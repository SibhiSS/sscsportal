import { useState, useEffect, createContext, useContext, ReactNode } from 'react';
import { supabase } from '@/lib/supabase';
import { User as SupabaseUser } from '@supabase/supabase-js';

interface User {
  email: string;
  displayName: string;
  photoURL: string;
  uid: string;
  role?: 'super_admin' | 'admin' | 'interviewer' | 'viewer';
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => void;
  loginAsLocalAdmin: () => void;
  logout: () => void;
  clearError: () => void;
}

/**
 * Identity used by the DEV-only local bypass.
 *
 * Set VITE_DEV_ADMIN_EMAIL in your local .env if you need it to match a real row in the
 * `admins` table. It is deliberately not a committee member's address: this is a public
 * repo, and the bypass grants super_admin in the UI.
 *
 * This only affects client-side state — RLS still evaluates the real (absent) JWT, so
 * database reads will fail regardless. It is a UI convenience, not an auth backdoor.
 */
const DEV_ADMIN = {
  email: import.meta.env.VITE_DEV_ADMIN_EMAIL || 'dev@vitstudent.ac.in',
  displayName: 'Local Dev Admin',
  photoURL: '',
  uid: 'local-dev-admin-uid',
  role: 'super_admin' as const,
};

// Create context
export const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Hook for child components to get the auth object ...
export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

// Provider component that wraps your app and makes auth object ... available to any child component that calls useAuth().
export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true); // Start loading true to check auth state
  const [error, setError] = useState<string | null>(null);

  // Monitor Supabase Auth State
  useEffect(() => {
    const validateAndSetUser = async (session: any) => {
      if (import.meta.env.DEV && localStorage.getItem('sscs_local_bypass') === 'true') {
        setUser(DEV_ADMIN);
        setLoading(false);
        return;
      }

      if (session?.user) {
        const email = session.user.email;
        const isHardcodedAdmin = email === 'sibhis5223@gmail.com';
        const isVitStudent = email?.endsWith('@vitstudent.ac.in');
        const isVitStaff = email?.endsWith('@vit.ac.in');

        if (!isHardcodedAdmin && !isVitStudent && !isVitStaff) {
          await supabase.auth.signOut();
          alert('Access Restricted: Please sign in with your VIT email address (@vitstudent.ac.in).');
          setUser(null);
        } else {
          // Fetch Role from DB. `admins.email` is matched case-insensitively here because
          // rows can be entered with inconsistent casing (e.g. pasted from a roster), while
          // OAuth always returns the email lowercased — a byte-exact match would silently
          // miss the row and downgrade a real admin to 'viewer'.
          const { data: adminData, error: adminLookupError } = await supabase
            .from('admins')
            .select('role')
            .ilike('email', email)
            .maybeSingle();

          if (adminLookupError) {
            console.error('[Auth] Admin role lookup failed:', adminLookupError.message);
          }

          // Use DB role if present, fallback to super_admin for exception email
          const role = adminData?.role || (isHardcodedAdmin ? 'super_admin' : 'viewer');
          const nextUser = {
            ...mapSupabaseUser(session.user),
            role
          };

          setUser(prev => {
            if (prev?.email === nextUser.email && prev?.role === nextUser.role) {
              return prev;
            }
            return nextUser;
          });
        }
      } else {
        setUser(null);
      }
      setLoading(false);
    };

    // Check active sessions and sets the user
    supabase.auth.getSession().then(({ data: { session } }) => {
      validateAndSetUser(session);
    });

    // Listen for changes on auth state (logged in, signed out, etc.)
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      validateAndSetUser(session);
    });

    return () => subscription.unsubscribe();
  }, []);

  const mapSupabaseUser = (sbUser: SupabaseUser): User => {
    return {
      email: sbUser.email || '',
      displayName: sbUser.user_metadata?.full_name || sbUser.user_metadata?.name || '',
      photoURL: sbUser.user_metadata?.avatar_url || sbUser.user_metadata?.picture || '',
      uid: sbUser.id,
    };
  };

  const signInWithGoogle = async () => {
    setLoading(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          // Supabase redirects back to the app after OAuth
          redirectTo: window.location.origin,
        }
      });
      if (error) throw error;
      // Redirect happens automatically
    } catch (err: any) {
      // FIX #14: Never log full error objects — they may contain token/session data.
      // FIX #13: Use generic message to prevent auth error enumeration.
      console.error('[Auth] Sign-in failed. Cause suppressed for security.');
      setError('Sign in failed. Please use your VIT email address and try again.');
      setLoading(false);
    }
  };

  const loginAsLocalAdmin = () => {
    if (import.meta.env.DEV) {
      localStorage.setItem('sscs_local_bypass', 'true');
      setUser(DEV_ADMIN);
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      localStorage.removeItem('sscs_local_bypass');
      // FIX #16 (Privacy/Frontend Security): Clear all user form draft data from localStorage
      // before signing out so sensitive PII is not left on shared/lab computers.
      const keys = Object.keys(localStorage).filter(k => k.startsWith('sscsFormData_'));
      keys.forEach(k => localStorage.removeItem(k));
      localStorage.removeItem('sscs_admin_view');

      const { error } = await supabase.auth.signOut();
      if (error) throw error;
      setUser(null);
    } catch (err: any) {
      // FIX #14: Don't log error objects that may contain session information.
      console.error('[Auth] Logout failed.');
      setError('Failed to log out. Please try again.');
    }
  };

  const clearError = () => {
    setError(null);
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        error,
        signInWithGoogle,
        loginAsLocalAdmin,
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

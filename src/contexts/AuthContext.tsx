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
  logout: () => void;
  clearError: () => void;
}

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
      if (session?.user) {
        const email = session.user.email;
        const isHardcodedAdmin = email === 'sibhi.s2024@vitstudent.ac.in';
        const isVitStudent = email?.endsWith('@vitstudent.ac.in');
        const isVitStaff = email?.endsWith('@vit.ac.in');

        if (!isHardcodedAdmin && !isVitStudent && !isVitStaff) {
          await supabase.auth.signOut();
          alert('Access Restricted: Please sign in with your VIT email address (@vitstudent.ac.in).');
          setUser(null);
        } else {
          // Fetch Role from DB
          const { data: adminData } = await supabase
            .from('admins')
            .select('role')
            .eq('email', email)
            .single();

          // Force super_admin for these two emails regardless of DB state
          const role = isHardcodedAdmin ? 'super_admin' : (adminData?.role || 'viewer');

          setUser({
            ...mapSupabaseUser(session.user),
            role
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
      });
      if (error) throw error;
      // Redirect happens automatically
    } catch (err: any) {
      console.error('Login error:', err);
      setError(err?.message || 'Failed to sign in. Please try again.');
      setLoading(false);
    }
  };

  const logout = async () => {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (err: any) {
      console.error('Logout error:', err);
      setError('Failed to log out.');
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
        logout,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

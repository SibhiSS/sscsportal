import { useState, useEffect, createContext, ReactNode } from 'react';
import { useGoogleLogin, googleLogout, TokenResponse } from '@react-oauth/google';
import axios from 'axios';

interface User {
  email: string;
  displayName: string;
  photoURL: string;
  uid: string;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  error: string | null;
  signInWithGoogle: () => void;
  logout: () => void;
  clearError: () => void;
}

export const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Check if user is already logged in (from localStorage)
  useEffect(() => {
    const savedUser = localStorage.getItem('IEEE_SSCS_user');
    if (savedUser) {
      try {
        setUser(JSON.parse(savedUser));
      } catch (err) {
        console.error('Failed to parse saved user:', err);
        localStorage.removeItem('IEEE_SSCS_user');
      }
    }
  }, []);

  const login = useGoogleLogin({
    onSuccess: async (tokenResponse: TokenResponse) => {
      try {
        setLoading(true);
        setError(null);

        // Get user info from Google
        const userInfoResponse = await axios.get(
          'https://www.googleapis.com/oauth2/v3/userinfo',
          {
            headers: { Authorization: `Bearer ${tokenResponse.access_token}` },
          }
        );

        const { email, name, picture, sub } = userInfoResponse.data;

        // Validate VIT email
        if (!email.endsWith('@vitstudent.ac.in')) {
          setError('Only @vitstudent.ac.in emails are allowed');
          setLoading(false);
          return;
        }

        // Create user object
        const userData: User = {
          email,
          displayName: name,
          photoURL: picture,
          uid: sub,
        };

        setUser(userData);
        localStorage.setItem('IEEE_SSCS_user', JSON.stringify(userData));
        setLoading(false);
      } catch (err: any) {
        console.error('Login error:', err);
        setError(err?.response?.data?.error || 'Failed to sign in. Please try again.');
        setLoading(false);
      }
    },
    onError: () => {
      setError('Login failed. Please try again.');
      setLoading(false);
    },
  });

  const signInWithGoogle = () => {
    setLoading(true);
    setError(null);
    login();
  };

  const logout = () => {
    googleLogout();
    setUser(null);
    localStorage.removeItem('IEEE_SSCS_user');
    setError(null);
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

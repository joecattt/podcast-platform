import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import {
  onAuthStateChanged,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut as fbSignOut,
  type User,
} from 'firebase/auth';
import { auth } from './firebase';

export const HOST_EMAIL = 'whitehat@joecattt.com';

export function isHost(user: User | null) {
  return !!user && !user.isAnonymous && user.email?.toLowerCase() === HOST_EMAIL;
}

interface AuthContextValue {
  user: User | null;
  loading: boolean;
  signInAsGuest: (displayName?: string) => Promise<User>;
  signInAsHost: (email: string, password: string) => Promise<User>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    return onAuthStateChanged(auth, (u) => {
      setUser(u);
      setLoading(false);
    });
  }, []);

  async function signInAsGuest() {
    const cred = await signInAnonymously(auth);
    return cred.user;
  }

  async function signInAsHost(email: string, password: string) {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    if (cred.user.email?.toLowerCase() !== HOST_EMAIL) {
      await fbSignOut(auth);
      throw new Error('This account is not authorized to host.');
    }
    return cred.user;
  }

  async function signOut() {
    await fbSignOut(auth);
  }

  return (
    <AuthContext.Provider value={{ user, loading, signInAsGuest, signInAsHost, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}

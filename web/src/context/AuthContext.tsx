import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode
} from 'react';
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  updateProfile as updateAuthProfile,
  type User
} from 'firebase/auth';
import { doc, onSnapshot, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { auth, db, isConfigured } from '../lib/firebase';
import type { UserProfile } from '../types';

interface AuthContextValue {
  user: User | null;
  profile: UserProfile | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signUpWithEmail: (email: string, password: string, name: string) => Promise<void>;
  signOut: () => Promise<void>;
  updateProfile: (patch: Partial<Pick<UserProfile, 'displayName' | 'targetLanguage' | 'voice'>>) => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isConfigured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthStateChanged(auth, (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setProfile(null);
        setLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  // Keep a live profile document in sync with the auth user.
  useEffect(() => {
    if (!user) return;

    const ref = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(
      ref,
      (snap) => {
        if (snap.exists()) {
          setProfile({ uid: user.uid, ...(snap.data() as Omit<UserProfile, 'uid'>) });
        } else {
          setProfile({
            uid: user.uid,
            email: user.email,
            displayName: user.displayName ?? user.email?.split('@')[0] ?? 'Speaker',
            photoURL: user.photoURL,
            targetLanguage: 'en-IN',
            voice: 'anushka',
            level: 'beginner',
            streakDays: 0
          });
        }
        setLoading(false);
      },
      () => setLoading(false)
    );

    return unsubscribe;
  }, [user]);

  const ensureProfile = useCallback(async (nextUser: User, name?: string) => {
    const ref = doc(db, 'users', nextUser.uid);
    await setDoc(
      ref,
      {
        uid: nextUser.uid,
        email: nextUser.email ?? null,
        displayName: name ?? nextUser.displayName ?? nextUser.email?.split('@')[0] ?? 'Speaker',
        photoURL: nextUser.photoURL ?? null,
        targetLanguage: 'en-IN',
        voice: 'anushka',
        level: 'beginner',
        streakDays: 0,
        createdAt: serverTimestamp(),
        lastActiveAt: serverTimestamp()
      },
      { merge: true }
    );
  }, []);

  const signInWithGoogle = useCallback(async () => {
    const provider = new GoogleAuthProvider();
    const credential = await signInWithPopup(auth, provider);
    await ensureProfile(credential.user);
  }, [ensureProfile]);

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  }, []);

  const signUpWithEmail = useCallback(
    async (email: string, password: string, name: string) => {
      const credential = await createUserWithEmailAndPassword(auth, email, password);
      if (name.trim()) await updateAuthProfile(credential.user, { displayName: name.trim() });
      await ensureProfile(credential.user, name.trim());
    },
    [ensureProfile]
  );

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const updateProfile = useCallback(
    async (patch: Partial<Pick<UserProfile, 'displayName' | 'targetLanguage' | 'voice'>>) => {
      if (!user) return;
      await updateDoc(doc(db, 'users', user.uid), { ...patch, lastActiveAt: serverTimestamp() });
    },
    [user]
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      profile,
      loading,
      signInWithGoogle,
      signInWithEmail,
      signUpWithEmail,
      signOut,
      updateProfile
    }),
    [user, profile, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, signOut, updateProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}

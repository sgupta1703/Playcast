import React, { createContext, useEffect, useState, useContext } from "react";
import { auth, db } from "../firebase";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signOut as firebaseSignOut,
  User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";

type AuthContextType = {
  user: User | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  preferredSports: string[];
  setPreferredSports: (sports: string[]) => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [preferredSports, setPreferredSportsState] = useState<string[]>([]);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      setUser(u);
      setLoading(true);
      if (u) {
        try {
          const userDocRef = doc(db, "users", u.uid);
          const snap = await getDoc(userDocRef);
          if (snap.exists()) {
            const data = snap.data();
            setPreferredSportsState(Array.isArray(data?.preferredSports) ? data.preferredSports : []);
          } else {
            setPreferredSportsState([]);
          }
        } catch (e) {
          console.warn("Failed to fetch user prefs:", e);
          setPreferredSportsState([]);
        }
      } else {
        setPreferredSportsState([]);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const setPreferredSports = async (sports: string[]) => {
    setPreferredSportsState(sports);
    if (!user) return;
    try {
      const userDocRef = doc(db, "users", user.uid);
      await setDoc(
        userDocRef,
        {
          preferredSports: sports,
        },
        { merge: true }
      );
    } catch (e) {
      console.warn("Failed to save preferredSports:", e);
      throw e;
    }
  };

  const signIn = async (email: string, password: string) => {
    setLoading(true);
    try {
      await signInWithEmailAndPassword(auth, email, password);
    } finally {
      setLoading(false);
    }
  };

  const signUp = async (email: string, password: string) => {
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email, password);
      try {
        const userDocRef = doc(db, "users", cred.user.uid);
        await setDoc(userDocRef, { preferredSports: [] }, { merge: true });
        setPreferredSportsState([]);
      } catch (e) {
        console.warn("Failed to create user doc:", e);
      }
    } finally {
      setLoading(false);
    }
  };

  const signOut = async () => {
    setLoading(true);
    try {
      await firebaseSignOut(auth);
      setPreferredSportsState([]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        signIn,
        signUp,
        signOut,
        preferredSports,
        setPreferredSports,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuthContext must be used within AuthProvider");
  return ctx;
}

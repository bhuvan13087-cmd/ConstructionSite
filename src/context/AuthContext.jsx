import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthChange, signOutUser } from "../firebase/auth";
import { getUserProfile, createUserProfile } from "../services/firebaseService";
import { isFirebaseConfigured } from "../firebase/config";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [userProfile, setUserProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(isFirebaseConfigured());

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const unsubscribe = onAuthChange(async (firebaseUser) => {
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          let profile = await getUserProfile(firebaseUser.uid);
          if (!profile && firebaseUser.email === "admin@gmail.com") {
            // Auto-provision admin user profile in Firestore if it doesn't exist
            const adminProfile = {
              fullName: "Admin",
              username: "admin",
              role: "admin",
              status: "active",
              email: firebaseUser.email,
              isFirstLogin: false
            };
            await createUserProfile(firebaseUser.uid, adminProfile);
            profile = await getUserProfile(firebaseUser.uid);
          }
          setUserProfile(profile);
        } catch (err) {
          console.error("Auth Listener Error fetching profile:", err);
          setUserProfile(null);
        }
      } else {
        setUser(null);
        setUserProfile(null);
      }
      setLoading(false);
    });

    return () => unsubscribe();
  }, [configured]);

  const logout = async () => {
    localStorage.removeItem("is_logged_in");
    await signOutUser();
    setUser(null);
    setUserProfile(null);
  };

  const recheckConfig = () => {
    setConfigured(isFirebaseConfigured());
  };

  const value = {
    user,
    userProfile,
    loading,
    configured,
    recheckConfig,
    logout,
    setUserProfile
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}

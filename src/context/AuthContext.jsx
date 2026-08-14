import React, { createContext, useContext, useState, useEffect } from "react";
import { onAuthChange, signOutUser } from "../firebase/auth";
import { getUserProfile, createUserProfile, logSystemActivity, subscribeToUserProfile } from "../services/firebaseService";
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

    let unsubProfile = null;
    const unsubscribe = onAuthChange((firebaseUser) => {
      if (unsubProfile) {
        unsubProfile();
        unsubProfile = null;
      }

      if (firebaseUser) {
        setLoading(true);
        unsubProfile = subscribeToUserProfile(firebaseUser.uid, async (profile) => {
          try {
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
              return;
            }

            if (!profile || profile.status !== "active") {
              // Force sign out invalid or inactive users immediately
              if (unsubProfile) {
                unsubProfile();
                unsubProfile = null;
              }
              await signOutUser();
              setUser(null);
              setUserProfile(null);
              setLoading(false);
              return;
            }

            setUser(firebaseUser);
            setUserProfile(profile);
          } catch (err) {
            console.error("Auth Listener Error fetching profile:", err);
            setUser(null);
            setUserProfile(null);
          } finally {
            setLoading(false);
          }
        });
      } else {
        setUser(null);
        setUserProfile(null);
        setLoading(false);
      }
    });

    return () => {
      unsubscribe();
      if (unsubProfile) unsubProfile();
    };
  }, [configured]);

  const logout = async () => {
    try {
      await signOutUser();
    } catch (err) {
      console.error("Logout error:", err);
    }
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

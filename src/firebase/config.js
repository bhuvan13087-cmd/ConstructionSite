import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";

let firebaseApp = null;
let secondaryApp = null;
let dbInstance = null;

import { firebaseConfig as importedConfig } from "../../env.js";

const metaEnv = (typeof import.meta !== "undefined" && import.meta && import.meta.env) ? import.meta.env : {};

export const firebaseConfig = {
  apiKey: metaEnv.VITE_FIREBASE_API_KEY || importedConfig?.apiKey,
  googleMapsApiKey: metaEnv.VITE_GOOGLE_MAPS_API_KEY || importedConfig?.googleMapsApiKey || importedConfig?.apiKey,
  authDomain: metaEnv.VITE_FIREBASE_AUTH_DOMAIN || importedConfig?.authDomain,
  projectId: metaEnv.VITE_FIREBASE_PROJECT_ID || importedConfig?.projectId,
  storageBucket: metaEnv.VITE_FIREBASE_STORAGE_BUCKET || importedConfig?.storageBucket,
  messagingSenderId: metaEnv.VITE_FIREBASE_MESSAGING_SENDER_ID || importedConfig?.messagingSenderId,
  appId: metaEnv.VITE_FIREBASE_APP_ID || importedConfig?.appId,
};

export const isProject2 = firebaseConfig?.projectId === "civilconstructionsite2";
export const defaultAdminEmail = isProject2 ? "admin2@gmail.com" : "admin@gmail.com";

// Check if config exists
export function getStoredConfig() {
  return firebaseConfig;
}

// Check if Firebase is configured
export function isFirebaseConfigured() {
  return (
    firebaseConfig && 
    firebaseConfig.apiKey && 
    firebaseConfig.apiKey !== "YOUR_API_KEY_HERE" && 
    firebaseConfig.apiKey !== ""
  );
}

// Initialize Firebase App and secondary instances
export function initFirebase(config) {
  try {
    if (getApps().length === 0) {
      firebaseApp = initializeApp(config);
    } else {
      firebaseApp = getApp();
    }

    const secondaryAppName = "SecondaryApp";
    const existingApps = getApps();
    const secondaryAppExists = existingApps.some(app => app.name === secondaryAppName);
    if (!secondaryAppExists) {
      secondaryApp = initializeApp(config, secondaryAppName);
    } else {
      secondaryApp = getApp(secondaryAppName);
    }

    return true;
  } catch (err) {
    console.error("Firebase Initialization Error:", err);
    throw err;
  }
}

// Auto-initialize if config is present
try {
  initFirebase(firebaseConfig);
} catch (err) {
  console.error("Auto-initialization of Firebase failed:", err);
}

// Getter for main Auth
export function getFirebaseAuth() {
  if (!firebaseApp) {
    initFirebase(firebaseConfig);
  }
  return getAuth(firebaseApp);
}

// Getter for Firestore
export function getFirebaseDb() {
  if (!firebaseApp) {
    initFirebase(firebaseConfig);
  }
  if (!dbInstance) {
    try {
      dbInstance = initializeFirestore(firebaseApp, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager()
        })
      });
    } catch (e) {
      console.warn("Firestore offline cache initialization notice:", e);
      try {
        dbInstance = getFirestore(firebaseApp);
      } catch (err) {
        console.error("Firestore fallback initialization failed:", err);
      }
    }
  }
  return dbInstance;
}

// Getter for secondary Auth (used to create engineer accounts without logging out admin)
export function getSecondaryAuth() {
  if (!secondaryApp) {
    initFirebase(firebaseConfig);
  }
  return getAuth(secondaryApp);
}

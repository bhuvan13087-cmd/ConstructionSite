import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

let firebaseApp = null;
let secondaryApp = null;

// Hardcoded Firebase configuration parameters
export const firebaseConfig = {
  apiKey: "AIzaSyBna0WHr527cwXcE76Ek-Nmomq4ayYhZDQ",
  authDomain: "studio-7044154747-fb0fa.firebaseapp.com",
  projectId: "studio-7044154747-fb0fa",
  storageBucket: "studio-7044154747-fb0fa.firebasestorage.app",
  messagingSenderId: "201376845036",
  appId: "1:201376845036:web:d50fb937ecc740e480e9c9"
};

// Check if config exists
export function getStoredConfig() {
  return firebaseConfig;
}

// Check if Firebase is configured
export function isFirebaseConfigured() {
  return true;
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
  return getFirestore(firebaseApp);
}

// Getter for secondary Auth (used to create engineer accounts without logging out admin)
export function getSecondaryAuth() {
  if (!secondaryApp) {
    initFirebase(firebaseConfig);
  }
  return getAuth(secondaryApp);
}

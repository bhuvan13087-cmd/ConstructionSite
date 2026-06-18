import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword
} from "firebase/auth";
import { getFirebaseAuth, getSecondaryAuth } from "./config";

// Sign in with email and password (main App)
export async function signIn(email, password) {
  const auth = getFirebaseAuth();
  return signInWithEmailAndPassword(auth, email, password);
}

// Create user with email and password (main App, e.g. Admin creation)
export async function signUp(email, password) {
  const auth = getFirebaseAuth();
  return createUserWithEmailAndPassword(auth, email, password);
}

// Sign out from main App
export async function signOutUser() {
  const auth = getFirebaseAuth();
  return signOut(auth);
}

// Listen to auth state changes
export function onAuthChange(callback) {
  const auth = getFirebaseAuth();
  return onAuthStateChanged(auth, callback);
}

// Create a user account on the secondary App without signing out the current admin
export async function registerEngineerAuth(email, password) {
  const secondaryAuth = getSecondaryAuth();
  const userCredential = await createUserWithEmailAndPassword(secondaryAuth, email, password);
  // Sign out secondary app session immediately to prevent caching conflicts
  await signOut(secondaryAuth);
  return userCredential.user;
}

// Send password reset email
export async function sendEngineerPasswordReset(email) {
  const auth = getFirebaseAuth();
  return sendPasswordResetEmail(auth, email);
}

// Update password on secondary auth instance by signing in first
export async function updateEngineerPasswordAuth(email, currentPassword, newPassword) {
  const secondaryAuth = getSecondaryAuth();
  // Sign in secondary app session to authenticate the user
  const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, currentPassword);
  // Update password
  await updatePassword(userCredential.user, newPassword);
  // Sign out secondary app session immediately to prevent caching conflicts
  await signOut(secondaryAuth);
}


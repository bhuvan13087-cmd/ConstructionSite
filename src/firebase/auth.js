import { 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  signOut, 
  onAuthStateChanged,
  sendPasswordResetEmail,
  updatePassword,
  updateEmail,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  setPersistence,
  browserLocalPersistence
} from "firebase/auth";
import { getFirebaseAuth, getSecondaryAuth } from "./config";

// Sign in with email and password (main App)
export async function signIn(email, password) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
  return signInWithEmailAndPassword(auth, email, password);
}

// Create user with email and password (main App, e.g. Admin creation)
export async function signUp(email, password) {
  const auth = getFirebaseAuth();
  await setPersistence(auth, browserLocalPersistence);
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

/**
 * Change password for the currently authenticated user in Firebase Authentication.
 * Re-authenticates the current user using their email and current password,
 * then securely updates the password to newPassword.
 * 
 * @param {string} currentPassword - The user's current password
 * @param {string} newPassword - The new password
 * @returns {Promise<void>}
 */
export async function changeCurrentUserPassword(currentPassword, newPassword) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user || !user.email) {
    throw new Error("No active authenticated session found. Please log in again.");
  }

  if (!currentPassword || !currentPassword.trim()) {
    throw new Error("Current password is required.");
  }

  if (!newPassword || newPassword.length < 6) {
    throw new Error("New password must be at least 6 characters long.");
  }

  if (currentPassword === newPassword) {
    throw new Error("New password must be different from your current password.");
  }

  // 1. Create credential with user's email and current password
  const credential = EmailAuthProvider.credential(user.email, currentPassword);

  // 2. Re-authenticate user
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/invalid-password") {
      throw new Error("Incorrect current password. Please verify and try again.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed attempts. Please wait a few moments and try again.");
    } else if (error.code === "auth/user-mismatch") {
      throw new Error("Authenticated user mismatch. Please reload and try again.");
    } else if (error.code === "auth/requires-recent-login") {
      throw new Error("Session expired. Please log out and sign in again to change your password.");
    }
    throw new Error(error.message || "Failed to verify current password.");
  }

  // 3. Update password in Firebase Authentication
  try {
    await updatePassword(user, newPassword);
  } catch (error) {
    if (error.code === "auth/weak-password") {
      throw new Error("New password is too weak. Please choose a stronger password.");
    } else if (error.code === "auth/requires-recent-login") {
      throw new Error("Please log in again before changing your password.");
    }
    throw new Error(error.message || "Failed to update password.");
  }
}

/**
 * Update authenticated user's email address in Firebase Authentication.
 * If newEmail !== user.email, re-authenticates the user with currentPassword
 * and updates their authentication email.
 * 
 * @param {string} newEmail - New email address
 * @param {string} currentPassword - Current password required for re-authentication
 * @returns {Promise<void>}
 */
export async function changeCurrentUserEmail(newEmail, currentPassword) {
  const auth = getFirebaseAuth();
  const user = auth.currentUser;
  if (!user) {
    throw new Error("No active authenticated session found. Please log in again.");
  }

  const trimmedEmail = (newEmail || "").trim().toLowerCase();
  if (!trimmedEmail) {
    throw new Error("Email address is required.");
  }

  if (trimmedEmail === user.email?.toLowerCase()) {
    return; // Email is unchanged
  }

  if (!currentPassword || !currentPassword.trim()) {
    throw new Error("Current password is required to update your account email address.");
  }

  // 1. Re-authenticate user
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  try {
    await reauthenticateWithCredential(user, credential);
  } catch (error) {
    if (error.code === "auth/invalid-credential" || error.code === "auth/wrong-password" || error.code === "auth/invalid-password") {
      throw new Error("Incorrect current password. Password verification is required to update your email.");
    } else if (error.code === "auth/too-many-requests") {
      throw new Error("Too many failed attempts. Please wait a few moments and try again.");
    }
    throw new Error(error.message || "Failed to verify current password for email update.");
  }

  // 2. Update email in Firebase Authentication
  try {
    if (typeof verifyBeforeUpdateEmail === "function") {
      try {
        await verifyBeforeUpdateEmail(user, trimmedEmail);
      } catch (err) {
        // Fallback to updateEmail if verifyBeforeUpdateEmail is not supported by environment
        await updateEmail(user, trimmedEmail);
      }
    } else {
      await updateEmail(user, trimmedEmail);
    }
  } catch (error) {
    if (error.code === "auth/email-already-in-use") {
      throw new Error("This email address is already in use by another account.");
    } else if (error.code === "auth/invalid-email") {
      throw new Error("Please enter a valid email address.");
    } else if (error.code === "auth/requires-recent-login") {
      throw new Error("Session expired. Please sign in again before updating your email.");
    }
    throw new Error(error.message || "Failed to update email address.");
  }
}


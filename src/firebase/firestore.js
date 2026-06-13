import { getFirebaseDb } from "./config";

// Lazy getter for the Firestore database instance
export function getDb() {
  return getFirebaseDb();
}

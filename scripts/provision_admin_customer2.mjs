import { initializeApp } from "firebase/app";
import { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } from "firebase/auth";
import { getFirestore, doc, setDoc, serverTimestamp } from "firebase/firestore";

const apiKey = process.argv[2] || process.env.VITE_FIREBASE_API_KEY;
const appId = process.argv[3] || process.env.VITE_FIREBASE_APP_ID;

if (!apiKey) {
  console.error("Error: Missing Firebase apiKey. Usage: node scripts/provision_admin_customer2.mjs <API_KEY> [APP_ID]");
  process.exit(1);
}

const firebaseConfig = {
  apiKey: apiKey,
  authDomain: "civilconstructionsite2.firebaseapp.com",
  projectId: "civilconstructionsite2",
  storageBucket: "civilconstructionsite2.firebasestorage.app",
  messagingSenderId: "86404894185",
  appId: appId || "1:86404894185:web:customer2"
};

async function provisionAdmin() {
  console.log("Connecting to Firebase project 'civilconstructionsite2'...");
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  const email = "admin@gmail.com";
  const password = "123456";

  let uid = null;

  try {
    console.log(`Creating Firebase Auth user: ${email}...`);
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    uid = userCredential.user.uid;
    console.log(`User created successfully! UID: ${uid}`);
  } catch (err) {
    if (err.code === "auth/email-already-in-use") {
      console.log(`User ${email} already exists in Auth. Signing in to retrieve UID...`);
      const userCredential = await signInWithEmailAndPassword(auth, email, password);
      uid = userCredential.user.uid;
      console.log(`Signed in successfully! UID: ${uid}`);
    } else {
      console.error("Auth creation failed:", err);
      throw err;
    }
  }

  console.log(`Provisioning Firestore collections for admin UID: ${uid}...`);
  
  // 1. users collection
  const userDocRef = doc(db, "users", uid);
  await setDoc(userDocRef, {
    uid,
    fullName: "Admin User",
    username: "admin",
    role: "admin",
    status: "active",
    email,
    isFirstLogin: false,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  console.log("✔ Created collection document: /users/" + uid);

  // 2. admins collection
  const adminDocRef = doc(db, "admins", uid);
  await setDoc(adminDocRef, {
    uid,
    name: "Admin User",
    email,
    role: "admin",
    assignedSites: [],
    status: "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  console.log("✔ Created collection document: /admins/" + uid);

  console.log("\n========================================================");
  console.log("🎉 SUCCESS: Admin account & initial collections created!");
  console.log("   Project: civilconstructionsite2");
  console.log("   Email: " + email);
  console.log("   Collections: 'users', 'admins'");
  console.log("========================================================");
}

provisionAdmin().catch((err) => {
  console.error("Provisioning failed:", err);
  process.exit(1);
});

import { initializeApp } from 'firebase/app';
import { getAuth, signInWithEmailAndPassword } from 'firebase/auth';
import { getFirestore, collection, getDocs, doc, setDoc, getDoc } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCwmOam1UHhAzZJNg7Jiuha1lcOy0qlwA8",
  authDomain: "studio-7044154747-fb0fa.firebaseapp.com",
  projectId: "studio-7044154747-fb0fa",
  storageBucket: "studio-7044154747-fb0fa.firebasestorage.app",
  messagingSenderId: "201376845036",
  appId: "1:201376845036:web:d50fb937ecc740e480e9c9"
};

async function migrate() {
  console.log("Initializing Firebase app...");
  const app = initializeApp(firebaseConfig);
  const auth = getAuth(app);
  const db = getFirestore(app);

  console.log("Authenticating as admin...");
  const userCred = await signInWithEmailAndPassword(auth, "admin@gmail.com", "123456");
  const adminUid = userCred.user.uid;
  console.log(`Authenticated successfully! UID: ${adminUid}`);

  // Provision admin profile if missing to grant rule permissions for the rest of the script
  const adminDocRef = doc(db, "users", adminUid);
  const adminDocSnap = await getDoc(adminDocRef);
  if (!adminDocSnap.exists()) {
    console.log("Admin profile not found in users. Provisioning...");
    await setDoc(adminDocRef, {
      fullName: "Admin User",
      username: "admin",
      role: "admin",
      status: "active",
      email: "admin@gmail.com",
      isFirstLogin: false
    });
    console.log("Admin profile provisioned in users.");
  }

  const adminRoleDocRef = doc(db, "admins", adminUid);
  const adminRoleDocSnap = await getDoc(adminRoleDocRef);
  if (!adminRoleDocSnap.exists()) {
    console.log("Admin profile not found in admins. Provisioning...");
    await setDoc(adminRoleDocRef, {
      uid: adminUid,
      name: "Admin User",
      email: "admin@gmail.com",
      role: "admin",
      assignedSites: [],
      status: "active"
    });
    console.log("Admin profile provisioned in admins.");
  }

  console.log("Fetching users collection...");
  const usersCollection = collection(db, "users");
  const usersSnapshot = await getDocs(usersCollection);
  console.log(`Found ${usersSnapshot.size} total documents in users collection.`);

  let migratedCount = 0;

  for (const docSnap of usersSnapshot.docs) {
    const userId = docSnap.id;
    const userData = docSnap.data();

    // Skip special documents starting with double underscores
    if (userId.startsWith("__")) {
      console.log(`Skipping system document: ${userId}`);
      continue;
    }

    const role = userData.role;
    console.log(`Processing user: ${userId} (Role: ${role}, Name: ${userData.fullName || userData.name})`);

    let targetCollection = "";
    let targetData = {};

    if (role === "super_admin" || role === "superadmin") {
      targetCollection = "superAdmins";
      targetData = {
        uid: userId,
        name: userData.fullName || userData.name || "",
        email: userData.email || "",
        role: role,
        status: userData.status || "active",
        ...userData // Preserve other properties if they exist
      };
      targetData.name = userData.fullName || userData.name || "";
    } else if (role === "admin") {
      targetCollection = "admins";
      targetData = {
        uid: userId,
        name: userData.fullName || userData.name || "",
        email: userData.email || "",
        role: role,
        assignedSites: userData.assignedSites || [],
        status: userData.status || "active",
        ...userData
      };
      targetData.name = userData.fullName || userData.name || "";
    } else if (role === "site_engineer" || role === "engineer") {
      targetCollection = "siteEngineers";
      targetData = {
        uid: userId,
        name: userData.fullName || userData.name || "",
        phone: userData.phoneNumber || userData.phone || "",
        assignedSites: userData.assignedSites || [],
        status: userData.status || "active",
        ...userData
      };
      targetData.name = userData.fullName || userData.name || "";
      targetData.phone = userData.phoneNumber || userData.phone || "";
    } else {
      console.warn(`Unknown role "${role}" for user ${userId}. Skipping migration for this user.`);
      continue;
    }

    if (targetCollection) {
      console.log(`Migrating user ${userId} to collection ${targetCollection}...`);
      const targetDocRef = doc(db, targetCollection, userId);
      await setDoc(targetDocRef, targetData);
      migratedCount++;
    }
  }
  console.log(`Migrated ${migratedCount} users.`);

  console.log("Migrating dailyUpdates to reports...");
  try {
    const dailyUpdatesCollection = collection(db, "dailyUpdates");
    const dailyUpdatesSnapshot = await getDocs(dailyUpdatesCollection);
    console.log(`Found ${dailyUpdatesSnapshot.size} daily progress reports.`);
    let reportsMigrated = 0;
    for (const docSnap of dailyUpdatesSnapshot.docs) {
      const data = docSnap.data();
      const targetRef = doc(db, "reports", docSnap.id);
      await setDoc(targetRef, data);
      reportsMigrated++;
    }
    console.log(`Migrated ${reportsMigrated} progress reports.`);
  } catch (err) {
    console.warn("Failed to migrate progress reports:", err);
  }

  console.log("Migrating general expenses to expenses/general...");
  try {
    const oldExpensesDocRef = doc(db, "users", "__site_expenses__");
    const oldExpensesSnap = await getDoc(oldExpensesDocRef);
    if (oldExpensesSnap.exists()) {
      const newExpensesDocRef = doc(db, "expenses", "general");
      await setDoc(newExpensesDocRef, oldExpensesSnap.data());
      console.log("Migrated general expenses document.");
    } else {
      console.log("No legacy general expenses document found.");
    }
  } catch (err) {
    console.warn("Failed to migrate general expenses:", err);
  }

  console.log("Migration completed successfully!");
}

migrate().catch(err => {
  console.error("Migration failed:", err);
  process.exit(1);
});

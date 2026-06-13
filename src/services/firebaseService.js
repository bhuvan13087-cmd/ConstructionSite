import { 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  serverTimestamp,
  writeBatch,
  arrayUnion,
  arrayRemove
} from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";

// Lazy getter for the Firestore database instance
function getDb() {
  return getFirebaseDb();
}

// ==========================================================================
// USER & SITE ENGINEER PROFILE SERVICES
// ==========================================================================

// Get a user profile by UID
export async function getUserProfile(uid) {
  const db = getDb();
  const userDocRef = doc(db, "users", uid);
  const userDoc = await getDoc(userDocRef);
  if (userDoc.exists()) {
    return userDoc.data();
  }
  return null;
}

// Create a user profile (e.g. for Admin or Engineer)
export async function createUserProfile(uid, profileData) {
  const db = getDb();
  const userDocRef = doc(db, "users", uid);
  await setDoc(userDocRef, {
    ...profileData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// Update user profile fields (e.g. lastLogin)
export async function updateUserProfile(uid, updateData) {
  const db = getDb();
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    ...updateData,
    updatedAt: serverTimestamp()
  });
}

// Fetch all registered site engineers
export async function getSiteEngineers() {
  const db = getDb();
  const usersCollection = collection(db, "users");
  const q = query(usersCollection, where("role", "==", "site_engineer"));
  const querySnapshot = await getDocs(q);
  
  const engineers = [];
  querySnapshot.forEach(doc => {
    engineers.push({ id: doc.id, ...doc.data() });
  });
  return engineers;
}

// Update status of site engineer
export async function updateEngineerStatus(uid, status) {
  const db = getDb();
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    status,
    updatedAt: serverTimestamp()
  });
}

// Register or update site engineer user record in Firestore along with site updates
export async function saveSiteEngineerProfile(id, name, email, phone, selectedSites, isEditMode, oldSites = []) {
  const db = getDb();
  const batch = writeBatch(db);
  const userDocRef = doc(db, "users", id);
  
  if (isEditMode) {
    batch.update(userDocRef, {
      fullName: name,
      phoneNumber: phone,
      assignedSites: selectedSites,
      updatedAt: serverTimestamp()
    });
    
    // Clear former site assignments
    oldSites.forEach(siteId => {
      const siteDocRef = doc(db, "sites", siteId);
      batch.update(siteDocRef, {
        assignedEngineers: arrayRemove(id)
      });
    });
    
    // Apply new site assignments
    selectedSites.forEach(siteId => {
      const siteDocRef = doc(db, "sites", siteId);
      batch.update(siteDocRef, {
        assignedEngineers: arrayUnion(id)
      });
    });
  } else {
    // Create Mode: Register profile document
    batch.set(userDocRef, {
      fullName: name,
      email: email,
      phoneNumber: phone,
      role: "site_engineer",
      status: "active",
      assignedSites: selectedSites,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
    
    // Apply site assignments
    selectedSites.forEach(siteId => {
      const siteDocRef = doc(db, "sites", siteId);
      batch.update(siteDocRef, {
        assignedEngineers: arrayUnion(id)
      });
    });
  }
  
  await batch.commit();
}

// ==========================================================================
// CONSTRUCTION SITE SERVICES
// ==========================================================================

// Seed default sites if collection is empty
export async function seedDefaultSites() {
  const db = getDb();
  const sitesCollection = collection(db, "sites");
  const sitesSnapshot = await getDocs(sitesCollection);
  
  if (sitesSnapshot.empty) {
    console.log("Seeding default sites...");
    const batch = writeBatch(db);
    const defaultSites = [
      { id: "site_a", name: "Greenwood Apartments", location: "Sector 45", status: "active" },
      { id: "site_b", name: "Metro Station Phase 2", location: "Central Line", status: "active" },
      { id: "site_c", name: "Downtown Office Tower", location: "Business District", status: "active" },
      { id: "site_d", name: "Highway Overpass Project", location: "Outer Ring Road", status: "active" }
    ];
    
    defaultSites.forEach(site => {
      const docRef = doc(db, "sites", site.id);
      batch.set(docRef, {
        siteName: site.name,
        location: site.location,
        status: site.status,
        assignedEngineers: [],
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp()
      });
    });
    
    await batch.commit();
    console.log("Default sites seeded successfully!");
    return true;
  }
  return false;
}

// Fetch all construction sites
export async function getSites() {
  const db = getDb();
  const sitesCollection = collection(db, "sites");
  const sitesSnapshot = await getDocs(sitesCollection);
  
  const sites = [];
  sitesSnapshot.forEach(doc => {
    sites.push({ id: doc.id, ...doc.data() });
  });
  return sites;
}

// Create a new construction site document
export async function createSite(siteName, location, status, assignedEngineers) {
  const db = getDb();
  const batch = writeBatch(db);
  
  const newSiteRef = doc(collection(db, "sites"));
  const siteId = newSiteRef.id;

  // 1. Create site document
  batch.set(newSiteRef, {
    siteName,
    location,
    status,
    assignedEngineers,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // 2. Add siteId to the engineers' assignedSites list
  assignedEngineers.forEach(engId => {
    const userDocRef = doc(db, "users", engId);
    batch.update(userDocRef, {
      assignedSites: arrayUnion(siteId)
    });
  });

  await batch.commit();
}

// Update site details and sync engineer assignments
export async function updateSite(siteId, siteName, location, status, assignedEngineers, oldEngineers = []) {
  const db = getDb();
  const batch = writeBatch(db);
  const siteDocRef = doc(db, "sites", siteId);

  // 1. Update site details
  batch.update(siteDocRef, {
    siteName,
    location,
    status,
    assignedEngineers,
    updatedAt: serverTimestamp()
  });

  // 2. Identify additions and removals
  const added = assignedEngineers.filter(id => !oldEngineers.includes(id));
  const removed = oldEngineers.filter(id => !assignedEngineers.includes(id));

  // 3. Remove siteId from removed engineers
  removed.forEach(engId => {
    const userDocRef = doc(db, "users", engId);
    batch.update(userDocRef, {
      assignedSites: arrayRemove(siteId)
    });
  });

  // 4. Add siteId to added engineers
  added.forEach(engId => {
    const userDocRef = doc(db, "users", engId);
    batch.update(userDocRef, {
      assignedSites: arrayUnion(siteId)
    });
  });

  await batch.commit();
}

// Delete site document and sync engineer assignments
export async function deleteSite(siteId, assignedEngineers = []) {
  const db = getDb();
  const batch = writeBatch(db);
  const siteDocRef = doc(db, "sites", siteId);

  // 1. Delete site document
  batch.delete(siteDocRef);

  // 2. Remove siteId association from engineers
  assignedEngineers.forEach(engId => {
    const userDocRef = doc(db, "users", engId);
    batch.update(userDocRef, {
      assignedSites: arrayRemove(siteId)
    });
  });

  await batch.commit();
}

// ==========================================================================
// METRICS & ANALYTICS SERVICES
// ==========================================================================

// Load metric counts for Admin Dashboard
export async function getDashboardMetrics() {
  const db = getDb();
  
  let totalSitesCount = 0;
  let activeEngineersCount = 0;
  let attendanceTodayCount = 0;
  let totalExpensesSum = 0;
  let dailyUpdatesCount = 0;

  try {
    const sitesSnap = await getDocs(collection(db, "sites"));
    totalSitesCount = sitesSnap.size;

    const engineersQuery = query(
      collection(db, "users"), 
      where("role", "==", "site_engineer"), 
      where("status", "==", "active")
    );
    const engineersSnap = await getDocs(engineersQuery);
    activeEngineersCount = engineersSnap.size;

    const todayStr = new Date().toISOString().split("T")[0];
    const attendanceQuery = query(
      collection(db, "attendance"),
      where("date", "==", todayStr)
    );
    const attendanceSnap = await getDocs(attendanceQuery);
    attendanceTodayCount = attendanceSnap.size;

    const expensesSnap = await getDocs(collection(db, "expenses"));
    expensesSnap.forEach(doc => {
      const amt = Number(doc.data().amount);
      if (!isNaN(amt)) {
        totalExpensesSum += amt;
      }
    });

    const updatesSnap = await getDocs(collection(db, "dailyUpdates"));
    dailyUpdatesCount = updatesSnap.size;
  } catch (err) {
    console.warn("Metrics Query Warning (could be empty collections):", err);
  }

  return {
    totalSites: totalSitesCount,
    activeEngineers: activeEngineersCount,
    attendanceToday: attendanceTodayCount,
    totalExpenses: totalExpensesSum,
    dailyUpdates: dailyUpdatesCount
  };
}

// Fetch today's progress updates for the engineer's assigned sites
export async function getTodayUpdates(siteIds) {
  if (!siteIds || siteIds.length === 0) return [];
  const db = getDb();
  const todayStr = new Date().toISOString().split("T")[0];
  const updates = [];
  
  // Chunk queries into groups of 30 due to Firestore IN query limit
  const chunks = [];
  for (let i = 0; i < siteIds.length; i += 30) {
    chunks.push(siteIds.slice(i, i + 30));
  }
  
  for (const chunk of chunks) {
    const q = query(
      collection(db, "dailyUpdates"),
      where("date", "==", todayStr),
      where("siteId", "in", chunk)
    );
    const snap = await getDocs(q);
    snap.forEach(doc => {
      updates.push({ id: doc.id, ...doc.data() });
    });
  }
  return updates;
}

// Save or overwrite a daily progress log for a site
export async function saveDailyUpdate(updateData) {
  const db = getDb();
  const docId = `${updateData.siteId}_${updateData.date}`;
  const docRef = doc(db, "dailyUpdates", docId);
  await setDoc(docRef, {
    ...updateData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}


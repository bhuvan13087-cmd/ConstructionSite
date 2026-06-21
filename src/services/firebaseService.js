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
import { getFirebaseDb, getSecondaryAuth } from "../firebase/config";
import { signInWithEmailAndPassword, deleteUser, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";

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
    return { uid, id: uid, ...userDoc.data() };
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
export async function saveSiteEngineerProfile(id, name, email, phone, selectedSites, isEditMode, oldSites = [], holidayAllowance = 24, password = "") {
  const db = getDb();
  const batch = writeBatch(db);
  const userDocRef = doc(db, "users", id);
  
  if (isEditMode) {
    batch.update(userDocRef, {
      fullName: name,
      phoneNumber: phone,
      assignedSites: selectedSites,
      holidayAllowance: Number(holidayAllowance) || 24,
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
      holidayAllowance: Number(holidayAllowance) || 24,
      password: password,
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

// Update password field for an engineer in Firestore database
export async function updateEngineerPasswordInDb(uid, newPassword) {
  const db = getDb();
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    password: newPassword,
    updatedAt: serverTimestamp()
  });
}


// ==========================================================================
// CONSTRUCTION SITE SERVICES
// ==========================================================================

// Seed default sites if collection is empty (Disabled for production)
export async function seedDefaultSites() {
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
export async function createSite(siteName, clientName, location, startDate, expectedEndDate, status, latitude = null, longitude = null, radius = 100) {
  const db = getDb();
  const newSiteRef = doc(collection(db, "sites"));

  await setDoc(newSiteRef, {
    siteName,
    clientName,
    location,
    startDate,
    expectedEndDate,
    status,
    latitude: latitude !== null && latitude !== "" ? Number(latitude) : null,
    longitude: longitude !== null && longitude !== "" ? Number(longitude) : null,
    radius: Number(radius) || 100,
    locationStatus: (latitude !== null && latitude !== "" && longitude !== null && longitude !== "") ? "Verified" : "Not Set",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return newSiteRef.id;
}

// Update site details
export async function updateSite(siteId, siteName, clientName, location, startDate, expectedEndDate, status, latitude = null, longitude = null, radius = 100) {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);

  const hasCoords = latitude !== null && latitude !== undefined && latitude !== "" && longitude !== null && longitude !== undefined && longitude !== "";

  await updateDoc(siteDocRef, {
    siteName,
    clientName,
    location,
    startDate,
    expectedEndDate,
    status,
    latitude: hasCoords ? Number(latitude) : null,
    longitude: hasCoords ? Number(longitude) : null,
    radius: Number(radius) || 100,
    locationStatus: hasCoords ? "Verified" : "Not Set",
    updatedAt: serverTimestamp()
  });
}

// Update site location details (from Map Picker)
export async function updateSiteLocation(siteId, latitude, longitude, address, locationAccuracy, locationCreatedDate = new Date().toISOString()) {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);
  await updateDoc(siteDocRef, {
    latitude: Number(latitude),
    longitude: Number(longitude),
    location: address,
    locationAccuracy: Number(locationAccuracy) || 5,
    locationStatus: "Verified",
    locationCreatedDate,
    updatedAt: serverTimestamp()
  });
}

// Delete site document
export async function deleteSite(siteId) {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);
  const batch = writeBatch(db);
  batch.delete(siteDocRef);
  await batch.commit();
}

// Load metric counts for Admin Dashboard
export async function getDashboardMetrics() {
  const db = getDb();
  
  let totalSitesCount = 0;
  let activeEngineersCount = 0;
  let attendanceTodayCount = 0;
  let totalMaterialsCount = 0;
  let activeWorkersCount = 0;

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

    const materialsSnap = await getDocs(collection(db, "materials"));
    totalMaterialsCount = materialsSnap.size;

    const workersQuery = query(
      collection(db, "workers"),
      where("status", "==", "active")
    );
    const workersSnap = await getDocs(workersQuery);
    activeWorkersCount = workersSnap.size;
  } catch (err) {
    console.warn("Metrics Query Warning (could be empty collections):", err);
  }

  return {
    totalSites: totalSitesCount,
    activeEngineers: activeEngineersCount,
    attendanceToday: attendanceTodayCount,
    totalMaterials: totalMaterialsCount,
    activeWorkers: activeWorkersCount
  };
}

// Haversine formula to compute distance in meters
export function calculateDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth's radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) * Math.cos(phi2) *
    Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

// Get the engineer's attendance record for a specific date
export async function getTodayAttendance(engineerId, dateStr, siteId = null) {
  const db = getDb();
  const attendanceColl = collection(db, "attendance");
  let q;
  if (siteId) {
    q = query(
      attendanceColl,
      where("engineerId", "==", engineerId),
      where("date", "==", dateStr),
      where("siteId", "==", siteId)
    );
  } else {
    q = query(
      attendanceColl,
      where("engineerId", "==", engineerId),
      where("date", "==", dateStr)
    );
  }
  const snap = await getDocs(q);
  if (snap.empty) return null;
  
  const records = [];
  snap.forEach(doc => {
    records.push({ id: doc.id, ...doc.data() });
  });
  return records[0];
}

// Mark attendance
export async function markAttendance(engineerId, siteId, dateStr, latitude, longitude, photoUrl = "", photoGpsLocation = null, verificationStatus = "verified") {
  const db = getDb();
  const existing = await getTodayAttendance(engineerId, dateStr);
  if (existing) {
    throw new Error("Attendance already marked for today.");
  }
  
  const newAttendanceRef = doc(collection(db, "attendance"));
  await setDoc(newAttendanceRef, {
    engineerId,
    siteId,
    date: dateStr,
    checkInTime: serverTimestamp(),
    latitude,
    longitude,
    photoUrl,
    photoGpsLocation,
    verificationStatus,
    status: "present"
  });
}

// Save site photo
export async function saveSitePhoto(engineerId, siteId, imageUrl, latitude, longitude) {
  const db = getDb();
  const newPhotoRef = doc(collection(db, "sitePhotos"));
  await setDoc(newPhotoRef, {
    engineerId,
    siteId,
    imageUrl,
    latitude,
    longitude,
    capturedAt: serverTimestamp()
  });
}

// Get photos captured by the engineer
export async function getSitePhotos(engineerId) {
  const db = getDb();
  const photosColl = collection(db, "sitePhotos");
  const q = query(photosColl, where("engineerId", "==", engineerId));
  const snap = await getDocs(q);
  
  const photos = [];
  snap.forEach(doc => {
    photos.push({ id: doc.id, ...doc.data() });
  });
  return photos.sort((a, b) => {
    const timeA = a.capturedAt?.seconds || (a.capturedAt ? new Date(a.capturedAt).getTime() : 0);
    const timeB = b.capturedAt?.seconds || (b.capturedAt ? new Date(b.capturedAt).getTime() : 0);
    return timeB - timeA;
  });
}

// Save progress report (daily updates)
export async function saveDailyProgressReport(engineerId, siteId, description, progress, photoIds = []) {
  const db = getDb();
  const newUpdateRef = doc(collection(db, "dailyUpdates"));
  await setDoc(newUpdateRef, {
    engineerId,
    siteId,
    description,
    progress,
    photoIds,
    createdAt: serverTimestamp()
  });
}

// Get daily updates for an engineer
export async function getDailyUpdatesForEngineer(engineerId) {
  const db = getDb();
  const updatesColl = collection(db, "dailyUpdates");
  const q = query(updatesColl, where("engineerId", "==", engineerId));
  const snap = await getDocs(q);
  
  const updates = [];
  snap.forEach(doc => {
    updates.push({ id: doc.id, ...doc.data() });
  });
  return updates.sort((a, b) => {
    const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });
}

// ==========================================================================
// SITE ASSIGNMENT SERVICES
// ==========================================================================

// Get all active sites assigned to an engineer
export async function getAssignedSitesForEngineer(engineerId) {
  const db = getDb();
  
  // 1. Fetch user profile to get assignedSites list directly
  const profile = await getUserProfile(engineerId);
  if (!profile || !profile.assignedSites || profile.assignedSites.length === 0) {
    return [];
  }
  
  const assignedSiteIds = profile.assignedSites;

  // 2. Query sites collection for all these site documents
  const allSites = await getSites();
  return allSites.filter(site => assignedSiteIds.includes(site.id));
}

// Get all site assignments (detailed list with site and engineer profiles)
export async function getSiteAssignmentsDetailed() {
  const db = getDb();
  const assignmentsColl = collection(db, "siteAssignments");
  const snapshot = await getDocs(assignmentsColl);
  
  // Fetch sites and users collections to resolve names
  const sites = await getSites();
  const usersCollection = collection(db, "users");
  const usersSnapshot = await getDocs(usersCollection);
  
  const usersMap = {};
  usersSnapshot.forEach(doc => {
    usersMap[doc.id] = doc.data();
  });

  const detailedAssignments = [];
  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    const site = sites.find(s => s.id === data.siteId);
    const engineer = usersMap[data.engineerId];

    detailedAssignments.push({
      id: docSnap.id,
      siteId: data.siteId,
      engineerId: data.engineerId,
      assignedBy: data.assignedBy,
      assignedAt: data.assignedAt,
      status: data.status,
      siteName: site ? site.siteName : `Site (ID: ${data.siteId})`,
      location: site ? site.location : "--",
      engineerName: engineer ? engineer.fullName : `Engineer (ID: ${data.engineerId})`,
      engineerEmail: engineer ? engineer.email : "--"
    });
  });

  return detailedAssignments.sort((a, b) => {
    const timeA = a.assignedAt?.seconds || (a.assignedAt ? new Date(a.assignedAt).getTime() : 0);
    const timeB = b.assignedAt?.seconds || (b.assignedAt ? new Date(b.assignedAt).getTime() : 0);
    return timeB - timeA;
  });
}

// Assign engineer to site
export async function assignEngineerToSite(siteId, engineerId, adminId) {
  const db = getDb();
  
  // Validation: Check if site selection is valid
  const sites = await getSites();
  const siteExists = sites.some(s => s.id === siteId);
  if (!siteExists) {
    throw new Error("Invalid site selected.");
  }

  // Validation: Check if engineer exists and is active
  const engineerDocRef = doc(db, "users", engineerId);
  const engineerDoc = await getDoc(engineerDocRef);
  if (!engineerDoc.exists()) {
    throw new Error("Selected engineer profile does not exist.");
  }
  const engineerData = engineerDoc.data();
  if (engineerData.status !== "active") {
    throw new Error("Cannot assign site to an inactive engineer.");
  }

  // Validation: Prevent duplicate active assignment
  const assignmentsColl = collection(db, "siteAssignments");
  const q = query(
    assignmentsColl,
    where("siteId", "==", siteId),
    where("engineerId", "==", engineerId),
    where("status", "==", "active")
  );
  const existingSnapshot = await getDocs(q);
  if (!existingSnapshot.empty) {
    throw new Error("This engineer is already actively assigned to this site.");
  }

  // Write new assignment doc
  const batch = writeBatch(db);
  const newAssignmentRef = doc(collection(db, "siteAssignments"));
  batch.set(newAssignmentRef, {
    siteId,
    engineerId,
    assignedBy: adminId || "admin",
    assignedAt: serverTimestamp(),
    status: "active"
  });

  // Also update engineer's profile assignedSites list
  batch.update(engineerDocRef, {
    assignedSites: arrayUnion(siteId)
  });

  // Also update site's assignedEngineers list
  const siteDocRef = doc(db, "sites", siteId);
  batch.update(siteDocRef, {
    assignedEngineers: arrayUnion(engineerId)
  });

  await batch.commit();
}

// Remove engineer from site (delete or deactivate)
export async function removeEngineerFromSite(assignmentId) {
  const db = getDb();
  const assignmentDocRef = doc(db, "siteAssignments", assignmentId);
  const assignmentDoc = await getDoc(assignmentDocRef);
  
  if (!assignmentDoc.exists()) {
    throw new Error("Assignment record not found.");
  }
  const assignmentData = assignmentDoc.data();
  const { siteId, engineerId } = assignmentData;

  const batch = writeBatch(db);
  batch.delete(assignmentDocRef);

  // Remove siteId from engineer's assignedSites list
  const engineerDocRef = doc(db, "users", engineerId);
  batch.update(engineerDocRef, {
    assignedSites: arrayRemove(siteId)
  });

  // Remove engineerId from site's assignedEngineers list
  const siteDocRef = doc(db, "sites", siteId);
  batch.update(siteDocRef, {
    assignedEngineers: arrayRemove(engineerId)
  });

  await batch.commit();
}

// ==========================================================================
// MATERIAL TRACKING SERVICES
// ==========================================================================

// Add a new material log
export async function addMaterial(materialData) {
  const db = getDb();
  const materialsColl = collection(db, "materials");
  const newMaterialRef = doc(materialsColl);
  
  await setDoc(newMaterialRef, {
    siteId: materialData.siteId,
    engineerId: materialData.engineerId,
    materialName: materialData.materialName,
    category: materialData.category,
    quantity: Number(materialData.quantity),
    unit: materialData.unit,
    supplierName: materialData.supplierName,
    purchaseDate: materialData.purchaseDate,
    notes: materialData.notes || "",
    invoiceUrl: materialData.invoiceUrl || "",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// Get materials, optionally filtered by siteId, and resolve names
export async function getMaterialsDetailed(siteId = null) {
  const db = getDb();
  const materialsColl = collection(db, "materials");
  
  let q;
  if (siteId) {
    q = query(materialsColl, where("siteId", "==", siteId));
  } else {
    q = query(materialsColl);
  }
  
  const snap = await getDocs(q);
  
  // Fetch users collection to resolve engineer names
  const usersColl = collection(db, "users");
  const usersSnap = await getDocs(usersColl);
  const usersMap = {};
  usersSnap.forEach(d => {
    usersMap[d.id] = d.data();
  });
  
  // Fetch sites list to resolve site names
  const sites = await getSites();
  const sitesMap = {};
  sites.forEach(s => {
    sitesMap[s.id] = s;
  });
  
  const detailedMaterials = [];
  snap.forEach(docSnap => {
    const data = docSnap.data();
    const engineer = usersMap[data.engineerId];
    const site = sitesMap[data.siteId];
    
    detailedMaterials.push({
      id: docSnap.id,
      ...data,
      engineerName: engineer ? engineer.fullName : `Engineer (ID: ${data.engineerId})`,
      siteName: site ? site.siteName : `Site (ID: ${data.siteId})`
    });
  });
  
  // Sort by createdAt descending
  return detailedMaterials.sort((a, b) => {
    const timeA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const timeB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return timeB - timeA;
  });
}

// ==========================================================================
// LABOUR MANAGEMENT SERVICES
// ==========================================================================

// Add a new construction worker
export async function addWorker(workerData) {
  const db = getDb();
  const workersColl = collection(db, "workers");
  const newWorkerRef = doc(workersColl);
  
  await setDoc(newWorkerRef, {
    siteId: workerData.siteId,
    engineerId: workerData.engineerId,
    workerName: workerData.workerName,
    category: workerData.category,
    phoneNumber: workerData.phoneNumber,
    joiningDate: workerData.joiningDate,
    status: workerData.status || "active",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
}

// Toggle a worker's status (Active / Inactive)
export async function updateWorkerStatus(workerId, status) {
  const db = getDb();
  const workerDocRef = doc(db, "workers", workerId);
  await updateDoc(workerDocRef, {
    status,
    updatedAt: serverTimestamp()
  });
}

// Fetch workers (optionally filtered by siteId)
export async function getWorkers(siteId = null) {
  const db = getDb();
  const workersColl = collection(db, "workers");
  
  let q;
  if (siteId) {
    q = query(workersColl, where("siteId", "==", siteId));
  } else {
    q = query(workersColl);
  }
  
  const snap = await getDocs(q);
  const workers = [];
  snap.forEach(d => {
    workers.push({ id: d.id, ...d.data() });
  });
  
  // Sort by workerName alphabetically
  return workers.sort((a, b) => a.workerName.localeCompare(b.workerName));
}

// Save/Mark daily workers attendance batch (idempotent setDoc writes)
export async function saveLabourAttendance(siteId, engineerId, dateStr, attendanceList) {
  const db = getDb();
  const batch = writeBatch(db);
  
  for (const item of attendanceList) {
    const docId = `${siteId}_${item.workerId}_${dateStr}`;
    const docRef = doc(db, "labourAttendance", docId);
    
    batch.set(docRef, {
      siteId,
      workerId: item.workerId,
      date: dateStr,
      status: item.status, // "present" or "absent"
      markedBy: engineerId,
      createdAt: serverTimestamp()
    });
  }
  
  await batch.commit();
}

// Get attendance logs for a site and date
export async function getLabourAttendance(siteId, dateStr) {
  const db = getDb();
  const attendanceColl = collection(db, "labourAttendance");
  const q = query(
    attendanceColl,
    where("siteId", "==", siteId),
    where("date", "==", dateStr)
  );
  
  const snap = await getDocs(q);
  const records = [];
  snap.forEach(d => {
    records.push({ id: d.id, ...d.data() });
  });
  return records;
}

// Get attendance summary history (dates & counts) for admin reports
export async function getLabourAttendanceSummary(siteId) {
  const db = getDb();
  const attendanceColl = collection(db, "labourAttendance");
  const q = query(attendanceColl, where("siteId", "==", siteId));
  const snap = await getDocs(q);
  
  const summaryMap = {};
  snap.forEach(d => {
    const data = d.data();
    const date = data.date;
    if (!summaryMap[date]) {
      summaryMap[date] = { present: 0, absent: 0 };
    }
    if (data.status === "present") {
      summaryMap[date].present += 1;
    } else {
      summaryMap[date].absent += 1;
    }
  });
  
  const summaryList = Object.keys(summaryMap).map(date => ({
    date,
    present: summaryMap[date].present,
    absent: summaryMap[date].absent
  }));
  
  // Sort by date descending
  return summaryList.sort((a, b) => b.date.localeCompare(a.date));
}

// ==========================================================================
// DAILY LABOUR COUNTS SERVICES (COUNT-BASED SYSTEM)
// ==========================================================================

// Save daily category counts for workers (idempotent writes using deterministic IDs)
export async function saveLabourDailyCounts(siteId, engineerId, dateStr, countsMap) {
  const db = getDb();
  const batch = writeBatch(db);
  
  const categories = Object.keys(countsMap);
  for (const category of categories) {
    const docId = `${siteId}_${dateStr}_${category}`;
    const docRef = doc(db, "labourDailyCount", docId);
    const count = Number(countsMap[category]) || 0;
    
    batch.set(docRef, {
      siteId,
      engineerId,
      date: dateStr,
      category,
      count,
      createdAt: serverTimestamp()
    });
  }
  
  await batch.commit();
}

// Fetch worker counts for a specific site and date
export async function getLabourDailyCounts(siteId, dateStr) {
  const db = getDb();
  const countsColl = collection(db, "labourDailyCount");
  const q = query(
    countsColl,
    where("siteId", "==", siteId),
    where("date", "==", dateStr)
  );
  
  const snap = await getDocs(q);
  const counts = {};
  // Pre-populate with 0 for all categories
  const categories = ["Mason", "Helper", "Painter", "Plumber", "Electrician", "Other"];
  categories.forEach(cat => {
    counts[cat] = 0;
  });
  
  snap.forEach(d => {
    const data = d.data();
    counts[data.category] = Number(data.count) || 0;
  });
  return counts;
}

// Fetch historical daily counts list for Site Engineer Dashboard and Admin Auditing
export async function getLabourDailyCountsHistory(siteId) {
  const db = getDb();
  const countsColl = collection(db, "labourDailyCount");
  const q = query(countsColl, where("siteId", "==", siteId));
  const snap = await getDocs(q);
  
  // Group by date to show a clean list of dates with counts
  const historyMap = {};
  snap.forEach(d => {
    const data = d.data();
    const date = data.date;
    if (!historyMap[date]) {
      historyMap[date] = { date, Masons: 0, Helpers: 0, Painters: 0, Plumbers: 0, Electricians: 0, Others: 0, total: 0, engineerId: data.engineerId || "" };
    }
    const categoryKey = data.category === "Mason" ? "Masons" :
                        data.category === "Helper" ? "Helpers" :
                        data.category === "Painter" ? "Painters" :
                        data.category === "Plumber" ? "Plumbers" :
                        data.category === "Electrician" ? "Electricians" : "Others";
    
    const countVal = Number(data.count) || 0;
    if (categoryKey === "Others") {
      historyMap[date].Others += countVal;
    } else {
      historyMap[date][categoryKey] = countVal;
    }
    historyMap[date].total += countVal;
  });
  
  return Object.values(historyMap).sort((a, b) => b.date.localeCompare(a.date));
}

// Aggregates counts by date to support the Admin Dashboard (aliased to getLabourDailyCountsHistory)
export async function getLabourDailyCountsSummary(siteId) {
  return getLabourDailyCountsHistory(siteId);
}

// ==========================================================================
// SITE ENGINEER PERSONAL ATTENDANCE & LEAVES SERVICES
// ==========================================================================

// Get stats for engineer's personal attendance and leaves
export async function getEngineerAttendanceAndLeaveStats(engineerId, holidayAllowance = 24) {
  const db = getDb();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentMonthStr = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
  const yearMonthPrefix = `${currentYear}-${currentMonthStr}`; // "YYYY-MM"
  
  // 1. Fetch all attendance for this engineer
  const attendanceColl = collection(db, "attendance");
  const attendanceQuery = query(
    attendanceColl,
    where("engineerId", "==", engineerId)
  );
  
  let weekdaysWorkedThisMonth = 0;
  try {
    const attendanceSnap = await getDocs(attendanceQuery);
    attendanceSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date && data.date.startsWith(yearMonthPrefix)) {
        const parts = data.date.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
          // Mon-Fri is 1-5
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            weekdaysWorkedThisMonth++;
          }
        }
      }
    });
  } catch (err) {
    console.warn("Attendance stats fetch error:", err);
  }
  
  // 2. Fetch all leaves for this engineer
  const leavesColl = collection(db, "leaves");
  const leavesQuery = query(
    leavesColl,
    where("engineerId", "==", engineerId)
  );
  let leavesThisMonth = 0;
  let leavesThisYear = 0;
  
  try {
    const leavesSnap = await getDocs(leavesQuery);
    leavesSnap.forEach(docSnap => {
      const data = docSnap.data();
      if (data.date) {
        if (data.date.startsWith(`${currentYear}-`)) {
          leavesThisYear++;
        }
        if (data.date.startsWith(yearMonthPrefix)) {
          leavesThisMonth++;
        }
      }
    });
  } catch (err) {
    console.warn("Leaves query error:", err);
  }
  
  const remainingHolidays = Math.max(0, Number(holidayAllowance) - leavesThisYear);
  
  return {
    weekdaysWorkedThisMonth,
    leavesThisMonth,
    leavesThisYear,
    remainingHolidays
  };
}

// Log a leave for an engineer
export async function logEngineerLeave(engineerId, dateStr, reason) {
  const db = getDb();
  
  // Check if a leave or attendance record already exists for this date
  const leavesColl = collection(db, "leaves");
  const qExist = query(
    leavesColl,
    where("engineerId", "==", engineerId),
    where("date", "==", dateStr)
  );
  const snapExist = await getDocs(qExist);
  if (!snapExist.empty) {
    throw new Error("Leave already logged for this date.");
  }
  
  const newLeaveRef = doc(collection(db, "leaves"));
  await setDoc(newLeaveRef, {
    engineerId,
    date: dateStr,
    reason: reason || "Personal Leave",
    status: "approved",
    createdAt: serverTimestamp()
  });
}

// Get all logged leaves for an engineer
export async function getEngineerLeaves(engineerId) {
  const db = getDb();
  const leavesColl = collection(db, "leaves");
  const q = query(leavesColl, where("engineerId", "==", engineerId));
  const snap = await getDocs(q);
  const leaves = [];
  snap.forEach(d => {
    leaves.push({ id: d.id, ...d.data() });
  });
  return leaves.sort((a, b) => b.date.localeCompare(a.date));
}

// Cancel / Delete a leave record
export async function deleteEngineerLeave(leaveId) {
  const db = getDb();
  const leaveDocRef = doc(db, "leaves", leaveId);
  const batch = writeBatch(db);
  batch.delete(leaveDocRef);
  await batch.commit();
}

// Delete Site Engineer completely from database (Admin command)
export async function deleteSiteEngineer(engineerId, email = null, password = null) {
  const db = getDb();

  // 1. Try to delete the user authentication account securely
  let authDeleted = false;

  // Try calling the secure backend/admin Cloud Function first
  try {
    const functions = getFunctions();
    const deleteUserAuth = httpsCallable(functions, "deleteUserAuth");
    await deleteUserAuth({ uid: engineerId });
    authDeleted = true;
  } catch (funcErr) {
    console.warn("Backend/admin delete operation failed, trying local emulator admin API:", funcErr);

    // Try calling local Firebase Auth Emulator admin REST API if active
    try {
      const response = await fetch(`http://127.0.0.1:9099/admin/v2/projects/studio-7044154747-fb0fa/users/${engineerId}`, {
        method: "DELETE"
      });
      if (response.ok) {
        authDeleted = true;
      } else {
        throw new Error("Emulator delete returned non-ok status");
      }
    } catch (emuErr) {
      console.warn("Emulator API delete failed, trying secondary client auth delete:", emuErr);

      // Fallback: Delete client-side by signing in as them on the secondary app instance
      if (email && password) {
        try {
          const secondaryAuth = getSecondaryAuth();
          const userCredential = await signInWithEmailAndPassword(secondaryAuth, email, password);
          await deleteUser(userCredential.user);
          await signOut(secondaryAuth);
          authDeleted = true;
        } catch (authErr) {
          console.warn("Secondary auth user deletion failed:", authErr);
          if (authErr.code !== "auth/user-not-found" && authErr.code !== "auth/invalid-credential" && authErr.code !== "auth/wrong-password") {
            throw new Error(`Failed to delete security account: ${authErr.message}`);
          }
        }
      }
    }
  }

  const batch = writeBatch(db);

  // 2. Delete engineer profile document
  const userDocRef = doc(db, "users", engineerId);
  batch.delete(userDocRef);

  // 3. Query and delete all site assignments for this engineer
  const assignmentsColl = collection(db, "siteAssignments");
  const qAssignments = query(assignmentsColl, where("engineerId", "==", engineerId));
  const assignmentsSnap = await getDocs(qAssignments);
  assignmentsSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  // 4. Update sites to remove this engineer from assignedEngineers array
  const sitesColl = collection(db, "sites");
  const qSites = query(sitesColl, where("assignedEngineers", "array-contains", engineerId));
  const sitesSnap = await getDocs(qSites);
  sitesSnap.forEach(docSnap => {
    batch.update(docSnap.ref, {
      assignedEngineers: arrayRemove(engineerId)
    });
  });

  // 5. Delete engineer's personal attendance records
  const attendanceColl = collection(db, "attendance");
  const qAttendance = query(attendanceColl, where("engineerId", "==", engineerId));
  const attendanceSnap = await getDocs(qAttendance);
  attendanceSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  // 6. Delete engineer's leaves records
  const leavesColl = collection(db, "leaves");
  const qLeaves = query(leavesColl, where("engineerId", "==", engineerId));
  const leavesSnap = await getDocs(qLeaves);
  leavesSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  // 7. Delete engineer's site photos
  const sitePhotosColl = collection(db, "sitePhotos");
  const qPhotos = query(sitePhotosColl, where("engineerId", "==", engineerId));
  const photosSnap = await getDocs(qPhotos);
  photosSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  // 8. Delete engineer's custom site location records
  const engineerLocationsColl = collection(db, "engineerLocations");
  const qLocations = query(engineerLocationsColl, where("engineerId", "==", engineerId));
  const locationsSnap = await getDocs(qLocations);
  locationsSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  // Commit firestore operations
  await batch.commit();
}

// Fetch saved site location for an engineer
export async function getSavedLocationForEngineer(engineerId, siteId) {
  const db = getDb();
  const docRef = doc(db, "engineerLocations", `${engineerId}_${siteId}`);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data();
  }
  return null;
}

// Save site location for an engineer
export async function saveSavedLocationForEngineer(engineerId, siteId, latitude, longitude, address, accuracy) {
  const db = getDb();
  const docRef = doc(db, "engineerLocations", `${engineerId}_${siteId}`);
  await setDoc(docRef, {
    engineerId,
    siteId,
    latitude: Number(latitude),
    longitude: Number(longitude),
    address: address || "",
    accuracy: Number(accuracy) || 0,
    timestamp: new Date().toISOString(),
    createdAt: serverTimestamp()
  });
}

// Delete a material receipt log
export async function deleteMaterial(materialId) {
  const db = getDb();
  const docRef = doc(db, "materials", materialId);
  const batch = writeBatch(db);
  batch.delete(docRef);
  await batch.commit();
}

// Delete daily labour counts for a site and date
export async function deleteLabourDailyCounts(siteId, dateStr) {
  const db = getDb();
  const countsColl = collection(db, "labourDailyCount");
  const q = query(
    countsColl,
    where("siteId", "==", siteId),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });
  await batch.commit();
}

// Delete daily progress report
export async function deleteDailyProgressReport(reportId) {
  const db = getDb();
  const docRef = doc(db, "dailyUpdates", reportId);
  const batch = writeBatch(db);
  batch.delete(docRef);
  await batch.commit();
}

// Delete site inspection photo
export async function deleteSitePhoto(photoId) {
  const db = getDb();
  const docRef = doc(db, "sitePhotos", photoId);
  const batch = writeBatch(db);
  batch.delete(docRef);
  await batch.commit();
}




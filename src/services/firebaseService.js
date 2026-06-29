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
  arrayRemove,
  deleteField,
  deleteDoc
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
    const createPayload = {
      fullName: name,
      email: email,
      phoneNumber: phone,
      role: "site_engineer",
      status: "active",
      assignedSites: selectedSites,
      holidayAllowance: Number(holidayAllowance) || 24,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    // Store admin-provided initial password so it can be shown to engineer on first login
    if (password) {
      createPayload.password = password;
    }
    batch.set(userDocRef, createPayload);
    
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

// Update password field for an engineer in Firestore database (Clear plaintext password and update timestamp)
export async function updateEngineerPasswordInDb(uid, newPassword) {
  const db = getDb();
  const userDocRef = doc(db, "users", uid);
  await updateDoc(userDocRef, {
    password: deleteField(),
    updatedAt: serverTimestamp()
  });
}

// Approve location setup for a site
export async function approveSiteLocation(siteId, proposedData) {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);
  await updateDoc(siteDocRef, {
    latitude: Number(proposedData.proposedLatitude),
    longitude: Number(proposedData.proposedLongitude),
    location: proposedData.proposedLocation,
    locationAccuracy: Number(proposedData.proposedLocationAccuracy) || 5,
    locationCapturedBy: proposedData.proposedLocationCapturedBy || null,
    locationDeviceDetails: proposedData.proposedLocationDeviceDetails || null,
    locationCreatedDate: proposedData.proposedLocationCreatedDate || new Date().toISOString(),
    locationStatus: "Verified",
    proposedLatitude: deleteField(),
    proposedLongitude: deleteField(),
    proposedLocation: deleteField(),
    proposedLocationAccuracy: deleteField(),
    proposedLocationCapturedBy: deleteField(),
    proposedLocationDeviceDetails: deleteField(),
    proposedLocationCreatedDate: deleteField(),
    proposedArea: deleteField(),
    proposedStreet: deleteField(),
    updatedAt: serverTimestamp()
  });
}

// Reject location setup for a site
export async function rejectSiteLocation(siteId) {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);
  await updateDoc(siteDocRef, {
    locationStatus: "Rejected",
    proposedLatitude: deleteField(),
    proposedLongitude: deleteField(),
    proposedLocation: deleteField(),
    proposedLocationAccuracy: deleteField(),
    proposedLocationCapturedBy: deleteField(),
    proposedLocationDeviceDetails: deleteField(),
    proposedLocationCreatedDate: deleteField(),
    proposedArea: deleteField(),
    proposedStreet: deleteField(),
    updatedAt: serverTimestamp()
  });
}


// Fetch user profile by corporate email
export async function getUserByEmail(email) {
  const db = getDb();
  const usersCollection = collection(db, "users");
  const q = query(usersCollection, where("email", "==", email.trim()));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, uid: doc.id, ...doc.data() };
  }
  return null;
}

// Fetch user profile by phone number
export async function getUserByPhone(phone) {
  const db = getDb();
  const usersCollection = collection(db, "users");
  const q = query(usersCollection, where("phoneNumber", "==", phone.trim()));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const doc = querySnapshot.docs[0];
    return { id: doc.id, uid: doc.id, ...doc.data() };
  }
  return null;
}

// Reset password in Firebase Auth Emulator securely via PATCH
export async function resetUserPasswordInAuthEmulator(uid, newPassword) {
  const response = await fetch(`http://127.0.0.1:9099/admin/v2/projects/studio-7044154747-fb0fa/users/${uid}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password: newPassword })
  });
  if (!response.ok) {
    throw new Error("Failed to update password in Auth emulator.");
  }
  return true;
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
    assignedAddress: location,
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

// Update site details (without modifying captured coordinates)
export async function updateSite(siteId, siteName, clientName, location, startDate, expectedEndDate, status, radius = 100) {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);

  await updateDoc(siteDocRef, {
    siteName,
    clientName,
    location,
    assignedAddress: location,
    startDate,
    expectedEndDate,
    status,
    radius: Number(radius) || 100,
    updatedAt: serverTimestamp()
  });
}

// Update site location details (sets as pending location approval for Admin review)
export async function updateSiteLocation(siteId, latitude, longitude, address, locationAccuracy, engineerId, deviceDetails, radius = 100, locationCreatedDate = new Date().toISOString(), area = "", street = "") {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);
  await updateDoc(siteDocRef, {
    proposedLatitude: Number(latitude),
    proposedLongitude: Number(longitude),
    proposedLocation: address,
    proposedLocationAccuracy: Number(locationAccuracy) || 5,
    proposedLocationCreatedDate: locationCreatedDate,
    proposedLocationCapturedBy: engineerId || null,
    proposedLocationDeviceDetails: deviceDetails || null,
    proposedArea: area,
    proposedStreet: street,
    locationStatus: "Pending Approval",
    radius: Number(radius) || 100,
    updatedAt: serverTimestamp()
  });

  // central approvals integration
  let siteName = "Unknown Site";
  try {
    const siteDoc = await getDoc(siteDocRef);
    if (siteDoc.exists()) {
      siteName = siteDoc.data().siteName;
    }
  } catch (e) {}

  let engineerName = "Site Engineer";
  try {
    const userDoc = await getDoc(doc(db, "users", engineerId));
    if (userDoc.exists()) {
      engineerName = userDoc.data().fullName;
    }
  } catch (e) {}

  const approvalId = `loc_${siteId}`;

  await saveApprovalRequest({
    id: approvalId,
    type: "Location",
    requestedBy: engineerName,
    engineerId: engineerId,
    siteId: siteId,
    siteName: siteName,
    details: `Site Geofence Setup: ${address}`,
    amount: 0,
    requestDate: locationCreatedDate.split("T")[0],
    status: "pending",
    raw: {
      proposedLatitude: Number(latitude),
      proposedLongitude: Number(longitude),
      proposedLocation: address,
      proposedLocationAccuracy: Number(locationAccuracy),
      proposedLocationCapturedBy: engineerId,
      proposedLocationCreatedDate: locationCreatedDate
    }
  });

  await logSystemActivity(
    engineerId,
    engineerName,
    "site_engineer",
    siteId,
    siteName,
    "Create",
    `${engineerName} requested site location geofencing setup for ${siteName}`,
    "Location",
    { siteId }
  );

  await notifyAdmins(
    "New Site Location Setup Request",
    `${engineerName} requested a geofence location setup at ${siteName}.`,
    "Location",
    siteId,
    siteName,
    engineerId,
    engineerName
  );
}

// Helper to calculate distance in meters between two coordinates
function getGeocodeDistance(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Radius of Earth in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Helper to score the accuracy and granularity of an address object
function getAddressAccuracyScore(address) {
  if (!address) return 0;
  let score = 0;
  if (address.road || address.pedestrian || address.path || address.cycleway || address.footway || address.steps || address.track || address.square || address.lane || address.street || address.alley) {
    score += 5;
  }
  if (address.colony || address.residential || address.neighbourhood || address.allotments || address.subdivision || address.farm || address.suburb || address.quarter || address.hamlet || address.locality || address.isolated_dwelling || address.croft) {
    score += 4;
  }
  if (address.village || address.town || address.city_district || address.city || address.municipality || address.borough) {
    score += 3;
  }
  if (address.state_district || address.county || address.district) {
    score += 2;
  }
  if (address.state) {
    score += 1;
  }
  if (address.country) {
    score += 1;
  }
  return score;
}

// Reverse geocode helper via Nominatim OSM API
export async function reverseGeocodeLatLng(lat, lng) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1&cb=${Date.now()}`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'ApexBuild-ConstructionSite-Verification/1.0 (contact@apexbuild.com)'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data) {
        // Handle potential array or single-object response
        const results = Array.isArray(data) ? data : [data];
        let bestResult = null;
        let bestScore = -1;
        let minDistance = Infinity;

        for (const result of results) {
          if (!result || !result.address) continue;
          const score = getAddressAccuracyScore(result.address);
          const resLat = Number(result.lat);
          const resLng = Number(result.lon);
          const dist = (!isNaN(resLat) && !isNaN(resLng)) 
            ? getGeocodeDistance(Number(lat), Number(lng), resLat, resLng) 
            : Infinity;

          if (score > bestScore) {
            bestScore = score;
            minDistance = dist;
            bestResult = result;
          } else if (score === bestScore && dist < minDistance) {
            minDistance = dist;
            bestResult = result;
          }
        }

        if (bestResult) {
          const address = bestResult.address;
          const landmark = address.amenity || address.shop || address.tourism || address.building || address.office || address.leisure || address.historic || address.emergency || address.place || address.aeroway || address.highway || address.man_made || address.institution || address.workplace || address.hotel || address.house_name || "";
          const houseNumber = address.house_number || "";
          const street = address.road || address.pedestrian || address.path || address.cycleway || address.footway || address.steps || address.track || address.square || address.lane || address.street || address.alley || address.road_reference || "";
          const colony = address.colony || address.residential || address.neighbourhood || address.allotments || address.subdivision || address.farm || "";
          const suburb = address.suburb || address.quarter || address.hamlet || address.locality || address.isolated_dwelling || address.croft || "";
          const town = address.village || address.town || address.city_district || address.city || address.municipality || address.borough || "";
          const district = address.state_district || address.county || address.district || "";
          const state = address.state || "";
          const postcode = address.postcode || "";
          const country = address.country || "";

          // Prioritized Custom Address Construction for maximum location details
          const addressParts = [];
          if (landmark) addressParts.push(landmark);
          if (houseNumber) addressParts.push(`No. ${houseNumber}`);
          if (street) addressParts.push(street);
          if (colony && !addressParts.includes(colony)) addressParts.push(colony);
          if (suburb && !addressParts.includes(suburb) && suburb !== colony) addressParts.push(suburb);
          if (town && !addressParts.includes(town) && town !== suburb) addressParts.push(town);
          if (district && !addressParts.includes(district)) addressParts.push(district);
          if (state && !addressParts.includes(state)) addressParts.push(state);
          if (postcode && !addressParts.includes(postcode)) addressParts.push(postcode);
          if (country && !addressParts.includes(country)) addressParts.push(country);

          let customFullAddress = addressParts.join(", ") || bestResult.display_name || "";

          // Compare GPS coordinates with returned address center
          const resLat = Number(bestResult.lat);
          const resLng = Number(bestResult.lon);
          const dist = (!isNaN(resLat) && !isNaN(resLng)) 
            ? getGeocodeDistance(Number(lat), Number(lng), resLat, resLng) 
            : 0;
          if (dist > 300) {
            customFullAddress += ` (within ${Math.round(dist)}m of resolved geocode)`;
          }

          let areaParts = [];
          if (colony) areaParts.push(colony);
          if (suburb && suburb !== colony) areaParts.push(suburb);
          if (town && town !== colony && town !== suburb) areaParts.push(town);
          const area = areaParts.join(", ") || "";

          return {
            fullAddress: customFullAddress,
            district: district || address.city || "",
            state: state,
            country: country,
            area: area,
            street: street,
            colony: colony
          };
        }
      }
    }
  } catch (e) {
    console.warn("Reverse geocode request failed:", e);
  }
  return {
    fullAddress: `Lat: ${Number(lat).toFixed(6)}, Lng: ${Number(lng).toFixed(6)}`,
    district: "",
    state: "",
    country: "",
    area: "",
    street: "",
    colony: ""
  };
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
export async function markAttendance(engineerId, siteId, dateStr, latitude, longitude, address, photoUrl = "", verificationStatus = "verified") {
  const db = getDb();
  const existing = await getTodayAttendance(engineerId, dateStr, siteId);
  if (existing) {
    throw new Error("Attendance already marked for today.");
  }
  
  const newAttendanceRef = doc(collection(db, "attendance"));
  await setDoc(newAttendanceRef, {
    userId: engineerId,
    engineerId: engineerId, // compatibility
    siteId,
    date: dateStr,
    latitude: Number(latitude),
    longitude: Number(longitude),
    address: address || "",
    timestamp: serverTimestamp(),
    checkInTime: serverTimestamp(), // compatibility
    photoUrl,
    verificationStatus,
    status: "present"
  });
}

// Mark check-out attendance
export async function markCheckOut(attendanceId, latitude, longitude, address, photoUrl = "") {
  const db = getDb();
  const attRef = doc(db, "attendance", attendanceId);
  await updateDoc(attRef, {
    checkOutTime: serverTimestamp(),
    checkOutLatitude: Number(latitude),
    checkOutLongitude: Number(longitude),
    checkOutAddress: address || "",
    checkOutPhotoUrl: photoUrl
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

// Get photos captured by the engineer (optionally filtered by siteId)
export async function getSitePhotos(engineerId, siteId = null) {
  const db = getDb();
  const photosColl = collection(db, "sitePhotos");
  let q;
  if (siteId) {
    q = query(
      photosColl,
      where("engineerId", "==", engineerId),
      where("siteId", "==", siteId)
    );
  } else {
    q = query(photosColl, where("engineerId", "==", engineerId));
  }
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
export async function saveDailyProgressReport(engineerId, siteId, description, progress, photoIds = [], additionalNotes = {}) {
  const db = getDb();
  const newUpdateRef = doc(collection(db, "dailyUpdates"));
  await setDoc(newUpdateRef, {
    engineerId,
    siteId,
    description,
    progress,
    photoIds,
    completedToday: additionalNotes.completedToday || "",
    currentlyRunning: additionalNotes.currentlyRunning || "",
    materialsStatus: additionalNotes.materialsStatus || "",
    problemsFaced: additionalNotes.problemsFaced || "",
    pendingWork: additionalNotes.pendingWork || "",
    nextActivity: additionalNotes.nextActivity || "",
    date: additionalNotes.date || new Date().toISOString().split("T")[0],
    createdAt: serverTimestamp()
  });

  // central updates integration
  let siteName = "Unknown Site";
  try {
    const siteDoc = await getDoc(doc(db, "sites", siteId));
    if (siteDoc.exists()) {
      siteName = siteDoc.data().siteName;
    }
  } catch (e) {}

  let engineerName = "Site Engineer";
  try {
    const userDoc = await getDoc(doc(db, "users", engineerId));
    if (userDoc.exists()) {
      engineerName = userDoc.data().fullName;
    }
  } catch (e) {}

  const activityDesc = `${engineerName} updated site progress at ${siteName} to ${progress}%`;
  await logSystemActivity(
    engineerId,
    engineerName,
    "site_engineer",
    siteId,
    siteName,
    "Update",
    activityDesc,
    "Progress",
    { progress }
  );

  await notifyAdmins(
    "Site Progress Updated",
    `${engineerName} logged progress at ${siteName}: "${description}" (${progress}% completed).`,
    "Progress",
    siteId,
    siteName,
    engineerId,
    engineerName
  );
}

// Get daily updates for an engineer (optionally filtered by siteId)
export async function getDailyUpdatesForEngineer(engineerId, siteId = null) {
  const db = getDb();
  const updatesColl = collection(db, "dailyUpdates");
  let q;
  if (siteId) {
    q = query(
      updatesColl,
      where("engineerId", "==", engineerId),
      where("siteId", "==", siteId)
    );
  } else {
    q = query(updatesColl, where("engineerId", "==", engineerId));
  }
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
  const matId = newMaterialRef.id;
  
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
    status: "pending", // Default to pending approval
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  // central approvals integration
  let siteName = "Unknown Site";
  try {
    const siteDoc = await getDoc(doc(db, "sites", materialData.siteId));
    if (siteDoc.exists()) {
      siteName = siteDoc.data().siteName;
    }
  } catch (e) {}

  let engineerName = "Site Engineer";
  try {
    const userDoc = await getDoc(doc(db, "users", materialData.engineerId));
    if (userDoc.exists()) {
      engineerName = userDoc.data().fullName;
    }
  } catch (e) {}

  const details = `${materialData.materialName} (${materialData.category}) - Qty: ${materialData.quantity} ${materialData.unit}`;

  await saveApprovalRequest({
    id: matId,
    type: "Material",
    requestedBy: engineerName,
    engineerId: materialData.engineerId,
    siteId: materialData.siteId,
    siteName: siteName,
    details: details,
    amount: 0,
    requestDate: materialData.purchaseDate || new Date().toISOString().split("T")[0],
    status: "pending",
    raw: { id: matId }
  });

  await logSystemActivity(
    materialData.engineerId,
    engineerName,
    "site_engineer",
    materialData.siteId,
    siteName,
    "Create",
    `${engineerName} requested ${details} for ${siteName}`,
    "Material",
    { materialId: matId }
  );

  await notifyAdmins(
    "New Material Requisition Request",
    `${engineerName} submitted a new request for ${details} at ${siteName}.`,
    "Material",
    materialData.siteId,
    siteName,
    materialData.engineerId,
    engineerName
  );
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
        // Only count approved leaves (or undefined for backward compatibility)
        const isApproved = data.status === "approved" || data.status === undefined;
        if (isApproved) {
          if (data.date.startsWith(`${currentYear}-`)) {
            leavesThisYear++;
          }
          if (data.date.startsWith(yearMonthPrefix)) {
            leavesThisMonth++;
          }
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
  const leaveId = newLeaveRef.id;
  
  await setDoc(newLeaveRef, {
    engineerId,
    date: dateStr,
    reason: reason || "Personal Leave",
    status: "pending", // Default to pending approval
    createdAt: serverTimestamp()
  });

  // Central approvals integration
  let engineerName = "Site Engineer";
  try {
    const userDoc = await getDoc(doc(db, "users", engineerId));
    if (userDoc.exists()) {
      engineerName = userDoc.data().fullName;
    }
  } catch (e) {}

  await saveApprovalRequest({
    id: leaveId,
    type: "Leave",
    requestedBy: engineerName,
    engineerId: engineerId,
    siteId: "",
    siteName: "N/A",
    details: `Leave Request on ${dateStr} for "${reason || 'Personal Leave'}"`,
    amount: 0,
    requestDate: dateStr,
    status: "pending",
    raw: { id: leaveId }
  });

  await logSystemActivity(
    engineerId,
    engineerName,
    "site_engineer",
    "",
    "N/A",
    "Create",
    `${engineerName} requested Leave for ${dateStr}`,
    "Leave",
    { leaveId }
  );

  await notifyAdmins(
    "New Leave Request",
    `${engineerName} requested leave for ${dateStr}. Reason: "${reason || 'Personal Leave'}"`,
    "Leave",
    "",
    "",
    engineerId,
    engineerName
  );
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

// Get all attendance records for an engineer across all sites
export async function getEngineerAttendanceHistory(engineerId) {
  const db = getDb();
  const attendanceColl = collection(db, "attendance");
  const q = query(attendanceColl, where("engineerId", "==", engineerId));
  const snap = await getDocs(q);
  const records = [];
  snap.forEach(docSnap => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

// Log engineer site entry/exit activity
export async function logActivity(engineerId, siteId, type, latitude, longitude, address) {
  const db = getDb();
  
  // Format local date and time:
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0]; // YYYY-MM-DD
  
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  const timeStr = `${hours}:${minStr} ${ampm}`;

  const activityRef = doc(collection(db, "activityLogs"));
  await setDoc(activityRef, {
    engineerId,
    siteId,
    type, // "entry" or "exit"
    date: dateStr,
    time: timeStr,
    latitude: Number(latitude),
    longitude: Number(longitude),
    address: address || "",
    timestamp: serverTimestamp()
  });
}

// Get all activity logs (ordered by timestamp desc)
export async function getActivityLogs() {
  const db = getDb();
  const logsQuery = query(collection(db, "activityLogs"));
  const querySnapshot = await getDocs(logsQuery);
  const logs = [];
  querySnapshot.forEach((doc) => {
    logs.push({ id: doc.id, ...doc.data() });
  });
  logs.sort((a, b) => {
    const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
    return tB - tA;
  });
  return logs;
}

// Get activity logs for a specific engineer for today
export async function getTodayActivityLogsForEngineer(engineerId, dateStr) {
  const db = getDb();
  const q = query(
    collection(db, "activityLogs"),
    where("engineerId", "==", engineerId),
    where("date", "==", dateStr)
  );
  const querySnapshot = await getDocs(q);
  const logs = [];
  querySnapshot.forEach((doc) => {
    logs.push({ id: doc.id, ...doc.data() });
  });
  logs.sort((a, b) => {
    const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
    return tA - tB;
  });
  return logs;
}

// Get all attendance records for a given site
export async function getAttendanceForSite(siteId) {
  const db = getDb();
  const attendanceColl = collection(db, "attendance");
  const q = query(attendanceColl, where("siteId", "==", siteId));
  const snap = await getDocs(q);
  const records = [];
  snap.forEach(docSnap => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  return records;
}

// Get daily progress updates for a site
export async function getDailyUpdatesForSite(siteId) {
  const db = getDb();
  const updatesColl = collection(db, "dailyUpdates");
  const q = query(updatesColl, where("siteId", "==", siteId));
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

// Get all photos captured for a site
export async function getPhotosForSite(siteId) {
  const db = getDb();
  const photosColl = collection(db, "sitePhotos");
  const q = query(photosColl, where("siteId", "==", siteId));
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

// Get engineer activity logs for a site
export async function getActivityLogsForSite(siteId) {
  const db = getDb();
  const q = query(collection(db, "activityLogs"), where("siteId", "==", siteId));
  const snap = await getDocs(q);
  const logs = [];
  snap.forEach(docSnap => {
    logs.push({ id: docSnap.id, ...docSnap.data() });
  });
  logs.sort((a, b) => {
    const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
    return tB - tA;
  });
  return logs;
}

// Get engineer activity logs for an engineer (history)
export async function getActivityLogsForEngineer(engineerId) {
  const db = getDb();
  const q = query(collection(db, "activityLogs"), where("engineerId", "==", engineerId));
  const snap = await getDocs(q);
  const logs = [];
  snap.forEach(docSnap => {
    logs.push({ id: docSnap.id, ...docSnap.data() });
  });
  logs.sort((a, b) => {
    const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
    const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
    return tB - tA;
  });
  return logs;
}

// Update existing material records
export async function updateMaterial(materialId, materialData) {
  const db = getDb();
  const docRef = doc(db, "materials", materialId);
  await updateDoc(docRef, {
    materialName: materialData.materialName,
    category: materialData.category,
    quantity: Number(materialData.quantity),
    unit: materialData.unit,
    supplierName: materialData.supplierName,
    purchaseDate: materialData.purchaseDate,
    notes: materialData.notes || "",
    requiredQuantity: Number(materialData.requiredQuantity) || 0,
    orderedQuantity: Number(materialData.orderedQuantity) || 0,
    paidQuantity: Number(materialData.paidQuantity) || 0,
    updatedAt: serverTimestamp()
  });
}

// Fetch all leaves across all engineers
export async function getAllLeaves() {
  const db = getDb();
  const leavesColl = collection(db, "leaves");
  const snap = await getDocs(leavesColl);
  
  // Resolve user info
  const usersColl = collection(db, "users");
  const usersSnap = await getDocs(usersColl);
  const usersMap = {};
  usersSnap.forEach(d => {
    usersMap[d.id] = d.data();
  });

  const leaves = [];
  snap.forEach(d => {
    const data = d.data();
    const engineer = usersMap[data.engineerId];
    leaves.push({
      id: d.id,
      ...data,
      engineerName: engineer ? engineer.fullName : `Engineer (ID: ${data.engineerId})`
    });
  });
  return leaves.sort((a, b) => b.date.localeCompare(a.date));
}

// Approve a leave request
export async function approveLeave(leaveId) {
  const db = getDb();
  const docRef = doc(db, "leaves", leaveId);
  await updateDoc(docRef, {
    status: "approved",
    updatedAt: serverTimestamp()
  });
}

// Reject a leave request
export async function rejectLeave(leaveId) {
  const db = getDb();
  const docRef = doc(db, "leaves", leaveId);
  await updateDoc(docRef, {
    status: "rejected",
    updatedAt: serverTimestamp()
  });
}

// Approve a material receipt log
export async function approveMaterialLog(materialId) {
  const db = getDb();
  const docRef = doc(db, "materials", materialId);
  await updateDoc(docRef, {
    status: "approved",
    updatedAt: serverTimestamp()
  });
}

// Reject a material receipt log
export async function rejectMaterialLog(materialId) {
  const db = getDb();
  const docRef = doc(db, "materials", materialId);
  await updateDoc(docRef, {
    status: "rejected",
    updatedAt: serverTimestamp()
  });
}

// ==========================================================================
// CENTRAL LABOUR MASTER & SALARY MANAGEMENT API
// ==========================================================================

export async function getLabourMaster() {
  const db = getDb();
  const docRef = doc(db, "users", "__labour_master__");
  const docSnap = await getDoc(docRef);
  
  const defaults = {
    "Mason": { wage: 800, type: "Daily", status: "Active" },
    "Helper": { wage: 500, type: "Daily", status: "Active" },
    "Carpenter": { wage: 700, type: "Daily", status: "Active" },
    "Electrician": { wage: 700, type: "Daily", status: "Active" },
    "Plumber": { wage: 700, type: "Daily", status: "Active" },
    "Painter": { wage: 700, type: "Daily", status: "Active" },
    "Other": { wage: 600, type: "Daily", status: "Active" }
  };
  
  if (docSnap.exists()) {
    const data = docSnap.data();
    const mergedCategories = { ...defaults, ...(data.categories || {}) };
    return {
      categories: mergedCategories,
      history: data.history || []
    };
  } else {
    await setDoc(docRef, {
      categories: defaults,
      history: []
    });
    return {
      categories: defaults,
      history: []
    };
  }
}

export async function saveLabourMaster(categories, history) {
  const db = getDb();
  const docRef = doc(db, "users", "__labour_master__");
  await setDoc(docRef, {
    categories,
    history,
    updatedAt: serverTimestamp()
  });
}

export async function getLabourPayments() {
  const db = getDb();
  const docRef = doc(db, "users", "__labour_payments__");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().payments || [];
  }
  return [];
}

export async function saveLabourPayment(paymentData) {
  const db = getDb();
  const docRef = doc(db, "users", "__labour_payments__");
  const docSnap = await getDoc(docRef);
  
  const newPayment = {
    id: `${paymentData.siteId}_${Date.now()}`,
    siteId: paymentData.siteId,
    amount: Number(paymentData.amount) || 0,
    date: paymentData.date || new Date().toISOString().split("T")[0],
    reference: paymentData.reference || "",
    notes: paymentData.notes || "",
    loggedBy: paymentData.loggedBy || "admin"
  };
  
  if (docSnap.exists()) {
    await updateDoc(docRef, {
      payments: arrayUnion(newPayment),
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(docRef, {
      payments: [newPayment],
      updatedAt: serverTimestamp()
    });
  }
  return newPayment;
}

export async function getMaterialMaster() {
  const db = getDb();
  const docRef = doc(db, "users", "__material_master__");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().materialsList || [];
  }
  const defaultList = [
    { name: "Cement", category: "Cement", unit: "Bag", status: "Active" },
    { name: "Steel", category: "Steel", unit: "Ton", status: "Active" },
    { name: "Sand", category: "Sand", unit: "Load", status: "Active" },
    { name: "Bricks", category: "Bricks", unit: "Piece", status: "Active" }
  ];
  return defaultList;
}

export async function saveMaterialMaster(materialsList) {
  const db = getDb();
  const docRef = doc(db, "users", "__material_master__");
  await setDoc(docRef, {
    materialsList,
    updatedAt: serverTimestamp()
  });
}

export async function logMaterialUsage(materialId, usageData) {
  const db = getDb();
  const docRef = doc(db, "materials", materialId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Material log not found");
  
  const currentData = docSnap.data();
  const currentConsumed = Number(currentData.consumedQuantity) || 0;
  
  const newUsageEntry = {
    id: `usage_${Date.now()}`,
    quantity: Number(usageData.quantity) || 0,
    date: usageData.date || new Date().toISOString().split("T")[0],
    notes: usageData.notes || ""
  };
  
  await updateDoc(docRef, {
    usageHistory: arrayUnion(newUsageEntry),
    consumedQuantity: currentConsumed + newUsageEntry.quantity,
    updatedAt: serverTimestamp()
  });
}

export async function logMaterialPayment(materialId, paymentData) {
  const db = getDb();
  const docRef = doc(db, "materials", materialId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Material log not found");
  
  const currentData = docSnap.data();
  const currentPaid = Number(currentData.paidAmount) || 0;
  
  const newPaymentEntry = {
    id: `pay_${Date.now()}`,
    amount: Number(paymentData.amount) || 0,
    date: paymentData.date || new Date().toISOString().split("T")[0],
    reference: paymentData.reference || "",
    notes: paymentData.notes || ""
  };
  
  await updateDoc(docRef, {
    paymentHistory: arrayUnion(newPaymentEntry),
    paidAmount: currentPaid + newPaymentEntry.amount,
    updatedAt: serverTimestamp()
  });
}

export async function getGeneralExpenses() {
  const db = getDb();
  const docRef = doc(db, "users", "__site_expenses__");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    return docSnap.data().expenses || [];
  }
  return [];
}

export async function saveGeneralExpense(expenseData) {
  const db = getDb();
  const docRef = doc(db, "users", "__site_expenses__");
  const docSnap = await getDoc(docRef);
  
  const newExpense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    siteId: expenseData.siteId,
    category: expenseData.category || "Site Expense",
    amount: Number(expenseData.amount) || 0,
    date: expenseData.date || new Date().toISOString().split("T")[0],
    description: expenseData.description || "",
    notes: expenseData.notes || "",
    createdBy: expenseData.createdBy || "Engineer",
    status: expenseData.status || "Pending",
    paidAmount: 0,
    paymentHistory: []
  };

  if (docSnap.exists()) {
    await updateDoc(docRef, {
      expenses: arrayUnion(newExpense),
      updatedAt: serverTimestamp()
    });
  } else {
    await setDoc(docRef, {
      expenses: [newExpense],
      updatedAt: serverTimestamp()
    });
  }

  // central approvals integration
  const expId = newExpense.id;

  let siteName = "Unknown Site";
  try {
    const siteDoc = await getDoc(doc(db, "sites", expenseData.siteId));
    if (siteDoc.exists()) {
      siteName = siteDoc.data().siteName;
    }
  } catch (e) {}

  let engineerName = expenseData.createdBy || "Engineer";

  if (newExpense.status === "Pending" || newExpense.status === "pending") {
    await saveApprovalRequest({
      id: expId,
      type: "Payment",
      requestedBy: engineerName,
      engineerId: expenseData.engineerId || "",
      siteId: expenseData.siteId,
      siteName: siteName,
      details: `${expenseData.category} - ${expenseData.description} (₹${expenseData.amount})`,
      amount: Number(expenseData.amount) || 0,
      requestDate: expenseData.date || new Date().toISOString().split("T")[0],
      status: "pending",
      raw: { id: expId }
    });

    await notifyAdmins(
      "New Field Payment Request",
      `${engineerName} requested ₹${expenseData.amount} for "${expenseData.description}" at ${siteName}.`,
      "Payment",
      expenseData.siteId,
      siteName,
      expenseData.engineerId || "",
      engineerName
    );
  }

  await logSystemActivity(
    expenseData.engineerId || "",
    engineerName,
    expenseData.createdBy === "Admin" ? "admin" : "site_engineer",
    expenseData.siteId,
    siteName,
    "Create",
    `${engineerName} logged ${expenseData.category} of ₹${expenseData.amount} (${expenseData.description})`,
    "Payment",
    { expenseId: expId }
  );

  if (Number(expenseData.amount) >= 100000) {
    try {
      const superadmins = await getUsersByRole("super_admin");
      const superadmins2 = await getUsersByRole("superadmin");
      const uniqueSas = [...superadmins, ...superadmins2].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);
      
      const promises = uniqueSas.map(sa => 
        sendNotification(
          sa.id,
          "⚠️ High-Value Payment logged",
          `A payment of ₹${expenseData.amount} for "${expenseData.description}" was logged at ${siteName}.`,
          "Payment",
          expenseData.siteId,
          siteName,
          expenseData.engineerId || "",
          engineerName,
          "high"
        )
      );
      await Promise.all(promises);
    } catch (err) {
      console.error("Super Admin high value notification failed:", err);
    }
  }

  return newExpense;
}

export async function approveGeneralExpense(expenseId) {
  const db = getDb();
  const docRef = doc(db, "users", "__site_expenses__");
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;
  
  const expenses = docSnap.data().expenses || [];
  const updatedExpenses = expenses.map(e => {
    if (e.id === expenseId) {
      return { ...e, status: "Approved" };
    }
    return e;
  });
  
  await updateDoc(docRef, {
    expenses: updatedExpenses,
    updatedAt: serverTimestamp()
  });
}

export async function logGeneralExpensePayment(expenseId, paymentData) {
  const db = getDb();
  const docRef = doc(db, "users", "__site_expenses__");
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;
  
  const expenses = docSnap.data().expenses || [];
  const updatedExpenses = expenses.map(e => {
    if (e.id === expenseId) {
      const currentPaid = Number(e.paidAmount) || 0;
      const payAmt = Number(paymentData.amount) || 0;
      const history = e.paymentHistory || [];
      const newPayEntry = {
        id: `pay_${Date.now()}`,
        amount: payAmt,
        date: paymentData.date || new Date().toISOString().split("T")[0],
        reference: paymentData.reference || "",
        notes: paymentData.notes || ""
      };
      
      return {
        ...e,
        paidAmount: currentPaid + payAmt,
        paymentHistory: [...history, newPayEntry]
      };
    }
    return e;
  });
  
  await updateDoc(docRef, {
    expenses: updatedExpenses,
    updatedAt: serverTimestamp()
  });
}

export async function rejectGeneralExpense(expenseId) {
  const db = getDb();
  const docRef = doc(db, "users", "__site_expenses__");
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) return;
  
  const expenses = docSnap.data().expenses || [];
  const updatedExpenses = expenses.map(e => {
    if (e.id === expenseId) {
      return { ...e, status: "Rejected" };
    }
    return e;
  });
  
  await updateDoc(docRef, {
    expenses: updatedExpenses,
    updatedAt: serverTimestamp()
  });
}

export async function getNotifications(userId) {
  const db = getDb();
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", userId)
  );
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });
  return list.sort((a, b) => {
    const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });
}

export async function sendNotification(recipientId, title, description, moduleType, siteId, siteName, createdUserId, createdUserName, priority = "normal") {
  const db = getDb();
  const docRef = doc(collection(db, "notifications"));
  await setDoc(docRef, {
    recipientId,
    title,
    description,
    moduleType,
    siteId: siteId || "",
    siteName: siteName || "",
    createdUserId: createdUserId || "",
    createdUserName: createdUserName || "",
    priority,
    read: false,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function markNotificationAsRead(notificationId) {
  const db = getDb();
  const docRef = doc(db, "notifications", notificationId);
  await updateDoc(docRef, {
    read: true,
    updatedAt: serverTimestamp()
  });
}

export async function markAllNotificationsAsRead(userId) {
  const db = getDb();
  const q = query(
    collection(db, "notifications"),
    where("recipientId", "==", userId),
    where("read", "==", false)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(d => {
    batch.update(doc(db, "notifications", d.id), {
      read: true,
      updatedAt: serverTimestamp()
    });
  });
  await batch.commit();
}

export async function logSystemActivity(userId, userName, userRole, siteId, siteName, actionType, description, moduleType, details = {}) {
  const db = getDb();
  const docRef = doc(collection(db, "activities"));
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  
  await setDoc(docRef, {
    userId: userId || "",
    userName: userName || "",
    userRole: userRole || "",
    siteId: siteId || "",
    siteName: siteName || "",
    actionType,
    description,
    moduleType,
    details,
    oldValue: details?.oldValue || "",
    newValue: details?.newValue || "",
    date: dateStr,
    createdAt: serverTimestamp()
  });
  return docRef.id;
}

export async function getSystemActivities() {
  const db = getDb();
  const q = collection(db, "activities");
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });
  return list.sort((a, b) => {
    const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });
}

export async function getCentralApprovals() {
  const db = getDb();
  const q = collection(db, "approvals");
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });
  return list.sort((a, b) => {
    const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
    const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
    return tB - tA;
  });
}

export async function saveApprovalRequest(approvalData) {
  const db = getDb();
  const docRef = doc(db, "approvals", approvalData.id);
  await setDoc(docRef, {
    id: approvalData.id,
    type: approvalData.type,
    requestedBy: approvalData.requestedBy || "",
    engineerId: approvalData.engineerId || "",
    siteId: approvalData.siteId || "",
    siteName: approvalData.siteName || "",
    details: approvalData.details || "",
    amount: Number(approvalData.amount) || 0,
    requestDate: approvalData.requestDate || new Date().toISOString().split("T")[0],
    status: approvalData.status || "pending",
    createdAt: serverTimestamp(),
    raw: approvalData.raw || {}
  });
  return docRef.id;
}

export async function getUsersByRole(role) {
  const db = getDb();
  const q = query(
    collection(db, "users"),
    where("role", "==", role)
  );
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });
  return list;
}

export async function notifyAdmins(title, description, moduleType, siteId, siteName, createdUserId, createdUserName, priority = "normal") {
  try {
    const admins = await getUsersByRole("admin");
    const superadmins = await getUsersByRole("super_admin");
    const superadmins2 = await getUsersByRole("superadmin");
    const recipients = [...admins, ...superadmins, ...superadmins2];
    
    const uniqueRecipients = [];
    const seen = new Set();
    recipients.forEach(r => {
      if (!seen.has(r.id)) {
        seen.add(r.id);
        uniqueRecipients.push(r);
      }
    });

    const promises = uniqueRecipients.map(admin => 
      sendNotification(admin.id, title, description, moduleType, siteId, siteName, createdUserId, createdUserName, priority)
    );
    await Promise.all(promises);
  } catch (err) {
    console.error("Failed to distribute notifications to admins:", err);
  }
}

export async function resolveApprovalRequest(approvalId, status, resolverId, resolverName) {
  const db = getDb();
  const docRef = doc(db, "approvals", approvalId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Approval record not found");
  
  const appData = docSnap.data();
  
  await updateDoc(docRef, {
    status,
    resolverId: resolverId || "",
    resolverName: resolverName || "",
    resolvedAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });

  if (appData.type === "Leave") {
    if (status === "approved" || status === "Approved") {
      await approveLeave(approvalId);
    } else {
      await rejectLeave(approvalId);
    }
  } else if (appData.type === "Location") {
    if (status === "approved" || status === "Approved") {
      await approveSiteLocation(appData.siteId, {
        proposedLatitude: appData.raw.proposedLatitude,
        proposedLongitude: appData.raw.proposedLongitude,
        proposedLocation: appData.raw.proposedLocation,
        proposedLocationAccuracy: appData.raw.proposedLocationAccuracy,
        proposedLocationCapturedBy: appData.raw.proposedLocationCapturedBy,
        proposedLocationCreatedDate: appData.raw.proposedLocationCreatedDate
      });
    } else {
      await rejectSiteLocation(appData.siteId);
    }
  } else if (appData.type === "Material") {
    if (status === "approved" || status === "Approved") {
      await approveMaterialLog(approvalId);
    } else {
      await rejectMaterialLog(approvalId);
    }
  } else if (appData.type === "Payment") {
    if (status === "approved" || status === "Approved") {
      await approveGeneralExpense(approvalId);
    } else {
      await rejectGeneralExpense(approvalId);
    }
  } else if (appData.type === "Labour") {
    if (appData.raw && appData.raw.workerId) {
      await updateWorkerStatus(appData.raw.workerId, status === "approved" || status === "Approved" ? "active" : "rejected");
    }
  }

  const actionText = status === "approved" || status === "Approved" ? "approved" : "rejected";
  const desc = `${resolverName || "Admin"} ${actionText} ${appData.type} request from ${appData.requestedBy} for ${appData.siteName}`;
  await logSystemActivity(
    resolverId, 
    resolverName, 
    "admin", 
    appData.siteId, 
    appData.siteName, 
    status === "approved" || status === "Approved" ? "Approve" : "Reject", 
    desc, 
    appData.type, 
    { approvalId, oldValue: appData.status || "pending", newValue: status }
  );

  if (appData.engineerId) {
    const title = `${appData.type} Request ${status === "approved" || status === "Approved" ? "Approved" : "Rejected"}`;
    const description = `Your request for "${appData.details}" at ${appData.siteName} has been ${actionText} by ${resolverName}.`;
    await sendNotification(appData.engineerId, title, description, appData.type, appData.siteId, appData.siteName, resolverId, resolverName, "normal");
  }
}

export async function syncApprovalsFromLegacy() {
  const db = getDb();
  
  const leavesSnap = await getDocs(collection(db, "leaves"));
  const usersSnap = await getDocs(collection(db, "users"));
  const usersMap = {};
  usersSnap.forEach(d => { usersMap[d.id] = d.data().fullName; });

  const sitesSnap = await getDocs(collection(db, "sites"));
  const sitesMap = {};
  sitesSnap.forEach(d => { sitesMap[d.id] = d.data().siteName; });

  const batch = writeBatch(db);
  let writeCount = 0;

  for (const d of leavesSnap.docs) {
    const data = d.data();
    const appRef = doc(db, "approvals", d.id);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) {
      batch.set(appRef, {
        id: d.id,
        type: "Leave",
        requestedBy: usersMap[data.engineerId] || "Site Engineer",
        engineerId: data.engineerId || "",
        siteId: "",
        siteName: "N/A",
        details: `Leave Request on ${data.date} for "${data.reason}"`,
        amount: 0,
        requestDate: data.date,
        status: data.status || "pending",
        createdAt: data.createdAt || serverTimestamp(),
        raw: { id: d.id }
      });
      writeCount++;
    }
  }

  const materialsSnap = await getDocs(collection(db, "materials"));
  for (const d of materialsSnap.docs) {
    const data = d.data();
    const appRef = doc(db, "approvals", d.id);
    const appSnap = await getDoc(appRef);
    if (!appSnap.exists()) {
      batch.set(appRef, {
        id: d.id,
        type: "Material",
        requestedBy: usersMap[data.engineerId] || "Site Engineer",
        engineerId: data.engineerId || "",
        siteId: data.siteId || "",
        siteName: sitesMap[data.siteId] || "Unknown Site",
        details: `${data.materialName} (${data.category}) - Qty: ${data.quantity} ${data.unit || 'Units'}`,
        amount: Number(data.totalAmount) || 0,
        requestDate: data.purchaseDate || "--",
        status: data.status || "pending",
        createdAt: data.createdAt || serverTimestamp(),
        raw: { id: d.id }
      });
      writeCount++;
    }
  }

  for (const d of sitesSnap.docs) {
    const data = d.data();
    if (data.locationStatus === "Pending Approval") {
      const appRef = doc(db, "approvals", `loc_${d.id}`);
      const appSnap = await getDoc(appRef);
      if (!appSnap.exists()) {
        batch.set(appRef, {
          id: `loc_${d.id}`,
          type: "Location",
          requestedBy: usersMap[data.proposedLocationCapturedBy] || "Site Engineer",
          engineerId: data.proposedLocationCapturedBy || "",
          siteId: d.id,
          siteName: data.siteName,
          details: `Site Geofence Setup: ${data.proposedLocation}`,
          amount: 0,
          requestDate: (data.proposedLocationCreatedDate || "").split("T")[0] || new Date().toISOString().split("T")[0],
          status: "pending",
          createdAt: data.updatedAt || serverTimestamp(),
          raw: {
            proposedLatitude: data.proposedLatitude,
            proposedLongitude: data.proposedLongitude,
            proposedLocation: data.proposedLocation,
            proposedLocationAccuracy: data.proposedLocationAccuracy,
            proposedLocationCapturedBy: data.proposedLocationCapturedBy,
            proposedLocationCreatedDate: data.proposedLocationCreatedDate
          }
        });
        writeCount++;
      }
    }
  }

  const expensesDoc = await getDoc(doc(db, "users", "__site_expenses__"));
  if (expensesDoc.exists()) {
    const expenses = expensesDoc.data().expenses || [];
    for (const exp of expenses) {
      if (exp.status === "Pending" || exp.status === "pending") {
        const appRef = doc(db, "approvals", exp.id);
        const appSnap = await getDoc(appRef);
        if (!appSnap.exists()) {
          batch.set(appRef, {
            id: exp.id,
            type: "Payment",
            requestedBy: exp.createdBy || "Engineer",
            engineerId: exp.engineerId || "",
            siteId: exp.siteId,
            siteName: sitesMap[exp.siteId] || "Unknown Site",
            details: `${exp.category} - ${exp.description} (₹${exp.amount})`,
            amount: Number(exp.amount) || 0,
            requestDate: exp.date,
            status: "pending",
            createdAt: serverTimestamp(),
            raw: { id: exp.id }
          });
          writeCount++;
        }
      }
    }
  }

  if (writeCount > 0) {
    await batch.commit();
  }
  return writeCount;
}

export async function getDocumentCategories() {
  const db = getDb();
  const docRef = doc(db, "users", "__document_categories__");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().categoriesList) {
    return docSnap.data().categoriesList;
  }
  return ["Contract", "Invoice", "Bill", "Photo", "Report", "Certificate"];
}

export async function saveDocumentCategories(categoriesList) {
  const db = getDb();
  const docRef = doc(db, "users", "__document_categories__");
  await setDoc(docRef, {
    categoriesList,
    updatedAt: serverTimestamp()
  });
}

export async function uploadDocument(docData) {
  const db = getDb();
  const docRef = doc(collection(db, "documents"));
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  
  const newDoc = {
    id: docRef.id,
    siteId: docData.siteId,
    siteName: docData.siteName,
    category: docData.category,
    title: docData.title,
    description: docData.description || "",
    fileUrl: docData.fileUrl || "",
    fileName: docData.fileName || "unnamed_file",
    fileSize: Number(docData.fileSize) || 0,
    uploadedBy: docData.uploadedBy,
    uploadedById: docData.uploadedById,
    uploadedAt: serverTimestamp(),
    date: dateStr,
    status: "Uploaded",
    verifiedBy: "",
    verifiedById: "",
    verifiedAt: null,
    comments: ""
  };
  
  await setDoc(docRef, newDoc);

  const desc = `${docData.uploadedBy} uploaded "${docData.title}" (${docData.category}) for site ${docData.siteName}`;
  await logSystemActivity(
    docData.uploadedById,
    docData.uploadedBy,
    docData.userRole || "site_engineer",
    docData.siteId,
    docData.siteName,
    "Create",
    desc,
    "Document",
    { documentId: docRef.id }
  );

  await notifyAdmins(
    "New Project Document Uploaded",
    `${docData.uploadedBy} uploaded a new document "${docData.title}" (${docData.category}) for ${docData.siteName}. Verification pending.`,
    "Document",
    docData.siteId,
    docData.siteName,
    docData.uploadedById,
    docData.uploadedBy
  );

  return newDoc;
}

export async function getSiteDocuments(siteId) {
  const db = getDb();
  const q = query(
    collection(db, "documents"),
    where("siteId", "==", siteId)
  );
  const snap = await getDocs(q);
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });
  return list.sort((a, b) => {
    const tA = a.uploadedAt?.seconds || 0;
    const tB = b.uploadedAt?.seconds || 0;
    return tB - tA;
  });
}

export async function getAllDocuments() {
  const db = getDb();
  const snap = await getDocs(collection(db, "documents"));
  const list = [];
  snap.forEach(d => {
    list.push({ id: d.id, ...d.data() });
  });
  return list.sort((a, b) => {
    const tA = a.uploadedAt?.seconds || 0;
    const tB = b.uploadedAt?.seconds || 0;
    return tB - tA;
  });
}

export async function verifyDocument(docId, status, verifierId, verifierName, comments) {
  const db = getDb();
  const docRef = doc(db, "documents", docId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Document not found");
  
  const data = docSnap.data();
  
  await updateDoc(docRef, {
    status,
    verifiedBy: verifierName,
    verifiedById: verifierId,
    verifiedAt: serverTimestamp(),
    comments: comments || ""
  });

  const desc = `${verifierName} marked document "${data.title}" as ${status} with comments "${comments || 'None'}"`;
  await logSystemActivity(
    verifierId,
    verifierName,
    "admin",
    data.siteId,
    data.siteName,
    "Approve",
    desc,
    "Document",
    { documentId: docId }
  );

  if (data.uploadedById) {
    const alertTitle = `Document ${status}`;
    const alertDesc = `Your document "${data.title}" at site ${data.siteName} has been ${status.toLowerCase()} by ${verifierName}.`;
    await sendNotification(
      data.uploadedById,
      alertTitle,
      alertDesc,
      "Document",
      data.siteId,
      data.siteName,
      verifierId,
      verifierName
    );
  }
}

export async function deleteDocument(docId, userId, userName) {
  const db = getDb();
  const docRef = doc(db, "documents", docId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) throw new Error("Document not found");
  
  const data = docSnap.data();
  await deleteDoc(docRef);

  const desc = `${userName} deleted document "${data.title}" (${data.category}) from ${data.siteName}`;
  await logSystemActivity(
    userId,
    userName,
    "admin",
    data.siteId,
    data.siteName,
    "Delete",
    desc,
    "Document",
    { documentId: docId }
  );
}







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
  deleteDoc,
  onSnapshot,
  runTransaction,
  addDoc,
  orderBy
} from "firebase/firestore";
import { getFirebaseDb, getSecondaryAuth, getFirebaseAuth } from "../firebase/config.js";
import { signInWithEmailAndPassword, deleteUser, signOut } from "firebase/auth";
import { getFunctions, httpsCallable } from "firebase/functions";
import { evaluateLabourDateSequence } from "./businessLogic.js";

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
  try {
    const [superAdminSnap, adminSnap, engSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "superAdmins", uid)).catch(() => null),
      getDoc(doc(db, "admins", uid)).catch(() => null),
      getDoc(doc(db, "siteEngineers", uid)).catch(() => null),
      getDoc(doc(db, "users", uid)).catch(() => null)
    ]);

    if (superAdminSnap && superAdminSnap.exists()) {
      return { uid, id: uid, ...superAdminSnap.data() };
    }
    if (adminSnap && adminSnap.exists()) {
      return { uid, id: uid, ...adminSnap.data() };
    }
    if (engSnap && engSnap.exists()) {
      const data = engSnap.data();
      return { uid, id: uid, role: "site_engineer", fullName: data.name, phoneNumber: data.phone, ...data };
    }
    if (userSnap && userSnap.exists()) {
      return { uid, id: uid, ...userSnap.data() };
    }
  } catch (e) {
    console.error("Error fetching user profile:", e);
  }
  return null;
}

// Real-time subscription to user profile changes
export function subscribeToUserProfile(uid, callback) {
  const db = getDb();
  
  // Listen to users collection document in real-time
  const userRef = doc(db, "users", uid);
  return onSnapshot(userRef, async (snap) => {
    if (snap.exists()) {
      callback({ uid, id: uid, ...snap.data() });
    } else {
      // Fallback one-time resolution for legacy/other collections
      try {
        const engRef = doc(db, "siteEngineers", uid);
        const engSnap = await getDoc(engRef);
        if (engSnap.exists()) {
          const data = engSnap.data();
          callback({ uid, id: uid, role: "site_engineer", fullName: data.name, phoneNumber: data.phone, ...data });
          return;
        }
        
        const admRef = doc(db, "admins", uid);
        const admSnap = await getDoc(admRef);
        if (admSnap.exists()) {
          callback({ uid, id: uid, ...admSnap.data() });
          return;
        }

        const saRef = doc(db, "superAdmins", uid);
        const saSnap = await getDoc(saRef);
        if (saSnap.exists()) {
          callback({ uid, id: uid, ...saSnap.data() });
          return;
        }
      } catch (e) {
        console.error("subscribeToUserProfile fallback resolution error:", e);
      }
      callback(null);
    }
  });
}

// Create a user profile (e.g. for Admin or Engineer)
export async function createUserProfile(uid, profileData) {
  const db = getDb();
  
  // Write to legacy collection first for backward compatibility
  const userDocRef = doc(db, "users", uid);
  const payload = {
    ...profileData,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };
  await setDoc(userDocRef, payload);

  // Determine role and write to corresponding collection
  const role = profileData.role;
  if (role === "super_admin" || role === "superadmin") {
    await setDoc(doc(db, "superAdmins", uid), {
      uid,
      name: profileData.fullName || profileData.name || "",
      email: profileData.email || "",
      role: role,
      status: profileData.status || "active",
      ...payload
    });
  } else if (role === "admin") {
    await setDoc(doc(db, "admins", uid), {
      uid,
      name: profileData.fullName || profileData.name || "",
      email: profileData.email || "",
      role: role,
      assignedSites: profileData.assignedSites || [],
      status: profileData.status || "active",
      ...payload
    });
  } else if (role === "site_engineer" || role === "engineer") {
    await setDoc(doc(db, "siteEngineers", uid), {
      uid,
      name: profileData.fullName || profileData.name || "",
      phone: profileData.phoneNumber || profileData.phone || "",
      assignedSites: profileData.assignedSites || [],
      status: profileData.status || "active",
      ...payload
    });
  }
}

// Update user profile fields (e.g. lastLogin)
export async function updateUserProfile(uid, updateData) {
  const db = getDb();
  const payload = {
    ...updateData,
    updatedAt: serverTimestamp()
  };
  
  // Update legacy users doc if it exists
  try {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, payload);
  } catch (e) {}

  // Update in correct role collection
  try {
    const superAdminDoc = doc(db, "superAdmins", uid);
    const snap = await getDoc(superAdminDoc);
    if (snap.exists()) {
      const rolePayload = { ...payload };
      if (updateData.fullName) rolePayload.name = updateData.fullName;
      await updateDoc(superAdminDoc, rolePayload);
      return;
    }
  } catch (e) {}

  try {
    const adminDoc = doc(db, "admins", uid);
    const snap = await getDoc(adminDoc);
    if (snap.exists()) {
      const rolePayload = { ...payload };
      if (updateData.fullName) rolePayload.name = updateData.fullName;
      await updateDoc(adminDoc, rolePayload);
      return;
    }
  } catch (e) {}

  try {
    const engineerDoc = doc(db, "siteEngineers", uid);
    const snap = await getDoc(engineerDoc);
    if (snap.exists()) {
      const rolePayload = { ...payload };
      if (updateData.fullName) rolePayload.name = updateData.fullName;
      if (updateData.phoneNumber) rolePayload.phone = updateData.phoneNumber;
      await updateDoc(engineerDoc, rolePayload);
      return;
    }
  } catch (e) {}
}

/**
 * Production-Safe Profile Update for the currently authenticated user.
 * Updates strictly only permitted personal fields: fullName, name, phoneNumber, phone.
 * Email, UID, Role, Status, Creation Date, and Site Assignments are permanently protected and immutable.
 * 
 * @param {string} uid - Authenticated user's UID
 * @param {object} profileData - { fullName, phoneNumber }
 */
export async function updateAuthenticatedUserProfile(uid, { fullName, phoneNumber }) {
  if (!uid) throw new Error("User UID is required for profile update.");

  const db = getDb();
  const trimmedName = (fullName || "").trim();
  const trimmedPhone = (phoneNumber || "").trim();

  if (!trimmedName) throw new Error("Admin name is required.");

  // Build clean payload with ONLY permitted fields (Name and Phone)
  const userPayload = {
    fullName: trimmedName,
    name: trimmedName,
    phoneNumber: trimmedPhone,
    phone: trimmedPhone,
    updatedAt: serverTimestamp()
  };

  // Update canonical users collection doc
  const userDocRef = doc(db, "users", uid);
  try {
    await updateDoc(userDocRef, userPayload);
  } catch (e) {
    await setDoc(userDocRef, userPayload, { merge: true });
  }

  // Also update corresponding role collections if they exist (without touching role, status, email, or assignedSites)
  const rolePayload = { ...userPayload };
  
  try {
    const adminDoc = doc(db, "admins", uid);
    const snap = await getDoc(adminDoc);
    if (snap.exists()) {
      await updateDoc(adminDoc, rolePayload);
    }
  } catch (e) {}

  try {
    const superAdminDoc = doc(db, "superAdmins", uid);
    const snap = await getDoc(superAdminDoc);
    if (snap.exists()) {
      await updateDoc(superAdminDoc, rolePayload);
    }
  } catch (e) {}

  try {
    const engineerDoc = doc(db, "siteEngineers", uid);
    const snap = await getDoc(engineerDoc);
    if (snap.exists()) {
      await updateDoc(engineerDoc, rolePayload);
    }
  } catch (e) {}
}

let inFlightCanonicalEngineersPromise = null;

/**
 * Unified Canonical Engineer Profile Store & Multi-Key Indexing
 * Fetches from both `siteEngineers` and `users` collections in parallel,
 * merges rich profile data, and creates multi-key indices for instant canonical resolution.
 * Deduplicates identical concurrent in-flight requests for query efficiency.
 */
export async function buildCanonicalEngineersLookup() {
  if (inFlightCanonicalEngineersPromise) {
    return inFlightCanonicalEngineersPromise;
  }

  inFlightCanonicalEngineersPromise = (async () => {
    try {
      const db = getDb();
      const siteEngineersCollection = collection(db, "siteEngineers");
      const usersCollection = collection(db, "users");
      const assignmentsColl = collection(db, "siteAssignments");

      const [seSnap, usersSnap, asgSnap] = await Promise.all([
        getDocs(siteEngineersCollection).catch(e => {
          console.warn("Could not fetch siteEngineers collection:", e);
          return { docs: [] };
        }),
        getDocs(usersCollection).catch(e => {
          console.warn("Could not fetch users collection:", e);
          return { docs: [] };
        }),
        getDocs(assignmentsColl).catch(e => {
          console.warn("Could not fetch canonical siteAssignments:", e);
          return { docs: [] };
        })
      ]);

      // Build active assignments map (engineerId -> Set of active siteIds)
      const activeAssignmentsMap = {};
      if (asgSnap && asgSnap.docs) {
        asgSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status === "active" && data.engineerId && data.siteId) {
            if (!activeAssignmentsMap[data.engineerId]) {
              activeAssignmentsMap[data.engineerId] = new Set();
            }
            activeAssignmentsMap[data.engineerId].add(data.siteId);
          }
        });
      }

      // Canonical engineer profile map (keyed by primary UID / Doc ID)
      const profilesMap = new Map();

      const processDoc = (docSnap, source) => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const uid = data.uid || data.userId || data.id || docId;
        const email = (data.email || data.userEmail || "").trim().toLowerCase();
        const primaryKey = uid || docId;

        const existing = profilesMap.get(primaryKey) || (email ? Array.from(profilesMap.values()).find(p => p.email && p.email.toLowerCase() === email) : null);

        const nameCandidates = [
          data.fullName,
          data.name,
          data.displayName,
          data.userName,
          existing?.fullName,
          existing?.name
        ].filter(n => typeof n === "string" && n.trim().length > 0);

        const cleanFullName = nameCandidates[0] || "";

        const phone = data.phone || data.phoneNumber || existing?.phoneNumber || existing?.phone || "";
        const status = data.status || existing?.status || "active";
        const customId = data.customId || data.engineerId || data.empId || existing?.customId || existing?.engineerId || "";
        const role = data.role || existing?.role || "site_engineer";
        const holidayAllowance = Number(data.holidayAllowance) || Number(existing?.holidayAllowance) || 24;

        const mergedSites = new Set([
          ...(Array.isArray(data.assignedSites) ? data.assignedSites : []),
          ...(Array.isArray(existing?.assignedSites) ? existing.assignedSites : [])
        ]);

        const activeCanonicalSites = [
          ...(activeAssignmentsMap[docId] ? Array.from(activeAssignmentsMap[docId]) : []),
          ...(activeAssignmentsMap[uid] ? Array.from(activeAssignmentsMap[uid]) : []),
          ...(activeAssignmentsMap[customId] ? Array.from(activeAssignmentsMap[customId]) : [])
        ];
        activeCanonicalSites.forEach(s => mergedSites.add(s));

        const profile = {
          id: docId,
          uid: uid || docId,
          docId: docId,
          fullName: cleanFullName,
          name: cleanFullName,
          email: data.email || existing?.email || "",
          phone: phone,
          phoneNumber: phone,
          customId: customId,
          engineerId: customId || uid || docId,
          role: role,
          status: status,
          holidayAllowance: holidayAllowance,
          assignedSites: Array.from(mergedSites),
          sourceCollection: source,
          ...data,
          fullName: cleanFullName,
          name: cleanFullName,
          assignedSites: Array.from(mergedSites)
        };

        profilesMap.set(primaryKey, profile);
        if (docId !== primaryKey) {
          profilesMap.set(docId, profile);
        }
      };

      // 1. Process siteEngineers collection
      if (seSnap && seSnap.docs) {
        seSnap.docs.forEach(docSnap => processDoc(docSnap, "siteEngineers"));
      }

      // 2. Process users collection (filter for engineers)
      if (usersSnap && usersSnap.docs) {
        usersSnap.docs.forEach(docSnap => {
          const data = docSnap.data();
          const role = (data.role || "").toLowerCase();
          const isEngineer = role === "site_engineer" || role === "engineer" || role.includes("engineer") || data.isEngineer === true || profilesMap.has(docSnap.id) || (data.email && Array.from(profilesMap.values()).some(p => p.email.toLowerCase() === data.email.toLowerCase()));
          if (isEngineer) {
            processDoc(docSnap, "users");
          }
        });
      }

      const engineersList = Array.from(new Set(profilesMap.values()));

      // 3. Build fast Multi-Key Lookup Index
      const lookupMap = {};
      engineersList.forEach(eng => {
        if (eng.id) lookupMap[eng.id] = eng;
        if (eng.uid) lookupMap[eng.uid] = eng;
        if (eng.docId) lookupMap[eng.docId] = eng;
        if (eng.customId) lookupMap[eng.customId] = eng;
        if (eng.engineerId) lookupMap[eng.engineerId] = eng;
        if (eng.email) {
          lookupMap[eng.email.toLowerCase()] = eng;
          lookupMap[eng.email] = eng;
        }
      });

      return { engineersList, lookupMap };
    } finally {
      setTimeout(() => {
        inFlightCanonicalEngineersPromise = null;
      }, 50);
    }
  })();

  return inFlightCanonicalEngineersPromise;
}

/**
 * Real-time unified subscription for canonical site engineers
 * Merges siteEngineers, users (with engineer roles/assignedSites), and siteAssignments
 * into a deduplicated single source of truth lookup map and list.
 */
export function subscribeCanonicalEngineers(callback) {
  if (typeof callback !== "function") return () => {};

  const db = getDb();
  let seDocs = [];
  let userDocs = [];
  let asgDocs = [];

  const recompute = () => {
    // Build active assignments map (engineerId -> Set of active siteIds)
    const activeAssignmentsMap = {};
    asgDocs.forEach(docSnap => {
      const data = docSnap.data ? docSnap.data() : docSnap;
      if (data.status === "active" && data.engineerId && data.siteId) {
        if (!activeAssignmentsMap[data.engineerId]) {
          activeAssignmentsMap[data.engineerId] = new Set();
        }
        activeAssignmentsMap[data.engineerId].add(data.siteId);
      }
    });

    const profilesMap = new Map();

    const processDoc = (docSnap, source) => {
      const data = docSnap.data ? docSnap.data() : docSnap;
      const docId = docSnap.id || data.id || data.uid;
      const uid = data.uid || data.userId || data.id || docId;
      const email = (data.email || data.userEmail || "").trim().toLowerCase();
      const primaryKey = uid || docId;

      const existing = profilesMap.get(primaryKey) || (email ? Array.from(profilesMap.values()).find(p => p.email && p.email.toLowerCase() === email) : null);

      const nameCandidates = [
        data.fullName,
        data.name,
        data.displayName,
        data.userName,
        existing?.fullName,
        existing?.name
      ].filter(n => typeof n === "string" && n.trim().length > 0);

      const cleanFullName = nameCandidates[0] || "";

      const phone = data.phone || data.phoneNumber || existing?.phoneNumber || existing?.phone || "";
      const status = data.status || existing?.status || "active";
      const customId = data.customId || data.engineerId || data.empId || existing?.customId || existing?.engineerId || "";
      const role = data.role || existing?.role || "site_engineer";
      const holidayAllowance = Number(data.holidayAllowance) || Number(existing?.holidayAllowance) || 24;

      const mergedSites = new Set([
        ...(Array.isArray(data.assignedSites) ? data.assignedSites : []),
        ...(Array.isArray(existing?.assignedSites) ? existing.assignedSites : [])
      ]);

      const activeCanonicalSites = [
        ...(activeAssignmentsMap[docId] ? Array.from(activeAssignmentsMap[docId]) : []),
        ...(activeAssignmentsMap[uid] ? Array.from(activeAssignmentsMap[uid]) : []),
        ...(activeAssignmentsMap[customId] ? Array.from(activeAssignmentsMap[customId]) : [])
      ];
      activeCanonicalSites.forEach(s => mergedSites.add(s));

      const profile = {
        id: docId,
        uid: uid || docId,
        docId: docId,
        fullName: cleanFullName,
        name: cleanFullName,
        email: data.email || existing?.email || "",
        phone: phone,
        phoneNumber: phone,
        customId: customId,
        engineerId: customId || uid || docId,
        role: role,
        status: status,
        holidayAllowance: holidayAllowance,
        assignedSites: Array.from(mergedSites),
        sourceCollection: source,
        ...data,
        fullName: cleanFullName,
        name: cleanFullName,
        assignedSites: Array.from(mergedSites)
      };

      profilesMap.set(primaryKey, profile);
      if (docId !== primaryKey) {
        profilesMap.set(docId, profile);
      }
    };

    // 1. Process siteEngineers
    seDocs.forEach(d => processDoc(d, "siteEngineers"));

    // 2. Process users collection (filter for engineers)
    userDocs.forEach(docSnap => {
      const data = docSnap.data ? docSnap.data() : docSnap;
      const role = (data.role || "").toLowerCase();
      const isEngineer = role === "site_engineer" || role === "engineer" || role.includes("engineer") || data.isEngineer === true || profilesMap.has(docSnap.id) || (data.email && Array.from(profilesMap.values()).some(p => p.email.toLowerCase() === data.email.toLowerCase()));
      if (isEngineer) {
        processDoc(docSnap, "users");
      }
    });

    const engineersList = Array.from(new Set(profilesMap.values())).sort((a, b) => 
      (a.fullName || a.name || "").localeCompare(b.fullName || b.name || "")
    );

    // Fast multi-key lookup map
    const lookupMap = {};
    engineersList.forEach(eng => {
      if (eng.id) lookupMap[eng.id] = eng;
      if (eng.uid) lookupMap[eng.uid] = eng;
      if (eng.docId) lookupMap[eng.docId] = eng;
      if (eng.customId) lookupMap[eng.customId] = eng;
      if (eng.engineerId) lookupMap[eng.engineerId] = eng;
      if (eng.email) {
        lookupMap[eng.email.toLowerCase()] = eng;
        lookupMap[eng.email] = eng;
      }
    });

    callback(engineersList, lookupMap);
  };

  const unsubSE = onSnapshot(collection(db, "siteEngineers"), (snap) => {
    seDocs = snap.docs || [];
    recompute();
  }, (err) => {
    console.warn("siteEngineers snapshot listener warning:", err);
  });

  const unsubUsers = onSnapshot(collection(db, "users"), (snap) => {
    userDocs = snap.docs || [];
    recompute();
  }, (err) => {
    console.warn("users snapshot listener warning:", err);
  });

  const unsubAsg = onSnapshot(collection(db, "siteAssignments"), (snap) => {
    asgDocs = snap.docs || [];
    recompute();
  }, (err) => {
    console.warn("siteAssignments snapshot listener warning:", err);
  });

  return () => {
    unsubSE();
    unsubUsers();
    unsubAsg();
  };
}

/**
 * Resolve any engineer reference (UID, document ID, customId, email) to a clean canonical profile
 */
export function resolveEngineerIdentity(ref, lookupMap = {}, historicalRecords = []) {
  if (!ref) {
    return {
      isResolved: false,
      engineerName: "Engineer Profile Unavailable",
      engineerEmail: "",
      engineerDisplayId: "",
      rawRef: ""
    };
  }

  const cleanRef = String(ref).trim();
  let matched = lookupMap[cleanRef] || lookupMap[cleanRef.toLowerCase()];

  // If not matched directly, check if any profile in lookupMap has this ref in any field
  if (!matched) {
    const allProfiles = Object.values(lookupMap);
    matched = allProfiles.find(p => 
      p && (
        p.id === cleanRef || 
        p.uid === cleanRef || 
        p.docId === cleanRef ||
        p.customId === cleanRef || 
        p.engineerId === cleanRef ||
        (p.email && p.email.toLowerCase() === cleanRef.toLowerCase())
      )
    );
  }

  if (matched) {
    const name = matched.fullName || matched.name || matched.displayName || "Site Engineer";
    const email = matched.email || "";
    const displayId = matched.customId || matched.engineerId || matched.uid || matched.id || cleanRef;

    return {
      isResolved: true,
      engineerName: name,
      engineerEmail: email,
      engineerDisplayId: displayId,
      phoneNumber: matched.phoneNumber || matched.phone || "",
      status: matched.status || "active",
      profile: matched,
      rawRef: cleanRef
    };
  }

  // Check historical records (attendance, reports, materials, etc.)
  if (Array.isArray(historicalRecords) && historicalRecords.length > 0) {
    const recMatch = historicalRecords.find(r => 
      r && (r.engineerId === cleanRef || r.userId === cleanRef || r.id === cleanRef || r.uid === cleanRef) && (r.engineerName || r.submittedByName || r.recordedByName)
    );
    if (recMatch) {
      const histName = recMatch.engineerName || recMatch.submittedByName || recMatch.recordedByName;
      return {
        isResolved: true,
        engineerName: histName,
        engineerEmail: recMatch.engineerEmail || "",
        engineerDisplayId: cleanRef,
        rawRef: cleanRef
      };
    }
  }

  return {
    isResolved: false,
    engineerName: "Engineer Profile Unavailable",
    engineerEmail: "",
    engineerDisplayId: cleanRef,
    rawRef: cleanRef
  };
}

// Fetch all registered site engineers (Shared canonical dataset for all authorized Admins)
export async function getSiteEngineers(adminId = null) {
  const { engineersList } = await buildCanonicalEngineersLookup();
  return engineersList.sort((a, b) => (a.fullName || a.name || "").localeCompare(b.fullName || b.name || ""));
}

// Update status of site engineer
export async function updateEngineerStatus(uid, status) {
  const db = getDb();
  
  try {
    const engineerDocRef = doc(db, "siteEngineers", uid);
    await updateDoc(engineerDocRef, {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

  try {
    const userDocRef = doc(db, "users", uid);
    await updateDoc(userDocRef, {
      status,
      updatedAt: serverTimestamp()
    });
  } catch (e) {}
}

// Register or update site engineer user record in Firestore along with site updates
export async function saveSiteEngineerProfile(id, name, email, phone, selectedSites = [], isEditMode = false, oldSites = [], holidayAllowance = 24, password = "", adminId = null) {
  const db = getDb();
  const batch = writeBatch(db);
  const userDocRef = doc(db, "users", id);
  const engineerDocRef = doc(db, "siteEngineers", id);
  
  const sitesToAdd = selectedSites.filter(siteId => !oldSites.includes(siteId));
  const sitesToRemove = oldSites.filter(siteId => !selectedSites.includes(siteId));

  const [userSnap, seSnap] = await Promise.all([
    getDoc(userDocRef).catch(() => null),
    getDoc(engineerDocRef).catch(() => null)
  ]);

  if (isEditMode) {
    const userUpdatePayload = {
      fullName: name,
      phoneNumber: phone,
      assignedSites: selectedSites,
      holidayAllowance: Number(holidayAllowance) || 24,
      updatedAt: serverTimestamp()
    };
    if (userSnap && userSnap.exists()) {
      batch.update(userDocRef, userUpdatePayload);
    } else {
      batch.set(userDocRef, {
        fullName: name,
        email: email,
        phoneNumber: phone,
        role: "site_engineer",
        status: "active",
        ...userUpdatePayload,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    
    const engUpdatePayload = {
      name: name,
      phone: phone,
      assignedSites: selectedSites,
      holidayAllowance: Number(holidayAllowance) || 24,
      updatedAt: serverTimestamp()
    };
    if (seSnap && seSnap.exists()) {
      batch.update(engineerDocRef, engUpdatePayload);
    } else {
      batch.set(engineerDocRef, {
        uid: id,
        name: name,
        email: email,
        phone: phone,
        role: "site_engineer",
        status: "active",
        ...engUpdatePayload,
        createdAt: serverTimestamp()
      }, { merge: true });
    }
    
    // Clear former site assignments array on sites
    for (const siteId of sitesToRemove) {
      const siteDocRef = doc(db, "sites", siteId);
      const sSnap = await getDoc(siteDocRef).catch(() => null);
      if (sSnap && sSnap.exists()) {
        batch.update(siteDocRef, {
          assignedEngineers: arrayRemove(id),
          updatedAt: serverTimestamp()
        });
      }
    }
    
    // Apply new site assignments array on sites
    for (const siteId of sitesToAdd) {
      const siteDocRef = doc(db, "sites", siteId);
      const sSnap = await getDoc(siteDocRef).catch(() => null);
      if (sSnap && sSnap.exists()) {
        batch.update(siteDocRef, {
          assignedEngineers: arrayUnion(id),
          updatedAt: serverTimestamp()
        });
      }
    }
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
      ...(adminId ? { createdByAdmin: adminId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };
    if (password) {
      createPayload.password = password;
    }
    batch.set(userDocRef, createPayload, { merge: true });
    
    batch.set(engineerDocRef, {
      uid: id,
      name: name,
      phone: phone,
      email: email,
      role: "site_engineer",
      status: "active",
      assignedSites: selectedSites,
      holidayAllowance: Number(holidayAllowance) || 24,
      ...(adminId ? { createdByAdmin: adminId } : {}),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
      ...(password ? { password } : {})
    }, { merge: true });
    
    // Apply site assignments array on sites
    for (const siteId of selectedSites) {
      const siteDocRef = doc(db, "sites", siteId);
      const sSnap = await getDoc(siteDocRef).catch(() => null);
      if (sSnap && sSnap.exists()) {
        batch.update(siteDocRef, {
          assignedEngineers: arrayUnion(id),
          updatedAt: serverTimestamp()
        });
      }
    }
  }

  // Synchronize with canonical siteAssignments collection
  const assignmentsColl = collection(db, "siteAssignments");

  // 1. Remove deleted site assignments from siteAssignments collection
  if (sitesToRemove.length > 0) {
    const removePromises = sitesToRemove.map(siteId => {
      const q = query(
        assignmentsColl,
        where("engineerId", "==", id),
        where("siteId", "==", siteId)
      );
      return getDocs(q);
    });
    const removeSnaps = await Promise.all(removePromises);
    removeSnaps.forEach(snap => {
      snap.forEach(docSnap => {
        batch.delete(docSnap.ref);
      });
    });
  }

  // 2. Add new site assignments to siteAssignments collection
  const targetAddSites = isEditMode ? sitesToAdd : selectedSites;
  if (targetAddSites.length > 0) {
    const addPromises = targetAddSites.map(siteId => {
      const q = query(
        assignmentsColl,
        where("engineerId", "==", id),
        where("siteId", "==", siteId),
        where("status", "==", "active")
      );
      return getDocs(q).then(snap => ({ siteId, snap }));
    });
    const addResults = await Promise.all(addPromises);
    addResults.forEach(({ siteId, snap }) => {
      if (snap.empty) {
        const newAssignmentRef = doc(collection(db, "siteAssignments"));
        batch.set(newAssignmentRef, {
          siteId,
          engineerId: id,
          assignedBy: adminId || "admin",
          assignedAt: serverTimestamp(),
          status: "active"
        });
      }
    });
  }
  
  await batch.commit();
}

// Update password field for an engineer in Firestore database (Clear plaintext password and update timestamp)
export async function updateEngineerPasswordInDb(uid, newPassword) {
  const db = getDb();
  
  try {
    const engineerDocRef = doc(db, "siteEngineers", uid);
    await updateDoc(engineerDocRef, {
      password: deleteField(),
      updatedAt: serverTimestamp()
    });
  } catch (e) {}

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
  const trimmed = email.trim();
  
  try {
    const [superSnap, adminSnap, engSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, "superAdmins"), where("email", "==", trimmed))).catch(() => null),
      getDocs(query(collection(db, "admins"), where("email", "==", trimmed))).catch(() => null),
      getDocs(query(collection(db, "siteEngineers"), where("email", "==", trimmed))).catch(() => null),
      getDocs(query(collection(db, "users"), where("email", "==", trimmed))).catch(() => null)
    ]);

    if (superSnap && !superSnap.empty) {
      const doc = superSnap.docs[0];
      return { id: doc.id, uid: doc.id, ...doc.data() };
    }
    if (adminSnap && !adminSnap.empty) {
      const doc = adminSnap.docs[0];
      return { id: doc.id, uid: doc.id, ...doc.data() };
    }
    if (engSnap && !engSnap.empty) {
      const doc = engSnap.docs[0];
      const data = doc.data();
      return { id: doc.id, uid: doc.id, role: "site_engineer", fullName: data.name, phoneNumber: data.phone, ...data };
    }
    if (userSnap && !userSnap.empty) {
      const doc = userSnap.docs[0];
      return { id: doc.id, uid: doc.id, ...doc.data() };
    }
  } catch (e) {}
  return null;
}

// Fetch user profile by phone number
export async function getUserByPhone(phone) {
  const db = getDb();
  const trimmed = phone.trim();
  
  try {
    const [engSnap, userSnap] = await Promise.all([
      getDocs(query(collection(db, "siteEngineers"), where("phone", "==", trimmed))).catch(() => null),
      getDocs(query(collection(db, "users"), where("phoneNumber", "==", trimmed))).catch(() => null)
    ]);

    if (engSnap && !engSnap.empty) {
      const doc = engSnap.docs[0];
      const data = doc.data();
      return { id: doc.id, uid: doc.id, role: "site_engineer", fullName: data.name, phoneNumber: data.phone, ...data };
    }
    if (userSnap && !userSnap.empty) {
      const doc = userSnap.docs[0];
      return { id: doc.id, uid: doc.id, ...doc.data() };
    }
  } catch (e) {}
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

let inFlightGetSitesMap = {};

// Fetch all construction sites
// Fetch all construction sites (Shared canonical dataset for all authorized Admins)
export async function getSites(adminId = null) {
  const cacheKey = adminId || "__all__";
  if (inFlightGetSitesMap[cacheKey]) {
    return inFlightGetSitesMap[cacheKey];
  }

  inFlightGetSitesMap[cacheKey] = (async () => {
    try {
      const db = getDb();
      const sitesCollection = collection(db, "sites");
      const assignmentsColl = collection(db, "siteAssignments");

      const [sitesSnapshot, asgSnapshot] = await Promise.all([
        getDocs(sitesCollection),
        getDocs(assignmentsColl).catch(e => {
          console.warn("Could not fetch canonical siteAssignments for sites:", e);
          return null;
        })
      ]);
      
      // Authoritative: Fetch active site assignments from canonical collection to populate assignedEngineers accurately
      const activeSiteEngineersMap = {};
      if (asgSnapshot) {
        asgSnapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (data.status === "active" && data.siteId && data.engineerId) {
            if (!activeSiteEngineersMap[data.siteId]) {
              activeSiteEngineersMap[data.siteId] = new Set();
            }
            activeSiteEngineersMap[data.siteId].add(data.engineerId);
          }
        });
      }

      const sites = [];
      sitesSnapshot.forEach(doc => {
        const data = doc.data();
        const canonicalEngineers = activeSiteEngineersMap[doc.id]
          ? Array.from(activeSiteEngineersMap[doc.id])
          : [];

        sites.push({ 
          id: doc.id, 
          ...data,
          assignedEngineers: canonicalEngineers
        });
      });
      return sites;
    } finally {
      setTimeout(() => {
        delete inFlightGetSitesMap[cacheKey];
      }, 50);
    }
  })();

  return inFlightGetSitesMap[cacheKey];
}

// Create a new construction site document
export async function createSite(siteName, clientName, location, startDate, expectedEndDate, status, latitude = null, longitude = null, radius = 50, adminId = null, googlePlaceId = null, siteLocationName = null, budget = null) {
  const db = getDb();
  const newSiteRef = doc(collection(db, "sites"));

  const latVal = latitude !== null && latitude !== "" ? Number(latitude) : null;
  const lngVal = longitude !== null && longitude !== "" ? Number(longitude) : null;

  const budgetNum = Number(budget);
  if (budget === undefined || budget === null || budget === "") {
    throw new Error("Site Budget is required.");
  }
  if (isNaN(budgetNum) || budgetNum <= 0) {
    throw new Error("Site Budget must be a positive numeric value.");
  }

  await setDoc(newSiteRef, {
    siteName,
    clientName,
    location,
    assignedAddress: location,
    formattedAddress: location, // Task 6 formattedAddress field
    startDate,
    expectedEndDate,
    status,
    latitude: latVal,
    longitude: lngVal,
    googlePlaceId: googlePlaceId || null,
    placeId: googlePlaceId || null, // Task 6 placeId field
    siteLocationName: siteLocationName || "", // Requirement 4 siteLocationName
    locationName: siteLocationName || "", // Task 7.9 locationName field
    radius: Number(radius) || 50,
    budget: budgetNum,
    locationStatus: (latVal !== null && lngVal !== null) ? "Verified" : "Not Set",
    ...(adminId ? { createdByAdmin: adminId } : {}),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  });
  return newSiteRef.id;
}

// Update site details (including coordinates and googlePlaceId)
export async function updateSite(siteId, siteName, clientName, location, startDate, expectedEndDate, status, radius = 50, latitude = null, longitude = null, googlePlaceId = null, siteLocationName = null, budget = null) {
  const db = getDb();
  const siteDocRef = doc(db, "sites", siteId);

  const latVal = latitude !== null && latitude !== "" ? Number(latitude) : null;
  const lngVal = longitude !== null && longitude !== "" ? Number(longitude) : null;

  const budgetNum = Number(budget);
  if (budget === undefined || budget === null || budget === "") {
    throw new Error("Site Budget is required.");
  }
  if (isNaN(budgetNum) || budgetNum <= 0) {
    throw new Error("Site Budget must be a positive numeric value.");
  }

  await updateDoc(siteDocRef, {
    siteName,
    clientName,
    location,
    assignedAddress: location,
    formattedAddress: location, // Task 6 formattedAddress field
    startDate,
    expectedEndDate,
    status,
    latitude: latVal,
    longitude: lngVal,
    googlePlaceId: googlePlaceId || null,
    placeId: googlePlaceId || null, // Task 6 placeId field
    siteLocationName: siteLocationName || "", // Requirement 4 siteLocationName
    locationName: siteLocationName || "", // Task 7.9 locationName field
    locationStatus: (latVal !== null && lngVal !== null) ? "Verified" : "Not Set",
    radius: Number(radius) || 50,
    budget: budgetNum,
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
    const userDoc = await getUserProfile(engineerId);
    if (userDoc) {
      engineerName = userDoc.fullName || userDoc.name || "Site Engineer";
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

// In-memory cache for reverse geocoding coordinates (approx. 11m precision)
const geocodeCache = new Map();
const MAX_GEOCODE_CACHE_SIZE = 400;

// Reverse geocode helper via Nominatim OSM API
export async function reverseGeocodeLatLng(lat, lng) {
  const numLat = Number(lat);
  const numLng = Number(lng);
  if (isNaN(numLat) || isNaN(numLng)) {
    return {
      fullAddress: `Lat: ${lat}, Lng: ${lng}`,
      district: "",
      state: "",
      country: "",
      area: "",
      street: "",
      colony: ""
    };
  }

  const cacheKey = `${numLat.toFixed(4)}_${numLng.toFixed(4)}`;
  if (geocodeCache.has(cacheKey)) {
    return geocodeCache.get(cacheKey);
  }

  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${numLat}&lon=${numLng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'en',
        'User-Agent': 'VisvasBuilders-ConstructionSite-Verification/1.0 (contact@visvasbuilders.com)'
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
            ? getGeocodeDistance(numLat, numLng, resLat, resLng) 
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
            ? getGeocodeDistance(numLat, numLng, resLat, resLng) 
            : 0;
          if (dist > 300) {
            customFullAddress += ` (within ${Math.round(dist)}m of resolved geocode)`;
          }

          let areaParts = [];
          if (colony) areaParts.push(colony);
          if (suburb && suburb !== colony) areaParts.push(suburb);
          if (town && town !== colony && town !== suburb) areaParts.push(town);
          const area = areaParts.join(", ") || "";

          const formattedResult = {
            fullAddress: customFullAddress,
            district: district || address.city || "",
            state: state,
            country: country,
            area: area,
            street: street,
            colony: colony
          };

          if (geocodeCache.size >= MAX_GEOCODE_CACHE_SIZE) {
            const firstKey = geocodeCache.keys().next().value;
            geocodeCache.delete(firstKey);
          }
          geocodeCache.set(cacheKey, formattedResult);

          return formattedResult;
        }
      }
    }
  } catch (e) {
    console.warn("Reverse geocode request failed:", e);
  }

  const fallbackResult = {
    fullAddress: `Lat: ${numLat.toFixed(6)}, Lng: ${numLng.toFixed(6)}`,
    district: "",
    state: "",
    country: "",
    area: "",
    street: "",
    colony: ""
  };
  return fallbackResult;
}

// Delete site document
export async function deleteSite(siteId) {
  const db = getDb();
  
  // 1. Fetch active assignments for this site
  const assignmentsColl = collection(db, "siteAssignments");
  const q = query(
    assignmentsColl,
    where("siteId", "==", siteId),
    where("status", "==", "active")
  );
  const snap = await getDocs(q);
  
  // 2. Perform validation inside Firestore transaction and delete if valid
  await runTransaction(db, async (transaction) => {
    if (!snap.empty) {
      for (const docSnap of snap.docs) {
        const data = docSnap.data();
        const engineerId = data.engineerId;
        
        // Fetch engineer profile within the transaction to check status
        const engineerRef = doc(db, "siteEngineers", engineerId);
        const engineerDoc = await transaction.get(engineerRef);
        let engineerData = null;
        if (engineerDoc.exists()) {
          engineerData = engineerDoc.data();
        } else {
          const userRef = doc(db, "users", engineerId);
          const userDoc = await transaction.get(userRef);
          if (userDoc.exists()) {
            engineerData = userDoc.data();
          }
        }
        
        if (engineerData && engineerData.status === "active") {
          throw new Error("Cannot delete site: This site is currently assigned to active Site Engineers.");
        }
      }
    }
    
    // Atomically delete the site
    const siteDocRef = doc(db, "sites", siteId);
    transaction.delete(siteDocRef);
  });
}

// Helper: Identifies genuine Engineer Attendance records
// Strictly excludes labour submission lock records, material locks, or non-engineer attendance metadata.
export function isEngineerAttendanceRecord(data, docId = "") {
  if (!data) return false;
  const idStr = String(docId || data.id || "");
  
  // 1. Exclude labour submission locks or other lock docs
  if (
    data.type === "labour_attendance_lock" ||
    data.type === "material_lock" ||
    idStr.startsWith("labour_lock_") ||
    idStr.startsWith("lock_")
  ) {
    return false;
  }
  
  // 2. If it has a teamId and no photo/GPS/time, it is a labour lock record, not engineer attendance
  if (data.teamId && !data.time && !data.latitude && !data.photoUrl) {
    return false;
  }

  // 3. Must have a date and an engineer/user identifier
  const hasDate = Boolean(
    data.date || 
    data.attendanceDate || 
    data.dateStr || 
    (data.timestamp?.seconds ? new Date(data.timestamp.seconds * 1000).toISOString().split("T")[0] : null) ||
    (data.checkInTime?.seconds ? new Date(data.checkInTime.seconds * 1000).toISOString().split("T")[0] : null)
  );
  
  const hasUser = Boolean(
    data.engineerId || 
    data.userId || 
    data.uid || 
    data.user_id || 
    data.engineer_id || 
    data.engineerEmail || 
    data.email || 
    data.engineerName ||
    idStr.startsWith("att_")
  );

  if (!hasDate || !hasUser) return false;

  return true;
}

/**
 * Score the completeness and validity of an engineer attendance record
 * Higher score = more complete, valid record
 */
function scoreAttendanceRecord(rec) {
  let score = 0;
  if (!rec) return -1;
  if (!isEngineerAttendanceRecord(rec, rec.id)) return -1;

  // Has valid human-readable time string (not empty and not "--")
  if (rec.time && rec.time !== "--" && typeof rec.time === "string" && rec.time.trim() !== "") {
    score += 20;
  }
  // Has valid GPS latitude and longitude
  if (rec.latitude !== undefined && rec.latitude !== null && !isNaN(Number(rec.latitude)) && Number(rec.latitude) !== 0) {
    score += 20;
  }
  if (rec.longitude !== undefined && rec.longitude !== null && !isNaN(Number(rec.longitude)) && Number(rec.longitude) !== 0) {
    score += 20;
  }
  // Has selfie / photo proof
  if (rec.photoUrl && typeof rec.photoUrl === "string" && rec.photoUrl.trim() !== "") {
    score += 15;
  }
  // Has address
  if (rec.address && typeof rec.address === "string" && rec.address.trim() !== "" && rec.address !== "GPS Captured") {
    score += 10;
  }
  // Status check
  if (rec.status === "checked_out") {
    score += 8;
  } else if (rec.status === "present" || rec.status === "verified") {
    score += 5;
  }
  // Verification status
  if (rec.verificationStatus === "verified" || rec.verificationStatus === "success") {
    score += 5;
  }
  // Timestamp present
  if (rec.timestamp || rec.checkInTime) {
    score += 5;
  }
  return score;
}

/**
 * Single source of truth deduplication:
 * Groups records by siteId + engineerId + date and returns exactly ONE canonical valid daily record per site.
 */
export function deduplicateDailyAttendance(records = []) {
  if (!Array.isArray(records) || records.length === 0) return [];

  // 1. Filter to genuine engineer attendance records only
  const validOnly = records.filter(r => isEngineerAttendanceRecord(r, r.id));

  // 2. Group by siteId + engineerId + date (Canonical Attendance Identity)
  const groups = new Map();

  for (const rec of validOnly) {
    const engId = String(rec.engineerId || rec.userId || rec.uid || rec.user_id || rec.engineer_id || "").trim();
    const dateStr = String(
      rec.date || 
      rec.attendanceDate || 
      rec.dateStr || 
      (rec.timestamp?.seconds ? new Date(rec.timestamp.seconds * 1000).toISOString().split("T")[0] : "") ||
      (rec.checkInTime?.seconds ? new Date(rec.checkInTime.seconds * 1000).toISOString().split("T")[0] : "")
    ).trim();
    const siteId = String(rec.siteId || "").trim();
    if (!engId || !dateStr) continue;

    // Site-scoped key ensures independent site records for the same engineer and date
    const sitePrefix = siteId || "_nosite";
    const key = `${sitePrefix}_${engId}_${dateStr}`;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key).push(rec);
  }

  // 3. For each group, pick the highest scoring record and normalize canonical fields
  const result = [];
  for (const groupList of groups.values()) {
    let chosen;
    if (groupList.length === 1) {
      chosen = groupList[0];
    } else {
      // Sort descending by completeness score, then by timestamp
      groupList.sort((a, b) => {
        const scoreA = scoreAttendanceRecord(a);
        const scoreB = scoreAttendanceRecord(b);
        if (scoreB !== scoreA) return scoreB - scoreA;

        const timeA = a.checkInTime?.seconds || a.timestamp?.seconds || 0;
        const timeB = b.checkInTime?.seconds || b.timestamp?.seconds || 0;
        return timeA - timeB; // prefer original / earlier checkin if equal score
      });
      chosen = groupList[0];
    }

    const normDate = String(
      chosen.date || 
      chosen.attendanceDate || 
      chosen.dateStr || 
      (chosen.timestamp?.seconds ? new Date(chosen.timestamp.seconds * 1000).toISOString().split("T")[0] : "") ||
      (chosen.checkInTime?.seconds ? new Date(chosen.checkInTime.seconds * 1000).toISOString().split("T")[0] : "")
    ).trim();

    const checkInFormatted = chosen.time && chosen.time !== "--"
      ? chosen.time
      : (chosen.checkInTime?.seconds 
          ? new Date(chosen.checkInTime.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
          : (chosen.timestamp?.seconds 
              ? new Date(chosen.timestamp.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
              : "--"));

    const checkOutFormatted = chosen.checkOutTime?.seconds 
      ? new Date(chosen.checkOutTime.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
      : (chosen.checkOutTime && typeof chosen.checkOutTime === "string" ? chosen.checkOutTime : null);

    const isCheckedOut = chosen.status === "checked_out" || Boolean(chosen.checkOutTime);
    const isVerified = chosen.verificationStatus === "verified" || chosen.verificationStatus === "success" || chosen.status === "present" || chosen.status === "checked_out";

    result.push({
      ...chosen,
      date: normDate,
      attendanceDate: normDate,
      engineerId: chosen.engineerId || chosen.userId || chosen.uid || "",
      userId: chosen.userId || chosen.engineerId || chosen.uid || "",
      siteId: chosen.siteId || "",
      time: checkInFormatted,
      checkInTimeFormatted: checkInFormatted,
      checkOutTimeFormatted: checkOutFormatted,
      isCheckedOut,
      isVerified,
      addressDisplay: chosen.address && chosen.address !== "GPS Captured" 
        ? chosen.address 
        : (chosen.latitude && chosen.longitude ? `${Number(chosen.latitude).toFixed(5)}, ${Number(chosen.longitude).toFixed(5)}` : "GPS Captured")
    });
  }

  // 4. Sort results descending by date, then by checkInTime
  return result.sort((a, b) => {
    const dateA = a.date || a.attendanceDate || "";
    const dateB = b.date || b.attendanceDate || "";
    const cmp = dateB.localeCompare(dateA);
    if (cmp !== 0) return cmp;
    const timeA = a.checkInTime?.seconds || a.timestamp?.seconds || 0;
    const timeB = b.checkInTime?.seconds || b.timestamp?.seconds || 0;
    return timeB - timeA;
  });
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
    const todayStr = new Date().toISOString().split("T")[0];
    const fetchEngineers = async () => {
      try {
        const engineersQuery = query(collection(db, "siteEngineers"), where("status", "==", "active"));
        const snap = await getDocs(engineersQuery);
        if (!snap.empty) return snap.size;
      } catch (e) {}
      const legacyQuery = query(collection(db, "users"), where("role", "==", "site_engineer"), where("status", "==", "active"));
      const legacySnap = await getDocs(legacyQuery);
      return legacySnap.size;
    };

    const [sitesSnap, engineersCount, attendanceSnap, materialsSnap, workersSnap] = await Promise.all([
      getDocs(collection(db, "sites")).catch(() => ({ size: 0 })),
      fetchEngineers().catch(() => 0),
      getDocs(query(collection(db, "attendance"), where("date", "==", todayStr))).catch(() => ({ docs: [] })),
      getDocs(collection(db, "materials")).catch(() => ({ size: 0 })),
      getDocs(query(collection(db, "workers"), where("status", "==", "active"))).catch(() => ({ size: 0 }))
    ]);

    totalSitesCount = sitesSnap.size || 0;
    activeEngineersCount = engineersCount || 0;
    
    if (attendanceSnap && attendanceSnap.docs) {
      const todayDocs = attendanceSnap.docs.map(d => ({ id: d.id, ...d.data() }));
      attendanceTodayCount = deduplicateDailyAttendance(todayDocs).length;
    } else {
      attendanceTodayCount = 0;
    }
    
    totalMaterialsCount = materialsSnap.size || 0;
    activeWorkersCount = workersSnap.size || 0;
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

// ==========================================================================
// PRODUCTION ATTENDANCE VERIFICATION GATE SERVICE
// ==========================================================================

/**
 * Canonical Attendance Gate Helper:
 * Determines if the engineer has completed verified attendance for a Site + Calendar Date.
 * Reusable single source of truth consumed by Materials, Labour, Progress, and Transfers.
 * 
 * @param {string} siteId - Target Site ID
 * @param {string} engineerId - Authenticated Engineer UID
 * @param {string} dateStr - Target Date (YYYY-MM-DD)
 * @returns {Promise<boolean>} - True if valid verified attendance exists for that exact Site + Engineer + Day, false otherwise
 */
export async function hasVerifiedAttendanceForDate(siteId, engineerId, dateStr) {
  if (!siteId || !engineerId || !dateStr) return false;

  const cleanSiteId = String(siteId).trim();
  const cleanEngineerId = String(engineerId).trim();
  const cleanDateStr = String(dateStr).trim();

  if (!cleanSiteId || !cleanEngineerId || !cleanDateStr) return false;

  try {
    const db = getDb();
    const attendanceColl = collection(db, "attendance");

    const isValidRecordForSite = (data, id) => {
      // 1. Exclude labour submission locks or non-engineer records
      if (!isEngineerAttendanceRecord(data, id)) {
        return false;
      }
      // 2. Ensure date matches
      const recDate = String(data.date || data.attendanceDate || "").trim();
      if (recDate !== cleanDateStr) return false;

      // 3. Ensure engineer/user strictly matches the requested engineerId
      const recUser = String(data.engineerId || data.userId || "").trim();
      if (!recUser || recUser !== cleanEngineerId) return false;

      // 4. Canonical Site Match: Must strictly match the requested siteId
      const recSite = String(data.siteId || "").trim();
      if (recSite !== cleanSiteId) return false;

      // 5. Ensure valid presence/verification status and not rejected/absent/failed
      const isPresent = data.status === "present" || data.status === "checked_out" || data.status === "verified";
      const isVerified = data.verificationStatus === "verified" || data.verificationStatus === "success" || isPresent || Boolean(data.time && data.time !== "--");
      const isNotRejected = data.status !== "absent" && data.status !== "rejected" && data.status !== "cancelled" && data.status !== "failed";
      return isVerified && isNotRejected;
    };

    // Query 1: Deterministic engineer-specific doc lookups
    const docIds = [
      `att_${cleanSiteId}_${cleanEngineerId}_${cleanDateStr}`,
      `att_${cleanEngineerId}_${cleanSiteId}_${cleanDateStr}`,
      `${cleanSiteId}_${cleanEngineerId}_${cleanDateStr}`,
      `att_${cleanEngineerId}_${cleanDateStr}`,
      `${cleanEngineerId}_${cleanDateStr}`
    ];

    for (const dId of docIds) {
      try {
        const snap = await getDoc(doc(db, "attendance", dId));
        if (snap.exists() && isValidRecordForSite(snap.data(), snap.id)) {
          return true;
        }
      } catch (e) {}
    }

    // Query 2: by siteId, engineerId, date
    try {
      const q1 = query(
        attendanceColl,
        where("siteId", "==", cleanSiteId),
        where("engineerId", "==", cleanEngineerId),
        where("date", "==", cleanDateStr)
      );
      const snap1 = await getDocs(q1);
      for (const docSnap of snap1.docs) {
        if (isValidRecordForSite(docSnap.data(), docSnap.id)) {
          return true;
        }
      }
    } catch (e) {}

    // Query 3: by siteId, userId, date (legacy field compatibility)
    try {
      const q2 = query(
        attendanceColl,
        where("siteId", "==", cleanSiteId),
        where("userId", "==", cleanEngineerId),
        where("date", "==", cleanDateStr)
      );
      const snap2 = await getDocs(q2);
      for (const docSnap of snap2.docs) {
        if (isValidRecordForSite(docSnap.data(), docSnap.id)) {
          return true;
        }
      }
    } catch (e) {}

    // Query 4: fallback by engineerId + date (evaluated through isValidRecordForSite)
    try {
      const q3 = query(
        attendanceColl,
        where("engineerId", "==", cleanEngineerId),
        where("date", "==", cleanDateStr)
      );
      const snap3 = await getDocs(q3);
      for (const docSnap of snap3.docs) {
        if (isValidRecordForSite(docSnap.data(), docSnap.id)) {
          return true;
        }
      }
    } catch (e) {}

    // Query 5: fallback by userId + date
    try {
      const q4 = query(
        attendanceColl,
        where("userId", "==", cleanEngineerId),
        where("date", "==", cleanDateStr)
      );
      const snap4 = await getDocs(q4);
      for (const docSnap of snap4.docs) {
        if (isValidRecordForSite(docSnap.data(), docSnap.id)) {
          return true;
        }
      }
    } catch (e) {}

  } catch (err) {
    console.error("Attendance Gate verification check failed:", err);
  }

  return false;
}

/**
 * Backward compatible alias for Attendance Gate verification
 */
export async function verifyEngineerAttendanceGate(engineerId, siteId, dateStr) {
  return hasVerifiedAttendanceForDate(siteId, engineerId, dateStr);
}

// Get the engineer's attendance record for a specific site and date
export async function getTodayAttendance(engineerId, dateStr, siteId = null) {
  if (!engineerId || !dateStr) return null;
  const cleanEngineerId = String(engineerId).trim();
  const cleanDateStr = String(dateStr).trim();
  const cleanSiteId = siteId ? String(siteId).trim() : null;

  const db = getDb();
  const attendanceColl = collection(db, "attendance");

  const candidates = [];
  const seenIds = new Set();

  const addDoc = (id, data) => {
    if (!seenIds.has(id)) {
      seenIds.add(id);
      candidates.push({ id, ...data });
    }
  };

  // Direct deterministic lookups
  const directDocIds = [
    cleanSiteId ? `att_${cleanSiteId}_${cleanEngineerId}_${cleanDateStr}` : null,
    cleanSiteId ? `att_${cleanEngineerId}_${cleanSiteId}_${cleanDateStr}` : null,
    cleanSiteId ? `${cleanSiteId}_${cleanEngineerId}_${cleanDateStr}` : null,
    `att_${cleanEngineerId}_${cleanDateStr}`,
    `${cleanEngineerId}_${cleanDateStr}`
  ].filter(Boolean);

  for (const docId of directDocIds) {
    try {
      const directSnap = await getDoc(doc(db, "attendance", docId));
      if (directSnap.exists()) {
        addDoc(directSnap.id, directSnap.data());
      }
    } catch (e) {}
  }

  // Query by siteId + engineerId + date if siteId is present
  if (cleanSiteId) {
    try {
      const qSite = query(
        attendanceColl,
        where("siteId", "==", cleanSiteId),
        where("engineerId", "==", cleanEngineerId),
        where("date", "==", cleanDateStr)
      );
      const snapSite = await getDocs(qSite);
      snapSite.forEach(docSnap => addDoc(docSnap.id, docSnap.data()));
    } catch (e) {}

    try {
      const qSiteUser = query(
        attendanceColl,
        where("siteId", "==", cleanSiteId),
        where("userId", "==", cleanEngineerId),
        where("date", "==", cleanDateStr)
      );
      const snapSiteUser = await getDocs(qSiteUser);
      snapSiteUser.forEach(docSnap => addDoc(docSnap.id, docSnap.data()));
    } catch (e) {}
  }

  // Query 1: engineerId + date
  try {
    const q1 = query(
      attendanceColl,
      where("engineerId", "==", cleanEngineerId),
      where("date", "==", cleanDateStr)
    );
    const snap1 = await getDocs(q1);
    snap1.forEach(docSnap => addDoc(docSnap.id, docSnap.data()));
  } catch (e) {}

  // Query 2: userId + date (compatibility)
  try {
    const q2 = query(
      attendanceColl,
      where("userId", "==", cleanEngineerId),
      where("date", "==", cleanDateStr)
    );
    const snap2 = await getDocs(q2);
    snap2.forEach(docSnap => addDoc(docSnap.id, docSnap.data()));
  } catch (e) {}

  // Deduplicate and filter out labour locks
  const deduplicated = deduplicateDailyAttendance(candidates);
  if (deduplicated.length === 0) return null;

  if (cleanSiteId) {
    const siteMatch = deduplicated.find(r => String(r.siteId || "").trim() === cleanSiteId);
    return siteMatch || null;
  }

  return deduplicated[0];
}

/**
 * Real-time listener for an engineer's daily attendance records
 * @param {string} engineerId 
 * @param {string} dateStr 
 * @param {function} callback 
 * @param {string|null} siteId 
 * @returns {function} unsubscribe
 */
export function subscribeTodayAttendance(engineerId, dateStr, callback, siteId = null) {
  if (!engineerId || !dateStr || typeof callback !== "function") {
    return () => {};
  }
  const cleanEngineerId = String(engineerId).trim();
  const cleanDateStr = String(dateStr).trim();
  const cleanSiteId = siteId ? String(siteId).trim() : null;

  const db = getDb();
  const attendanceColl = collection(db, "attendance");

  const q = query(
    attendanceColl,
    where("engineerId", "==", cleanEngineerId),
    where("date", "==", cleanDateStr)
  );

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    const deduplicated = deduplicateDailyAttendance(list);
    if (cleanSiteId) {
      const siteMatch = deduplicated.find(r => String(r.siteId || "").trim() === cleanSiteId);
      callback(siteMatch || null);
    } else {
      callback(deduplicated.length > 0 ? deduplicated[0] : null);
    }
  }, (err) => {
    console.error("subscribeTodayAttendance error:", err);
  });
}

// Mark attendance (Idempotent and duplicate-safe daily save mechanism)
export async function markAttendance(engineerId, siteId, dateStr, latitude, longitude, accuracy, address, photoUrl = "", verificationStatus = "verified", distance = null) {
  if (!engineerId || !siteId || !dateStr) {
    throw new Error("Engineer ID, Site ID, and Date are required to mark attendance.");
  }
  const cleanEngineerId = String(engineerId).trim();
  const cleanSiteId = String(siteId).trim();
  const cleanDateStr = String(dateStr).trim();

  const db = getDb();
  
  // 1. Idempotent check for THIS SPECIFIC SITE: if valid attendance already recorded for this engineer on this site & date
  const existing = await getTodayAttendance(cleanEngineerId, cleanDateStr, cleanSiteId);
  if (existing) {
    // If already marked present for this site with valid GPS / time, preserve it idempotently
    if (existing.status === "present" || existing.status === "checked_out" || existing.status === "verified") {
      return existing;
    }
  }
  
  // Format local date and time:
  const now = new Date();
  let hours = now.getHours();
  const minutes = now.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const minStr = minutes < 10 ? '0' + minutes : minutes;
  const timeStr = `${hours}:${minStr} ${ampm}`;

  // Deterministic, idempotent document ID per Site + Engineer + Date
  const deterministicDocId = `att_${cleanSiteId}_${cleanEngineerId}_${cleanDateStr}`;
  const docRef = doc(db, "attendance", deterministicDocId);

  const payload = {
    type: "engineer_attendance",
    userId: cleanEngineerId,
    engineerId: cleanEngineerId,
    siteId: cleanSiteId,
    date: cleanDateStr,
    attendanceDate: cleanDateStr,
    time: timeStr,
    latitude: Number(latitude),
    longitude: Number(longitude),
    gpsAccuracy: Number(accuracy) || null,
    address: address || "",
    timestamp: serverTimestamp(),
    checkInTime: serverTimestamp(),
    photoUrl: photoUrl || "",
    verificationStatus: verificationStatus || "verified",
    status: "present",
    distance: distance !== null && distance !== undefined ? Number(distance) : null
  };

  await setDoc(docRef, payload, { merge: true });
  return { id: deterministicDocId, ...payload };
}

// Mark check-out attendance
export async function markCheckOut(attendanceId, latitude, longitude, accuracy, address, photoUrl = "", distance = null) {
  const db = getDb();
  const attRef = doc(db, "attendance", attendanceId);
  await updateDoc(attRef, {
    checkOutTime: serverTimestamp(),
    checkOutLatitude: Number(latitude),
    checkOutLongitude: Number(longitude),
    checkOutAccuracy: Number(accuracy) || null,
    checkOutAddress: address || "",
    checkOutPhotoUrl: photoUrl,
    status: "checked_out",
    checkOutDistance: distance !== null ? Number(distance) : null // Store check-out distance from site
  });
}

// Helper to format Firestore timestamp/date into DD/MM/YYYY and hh:mm AM/PM
export function formatPhotoTimestamp(timestamp) {
  if (!timestamp) return { date: "--", time: "--" };
  
  let dateObj;
  if (timestamp.toDate && typeof timestamp.toDate === "function") {
    dateObj = timestamp.toDate();
  } else if (timestamp.seconds !== undefined) {
    dateObj = new Date(timestamp.seconds * 1000);
  } else {
    dateObj = new Date(timestamp);
  }
  
  if (isNaN(dateObj.getTime())) {
    return { date: "--", time: "--" };
  }
  
  // Format Date: DD/MM/YYYY
  const day = String(dateObj.getDate()).padStart(2, '0');
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const year = dateObj.getFullYear();
  const dateStr = `${day}/${month}/${year}`;
  
  // Format Time: hh:mm AM/PM
  let hours = dateObj.getHours();
  const minutes = String(dateObj.getMinutes()).padStart(2, '0');
  const ampm = hours >= 12 ? 'PM' : 'AM';
  hours = hours % 12;
  hours = hours ? hours : 12; // the hour '0' should be '12'
  const hoursStr = String(hours).padStart(2, '0');
  const timeStr = `${hoursStr}:${minutes} ${ampm}`;
  
  return {
    date: dateStr,
    time: timeStr
  };
}

// Save site photo
export async function saveSitePhoto(engineerId, siteId, imageUrl, latitude, longitude, photoType = "Site Photo") {
  const db = getDb();
  
  // Retrieve site details
  let siteName = "Unknown Site";
  try {
    const siteSnap = await getDoc(doc(db, "sites", siteId));
    if (siteSnap.exists()) {
      siteName = siteSnap.data().siteName || "Unknown Site";
    }
  } catch (e) {
    console.error("Failed to retrieve site name for photo:", e);
  }
  
  // Retrieve engineer details
  let engineerName = "Unknown Engineer";
  try {
    const engSnap = await getDoc(doc(db, "siteEngineers", engineerId));
    if (engSnap.exists()) {
      engineerName = engSnap.data().name || "Unknown Engineer";
    } else {
      const userSnap = await getDoc(doc(db, "users", engineerId));
      if (userSnap.exists()) {
        engineerName = userSnap.data().fullName || userSnap.data().name || "Unknown Engineer";
      }
    }
  } catch (e) {
    console.error("Failed to retrieve engineer name for photo:", e);
  }

  const newPhotoRef = doc(collection(db, "sitePhotos"));
  await setDoc(newPhotoRef, {
    engineerId,
    engineerName,
    siteId,
    siteName,
    imageUrl,
    latitude,
    longitude,
    uploadedAt: serverTimestamp(),
    capturedAt: serverTimestamp(), // Keep for backwards compatibility
    photoType
  });
  
  return newPhotoRef.id;
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
    const data = doc.data();
    const timestamp = data.uploadedAt || data.capturedAt;
    const { date, time } = formatPhotoTimestamp(timestamp);
    photos.push({ 
      id: doc.id, 
      ...data,
      createdDate: date,
      createdTime: time
    });
  });
  return photos.sort((a, b) => {
    const timeA = a.uploadedAt?.seconds || (a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0);
    const timeB = b.uploadedAt?.seconds || (b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0);
    return timeB - timeA;
  });
}

// Subscribe to site photos in real-time
export function subscribePhotosForSite(siteId, onUpdate) {
  const db = getDb();
  const q = query(
    collection(db, "sitePhotos"),
    where("siteId", "==", siteId)
  );
  
  return onSnapshot(q, (snapshot) => {
    const photos = [];
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      const timestamp = data.uploadedAt || data.capturedAt;
      const { date, time } = formatPhotoTimestamp(timestamp);
      photos.push({
        id: docSnap.id,
        ...data,
        createdDate: date,
        createdTime: time
      });
    });
    
    // Sort descending by uploadedAt/capturedAt
    photos.sort((a, b) => {
      const timeA = a.uploadedAt?.seconds || (a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0);
      const timeB = b.uploadedAt?.seconds || (b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0);
      return timeB - timeA;
    });
    
    onUpdate(photos);
  }, (error) => {
    console.error("subscribePhotosForSite failed:", error);
  });
}

// Save progress report (daily updates)
export async function saveDailyProgressReport(engineerId, siteId, description, progress, photoIds = [], additionalNotes = {}) {
  const db = getDb();
  const reportData = {
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
  };

  // Write to reports
  const newReportRef = doc(collection(db, "reports"));
  await setDoc(newReportRef, reportData);

  // Write to legacy dailyUpdates using the same document ID for backward compatibility
  try {
    const legacyRef = doc(db, "dailyUpdates", newReportRef.id);
    await setDoc(legacyRef, reportData);
  } catch (e) {}

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
    const userDoc = await getUserProfile(engineerId);
    if (userDoc) {
      engineerName = userDoc.fullName || userDoc.name || "Site Engineer";
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
  let updatesColl = collection(db, "reports");
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
  let snap;
  try {
    snap = await getDocs(q);
  } catch (e) {
    updatesColl = collection(db, "dailyUpdates");
    if (siteId) {
      q = query(
        updatesColl,
        where("engineerId", "==", engineerId),
        where("siteId", "==", siteId)
      );
    } else {
      q = query(updatesColl, where("engineerId", "==", engineerId));
    }
    snap = await getDocs(q);
  }
  if (snap.empty) {
    try {
      const fallbackColl = collection(db, "dailyUpdates");
      let fallbackQ;
      if (siteId) {
        fallbackQ = query(
          fallbackColl,
          where("engineerId", "==", engineerId),
          where("siteId", "==", siteId)
        );
      } else {
        fallbackQ = query(fallbackColl, where("engineerId", "==", engineerId));
      }
      const fallbackSnap = await getDocs(fallbackQ);
      if (!fallbackSnap.empty) {
        snap = fallbackSnap;
      }
    } catch (err) {}
  }
  const list = [];
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

// Get all active sites assigned to an engineer from canonical siteAssignments
export async function getAssignedSitesForEngineer(engineerId) {
  const db = getDb();
  if (!engineerId) return [];
  
  const { lookupMap } = await buildCanonicalEngineersLookup();
  const resolved = resolveEngineerIdentity(engineerId, lookupMap);
  const candidateEngIds = new Set([
    engineerId,
    resolved.profile?.id,
    resolved.profile?.uid,
    resolved.profile?.docId,
    resolved.profile?.customId,
    resolved.profile?.engineerId
  ].filter(Boolean));

  // 1. Fetch active assignments directly from canonical siteAssignments collection
  const assignmentsColl = collection(db, "siteAssignments");
  const snap = await getDocs(assignmentsColl).catch(() => ({ docs: [] }));
  const assignedSiteIds = new Set();

  snap.docs.forEach(d => {
    const data = d.data();
    if (data.status === "active" && candidateEngIds.has(data.engineerId || data.userId || data.uid)) {
      if (data.siteId) assignedSiteIds.add(data.siteId);
    }
  });

  // Also include assignedSites array from engineer profile if any
  if (resolved.profile && Array.isArray(resolved.profile.assignedSites)) {
    resolved.profile.assignedSites.forEach(s => assignedSiteIds.add(s));
  }

  if (assignedSiteIds.size === 0) {
    return [];
  }
  
  // 2. Query sites collection for all these site documents
  const allSites = await getSites();
  return allSites.filter(site => assignedSiteIds.has(site.id) && site.status !== "Deleted");
}

// Get all site assignments (detailed list with site and engineer profiles)
export async function getSiteAssignmentsDetailed(adminId = null) {
  const db = getDb();
  const assignmentsColl = collection(db, "siteAssignments");

  const [snapshot, sites, { lookupMap }] = await Promise.all([
    getDocs(assignmentsColl),
    getSites(adminId),
    buildCanonicalEngineersLookup()
  ]);

  const detailedAssignments = [];
  const seenPairs = new Set();

  snapshot.forEach(docSnap => {
    const data = docSnap.data();
    // Only include valid active assignments
    if (data.status !== "active") return;

    const rawEngRef = data.engineerId || data.userId || data.uid || data.id;
    if (!rawEngRef) return;

    // Deduplicate any accidental duplicate (siteId + engineerRef) records
    const pairKey = `${data.siteId}_${rawEngRef}`;
    if (seenPairs.has(pairKey)) return;
    seenPairs.add(pairKey);

    const site = sites.find(s => s.id === data.siteId);
    const resolvedEng = resolveEngineerIdentity(rawEngRef, lookupMap);

    detailedAssignments.push({
      id: docSnap.id,
      siteId: data.siteId,
      engineerId: rawEngRef,
      assignedBy: data.assignedBy,
      assignedAt: data.assignedAt,
      status: data.status,
      siteName: site ? site.siteName : (data.siteName || `Site (${data.siteId})`),
      location: site ? site.location : (data.location || "--"),
      clientName: site ? site.clientName : (data.clientName || ""),
      isEngineerResolved: resolvedEng.isResolved,
      engineerName: resolvedEng.engineerName,
      engineerEmail: resolvedEng.engineerEmail,
      engineerDisplayId: resolvedEng.engineerDisplayId,
      engineerPhone: resolvedEng.phoneNumber || "",
      engineerStatus: resolvedEng.status || "active"
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

  // Validation: Check if engineer exists and is active using unified lookup
  const { lookupMap } = await buildCanonicalEngineersLookup();
  const resolved = resolveEngineerIdentity(engineerId, lookupMap);
  if (!resolved.isResolved) {
    throw new Error("Selected engineer profile does not exist.");
  }
  if (resolved.status !== "active") {
    throw new Error("Cannot assign site to an inactive engineer.");
  }

  const canonicalEngId = resolved.profile.id || resolved.profile.uid || engineerId;
  const candidateEngIds = new Set([
    canonicalEngId,
    engineerId,
    resolved.profile?.uid,
    resolved.profile?.id,
    resolved.profile?.docId
  ].filter(Boolean));

  // Validation: Prevent duplicate active assignment
  const assignmentsColl = collection(db, "siteAssignments");
  const q = query(
    assignmentsColl,
    where("siteId", "==", siteId),
    where("status", "==", "active")
  );
  const existingSnapshot = await getDocs(q);
  const isAlreadyAssigned = existingSnapshot.docs.some(d => {
    const data = d.data();
    const existingRef = data.engineerId || data.userId || data.uid;
    return candidateEngIds.has(existingRef);
  });
  if (isAlreadyAssigned) {
    throw new Error("This engineer is already actively assigned to this site.");
  }

  // Write new assignment doc
  const batch = writeBatch(db);
  const newAssignmentRef = doc(collection(db, "siteAssignments"));
  batch.set(newAssignmentRef, {
    siteId,
    engineerId: canonicalEngId,
    assignedBy: adminId || "admin",
    assignedAt: serverTimestamp(),
    status: "active"
  });

  // Safely update engineer's profile assignedSites list if docs exist
  for (const engKey of candidateEngIds) {
    const seRef = doc(db, "siteEngineers", engKey);
    const seSnap = await getDoc(seRef).catch(() => null);
    if (seSnap && seSnap.exists()) {
      batch.update(seRef, {
        assignedSites: arrayUnion(siteId),
        updatedAt: serverTimestamp()
      });
    }

    const userRef = doc(db, "users", engKey);
    const userSnap = await getDoc(userRef).catch(() => null);
    if (userSnap && userSnap.exists()) {
      batch.update(userRef, {
        assignedSites: arrayUnion(siteId),
        updatedAt: serverTimestamp()
      });
    }
  }

  // Safely update site's assignedEngineers list if doc exists
  const siteDocRef = doc(db, "sites", siteId);
  const siteSnap = await getDoc(siteDocRef).catch(() => null);
  if (siteSnap && siteSnap.exists()) {
    batch.update(siteDocRef, {
      assignedEngineers: arrayUnion(canonicalEngId),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
}

// Remove engineer from site (delete or deactivate)
export async function removeEngineerFromSite(assignmentId) {
  const db = getDb();
  let siteId = null;
  let engineerId = null;
  let assignmentDocRef = null;

  // 1. Try to find assignment record by direct doc ID
  if (assignmentId) {
    assignmentDocRef = doc(db, "siteAssignments", assignmentId);
    const assignmentDoc = await getDoc(assignmentDocRef).catch(() => null);
    if (assignmentDoc && assignmentDoc.exists()) {
      const assignmentData = assignmentDoc.data();
      siteId = assignmentData.siteId;
      engineerId = assignmentData.engineerId || assignmentData.userId || assignmentData.uid;
    }
  }

  // 2. Fallback: Search in all siteAssignments if not found by direct doc ID
  if (!siteId || !engineerId) {
    const asgSnap = await getDocs(collection(db, "siteAssignments")).catch(() => ({ docs: [] }));
    const match = asgSnap.docs.find(d => d.id === assignmentId);
    if (match) {
      assignmentDocRef = match.ref;
      siteId = match.data().siteId;
      engineerId = match.data().engineerId || match.data().userId || match.data().uid;
    }
  }

  if (!siteId || !engineerId) {
    throw new Error("Assignment record not found.");
  }

  // 3. Resolve canonical engineer keys
  const { lookupMap } = await buildCanonicalEngineersLookup();
  const resolved = resolveEngineerIdentity(engineerId, lookupMap);
  const candidateEngIds = new Set([
    engineerId,
    resolved.profile?.id,
    resolved.profile?.uid,
    resolved.profile?.docId,
    resolved.profile?.customId,
    resolved.profile?.engineerId
  ].filter(Boolean));

  // 4. Batch delete all matching siteAssignment docs for this (siteId, engineer)
  const assignmentsColl = collection(db, "siteAssignments");
  const matchingAsgQuery = query(
    assignmentsColl,
    where("siteId", "==", siteId)
  );
  const matchingAsgSnap = await getDocs(matchingAsgQuery).catch(() => ({ docs: [] }));

  const batch = writeBatch(db);
  let batchOpsCount = 0;

  // Delete direct assignment doc if found
  if (assignmentDocRef) {
    batch.delete(assignmentDocRef);
    batchOpsCount++;
  }

  // Also delete any other duplicate/legacy assignments matching this engineer and site
  matchingAsgSnap.docs.forEach(docSnap => {
    const d = docSnap.data();
    const engRef = d.engineerId || d.userId || d.uid;
    if (candidateEngIds.has(engRef)) {
      if (!assignmentDocRef || docSnap.id !== assignmentDocRef.id) {
        batch.delete(docSnap.ref);
        batchOpsCount++;
      }
    }
  });

  // 5. Safely clean up engineer documents (ONLY update if doc exists)
  for (const engKey of candidateEngIds) {
    const seRef = doc(db, "siteEngineers", engKey);
    const seSnap = await getDoc(seRef).catch(() => null);
    if (seSnap && seSnap.exists()) {
      batch.update(seRef, {
        assignedSites: arrayRemove(siteId),
        updatedAt: serverTimestamp()
      });
      batchOpsCount++;
    }

    const userRef = doc(db, "users", engKey);
    const userSnap = await getDoc(userRef).catch(() => null);
    if (userSnap && userSnap.exists()) {
      batch.update(userRef, {
        assignedSites: arrayRemove(siteId),
        updatedAt: serverTimestamp()
      });
      batchOpsCount++;
    }
  }

  // 6. Safely clean up site document
  if (siteId) {
    const siteDocRef = doc(db, "sites", siteId);
    const siteSnap = await getDoc(siteDocRef).catch(() => null);
    if (siteSnap && siteSnap.exists()) {
      const siteData = siteSnap.data();
      const currentAssigned = Array.isArray(siteData.assignedEngineers) ? siteData.assignedEngineers : [];
      const updatedEngineers = currentAssigned.filter(id => !candidateEngIds.has(id));
      batch.update(siteDocRef, {
        assignedEngineers: updatedEngineers,
        updatedAt: serverTimestamp()
      });
      batchOpsCount++;
    }
  }

  if (batchOpsCount > 0) {
    await batch.commit();
  }
}

// Reconcile and synchronize legacy document array fields with canonical siteAssignments
export async function reconcileSiteAssignments() {
  const db = getDb();
  const assignmentsColl = collection(db, "siteAssignments");
  
  const [snap, engSnap, usersSnap, sitesSnap] = await Promise.all([
    getDocs(assignmentsColl),
    getDocs(collection(db, "siteEngineers")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "sites"))
  ]);

  const activeEngineerSitesMap = {}; // engineerId -> Set(siteIds)
  const activeSiteEngineersMap = {}; // siteId -> Set(engineerIds)

  snap.forEach(docSnap => {
    const data = docSnap.data();
    if (data.status === "active" && data.siteId && data.engineerId) {
      if (!activeEngineerSitesMap[data.engineerId]) {
        activeEngineerSitesMap[data.engineerId] = new Set();
      }
      activeEngineerSitesMap[data.engineerId].add(data.siteId);

      if (!activeSiteEngineersMap[data.siteId]) {
        activeSiteEngineersMap[data.siteId] = new Set();
      }
      activeSiteEngineersMap[data.siteId].add(data.engineerId);
    }
  });

  const batch = writeBatch(db);
  let batchCount = 0;

  // Sync siteEngineers & users
  engSnap.forEach(d => {
    const canonicalSites = Array.from(activeEngineerSitesMap[d.id] || []);
    const currentSites = d.data().assignedSites || [];
    if (JSON.stringify(canonicalSites.sort()) !== JSON.stringify(currentSites.sort())) {
      batch.update(d.ref, { assignedSites: canonicalSites, updatedAt: serverTimestamp() });
      batchCount++;
    }
  });

  usersSnap.forEach(d => {
    if (d.data().role === "site_engineer" || d.data().assignedSites) {
      const canonicalSites = Array.from(activeEngineerSitesMap[d.id] || []);
      const currentSites = d.data().assignedSites || [];
      if (JSON.stringify(canonicalSites.sort()) !== JSON.stringify(currentSites.sort())) {
        batch.update(d.ref, { assignedSites: canonicalSites, updatedAt: serverTimestamp() });
        batchCount++;
      }
    }
  });

  // Sync sites
  sitesSnap.forEach(d => {
    const canonicalEngineers = Array.from(activeSiteEngineersMap[d.id] || []);
    const currentEngineers = d.data().assignedEngineers || [];
    if (JSON.stringify(canonicalEngineers.sort()) !== JSON.stringify(currentEngineers.sort())) {
      batch.update(d.ref, { assignedEngineers: canonicalEngineers, updatedAt: serverTimestamp() });
      batchCount++;
    }
  });

  if (batchCount > 0) {
    await batch.commit();
  }
}

// ==========================================================================
// MATERIAL TRACKING SERVICES
// ==========================================================================

// Add a new material log
export async function addMaterial(materialData) {
  const db = getDb();
  const matName = (materialData.materialName || "").trim();
  const purchaseDate = materialData.purchaseDate || new Date().toISOString().split("T")[0];
  
  // Attendance Verification Gate: Verify engineer attendance if write is created by engineer
  if (materialData.engineerId) {
    const isVerified = await verifyEngineerAttendanceGate(materialData.engineerId, materialData.siteId, purchaseDate);
    if (!isVerified) {
      throw new Error(`Attendance Verification Gate: Verified site attendance is required for site and date (${purchaseDate}) before recording material logs.`);
    }
  }

  // Use unique ID if not explicitly specified
  const newMaterialRef = materialData.id 
    ? doc(db, "materials", materialData.id) 
    : doc(collection(db, "materials"));
  const matId = newMaterialRef.id;
  
  await setDoc(newMaterialRef, {
    id: matId,
    siteId: materialData.siteId,
    engineerId: materialData.engineerId,
    teamId: materialData.teamId || null,
    teamName: materialData.teamName || materialData.category || "General",
    materialName: matName,
    category: materialData.category || materialData.teamName || "General",
    quantity: Number(materialData.quantity),
    requiredQuantity: Number(materialData.requiredQuantity || materialData.quantity),
    unit: materialData.unit,
    unitPrice: Number(materialData.unitPrice || materialData.rate) || 0,
    totalAmount: Number(materialData.totalAmount) || (Number(materialData.quantity) * (Number(materialData.unitPrice || materialData.rate) || 0)),
    supplierName: materialData.supplierName || materialData.teamName || "Material Supplier",
    purchaseDate: purchaseDate,
    notes: materialData.notes || "",
    invoiceUrl: materialData.invoiceUrl || "",
    status: materialData.status || "Approved",
    locked: true,
    submitted: true,
    submittedAt: serverTimestamp(),
    type: "material_log",
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

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
    const userDoc = await getUserProfile(materialData.engineerId);
    if (userDoc) {
      engineerName = userDoc.fullName || userDoc.name || "Site Engineer";
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
  
  const fetchUsersSnap = async () => {
    try {
      const snap = await getDocs(collection(db, "siteEngineers"));
      if (!snap.empty) return snap;
    } catch (e) {}
    return await getDocs(collection(db, "users"));
  };

  const [snap, usersSnap, sites] = await Promise.all([
    getDocs(q),
    fetchUsersSnap(),
    getSites()
  ]);
  
  const usersMap = {};
  usersSnap.forEach(d => {
    const data = d.data();
    usersMap[d.id] = { fullName: data.name || data.fullName || "", ...data };
  });
  
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
    engineerId: workerData.engineerId || null,
    adminId: workerData.adminId || null,
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

// Fetch workers (Shared canonical dataset for all authorized Admins)
export async function getWorkers(siteId = null, adminId = null) {
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
    const data = d.data();
    workers.push({ id: d.id, ...data });
  });
  
  // Sort by workerName alphabetically
  return workers.sort((a, b) => (a.workerName || "").localeCompare(b.workerName || ""));
}

// Save/Mark daily workers attendance batch (idempotent setDoc writes)
export async function saveLabourAttendance(siteId, engineerId, dateStr, attendanceList) {
  // Attendance Verification Gate: Verify engineer attendance if write is created by engineer
  if (engineerId) {
    const isVerified = await verifyEngineerAttendanceGate(engineerId, siteId, dateStr);
    if (!isVerified) {
      throw new Error(`Attendance Verification Gate: Verified site attendance is required for site and date (${dateStr}) before recording labour attendance.`);
    }
  }

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
export async function getLabourAttendanceSummary(siteId = null) {
  const db = getDb();
  const attendanceColl = collection(db, "labourAttendance");
  const q = siteId ? query(attendanceColl, where("siteId", "==", siteId)) : query(attendanceColl);
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

// Fetch individual site labour entries for a specific site and date
export async function getLabourDailyEntries(siteId, dateStr) {
  const db = getDb();
  const q = query(
    collection(db, "siteLabourEntries"),
    where("siteId", "==", siteId),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  const entries = [];
  snap.forEach(d => {
    entries.push({
      id: d.id,
      ...d.data()
    });
  });
  return entries;
}

// Save daily site labour entries for a specific site, date, and engineer (idempotent writes using clear-and-set)
export async function saveLabourDailyEntries(siteId, engineerId, dateStr, entries) {
  // Attendance Verification Gate: Verify engineer attendance if write is created by engineer
  if (engineerId) {
    const isVerified = await verifyEngineerAttendanceGate(engineerId, siteId, dateStr);
    if (!isVerified) {
      throw new Error(`Attendance Verification Gate: Verified site attendance is required for site and date (${dateStr}) before saving daily labour entries.`);
    }
  }

  const db = getDb();
  
  // 1. Delete existing entries for this site and date
  const q = query(
    collection(db, "siteLabourEntries"),
    where("siteId", "==", siteId),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  const batch = writeBatch(db);
  snap.forEach(d => {
    batch.delete(d.ref);
  });
  
  // 2. Add new entries
  entries.forEach(entry => {
    const newRef = doc(collection(db, "siteLabourEntries"));
    batch.set(newRef, {
      siteId,
      engineerId,
      date: dateStr,
      categoryId: entry.categoryId,
      displayName: entry.displayName,
      createdAt: serverTimestamp()
    });
  });
  
  await batch.commit();
}

// Save daily category counts for workers (retained/adapted for compatibility)
export async function saveLabourDailyCounts(siteId, engineerId, dateStr, countsMap) {
  const db = getDb();
  
  // Fetch active categories first to find category ID
  const catsSnap = await getDocs(collection(db, "labourCategories"));
  const categories = [];
  catsSnap.forEach(d => {
    categories.push({ id: d.id, name: d.data().name });
  });

  const entries = [];
  Object.keys(countsMap).forEach(categoryName => {
    const count = Number(countsMap[categoryName]) || 0;
    const cat = categories.find(c => c.name.toLowerCase() === categoryName.toLowerCase());
    if (cat && count > 0) {
      for (let i = 1; i <= count; i++) {
        entries.push({
          categoryId: cat.id,
          displayName: `${cat.name} ${i}`
        });
      }
    }
  });

  await saveLabourDailyEntries(siteId, engineerId, dateStr, entries);
}

// Fetch worker counts for a specific site and date
export async function getLabourDailyCounts(siteId, dateStr) {
  const db = getDb();
  
  // Fetch master categories to map IDs to names
  const catsSnap = await getDocs(collection(db, "labourCategories"));
  const catMap = {};
  const counts = {};
  catsSnap.forEach(d => {
    const name = d.data().name;
    catMap[d.id] = name;
    counts[name] = 0;
  });

  const q = query(
    collection(db, "siteLabourEntries"),
    where("siteId", "==", siteId),
    where("date", "==", dateStr)
  );
  const snap = await getDocs(q);
  snap.forEach(d => {
    const data = d.data();
    const catName = catMap[data.categoryId] || "Other";
    counts[catName] = (counts[catName] || 0) + 1;
  });
  
  return counts;
}

// Fetch historical daily counts list for Site Engineer Dashboard and Admin Auditing
export async function getLabourDailyCountsHistory(siteId) {
  const db = getDb();
  
  const qLegacy = siteId
    ? query(collection(db, "siteLabourEntries"), where("siteId", "==", siteId))
    : query(collection(db, "siteLabourEntries"));

  const qNew = siteId
    ? query(collection(db, "labourMemberAttendance"), where("siteId", "==", siteId))
    : query(collection(db, "labourMemberAttendance"));

  // 1. Fetch all datasets in parallel
  const [catsSnap, snapLegacy, snapNew, teamsSnap] = await Promise.all([
    getDocs(collection(db, "labourCategories")),
    getDocs(qLegacy),
    getDocs(qNew),
    getDocs(collection(db, "labourTeams"))
  ]);

  const catMap = {};
  catsSnap.forEach(d => {
    catMap[d.id] = d.data().name;
  });
  
  const historyMap = {};
  snapLegacy.forEach(d => {
    const data = d.data();
    const date = data.date;
    if (!historyMap[date]) {
      historyMap[date] = { date, siteId: data.siteId, Masons: 0, Helpers: 0, Painters: 0, Plumbers: 0, Electricians: 0, Others: 0, total: 0, engineerId: data.engineerId || "" };
    }
    
    const catName = catMap[data.categoryId] || "Other";
    const categoryKey = catName === "Mason" ? "Masons" :
                        catName === "Helper" ? "Helpers" :
                        catName === "Painter" ? "Painters" :
                        catName === "Plumber" ? "Plumbers" :
                        catName === "Electrician" ? "Electricians" : "Others";
    
    if (categoryKey === "Others") {
      historyMap[date].Others += 1;
    } else {
      historyMap[date][categoryKey] = (historyMap[date][categoryKey] || 0) + 1;
    }
    historyMap[date].total += 1;
  });
  
  const legacyList = Object.values(historyMap);

  // 2. Process member-level attendance records
  const teamCatWageMap = {};
  const teamCatNameMap = {};
  const teamNameMap = {};
  teamsSnap.forEach(d => {
    const teamData = d.data();
    teamNameMap[d.id] = teamData.teamName;
    if (teamData.categories) {
      Object.keys(teamData.categories).forEach(catId => {
        const cat = teamData.categories[catId];
        teamCatWageMap[`${d.id}_${catId}`] = Number(cat.baseWage) || 500;
        teamCatNameMap[`${d.id}_${catId}`] = cat.name;
      });
    }
  });

  const newList = [];
  snapNew.forEach(d => {
    const data = d.data();
    if (data.workerCount !== undefined) {
      const workerCount = Number(data.workerCount !== undefined ? data.workerCount : 1) || 1;
      const customWorkUnits = Number(
        data.customWorkUnits !== undefined 
          ? data.customWorkUnits 
          : (data.units !== undefined 
              ? data.units 
              : (data.attendanceType === "Half Day" ? 0.5 : 1.0))
      ) || 1.0;
      const catWage = teamCatWageMap[`${data.teamId}_${data.categoryId}`];
      const dailyWage = Number(
        data.dailyWage !== undefined 
          ? data.dailyWage 
          : (data.wage !== undefined 
              ? data.wage 
              : (catWage !== undefined ? catWage : 500))
      ) || 0;

      const rawWorkerEntries = Array.isArray(data.workerEntries) ? data.workerEntries : [];
      let calculatedAmount = 0;
      if (data.calculatedAmount !== undefined) {
        calculatedAmount = Number(data.calculatedAmount);
      } else if (data.totalAmount !== undefined) {
        calculatedAmount = Number(data.totalAmount);
      } else if (rawWorkerEntries.length > 0) {
        let customSum = 0;
        rawWorkerEntries.forEach(w => {
          customSum += Number(w.calculatedAmount) || (Number(w.units || w.customWorkUnits || 1) * Number(w.dailyWage || w.wage || dailyWage));
        });
        const remainingCount = Math.max(0, workerCount - rawWorkerEntries.length);
        calculatedAmount = customSum + (remainingCount * customWorkUnits * dailyWage);
      } else {
        calculatedAmount = workerCount * customWorkUnits * dailyWage;
      }
      const totalAmount = Number(data.totalAmount !== undefined ? data.totalAmount : calculatedAmount);

      const catName = data.categoryName || teamCatNameMap[`${data.teamId}_${data.categoryId}`] || "Workers";
      const tName = data.teamName || teamNameMap[data.teamId] || "Team";
      const displayType = rawWorkerEntries.length > 0 ? "Custom Durations" : (data.attendanceType || `${customWorkUnits} Units`);

      newList.push({
        id: d.id,
        ...data,
        date: data.attendanceDate || data.date,
        attendanceDate: data.attendanceDate || data.date,
        memberId: `${data.categoryId}_${displayType}`,
        memberName: `${workerCount} x ${catName} (${displayType})`,
        workerCount,
        customWorkUnits,
        units: customWorkUnits,
        workerEntries: rawWorkerEntries,
        wage: dailyWage,
        dailyWage,
        calculatedAmount,
        totalAmount,
        categoryName: catName,
        teamName: tName
      });
    } else {
      newList.push({ id: d.id, ...data });
    }
  });

  // 4. Combine both
  const combined = [...legacyList, ...newList];
  
  // Sort descending by date
  return combined.sort((a, b) => (b.date || "").localeCompare(a.date || ""));
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
  if (!engineerId) {
    return {
      weekdaysWorkedThisMonth: 0,
      leavesThisMonth: 0,
      leavesThisYear: 0,
      remainingHolidays: Number(holidayAllowance) || 24
    };
  }

  const db = getDb();
  
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-indexed
  const currentMonthStr = currentMonth < 10 ? `0${currentMonth}` : `${currentMonth}`;
  const yearMonthPrefix = `${currentYear}-${currentMonthStr}`; // "YYYY-MM"
  
  const cleanEngineerId = (typeof engineerId === "object" ? String(engineerId.id || engineerId.uid || "").trim() : String(engineerId).trim());
  const leavesColl = collection(db, "leaves");

  const [validRecords, leavesSnap1, leavesSnap2] = await Promise.all([
    getEngineerAttendanceHistory(cleanEngineerId),
    getDocs(query(leavesColl, where("engineerId", "==", cleanEngineerId))).catch(err => {
      console.warn("Leaves stats fetch error:", err);
      return null;
    }),
    getDocs(query(leavesColl, where("userId", "==", cleanEngineerId))).catch(err => {
      console.warn("Leaves stats fetch error (userId):", err);
      return null;
    })
  ]);

  let weekdaysWorkedThisMonth = 0;
  let leavesThisMonth = 0;
  let leavesThisYear = 0;

  const distinctDatesWorked = new Set();

  validRecords.forEach(data => {
    const recDate = data.date || data.attendanceDate;
    if (recDate && recDate.startsWith(yearMonthPrefix)) {
      if (!distinctDatesWorked.has(recDate)) {
        distinctDatesWorked.add(recDate);
        const parts = recDate.split('-');
        if (parts.length === 3) {
          const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
          const dayOfWeek = d.getDay(); // 0 = Sun, 1 = Mon, ..., 6 = Sat
          // Mon-Fri is 1-5
          if (dayOfWeek >= 1 && dayOfWeek <= 5) {
            weekdaysWorkedThisMonth++;
          }
        }
      }
    }
  });

  const seenLeaveIds = new Set();
  [...(leavesSnap1?.docs || []), ...(leavesSnap2?.docs || [])].forEach(docSnap => {
    if (seenLeaveIds.has(docSnap.id)) return;
    seenLeaveIds.add(docSnap.id);
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
    const userDoc = await getUserProfile(engineerId);
    if (userDoc) {
      engineerName = userDoc.fullName || userDoc.name || "Site Engineer";
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
  const engineerDocRef = doc(db, "siteEngineers", engineerId);
  batch.delete(engineerDocRef);

  // 3-8. Query related documents in parallel before batch commit
  const [
    assignmentsSnap,
    sitesSnap,
    attendanceSnap,
    leavesSnap,
    photosSnap,
    locationsSnap
  ] = await Promise.all([
    getDocs(query(collection(db, "siteAssignments"), where("engineerId", "==", engineerId))),
    getDocs(query(collection(db, "sites"), where("assignedEngineers", "array-contains", engineerId))),
    getDocs(query(collection(db, "attendance"), where("engineerId", "==", engineerId))),
    getDocs(query(collection(db, "leaves"), where("engineerId", "==", engineerId))),
    getDocs(query(collection(db, "sitePhotos"), where("engineerId", "==", engineerId))),
    getDocs(query(collection(db, "engineerLocations"), where("engineerId", "==", engineerId)))
  ]);

  assignmentsSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  sitesSnap.forEach(docSnap => {
    batch.update(docSnap.ref, {
      assignedEngineers: arrayRemove(engineerId)
    });
  });

  attendanceSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  leavesSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

  photosSnap.forEach(docSnap => {
    batch.delete(docSnap.ref);
  });

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

export async function deleteLabourDailyCounts(siteId, dateStr) {
  const db = getDb();
  const q = query(
    collection(db, "siteLabourEntries"),
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
  const batch = writeBatch(db);
  batch.delete(doc(db, "reports", reportId));
  try {
    batch.delete(doc(db, "dailyUpdates", reportId));
  } catch (e) {}
  await batch.commit();
}

// Delete site inspection photo (Permanent production record — Protected from Site Engineer deletion)
export async function deleteSitePhoto(photoId, requesterRole = null) {
  if (requesterRole === "site_engineer" || requesterRole === "engineer") {
    throw new Error("Security Error: Uploaded inspection photos are permanent production records and cannot be deleted by Site Engineers.");
  }
  const db = getDb();
  const docRef = doc(db, "sitePhotos", photoId);
  const batch = writeBatch(db);
  batch.delete(docRef);
  await batch.commit();
}

// Get all attendance records for an engineer across all sites (deduplicated per day & site)
export async function getEngineerAttendanceHistory(engineerId) {
  if (!engineerId) return [];
  const cleanEngineerId = (typeof engineerId === "object" ? String(engineerId.id || engineerId.uid || "").trim() : String(engineerId).trim());
  if (!cleanEngineerId) return [];

  const db = getDb();
  const attendanceColl = collection(db, "attendance");

  // Collect all known alias identifiers for this engineer
  const aliasSet = new Set([cleanEngineerId.toLowerCase()]);
  if (typeof engineerId === "object") {
    if (engineerId.uid) aliasSet.add(String(engineerId.uid).trim().toLowerCase());
    if (engineerId.id) aliasSet.add(String(engineerId.id).trim().toLowerCase());
    if (engineerId.userId) aliasSet.add(String(engineerId.userId).trim().toLowerCase());
    if (engineerId.email) aliasSet.add(String(engineerId.email).trim().toLowerCase());
  }

  // Lookup engineer profile from siteEngineers / users to resolve all aliases
  try {
    const [engSnap, userSnap] = await Promise.all([
      getDoc(doc(db, "siteEngineers", cleanEngineerId)).catch(() => null),
      getDoc(doc(db, "users", cleanEngineerId)).catch(() => null)
    ]);
    if (engSnap && engSnap.exists()) {
      const d = engSnap.data();
      if (d.uid) aliasSet.add(String(d.uid).trim().toLowerCase());
      if (d.email) aliasSet.add(String(d.email).trim().toLowerCase());
      if (d.userId) aliasSet.add(String(d.userId).trim().toLowerCase());
    }
    if (userSnap && userSnap.exists()) {
      const d = userSnap.data();
      if (d.uid) aliasSet.add(String(d.uid).trim().toLowerCase());
      if (d.email) aliasSet.add(String(d.email).trim().toLowerCase());
      if (d.userId) aliasSet.add(String(d.userId).trim().toLowerCase());
    }
  } catch (e) {}

  const aliasList = Array.from(aliasSet).filter(Boolean);

  // Method 1: Parallel targeted queries across all known aliases
  const queryPromises = [];
  for (const alias of aliasList) {
    queryPromises.push(
      getDocs(query(attendanceColl, where("engineerId", "==", alias))).catch(() => ({ docs: [] })),
      getDocs(query(attendanceColl, where("userId", "==", alias))).catch(() => ({ docs: [] })),
      getDocs(query(attendanceColl, where("uid", "==", alias))).catch(() => ({ docs: [] }))
    );
  }

  // Method 2: Comprehensive canonical collection query (single source of truth fallback)
  // Ensures records across all assigned sites with any legacy or casing formats are resolved
  const [targetedResults, allCollSnap] = await Promise.all([
    Promise.all(queryPromises),
    getDocs(attendanceColl).catch(() => ({ docs: [] }))
  ]);

  const rawRecords = [];
  const seenIds = new Set();

  const addDocSnap = (docSnap) => {
    if (!seenIds.has(docSnap.id)) {
      seenIds.add(docSnap.id);
      rawRecords.push({ id: docSnap.id, ...docSnap.data() });
    }
  };

  targetedResults.forEach(res => {
    (res.docs || []).forEach(addDocSnap);
  });

  (allCollSnap.docs || []).forEach(docSnap => {
    if (seenIds.has(docSnap.id)) return;
    const data = docSnap.data();
    if (!isEngineerAttendanceRecord(data, docSnap.id)) return;

    const docEngId = String(data.engineerId || data.userId || data.uid || data.user_id || data.engineer_id || "").trim().toLowerCase();
    const docEmail = String(data.engineerEmail || data.email || "").trim().toLowerCase();
    const docIdStr = String(docSnap.id).toLowerCase();

    const matchesAlias = aliasList.some(alias => 
      alias && (docEngId === alias || docEmail === alias || docIdStr.includes(`_${alias}_`) || docIdStr.includes(`_${alias}`))
    );

    if (matchesAlias) {
      addDocSnap(docSnap);
    }
  });

  return deduplicateDailyAttendance(rawRecords);
}

// Get all attendance records for a given site (deduplicated per engineer and date)
export async function getAttendanceForSite(siteId = null) {
  const db = getDb();
  const attendanceColl = collection(db, "attendance");
  const cleanSiteId = siteId ? String(siteId).trim() : null;
  const q = cleanSiteId ? query(attendanceColl, where("siteId", "==", cleanSiteId)) : query(attendanceColl);
  const snap = await getDocs(q);
  const records = [];
  snap.forEach(docSnap => {
    records.push({ id: docSnap.id, ...docSnap.data() });
  });
  
  const deduplicated = deduplicateDailyAttendance(records);
  if (cleanSiteId) {
    return deduplicated.filter(r => String(r.siteId).trim() === cleanSiteId);
  }
  return deduplicated;
}

// Get daily progress updates for a site
export async function getDailyUpdatesForSite(siteId = null) {
  const db = getDb();
  let snap;
  try {
    const q = siteId ? query(collection(db, "reports"), where("siteId", "==", siteId)) : query(collection(db, "reports"));
    snap = await getDocs(q);
    if (snap.empty) {
      const qFallback = siteId ? query(collection(db, "dailyUpdates"), where("siteId", "==", siteId)) : query(collection(db, "dailyUpdates"));
      const snapFallback = await getDocs(qFallback);
      if (!snapFallback.empty) {
        snap = snapFallback;
      }
    }
  } catch (e) {
    const qFallback = siteId ? query(collection(db, "dailyUpdates"), where("siteId", "==", siteId)) : query(collection(db, "dailyUpdates"));
    snap = await getDocs(qFallback);
  }
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
export async function getPhotosForSite(siteId = null) {
  const db = getDb();
  const photosColl = collection(db, "sitePhotos");
  const q = siteId ? query(photosColl, where("siteId", "==", siteId)) : query(photosColl);
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


// Update existing material records
export async function updateMaterial(materialId, materialData) {
  const db = getDb();
  const docRef = doc(db, "materials", materialId);
  const cleanData = { ...materialData, updatedAt: serverTimestamp() };
  Object.keys(cleanData).forEach(key => cleanData[key] === undefined && delete cleanData[key]);
  await updateDoc(docRef, cleanData);
}

// Fetch all leaves across all engineers
export async function getAllLeaves() {
  const db = getDb();
  const leavesColl = collection(db, "leaves");
  const snap = await getDocs(leavesColl);
  
  let usersSnap;
  try {
    usersSnap = await getDocs(collection(db, "siteEngineers"));
    if (usersSnap.empty) {
      usersSnap = await getDocs(collection(db, "users"));
    }
  } catch (e) {
    usersSnap = await getDocs(collection(db, "users"));
  }
  const usersMap = {};
  usersSnap.forEach(d => {
    const data = d.data();
    usersMap[d.id] = { fullName: data.name || data.fullName || "", ...data };
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

// Get shared labour master categories and wage update history across all authorized Admins
export async function getLabourMaster(adminId = null) {
  const db = getDb();
  const collRef = collection(db, "labourCategories");
  
  const fetchCategories = async () => {
    try {
      return await getDocs(query(collRef, orderBy("createdTime", "asc")));
    } catch (e) {
      return await getDocs(collRef);
    }
  };

  const [snap, historySnapGlobal, historySnapLegacy] = await Promise.all([
    fetchCategories(),
    getDoc(doc(db, "users", "labour_master_global")).catch(() => null),
    adminId ? getDoc(doc(db, "users", `__labour_master__${adminId}`)).catch(() => null) : null
  ]);

  const categories = {};
  snap.forEach(d => {
    const data = d.data();
    categories[d.id] = {
      name: data.name,
      wage: Number(data.salaryAmount) || 0,
      type: data.salaryType,
      status: data.status,
      createdBy: data.createdBy,
      createdTime: data.createdTime
    };
  });

  let history = (historySnapGlobal && historySnapGlobal.exists()) ? (historySnapGlobal.data().history || []) : [];
  if (history.length === 0 && historySnapLegacy && historySnapLegacy.exists()) {
    history = historySnapLegacy.data().history || [];
  }

  return {
    categories,
    history
  };
}

// Create a new labour category document in the master collection.
export async function createLabourCategory(categoryData) {
  const db = getDb();
  const nameClean = categoryData.name.trim();
  
  // Check for duplicates case-insensitively
  const collRef = collection(db, "labourCategories");
  const snap = await getDocs(collRef);
  const duplicate = snap.docs.some(docSnap => docSnap.data().name.trim().toLowerCase() === nameClean.toLowerCase());
  if (duplicate) {
    throw new Error("Category name already exists.");
  }

  const docRef = await addDoc(collRef, {
    name: nameClean,
    salaryType: categoryData.salaryType,
    salaryAmount: Number(categoryData.salaryAmount) || 0,
    createdBy: categoryData.createdBy || "Admin",
    createdTime: serverTimestamp(),
    status: "Active"
  });

  // Verify Firestore document is actually written before proceeding
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("Failed to verify newly created Labour Category document in Firestore.");
  }

  // Log history under shared global document
  const logRef = doc(db, "users", "labour_master_global");
  const logSnap = await getDoc(logRef);
  const history = logSnap.exists() ? (logSnap.data().history || []) : [];
  const newLog = {
    categoryName: nameClean,
    oldSalary: 0,
    newSalary: Number(categoryData.salaryAmount) || 0,
    changedDate: new Date().toISOString().split("T")[0],
    changedBy: categoryData.createdBy || "Admin"
  };
  await setDoc(logRef, { history: [newLog, ...history], updatedAt: serverTimestamp() }, { merge: true });

  return docRef.id;
}

// Update a labour category document in the master collection.
export async function updateLabourCategory(categoryId, categoryData) {
  const db = getDb();
  const docRef = doc(db, "labourCategories", categoryId);
  const docSnap = await getDoc(docRef);
  if (!docSnap.exists()) {
    throw new Error("Category does not exist.");
  }
  const oldData = docSnap.data();

  const updates = {};
  if (categoryData.salaryAmount !== undefined) {
    updates.salaryAmount = Number(categoryData.salaryAmount) || 0;
  }
  if (categoryData.status !== undefined) {
    updates.status = categoryData.status;
  }
  updates.updatedTime = serverTimestamp();

  await updateDoc(docRef, updates);

  // Log history if wage changed under shared global document
  if (categoryData.salaryAmount !== undefined && Number(categoryData.salaryAmount) !== Number(oldData.salaryAmount)) {
    const logRef = doc(db, "users", "labour_master_global");
    const logSnap = await getDoc(logRef);
    const history = logSnap.exists() ? (logSnap.data().history || []) : [];
    const newLog = {
      categoryName: oldData.name,
      oldSalary: Number(oldData.salaryAmount) || 0,
      newSalary: Number(categoryData.salaryAmount) || 0,
      changedDate: new Date().toISOString().split("T")[0],
      changedBy: categoryData.updatedBy || "Admin"
    };
    await setDoc(logRef, { history: [newLog, ...history], updatedAt: serverTimestamp() }, { merge: true });
  }
}

// Delete a labour category document from the master collection.
export async function deleteLabourCategory(categoryId) {
  const db = getDb();
  await deleteDoc(doc(db, "labourCategories", categoryId));
}

// Save shared labour master categories history
export async function saveLabourMaster(categories, history, adminId = null) {
  const db = getDb();
  const docRef = doc(db, "users", "labour_master_global");
  await setDoc(docRef, {
    history,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

// Real-time synchronization subscription for labour categories
export function subscribeLabourCategories(onUpdate) {
  const db = getDb();
  const collRef = collection(db, "labourCategories");
  
  let q;
  try {
    q = query(collRef, orderBy("createdTime", "asc"));
  } catch (e) {
    q = collRef;
  }
  
  return onSnapshot(q, (snapshot) => {
    const categories = {};
    snapshot.forEach(docSnap => {
      const data = docSnap.data();
      categories[docSnap.id] = {
        name: data.name,
        wage: Number(data.salaryAmount) || 0,
        type: data.salaryType,
        status: data.status,
        createdBy: data.createdBy,
        createdTime: data.createdTime
      };
    });
    onUpdate(categories);
  }, (error) => {
    console.error("subscribeLabourCategories failed:", error);
  });
}

// Get shared labour payments across all authorized Admins
export async function getLabourPayments(adminIdOrSiteId = null, siteId = null) {
  const db = getDb();
  let paymentsList = [];
  
  let targetSiteId = siteId;
  if (adminIdOrSiteId && !siteId && typeof adminIdOrSiteId === "string" && !adminIdOrSiteId.startsWith("admin_")) {
    targetSiteId = adminIdOrSiteId;
  }

  // 1. Primary shared document
  try {
    const docRef = doc(db, "users", "labour_payments_global");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      paymentsList = docSnap.data().payments || [];
    }
  } catch (e) {}

  // 2. Merge any legacy per-admin docs if global is empty or missing records
  if (adminIdOrSiteId && typeof adminIdOrSiteId === "string") {
    try {
      const scopedRef = doc(db, "users", `__labour_payments__${adminIdOrSiteId}`);
      const scopedSnap = await getDoc(scopedRef);
      if (scopedSnap.exists()) {
        const legacyPayments = scopedSnap.data().payments || [];
        const seenIds = new Set(paymentsList.map(p => p.id));
        legacyPayments.forEach(lp => {
          if (!seenIds.has(lp.id)) {
            paymentsList.push(lp);
          }
        });
      }
    } catch (e) {}
  }

  if (targetSiteId && targetSiteId !== "all") {
    return paymentsList.filter(p => p.siteId === targetSiteId);
  }
  return paymentsList;
}

// Save shared labour payment across all authorized Admins
export async function saveLabourPayment(paymentData, adminId = null) {
  const db = getDb();
  const docRef = doc(db, "users", "labour_payments_global");
  const docSnap = await getDoc(docRef);
  
  const newPayment = {
    id: `${paymentData.siteId}_${Date.now()}`,
    siteId: paymentData.siteId,
    amount: Number(paymentData.amount) || 0,
    date: paymentData.date || new Date().toISOString().split("T")[0],
    reference: paymentData.reference || "",
    notes: paymentData.notes || "",
    loggedBy: paymentData.loggedBy || adminId || "admin",
    createdAt: new Date().toISOString()
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

// ─────────────────────────────────────────────────────────────────────────────
// MATERIAL MASTER & TEAMS – Single Source of Truth
//
// Storage path:  labourCategories/material-master-config  (fields: materialTeams, materialsList)
//
// Storing here ensures every active role (Admin and Site Engineers) can subscribe
// and receive real-time updates without Firestore security rule changes.
// ─────────────────────────────────────────────────────────────────────────────
const MATERIAL_MASTER_DOC = ["labourCategories", "material-master-config"];

export async function getMaterialTeams() {
  const db = getDb();
  const primaryRef = doc(db, MATERIAL_MASTER_DOC[0], MATERIAL_MASTER_DOC[1]);
  const primarySnap = await getDoc(primaryRef);
  if (primarySnap.exists()) {
    const data = primarySnap.data();
    if (data.materialTeams && Array.isArray(data.materialTeams)) {
      return data.materialTeams;
    }
    // Fallback: If legacy materialsList exists, migrate to teams representation
    if (data.materialsList && Array.isArray(data.materialsList) && data.materialsList.length > 0) {
      const grouped = {};
      data.materialsList.forEach(m => {
        const teamName = m.category || "General";
        if (!grouped[teamName]) {
          grouped[teamName] = {
            id: `mat_team_${teamName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
            name: teamName,
            createdAt: new Date().toISOString(),
            materials: []
          };
        }
        grouped[teamName].materials.push({
          id: m.id || `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
          name: m.name || "",
          unit: m.unit || "Unit",
          rate: Number(m.unitPrice || m.rate) || 0,
          unitPrice: Number(m.unitPrice || m.rate) || 0,
          status: m.status || "Active"
        });
      });
      return Object.values(grouped);
    }
  }
  return [];
}

export async function saveMaterialTeams(teamsList) {
  const db = getDb();
  const primaryRef = doc(db, MATERIAL_MASTER_DOC[0], MATERIAL_MASTER_DOC[1]);
  
  // Flatten to legacy materialsList as well for backward-compatibility with any legacy views
  const flatList = [];
  (teamsList || []).forEach(team => {
    (team.materials || []).forEach(mat => {
      const isCustom = mat.type === "custom";
      const isRateOnly = mat.type === "rate_only";
      const amt = Number(mat.amount !== undefined ? mat.amount : (mat.rate !== undefined ? mat.rate : mat.unitPrice)) || 0;
      const cleanName = (mat.name || mat.title || "").trim();
      flatList.push({
        id: mat.id,
        name: cleanName,
        title: mat.title || cleanName,
        type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
        category: team.name,
        teamId: team.id,
        teamName: team.name,
        unit: (isCustom || isRateOnly) ? "" : (mat.unit || "Bag"),
        unitPrice: amt,
        rate: amt,
        amount: amt,
        status: mat.status || "Active"
      });
    });
  });

  await setDoc(primaryRef, {
    materialTeams: teamsList,
    materialsList: flatList,
    updatedAt: serverTimestamp()
  }, { merge: true });

  try {
    const legacyRef = doc(db, "users", "material_master");
    await setDoc(legacyRef, { materialTeams: teamsList, materialsList: flatList, updatedAt: serverTimestamp() }, { merge: true });
  } catch (e) {}
}

// Real-time synchronization subscription for Material Teams (Single Source of Truth)
export function subscribeMaterialTeams(onUpdate) {
  const db = getDb();
  const primaryRef = doc(db, MATERIAL_MASTER_DOC[0], MATERIAL_MASTER_DOC[1]);

  return onSnapshot(primaryRef, async (docSnap) => {
    if (docSnap.exists()) {
      const data = docSnap.data();
      if (data.materialTeams && Array.isArray(data.materialTeams)) {
        onUpdate(data.materialTeams);
        return;
      }
      if (data.materialsList && Array.isArray(data.materialsList) && data.materialsList.length > 0) {
        const grouped = {};
        data.materialsList.forEach(m => {
          const teamName = m.category || "General";
          if (!grouped[teamName]) {
            grouped[teamName] = {
              id: `mat_team_${teamName.toLowerCase().replace(/[^a-z0-9]/g, "_")}`,
              name: teamName,
              createdAt: new Date().toISOString(),
              materials: []
            };
          }
          const isCustom = m.type === "custom";
          const isRateOnly = m.type === "rate_only";
          const amt = Number(m.amount !== undefined ? m.amount : (m.unitPrice !== undefined ? m.unitPrice : m.rate)) || 0;
          const cleanName = (m.name || m.title || "").trim();
          grouped[teamName].materials.push({
            id: m.id || `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
            name: cleanName,
            title: m.title || cleanName,
            type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
            unit: (isCustom || isRateOnly) ? "" : (m.unit || "Bag"),
            rate: amt,
            amount: amt,
            unitPrice: amt,
            status: m.status || "Active"
          });
        });
        onUpdate(Object.values(grouped));
        return;
      }
    }
    try {
      const teams = await getMaterialTeams();
      onUpdate(teams || []);
    } catch (e) {
      onUpdate([]);
    }
  }, (error) => {
    console.error("subscribeMaterialTeams failed:", error);
    onUpdate([]);
  });
}

export async function createMaterialTeam(teamName, initialMaterials = []) {
  const cleanName = (teamName || "").trim();
  if (!cleanName) throw new Error("Material Team name cannot be empty.");

  const currentTeams = await getMaterialTeams();
  const exists = currentTeams.some(t => (t.name || "").toLowerCase() === cleanName.toLowerCase());
  if (exists) throw new Error(`Material Team "${cleanName}" already exists.`);

  const formattedMaterials = (initialMaterials || [])
    .filter(m => {
      if (!m) return false;
      if (m.type === "rate_only") {
        const amt = Number(m.amount !== undefined ? m.amount : (m.rate !== undefined ? m.rate : m.unitPrice));
        return !isNaN(amt) && amt > 0;
      }
      return Boolean((m.name || "").trim());
    })
    .map(m => {
      const isCustom = m.type === "custom";
      const isRateOnly = m.type === "rate_only";
      const amt = Number(m.amount !== undefined ? m.amount : (m.rate !== undefined ? m.rate : m.unitPrice)) || 0;
      const cleanMatName = (m.name || m.title || "").trim();
      return {
        id: m.id || `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
        name: cleanMatName,
        title: m.title || cleanMatName,
        type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
        unit: (isCustom || isRateOnly) ? "" : ((m.unit || "Bag").trim()),
        rate: amt,
        amount: amt,
        unitPrice: amt,
        status: m.status || "Active"
      };
    });

  const newTeam = {
    id: `mat_team_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: cleanName,
    createdAt: new Date().toISOString(),
    materials: formattedMaterials
  };

  const updatedTeams = [...currentTeams, newTeam];
  await saveMaterialTeams(updatedTeams);
  return updatedTeams;
}

export async function updateMaterialTeam(teamId, { name }) {
  const cleanName = (name || "").trim();
  if (!cleanName) throw new Error("Team name cannot be empty.");

  const currentTeams = await getMaterialTeams();
  const updatedTeams = currentTeams.map(t => {
    if (t.id === teamId) {
      return { ...t, name: cleanName };
    }
    return t;
  });

  await saveMaterialTeams(updatedTeams);
  return updatedTeams;
}

export async function deleteMaterialTeam(teamId) {
  const currentTeams = await getMaterialTeams();
  const updatedTeams = currentTeams.filter(t => t.id !== teamId);
  await saveMaterialTeams(updatedTeams);
  return updatedTeams;
}

export async function addMaterialToTeam(teamId, materialData) {
  const isCustom = materialData.type === "custom";
  const isRateOnly = materialData.type === "rate_only";
  const nameClean = (materialData.name || materialData.title || "").trim();
  const unitClean = (isCustom || isRateOnly) ? "" : (materialData.unit || "Bag").trim();
  const amountVal = Number(materialData.amount !== undefined ? materialData.amount : (materialData.rate !== undefined ? materialData.rate : materialData.unitPrice)) || 0;

  if (isRateOnly) {
    if (isNaN(amountVal) || amountVal <= 0) {
      throw new Error("Rate / Amount must be a valid positive number.");
    }
  } else {
    if (!nameClean) throw new Error("Material Name cannot be empty.");
    if (!isCustom && !unitClean) throw new Error("Unit of measure cannot be empty.");
    if (isNaN(amountVal) || amountVal < 0) {
      throw new Error("Rate / Amount must be a valid number.");
    }
  }

  const currentTeams = await getMaterialTeams();
  const teamIndex = currentTeams.findIndex(t => t.id === teamId);
  if (teamIndex === -1) throw new Error("Material Team not found.");

  const team = currentTeams[teamIndex];
  if (nameClean) {
    const matExists = (team.materials || []).some(m => (m.name || m.title || "").toLowerCase() === nameClean.toLowerCase());
    if (matExists) throw new Error(`Material "${nameClean}" already exists under team "${team.name}".`);
  }

  const newMat = {
    id: `mat_${Date.now()}_${Math.random().toString(36).substr(2, 4)}`,
    name: nameClean,
    title: materialData.title || nameClean,
    type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
    unit: unitClean,
    rate: amountVal,
    amount: amountVal,
    unitPrice: amountVal,
    status: materialData.status || "Active"
  };

  const updatedTeam = {
    ...team,
    materials: [...(team.materials || []), newMat]
  };

  const updatedTeams = [...currentTeams];
  updatedTeams[teamIndex] = updatedTeam;
  await saveMaterialTeams(updatedTeams);
  return updatedTeams;
}

export async function updateMaterialInTeam(teamId, materialId, updatedData) {
  const currentTeams = await getMaterialTeams();
  const teamIndex = currentTeams.findIndex(t => t.id === teamId);
  if (teamIndex === -1) throw new Error("Material Team not found.");

  const team = currentTeams[teamIndex];
  const updatedMaterials = (team.materials || []).map(m => {
    if (m.id === materialId) {
      const isCustom = updatedData.type !== undefined ? (updatedData.type === "custom") : (m.type === "custom");
      const isRateOnly = updatedData.type !== undefined ? (updatedData.type === "rate_only") : (m.type === "rate_only");
      const amtVal = updatedData.amount !== undefined 
        ? Number(updatedData.amount)
        : (updatedData.rate !== undefined 
            ? Number(updatedData.rate) 
            : (updatedData.unitPrice !== undefined 
                ? Number(updatedData.unitPrice) 
                : (m.amount !== undefined ? m.amount : (m.rate !== undefined ? m.rate : m.unitPrice))));
      
      const newUnit = (isCustom || isRateOnly) ? "" : (updatedData.unit !== undefined ? updatedData.unit.trim() : (m.unit || "Bag"));
      const newName = updatedData.name !== undefined 
        ? updatedData.name.trim() 
        : (updatedData.title !== undefined ? updatedData.title.trim() : m.name);

      return {
        ...m,
        name: newName,
        title: updatedData.title !== undefined ? updatedData.title.trim() : (m.title || newName),
        type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
        unit: newUnit,
        rate: amtVal,
        amount: amtVal,
        unitPrice: amtVal,
        status: updatedData.status || m.status || "Active"
      };
    }
    return m;
  });

  const updatedTeam = { ...team, materials: updatedMaterials };
  const updatedTeams = [...currentTeams];
  updatedTeams[teamIndex] = updatedTeam;
  await saveMaterialTeams(updatedTeams);
  return updatedTeams;
}

export async function deleteMaterialFromTeam(teamId, materialId) {
  const currentTeams = await getMaterialTeams();
  const teamIndex = currentTeams.findIndex(t => t.id === teamId);
  if (teamIndex === -1) throw new Error("Material Team not found.");

  const team = currentTeams[teamIndex];
  const updatedMaterials = (team.materials || []).filter(m => m.id !== materialId);
  const updatedTeam = { ...team, materials: updatedMaterials };
  const updatedTeams = [...currentTeams];
  updatedTeams[teamIndex] = updatedTeam;
  await saveMaterialTeams(updatedTeams);
  return updatedTeams;
}

// Backward-compatible wrappers for legacy callers
export async function getMaterialMaster() {
  const teams = await getMaterialTeams();
  const flat = [];
  teams.forEach(t => {
    (t.materials || []).forEach(m => {
      flat.push({ ...m, category: t.name, teamId: t.id, teamName: t.name });
    });
  });
  return flat;
}

export async function saveMaterialMaster(materialsList) {
  const db = getDb();
  const primaryRef = doc(db, MATERIAL_MASTER_DOC[0], MATERIAL_MASTER_DOC[1]);
  await setDoc(primaryRef, {
    materialsList,
    updatedAt: serverTimestamp()
  }, { merge: true });
}

export function subscribeMaterialMaster(onUpdate) {
  return subscribeMaterialTeams((teams) => {
    const flat = [];
    (teams || []).forEach(t => {
      (t.materials || []).forEach(m => {
        flat.push({ ...m, category: t.name, teamId: t.id, teamName: t.name });
      });
    });
    onUpdate(flat);
  });
}

export async function createMaterialGroup(groupName) {
  return createMaterialTeam(groupName);
}

export async function renameMaterialGroup(oldGroupName, newGroupName) {
  const teams = await getMaterialTeams();
  const team = teams.find(t => (t.name || "").toLowerCase() === (oldGroupName || "").toLowerCase());
  if (team) {
    return updateMaterialTeam(team.id, { name: newGroupName });
  }
  return teams;
}

export async function deleteMaterialGroup(groupName) {
  const teams = await getMaterialTeams();
  const team = teams.find(t => (t.name || "").toLowerCase() === (groupName || "").toLowerCase());
  if (team) {
    return deleteMaterialTeam(team.id);
  }
  return teams;
}

export async function createMaterialItem(materialData) {
  const teams = await getMaterialTeams();
  const cat = materialData.category || "General";
  let team = teams.find(t => (t.name || "").toLowerCase() === cat.toLowerCase());
  if (!team) {
    await createMaterialTeam(cat);
    const updated = await getMaterialTeams();
    team = updated.find(t => (t.name || "").toLowerCase() === cat.toLowerCase());
  }
  if (team) {
    return addMaterialToTeam(team.id, materialData);
  }
  return teams;
}

export async function updateMaterialItem(itemId, updatedData) {
  const teams = await getMaterialTeams();
  for (const t of teams) {
    const m = (t.materials || []).find(mat => mat.id === itemId);
    if (m) {
      return updateMaterialInTeam(t.id, itemId, updatedData);
    }
  }
  return teams;
}

export async function deleteMaterialItem(itemId) {
  const teams = await getMaterialTeams();
  for (const t of teams) {
    const m = (t.materials || []).find(mat => mat.id === itemId);
    if (m) {
      return deleteMaterialFromTeam(t.id, itemId);
    }
  }
  return teams;
}


// Real-time synchronization subscription for site-specific detailed materials
export function subscribeMaterialsDetailed(siteId, onUpdate) {
  const db = getDb();
  const materialsColl = collection(db, "materials");
  
  let q;
  if (siteId) {
    q = query(materialsColl, where("siteId", "==", siteId));
  } else {
    q = query(materialsColl);
  }

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(d => {
      const data = d.data();
      if (d.id.startsWith("lock_") || d.id === "__material_master__" || data.type === "material_lock" || data.type === "labour_attendance_lock") {
        return;
      }
      list.push({
        id: d.id,
        ...data,
        receivedQuantity: Number(data.receivedQuantity) || Number(data.quantity) || (data.materialType === "customer_amount_only" || data.type === "customer_amount_only" ? 1 : 0),
        consumedQuantity: Number(data.consumedQuantity) || 0,
        unitCost: Number(data.unitCost) || Number(data.unitPrice) || Number(data.rate) || 0,
        totalCost: Number(data.totalCost) || Number(data.totalAmount) || Number(data.amount) || 0,
        totalAmount: Number(data.totalAmount) || Number(data.amount) || Number(data.totalCost) || 0,
        amount: Number(data.amount) || Number(data.totalAmount) || Number(data.totalCost) || 0
      });
    });
    
    list.sort((a, b) => {
      const dateA = a.createdTime?.seconds ? new Date(a.createdTime.seconds * 1000) : new Date(a.purchaseDate || 0);
      const dateB = b.createdTime?.seconds ? new Date(b.createdTime.seconds * 1000) : new Date(b.purchaseDate || 0);
      return dateB - dateA;
    });

    onUpdate(list);
  }, (error) => {
    console.error("subscribeMaterialsDetailed failed:", error);
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

export async function getGeneralExpenses(siteId = null) {
  const db = getDb();
  let expensesList = [];
  try {
    const docRef = doc(db, "expenses", "general");
    const docSnap = await getDoc(docRef);
    if (docSnap.exists() && docSnap.data().expenses) {
      expensesList = docSnap.data().expenses || [];
    }
  } catch (e) {}

  if (expensesList.length === 0) {
    try {
      const docRef = doc(db, "users", "__site_expenses__");
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        expensesList = docSnap.data().expenses || [];
      }
    } catch (e) {}
  }

  if (siteId) {
    return expensesList.filter(g => g.siteId === siteId);
  }
  return expensesList;
}

export async function saveGeneralExpense(expenseData) {
  const db = getDb();
  const newExpense = {
    id: `exp_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
    siteId: expenseData.siteId,
    category: expenseData.category || "Site Expense",
    customer: expenseData.customer || "",
    amount: Number(expenseData.amount) || 0,
    date: expenseData.date || new Date().toISOString().split("T")[0],
    description: expenseData.description || "",
    notes: expenseData.notes || "",
    createdBy: expenseData.createdBy || "Engineer",
    status: expenseData.status || "Pending",
    paidAmount: 0,
    paymentHistory: []
  };

  // Write to new expenses/general collection
  try {
    const docRef = doc(db, "expenses", "general");
    const docSnap = await getDoc(docRef);
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
  } catch (e) {}

  // Write to legacy users/__site_expenses__ document
  try {
    const docRef = doc(db, "users", "__site_expenses__");
    const docSnap = await getDoc(docRef);
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
  } catch (e) {}

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
  const runUpdate = async (docPath) => {
    const docRef = doc(db, docPath[0], docPath[1]);
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
  };

  try {
    await runUpdate(["expenses", "general"]);
  } catch (e) {}
  try {
    await runUpdate(["users", "__site_expenses__"]);
  } catch (e) {}
}

export async function logGeneralExpensePayment(expenseId, paymentData) {
  const db = getDb();
  const runUpdate = async (docPath) => {
    const docRef = doc(db, docPath[0], docPath[1]);
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
  };

  try {
    await runUpdate(["expenses", "general"]);
  } catch (e) {}
  try {
    await runUpdate(["users", "__site_expenses__"]);
  } catch (e) {}
}

export async function rejectGeneralExpense(expenseId) {
  const db = getDb();
  const runUpdate = async (docPath) => {
    const docRef = doc(db, docPath[0], docPath[1]);
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
  };

  try {
    await runUpdate(["expenses", "general"]);
  } catch (e) {}
  try {
    await runUpdate(["users", "__site_expenses__"]);
  } catch (e) {}
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
  if (moduleType === "Material" || moduleType === "Auth") return null;

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
    const data = d.data();
    if (data.moduleType !== "Material" && data.moduleType !== "Auth") {
      list.push({ id: d.id, ...data });
    }
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
  let targetColl = "users";
  let mapFields = false;
  
  if (role === "super_admin" || role === "superadmin") {
    targetColl = "superAdmins";
  } else if (role === "admin") {
    targetColl = "admins";
  } else if (role === "site_engineer" || role === "engineer") {
    targetColl = "siteEngineers";
    mapFields = true;
  }
  
  let snap;
  try {
    snap = await getDocs(collection(db, targetColl));
  } catch (e) {
    const q = query(collection(db, "users"), where("role", "==", role));
    snap = await getDocs(q);
    mapFields = false;
  }
  
  // Fallback to legacy if the collection was empty (e.g. before migration)
  if (snap.empty && targetColl !== "users") {
    const q = query(collection(db, "users"), where("role", "==", role));
    snap = await getDocs(q);
    mapFields = false;
  }
  
  const list = [];
  snap.forEach(d => {
    const data = d.data();
    if (mapFields) {
      list.push({ 
        id: d.id, 
        uid: d.id,
        fullName: data.name || data.fullName || "", 
        phoneNumber: data.phone || data.phoneNumber || "", 
        ...data 
      });
    } else {
      list.push({ id: d.id, uid: d.id, ...data });
    }
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
  
  const [leavesSnap, usersSnap, sitesSnap, existingApprovalsSnap, expensesDocRes] = await Promise.all([
    getDocs(collection(db, "leaves")),
    getDocs(collection(db, "users")),
    getDocs(collection(db, "sites")),
    getDocs(collection(db, "approvals")),
    getDoc(doc(db, "expenses", "general")).catch(async () => {
      return await getDoc(doc(db, "users", "__site_expenses__")).catch(() => null);
    })
  ]);

  const existingApprovalIds = new Set(existingApprovalsSnap.docs.map(d => d.id));

  const usersMap = {};
  usersSnap.forEach(d => { usersMap[d.id] = d.data().fullName; });

  const sitesMap = {};
  sitesSnap.forEach(d => { sitesMap[d.id] = d.data().siteName; });

  const batch = writeBatch(db);
  let writeCount = 0;

  for (const d of leavesSnap.docs) {
    if (!existingApprovalIds.has(d.id)) {
      const data = d.data();
      const appRef = doc(db, "approvals", d.id);
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
      existingApprovalIds.add(d.id);
      writeCount++;
    }
  }

  const materialsSnap = await getDocs(collection(db, "materials"));
  for (const d of materialsSnap.docs) {
    if (!existingApprovalIds.has(d.id)) {
      const data = d.data();
      const appRef = doc(db, "approvals", d.id);
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
      existingApprovalIds.add(d.id);
      writeCount++;
    }
  }

  for (const d of sitesSnap.docs) {
    const data = d.data();
    if (data.locationStatus === "Pending Approval") {
      const locId = `loc_${d.id}`;
      if (!existingApprovalIds.has(locId)) {
        const appRef = doc(db, "approvals", locId);
        batch.set(appRef, {
          id: locId,
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
        existingApprovalIds.add(locId);
        writeCount++;
      }
    }
  }

  let expensesDoc = expensesDocRes;
  if (!expensesDoc || !expensesDoc.exists()) {
    try {
      expensesDoc = await getDoc(doc(db, "users", "__site_expenses__"));
    } catch (e) {
      console.warn("Error getting legacy site expenses:", e);
    }
  }
  if (expensesDoc && expensesDoc.exists()) {
    const expenses = expensesDoc.data().expenses || [];
    for (const exp of expenses) {
      if ((exp.status === "Pending" || exp.status === "pending") && !existingApprovalIds.has(exp.id)) {
        const appRef = doc(db, "approvals", exp.id);
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
        existingApprovalIds.add(exp.id);
        writeCount++;
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
  const docRef = doc(db, "users", "document_categories");
  const docSnap = await getDoc(docRef);
  if (docSnap.exists() && docSnap.data().categoriesList) {
    return docSnap.data().categoriesList;
  }
  return ["Contract", "Invoice", "Bill", "Photo", "Report", "Certificate"];
}

export async function saveDocumentCategories(categoriesList) {
  const db = getDb();
  const docRef = doc(db, "users", "document_categories");
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

// ==========================================================================
// CENTRAL LABOUR TEAM MASTER CRUD & MEMBER ATTENDANCE
// ==========================================================================

export async function createLabourTeam(teamName, adminId) {
  const db = getDb();
  const nameClean = teamName.trim();
  if (!nameClean) {
    throw new Error("Team Name cannot be empty.");
  }

  // Check for duplicate Team names inside the same company
  const q = query(
    collection(db, "labourTeams"),
    where("adminId", "==", adminId)
  );
  const snap = await getDocs(q);
  const duplicate = snap.docs.some(docSnap => docSnap.data().teamName.trim().toLowerCase() === nameClean.toLowerCase());
  if (duplicate) {
    throw new Error("Team name already exists in this company.");
  }

  const newTeamRef = doc(collection(db, "labourTeams"));
  await setDoc(newTeamRef, {
    teamName: nameClean,
    adminId: adminId,
    categories: {},
    createdAt: serverTimestamp()
  });
  return newTeamRef.id;
}

// Fetch all labour teams (Shared canonical dataset for all Admins and Engineers)
export async function getLabourTeams(adminId = null) {
  const db = getDb();
  const collRef = collection(db, "labourTeams");
  const snap = await getDocs(collRef);
  const teams = [];
  snap.forEach(d => {
    teams.push({ id: d.id, ...d.data() });
  });
  return teams.sort((a, b) => (a.teamName || "").localeCompare(b.teamName || ""));
}

// Real-time synchronization of all labour teams across all Admins and Engineers
export function subscribeLabourTeams(onUpdate, adminId = null) {
  const db = getDb();
  const collRef = collection(db, "labourTeams");
  
  return onSnapshot(collRef, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    list.sort((a, b) => (a.teamName || "").localeCompare(b.teamName || ""));
    onUpdate(list);
  }, (err) => {
    console.error("Labour teams subscription failed:", err);
  });
}

export async function updateLabourTeam(teamId, teamName, adminId = null) {
  const db = getDb();
  const nameClean = teamName.trim();
  if (!nameClean) {
    throw new Error("Team Name cannot be empty.");
  }

  // Check for duplicate team names
  const snap = await getDocs(collection(db, "labourTeams"));
  const duplicate = snap.docs.some(docSnap => docSnap.id !== teamId && docSnap.data().teamName.trim().toLowerCase() === nameClean.toLowerCase());
  if (duplicate) {
    throw new Error("Another team already has this name.");
  }

  const docRef = doc(db, "labourTeams", teamId);
  await updateDoc(docRef, { teamName: nameClean, ...(adminId ? { lastUpdatedByAdmin: adminId } : {}) });
}

export async function deleteLabourTeam(teamId) {
  const db = getDb();
  await deleteDoc(doc(db, "labourTeams", teamId));
}

export async function addLabourCategoryToTeam(teamId, categoryData) {
  const db = getDb();
  const teamRef = doc(db, "labourTeams", teamId);
  
  const nameClean = categoryData.name.trim();
  if (!nameClean) {
    throw new Error("Category Name cannot be empty.");
  }
  const baseWage = Number(categoryData.baseWage);
  if (isNaN(baseWage) || baseWage <= 0) {
    throw new Error("Base Wage must be a positive number.");
  }
  if (!["Daily", "Weekly", "Monthly"].includes(categoryData.paymentType)) {
    throw new Error("Payment Type must be Daily, Weekly, or Monthly.");
  }

  await runTransaction(db, async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists()) {
      throw new Error("Labour Team does not exist.");
    }
    const data = teamDoc.data();
    const categories = data.categories || {};
    
    // Check if category name already exists in this team
    const duplicate = Object.values(categories).some(cat => cat.name.toLowerCase() === nameClean.toLowerCase());
    if (duplicate) {
      throw new Error("Category name already exists in this team.");
    }

    const categoryId = `cat_${Date.now()}`;
    categories[categoryId] = {
      id: categoryId,
      name: nameClean,
      paymentType: categoryData.paymentType,
      baseWage: baseWage,
      members: {}
    };

    transaction.update(teamRef, { categories });
  });
}

export async function updateLabourCategoryInTeam(teamId, categoryId, categoryData) {
  const db = getDb();
  const teamRef = doc(db, "labourTeams", teamId);
  const baseWage = Number(categoryData.baseWage);
  if (isNaN(baseWage) || baseWage <= 0) {
    throw new Error("Base Wage must be a positive number.");
  }
  if (!["Daily", "Weekly", "Monthly"].includes(categoryData.paymentType)) {
    throw new Error("Payment Type must be Daily, Weekly, or Monthly.");
  }

  await runTransaction(db, async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists()) {
      throw new Error("Labour Team does not exist.");
    }
    const data = teamDoc.data();
    const categories = data.categories || {};
    const category = categories[categoryId];
    if (!category) {
      throw new Error("Category does not exist.");
    }
    if (categoryData.name && categoryData.name.trim()) {
      category.name = categoryData.name.trim();
    }
    category.paymentType = categoryData.paymentType;
    category.baseWage = baseWage;
    
    transaction.update(teamRef, { categories });
  });
}

export async function deleteLabourCategoryFromTeam(teamId, categoryId) {
  const db = getDb();
  const teamRef = doc(db, "labourTeams", teamId);

  await runTransaction(db, async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists()) {
      throw new Error("Labour Team does not exist.");
    }
    const data = teamDoc.data();
    const categories = data.categories || {};
    
    delete categories[categoryId];
    
    transaction.update(teamRef, { categories });
  });
}

export async function addLabourMemberToCategory(teamId, categoryId, memberData, adminId) {
  const db = getDb();
  
  const memberIdClean = memberData.memberId.toString().trim();
  if (!memberIdClean) {
    throw new Error("Labour Member ID cannot be empty.");
  }
  const nameClean = memberData.name.trim();
  if (!nameClean) {
    throw new Error("Labour Member Name cannot be empty.");
  }
  const salary = Number(memberData.salary);
  if (isNaN(salary) || salary <= 0) {
    throw new Error("Salary must be a positive number.");
  }

  // 1. Query all teams for this admin to verify memberId uniqueness
  const q = query(collection(db, "labourTeams"), where("adminId", "==", adminId));
  const snap = await getDocs(q);
  
  let duplicate = false;
  snap.forEach(teamDoc => {
    const data = teamDoc.data();
    if (data.categories) {
      Object.values(data.categories).forEach(cat => {
        if (cat.members) {
          const membersList = Object.values(cat.members);
          if (membersList.some(m => m.memberId.toString().trim().toLowerCase() === memberIdClean.toLowerCase())) {
            duplicate = true;
          }
        }
      });
    }
  });

  if (duplicate) {
    throw new Error(`Labour Member ID "${memberIdClean}" already exists in the company.`);
  }

  // 2. Add the member
  const teamRef = doc(db, "labourTeams", teamId);
  await runTransaction(db, async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists()) {
      throw new Error("Labour Team does not exist.");
    }
    const data = teamDoc.data();
    const categories = data.categories || {};
    const category = categories[categoryId];
    if (!category) {
      throw new Error("Category does not exist inside this Team.");
    }
    if (!category.members) {
      category.members = {};
    }
    
    category.members[memberIdClean] = {
      memberId: memberIdClean,
      name: nameClean,
      salary: salary
    };
    
    transaction.update(teamRef, { categories });
  });
}

export async function updateLabourMemberInCategory(teamId, categoryId, memberId, memberData) {
  const db = getDb();
  const teamRef = doc(db, "labourTeams", teamId);
  
  const nameClean = memberData.name.trim();
  if (!nameClean) {
    throw new Error("Labour Member Name cannot be empty.");
  }
  const salary = Number(memberData.salary);
  if (isNaN(salary) || salary <= 0) {
    throw new Error("Salary must be a positive number.");
  }

  await runTransaction(db, async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists()) {
      throw new Error("Labour Team does not exist.");
    }
    const data = teamDoc.data();
    const categories = data.categories || {};
    const category = categories[categoryId];
    if (!category || !category.members || !category.members[memberId]) {
      throw new Error("Member does not exist.");
    }

    category.members[memberId].name = nameClean;
    category.members[memberId].salary = salary;
    
    transaction.update(teamRef, { categories });
  });
}

export async function deleteLabourMemberFromCategory(teamId, categoryId, memberId) {
  const db = getDb();
  const teamRef = doc(db, "labourTeams", teamId);

  await runTransaction(db, async (transaction) => {
    const teamDoc = await transaction.get(teamRef);
    if (!teamDoc.exists()) {
      throw new Error("Labour Team does not exist.");
    }
    const data = teamDoc.data();
    const categories = data.categories || {};
    const category = categories[categoryId];
    if (category && category.members) {
      delete category.members[memberId];
    }
    
    transaction.update(teamRef, { categories });
  });
}

export async function saveLabourMemberAttendance(siteId, engineerId, dateStr, attendanceList) {
  // Attendance Verification Gate: Verify engineer attendance if write is created by engineer
  if (engineerId) {
    const isVerified = await verifyEngineerAttendanceGate(engineerId, siteId, dateStr);
    if (!isVerified) {
      throw new Error(`Attendance Verification Gate: Verified site attendance is required for site and date (${dateStr}) before saving labour member attendance.`);
    }
  }

  const db = getDb();
  const batch = writeBatch(db);
  
  // First delete any existing new-format attendance logs for this site and date to keep it idempotent
  const qExisting = query(
    collection(db, "labourMemberAttendance"),
    where("siteId", "==", siteId),
    where("date", "==", dateStr)
  );
  const snapExisting = await getDocs(qExisting);
  snapExisting.forEach(d => {
    batch.delete(d.ref);
  });
  
  for (const item of attendanceList) {
    const docId = `${siteId}_${item.memberId}_${dateStr}`;
    const docRef = doc(db, "labourMemberAttendance", docId);
    
    batch.set(docRef, {
      siteId,
      teamId: item.teamId,
      teamName: item.teamName,
      categoryId: item.categoryId,
      categoryName: item.categoryName,
      memberId: item.memberId,
      memberName: item.memberName,
      date: dateStr,
      units: Number(item.units), // 1.0, 0.5, 0.25
      wage: Number(item.wage), // wage at the time of recording
      markedBy: engineerId,
      createdAt: serverTimestamp()
    });
  }
  
  await batch.commit();
}

export async function getLabourMemberAttendance(siteId, dateStr) {
  const db = getDb();
  const q = query(
    collection(db, "labourMemberAttendance"),
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

export async function getLabourMemberAttendanceSummary(siteId = null) {
  const db = getDb();
  const q = siteId
    ? query(collection(db, "labourMemberAttendance"), where("siteId", "==", siteId))
    : query(collection(db, "labourMemberAttendance"));
  const snap = await getDocs(q);
  const records = [];
  snap.forEach(d => {
    records.push({ id: d.id, ...d.data() });
  });
  return records;
}

// Save/Update a single labour attendance record (Auto-save row-by-row)
export async function saveLabourAttendanceRecord(recordId, recordData) {
  const db = getDb();
  const safeType = (recordData.attendanceType || "Custom").replace(/\s+/g, "_");
  const docId = recordId || `${recordData.siteId}_${recordData.teamId}_${recordData.categoryId}_${safeType}_${recordData.attendanceDate}`;
  const docRef = doc(db, "labourMemberAttendance", docId);
  
  // Guard against modifying already submitted/locked records
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const existing = docSnap.data();
    if (existing.locked || existing.status === "submitted" || existing.submitted) {
      throw new Error("Cannot modify: This team's attendance is submitted and locked.");
    }
  }

  // Attendance Verification Gate: Verify engineer attendance if write is created by engineer
  const engId = recordData.createdBy || recordData.engineerId;
  const attDate = recordData.attendanceDate || recordData.date;
  if (engId && recordData.siteId && attDate) {
    const isVerified = await verifyEngineerAttendanceGate(engId, recordData.siteId, attDate);
    if (!isVerified) {
      throw new Error(`Attendance Verification Gate: Verified site attendance is required for site and date (${attDate}) before saving labour attendance records.`);
    }
  }

  // Sequential Date Rule: Prevent modifying records for dates blocked by previous pending dates
  if (recordData.siteId && attDate) {
    const siteLocks = await getLabourLocksForSite(recordData.siteId);
    const seq = evaluateLabourDateSequence(recordData.siteId, attDate, siteLocks);
    if (!seq.allowed && seq.status !== "editable") {
      throw new Error(seq.message || "Please submit the previous pending date first.");
    }
  }

  const workerCount = Number(recordData.workerCount) || 0;
  const customWorkUnits = Number(recordData.customWorkUnits !== undefined ? recordData.customWorkUnits : (recordData.units !== undefined ? recordData.units : (recordData.attendanceType === "Half Day" ? 0.5 : 1.0))) || 1.0;
  const dailyWage = Number(recordData.dailyWage !== undefined ? recordData.dailyWage : (recordData.wage || 0)) || 0;

  const rawWorkerEntries = Array.isArray(recordData.workerEntries) ? recordData.workerEntries : [];
  const normalizedWorkerEntries = rawWorkerEntries.map((w, idx) => {
    const wUnits = Math.max(0.01, Number(w.customWorkUnits !== undefined ? w.customWorkUnits : (w.units !== undefined ? w.units : customWorkUnits)));
    const wWage = Number(w.dailyWage !== undefined ? w.dailyWage : (w.wage !== undefined ? w.wage : dailyWage));
    const wAmount = Number(w.calculatedAmount !== undefined ? w.calculatedAmount : (wUnits * wWage));
    return {
      workerId: w.workerId || `worker_${idx + 1}`,
      workerName: w.workerName || `Worker ${idx + 1}`,
      customWorkUnits: wUnits,
      units: wUnits,
      dailyWage: wWage,
      wage: wWage,
      calculatedAmount: wAmount
    };
  });

  let calculatedAmount = 0;
  if (normalizedWorkerEntries.length > 0) {
    let customSum = 0;
    normalizedWorkerEntries.forEach(w => {
      customSum += Number(w.calculatedAmount) || (w.units * w.wage);
    });
    const remainingCount = Math.max(0, workerCount - normalizedWorkerEntries.length);
    const remainingSum = remainingCount * customWorkUnits * dailyWage;
    calculatedAmount = customSum + remainingSum;
  } else {
    calculatedAmount = Number(recordData.calculatedAmount) || (workerCount * customWorkUnits * dailyWage);
  }

  const payload = {
    id: docId,
    siteId: recordData.siteId,
    teamId: recordData.teamId,
    teamName: recordData.teamName || "",
    categoryId: recordData.categoryId,
    categoryName: recordData.categoryName || "",
    attendanceDate: recordData.attendanceDate,
    date: recordData.attendanceDate,
    workerCount,
    customWorkUnits,
    units: customWorkUnits,
    dailyWage,
    wage: dailyWage,
    workerEntries: normalizedWorkerEntries,
    calculatedAmount,
    totalAmount: calculatedAmount,
    attendanceType: normalizedWorkerEntries.length > 0 ? `${customWorkUnits} Units (Custom Workers)` : `${customWorkUnits} Units`,
    createdBy: recordData.createdBy,
    updatedAt: serverTimestamp()
  };

  if (!recordId) {
    payload.createdAt = serverTimestamp();
  }

  await setDoc(docRef, payload, { merge: true });
  return docRef.id;
}

// Delete a single labour attendance record
export async function deleteLabourAttendanceRecord(recordId) {
  const db = getDb();
  const docRef = doc(db, "labourMemberAttendance", recordId);
  const docSnap = await getDoc(docRef);
  if (docSnap.exists()) {
    const existing = docSnap.data();
    if (existing.locked || existing.status === "submitted" || existing.submitted) {
      throw new Error("Cannot delete: This team's attendance is submitted and locked.");
    }
    const attDate = existing.attendanceDate || existing.date;
    if (existing.siteId && attDate) {
      const siteLocks = await getLabourLocksForSite(existing.siteId);
      const seq = evaluateLabourDateSequence(existing.siteId, attDate, siteLocks);
      if (!seq.allowed && seq.status !== "editable") {
        throw new Error(seq.message || "Please submit the previous pending date first.");
      }
    }
  }
  await deleteDoc(docRef);
}

// Get labour attendance records for a specific site, date, and team
export async function getLabourAttendanceRecords(siteId, dateStr, teamId) {
  const db = getDb();
  const q = query(
    collection(db, "labourMemberAttendance"),
    where("siteId", "==", siteId),
    where("attendanceDate", "==", dateStr),
    where("teamId", "==", teamId)
  );
  const snap = await getDocs(q);
  const records = [];
  snap.forEach(d => {
    records.push({ id: d.id, ...d.data() });
  });
  return records;
}

// Real-time subscription to all labour attendance records for a site
export function subscribeLabourAttendanceRecords(siteId, onUpdate) {
  const db = getDb();
  const q = siteId
    ? query(collection(db, "labourMemberAttendance"), where("siteId", "==", siteId))
    : query(collection(db, "labourMemberAttendance"));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by attendanceDate descending, then workerName ascending
    list.sort((a, b) => {
      const dateCompare = (b.attendanceDate || "").localeCompare(a.attendanceDate || "");
      if (dateCompare !== 0) return dateCompare;
      return (a.workerName || a.categoryId || "").localeCompare(b.workerName || b.categoryId || "");
    });
    onUpdate(list);
  }, (err) => {
    console.error("Labour member attendance subscription failed:", err);
  });
}

// Real-time subscription to all labour attendance records across all sites
export function subscribeAllLabourAttendance(onUpdate) {
  const db = getDb();
  const q = query(collection(db, "labourMemberAttendance"));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    // Sort by attendanceDate descending
    list.sort((a, b) => (b.attendanceDate || "").localeCompare(a.attendanceDate || ""));
    onUpdate(list);
  }, (err) => {
    console.error("All labour attendance subscription failed:", err);
  });
}

// Real-time subscription to all engineer attendance logs (deduplicated per engineer and date)
export function subscribeAllEngineerAttendance(onUpdate) {
  const db = getDb();
  const q = query(collection(db, "attendance"));
  return onSnapshot(q, (snapshot) => {
    const rawList = [];
    snapshot.forEach(docSnap => {
      rawList.push({ id: docSnap.id, ...docSnap.data() });
    });
    const cleanList = deduplicateDailyAttendance(rawList);
    onUpdate(cleanList);
  }, (err) => {
    console.error("All engineer attendance subscription failed:", err);
  });
}

// Real-time subscription to all engineer leaves logs
export function subscribeAllEngineerLeaves(onUpdate) {
  const db = getDb();
  const q = query(collection(db, "leaves"));
  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(docSnap => {
      list.push({ id: docSnap.id, ...docSnap.data() });
    });
    onUpdate(list);
  }, (err) => {
    console.error("All engineer leaves subscription failed:", err);
  });
}

// Real-time subscription to payroll payment status records
export function subscribePayrollStatuses(onUpdate) {
  const db = getDb();
  const docRef = doc(db, "users", "payroll_status_global");
  return onSnapshot(docRef, (snapshot) => {
    if (snapshot.exists()) {
      onUpdate(snapshot.data().statuses || {});
    } else {
      onUpdate({});
    }
  }, (err) => {
    console.error("Payroll statuses subscription failed:", err);
  });
}

// Update payment status for a specific payroll item
export async function savePayrollStatus(key, statusData) {
  const db = getDb();
  const docRef = doc(db, "users", "payroll_status_global");
  const snap = await getDoc(docRef);
  
  let currentStatuses = {};
  if (snap.exists()) {
    currentStatuses = snap.data().statuses || {};
  }
  
  currentStatuses[key] = {
    ...currentStatuses[key],
    ...statusData,
    updatedAt: new Date().toISOString()
  };
  
  await setDoc(docRef, { statuses: currentStatuses }, { merge: true });
}

// Real-time subscription to all general expenses (merging primary expenses/general and users/__site_expenses__)
export function subscribeGeneralExpenses(onUpdate) {
  const db = getDb();
  let expensesGeneral = [];
  let expensesLegacy = [];

  const emit = () => {
    const combined = [...expensesGeneral, ...expensesLegacy];
    const seen = new Set();
    const unique = [];
    combined.forEach(e => {
      if (!e) return;
      const key = e.id || `exp_${e.siteId}_${e.date}_${e.amount}_${e.description}`;
      if (!seen.has(key)) {
        seen.add(key);
        unique.push({ id: key, ...e });
      }
    });
    onUpdate(unique);
  };

  const unsub1 = onSnapshot(doc(db, "expenses", "general"), (snap) => {
    expensesGeneral = snap.exists() ? (snap.data().expenses || []) : [];
    emit();
  }, (err) => {
    console.warn("expenses/general listener warning:", err);
  });

  const unsub2 = onSnapshot(doc(db, "users", "__site_expenses__"), (snap) => {
    expensesLegacy = snap.exists() ? (snap.data().expenses || []) : [];
    emit();
  }, (err) => {
    console.warn("users/__site_expenses__ listener warning:", err);
  });

  return () => {
    unsub1();
    unsub2();
  };
}

// Check daily labour attendance submission status per Site + Date (Site-Level Lock)
export async function checkLabourSubmissionStatus(siteId, dateStr, teamId = null) {
  if (!siteId || !dateStr) return { submitted: false };
  const cleanSiteId = String(siteId).trim();
  const cleanDateStr = String(dateStr).trim();
  const cleanTeamId = teamId ? String(teamId).trim() : null;

  try {
    const db = getDb();
    
    // 1. Primary Site-Level Lock Check (Canonical single source of truth for Site + Date)
    const siteDocRef = doc(db, "attendance", `labour_lock_${cleanSiteId}_${cleanDateStr}`);
    const siteDocSnap = await getDoc(siteDocRef);
    if (siteDocSnap.exists()) {
      const data = siteDocSnap.data();
      if (data.status === "submitted" || data.locked || data.submitted) {
        return {
          submitted: true,
          locked: true,
          submittedAt: data.submittedAt || data.updatedAt || data.createdAt || null,
          submittedBy: data.submittedBy || data.engineerId || data.userId || null,
          siteId: cleanSiteId
        };
      }
    }

    // 2. Team-level lock check if specified
    if (cleanTeamId) {
      const teamDocRef = doc(db, "attendance", `labour_lock_${cleanSiteId}_${cleanTeamId}_${cleanDateStr}`);
      const teamDocSnap = await getDoc(teamDocRef);
      if (teamDocSnap.exists()) {
        const data = teamDocSnap.data();
        if (data.status === "submitted" || data.locked || data.submitted) {
          return {
            submitted: true,
            locked: true,
            submittedAt: data.submittedAt || data.updatedAt || data.createdAt || null,
            submittedBy: data.submittedBy || data.engineerId || data.userId || null,
            teamId: cleanTeamId,
            siteId: cleanSiteId
          };
        }
      }
    }

    // 3. Check labourMemberAttendance collection for any submitted/locked record on this Site + Date
    const qAttendanceDate = query(
      collection(db, "labourMemberAttendance"),
      where("siteId", "==", cleanSiteId),
      where("attendanceDate", "==", cleanDateStr)
    );
    const qSnap = await getDocs(qAttendanceDate);
    if (!qSnap.empty) {
      const submittedDoc = qSnap.docs.find(d => {
        const dt = d.data();
        return dt.status === "submitted" || dt.locked === true || dt.submitted === true;
      });
      if (submittedDoc) {
        const dt = submittedDoc.data();
        return {
          submitted: true,
          locked: true,
          submittedAt: dt.submittedAt || dt.updatedAt || dt.createdAt || null,
          submittedBy: dt.submittedBy || dt.createdBy || null,
          siteId: cleanSiteId
        };
      }
    }

    // 4. Fallback query checking "date" field in labourMemberAttendance
    const qDate = query(
      collection(db, "labourMemberAttendance"),
      where("siteId", "==", cleanSiteId),
      where("date", "==", cleanDateStr)
    );
    const qSnapDate = await getDocs(qDate);
    if (!qSnapDate.empty) {
      const submittedDoc = qSnapDate.docs.find(d => {
        const dt = d.data();
        return dt.status === "submitted" || dt.locked === true || dt.submitted === true;
      });
      if (submittedDoc) {
        const dt = submittedDoc.data();
        return {
          submitted: true,
          locked: true,
          submittedAt: dt.submittedAt || dt.updatedAt || dt.createdAt || null,
          submittedBy: dt.submittedBy || dt.createdBy || null,
          siteId: cleanSiteId
        };
      }
    }

    // 5. Fallback query checking siteLabourEntries
    const qLegacy = query(
      collection(db, "siteLabourEntries"),
      where("siteId", "==", cleanSiteId),
      where("date", "==", cleanDateStr)
    );
    const qSnapLegacy = await getDocs(qLegacy);
    if (!qSnapLegacy.empty) {
      const submittedDoc = qSnapLegacy.docs.find(d => {
        const dt = d.data();
        return dt.status === "submitted" || dt.locked === true || dt.submitted === true;
      });
      if (submittedDoc) {
        const dt = submittedDoc.data();
        return {
          submitted: true,
          locked: true,
          submittedAt: dt.submittedAt || dt.updatedAt || dt.createdAt || null,
          submittedBy: dt.submittedBy || dt.createdBy || null,
          siteId: cleanSiteId
        };
      }
    }
  } catch (err) {
    console.error("Error checking labour submission status:", err);
  }
  return { submitted: false };
}

// Get all labour locks for a specific site (without running through engineer personal attendance deduplication)
export async function getLabourLocksForSite(siteId) {
  if (!siteId) return [];
  const cleanSiteId = String(siteId).trim();
  const db = getDb();
  try {
    const q = query(
      collection(db, "attendance"),
      where("siteId", "==", cleanSiteId),
      where("type", "==", "labour_attendance_lock")
    );
    const snap = await getDocs(q);
    const locks = [];
    snap.forEach(docSnap => {
      locks.push({ id: docSnap.id, ...docSnap.data() });
    });
    return locks;
  } catch (err) {
    console.error("Error fetching labour locks for site:", err);
    return [];
  }
}

// Check date sequence status and lock status for Labour Attendance on a Site + Date
export async function checkLabourDateSequenceStatus(siteId, dateStr) {
  if (!siteId || !dateStr) {
    return { allowed: false, status: "invalid", message: "Site ID and Date are required." };
  }
  const cleanSiteId = String(siteId).trim();
  const cleanDateStr = String(dateStr).trim();
  const db = getDb();

  try {
    // 1. Fetch site locks from canonical attendance collection
    const locks = await getLabourLocksForSite(cleanSiteId);

    // 2. Fetch existing draft/unsubmitted records for site
    const qDrafts = query(
      collection(db, "labourMemberAttendance"),
      where("siteId", "==", cleanSiteId)
    );
    const draftSnap = await getDocs(qDrafts);
    const draftRecords = [];
    draftSnap.forEach(d => {
      draftRecords.push({ id: d.id, ...d.data() });
    });

    // 3. Evaluate sequence status using canonical business logic
    return evaluateLabourDateSequence(cleanSiteId, cleanDateStr, locks, draftRecords);
  } catch (err) {
    console.error("Error checking labour date sequence status:", err);
    return {
      allowed: true, // Fallback gracefully if query fails
      status: "editable",
      error: err.message
    };
  }
}

// Submit workforce attendance for site and date (Site-Level Labour Submission & Concurrency Lock)
export async function submitLabourAttendance(siteId, dateStr, engineerId, teamId = null, attendanceItems = []) {
  if (!siteId || !dateStr) throw new Error("Site ID and Date are required to submit attendance.");
  const cleanSiteId = String(siteId).trim();
  const cleanDateStr = String(dateStr).trim();
  const cleanTeamId = teamId ? String(teamId).trim() : null;

  // 1. Attendance Verification Gate: Verify current engineer's individual attendance
  if (engineerId) {
    const isVerified = await verifyEngineerAttendanceGate(engineerId, cleanSiteId, cleanDateStr);
    if (!isVerified) {
      throw new Error(`Attendance Verification Gate: Verified site attendance is required for site and date (${cleanDateStr}) before submitting labour attendance.`);
    }
  }

  const db = getDb();
  const siteLockDocRef = doc(db, "attendance", `labour_lock_${cleanSiteId}_${cleanDateStr}`);
  const teamLockDocRef = cleanTeamId ? doc(db, "attendance", `labour_lock_${cleanSiteId}_${cleanTeamId}_${cleanDateStr}`) : null;

  // 2. Sequential Date Validation against canonical site locks before submission
  const locks = await getLabourLocksForSite(cleanSiteId);
  const qDrafts = query(
    collection(db, "labourMemberAttendance"),
    where("siteId", "==", cleanSiteId)
  );
  const draftSnap = await getDocs(qDrafts);
  const draftRecords = [];
  draftSnap.forEach(d => draftRecords.push({ id: d.id, ...d.data() }));

  const seqResult = evaluateLabourDateSequence(cleanSiteId, cleanDateStr, locks, draftRecords);
  if (!seqResult.allowed) {
    throw new Error(seqResult.message || "Please submit the previous pending date first.");
  }

  // 3. Concurrency Guard: Atomic Firestore transaction ensures only ONE submission succeeds if multiple engineers submit simultaneously
  await runTransaction(db, async (transaction) => {
    const siteLockSnap = await transaction.get(siteLockDocRef);
    if (siteLockSnap.exists()) {
      const data = siteLockSnap.data();
      if (data.status === "submitted" || data.locked === true || data.submitted === true) {
        throw new Error("Labour attendance for this site on this date has already been submitted and is locked.");
      }
    }

    if (teamLockDocRef) {
      const teamLockSnap = await transaction.get(teamLockDocRef);
      if (teamLockSnap.exists()) {
        const data = teamLockSnap.data();
        if (data.status === "submitted" || data.locked === true || data.submitted === true) {
          throw new Error("Labour attendance for this team on this date has already been submitted and is locked.");
        }
      }
    }

    const nowIso = new Date().toISOString();
    const lockPayload = {
      type: "labour_attendance_lock",
      userId: engineerId || "",
      engineerId: engineerId || "",
      siteId: cleanSiteId,
      date: cleanDateStr,
      attendanceDate: cleanDateStr,
      teamId: cleanTeamId || "",
      status: "submitted",
      locked: true,
      submitted: true,
      submittedAt: nowIso,
      submittedBy: engineerId || "",
      createdAt: nowIso,
      updatedAt: nowIso
    };

    transaction.set(siteLockDocRef, lockPayload, { merge: true });
    if (teamLockDocRef) {
      transaction.set(teamLockDocRef, lockPayload, { merge: true });
    }
  });

  // 3. Mark all labourMemberAttendance records for this site and date as submitted & locked
  const batch = writeBatch(db);
  const updatedDocIds = new Set();

  try {
    const qSiteAttDate = query(
      collection(db, "labourMemberAttendance"),
      where("siteId", "==", cleanSiteId),
      where("attendanceDate", "==", cleanDateStr)
    );
    const snap1 = await getDocs(qSiteAttDate);
    snap1.forEach(d => {
      updatedDocIds.add(d.id);
      batch.update(d.ref, {
        status: "submitted",
        locked: true,
        submitted: true,
        submittedAt: new Date().toISOString(),
        submittedBy: engineerId || "",
        updatedAt: new Date().toISOString()
      });
    });

    const qSiteDate = query(
      collection(db, "labourMemberAttendance"),
      where("siteId", "==", cleanSiteId),
      where("date", "==", cleanDateStr)
    );
    const snap2 = await getDocs(qSiteDate);
    snap2.forEach(d => {
      if (!updatedDocIds.has(d.id)) {
        updatedDocIds.add(d.id);
        batch.update(d.ref, {
          status: "submitted",
          locked: true,
          submitted: true,
          submittedAt: new Date().toISOString(),
          submittedBy: engineerId || "",
          updatedAt: new Date().toISOString()
        });
      }
    });

    if (updatedDocIds.size > 0) {
      await batch.commit();
    }
  } catch (err) {
    console.warn("Labour records batch update notice:", err);
  }
}

// Check bulk material submission status for site and date (per-record locking replaces day-wide locking)
export async function checkMaterialSubmissionStatus(siteId, dateStr) {
  return { submitted: false };
}

// Save bulk material entry for site and date in single transaction/batch
export async function saveBulkMaterialEntry(bulkData) {
  const { siteId, dateStr, engineerId, items } = bulkData;
  if (!siteId) throw new Error("Construction site is required.");
  if (!dateStr) throw new Error("Entry date is required.");
  if (!engineerId) throw new Error("Engineer ID is required.");

  // Attendance Verification Gate: Verify engineer attendance
  const isVerified = await verifyEngineerAttendanceGate(engineerId, siteId, dateStr);
  if (!isVerified) {
    throw new Error(`Attendance Verification Gate: Verified site attendance is required for site and date (${dateStr}) before submitting material entries.`);
  }

  const validItems = (items || []).filter(item => item.type === "custom" || item.type === "customer_amount_only" || item.type === "rate_only" || Number(item.quantity) > 0);
  if (validItems.length === 0) {
    throw new Error("Please enter at least one material for submission.");
  }

  const db = getDb();
  const batch = writeBatch(db);

  // Save each material item as a unique permanent record to materials collection in single atomic batch
  for (const item of validItems) {
    const isCustom = item.type === "custom";
    const isCustomerAmountOnly = item.type === "customer_amount_only";
    const isRateOnly = item.type === "rate_only";
    const isFixed = isCustom || isCustomerAmountOnly || isRateOnly;
    const qty = isFixed ? 1 : Number(item.quantity);
    const uPrice = Number(item.unitPrice !== undefined ? item.unitPrice : (item.amount !== undefined ? item.amount : item.rate)) || 0;
    const totAmount = isFixed 
      ? (Number(item.amount !== undefined ? item.amount : (item.totalAmount !== undefined ? item.totalAmount : uPrice)) || 0)
      : (qty * uPrice);
    const cleanTitle = (item.title || "").trim();
    const matName = cleanTitle || (item.materialName || item.name || "").trim() || (isCustomerAmountOnly ? "Customer Amount" : (isRateOnly ? "Rate Item" : "Customer Entry"));
    
    // Generate unique record ID for each submitted material record
    const newDocRef = item.id ? doc(db, "materials", item.id) : doc(collection(db, "materials"));

    batch.set(newDocRef, {
      id: newDocRef.id,
      siteId,
      engineerId,
      teamId: item.teamId || bulkData.teamId || null,
      teamName: item.teamName || bulkData.teamName || item.category || "General",
      materialName: matName,
      title: cleanTitle,
      materialType: isCustomerAmountOnly ? "customer_amount_only" : (isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard")),
      category: item.category || item.teamName || bulkData.teamName || "General",
      quantity: qty,
      receivedQuantity: qty,
      requiredQuantity: qty,
      unit: isFixed ? "" : (item.unit || "Unit"),
      unitPrice: uPrice,
      rate: uPrice,
      amount: totAmount,
      totalAmount: totAmount,
      supplierName: item.supplierName?.trim() || item.teamName || bulkData.teamName || "Material Supplier",
      purchaseDate: dateStr,
      notes: item.notes?.trim() || `${isCustomerAmountOnly ? "Customer Amount" : (isRateOnly ? "Rate Only" : (isCustom ? "Custom Material" : "Material"))} Entry for ${item.teamName || bulkData.teamName || "Team"} on ${dateStr}`,
      invoiceUrl: item.invoiceUrl || "",
      status: "Approved", // Automatically approved material log
      locked: true,
      submitted: true,
      submittedAt: serverTimestamp(),
      type: "material_log",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();

  return { success: true, count: validItems.length };
}

// Atomic Material Transfer between sites
export async function transferMaterialBetweenSites({
  sourceSiteId,
  sourceSiteName,
  destinationSiteId,
  destinationSiteName,
  sourceMaterialId,
  transferQuantity,
  transferDate,
  engineerId,
  engineerName,
  notes
}) {
  const db = getDb();
  if (!sourceSiteId || !destinationSiteId) throw new Error("Source and Destination sites are required.");
  if (sourceSiteId === destinationSiteId) throw new Error("Cannot transfer material to the same site.");
  const transferQty = Number(transferQuantity);
  if (!transferQty || isNaN(transferQty) || transferQty <= 0) throw new Error("Transfer quantity must be greater than 0.");

  const txDate = transferDate || new Date().toISOString().split("T")[0];

  // Attendance Verification Gate: Verify engineer attendance at source site
  if (engineerId) {
    const isVerified = await verifyEngineerAttendanceGate(engineerId, sourceSiteId, txDate);
    if (!isVerified) {
      throw new Error(`Attendance Verification Gate: Verified site attendance is required at the source site for date (${txDate}) before transferring materials.`);
    }
  }

  const sourceDocRef = doc(db, "materials", sourceMaterialId);

  return await runTransaction(db, async (transaction) => {
    const sourceSnap = await transaction.get(sourceDocRef);
    if (!sourceSnap.exists()) throw new Error("Source material record not found.");

    const sourceData = sourceSnap.data();
    const currentQty = Number(sourceData.quantity) || 0;
    const consumedQty = Number(sourceData.consumedQuantity) || 0;
    const availableStock = Math.max(0, currentQty - consumedQty);

    if (transferQty > availableStock) {
      throw new Error(`Transfer quantity (${transferQty}) exceeds available stock (${availableStock} ${sourceData.unit || "units"}).`);
    }

    const transferId = `transfer_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;
    const txDate = transferDate || new Date().toISOString().split("T")[0];
    const newSourceQty = currentQty - transferQty;
    const currentTransferredOut = Number(sourceData.transferredOutQuantity) || 0;

    const transferOutEntry = {
      transferId,
      toSiteId: destinationSiteId,
      toSiteName: destinationSiteName || "Destination Site",
      quantity: transferQty,
      date: txDate,
      transferredBy: engineerId,
      transferredByName: engineerName || "Site Engineer",
      notes: notes || "",
      timestamp: new Date().toISOString()
    };

    const existingTransfersOut = Array.isArray(sourceData.transfersOut) ? sourceData.transfersOut : [];

    // 1. Update source site material record atomically
    transaction.update(sourceDocRef, {
      quantity: newSourceQty,
      transferredOutQuantity: currentTransferredOut + transferQty,
      transfersOut: [...existingTransfersOut, transferOutEntry],
      notes: (sourceData.notes ? sourceData.notes + "\n" : "") + `[${txDate}] Transferred out -${transferQty} ${sourceData.unit || ""} to ${destinationSiteName || "other site"}`,
      updatedAt: serverTimestamp()
    });

    // 2. Create destination incoming transfer record in canonical 'materials' collection
    const destDocRef = doc(db, "materials", transferId);
    const uPrice = Number(sourceData.unitPrice || sourceData.rate) || 0;
    const totAmount = transferQty * uPrice;

    transaction.set(destDocRef, {
      id: transferId,
      transferId,
      type: "material_transfer",
      sourceSiteId,
      sourceSiteName: sourceSiteName || "Source Site",
      destinationSiteId,
      destinationSiteName: destinationSiteName || "Destination Site",
      sourceMaterialId,
      siteId: destinationSiteId, // Canonical siteId for destination site queries
      engineerId,
      transferredBy: engineerId,
      transferredByName: engineerName || "Site Engineer",
      materialName: sourceData.materialName,
      materialType: sourceData.materialType || "standard",
      category: sourceData.category || sourceData.teamName || "General",
      teamId: sourceData.teamId || null,
      teamName: sourceData.teamName || "General",
      unit: sourceData.unit || "Unit",
      quantity: 0, // In transit - not yet received
      transferQuantity: transferQty,
      requiredQuantity: transferQty,
      unitPrice: uPrice,
      rate: uPrice,
      amount: totAmount,
      totalAmount: totAmount,
      transferDate: txDate,
      purchaseDate: txDate,
      notes: notes?.trim() || `Incoming transfer of ${transferQty} ${sourceData.unit || "units"} from ${sourceSiteName || "Source Site"}`,
      status: "In Transit", // Canonical status
      transferStatus: "In Transit",
      deliveryStatus: "Pending Receipt",
      isIncomingTransfer: true,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });

    return {
      transferId,
      transferredQuantity: transferQty,
      newSourceQuantity: newSourceQty,
      destinationSiteId
    };
  });
}

// Atomic Material Transfer Receipt Confirmation at Destination Site
export async function receiveMaterialTransfer({
  transferId,
  receivedQuantity,
  receiveDate,
  engineerId,
  engineerName,
  notes
}) {
  const db = getDb();
  if (!transferId) throw new Error("Transfer record ID is required.");
  const newlyReceived = Number(receivedQuantity);
  if (!newlyReceived || isNaN(newlyReceived) || newlyReceived <= 0) {
    throw new Error("Received quantity must be greater than 0.");
  }

  const rxDate = receiveDate || new Date().toISOString().split("T")[0];

  const transferDocRef = doc(db, "materials", transferId);

  return await runTransaction(db, async (transaction) => {
    const transferSnap = await transaction.get(transferDocRef);
    if (!transferSnap.exists()) throw new Error("Material transfer record not found.");

    const data = transferSnap.data();

    // Attendance Verification Gate: Verify engineer attendance at destination site
    if (engineerId) {
      const destSiteId = data.destinationSiteId || data.siteId;
      const isVerified = await verifyEngineerAttendanceGate(engineerId, destSiteId, rxDate);
      if (!isVerified) {
        throw new Error(`Attendance Verification Gate: Verified site attendance is required at the destination site for date (${rxDate}) before confirming material receipts.`);
      }
    }
    const totalTransferred = Number(data.transferQuantity || data.requiredQuantity || data.orderedQuantity) || 0;
    const previouslyReceived = Number(data.quantity) || 0;
    const currentPending = Math.max(0, totalTransferred - previouslyReceived);

    if (newlyReceived > currentPending) {
      throw new Error(`Received quantity (${newlyReceived}) cannot exceed pending quantity (${currentPending} ${data.unit || "units"}).`);
    }

    const updatedReceived = previouslyReceived + newlyReceived;
    const updatedPending = Math.max(0, totalTransferred - updatedReceived);
    const isFullyReceived = updatedPending === 0;
    const rxDate = receiveDate || new Date().toISOString().split("T")[0];

    const uPrice = Number(data.unitPrice || data.rate) || 0;
    const newTotalAmount = updatedReceived * uPrice;

    const receiptEntry = {
      id: `rx_${Date.now()}`,
      receivedQuantity: newlyReceived,
      date: rxDate,
      receivedBy: engineerId,
      receivedByName: engineerName || "Site Engineer",
      notes: notes || "",
      timestamp: new Date().toISOString()
    };

    const existingReceipts = Array.isArray(data.receiptHistory) ? data.receiptHistory : [];
    const appendNote = `\n[${rxDate}] Received +${newlyReceived} ${data.unit || ""} from ${data.sourceSiteName || "Source Site"} (Total received: ${updatedReceived}/${totalTransferred}${isFullyReceived ? " - Fully Received" : ` - ${updatedPending} remaining`})`;

    // Atomically update the EXACT SAME canonical document in-place
    transaction.update(transferDocRef, {
      quantity: updatedReceived, // Canonical received quantity at destination site
      receivedQuantity: updatedReceived,
      requiredQuantity: totalTransferred,
      pendingDelivery: updatedPending,
      isPendingDelivery: !isFullyReceived,
      totalAmount: newTotalAmount,
      amount: newTotalAmount,
      status: isFullyReceived ? "Received" : "Partial Received",
      transferStatus: isFullyReceived ? "Received" : "Partial Received",
      deliveryStatus: isFullyReceived ? "Fully Delivered" : "Partial Delivery",
      receiptHistory: [...existingReceipts, receiptEntry],
      lastReceivedAt: serverTimestamp(),
      receivedBy: engineerId,
      receivedByName: engineerName || "Site Engineer",
      purchaseDate: data.purchaseDate || rxDate,
      notes: (data.notes || "") + appendNote,
      updatedAt: serverTimestamp()
    });

    return {
      transferId,
      receivedQuantity: updatedReceived,
      pendingQuantity: updatedPending,
      isFullyReceived
    };
  });
}

// Real-time site-scoped material transfer subscription (Single Source of Truth)
export function subscribeMaterialTransfersForSite(siteId, onUpdate) {
  const db = getDb();
  const materialsColl = collection(db, "materials");
  const q = query(materialsColl, where("type", "==", "material_transfer"));

  return onSnapshot(q, (snapshot) => {
    const list = [];
    snapshot.forEach(d => {
      const data = d.data();
      // Enforce strict site isolation: only include if site is source OR destination
      if (siteId) {
        if (data.sourceSiteId !== siteId && data.destinationSiteId !== siteId && data.siteId !== siteId) {
          return;
        }
      }

      const transferQty = Number(data.transferQuantity || data.requiredQuantity || data.quantity || 0);
      const recQty = Number(data.receivedQuantity || data.quantity || 0);
      const pendingQty = Math.max(0, transferQty - recQty);
      const isOutgoing = data.sourceSiteId === siteId;
      const isIncoming = data.destinationSiteId === siteId || data.siteId === siteId;

      list.push({
        id: d.id,
        transferId: data.transferId || d.id,
        ...data,
        transferQuantity: transferQty,
        receivedQuantity: recQty,
        pendingQuantity: pendingQty,
        isOutgoing,
        isIncoming,
        direction: isOutgoing ? "OUTGOING" : "INCOMING",
        counterpartSiteName: isOutgoing ? (data.destinationSiteName || "Destination Site") : (data.sourceSiteName || "Source Site"),
        counterpartSiteId: isOutgoing ? data.destinationSiteId : data.sourceSiteId
      });
    });

    list.sort((a, b) => {
      const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.transferDate || 0);
      const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.transferDate || 0);
      return dateB - dateA;
    });

    onUpdate(list);
  }, (error) => {
    console.error("subscribeMaterialTransfersForSite failed:", error);
  });
}

// Fetch site-scoped material transfer history
export async function getMaterialTransfersForSite(siteId) {
  const db = getDb();
  const materialsColl = collection(db, "materials");
  const q = query(materialsColl, where("type", "==", "material_transfer"));
  const snapshot = await getDocs(q);

  const list = [];
  snapshot.forEach(d => {
    const data = d.data();
    if (siteId) {
      if (data.sourceSiteId !== siteId && data.destinationSiteId !== siteId && data.siteId !== siteId) {
        return;
      }
    }

    const transferQty = Number(data.transferQuantity || data.requiredQuantity || data.quantity || 0);
    const recQty = Number(data.receivedQuantity || data.quantity || 0);
    const pendingQty = Math.max(0, transferQty - recQty);
    const isOutgoing = data.sourceSiteId === siteId;

    list.push({
      id: d.id,
      transferId: data.transferId || d.id,
      ...data,
      transferQuantity: transferQty,
      receivedQuantity: recQty,
      pendingQuantity: pendingQty,
      isOutgoing,
      isIncoming: !isOutgoing,
      direction: isOutgoing ? "OUTGOING" : "INCOMING",
      counterpartSiteName: isOutgoing ? (data.destinationSiteName || "Destination Site") : (data.sourceSiteName || "Source Site"),
      counterpartSiteId: isOutgoing ? data.destinationSiteId : data.sourceSiteId
    });
  });

  list.sort((a, b) => {
    const dateA = a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000) : new Date(a.transferDate || 0);
    const dateB = b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000) : new Date(b.transferDate || 0);
    return dateB - dateA;
  });

  return list;
}

/**
 * Mark a site as Completed in canonical sites collection
 * Updates site status and metadata without mutating historical operational records
 */
export async function markSiteCompleted(siteId, completionData = {}) {
  const db = getDb();
  const siteRef = doc(db, "sites", siteId);
  const payload = {
    status: "Completed",
    isCompleted: true,
    completedAt: serverTimestamp(),
    completedBy: completionData.completedBy || "admin",
    completedByName: completionData.completedByName || "Admin",
    completionNotes: completionData.notes || "",
    updatedAt: serverTimestamp()
  };
  await updateDoc(siteRef, payload);
  return { id: siteId, ...payload };
}

/**
 * Reopen a Completed site back to In Progress status
 */
export async function reopenSite(siteId, reopenData = {}) {
  const db = getDb();
  const siteRef = doc(db, "sites", siteId);
  const payload = {
    status: "In Progress",
    isCompleted: false,
    reopenedAt: serverTimestamp(),
    reopenedBy: reopenData.reopenedBy || "admin",
    reopenedByName: reopenData.reopenedByName || "Admin",
    reopenNotes: reopenData.notes || "",
    updatedAt: serverTimestamp()
  };
  await updateDoc(siteRef, payload);
  return { id: siteId, ...payload };
}

/**
 * Fetch all canonical pending records for a site to audit before completion
 */
export async function getSitePendingAuditDetails(siteId) {
  const [
    materials,
    transfers,
    expenses,
    labourHistory,
    labourPayments
  ] = await Promise.all([
    getMaterialsDetailed(siteId),
    getMaterialTransfersForSite(siteId),
    getGeneralExpenses(),
    getLabourDailyCountsSummary(siteId),
    getLabourPayments(siteId)
  ]);

  // 1. Pending material deliveries
  const siteMaterials = (materials || []).filter(m => m.siteId === siteId && m.type !== "material_transfer");
  const pendingDeliveries = siteMaterials.filter(m => {
    const req = Number(m.requiredQuantity || m.orderedQuantity || m.quantity || 0);
    const rec = Number(m.receivedQuantity || m.quantity || 0);
    return req > rec && m.deliveryStatus !== "Delivered";
  }).map(m => ({
    id: m.id,
    materialName: m.materialName || m.name,
    required: Number(m.requiredQuantity || m.orderedQuantity || m.quantity || 0),
    received: Number(m.receivedQuantity || m.quantity || 0),
    pending: Math.max(0, Number(m.requiredQuantity || m.orderedQuantity || m.quantity || 0) - Number(m.receivedQuantity || m.quantity || 0)),
    unit: m.unit || "unit"
  }));

  // 2. Pending material transfers
  const pendingTransfers = (transfers || []).filter(t => 
    t.status === "Pending" || t.status === "In Transit" || t.status === "Partial Received"
  );

  // 3. Pending expenses
  const pendingExpenses = (expenses || []).filter(e => 
    e.siteId === siteId && (e.status === "Pending" || e.status === "pending")
  );

  // 4. Labour net payable balance
  let grossLabour = 0;
  (labourHistory || []).forEach(row => {
    if (row.totalAmount) {
      grossLabour += Number(row.totalAmount) || 0;
    } else if (row.calculatedAmount) {
      grossLabour += Number(row.calculatedAmount) || 0;
    } else if (row.workerCount) {
      const wage = Number(row.dailyWage || row.wage || 500);
      const units = Number(row.customWorkUnits !== undefined ? row.customWorkUnits : (row.units || 1));
      grossLabour += Number(row.workerCount) * units * wage;
    }
  });
  const advances = (labourPayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
  const netPayableLabour = Math.max(0, grossLabour - advances);

  const totalPendingCount = pendingDeliveries.length + pendingTransfers.length + pendingExpenses.length + (netPayableLabour > 0 ? 1 : 0);

  return {
    pendingDeliveries,
    pendingTransfers,
    pendingExpenses,
    netPayableLabour,
    grossLabour,
    advances,
    totalPendingCount,
    hasPendingItems: totalPendingCount > 0
  };
}

// ============================================================================
// ADMIN ASSISTED ENTRY (OVERRIDE WHEN SITE ENGINEER IS UNAVAILABLE)
// ============================================================================

// Submit Admin Assisted Labour Attendance for a Site, Date, Team & Assigned Engineer
export async function submitAdminAssistedLabourAttendance({
  siteId,
  dateStr,
  assignedEngineerId,
  teamId,
  teamName,
  attendanceRows = [],
  adminUser = {},
  reason = "Site Engineer Unavailable"
}) {
  if (!siteId || !dateStr || !teamId) {
    throw new Error("Site, Date, and Labour Team are required.");
  }
  if (!assignedEngineerId) {
    throw new Error("Assigned Site Engineer ID is required.");
  }
  if (!attendanceRows || attendanceRows.length === 0) {
    throw new Error("Please provide at least one workforce category with count.");
  }

  const cleanSiteId = String(siteId).trim();
  const cleanDateStr = String(dateStr).trim();
  const cleanTeamId = String(teamId).trim();
  const cleanAssignedEngId = String(assignedEngineerId).trim();
  const adminId = adminUser.uid || adminUser.id || "admin";
  const adminName = adminUser.fullName || adminUser.name || "Admin";

  // Duplicate Prevention Check directly against database
  const lockStatus = await checkLabourSubmissionStatus(cleanSiteId, cleanDateStr, cleanTeamId);
  if (lockStatus && lockStatus.submitted) {
    throw new Error(`Attendance for this team on ${cleanDateStr} has already been submitted and locked.`);
  }

  const db = getDb();
  const batch = writeBatch(db);

  // 1. Save each category attendance record
  for (const row of attendanceRows) {
    const workerCount = Number(row.workerCount) || 0;
    if (workerCount <= 0) continue;

    const units = Math.max(0.01, Number(row.customWorkUnits !== undefined ? row.customWorkUnits : (row.units || 1.0)));
    const dailyWage = Number(row.dailyWage || row.wage || 0);

    const rawWorkerEntries = Array.isArray(row.workerEntries) ? row.workerEntries : [];
    const normalizedWorkerEntries = rawWorkerEntries.map((w, idx) => {
      const wUnits = Math.max(0.01, Number(w.customWorkUnits !== undefined ? w.customWorkUnits : (w.units !== undefined ? w.units : units)));
      const wWage = Number(w.dailyWage !== undefined ? w.dailyWage : (w.wage !== undefined ? w.wage : dailyWage));
      const wAmount = Number(w.calculatedAmount !== undefined ? w.calculatedAmount : (wUnits * wWage));
      return {
        workerId: w.workerId || `worker_${idx + 1}`,
        workerName: w.workerName || `Worker ${idx + 1}`,
        customWorkUnits: wUnits,
        units: wUnits,
        dailyWage: wWage,
        wage: wWage,
        calculatedAmount: wAmount
      };
    });

    let calculatedAmount = 0;
    if (normalizedWorkerEntries.length > 0) {
      let customSum = 0;
      normalizedWorkerEntries.forEach(w => {
        customSum += Number(w.calculatedAmount) || (w.units * w.wage);
      });
      const remainingCount = Math.max(0, workerCount - normalizedWorkerEntries.length);
      const remainingSum = remainingCount * units * dailyWage;
      calculatedAmount = customSum + remainingSum;
    } else {
      calculatedAmount = Number(row.calculatedAmount) || (workerCount * units * dailyWage);
    }

    const safeType = `${units}_Units`.replace(/\s+/g, "_");
    const docId = row.id || `${cleanSiteId}_${cleanTeamId}_${row.categoryId}_${safeType}_${cleanDateStr}`;
    const docRef = doc(db, "labourMemberAttendance", docId);

    batch.set(docRef, {
      id: docId,
      siteId: cleanSiteId,
      teamId: cleanTeamId,
      teamName: teamName || row.teamName || "Labour Team",
      categoryId: row.categoryId,
      categoryName: row.categoryName || row.name || "",
      attendanceDate: cleanDateStr,
      date: cleanDateStr,
      workerCount,
      customWorkUnits: units,
      units: units,
      dailyWage,
      wage: dailyWage,
      workerEntries: normalizedWorkerEntries,
      calculatedAmount,
      totalAmount: calculatedAmount,
      attendanceType: normalizedWorkerEntries.length > 0 ? `${units} Units (Custom Workers)` : `${units} Units`,
      
      // Audit information
      assignedEngineerId: cleanAssignedEngId,
      engineerId: cleanAssignedEngId, // Preserves original assigned engineer for all dashboards/reports
      createdBy: adminId,
      createdByName: adminName,
      createdByRole: "admin",
      createdVia: "admin_assisted_entry",
      isAdminEntry: true,
      adminReason: reason,
      
      status: "submitted",
      locked: true,
      submitted: true,
      submittedAt: serverTimestamp(),
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
  }

  // 2. Create team-specific lock record in attendance collection
  const lockDocId = `labour_lock_${cleanSiteId}_${cleanTeamId}_${cleanDateStr}`;
  const lockDocRef = doc(db, "attendance", lockDocId);
  batch.set(lockDocRef, {
    type: "labour_attendance_lock",
    userId: adminId,
    engineerId: cleanAssignedEngId,
    assignedEngineerId: cleanAssignedEngId,
    siteId: cleanSiteId,
    date: cleanDateStr,
    attendanceDate: cleanDateStr,
    teamId: cleanTeamId,
    status: "submitted",
    locked: true,
    submitted: true,
    submittedAt: serverTimestamp(),
    submittedBy: adminId,
    createdByName: adminName,
    createdByRole: "admin",
    createdVia: "admin_assisted_entry",
    isAdminEntry: true,
    adminReason: reason,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  }, { merge: true });

  await batch.commit();
  return { success: true };
}

// Submit Admin Assisted Material Entry for a Site, Date & Assigned Engineer
export async function submitAdminAssistedMaterialEntry({
  siteId,
  dateStr,
  assignedEngineerId,
  items = [],
  adminUser = {},
  reason = "Site Engineer Unavailable"
}) {
  if (!siteId || !dateStr) {
    throw new Error("Site and Date are required.");
  }
  if (!assignedEngineerId) {
    throw new Error("Assigned Site Engineer ID is required.");
  }
  const validItems = (items || []).filter(item => item.type === "custom" || item.type === "customer_amount_only" || item.type === "rate_only" || Number(item.quantity) > 0);
  if (validItems.length === 0) {
    throw new Error("Please enter at least one material for submission.");
  }

  const cleanSiteId = String(siteId).trim();
  const cleanDateStr = String(dateStr).trim();
  const cleanAssignedEngId = String(assignedEngineerId).trim();
  const adminId = adminUser.uid || adminUser.id || "admin";
  const adminName = adminUser.fullName || adminUser.name || "Admin";

  const db = getDb();
  const batch = writeBatch(db);

  for (const item of validItems) {
    const isCustom = item.type === "custom";
    const isCustomerAmountOnly = item.type === "customer_amount_only";
    const isRateOnly = item.type === "rate_only";
    const isFixed = isCustom || isCustomerAmountOnly || isRateOnly;
    const qty = isFixed ? 1 : Number(item.quantity);
    const uPrice = Number(item.unitPrice !== undefined ? item.unitPrice : (item.amount !== undefined ? item.amount : item.rate)) || 0;
    const totAmount = isFixed 
      ? (Number(item.amount !== undefined ? item.amount : (item.totalAmount !== undefined ? item.totalAmount : uPrice)) || 0)
      : (qty * uPrice);
    const cleanTitle = (item.title || "").trim();
    const matName = cleanTitle || (item.materialName || item.name || "").trim() || (isCustomerAmountOnly ? "Customer Amount" : (isRateOnly ? "Rate Item" : "Customer Entry"));

    const newDocRef = item.id ? doc(db, "materials", item.id) : doc(collection(db, "materials"));

    batch.set(newDocRef, {
      id: newDocRef.id,
      siteId: cleanSiteId,
      assignedEngineerId: cleanAssignedEngId,
      engineerId: cleanAssignedEngId, // Preserves original assigned engineer
      teamId: item.teamId || null,
      teamName: item.teamName || item.category || "General",
      materialName: matName,
      title: cleanTitle,
      materialType: isCustomerAmountOnly ? "customer_amount_only" : (isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard")),
      category: item.category || item.teamName || "General",
      quantity: qty,
      receivedQuantity: qty,
      requiredQuantity: qty,
      unit: isFixed ? "" : (item.unit || "Unit"),
      unitPrice: uPrice,
      rate: uPrice,
      amount: totAmount,
      totalAmount: totAmount,
      supplierName: item.supplierName?.trim() || item.teamName || "Material Supplier",
      purchaseDate: cleanDateStr,
      notes: item.notes?.trim() || `Admin Entry on behalf of assigned engineer on ${cleanDateStr}`,
      invoiceUrl: item.invoiceUrl || "",
      status: "Approved",
      locked: true,
      submitted: true,
      submittedAt: serverTimestamp(),
      type: "material_log",
      
      // Audit Information
      createdBy: adminId,
      createdByName: adminName,
      createdByRole: "admin",
      createdVia: "admin_assisted_entry",
      isAdminEntry: true,
      adminReason: reason,

      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    });
  }

  await batch.commit();
  return { success: true, count: validItems.length };
}

// Submit Admin Assisted Progress Report (DPR)
export async function submitAdminAssistedProgressReport({
  siteId,
  dateStr,
  assignedEngineerId,
  description = "",
  progress = 0,
  additionalNotes = {},
  adminUser = {},
  reason = "Site Engineer Unavailable"
}) {
  if (!siteId || !dateStr || !assignedEngineerId) {
    throw new Error("Site, Date, and Assigned Engineer are required.");
  }
  const cleanSiteId = String(siteId).trim();
  const cleanDateStr = String(dateStr).trim();
  const cleanAssignedEngId = String(assignedEngineerId).trim();
  const adminId = adminUser.uid || adminUser.id || "admin";
  const adminName = adminUser.fullName || adminUser.name || "Admin";

  const db = getDb();
  const newReportRef = doc(collection(db, "reports"));

  const reportPayload = {
    id: newReportRef.id,
    siteId: cleanSiteId,
    date: cleanDateStr,
    assignedEngineerId: cleanAssignedEngId,
    engineerId: cleanAssignedEngId, // Preserves assigned engineer
    description: description || "Daily progress report logged by Admin.",
    progress: Number(progress) || 0,
    photoIds: additionalNotes.photoIds || [],
    completedToday: additionalNotes.completedToday || "",
    currentlyRunning: additionalNotes.currentlyRunning || "",
    materialsStatus: additionalNotes.materialsStatus || "",
    problemsFaced: additionalNotes.problemsFaced || "",
    pendingWork: additionalNotes.pendingWork || "",
    nextActivity: additionalNotes.nextActivity || "",
    
    // Audit information
    createdBy: adminId,
    createdByName: adminName,
    createdByRole: "admin",
    createdVia: "admin_assisted_entry",
    isAdminEntry: true,
    adminReason: reason,

    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp()
  };

  await setDoc(newReportRef, reportPayload);

  try {
    const legacyRef = doc(db, "dailyUpdates", newReportRef.id);
    await setDoc(legacyRef, reportPayload);
  } catch (e) {}

  return { success: true, id: newReportRef.id };
}


import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, initializeFirestore, persistentLocalCache, persistentSingleTabManager } from "firebase/firestore";
import { PROJECT_CONFIGS as importedProjects, firebaseConfig as fallbackConfig } from "../../env.js";

// Canonical Multi-Tenant Project Registry
export const PROJECT_CONFIGS = importedProjects || {
  customer1: {
    id: "customer1",
    name: "Civil Construction Site 1",
    shortName: "Project 1",
    apiKey: "AIzaSyCwmOam1UHhAzZJNg7Jiuha1lcOy0qlwA8",
    googleMapsApiKey: "AIzaSyC738UrEsuIru8YsGJBayjvJGqK-s332Zg",
    authDomain: "studio-7044154747-fb0fa.firebaseapp.com",
    projectId: "studio-7044154747-fb0fa",
    storageBucket: "studio-7044154747-fb0fa.firebasestorage.app",
    messagingSenderId: "201376845036",
    appId: "1:201376845036:web:d50fb937ecc740e480e9c9",
    defaultAdminEmail: "admin@gmail.com"
  },
  customer2: {
    id: "customer2",
    name: "Civil Construction Site 2",
    shortName: "Project 2",
    apiKey: "AIzaSyB2P-B08Zg8aAaAJaNeg57fhCGvFJmrK24",
    googleMapsApiKey: "AIzaSyB2P-B08Zg8aAaAJaNeg57fhCGvFJmrK24",
    authDomain: "civilconstructionsite2.firebaseapp.com",
    projectId: "civilconstructionsite2",
    storageBucket: "civilconstructionsite2.firebasestorage.app",
    messagingSenderId: "86404894185",
    appId: "1:86404894185:web:ac69fc24d500391b09cf78",
    defaultAdminEmail: "admin2@gmail.com"
  }
};

// Retrieve currently active tenant project key ("customer1" | "customer2")
export function getActiveProjectKey() {
  if (typeof window !== "undefined") {
    try {
      // 1. URL Parameter check: ?project=customer2 or ?project=civilconstructionsite2
      const params = new URLSearchParams(window.location.search);
      const urlProj = params.get("project") || params.get("tenant");
      if (urlProj) {
        if (urlProj === "2" || urlProj === "customer2" || urlProj === "civilconstructionsite2") return "customer2";
        if (urlProj === "1" || urlProj === "customer1" || urlProj === "studio-7044154747-fb0fa") return "customer1";
      }
    } catch (e) {}

    try {
      // 2. LocalStorage persistence check
      const saved = localStorage.getItem("active_tenant_key") || localStorage.getItem("active_project_id");
      if (saved) {
        if (saved === "customer2" || saved === "civilconstructionsite2") return "customer2";
        if (saved === "customer1" || saved === "studio-7044154747-fb0fa") return "customer1";
      }
    } catch (e) {}
  }

  // 3. Fallback to Customer 1 by default
  return "customer1";
}

// Set active project key in localStorage and memory
export function setActiveProject(projectKeyOrId) {
  let normalizedKey = "customer1";
  if (
    projectKeyOrId === "customer2" || 
    projectKeyOrId === "civilconstructionsite2" || 
    projectKeyOrId === "2"
  ) {
    normalizedKey = "customer2";
  } else if (
    projectKeyOrId === "customer1" || 
    projectKeyOrId === "studio-7044154747-fb0fa" || 
    projectKeyOrId === "1"
  ) {
    normalizedKey = "customer1";
  }

  if (typeof window !== "undefined") {
    try {
      localStorage.setItem("active_tenant_key", normalizedKey);
      localStorage.setItem("active_project_id", PROJECT_CONFIGS[normalizedKey].projectId);
    } catch (e) {}
  }

  return normalizedKey;
}

// Get the config object of the active project
export function getActiveProjectConfig() {
  const key = getActiveProjectKey();
  return PROJECT_CONFIGS[key] || PROJECT_CONFIGS.customer1 || fallbackConfig;
}

// Active firebase configuration proxy / snapshot
export const firebaseConfig = new Proxy({}, {
  get(target, prop) {
    const activeCfg = getActiveProjectConfig();
    return activeCfg[prop];
  }
});

// Storage for initialized project instances
const instancesCache = {};

// Initialize or return instances for a specific project
export function getProjectInstances(projectKey = getActiveProjectKey()) {
  const key = (projectKey === "customer2" || projectKey === "civilconstructionsite2") ? "customer2" : "customer1";
  
  if (instancesCache[key]) {
    return instancesCache[key];
  }

  const config = PROJECT_CONFIGS[key] || PROJECT_CONFIGS.customer1;
  const primaryAppName = `app_${key}`;
  const secondaryAppName = `sec_${key}`;

  let primaryApp;
  const existingApps = getApps();
  const existingPrimary = existingApps.find(a => a.name === primaryAppName);
  if (existingPrimary) {
    primaryApp = existingPrimary;
  } else {
    primaryApp = initializeApp(config, primaryAppName);
  }

  let secondaryApp;
  const existingSecondary = existingApps.find(a => a.name === secondaryAppName);
  if (existingSecondary) {
    secondaryApp = existingSecondary;
  } else {
    secondaryApp = initializeApp(config, secondaryAppName);
  }

  const authInstance = getAuth(primaryApp);
  const secondaryAuthInstance = getAuth(secondaryApp);

  let dbInstance;
  try {
    dbInstance = initializeFirestore(primaryApp, {
      localCache: persistentLocalCache({
        tabManager: persistentSingleTabManager()
      })
    });
  } catch (e) {
    try {
      dbInstance = getFirestore(primaryApp);
    } catch (err) {
      console.warn(`Firestore initialization fallback for ${key}:`, err);
    }
  }

  instancesCache[key] = {
    key,
    config,
    primaryApp,
    secondaryApp,
    auth: authInstance,
    secondaryAuth: secondaryAuthInstance,
    db: dbInstance
  };

  return instancesCache[key];
}

// Pre-initialize both tenant projects on startup
try {
  getProjectInstances("customer1");
  getProjectInstances("customer2");
} catch (e) {
  console.warn("Pre-initialization notice:", e);
}

// Getter for current active Auth instance
export function getFirebaseAuth(projectKey) {
  return getProjectInstances(projectKey || getActiveProjectKey()).auth;
}

// Getter for current active Firestore instance
export function getFirebaseDb(projectKey) {
  return getProjectInstances(projectKey || getActiveProjectKey()).db;
}

// Getter for secondary Auth (used to create engineer accounts without logging out admin)
export function getSecondaryAuth(projectKey) {
  return getProjectInstances(projectKey || getActiveProjectKey()).secondaryAuth;
}

// Default Admin Email based on active project
export function getDefaultAdminEmail(projectKey = getActiveProjectKey()) {
  const key = (projectKey === "customer2" || projectKey === "civilconstructionsite2") ? "customer2" : "customer1";
  return PROJECT_CONFIGS[key]?.defaultAdminEmail || "admin@gmail.com";
}

export const defaultAdminEmail = getDefaultAdminEmail();
export const isProject2 = getActiveProjectKey() === "customer2";

// Stored config check
export function getStoredConfig() {
  return getActiveProjectConfig();
}

// Check if Firebase is configured
export function isFirebaseConfigured() {
  const cfg = getActiveProjectConfig();
  return Boolean(cfg && cfg.apiKey && cfg.apiKey !== "YOUR_API_KEY_HERE" && cfg.apiKey !== "");
}

// Universal initialization helper
export function initFirebase() {
  getProjectInstances("customer1");
  getProjectInstances("customer2");
  return true;
}

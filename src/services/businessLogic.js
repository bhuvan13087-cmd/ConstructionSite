// Unified business logic layer for calculations, validations, permissions, etc.
import { calculateDistanceMeters } from "./firebaseService.js";

/**
 * Canonical extractor for site budget.
 * Supports site.budget, site.totalBudget, site.contractValue, with strict type safety.
 * @param {object} site - Site object
 * @returns {number} - Budget in INR
 */
export function getSiteBudget(site) {
  if (!site) return 0;
  if (site.budget !== undefined && site.budget !== null && site.budget !== "") {
    const val = Number(site.budget);
    return isNaN(val) ? 0 : Math.max(0, val);
  }
  if (site.totalBudget !== undefined && site.totalBudget !== null && site.totalBudget !== "") {
    const val = Number(site.totalBudget);
    return isNaN(val) ? 0 : Math.max(0, val);
  }
  if (site.contractValue !== undefined && site.contractValue !== null && site.contractValue !== "") {
    const val = Number(site.contractValue);
    return isNaN(val) ? 0 : Math.max(0, val);
  }
  return 0;
}

/**
 * Aggregates total budget across an array of sites.
 * @param {Array} sites - Array of site objects
 * @returns {number} - Total budget across all sites in INR
 */
export function calculateTotalSitesBudget(sites = []) {
  if (!Array.isArray(sites) || sites.length === 0) return 0;
  return sites.reduce((sum, site) => sum + getSiteBudget(site), 0);
}

/**
 * Standard Indian Rupee currency formatter.
 * Formats full numeric values with standard Indian numbering system (e.g. ₹38,75,00,000).
 * @param {number|string} val - Numeric value or string
 * @param {object} [options] - Optional configuration { maximumFractionDigits, minimumFractionDigits }
 * @returns {string} - Formatted currency string
 */
export function formatINR(val, options = {}) {
  if (val === undefined || val === null || val === "") return "₹0";
  const num = Number(val);
  if (isNaN(num)) return "₹0";
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: options.maximumFractionDigits !== undefined ? options.maximumFractionDigits : 0,
    minimumFractionDigits: options.minimumFractionDigits !== undefined ? options.minimumFractionDigits : 0
  }).format(num);
}

/**
 * Formats currency in full amount explicitly.
 * @param {number|string} val - Amount in INR
 * @returns {string} - Formatted full currency e.g. ₹38,75,00,000
 */
export function formatFullINR(val) {
  return formatINR(val, { maximumFractionDigits: 0, minimumFractionDigits: 0 });
}

/**
 * Formats currency in compact Indian notation (Crores / Lakhs) when explicitly requested.
 * @param {number|string} val - Amount in INR
 * @returns {string} - Formatted compact currency e.g. ₹38.75 Cr or ₹50.00 L
 */
export function formatCompactINR(val) {
  if (val === undefined || val === null || val === "") return "₹0";
  const num = Number(val);
  if (isNaN(num) || num === 0) return "₹0";
  if (Math.abs(num) >= 10000000) {
    return `₹${(num / 10000000).toFixed(2)} Cr`;
  }
  if (Math.abs(num) >= 100000) {
    return `₹${(num / 100000).toFixed(2)} L`;
  }
  return formatINR(num);
}

/**
 * Canonical Date Formatter (DD-MM-YYYY).
 * Formats YYYY-MM-DD string, ISO string, Date object, or Firestore Timestamp into DD-MM-YYYY format.
 *
 * @param {string|Date|object} dateVal - Input date value.
 * @param {string} fallback - String returned if date is missing/invalid. Default: "—".
 * @returns {string} - Formatted DD-MM-YYYY string (e.g., "15-08-2024").
 */
export function formatDateDMY(dateVal, fallback = "—") {
  if (!dateVal) return fallback;

  if (typeof dateVal === "string") {
    const trimmed = dateVal.trim();
    if (!trimmed) return fallback;

    // Fast-path: ISO standard format YYYY-MM-DD
    const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
    if (isoMatch) {
      const year = isoMatch[1];
      const month = isoMatch[2].padStart(2, "0");
      const day = isoMatch[3].padStart(2, "0");
      return `${day}-${month}-${year}`;
    }

    // Fast-path: already DD-MM-YYYY or DD/MM/YYYY
    const dmyMatch = /^(\d{1,2})[-/](\d{1,2})[-/](\d{4})/.exec(trimmed);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
      return `${day}-${month}-${year}`;
    }
  }

  try {
    let d;
    if (dateVal instanceof Date) {
      d = dateVal;
    } else if (dateVal?.seconds) {
      d = new Date(dateVal.seconds * 1000);
    } else {
      d = new Date(dateVal);
    }

    if (isNaN(d.getTime())) return typeof dateVal === "string" ? dateVal : fallback;

    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    return `${day}-${month}-${year}`;
  } catch {
    return typeof dateVal === "string" ? dateVal : fallback;
  }
}

export const formatDDMMYYYY = formatDateDMY;
export const formatDateDDMMYYYY = formatDateDMY;

/**
 * Canonical Date Formatter (DD Month YYYY).
 * Formats YYYY-MM-DD string, ISO string, Date object, or Firestore Timestamp into "DD Month YYYY" (e.g. "18 August 2026").
 *
 * @param {string|Date|object} dateVal - Input date value.
 * @param {string} fallback - String returned if date is missing/invalid. Default: "No date set".
 * @returns {string} - Formatted string (e.g. "18 August 2026").
 */
export function formatDateDDMonthYYYY(dateVal, fallback = "No date set") {
  if (!dateVal) return fallback;
  try {
    let d;
    if (typeof dateVal === "string") {
      const trimmed = dateVal.trim();
      if (!trimmed) return fallback;
      const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})/.exec(trimmed);
      if (isoMatch) {
        d = new Date(Number(isoMatch[1]), Number(isoMatch[2]) - 1, Number(isoMatch[3]));
      } else {
        d = new Date(trimmed);
      }
    } else if (dateVal?.seconds) {
      d = new Date(dateVal.seconds * 1000);
    } else if (dateVal instanceof Date) {
      d = dateVal;
    } else {
      d = new Date(dateVal);
    }

    if (isNaN(d.getTime())) return typeof dateVal === "string" ? dateVal : fallback;

    const months = [
      "January", "February", "March", "April", "May", "June",
      "July", "August", "September", "October", "November", "December"
    ];
    const day = String(d.getDate()).padStart(2, "0");
    const monthName = months[d.getMonth()];
    const year = d.getFullYear();
    return `${day} ${monthName} ${year}`;
  } catch {
    return typeof dateVal === "string" ? dateVal : fallback;
  }
}

/**
 * Calculates total configured workers / categories from canonical Labour Teams.
 * Iterates through every Labour Team and dynamically counts configured worker / category entries.
 *
 * @param {Array} teams - Array of Labour Team records.
 * @returns {number} - Total count of configured labour category/worker entries.
 */
export function calculateTotalWorkers(teams = []) {
  if (!teams || !Array.isArray(teams)) return 0;
  let count = 0;
  teams.forEach(team => {
    if (!team) return;
    if (team.categories) {
      if (Array.isArray(team.categories)) {
        count += team.categories.filter(Boolean).length;
      } else if (typeof team.categories === "object") {
        Object.values(team.categories).forEach(cat => {
          if (!cat) return;
          const membersObj = cat.members && typeof cat.members === "object" ? cat.members : {};
          const memberKeys = Object.keys(membersObj);
          if (memberKeys.length > 0) {
            count += memberKeys.length;
          } else {
            count += 1;
          }
        });
      }
    } else if (Array.isArray(team.labourCategories)) {
      count += team.labourCategories.length;
    } else if (Array.isArray(team.workers)) {
      count += team.workers.length;
    }
  });
  return count;
}

/**
 * Calculates the total number of site assignments across engineers.
 * Every valid engineer -> site assignment is counted separately (an engineer assigned to multiple sites contributes multiple assignments).
 * Reconciles directly with the individual engineer list (e.g. 2 + 1 + 1 + ... = 15).
 * Uses the canonical Site Engineer + Site Assignment data structure.
 *
 * @param {Array} engineers - Array of Site Engineer records
 * @returns {number} - Total count of site assignments across engineers
 */
export function calculateCoveredEngineers(engineers = []) {
  if (!engineers || !Array.isArray(engineers)) return 0;
  return engineers.reduce((total, eng) => {
    if (!eng || !Array.isArray(eng.assignedSites)) return total;
    return total + eng.assignedSites.filter(Boolean).length;
  }, 0);
}

/**
 * Validates whether a given geocode coordinate is within Tamil Nadu, India.
 * @param {number} lat - Latitude
 * @param {number} lng - Longitude
 * @param {object} geocode - Geocode address object returned by reverseGeocodeLatLng
 * @returns {boolean} - true if location is in Tamil Nadu, India, false otherwise
 */
export function verifyTNLocation(lat, lng, geocode) {
  const stateStr = (geocode?.state || "").toLowerCase();
  const countryStr = (geocode?.country || "").toLowerCase();
  const isTamilNadu = stateStr.includes("tamil") && (stateStr.includes("nadu") || stateStr.includes("nādū"));
  const isIndia = countryStr.includes("india");
  const isCoordinateInTN = lat >= 8.08 && lat <= 13.9 && lng >= 76.15 && lng <= 80.3;
  return (isTamilNadu && isIndia) || (geocode?.fullAddress?.startsWith("Lat:") && isCoordinateInTN);
}

/**
 * Checks if coordinates are within the site radius.
 * @param {object} coords - Current device coordinates { latitude, longitude }
 * @param {object} savedLocation - Site saved location { latitude, longitude, address }
 * @param {number} siteRadius - Allowed geofencing radius in meters
 * @returns {object} - Geofence status and details
 */
export function verifySiteGeofence(coords, savedLocation, siteRadius) {
  if (!coords || coords.latitude === undefined || coords.latitude === null) {
    return {
      status: "failed",
      errorType: "GPS_DISABLED",
      message: "GPS Disabled",
      details: "Please turn ON device location"
    };
  }
  if (!savedLocation) {
    return {
      status: "failed",
      errorType: "LOCATION_NOT_SET",
      message: "Location Not Set",
      details: "Site location is not configured. Setup required."
    };
  }
  const distance = calculateDistanceMeters(
    Number(savedLocation.latitude),
    Number(savedLocation.longitude),
    coords.latitude,
    coords.longitude
  );
  const allowedRadius = 50; // Strictly 50 meters for Phase 7
  const isWithinRadius = distance <= allowedRadius;
  if (isWithinRadius) {
    return {
      status: "success",
      distance: Math.round(distance)
    };
  } else {
    return {
      status: "failed",
      errorType: "OUTSIDE_RADIUS",
      message: "Outside Site Radius",
      details: "You are outside the allowed attendance area.",
      distance: Math.round(distance),
      allowedRadius
    };
  }
}

/**
 * Processes materials to derive tracking, delivery, and payment status details.
 * @param {object} mat - Material object
 * @returns {object} - Processed material object with computed fields
 */
export function processMaterialPaymentAndDelivery(mat) {
  if (!mat) return {};
  const normalizedStatus = (mat.status || "").toLowerCase();
  const isApproved = normalizedStatus === "approved" || normalizedStatus === "received" || normalizedStatus === "partial received" || normalizedStatus === "partially received";
  const isPending = normalizedStatus === "pending" || normalizedStatus === "in transit" || normalizedStatus === "awaiting receipt" || !mat.status;
  const isRejected = normalizedStatus === "rejected";

  const isFixedType = mat.materialType === "customer_amount_only" || mat.materialType === "custom" || mat.materialType === "rate_only" || mat.type === "customer_amount_only" || mat.type === "custom" || mat.type === "rate_only";
  const reqQty = mat.requiredQuantity !== undefined && mat.requiredQuantity !== null ? Number(mat.requiredQuantity) : (Number(mat.transferQuantity) || Number(mat.quantity) || (isFixedType ? 1 : 0));
  const ordQty = mat.orderedQuantity !== undefined && mat.orderedQuantity !== null ? Number(mat.orderedQuantity) : reqQty;
  const recQty = isApproved ? (Number(mat.quantity) || (isFixedType ? 1 : 0)) : 0;
  const consumedQty = Number(mat.consumedQuantity) || 0;
  const remainingStock = Math.max(0, recQty - consumedQty);
  
  // Standard prices with precedence to canonical unitPrice / rate
  let unitCost = Number(mat.unitPrice || mat.rate || mat.amount) || 0;
  if (!unitCost && !isFixedType) {
    if (mat.category === "Steel") unitCost = 5000;
    else if (mat.category === "Sand") unitCost = 2500;
    else if (mat.category === "Bricks") unitCost = 10;
    else if (mat.category === "Cement") unitCost = 400;
    else if (mat.category === "Other") unitCost = 1500;
    else unitCost = 500;
  }

  const totalAmount = mat.totalAmount !== undefined && mat.totalAmount !== null 
    ? Number(mat.totalAmount) 
    : (mat.amount !== undefined && mat.amount !== null 
        ? Number(mat.amount) 
        : (isFixedType ? unitCost : recQty * unitCost));

  const paidAmount = Number(mat.paidAmount) || 0;
  const pendingPay = Math.max(0, totalAmount - paidAmount);
  const pendingDel = Math.max(0, reqQty - recQty);

  const cleanName = (mat.materialName || mat.title || "").trim() || (mat.materialType === "customer_amount_only" || mat.type === "customer_amount_only" ? "Customer Amount" : (mat.materialType === "rate_only" || mat.type === "rate_only" ? "Rate Item" : "Material"));
  
  let delStatus = "Fully Delivered";
  if (isRejected) {
    delStatus = "Rejected";
  } else if (normalizedStatus === "in transit" || normalizedStatus === "awaiting receipt") {
    delStatus = "In Transit";
  } else if (normalizedStatus === "received") {
    delStatus = "Fully Delivered";
  } else if (normalizedStatus === "partial received" || normalizedStatus === "partially received") {
    delStatus = "Partial Delivery";
  } else if (isPending) {
    delStatus = "Awaiting Approval";
  } else if (recQty === 0) {
    delStatus = "Pending Delivery";
  } else if (recQty < reqQty) {
    delStatus = "Partial Delivery";
  }

  let payStatus = "Pending Payment";
  if (totalAmount === 0) {
    payStatus = "No Cost / Pending Quote";
  } else if (paidAmount >= totalAmount) {
    payStatus = "Paid";
  } else if (paidAmount > 0 && paidAmount < totalAmount) {
    payStatus = "Partial Payment";
  }

  return {
    ...mat,
    materialName: cleanName,
    requiredQuantity: reqQty,
    orderedQuantity: ordQty,
    receivedQuantity: recQty,
    consumedQuantity: consumedQty,
    remainingStock,
    totalAmount,
    amount: totalAmount,
    paidAmount,
    pendingDelivery: pendingDel,
    pendingPayment: pendingPay,
    deliveryStatus: delStatus,
    paymentStatus: payStatus
  };
}

/**
 * Aggregates materials stats (received, consumed, pending payments) for a site.
 */
export function calculateSiteMaterialStats(siteId, allMaterials = []) {
  const siteMats = allMaterials.filter(m => m.siteId === siteId).map(processMaterialPaymentAndDelivery);
  
  let totalRequests = siteMats.length;
  let pendingRequests = siteMats.filter(m => m.status === "pending" || m.status === "Pending" || !m.status).length;
  
  let receivedValue = 0;
  let totalPaid = 0;
  let totalPendingPayment = 0;
  
  siteMats.forEach(m => {
    receivedValue += m.totalAmount;
    totalPaid += m.paidAmount;
    totalPendingPayment += m.pendingPayment;
  });

  return {
    totalRequests,
    pendingRequests,
    receivedValue,
    totalPaid,
    totalPendingPayment,
    materialsList: siteMats
  };
}

/**
 * Parses and formats progress update percentage.
 * @param {string|number} progress - Progress value
 * @returns {string} - Clean formatted progress string without percentage duplicates
 */
export function formatProgress(progress) {
  if (typeof progress === 'string') {
    return progress.replace(/%/g, '').trim();
  }
  return progress !== undefined ? String(progress).trim() : "0";
}

/**
 * Normalizes request data structure for leave, location, and material requests to display on Approvals dashboard.
 * @param {object} item - Request item
 * @param {string} type - "Leave" | "Location" | "Material"
 * @param {Array} engineers - Site engineers profiles list
 * @returns {object} - Normalized request object
 */
export function normalizeApprovalRequest(item, type, engineers) {
  if (type === "Leave") {
    return {
      id: item.id,
      type: "Leave",
      employeeId: item.engineerId,
      employeeName: item.engineerName,
      requestDate: item.date,
      details: item.reason,
      leaveType: item.leaveType || "Casual",
      days: item.days || 1,
      status: item.status || "approved",
      raw: item
    };
  } else if (type === "Location") {
    const engineer = engineers.find(e => e.id === (item.proposedLocationCapturedBy || item.locationCapturedBy));
    const isPending = item.locationStatus === "Pending Approval";
    return {
      id: item.id,
      type: "Location",
      employeeId: item.proposedLocationCapturedBy || item.locationCapturedBy || "",
      employeeName: engineer ? engineer.fullName : "Unknown Engineer",
      requestDate: (item.proposedLocationCreatedDate || item.locationCreatedDate || "").split("T")[0] || "",
      details: item.siteName,
      address: isPending ? item.proposedLocation : item.location,
      latitude: isPending ? item.proposedLatitude : item.latitude,
      longitude: isPending ? item.proposedLongitude : item.longitude,
      accuracy: isPending ? item.proposedLocationAccuracy : item.locationAccuracy,
      status: item.locationStatus === "Verified" ? "approved" : item.locationStatus === "Pending Approval" ? "pending" : "rejected",
      raw: item
    };
  } else if (type === "Material") {
    return {
      id: item.id,
      type: "Material",
      employeeId: item.engineerId,
      employeeName: item.engineerName,
      requestDate: item.purchaseDate,
      details: `${item.materialName} (${item.category})`,
      quantity: `${item.quantity} ${item.unit || "Unit"}${Number(item.quantity) !== 1 ? "s" : ""}`,
      supplier: item.supplierName,
      invoiceUrl: item.invoiceUrl || "",
      status: item.status === undefined ? "approved" : item.status,
      raw: item
    };
  }
  return item;
}

/**
 * Checks permissions for various roles on different modules.
 * Action: "view" | "create" | "edit" | "approve"
 * Resource: "attendance" | "materials" | "labour" | "payment" | "approvals" | "sites" | "progress" | "engineers" | "assignments"
 */
export function hasPermission(role, action, resource) {
  if (!role) return false;
  
  const normalizedRole = role.toLowerCase().replace(/[\s-]/g, '_');
  
  if (normalizedRole === 'super_admin' || normalizedRole === 'superadmin') {
    return true; // Super Admin has access to all actions/resources
  }
  
  const permissions = {
    admin: {
      view: ["dashboard", "sites", "engineers", "assignments", "approvals", "materials", "labour", "progress", "photos", "activity", "payment", "attendance"],
      create: ["sites", "engineers", "assignments"],
      edit: ["sites", "engineers", "assignments", "materials", "payment"],
      approve: ["leaves", "locations", "materials", "approvals"]
    },
    site_engineer: {
      view: ["dashboard", "sites", "materials", "labour", "progress", "photos", "profile", "attendance"],
      create: ["attendance", "leaves", "materials", "labour", "progress", "photos", "activity", "locations"],
      edit: ["profile", "materials"],
      approve: []
    },
    engineer: {
      view: ["dashboard", "sites", "materials", "labour", "progress", "photos", "profile", "attendance"],
      create: ["attendance", "leaves", "materials", "labour", "progress", "photos", "activity", "locations"],
      edit: ["profile", "materials"],
      approve: []
    },
    supervisor: {
      view: ["dashboard", "sites", "materials", "labour", "progress", "photos"],
      create: ["labour", "progress", "photos"],
      edit: ["labour", "progress"],
      approve: []
    }
  };
  
  const roleRules = permissions[normalizedRole];
  if (!roleRules) return false;
  
  const allowedResources = roleRules[action] || [];
  return allowedResources.includes(resource.toLowerCase());
}

/**
 * Helper to calculate duration in hours and minutes between entry and exit times.
 */
export function getActivityDuration(entry, exit) {
  if (!entry || !exit) return null;
  const entryTime = entry.timestamp?.seconds ? entry.timestamp.seconds * 1000 : (entry.timestamp ? new Date(entry.timestamp).getTime() : 0);
  const exitTime = exit.timestamp?.seconds ? exit.timestamp.seconds * 1000 : (exit.timestamp ? new Date(exit.timestamp).getTime() : 0);
  if (!entryTime || !exitTime) return null;
  const diffMs = exitTime - entryTime;
  if (diffMs < 0) return null;
  const diffHrs = Math.floor(diffMs / (1000 * 60 * 60));
  const diffMins = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
  return `${diffHrs} hrs ${diffMins} mins`;
}

/**
 * Pairs entry and exit activity logs chronologically and calculates duration.
 */
export function pairActivityLogs(logsList) {
  // Group logs by siteId and date
  const groups = {};
  logsList.forEach(log => {
    const key = `${log.siteId}_${log.date}`;
    if (!groups[key]) {
      groups[key] = [];
    }
    groups[key].push(log);
  });

  const processed = [];
  Object.keys(groups).forEach(key => {
    // Sort chronologically ascending
    const groupLogs = groups[key].sort((a, b) => {
      const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return tA - tB;
    });

    // Pair entries and exits
    let entry = null;
    groupLogs.forEach(log => {
      if (log.type === "entry") {
        entry = log;
      } else if (log.type === "exit" && entry) {
        processed.push({
          id: `${entry.id}_${log.id}`,
          date: log.date,
          siteId: log.siteId,
          entryTime: entry.time,
          exitTime: log.time,
          entryAddress: entry.address,
          exitAddress: log.address,
          entryLat: entry.latitude,
          entryLng: entry.longitude,
          exitLat: log.latitude,
          exitLng: log.longitude,
          duration: getActivityDuration(entry, log)
        });
        entry = null;
      } else {
        // Unpaired exit or duplicate exit
        processed.push({
          id: log.id,
          date: log.date,
          siteId: log.siteId,
          type: "exit_only",
          time: log.time,
          address: log.address,
          lat: log.latitude,
          lng: log.longitude
        });
      }
    });

    // If trailing entry with no exit
    if (entry) {
      processed.push({
        id: entry.id,
        date: entry.date,
        siteId: entry.siteId,
        type: "entry_only",
        time: entry.time,
        address: entry.address,
        lat: entry.latitude,
        lng: entry.longitude
      });
    }
  });

  return processed;
}

/**
 * Checks if a site is delayed.
 * Delayed condition: site status is not "Completed" AND expectedEndDate is in the past.
 * @param {object} site - Site object
 * @returns {boolean} - true if site is delayed, false otherwise
 */
export function isSiteDelayed(site) {
  if (site.status === "Completed") return false;
  if (!site.expectedEndDate) return false;
  const todayStr = new Date().toISOString().split("T")[0];
  return site.expectedEndDate < todayStr;
}

/**
 * Computes planned progress milestone linearly between start date and expected end date.
 * @param {string} startDateStr - YYYY-MM-DD
 * @param {string} expectedEndDateStr - YYYY-MM-DD
 * @returns {number} - Planned progress percentage (0 - 100)
 */
export function calculatePlannedProgress(startDateStr, expectedEndDateStr) {
  if (!startDateStr || !expectedEndDateStr) return 0;
  
  const start = new Date(startDateStr).getTime();
  const end = new Date(expectedEndDateStr).getTime();
  const today = new Date().getTime();
  
  if (isNaN(start) || isNaN(end) || end <= start) return 0;
  if (today < start) return 0;
  if (today > end) return 100;
  
  const totalDuration = end - start;
  const elapsed = today - start;
  
  return Math.min(100, Math.round((elapsed / totalDuration) * 100));
}

/**
 * Calculates budget, payments, and expenses for a single site dynamically.
 * Material expenses: sum of received materials unit costs.
 * Labour expenses: daily trade headcount cost sums.
 * Other expenses: 5% of material + labour costs.
 * Total spent: materials + labour + other.
 * Client payments received: computed based on latest progress milestones.
 */
export function getSiteFinancials(site, materials = [], labourHistory = [], progressUpdates = [], labourMaster = {}, generalExpenses = [], labourPayments = []) {
  const ledger = getSiteExpenseLedger(site, materials, labourHistory, generalExpenses, labourPayments, labourMaster);
  
  // Calculate progress percent from progressUpdates
  let progressPercent = 0;
  const siteProgressLogs = progressUpdates.filter(p => p.siteId === site.id);
  if (site.status === "Completed") {
    progressPercent = 100;
  } else if (siteProgressLogs.length > 0) {
    const sortedLogs = [...siteProgressLogs].sort((a, b) => {
      const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tB - tA;
    });
    const latestProgressStr = sortedLogs[0].progress || sortedLogs[0].completionPercent || "0";
    progressPercent = Number(latestProgressStr.toString().replace(/%/g, '')) || 0;
  }

  const paymentsReceived = Math.round(ledger.totalBudget * (progressPercent / 100));
  const remainingBalance = Math.max(0, ledger.totalBudget - paymentsReceived);

  return {
    budget: ledger.totalBudget,
    paymentsReceived,
    materialExpenses: ledger.materialExpenseTotal,
    labourExpenses: ledger.labourExpenseTotal,
    otherExpenses: ledger.siteExpenseTotal + ledger.otherExpenseTotal,
    totalSpent: ledger.totalExpenses,
    remainingBalance,
    pendingAmount: ledger.pendingPayments,
    progressPercent
  };
}

/**
 * Aggregates overall financials across all sites.
 */
export function calculateOverallFinancials(sites = [], allMaterials = [], allLabourHistory = [], allProgressUpdates = [], labourMaster = {}, generalExpenses = [], labourPayments = []) {
  let totalSites = sites.length;
  let activeSites = 0;
  let completedSites = 0;
  let delayedSites = 0;
  
  let totalProjectValue = 0;
  let totalPaymentsReceived = 0;
  let totalExpenses = 0;
  let pendingPayments = 0;
  let progressSum = 0;

  // Pre-index collections by siteId for O(1) lookups during multi-site aggregation
  const materialsBySite = new Map();
  (allMaterials || []).forEach(m => {
    if (m && m.siteId) {
      if (!materialsBySite.has(m.siteId)) materialsBySite.set(m.siteId, []);
      materialsBySite.get(m.siteId).push(m);
    }
  });

  const progressBySite = new Map();
  (allProgressUpdates || []).forEach(p => {
    if (p && p.siteId) {
      if (!progressBySite.has(p.siteId)) progressBySite.set(p.siteId, []);
      progressBySite.get(p.siteId).push(p);
    }
  });

  const expensesBySite = new Map();
  (generalExpenses || []).forEach(e => {
    if (e && e.siteId) {
      if (!expensesBySite.has(e.siteId)) expensesBySite.set(e.siteId, []);
      expensesBySite.get(e.siteId).push(e);
    }
  });

  const labourPaymentsBySite = new Map();
  (labourPayments || []).forEach(lp => {
    if (lp && lp.siteId) {
      if (!labourPaymentsBySite.has(lp.siteId)) labourPaymentsBySite.set(lp.siteId, []);
      labourPaymentsBySite.get(lp.siteId).push(lp);
    }
  });

  const isLabourHistoryArray = Array.isArray(allLabourHistory);
  const labourHistoryBySite = new Map();
  if (isLabourHistoryArray) {
    allLabourHistory.forEach(lh => {
      if (lh && lh.siteId) {
        if (!labourHistoryBySite.has(lh.siteId)) labourHistoryBySite.set(lh.siteId, []);
        labourHistoryBySite.get(lh.siteId).push(lh);
      }
    });
  }
  
  sites.forEach(site => {
    if (site.status === "Completed") {
      completedSites++;
    } else if (site.status !== "Planning") {
      activeSites++;
    }
    
    if (isSiteDelayed(site)) {
      delayedSites++;
    }

    const siteMats = materialsBySite.get(site.id) || [];
    const siteProgress = progressBySite.get(site.id) || [];
    const siteExpenses = expensesBySite.get(site.id) || [];
    const sitePayments = labourPaymentsBySite.get(site.id) || [];
    const siteLabour = isLabourHistoryArray 
      ? (labourHistoryBySite.get(site.id) || [])
      : ((allLabourHistory && allLabourHistory[site.id]) || []);
    
    const financials = getSiteFinancials(site, siteMats, siteLabour, siteProgress, labourMaster, siteExpenses, sitePayments);
    totalProjectValue += financials.budget;
    totalPaymentsReceived += financials.paymentsReceived;
    totalExpenses += financials.totalSpent;
    pendingPayments += financials.pendingAmount;
    progressSum += financials.progressPercent;
  });
  
  const overallProgressPercent = totalSites > 0 ? Math.round(progressSum / totalSites) : 0;
  
  return {
    totalSites,
    activeSites,
    completedSites,
    delayedSites,
    totalProjectValue,
    totalPaymentsReceived,
    totalExpenses,
    overallProgressPercent
  };
}

export const LABOUR_TAMIL_TRANSLATIONS = {
  "Mason": "மேஸ்திரி",
  "Helper": "உதவியாளர்",
  "Carpenter": "தச்சர்",
  "Electrician": "எலக்ட்ரீஷியன்",
  "Plumber": "குழாய் பதிப்பாளர்",
  "Painter": "வண்ணப்பூச்சு செய்பவர்",
  "Other": "மற்றவை"
};

/**
 * Gets category name with Tamil meaning in brackets for display.
 */
export function getLabourDisplayName(category) {
  if (!category) return "";
  const translation = LABOUR_TAMIL_TRANSLATIONS[category];
  return translation ? `${category} (${translation})` : category;
}

/**
 * Reconciles daily counts work duration costs with logged payments.
 */
export function calculateLabourFinancials(siteId, labourHistory = [], labourMaster = {}, paymentsList = []) {
  let totalCost = 0;
  
  labourHistory.forEach(row => {
    if (row.memberId !== undefined) {
      // New member-level attendance record
      totalCost += (Number(row.wage) || 0) * (Number(row.units) || 0);
    } else {
      // Legacy headcount logic
      Object.keys(row).forEach(key => {
        if (key === "date" || key === "total" || key === "engineerId" || key === "id" || key === "siteId") return;
        
        let masterKey = key;
        if (key === "Masons") masterKey = "Mason";
        if (key === "Helpers") masterKey = "Helper";
        if (key === "Painters") masterKey = "Painter";
        if (key === "Plumbers") masterKey = "Plumber";
        if (key === "Electricians") masterKey = "Electrician";
        if (key === "Others") masterKey = "Other";
        
        const count = Number(row[key]) || 0;
        const rateObj = labourMaster[masterKey] || { wage: 500 }; 
        const rate = Number(rateObj.wage) || 0;
        
        totalCost += count * rate;
      });
    }
  });
  
  const sitePayments = paymentsList.filter(p => p.siteId === siteId);
  const paidAmount = sitePayments.reduce((acc, p) => acc + (Number(p.amount) || 0), 0);
  const pendingAmount = Math.max(0, totalCost - paidAmount);
  
  return {
    totalCost,
    paidAmount,
    pendingAmount,
    paymentsHistory: sitePayments.sort((a, b) => b.date.localeCompare(a.date))
  };
}

/**
 * Automatically aggregates daily updates into weekly reports.
 */
export function generateWeeklyReportFromDprs(dprs = []) {
  if (dprs.length === 0) return [];
  
  // Sort chronologically ascending
  const sorted = [...dprs].sort((a, b) => {
    const dateA = a.date || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
    const dateB = b.date || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
    return dateA.localeCompare(dateB);
  });
  
  const getWeekKey = (dateStr) => {
    if (!dateStr) return "Unknown Week";
    const date = new Date(dateStr);
    const firstDayOfYear = new Date(date.getFullYear(), 0, 1);
    const pastDaysOfYear = (date - firstDayOfYear) / 86400000;
    const weekNumber = Math.ceil((pastDaysOfYear + firstDayOfYear.getDay() + 1) / 7);
    return `${date.getFullYear()}-W${weekNumber}`;
  };

  const weeksMap = {};
  sorted.forEach(dpr => {
    const dprDate = dpr.date || (dpr.createdAt?.seconds ? new Date(dpr.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
    const weekKey = getWeekKey(dprDate);
    
    if (!weeksMap[weekKey]) {
      weeksMap[weekKey] = {
        weekKey,
        dprs: [],
        startDate: dprDate,
        endDate: dprDate
      };
    }
    
    weeksMap[weekKey].dprs.push(dpr);
    if (dprDate < weeksMap[weekKey].startDate) weeksMap[weekKey].startDate = dprDate;
    if (dprDate > weeksMap[weekKey].endDate) weeksMap[weekKey].endDate = dprDate;
  });

  const weeklyReports = [];
  const weekKeys = Object.keys(weeksMap).sort().reverse();

  weekKeys.forEach(key => {
    const { dprs: weekDprs, startDate, endDate } = weeksMap[key];
    const weekSorted = [...weekDprs].sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return dateA.localeCompare(dateB);
    });

    const firstDpr = weekSorted[0];
    const lastDpr = weekSorted[weekSorted.length - 1];

    const firstProgress = Number(String(firstDpr.progress).replace(/%/g, '')) || 0;
    const lastProgress = Number(String(lastDpr.progress).replace(/%/g, '')) || 0;
    const progressChange = lastProgress - firstProgress;
    
    const completedList = weekSorted.map(d => d.completedToday || d.description).filter(Boolean);
    const completedWork = [...new Set(completedList)].join("; ");

    const problemsList = weekSorted.map(d => d.problemsFaced).filter(Boolean);
    const delayReasons = [...new Set(problemsList)].join("; ") || "No major issues faced";

    const pendingList = weekSorted.map(d => d.pendingWork).filter(Boolean);
    const pendingActivities = [...new Set(pendingList)].join("; ") || "None";

    weeklyReports.push({
      weekLabel: `Week ${key} (${startDate} to ${endDate})`,
      startDate,
      endDate,
      startProgress: firstProgress,
      endProgress: lastProgress,
      progressChange,
      completedWork: completedWork || "No detailed work logged",
      pendingActivities,
      delayReasons
    });
  });

  return weeklyReports;
}

/**
 * Consolidates all expenses and payouts across materials, labour, and general expenses for a site.
 */
export function getSiteExpenseLedger(site, materials = [], labourHistory = [], generalExpenses = [], labourPayments = [], labourMaster = {}) {
  if (!site) {
    return {
      expenses: [],
      payments: [],
      materialExpenseTotal: 0,
      materialPaidTotal: 0,
      labourExpenseTotal: 0,
      labourPaidTotal: 0,
      siteExpenseTotal: 0,
      otherExpenseTotal: 0,
      generalPaidTotal: 0,
      budget: 0,
      totalExpenses: 0,
      totalPayments: 0,
      balance: 0,
      percentSpent: 0
    };
  }
  // 1. Budget retrieve (single source of truth)
  const budget = getSiteBudget(site);

  const expenses = [];
  const payments = [];

  let materialExpenseTotal = 0;
  let materialPaidTotal = 0;
  let labourExpenseTotal = 0;
  let labourPaidTotal = 0;
  let siteExpenseTotal = 0;
  let otherExpenseTotal = 0;
  let generalPaidTotal = 0;

  // Compile materials
  const siteMaterials = materials.filter(m => m.siteId === site.id);
  siteMaterials.forEach(m => {
    const isApproved = m.status === "approved" || m.status === "Approved" || m.status === undefined;
    if (isApproved) {
      // Determine cost
      let cost = 0;
      if (m.totalAmount !== undefined && m.totalAmount !== null) {
        cost = Number(m.totalAmount) || 0;
      } else {
        let unitCost = 500;
        if (m.category === "Steel") unitCost = 5000;
        else if (m.category === "Sand") unitCost = 2500;
        else if (m.category === "Bricks") unitCost = 10;
        else if (m.category === "Cement") unitCost = 400;
        else if (m.category === "Other") unitCost = 1500;
        cost = (Number(m.quantity) || 0) * unitCost;
      }
      materialExpenseTotal += cost;

      expenses.push({
        id: m.id,
        type: "Expense",
        category: "Material Expense",
        name: m.materialName,
        date: m.purchaseDate || "--",
        amount: cost,
        description: `Supplier: ${m.supplierName || "Direct Invoice"} • ${m.notes || ""}`,
        status: "Approved"
      });

      // Payments from paymentHistory
      if (m.paymentHistory && m.paymentHistory.length > 0) {
        m.paymentHistory.forEach(p => {
          materialPaidTotal += p.amount;
          payments.push({
            id: p.id,
            type: "Payment",
            category: "Material Payment",
            name: m.materialName,
            date: p.date,
            amount: p.amount,
            reference: p.reference,
            notes: p.notes
          });
        });
      } else {
        // Fallback backward compatibility paidAmount
        const pAmt = Number(m.paidAmount) || 0;
        if (pAmt > 0) {
          materialPaidTotal += pAmt;
          payments.push({
            id: `pay_fallback_${m.id}`,
            type: "Payment",
            category: "Material Payment",
            name: m.materialName,
            date: m.purchaseDate || "--",
            amount: pAmt,
            reference: "Legacy direct payment",
            notes: ""
          });
        }
      }
    } else if (m.status === "pending" || m.status === "Pending" || !m.status) {
      // Pending requisition
      expenses.push({
        id: m.id,
        type: "Expense",
        category: "Material Requisition",
        name: m.materialName,
        date: m.purchaseDate || "--",
        amount: Number(m.requiredQuantity || m.quantity) * 400, // fallback value
        description: `Requested by engineer • Notes: ${m.notes || ""}`,
        status: "Pending"
      });
    }
  });

  // Compile labour expenses from headcounts and member-level attendance records
  const siteLabour = labourHistory.filter(l => l.siteId === site.id);
  siteLabour.forEach(l => {
    if (l.memberId !== undefined || l.categoryId !== undefined || l.units !== undefined) {
      const count = Number(l.workerCount) || 1;
      const units = l.units !== undefined && l.units !== null && !isNaN(Number(l.units))
        ? Number(l.units)
        : (count * (l.workUnit !== undefined ? Number(l.workUnit) : (l.attendanceType === "Half Day" ? 0.5 : 1.0)));
      const wage = Number(l.wage) || 0;
      const cost = wage > 0 ? (units * wage) : 0;
      labourExpenseTotal += cost;
      if (cost > 0) {
        expenses.push({
          id: l.id || `labour_${l.memberId || l.categoryId}_${l.date || l.attendanceDate}`,
          type: "Expense",
          category: "Labour Expense",
          name: `${l.memberName || l.categoryName || 'Worker'} (${units} units)`,
          date: l.date || l.attendanceDate,
          amount: cost,
          description: `Labour Attendance: ${units} unit(s) @ ₹${wage}/unit`,
          status: "Approved"
        });
      }
    } else {
      // Legacy headcount logic
      let dayCost = 0;
      Object.keys(l).forEach(key => {
        if (key === "date" || key === "total" || key === "engineerId" || key === "id" || key === "siteId") return;
        let masterKey = key;
        if (key === "Masons") masterKey = "Mason";
        if (key === "Helpers") masterKey = "Helper";
        if (key === "Painters") masterKey = "Painter";
        if (key === "Plumbers") masterKey = "Plumber";
        if (key === "Electricians") masterKey = "Electrician";
        if (key === "Others") masterKey = "Other";

        const count = Number(l[key]) || 0;
        const rateObj = labourMaster[masterKey] || {};
        let rate = Number(rateObj.wage);
        if (isNaN(rate)) {
          if (masterKey === "Mason") rate = 800;
          else if (masterKey === "Helper") rate = 500;
          else if (masterKey === "Electrician") rate = 700;
          else if (masterKey === "Plumber") rate = 700;
          else if (masterKey === "Painter") rate = 700;
          else rate = 600;
        }
        dayCost += count * rate;
      });

      labourExpenseTotal += dayCost;
      if (dayCost > 0) {
        expenses.push({
          id: l.id || `labour_legacy_${l.date}`,
          type: "Expense",
          category: "Labour Expense",
          name: `${l.total || 0} Workers Headcount (Legacy)`,
          date: l.date,
          amount: dayCost,
          description: "Daily payroll headcount accrual",
          status: "Approved"
        });
      }
    }
  });

  // Compile labour payments
  const siteLabourPayments = labourPayments.filter(p => p.siteId === site.id);
  siteLabourPayments.forEach(p => {
    labourPaidTotal += p.amount;
    payments.push({
      id: p.id,
      type: "Payment",
      category: "Labour Payment",
      name: "Labour Wages",
      date: p.date,
      amount: p.amount,
      reference: p.reference || "Direct reference",
      notes: p.notes
    });
  });

  // Compile general expenses
  const siteGenExpenses = generalExpenses.filter(g => g.siteId === site.id);
  siteGenExpenses.forEach(g => {
    const isApproved = g.status === "Approved" || g.status === "approved";
    if (isApproved) {
      if (g.category === "Site Expense") siteExpenseTotal += g.amount;
      else otherExpenseTotal += g.amount;

      expenses.push({
        id: g.id,
        type: "Expense",
        category: g.category,
        name: g.description,
        date: g.date,
        amount: g.amount,
        description: g.notes || "None",
        status: "Approved"
      });

      // Payments made
      if (g.paymentHistory && g.paymentHistory.length > 0) {
        g.paymentHistory.forEach(p => {
          generalPaidTotal += p.amount;
          payments.push({
            id: p.id,
            type: "Payment",
            category: `${g.category} Payment`,
            name: g.description,
            date: p.date,
            amount: p.amount,
            reference: p.reference,
            notes: p.notes
          });
        });
      } else {
        const pAmt = Number(g.paidAmount) || 0;
        if (pAmt > 0) {
          generalPaidTotal += pAmt;
          payments.push({
            id: `pay_fallback_${g.id}`,
            type: "Payment",
            category: `${g.category} Payment`,
            name: g.description,
            date: g.date,
            amount: pAmt,
            reference: "Legacy payment log",
            notes: ""
          });
        }
      }
    } else if (g.status === "Pending" || g.status === "pending") {
      expenses.push({
        id: g.id,
        type: "Expense",
        category: g.category,
        name: g.description,
        date: g.date,
        amount: g.amount,
        description: `Awaiting approval • Notes: ${g.notes || ""}`,
        status: "Pending"
      });
    }
  });

  const totalExpenses = materialExpenseTotal + labourExpenseTotal + siteExpenseTotal + otherExpenseTotal;
  const totalPayments = materialPaidTotal + labourPaidTotal + generalPaidTotal;
  const pendingPayments = Math.max(0, totalExpenses - totalPayments);
  const remainingBalance = Math.max(0, budget - totalExpenses);

  return {
    totalBudget: budget,
    totalExpenses,
    totalPayments,
    pendingPayments,
    remainingBalance,
    materialExpenseTotal,
    labourExpenseTotal,
    siteExpenseTotal,
    otherExpenseTotal,
    materialPaidTotal,
    labourPaidTotal,
    generalPaidTotal,
    expensesList: expenses.sort((a, b) => b.date.localeCompare(a.date)),
    paymentsHistory: payments.sort((a, b) => b.date.localeCompare(a.date))
  };
}

/**
 * Automatically aggregates daily updates into monthly reports.
 */
export function generateMonthlyReportFromDprs(dprs = []) {
  if (dprs.length === 0) return [];
  
  // Sort chronologically ascending
  const sorted = [...dprs].sort((a, b) => {
    const dateA = a.date || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
    const dateB = b.date || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
    return dateA.localeCompare(dateB);
  });
  
  const getMonthKey = (dateStr) => {
    if (!dateStr) return "Unknown Month";
    return dateStr.substring(0, 7); // YYYY-MM
  };

  const monthsMap = {};
  sorted.forEach(dpr => {
    const dprDate = dpr.date || (dpr.createdAt?.seconds ? new Date(dpr.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
    const monthKey = getMonthKey(dprDate);
    
    if (!monthsMap[monthKey]) {
      monthsMap[monthKey] = {
        monthKey,
        dprs: [],
        startDate: dprDate,
        endDate: dprDate
      };
    }
    
    monthsMap[monthKey].dprs.push(dpr);
    if (dprDate < monthsMap[monthKey].startDate) monthsMap[monthKey].startDate = dprDate;
    if (dprDate > monthsMap[monthKey].endDate) monthsMap[monthKey].endDate = dprDate;
  });

  const monthlyReports = [];
  const monthKeys = Object.keys(monthsMap).sort().reverse();

  monthKeys.forEach(key => {
    const { dprs: monthDprs, startDate, endDate } = monthsMap[key];
    const monthSorted = [...monthDprs].sort((a, b) => {
      const dateA = a.date || "";
      const dateB = b.date || "";
      return dateA.localeCompare(dateB);
    });

    const firstDpr = monthSorted[0];
    const lastDpr = monthSorted[monthSorted.length - 1];

    const firstProgress = Number(String(firstDpr.progress).replace(/%/g, '')) || 0;
    const lastProgress = Number(String(lastDpr.progress).replace(/%/g, '')) || 0;
    const progressChange = lastProgress - firstProgress;
    
    const completedList = monthSorted.map(d => d.completedToday || d.description).filter(Boolean);
    const completedWork = [...new Set(completedList)].join("; ");

    const problemsList = monthSorted.map(d => d.problemsFaced).filter(Boolean);
    const delayReasons = [...new Set(problemsList)].join("; ") || "No major issues faced";

    const pendingList = monthSorted.map(d => d.pendingWork).filter(Boolean);
    const pendingActivities = [...new Set(pendingList)].join("; ") || "None";

    let monthLabel = key;
    try {
      const [year, month] = key.split("-").map(Number);
      const dateObj = new Date(year, month - 1, 1);
      monthLabel = dateObj.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
    } catch(e) {}

    monthlyReports.push({
      monthLabel,
      startDate,
      endDate,
      startProgress: firstProgress,
      endProgress: lastProgress,
      progressChange,
      completedWork: completedWork || "No detailed work logged",
      pendingActivities,
      delayReasons
    });
  });

  return monthlyReports;
}

/**
 * Computes canonical pending items summary across materials, transfers, expenses, labour payouts, and DPRs.
 */
export function computeSitePendingItemsSummary(siteId, materials = [], transfers = [], expenses = [], labourHistory = [], labourPayments = [], progressUpdates = []) {
  const todayStr = new Date().toISOString().split("T")[0];

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
    (t.sourceSiteId === siteId || t.destinationSiteId === siteId || t.siteId === siteId) &&
    (t.status === "Pending" || t.status === "In Transit" || t.status === "Partial Received")
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

  // 5. DPR check
  const siteProgress = (progressUpdates || []).filter(p => p.siteId === siteId);
  const hasDprToday = siteProgress.some(p => p.date === todayStr);

  const totalPendingCount = pendingDeliveries.length + pendingTransfers.length + pendingExpenses.length + (netPayableLabour > 0 ? 1 : 0);

  return {
    pendingDeliveries,
    pendingTransfers,
    pendingExpenses,
    netPayableLabour,
    grossLabour,
    advances,
    hasDprToday,
    totalPendingCount,
    hasPendingItems: totalPendingCount > 0
  };
}



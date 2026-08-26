import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  limit,
  doc
} from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import { 
  MapPin, 
  Users, 
  ClipboardCheck, 
  Package, 
  Building2, 
  Activity, 
  Clock, 
  Calendar, 
  AlertTriangle, 
  CheckCircle2, 
  Filter, 
  Eye, 
  FolderOpen, 
  HardHat, 
  ArrowRight, 
  ChevronRight, 
  TrendingUp, 
  Search, 
  Bell, 
  Briefcase, 
  FileText, 
  DollarSign, 
  ExternalLink, 
  UserCheck, 
  Navigation, 
  Maximize2, 
  ShieldCheck, 
  X
} from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import { Link } from "react-router-dom";
import { 
  deduplicateDailyAttendance, 
  isEngineerAttendanceRecord, 
  subscribeAllLabourAttendance, 
  subscribeGeneralExpenses,
  subscribeCanonicalEngineers,
  resolveEngineerIdentity
} from "../services/firebaseService";
import { formatINR, resolveLabourRecordCalculations } from "../services/businessLogic";

// Universal date string normalizer to ISO 'YYYY-MM-DD'
const normalizeToISODate = (val) => {
  if (!val) return "";
  if (typeof val === "string") {
    const s = val.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
    if (s.includes("T")) return s.split("T")[0];
    const partsSlash = s.split("/");
    if (partsSlash.length === 3) {
      if (partsSlash[0].length === 4) return `${partsSlash[0]}-${String(partsSlash[1]).padStart(2, '0')}-${String(partsSlash[2]).padStart(2, '0')}`;
      return `${partsSlash[2]}-${String(partsSlash[1]).padStart(2, '0')}-${String(partsSlash[0]).padStart(2, '0')}`;
    }
    const partsHyphen = s.split("-");
    if (partsHyphen.length === 3 && partsHyphen[2].length === 4) {
      return `${partsHyphen[2]}-${String(partsHyphen[1]).padStart(2, '0')}-${String(partsHyphen[0]).padStart(2, '0')}`;
    }
    const parsed = new Date(s);
    if (!isNaN(parsed.getTime())) {
      const year = parsed.getFullYear();
      const month = String(parsed.getMonth() + 1).padStart(2, '0');
      const day = String(parsed.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
    return s;
  }
  if (typeof val === "number") {
    const d = new Date(val);
    if (!isNaN(d.getTime())) return d.toISOString().split("T")[0];
  }
  if (val instanceof Date) {
    if (!isNaN(val.getTime())) {
      const year = val.getFullYear();
      const month = String(val.getMonth() + 1).padStart(2, '0');
      const day = String(val.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  if (typeof val === "object") {
    if (typeof val.toDate === "function") {
      try {
        const d = val.toDate();
        const year = d.getFullYear();
        const month = String(d.getMonth() + 1).padStart(2, '0');
        const day = String(d.getDate()).padStart(2, '0');
        return `${year}-${month}-${day}`;
      } catch (e) {}
    }
    if (typeof val.seconds === "number") {
      const d = new Date(val.seconds * 1000);
      const year = d.getFullYear();
      const month = String(d.getMonth() + 1).padStart(2, '0');
      const day = String(d.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    }
  }
  return "";
};

const isTodayRecord = (dateVal, createdAtVal, todayKeys) => {
  const normDate = normalizeToISODate(dateVal);
  if (normDate && todayKeys.includes(normDate)) return true;
  const normCreated = normalizeToISODate(createdAtVal);
  if (normCreated && todayKeys.includes(normCreated)) return true;
  return false;
};

export default function AdminDashboard() {
  const { user } = useAuth();
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [engineersLookup, setEngineersLookup] = useState({});
  const [rawAttendance, setRawAttendance] = useState([]);
  const [rawLabourAttendance, setRawLabourAttendance] = useState([]);
  const [rawLegacyLabour, setRawLegacyLabour] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rawWorkers, setRawWorkers] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [rawReports, setRawReports] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  
  // Attendance Activity Filter States
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [attendanceSiteFilter, setAttendanceSiteFilter] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all"); // 'all' | 'onsite' | 'checkout'
  const [selectedInspectRecord, setSelectedInspectRecord] = useState(null);
  const [showTodayAttendanceModal, setShowTodayAttendanceModal] = useState(false);

  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Canonical Today Date Keys (UTC, Indian Standard Time, and local timezone date)
  const todayDateKeys = useMemo(() => {
    const now = new Date();
    const utcDate = now.toISOString().split("T")[0];
    let istDate = utcDate;
    try {
      istDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(now);
    } catch (e) {}

    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const localDate = `${year}-${month}-${day}`;

    return Array.from(new Set([utcDate, istDate, localDate].filter(Boolean)));
  }, []);

  const formattedTodayDate = useMemo(() => {
    try {
      return new Date().toLocaleDateString("en-IN", { 
        timeZone: "Asia/Kolkata", 
        weekday: "long", 
        day: "numeric", 
        month: "short", 
        year: "numeric" 
      });
    } catch (e) {
      return new Date().toDateString();
    }
  }, []);

  useEffect(() => {
    const db = getFirebaseDb();
    setLoading(true);

    let sitesLoaded = false;
    let engineersLoaded = false;

    const checkLoadingComplete = () => {
      if (sitesLoaded && engineersLoaded) {
        setLoading(false);
      }
    };

    // 1. Sites Listener (Shared canonical dataset across all authorized Admins)
    const unsubSites = onSnapshot(collection(db, "sites"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSites(list);
      sitesLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Sites listener error:", err);
      sitesLoaded = true;
      checkLoadingComplete();
    });

    // 2. Canonical Engineers Unified Listener (merges siteEngineers, users, siteAssignments)
    const unsubEngineers = subscribeCanonicalEngineers((list, map) => {
      setEngineers(list || []);
      setEngineersLookup(map || {});
      engineersLoaded = true;
      checkLoadingComplete();
    });

    // 3. Single Data Source: Attendance Real-Time Listener
    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawAttendance(list);
    }, (err) => {
      console.error("Attendance listener error on Admin Dashboard:", err);
    });

    // 4. Materials Listener (Excluding lock / metadata docs)
    const unsubMaterials = onSnapshot(collection(db, "materials"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id.startsWith("lock_") || docSnap.id.startsWith("material_lock_") || docSnap.id === "__material_master__" || data.type === "material_lock" || data.type === "labour_attendance_lock") {
          return;
        }
        list.push({ id: docSnap.id, ...data });
      });
      setRawMaterials(list);
    }, (err) => {
      console.error("Materials listener error:", err);
    });

    // 5. Labour Attendance Listener (Canonical Member-Level and Category Count Records)
    const unsubLabourAtt = subscribeAllLabourAttendance((list) => {
      setRawLabourAttendance(list || []);
    });

    // 5b. Legacy Site Labour Entries Listener (Fallback)
    const unsubLegacyLabour = onSnapshot(collection(db, "siteLabourEntries"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id.startsWith("labour_lock_") || data.type === "labour_attendance_lock") return;
        list.push({ id: docSnap.id, ...data });
      });
      setRawLegacyLabour(list);
    }, (err) => {
      console.warn("siteLabourEntries listener notice:", err);
    });

    // 5c. Teams / Roster Listener (Shared canonical dataset across all Admins)
    const unsubWorkers = onSnapshot(collection(db, "labourTeams"), (snapshot) => {
      const flattenedWorkers = [];
      snapshot.forEach(docSnap => {
        const team = docSnap.data();
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            if (cat.members) {
              Object.keys(cat.members).forEach(memberId => {
                const mem = cat.members[memberId];
                flattenedWorkers.push({
                  id: mem.memberId || `${docSnap.id}_${memberId}`,
                  workerName: mem.name,
                  category: cat.name,
                  teamName: team.teamName,
                  adminId: team.adminId
                });
              });
            }
          });
        }
      });
      setRawWorkers(flattenedWorkers);
    }, (err) => {
      console.error("Labour teams listener error on Dashboard:", err);
    });

    // 6. System Activities Listener
    const qSys = query(collection(db, "activities"), limit(50));
    const unsubSys = onSnapshot(qSys, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSystemActivities(list);
    }, (err) => {
      console.error("System activities listener error:", err);
    });

    // 7. Approvals Listener
    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setApprovals(list);
    }, (err) => {
      console.error("Approvals listener error:", err);
    });

    // 8. Documents Listener
    const unsubDocuments = onSnapshot(collection(db, "documents"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDocuments(list);
    }, (err) => {
      console.error("Documents listener error:", err);
    });

    // 9. Reports (DPRs) Listener
    const unsubReports = onSnapshot(collection(db, "reports"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawReports(list);
    }, (err) => {
      console.warn("Reports listener notice:", err);
    });

    // 10. General Expenses Listener (Single Canonical Subscription with Fallback Merging)
    const unsubExpenses = subscribeGeneralExpenses((expensesList) => {
      setRawExpenses(expensesList || []);
    });

    return () => {
      unsubSites();
      unsubEngineers();
      unsubAttendance();
      unsubMaterials();
      unsubLabourAtt();
      unsubLegacyLabour();
      unsubWorkers();
      unsubSys();
      unsubApprovals();
      unsubDocuments();
      unsubReports();
      unsubExpenses();
    };
  }, [user]);

  // Single Source of Truth: Canonical Today's Engineer Attendance List
  const todayAttendanceList = useMemo(() => {
    const todaySet = new Set(todayDateKeys);
    
    // 1. Deduplicate via canonical service function (filters non-engineer records and duplicate entries)
    const deduplicated = deduplicateDailyAttendance(rawAttendance);

    // 2. Filter for today's date
    const todayRecords = deduplicated.filter(r => {
      const d = r.date || r.attendanceDate;
      return d && todaySet.has(d);
    });

    // 3. Enrich with live engineer & site details
    return todayRecords.map(rec => {
      const engId = rec.engineerId || rec.userId;
      const engineer = engineers.find(e => e.id === engId || e.uid === engId);
      const site = sites.find(s => s.id === rec.siteId);

      const checkInTime = rec.time || (rec.checkInTime?.seconds 
        ? new Date(rec.checkInTime.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
        : (rec.timestamp?.seconds 
            ? new Date(rec.timestamp.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
            : "--"));

      const checkOutTime = rec.checkOutTime?.seconds 
        ? new Date(rec.checkOutTime.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) 
        : (rec.checkOutTime ? String(rec.checkOutTime) : null);

      const isCheckedOut = rec.status === "checked_out" || !!checkOutTime;
      const isVerified = rec.verificationStatus === "verified" || rec.verificationStatus === "success" || rec.status === "present" || rec.status === "checked_out";

      return {
        ...rec,
        resolvedEngineerId: engId,
        engineerName: engineer?.fullName || engineer?.name || rec.engineerName || "Site Engineer",
        engineerEmail: engineer?.email || "",
        engineerPhone: engineer?.phone || engineer?.mobile || "",
        engineerAvatar: engineer?.photoUrl || engineer?.avatarUrl || null,
        resolvedSiteId: rec.siteId,
        siteName: site?.siteName || rec.siteName || "Assigned Site",
        clientName: site?.clientName || "",
        siteLocation: site?.location || site?.city || "",
        checkInTimeFormatted: checkInTime,
        checkOutTimeFormatted: checkOutTime,
        isCheckedOut,
        isVerified,
        photoUrl: rec.photoUrl || rec.checkInPhotoUrl || null,
        checkOutPhotoUrl: rec.checkOutPhotoUrl || null,
        distance: rec.distance !== undefined && rec.distance !== null ? Number(rec.distance) : null,
        gpsAccuracy: rec.gpsAccuracy ? Number(rec.gpsAccuracy) : null,
        addressDisplay: rec.address && rec.address !== "GPS Captured" 
          ? rec.address 
          : (rec.latitude && rec.longitude ? `${Number(rec.latitude).toFixed(5)}, ${Number(rec.longitude).toFixed(5)}` : "GPS Captured")
      };
    }).sort((a, b) => {
      const tA = a.checkInTime?.seconds ? a.checkInTime.seconds * 1000 : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0));
      const tB = b.checkInTime?.seconds ? b.checkInTime.seconds * 1000 : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0));
      return tB - tA;
    });
  }, [rawAttendance, todayDateKeys, engineers, sites]);

  // Filtered Today Attendance based on search and tab selections
  const filteredTodayAttendance = useMemo(() => {
    return todayAttendanceList.filter(rec => {
      // 1. Site filter
      if (attendanceSiteFilter && rec.resolvedSiteId !== attendanceSiteFilter) {
        return false;
      }
      // 2. Status filter
      if (attendanceStatusFilter === "onsite" && rec.isCheckedOut) {
        return false;
      }
      if (attendanceStatusFilter === "checkout" && !rec.isCheckedOut) {
        return false;
      }
      // 3. Search query
      if (attendanceSearchQuery.trim()) {
        const q = attendanceSearchQuery.toLowerCase().trim();
        const matchName = (rec.engineerName || "").toLowerCase().includes(q);
        const matchEmail = (rec.engineerEmail || "").toLowerCase().includes(q);
        const matchPhone = (rec.engineerPhone || "").toLowerCase().includes(q);
        const matchSite = (rec.siteName || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone && !matchSite) return false;
      }
      return true;
    });
  }, [todayAttendanceList, attendanceSiteFilter, attendanceStatusFilter, attendanceSearchQuery]);

  // Derived KPI Metrics
  const activeEngineersCount = useMemo(() => {
    return engineers.filter(e => e.status === "active").length || engineers.length;
  }, [engineers]);

  const presentCount = todayAttendanceList.length;
  const onSiteCount = todayAttendanceList.filter(r => !r.isCheckedOut).length;
  const checkedOutCount = todayAttendanceList.filter(r => r.isCheckedOut).length;
  const verifiedCount = todayAttendanceList.filter(r => r.isVerified).length;
  const attendanceRate = activeEngineersCount > 0 ? Math.round((presentCount / activeEngineersCount) * 100) : 0;

  const totalMaterialsCount = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    return rawMaterials.filter(m => siteIds.has(m.siteId)).length;
  }, [sites, rawMaterials]);

  // 1. Today's Canonical Labour Records & Counts (Single Source of Truth)
  const todayLabourRecords = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    const uniqueMap = new Map();

    // Process canonical labourMemberAttendance records
    (rawLabourAttendance || []).forEach(r => {
      if (!r) return;
      // Exclude lock/metadata records
      if (r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock" || r.lockedMetadata || r.type === "lock") return;
      if (siteIds.size > 0 && r.siteId && !siteIds.has(r.siteId)) return;

      const dateField = normalizeToISODate(r.attendanceDate || r.date);
      if (!dateField || !todayDateKeys.includes(dateField)) return;

      const recKey = r.id || `${r.siteId}_${r.teamId}_${r.categoryId}_${dateField}`;
      if (uniqueMap.has(recKey)) return;

      const { workerCount, units: customUnits, wage: dailyWage, amount: calculatedAmount } = resolveLabourRecordCalculations(r);

      uniqueMap.set(recKey, {
        id: recKey,
        siteId: r.siteId,
        teamId: r.teamId,
        workerCount,
        customUnits,
        dailyWage,
        calculatedAmount,
        date: dateField,
        rawRecord: r
      });
    });

    // Process legacy siteLabourEntries records
    (rawLegacyLabour || []).forEach(r => {
      if (!r) return;
      if (r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock" || r.lockedMetadata || r.type === "lock") return;
      if (siteIds.size > 0 && r.siteId && !siteIds.has(r.siteId)) return;

      const dateField = normalizeToISODate(r.date || r.attendanceDate);
      if (!dateField || !todayDateKeys.includes(dateField)) return;

      const recKey = r.id || `legacy_labour_${r.siteId}_${r.categoryId}_${dateField}`;
      if (uniqueMap.has(recKey)) return;

      const { workerCount, units: customUnits, wage: dailyWage, amount: calculatedAmount } = resolveLabourRecordCalculations(r);

      uniqueMap.set(recKey, {
        id: recKey,
        siteId: r.siteId,
        workerCount,
        customUnits,
        dailyWage,
        calculatedAmount,
        date: dateField,
        rawRecord: r
      });
    });

    return Array.from(uniqueMap.values());
  }, [rawLabourAttendance, rawLegacyLabour, sites, todayDateKeys]);

  // Aggregate Today's Labour Count (Metric Card 4)
  const todayLabourCount = useMemo(() => {
    return todayLabourRecords.reduce((sum, r) => sum + (Number(r.workerCount) || 0), 0);
  }, [todayLabourRecords]);

  // Aggregate Today's Labour Expense (Wage Accruals)
  const todayLabourExpenseSum = useMemo(() => {
    return todayLabourRecords.reduce((sum, r) => sum + (Number(r.calculatedAmount) || 0), 0);
  }, [todayLabourRecords]);

  // 2. Today's Canonical Material Expenses
  const todayMaterialRecords = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    const uniqueMap = new Map();

    (rawMaterials || []).forEach(m => {
      if (!m) return;
      if (m.id?.startsWith("lock_") || m.id === "__material_master__" || m.type === "material_lock" || m.type === "labour_attendance_lock") return;
      if (siteIds.size > 0 && m.siteId && !siteIds.has(m.siteId)) return;

      const dateField = m.purchaseDate || m.date || m.orderDate;
      if (!isTodayRecord(dateField, m.createdAt || m.updatedAt, todayDateKeys)) return;

      const recKey = m.id || `mat_${m.siteId}_${m.materialName}_${m.purchaseDate}`;
      if (uniqueMap.has(recKey)) return;

      let amount = 0;
      if (m.totalAmount !== undefined && m.totalAmount !== null) {
        amount = Number(m.totalAmount) || 0;
      } else if (m.amount !== undefined && m.amount !== null) {
        amount = Number(m.amount) || 0;
      } else {
        const qty = Number(m.quantity || m.requiredQuantity) || 0;
        let unitCost = 500;
        if (m.category === "Steel") unitCost = 5000;
        else if (m.category === "Sand") unitCost = 2500;
        else if (m.category === "Bricks") unitCost = 10;
        else if (m.category === "Cement") unitCost = 400;
        amount = qty * unitCost;
      }

      uniqueMap.set(recKey, {
        id: recKey,
        siteId: m.siteId,
        category: "Material",
        materialName: m.materialName,
        amount,
        date: normalizeToISODate(dateField) || todayDateKeys[0],
        rawRecord: m
      });
    });

    return Array.from(uniqueMap.values());
  }, [rawMaterials, sites, todayDateKeys]);

  const todayMaterialExpenseSum = useMemo(() => {
    return todayMaterialRecords.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
  }, [todayMaterialRecords]);

  // 3. Today's Canonical General Expenses
  const todayGeneralExpenseRecords = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    const uniqueMap = new Map();

    (rawExpenses || []).forEach(e => {
      if (!e) return;
      if (siteIds.size > 0 && e.siteId && !siteIds.has(e.siteId)) return;

      const dateField = e.date || e.expenseDate;
      if (!isTodayRecord(dateField, e.createdAt || e.updatedAt, todayDateKeys)) return;

      const recKey = e.id || `exp_${e.siteId}_${e.date}_${e.amount}_${e.description}`;
      if (uniqueMap.has(recKey)) return;

      const amount = Number(e.amount) || 0;
      uniqueMap.set(recKey, {
        id: recKey,
        siteId: e.siteId,
        category: e.category || "Site Expense",
        amount,
        date: normalizeToISODate(dateField) || todayDateKeys[0],
        rawRecord: e
      });
    });

    return Array.from(uniqueMap.values());
  }, [rawExpenses, sites, todayDateKeys]);

  const todayGeneralExpenseSum = useMemo(() => {
    return todayGeneralExpenseRecords.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [todayGeneralExpenseRecords]);

  // 4. Today's Canonical Reports / DPRs
  const todayReportsRecords = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    return (rawReports || []).filter(r => {
      if (!r) return false;
      if (siteIds.size > 0 && r.siteId && !siteIds.has(r.siteId)) return false;
      const dateField = r.date || r.reportDate || r.createdAt;
      return isTodayRecord(dateField, r.createdAt, todayDateKeys);
    });
  }, [rawReports, sites, todayDateKeys]);

  // 5. Consolidated Today's Total Expense (Metric Card 5)
  const todayExpensesSum = useMemo(() => {
    return todayGeneralExpenseSum + todayMaterialExpenseSum + todayLabourExpenseSum;
  }, [todayGeneralExpenseSum, todayMaterialExpenseSum, todayLabourExpenseSum]);

  const runningProjectsCount = useMemo(() => {
    return sites.filter(s => {
      const st = (s.status || "active").toLowerCase();
      return st === "active" || st === "running" || st === "in progress";
    }).length;
  }, [sites]);

  const completedProjectsCount = useMemo(() => {
    return sites.filter(s => (s.status || "").toLowerCase() === "completed").length;
  }, [sites]);

  const onHoldProjectsCount = useMemo(() => {
    return sites.filter(s => {
      const st = (s.status || "").toLowerCase();
      return st === "on hold" || st === "planning" || st === "pending";
    }).length;
  }, [sites]);

  const delayedProjectsCount = useMemo(() => {
    return sites.filter(s => (s.status || "").toLowerCase() === "delayed" || s.isSiteDelayed).length;
  }, [sites]);

  // Expenses breakdown by category across all logged records
  const expenseCategoryBreakdown = useMemo(() => {
    const categories = { "Material": 0, "Labour": 0, "Fuel & Equipment": 0, "Other": 0 };

    (rawExpenses || []).forEach(exp => {
      const amt = Number(exp.amount) || 0;
      const cat = (exp.category || exp.expenseType || "Other").toLowerCase();
      if (cat.includes("fuel") || cat.includes("equip") || cat.includes("transport")) {
        categories["Fuel & Equipment"] += amt;
      } else if (cat.includes("mat")) {
        categories["Material"] += amt;
      } else if (cat.includes("lab")) {
        categories["Labour"] += amt;
      } else {
        categories["Other"] += amt;
      }
    });

    (rawMaterials || []).forEach(m => {
      if (m.id?.startsWith("lock_") || m.id === "__material_master__" || m.type === "material_lock") return;
      let amt = 0;
      if (m.totalAmount !== undefined && m.totalAmount !== null) amt = Number(m.totalAmount) || 0;
      else if (m.amount !== undefined && m.amount !== null) amt = Number(m.amount) || 0;
      else {
        const qty = Number(m.quantity || m.requiredQuantity) || 0;
        let unitCost = 500;
        if (m.category === "Steel") unitCost = 5000;
        else if (m.category === "Sand") unitCost = 2500;
        else if (m.category === "Bricks") unitCost = 10;
        else if (m.category === "Cement") unitCost = 400;
        amt = qty * unitCost;
      }
      categories["Material"] += amt;
    });

    (rawLabourAttendance || []).forEach(r => {
      if (r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock") return;
      let amt = 0;
      if (r.calculatedAmount !== undefined && r.calculatedAmount !== null) amt = Number(r.calculatedAmount) || 0;
      else if (r.totalAmount !== undefined && r.totalAmount !== null) amt = Number(r.totalAmount) || 0;
      else {
        const cnt = Number(r.workerCount || 1) || 1;
        const u = Number(r.customWorkUnits !== undefined ? r.customWorkUnits : (r.units || 1)) || 1;
        const w = Number(r.dailyWage || r.wage || 500) || 500;
        amt = cnt * u * w;
      }
      categories["Labour"] += amt;
    });

    return categories;
  }, [rawExpenses, rawMaterials, rawLabourAttendance]);

  const totalExpenseAllTime = useMemo(() => {
    return Object.values(expenseCategoryBreakdown).reduce((a, b) => a + b, 0);
  }, [expenseCategoryBreakdown]);

  // Upcoming Deadlines
  const upcomingDeadlines = useMemo(() => {
    return sites
      .filter(s => s.expectedEndDate || s.startDate)
      .sort((a, b) => {
        const dA = new Date(a.expectedEndDate || a.startDate).getTime() || Infinity;
        const dB = new Date(b.expectedEndDate || b.startDate).getTime() || Infinity;
        return dA - dB;
      })
      .slice(0, 4);
  }, [sites]);

  return (
    <Layout 
      title="Overall Admin ERP Dashboard" 
      description="Executive Construction Control Center, Workforce Operations & Financial Analytics"
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── MAIN DASHBOARD CONTAINER ── */}
      <div className="admin-dashboard-container">
        
        {/* ── 1. TOP SUMMARY CARDS (6 CARDS) ── */}
        <div className="admin-summary-grid">
          
          {/* KPI 1: Active Sites */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <Building2 size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{sites.filter(s => (s.status || "active").toLowerCase() === "active").length}</div>
              <div className="admin-summary-label">Active Sites</div>
            </div>
          </div>

          {/* KPI 2: Running Projects */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-blue">
              <Activity size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{runningProjectsCount}</div>
              <div className="admin-summary-label">Running Projects</div>
            </div>
          </div>

          {/* KPI 3: Today's Engineer Attendance (Single Source of Truth) */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-green">
              <UserCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">
                <span>{presentCount}/{activeEngineersCount}</span>
                <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#16a34a" }}>
                  ({attendanceRate}%)
                </span>
              </div>
              <div className="admin-summary-label">Today's Attendance</div>
            </div>
          </div>

          {/* KPI 4: Today's Labour (Single Source of Truth) */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{todayLabourCount}</div>
              <div className="admin-summary-label">Today's Labour</div>
            </div>
          </div>

          {/* KPI 5: Today's Expense */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">₹{todayExpensesSum.toLocaleString()}</div>
              <div className="admin-summary-label">Today's Expense</div>
            </div>
          </div>

          {/* KPI 6: Monthly Completed Projects */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <TrendingUp size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{completedProjectsCount}</div>
              <div className="admin-summary-label">Completed Projects</div>
            </div>
          </div>
        </div>

        {/* ── 2. COMPACT ATTENDANCE VIEW CARD (ZERO VERTICAL EXPANSION) ── */}
        <div className="admin-attendance-card" id="today-attendance-activity-section" style={{ padding: "16px 20px" }}>
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "16px"
          }}>
            {/* Left: Title, Live Sync, and Today's Date */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
              <div style={{
                width: "42px",
                height: "42px",
                borderRadius: "10px",
                backgroundColor: "#ffedd5",
                color: "var(--brand-orange)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                flexShrink: 0
              }}>
                <ClipboardCheck size={22} />
              </div>

              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-950)" }}>
                    Today's Attendance
                  </h3>
                  <div className="admin-attendance-live-badge">
                    <span className="admin-attendance-live-dot" />
                    Live Sync
                  </div>
                </div>
                <span style={{ fontSize: "12px", color: "var(--primary-600)", fontWeight: "600" }}>
                  {formattedTodayDate} • {todayAttendanceList.length} engineer{todayAttendanceList.length === 1 ? "" : "s"} recorded today
                </span>
              </div>
            </div>

            {/* Center / Summary Pills */}
            <div className="admin-attendance-metrics" style={{ flexWrap: "wrap" }}>
              <div className="admin-attendance-metric-pill present">
                <UserCheck size={14} />
                <span>Today: {todayAttendanceList.length} Engineer{todayAttendanceList.length === 1 ? "" : "s"} ({presentCount}/{activeEngineersCount})</span>
              </div>
              <div className="admin-attendance-metric-pill onsite">
                <Clock size={14} />
                <span>On-Site: {onSiteCount}</span>
              </div>
              <div className="admin-attendance-metric-pill checkout">
                <CheckCircle2 size={14} />
                <span>Checked Out: {checkedOutCount}</span>
              </div>
              <div className="admin-attendance-metric-pill verified">
                <ShieldCheck size={14} />
                <span>GPS Verified: {verifiedCount}</span>
              </div>
            </div>

            {/* Right: Primary Action Button to Open Full Modal */}
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <button
                type="button"
                onClick={() => setShowTodayAttendanceModal(true)}
                className="erp-btn-primary"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "8px",
                  padding: "9px 18px",
                  fontSize: "13px",
                  fontWeight: "750",
                  borderRadius: "8px",
                  backgroundColor: "#ea580c",
                  color: "#ffffff",
                  border: "none",
                  cursor: "pointer",
                  boxShadow: "0 2px 4px rgba(234, 88, 12, 0.2)",
                  transition: "all 0.15s ease"
                }}
              >
                <ClipboardCheck size={16} />
                Attendance View
                <span style={{
                  backgroundColor: "rgba(255, 255, 255, 0.25)",
                  padding: "1px 6px",
                  borderRadius: "100px",
                  fontSize: "11px"
                }}>
                  {todayAttendanceList.length}
                </span>
              </button>

              <Link 
                to="/admin/engineers" 
                className="admin-attendance-link-pill"
                style={{ padding: "8px 12px", textDecoration: "none" }}
              >
                All Engineers →
              </Link>
            </div>
          </div>
        </div>

        {/* ── 3. THIRD ROW: 3-CARD ANALYTICS & INSIGHTS GRID ── */}
        <div className="admin-analytics-grid">
          
          {/* CARD 1: CONSTRUCTION STATUS */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <Building2 size={16} style={{ color: "var(--brand-orange)" }} />
                Construction Site Status
              </h3>
              <span className="admin-card-subtitle">Total Sites: {sites.length}</span>
            </div>

            <div className="admin-status-grid">
              <div className="admin-status-box running">
                <div className="status-num">{runningProjectsCount}</div>
                <div className="status-lbl">Running</div>
              </div>
              <div className="admin-status-box completed">
                <div className="status-num">{completedProjectsCount}</div>
                <div className="status-lbl">Completed</div>
              </div>
              <div className="admin-status-box on-hold">
                <div className="status-num">{onHoldProjectsCount}</div>
                <div className="status-lbl">On Hold</div>
              </div>
              <div className="admin-status-box delayed">
                <div className="status-num">{delayedProjectsCount}</div>
                <div className="status-lbl">Delayed</div>
              </div>
            </div>
          </div>

          {/* CARD 2: EXPENSE OVERVIEW */}
          <div className="admin-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <DollarSign size={16} style={{ color: "var(--brand-orange)" }} />
                Expense Overview
              </h3>
              <span className="admin-card-subtitle">Total Logged: ₹{totalExpenseAllTime.toLocaleString()}</span>
            </div>

            <div className="admin-expense-list">
              {Object.entries(expenseCategoryBreakdown).map(([catName, amount]) => {
                const pct = totalExpenseAllTime > 0 ? Math.round((amount / totalExpenseAllTime) * 100) : 0;
                return (
                  <div key={catName} className="admin-expense-item">
                    <div className="admin-expense-item-header">
                      <span className="admin-expense-cat">{catName}</span>
                      <span className="admin-expense-val">₹{amount.toLocaleString()} ({pct}%)</span>
                    </div>
                    <div className="admin-progress-track">
                      <div 
                        className="admin-progress-fill"
                        style={{ 
                          width: `${Math.max(3, pct)}%`, 
                          backgroundColor: catName === "Material" ? "#f97316" : catName === "Labour" ? "#ea580c" : catName === "Fuel & Equipment" ? "#16a34a" : "#64748b" 
                        }} 
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* CARD 3: UPCOMING DEADLINES */}
          <div className="admin-deadlines-card">
            <div className="admin-card-header">
              <h3 className="admin-card-title">
                <Calendar size={16} style={{ color: "var(--brand-orange)" }} />
                Upcoming Deadlines
              </h3>
              <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: "#fff7ed", color: "#f97316", padding: "2px 8px", borderRadius: "100px" }}>
                Schedule
              </span>
            </div>

            <div className="admin-deadlines-list">
              {upcomingDeadlines.length === 0 ? (
                <div style={{ textAlign: "center", padding: "20px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--primary-600)" }}>No deadlines configured.</p>
                </div>
              ) : (
                upcomingDeadlines.map(site => (
                  <div key={site.id} className="admin-deadline-item">
                    <div className="admin-deadline-info">
                      <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {site.siteName}
                      </strong>
                      <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block", marginTop: "1px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Client: {site.clientName || "Internal"}
                      </span>
                    </div>
                    <div className="admin-deadline-meta">
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#c2410c", fontFamily: "var(--font-family-mono, monospace)" }}>
                        {site.expectedEndDate || site.startDate || "TBD"}
                      </span>
                      <Badge status={site.status || "active"} style={{ fontSize: "10px", padding: "1px 6px" }} />
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

        </div>

        {/* ── 4. FOURTH ROW: ACTIVE PROJECTS OVERVIEW TABLE (FULL WIDTH) ── */}
        <div className="admin-table-card" style={{ width: "100%" }}>
          <div className="admin-table-header">
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Active Projects Operations Matrix</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--primary-600)" }}>Detailed site supervision, real-time workforce deployment, and daily costs</p>
            </div>
            <Link to="/admin/sites" style={{ fontSize: "12px", fontWeight: "700", color: "var(--brand-orange)", textDecoration: "none" }}>
              View All Sites ({sites.length}) →
            </Link>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-table">
              <colgroup>
                <col className="col-matrix-site" />
                <col className="col-matrix-engineers" />
                <col className="col-matrix-activity" />
                <col className="col-matrix-progress" />
                <col className="col-matrix-labour" />
                <col className="col-matrix-expense" />
                <col className="col-matrix-status" />
                <col className="col-matrix-action" />
              </colgroup>
              <thead>
                <tr>
                  <th>Site</th>
                  <th>Site Engineers</th>
                  <th>Today's Activity</th>
                  <th>Live Progress</th>
                  <th>Today's Labour</th>
                  <th>Today's Expense</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "right" }}>View</th>
                </tr>
              </thead>
              <tbody>
                {sites.length === 0 ? (
                  <tr>
                    <td colSpan="8">
                      <div className="erp-empty-state">
                        <div className="erp-empty-icon"><Building2 size={22} /></div>
                        <span style={{ fontSize: "13px", fontWeight: "600" }}>No active construction sites registered.</span>
                        <Link to="/admin/sites" className="erp-btn-primary" style={{ marginTop: "4px" }}>+ Add Site</Link>
                      </div>
                    </td>
                  </tr>
                ) : (
                  sites.map(site => {
                    const progVal = Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || 0));
                    
                    // 1. Resolve Assigned Engineers (multi-key lookup + historical operational records fallback)
                    const siteAssignedUids = new Set(site.assignedEngineers || []);

                    // Include engineers who have this site in their assignedSites profile
                    engineers.forEach(eng => {
                      if (Array.isArray(eng.assignedSites) && eng.assignedSites.includes(site.id)) {
                        siteAssignedUids.add(eng.id || eng.uid);
                      }
                    });

                    // Include engineers who marked attendance on this site
                    todayAttendanceList.filter(a => a.resolvedSiteId === site.id).forEach(a => {
                      if (a.resolvedEngineerId) siteAssignedUids.add(a.resolvedEngineerId);
                    });

                    const assignedEngList = Array.from(siteAssignedUids).map(uid => {
                      const cleanId = String(uid).trim();
                      const e = engineersLookup[cleanId] || engineersLookup[cleanId.toLowerCase()] || engineers.find(eng => 
                        eng.id === cleanId || 
                        eng.uid === cleanId || 
                        eng.docId === cleanId ||
                        eng.customId === cleanId || 
                        eng.engineerId === cleanId ||
                        (eng.email && eng.email.toLowerCase() === cleanId.toLowerCase())
                      );

                      let resolvedName = e ? (e.fullName || e.name || e.displayName) : "";

                      // If still not resolved, check historical operational records for this site/engineer
                      if (!resolvedName || resolvedName === "Site Engineer") {
                        const attMatch = (rawAttendance || []).find(a => 
                          (a.siteId === site.id || a.resolvedSiteId === site.id) &&
                          (a.engineerId === cleanId || a.userId === cleanId || a.id === cleanId) &&
                          a.engineerName && a.engineerName !== "Site Engineer"
                        );
                        if (attMatch) resolvedName = attMatch.engineerName;
                      }
                      if (!resolvedName || resolvedName === "Site Engineer") {
                        const repMatch = (rawReports || []).find(r => 
                          r.siteId === site.id && 
                          (r.engineerId === cleanId || r.userId === cleanId) && 
                          (r.engineerName || r.submittedByName)
                        );
                        if (repMatch) resolvedName = repMatch.engineerName || repMatch.submittedByName;
                      }
                      if (!resolvedName || resolvedName === "Site Engineer") {
                        const matMatch = (rawMaterials || []).find(m => 
                          m.siteId === site.id && 
                          (m.engineerId === cleanId || m.userId === cleanId) && 
                          (m.engineerName || m.recordedByName)
                        );
                        if (matMatch) resolvedName = matMatch.engineerName || matMatch.recordedByName;
                      }
                      if (!resolvedName || resolvedName === "Site Engineer") {
                        const labMatch = (rawLabourAttendance || []).find(l => 
                          l.siteId === site.id && 
                          (l.engineerId === cleanId || l.userId === cleanId || l.submittedBy === cleanId) && 
                          (l.engineerName || l.createdByName)
                        );
                        if (labMatch) resolvedName = labMatch.engineerName || labMatch.createdByName;
                      }

                      if (!resolvedName) {
                        resolvedName = e?.email ? e.email.split('@')[0] : "Site Engineer";
                      }

                      return {
                        id: cleanId,
                        uid: e?.uid || cleanId,
                        name: resolvedName
                      };
                    });

                    // 2. Identify Engineers present on this site today
                    const siteTodayEngineers = todayAttendanceList.filter(a => a.resolvedSiteId === site.id);
                    const siteTodayEngSet = new Set(siteTodayEngineers.map(a => a.resolvedEngineerId || a.engineerName));

                    // 3. Today's Labour records & worker count for this site
                    const siteLabourRecs = todayLabourRecords.filter(l => l.siteId === site.id);
                    const siteLabourCount = siteLabourRecs.reduce((sum, l) => sum + (Number(l.workerCount) || 0), 0);

                    // 4. Today's Materials recorded for this site
                    const siteMaterialRecs = todayMaterialRecords.filter(m => m.siteId === site.id);

                    // 5. Today's General Expenses recorded for this site
                    const siteGenExpRecs = todayGeneralExpenseRecords.filter(e => e.siteId === site.id);

                    // 6. Today's Reports / DPRs filed for this site
                    const siteReportsRecs = todayReportsRecords.filter(r => r.siteId === site.id);

                    // 7. Calculate site's total today expense (General + Material + Labour)
                    const siteGenExpSum = siteGenExpRecs.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
                    const siteMatExpSum = siteMaterialRecs.reduce((sum, m) => sum + (Number(m.amount) || 0), 0);
                    const siteLabExpSum = siteLabourRecs.reduce((sum, l) => sum + (Number(l.calculatedAmount) || 0), 0);
                    const siteExpenseToday = siteGenExpSum + siteMatExpSum + siteLabExpSum;

                    // 8. Compose Today's Activity checklist items
                    const activities = [];
                    if (siteTodayEngineers.length > 0) {
                      activities.push({
                        id: "attendance",
                        text: `Attendance marked — ${siteTodayEngineers.length} ${siteTodayEngineers.length === 1 ? "engineer" : "engineers"}`,
                        color: "#16a34a"
                      });
                    }
                    if (siteLabourCount > 0) {
                      activities.push({
                        id: "labour",
                        text: `Labour added — ${siteLabourCount} ${siteLabourCount === 1 ? "worker" : "workers"}`,
                        color: "#0284c7"
                      });
                    }
                    if (siteMaterialRecs.length > 0) {
                      activities.push({
                        id: "material",
                        text: `Material added`,
                        color: "#7c3aed"
                      });
                    }
                    if (siteExpenseToday > 0) {
                      activities.push({
                        id: "expense",
                        text: `Expense recorded — ₹${siteExpenseToday.toLocaleString()}`,
                        color: "#d97706"
                      });
                    }
                    if (siteReportsRecs.length > 0) {
                      activities.push({
                        id: "report",
                        text: `Progress / report uploaded`,
                        color: "#059669"
                      });
                    }

                    const locationText = site.location || site.siteLocationName || site.city || "";

                    return (
                      <tr key={site.id}>
                        {/* 1. SITE */}
                        <td>
                          <strong style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-950)", display: "block", lineHeight: "1.3", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {site.siteName}
                          </strong>
                          {locationText ? (
                            <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              <MapPin size={10} style={{ flexShrink: 0, color: "#94a3b8" }} />
                              {locationText}
                            </span>
                          ) : (
                            <span style={{ fontSize: "10.5px", color: "#94a3b8", display: "block", marginTop: "2px" }}>
                              Construction Project
                            </span>
                          )}
                        </td>

                        {/* 2. SITE ENGINEERS */}
                        <td>
                          {assignedEngList.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                              {assignedEngList.map((eng, idx) => {
                                const isPresent = siteTodayEngSet.has(eng.id) || siteTodayEngSet.has(eng.uid) || siteTodayEngSet.has(eng.name);
                                return (
                                  <div key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "11.5px" }}>
                                    <span style={{ 
                                      width: "6px", 
                                      height: "6px", 
                                      borderRadius: "50%", 
                                      backgroundColor: isPresent ? "#16a34a" : "#cbd5e1",
                                      flexShrink: 0 
                                    }} />
                                    <span style={{ 
                                      fontWeight: isPresent ? "700" : "500", 
                                      color: isPresent ? "var(--primary-950)" : "var(--primary-700)",
                                      overflow: "hidden",
                                      textOverflow: "ellipsis",
                                      whiteSpace: "nowrap"
                                    }}>
                                      {eng.name}
                                    </span>
                                    {isPresent && (
                                      <span style={{ 
                                        fontSize: "9px", 
                                        fontWeight: "800", 
                                        color: "#15803d", 
                                        backgroundColor: "#dcfce7", 
                                        padding: "1px 4px", 
                                        borderRadius: "3px",
                                        lineHeight: "1.2",
                                        flexShrink: 0
                                      }}>
                                        Present
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic" }}>Unassigned</span>
                          )}
                        </td>

                        {/* 3. TODAY'S ACTIVITY */}
                        <td>
                          {activities.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              {activities.map((act, i) => (
                                <div key={i} style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11px", color: act.color, fontWeight: "600" }}>
                                  <CheckCircle2 size={12} color={act.color} style={{ flexShrink: 0 }} />
                                  <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{act.text}</span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic" }}>No activity logged today</span>
                          )}
                        </td>

                        {/* 4. LIVE PROGRESS */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                            <div style={{ flex: 1, height: "7px", backgroundColor: "#e2e8f0", borderRadius: "100px", overflow: "hidden" }}>
                              <div style={{ 
                                width: `${progVal}%`, 
                                height: "100%", 
                                backgroundColor: progVal >= 80 ? "#16a34a" : (progVal >= 40 ? "#2563eb" : "#f97316"), 
                                borderRadius: "100px",
                                transition: "width 0.3s ease"
                              }} />
                            </div>
                            <span style={{ fontSize: "11.5px", fontWeight: "800", color: "var(--primary-950)", minWidth: "30px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                              {progVal}%
                            </span>
                          </div>
                        </td>

                        {/* 5. TODAY'S LABOUR */}
                        <td>
                          <span style={{ 
                            fontSize: "12px", 
                            fontWeight: siteLabourCount > 0 ? "700" : "500", 
                            color: siteLabourCount > 0 ? "var(--primary-950)" : "var(--primary-500)",
                            fontVariantNumeric: "tabular-nums" 
                          }}>
                            {siteLabourCount > 0 ? `${siteLabourCount} Workers` : "0 Workers"}
                          </span>
                        </td>

                        {/* 6. TODAY'S EXPENSE */}
                        <td>
                          <span style={{ 
                            fontSize: "12px", 
                            fontWeight: siteExpenseToday > 0 ? "700" : "500", 
                            color: siteExpenseToday > 0 ? "var(--primary-950)" : "var(--primary-500)",
                            fontVariantNumeric: "tabular-nums" 
                          }}>
                            {siteExpenseToday > 0 ? `₹${siteExpenseToday.toLocaleString()}` : "₹0"}
                          </span>
                        </td>

                        {/* 7. STATUS */}
                        <td style={{ textAlign: "center" }}>
                          <Badge status={site.status || "active"} />
                        </td>

                        {/* 8. VIEW */}
                        <td style={{ textAlign: "right" }}>
                          <Link to="/admin/sites" className="admin-action-btn">
                            View
                          </Link>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>

      {/* ── EXPANDED ATTENDANCE VIEW MODAL (TODAY'S ATTENDANCE FULL VIEW) ── */}
      <Modal
        isOpen={showTodayAttendanceModal}
        onClose={() => setShowTodayAttendanceModal(false)}
        title={`Today's Attendance Activity — Full View (${formattedTodayDate})`}
        maxWidth="1100px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header / Summary Bar */}
          <div style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            flexWrap: "wrap",
            gap: "12px",
            padding: "12px 16px",
            backgroundColor: "#f8fafc",
            borderRadius: "8px",
            border: "1px solid #e2e8f0"
          }}>
            <div className="admin-attendance-metrics" style={{ flexWrap: "wrap" }}>
              <div className="admin-attendance-metric-pill present">
                <UserCheck size={14} />
                <span>Present: {presentCount}/{activeEngineersCount} ({attendanceRate}%)</span>
              </div>
              <div className="admin-attendance-metric-pill onsite">
                <Clock size={14} />
                <span>On-Site: {onSiteCount}</span>
              </div>
              <div className="admin-attendance-metric-pill checkout">
                <CheckCircle2 size={14} />
                <span>Checked Out: {checkedOutCount}</span>
              </div>
              <div className="admin-attendance-metric-pill verified">
                <ShieldCheck size={14} />
                <span>GPS Verified: {verifiedCount}</span>
              </div>
            </div>

            <div className="admin-attendance-live-badge">
              <span className="admin-attendance-live-dot" />
              Live Real-Time Sync
            </div>
          </div>

          {/* Interactive Toolbar: Search, Site Filter & Status Tabs */}
          <div className="admin-attendance-controls-bar" style={{ margin: 0 }}>
            <div className="admin-attendance-search-group">
              <div className="admin-attendance-search-input-wrap">
                <Search size={14} className="admin-attendance-search-icon" />
                <input 
                  type="text"
                  placeholder="Search engineer name, email or site..."
                  value={attendanceSearchQuery}
                  onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                  className="admin-attendance-search-input"
                />
              </div>

              <select
                value={attendanceSiteFilter}
                onChange={(e) => setAttendanceSiteFilter(e.target.value)}
                className="admin-attendance-select"
              >
                <option value="">All Sites ({sites.length})</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            <div className="admin-attendance-tabs">
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${attendanceStatusFilter === "all" ? "active" : ""}`}
                onClick={() => setAttendanceStatusFilter("all")}
              >
                All Checked-In ({todayAttendanceList.length})
              </button>
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${attendanceStatusFilter === "onsite" ? "active" : ""}`}
                onClick={() => setAttendanceStatusFilter("onsite")}
              >
                On-Site Now ({onSiteCount})
              </button>
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${attendanceStatusFilter === "checkout" ? "active" : ""}`}
                onClick={() => setAttendanceStatusFilter("checkout")}
              >
                Checked Out ({checkedOutCount})
              </button>
            </div>
          </div>

          {/* Attendance Activity Table in Modal */}
          <div className="admin-attendance-table-wrap" style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            {filteredTodayAttendance.length === 0 ? (
              <div style={{ textAlign: "center", padding: "40px 20px", background: "#f8fafc" }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "100px", backgroundColor: "#ffedd5", color: "#ea580c", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "10px" }}>
                  <ClipboardCheck size={22} />
                </div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                  {todayAttendanceList.length === 0 ? "No Attendance Marked Yet Today" : "No Attendance Matching Selected Filters"}
                </h4>
                <p style={{ margin: 0, fontSize: "12px", color: "#64748b", maxWidth: "420px", marginInline: "auto" }}>
                  {todayAttendanceList.length === 0 
                    ? "When site engineers check in via the mobile or web portal with GPS verification and photo proof, their records will sync here in real-time."
                    : "Try clearing search keywords or site filters to view all recorded attendance for today."}
                </p>
                {todayAttendanceList.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      setAttendanceSearchQuery("");
                      setAttendanceSiteFilter("");
                      setAttendanceStatusFilter("all");
                    }}
                    className="erp-btn-secondary"
                    style={{ marginTop: "12px", fontSize: "11.5px", padding: "5px 12px" }}
                  >
                    Reset Filters
                  </button>
                )}
              </div>
            ) : (
              <table className="admin-attendance-table">
                <colgroup>
                  <col style={{ width: "24%" }} />
                  <col style={{ width: "36px" }} />
                  <col style={{ width: "20%" }} />
                  <col style={{ width: "13%" }} />
                  <col style={{ width: "14%" }} />
                  <col style={{ width: "21%" }} />
                  <col style={{ width: "70px" }} />
                </colgroup>
                <thead>
                  <tr>
                    <th>Engineer</th>
                    <th style={{ width: "36px", padding: 0 }}></th>
                    <th>Assigned Site</th>
                    <th>Check-In Time</th>
                    <th>Check-Out / Status</th>
                    <th>Location & Geofence</th>
                    <th style={{ textAlign: "center" }}>Photo Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTodayAttendance.map((rec) => {
                    const hasDistance = rec.distance !== null && rec.distance !== undefined;
                    const isOnSiteGeofence = hasDistance && rec.distance <= 150;

                    return (
                      <tr key={rec.id}>
                        {/* Engineer Info */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            {rec.engineerAvatar ? (
                              <img 
                                src={rec.engineerAvatar} 
                                alt={rec.engineerName} 
                                className="admin-attendance-avatar"
                              />
                            ) : (
                              <div className="admin-attendance-avatar">
                                {(rec.engineerName || "E").charAt(0).toUpperCase()}
                              </div>
                            )}
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {rec.engineerName}
                              </strong>
                              <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {rec.engineerPhone || rec.engineerEmail || "Site Engineer"}
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Compact Eye / View Details Icon between Engineer & Site */}
                        <td style={{ textAlign: "center", padding: "8px 4px", width: "36px" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedInspectRecord(rec)}
                            title="View Attendance Details"
                            style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "6px",
                              border: "1px solid #e2e8f0",
                              backgroundColor: "#f8fafc",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              color: "#64748b",
                              cursor: "pointer",
                              padding: 0,
                              transition: "all 0.15s ease"
                            }}
                            onMouseEnter={e => {
                              e.currentTarget.style.backgroundColor = "#fff7ed";
                              e.currentTarget.style.borderColor = "#fdba74";
                              e.currentTarget.style.color = "#ea580c";
                            }}
                            onMouseLeave={e => {
                              e.currentTarget.style.backgroundColor = "#f8fafc";
                              e.currentTarget.style.borderColor = "#e2e8f0";
                              e.currentTarget.style.color = "#64748b";
                            }}
                          >
                            <Eye size={14} />
                          </button>
                        </td>

                        {/* Assigned Site */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Building2 size={14} style={{ color: "var(--brand-orange)", flexShrink: 0 }} />
                            <div style={{ minWidth: 0, flex: 1 }}>
                              <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {rec.siteName}
                              </strong>
                              {rec.clientName && (
                                <span style={{ fontSize: "10.5px", color: "var(--primary-600)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                  Client: {rec.clientName}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Check-In Time */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <Clock size={14} style={{ color: "#16a34a", flexShrink: 0 }} />
                            <div>
                              <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#15803d", display: "block" }}>
                                {rec.checkInTimeFormatted}
                              </span>
                              <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                                Checked In
                              </span>
                            </div>
                          </div>
                        </td>

                        {/* Check-Out / Active Status */}
                        <td>
                          {rec.isCheckedOut ? (
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <CheckCircle2 size={14} style={{ color: "#2563eb", flexShrink: 0 }} />
                              <div>
                                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#1d4ed8", display: "block" }}>
                                  {rec.checkOutTimeFormatted || "Completed"}
                                </span>
                                <span style={{ fontSize: "10.5px", color: "#64748b" }}>
                                  Checked Out
                                </span>
                              </div>
                            </div>
                          ) : (
                            <span style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "5px",
                              backgroundColor: "#f0fdf4", 
                              color: "#16a34a", 
                              border: "1px solid #bbf7d0", 
                              padding: "3px 8px", 
                              borderRadius: "6px", 
                              fontSize: "11px", 
                              fontWeight: "700", 
                              whiteSpace: "nowrap"
                            }}>
                              <span style={{ width: "6px", height: "6px", backgroundColor: "#22c55e", borderRadius: "50%" }} />
                              Active On-Site
                            </span>
                          )}
                        </td>

                        {/* Location & Geofence Details */}
                        <td>
                          <div style={{ display: "flex", flexDirection: "column", gap: "3px", minWidth: 0 }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", flexWrap: "nowrap", overflow: "hidden" }}>
                              <span className="admin-attendance-gps-badge">
                                <MapPin size={11} />
                                {rec.latitude && rec.longitude 
                                  ? `${Number(rec.latitude).toFixed(4)}, ${Number(rec.longitude).toFixed(4)}`
                                  : "GPS Logged"}
                              </span>

                              {hasDistance && (
                                <span className={`admin-attendance-distance-badge ${isOnSiteGeofence ? "on-site" : "off-site"}`}>
                                  <Navigation size={10} />
                                  {rec.distance < 1000 
                                    ? `${Math.round(rec.distance)}m` 
                                    : `${(rec.distance / 1000).toFixed(1)}km`}
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "11px", color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", display: "block" }} title={rec.addressDisplay}>
                              {rec.addressDisplay}
                            </span>
                          </div>
                        </td>

                        {/* Photo Proof */}
                        <td style={{ textAlign: "center" }}>
                          {rec.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedInspectRecord(rec)}
                              className="admin-attendance-thumb-btn"
                              title="Click to view full photo verification"
                            >
                              <img 
                                src={rec.photoUrl} 
                                alt="Check-in Selfie" 
                                className="admin-attendance-thumb-img"
                              />
                              <div className="admin-attendance-thumb-overlay">
                                <Eye size={12} />
                              </div>
                            </button>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>
                              No Photo
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Close button in modal */}
          <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
            <button
              type="button"
              onClick={() => setShowTodayAttendanceModal(false)}
              className="erp-btn-primary"
              style={{ padding: "8px 18px", fontSize: "13px" }}
            >
              Close View
            </button>
          </div>
        </div>
      </Modal>

      {/* ── ATTENDANCE VERIFICATION & PHOTO INSPECTION MODAL ── */}
      <Modal
        isOpen={Boolean(selectedInspectRecord)}
        onClose={() => setSelectedInspectRecord(null)}
        title={selectedInspectRecord ? `Attendance Proof: ${selectedInspectRecord.engineerName}` : "Attendance Verification"}
        maxWidth="680px"
      >
        {selectedInspectRecord && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="admin-attendance-inspect-grid">
              
              {/* Photo Box */}
              <div className="admin-attendance-inspect-photo-box">
                {selectedInspectRecord.photoUrl ? (
                  <img 
                    src={selectedInspectRecord.photoUrl} 
                    alt="Engineer Check-in" 
                    className="admin-attendance-inspect-photo"
                  />
                ) : (
                  <div style={{ textAlign: "center", color: "#94a3b8" }}>
                    <HardHat size={36} style={{ marginBottom: "6px" }} />
                    <span style={{ fontSize: "11px", display: "block" }}>No photo proof</span>
                  </div>
                )}
              </div>

              {/* Details List */}
              <div className="admin-attendance-inspect-details">
                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">Site Engineer</span>
                  <span className="admin-attendance-inspect-val" style={{ fontSize: "14px", fontWeight: "800" }}>
                    {selectedInspectRecord.engineerName}
                  </span>
                  <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                    {selectedInspectRecord.engineerEmail} {selectedInspectRecord.engineerPhone ? `• ${selectedInspectRecord.engineerPhone}` : ""}
                  </span>
                </div>

                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">Assigned Site</span>
                  <span className="admin-attendance-inspect-val" style={{ color: "var(--brand-orange)" }}>
                    {selectedInspectRecord.siteName}
                  </span>
                  {selectedInspectRecord.clientName && (
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      Client: {selectedInspectRecord.clientName}
                    </span>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="admin-attendance-inspect-row">
                    <span className="admin-attendance-inspect-label">Check-In Time</span>
                    <span className="admin-attendance-inspect-val" style={{ color: "#16a34a" }}>
                      {selectedInspectRecord.checkInTimeFormatted}
                    </span>
                  </div>
                  <div className="admin-attendance-inspect-row">
                    <span className="admin-attendance-inspect-label">Check-Out Time</span>
                    <span className="admin-attendance-inspect-val" style={{ color: selectedInspectRecord.isCheckedOut ? "#2563eb" : "#f97316" }}>
                      {selectedInspectRecord.checkOutTimeFormatted || "Active On-Site"}
                    </span>
                  </div>
                </div>

                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">GPS Geofence Distance</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
                    {selectedInspectRecord.distance !== null && selectedInspectRecord.distance !== undefined ? (
                      <span className={`admin-attendance-distance-badge ${selectedInspectRecord.distance <= 150 ? "on-site" : "off-site"}`}>
                        <Navigation size={11} />
                        {selectedInspectRecord.distance < 1000 
                          ? `${Math.round(selectedInspectRecord.distance)} meters from site boundary` 
                          : `${(selectedInspectRecord.distance / 1000).toFixed(2)} km from site`}
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#64748b" }}>Standard GPS Logged</span>
                    )}

                    <span className="admin-attendance-gps-badge">
                      <ShieldCheck size={11} />
                      Verified
                    </span>
                  </div>
                </div>

                <div className="admin-attendance-inspect-row">
                  <span className="admin-attendance-inspect-label">Captured Location & Address</span>
                  <span className="admin-attendance-inspect-val" style={{ fontSize: "12px", lineHeight: "1.4" }}>
                    {selectedInspectRecord.addressDisplay}
                  </span>
                </div>
              </div>

            </div>

            {/* Check-Out Photo Preview if present */}
            {selectedInspectRecord.checkOutPhotoUrl && (
              <div style={{ padding: "12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span className="admin-attendance-inspect-label" style={{ display: "block", marginBottom: "8px" }}>
                  Check-Out Verification Photo
                </span>
                <div style={{ width: "100px", height: "100px", borderRadius: "6px", overflow: "hidden" }}>
                  <img 
                    src={selectedInspectRecord.checkOutPhotoUrl} 
                    alt="Check-out proof" 
                    style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                  />
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              {selectedInspectRecord.latitude && selectedInspectRecord.longitude ? (
                <a
                  href={`https://www.google.com/maps?q=${selectedInspectRecord.latitude},${selectedInspectRecord.longitude}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="erp-btn-secondary"
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px" }}
                >
                  <MapPin size={14} style={{ color: "#0284c7" }} />
                  Open in Google Maps
                  <ExternalLink size={12} />
                </a>
              ) : <div />}

              <button
                type="button"
                onClick={() => setSelectedInspectRecord(null)}
                className="erp-btn-primary"
                style={{ padding: "6px 18px", fontSize: "12.5px" }}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </Modal>

      <Loading show={loading} text="Loading Construction ERP..." />
    </Layout>
  );
}

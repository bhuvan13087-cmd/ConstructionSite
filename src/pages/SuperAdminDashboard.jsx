import React, { useState, useEffect, useMemo } from "react";
import { onSnapshot, collection, query, where, doc, limit } from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getSiteEngineers,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  approveSiteLocation,
  rejectSiteLocation,
  approveMaterialLog,
  rejectMaterialLog,
  getLabourMaster,
  getGeneralExpenses,
  getLabourPayments,
  getSystemActivities,
  resolveApprovalRequest,
  getAllDocuments,
  deduplicateDailyAttendance,
  subscribeAllLabourAttendance,
  subscribeCanonicalEngineers,
  resolveEngineerIdentity
} from "../services/firebaseService";
import {
  calculatePlannedProgress,
  getSiteFinancials,
  calculateOverallFinancials,
  isSiteDelayed,
  formatINR,
  getSiteBudget,
  formatDateDMY
} from "../services/businessLogic";
import {
  Building2,
  Users,
  MapPin,
  ClipboardCheck,
  TrendingUp,
  Calendar,
  AlertTriangle,
  Printer,
  ChevronRight,
  User,
  Activity,
  CheckCircle2,
  XCircle,
  FileText,
  DollarSign,
  Briefcase,
  Layers,
  ArrowRight,
  ArrowLeft,
  TrendingDown,
  Clock,
  Package,
  Search,
  Filter,
  Eye,
  ShieldAlert,
  FolderOpen,
  CheckSquare,
  Shield,
  ShieldCheck,
  UserCheck,
  Image as ImageIcon,
  ExternalLink,
  Info,
  LayoutGrid,
  List,
  Camera,
  Maximize2,
  Sparkles,
  RefreshCw
} from "lucide-react";
import { Link } from "react-router-dom";

export default function SuperAdminDashboard({ tab = "dashboard" }) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // ── Canonical Datasets from Firestore ──
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [admins, setAdmins] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [leaves, setLeaves] = useState([]);
  const [allDprs, setAllDprs] = useState([]);
  const [labourMaster, setLabourMaster] = useState({ categories: {}, history: [] });
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [labourPayments, setLabourPayments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [rawAttendance, setRawAttendance] = useState([]);
  const [rawLabourAttendance, setRawLabourAttendance] = useState([]);
  const [rawTeams, setRawTeams] = useState([]);
  const [assignments, setAssignments] = useState([]);

  // ── Executive Command Dashboard Specific States ──
  const [showTodayAttendanceModal, setShowTodayAttendanceModal] = useState(false);
  const [selectedInspectSite, setSelectedInspectSite] = useState(null);
  const [selectedInspectRecord, setSelectedInspectRecord] = useState(null);
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState("");
  const [dashboardActivityFilter, setDashboardActivityFilter] = useState("all");
  const [dashboardAttendanceSearch, setDashboardAttendanceSearch] = useState("");
  const [dashboardAttendanceSiteFilter, setDashboardAttendanceSiteFilter] = useState("");
  const [dashboardAttendanceStatusFilter, setDashboardAttendanceStatusFilter] = useState("all"); // 'all' | 'onsite' | 'checkout'
  const [siteModalActiveTab, setSiteModalActiveTab] = useState("engineers");

  // ── All Sites View States ──
  const [sitesViewMode, setSitesViewMode] = useState(() => {
    try {
      return localStorage.getItem("superadmin_sites_view") || "grid";
    } catch (e) {
      return "grid";
    }
  });
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [siteSearchQuery, setSiteSearchQuery] = useState("");
  const [siteStatusFilter, setSiteStatusFilter] = useState("all");
  const [selectedSiteTab, setSelectedSiteTab] = useState("overview");
  const [siteInspectionDate, setSiteInspectionDate] = useState("");

  // ── Modal Photo Preview ──
  const [selectedPreviewImage, setSelectedPreviewImage] = useState(null);

  // ── Engineers View State ──
  const [engineerSearchQuery, setEngineerSearchQuery] = useState("");
  const [selectedEngineerDetail, setSelectedEngineerDetail] = useState(null);

  // ── Admins View State ──
  const [adminSearchQuery, setAdminSearchQuery] = useState("");

  // ── Attendance View State ──
  const [attendanceSearchQuery, setAttendanceSearchQuery] = useState("");
  const [attendanceSiteFilter, setAttendanceSiteFilter] = useState("");
  const [attendanceStatusFilter, setAttendanceStatusFilter] = useState("all"); // 'all' | 'onsite' | 'checkout'
  const [attendanceDateFilter, setAttendanceDateFilter] = useState("");

  // ── Labour View State ──
  const [labourSearchQuery, setLabourSearchQuery] = useState("");
  const [labourSiteFilter, setLabourSiteFilter] = useState("");

  // ── Material & Finance Filters ──
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialSiteFilter, setMaterialSiteFilter] = useState("");
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [expenseSiteFilter, setExpenseSiteFilter] = useState("");

  // ── Activity Log Filter ──
  const [activitySearchQuery, setActivitySearchQuery] = useState("");
  const [activityModuleFilter, setActivityModuleFilter] = useState("all");

  const [laborHistoryMap, setLaborHistoryMap] = useState({});
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  // Custom Confirmation Modal state
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    details: null,
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "danger",
    onConfirm: null,
    isLoading: false
  });

  const showConfirmModal = (config) => {
    setConfirmModalState({
      isOpen: true,
      title: config.title || "Confirm Action",
      message: config.message || "Are you sure you want to proceed?",
      details: config.details || null,
      confirmText: config.confirmText || "Confirm",
      cancelText: config.cancelText || "Cancel",
      variant: config.variant || "danger",
      onConfirm: config.onConfirm || null,
      isLoading: false
    });
  };

  const closeConfirmModal = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  };

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const handleToggleViewMode = (mode) => {
    setSitesViewMode(mode);
    try {
      localStorage.setItem("superadmin_sites_view", mode);
    } catch (e) {}
  };

  // Today Date String normalizer
  const todayDateString = useMemo(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch (e) {
      return new Date().toISOString().split("T")[0];
    }
  }, []);

  const loadStaticData = async () => {
    try {
      const [fetchedLeaves, fetchedLabourMaster, fetchedLabourPayments, fetchedSysActivities] = await Promise.all([
        getAllLeaves().catch(() => []),
        getLabourMaster().catch(() => ({ categories: {}, history: [] })),
        getLabourPayments().catch(() => []),
        getSystemActivities().catch(() => [])
      ]);
      setLeaves(fetchedLeaves || []);
      setLabourMaster(fetchedLabourMaster || { categories: {}, history: [] });
      setLabourPayments(fetchedLabourPayments || []);
      setSystemActivities(fetchedSysActivities || []);
    } catch (err) {
      console.error("Static data load error:", err);
    }
  };

  useEffect(() => {
    const db = getFirebaseDb();

    // 1. Sites Listener
    const unsubSites = onSnapshot(collection(db, "sites"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setSites(list);
      setLoading(false);
    }, (err) => {
      console.error("Sites listener error:", err);
      setLoading(false);
    });

    // 2. Canonical Engineers Unified Listener (merges siteEngineers, users, siteAssignments)
    const unsubEngineers = subscribeCanonicalEngineers((list) => {
      setEngineers(list || []);
    });

    // 3. Admins Listener
    let unsubFallbackAdmins = null;
    const unsubAdmins = onSnapshot(collection(db, "admins"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, uid: docSnap.id, fullName: docSnap.data().name || docSnap.data().fullName || "", email: docSnap.data().email || "", role: "admin", ...docSnap.data() });
      });
      if (list.length > 0) {
        if (unsubFallbackAdmins) {
          unsubFallbackAdmins();
          unsubFallbackAdmins = null;
        }
        setAdmins(list);
      } else {
        if (unsubFallbackAdmins) unsubFallbackAdmins();
        const qUsers = query(collection(db, "users"), where("role", "in", ["admin", "super_admin", "superadmin"]));
        unsubFallbackAdmins = onSnapshot(qUsers, (uSnap) => {
          const uList = [];
          uSnap.forEach(d => {
            uList.push({ id: d.id, uid: d.id, fullName: d.data().name || d.data().fullName || "", email: d.data().email || "", role: d.data().role || "admin", ...d.data() });
          });
          setAdmins(uList);
        });
      }
    });

    // 4. Materials Listener (Excluding lock / metadata docs)
    const unsubMaterials = onSnapshot(collection(db, "materials"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id.startsWith("lock_") || docSnap.id.startsWith("material_lock_") || docSnap.id === "__material_master__" || data.type === "material_lock") {
          return;
        }
        list.push({ id: docSnap.id, ...data });
      });
      setMaterials(list);
    }, (err) => {
      console.error("Materials listener error:", err);
    });

    // 5. Reports (DPRs) Listener
    const unsubReports = onSnapshot(collection(db, "reports"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllDprs(list);
    });

    // 6. Labour Daily Counts Listener
    const unsubLabour = onSnapshot(collection(db, "labourDailyCount"), (snapshot) => {
      const map = {};
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        const sId = data.siteId;
        if (sId) {
          if (!map[sId]) map[sId] = [];
          map[sId].push({ id: docSnap.id, ...data });
        }
      });
      setLaborHistoryMap(map);
    });

    // 7. Labour Attendance Listener
    const unsubLabourAtt = subscribeAllLabourAttendance((list) => {
      setRawLabourAttendance(list || []);
    });

    // 8. Labour Teams Listener
    const unsubTeams = onSnapshot(collection(db, "labourTeams"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawTeams(list);
    });

    // 9. Site Assignments Listener
    const unsubAssignments = onSnapshot(collection(db, "siteAssignments"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAssignments(list);
    });

    // 10. Attendance Listener
    const unsubAttendance = onSnapshot(collection(db, "attendance"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawAttendance(list);
    });

    // 11. Approvals Listener
    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setApprovals(list);
    });

    // 12. Documents Listener
    const unsubDocs = onSnapshot(collection(db, "documents"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDocuments(list);
    });

    // 13. General Expenses Listener
    const unsubExpenses = onSnapshot(doc(db, "expenses", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setGeneralExpenses(snapshot.data().expenses || []);
      } else {
        setGeneralExpenses([]);
      }
    }, (err) => {
      console.error("Expenses super admin listener error:", err);
    });

    loadStaticData();

    return () => {
      unsubSites();
      unsubEngineers();
      unsubAdmins();
      if (unsubFallbackAdmins) unsubFallbackAdmins();
      unsubMaterials();
      unsubReports();
      unsubLabour();
      unsubLabourAtt();
      unsubTeams();
      unsubAssignments();
      unsubAttendance();
      unsubApprovals();
      unsubDocs();
      unsubExpenses();
    };
  }, []);

  // Pre-calculate financial logs
  const flatLaborHistory = useMemo(() => {
    const list = [];
    Object.keys(laborHistoryMap).forEach(siteId => {
      laborHistoryMap[siteId].forEach(l => {
        list.push({ ...l, siteId });
      });
    });
    return list;
  }, [laborHistoryMap]);

  const overallMetrics = useMemo(() => {
    return calculateOverallFinancials(sites, materials, flatLaborHistory, allDprs, labourMaster.categories, generalExpenses, labourPayments);
  }, [sites, materials, flatLaborHistory, allDprs, labourMaster, generalExpenses, labourPayments]);

  // Engineers Map (Multi-key index)
  const engineersMap = useMemo(() => {
    const map = {};
    engineers.forEach(e => {
      const name = e.fullName || e.name || e.displayName || "Site Engineer";
      if (e.id) map[e.id] = name;
      if (e.uid) map[e.uid] = name;
      if (e.docId) map[e.docId] = name;
      if (e.customId) map[e.customId] = name;
      if (e.engineerId) map[e.engineerId] = name;
      if (e.email) {
        map[e.email.toLowerCase()] = name;
        map[e.email] = name;
      }
    });
    return map;
  }, [engineers]);

  // Canonical Deduplicated Attendance Records
  const allDeduplicatedAttendance = useMemo(() => {
    const deduplicated = deduplicateDailyAttendance(rawAttendance);
    return deduplicated.map(rec => {
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
        resolvedSiteId: rec.siteId,
        siteName: site?.siteName || rec.siteName || "Assigned Site",
        checkInTimeFormatted: checkInTime,
        checkOutTimeFormatted: checkOutTime,
        isCheckedOut,
        isVerified,
        photoUrl: rec.photoUrl || rec.checkInPhotoUrl || null,
        checkOutPhotoUrl: rec.checkOutPhotoUrl || null
      };
    }).sort((a, b) => {
      const tA = a.checkInTime?.seconds ? a.checkInTime.seconds * 1000 : (a.timestamp?.seconds ? a.timestamp.seconds * 1000 : 0);
      const tB = b.checkInTime?.seconds ? b.checkInTime.seconds * 1000 : (b.timestamp?.seconds ? b.timestamp.seconds * 1000 : 0);
      return tB - tA;
    });
  }, [rawAttendance, engineers, sites]);

  // Today's Engineer Attendance List
  const todayAttendanceList = useMemo(() => {
    return allDeduplicatedAttendance.filter(r => {
      const d = r.date || r.attendanceDate;
      return d === todayDateString;
    });
  }, [allDeduplicatedAttendance, todayDateString]);

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

  const filteredDashboardAttendance = useMemo(() => {
    return todayAttendanceList.filter(rec => {
      if (dashboardAttendanceStatusFilter === "onsite" && rec.isCheckedOut) return false;
      if (dashboardAttendanceStatusFilter === "checkout" && !rec.isCheckedOut) return false;
      if (dashboardAttendanceSiteFilter && rec.resolvedSiteId !== dashboardAttendanceSiteFilter) return false;
      if (dashboardAttendanceSearch.trim()) {
        const q = dashboardAttendanceSearch.toLowerCase().trim();
        const mName = (rec.engineerName || "").toLowerCase().includes(q);
        const mSite = (rec.siteName || "").toLowerCase().includes(q);
        const mEmail = (rec.engineerEmail || "").toLowerCase().includes(q);
        if (!mName && !mSite && !mEmail) return false;
      }
      return true;
    });
  }, [todayAttendanceList, dashboardAttendanceStatusFilter, dashboardAttendanceSiteFilter, dashboardAttendanceSearch]);

  // Today's Labour Count Total
  const todayLabourCount = useMemo(() => {
    let count = 0;
    (rawLabourAttendance || []).forEach(r => {
      if (!r || r.lockedMetadata) return;
      const dateField = r.attendanceDate || r.date;
      if (dateField === todayDateString) {
        const workerCount = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
        count += workerCount;
      }
    });
    return count;
  }, [rawLabourAttendance, todayDateString]);

  // Pending Approvals
  const allApprovalRequests = useMemo(() => {
    return approvals
      .filter(r => (r.status || "").toLowerCase() === "pending" && r.type !== "Material")
      .map(r => ({
        id: r.id,
        type: r.type,
        employeeName: r.requestedBy,
        details: r.details,
        requestDate: r.requestDate,
        latitude: r.raw?.proposedLatitude || 0,
        longitude: r.raw?.proposedLongitude || 0,
        quantity: r.raw?.quantity || 0,
        supplier: r.raw?.supplierName || "N/A",
        raw: r.raw
      }))
      .sort((a, b) => (b.requestDate || "").localeCompare(a.requestDate || ""));
  }, [approvals]);

  const handleApproveRequest = async (req) => {
    showConfirmModal({
      title: `Approve ${req.type} Request?`,
      message: `Are you sure you want to approve this ${req.type} request from ${req.requestedBy || 'engineer'}?`,
      details: req.details ? `Details: ${req.details}` : null,
      confirmText: "Approve Request",
      variant: "success",
      onConfirm: async () => {
        setDataLoading(true);
        try {
          await resolveApprovalRequest(req.id, "Approved", userProfile?.id || "superadmin", userProfile?.fullName || "Super Admin");
          showToast(`${req.type} request approved successfully.`, "success");
          await loadStaticData();
        } catch (err) {
          console.error("Approve failed:", err);
          showToast(`Approval failed: ${err.message}`, "error");
        } finally {
          setDataLoading(false);
          closeConfirmModal();
        }
      }
    });
  };

  const handleRejectRequest = async (req) => {
    showConfirmModal({
      title: `Reject ${req.type} Request?`,
      message: `Are you sure you want to reject this ${req.type} request from ${req.requestedBy || 'engineer'}?`,
      details: req.details ? `Details: ${req.details}` : null,
      confirmText: "Reject Request",
      variant: "danger",
      onConfirm: async () => {
        setDataLoading(true);
        try {
          await resolveApprovalRequest(req.id, "Rejected", userProfile?.id || "superadmin", userProfile?.fullName || "Super Admin");
          showToast(`${req.type} request rejected.`, "info");
          await loadStaticData();
        } catch (err) {
          console.error("Reject failed:", err);
          showToast(`Rejection failed: ${err.message}`, "error");
        } finally {
          setDataLoading(false);
          closeConfirmModal();
        }
      }
    });
  };

  if (loading) {
    return (
      <Layout title="Super Admin Console" description="Synchronizing master corporate tables...">
        <Loading show={true} text="Initializing Management Dashboard..." />
      </Layout>
    );
  }

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 1: EXECUTIVE COMMAND DASHBOARD (SUPER ADMIN HIGH-LEVEL MONITORING)
  // ══════════════════════════════════════════════════════════════════════════
  const renderDashboardView = () => {
    // 1. Core Computed Quantities
    const activeSitesList = sites.filter(s => (s.status || "active").toLowerCase() === "active" || (s.status || "").toLowerCase() === "running");
    const activeSitesCount = activeSitesList.length;
    const completedSitesCount = sites.filter(s => (s.status || "").toLowerCase() === "completed").length;
    const delayedSitesCount = sites.filter(s => (s.status || "").toLowerCase() === "delayed" || isSiteDelayed(s)).length;
    const onHoldSitesCount = sites.filter(s => (s.status || "").toLowerCase() === "on-hold" || (s.status || "").toLowerCase() === "paused").length;
    
    // Site Engineers & Attendance Pulse
    const activeEngineersList = engineers.filter(e => (e.status || "active").toLowerCase() === "active");
    const activeEngineersCount = activeEngineersList.length;
    const presentEngineersSet = new Set(todayAttendanceList.map(r => r.resolvedEngineerId || r.engineerName));
    const presentCount = presentEngineersSet.size;
    const onSiteCount = todayAttendanceList.filter(r => !r.isCheckedOut).length;
    const checkedOutCount = todayAttendanceList.filter(r => r.isCheckedOut).length;
    const verifiedCount = todayAttendanceList.filter(r => r.isVerified).length;
    const attendanceRate = activeEngineersCount > 0 ? Math.round((presentCount / activeEngineersCount) * 100) : 0;
    
    const sitesWithAttendanceSet = new Set(todayAttendanceList.map(r => r.resolvedSiteId));
    const activeSitesWithAttendanceCount = activeSitesList.filter(s => sitesWithAttendanceSet.has(s.id)).length;
    
    // Labour Pulse
    const sitesWithLabourTodaySet = new Set(
      (rawLabourAttendance || [])
        .filter(r => !r.lockedMetadata && (r.attendanceDate === todayDateString || r.date === todayDateString))
        .map(r => r.siteId)
    );

    // Today's Expense Sums
    let todayLabourExpense = 0;
    (rawLabourAttendance || []).forEach(r => {
      if (!r || r.lockedMetadata) return;
      const dateField = r.attendanceDate || r.date;
      if (dateField === todayDateString) {
        const workerCount = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
        const rate = Number(r.dailyWage || r.rate || r.categoryRate) || 0;
        todayLabourExpense += Number(r.totalAmount || (workerCount * rate));
      }
    });

    let todayMaterialExpense = 0;
    materials.forEach(m => {
      const mDate = m.date || (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
      if (mDate === todayDateString) {
        const qty = Number(m.quantity || m.currentStock) || 0;
        const rate = Number(m.unitRate || m.rate) || 0;
        todayMaterialExpense += Number(m.totalCost) || (qty * rate);
      }
    });

    let todayGeneralExpense = 0;
    generalExpenses.forEach(e => {
      if ((e.date || "").startsWith(todayDateString)) {
        todayGeneralExpense += Number(e.amount) || 0;
      }
    });

    const todayTotalExpenses = todayLabourExpense + todayMaterialExpense + todayGeneralExpense;

    // Financial Health
    const netPosition = overallMetrics.totalPaymentsReceived - overallMetrics.totalExpenses;
    const isProfit = netPosition >= 0;

    // 2. Expense Category Breakdown for Analytics Chart
    const expenseBreakdown = {
      "Material": 0,
      "Labour": 0,
      "General": 0,
      "Fuel & Equipment": 0
    };
    materials.forEach(m => {
      const qty = Number(m.quantity || m.currentStock) || 0;
      const rate = Number(m.unitRate || m.rate) || 0;
      expenseBreakdown["Material"] += Number(m.totalCost) || (qty * rate);
    });
    (rawLabourAttendance || []).forEach(r => {
      if (!r || r.lockedMetadata) return;
      const workerCount = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
      const rate = Number(r.dailyWage || r.rate || r.categoryRate) || 0;
      expenseBreakdown["Labour"] += Number(r.totalAmount || (workerCount * rate));
    });
    generalExpenses.forEach(e => {
      const cat = (e.category || "General").trim();
      const amt = Number(e.amount) || 0;
      if (cat.toLowerCase().includes("fuel") || cat.toLowerCase().includes("equipment") || cat.toLowerCase().includes("machinery")) {
        expenseBreakdown["Fuel & Equipment"] += amt;
      } else if (cat.toLowerCase().includes("material")) {
        expenseBreakdown["Material"] += amt;
      } else if (cat.toLowerCase().includes("labour") || cat.toLowerCase().includes("worker")) {
        expenseBreakdown["Labour"] += amt;
      } else {
        expenseBreakdown["General"] += amt;
      }
    });
    const totalCategorizedExpenses = Object.values(expenseBreakdown).reduce((a, b) => a + b, 0) || 1;

    // 3. Upcoming Deadlines
    const upcomingDeadlinesList = sites
      .filter(s => s.expectedEndDate && (s.status || "").toLowerCase() !== "completed")
      .sort((a, b) => (a.expectedEndDate || "").localeCompare(b.expectedEndDate || ""))
      .slice(0, 4);

    // 4. Executive Decision Alerts (Safe derived data only)
    const alerts = [];
    const nowMs = Date.now();

    activeSitesList.forEach(s => {
      if (!sitesWithAttendanceSet.has(s.id)) {
        alerts.push({
          id: `alert_sa_att_${s.id}`,
          type: 'danger',
          category: 'Missing Attendance',
          title: `No Attendance Logged: ${s.siteName}`,
          message: `Active project "${s.siteName}" has zero field engineer check-ins recorded today.`,
          link: `/superadmin/attendance`
        });
      }
    });

    activeSitesList.forEach(s => {
      if (!sitesWithLabourTodaySet.has(s.id)) {
        alerts.push({
          id: `alert_sa_lab_${s.id}`,
          type: 'warning',
          category: 'Missing Labour',
          title: `No Labour Force Logged: ${s.siteName}`,
          message: `No daily worker attendance filed today for active project "${s.siteName}".`,
          link: `/superadmin/labour`
        });
      }
    });

    sites.forEach(site => {
      if (site.status === 'Delayed' || isSiteDelayed(site)) {
        const planned = calculatePlannedProgress(site.startDate, site.expectedEndDate);
        const prog = site.progress !== undefined ? Number(site.progress) : 0;
        const gap = Math.max(0, planned - prog);
        alerts.push({
          id: `alert_sa_delay_${site.id}`,
          type: 'danger',
          category: 'Schedule Delay',
          title: `Milestone Delayed: ${site.siteName}`,
          message: `Progress is ${prog}% vs planned target ${planned}% (-${gap}% gap). Expected: ${formatDateDMY(site.expectedEndDate)}.`,
          link: `/superadmin/progress`
        });
      }
    });

    generalExpenses.forEach(exp => {
      if (Number(exp.amount) >= 100000) {
        alerts.push({
          id: `alert_sa_high_${exp.id}`,
          type: 'warning',
          category: 'Payment Alert',
          title: `High-Value Field Payment: ₹${Number(exp.amount).toLocaleString()}`,
          message: `Expense for "${exp.description}" has been logged at ${sites.find(s => s.id === exp.siteId)?.siteName || 'Site'}.`,
          link: `/superadmin/finance`
        });
      }
    });

    approvals.forEach(a => {
      if ((a.status || '').toLowerCase() === 'pending') {
        const createdMs = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt ? new Date(a.createdAt).getTime() : nowMs);
        const diffHours = (nowMs - createdMs) / (1000 * 60 * 60);
        if (diffHours >= 48) {
          alerts.push({
            id: `alert_sa_app_${a.id}`,
            type: 'warning',
            category: 'Pending Approval',
            title: `Awaiting Sign-off: ${a.type} Request`,
            message: `${a.type} request from ${a.requestedBy || 'Engineer'} for ${a.siteName || 'Site'} has been pending over 48 hours.`,
            link: `/superadmin/approvals`
          });
        }
      }
    });

    // 5. Today's Real-Time Operations Activity Feed (Live Chronological Stream)
    const todayFeedList = [];
    
    todayAttendanceList.forEach(rec => {
      todayFeedList.push({
        id: `att_in_${rec.id}`,
        module: "Attendance",
        moduleType: "attendance",
        badgeStatus: "success",
        title: `${rec.engineerName} Checked In`,
        description: `Logged on-site presence at ${rec.siteName} (${rec.isVerified ? "GPS Verified" : "Pending GPS"})`,
        time: rec.checkInTimeFormatted,
        timestamp: rec.checkInTime?.seconds ? rec.checkInTime.seconds * 1000 : (rec.timestamp?.seconds ? rec.timestamp.seconds * 1000 : 0),
        siteName: rec.siteName,
        user: rec.engineerName,
        photoUrl: rec.photoUrl
      });
      if (rec.isCheckedOut && rec.checkOutTimeFormatted) {
        todayFeedList.push({
          id: `att_out_${rec.id}`,
          module: "Attendance",
          moduleType: "attendance",
          badgeStatus: "default",
          title: `${rec.engineerName} Checked Out`,
          description: `Checked out from ${rec.siteName}`,
          time: rec.checkOutTimeFormatted,
          timestamp: rec.checkOutTime?.seconds ? rec.checkOutTime.seconds * 1000 : 0,
          siteName: rec.siteName,
          user: rec.engineerName,
          photoUrl: rec.checkOutPhotoUrl
        });
      }
    });

    (rawLabourAttendance || []).forEach(r => {
      if (!r || r.lockedMetadata) return;
      const dateField = r.attendanceDate || r.date;
      if (dateField === todayDateString) {
        const site = sites.find(s => s.id === r.siteId);
        const workerCount = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
        const rate = Number(r.dailyWage || r.rate || r.categoryRate) || 0;
        const total = Number(r.totalAmount || (workerCount * rate));
        todayFeedList.push({
          id: `lab_${r.id}`,
          module: "Labour",
          moduleType: "labour",
          badgeStatus: "info",
          title: `Labour Workforce Logged: ${workerCount} Workers`,
          description: `${r.categoryName || r.category || "General Labour"} added at ${site?.siteName || "Site"} — ₹${total.toLocaleString()}`,
          time: r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: r.createdAt?.seconds ? r.createdAt.seconds * 1000 : 0,
          siteName: site?.siteName || "Site",
          user: r.recordedByName || r.engineerName || "Site Engineer"
        });
      }
    });

    materials.forEach(m => {
      const mDate = m.date || (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
      if (mDate === todayDateString) {
        const site = sites.find(s => s.id === m.siteId);
        todayFeedList.push({
          id: `mat_${m.id}`,
          module: "Materials",
          moduleType: "materials",
          badgeStatus: "info",
          title: `Material Received: ${m.materialName || m.name || "Item"}`,
          description: `${m.quantity || 0} ${m.unit || "units"} added at ${site?.siteName || "Site"}`,
          time: m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: m.createdAt?.seconds ? m.createdAt.seconds * 1000 : 0,
          siteName: site?.siteName || "Site",
          user: m.engineerName || m.recordedByName || "Site Engineer"
        });
      }
    });

    generalExpenses.forEach(exp => {
      if ((exp.date || "").startsWith(todayDateString)) {
        const site = sites.find(s => s.id === exp.siteId);
        todayFeedList.push({
          id: `exp_${exp.id}`,
          module: "Expenses",
          moduleType: "expenses",
          badgeStatus: "warning",
          title: `Expense Logged: ₹${Number(exp.amount || 0).toLocaleString()}`,
          description: `"${exp.description}" (${exp.category || "General"}) at ${site?.siteName || "Site"}`,
          time: exp.createdAt?.seconds ? new Date(exp.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: exp.createdAt?.seconds ? exp.createdAt.seconds * 1000 : 0,
          siteName: site?.siteName || "Site",
          user: exp.recordedByName || "Administrator"
        });
      }
    });

    allDprs.forEach(dpr => {
      const dDate = dpr.date || (dpr.createdAt?.seconds ? new Date(dpr.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
      if (dDate === todayDateString) {
        const site = sites.find(s => s.id === dpr.siteId);
        todayFeedList.push({
          id: `dpr_${dpr.id}`,
          module: "Reports",
          moduleType: "reports",
          badgeStatus: "success",
          title: `DPR Submitted: ${dpr.workDescription ? dpr.workDescription.substring(0, 36) + '...' : "Daily Progress Report"}`,
          description: `Progress updated for ${site?.siteName || "Site"}${dpr.weather ? ` • Weather: ${dpr.weather}` : ''}`,
          time: dpr.createdAt?.seconds ? new Date(dpr.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: dpr.createdAt?.seconds ? dpr.createdAt.seconds * 1000 : 0,
          siteName: site?.siteName || "Site",
          user: dpr.submittedByName || dpr.engineerName || "Site Engineer"
        });
      }
    });

    systemActivities.forEach(act => {
      const actDate = act.createdAt?.seconds ? new Date(act.createdAt.seconds * 1000).toISOString().split("T")[0] : "";
      if (actDate === todayDateString && !todayFeedList.some(item => item.id.includes(act.id))) {
        todayFeedList.push({
          id: `act_${act.id}`,
          module: act.moduleType || "General",
          moduleType: (act.moduleType || "general").toLowerCase(),
          badgeStatus: "info",
          title: act.description || act.actionType || "System event",
          description: `Module: ${act.moduleType} at ${act.siteName || "Enterprise"}`,
          time: act.createdAt?.seconds ? new Date(act.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: act.createdAt?.seconds ? act.createdAt.seconds * 1000 : 0,
          siteName: act.siteName || "Enterprise",
          user: act.userName || "System"
        });
      }
    });

    todayFeedList.sort((a, b) => b.timestamp - a.timestamp);

    const filteredTodayFeed = todayFeedList.filter(item => {
      if (dashboardActivityFilter === "all") return true;
      return item.moduleType === dashboardActivityFilter;
    });

    // 6. Active Projects Operations Matrix Filtering
    const filteredActiveSites = activeSitesList.filter(site => {
      if (!dashboardSearchQuery.trim()) return true;
      const q = dashboardSearchQuery.toLowerCase().trim();
      return (
        (site.siteName || "").toLowerCase().includes(q) ||
        (site.clientName || "").toLowerCase().includes(q) ||
        (site.location || "").toLowerCase().includes(q)
      );
    });

    return (
      <div className="admin-dashboard-container">

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 1: TOP EXECUTIVE COMMAND METRIC CARDS (10 UNIFIED CARDS)    */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="admin-summary-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}>

          {/* Card 1: Sites Pulse */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <Building2 size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{overallMetrics.totalSites}</div>
              <div className="admin-summary-label">Total Sites</div>
              <span style={{ fontSize: "10.5px", color: "var(--success-600)", fontWeight: "700" }}>
                {activeSitesCount} Active • {completedSitesCount} Done
              </span>
            </div>
          </div>

          {/* Card 2: Running Projects */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-blue">
              <Activity size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{activeSitesCount}</div>
              <div className="admin-summary-label">Running Projects</div>
              <span style={{ fontSize: "10.5px", color: delayedSitesCount > 0 ? "#dc2626" : "var(--text-muted)", fontWeight: "600" }}>
                {delayedSitesCount > 0 ? `${delayedSitesCount} Delayed` : "All on Track"}
              </span>
            </div>
          </div>

          {/* Card 3: Site Engineers */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-purple">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{engineers.length}</div>
              <div className="admin-summary-label">Site Engineers</div>
              <span style={{ fontSize: "10.5px", color: "#a855f7", fontWeight: "700" }}>
                {activeEngineersCount} Active • {presentCount} Present
              </span>
            </div>
          </div>

          {/* Card 4: Today's Labour Force */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <Briefcase size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{todayLabourCount}</div>
              <div className="admin-summary-label">Today's Labour</div>
              <span style={{ fontSize: "10.5px", color: "#c2410c", fontWeight: "700" }}>
                Across {sitesWithLabourTodaySet.size} Active Sites
              </span>
            </div>
          </div>

          {/* Card 5: Today's Attendance */}
          <div className="admin-summary-card" style={todayAttendanceList.length > 0 ? { borderColor: "#bbf7d0" } : {}}>
            <div className="admin-summary-icon erp-kpi-icon-green">
              <UserCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{presentCount}/{activeEngineersCount}</div>
              <div className="admin-summary-label">Today's Attendance</div>
              <span style={{ fontSize: "10.5px", color: "#16a34a", fontWeight: "700" }}>
                {attendanceRate}% • {onSiteCount} On-Site
              </span>
            </div>
          </div>

          {/* Card 6: Today's Total Expenses */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "14px" }}>{formatINR(todayTotalExpenses)}</div>
              <div className="admin-summary-label">Today's Expenses</div>
              <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: "600" }}>
                Labour + Mat + Gen
              </span>
            </div>
          </div>

          {/* Card 7: Corporate Budget Portfolio */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-teal">
              <TrendingUp size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "14px" }}>{formatINR(overallMetrics.totalProjectValue)}</div>
              <div className="admin-summary-label">Portfolio Budget</div>
              <span style={{ fontSize: "10.5px", color: "#0d9488", fontWeight: "700" }}>
                Total Contract Value
              </span>
            </div>
          </div>

          {/* Card 8: Total Spent */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "14px" }}>{formatINR(overallMetrics.totalExpenses)}</div>
              <div className="admin-summary-label">Total Spent</div>
              <span style={{ fontSize: "10.5px", color: "var(--warning-600)", fontWeight: "600" }}>
                Owed: {formatINR(overallMetrics.pendingPayments)}
              </span>
            </div>
          </div>

          {/* Card 9: Net Cash Position */}
          <div className="admin-summary-card" style={{ borderColor: isProfit ? "#bbf7d0" : "#fecaca", backgroundColor: isProfit ? "#f0fdf4" : "#fef2f2" }}>
            <div className={`admin-summary-icon ${isProfit ? "erp-kpi-icon-green" : "erp-kpi-icon-red"}`}>
              {isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "14px", color: isProfit ? "#16a34a" : "#dc2626" }}>
                {isProfit ? "+" : ""}{formatINR(netPosition)}
              </div>
              <div className="admin-summary-label">Net Position</div>
              <span style={{ fontSize: "10.5px", color: isProfit ? "#16a34a" : "#dc2626", fontWeight: "700" }}>
                {isProfit ? "Cash Surplus" : "Cash Deficit"}
              </span>
            </div>
          </div>

          {/* Card 10: Material Stock Items */}
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <Package size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{materials.length}</div>
              <div className="admin-summary-label">Material Items</div>
              <span style={{ fontSize: "10.5px", color: "var(--text-muted)", fontWeight: "600" }}>
                Tracked Stock Lines
              </span>
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 2: EXECUTIVE DECISION ALERTS / ATTENTION CENTER              */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        {alerts.length > 0 && (
          <div className="admin-card" style={{ borderLeft: "4px solid #ef4444", padding: "16px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <AlertTriangle size={18} style={{ color: "#dc2626" }} />
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>
                  Executive Attention Alerts ({alerts.length})
                </h3>
              </div>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#dc2626", backgroundColor: "#fee2e2", padding: "2px 8px", borderRadius: "10px" }}>
                Action Required
              </span>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "10px" }}>
              {(showAllAlerts ? alerts : alerts.slice(0, 4)).map(alert => (
                <div 
                  key={alert.id} 
                  style={{ 
                    padding: "10px 12px", 
                    borderRadius: "8px", 
                    backgroundColor: alert.type === "danger" ? "#fef2f2" : "#fffbeb",
                    border: `1px solid ${alert.type === "danger" ? "#fecaca" : "#fef3c7"}`,
                    display: "flex",
                    flexDirection: "column",
                    gap: "4px"
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <span style={{ 
                      fontSize: "10px", 
                      fontWeight: "800", 
                      textTransform: "uppercase", 
                      letterSpacing: "0.4px",
                      color: alert.type === "danger" ? "#b91c1c" : "#b45309"
                    }}>
                      [{alert.category}]
                    </span>
                    {alert.link && (
                      <Link to={alert.link} style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", textDecoration: "none" }}>
                        Review →
                      </Link>
                    )}
                  </div>
                  <strong style={{ fontSize: "12px", color: "var(--primary-950)" }}>{alert.title}</strong>
                  <p style={{ margin: 0, fontSize: "11.5px", color: "var(--primary-700)", lineHeight: "1.4" }}>{alert.message}</p>
                </div>
              ))}
            </div>

            {alerts.length > 4 && (
              <div style={{ marginTop: "12px", paddingTop: "10px", borderTop: "1px solid var(--border-color)", textAlign: "center" }}>
                <button
                  type="button"
                  onClick={() => setShowAllAlerts(!showAllAlerts)}
                  style={{ background: "none", border: "none", color: "var(--primary-600)", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                >
                  {showAllAlerts ? "Show Less" : `View All ${alerts.length} Operations Alerts`}
                </button>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 3: REAL-TIME ATTENDANCE COMMAND BANNER                        */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="admin-attendance-card">
          <div className="admin-attendance-header-row">
            <div className="admin-attendance-title-group">
              <div className="admin-attendance-icon-wrap">
                <ClipboardCheck size={22} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h3 className="admin-attendance-title">Master Attendance &amp; Field Presence Command</h3>
                  <div className="admin-attendance-live-badge">
                    <span className="admin-attendance-live-dot" />
                    Live Real-Time Sync
                  </div>
                </div>
                <p className="admin-attendance-subtitle">
                  Real-time synchronization across all active sites for {formattedTodayDate}.
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <button
                type="button"
                className="erp-btn-primary"
                onClick={() => setShowTodayAttendanceModal(true)}
                style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <ClipboardCheck size={14} />
                Attendance Ledger ({todayAttendanceList.length})
              </button>
              <Link
                to="/superadmin/attendance"
                className="erp-btn-secondary"
                style={{ fontSize: "12px", padding: "6px 14px", display: "inline-flex", alignItems: "center", gap: "6px", textDecoration: "none" }}
              >
                <ExternalLink size={14} />
                Full Attendance Monitor
              </Link>
            </div>
          </div>

          <div className="admin-attendance-metrics">
            <div className="admin-attendance-metric-pill present">
              <UserCheck size={14} />
              <span>Present: {presentCount}/{activeEngineersCount} ({attendanceRate}%)</span>
            </div>
            <div className="admin-attendance-metric-pill onsite">
              <Clock size={14} />
              <span>On-Site Now: {onSiteCount}</span>
            </div>
            <div className="admin-attendance-metric-pill checkout">
              <CheckCircle2 size={14} />
              <span>Checked Out: {checkedOutCount}</span>
            </div>
            <div className="admin-attendance-metric-pill verified">
              <ShieldCheck size={14} />
              <span>GPS Verified: {verifiedCount}</span>
            </div>
            <div className="admin-attendance-metric-pill" style={{ backgroundColor: "#f8fafc", color: "#475569", border: "1px solid #e2e8f0" }}>
              <Building2 size={14} />
              <span>Sites Active: {activeSitesWithAttendanceCount}/{activeSitesCount}</span>
            </div>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 4: 3-CARD HIGH-LEVEL ANALYTICS & INSIGHTS ROW                */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="admin-analytics-grid">

          {/* Analytics Card 1: Construction Site Lifecycle Standing */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Construction Projects Status</h3>
                <p className="admin-card-subtitle">Organization portfolio lifecycle overview</p>
              </div>
            </div>
            <div className="admin-status-grid">
              <div className="admin-status-box running">
                <span className="admin-status-count">{activeSitesCount}</span>
                <span className="admin-status-name">Running / Active</span>
              </div>
              <div className="admin-status-box completed">
                <span className="admin-status-count">{completedSitesCount}</span>
                <span className="admin-status-name">Completed</span>
              </div>
              <div className="admin-status-box on-hold">
                <span className="admin-status-count">{onHoldSitesCount}</span>
                <span className="admin-status-name">On Hold / Paused</span>
              </div>
              <div className="admin-status-box delayed">
                <span className="admin-status-count">{delayedSitesCount}</span>
                <span className="admin-status-name">Delayed Milestone</span>
              </div>
            </div>
          </div>

          {/* Analytics Card 2: Corporate Expense Category Breakdown */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Expense Allocation Breakdown</h3>
                <p className="admin-card-subtitle">Distribution across critical expenditure heads</p>
              </div>
            </div>
            <div className="admin-expense-list">
              {Object.entries(expenseBreakdown).map(([category, amount]) => {
                const pct = Math.round((amount / totalCategorizedExpenses) * 100);
                const colorClass = category === "Material" ? "material" : category === "Labour" ? "labor" : category === "Fuel & Equipment" ? "equipment" : "others";
                return (
                  <div key={category} className="admin-expense-item">
                    <div className="admin-expense-meta">
                      <span className="admin-expense-cat">{category}</span>
                      <span className="admin-expense-pct">{pct}% • {formatINR(amount)}</span>
                    </div>
                    <div className="admin-progress-track">
                      <div className={`admin-progress-fill ${colorClass}`} style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Analytics Card 3: Corporate Progress Standing & Milestone Schedule */}
          <div className="admin-card">
            <div className="admin-card-header">
              <div>
                <h3 className="admin-card-title">Corporate Milestone Schedule</h3>
                <p className="admin-card-subtitle">Upcoming target completions &amp; progress</p>
              </div>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {/* Circular Gauge / Summary Bar */}
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", display: "block" }}>
                    Corporate Average Execution
                  </span>
                  <span style={{ fontSize: "20px", fontWeight: "900", color: "var(--primary-950)" }}>
                    {overallMetrics.overallProgressPercent}% Complete
                  </span>
                </div>
                <div style={{
                  width: "48px",
                  height: "48px",
                  borderRadius: "50%",
                  background: `conic-gradient(var(--primary-600) ${overallMetrics.overallProgressPercent}%, #e2e8f0 0)`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "11px", fontWeight: "800" }}>
                    {overallMetrics.overallProgressPercent}%
                  </div>
                </div>
              </div>

              {/* Upcoming Deadlines */}
              <div className="admin-deadlines-list">
                {upcomingDeadlinesList.length === 0 ? (
                  <div style={{ textAlign: "center", padding: "16px", color: "var(--text-muted)", fontSize: "12px" }}>
                    No upcoming deadlines recorded.
                  </div>
                ) : (
                  upcomingDeadlinesList.map(site => {
                    const daysLeft = Math.ceil((new Date(site.expectedEndDate).getTime() - Date.now()) / (1000 * 60 * 60 * 24));
                    const isUrgent = daysLeft <= 14;
                    return (
                      <div key={site.id} className="admin-deadline-item" style={{ padding: "6px 0" }}>
                        <div className="admin-deadline-info">
                          <span className="admin-deadline-name" style={{ fontSize: "12.5px" }}>{site.siteName}</span>
                          <span className="admin-deadline-date" style={{ fontSize: "11px" }}>Target: {formatDateDMY(site.expectedEndDate)}</span>
                        </div>
                        <span className={`admin-deadline-badge ${isUrgent ? "urgent" : "normal"}`} style={{ fontSize: "10.5px" }}>
                          {daysLeft > 0 ? `${daysLeft} days left` : "Overdue"}
                        </span>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>

        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 5: ACTIVE PROJECTS OPERATIONS COMMAND MATRIX                 */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="admin-table-card">
          <div className="admin-table-header">
            <div>
              <h3 className="admin-card-title">Active Projects Operations Matrix</h3>
              <p className="admin-card-subtitle">
                Live monitoring of engineer presence, daily labour force, materials, expenses, and execution progress across active sites.
              </p>
            </div>

            <div className="sites-actions-group">
              <div className="sites-search-wrapper" style={{ minWidth: "220px" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search active site, client, location..."
                  value={dashboardSearchQuery}
                  onChange={(e) => setDashboardSearchQuery(e.target.value)}
                  style={{ width: "100%", height: "36px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12px", boxSizing: "border-box" }}
                />
              </div>
            </div>
          </div>

          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Site &amp; Client</th>
                  <th>Assigned Engineers &amp; Presence</th>
                  <th>Today's Activity Pulse</th>
                  <th>Today's Labour</th>
                  <th>Today's Expenses</th>
                  <th>Execution Progress</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                  <th style={{ textAlign: "right" }}>Inspect</th>
                </tr>
              </thead>
              <tbody>
                {filteredActiveSites.length === 0 ? (
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                      No active construction sites match the search filter.
                    </td>
                  </tr>
                ) : (
                  filteredActiveSites.map(site => {
                    // 1. Engineers assigned
                    const assignedEngList = engineers.filter(e => {
                      if (e.assignedSiteId === site.id) return true;
                      if (Array.isArray(e.assignedSites) && e.assignedSites.includes(site.id)) return true;
                      if (assignments.some(a => a.siteId === site.id && (a.engineerId === e.id || a.engineerId === e.uid))) return true;
                      return false;
                    });

                    // 2. Today's attendance for this site
                    const siteTodayAttendance = todayAttendanceList.filter(r => r.resolvedSiteId === site.id);
                    const sitePresentEngSet = new Set(siteTodayAttendance.map(r => r.resolvedEngineerId || r.engineerName));

                    // 3. Today's labour for this site
                    let siteLabourCount = 0;
                    let siteLabourAmount = 0;
                    (rawLabourAttendance || []).forEach(r => {
                      if (!r || r.lockedMetadata || r.siteId !== site.id) return;
                      const d = r.attendanceDate || r.date;
                      if (d === todayDateString) {
                        const count = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
                        const rate = Number(r.dailyWage || r.rate || r.categoryRate) || 0;
                        siteLabourCount += count;
                        siteLabourAmount += Number(r.totalAmount || (count * rate));
                      }
                    });

                    // 4. Today's materials for this site
                    let siteMaterialCount = 0;
                    let siteMaterialCost = 0;
                    materials.forEach(m => {
                      if (m.siteId !== site.id) return;
                      const d = m.date || (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
                      if (d === todayDateString) {
                        siteMaterialCount += 1;
                        siteMaterialCost += Number(m.totalCost) || 0;
                      }
                    });

                    // 5. Today's general expenses for this site
                    let siteGeneralExpense = 0;
                    generalExpenses.forEach(e => {
                      if (e.siteId === site.id && (e.date || "").startsWith(todayDateString)) {
                        siteGeneralExpense += Number(e.amount) || 0;
                      }
                    });

                    const siteTotalExpenseToday = siteLabourAmount + siteMaterialCost + siteGeneralExpense;

                    // 6. Today's DPR
                    const hasDprToday = allDprs.some(d => {
                      if (d.siteId !== site.id) return false;
                      const dDate = d.date || (d.createdAt?.seconds ? new Date(d.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
                      return dDate === todayDateString;
                    });

                    // 7. Progress & Milestone Standing
                    const progVal = site.progress !== undefined ? Number(site.progress) : 0;
                    const isDelayed = site.status === "Delayed" || isSiteDelayed(site);

                    return (
                      <tr key={site.id}>
                        {/* Site Name & Client */}
                        <td>
                          <strong style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-950)", display: "block" }}>
                            {site.siteName}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "inline-flex", alignItems: "center", gap: "3px", marginTop: "2px" }}>
                            <MapPin size={10} style={{ color: "#94a3b8" }} />
                            {site.location || site.clientName || "Construction Project"}
                          </span>
                        </td>

                        {/* Assigned Engineers */}
                        <td>
                          {assignedEngList.length > 0 ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                              {assignedEngList.map((eng, idx) => {
                                const isPresent = sitePresentEngSet.has(eng.id) || sitePresentEngSet.has(eng.uid) || sitePresentEngSet.has(eng.name);
                                return (
                                  <div key={idx} style={{ display: "inline-flex", alignItems: "center", gap: "5px", fontSize: "11.5px" }}>
                                    <span style={{
                                      width: "6px",
                                      height: "6px",
                                      borderRadius: "50%",
                                      backgroundColor: isPresent ? "#16a34a" : "#cbd5e1",
                                      flexShrink: 0
                                    }} />
                                    <span style={{ fontWeight: isPresent ? "700" : "500", color: isPresent ? "var(--primary-950)" : "var(--primary-700)" }}>
                                      {eng.fullName || eng.name}
                                    </span>
                                    {isPresent && (
                                      <span style={{ fontSize: "9px", fontWeight: "800", color: "#15803d", backgroundColor: "#dcfce7", padding: "1px 4px", borderRadius: "3px" }}>
                                        Present
                                      </span>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "#94a3b8", fontStyle: "italic" }}>No Assigned Engineer</span>
                          )}
                        </td>

                        {/* Today's Activity Pulse */}
                        <td>
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {siteTodayAttendance.length > 0 && (
                              <Badge status="success" style={{ fontSize: "10px", padding: "1px 6px" }}>Attendance ({siteTodayAttendance.length})</Badge>
                            )}
                            {siteLabourCount > 0 && (
                              <Badge status="info" style={{ fontSize: "10px", padding: "1px 6px" }}>Labour ({siteLabourCount})</Badge>
                            )}
                            {siteMaterialCount > 0 && (
                              <Badge status="pending" style={{ fontSize: "10px", padding: "1px 6px" }}>Materials ({siteMaterialCount})</Badge>
                            )}
                            {siteGeneralExpense > 0 && (
                              <Badge status="warning" style={{ fontSize: "10px", padding: "1px 6px" }}>Expense Logged</Badge>
                            )}
                            {hasDprToday && (
                              <Badge status="success" style={{ fontSize: "10px", padding: "1px 6px" }}>DPR Filed</Badge>
                            )}
                            {siteTodayAttendance.length === 0 && siteLabourCount === 0 && siteMaterialCount === 0 && siteGeneralExpense === 0 && !hasDprToday && (
                              <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>No activity logged today</span>
                            )}
                          </div>
                        </td>

                        {/* Today's Labour */}
                        <td>
                          <span style={{ fontSize: "12px", fontWeight: siteLabourCount > 0 ? "700" : "500", color: siteLabourCount > 0 ? "var(--primary-950)" : "var(--primary-500)" }}>
                            {siteLabourCount > 0 ? `${siteLabourCount} Workers` : "0 Workers"}
                          </span>
                        </td>

                        {/* Today's Expenses */}
                        <td>
                          <span style={{ fontSize: "12px", fontWeight: siteTotalExpenseToday > 0 ? "700" : "500", color: siteTotalExpenseToday > 0 ? "var(--primary-950)" : "var(--primary-500)" }}>
                            {formatINR(siteTotalExpenseToday)}
                          </span>
                        </td>

                        {/* Live Progress */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px", width: "100%" }}>
                            <div style={{ flex: 1, height: "7px", backgroundColor: "#e2e8f0", borderRadius: "100px", overflow: "hidden" }}>
                              <div style={{
                                width: `${progVal}%`,
                                height: "100%",
                                backgroundColor: isDelayed ? "#dc2626" : (progVal >= 80 ? "#16a34a" : (progVal >= 40 ? "#2563eb" : "#f97316")),
                                borderRadius: "100px"
                              }} />
                            </div>
                            <span style={{ fontSize: "11.5px", fontWeight: "800", color: "var(--primary-950)", minWidth: "32px", textAlign: "right" }}>
                              {progVal}%
                            </span>
                          </div>
                        </td>

                        {/* Status */}
                        <td style={{ textAlign: "center" }}>
                          <Badge status={isDelayed ? "danger" : (site.status || "active")} />
                        </td>

                        {/* Action: Inspect Details */}
                        <td style={{ textAlign: "right" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedInspectSite(site)}
                            className="erp-btn-secondary"
                            style={{ fontSize: "11.5px", padding: "4px 10px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Eye size={12} />
                            Inspect
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 6: TODAY'S REAL-TIME ACTIVITY STREAM (LIVE AUDIT FEED)       */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="admin-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "14px" }}>
            <div>
              <h3 className="admin-card-title">Today's Real-Time Operations Activity Stream</h3>
              <p className="admin-card-subtitle">
                Chronological live feed of field submissions, check-ins, labour logs, materials, and expenses recorded today ({todayFeedList.length} events).
              </p>
            </div>

            {/* Filter Tabs */}
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {["all", "attendance", "labour", "materials", "expenses", "reports"].map(f => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setDashboardActivityFilter(f)}
                  style={{
                    padding: "4px 10px",
                    borderRadius: "6px",
                    border: "1px solid",
                    borderColor: dashboardActivityFilter === f ? "var(--brand-orange)" : "var(--border-color)",
                    backgroundColor: dashboardActivityFilter === f ? "#fff7ed" : "#ffffff",
                    color: dashboardActivityFilter === f ? "var(--brand-orange)" : "var(--primary-700)",
                    fontSize: "11.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    textTransform: "capitalize"
                  }}
                >
                  {f === "all" ? `All Events (${todayFeedList.length})` : `${f} (${todayFeedList.filter(item => item.moduleType === f).length})`}
                </button>
              ))}
            </div>
          </div>

          {filteredTodayFeed.length === 0 ? (
            <div style={{ textAlign: "center", padding: "36px 20px", color: "var(--text-muted)" }}>
              <Clock size={28} style={{ color: "var(--primary-300)", marginBottom: "8px" }} />
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600" }}>No operations activity recorded for the selected filter today.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "360px", overflowY: "auto" }}>
              {filteredTodayFeed.map(item => (
                <div
                  key={item.id}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    padding: "10px 14px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "8px",
                    border: "1px solid #e2e8f0",
                    gap: "12px"
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "10px", minWidth: 0, flex: 1 }}>
                    <Badge status={item.badgeStatus} style={{ fontSize: "10.5px", flexShrink: 0 }}>
                      {item.module}
                    </Badge>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.title}
                      </strong>
                      <span style={{ fontSize: "11.5px", color: "var(--primary-600)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        {item.description}
                      </span>
                    </div>
                  </div>

                  <div style={{ textAlign: "right", flexShrink: 0 }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", display: "block" }}>
                      {item.time}
                    </span>
                    <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>
                      by {item.user}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* ══════════════════════════════════════════════════════════════════════ */}
        {/* SECTION 7: EXECUTIVE QUICK-ACCESS MODULE SHORTCUTS                   */}
        {/* ══════════════════════════════════════════════════════════════════════ */}
        <div className="admin-card">
          <div className="admin-card-header" style={{ marginBottom: "12px" }}>
            <div>
              <h3 className="admin-card-title">Executive Shortcuts &amp; Department Gateways</h3>
              <p className="admin-card-subtitle">Direct quick-access into deep-dive operational ledgers and management tables</p>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(170px, 1fr))", gap: "10px" }}>
            {[
              { to: "/superadmin/sites", label: "All Sites Operations", icon: Building2, desc: `${overallMetrics.totalSites} Sites Portfolio` },
              { to: "/superadmin/engineers", label: "Engineers Directory", icon: Users, desc: `${engineers.length} Registered Engineers` },
              { to: "/superadmin/attendance", label: "Attendance Monitor", icon: ClipboardCheck, desc: `${presentCount} Present Today` },
              { to: "/superadmin/labour", label: "Daily Labour Ledger", icon: Briefcase, desc: `${todayLabourCount} Workers Today` },
              { to: "/superadmin/materials", label: "Materials Stock", icon: Package, desc: `${materials.length} Inventory Items` },
              { to: "/superadmin/payments", label: "Corporate Payments", icon: DollarSign, desc: "Vendor & Client Ledger" },
              { to: "/superadmin/payroll", label: "Worker Payouts", icon: FileText, desc: "Wages & Attendance" },
              { to: "/superadmin/finance", label: "Financial Ledger", icon: TrendingUp, desc: formatINR(overallMetrics.totalExpenses) },
              { to: "/superadmin/reports", label: "Reports & Analytics", icon: Layers, desc: "DPRs & Site Insights" },
              { to: "/superadmin/admins", label: "Admin Accounts", icon: ShieldCheck, desc: `${admins.length || 1} Admins Oversight` },
              { to: "/superadmin/activity", label: "System Audit Trail", icon: Activity, desc: "Chronological Logs" }
            ].map(item => {
              const IconComponent = item.icon;
              return (
                <Link
                  key={item.to}
                  to={item.to}
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    padding: "12px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    backgroundColor: "#ffffff",
                    textDecoration: "none",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.borderColor = "var(--brand-orange)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(234, 88, 12, 0.1)";
                    e.currentTarget.style.transform = "translateY(-1px)";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = "var(--border-color)";
                    e.currentTarget.style.boxShadow = "none";
                    e.currentTarget.style.transform = "none";
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <IconComponent size={16} style={{ color: "var(--brand-orange)" }} />
                    <strong style={{ fontSize: "12.5px", color: "var(--primary-950)" }}>{item.label}</strong>
                  </div>
                  <span style={{ fontSize: "11px", color: "var(--primary-600)" }}>{item.desc}</span>
                </Link>
              );
            })}
          </div>
        </div>

      </div>
    );
  };



  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: ALL SITES (GRID & LIST/TABLE VIEW + DEEP-DIVE MONITORING)
  // ══════════════════════════════════════════════════════════════════════════
  const renderSitesView = () => {
    // 1. Filtering logic
    const filteredSites = sites.filter(s => {
      if (siteStatusFilter !== "all" && (s.status || "").toLowerCase() !== siteStatusFilter.toLowerCase()) return false;
      if (siteSearchQuery.trim()) {
        const q = siteSearchQuery.toLowerCase().trim();
        const matchName = (s.siteName || "").toLowerCase().includes(q);
        const matchClient = (s.clientName || "").toLowerCase().includes(q);
        const matchLoc = (s.location || "").toLowerCase().includes(q);
        if (!matchName && !matchClient && !matchLoc) return false;
      }
      return true;
    });

    const selectedSite = sites.find(s => s.id === selectedSiteId);

    // ──────────────────────────────────────────────────────────────────────────
    // A. ALL SITES BROWSING (GRID & LIST VIEW)
    // ──────────────────────────────────────────────────────────────────────────
    if (!selectedSite) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* Top Control Bar */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px", marginBottom: "4px" }}>
            <div>
              <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
                All Construction Sites ({filteredSites.length})
              </h2>
              <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
                Executive monitoring of all projects. Toggle between Card Grid and Table View to inspect operations.
              </p>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              {/* Search */}
              <div style={{ position: "relative", minWidth: "240px", maxWidth: "360px", flex: "1 1 240px" }}>
                <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
                <input
                  type="text"
                  placeholder="Search site, client, location..."
                  value={siteSearchQuery}
                  onChange={(e) => setSiteSearchQuery(e.target.value)}
                  style={{ width: "100%", height: "38px", paddingLeft: "36px", paddingRight: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", fontSize: "12.5px", boxSizing: "border-box", outline: "none" }}
                />
              </div>

              {/* Status Filter */}
              <select
                value={siteStatusFilter}
                onChange={(e) => setSiteStatusFilter(e.target.value)}
                style={{ height: "38px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", fontSize: "12.5px", fontWeight: "600", outline: "none" }}
              >
                <option value="all">All Statuses</option>
                <option value="active">Active</option>
                <option value="planning">Planning</option>
                <option value="delayed">Delayed</option>
                <option value="completed">Completed</option>
              </select>

              {/* View Mode Toggle Button Group */}
              <div style={{
                display: "inline-flex",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                backgroundColor: "#f8fafc",
                padding: "2px"
              }}>
                <button
                  type="button"
                  onClick={() => handleToggleViewMode("grid")}
                  title="Card Grid View"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: sitesViewMode === "grid" ? "#ffffff" : "transparent",
                    color: sitesViewMode === "grid" ? "var(--primary-900)" : "var(--text-muted)",
                    boxShadow: sitesViewMode === "grid" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    fontWeight: sitesViewMode === "grid" ? "750" : "600",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  <LayoutGrid size={14} /> Grid
                </button>
                <button
                  type="button"
                  onClick={() => handleToggleViewMode("list")}
                  title="Normal List / Table View"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: sitesViewMode === "list" ? "#ffffff" : "transparent",
                    color: sitesViewMode === "list" ? "var(--primary-900)" : "var(--text-muted)",
                    boxShadow: sitesViewMode === "list" ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                    fontWeight: sitesViewMode === "list" ? "750" : "600",
                    fontSize: "12px",
                    cursor: "pointer"
                  }}
                >
                  <List size={14} /> List View
                </button>
              </div>
            </div>
          </div>

          {filteredSites.length === 0 ? (
            <Card>
              <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
                <Building2 size={36} style={{ color: "var(--primary-300)", marginBottom: "8px" }} />
                <p style={{ margin: 0, fontSize: "14px", fontWeight: "600" }}>No construction sites match your filter criteria.</p>
              </div>
            </Card>
          ) : sitesViewMode === "grid" ? (
            /* ── GRID VIEW ── */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(350px, 1fr))", gap: "18px" }}>
              {filteredSites.map(site => {
                const siteMaterials = materials.filter(m => m.siteId === site.id);
                const siteLabour = laborHistoryMap[site.id] || [];
                const siteDprs = allDprs.filter(d => d.siteId === site.id);
                const siteExpenses = generalExpenses.filter(e => e.siteId === site.id);
                const financials = getSiteFinancials(site, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
                const isDelayed = isSiteDelayed(site);
                const budget = getSiteBudget(site);
                
                // Today's site metrics
                const siteTodayAttendance = todayAttendanceList.filter(r => r.resolvedSiteId === site.id);
                const siteTodayLabour = (rawLabourAttendance || []).filter(r => r && !r.lockedMetadata && r.siteId === site.id && (r.attendanceDate === todayDateString || r.date === todayDateString)).reduce((acc, c) => acc + Number(c.workerCount || (c.workerEntries && c.workerEntries.length) || 1), 0);
                const siteTotalSpent = siteExpenses.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);
                
                // Assigned engineers
                const assignedUids = new Set([
                  ...(site.assignedEngineers || []),
                  ...assignments.filter(a => a.siteId === site.id).map(a => a.engineerId || a.userId)
                ].filter(Boolean));
                const assignedEngineersList = engineers.filter(e => assignedUids.has(e.id) || assignedUids.has(e.uid));

                return (
                  <div
                    key={site.id}
                    onClick={() => {
                      setSelectedSiteId(site.id);
                      setSelectedSiteTab("overview");
                      setSiteInspectionDate("");
                    }}
                    style={{
                      background: "#ffffff",
                      border: "1px solid var(--border-color)",
                      borderRadius: "14px",
                      boxShadow: "0 2px 6px rgba(15,23,42,0.04)",
                      padding: "20px",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "16px",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease, border-color 0.15s ease"
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.transform = "translateY(-2px)";
                      e.currentTarget.style.boxShadow = "0 8px 20px rgba(15,23,42,0.08)";
                      e.currentTarget.style.borderColor = "var(--primary-300)";
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.transform = "translateY(0)";
                      e.currentTarget.style.boxShadow = "0 2px 6px rgba(15,23,42,0.04)";
                      e.currentTarget.style.borderColor = "var(--border-color)";
                    }}
                  >
                    <div>
                      {/* Top Row: Title & Badges */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "8px" }}>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
                          {site.siteName}
                        </h3>
                        <div style={{ display: "flex", gap: "6px", flexShrink: 0 }}>
                          <Badge status={site.status || "Planning"} />
                          {isDelayed && <Badge status="danger">Delayed</Badge>}
                        </div>
                      </div>

                      <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                        <MapPin size={13} style={{ color: "var(--primary-500)" }} />
                        {site.location || "Location not specified"}
                      </p>

                      {/* Customer & Assigned Engineers */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                        <div>
                          <span style={{ color: "var(--text-muted)", fontSize: "11px", display: "block" }}>Client / Project</span>
                          <strong style={{ color: "var(--primary-900)" }}>{site.clientName || "—"}</strong>
                        </div>
                        <div>
                          <span style={{ color: "var(--text-muted)", fontSize: "11px", display: "block" }}>Assigned Engineers</span>
                          <strong style={{ color: "var(--primary-900)" }}>
                            {assignedEngineersList.length > 0 
                              ? `${assignedEngineersList.length} (${assignedEngineersList.slice(0, 2).map(e => e.fullName?.split(' ')[0] || e.name).join(', ')})`
                              : "None assigned"}
                          </strong>
                        </div>
                      </div>

                      {/* Today's Operational Pulse Grid */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginTop: "10px", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px" }}>
                        <div>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>Today's Attendance</span>
                          <strong style={{ fontSize: "12px", color: siteTodayAttendance.length > 0 ? "#15803d" : "var(--primary-900)" }}>
                            {siteTodayAttendance.length > 0 ? `${siteTodayAttendance.length} On Site` : "No Check-ins"}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>Today's Labour</span>
                          <strong style={{ fontSize: "12px", color: siteTodayLabour > 0 ? "#c2410c" : "var(--primary-900)" }}>
                            {siteTodayLabour > 0 ? `${siteTodayLabour} Workers` : "0 logged"}
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>Materials Logged</span>
                          <strong style={{ fontSize: "12px", color: "var(--primary-900)" }}>
                            {siteMaterials.length} Items
                          </strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>Total Spent</span>
                          <strong style={{ fontSize: "12px", color: "var(--primary-900)", fontFamily: "monospace" }}>
                            {formatINR(siteTotalSpent)}
                          </strong>
                        </div>
                      </div>
                    </div>

                    <div>
                      {/* Progress bar */}
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", fontWeight: "700", marginBottom: "4px" }}>
                        <span style={{ color: "var(--text-muted)" }}>Execution Progress</span>
                        <span style={{ color: "var(--primary-700)" }}>{financials.progressPercent}%</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "var(--primary-100)", borderRadius: "3px", overflow: "hidden", marginBottom: "12px" }}>
                        <div style={{ width: `${financials.progressPercent}%`, height: "100%", backgroundColor: "var(--primary-600)" }} />
                      </div>

                      <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: "4px", fontSize: "12.5px", fontWeight: "750", color: "var(--primary-600)" }}>
                        <span>Inspect Site Operations</span>
                        <ChevronRight size={14} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* ── NORMAL LIST / TABLE VIEW ── */
            <Card variant="table">
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Site Name</th>
                      <th>Customer / Project</th>
                      <th>Assigned Engineers</th>
                      <th>Status</th>
                      <th>Today's Attendance</th>
                      <th style={{ textAlign: "right" }}>Today's Labour</th>
                      <th style={{ textAlign: "right" }}>Materials</th>
                      <th style={{ textAlign: "right" }}>Total Spent</th>
                      <th style={{ textAlign: "right" }}>Progress</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSites.map(site => {
                      const siteMaterials = materials.filter(m => m.siteId === site.id);
                      const siteLabour = laborHistoryMap[site.id] || [];
                      const siteDprs = allDprs.filter(d => d.siteId === site.id);
                      const siteExpenses = generalExpenses.filter(e => e.siteId === site.id);
                      const financials = getSiteFinancials(site, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
                      const isDelayed = isSiteDelayed(site);

                      const siteTodayAttendance = todayAttendanceList.filter(r => r.resolvedSiteId === site.id);
                      const siteTodayLabour = (rawLabourAttendance || []).filter(r => r && !r.lockedMetadata && r.siteId === site.id && (r.attendanceDate === todayDateString || r.date === todayDateString)).reduce((acc, c) => acc + Number(c.workerCount || (c.workerEntries && c.workerEntries.length) || 1), 0);
                      const siteTotalSpent = siteExpenses.reduce((acc, c) => acc + (Number(c.amount) || 0), 0);

                      const assignedUids = new Set([
                        ...(site.assignedEngineers || []),
                        ...assignments.filter(a => a.siteId === site.id).map(a => a.engineerId || a.userId)
                      ].filter(Boolean));
                      const assignedEngineersList = engineers.filter(e => assignedUids.has(e.id) || assignedUids.has(e.uid));

                      return (
                        <tr key={site.id}>
                          <td style={{ fontWeight: "700" }}>{site.siteName}</td>
                          <td>{site.clientName || "—"}</td>
                          <td>
                            {assignedEngineersList.length > 0 
                              ? assignedEngineersList.map(e => e.fullName || e.name).join(", ")
                              : <span style={{ color: "var(--text-muted)", fontSize: "11px" }}>Unassigned</span>}
                          </td>
                          <td>
                            <div style={{ display: "flex", gap: "4px" }}>
                              <Badge status={site.status || "Planning"} />
                              {isDelayed && <Badge status="danger">Delayed</Badge>}
                            </div>
                          </td>
                          <td>
                            <span style={{
                              fontSize: "11px",
                              fontWeight: "750",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              backgroundColor: siteTodayAttendance.length > 0 ? "#dcfce7" : "#f1f5f9",
                              color: siteTodayAttendance.length > 0 ? "#15803d" : "#64748b"
                            }}>
                              {siteTodayAttendance.length > 0 ? `${siteTodayAttendance.length} On Site` : "No Check-ins"}
                            </span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: "700", color: siteTodayLabour > 0 ? "#c2410c" : "inherit" }}>
                            {siteTodayLabour}
                          </td>
                          <td style={{ textAlign: "right" }}>{siteMaterials.length} Items</td>
                          <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "600" }}>{formatINR(siteTotalSpent)}</td>
                          <td style={{ textAlign: "right", fontWeight: "750", color: "var(--primary-700)" }}>{financials.progressPercent}%</td>
                          <td style={{ textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedSiteId(site.id);
                                setSelectedSiteTab("overview");
                                setSiteInspectionDate("");
                              }}
                              style={{
                                border: "none",
                                background: "transparent",
                                color: "var(--primary-600)",
                                fontWeight: "750",
                                fontSize: "12px",
                                cursor: "pointer",
                                padding: "4px 8px"
                              }}
                            >
                              Inspect Details →
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )}

        </div>
      );
    }

    // ──────────────────────────────────────────────────────────────────────────
    // B. SELECTED SITE DEEP-DIVE MONITORING SUITE
    // ──────────────────────────────────────────────────────────────────────────
    const siteMaterials = materials.filter(m => m.siteId === selectedSite.id);
    const siteLabour = laborHistoryMap[selectedSite.id] || [];
    const siteDprs = allDprs.filter(d => d.siteId === selectedSite.id);
    const siteExpenses = generalExpenses.filter(e => e.siteId === selectedSite.id);
    const siteTeams = rawTeams.filter(t => t.siteId === selectedSite.id);
    const siteActivities = systemActivities.filter(a => a.siteId === selectedSite.id);
    const siteDocs = documents.filter(d => d.siteId === selectedSite.id);

    // Site Attendance
    const siteAttendanceRecords = allDeduplicatedAttendance.filter(r => r.resolvedSiteId === selectedSite.id);
    
    // Assigned engineers for this site
    const siteAssignedUids = new Set([
      ...(selectedSite.assignedEngineers || []),
      ...assignments.filter(a => a.siteId === selectedSite.id).map(a => a.engineerId || a.userId)
    ].filter(Boolean));
    const siteAssignedEngineers = engineers.filter(e => siteAssignedUids.has(e.id) || siteAssignedUids.has(e.uid));

    // Date-Filtered records if siteInspectionDate is chosen
    const activeDate = siteInspectionDate;
    const filteredSiteAttendance = activeDate 
      ? siteAttendanceRecords.filter(r => (r.date || r.attendanceDate) === activeDate)
      : siteAttendanceRecords;

    const filteredSiteLabour = (rawLabourAttendance || []).filter(r => {
      if (!r || r.lockedMetadata || r.siteId !== selectedSite.id) return false;
      if (activeDate) return (r.attendanceDate || r.date) === activeDate;
      return true;
    });

    const filteredSiteMaterials = activeDate
      ? siteMaterials.filter(m => formatDateDMY(m.date || m.createdAt) === formatDateDMY(activeDate))
      : siteMaterials;

    const filteredSiteExpenses = activeDate
      ? siteExpenses.filter(e => (e.date || "").startsWith(activeDate))
      : siteExpenses;

    const filteredSiteDprs = activeDate
      ? siteDprs.filter(d => (d.date || "").startsWith(activeDate))
      : siteDprs;

    // Photos Collection for this site
    const sitePhotos = [];
    siteDprs.forEach(dpr => {
      if (dpr.photos && Array.isArray(dpr.photos)) {
        dpr.photos.forEach(p => sitePhotos.push({ url: p, title: `DPR: ${dpr.workDescription || 'Daily Update'}`, date: dpr.date || formatDateDMY(dpr.createdAt), source: 'Daily Progress Report' }));
      } else if (dpr.photoUrl) {
        sitePhotos.push({ url: dpr.photoUrl, title: `DPR: ${dpr.workDescription || 'Daily Update'}`, date: dpr.date || formatDateDMY(dpr.createdAt), source: 'Daily Progress Report' });
      }
    });

    siteAttendanceRecords.forEach(att => {
      if (att.photoUrl) {
        sitePhotos.push({ url: att.photoUrl, title: `Check-in: ${att.engineerName}`, date: att.date || att.attendanceDate, source: 'Attendance Proof' });
      }
      if (att.checkOutPhotoUrl) {
        sitePhotos.push({ url: att.checkOutPhotoUrl, title: `Check-out: ${att.engineerName}`, date: att.date || att.attendanceDate, source: 'Attendance Proof' });
      }
    });

    siteDocs.forEach(doc => {
      if (doc.url && (doc.fileType?.includes('image') || doc.url.match(/\.(jpg|jpeg|png|webp)/i))) {
        sitePhotos.push({ url: doc.url, title: doc.title || doc.name || 'Site Document Image', date: formatDateDMY(doc.createdAt), source: 'Project Document' });
      }
    });

    // Site Financials & Progress
    const financials = getSiteFinancials(selectedSite, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
    const isDelayed = isSiteDelayed(selectedSite);
    const plannedProgress = calculatePlannedProgress(selectedSite.startDate, selectedSite.expectedEndDate);
    const budget = getSiteBudget(selectedSite);
    const totalSpent = siteExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
    const utilization = budget > 0 ? (totalSpent / budget) * 100 : 0;
    const remaining = budget - totalSpent;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Top Header Bar */}
        <div style={{
          background: "#ffffff",
          border: "1px solid var(--border-color)",
          borderRadius: "14px",
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "14px"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "14px" }}>
            <button
              type="button"
              onClick={() => {
                setSelectedSiteId("");
                setSiteInspectionDate("");
              }}
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                padding: "7px 14px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                backgroundColor: "#f8fafc",
                color: "var(--primary-900)",
                fontSize: "12.5px",
                fontWeight: "750",
                cursor: "pointer"
              }}
            >
              <ArrowLeft size={14} /> Back to All Sites
            </button>

            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "900", color: "var(--primary-950)" }}>
                  {selectedSite.siteName}
                </h2>
                <Badge status={selectedSite.status || "Planning"} />
                {isDelayed && <Badge status="danger">Delayed</Badge>}
                <span style={{ fontSize: "11.5px", color: "#16a34a", display: "inline-flex", alignItems: "center", gap: "4px", fontWeight: "700" }}>
                  <ShieldCheck size={13} /> Super Admin Read-Only
                </span>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={12} style={{ color: "var(--primary-500)" }} />
                {selectedSite.location || "Location not specified"} · Client: <strong>{selectedSite.clientName || "—"}</strong>
              </p>
            </div>
          </div>

          {/* Date Selector for Site-Specific Inspection */}
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#f8fafc", padding: "4px 8px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <Calendar size={14} style={{ color: "var(--primary-600)" }} />
              <input
                type="date"
                value={siteInspectionDate}
                onChange={(e) => setSiteInspectionDate(e.target.value)}
                style={{ border: "none", background: "transparent", fontSize: "12px", outline: "none", fontWeight: "600" }}
              />
            </div>
            {siteInspectionDate && (
              <button
                type="button"
                onClick={() => setSiteInspectionDate("")}
                style={{ padding: "5px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", fontSize: "11.5px", cursor: "pointer", fontWeight: "600" }}
              >
                Clear Date
              </button>
            )}
            <button
              type="button"
              onClick={() => setSiteInspectionDate(todayDateString)}
              style={{
                padding: "5px 10px",
                borderRadius: "6px",
                border: "1px solid var(--border-color)",
                backgroundColor: siteInspectionDate === todayDateString ? "#eff6ff" : "#ffffff",
                color: siteInspectionDate === todayDateString ? "#1d4ed8" : "inherit",
                fontSize: "11.5px",
                cursor: "pointer",
                fontWeight: "700"
              }}
            >
              Today
            </button>
          </div>
        </div>

        {/* ── Sub-Navigation Tabs ── */}
        <div style={{
          display: "flex",
          gap: "6px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "10px",
          overflowX: "auto"
        }}>
          {[
            { id: "overview", label: "Overview & Progress", icon: Activity },
            { id: "attendance", label: `Attendance (${filteredSiteAttendance.length})`, icon: ClipboardCheck },
            { id: "labour", label: `Labour Ledger (${filteredSiteLabour.length})`, icon: Briefcase },
            { id: "materials", label: `Materials (${filteredSiteMaterials.length})`, icon: Package },
            { id: "expenses", label: `Site Expenses (${filteredSiteExpenses.length})`, icon: DollarSign },
            { id: "reports", label: `DPR Reports (${filteredSiteDprs.length})`, icon: FileText },
            { id: "photos", label: `Photos Gallery (${sitePhotos.length})`, icon: Camera },
            { id: "engineers", label: `Assigned Engineers (${siteAssignedEngineers.length})`, icon: Users },
            { id: "activity", label: `Activity Log (${siteActivities.length})`, icon: Clock }
          ].map(tabItem => {
            const Icon = tabItem.icon;
            const isActive = selectedSiteTab === tabItem.id;
            return (
              <button
                key={tabItem.id}
                type="button"
                onClick={() => setSelectedSiteTab(tabItem.id)}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "7px 14px",
                  borderRadius: "8px",
                  border: isActive ? "1px solid #fed7aa" : "1px solid transparent",
                  backgroundColor: isActive ? "#fff7ed" : "transparent",
                  color: isActive ? "#c2410c" : "var(--text-muted)",
                  fontWeight: isActive ? "800" : "600",
                  fontSize: "12.5px",
                  cursor: "pointer",
                  whiteSpace: "nowrap"
                }}
              >
                <Icon size={14} />
                {tabItem.label}
              </button>
            );
          })}
        </div>

        {/* ── 1. Overview & Progress Tab ── */}
        {selectedSiteTab === "overview" && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px", alignItems: "start" }}>
            <Card title="Project Site Registry Details">
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Site / Project Name</span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "17px", fontWeight: "800", color: "var(--primary-900)" }}>{selectedSite.siteName}</h3>
                </div>
                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Client Name</span>
                  <p style={{ margin: "2px 0 0 0", fontSize: "13.5px", fontWeight: "600" }}>{selectedSite.clientName || "—"}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Start Date</span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600" }} className="font-mono">{formatDateDMY(selectedSite.startDate)}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Expected End Date</span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: isDelayed ? "var(--danger-600)" : "inherit" }} className="font-mono">{formatDateDMY(selectedSite.expectedEndDate)}</p>
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Geofence Coordinates</span>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={12} />
                    {selectedSite.latitude ? `${Number(selectedSite.latitude).toFixed(6)}, ${Number(selectedSite.longitude).toFixed(6)} (Radius: ${selectedSite.radius || 150}m)` : "Geofence not configured"}
                  </p>
                </div>
              </div>
            </Card>

            <Card title="Work Progress &amp; Milestone Standing">
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: "700" }}>
                    <span>Actual Progress</span>
                    <span style={{ color: "var(--primary-700)" }}>{financials.progressPercent}%</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "var(--primary-100)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${financials.progressPercent}%`, height: "100%", backgroundColor: "var(--primary-600)" }} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", fontWeight: "700" }}>
                    <span>Linear Milestone Target</span>
                    <span style={{ color: "var(--accent-700)" }}>{plannedProgress}%</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "var(--accent-100)", borderRadius: "4px", overflow: "hidden" }}>
                    <div style={{ width: `${plannedProgress}%`, height: "100%", backgroundColor: "var(--accent-500)" }} />
                  </div>
                </div>

                {/* Progress Gap Indicator */}
                <div style={{
                  padding: "10px 12px",
                  borderRadius: "8px",
                  backgroundColor: financials.progressPercent >= plannedProgress ? "var(--success-50)" : "var(--danger-50)",
                  border: `1px solid ${financials.progressPercent >= plannedProgress ? "var(--success-200)" : "var(--danger-200)"}`,
                  display: "flex",
                  alignItems: "center",
                  gap: "8px"
                }}>
                  {financials.progressPercent >= plannedProgress ? (
                    <>
                      <CheckCircle2 size={16} style={{ color: "var(--success-600)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--success-700)" }}>
                        Site is running ahead of plan (+{financials.progressPercent - plannedProgress}%)
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} style={{ color: "var(--danger-600)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--danger-700)" }}>
                        Site is behind linear milestones (-{plannedProgress - financials.progressPercent}%)
                      </span>
                    </>
                  )}
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                  <div style={{ backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Budget</span>
                    <strong style={{ fontSize: "12px", color: "var(--primary-900)", fontFamily: "monospace" }}>{formatINR(budget)}</strong>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Spent</span>
                    <strong style={{ fontSize: "12px", color: "var(--primary-900)", fontFamily: "monospace" }}>{formatINR(totalSpent)}</strong>
                  </div>
                  <div style={{ backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Remaining</span>
                    <strong style={{ fontSize: "12px", color: remaining < 0 ? "var(--danger-700)" : "var(--success-700)", fontFamily: "monospace" }}>{formatINR(remaining)}</strong>
                  </div>
                </div>
              </div>
            </Card>
          </div>
        )}

        {/* ── 2. Attendance Tab ── */}
        {selectedSiteTab === "attendance" && (
          <Card title={`Attendance Records for "${selectedSite.siteName}"`} variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Engineer Name</th>
                    <th>Date</th>
                    <th>Check-In</th>
                    <th>Check-Out</th>
                    <th>Status</th>
                    <th>Verification</th>
                    <th style={{ textAlign: "center" }}>Photo Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSiteAttendance.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No attendance records found for this selection.</td></tr>
                  ) : (
                    filteredSiteAttendance.map(rec => (
                      <tr key={rec.id}>
                        <td style={{ fontWeight: "700" }}>{rec.engineerName}</td>
                        <td className="font-mono">{formatDateDMY(rec.date || rec.attendanceDate)}</td>
                        <td className="font-mono">{rec.checkInTimeFormatted}</td>
                        <td className="font-mono">{rec.checkOutTimeFormatted || "—"}</td>
                        <td>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "750",
                            padding: "2px 8px",
                            borderRadius: "12px",
                            backgroundColor: rec.isCheckedOut ? "#f1f5f9" : "#dcfce7",
                            color: rec.isCheckedOut ? "#475569" : "#15803d"
                          }}>
                            {rec.isCheckedOut ? "Checked Out" : "On Site"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "11px", color: rec.isVerified ? "#16a34a" : "#ca8a04", fontWeight: "700" }}>
                            {rec.isVerified ? "✓ Verified GPS" : "Pending"}
                          </span>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {rec.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPreviewImage({ url: rec.photoUrl, title: `Attendance Check-In: ${rec.engineerName}` })}
                              style={{ border: "none", background: "none", color: "var(--primary-600)", fontWeight: "700", fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "3px" }}
                            >
                              <ImageIcon size={13} /> View
                            </button>
                          ) : "—"}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── 3. Labour Tab ── */}
        {selectedSiteTab === "labour" && (
          <Card title={`Labour & Workforce Records for "${selectedSite.siteName}"`} variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Attendance Date</th>
                    <th>Labour Category / Team</th>
                    <th style={{ textAlign: "right" }}>Worker Count</th>
                    <th style={{ textAlign: "right" }}>Rate / Day</th>
                    <th style={{ textAlign: "right" }}>Calculated Amount</th>
                    <th>Recorded By</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSiteLabour.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No labour logs found.</td></tr>
                  ) : (
                    filteredSiteLabour.map(r => {
                      const workerCount = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
                      const rate = Number(r.dailyWage || r.rate || r.categoryRate) || 0;
                      const amount = Number(r.totalAmount || (workerCount * rate));

                      return (
                        <tr key={r.id}>
                          <td className="font-mono">{formatDateDMY(r.attendanceDate || r.date)}</td>
                          <td style={{ fontWeight: "600" }}>{r.categoryName || r.category || r.teamName || "General Labour"}</td>
                          <td style={{ textAlign: "right", fontWeight: "700" }}>{workerCount}</td>
                          <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(rate)}</td>
                          <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace" }}>{formatINR(amount)}</td>
                          <td>{r.recordedByName || r.engineerName || "Site Engineer"}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── 4. Materials Tab ── */}
        {selectedSiteTab === "materials" && (
          <Card title={`Material Inventory for "${selectedSite.siteName}"`} variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Material Name</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Quantity</th>
                    <th>Unit</th>
                    <th style={{ textAlign: "right" }}>Unit Rate</th>
                    <th style={{ textAlign: "right" }}>Total Value</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSiteMaterials.length === 0 ? (
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No material logs found.</td></tr>
                  ) : (
                    filteredSiteMaterials.map(m => (
                      <tr key={m.id}>
                        <td style={{ fontWeight: "700" }}>{m.materialName || m.name || "Material"}</td>
                        <td>{m.category || "General"}</td>
                        <td style={{ textAlign: "right", fontWeight: "700" }}>{m.quantity || 0}</td>
                        <td>{m.unit || "units"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(m.unitRate || m.rate || 0)}</td>
                        <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace" }}>{formatINR(m.totalCost || ((m.quantity || 0) * (m.unitRate || 0)))}</td>
                        <td><Badge status={m.status || "In Stock"} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── 5. Expenses Tab ── */}
        {selectedSiteTab === "expenses" && (
          <Card title={`Site Expense Ledger for "${selectedSite.siteName}"`} variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Description</th>
                    <th>Category</th>
                    <th style={{ textAlign: "right" }}>Amount</th>
                    <th>Date</th>
                    <th>Paid To / Vendor</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredSiteExpenses.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No expenses logged for this site.</td></tr>
                  ) : (
                    filteredSiteExpenses.map(exp => (
                      <tr key={exp.id}>
                        <td style={{ fontWeight: "700" }}>{exp.description}</td>
                        <td>{exp.category || "General"}</td>
                        <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--danger-700)" }}>{formatINR(exp.amount)}</td>
                        <td className="font-mono">{formatDateDMY(exp.date)}</td>
                        <td>{exp.paidTo || "—"}</td>
                        <td><Badge status={exp.status || "Approved"} /></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        )}

        {/* ── 6. DPR Reports Tab ── */}
        {selectedSiteTab === "reports" && (
          <Card title={`Daily Progress Reports (DPRs) for "${selectedSite.siteName}"`}>
            {filteredSiteDprs.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "24px" }}>No Daily Progress Reports recorded for this selection.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {filteredSiteDprs.map(dpr => (
                  <div key={dpr.id} style={{ padding: "16px", borderRadius: "10px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px" }}>
                      <strong style={{ fontSize: "14px", color: "var(--primary-950)" }}>Date: {dpr.date || formatDateDMY(dpr.createdAt)}</strong>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>By: {dpr.submittedByName || dpr.engineerName || "Site Engineer"}</span>
                    </div>
                    <p style={{ margin: "0 0 6px 0", fontSize: "13px", color: "#334155", lineHeight: "1.5" }}>{dpr.workDescription || dpr.description || "No notes."}</p>
                    {dpr.weather && <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Weather Condition: {dpr.weather}</span>}
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── 7. Photos Gallery Tab ── */}
        {selectedSiteTab === "photos" && (
          <Card title={`Site Photos Gallery for "${selectedSite.siteName}" (${sitePhotos.length} Photos)`}>
            {sitePhotos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                <Camera size={32} style={{ color: "var(--primary-300)", marginBottom: "8px" }} />
                <p style={{ margin: 0, fontSize: "13px" }}>No site photos uploaded yet.</p>
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
                {sitePhotos.map((photo, idx) => (
                  <div
                    key={idx}
                    onClick={() => setSelectedPreviewImage(photo)}
                    style={{
                      border: "1px solid var(--border-color)",
                      borderRadius: "10px",
                      overflow: "hidden",
                      backgroundColor: "#fff",
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column"
                    }}
                  >
                    <div style={{ height: "140px", backgroundColor: "#f1f5f9", overflow: "hidden", position: "relative" }}>
                      <img
                        src={photo.url}
                        alt={photo.title}
                        style={{ width: "100%", height: "100%", objectFit: "cover" }}
                      />
                    </div>
                    <div style={{ padding: "10px" }}>
                      <strong style={{ fontSize: "12px", color: "var(--primary-950)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                        {photo.title}
                      </strong>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "10.5px", color: "var(--text-muted)", marginTop: "4px" }}>
                        <span>{photo.source}</span>
                        <span>{photo.date}</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* ── 8. Assigned Engineers Tab ── */}
        {selectedSiteTab === "engineers" && (
          <Card title={`Assigned Site Engineers for "${selectedSite.siteName}"`}>
            {siteAssignedEngineers.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "24px" }}>No engineers currently assigned to this site.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
                {siteAssignedEngineers.map(eng => {
                  const engId = eng.id || eng.uid;
                  const recentAtt = siteAttendanceRecords.find(r => r.resolvedEngineerId === engId);

                  return (
                    <div key={eng.id} style={{ padding: "14px 16px", borderRadius: "10px", border: "1px solid var(--border-color)", backgroundColor: "#f8fafc" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <strong style={{ fontSize: "14px", color: "var(--primary-950)" }}>{eng.fullName || eng.name}</strong>
                        <Badge status={eng.status || "active"} />
                      </div>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>📧 {eng.email || "—"}</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>📞 {eng.phoneNumber || eng.phone || "—"}</span>
                      <div style={{ borderTop: "1px solid #e2e8f0", marginTop: "8px", paddingTop: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                        Recent Attendance: {recentAtt ? `${formatDateDMY(recentAtt.date || recentAtt.attendanceDate)} (${recentAtt.isCheckedOut ? 'Checked Out' : 'On Site'})` : 'No logs'}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        )}

        {/* ── 9. Activity History Tab ── */}
        {selectedSiteTab === "activity" && (
          <Card title={`Operations Activity History for "${selectedSite.siteName}"`}>
            {siteActivities.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "24px" }}>No system activity recorded specifically for this site.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {siteActivities.map(act => (
                  <div key={act.id} style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--primary-950)" }}>{act.description || act.actionType}</strong>
                      <span style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "block" }}>By {act.userName || 'System'} · Module: {act.moduleType}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace" }}>
                      {act.createdAt?.seconds ? new Date(act.createdAt.seconds * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' }) : "Recently"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )}

        {/* Image Preview Modal */}
        {selectedPreviewImage && (
          <ConfirmationModal
            isOpen={!!selectedPreviewImage}
            onClose={() => setSelectedPreviewImage(null)}
            title={selectedPreviewImage.title || "Image Preview"}
            message=""
            confirmText="Close"
            variant="info"
            onConfirm={() => setSelectedPreviewImage(null)}
            details={
              <div style={{ textAlign: "center" }}>
                <img
                  src={selectedPreviewImage.url}
                  alt={selectedPreviewImage.title}
                  style={{ maxWidth: "100%", maxHeight: "500px", borderRadius: "8px", objectFit: "contain" }}
                />
              </div>
            }
          />
        )}

      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 3: SITE ENGINEERS MONITORING
  // ══════════════════════════════════════════════════════════════════════════
  const renderEngineersView = () => {
    const filteredEngineers = engineers.filter(e => {
      if (engineerSearchQuery.trim()) {
        const q = engineerSearchQuery.toLowerCase().trim();
        const matchName = (e.fullName || e.name || "").toLowerCase().includes(q);
        const matchEmail = (e.email || "").toLowerCase().includes(q);
        const matchPhone = (e.phoneNumber || e.phone || "").toLowerCase().includes(q);
        if (!matchName && !matchEmail && !matchPhone) return false;
      }
      return true;
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Site Engineers Directory ({filteredEngineers.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Oversight of all registered field engineers, their current site assignments, and live attendance standing.
            </p>
          </div>

          <div style={{ position: "relative", minWidth: "220px" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search engineer name, email..."
              value={engineerSearchQuery}
              onChange={(e) => setEngineerSearchQuery(e.target.value)}
              style={{ width: "100%", height: "36px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <Card variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Engineer Name</th>
                  <th>Email Address</th>
                  <th>Phone Number</th>
                  <th>Status</th>
                  <th>Assigned Sites</th>
                  <th>Today's Attendance</th>
                  <th style={{ textAlign: "center" }}>Details</th>
                </tr>
              </thead>
              <tbody>
                {filteredEngineers.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No site engineers found.</td></tr>
                ) : (
                  filteredEngineers.map(eng => {
                    const engId = eng.id || eng.uid;
                    const assignedSiteList = sites.filter(s => (s.assignedEngineers || []).includes(engId) || assignments.some(a => (a.engineerId === engId || a.userId === engId) && a.siteId === s.id));
                    const todayRec = todayAttendanceList.find(r => r.resolvedEngineerId === engId);

                    return (
                      <tr key={eng.id}>
                        <td style={{ fontWeight: "700" }}>{eng.fullName || eng.name}</td>
                        <td>{eng.email || "—"}</td>
                        <td>{eng.phoneNumber || eng.phone || "—"}</td>
                        <td><Badge status={eng.status || "active"} /></td>
                        <td>
                          {assignedSiteList.length === 0 ? (
                            <span style={{ color: "var(--text-muted)", fontSize: "11.5px" }}>Unassigned</span>
                          ) : (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {assignedSiteList.map(s => (
                                <span key={s.id} style={{ fontSize: "11px", padding: "2px 6px", borderRadius: "4px", backgroundColor: "#f1f5f9", color: "#334155", fontWeight: "600" }}>
                                  {s.siteName}
                                </span>
                              ))}
                            </div>
                          )}
                        </td>
                        <td>
                          {todayRec ? (
                            <span style={{
                              fontSize: "11px",
                              fontWeight: "750",
                              padding: "2px 8px",
                              borderRadius: "12px",
                              backgroundColor: todayRec.isCheckedOut ? "#f1f5f9" : "#dcfce7",
                              color: todayRec.isCheckedOut ? "#475569" : "#15803d"
                            }}>
                              {todayRec.isCheckedOut ? "Checked Out" : `On Site (${todayRec.siteName})`}
                            </span>
                          ) : (
                            <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Not Checked In</span>
                          )}
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <button
                            type="button"
                            onClick={() => setSelectedEngineerDetail(eng)}
                            style={{ border: "none", background: "none", color: "var(--primary-600)", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {selectedEngineerDetail && (
          <ConfirmationModal
            isOpen={!!selectedEngineerDetail}
            onClose={() => setSelectedEngineerDetail(null)}
            title={`Engineer Profile: ${selectedEngineerDetail.fullName || selectedEngineerDetail.name}`}
            message=""
            confirmText="Close"
            variant="info"
            onConfirm={() => setSelectedEngineerDetail(null)}
            details={
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", fontSize: "12.5px" }}>
                <div><strong>Email:</strong> {selectedEngineerDetail.email || "—"}</div>
                <div><strong>Phone:</strong> {selectedEngineerDetail.phoneNumber || selectedEngineerDetail.phone || "—"}</div>
                <div><strong>Status:</strong> {selectedEngineerDetail.status || "active"}</div>
                <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "8px" }}>
                  <strong>Site Assignments:</strong>
                  <ul style={{ margin: "4px 0 0 16px", padding: 0 }}>
                    {sites.filter(s => (s.assignedEngineers || []).includes(selectedEngineerDetail.id) || assignments.some(a => a.engineerId === selectedEngineerDetail.id && a.siteId === s.id)).map(s => (
                      <li key={s.id} style={{ marginBottom: "4px" }}>
                        {s.siteName} ({s.location}) — Status: {s.status || "Active"}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            }
          />
        )}
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 4: ADMIN ACCOUNTS MONITORING
  // ══════════════════════════════════════════════════════════════════════════
  const renderAdminsView = () => {
    const filteredAdmins = admins.filter(a => {
      if (adminSearchQuery.trim()) {
        const q = adminSearchQuery.toLowerCase().trim();
        return (a.fullName || a.name || "").toLowerCase().includes(q) || (a.email || "").toLowerCase().includes(q);
      }
      return true;
    });

    const superAdminCount = admins.filter(a => a.role === "super_admin" || a.role === "superadmin").length;
    const siteAdminCount = admins.length - superAdminCount;

    return (
      <div className="admin-dashboard-container">
        {/* KPI Summary Cards */}
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-purple">
              <ShieldCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{admins.length || 1}</div>
              <div className="admin-summary-label">Total Administrators</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <ShieldCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{superAdminCount || 1}</div>
              <div className="admin-summary-label">Super Admins</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-blue">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{siteAdminCount}</div>
              <div className="admin-summary-label">Site Administrators</div>
            </div>
          </div>
        </div>

        {/* Toolbar */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Administrator Accounts Directory ({filteredAdmins.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Authorized company administrators, management personnel, and role assignments.
            </p>
          </div>

          <div className="sites-search-wrapper" style={{ maxWidth: "340px" }}>
            <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
            <input
              type="text"
              placeholder="Search admin name, email..."
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              style={{ width: "100%", height: "40px", paddingLeft: "36px", paddingRight: "12px", borderRadius: "10px", border: "1.5px solid var(--border-color)", fontSize: "13px", boxSizing: "border-box", outline: "none", backgroundColor: "#fff" }}
            />
          </div>
        </div>

        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Admin Name</th>
                  <th>Email Address</th>
                  <th>Role Scope</th>
                  <th>Account Status</th>
                  <th>Managed Sites</th>
                  <th>Assigned Identifier</th>
                </tr>
              </thead>
              <tbody>
                {filteredAdmins.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No administrator accounts found.</td></tr>
                ) : (
                  filteredAdmins.map(adm => {
                    const admId = adm.id || adm.uid;
                    const managedSitesCount = sites.filter(s => s.adminId === admId || s.createdBy === admId || (s.assignedAdmins || []).includes(admId)).length;

                    return (
                      <tr key={adm.id}>
                        <td style={{ fontWeight: "700" }}>{adm.fullName || adm.name || "Administrator"}</td>
                        <td>{adm.email || "—"}</td>
                        <td>
                          <Badge status={adm.role === "super_admin" || adm.role === "superadmin" ? "warning" : "info"}>
                            {adm.role === "super_admin" || adm.role === "superadmin" ? "Super Admin" : "Administrator"}
                          </Badge>
                        </td>
                        <td><Badge status={adm.status || "active"} /></td>
                        <td>{managedSitesCount > 0 ? `${managedSitesCount} Sites` : "Enterprise / Global"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "11.5px", color: "var(--primary-600)" }}>
                          {adm.id ? `${adm.id.substring(0, 12)}...` : "—"}
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
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 5: ATTENDANCE MONITORING
  // ══════════════════════════════════════════════════════════════════════════
  const renderAttendanceView = () => {
    const filteredAttendance = allDeduplicatedAttendance.filter(r => {
      if (attendanceSiteFilter && r.resolvedSiteId !== attendanceSiteFilter) return false;
      if (attendanceStatusFilter === "onsite" && r.isCheckedOut) return false;
      if (attendanceStatusFilter === "checkout" && !r.isCheckedOut) return false;
      if (attendanceDateFilter && (r.date || r.attendanceDate) !== attendanceDateFilter) return false;
      if (attendanceSearchQuery.trim()) {
        const q = attendanceSearchQuery.toLowerCase().trim();
        const matchEng = (r.engineerName || "").toLowerCase().includes(q);
        const matchSite = (r.siteName || "").toLowerCase().includes(q);
        if (!matchEng && !matchSite) return false;
      }
      return true;
    });

    const onSiteCount = filteredAttendance.filter(r => !r.isCheckedOut).length;
    const checkedOutCount = filteredAttendance.filter(r => r.isCheckedOut).length;
    const verifiedCount = filteredAttendance.filter(r => r.isVerified).length;

    return (
      <div className="admin-dashboard-container">
        {/* KPI Summary Cards */}
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-green">
              <ClipboardCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{filteredAttendance.length}</div>
              <div className="admin-summary-label">Total Records</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-teal">
              <UserCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{onSiteCount}</div>
              <div className="admin-summary-label">On Site Now</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <Clock size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{checkedOutCount}</div>
              <div className="admin-summary-label">Checked Out</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <ShieldCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{verifiedCount}</div>
              <div className="admin-summary-label">GPS Verified</div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Master Engineer Attendance Monitor ({filteredAttendance.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Audit ledger of field engineer check-ins, check-outs, photo proofs, and geofence locations.
            </p>
          </div>

          <div className="sites-actions-group">
            <div className="sites-search-wrapper" style={{ minWidth: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search engineer, site..."
                value={attendanceSearchQuery}
                onChange={(e) => setAttendanceSearchQuery(e.target.value)}
                style={{ width: "100%", height: "38px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={attendanceSiteFilter}
              onChange={(e) => setAttendanceSiteFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
            <select
              value={attendanceStatusFilter}
              onChange={(e) => setAttendanceStatusFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="all">All Status</option>
              <option value="onsite">On Site</option>
              <option value="checkout">Checked Out</option>
            </select>
            <input
              type="date"
              value={attendanceDateFilter}
              onChange={(e) => setAttendanceDateFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
            />
            {attendanceDateFilter && (
              <button
                type="button"
                onClick={() => setAttendanceDateFilter("")}
                className="btn btn-outline"
                style={{ height: "38px", padding: "0 10px", fontSize: "12px" }}
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Engineer</th>
                  <th>Project Site</th>
                  <th>Date</th>
                  <th>Check-In</th>
                  <th>Check-Out</th>
                  <th>Status</th>
                  <th>Verification</th>
                  <th style={{ textAlign: "center" }}>Photo Proof</th>
                </tr>
              </thead>
              <tbody>
                {filteredAttendance.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No attendance records found.</td></tr>
                ) : (
                  filteredAttendance.map(rec => (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: "700" }}>{rec.engineerName}</td>
                      <td>{rec.siteName}</td>
                      <td className="font-mono">{formatDateDMY(rec.date || rec.attendanceDate)}</td>
                      <td className="font-mono">{rec.checkInTimeFormatted}</td>
                      <td className="font-mono">{rec.checkOutTimeFormatted || "—"}</td>
                      <td>
                        <Badge status={rec.isCheckedOut ? "default" : "success"}>
                          {rec.isCheckedOut ? "Checked Out" : "On Site"}
                        </Badge>
                      </td>
                      <td>
                        <span style={{ fontSize: "11.5px", color: rec.isVerified ? "#16a34a" : "#ca8a04", fontWeight: "700" }}>
                          {rec.isVerified ? "✓ Verified GPS" : "Pending"}
                        </span>
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {rec.photoUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewImage({ url: rec.photoUrl, title: `Attendance: ${rec.engineerName}` })}
                            style={{ border: "none", background: "none", color: "var(--brand-orange)", fontWeight: "750", fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                          >
                            <Eye size={13} /> View
                          </button>
                        ) : "—"}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 8: FINANCIAL LEDGER & SITE EXPENSES
  // ══════════════════════════════════════════════════════════════════════════
  const renderFinanceView = () => {
    const siteWiseFinancials = sites.map(site => {
      const siteMaterials = materials.filter(m => m.siteId === site.id);
      const siteLabour = laborHistoryMap[site.id] || [];
      const siteDprs = allDprs.filter(d => d.siteId === site.id);
      return {
        site,
        financials: getSiteFinancials(site, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments)
      };
    });

    const filteredExpenses = generalExpenses.filter(e => {
      if (expenseSiteFilter && e.siteId !== expenseSiteFilter) return false;
      if (expenseSearchQuery.trim()) {
        const q = expenseSearchQuery.toLowerCase().trim();
        const matchDesc = (e.description || "").toLowerCase().includes(q);
        const matchCat = (e.category || "").toLowerCase().includes(q);
        const matchPaid = (e.paidTo || "").toLowerCase().includes(q);
        const matchSite = (sites.find(s => s.id === e.siteId)?.siteName || "").toLowerCase().includes(q);
        if (!matchDesc && !matchCat && !matchPaid && !matchSite) return false;
      }
      return true;
    });

    const totalMatExp = siteWiseFinancials.reduce((acc, c) => acc + c.financials.materialExpenses, 0);
    const totalLabExp = siteWiseFinancials.reduce((acc, c) => acc + c.financials.labourExpenses, 0);

    return (
      <div className="admin-dashboard-container">
        {/* Financial KPI Summary Cards */}
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-teal">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(overallMetrics.totalProjectValue)}</div>
              <div className="admin-summary-label">Total Project Budget</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(overallMetrics.totalExpenses)}</div>
              <div className="admin-summary-label">Total Outlay Spent</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-green">
              <TrendingUp size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(overallMetrics.totalPaymentsReceived)}</div>
              <div className="admin-summary-label">Client Collections</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-red">
              <AlertTriangle size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(overallMetrics.pendingPayments)}</div>
              <div className="admin-summary-label">Balance Owed</div>
            </div>
          </div>
        </div>

        {/* Section 1: Site-wise Ledger Table */}
        <div className="admin-table-card">
          <div className="admin-table-header">
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Corporate Site-wise Financial Ledger</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--primary-600)" }}>Site-by-site budgets, material outlays, labour costs, client receivables, and balances</p>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th style={{ textAlign: "right" }}>Budget Value</th>
                  <th style={{ textAlign: "right" }}>Material Costs</th>
                  <th style={{ textAlign: "right" }}>Labour Costs</th>
                  <th style={{ textAlign: "right" }}>Other Costs</th>
                  <th style={{ textAlign: "right" }}>Total Spent</th>
                  <th style={{ textAlign: "right" }}>Received (Client)</th>
                  <th style={{ textAlign: "right" }}>Balance Owed</th>
                </tr>
              </thead>
              <tbody>
                {siteWiseFinancials.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No sites found.</td></tr>
                ) : (
                  siteWiseFinancials.map(({ site, financials }) => (
                    <tr key={site.id}>
                      <td style={{ fontWeight: "700" }}>{site.siteName}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.budget)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.materialExpenses)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.labourExpenses)}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(financials.otherExpenses)}</td>
                      <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace" }}>{formatINR(financials.totalSpent)}</td>
                      <td style={{ textAlign: "right", color: "var(--success-700)", fontFamily: "monospace" }}>{formatINR(financials.paymentsReceived)}</td>
                      <td style={{ textAlign: "right", color: "var(--danger-700)", fontWeight: "600", fontFamily: "monospace" }}>{formatINR(financials.remainingBalance)}</td>
                    </tr>
                  ))
                )}
                <tr style={{ backgroundColor: "#f8fafc", fontWeight: "800", borderTop: "2px solid var(--border-color)" }}>
                  <td>Corporate Totals</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalProjectValue)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(totalMatExp)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(totalLabExp)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(siteWiseFinancials.reduce((acc, c) => acc + c.financials.otherExpenses, 0))}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalExpenses)}</td>
                  <td style={{ textAlign: "right", color: "var(--success-700)", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalPaymentsReceived)}</td>
                  <td style={{ textAlign: "right", color: "var(--danger-700)", fontFamily: "monospace" }}>{formatINR(siteWiseFinancials.reduce((acc, c) => acc + c.financials.remainingBalance, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Section 2: General Expenses Table */}
        <div className="admin-table-card">
          <div className="admin-table-header" style={{ flexWrap: "wrap", gap: "10px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Field &amp; General Expenses Ledger ({filteredExpenses.length})</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--primary-600)" }}>Itemized operational expenses filed across all site locations</p>
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Search description..."
                value={expenseSearchQuery}
                onChange={(e) => setExpenseSearchQuery(e.target.value)}
                style={{ height: "36px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12px" }}
              />
              <select
                value={expenseSiteFilter}
                onChange={(e) => setExpenseSiteFilter(e.target.value)}
                style={{ height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12px" }}
              >
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
              </select>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Description</th>
                  <th>Project Site</th>
                  <th>Category</th>
                  <th style={{ textAlign: "right" }}>Amount</th>
                  <th>Date</th>
                  <th>Paid To</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No general expenses found.</td></tr>
                ) : (
                  filteredExpenses.map(exp => (
                    <tr key={exp.id}>
                      <td style={{ fontWeight: "700" }}>{exp.description}</td>
                      <td>{sites.find(s => s.id === exp.siteId)?.siteName || "General / HQ"}</td>
                      <td>{exp.category || "General"}</td>
                      <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--danger-700)" }}>{formatINR(exp.amount)}</td>
                      <td className="font-mono">{formatDateDMY(exp.date)}</td>
                      <td>{exp.paidTo || "—"}</td>
                      <td><Badge status={exp.status || "Approved"} /></td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 9: SCHEDULE STANDING & PROGRESS
  // ══════════════════════════════════════════════════════════════════════════
  const renderProgressView = () => {
    const delayedList = sites.filter(s => isSiteDelayed(s));

    return (
      <div className="admin-dashboard-container">
        {/* Delayed Alert Card */}
        {delayedList.length > 0 && (
          <div className="admin-card" style={{ borderLeft: "4px solid var(--danger-500)", backgroundColor: "#fef2f2" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger-700)", fontWeight: "800", fontSize: "14px" }}>
              <AlertTriangle size={18} />
              <span>Delayed Construction Projects ({delayedList.length} sites require review)</span>
            </div>
            <ul style={{ margin: "6px 0 0 20px", padding: 0, fontSize: "13px", color: "#334155" }}>
              {delayedList.map(s => {
                const siteMaterials = materials.filter(m => m.siteId === s.id);
                const siteLabour = laborHistoryMap[s.id] || [];
                const siteDprs = allDprs.filter(d => d.siteId === s.id);
                const financials = getSiteFinancials(s, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
                const planned = calculatePlannedProgress(s.startDate, s.expectedEndDate);
                
                return (
                  <li key={s.id} style={{ marginBottom: "4px" }}>
                    <strong>{s.siteName}</strong>: Target completion: <u>{formatDateDMY(s.expectedEndDate)}</u>. Actual progress: <strong>{financials.progressPercent}%</strong> (Planned: {planned}%, Gap: -{planned - financials.progressPercent}%).
                  </li>
                );
              })}
            </ul>
          </div>
        )}

        <div className="admin-table-card">
          <div className="admin-table-header">
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Corporate Site Progress Standing Ledger</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--primary-600)" }}>Linear milestone targets vs actual execution progress and schedule status</p>
            </div>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>Client Name</th>
                  <th>Target Completion Date</th>
                  <th style={{ textAlign: "right" }}>Actual Progress</th>
                  <th style={{ textAlign: "right" }}>Planned Target</th>
                  <th style={{ textAlign: "right" }}>Variance (Gap)</th>
                  <th>Schedule Standing</th>
                </tr>
              </thead>
              <tbody>
                {sites.map(site => {
                  const siteMaterials = materials.filter(m => m.siteId === site.id);
                  const siteLabour = laborHistoryMap[site.id] || [];
                  const siteDprs = allDprs.filter(d => d.siteId === site.id);
                  const financials = getSiteFinancials(site, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
                  const planned = calculatePlannedProgress(site.startDate, site.expectedEndDate);
                  const gap = financials.progressPercent - planned;
                  
                  let standingText = "On Track";
                  let standingBadge = "success";
                  if (gap < 0) {
                    standingText = "Delayed";
                    standingBadge = "danger";
                  } else if (gap > 5) {
                    standingText = "Ahead of Schedule";
                    standingBadge = "success";
                  }
                  
                  return (
                    <tr key={site.id}>
                      <td style={{ fontWeight: "700" }}>{site.siteName}</td>
                      <td>{site.clientName || "—"}</td>
                      <td className="font-mono">{formatDateDMY(site.expectedEndDate)}</td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>{financials.progressPercent}%</td>
                      <td style={{ textAlign: "right" }}>{planned}%</td>
                      <td style={{ textAlign: "right", fontWeight: "700", color: gap >= 0 ? "var(--success-700)" : "var(--danger-700)" }}>
                        {gap >= 0 ? `+${gap}%` : `${gap}%`}
                      </td>
                      <td><Badge status={standingBadge}>{standingText}</Badge></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 11: SYSTEM ACTIVITY & AUDIT TRAIL
  // ══════════════════════════════════════════════════════════════════════════
  const renderActivityView = () => {
    const filteredActivities = systemActivities.filter(a => {
      if (activityModuleFilter !== "all" && (a.moduleType || "").toLowerCase() !== activityModuleFilter.toLowerCase()) return false;
      if (activitySearchQuery.trim()) {
        const q = activitySearchQuery.toLowerCase().trim();
        const matchDesc = (a.description || "").toLowerCase().includes(q);
        const matchUser = (a.userName || "").toLowerCase().includes(q);
        const matchSite = (a.siteName || "").toLowerCase().includes(q);
        if (!matchDesc && !matchUser && !matchSite) return false;
      }
      return true;
    });

    return (
      <div className="admin-dashboard-container">
        {/* Toolbar & Filters */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              System Activity &amp; Audit Trail ({filteredActivities.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Chronological immutable record of administrative actions, check-ins, labour logs, and financial transactions.
            </p>
          </div>

          <div className="sites-actions-group">
            <div className="sites-search-wrapper" style={{ minWidth: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search user, action, site..."
                value={activitySearchQuery}
                onChange={(e) => setActivitySearchQuery(e.target.value)}
                style={{ width: "100%", height: "38px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={activityModuleFilter}
              onChange={(e) => setActivityModuleFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="all">All Modules</option>
              <option value="attendance">Attendance</option>
              <option value="labour">Labour</option>
              <option value="materials">Materials</option>
              <option value="progress">Progress</option>
              <option value="finance">Finance</option>
            </select>
          </div>
        </div>

        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>User</th>
                  <th>Module</th>
                  <th>Action / Details</th>
                  <th>Site</th>
                </tr>
              </thead>
              <tbody>
                {filteredActivities.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No system activity recorded.</td></tr>
                ) : (
                  filteredActivities.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono" style={{ fontSize: "11.5px", color: "var(--primary-600)" }}>
                        {a.createdAt?.seconds 
                          ? new Date(a.createdAt.seconds * 1000).toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', hour12: true })
                          : "Just now"}
                      </td>
                      <td style={{ fontWeight: "700" }}>{a.userName || "System"}</td>
                      <td><Badge status="info">{a.moduleType || "General"}</Badge></td>
                      <td>{a.description || a.actionType || "Action recorded"}</td>
                      <td>{a.siteName || "General / HQ"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  };




  return (
    <Layout
      title={
        tab === "dashboard" ? "Executive Summary Dashboard" :
        tab === "sites" ? "All Sites Operations Monitor" :
        tab === "engineers" ? "Site Engineers Directory" :
        tab === "admins" ? "Administrator Accounts Oversight" :
        tab === "attendance" ? "Master Attendance Monitor" :
        tab === "labour" ? "Daily Labour & Workforce" :
        tab === "materials" ? "Material Stock Inventory" :
        tab === "finance" ? "Financial Ledger & Expenses" :
        tab === "progress" ? "Schedule & Progress Standing" :
        tab === "approvals" ? "Central Approvals Gateway" :
        tab === "activity" ? "System Activity & Audit Trail" :
        `Super Admin: ${tab.charAt(0).toUpperCase() + tab.slice(1)}`
      }
      description="Corporate management monitor console for decision reviews and financial auditing."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {tab === "dashboard" && renderDashboardView()}
      {tab === "sites" && renderSitesView()}
      {tab === "engineers" && renderEngineersView()}
      {tab === "admins" && renderAdminsView()}
      {tab === "attendance" && renderAttendanceView()}
      {tab === "labour" && renderLabourView()}
      {tab === "materials" && renderMaterialsView()}
      {tab === "finance" && renderFinanceView()}
      {tab === "progress" && renderProgressView()}
      {tab === "approvals" && renderApprovalsView()}
      {tab === "activity" && renderActivityView()}

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />

      {/* ── 1. EXPANDED TODAY ATTENDANCE MODAL ── */}
      <Modal
        isOpen={showTodayAttendanceModal}
        onClose={() => setShowTodayAttendanceModal(false)}
        title={`Today's Attendance Master Ledger — (${formattedTodayDate})`}
        maxWidth="1100px"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* Header Summary */}
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
                <span>Present: {todayAttendanceList.length}/{engineers.filter(e => e.status === "active").length}</span>
              </div>
              <div className="admin-attendance-metric-pill onsite">
                <Clock size={14} />
                <span>On-Site Now: {todayAttendanceList.filter(r => !r.isCheckedOut).length}</span>
              </div>
              <div className="admin-attendance-metric-pill checkout">
                <CheckCircle2 size={14} />
                <span>Checked Out: {todayAttendanceList.filter(r => r.isCheckedOut).length}</span>
              </div>
              <div className="admin-attendance-metric-pill verified">
                <ShieldCheck size={14} />
                <span>GPS Verified: {todayAttendanceList.filter(r => r.isVerified).length}</span>
              </div>
            </div>

            <div className="admin-attendance-live-badge">
              <span className="admin-attendance-live-dot" />
              Live Real-Time Sync
            </div>
          </div>

          {/* Controls Bar */}
          <div className="admin-attendance-controls-bar" style={{ margin: 0 }}>
            <div className="admin-attendance-search-group">
              <div className="admin-attendance-search-input-wrap">
                <Search size={14} className="admin-attendance-search-icon" />
                <input 
                  type="text"
                  placeholder="Search engineer name, email or site..."
                  value={dashboardAttendanceSearch}
                  onChange={(e) => setDashboardAttendanceSearch(e.target.value)}
                  className="admin-attendance-search-input"
                />
              </div>

              <select
                value={dashboardAttendanceSiteFilter}
                onChange={(e) => setDashboardAttendanceSiteFilter(e.target.value)}
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
                className={`admin-attendance-tab-btn ${dashboardAttendanceStatusFilter === "all" ? "active" : ""}`}
                onClick={() => setDashboardAttendanceStatusFilter("all")}
              >
                All Checked-In ({todayAttendanceList.length})
              </button>
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${dashboardAttendanceStatusFilter === "onsite" ? "active" : ""}`}
                onClick={() => setDashboardAttendanceStatusFilter("onsite")}
              >
                On-Site Now ({todayAttendanceList.filter(r => !r.isCheckedOut).length})
              </button>
              <button 
                type="button"
                className={`admin-attendance-tab-btn ${dashboardAttendanceStatusFilter === "checkout" ? "active" : ""}`}
                onClick={() => setDashboardAttendanceStatusFilter("checkout")}
              >
                Checked Out ({todayAttendanceList.filter(r => r.isCheckedOut).length})
              </button>
            </div>
          </div>

          {/* Table */}
          <div className="admin-attendance-table-wrap" style={{ maxHeight: "60vh", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
            {filteredDashboardAttendance.length === 0 ? (
              <div style={{ textAlign: "center", padding: "36px", color: "var(--text-muted)" }}>
                No attendance records match the selected filters.
              </div>
            ) : (
              <table className="admin-attendance-table">
                <thead>
                  <tr>
                    <th>Engineer</th>
                    <th>Assigned Site</th>
                    <th>Check-In Time</th>
                    <th>Check-Out / Status</th>
                    <th>GPS Coordinates &amp; Verification</th>
                    <th style={{ textAlign: "center" }}>Photo Proof</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredDashboardAttendance.map(rec => (
                    <tr key={rec.id}>
                      <td>
                        <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block" }}>{rec.engineerName}</strong>
                        <span style={{ fontSize: "11px", color: "var(--primary-600)" }}>{rec.engineerEmail || rec.engineerPhone || "Site Engineer"}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>{rec.siteName}</strong>
                      </td>
                      <td>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "#15803d" }}>{rec.checkInTimeFormatted}</span>
                      </td>
                      <td>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "750",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          backgroundColor: rec.isCheckedOut ? "#f1f5f9" : "#dcfce7",
                          color: rec.isCheckedOut ? "#475569" : "#15803d"
                        }}>
                          {rec.isCheckedOut ? `Checked Out (${rec.checkOutTimeFormatted || "Done"})` : "On Site"}
                        </span>
                      </td>
                      <td>
                        {rec.latitude && rec.longitude ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "11px" }}>
                            <span className="font-mono" style={{ color: "var(--primary-700)" }}>{Number(rec.latitude).toFixed(5)}, {Number(rec.longitude).toFixed(5)}</span>
                            <span style={{ color: rec.isVerified ? "#15803d" : "#ea580c", fontWeight: "600" }}>
                              {rec.isVerified ? "✓ Verified Location" : "Location Pending"}
                            </span>
                          </div>
                        ) : (
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>GPS Logged</span>
                        )}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        {rec.photoUrl ? (
                          <button
                            type="button"
                            onClick={() => setSelectedPreviewImage({ url: rec.photoUrl, title: `Check-in Photo — ${rec.engineerName}` })}
                            style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                          >
                            <img src={rec.photoUrl} alt="Check-in Proof" style={{ width: "34px", height: "34px", borderRadius: "6px", objectFit: "cover", border: "1px solid #cbd5e1" }} />
                          </button>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </Modal>

      {/* ── 2. SITE OPERATIONS SUPERVISION DETAIL MODAL ── */}
      {selectedInspectSite && (
        <Modal
          isOpen={!!selectedInspectSite}
          onClose={() => setSelectedInspectSite(null)}
          title={`Operations Deep-Dive: ${selectedInspectSite.siteName}`}
          maxWidth="960px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Top Site Metadata Banner */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div>
                <strong style={{ fontSize: "14px", color: "var(--primary-950)", display: "block" }}>{selectedInspectSite.siteName}</strong>
                <span style={{ fontSize: "12px", color: "var(--primary-600)" }}>Client: {selectedInspectSite.clientName || "Corporate Client"} • Location: {selectedInspectSite.location || "N/A"}</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700" }}>Budget: {formatINR(selectedInspectSite.budget || selectedInspectSite.projectValue || 0)}</span>
                <Badge status={selectedInspectSite.status || "active"} />
              </div>
            </div>

            {/* Sub-Tabs */}
            <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
              {[
                { id: "engineers", label: "Assigned Engineers & Presence" },
                { id: "labour", label: "Today's Labour Force" },
                { id: "materials", label: "Material Stock" },
                { id: "progress", label: "Progress & DPRs" }
              ].map(tabItem => (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setSiteModalActiveTab(tabItem.id)}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: siteModalActiveTab === tabItem.id ? "var(--brand-orange)" : "transparent",
                    color: siteModalActiveTab === tabItem.id ? "#fff" : "var(--primary-700)",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer"
                  }}
                >
                  {tabItem.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Engineers */}
            {siteModalActiveTab === "engineers" && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800" }}>Engineers Assigned to Site</h4>
                {engineers.filter(e => e.assignedSiteId === selectedInspectSite.id || (Array.isArray(e.assignedSites) && e.assignedSites.includes(selectedInspectSite.id)) || assignments.some(a => a.siteId === selectedInspectSite.id && (a.engineerId === e.id || a.engineerId === e.uid))).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>No engineers currently assigned to this site.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {engineers.filter(e => e.assignedSiteId === selectedInspectSite.id || (Array.isArray(e.assignedSites) && e.assignedSites.includes(selectedInspectSite.id)) || assignments.some(a => a.siteId === selectedInspectSite.id && (a.engineerId === e.id || a.engineerId === e.uid))).map(eng => {
                      const todayRec = todayAttendanceList.find(r => r.resolvedSiteId === selectedInspectSite.id && (r.resolvedEngineerId === eng.id || r.resolvedEngineerId === eng.uid));
                      return (
                        <div key={eng.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                          <div>
                            <strong style={{ fontSize: "13px", color: "var(--primary-950)" }}>{eng.fullName || eng.name}</strong>
                            <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block" }}>{eng.email} • {eng.phoneNumber || eng.phone || ""}</span>
                          </div>
                          <div>
                            {todayRec ? (
                              <span style={{ fontSize: "11px", fontWeight: "750", padding: "2px 8px", borderRadius: "10px", backgroundColor: todayRec.isCheckedOut ? "#f1f5f9" : "#dcfce7", color: todayRec.isCheckedOut ? "#475569" : "#15803d" }}>
                                {todayRec.isCheckedOut ? "Checked Out" : `On Site (${todayRec.checkInTimeFormatted})`}
                              </span>
                            ) : (
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Not Checked In Today</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Labour */}
            {siteModalActiveTab === "labour" && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800" }}>Today's Field Workforce Attendance</h4>
                {(rawLabourAttendance || []).filter(r => !r.lockedMetadata && r.siteId === selectedInspectSite.id && (r.attendanceDate === todayDateString || r.date === todayDateString)).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>No labour attendance logged for this site today.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    {(rawLabourAttendance || []).filter(r => !r.lockedMetadata && r.siteId === selectedInspectSite.id && (r.attendanceDate === todayDateString || r.date === todayDateString)).map(r => (
                      <div key={r.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        <div>
                          <strong style={{ fontSize: "12.5px" }}>{r.categoryName || r.category || "General Labour"}</strong>
                          <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block" }}>{r.workerCount || 1} Workers @ ₹{r.dailyWage || r.rate || 0}/day</span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-950)" }}>
                          {formatINR(r.totalAmount || ((r.workerCount || 1) * (r.dailyWage || r.rate || 0)))}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 3: Materials */}
            {siteModalActiveTab === "materials" && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800" }}>Material Stock at Site</h4>
                {materials.filter(m => m.siteId === selectedInspectSite.id).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>No material stock records registered for this site.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "250px", overflowY: "auto" }}>
                    {materials.filter(m => m.siteId === selectedInspectSite.id).map(m => (
                      <div key={m.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        <div>
                          <strong style={{ fontSize: "12.5px" }}>{m.materialName || m.name}</strong>
                          <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block" }}>Stock: {m.quantity || m.currentStock || 0} {m.unit || "units"}</span>
                        </div>
                        <span style={{ fontSize: "12px", fontWeight: "700" }}>
                          {formatINR(m.totalCost || 0)}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Tab 4: Progress & DPRs */}
            {siteModalActiveTab === "progress" && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800" }}>Recent Daily Progress Reports</h4>
                {allDprs.filter(d => d.siteId === selectedInspectSite.id).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>No DPRs submitted for this site.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
                    {allDprs.filter(d => d.siteId === selectedInspectSite.id).slice(0, 5).map(d => (
                      <div key={d.id} style={{ padding: "10px 12px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "12px", color: "var(--primary-950)" }}>{d.date || "DPR Report"}</strong>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>By {d.submittedByName || d.engineerName || "Engineer"}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "11.5px", color: "var(--primary-700)" }}>{d.workDescription || d.description || "Progress report logged."}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── 3. PHOTO PROOF LIGHTBOX MODAL ── */}
      {selectedPreviewImage && (
        <ConfirmationModal
          isOpen={!!selectedPreviewImage}
          onClose={() => setSelectedPreviewImage(null)}
          title={selectedPreviewImage.title || "Photo Proof"}
          message=""
          confirmText="Close"
          variant="info"
          onConfirm={() => setSelectedPreviewImage(null)}
          details={
            <div style={{ textAlign: "center" }}>
              <img
                src={selectedPreviewImage.url}
                alt={selectedPreviewImage.title}
                style={{ maxWidth: "100%", maxHeight: "500px", borderRadius: "8px", objectFit: "contain" }}
              />
            </div>
          }
        />
      )}

      <Loading show={dataLoading} text="Updating database record..." />
    </Layout>
  );
}

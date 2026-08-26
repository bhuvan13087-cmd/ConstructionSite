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
  formatDateDMY,
  resolveLabourRecordCalculations
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
import ReportsDashboard from "./ReportsDashboard";
import Sites from "./Sites";

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

  // ── Owner Command Center Specific States ──
  const [showTodayAttendanceModal, setShowTodayAttendanceModal] = useState(false);
  const [selectedInspectSite, setSelectedInspectSite] = useState(null);
  const [selectedInspectRecord, setSelectedInspectRecord] = useState(null);
  const [kpiDrilldownState, setKpiDrilldownState] = useState({ isOpen: false, type: "", title: "", subtitle: "", items: [] });
  const [exceptionFilter, setExceptionFilter] = useState("all");
  const [dashboardSearchQuery, setDashboardSearchQuery] = useState("");
  const [dashboardActivityFilter, setDashboardActivityFilter] = useState("all");
  const [dashboardAttendanceSearch, setDashboardAttendanceSearch] = useState("");
  const [dashboardAttendanceSiteFilter, setDashboardAttendanceSiteFilter] = useState("");
  const [dashboardAttendanceStatusFilter, setDashboardAttendanceStatusFilter] = useState("all"); // 'all' | 'onsite' | 'checkout'
  const [siteModalActiveTab, setSiteModalActiveTab] = useState("engineers");
  const [attendanceViewSearch, setAttendanceViewSearch] = useState("");
  const [attendanceViewStatusFilter, setAttendanceViewStatusFilter] = useState("all");
  const [portfolioStatusFilter, setPortfolioStatusFilter] = useState("all");
  const [portfolioActivityFilter, setPortfolioActivityFilter] = useState("all");
  const [portfolioSortBy, setPortfolioSortBy] = useState("attention");


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

  // ── Site Supervision Modal Attendance Date Range Filter State ──
  const [siteAttendanceFromDate, setSiteAttendanceFromDate] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return d.toISOString().split("T")[0];
  });
  const [siteAttendanceToDate, setSiteAttendanceToDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [siteLaborInspectionDate, setSiteLaborInspectionDate] = useState(() => {
    try {
      return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Kolkata" }).format(new Date());
    } catch (e) {
      return new Date().toISOString().split("T")[0];
    }
  });

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
  const [labourDateFilter, setLabourDateFilter] = useState("");

  // ── Material Filters ──
  const [materialSearchQuery, setMaterialSearchQuery] = useState("");
  const [materialSiteFilter, setMaterialSiteFilter] = useState("");
  const [materialCategoryFilter, setMaterialCategoryFilter] = useState("all");
  const [materialStatusFilter, setMaterialStatusFilter] = useState("all");

  // ── Finance & Expense Filters ──
  const [expenseSearchQuery, setExpenseSearchQuery] = useState("");
  const [expenseSiteFilter, setExpenseSiteFilter] = useState("");

  // ── Payments & Payroll Filters ──
  const [paymentSearchQuery, setPaymentSearchQuery] = useState("");
  const [paymentSiteFilter, setPaymentSiteFilter] = useState("");
  const [paymentCategoryFilter, setPaymentCategoryFilter] = useState("all");
  const [paymentStatusFilter, setPaymentStatusFilter] = useState("all");
  const [payrollSearchQuery, setPayrollSearchQuery] = useState("");
  const [payrollSiteFilter, setPayrollSiteFilter] = useState("");

  // ── Reports Filters ──
  const [reportsSearchQuery, setReportsSearchQuery] = useState("");
  const [reportsSiteFilter, setReportsSiteFilter] = useState("");
  const [reportsDateFilter, setReportsDateFilter] = useState("");

  // ── Approvals Filters ──
  const [approvalsTypeFilter, setApprovalsTypeFilter] = useState("all");
  const [approvalsStatusFilter, setApprovalsStatusFilter] = useState("pending");

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
      if (!r || r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock" || r.lockedMetadata || r.type === "lock") return;
      const dateField = r.attendanceDate || r.date;
      if (dateField === todayDateString) {
        const { workerCount } = resolveLabourRecordCalculations(r);
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
  // VIEW 1: SUPER ADMIN EXECUTIVE DASHBOARD (OWNER COMMAND CENTER)
  // ══════════════════════════════════════════════════════════════════════════
  const renderDashboardView = () => {
    // 1. Core Computed Quantities from Canonical Firestore Data
    const activeSitesList = sites.filter(s => (s.status || "Active").toLowerCase() === "active");
    const activeSitesCount = activeSitesList.length;
    const planningSitesList = sites.filter(s => (s.status || "").toLowerCase() === "planning");
    const planningSitesCount = planningSitesList.length;
    const completedSitesList = sites.filter(s => (s.status || "").toLowerCase() === "completed");
    const completedSitesCount = completedSitesList.length;
    const delayedSitesList = sites.filter(s => (s.status || "").toLowerCase() === "delayed" || isSiteDelayed(s));
    const delayedSitesCount = delayedSitesList.length;
    const onTrackSitesCount = Math.max(0, activeSitesCount - delayedSitesCount);

    // Site Engineers & Attendance Pulse
    const activeEngineersList = engineers.filter(e => (e.status || "active").toLowerCase() === "active");
    const activeEngineersCount = activeEngineersList.length || engineers.length;
    const presentEngineersSet = new Set(todayAttendanceList.map(r => r.resolvedEngineerId || r.engineerName));
    const presentCount = presentEngineersSet.size;
    const pendingEngineersCount = Math.max(0, activeEngineersCount - presentCount);
    const attendanceRate = activeEngineersCount > 0 ? Math.round((presentCount / activeEngineersCount) * 100) : 0;

    // Labour & Workforce Today
    const sitesWithAttendanceSet = new Set(todayAttendanceList.map(r => r.resolvedSiteId));
    const sitesWithLabourTodaySet = new Set();
    let todayLabourExpense = 0;
    let masonCount = 0;
    let barbenderCount = 0;
    let carpenterCount = 0;
    let helperCount = 0;

    (rawLabourAttendance || []).forEach(r => {
      if (!r || r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock" || r.lockedMetadata || r.type === "lock") return;
      const dateField = r.attendanceDate || r.date;
      if (dateField === todayDateString) {
        if (r.siteId) sitesWithLabourTodaySet.add(r.siteId);
        const { workerCount, amount } = resolveLabourRecordCalculations(r);
        todayLabourExpense += amount;

        const cat = (r.categoryName || r.category || "").toLowerCase();
        if (cat.includes("mason") || cat.includes("karigar") || cat.includes("brick") || cat.includes("plaster")) {
          masonCount += workerCount;
        } else if (cat.includes("bar") || cat.includes("steel") || cat.includes("rebar") || cat.includes("bender")) {
          barbenderCount += workerCount;
        } else if (cat.includes("carpenter") || cat.includes("shutter") || cat.includes("centering") || cat.includes("formwork")) {
          carpenterCount += workerCount;
        } else {
          helperCount += workerCount;
        }
      }
    });

    const totalWorkforceToday = presentCount + todayLabourCount;
    const distinctTeams = new Set((rawLabourAttendance || []).filter(r => (r.attendanceDate || r.date) === todayDateString).map(r => r.teamId || r.teamName).filter(Boolean)).size || rawTeams.length;

    // Today's Materials Expense
    let todayMaterialExpense = 0;
    materials.forEach(m => {
      const mDate = m.date || (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
      if (mDate === todayDateString) {
        const qty = Number(m.quantity || m.currentStock) || 0;
        const rate = Number(m.unitRate || m.rate || m.unitPrice) || 0;
        todayMaterialExpense += Number(m.totalCost || m.amount) || (qty * rate);
      }
    });

    // Today's General Expenses
    let todayGeneralExpense = 0;
    generalExpenses.forEach(e => {
      if ((e.date || "").startsWith(todayDateString)) {
        todayGeneralExpense += Number(e.amount) || 0;
      }
    });

    const todayTotalExpenses = todayLabourExpense + todayMaterialExpense + todayGeneralExpense;

    // Overall Progress
    const totalProgressSum = sites.reduce((sum, s) => {
      const siteMaterials = materials.filter(m => m.siteId === s.id);
      const siteLabour = laborHistoryMap[s.id] || [];
      const siteDprs = allDprs.filter(d => d.siteId === s.id);
      const financials = getSiteFinancials(s, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
      return sum + (financials.progressPercent || Number(s.progress) || 0);
    }, 0);
    const averageProgressPercent = sites.length > 0 ? Math.round(totalProgressSum / sites.length) : 0;

    // Attention Required (Real Production Derivations)
    const alerts = [];
    activeSitesList.forEach(s => {
      if (!sitesWithAttendanceSet.has(s.id)) {
        alerts.push({
          id: `alert_att_${s.id}`,
          type: "danger",
          category: "Missing Attendance",
          title: `No Attendance: ${s.siteName}`,
          message: `Zero engineer check-ins recorded today.`,
          site: s
        });
      }
    });

    sites.forEach(s => {
      if (s.status === "Delayed" || isSiteDelayed(s)) {
        const planned = calculatePlannedProgress(s.startDate, s.expectedEndDate);
        const prog = Number(s.progress) || 0;
        const gap = Math.max(0, planned - prog);
        alerts.push({
          id: `alert_del_${s.id}`,
          type: "danger",
          category: "Schedule Delay",
          title: `Delayed: ${s.siteName}`,
          message: `${prog}% completed vs planned ${planned}% (${gap}% gap).`,
          site: s
        });
      }
    });

    approvals.forEach(a => {
      if ((a.status || "").toLowerCase() === "pending") {
        alerts.push({
          id: `alert_app_${a.id}`,
          type: "warning",
          category: "Pending Approval",
          title: `Pending Approval: ${a.type || "Request"}`,
          message: `${a.type || "Request"} from ${a.requestedBy || "Engineer"}.`,
          link: "/superadmin/approvals"
        });
      }
    });

    // Today's Operations Feed
    const todayFeedList = [];
    todayAttendanceList.forEach(rec => {
      todayFeedList.push({
        id: `att_${rec.id}`,
        user: rec.engineerName,
        action: rec.isCheckedOut ? "Checked Out" : "Checked In",
        site: rec.siteName,
        time: rec.checkInTimeFormatted,
        timestamp: rec.checkInTime?.seconds ? rec.checkInTime.seconds * 1000 : 0
      });
    });

    (rawLabourAttendance || []).forEach(r => {
      if (!r || r.lockedMetadata) return;
      if ((r.attendanceDate || r.date) === todayDateString) {
        const site = sites.find(s => s.id === r.siteId);
        const count = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
        todayFeedList.push({
          id: `lab_${r.id}`,
          user: r.recordedByName || r.engineerName || "Site Engineer",
          action: `Logged ${count} ${r.categoryName || r.category || "Workers"}`,
          site: site?.siteName || "Civil Site",
          time: r.createdAt?.seconds ? new Date(r.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: r.createdAt?.seconds ? r.createdAt.seconds * 1000 : 0
        });
      }
    });

    materials.forEach(m => {
      const mDate = m.date || (m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
      if (mDate === todayDateString) {
        const site = sites.find(s => s.id === m.siteId);
        todayFeedList.push({
          id: `mat_${m.id}`,
          user: m.recordedByName || m.engineerName || "Site Engineer",
          action: `Received ${m.quantity || 0} ${m.unit || "units"} of ${m.materialName || m.name || "Material"}`,
          site: site?.siteName || "Civil Site",
          time: m.createdAt?.seconds ? new Date(m.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: m.createdAt?.seconds ? m.createdAt.seconds * 1000 : 0
        });
      }
    });

    generalExpenses.forEach(e => {
      if ((e.date || "").startsWith(todayDateString)) {
        const site = sites.find(s => s.id === e.siteId);
        todayFeedList.push({
          id: `exp_${e.id}`,
          user: e.recordedByName || "Administrator",
          action: `Expense ₹${Number(e.amount || 0).toLocaleString()} (${e.description || e.category || "General"})`,
          site: site?.siteName || "General / HQ",
          time: e.createdAt?.seconds ? new Date(e.createdAt.seconds * 1000).toLocaleTimeString("en-IN", { timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true }) : "Today",
          timestamp: e.createdAt?.seconds ? e.createdAt.seconds * 1000 : 0
        });
      }
    });

    todayFeedList.sort((a, b) => b.timestamp - a.timestamp);

    // Site Performance list
    const sitePerformanceList = sites.map(site => {
      const siteMaterials = materials.filter(m => m.siteId === site.id);
      const siteLabour = laborHistoryMap[site.id] || [];
      const siteDprs = allDprs.filter(d => d.siteId === site.id);
      const financials = getSiteFinancials(site, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
      
      let siteWorkforceToday = 0;
      let siteTodayLabourCost = 0;
      (rawLabourAttendance || []).forEach(r => {
        if (!r || r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock" || r.lockedMetadata || r.type === "lock") return;
        if (r.siteId === site.id && (r.attendanceDate === todayDateString || r.date === todayDateString)) {
          const { workerCount, amount } = resolveLabourRecordCalculations(r);
          siteWorkforceToday += workerCount;
          siteTodayLabourCost += amount;
        }
      });

      const siteAssignedEngineers = engineers.filter(e => 
        (Array.isArray(site.assignedEngineers) && (site.assignedEngineers.includes(e.id) || site.assignedEngineers.includes(e.uid))) ||
        e.assignedSiteId === site.id || 
        (Array.isArray(e.assignedSites) && e.assignedSites.includes(site.id)) || 
        assignments.some(a => a.siteId === site.id && (a.engineerId === e.id || a.engineerId === e.uid))
      );

      return {
        site,
        progress: financials.progressPercent || Number(site.progress) || 0,
        workforce: siteWorkforceToday,
        todayLabourCost: siteTodayLabourCost,
        assignedEngineers: siteAssignedEngineers,
        expense: financials.totalSpent || 0,
        status: site.status || "Active"
      };
    });

    return (
      <div className="admin-dashboard-container" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* ── 1. EXECUTIVE HEADER ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", paddingBottom: "2px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <h1 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)", letterSpacing: "-0.2px" }}>
                Executive Overview
              </h1>
              <span style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "2px 8px", backgroundColor: "#ecfdf5", color: "#059669", borderRadius: "12px", fontSize: "11px", fontWeight: "700", border: "1px solid #a7f3d0" }}>
                <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#10b981" }} />
                Live (IST)
              </span>
            </div>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)", fontWeight: "500" }}>
              Central monitoring and operations oversight for Visvas Builders construction portfolio.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", padding: "6px 12px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px", fontWeight: "700", color: "var(--primary-800)" }}>
              <Calendar size={13} style={{ color: "var(--brand-orange)" }} />
              <span>{formattedTodayDate}</span>
            </div>
            <button
              type="button"
              onClick={async () => {
                setDataLoading(true);
                await loadStaticData();
                setDataLoading(false);
                showToast("Executive telemetry updated.", "success");
              }}
              className="btn btn-outline"
              style={{ display: "inline-flex", alignItems: "center", gap: "6px", height: "34px", padding: "0 12px", fontSize: "12px", fontWeight: "700", borderRadius: "8px" }}
              title="Refresh Data"
            >
              <RefreshCw size={13} className={dataLoading ? "animate-spin" : ""} />
              <span>Refresh</span>
            </button>
          </div>
        </div>

        {/* ── 2. EXECUTIVE KPI OVERVIEW (6 COMPACT CARDS) ── */}
        <div className="admin-summary-grid">
          {/* Total Sites */}
          <div 
            className="admin-summary-card" 
            onClick={() => setKpiDrilldownState({ 
              isOpen: true, 
              type: "total_sites", 
              title: "All Construction Sites", 
              subtitle: `${sites.length} Projects in Portfolio`, 
              items: sites.map(s => ({
                id: s.id,
                title: s.siteName,
                subtitle: `Client: ${s.clientName || "Corporate Client"} • Location: ${s.location || s.formattedAddress || "N/A"}`,
                status: s.status || "Active",
                badgeStatus: s.status?.toLowerCase() === "completed" ? "success" : (isSiteDelayed(s) ? "danger" : "default"),
                metric: `${s.progress || 0}% Progress`,
                actionSite: s
              }))
            })} 
            style={{ cursor: "pointer" }}
          >
            <div className="admin-summary-icon erp-kpi-icon-slate">
              <Building2 size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{sites.length}</div>
              <div className="admin-summary-label">Total Sites</div>
            </div>
          </div>

          {/* Active Sites */}
          <div 
            className="admin-summary-card" 
            onClick={() => setKpiDrilldownState({ 
              isOpen: true, 
              type: "active_sites", 
              title: "Active Construction Sites", 
              subtitle: `${activeSitesCount} Active Projects`, 
              items: activeSitesList.map(s => ({
                id: s.id,
                title: s.siteName,
                subtitle: `Client: ${s.clientName || "Corporate Client"} • Location: ${s.location || s.formattedAddress || "N/A"}`,
                status: s.status || "Active",
                badgeStatus: "info",
                metric: `${s.progress || 0}% Progress`,
                actionSite: s
              }))
            })} 
            style={{ cursor: "pointer" }}
          >
            <div className="admin-summary-icon erp-kpi-icon-blue">
              <Activity size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{activeSitesCount}</div>
              <div className="admin-summary-label">Active Sites</div>
            </div>
          </div>

          {/* Completed Sites */}
          <div 
            className="admin-summary-card" 
            onClick={() => setKpiDrilldownState({ 
              isOpen: true, 
              type: "completed_sites", 
              title: "Completed Sites", 
              subtitle: `${completedSitesCount} Delivered Projects`, 
              items: completedSitesList.map(s => ({
                id: s.id,
                title: s.siteName,
                subtitle: `Delivered • Client: ${s.clientName || "Corporate Client"} • Location: ${s.location || s.formattedAddress || "N/A"}`,
                status: "Completed",
                badgeStatus: "success",
                metric: `100% Progress`,
                actionSite: s
              }))
            })} 
            style={{ cursor: "pointer" }}
          >
            <div className="admin-summary-icon erp-kpi-icon-green">
              <TrendingUp size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{completedSitesCount}</div>
              <div className="admin-summary-label">Completed</div>
            </div>
          </div>

          {/* Delayed Sites */}
          <div 
            className="admin-summary-card" 
            onClick={() => setKpiDrilldownState({ 
              isOpen: true, 
              type: "delayed_sites", 
              title: "Delayed Sites Requiring Attention", 
              subtitle: `${delayedSitesCount} Delayed Projects`, 
              items: delayedSitesList.map(s => {
                const planned = calculatePlannedProgress(s.startDate, s.expectedEndDate);
                const actual = Number(s.progress) || 0;
                const gap = Math.max(0, planned - actual);
                const delayDetail = s.delayReason || (s.expectedEndDate && isSiteDelayed(s)
                  ? `Target was ${formatDateDMY(s.expectedEndDate)} • ${gap > 0 ? `${gap}% behind schedule` : 'Past completion date'}`
                  : `Behind schedule (${actual}% vs planned ${planned}%)`);
                return {
                  id: s.id,
                  title: s.siteName,
                  subtitle: `Client: ${s.clientName || "Corporate Client"} • Target: ${formatDateDMY(s.expectedEndDate) || "Not Set"}`,
                  status: s.status || "Delayed",
                  badgeStatus: "danger",
                  metric: `${actual}% Progress`,
                  delayDetail,
                  actionSite: s
                };
              })
            })} 
            style={{ cursor: "pointer" }}
          >
            <div className="admin-summary-icon erp-kpi-icon-red">
              <AlertTriangle size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ color: delayedSitesCount > 0 ? "var(--danger-700)" : "var(--primary-950)" }}>
                {delayedSitesCount}
              </div>
              <div className="admin-summary-label">Delayed</div>
            </div>
          </div>

          {/* Site Engineers */}
          <div 
            className="admin-summary-card" 
            onClick={() => setKpiDrilldownState({ 
              isOpen: true, 
              type: "site_engineers", 
              title: "Site Engineers Roster", 
              subtitle: `${activeEngineersCount} Active Field Engineers`, 
              items: activeEngineersList.map(eng => ({
                id: eng.id || eng.uid,
                title: eng.fullName || eng.name,
                subtitle: `${eng.email || ""} • ${eng.phoneNumber || eng.phone || ""}`,
                status: eng.status || "Active",
                badgeStatus: "success",
                metric: `${(eng.assignedSites || []).length || (eng.assignedSiteId ? 1 : 0)} Assigned Sites`,
                link: "/superadmin/engineers"
              }))
            })} 
            style={{ cursor: "pointer" }}
          >
            <div className="admin-summary-icon erp-kpi-icon-purple">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{activeEngineersCount}</div>
              <div className="admin-summary-label">Site Engineers</div>
            </div>
          </div>

          {/* Today's Workforce */}
          <div className="admin-summary-card" onClick={() => setShowTodayAttendanceModal(true)} style={{ cursor: "pointer" }}>
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <UserCheck size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{totalWorkforceToday}</div>
              <div className="admin-summary-label">Today's Workforce</div>
            </div>
          </div>
        </div>

        {/* ── 3. SITE HEALTH & 4. OVERALL PROJECT PROGRESS ── */}
        <div className="admin-middle-grid">
          {/* Section 3: Site Health */}
          <div className="admin-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Site Health</h3>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>{sites.length} Total Projects</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                <div style={{ padding: "8px 10px", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#15803d" }}>{activeSitesCount}</div>
                  <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#166534" }}>Active</div>
                </div>
                <div style={{ padding: "8px 10px", backgroundColor: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#1d4ed8" }}>{planningSitesCount}</div>
                  <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#1e40af" }}>Planning</div>
                </div>
                <div style={{ padding: "8px 10px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#b91c1c" }}>{delayedSitesCount}</div>
                  <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#991b1b" }}>Delayed</div>
                </div>
                <div style={{ padding: "8px 10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "18px", fontWeight: "800", color: "#475569" }}>{completedSitesCount}</div>
                  <div style={{ fontSize: "10.5px", fontWeight: "700", color: "#334155" }}>Completed</div>
                </div>
              </div>
            </div>
            {/* Segmented Distribution Bar */}
            <div style={{ marginTop: "12px" }}>
              <div style={{ display: "flex", height: "6px", borderRadius: "3px", overflow: "hidden", backgroundColor: "#e2e8f0" }}>
                <div style={{ width: `${sites.length > 0 ? (activeSitesCount / sites.length) * 100 : 0}%`, backgroundColor: "#22c55e" }} title={`Active: ${activeSitesCount}`} />
                <div style={{ width: `${sites.length > 0 ? (planningSitesCount / sites.length) * 100 : 0}%`, backgroundColor: "#3b82f6" }} title={`Planning: ${planningSitesCount}`} />
                <div style={{ width: `${sites.length > 0 ? (delayedSitesCount / sites.length) * 100 : 0}%`, backgroundColor: "#ef4444" }} title={`Delayed: ${delayedSitesCount}`} />
                <div style={{ width: `${sites.length > 0 ? (completedSitesCount / sites.length) * 100 : 0}%`, backgroundColor: "#64748b" }} title={`Completed: ${completedSitesCount}`} />
              </div>
            </div>
          </div>

          {/* Section 4: Overall Project Progress */}
          <div className="admin-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Overall Project Progress</h3>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>Portfolio Average</span>
              </div>
              <div style={{ display: "flex", alignItems: "baseline", gap: "8px", margin: "4px 0 10px 0" }}>
                <span style={{ fontSize: "28px", fontWeight: "800", color: "var(--primary-950)", fontVariantNumeric: "tabular-nums" }}>
                  {averageProgressPercent}%
                </span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "var(--primary-600)" }}>Completed Across Organization</span>
              </div>
              <div style={{ width: "100%", height: "8px", backgroundColor: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                <div style={{ width: `${averageProgressPercent}%`, height: "100%", background: "linear-gradient(90deg, #f97316, #ea580c)", borderRadius: "4px" }} />
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "600", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
              <span>🟢 {onTrackSitesCount} On Track</span>
              <span>🔴 {delayedSitesCount} Delayed</span>
              <span>⚪ {completedSitesCount} Completed</span>
            </div>
          </div>
        </div>

        {/* ── 5. WORKFORCE TODAY & 6. FINANCIAL OVERVIEW ── */}
        <div className="admin-middle-grid">
          {/* Section 5: Workforce Today */}
          <div className="admin-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Workforce Today</h3>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--brand-orange)" }}>{totalWorkforceToday} Total Active</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "8px" }}>
                <div style={{ padding: "8px 6px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "#16a34a" }}>{presentCount}</div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-700)" }}>Eng Present</div>
                </div>
                <div style={{ padding: "8px 6px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: pendingEngineersCount > 0 ? "#ea580c" : "#16a34a" }}>{pendingEngineersCount}</div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-700)" }}>Eng Missing</div>
                </div>
                <div style={{ padding: "8px 6px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>{todayLabourCount}</div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-700)" }}>Total Labour</div>
                </div>
                <div style={{ padding: "8px 6px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px", textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>{distinctTeams}</div>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-700)" }}>Active Teams</div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "4px", fontSize: "11px", color: "var(--primary-600)", fontWeight: "600", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
              <span>🧱 {masonCount} Masons</span>
              <span>🏗️ {barbenderCount} Barbenders</span>
              <span>🪵 {carpenterCount} Carpenters</span>
              <span>🦺 {helperCount} Helpers</span>
            </div>
          </div>

          {/* Section 6: Financial Overview */}
          <div className="admin-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
            <div>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Financial Overview</h3>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>Corporate Spend</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "8px" }}>
                <div style={{ padding: "10px 12px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>Total Expenses</div>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--primary-950)", fontFamily: "monospace", marginTop: "4px" }}>
                    {formatINR(overallMetrics.totalExpenses)}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", backgroundColor: "#fff7ed", border: "1px solid #fed7aa", borderRadius: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#c2410c", textTransform: "uppercase" }}>Today's Expenses</div>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "var(--brand-orange)", fontFamily: "monospace", marginTop: "4px" }}>
                    {formatINR(todayTotalExpenses)}
                  </div>
                </div>
                <div style={{ padding: "10px 12px", backgroundColor: "#fef2f2", border: "1px solid #fecaca", borderRadius: "8px" }}>
                  <div style={{ fontSize: "10px", fontWeight: "700", color: "#991b1b", textTransform: "uppercase" }}>Pending</div>
                  <div style={{ fontSize: "15px", fontWeight: "800", color: "#b91c1c", fontFamily: "monospace", marginTop: "4px" }}>
                    {formatINR(overallMetrics.pendingPayments)}
                  </div>
                </div>
              </div>
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--primary-600)", fontWeight: "600", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
              <span>Total Project Portfolio Budget: {formatINR(overallMetrics.totalProjectValue)}</span>
            </div>
          </div>
        </div>

        {/* ── 7. SITE PROGRESS OVERVIEW (COMPACT TABLE) ── */}
        <div className="admin-table-card">
          <div className="admin-table-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>
                Site Progress Overview ({sites.length} Sites)
              </h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--primary-600)" }}>
                Execution progress, assigned field engineers, today's workforce deployment, and total project spend per site.
              </p>
            </div>
            <Link to="/superadmin/sites" className="btn btn-outline" style={{ height: "30px", padding: "0 10px", fontSize: "11.5px", fontWeight: "700" }}>
              View All Sites →
            </Link>
          </div>
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Site &amp; Location</th>
                  <th>Assigned Engineer(s)</th>
                  <th style={{ width: "170px" }}>Progress</th>
                  <th style={{ textAlign: "right" }}>Today's Labour</th>
                  <th style={{ textAlign: "right" }}>Total Cost</th>
                  <th style={{ textAlign: "center" }}>Target Date</th>
                  <th style={{ textAlign: "center" }}>Status</th>
                </tr>
              </thead>
              <tbody>
                {sitePerformanceList.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No sites recorded.</td></tr>
                ) : (
                  sitePerformanceList.map(({ site, progress, workforce, todayLabourCost, assignedEngineers, expense, status }) => (
                    <tr 
                      key={site.id} 
                      onClick={() => setSelectedInspectSite(site)} 
                      style={{ cursor: "pointer" }}
                      title="Click to inspect detailed site operations"
                    >
                      <td>
                        <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>
                          {site.siteName}
                        </strong>
                        <span style={{ fontSize: "11px", color: "var(--primary-600)" }}>
                          {site.location || site.assignedAddress || site.clientName || "Tamil Nadu"}
                        </span>
                      </td>
                      <td>
                        {assignedEngineers.length > 0 ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            {assignedEngineers.map(eng => {
                              const engId = eng.id || eng.uid;
                              const hasAttendance = todayAttendanceList.some(r => 
                                (r.resolvedEngineerId === engId || r.engineerId === engId || r.userId === engId) &&
                                (r.resolvedSiteId === site.id || r.siteId === site.id)
                              );
                              return (
                                <div 
                                  key={engId} 
                                  style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--primary-900)", fontWeight: "500", lineHeight: "1.2" }}
                                  title={hasAttendance ? `Attendance submitted today for ${site.siteName}` : `No attendance submitted today for ${site.siteName}`}
                                >
                                  <span 
                                    style={{ 
                                      width: "6.5px", 
                                      height: "6.5px", 
                                      borderRadius: "50%", 
                                      backgroundColor: hasAttendance ? "#16a34a" : "#cbd5e1",
                                      display: "inline-block",
                                      flexShrink: 0
                                    }} 
                                  />
                                  <span>{eng.fullName || eng.name}</span>
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>Unassigned</span>
                        )}
                      </td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ flex: 1, height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px", overflow: "hidden" }}>
                            <div style={{ width: `${progress}%`, height: "100%", backgroundColor: progress >= 100 ? "#22c55e" : "#f97316", borderRadius: "3px" }} />
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: "700", minWidth: "32px", textAlign: "right", fontVariantNumeric: "tabular-nums" }}>
                            {progress}%
                          </span>
                        </div>
                      </td>
                      <td style={{ textAlign: "right" }}>
                        {workforce > 0 ? (
                          <div>
                            <strong style={{ fontSize: "12px", color: "var(--primary-950)", display: "block", fontVariantNumeric: "tabular-nums" }}>
                              {workforce} Workers
                            </strong>
                            {todayLabourCost > 0 && (
                              <span style={{ fontSize: "10.5px", color: "var(--brand-orange)", fontWeight: "700", fontFamily: "monospace" }}>
                                {formatINR(todayLabourCost)}
                              </span>
                            )}
                          </div>
                        ) : (
                          <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>—</span>
                        )}
                      </td>
                      <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700", color: "var(--primary-950)" }}>
                        {formatINR(expense)}
                      </td>
                      <td style={{ textAlign: "center", fontSize: "11.5px", color: "var(--primary-700)", fontWeight: "600" }}>
                        {formatDateDMY(site.expectedEndDate) || "—"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Badge status={status.toLowerCase() === "completed" ? "success" : (status.toLowerCase() === "delayed" ? "danger" : "default")}>
                          {status}
                        </Badge>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* ── 8. ATTENTION REQUIRED & 9. TODAY'S OPERATIONS ── */}
        <div className="admin-middle-grid">
          {/* Section 8: Attention Required */}
          <div className="admin-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={15} style={{ color: alerts.length > 0 ? "#dc2626" : "#16a34a" }} />
                <span>Attention Required</span>
              </h3>
              <span style={{ fontSize: "11px", fontWeight: "700", color: alerts.length > 0 ? "#dc2626" : "#16a34a" }}>
                {alerts.length > 0 ? `${alerts.length} Action Items` : "All Clear"}
              </span>
            </div>

            {alerts.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "#16a34a", backgroundColor: "#f0fdf4", borderRadius: "8px", border: "1px solid #bbf7d0" }}>
                <CheckCircle2 size={24} style={{ margin: "0 auto 6px auto", display: "block" }} />
                <strong style={{ fontSize: "13px" }}>All Operations Normal</strong>
                <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#166534" }}>No delayed sites or missing attendance alerts detected.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                {alerts.slice(0, 6).map(alert => (
                  <div
                    key={alert.id}
                    onClick={() => {
                      if (alert.site) setSelectedInspectSite(alert.site);
                    }}
                    style={{
                      padding: "10px 12px",
                      borderRadius: "8px",
                      border: "1px solid",
                      borderColor: alert.type === "danger" ? "#fecaca" : "#fed7aa",
                      backgroundColor: alert.type === "danger" ? "#fef2f2" : "#fff7ed",
                      cursor: alert.site ? "pointer" : "default"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <strong style={{ fontSize: "12px", color: alert.type === "danger" ? "#991b1b" : "#9a3412" }}>
                        {alert.title}
                      </strong>
                      <span style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: alert.type === "danger" ? "#b91c1c" : "#c2410c" }}>
                        {alert.category}
                      </span>
                    </div>
                    <p style={{ margin: "3px 0 0 0", fontSize: "11.5px", color: "#334155" }}>
                      {alert.message}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 9: Today's Operations */}
          <div className="admin-card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Clock size={15} style={{ color: "var(--brand-orange)" }} />
                <span>Today's Operations</span>
              </h3>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>
                {todayFeedList.length} Events Logged
              </span>
            </div>

            {todayFeedList.length === 0 ? (
              <div style={{ padding: "24px", textAlign: "center", color: "var(--text-muted)" }}>
                No events recorded yet today.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: "280px", overflowY: "auto" }}>
                {todayFeedList.slice(0, 8).map(event => (
                  <div
                    key={event.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 10px",
                      borderRadius: "6px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      fontSize: "12px"
                    }}
                  >
                    <div style={{ minWidth: 0, flex: 1, paddingRight: "8px" }}>
                      <strong style={{ color: "var(--primary-950)" }}>{event.user}</strong>
                      <span style={{ color: "var(--text-muted)" }}> — </span>
                      <span style={{ color: "var(--primary-800)" }}>{event.action}</span>
                      <span style={{ color: "var(--text-muted)" }}> — </span>
                      <span style={{ color: "var(--brand-orange)", fontWeight: "600" }}>{event.site}</span>
                    </div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", fontFamily: "monospace" }}>
                      {event.time}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 2: ALL SITES OPERATIONS (CANONICAL ADMIN SITES REUSE)
  // ══════════════════════════════════════════════════════════════════════════
  const renderSitesView = () => {
    return <Sites embedded={true} />;
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




  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 6: DAILY LABOUR & CIVIL WORKFORCE COMMAND CENTER
  // ══════════════════════════════════════════════════════════════════════════
  const renderLabourView = () => {
    const activeDate = labourDateFilter || todayDateString;

    // Filter raw labour attendance records
    const filteredLabour = rawLabourAttendance.filter(r => {
      if (!r || r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock" || r.lockedMetadata || r.type === "lock") return false;
      const recDate = r.attendanceDate || r.date;
      if (labourDateFilter && recDate !== labourDateFilter) return false;
      if (labourSiteFilter && r.siteId !== labourSiteFilter) return false;
      if (labourSearchQuery.trim()) {
        const q = labourSearchQuery.toLowerCase().trim();
        const mSite = (r.siteName || sites.find(s => s.id === r.siteId)?.siteName || "").toLowerCase().includes(q);
        const mCat = (r.categoryName || r.category || "").toLowerCase().includes(q);
        const mTeam = (r.teamName || "").toLowerCase().includes(q);
        const mEng = (r.engineerName || r.createdByName || "").toLowerCase().includes(q);
        if (!mSite && !mCat && !mTeam && !mEng) return false;
      }
      return true;
    });

    // Compute Metrics for current filter
    const totalWorkersFiltered = filteredLabour.reduce((sum, r) => {
      const { workerCount } = resolveLabourRecordCalculations(r);
      return sum + workerCount;
    }, 0);
    const totalWageLiability = filteredLabour.reduce((sum, r) => {
      const { amount } = resolveLabourRecordCalculations(r);
      return sum + amount;
    }, 0);
    const activeSitesWithLabour = new Set(filteredLabour.map(r => r.siteId)).size;
    const distinctTeams = new Set(filteredLabour.map(r => r.teamId || r.teamName).filter(Boolean)).size;

    // Civil Trade Specific Headcounts for current date
    let masonCountFiltered = 0;
    let barbenderCountFiltered = 0;
    let carpenterCountFiltered = 0;
    let helperCountFiltered = 0;

    filteredLabour.forEach(r => {
      const cat = (r.categoryName || r.category || "").toLowerCase();
      const { workerCount: count } = resolveLabourRecordCalculations(r);
      if (cat.includes("mason") || cat.includes("karigar") || cat.includes("brick") || cat.includes("plaster")) {
        masonCountFiltered += count;
      } else if (cat.includes("barbend") || cat.includes("steel") || cat.includes("rebar") || cat.includes("fitter")) {
        barbenderCountFiltered += count;
      } else if (cat.includes("carpenter") || cat.includes("shutter") || cat.includes("centering") || cat.includes("formwork")) {
        carpenterCountFiltered += count;
      } else {
        helperCountFiltered += count;
      }
    });

    return (
      <div className="admin-dashboard-container">
        {/* KPI Summary Cards */}
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{totalWorkersFiltered}</div>
              <div className="admin-summary-label">Total On-Site Workers</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-teal">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(totalWageLiability)}</div>
              <div className="admin-summary-label">Daily Wage Liability</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-purple">
              <Briefcase size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{distinctTeams || rawTeams.length}</div>
              <div className="admin-summary-label">Active Labour Gangs</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-blue">
              <Building2 size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{activeSitesWithLabour}/{sites.length}</div>
              <div className="admin-summary-label">Sites with Labour</div>
            </div>
          </div>
        </div>

        {/* Civil Trade Distribution Strip */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "10px" }}>
          <div style={{ padding: "12px 14px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", display: "block" }}>🧱 Masons / Karigar</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
              <strong style={{ fontSize: "20px", color: "var(--primary-950)" }}>{masonCountFiltered}</strong>
              <span style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: "600" }}>Blockwork &amp; Plaster</span>
            </div>
          </div>
          <div style={{ padding: "12px 14px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", display: "block" }}>🏗️ Barbenders / Steel</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
              <strong style={{ fontSize: "20px", color: "var(--primary-950)" }}>{barbenderCountFiltered}</strong>
              <span style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: "600" }}>Rebar Tying</span>
            </div>
          </div>
          <div style={{ padding: "12px 14px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", display: "block" }}>🪵 Formwork Carpenters</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
              <strong style={{ fontSize: "20px", color: "var(--primary-950)" }}>{carpenterCountFiltered}</strong>
              <span style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: "600" }}>Centering &amp; Staging</span>
            </div>
          </div>
          <div style={{ padding: "12px 14px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "700", display: "block" }}>🦺 Helpers / Mazdoors</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px" }}>
              <strong style={{ fontSize: "20px", color: "var(--primary-950)" }}>{helperCountFiltered}</strong>
              <span style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: "600" }}>Casting &amp; Curing</span>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Organization Labour &amp; Workforce Muster ({filteredLabour.length} entries)
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Daily trade headcount distribution, contractor gang musters, and wage liability ledger.
            </p>
          </div>

          <div className="sites-actions-group">
            <div className="sites-search-wrapper" style={{ minWidth: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search team, site, trade..."
                value={labourSearchQuery}
                onChange={(e) => setLabourSearchQuery(e.target.value)}
                style={{ width: "100%", height: "38px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={labourSiteFilter}
              onChange={(e) => setLabourSiteFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="">All Sites ({sites.length})</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
            <input
              type="date"
              value={labourDateFilter}
              onChange={(e) => setLabourDateFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
            />
            {labourDateFilter && (
              <button
                type="button"
                onClick={() => setLabourDateFilter("")}
                className="btn btn-outline"
                style={{ height: "38px", padding: "0 10px", fontSize: "12px" }}
              >
                Today
              </button>
            )}
          </div>
        </div>

        {/* Labour Ledger Table */}
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Project Site</th>
                  <th>Contractor / Team</th>
                  <th>Trade Craft</th>
                  <th style={{ textAlign: "right" }}>Worker Count</th>
                  <th style={{ textAlign: "right" }}>Wage Rate</th>
                  <th style={{ textAlign: "right" }}>Total Amount</th>
                  <th>Muster Date</th>
                  <th>Logged By</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabour.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No labour muster records found for the selected criteria.</td></tr>
                ) : (
                  filteredLabour.map(rec => {
                    const siteName = rec.siteName || sites.find(s => s.id === rec.siteId)?.siteName || "Civil Project";
                    const count = Number(r => r.workerCount || (r.workerEntries && r.workerEntries.length) || 1) || Number(rec.workerCount) || 1;
                    const rate = Number(rec.dailyWage || rec.rate || rec.categoryRate) || 0;
                    const total = Number(rec.totalAmount || (count * rate));

                    return (
                      <tr key={rec.id}>
                        <td style={{ fontWeight: "700" }}>{siteName}</td>
                        <td>{rec.teamName || "Direct Site Gang"}</td>
                        <td>
                          <Badge status="info">
                            {rec.categoryName || rec.category || "General Labour"}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "800", fontVariantNumeric: "tabular-nums" }}>
                          {count}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {rate > 0 ? formatINR(rate) : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--primary-950)" }}>
                          {formatINR(total)}
                        </td>
                        <td className="font-mono">{formatDateDMY(rec.attendanceDate || rec.date)}</td>
                        <td>{rec.engineerName || rec.createdByName || "Site Engineer"}</td>
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
  // VIEW 7: CIVIL MATERIAL STOCK & INWARD DELIVERIES REGISTER
  // ══════════════════════════════════════════════════════════════════════════
  const renderMaterialsView = () => {
    const filteredMaterials = materials.filter(m => {
      if (materialSiteFilter && m.siteId !== materialSiteFilter) return false;
      if (materialCategoryFilter !== "all" && (m.category || "").toLowerCase() !== materialCategoryFilter.toLowerCase()) return false;
      if (materialStatusFilter !== "all" && (m.paymentStatus || "pending").toLowerCase() !== materialStatusFilter.toLowerCase()) return false;
      if (materialSearchQuery.trim()) {
        const q = materialSearchQuery.toLowerCase().trim();
        const mName = (m.materialName || m.name || "").toLowerCase().includes(q);
        const mCat = (m.category || "").toLowerCase().includes(q);
        const mSupp = (m.supplier || m.vendor || "").toLowerCase().includes(q);
        const mSite = (m.siteName || sites.find(s => s.id === m.siteId)?.siteName || "").toLowerCase().includes(q);
        if (!mName && !mCat && !mSupp && !mSite) return false;
      }
      return true;
    });

    const totalMaterialsCost = filteredMaterials.reduce((sum, m) => sum + (Number(m.totalCost || m.amount || (Number(m.quantity || 0) * Number(m.unitPrice || 0))) || 0), 0);
    const todayMaterials = filteredMaterials.filter(m => (m.date || m.deliveryDate || "").startsWith(todayDateString));
    const todayMaterialCost = todayMaterials.reduce((sum, m) => sum + (Number(m.totalCost || m.amount || (Number(m.quantity || 0) * Number(m.unitPrice || 0))) || 0), 0);
    const pendingPaymentMaterials = filteredMaterials.filter(m => (m.paymentStatus || "").toLowerCase() === "pending");

    return (
      <div className="admin-dashboard-container">
        {/* KPI Summary Cards */}
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-purple">
              <Package size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{filteredMaterials.length}</div>
              <div className="admin-summary-label">Total Material Logs</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(todayMaterialCost)}</div>
              <div className="admin-summary-label">Today's Material Outlay</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-teal">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(totalMaterialsCost)}</div>
              <div className="admin-summary-label">Cumulative Inward Cost</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-red">
              <AlertTriangle size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{pendingPaymentMaterials.length}</div>
              <div className="admin-summary-label">Pending Invoices</div>
            </div>
          </div>
        </div>

        {/* Category Filter Chips */}
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {[
            { id: "all", label: "All Materials" },
            { id: "cement", label: "Cement" },
            { id: "steel", label: "TMT Steel" },
            { id: "sand", label: "Sand / M-Sand" },
            { id: "aggregate", label: "Aggregates" },
            { id: "bricks", label: "Bricks / Blocks" },
            { id: "electrical", label: "Electrical" },
            { id: "plumbing", label: "Plumbing" }
          ].map(c => (
            <button
              key={c.id}
              type="button"
              onClick={() => setMaterialCategoryFilter(c.id)}
              style={{
                padding: "4px 10px",
                borderRadius: "6px",
                border: "1px solid",
                borderColor: materialCategoryFilter === c.id ? "var(--brand-orange)" : "var(--border-color)",
                backgroundColor: materialCategoryFilter === c.id ? "#fff7ed" : "#ffffff",
                color: materialCategoryFilter === c.id ? "var(--brand-orange)" : "var(--primary-700)",
                fontSize: "11.5px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              {c.label}
            </button>
          ))}
        </div>

        {/* Toolbar & Filters */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Civil Materials Inventory &amp; Stock Inward Register ({filteredMaterials.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Bulk construction material deliveries, delivery challan receipts, supplier rates, and payment tracking.
            </p>
          </div>

          <div className="sites-actions-group">
            <div className="sites-search-wrapper" style={{ minWidth: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search material, vendor, site..."
                value={materialSearchQuery}
                onChange={(e) => setMaterialSearchQuery(e.target.value)}
                style={{ width: "100%", height: "38px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={materialSiteFilter}
              onChange={(e) => setMaterialSiteFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
            <select
              value={materialStatusFilter}
              onChange={(e) => setMaterialStatusFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="all">All Payment Status</option>
              <option value="paid">Paid</option>
              <option value="pending">Pending</option>
              <option value="partial">Partial</option>
            </select>
          </div>
        </div>

        {/* Materials Table */}
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Material &amp; Category</th>
                  <th>Project Site</th>
                  <th style={{ textAlign: "right" }}>Inward Quantity</th>
                  <th style={{ textAlign: "right" }}>Unit Rate</th>
                  <th style={{ textAlign: "right" }}>Total Cost</th>
                  <th>Supplier / Vendor</th>
                  <th>Delivery Date</th>
                  <th>Payment Status</th>
                  <th style={{ textAlign: "center" }}>Challan Proof</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.length === 0 ? (
                  <tr><td colSpan={9} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No material delivery records found.</td></tr>
                ) : (
                  filteredMaterials.map(m => {
                    const siteName = m.siteName || sites.find(s => s.id === m.siteId)?.siteName || "Civil Project";
                    const cost = Number(m.totalCost || m.amount || (Number(m.quantity || 0) * Number(m.unitPrice || 0))) || 0;
                    const unitPrice = Number(m.unitPrice || m.rate || 0);

                    return (
                      <tr key={m.id}>
                        <td>
                          <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>
                            {m.materialName || m.name || "Material Item"}
                          </strong>
                          <span style={{ fontSize: "11px", color: "var(--primary-600)" }}>{m.category || "General Supply"}</span>
                        </td>
                        <td style={{ fontWeight: "600" }}>{siteName}</td>
                        <td style={{ textAlign: "right", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>
                          {m.quantity} {m.unit || "Units"}
                        </td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                          {unitPrice > 0 ? formatINR(unitPrice) : "—"}
                        </td>
                        <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--primary-950)" }}>
                          {formatINR(cost)}
                        </td>
                        <td>{m.supplier || m.vendor || "Direct Supply"}</td>
                        <td className="font-mono">{formatDateDMY(m.date || m.deliveryDate)}</td>
                        <td>
                          <Badge status={(m.paymentStatus || "").toLowerCase() === "paid" ? "success" : "warning"}>
                            {m.paymentStatus || "Pending"}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          {m.billPhotoUrl || m.photoUrl ? (
                            <button
                              type="button"
                              onClick={() => setSelectedPreviewImage({ url: m.billPhotoUrl || m.photoUrl, title: `Material Receipt: ${m.materialName || m.name}` })}
                              style={{ border: "none", background: "none", color: "var(--brand-orange)", fontWeight: "750", fontSize: "12px", cursor: "pointer", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Eye size={13} /> View
                            </button>
                          ) : "—"}
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
  // VIEW 10: PAYMENTS & OUTSTANDINGS CENTRAL MONITOR
  // ══════════════════════════════════════════════════════════════════════════
  const renderPaymentsView = () => {
    // Merge general expenses payments, material payments, and labour payments
    const allPaymentEntries = [];

    (labourPayments || []).forEach(p => {
      allPaymentEntries.push({
        id: `lab_${p.id}`,
        payee: p.teamName || p.contractorName || "Labour Contractor",
        siteId: p.siteId,
        siteName: sites.find(s => s.id === p.siteId)?.siteName || "Civil Site",
        category: "Labour Payout",
        amount: Number(p.amount || 0),
        paidAmount: Number(p.paidAmount || p.amount || 0),
        pendingAmount: Math.max(0, Number(p.amount || 0) - Number(p.paidAmount || p.amount || 0)),
        status: (p.status || "Paid"),
        date: p.date || p.paymentDate,
        mode: p.paymentMethod || "Bank Transfer",
        refId: p.referenceId || p.transactionId || "—"
      });
    });

    materials.forEach(m => {
      const cost = Number(m.totalCost || m.amount || (Number(m.quantity || 0) * Number(m.unitPrice || 0))) || 0;
      const isPaid = (m.paymentStatus || "").toLowerCase() === "paid";
      allPaymentEntries.push({
        id: `mat_${m.id}`,
        payee: m.supplier || m.vendor || "Material Supplier",
        siteId: m.siteId,
        siteName: m.siteName || sites.find(s => s.id === m.siteId)?.siteName || "Civil Site",
        category: `Material: ${m.materialName || m.category || "Supply"}`,
        amount: cost,
        paidAmount: isPaid ? cost : 0,
        pendingAmount: isPaid ? 0 : cost,
        status: m.paymentStatus || "Pending",
        date: m.date || m.deliveryDate,
        mode: m.paymentMode || "Vendor Invoice",
        refId: m.challanNo || m.invoiceNo || "—"
      });
    });

    generalExpenses.forEach(e => {
      allPaymentEntries.push({
        id: `gen_${e.id}`,
        payee: e.paidTo || "Operational Expense",
        siteId: e.siteId,
        siteName: sites.find(s => s.id === e.siteId)?.siteName || "General / HQ",
        category: `Field Expense: ${e.category || "General"}`,
        amount: Number(e.amount || 0),
        paidAmount: Number(e.amount || 0),
        pendingAmount: 0,
        status: e.status || "Approved",
        date: e.date,
        mode: e.paymentMethod || "Cash / Petty",
        refId: e.receiptNo || "—"
      });
    });

    const filteredPayments = allPaymentEntries.filter(p => {
      if (paymentSiteFilter && p.siteId !== paymentSiteFilter) return false;
      if (paymentStatusFilter !== "all" && p.status.toLowerCase() !== paymentStatusFilter.toLowerCase()) return false;
      if (paymentCategoryFilter !== "all" && !p.category.toLowerCase().includes(paymentCategoryFilter.toLowerCase())) return false;
      if (paymentSearchQuery.trim()) {
        const q = paymentSearchQuery.toLowerCase().trim();
        const mPayee = (p.payee || "").toLowerCase().includes(q);
        const mSite = (p.siteName || "").toLowerCase().includes(q);
        const mCat = (p.category || "").toLowerCase().includes(q);
        const mRef = (p.refId || "").toLowerCase().includes(q);
        if (!mPayee && !mSite && !mCat && !mRef) return false;
      }
      return true;
    }).sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const totalPaid = filteredPayments.reduce((s, p) => s + p.paidAmount, 0);
    const totalPending = filteredPayments.reduce((s, p) => s + p.pendingAmount, 0);
    const totalLabourPaid = filteredPayments.filter(p => p.category.includes("Labour")).reduce((s, p) => s + p.paidAmount, 0);
    const totalMaterialPaid = filteredPayments.filter(p => p.category.includes("Material")).reduce((s, p) => s + p.paidAmount, 0);

    return (
      <div className="admin-dashboard-container">
        {/* KPI Summary Cards */}
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-green">
              <CreditCard size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(totalPaid)}</div>
              <div className="admin-summary-label">Total Paid Outlays</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-red">
              <AlertTriangle size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(totalPending)}</div>
              <div className="admin-summary-label">Pending Outstandings</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(totalLabourPaid)}</div>
              <div className="admin-summary-label">Labour Payouts</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-teal">
              <Package size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(totalMaterialPaid)}</div>
              <div className="admin-summary-label">Vendor Material Bills</div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Corporate Payments &amp; Outstandings Monitor ({filteredPayments.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Consolidated payment ledger for contractor wages, supplier bills, and field operational expenses.
            </p>
          </div>

          <div className="sites-actions-group">
            <div className="sites-search-wrapper" style={{ minWidth: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search payee, invoice, site..."
                value={paymentSearchQuery}
                onChange={(e) => setPaymentSearchQuery(e.target.value)}
                style={{ width: "100%", height: "38px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={paymentSiteFilter}
              onChange={(e) => setPaymentSiteFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
            <select
              value={paymentCategoryFilter}
              onChange={(e) => setPaymentCategoryFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="all">All Heads</option>
              <option value="labour">Labour Payouts</option>
              <option value="material">Material Invoices</option>
              <option value="field">Field Expenses</option>
            </select>
            <select
              value={paymentStatusFilter}
              onChange={(e) => setPaymentStatusFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="all">All Status</option>
              <option value="paid">Paid / Approved</option>
              <option value="pending">Pending</option>
            </select>
          </div>
        </div>

        {/* Payments Table */}
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Payee / Party Name</th>
                  <th>Project Site</th>
                  <th>Payment Head</th>
                  <th style={{ textAlign: "right" }}>Total Bill</th>
                  <th style={{ textAlign: "right" }}>Paid Amount</th>
                  <th style={{ textAlign: "right" }}>Balance Due</th>
                  <th>Status</th>
                  <th>Payment Mode</th>
                  <th>Reference / Txn ID</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayments.length === 0 ? (
                  <tr><td colSpan={10} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No payment records found.</td></tr>
                ) : (
                  filteredPayments.map(p => (
                    <tr key={p.id}>
                      <td style={{ fontWeight: "700" }}>{p.payee}</td>
                      <td>{p.siteName}</td>
                      <td><Badge status="info">{p.category}</Badge></td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(p.amount)}</td>
                      <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--success-700)" }}>{formatINR(p.paidAmount)}</td>
                      <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: p.pendingAmount > 0 ? "var(--danger-700)" : "var(--primary-600)" }}>
                        {formatINR(p.pendingAmount)}
                      </td>
                      <td>
                        <Badge status={p.status.toLowerCase() === "paid" || p.status.toLowerCase() === "approved" ? "success" : "warning"}>
                          {p.status}
                        </Badge>
                      </td>
                      <td>{p.mode}</td>
                      <td className="font-mono" style={{ fontSize: "11px" }}>{p.refId}</td>
                      <td className="font-mono">{formatDateDMY(p.date)}</td>
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
  // VIEW 12: WORKER PAYOUTS & WAGE SETTLEMENT MONITOR
  // ══════════════════════════════════════════════════════════════════════════
  const renderPayrollView = () => {
    const totalWageDisbursed = (labourPayments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0);

    const filteredPayroll = (labourPayments || []).filter(p => {
      if (payrollSiteFilter && p.siteId !== payrollSiteFilter) return false;
      if (payrollSearchQuery.trim()) {
        const q = payrollSearchQuery.toLowerCase().trim();
        const mTeam = (p.teamName || p.contractorName || "").toLowerCase().includes(q);
        const mSite = (p.siteName || sites.find(s => s.id === p.siteId)?.siteName || "").toLowerCase().includes(q);
        if (!mTeam && !mSite) return false;
      }
      return true;
    });

    return (
      <div className="admin-dashboard-container">
        {/* KPI Summary Cards */}
        <div className="admin-summary-grid">
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-green">
              <DollarSign size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value" style={{ fontSize: "15px" }}>{formatINR(totalWageDisbursed)}</div>
              <div className="admin-summary-label">Total Wages Disbursed</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-purple">
              <Users size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{rawTeams.length}</div>
              <div className="admin-summary-label">Active Labour Gangs</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-teal">
              <FileText size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{labourPayments.length}</div>
              <div className="admin-summary-label">Wage Settlements Filed</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-blue">
              <Building2 size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{sites.length}</div>
              <div className="admin-summary-label">Operational Sites</div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Worker Payouts &amp; Gang Settlement Register ({filteredPayroll.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Wage disbursement records, contractor gang advances, and balance settlements.
            </p>
          </div>

          <div className="sites-actions-group">
            <div className="sites-search-wrapper" style={{ minWidth: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search contractor, gang, site..."
                value={payrollSearchQuery}
                onChange={(e) => setPayrollSearchQuery(e.target.value)}
                style={{ width: "100%", height: "38px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
              />
            </div>
            <select
              value={payrollSiteFilter}
              onChange={(e) => setPayrollSiteFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
          </div>
        </div>

        {/* Payroll Table */}
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Labour Team / Contractor</th>
                  <th>Project Site</th>
                  <th>Trade Head</th>
                  <th style={{ textAlign: "right" }}>Disbursed Amount</th>
                  <th>Payment Date</th>
                  <th>Payment Method</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredPayroll.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No worker payout records found.</td></tr>
                ) : (
                  filteredPayroll.map(p => {
                    const siteName = p.siteName || sites.find(s => s.id === p.siteId)?.siteName || "Civil Project";

                    return (
                      <tr key={p.id}>
                        <td style={{ fontWeight: "700" }}>{p.teamName || p.contractorName || "Site Labour Gang"}</td>
                        <td>{siteName}</td>
                        <td><Badge status="info">{p.category || "Wage Disbursement"}</Badge></td>
                        <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--success-700)" }}>
                          {formatINR(p.amount)}
                        </td>
                        <td className="font-mono">{formatDateDMY(p.date || p.paymentDate)}</td>
                        <td>{p.paymentMethod || "Direct Transfer"}</td>
                        <td><Badge status="success">Settled</Badge></td>
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
  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 13: SUPER ADMIN SITE REPORTS DASHBOARD (CANONICAL ADMIN REPORTS REUSE)
  // ══════════════════════════════════════════════════════════════════════════
  const renderReportsView = () => {
    return <ReportsDashboard embedded={true} />;
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 14: CENTRAL APPROVALS & GOVERNANCE GATEWAY
  // ══════════════════════════════════════════════════════════════════════════
  const renderApprovalsView = () => {
    const filteredApprovals = approvals.filter(a => {
      if (approvalsStatusFilter !== "all" && (a.status || "pending").toLowerCase() !== approvalsStatusFilter.toLowerCase()) return false;
      if (approvalsTypeFilter !== "all" && (a.type || "").toLowerCase() !== approvalsTypeFilter.toLowerCase()) return false;
      return true;
    }).sort((a, b) => (b.requestDate || b.createdAt || "").localeCompare(a.requestDate || a.createdAt || ""));

    const pendingCount = approvals.filter(a => (a.status || "pending").toLowerCase() === "pending").length;
    const approvedCount = approvals.filter(a => (a.status || "").toLowerCase() === "approved").length;
    const rejectedCount = approvals.filter(a => (a.status || "").toLowerCase() === "rejected").length;

    return (
      <div className="admin-dashboard-container">
        {/* KPI Summary Cards */}
        <div className="admin-summary-grid" style={{ gridTemplateColumns: "repeat(3, minmax(0, 1fr))" }}>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-orange">
              <AlertTriangle size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{pendingCount}</div>
              <div className="admin-summary-label">Pending Review</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-green">
              <CheckCircle2 size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{approvedCount}</div>
              <div className="admin-summary-label">Approved Requests</div>
            </div>
          </div>
          <div className="admin-summary-card">
            <div className="admin-summary-icon erp-kpi-icon-red">
              <XCircle size={20} />
            </div>
            <div className="admin-summary-info">
              <div className="admin-summary-value">{rejectedCount}</div>
              <div className="admin-summary-label">Rejected Requests</div>
            </div>
          </div>
        </div>

        {/* Toolbar & Filters */}
        <div className="sites-toolbar-container">
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Central Approvals &amp; Governance Gateway ({filteredApprovals.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--primary-600)" }}>
              Review and audit pending engineer leaves, site location updates, high-value material orders, and expenses.
            </p>
          </div>

          <div className="sites-actions-group">
            <select
              value={approvalsStatusFilter}
              onChange={(e) => setApprovalsStatusFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="pending">Pending Review ({pendingCount})</option>
              <option value="approved">Approved ({approvedCount})</option>
              <option value="rejected">Rejected ({rejectedCount})</option>
              <option value="all">All Requests ({approvals.length})</option>
            </select>
            <select
              value={approvalsTypeFilter}
              onChange={(e) => setApprovalsTypeFilter(e.target.value)}
              style={{ height: "38px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="all">All Types</option>
              <option value="leave">Leave Requests</option>
              <option value="location">Site Location</option>
              <option value="material">Material Orders</option>
              <option value="expense">Field Expense</option>
            </select>
          </div>
        </div>

        {/* Approvals Table */}
        <div className="admin-table-card">
          <div className="admin-table-scroll">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Request Type</th>
                  <th>Requested By</th>
                  <th>Details / Scope</th>
                  <th>Submission Date</th>
                  <th>Status</th>
                  <th style={{ textAlign: "right" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredApprovals.length === 0 ? (
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)" }}>No approval requests matching filters.</td></tr>
                ) : (
                  filteredApprovals.map(req => {
                    const isPending = (req.status || "pending").toLowerCase() === "pending";

                    return (
                      <tr key={req.id}>
                        <td><Badge status="info">{req.type || "General"}</Badge></td>
                        <td style={{ fontWeight: "700" }}>{req.requestedBy || req.employeeName || "Site Engineer"}</td>
                        <td>{req.details || req.description || "Operational request"}</td>
                        <td className="font-mono">{formatDateDMY(req.requestDate || req.createdAt)}</td>
                        <td>
                          <Badge status={(req.status || "pending").toLowerCase() === "approved" ? "success" : ((req.status || "pending").toLowerCase() === "rejected" ? "danger" : "warning")}>
                            {req.status || "Pending"}
                          </Badge>
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {isPending ? (
                            <div style={{ display: "inline-flex", gap: "6px" }}>
                              <button
                                type="button"
                                onClick={() => handleApproveRequest(req)}
                                className="erp-btn-primary"
                                style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "#16a34a" }}
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectRequest(req)}
                                className="erp-btn-secondary"
                                style={{ fontSize: "11px", padding: "4px 8px", color: "#dc2626" }}
                              >
                                Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Resolved</span>
                          )}
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
        tab === "payments" ? "Payments & Outstandings" :
        tab === "payroll" ? "Worker Payouts & Settlement" :
        tab === "progress" ? "Schedule & Progress Standing" :
        tab === "reports" ? "Site Reports Dashboard" :
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
      {tab === "payments" && renderPaymentsView()}
      {tab === "payroll" && renderPayrollView()}
      {tab === "progress" && renderProgressView()}
      {tab === "reports" && renderReportsView()}
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
          maxWidth="1140px"
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
            <div style={{ display: "flex", gap: "6px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", overflowX: "auto" }}>
              {[
                { id: "overview", label: "Overview & Specs" },
                { id: "engineers", label: "Engineers & Attendance" },
                { id: "labour", label: "Workforce & Labour" },
                { id: "materials", label: "Materials & Stock" },
                { id: "expenses", label: "Financials & Expenses" },
                { id: "progress", label: "DPRs & Site Photos" }
              ].map(tabItem => (
                <button
                  key={tabItem.id}
                  type="button"
                  onClick={() => setSiteModalActiveTab(tabItem.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: "6px",
                    border: "none",
                    backgroundColor: siteModalActiveTab === tabItem.id ? "var(--brand-orange)" : "transparent",
                    color: siteModalActiveTab === tabItem.id ? "#fff" : "var(--primary-700)",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    whiteSpace: "nowrap"
                  }}
                >
                  {tabItem.label}
                </button>
              ))}
            </div>

            {/* Tab 1: Overview & Specs */}
            {siteModalActiveTab === "overview" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "10px" }}>
                  <div style={{ padding: "10px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Contract Budget</span>
                    <strong style={{ fontSize: "14px", color: "var(--primary-950)" }}>{formatINR(selectedInspectSite.budget || selectedInspectSite.projectValue || 0)}</strong>
                  </div>
                  <div style={{ padding: "10px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Execution Progress</span>
                    <strong style={{ fontSize: "14px", color: "#16a34a" }}>{selectedInspectSite.progress || 0}% Complete</strong>
                  </div>
                  <div style={{ padding: "10px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Target Completion</span>
                    <strong style={{ fontSize: "13px", color: "var(--primary-950)" }}>{formatDateDMY(selectedInspectSite.expectedEndDate)}</strong>
                  </div>
                  <div style={{ padding: "10px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Site Geofence Location</span>
                    <strong style={{ fontSize: "12px", color: "var(--primary-950)", fontFamily: "monospace" }}>
                      {selectedInspectSite.latitude && selectedInspectSite.longitude 
                        ? `${Number(selectedInspectSite.latitude).toFixed(4)}, ${Number(selectedInspectSite.longitude).toFixed(4)}` 
                        : "Coords Configured"}
                    </strong>
                  </div>
                </div>

                <div style={{ padding: "10px 12px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Assigned Site Engineers</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {engineers.filter(e => e.assignedSiteId === selectedInspectSite.id || (Array.isArray(e.assignedSites) && e.assignedSites.includes(selectedInspectSite.id)) || assignments.some(a => a.siteId === selectedInspectSite.id && (a.engineerId === e.id || a.engineerId === e.uid))).length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No engineers assigned</span>
                    ) : (
                      engineers.filter(e => e.assignedSiteId === selectedInspectSite.id || (Array.isArray(e.assignedSites) && e.assignedSites.includes(selectedInspectSite.id)) || assignments.some(a => a.siteId === selectedInspectSite.id && (a.engineerId === e.id || a.engineerId === e.uid))).map(e => (
                        <span key={e.id} style={{ fontSize: "11.5px", padding: "3px 8px", backgroundColor: "#e2e8f0", borderRadius: "4px", fontWeight: "600" }}>
                          👤 {e.fullName || e.name} ({e.phoneNumber || e.phone || "Engineer"})
                        </span>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* Tab 2: Engineers & Historical Attendance */}
            {siteModalActiveTab === "engineers" && (() => {
              const siteAssignedEngineers = engineers.filter(e => 
                (Array.isArray(selectedInspectSite.assignedEngineers) && (selectedInspectSite.assignedEngineers.includes(e.id) || selectedInspectSite.assignedEngineers.includes(e.uid))) ||
                e.assignedSiteId === selectedInspectSite.id || 
                (Array.isArray(e.assignedSites) && e.assignedSites.includes(selectedInspectSite.id)) || 
                assignments.some(a => a.siteId === selectedInspectSite.id && (a.engineerId === e.id || a.engineerId === e.uid))
              );
              const assignedEngineerIds = new Set(siteAssignedEngineers.flatMap(e => [e.id, e.uid, e._id].filter(Boolean)));

              // Historical Attendance matching site and assigned engineers within selected date range
              const siteAttendanceHistory = allDeduplicatedAttendance.filter(rec => {
                if (rec.resolvedSiteId !== selectedInspectSite.id && rec.siteId !== selectedInspectSite.id) return false;
                const engId = rec.resolvedEngineerId || rec.engineerId || rec.userId;
                if (assignedEngineerIds.size > 0 && engId && !assignedEngineerIds.has(engId)) {
                  const engMatches = siteAssignedEngineers.some(e => e.id === engId || e.uid === engId);
                  if (!engMatches) return false;
                }
                const recDate = rec.date || rec.attendanceDate;
                if (!recDate) return false;
                if (siteAttendanceFromDate && recDate < siteAttendanceFromDate) return false;
                if (siteAttendanceToDate && recDate > siteAttendanceToDate) return false;
                return true;
              });

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  {/* Assigned Engineers Roster Banner */}
                  <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                      Assigned Site Engineers ({siteAssignedEngineers.length})
                    </span>
                    {siteAssignedEngineers.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>No engineers currently assigned to this site.</span>
                    ) : (
                      <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                        {siteAssignedEngineers.map(eng => {
                          const todayRec = todayAttendanceList.find(r => 
                            (r.resolvedSiteId === selectedInspectSite.id || r.siteId === selectedInspectSite.id) && 
                            (r.resolvedEngineerId === eng.id || r.resolvedEngineerId === eng.uid || r.engineerId === eng.id || r.engineerId === eng.uid || r.userId === eng.id || r.userId === eng.uid)
                          );
                          return (
                            <div key={eng.id || eng.uid} style={{ display: "inline-flex", alignItems: "center", gap: "8px", padding: "6px 10px", backgroundColor: "#ffffff", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                              <span style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: todayRec ? "#16a34a" : "#cbd5e1", display: "inline-block" }} />
                              <div>
                                <strong style={{ fontSize: "12px", color: "var(--primary-950)", display: "block", lineHeight: "1.2" }}>{eng.fullName || eng.name}</strong>
                                <span style={{ fontSize: "10.5px", color: "var(--primary-600)" }}>{eng.phoneNumber || eng.phone || eng.email || "Field Engineer"}</span>
                              </div>
                              <span style={{ fontSize: "10px", fontWeight: "700", padding: "1px 6px", borderRadius: "8px", backgroundColor: todayRec ? "#dcfce7" : "#f1f5f9", color: todayRec ? "#15803d" : "#64748b", marginLeft: "4px" }}>
                                {todayRec ? (todayRec.isCheckedOut ? "Checked Out" : `On Site (${todayRec.checkInTimeFormatted})`) : "Not Marked Today"}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Date Range Filter Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "10px 14px", backgroundColor: "#fafafa", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", flexWrap: "wrap", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--primary-800)" }}>From:</span>
                        <input 
                          type="date" 
                          value={siteAttendanceFromDate} 
                          onChange={(e) => setSiteAttendanceFromDate(e.target.value)} 
                          style={{ height: "30px", padding: "2px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
                        />
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--primary-800)" }}>To:</span>
                        <input 
                          type="date" 
                          value={siteAttendanceToDate} 
                          onChange={(e) => setSiteAttendanceToDate(e.target.value)} 
                          style={{ height: "30px", padding: "2px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
                        />
                      </div>
                      <div style={{ display: "flex", gap: "4px" }}>
                        <button 
                          type="button" 
                          onClick={() => {
                            setSiteAttendanceFromDate(todayDateString);
                            setSiteAttendanceToDate(todayDateString);
                          }}
                          className="erp-btn-secondary"
                          style={{ padding: "2px 8px", fontSize: "11px", height: "30px" }}
                        >
                          Today
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 7);
                            setSiteAttendanceFromDate(d.toISOString().split("T")[0]);
                            setSiteAttendanceToDate(todayDateString);
                          }}
                          className="erp-btn-secondary"
                          style={{ padding: "2px 8px", fontSize: "11px", height: "30px" }}
                        >
                          Last 7 Days
                        </button>
                        <button 
                          type="button" 
                          onClick={() => {
                            const d = new Date();
                            d.setDate(d.getDate() - 30);
                            setSiteAttendanceFromDate(d.toISOString().split("T")[0]);
                            setSiteAttendanceToDate(todayDateString);
                          }}
                          className="erp-btn-secondary"
                          style={{ padding: "2px 8px", fontSize: "11px", height: "30px" }}
                        >
                          Last 30 Days
                        </button>
                      </div>
                    </div>
                    <span style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--primary-700)" }}>
                      {siteAttendanceHistory.length} Attendance Records
                    </span>
                  </div>

                  {/* Historical Attendance Records Table */}
                  {siteAttendanceHistory.length === 0 ? (
                    <div style={{ padding: "32px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", color: "var(--text-muted)", fontSize: "12.5px" }}>
                      No attendance records found for this site within the selected date range ({formatDateDMY(siteAttendanceFromDate)} to {formatDateDMY(siteAttendanceToDate)}).
                    </div>
                  ) : (
                    <div style={{ maxHeight: "360px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f8fafc" }}>
                            <th style={{ width: "110px" }}>Date</th>
                            <th>Engineer Name</th>
                            <th style={{ textAlign: "center", width: "120px" }}>Check-In</th>
                            <th style={{ textAlign: "center", width: "120px" }}>Check-Out</th>
                            <th style={{ textAlign: "center", width: "140px" }}>Status</th>
                            <th style={{ textAlign: "center", width: "130px" }}>Photo Proof</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siteAttendanceHistory.map(rec => {
                            const photoUrl = rec.photoUrl || rec.photoURL || rec.selfieUrl || rec.imageUrl || rec.photo || rec.checkInPhotoUrl;
                            const recDateStr = formatDateDMY(rec.date || rec.attendanceDate);
                            return (
                              <tr key={rec.id}>
                                <td style={{ fontWeight: "700", color: "var(--primary-950)", fontSize: "12px" }}>
                                  {recDateStr}
                                </td>
                                <td>
                                  <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>{rec.engineerName}</strong>
                                  <span style={{ fontSize: "11px", color: "var(--primary-600)" }}>{rec.engineerEmail || rec.engineerPhone || "Site Engineer"}</span>
                                </td>
                                <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "11.5px", fontWeight: "600" }}>
                                  {rec.checkInTimeFormatted}
                                </td>
                                <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "11.5px", color: rec.checkOutTimeFormatted ? "var(--primary-950)" : "var(--text-muted)" }}>
                                  {rec.checkOutTimeFormatted || "—"}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <Badge status={rec.isCheckedOut ? "default" : (rec.isVerified ? "success" : "info")}>
                                    {rec.isCheckedOut ? "Checked Out" : (rec.isVerified ? "Present / On-Site" : "Present")}
                                  </Badge>
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  {photoUrl ? (
                                    <div style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                                      <img 
                                        src={photoUrl} 
                                        alt="Proof Thumbnail" 
                                        style={{ width: "28px", height: "28px", borderRadius: "4px", objectFit: "cover", border: "1px solid #cbd5e1" }} 
                                      />
                                      <button
                                        type="button"
                                        onClick={() => setSelectedPreviewImage({
                                          url: photoUrl,
                                          title: `Attendance Photo — ${rec.engineerName} (${recDateStr})`
                                        })}
                                        title="View Full Photo Proof"
                                        className="erp-btn-secondary"
                                        style={{
                                          display: "inline-flex",
                                          alignItems: "center",
                                          gap: "3px",
                                          padding: "2px 6px",
                                          fontSize: "11px",
                                          cursor: "pointer",
                                          borderRadius: "4px"
                                        }}
                                      >
                                        <Eye size={12} style={{ color: "var(--primary-600)" }} />
                                        <span>View</span>
                                      </button>
                                    </div>
                                  ) : (
                                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>No Photo</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tab 3: Workforce / Labour (Date-Based Report-Style View) */}
            {siteModalActiveTab === "labour" && (() => {
              const activeLaborDate = siteLaborInspectionDate || todayDateString;
              const dateLabourRecords = (rawLabourAttendance || []).filter(r => 
                !r?.id?.startsWith("labour_lock_") && 
                r?.type !== "labour_attendance_lock" && 
                !r?.lockedMetadata && 
                r?.type !== "lock" && 
                r?.siteId === selectedInspectSite.id && 
                (r?.attendanceDate === activeLaborDate || r?.date === activeLaborDate)
              );

              let totalWorkers = 0;
              let totalLabourCost = 0;

              const rows = dateLabourRecords.map(r => {
                const { workerCount, units, wage, amount } = resolveLabourRecordCalculations(r);
                totalWorkers += workerCount;
                totalLabourCost += amount;
                const team = r.teamName || (r.teamId ? "Labour Team" : "Civil Team");
                const workerType = r.categoryName || r.category || (r.categoryId ? String(r.categoryId).replace(/^cat_/, '') : "Civil Labour");
                return {
                  id: r.id,
                  team,
                  workerType,
                  workerCount,
                  units,
                  wage,
                  amount
                };
              });

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Date Filter Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", padding: "10px 14px", backgroundColor: "#fafafa", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--primary-800)" }}>Date:</span>
                        <input 
                          type="date" 
                          value={activeLaborDate} 
                          onChange={(e) => setSiteLaborInspectionDate(e.target.value)} 
                          style={{ height: "30px", padding: "2px 8px", fontSize: "11.5px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#fff" }}
                        />
                      </div>
                      <button 
                        type="button" 
                        onClick={() => setSiteLaborInspectionDate(todayDateString)}
                        className="erp-btn-secondary"
                        style={{ padding: "2px 8px", fontSize: "11px", height: "30px" }}
                      >
                        Today
                      </button>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <span style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--brand-orange)" }}>
                        {totalWorkers} Active Workers
                      </span>
                      <span style={{ fontSize: "11.5px", fontWeight: "700", color: "var(--primary-950)", fontFamily: "monospace" }}>
                        Total: {formatINR(totalLabourCost)}
                      </span>
                    </div>
                  </div>

                  {/* Labor Records Breakdown Table */}
                  {rows.length === 0 ? (
                    <div style={{ padding: "28px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", color: "var(--text-muted)", fontSize: "12.5px" }}>
                      No labour attendance logged for this site on {formatDateDMY(activeLaborDate)}.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f8fafc" }}>
                            <th>Team</th>
                            <th>Worker Type</th>
                            <th style={{ textAlign: "center" }}>Workers</th>
                            <th style={{ textAlign: "center" }}>Duration (Days)</th>
                            <th style={{ textAlign: "center" }}>Calculation</th>
                            <th style={{ textAlign: "right" }}>Total Amount</th>
                          </tr>
                        </thead>
                        <tbody>
                          {rows.map(row => (
                            <tr key={row.id}>
                              <td style={{ fontWeight: "700", color: "var(--primary-950)" }}>{row.team}</td>
                              <td>{row.workerType}</td>
                              <td style={{ textAlign: "center", fontWeight: "700", fontVariantNumeric: "tabular-nums" }}>{row.workerCount}</td>
                              <td style={{ textAlign: "center", fontSize: "11.5px", color: "var(--primary-700)" }}>
                                {row.units} {row.units === 1 ? "Day" : "Days"}
                              </td>
                              <td style={{ textAlign: "center", fontFamily: "monospace", fontSize: "11.5px", color: "var(--primary-800)" }}>
                                {row.workerCount} × {row.units} × {formatINR(row.wage)}
                              </td>
                              <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700", color: "var(--primary-950)" }}>
                                {formatINR(row.amount)}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "800", borderTop: "2px solid #cbd5e1" }}>
                            <td colSpan={2} style={{ color: "var(--primary-950)" }}>Total Workforce &amp; Spend ({formatDateDMY(activeLaborDate)})</td>
                            <td style={{ textAlign: "center", color: "var(--primary-950)" }}>{totalWorkers} Workers</td>
                            <td colSpan={2}></td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--brand-orange)", fontSize: "13px" }}>
                              {formatINR(totalLabourCost)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tab 4: Materials & Stock (Report-Style Structure) */}
            {siteModalActiveTab === "materials" && (() => {
              const siteMaterials = materials.filter(m => m.siteId === selectedInspectSite.id);
              const totalMatAmount = siteMaterials.reduce((sum, m) => sum + Number(m.totalAmount || m.totalCost || m.amount || ((m.quantity || 0) * (m.unitPrice || m.rate || 0)) || 0), 0);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "800", color: "var(--primary-950)" }}>
                      Materials Inventory &amp; Stock Register
                    </h4>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)" }}>
                      {siteMaterials.length} Recorded Entries
                    </span>
                  </div>

                  {siteMaterials.length === 0 ? (
                    <div style={{ padding: "28px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", color: "var(--text-muted)", fontSize: "12.5px" }}>
                      No material deliveries or stock records registered for this site.
                    </div>
                  ) : (
                    <div style={{ maxHeight: "300px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                      <table className="admin-table" style={{ margin: 0 }}>
                        <thead>
                          <tr style={{ backgroundColor: "#f8fafc" }}>
                            <th>Material Name</th>
                            <th style={{ textAlign: "center" }}>Quantity</th>
                            <th>Supplier / Vendor</th>
                            <th style={{ textAlign: "right" }}>Rate</th>
                            <th style={{ textAlign: "right" }}>Amount</th>
                            <th style={{ textAlign: "center" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {siteMaterials.map(m => {
                            const amt = Number(m.totalAmount || m.totalCost || m.amount || ((m.quantity || 0) * (m.unitPrice || m.rate || 0)) || 0);
                            const rate = Number(m.unitPrice || m.rate || 0);
                            return (
                              <tr key={m.id}>
                                <td>
                                  <strong style={{ fontSize: "12px", color: "var(--primary-950)", display: "block" }}>{m.materialName || m.name}</strong>
                                  <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{m.category || m.materialType || "General Supply"} • {m.purchaseDate || m.date || formatDateDMY(m.createdAt)}</span>
                                </td>
                                <td style={{ textAlign: "center", fontWeight: "600", fontSize: "12px" }}>
                                  {m.quantity || m.receivedQuantity || m.currentStock || 0} {m.unit || "Units"}
                                </td>
                                <td style={{ fontSize: "11.5px", color: "var(--primary-800)" }}>
                                  {m.supplierName || m.teamName || m.vendor || "Direct Supply"}
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "11.5px" }}>
                                  {rate > 0 ? formatINR(rate) : "—"}
                                </td>
                                <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700", color: "var(--primary-950)" }}>
                                  {formatINR(amt)}
                                </td>
                                <td style={{ textAlign: "center" }}>
                                  <Badge status={(m.status || "").toLowerCase() === "approved" ? "success" : "default"}>
                                    {m.status || "Logged"}
                                  </Badge>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                        <tfoot>
                          <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "800", borderTop: "2px solid #cbd5e1" }}>
                            <td colSpan={4} style={{ color: "var(--primary-950)" }}>Total Site Material Inward Cost</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", color: "var(--primary-950)", fontSize: "13px" }}>
                              {formatINR(totalMatAmount)}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  )}
                </div>
              );
            })()}

            {/* Tab 5: Financials & Expenses */}
            {siteModalActiveTab === "expenses" && (() => {
              const siteMaterials = materials.filter(m => m.siteId === selectedInspectSite.id);
              const siteLabour = laborHistoryMap[selectedInspectSite.id] || [];
              const siteDprs = allDprs.filter(d => d.siteId === selectedInspectSite.id);
              const siteExpenses = generalExpenses.filter(e => e.siteId === selectedInspectSite.id);
              const sitePayments = labourPayments.filter(lp => lp.siteId === selectedInspectSite.id);
              const financials = getSiteFinancials(selectedInspectSite, siteMaterials, siteLabour, siteDprs, labourMaster.categories, siteExpenses, sitePayments);

              return (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "8px" }}>
                    <div style={{ padding: "10px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Contract Budget</span>
                      <strong style={{ fontSize: "14px", color: "var(--primary-950)", fontFamily: "monospace", display: "block", marginTop: "2px" }}>{formatINR(financials.budget)}</strong>
                    </div>
                    <div style={{ padding: "10px", backgroundColor: "#fff7ed", borderRadius: "6px", border: "1px solid #fed7aa" }}>
                      <span style={{ fontSize: "10px", color: "#c2410c", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Total Cost Spent</span>
                      <strong style={{ fontSize: "14px", color: "var(--brand-orange)", fontFamily: "monospace", display: "block", marginTop: "2px" }}>{formatINR(financials.totalSpent)}</strong>
                    </div>
                    <div style={{ padding: "10px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Material Cost</span>
                      <strong style={{ fontSize: "14px", color: "var(--primary-950)", fontFamily: "monospace", display: "block", marginTop: "2px" }}>{formatINR(financials.materialCost)}</strong>
                    </div>
                    <div style={{ padding: "10px", backgroundColor: "#f8fafc", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Labour Cost</span>
                      <strong style={{ fontSize: "14px", color: "var(--primary-950)", fontFamily: "monospace", display: "block", marginTop: "2px" }}>{formatINR(financials.labourCost)}</strong>
                    </div>
                  </div>

                  <div style={{ marginTop: "4px" }}>
                    <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800", color: "var(--primary-950)" }}>
                      Site General Expenses Ledger
                    </h4>
                    {siteExpenses.length === 0 ? (
                      <div style={{ padding: "20px", textAlign: "center", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0", color: "var(--text-muted)", fontSize: "12px" }}>
                        No general expenses recorded for this site.
                      </div>
                    ) : (
                      <div style={{ maxHeight: "200px", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                        <table className="admin-table" style={{ margin: 0 }}>
                          <thead>
                            <tr style={{ backgroundColor: "#f8fafc" }}>
                              <th>Description</th>
                              <th>Category</th>
                              <th>Date</th>
                              <th style={{ textAlign: "right" }}>Amount</th>
                            </tr>
                          </thead>
                          <tbody>
                            {siteExpenses.map(e => (
                              <tr key={e.id}>
                                <td style={{ fontWeight: "600", fontSize: "12px" }}>{e.description}</td>
                                <td style={{ fontSize: "11px", color: "var(--primary-700)" }}>{e.category || "General"}</td>
                                <td style={{ fontSize: "11px", color: "var(--text-muted)" }}>{formatDateDMY(e.date)}</td>
                                <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700", color: "var(--primary-950)" }}>{formatINR(e.amount || 0)}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                </div>
              );
            })()}

            {/* Tab 6: Progress & DPRs */}
            {siteModalActiveTab === "progress" && (
              <div>
                <h4 style={{ margin: "0 0 8px 0", fontSize: "13px", fontWeight: "800" }}>Daily Progress Reports &amp; Field Photos</h4>
                {allDprs.filter(d => d.siteId === selectedInspectSite.id).length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "12px" }}>No DPRs submitted for this site.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
                    {allDprs.filter(d => d.siteId === selectedInspectSite.id).slice(0, 5).map(d => (
                      <div key={d.id} style={{ padding: "10px 12px", backgroundColor: "#fafafa", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "4px" }}>
                          <strong style={{ fontSize: "12px", color: "var(--primary-950)" }}>{d.date || "DPR Report"}{d.weather ? ` (${d.weather})` : ""}</strong>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>By {d.submittedByName || d.engineerName || "Engineer"}</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "11.5px", color: "var(--primary-700)" }}>{d.workDescription || d.description || "Progress report logged."}</p>
                        {d.photoUrl && (
                          <div style={{ marginTop: "6px" }}>
                            <button
                              type="button"
                              onClick={() => setSelectedPreviewImage({ url: d.photoUrl, title: `DPR Photo — ${d.date}` })}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "3px 8px",
                                fontSize: "11px",
                                cursor: "pointer",
                                borderRadius: "6px",
                                border: "1px solid var(--border-color)",
                                backgroundColor: "#ffffff",
                                color: "var(--primary-700)"
                              }}
                            >
                              <Eye size={13} style={{ color: "var(--primary-600)" }} />
                              <span>View DPR Photo</span>
                            </button>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── 3. PHOTO PROOF LIGHTBOX MODAL (ASPECT RATIO PRESERVED) ── */}
      {selectedPreviewImage && (
        <Modal
          isOpen={!!selectedPreviewImage}
          onClose={() => setSelectedPreviewImage(null)}
          title={selectedPreviewImage.title || "Photo Proof"}
          maxWidth="840px"
          footer={
            <button
              type="button"
              onClick={() => setSelectedPreviewImage(null)}
              className="btn btn-outline"
              style={{ padding: "8px 20px", fontSize: "13px", fontWeight: "700" }}
            >
              Close Viewer
            </button>
          }
        >
          <div style={{ textAlign: "center", padding: "6px 0" }}>
            {selectedPreviewImage.url ? (
              <div style={{ 
                display: "flex", 
                justifyContent: "center", 
                alignItems: "center", 
                backgroundColor: "#0f172a", 
                borderRadius: "12px", 
                padding: "16px", 
                overflow: "hidden",
                minHeight: "260px"
              }}>
                <img
                  src={selectedPreviewImage.url}
                  alt={selectedPreviewImage.title}
                  style={{ 
                    maxWidth: "100%", 
                    maxHeight: "75vh", 
                    width: "auto", 
                    height: "auto", 
                    borderRadius: "8px", 
                    objectFit: "contain", 
                    boxShadow: "0 10px 30px rgba(0,0,0,0.35)" 
                  }}
                />
              </div>
            ) : (
              <div style={{ padding: "40px 20px", color: "var(--text-muted)", fontSize: "13px" }}>
                <Camera size={40} style={{ margin: "0 auto 10px auto", opacity: "0.4", display: "block" }} />
                <strong style={{ display: "block", color: "var(--primary-900)", marginBottom: "4px" }}>No Photo Available</strong>
                <p style={{ margin: 0, fontSize: "12px" }}>No verified image was recorded for this entry.</p>
              </div>
            )}
          </div>
        </Modal>
      )}

      {/* ── 4. KPI CLICK-TO-DRILLDOWN MODAL ── */}
      {kpiDrilldownState.isOpen && (
        <Modal
          isOpen={kpiDrilldownState.isOpen}
          onClose={() => setKpiDrilldownState(prev => ({ ...prev, isOpen: false }))}
          title={kpiDrilldownState.title}
          maxWidth="900px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <p style={{ margin: 0, fontSize: "12.5px", color: "var(--primary-600)" }}>
              {kpiDrilldownState.subtitle}
            </p>

            {kpiDrilldownState.items.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px", color: "var(--text-muted)", fontSize: "13px" }}>
                No records found for this metric.
              </div>
            ) : (
              <div style={{ maxHeight: "55vh", overflowY: "auto", border: "1px solid var(--border-color)", borderRadius: "8px" }}>
                <table className="admin-table">
                  <thead>
                    <tr>
                      <th>Details / Name</th>
                      <th>Status / Standing</th>
                      <th>Metric</th>
                      <th style={{ textAlign: "right" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {kpiDrilldownState.items.map((item, idx) => (
                      <tr key={item.id || idx}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            {item.photoUrl && (
                              <img src={item.photoUrl} alt="Thumbnail" style={{ width: "28px", height: "28px", borderRadius: "4px", objectFit: "cover" }} />
                            )}
                            <div>
                              <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>{item.title}</strong>
                              <span style={{ fontSize: "11px", color: "var(--primary-600)", display: "block" }}>{item.subtitle}</span>
                              {item.delayDetail && (
                                <span style={{ fontSize: "11px", color: "var(--danger-700)", fontWeight: "600", display: "inline-block", marginTop: "2px" }}>
                                  ⚠️ {item.delayDetail}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <Badge status={item.badgeStatus || "default"}>{item.status}</Badge>
                        </td>
                        <td style={{ fontWeight: "700", fontSize: "12px", color: "var(--primary-950)" }}>
                          {item.metric}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          {item.actionSite ? (
                            <button
                              type="button"
                              onClick={() => {
                                setKpiDrilldownState(prev => ({ ...prev, isOpen: false }));
                                setSelectedInspectSite(item.actionSite);
                              }}
                              className="erp-btn-secondary"
                              style={{ fontSize: "11px", padding: "3px 8px" }}
                            >
                              Inspect Site
                            </button>
                          ) : item.link ? (
                            <Link
                              to={item.link}
                              onClick={() => setKpiDrilldownState(prev => ({ ...prev, isOpen: false }))}
                              className="erp-btn-secondary"
                              style={{ fontSize: "11px", padding: "3px 8px", textDecoration: "none", display: "inline-block" }}
                            >
                              Review →
                            </Link>
                          ) : (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </Modal>
      )}

      <Loading show={dataLoading} text="Updating database record..." />
    </Layout>
  );
}

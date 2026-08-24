import React, { useState, useEffect, useMemo } from "react";
import { onSnapshot, collection, query, where, doc, limit } from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
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
  Maximize2
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
  // VIEW 1: EXECUTIVE DASHBOARD
  // ══════════════════════════════════════════════════════════════════════════
  const renderDashboardView = () => {
    const pendingDocs = documents.filter(d => (d.status || '').toLowerCase() === 'uploaded' || (d.status || '').toLowerCase() === 'pending' || !d.status);
    const alerts = [];
    const nowMs = Date.now();
    
    generalExpenses.forEach(exp => {
      if (Number(exp.amount) >= 100000) {
        alerts.push({
          id: `alert_sa_high_${exp.id}`,
          type: 'warning',
          category: 'Payment Alert',
          title: 'High-Value Field Payment Logged',
          message: `General expense of ₹${exp.amount} for "${exp.description}" has been logged at site ${sites.find(s => s.id === exp.siteId)?.siteName || 'Site'}.`
        });
      }
    });

    sites.forEach(site => {
      if (site.status === 'Delayed' || isSiteDelayed(site)) {
        alerts.push({
          id: `alert_sa_delay_${site.id}`,
          type: 'danger',
          category: 'Schedule Alert',
          title: 'Project Schedule Delayed Milestone',
          message: `Site execution status for "${site.siteName}" is delayed.`
        });
      }
    });

    sites.forEach(site => {
      if ((site.status || '').toLowerCase() === 'active') {
        const updates = systemActivities.filter(a => a.siteId === site.id && a.moduleType === 'Progress');
        let lastUpdatedMs = 0;
        if (updates.length > 0) {
          const latestUpdate = updates[0];
          lastUpdatedMs = latestUpdate.createdAt?.seconds 
            ? latestUpdate.createdAt.seconds * 1000 
            : (latestUpdate.createdAt ? new Date(latestUpdate.createdAt).getTime() : 0);
        } else {
          lastUpdatedMs = site.createdAt?.seconds 
            ? site.createdAt.seconds * 1000 
            : (site.createdAt ? new Date(site.createdAt).getTime() : 0);
        }
        const diffHours = (nowMs - lastUpdatedMs) / (1000 * 60 * 60);
        if (diffHours >= 48) {
          alerts.push({
            id: `alert_sa_dpr_${site.id}`,
            type: 'danger',
            category: 'Progress Alert',
            title: 'Missing Daily Progress Update',
            message: `No Daily Progress Report submitted in the last 48 hours for active site "${site.siteName}".`
          });
        }
      }
    });

    approvals.forEach(a => {
      if ((a.status || '').toLowerCase() === 'pending') {
        const createdMs = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt ? new Date(a.createdAt).getTime() : nowMs);
        const diffDays = (nowMs - createdMs) / (1000 * 60 * 60 * 24);
        if (diffDays >= 3) {
          alerts.push({
            id: `alert_sa_app_${a.id}`,
            type: 'warning',
            category: 'Approvals Alert',
            title: 'Long Pending Approval',
            message: `${a.type} request from ${a.requestedBy} for ${a.siteName} has been pending for over 3 days.`
          });
        }
      }
    });

    const netPosition = overallMetrics.totalPaymentsReceived - overallMetrics.totalExpenses;
    const isProfit = netPosition >= 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>

        {/* ── 10 REAL-TIME SYSTEM-WIDE KPI CARDS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px" }}>
          
          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#f1f5f9", color: "var(--primary-900)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Building2 size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Total Sites</span>
              <strong style={{ fontSize: "18px", color: "var(--primary-950)" }}>{overallMetrics.totalSites}</strong>
              <span style={{ fontSize: "10.5px", color: "var(--success-600)", fontWeight: "700", display: "block" }}>{overallMetrics.activeSites} Active</span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: overallMetrics.delayedSites > 0 ? "#fef2f2" : "#f0fdf4", color: overallMetrics.delayedSites > 0 ? "#dc2626" : "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <AlertTriangle size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Delayed Sites</span>
              <strong style={{ fontSize: "18px", color: overallMetrics.delayedSites > 0 ? "#dc2626" : "var(--primary-950)" }}>{overallMetrics.delayedSites}</strong>
              <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>{overallMetrics.delayedSites > 0 ? "Requires Attention" : "On Track"}</span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#eff6ff", color: "#1d4ed8", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Site Engineers</span>
              <strong style={{ fontSize: "18px", color: "var(--primary-950)" }}>{engineers.length}</strong>
              <span style={{ fontSize: "10.5px", color: "#1d4ed8", fontWeight: "700", display: "block" }}>{engineers.filter(e => e.status === "active").length} Active</span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#fdf4ff", color: "#a855f7", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Total Admins</span>
              <strong style={{ fontSize: "18px", color: "var(--primary-950)" }}>{admins.length || 1}</strong>
              <span style={{ fontSize: "10.5px", color: "#a855f7", fontWeight: "700", display: "block" }}>Company Administrators</span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <ClipboardCheck size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Today's Attendance</span>
              <strong style={{ fontSize: "18px", color: "var(--primary-950)" }}>{todayAttendanceList.length}</strong>
              <span style={{ fontSize: "10.5px", color: "#16a34a", fontWeight: "700", display: "block" }}>{todayAttendanceList.filter(r => !r.isCheckedOut).length} On-Site Now</span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#fff7ed", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Briefcase size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Today's Workers</span>
              <strong style={{ fontSize: "18px", color: "var(--primary-950)" }}>{todayLabourCount}</strong>
              <span style={{ fontSize: "10.5px", color: "#c2410c", fontWeight: "700", display: "block" }}>Field Labour Force</span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#ecfdf5", color: "#059669", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <TrendingUp size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Received (Client)</span>
              <strong style={{ fontSize: "16px", color: "var(--primary-950)", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalPaymentsReceived)}</strong>
              <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>Budget: {formatINR(overallMetrics.totalProjectValue)}</span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#fff7ed", color: "#f97316", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Total Spent</span>
              <strong style={{ fontSize: "16px", color: "var(--primary-950)", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalExpenses)}</strong>
              <span style={{ fontSize: "10.5px", color: "var(--warning-700)", fontWeight: "600", display: "block" }}>Owed: {formatINR(overallMetrics.pendingPayments)}</span>
            </div>
          </div>

          <div style={{ background: isProfit ? "#f0fdf4" : "#fef2f2", border: `1px solid ${isProfit ? "#bbf7d0" : "#fecaca"}`, borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: isProfit ? "#dcfce7" : "#fee2e2", color: isProfit ? "#16a34a" : "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
              {isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Net Cash Position</span>
              <strong style={{ fontSize: "16px", color: isProfit ? "#16a34a" : "#dc2626", fontFamily: "monospace" }}>
                {isProfit ? "+" : ""}{formatINR(netPosition)}
              </strong>
              <span style={{ fontSize: "10.5px", color: isProfit ? "#16a34a" : "#dc2626", fontWeight: "700", display: "block" }}>
                {isProfit ? "Profit Margin" : "Deficit"}
              </span>
            </div>
          </div>

          <div style={{ background: "#fff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "14px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ width: "42px", height: "42px", borderRadius: "10px", backgroundColor: "#f8fafc", color: "var(--accent-600)", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={20} />
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600", display: "block" }}>Material Stock</span>
              <strong style={{ fontSize: "18px", color: "var(--primary-950)" }}>{materials.length} Items</strong>
              <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>Total Tracked</span>
            </div>
          </div>

        </div>

        {/* ── TODAY'S OPERATIONS FEED & PROGRESS ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>

          <Card title="Corporate Work Progress & Milestone Standing">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", padding: "12px 0" }}>
              <div style={{
                position: "relative",
                width: "130px",
                height: "130px",
                borderRadius: "50%",
                background: `conic-gradient(var(--primary-600) ${overallMetrics.overallProgressPercent}%, var(--primary-100) 0)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.08)"
              }}>
                <div style={{ width: "100px", height: "100px", borderRadius: "50%", backgroundColor: "#ffffff", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
                  <span style={{ fontSize: "26px", fontWeight: "900", color: "var(--primary-900)" }}>{overallMetrics.overallProgressPercent}%</span>
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>Corporate Avg</span>
                </div>
              </div>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Projects</span>
                  <span style={{ fontWeight: "700" }}>{overallMetrics.totalSites} sites</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Budget</span>
                  <span style={{ fontWeight: "700", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalProjectValue)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Pending Approvals</span>
                  <span style={{ fontWeight: "700", color: allApprovalRequests.length > 0 ? "var(--warning-600)" : "var(--success-600)" }}>{allApprovalRequests.length}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Today's Engineer Attendance Live Status" subtitle="Real-time check-ins and field presence logged today.">
            {todayAttendanceList.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px", color: "var(--text-muted)" }}>
                <UserCheck size={28} style={{ color: "var(--primary-300)", marginBottom: "6px" }} />
                <p style={{ margin: 0, fontSize: "12.5px" }}>No engineer attendance recorded yet today.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                {todayAttendanceList.slice(0, 8).map(rec => (
                  <div key={rec.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <div>
                      <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block" }}>{rec.engineerName}</strong>
                      <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>{rec.siteName}</span>
                    </div>
                    <div style={{ textAlign: "right" }}>
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
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                        In: {rec.checkInTimeFormatted}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>

          <Card title="Pending Approvals &amp; Requisitions">
            {allApprovalRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "28px", color: "var(--text-muted)" }}>
                <CheckCircle2 size={28} style={{ color: "var(--success-500)", marginBottom: "6px" }} />
                <p style={{ margin: 0, fontSize: "12.5px" }}>All clear! No pending requests.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {allApprovalRequests.slice(0, 3).map(req => (
                  <div key={req.id} style={{ padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "8px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "#fafafa" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <Badge status={req.type === "Leave" ? "warning" : req.type === "Location" ? "pending" : "success"}>{req.type}</Badge>
                      <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }} className="font-mono">{req.requestDate}</span>
                    </div>
                    <span style={{ fontSize: "12px", fontWeight: "700" }}>{req.employeeName}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{req.details}</span>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <button onClick={() => handleApproveRequest(req)} style={{ flex: 1, padding: "4px", backgroundColor: "var(--success-600)", color: "#fff", border: "none", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Approve</button>
                      <button onClick={() => handleRejectRequest(req)} style={{ flex: 1, padding: "4px", backgroundColor: "transparent", color: "var(--danger-600)", border: "1px solid var(--danger-200)", borderRadius: "4px", fontSize: "11px", fontWeight: "700", cursor: "pointer" }}>Reject</button>
                    </div>
                  </div>
                ))}
                {allApprovalRequests.length > 3 && (
                  <Link to="/superadmin/approvals" style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: "700", textAlign: "center", display: "block" }}>
                    + {allApprovalRequests.length - 3} more
                  </Link>
                )}
              </div>
            )}
          </Card>

        </div>

        {/* ── ALERTS & NOTIFICATIONS ── */}
        {alerts.length > 0 && (
          <Card title="System-Wide Operations Alerts" style={{ borderLeft: "4px solid var(--danger-500)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(showAllAlerts ? alerts : alerts.slice(0, 4)).map(alert => (
                <div key={alert.id} className={`dash-alert-row ${alert.type}`}>
                  <AlertTriangle size={14} style={{ color: alert.type === "danger" ? "var(--danger-600)" : "var(--warning-600)", flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <span className="dash-alert-title">[{alert.category}] {alert.title}</span>
                    <p className="dash-alert-msg">{alert.message}</p>
                  </div>
                </div>
              ))}
            </div>
            {alerts.length > 4 && (
              <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "10px", textAlign: "center" }}>
                <button 
                  onClick={() => setShowAllAlerts(!showAllAlerts)}
                  style={{ background: "none", border: "none", color: "var(--primary-600)", fontWeight: "700", fontSize: "12px", cursor: "pointer" }}
                >
                  {showAllAlerts ? "Show Less" : `View All Alerts (${alerts.length})`}
                </button>
              </div>
            )}
          </Card>
        )}

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

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Administrator Accounts ({filteredAdmins.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Master directory of authorized company administrators and management personnel.
            </p>
          </div>

          <div style={{ position: "relative", minWidth: "220px" }}>
            <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              type="text"
              placeholder="Search admin name, email..."
              value={adminSearchQuery}
              onChange={(e) => setAdminSearchQuery(e.target.value)}
              style={{ width: "100%", height: "36px", paddingLeft: "32px", paddingRight: "10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <Card variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
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
                  <tr><td colSpan={6} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No administrator accounts found.</td></tr>
                ) : (
                  filteredAdmins.map(adm => {
                    const admId = adm.id || adm.uid;
                    const managedSitesCount = sites.filter(s => s.adminId === admId || s.createdBy === admId || (s.assignedAdmins || []).includes(admId)).length;

                    return (
                      <tr key={adm.id}>
                        <td style={{ fontWeight: "700" }}>{adm.fullName || adm.name || "Administrator"}</td>
                        <td>{adm.email || "—"}</td>
                        <td>
                          <span style={{
                            fontSize: "11px",
                            fontWeight: "800",
                            padding: "3px 8px",
                            borderRadius: "12px",
                            backgroundColor: adm.role === "super_admin" || adm.role === "superadmin" ? "#fdf4ff" : "#eff6ff",
                            color: adm.role === "super_admin" || adm.role === "superadmin" ? "#a855f7" : "#1d4ed8",
                            border: `1px solid ${adm.role === "super_admin" || adm.role === "superadmin" ? "#f0abfc" : "#bfdbfe"}`,
                            textTransform: "uppercase"
                          }}>
                            {adm.role === "super_admin" || adm.role === "superadmin" ? "Super Admin" : "Administrator"}
                          </span>
                        </td>
                        <td><Badge status={adm.status || "active"} /></td>
                        <td>{managedSitesCount > 0 ? `${managedSitesCount} Sites` : "Enterprise / Global"}</td>
                        <td style={{ fontFamily: "monospace", fontSize: "11px", color: "#64748b" }}>
                          {adm.id ? `${adm.id.substring(0, 10)}...` : "—"}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
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

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Master Engineer Attendance Monitor ({filteredAttendance.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Complete audit ledger of field engineer check-ins, check-outs, photo proofs, and geofence locations.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search engineer, site..."
              value={attendanceSearchQuery}
              onChange={(e) => setAttendanceSearchQuery(e.target.value)}
              style={{ height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px" }}
            />
            <select
              value={attendanceSiteFilter}
              onChange={(e) => setAttendanceSiteFilter(e.target.value)}
              style={{ height: "36px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
            <select
              value={attendanceStatusFilter}
              onChange={(e) => setAttendanceStatusFilter(e.target.value)}
              style={{ height: "36px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
            >
              <option value="all">All Status</option>
              <option value="onsite">On Site</option>
              <option value="checkout">Checked Out</option>
            </select>
            <input
              type="date"
              value={attendanceDateFilter}
              onChange={(e) => setAttendanceDateFilter(e.target.value)}
              style={{ height: "36px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
            />
            {attendanceDateFilter && (
              <button
                type="button"
                onClick={() => setAttendanceDateFilter("")}
                style={{ height: "36px", padding: "0 8px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#f8fafc", fontSize: "12px", cursor: "pointer" }}
              >
                Clear Date
              </button>
            )}
          </div>
        </div>

        <Card variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
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
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No attendance records found.</td></tr>
                ) : (
                  filteredAttendance.map(rec => (
                    <tr key={rec.id}>
                      <td style={{ fontWeight: "700" }}>{rec.engineerName}</td>
                      <td>{rec.siteName}</td>
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
                            onClick={() => setSelectedPreviewImage({ url: rec.photoUrl, title: `Attendance: ${rec.engineerName}` })}
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
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 6: DAILY LABOUR MONITORING
  // ══════════════════════════════════════════════════════════════════════════
  const renderLabourView = () => {
    const filteredLabour = (rawLabourAttendance || []).filter(r => {
      if (!r || r.lockedMetadata) return false;
      if (labourSiteFilter && r.siteId !== labourSiteFilter) return false;
      if (labourSearchQuery.trim()) {
        const q = labourSearchQuery.toLowerCase().trim();
        const matchSite = (sites.find(s => s.id === r.siteId)?.siteName || "").toLowerCase().includes(q);
        const matchCat = (r.categoryName || r.category || "").toLowerCase().includes(q);
        const matchTeam = (r.teamName || "").toLowerCase().includes(q);
        if (!matchSite && !matchCat && !matchTeam) return false;
      }
      return true;
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Daily Workforce &amp; Labour Ledger ({filteredLabour.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Real-time daily worker counts, wage categories, and labour attendance across all construction sites.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search category, team..."
              value={labourSearchQuery}
              onChange={(e) => setLabourSearchQuery(e.target.value)}
              style={{ height: "36px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px" }}
            />
            <select
              value={labourSiteFilter}
              onChange={(e) => setLabourSiteFilter(e.target.value)}
              style={{ height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
          </div>
        </div>

        <Card variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Project Site</th>
                  <th>Attendance Date</th>
                  <th>Labour Category / Team</th>
                  <th style={{ textAlign: "right" }}>Worker Count</th>
                  <th style={{ textAlign: "right" }}>Rate / Day</th>
                  <th style={{ textAlign: "right" }}>Calculated Amount</th>
                  <th>Recorded By</th>
                </tr>
              </thead>
              <tbody>
                {filteredLabour.length === 0 ? (
                  <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No labour attendance records found.</td></tr>
                ) : (
                  filteredLabour.map(r => {
                    const siteName = sites.find(s => s.id === r.siteId)?.siteName || "General Site";
                    const workerCount = Number(r.workerCount || (r.workerEntries && r.workerEntries.length) || 1);
                    const rate = Number(r.dailyWage || r.rate || r.categoryRate) || 0;
                    const amount = Number(r.totalAmount || (workerCount * rate));

                    return (
                      <tr key={r.id}>
                        <td style={{ fontWeight: "700" }}>{siteName}</td>
                        <td className="font-mono">{formatDateDMY(r.attendanceDate || r.date)}</td>
                        <td>{r.categoryName || r.category || r.teamName || "General Labour"}</td>
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
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 7: MATERIAL STOCK INVENTORY
  // ══════════════════════════════════════════════════════════════════════════
  const renderMaterialsView = () => {
    const filteredMaterials = materials.filter(m => {
      if (materialSiteFilter && m.siteId !== materialSiteFilter) return false;
      if (materialSearchQuery.trim()) {
        const q = materialSearchQuery.toLowerCase().trim();
        const matchName = (m.materialName || m.name || "").toLowerCase().includes(q);
        const matchCat = (m.category || "").toLowerCase().includes(q);
        const matchSite = (sites.find(s => s.id === m.siteId)?.siteName || "").toLowerCase().includes(q);
        if (!matchName && !matchCat && !matchSite) return false;
      }
      return true;
    });

    const totalStockValue = filteredMaterials.reduce((acc, m) => {
      const qty = Number(m.quantity || m.currentStock) || 0;
      const rate = Number(m.unitRate || m.rate) || 0;
      return acc + (Number(m.totalCost) || (qty * rate));
    }, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Material Stock &amp; Inventory ({filteredMaterials.length} Items)
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Centralized monitoring of construction materials, inventory levels, and stock valuations across all sites.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search material, category..."
              value={materialSearchQuery}
              onChange={(e) => setMaterialSearchQuery(e.target.value)}
              style={{ height: "36px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px" }}
            />
            <select
              value={materialSiteFilter}
              onChange={(e) => setMaterialSiteFilter(e.target.value)}
              style={{ height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", fontSize: "12.5px", fontWeight: "600" }}
            >
              <option value="">All Sites</option>
              {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
            </select>
          </div>
        </div>

        <Card variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Material Name</th>
                  <th>Category</th>
                  <th>Project Site</th>
                  <th style={{ textAlign: "right" }}>Current Stock</th>
                  <th>Unit</th>
                  <th style={{ textAlign: "right" }}>Unit Rate</th>
                  <th style={{ textAlign: "right" }}>Total Value</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredMaterials.length === 0 ? (
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No materials found.</td></tr>
                ) : (
                  filteredMaterials.map(m => {
                    const siteName = sites.find(s => s.id === m.siteId)?.siteName || "General Warehouse";
                    const qty = Number(m.quantity || m.currentStock) || 0;
                    const rate = Number(m.unitRate || m.rate) || 0;
                    const totalCost = Number(m.totalCost) || (qty * rate);

                    return (
                      <tr key={m.id}>
                        <td style={{ fontWeight: "700" }}>{m.materialName || m.name || "Material"}</td>
                        <td>{m.category || "General"}</td>
                        <td>{siteName}</td>
                        <td style={{ textAlign: "right", fontWeight: "700" }}>{qty}</td>
                        <td>{m.unit || "units"}</td>
                        <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(rate)}</td>
                        <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace" }}>{formatINR(totalCost)}</td>
                        <td><Badge status={m.status || "In Stock"} /></td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>
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

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Financial Auditing &amp; Site Expense Ledger
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Audit site-by-site budgets, material outlays, labour costs, client receivables, and field payments.
            </p>
          </div>
        </div>

        <Card title="Corporate Site-wise Financial Ledger" variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
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
                  <tr><td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No sites found.</td></tr>
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
                <tr style={{ backgroundColor: "var(--primary-50)", fontWeight: "800", borderTop: "2px solid var(--primary-200)" }}>
                  <td>Corporate Aggregate Totals</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalProjectValue)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(siteWiseFinancials.reduce((acc, c) => acc + c.financials.materialExpenses, 0))}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(siteWiseFinancials.reduce((acc, c) => acc + c.financials.labourExpenses, 0))}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(siteWiseFinancials.reduce((acc, c) => acc + c.financials.otherExpenses, 0))}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalExpenses)}</td>
                  <td style={{ textAlign: "right", color: "var(--success-800)", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalPaymentsReceived)}</td>
                  <td style={{ textAlign: "right", color: "var(--danger-800)", fontFamily: "monospace" }}>{formatINR(siteWiseFinancials.reduce((acc, c) => acc + c.financials.remainingBalance, 0))}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

        <div style={{ marginTop: "10px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-950)" }}>
              Field &amp; General Expenses Ledger ({filteredExpenses.length})
            </h3>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="Search description..."
                value={expenseSearchQuery}
                onChange={(e) => setExpenseSearchQuery(e.target.value)}
                style={{ height: "36px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px" }}
              />
              <select
                value={expenseSiteFilter}
                onChange={(e) => setExpenseSiteFilter(e.target.value)}
                style={{ height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
              >
                <option value="">All Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
              </select>
            </div>
          </div>

          <Card variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
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
                    <tr><td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No general expenses found.</td></tr>
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
          </Card>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Project Schedule Standing &amp; Milestone Auditing
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Compare linear milestone targets against actual site progress and track delay action points.
            </p>
          </div>
        </div>

        {delayedList.length > 0 && (
          <Card title="Delayed Schedules Action Center" style={{ borderLeft: "4px solid var(--danger-500)", backgroundColor: "var(--danger-50)" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px", color: "var(--danger-700)", fontWeight: "800" }}>
                <AlertTriangle size={18} />
                <span>Delayed Construction Projects detected: {delayedList.length} sites.</span>
              </div>
              <ul style={{ margin: "4px 0 0 20px", padding: 0, fontSize: "13px", color: "#334155" }}>
                {delayedList.map(s => {
                  const siteMaterials = materials.filter(m => m.siteId === s.id);
                  const siteLabour = laborHistoryMap[s.id] || [];
                  const siteDprs = allDprs.filter(d => d.siteId === s.id);
                  const financials = getSiteFinancials(s, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments);
                  const planned = calculatePlannedProgress(s.startDate, s.expectedEndDate);
                  
                  return (
                    <li key={s.id} style={{ marginBottom: "6px" }}>
                      <strong>{s.siteName}</strong>: Expected completion: <u>{formatDateDMY(s.expectedEndDate)}</u>. Actual progress: <strong>{financials.progressPercent}%</strong> (Planned: {planned}%, Gap: -{planned - financials.progressPercent}%).
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        )}

        <Card title="Corporate Site Progress Standing Ledger" variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
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
        </Card>
      </div>
    );
  };

  // ══════════════════════════════════════════════════════════════════════════
  // VIEW 10: CENTRAL APPROVALS GATEWAY
  // ══════════════════════════════════════════════════════════════════════════
  const renderApprovalsView = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              Central Approvals Gateway ({allApprovalRequests.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Review and act upon field requests for leave, site location coordinates, and requisitions.
            </p>
          </div>
        </div>

        <Card variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Type</th>
                  <th>Requester</th>
                  <th>Request Details</th>
                  <th>Date</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {allApprovalRequests.length === 0 ? (
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "30px", color: "var(--text-muted)" }}>All clear! No pending requests.</td></tr>
                ) : (
                  allApprovalRequests.map(req => (
                    <tr key={req.id}>
                      <td><Badge status={req.type === "Leave" ? "warning" : req.type === "Location" ? "pending" : "success"}>{req.type}</Badge></td>
                      <td style={{ fontWeight: "700" }}>{req.employeeName}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{req.details}</span>
                          {req.type === "Location" && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Proposed coordinates: {req.latitude.toFixed(6)}, {req.longitude.toFixed(6)}</span>
                          )}
                        </div>
                      </td>
                      <td className="font-mono">{req.requestDate}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                          <button type="button" onClick={() => handleApproveRequest(req)} style={{ border: "none", background: "none", color: "#16a34a", padding: "4px 8px", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>Approve</button>
                          <button type="button" onClick={() => handleRejectRequest(req)} style={{ border: "none", background: "none", color: "#dc2626", padding: "4px 8px", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}>Reject</button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "var(--primary-950)" }}>
              System Activity &amp; Audit Trail ({filteredActivities.length})
            </h2>
            <p style={{ margin: "2px 0 0 0", fontSize: "12.5px", color: "var(--text-muted)" }}>
              Immutable chronological record of administrative actions, check-ins, labour logs, and financial transactions.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="Search user, action, site..."
              value={activitySearchQuery}
              onChange={(e) => setActivitySearchQuery(e.target.value)}
              style={{ height: "36px", padding: "0 12px", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px" }}
            />
            <select
              value={activityModuleFilter}
              onChange={(e) => setActivityModuleFilter(e.target.value)}
              style={{ height: "36px", padding: "0 10px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#fff", fontSize: "12.5px" }}
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

        <Card variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
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
                  <tr><td colSpan={5} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No system activity recorded.</td></tr>
                ) : (
                  filteredActivities.map(a => (
                    <tr key={a.id}>
                      <td className="font-mono" style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
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
        </Card>
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

      <Loading show={dataLoading} text="Updating database record..." />
    </Layout>
  );
}

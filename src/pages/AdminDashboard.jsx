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
  DollarSign
} from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [rawAttendanceToday, setRawAttendanceToday] = useState([]);
  const [rawMaterials, setRawMaterials] = useState([]);
  const [rawWorkers, setRawWorkers] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [rawExpenses, setRawExpenses] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const attendanceTodayCount = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    return rawAttendanceToday.filter(record => siteIds.has(record.siteId)).length;
  }, [sites, rawAttendanceToday]);

  const totalMaterialsCount = useMemo(() => {
    const siteIds = new Set(sites.map(s => s.id));
    return rawMaterials.filter(m => siteIds.has(m.siteId)).length;
  }, [sites, rawMaterials]);

  const activeWorkersCount = useMemo(() => {
    return rawWorkers.length;
  }, [rawWorkers]);

  const metrics = {
    totalSites: sites.length,
    activeEngineers: engineers.filter(e => e.status === "active").length,
    attendanceToday: attendanceTodayCount,
    totalMaterials: totalMaterialsCount,
    activeWorkers: activeWorkersCount
  };

  // Timeline Filter States
  const [filterSite, setFilterSite] = useState("");
  const [filterEngineer, setFilterEngineer] = useState("");
  const [filterDate, setFilterDate] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

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

    // 1. Sites Listener
    const adminUid = user?.uid || null;
    const unsubSites = onSnapshot(collection(db, "sites"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
        list.push({ id: docSnap.id, ...data });
      });
      setSites(list);
      sitesLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Sites listener error:", err);
      sitesLoaded = true;
      checkLoadingComplete();
    });

    // 2. Engineers Listener
    let unsubLegacyEngineers = null;
    const unsubEngineers = onSnapshot(collection(db, "siteEngineers"), (snapshot) => {
      if (snapshot.empty) {
        if (unsubLegacyEngineers) unsubLegacyEngineers();
        const qLegacy = query(collection(db, "users"), where("role", "==", "site_engineer"));
        unsubLegacyEngineers = onSnapshot(qLegacy, (legacySnap) => {
          const list = [];
          legacySnap.forEach(docSnap => {
            const data = docSnap.data();
            if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
            list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
          });
          setEngineers(list);
          engineersLoaded = true;
          checkLoadingComplete();
        }, (err) => {
          console.error("Legacy engineers listener error:", err);
          engineersLoaded = true;
          checkLoadingComplete();
        });
      } else {
        if (unsubLegacyEngineers) {
          unsubLegacyEngineers();
          unsubLegacyEngineers = null;
        }
        const list = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
          list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
        });
        setEngineers(list);
        engineersLoaded = true;
        checkLoadingComplete();
      }
    }, (err) => {
      console.warn("siteEngineers listener error, falling back to legacy users:", err);
      if (unsubLegacyEngineers) unsubLegacyEngineers();
      const qLegacy = query(collection(db, "users"), where("role", "==", "site_engineer"));
      unsubLegacyEngineers = onSnapshot(qLegacy, (legacySnap) => {
        const list = [];
        legacySnap.forEach(docSnap => {
          const data = docSnap.data();
          if (adminUid && data.createdByAdmin && data.createdByAdmin !== adminUid) return;
          list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
        });
        setEngineers(list);
        engineersLoaded = true;
        checkLoadingComplete();
      }, (e) => {
        console.error("Fallback engineers listener error:", e);
        engineersLoaded = true;
        checkLoadingComplete();
      });
    });

    // 3. Attendance Today Listener
    const todayStr = new Date().toISOString().split("T")[0];
    const qAttendance = query(collection(db, "attendance"), where("date", "==", todayStr));
    const unsubAttendance = onSnapshot(qAttendance, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawAttendanceToday(list);
    }, (err) => {
      console.error("Attendance today listener error:", err);
    });

    // 4. Materials Listener
    const unsubMaterials = onSnapshot(collection(db, "materials"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawMaterials(list);
    }, (err) => {
      console.error("Materials listener error:", err);
    });

    // 5. Teams Listener
    const unsubWorkers = onSnapshot(collection(db, "labourTeams"), (snapshot) => {
      const flattenedWorkers = [];
      snapshot.forEach(docSnap => {
        const team = docSnap.data();
        if (adminUid && team.adminId !== adminUid) return;
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            if (cat.members) {
              Object.keys(cat.members).forEach(memberId => {
                const mem = cat.members[memberId];
                flattenedWorkers.push({
                  id: mem.memberId,
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

    // 7. System Activities Listener
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

    // 8. Approvals Listener
    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setApprovals(list);
    }, (err) => {
      console.error("Approvals listener error:", err);
    });

    // 9. Documents Listener
    const unsubDocuments = onSnapshot(collection(db, "documents"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDocuments(list);
    }, (err) => {
      console.error("Documents listener error:", err);
    });

    // 10. Expenses Listener
    const unsubExpenses = onSnapshot(doc(db, "expenses", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setRawExpenses(snapshot.data().expenses || []);
      } else {
        setRawExpenses([]);
      }
    }, (err) => {
      console.error("Expenses dashboard listener error:", err);
    });

    return () => {
      unsubSites();
      unsubEngineers();
      if (unsubLegacyEngineers) unsubLegacyEngineers();
      unsubAttendance();
      unsubMaterials();
      unsubWorkers();
      unsubSys();
      unsubApprovals();
      unsubDocuments();
      unsubExpenses();
    };
  }, []);

  // Map engineers by ID for quick lookups
  const engineersMap = {};
  engineers.forEach(eng => {
    engineersMap[eng.id] = eng.fullName;
  });

  const totalAssignedProjects = sites.filter(
    site => site.assignedEngineers && site.assignedEngineers.length > 0
  ).length;

  const pendingCount = approvals.filter(r => (r.status || "").toLowerCase() === "pending").length;

  // Compute Alerts dynamically
  const alerts = [];
  const nowMs = Date.now();

  approvals.forEach(a => {
    if ((a.status || "").toLowerCase() === "pending") {
      const createdMs = a.createdAt?.seconds 
        ? a.createdAt.seconds * 1000 
        : (a.createdAt ? new Date(a.createdAt).getTime() : nowMs);
      const diffDays = (nowMs - createdMs) / (1000 * 60 * 60 * 24);
      if (diffDays >= 3) {
        alerts.push({
          id: `alert_app_${a.id}`,
          type: "warning",
          category: "Approvals",
          title: "Pending Requisition",
          message: `${a.type} from ${a.requestedBy} has been pending for over 3 days.`
        });
      }
    }
  });

  const pendingDocs = documents.filter(d => (d.status || "").toLowerCase() === "uploaded" || (d.status || "").toLowerCase() === "pending" || !d.status);
  if (pendingDocs.length > 0) {
    alerts.push({
      id: "alert_pending_docs",
      type: "warning",
      category: "Documents",
      title: "Document Review",
      message: `There are ${pendingDocs.length} site document(s) awaiting verification.`
    });
  }

  sites.forEach(site => {
    if ((site.status || "").toLowerCase() === "active") {
      const updates = systemActivities.filter(a => a.siteId === site.id && a.moduleType === "Progress");
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
          id: `alert_dpr_${site.id}`,
          type: "danger",
          category: "Progress",
          title: "Missing DPR",
          message: `No updates logged for "${site.siteName}" in the last 48 hours.`
        });
      }
    }
  });

  sites.forEach(site => {
    if (site.status === "Delayed" || site.isSiteDelayed) {
      alerts.push({
        id: `alert_delay_${site.id}`,
        type: "danger",
        category: "Milestone",
        title: "Timeline Slippage",
        message: `Project "${site.siteName}" timeline has slipped behind target.`
      });
    }
  });

  const mappedSys = systemActivities.map(s => ({
    id: s.id,
    type: s.actionType,
    engineerId: s.userId,
    engineerName: s.userName || "System",
    siteId: s.siteId,
    siteName: s.siteName || "N/A",
    date: s.date,
    time: s.createdAt?.seconds 
      ? new Date(s.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
      : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    description: s.description,
    details: `Module: ${s.moduleType}`,
    timestamp: s.createdAt,
    isSystem: true,
    moduleType: s.moduleType
  }));

  const combinedTimeline = [...mappedSys]
    .sort((a, b) => {
      const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return tB - tA;
    })
    .filter(log => {
      if (filterSite && log.siteId !== filterSite) return false;
      if (filterEngineer && log.engineerId !== filterEngineer) return false;
      if (filterDate && log.date !== filterDate) return false;
      return true;
    });

  // Calculate KPI values
  const todayExpensesSum = useMemo(() => {
    const todayStr = new Date().toISOString().split("T")[0];
    return rawExpenses
      .filter(e => e.date === todayStr || (e.createdAt?.seconds && new Date(e.createdAt.seconds * 1000).toISOString().split("T")[0] === todayStr))
      .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
  }, [rawExpenses]);

  const avgProgress = useMemo(() => {
    if (sites.length === 0) return 0;
    const totalProg = sites.reduce((sum, s) => sum + (Number(s.progress) || Number(s.completionPercentage) || 0), 0);
    return Math.round(totalProg / sites.length);
  }, [sites]);

  const pendingDprCount = useMemo(() => {
    const activeSites = sites.filter(s => (s.status || "").toLowerCase() === "active");
    const todayStr = new Date().toISOString().split("T")[0];
    const reportedSiteIds = new Set(systemActivities.filter(a => a.date === todayStr && a.moduleType === "Progress").map(a => a.siteId));
    return activeSites.filter(s => !reportedSiteIds.has(s.id)).length;
  }, [sites, systemActivities]);

  const pendingMaterialApprovalCount = useMemo(() => {
    return approvals.filter(a => (a.status || "").toLowerCase() === "pending" && a.type === "Material").length;
  }, [approvals]);

  const pendingEngineerApprovalCount = useMemo(() => {
    return approvals.filter(a => (a.status || "").toLowerCase() === "pending" && (a.type === "Leave" || a.type === "Location")).length;
  }, [approvals]);

  const pendingExpenseCount = useMemo(() => {
    return rawExpenses.filter(e => (e.status || "").toLowerCase() === "pending").length;
  }, [rawExpenses]);

  return (
    <Layout 
      title="ERP Executive Dashboard" 
      description="Real-time construction site monitoring, workforce deployment, and operational control center."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── 1. TOP SUMMARY KPI CARDS (EXACT 6 CARDS) ── */}
      <div className="erp-kpi-container" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", marginBottom: "20px" }}>
        
        {/* KPI 1: Active Sites */}
        <div className="erp-stat-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Sites</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#fff7ed", color: "#f97316", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Building2 size={20} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{sites.filter(s => (s.status || "active").toLowerCase() === "active").length}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
            <span>{totalAssignedProjects} Assigned</span>
            <span style={{ fontWeight: "700", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>Active</span>
          </div>
        </div>

        {/* KPI 2: Active Site Engineers */}
        <div className="erp-stat-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Engineers</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <HardHat size={20} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{engineers.filter(e => e.status === "active").length}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
            <span>Of {engineers.length} Registered</span>
            <span style={{ fontWeight: "700", color: "#2563eb", backgroundColor: "#dbeafe", padding: "2px 6px", borderRadius: "4px" }}>Deployed</span>
          </div>
        </div>

        {/* KPI 3: Today's Labour */}
        <div className="erp-stat-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Today's Labour</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Users size={20} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{metrics.activeWorkers}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
            <span>{metrics.attendanceToday} Check-ins Today</span>
            <span style={{ fontWeight: "700", color: "#ea580c", backgroundColor: "#ffedd5", padding: "2px 6px", borderRadius: "4px" }}>On Site</span>
          </div>
        </div>

        {/* KPI 4: Pending Approvals */}
        <div className="erp-stat-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Pending Approvals</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: pendingCount > 0 ? "#fef2f2" : "#f1f5f9", color: pendingCount > 0 ? "#ef4444" : "#64748b", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <ClipboardCheck size={20} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: pendingCount > 0 ? "#ef4444" : "#0f172a", lineHeight: "1" }}>{pendingCount}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
            <span>Awaiting Action</span>
            {pendingCount > 0 ? (
              <Link to="/admin/approvals" style={{ fontWeight: "700", color: "#ef4444", backgroundColor: "#fee2e2", padding: "2px 6px", borderRadius: "4px", textDecoration: "none" }}>Review →</Link>
            ) : (
              <span style={{ fontWeight: "700", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>Clear</span>
            )}
          </div>
        </div>

        {/* KPI 5: Today's Expenses */}
        <div className="erp-stat-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Today's Expenses</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#fef3c7", color: "#b45309", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <DollarSign size={20} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>₹{todayExpensesSum.toLocaleString()}</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
            <span>Field & Material Ledger</span>
            <span style={{ fontWeight: "700", color: "#b45309", backgroundColor: "#fef3c7", padding: "2px 6px", borderRadius: "4px" }}>Daily</span>
          </div>
        </div>

        {/* KPI 6: Monthly Progress */}
        <div className="erp-stat-card" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "18px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Monthly Progress</span>
            <div style={{ width: "36px", height: "36px", borderRadius: "8px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <TrendingUp size={20} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "28px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{avgProgress}%</div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "10px", fontSize: "11px", color: "#64748b" }}>
            <span>Sites Completion Avg</span>
            <span style={{ fontWeight: "700", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 6px", borderRadius: "4px" }}>Tracked</span>
          </div>
        </div>

      </div>

      {/* ── 2. QUICK ACTIONS SECTION ── */}
      <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", marginBottom: "20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "12px" }}>
          Quick Actions
        </div>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
          <Link to="/admin/sites" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "8px 14px" }}>
            <Building2 size={15} style={{ color: "#f97316" }} /> + Add Site
          </Link>
          <Link to="/admin/assignments" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "8px 14px" }}>
            <ClipboardCheck size={15} style={{ color: "#2563eb" }} /> + Assign Engineer
          </Link>
          <Link to="/admin/engineers" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "8px 14px" }}>
            <HardHat size={15} style={{ color: "#16a34a" }} /> + Add Engineer
          </Link>
          <Link to="/admin/labour" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "8px 14px" }}>
            <Users size={15} style={{ color: "#ea580c" }} /> + Add Labour
          </Link>
          <Link to="/admin/materials" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "8px 14px" }}>
            <Package size={15} style={{ color: "#8b5cf6" }} /> + Add Material
          </Link>
          <Link to="/admin/reports" className="btn btn-outline" style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "8px 14px" }}>
            <FileText size={15} style={{ color: "#06b6d4" }} /> + Create DPR
          </Link>
        </div>
      </div>

      {/* ── 3. MAIN CONTENT GRID (ACTIVE PROJECTS TABLE + SIDEBAR ALERTS/TASKS) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "20px", marginBottom: "20px" }}>
        
        {/* ACTIVE PROJECTS TABLE */}
        <Card variant="table" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>Active Projects</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>Live status, progress percentages, and supervision</p>
            </div>
            <Link to="/admin/sites" style={{ fontSize: "12px", fontWeight: "700", color: "#ea580c", textDecoration: "none" }}>View All Sites →</Link>
          </div>

          <div className="table-container" style={{ overflowX: "auto" }}>
            <table className="modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Site Name</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Client</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Assigned Engineer</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Progress %</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Last Updated</th>
                  <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {sites.length === 0 ? (
                  <tr>
                    <td colSpan="7" style={{ textAlign: "center", padding: "32px", color: "#64748b", fontSize: "13px" }}>
                      No construction sites registered. Click <strong>+ Add Site</strong> above to initialize your first project.
                    </td>
                  </tr>
                ) : (
                  sites.map(site => {
                    const progVal = Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || 0));
                    const assignedEngNames = (site.assignedEngineers || []).map(uid => {
                      const e = engineers.find(eng => eng.id === uid);
                      return e ? e.fullName : "Engineer";
                    });

                    const lastUpdateStr = site.updatedAt?.seconds 
                      ? new Date(site.updatedAt.seconds * 1000).toLocaleDateString("en-GB") 
                      : (site.createdAt?.seconds 
                          ? new Date(site.createdAt.seconds * 1000).toLocaleDateString("en-GB") 
                          : "Today");

                    return (
                      <tr key={site.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "14px 16px" }}>
                          <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{site.siteName}</strong>
                          <span style={{ fontSize: "11px", color: "#64748b" }}>{site.location || "Location not set"}</span>
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "12.5px", color: "#334155" }}>
                          {site.clientName || "Internal Project"}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {assignedEngNames.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {assignedEngNames.map((name, idx) => (
                                <span key={idx} style={{ fontSize: "10.5px", fontWeight: "700", backgroundColor: "#f1f5f9", color: "#334155", padding: "2px 6px", borderRadius: "4px" }}>{name}</span>
                              ))}
                            </div>
                          ) : (
                            <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>Unassigned</span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", width: "160px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "6px", backgroundColor: "#e2e8f0", borderRadius: "100px", overflow: "hidden" }}>
                              <div style={{ width: `${progVal}%`, height: "100%", backgroundColor: progVal >= 80 ? "#16a34a" : (progVal >= 40 ? "#f97316" : "#2563eb") }} />
                            </div>
                            <span style={{ fontSize: "11.5px", fontWeight: "800", color: "#0f172a", minWidth: "32px" }}>{progVal}%</span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          <Badge status={site.status || "active"} />
                        </td>
                        <td style={{ padding: "14px 16px", fontSize: "11.5px", color: "#64748b", fontFamily: "monospace" }}>
                          {lastUpdateStr}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <Link to="/admin/sites" className="btn btn-outline" style={{ padding: "4px 10px", fontSize: "11px" }}>
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
        </Card>

        {/* SIDEBAR: OPERATIONAL ALERTS & PENDING TASKS */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* OPERATIONAL ALERTS */}
          <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
              <span style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                <AlertTriangle size={16} style={{ color: "#ef4444" }} />
                Operational Alerts
              </span>
              <span style={{ fontSize: "10px", fontWeight: "800", backgroundColor: alerts.length > 0 ? "#fee2e2" : "#dcfce7", color: alerts.length > 0 ? "#ef4444" : "#16a34a", padding: "2px 8px", borderRadius: "100px" }}>
                {alerts.length} Critical
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {alerts.length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                  <CheckCircle2 size={24} style={{ color: "#16a34a", marginBottom: "6px" }} />
                  <p style={{ margin: 0, fontSize: "12.5px", fontWeight: "700", color: "#16a34a" }}>No Critical Alerts Today</p>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>All active sites and field DPR logs on schedule</span>
                </div>
              ) : (
                alerts.slice(0, 4).map(alert => (
                  <div key={alert.id} style={{ display: "flex", gap: "10px", padding: "10px 12px", backgroundColor: alert.type === "danger" ? "#fef2f2" : "#fffbeb", borderRadius: "8px", border: `1px solid ${alert.type === "danger" ? "#fecaca" : "#fde68a"}` }}>
                    <AlertTriangle size={15} style={{ color: alert.type === "danger" ? "#ef4444" : "#b45309", flexShrink: 0, marginTop: "2px" }} />
                    <div style={{ minWidth: 0 }}>
                      <strong style={{ fontSize: "11.5px", color: alert.type === "danger" ? "#991b1b" : "#92400e", display: "block" }}>{alert.title}</strong>
                      <p style={{ margin: "2px 0 0 0", fontSize: "11px", color: "#334155", lineHeight: "1.3" }}>{alert.message}</p>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          {/* PENDING TASKS */}
          <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
            <div style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
              <CheckCircle2 size={16} style={{ color: "#2563eb" }} />
              Pending Tasks
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Pending DPR Submissions</span>
                <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: pendingDprCount > 0 ? "#fee2e2" : "#f1f5f9", color: pendingDprCount > 0 ? "#ef4444" : "#64748b", padding: "2px 8px", borderRadius: "100px" }}>{pendingDprCount} Sites</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Pending Material Approvals</span>
                <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: pendingMaterialApprovalCount > 0 ? "#ffedd5" : "#f1f5f9", color: pendingMaterialApprovalCount > 0 ? "#c2410c" : "#64748b", padding: "2px 8px", borderRadius: "100px" }}>{pendingMaterialApprovalCount} Requests</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Pending Engineer Approvals</span>
                <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: pendingEngineerApprovalCount > 0 ? "#e0f2fe" : "#f1f5f9", color: pendingEngineerApprovalCount > 0 ? "#0369a1" : "#64748b", padding: "2px 8px", borderRadius: "100px" }}>{pendingEngineerApprovalCount} Requests</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>Pending Expenses</span>
                <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: pendingExpenseCount > 0 ? "#fef3c7" : "#f1f5f9", color: pendingExpenseCount > 0 ? "#b45309" : "#64748b", padding: "2px 8px", borderRadius: "100px" }}>{pendingExpenseCount} Logs</span>
              </div>

            </div>
          </Card>

        </div>

      </div>

      {/* ── 4. RECENT ACTIVITY TIMELINE ── */}
      <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>Recent Operational Activity</h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>Live log stream of site actions, field attendance, materials, and expenses</p>
          </div>
          <Activity size={18} style={{ color: "#ea580c" }} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {combinedTimeline.length === 0 ? (
            <p style={{ textAlign: "center", color: "#64748b", padding: "20px", fontSize: "12.5px" }}>No recent activity logged in the system.</p>
          ) : (
            combinedTimeline.slice(0, 6).map((log, index) => (
              <div key={log.id || index} style={{ display: "flex", gap: "12px", alignItems: "flex-start", paddingBottom: index === 5 ? "0" : "12px", borderBottom: index === 5 ? "none" : "1px solid #f1f5f9" }}>
                <div style={{ width: "8px", height: "8px", borderRadius: "50%", backgroundColor: "#ea580c", marginTop: "5px", flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>{log.description}</strong>
                    <span style={{ fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>{log.time}</span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Site: {log.siteName} • By: {log.engineerName} ({log.details})</span>
                </div>
              </div>
            ))
          )}
        </div>
      </Card>

      <Loading show={loading} text="Loading Construction ERP dashboard..." />
    </Layout>
  );
}


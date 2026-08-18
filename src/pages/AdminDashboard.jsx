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
      ? new Date(s.createdAt.seconds * 1000).toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true })
      : new Date().toLocaleTimeString('en-IN', { timeZone: 'Asia/Kolkata', hour: '2-digit', minute: '2-digit', hour12: true }),
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

  // Derived values for the 6 exact KPI cards
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

  // Expenses breakdown by category for Expense Overview Chart
  const expenseCategoryBreakdown = useMemo(() => {
    const categories = { "Material": 0, "Labour": 0, "Fuel & Equipment": 0, "Other": 0 };
    rawExpenses.forEach(exp => {
      const amt = Number(exp.amount) || 0;
      const cat = exp.category || exp.expenseType || "Other";
      if (cat.toLowerCase().includes("mat")) categories["Material"] += amt;
      else if (cat.toLowerCase().includes("lab")) categories["Labour"] += amt;
      else if (cat.toLowerCase().includes("fuel") || cat.toLowerCase().includes("equip")) categories["Fuel & Equipment"] += amt;
      else categories["Other"] += amt;
    });
    return categories;
  }, [rawExpenses]);

  const totalExpenseAllTime = useMemo(() => {
    return Object.values(expenseCategoryBreakdown).reduce((a, b) => a + b, 0);
  }, [expenseCategoryBreakdown]);

  // Projects sorted for Upcoming Deadlines card
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

      {/* ── 1. EXACTLY SIX COMPACT KPI CARDS ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginBottom: "20px" }}>
        
        {/* KPI 1: Active Sites */}
        <div className="erp-kpi-compact">
          <div className="erp-kpi-icon-box erp-kpi-icon-orange">
            <Building2 size={20} />
          </div>
          <div>
            <div className="erp-kpi-val">{sites.filter(s => (s.status || "active").toLowerCase() === "active").length}</div>
            <div className="erp-kpi-lbl">Active Sites</div>
          </div>
        </div>

        {/* KPI 2: Running Projects */}
        <div className="erp-kpi-compact">
          <div className="erp-kpi-icon-box erp-kpi-icon-blue">
            <Activity size={20} />
          </div>
          <div>
            <div className="erp-kpi-val">{runningProjectsCount}</div>
            <div className="erp-kpi-lbl">Running Projects</div>
          </div>
        </div>

        {/* KPI 3: Today's Labour */}
        <div className="erp-kpi-compact">
          <div className="erp-kpi-icon-box erp-kpi-icon-slate">
            <Users size={20} />
          </div>
          <div>
            <div className="erp-kpi-val">{metrics.activeWorkers}</div>
            <div className="erp-kpi-lbl">Today's Labour</div>
          </div>
        </div>

        {/* KPI 4: Today's Expense */}
        <div className="erp-kpi-compact">
          <div className="erp-kpi-icon-box erp-kpi-icon-orange">
            <DollarSign size={20} />
          </div>
          <div>
            <div className="erp-kpi-val">₹{todayExpensesSum.toLocaleString()}</div>
            <div className="erp-kpi-lbl">Today's Expense</div>
          </div>
        </div>

        {/* KPI 5: Total Engineers */}
        <div className="erp-kpi-compact">
          <div className="erp-kpi-icon-box erp-kpi-icon-green">
            <HardHat size={20} />
          </div>
          <div>
            <div className="erp-kpi-val">{engineers.length}</div>
            <div className="erp-kpi-lbl">Total Engineers</div>
          </div>
        </div>

        {/* KPI 6: Monthly Completed Projects */}
        <div className="erp-kpi-compact">
          <div className="erp-kpi-icon-box erp-kpi-icon-slate">
            <TrendingUp size={20} />
          </div>
          <div>
            <div className="erp-kpi-val">{completedProjectsCount}</div>
            <div className="erp-kpi-lbl">Completed Projects</div>
          </div>
        </div>

      </div>

      {/* ── 2. SECOND ROW: CONSTRUCTION STATUS & EXPENSE OVERVIEW CHART ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        
        {/* CONSTRUCTION STATUS CARD */}
        <div style={{ background: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Building2 size={16} style={{ color: "var(--brand-orange)" }} />
              Construction Site Status
            </h3>
            <span style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: "600" }}>Total Sites: {sites.length}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr 1fr", gap: "10px" }}>
            <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "12px 10px", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#16a34a" }}>{runningProjectsCount}</div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#15803d", marginTop: "2px" }}>Running</div>
            </div>
            <div style={{ backgroundColor: "#fff7ed", border: "1px solid #ffedd5", padding: "12px 10px", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#ea580c" }}>{completedProjectsCount}</div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#c2410c", marginTop: "2px" }}>Completed</div>
            </div>
            <div style={{ backgroundColor: "#fef3c7", border: "1px solid #fde68a", padding: "12px 10px", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#b45309" }}>{onHoldProjectsCount}</div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#92400e", marginTop: "2px" }}>On Hold</div>
            </div>
            <div style={{ backgroundColor: "#fef2f2", border: "1px solid #fecaca", padding: "12px 10px", borderRadius: "8px", textAlign: "center" }}>
              <div style={{ fontSize: "18px", fontWeight: "800", color: "#ef4444" }}>{delayedProjectsCount}</div>
              <div style={{ fontSize: "11px", fontWeight: "700", color: "#991b1b", marginTop: "2px" }}>Delayed</div>
            </div>
          </div>
        </div>

        {/* COMPACT EXPENSE OVERVIEW CHART */}
        <div style={{ background: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "6px" }}>
              <DollarSign size={16} style={{ color: "var(--brand-orange)" }} />
              Expense Overview
            </h3>
            <span style={{ fontSize: "11px", color: "var(--primary-600)", fontWeight: "600" }}>Total Logged: ₹{totalExpenseAllTime.toLocaleString()}</span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {Object.entries(expenseCategoryBreakdown).map(([catName, amount]) => {
              const pct = totalExpenseAllTime > 0 ? Math.round((amount / totalExpenseAllTime) * 100) : 0;
              return (
                <div key={catName}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", marginBottom: "3px" }}>
                    <span style={{ fontWeight: "600", color: "var(--primary-800)" }}>{catName}</span>
                    <span style={{ fontWeight: "700", color: "var(--primary-950)" }}>₹{amount.toLocaleString()} ({pct}%)</span>
                  </div>
                  <div style={{ height: "6px", backgroundColor: "#e2e8f0", borderRadius: "100px", overflow: "hidden" }}>
                    <div style={{ 
                      width: `${Math.max(5, pct)}%`, 
                      height: "100%", 
                      backgroundColor: catName === "Material" ? "#f97316" : catName === "Labour" ? "#ea580c" : catName === "Fuel & Equipment" ? "#16a34a" : "#64748b" 
                    }} />
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>

      {/* ── 4. THIRD ROW: ACTIVE PROJECTS TABLE + UPCOMING DEADLINES ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 340px", gap: "20px", alignItems: "start" }}>
        
        {/* ACTIVE PROJECTS TABLE (COLUMNS: Site Name, Engineer, Progress, Workers, Today's Expense, Status, View) */}
        <div className="erp-data-table-container" style={{ marginBottom: 0 }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Active Projects Overview</h3>
              <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--primary-600)" }}>Detailed site progress, supervision, and daily costs</p>
            </div>
            <Link to="/admin/sites" style={{ fontSize: "12px", fontWeight: "700", color: "var(--brand-orange)", textDecoration: "none" }}>
              View All ({sites.length}) →
            </Link>
          </div>

          <table className="erp-table">
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Engineer</th>
                <th>Progress</th>
                <th>Workers</th>
                <th>Today's Expense</th>
                <th>Status</th>
                <th style={{ textAlign: "right" }}>View</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 ? (
                <tr>
                  <td colSpan="7">
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
                  
                  // Engineer name lookup
                  const assignedEngNames = (site.assignedEngineers || []).map(uid => {
                    const e = engineers.find(eng => eng.id === uid);
                    return e ? e.fullName : "Engineer";
                  });

                  // Calculate site's today expense
                  const todayStr = new Date().toISOString().split("T")[0];
                  const siteExpenseToday = rawExpenses
                    .filter(e => e.siteId === site.id && (e.date === todayStr || (e.createdAt?.seconds && new Date(e.createdAt.seconds * 1000).toISOString().split("T")[0] === todayStr)))
                    .reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

                  // Count workers at this site today
                  const siteWorkerCount = rawAttendanceToday.filter(a => a.siteId === site.id).length;

                  return (
                    <tr key={site.id}>
                      <td>
                        <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block" }}>{site.siteName}</strong>
                        <span style={{ fontSize: "11px", color: "var(--primary-600)" }}>{site.clientName || site.location || "Site Project"}</span>
                      </td>
                      <td>
                        {assignedEngNames.length > 0 ? (
                          <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                            {assignedEngNames.map((name, idx) => (
                              <span key={idx} style={{ fontSize: "10.5px", fontWeight: "700", backgroundColor: "#f1f5f9", color: "var(--primary-800)", padding: "2px 6px", borderRadius: "4px" }}>{name}</span>
                            ))}
                          </div>
                        ) : (
                          <span style={{ fontSize: "11px", color: "#94a3b8", fontStyle: "italic" }}>Unassigned</span>
                        )}
                      </td>
                      <td style={{ width: "120px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <div style={{ flex: 1, height: "6px", backgroundColor: "#e2e8f0", borderRadius: "100px", overflow: "hidden" }}>
                            <div style={{ width: `${progVal}%`, height: "100%", backgroundColor: progVal >= 80 ? "#16a34a" : (progVal >= 40 ? "#f97316" : "#ea580c") }} />
                          </div>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-950)", minWidth: "26px" }}>{progVal}%</span>
                        </div>
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--primary-800)", fontWeight: "600" }}>
                        {siteWorkerCount > 0 ? `${siteWorkerCount} Active` : "--"}
                      </td>
                      <td style={{ fontSize: "12px", color: "var(--primary-950)", fontWeight: "700", fontFamily: "monospace" }}>
                        {siteExpenseToday > 0 ? `₹${siteExpenseToday.toLocaleString()}` : "₹0"}
                      </td>
                      <td>
                        <Badge status={site.status || "active"} />
                      </td>
                      <td style={{ textAlign: "right" }}>
                        <Link to="/admin/sites" className="erp-btn-secondary" style={{ padding: "4px 10px", fontSize: "11px" }}>
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

        {/* UPCOMING DEADLINES CARD */}
        <div style={{ background: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "12px", padding: "18px", boxShadow: "0 1px 3px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "6px" }}>
              <Calendar size={16} style={{ color: "var(--brand-orange)" }} />
              Upcoming Deadlines
            </h3>
            <span style={{ fontSize: "11px", fontWeight: "800", backgroundColor: "#fff7ed", color: "#f97316", padding: "2px 8px", borderRadius: "100px" }}>
              Schedule
            </span>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {upcomingDeadlines.length === 0 ? (
              <div style={{ textAlign: "center", padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--primary-600)" }}>No deadlines configured.</p>
              </div>
            ) : (
              upcomingDeadlines.map(site => (
                <div key={site.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 12px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <div>
                    <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>{site.siteName}</strong>
                    <span style={{ fontSize: "11px", color: "var(--primary-600)" }}>Client: {site.clientName || "Internal"}</span>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#c2410c", display: "block", fontFamily: "monospace" }}>
                      {site.expectedEndDate || site.startDate || "TBD"}
                    </span>
                    <Badge status={site.status || "active"} style={{ fontSize: "10px", padding: "1px 5px" }} />
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

      </div>

      <Loading show={loading} text="Loading Construction ERP..." />
    </Layout>
  );
}


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
  FileText
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

  const groupedTimeline = {};
  combinedTimeline.forEach(log => {
    const d = log.date || "Unknown Date";
    if (!groupedTimeline[d]) {
      groupedTimeline[d] = [];
    }
    groupedTimeline[d].push(log);
  });
  
  const sortedDates = Object.keys(groupedTimeline).sort((a, b) => b.localeCompare(a));

  const recentDocs = [...documents]
    .sort((a, b) => {
      const tA = a.uploadedAt?.seconds || (a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0);
      const tB = b.uploadedAt?.seconds || (b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0);
      return tB - tA;
    })
    .slice(0, 5);

  return (
    <Layout 
      title="ERP Control Center" 
      description="Enterprise civil construction intelligence console. Real-time scheduling, personnel deployment and capital utilization analytics."
    >
      {/* Dynamic inline variables & styling overrides for a premium dark-slate / warm accent theme */}
      <style>{`
        .erp-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
          gap: 16px;
          margin-bottom: 24px;
        }
        
        .erp-kpi-card {
          background: #ffffff;
          border: 1px solid var(--border-color, #e2e8f0);
          border-radius: 12px;
          padding: 18px 20px;
          display: flex;
          align-items: center;
          gap: 16px;
          box-shadow: 0 4px 6px -1px rgba(0,0,0,0.02), 0 2px 4px -2px rgba(0,0,0,0.02);
          transition: all 0.2s ease;
          position: relative;
          overflow: hidden;
        }

        .erp-kpi-card::after {
          content: '';
          position: absolute;
          left: 0;
          top: 0;
          bottom: 0;
          width: 3px;
          background: transparent;
          transition: background 0.2s ease;
        }

        .erp-kpi-card:hover::after {
          background: var(--primary-600, #3b82f6);
        }
        
        .erp-kpi-icon {
          width: 44px;
          height: 44px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        
        .erp-kpi-content {
          display: flex;
          flex-direction: column;
          min-width: 0;
          flex: 1;
        }
        
        .erp-kpi-num {
          font-size: 24px;
          font-weight: 800;
          color: var(--primary-900, #0f172a);
          line-height: 1;
          font-family: var(--font-family-title, sans-serif);
          margin-bottom: 4px;
        }
        
        .erp-kpi-label {
          font-size: 11px;
          font-weight: 700;
          color: var(--text-muted, #64748b);
          text-transform: uppercase;
          letter-spacing: 0.5px;
          margin-bottom: 2px;
        }
        
        .erp-kpi-footer {
          font-size: 11px;
          color: var(--text-muted, #64748b);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        .erp-card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          font-family: var(--font-family-title, sans-serif);
        }

        .erp-card-title {
          font-size: 14px;
          font-weight: 800;
          color: var(--primary-950, #030712);
          display: flex;
          align-items: center;
          gap: 8px;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }

        .erp-table-container {
          overflow-x: auto;
          position: relative;
        }

        .erp-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 12.5px;
          text-align: left;
        }

        .erp-table th {
          position: sticky;
          top: 0;
          background: #f8fafc !important;
          z-index: 10;
          color: var(--primary-700, #475569);
          font-weight: 700;
          padding: 12px 16px;
          border-bottom: 1.5px solid var(--border-color, #e2e8f0);
          text-transform: uppercase;
          font-size: 10.5px;
          letter-spacing: 0.5px;
        }

        .erp-table td {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #e2e8f0);
          color: #334155;
          vertical-align: middle;
        }

        .erp-table tbody tr {
          transition: background-color 0.15s ease;
        }

        .erp-table tbody tr:hover {
          background-color: #f8fafc;
        }

        .erp-badge-container {
          display: flex;
          flex-wrap: wrap;
          gap: 4px;
        }

        .erp-badge-eng {
          font-size: 10px;
          padding: 2.5px 6.5px;
          font-weight: 700;
          background-color: #f1f5f9;
          color: #334155;
          border-radius: 4px;
          border: 1px solid #e2e8f0;
        }

        .erp-utilization-bar-wrapper {
          display: flex;
          flex-direction: column;
          gap: 4px;
          width: 120px;
        }

        .erp-utilization-metrics {
          display: flex;
          justify-content: space-between;
          font-size: 10.5px;
          font-weight: 700;
        }

        .erp-utilization-track {
          width: 100%;
          height: 6px;
          background-color: #f1f5f9;
          border-radius: 3px;
          overflow: hidden;
          border: 1px solid #cbd5e1;
        }

        .erp-alert-item {
          display: flex;
          gap: 10px;
          padding: 10px 12px;
          border-radius: 8px;
          border-left: 3px solid transparent;
          background-color: #f8fafc;
          font-size: 12px;
        }

        .erp-alert-item.danger {
          border-left-color: var(--danger-500, #ef4444);
          background-color: #fef2f2;
        }

        .erp-alert-item.warning {
          border-left-color: var(--warning-500, #f59e0b);
          background-color: #fffbeb;
        }

        .erp-grid-layout {
          display: grid;
          grid-template-columns: 2.2fr 1fr;
          gap: 20px;
          margin-bottom: 24px;
        }

        @media (max-width: 1024px) {
          .erp-grid-layout {
            grid-template-columns: 1fr;
          }
        }
      `}</style>

      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {sites.length === 0 && (
        <div style={{ borderLeft: "4px solid var(--warning-500)", backgroundColor: "#fffbeb", marginBottom: "20px", padding: "12px 16px", borderRadius: "8px", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={16} style={{ color: "var(--warning-600)", flexShrink: 0 }} />
          <span style={{ color: "var(--warning-700)", fontWeight: "600", fontSize: "13px" }}>
            <strong>Workspace Setup Required:</strong> You do not have any registered sites yet. Go to <Link to="/admin/sites" style={{ color: "var(--warning-800)", fontWeight: "700", textDecoration: "underline" }}>Sites Panel</Link> to create your first site profile.
          </span>
        </div>
      )}

      {/* ── ERP COMPACT KPI METRICS GRID ── */}
      <div className="erp-kpi-grid">
        
        {/* KPI 1: Project Sites */}
        <div className="erp-kpi-card" style={{ borderLeft: "4px solid #3b82f6" }}>
          <div className="erp-kpi-icon" style={{ backgroundColor: "rgba(59,130,246,0.08)", color: "#3b82f6" }}>
            <Building2 size={22} />
          </div>
          <div className="erp-kpi-content">
            <span className="erp-kpi-label">Active Projects</span>
            <span className="erp-kpi-num">{sites.length}</span>
            <span className="erp-kpi-footer">{totalAssignedProjects} actively assigned</span>
          </div>
        </div>

        {/* KPI 2: Site Engineers */}
        <div className="erp-kpi-card" style={{ borderLeft: "4px solid #10b981" }}>
          <div className="erp-kpi-icon" style={{ backgroundColor: "rgba(16,185,129,0.08)", color: "#10b981" }}>
            <HardHat size={22} />
          </div>
          <div className="erp-kpi-content">
            <span className="erp-kpi-label">Personnel Logs</span>
            <span className="erp-kpi-num">{engineers.filter(e => e.status === "active").length}</span>
            <span className="erp-kpi-footer">{engineers.length} registered engineers</span>
          </div>
        </div>

        {/* KPI 3: Labor Force Deployments */}
        <div className="erp-kpi-card" style={{ borderLeft: "4px solid #f59e0b" }}>
          <div className="erp-kpi-icon" style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#f59e0b" }}>
            <Users size={22} />
          </div>
          <div className="erp-kpi-content">
            <span className="erp-kpi-label">Labor Force deployment</span>
            <span className="erp-kpi-num">{metrics.activeWorkers}</span>
            <span className="erp-kpi-footer">{metrics.attendanceToday} check-ins logged today</span>
          </div>
        </div>

        {/* KPI 4: Pending Requisitions */}
        <div className="erp-kpi-card" style={{ 
          borderLeft: "4px solid #f43f5e",
          backgroundColor: pendingCount > 0 ? "rgba(244,63,94,0.02)" : undefined
        }}>
          <div className="erp-kpi-icon" style={{ 
            backgroundColor: pendingCount > 0 ? "rgba(244,63,94,0.08)" : "rgba(100,116,139,0.08)", 
            color: pendingCount > 0 ? "#f43f5e" : "#64748b" 
          }}>
            <ClipboardCheck size={22} />
          </div>
          <div className="erp-kpi-content">
            <span className="erp-kpi-label">Task Requisitions</span>
            <span className="erp-kpi-num" style={{ color: pendingCount > 0 ? "#f43f5e" : undefined }}>{pendingCount}</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span className="erp-kpi-footer">Awaiting authorization</span>
              {pendingCount > 0 && (
                <Link to="/admin/approvals" style={{ fontSize: "10.5px", fontWeight: "800", color: "#f43f5e", display: "flex", alignItems: "center", gap: "2px", textDecoration: "none" }}>
                  Action <ChevronRight size={10} />
                </Link>
              )}
            </div>
          </div>
        </div>

      </div>

      {/* ── MAIN ERP TWO-COLUMN LAYOUT ── */}
      <div className="erp-grid-layout">
        
        {/* Left Column — Corporate Sites Portfolio */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          <Card variant="table" style={{ borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div className="erp-card-header">
              <span className="erp-card-title">
                <Briefcase size={16} style={{ color: "var(--primary-600)" }} />
                Corporate Site Portfolio
              </span>
              <Badge status="success">{sites.length} Active Sites</Badge>
            </div>
            
            <div className="erp-table-container">
              <table className="erp-table">
                <thead>
                  <tr>
                    <th>Site Profile</th>
                    <th>Supervisor Engineer</th>
                    <th>Site Location</th>
                    <th style={{ textAlign: "right" }}>Financial Allocation</th>
                    <th>Status</th>
                    <th>Created</th>
                  </tr>
                </thead>
                <tbody>
                  {sites.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                        No project profiles registered in the system portfolio.
                      </td>
                    </tr>
                  ) : (
                    sites.map((site) => {
                      const createdDateStr = site.createdAt
                        ? (site.createdAt.seconds
                            ? new Date(site.createdAt.seconds * 1000).toLocaleDateString("en-GB")
                            : new Date(site.createdAt).toLocaleDateString("en-GB"))
                        : "N/A";
                      
                      return (
                        <tr key={site.id}>
                          <td style={{ fontWeight: 800, color: "var(--primary-900)" }}>
                            {site.siteName}
                          </td>
                          <td>
                            {site.assignedEngineers && site.assignedEngineers.length > 0 ? (
                              <div className="erp-badge-container">
                                {site.assignedEngineers.map(uid => {
                                  const name = engineersMap[uid] || "Unknown Engineer";
                                  return (
                                    <span key={uid} className="erp-badge-eng">
                                      {name}
                                    </span>
                                  );
                                })}
                              </div>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "11.5px", fontStyle: "italic" }}>
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                              <MapPin size={12} style={{ color: "var(--text-muted)" }} />
                              <span style={{ fontSize: "12px" }}>{site.location}</span>
                            </div>
                          </td>
                          <td>
                            {(() => {
                              const budget = site.budget !== undefined && site.budget !== null ? Number(site.budget) : 0;
                              const siteExpenses = rawExpenses.filter(e => e.siteId === site.id && (e.status === "Approved" || e.status === "approved"));
                              const totalExpense = siteExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                              const utilization = budget > 0 ? (totalExpense / budget) * 100 : 0;
                              
                              return (
                                <div className="erp-utilization-bar-wrapper" style={{ marginLeft: "auto" }}>
                                  <div className="erp-utilization-metrics">
                                    <span style={{ fontFamily: "monospace", color: "var(--primary-900)" }}>₹{totalExpense.toLocaleString()}</span>
                                    <span style={{ 
                                      color: utilization > 100 ? "var(--danger-700)" : (utilization > 80 ? "var(--warning-700)" : "var(--success-700)")
                                    }}>
                                      {utilization.toFixed(0)}%
                                    </span>
                                  </div>
                                  <div className="erp-utilization-track">
                                    <div style={{
                                      width: `${Math.min(utilization, 100)}%`,
                                      height: "100%",
                                      backgroundColor: utilization > 100 ? "#b3261e" : (utilization > 80 ? "#e65100" : "#2e7d32")
                                    }} />
                                  </div>
                                </div>
                              );
                            })()}
                          </td>
                          <td>
                            <Badge status={site.status || "Planning"} />
                          </td>
                          <td className="font-mono" style={{ fontSize: "11px" }}>{createdDateStr}</td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </Card>
        </div>

        {/* Right Column — Operational Tasks & Warning Alerts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          
          {/* ERP Alarm Warnings */}
          {alerts.length > 0 && (
            <Card style={{ padding: "0 0 16px 0", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
              <div className="erp-card-header" style={{ borderBottom: "none" }}>
                <span className="erp-card-title" style={{ color: "var(--danger-600)" }}>
                  <AlertTriangle size={16} />
                  Operational Flags
                </span>
                <span style={{ 
                  fontSize: "10px", 
                  fontWeight: "800", 
                  backgroundColor: "rgba(239,68,68,0.1)", 
                  color: "var(--danger-600)", 
                  padding: "2px 8px", 
                  borderRadius: "10px" 
                }}>
                  {alerts.length} Warnings
                </span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "0 16px" }}>
                {alerts.slice(0, 4).map(alert => (
                  <div key={alert.id} className={`erp-alert-item ${alert.type}`}>
                    <AlertTriangle 
                      size={15} 
                      style={{ 
                        color: alert.type === "danger" ? "var(--danger-600)" : "var(--warning-600)", 
                        flexShrink: 0,
                        marginTop: "1px"
                      }} 
                    />
                    <div>
                      <strong style={{ fontSize: "11px", display: "block", color: "var(--primary-900)" }}>{alert.category} • {alert.title}</strong>
                      <p style={{ margin: "2px 0 0 0", color: "var(--primary-700)", fontSize: "11.5px", lineHeight: "1.3" }}>{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {/* Document Verification Action Card */}
          <Card style={{ borderRadius: "12px", border: "1px solid var(--border-color)", padding: "16px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <span style={{ fontSize: "12.5px", fontWeight: "800", color: "var(--primary-950)", textTransform: "uppercase", letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: "6px" }}>
                <FolderOpen size={15} style={{ color: "var(--primary-600)" }} />
                Document Verification
              </span>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "8px", 
                padding: "8px 12px", 
                backgroundColor: pendingDocs.length > 0 ? "rgba(245,158,11,0.06)" : "rgba(16,185,129,0.06)", 
                borderRadius: "6px", 
                border: `1px solid ${pendingDocs.length > 0 ? "rgba(245,158,11,0.2)" : "rgba(16,185,129,0.2)"}` 
              }}>
                {pendingDocs.length > 0 ? (
                  <>
                    <AlertTriangle size={15} style={{ color: "var(--warning-600)" }} />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--warning-700)" }}>
                      {pendingDocs.length} site documentation logs pending
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} style={{ color: "var(--success-600)" }} />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--success-700)" }}>
                      All system documentation verified
                    </span>
                  </>
                )}
              </div>

              {pendingDocs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {pendingDocs.slice(0, 2).map(doc => (
                    <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", backgroundColor: "#ffffff" }}>
                      <div style={{ minWidth: 0, marginRight: "8px" }}>
                        <div style={{ fontSize: "12px", fontWeight: "800", color: "var(--primary-900)" }} className="text-ellipsis">{doc.title}</div>
                        <p style={{ margin: 0, fontSize: "10.5px", color: "var(--text-muted)" }} className="text-ellipsis">{doc.siteName}</p>
                      </div>
                      <Link to="/admin/documents" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", textDecoration: "none" }}>
                        Verify →
                      </Link>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </Card>

          {/* Recent uploads catalog */}
          <Card style={{ borderRadius: "12px", border: "1px solid var(--border-color)" }}>
            <div className="erp-card-header">
              <span className="erp-card-title">
                <FileText size={16} style={{ color: "var(--primary-600)" }} />
                Recent Uploads
              </span>
              <Link to="/admin/documents" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", textDecoration: "none" }}>
                All Logs
              </Link>
            </div>
            
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px 20px" }}>
              {recentDocs.length === 0 ? (
                <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "10px", fontSize: "12px" }}>No document streams uploaded yet.</p>
              ) : (
                recentDocs.slice(0, 3).map(doc => {
                  const isUploaded = doc.status === "Uploaded";
                  const isVerified = doc.status === "Verified";
                  return (
                    <div key={doc.id} style={{ display: "flex", gap: "10px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
                      <div style={{
                        backgroundColor: isVerified ? "rgba(16,185,129,0.06)" : (isUploaded ? "rgba(59,130,246,0.06)" : "rgba(239,68,68,0.06)"),
                        color: isVerified ? "#10b981" : (isUploaded ? "#3b82f6" : "#ef4444"),
                        padding: "6px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "28px",
                        width: "28px",
                        flexShrink: 0
                      }}>
                        <FolderOpen size={14} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "1px", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)" }} className="text-ellipsis">{doc.title}</span>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{doc.category} • {doc.siteName}</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
                          <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>Uploaded by: {doc.uploadedBy}</span>
                          <Badge status={doc.status === "Uploaded" ? "pending" : (doc.status === "Verified" ? "success" : "danger")} style={{ fontSize: "8.5px", padding: "0 6px" }}>
                            {doc.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>

        </div>
      </div>

      {/* ── BOTTOM: Operations Chronological Timeline ── */}
      <Card style={{ borderRadius: "12px", border: "1px solid var(--border-color)" }}>
        
        <div className="erp-card-header" style={{ borderBottom: "none", paddingBottom: "0" }}>
          <span className="erp-card-title">
            <Activity size={16} style={{ color: "var(--primary-600)" }} />
            Site Operations &amp; Event Stream
          </span>
        </div>

        {/* Compact Filters panel */}
        <div style={{ 
          display: "flex", 
          flexWrap: "wrap",
          gap: "10px", 
          margin: "16px 20px",
          alignItems: "center",
          padding: "8px 12px",
          backgroundColor: "#f8fafc",
          borderRadius: "8px",
          border: "1px solid var(--border-color)"
        }}>
          <Filter size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          
          <select 
            value={filterSite} 
            onChange={(e) => setFilterSite(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "12px", flex: "1 1 150px" }}
          >
            <option value="">All Project Sites</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.siteName}</option>
            ))}
          </select>

          <select 
            value={filterEngineer} 
            onChange={(e) => setFilterEngineer(e.target.value)}
            style={{ padding: "6px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "12px", flex: "1 1 150px" }}
          >
            <option value="">All Engineers</option>
            {engineers.map(e => (
              <option key={e.id} value={e.id}>{e.fullName}</option>
            ))}
          </select>

          <input 
            type="date"
            value={filterDate}
            onChange={(e) => setFilterDate(e.target.value)}
            style={{ padding: "5px 8px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "12px", flex: "1 1 130px" }}
          />

          {(filterSite || filterEngineer || filterDate) && (
            <button 
              type="button"
              onClick={() => { setFilterSite(""); setFilterEngineer(""); setFilterDate(""); }}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "11.5px", fontWeight: "700", color: "var(--text-muted)", cursor: "pointer" }}
            >
              Reset Filters
            </button>
          )}
        </div>

        <div style={{ padding: "0 20px 20px 20px" }}>
          {sortedDates.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px 0" }}>
              <Activity size={24} style={{ color: "var(--primary-300)", marginBottom: "6px" }} />
              <p style={{ fontSize: "12.5px" }}>No operations logs matching selected parameter scope.</p>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {sortedDates.map((dateStr) => {
                let formattedDate = dateStr;
                try {
                  const [y, m, d] = dateStr.split("-").map(Number);
                  const dateObj = new Date(y, m - 1, d);
                  formattedDate = dateObj.toLocaleDateString("en-GB", {
                    day: "numeric",
                    month: "long",
                    year: "numeric"
                  });
                } catch (e) {
                  console.error(e);
                }

                const logsForDate = groupedTimeline[dateStr];

                return (
                  <div key={dateStr} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    
                    {/* Date subtitle header */}
                    <div style={{ 
                      fontSize: "11.5px", 
                      fontWeight: "800", 
                      color: "var(--primary-800)", 
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      paddingBottom: "4px",
                      borderBottom: "1px solid #f1f5f9"
                    }}>
                      <Calendar size={12} style={{ color: "var(--primary-500)" }} />
                      {formattedDate}
                      <span style={{ marginLeft: "auto", fontSize: "10px", fontWeight: "700", color: "var(--text-muted)" }}>
                        {logsForDate.length} Logged Action(s)
                      </span>
                    </div>
                    
                    {/* Timeline elements */}
                    <div style={{ 
                      position: "relative", 
                      paddingLeft: "16px", 
                      borderLeft: "1.5px solid #e2e8f0",
                      marginLeft: "6px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px"
                    }}>
                      {logsForDate.map((log, index) => {
                        const isEntry = log.type === "entry";
                        const isExit = log.type === "exit";

                        const dotColor = isEntry ? "var(--success-500)" : (isExit ? "var(--danger-500)" : "var(--primary-500)");
                        const tagBg = isEntry ? "var(--success-50)" : (isExit ? "var(--danger-50)" : "var(--primary-50)");
                        const tagColor = isEntry ? "var(--success-600)" : (isExit ? "var(--danger-600)" : "var(--primary-600)");

                        return (
                          <div key={log.id || index} style={{ position: "relative" }}>
                            <div style={{ 
                              position: "absolute", 
                              left: "-22px", 
                              top: "6px", 
                              width: "8px", 
                              height: "8px", 
                              borderRadius: "50%", 
                              backgroundColor: dotColor,
                              border: "1.5px solid #ffffff",
                              boxShadow: `0 0 0 1.5px ${dotColor}33`
                            }} />
                            
                            <div style={{ 
                              display: "flex", 
                              justifyContent: "space-between",
                              alignItems: "center",
                              gap: "8px",
                              padding: "8px 12px",
                              borderRadius: "8px",
                              border: "1px solid var(--border-color)",
                              backgroundColor: "#ffffff"
                            }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ 
                                    fontWeight: "800", 
                                    fontSize: "9px", 
                                    color: tagColor,
                                    backgroundColor: tagBg,
                                    padding: "0.5px 6px",
                                    borderRadius: "8px",
                                    textTransform: "uppercase"
                                  }}>
                                    {log.type}
                                  </span>
                                  <strong style={{ fontSize: "12px", color: "var(--primary-900)" }}>{log.engineerName}</strong>
                                </div>
                                <span style={{ fontSize: "12px", color: "#334155" }}>{log.description}</span>
                                <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{log.details} • Site: {log.siteName}</span>
                              </div>
                              <span style={{ fontSize: "10.5px", fontWeight: "700", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "2.5px", flexShrink: 0 }}>
                                <Clock size={11} /> {log.time}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>

                  </div>
                );
              })}
            </div>
          )}
        </div>

      </Card>

      <Loading show={loading} text="Loading ERP dashboard..." />
    </Layout>
  );
}

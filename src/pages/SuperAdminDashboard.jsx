import React, { useState, useEffect } from "react";
import { onSnapshot, collection, query, where, doc } from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getSiteEngineers,
  getMaterialsDetailed,
  getLabourDailyCountsSummary,
  getAllLeaves,
  approveLeave,
  rejectLeave,
  approveSiteLocation,
  rejectSiteLocation,
  approveMaterialLog,
  rejectMaterialLog,
  getDailyUpdatesForSite,
  getLabourMaster,
  getGeneralExpenses,
  getLabourPayments,
  getSystemActivities,
  getCentralApprovals,
  resolveApprovalRequest,
  getAllDocuments
} from "../services/firebaseService";
import {
  calculatePlannedProgress,
  getSiteFinancials,
  calculateOverallFinancials,
  isSiteDelayed,
  normalizeApprovalRequest
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
  TrendingDown,
  Clock
} from "lucide-react";
import { Link } from "react-router-dom";

export default function SuperAdminDashboard({ tab = "dashboard" }) {
  const { userProfile } = useAuth();
  const [loading, setLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Datasets
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [leaves, setLeaves] = useState([]);

  const [allDprs, setAllDprs] = useState([]);
  const [labourMaster, setLabourMaster] = useState({ categories: {}, history: [] });
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [labourPayments, setLabourPayments] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [documents, setDocuments] = useState([]);
  
  // Specific views state
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [laborHistoryMap, setLaborHistoryMap] = useState({});
  const [showAllAlerts, setShowAllAlerts] = useState(false);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
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
      if (list.length > 0) {
        setSelectedSiteId(prev => prev || list[0].id);
      }
      setLoading(false);
    }, (err) => {
      console.error("Sites listener error:", err);
      setLoading(false);
    });

    // 2. Engineers Listener
    const unsubEngineers = onSnapshot(collection(db, "siteEngineers"), (snapshot) => {
      if (snapshot.empty) {
        // fallback
        const q = query(collection(db, "users"), where("role", "==", "site_engineer"));
        onSnapshot(q, (snap) => {
          const list = [];
          snap.forEach(d => {
            list.push({ id: d.id, uid: d.id, fullName: d.data().name || d.data().fullName || "", ...d.data() });
          });
          setEngineers(list);
        });
        return;
      }
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, uid: docSnap.id, fullName: docSnap.data().name || docSnap.data().fullName || "", ...docSnap.data() });
      });
      setEngineers(list);
    }, (err) => {
      // fallback
      const q = query(collection(db, "users"), where("role", "==", "site_engineer"));
      onSnapshot(q, (snap) => {
        const list = [];
        snap.forEach(d => {
          list.push({ id: d.id, uid: d.id, fullName: d.data().name || d.data().fullName || "", ...d.data() });
        });
        setEngineers(list);
      });
    });

    // 3. Materials Listener
    const unsubMaterials = onSnapshot(collection(db, "materials"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setMaterials(list);
    });

    // 4. Reports (DPRs) Listener
    const unsubReports = onSnapshot(collection(db, "reports"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setAllDprs(list);
    });

    // 5. Labour Daily Counts Listener
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

    // 6. Approvals Listener
    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setApprovals(list);
    });

    // 7. Documents Listener
    const unsubDocs = onSnapshot(collection(db, "documents"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setDocuments(list);
    });

    // 8. General Expenses Listener
    const unsubExpenses = onSnapshot(doc(db, "expenses", "general"), (snapshot) => {
      if (snapshot.exists()) {
        setGeneralExpenses(snapshot.data().expenses || []);
      } else {
        setGeneralExpenses([]);
      }
    }, (err) => {
      console.error("Expenses super admin listener error:", err);
    });

    // Central load for static / metadata entities
    const loadStaticData = async () => {
      try {
        const [fetchedLeaves, fetchedLabourMaster, fetchedLabourPayments, fetchedSysActivities] = await Promise.all([
          getAllLeaves(),
          getLabourMaster(),
          getLabourPayments(),
          getSystemActivities()
        ]);
        setLeaves(fetchedLeaves);
        setLabourMaster(fetchedLabourMaster);
        setLabourPayments(fetchedLabourPayments);
        setSystemActivities(fetchedSysActivities);
      } catch (err) {
        console.error("Static data load error:", err);
      }
    };
    loadStaticData();

    return () => {
      unsubSites();
      unsubEngineers();
      unsubMaterials();
      unsubReports();
      unsubLabour();
      unsubApprovals();
      unsubDocs();
      unsubExpenses();
    };
  }, []);

  if (loading) {
    return (
      <Layout title="Super Admin console" description="Synchronizing master corporate tables...">
        <Loading show={true} text="Initializing Management dashboard..." />
      </Layout>
    );
  }

  // Pre-calculate financial logs
  const flatLaborHistory = [];
  Object.keys(laborHistoryMap).forEach(siteId => {
    laborHistoryMap[siteId].forEach(l => {
      flatLaborHistory.push({ ...l, siteId });
    });
  });

  const overallMetrics = calculateOverallFinancials(sites, materials, flatLaborHistory, allDprs, labourMaster.categories, generalExpenses, labourPayments);
  
  // Format currency helpers
  const formatINR = (val) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0
    }).format(val);
  };

  // Helper to map engineers map
  const engineersMap = {};
  engineers.forEach(e => {
    engineersMap[e.id] = e.fullName;
  });

  // Approvals workflow mappings
  const allApprovalRequests = approvals
    .filter(r => (r.status || "").toLowerCase() === "pending")
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
    .sort((a, b) => b.requestDate.localeCompare(a.requestDate));

  const handleApproveRequest = async (req) => {
    if (!window.confirm(`Approve this ${req.type} request?`)) return;
    setDataLoading(true);
    try {
      await resolveApprovalRequest(req.id, "Approved", userProfile?.id || "admin", userProfile?.fullName || "Admin User");
      showToast(`${req.type} request approved successfully.`, "success");
      await loadData();
    } catch (err) {
      console.error("Approve failed:", err);
      showToast(`Approval failed: ${err.message}`, "error");
    } finally {
      setDataLoading(false);
    }
  };

  const handleRejectRequest = async (req) => {
    if (!window.confirm(`Reject this ${req.type} request?`)) return;
    setDataLoading(true);
    try {
      await resolveApprovalRequest(req.id, "Rejected", userProfile?.id || "admin", userProfile?.fullName || "Admin User");
      showToast(`${req.type} request rejected.`, "info");
      await loadData();
    } catch (err) {
      console.error("Reject failed:", err);
      showToast(`Rejection failed: ${err.message}`, "error");
    } finally {
      setDataLoading(false);
    }
  };

  // Render sub-view handlers
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
      if (site.status === 'Delayed' || site.isSiteDelayed) {
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

    if (pendingDocs.length > 0) {
      alerts.push({
        id: 'alert_sa_pending_docs',
        type: 'warning',
        category: 'Documents Alert',
        title: 'Pending Document Verification',
        message: `There are ${pendingDocs.length} uploaded project document(s) waiting for verification.`
      });
    }

    const mappedSys = systemActivities.map(s => ({
      id: s.id,
      type: s.actionType,
      engineerName: s.userName || 'System User',
      siteName: s.siteName || 'N/A',
      date: s.date,
      time: s.createdAt?.seconds 
        ? new Date(s.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: s.description,
      details: `Module: ${s.moduleType}`,
      timestamp: s.createdAt,
      isSystem: true
    }));

    const combinedTimeline = [...mappedSys]
      .sort((a, b) => {
        const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return tB - tA;
      });

    const netPosition = overallMetrics.totalPaymentsReceived - overallMetrics.totalExpenses;
    const isProfit = netPosition >= 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

        {/* ── TOP: Compact KPI Bar ── */}
        <div className="dash-kpi-bar">

          <div className="dash-kpi-item">
            <div className="dash-kpi-icon" style={{ backgroundColor: "rgba(59,130,246,0.08)", color: "#3b82f6" }}>
              <Building2 size={20} />
            </div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-label">Total Sites</span>
              <span className="dash-kpi-value">{overallMetrics.totalSites}</span>
              <span className="dash-kpi-sub">
                <span style={{ color: "var(--success-600)", fontWeight: "700" }}>{overallMetrics.activeSites} active</span>
                {" · "}
                <span style={{ color: "var(--primary-600)", fontWeight: "700" }}>{overallMetrics.completedSites} done</span>
              </span>
            </div>
          </div>

          <div className="dash-kpi-item">
            <div className="dash-kpi-icon" style={{ backgroundColor: overallMetrics.delayedSites > 0 ? "rgba(239,68,68,0.1)" : "rgba(16,185,129,0.08)", color: overallMetrics.delayedSites > 0 ? "var(--danger-600)" : "var(--success-600)" }}>
              <AlertTriangle size={20} />
            </div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-label">Schedule Delays</span>
              <span className="dash-kpi-value" style={{ color: overallMetrics.delayedSites > 0 ? "var(--danger-600)" : "var(--success-600)" }}>{overallMetrics.delayedSites}</span>
              <span className="dash-kpi-sub">{overallMetrics.delayedSites > 0 ? "Attention required" : "All on track"}</span>
            </div>
          </div>

          <div className="dash-kpi-item">
            <div className="dash-kpi-icon" style={{ backgroundColor: "rgba(16,185,129,0.08)", color: "var(--success-600)" }}>
              <TrendingUp size={20} />
            </div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-label">Payments Received</span>
              <span className="dash-kpi-value" style={{ fontSize: "18px" }}>{formatINR(overallMetrics.totalPaymentsReceived)}</span>
              <span className="dash-kpi-sub">of {formatINR(overallMetrics.totalProjectValue)} budget</span>
            </div>
          </div>

          <div className="dash-kpi-item">
            <div className="dash-kpi-icon" style={{ backgroundColor: "rgba(249,115,22,0.08)", color: "#f97316" }}>
              <DollarSign size={20} />
            </div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-label">Total Expenses</span>
              <span className="dash-kpi-value" style={{ fontSize: "18px" }}>{formatINR(overallMetrics.totalExpenses)}</span>
              <span className="dash-kpi-sub" style={{ color: "var(--warning-600)" }}>Owed: {formatINR(overallMetrics.pendingPayments)}</span>
            </div>
          </div>

          <div className={`dash-kpi-item sa-net-card ${isProfit ? "profit" : "deficit"}`}>
            <div className="dash-kpi-icon">
              {isProfit ? <TrendingUp size={20} /> : <TrendingDown size={20} />}
            </div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-label">Net Position</span>
              <span className="dash-kpi-value" style={{ fontSize: "18px" }}>
                {isProfit ? "+" : ""}{formatINR(netPosition)}
              </span>
              <span className="dash-kpi-sub">{isProfit ? "Profit margin" : "Deficit"}</span>
            </div>
          </div>

          <div className="dash-kpi-item">
            <div className="dash-kpi-icon" style={{ backgroundColor: "rgba(139,92,246,0.08)", color: "#8b5cf6" }}>
              <Layers size={20} />
            </div>
            <div className="dash-kpi-info">
              <span className="dash-kpi-label">Project Records</span>
              <span className="dash-kpi-value">{documents.length}</span>
              <Link to="/superadmin/documents" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", display: "flex", alignItems: "center", gap: "2px", textDecoration: "none" }}>
                {pendingDocs.length} pending <ArrowRight size={10} />
              </Link>
            </div>
          </div>

        </div>

        {/* ── MIDDLE: 3-Column ── */}
        <div className="sa-dashboard-main-grid">

          {/* Progress Ring */}
          <Card title="Overall Progress">
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
                  <span style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>Corp. Avg</span>
                </div>
              </div>
              <div style={{ marginTop: "16px", display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Projects</span>
                  <span style={{ fontWeight: "700" }}>{overallMetrics.totalSites} sites</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Budget</span>
                  <span style={{ fontWeight: "700" }}>{formatINR(overallMetrics.totalProjectValue)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Pending Approvals</span>
                  <span style={{ fontWeight: "700", color: allApprovalRequests.length > 0 ? "var(--warning-600)" : "var(--success-600)" }}>{allApprovalRequests.length}</span>
                </div>
              </div>
            </div>
          </Card>

          {/* Recent Timeline */}
          <Card title="Corporate Operations Timeline" subtitle="Recent field activities, check-ins, progress logs.">
            {combinedTimeline.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "20px", textAlign: "center" }}>No logs recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "340px", overflowY: "auto", paddingRight: "4px" }}>
                {combinedTimeline.slice(0, 12).map((log, i) => {
                  const isSystem = log.isSystem;
                  const dotColor = isSystem ? "var(--primary-400)" : (log.type === "entry" ? "var(--success-500)" : "var(--danger-500)");
                  return (
                    <div key={log.id || i} style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                      <div style={{ width: "7px", height: "7px", borderRadius: "50%", backgroundColor: dotColor, marginTop: "5px", flexShrink: 0 }} />
                      <div style={{ display: "flex", flexDirection: "column", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                          <span style={{ fontWeight: "700", color: "var(--primary-900)" }}>{log.engineerName}</span>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", flexShrink: 0 }} className="font-mono">{log.date} {log.time}</span>
                        </div>
                        <span style={{ fontSize: "11.5px", color: "#334155", marginTop: "1px" }}>{log.description}</span>
                        <span style={{ fontSize: "10.5px", color: "var(--text-muted)", marginTop: "1px" }}>{log.details}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

          {/* Quick Approvals */}
          <Card title="Pending Approvals">
            {allApprovalRequests.length === 0 ? (
              <div style={{ textAlign: "center", padding: "20px", color: "var(--text-muted)" }}>
                <CheckCircle2 size={24} style={{ color: "var(--success-500)", marginBottom: "6px" }} />
                <p style={{ fontSize: "12px" }}>No pending requests</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {allApprovalRequests.slice(0, 3).map(req => (
                  <div key={req.id} style={{ padding: "10px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "#fafafa" }}>
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

        {/* ── BOTTOM: Alerts ── */}
        {alerts.length > 0 && (
          <>
            <div className="dash-section-label" style={{ marginBottom: "12px" }}>
              <span>Operations Alerts &amp; Reminders</span>
            </div>
            <Card style={{ borderLeft: "3px solid var(--danger-500)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {(showAllAlerts ? alerts : alerts.slice(0, 3)).map(alert => (
                  <div key={alert.id} className={`dash-alert-row ${alert.type}`}>
                    <AlertTriangle size={14} style={{ color: alert.type === "danger" ? "var(--danger-600)" : "var(--warning-600)", flexShrink: 0, marginTop: "2px" }} />
                    <div>
                      <span className="dash-alert-title">[{alert.category}] {alert.title}</span>
                      <p className="dash-alert-msg">{alert.message}</p>
                    </div>
                  </div>
                ))}
              </div>
              {alerts.length > 3 && (
                <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "10px", textAlign: "center" }}>
                  <button 
                    onClick={() => setShowAllAlerts(!showAllAlerts)}
                    style={{ 
                      background: "none", 
                      border: "none", 
                      color: "var(--primary-600)", 
                      fontWeight: "700", 
                      fontSize: "12px", 
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px"
                    }}
                  >
                    {showAllAlerts ? "Show Less" : `View All Alerts (${alerts.length})`}
                  </button>
                </div>
              )}
            </Card>
          </>
        )}

      </div>
    );
  };

  const renderSiteMonitoring = () => {
    const selectedSite = sites.find(s => s.id === selectedSiteId);
    
    // Resolve engineers and details for selected site
    const siteEngineers = selectedSite?.assignedEngineers?.map(uid => engineersMap[uid] || "Unknown Engineer") || [];
    const siteDprs = allDprs.filter(d => d.siteId === selectedSiteId);
    const siteLabour = laborHistoryMap[selectedSiteId] || [];
    const siteMaterials = materials.filter(m => m.siteId === selectedSiteId);
    
    const financials = selectedSite ? getSiteFinancials(selectedSite, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments) : null;
    const isDelayed = selectedSite ? isSiteDelayed(selectedSite) : false;
    const plannedProgress = selectedSite ? calculatePlannedProgress(selectedSite.startDate, selectedSite.expectedEndDate) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <div className="dash-section-label"><span>Site Operations Monitor</span></div>

        {/* Compact Inline Site Selector */}
        <div style={{ display: "flex", alignItems: "center", gap: "14px", padding: "12px 16px", backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", boxShadow: "var(--shadow-sm)", flexWrap: "wrap" }}>
          <MapPin size={16} style={{ color: "var(--primary-500)", flexShrink: 0 }} />
          <label htmlFor="site-select" style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap" }}>Viewing Site:</label>
          <select
            id="site-select"
            value={selectedSiteId}
            onChange={(e) => setSelectedSiteId(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", fontWeight: 600, outline: "none", fontSize: "13px", flex: "1 1 240px", maxWidth: "400px" }}
          >
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.siteName} ({s.location})</option>
            ))}
          </select>
          {selectedSite && (
            <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
              <Badge status={selectedSite.status || "Planning"} />
              {isDelayed && <Badge status="danger">Delayed</Badge>}
            </div>
          )}
        </div>

        {selectedSite && financials && (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px", alignItems: "start" }}>
            
            {/* Project Details Panel */}
            <Card title="Project Site Registry Details">
              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Site / Project Name</span>
                  <h3 style={{ margin: "2px 0 0 0", fontSize: "18px", fontWeight: "800", color: "var(--primary-900)" }}>{selectedSite.siteName}</h3>
                </div>
                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Client / Owner Name</span>
                  <p style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "600" }}>{selectedSite.clientName || "--"}</p>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Start Date</span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600" }} className="font-mono">{selectedSite.startDate}</p>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Expected End Date</span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "13px", fontWeight: "600", color: isDelayed ? "var(--danger-600)" : "inherit" }} className="font-mono">{selectedSite.expectedEndDate}</p>
                  </div>
                </div>
                <div style={{ borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Assigned Site Engineers</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                    {siteEngineers.length === 0 ? (
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>No engineers assigned</span>
                    ) : (
                      siteEngineers.map((name, idx) => (
                        <span key={idx} className="badge badge-completed" style={{ fontSize: "11px", padding: "4px 8px", backgroundColor: "var(--primary-50)", color: "var(--primary-800)", fontWeight: "600" }}>
                          {name}
                        </span>
                      ))
                    )}
                  </div>
                </div>
                <div>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Location Coordinates</span>
                  <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={12} />
                    {selectedSite.latitude ? `${selectedSite.latitude.toFixed(6)}, ${selectedSite.longitude.toFixed(6)} (Radius: ${selectedSite.radius}m)` : "Geofence not configured"}
                  </p>
                </div>
              </div>
            </Card>

            {/* Site operation progress comparing linear plan vs actual */}
            <Card title="Work Progress & Delays Dashboard">
              <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
                
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700" }}>
                    <span>Actual Progress</span>
                    <span style={{ color: "var(--primary-700)" }}>{financials.progressPercent}%</span>
                  </div>
                  <div style={{ width: "100%", height: "10px", backgroundColor: "var(--primary-100)", borderRadius: "5px", overflow: "hidden" }}>
                    <div style={{ width: `${financials.progressPercent}%`, height: "100%", backgroundColor: "var(--primary-600)" }} />
                  </div>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px", fontWeight: "700" }}>
                    <span>Target Planned Progress (Linear Milestone)</span>
                    <span style={{ color: "var(--accent-700)" }}>{plannedProgress}%</span>
                  </div>
                  <div style={{ width: "100%", height: "10px", backgroundColor: "var(--accent-100)", borderRadius: "5px", overflow: "hidden" }}>
                    <div style={{ width: `${plannedProgress}%`, height: "100%", backgroundColor: "var(--accent-500)" }} />
                  </div>
                </div>

                {/* Progress Gap and schedule status indicators */}
                <div style={{
                  padding: "12px 14px",
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
                      <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--success-700)" }}>
                        Site schedule is running ahead of plan (Gap: +{financials.progressPercent - plannedProgress}%)
                      </span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle size={16} style={{ color: "var(--danger-600)", flexShrink: 0 }} />
                      <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--danger-700)" }}>
                        Site is behind linear milestones (Gap: -{plannedProgress - financials.progressPercent}%)
                      </span>
                    </>
                  )}
                </div>

                {/* Financial Summary */}
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", borderTop: "1px solid var(--border-color)", paddingTop: "14px" }}>
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary-600)" }}>Budget &amp; Expense Status</h4>
                  {(() => {
                    const budget = site.budget !== undefined && site.budget !== null ? Number(site.budget) : 0;
                    const siteExpenses = generalExpenses.filter(e => e.siteId === site.id && (e.status === "Approved" || e.status === "approved"));
                    const totalExpense = siteExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
                    const utilization = budget > 0 ? (totalExpense / budget) * 100 : 0;
                    const remaining = budget - totalExpense;

                    return (
                      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", marginTop: "4px" }}>
                          <div style={{ backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px" }}>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Total Budget</span>
                            <strong style={{ fontSize: "12px", color: "var(--primary-900)", fontFamily: "monospace" }}>{formatINR(budget)}</strong>
                          </div>
                          <div style={{ backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px" }}>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Total Expense</span>
                            <strong style={{ fontSize: "12px", color: "var(--primary-900)", fontFamily: "monospace" }}>{formatINR(totalExpense)}</strong>
                          </div>
                          <div style={{ backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px" }}>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Remaining</span>
                            <strong style={{ fontSize: "12px", color: remaining < 0 ? "var(--danger-700)" : "var(--success-700)", fontFamily: "monospace" }}>{formatINR(remaining)}</strong>
                          </div>
                        </div>

                        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700" }}>
                            <span style={{ color: "var(--text-muted)" }}>Budget Used %</span>
                            <span style={{ color: utilization > 100 ? "var(--danger-700)" : (utilization > 80 ? "var(--warning-700)" : "var(--success-700)") }}>
                              {utilization.toFixed(1)}%
                            </span>
                          </div>
                          {/* Clean progress bar */}
                          <div style={{ width: "100%", height: "8px", backgroundColor: "#e2e8f0", borderRadius: "4px", overflow: "hidden" }}>
                            <div style={{
                              width: `${Math.min(utilization, 100)}%`,
                              height: "100%",
                              backgroundColor: utilization > 100 ? "#b3261e" : (utilization > 80 ? "#e65100" : "#2e7d32"),
                              borderRadius: "4px"
                            }} />
                          </div>
                        </div>

                        {/* Warning Alert */}
                        {utilization > 100 ? (
                          <div style={{ backgroundColor: "#fde8e8", border: "1px solid #f8b4b4", borderRadius: "6px", padding: "6px 8px", color: "#b3261e", fontSize: "11px", fontWeight: "600" }}>
                            ⚠️ DANGER: Exceeded 100% of budget!
                          </div>
                        ) : utilization > 80 ? (
                          <div style={{ backgroundColor: "#fff3e0", border: "1px solid #ffe0b2", borderRadius: "6px", padding: "6px 8px", color: "#e65100", fontSize: "11px", fontWeight: "600" }}>
                            ⚠️ WARNING: Exceeded 80% of budget.
                          </div>
                        ) : null}
                      </div>
                    );
                  })()}
                </div>

              </div>
            </Card>

          </div>
        )}

      </div>
    );
  };

  const renderFinancialMonitoring = () => {
    // Generate site-wise financials
    const siteWiseFinancials = sites.map(site => {
      const siteMaterials = materials.filter(m => m.siteId === site.id);
      const siteLabour = laborHistoryMap[site.id] || [];
      const siteDprs = allDprs.filter(d => d.siteId === site.id);
      return {
        site,
        financials: getSiteFinancials(site, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments)
      };
    });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <div className="dash-section-label" style={{ marginBottom: "16px" }}><span>Financial Ledger &amp; Auditing</span></div>
        
        <Card title="Corporate Site-wise Financial ledger" variant="table">
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
                  <tr>
                    <td colSpan={8} style={{ textAlign: "center", padding: "24px", color: "var(--text-muted)" }}>No sites found.</td>
                  </tr>
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
                
                {/* Aggregate Summary row */}
                <tr style={{ backgroundColor: "var(--primary-50)", fontWeight: "800", borderTop: "2px solid var(--primary-200)" }}>
                  <td>Corporate Aggregate Totals</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalProjectValue)}</td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                    {formatINR(siteWiseFinancials.reduce((acc, current) => acc + current.financials.materialExpenses, 0))}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                    {formatINR(siteWiseFinancials.reduce((acc, current) => acc + current.financials.labourExpenses, 0))}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                    {formatINR(siteWiseFinancials.reduce((acc, current) => acc + current.financials.otherExpenses, 0))}
                  </td>
                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalExpenses)}</td>
                  <td style={{ textAlign: "right", color: "var(--success-800)", fontFamily: "monospace" }}>{formatINR(overallMetrics.totalPaymentsReceived)}</td>
                  <td style={{ textAlign: "right", color: "var(--danger-800)", fontFamily: "monospace" }}>
                    {formatINR(siteWiseFinancials.reduce((acc, current) => acc + current.financials.remainingBalance, 0))}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>

      </div>
    );
  };

  const renderProgressMonitoring = () => {
    // Group updates into weekly / monthly summaries
    const dprsSorted = [...allDprs].sort((a, b) => {
      const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      return tB - tA;
    });

    // Check delays
    const delayedList = sites.filter(s => isSiteDelayed(s));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <div className="dash-section-label" style={{ marginBottom: "16px" }}><span>Operations &amp; Schedule Standing</span></div>
        
        {/* Delay Warnings */}
        {delayedList.length > 0 && (
          <Card title="Delayed Schedules Action center" style={{ borderLeft: "4px solid var(--danger-500)", backgroundColor: "var(--danger-50)" }}>
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
                      <strong>{s.siteName}</strong>: Expected completion: <u>{s.expectedEndDate}</u>. Actual progress: <strong>{financials.progressPercent}%</strong> (Planned: {planned}%, Gap: -{planned - financials.progressPercent}%).
                    </li>
                  );
                })}
              </ul>
            </div>
          </Card>
        )}

        {/* Site Progress Comparison & Schedule Standing Ledger */}
        <Card title="Corporate Site Progress Comparison & Standing Ledger" variant="table">
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
                      <td>{site.clientName || "--"}</td>
                      <td className="font-mono">{site.expectedEndDate}</td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>{financials.progressPercent}%</td>
                      <td style={{ textAlign: "right" }}>{planned}%</td>
                      <td style={{ textAlign: "right", fontWeight: "700", color: gap >= 0 ? "var(--success-700)" : "var(--danger-700)" }}>
                        {gap >= 0 ? `+${gap}%` : `${gap}%`}
                      </td>
                      <td>
                        <Badge status={standingBadge}>{standingText}</Badge>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Daily progress logs timeline */}
        <Card title="Corporate Daily Construction Timeline logs">
          {dprsSorted.length === 0 ? (
            <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No progress logs registered yet.</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingLeft: "10px", borderLeft: "2px solid var(--border-color)", marginLeft: "8px" }}>
              {dprsSorted.slice(0, 10).map((update, idx) => {
                const site = sites.find(s => s.id === update.siteId) || { siteName: "Unknown Site" };
                const formattedDate = update.createdAt
                  ? (update.createdAt.seconds
                      ? new Date(update.createdAt.seconds * 1000).toLocaleDateString()
                      : new Date(update.createdAt).toLocaleDateString())
                  : "--";
                const engName = engineersMap[update.engineerId] || `Engineer (ID: ${update.engineerId})`;
                
                return (
                  <div key={update.id || idx} style={{ position: "relative", paddingLeft: "14px" }}>
                    <div style={{
                      position: "absolute",
                      left: "-21px",
                      top: "4px",
                      width: "10px",
                      height: "10px",
                      borderRadius: "50%",
                      backgroundColor: "var(--primary-600)",
                      border: "2px solid #ffffff",
                      boxShadow: "0 0 0 2px var(--primary-100)"
                    }} />
                    
                    <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", fontSize: "12px", color: "var(--text-muted)" }}>
                      <div>
                        <strong>{site.siteName}</strong> • {engName}
                      </div>
                      <span className="font-mono">{formattedDate}</span>
                    </div>

                    <h4 style={{ margin: "4px 0 2px 0", fontSize: "14px", color: "var(--primary-900)", display: "flex", alignItems: "center", gap: "8px" }}>
                      <span>Progress reported: {update.progress}</span>
                    </h4>

                    <p style={{ margin: 0, fontSize: "13px", color: "#334155" }}>
                      {update.description}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
        </Card>

      </div>
    );
  };

  const renderApprovalCenter = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <div className="dash-section-label" style={{ marginBottom: "16px" }}><span>Central Approvals Gateway</span></div>

        <Card title="Pending Approvals Ledger" subtitle="Approve or Reject locations setup, leaves, and materials purchases.">
          {allApprovalRequests.length === 0 ? (
            <div style={{ textAlign: "center", padding: "40px", color: "var(--text-muted)" }}>
              <CheckCircle2 size={32} style={{ color: "var(--success-500)", marginBottom: "8px" }} />
              <p>All clear! There are no pending requests waiting for your approval.</p>
            </div>
          ) : (
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
                  {allApprovalRequests.map(req => (
                    <tr key={req.id}>
                      <td>
                        <Badge status={req.type === "Leave" ? "warning" : req.type === "Location" ? "pending" : "success"}>
                          {req.type}
                        </Badge>
                      </td>
                      <td style={{ fontWeight: "700" }}>{req.employeeName}</td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <span>{req.details}</span>
                          {req.type === "Location" && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Proposed coordinates: {req.latitude.toFixed(6)}, {req.longitude.toFixed(6)}</span>
                          )}
                          {req.type === "Material" && (
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Quantity: {req.quantity} | Supplier: {req.supplier}</span>
                          )}
                        </div>
                      </td>
                      <td className="font-mono">{req.requestDate}</td>
                      <td>
                        <div style={{ display: "flex", gap: "8px", justifyContent: "center" }}>
                          <Button
                            size="sm"
                            onClick={() => handleApproveRequest(req)}
                            style={{ backgroundColor: "var(--success-600)", color: "#ffffff", padding: "4px 10px" }}
                          >
                            Approve
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleRejectRequest(req)}
                            style={{ color: "var(--danger-600)", borderColor: "var(--danger-200)", padding: "4px 10px" }}
                          >
                            Reject
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

      </div>
    );
  };

  return (
    <Layout
      title={tab === "dashboard" ? "Executive Summary dashboard" : `Super Admin: ${tab.charAt(0).toUpperCase() + tab.slice(1)}`}
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
      {tab === "sites" && renderSiteMonitoring()}
      {tab === "finance" && renderFinancialMonitoring()}
      {tab === "progress" && renderProgressMonitoring()}
      {tab === "approvals" && renderApprovalCenter()}

      <Loading show={dataLoading} text="Updating database record..." />
    </Layout>
  );
}

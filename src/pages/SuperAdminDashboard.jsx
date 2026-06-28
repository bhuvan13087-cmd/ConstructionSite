import React, { useState, useEffect } from "react";
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
  getActivityLogs,
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
  const [activityLogs, setActivityLogs] = useState([]);
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

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const [fetchedSites, fetchedEngineers, fetchedLeaves, fetchedLogs, fetchedMaterials, fetchedLabourMaster, fetchedGeneralExpenses, fetchedLabourPayments, fetchedSysActivities, fetchedApprovals, fetchedDocs] = await Promise.all([
        getSites(),
        getSiteEngineers(),
        getAllLeaves(),
        getActivityLogs(),
        getMaterialsDetailed(),
        getLabourMaster(),
        getGeneralExpenses(),
        getLabourPayments(),
        getSystemActivities(),
        getCentralApprovals(),
        getAllDocuments()
      ]);

      setSites(fetchedSites);
      setEngineers(fetchedEngineers);
      setLeaves(fetchedLeaves);
      setActivityLogs(fetchedLogs);
      setMaterials(fetchedMaterials);
      setLabourMaster(fetchedLabourMaster);
      setGeneralExpenses(fetchedGeneralExpenses);
      setLabourPayments(fetchedLabourPayments);
      setSystemActivities(fetchedSysActivities);
      setApprovals(fetchedApprovals);
      setDocuments(fetchedDocs);

      if (fetchedSites.length > 0) {
        setSelectedSiteId(fetchedSites[0].id);
      }

      // Fetch DPRs & Labor history for each site in parallel to build financial/progress maps
      const dprsPromises = fetchedSites.map(s => getDailyUpdatesForSite(s.id));
      const laborPromises = fetchedSites.map(s => getLabourDailyCountsSummary(s.id));
      
      const dprsResults = await Promise.all(dprsPromises);
      const laborResults = await Promise.all(laborPromises);

      const combinedDprs = [];
      dprsResults.forEach((siteDprs, index) => {
        const siteId = fetchedSites[index].id;
        siteDprs.forEach(d => {
          combinedDprs.push({ ...d, siteId });
        });
      });
      setAllDprs(combinedDprs);

      const laborMap = {};
      laborResults.forEach((history, index) => {
        const siteId = fetchedSites[index].id;
        laborMap[siteId] = history;
      });
      setLaborHistoryMap(laborMap);

    } catch (err) {
      console.error("Super Admin dashboard load error:", err);
      showToast(`Failed to load system records: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
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
    const alerts = [];
    const nowMs = Date.now();
    
    generalExpenses.forEach(exp => {
      if (Number(exp.amount) >= 100000) {
        alerts.push({
          id: `alert_sa_high_${exp.id}`,
          type: "warning",
          category: "Payment Alert",
          title: "High-Value Field Payment Logged",
          message: `General expense of ₹${exp.amount} for "${exp.description}" has been logged at site ${sites.find(s => s.id === exp.siteId)?.siteName || "Site"}.`
        });
      }
    });

    sites.forEach(site => {
      if (site.status === "Delayed" || site.isSiteDelayed) {
        alerts.push({
          id: `alert_sa_delay_${site.id}`,
          type: "danger",
          category: "Schedule Alert",
          title: "Project Schedule Delayed Milestone",
          message: `Site execution status for "${site.siteName}" is delayed.`
        });
      }
    });

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
            id: `alert_sa_dpr_${site.id}`,
            type: "danger",
            category: "Progress Alert",
            title: "Missing Daily Progress Update",
            message: `No Daily Progress Report submitted in the last 48 hours for active site "${site.siteName}".`
          });
        }
      }
    });

    approvals.forEach(a => {
      if ((a.status || "").toLowerCase() === "pending") {
        const createdMs = a.createdAt?.seconds 
          ? a.createdAt.seconds * 1000 
          : (a.createdAt ? new Date(a.createdAt).getTime() : nowMs);
        const diffDays = (nowMs - createdMs) / (1000 * 60 * 60 * 24);
        if (diffDays >= 3) {
          alerts.push({
            id: `alert_sa_app_${a.id}`,
            type: "warning",
            category: "Approvals Alert",
            title: "Long Pending Approval",
            message: `${a.type} request from ${a.requestedBy} for ${a.siteName} has been pending for over 3 days.`
          });
        }
      }
    });

    // Pending Document Verification Alert
    const pendingDocs = documents.filter(d => (d.status || "").toLowerCase() === "uploaded" || (d.status || "").toLowerCase() === "pending" || !d.status);
    if (pendingDocs.length > 0) {
      alerts.push({
        id: "alert_sa_pending_docs",
        type: "warning",
        category: "Documents Alert",
        title: "Pending Document Verification",
        message: `There are ${pendingDocs.length} uploaded project document(s) waiting for verification.`
      });
    }

    const mappedLogs = activityLogs.map(l => ({
      id: l.id,
      type: l.type,
      engineerName: engineersMap[l.engineerId] || "Site Engineer",
      siteName: sites.find(s => s.id === l.siteId)?.siteName || "Unknown Site",
      date: l.date,
      time: l.time,
      description: `Clocked ${l.type.toUpperCase()} at ${sites.find(s => s.id === l.siteId)?.siteName || "Site"}`,
      details: l.address,
      timestamp: l.timestamp,
      isSystem: false
    }));

    const mappedSys = systemActivities.map(s => ({
      id: s.id,
      type: s.actionType,
      engineerName: s.userName || "System User",
      siteName: s.siteName || "N/A",
      date: s.date,
      time: s.createdAt?.seconds 
        ? new Date(s.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
        : new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      description: s.description,
      details: `Module: ${s.moduleType}`,
      timestamp: s.createdAt,
      isSystem: true
    }));

    const combinedTimeline = [...mappedLogs, ...mappedSys]
      .sort((a, b) => {
        const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return tB - tA;
      });

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "28px" }}>
        
        {alerts.length > 0 && (
          <Card 
            title="Executive Operations Alerts & Reminders" 
            subtitle="Real-time alerts tracking high-value expenditures, missing progress reports, geofences, and schedule deviations."
            style={{ borderLeft: "4px solid var(--danger-500)" }}
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {alerts.slice(0, 5).map(alert => (
                <div 
                  key={alert.id} 
                  style={{ 
                    display: "flex", 
                    gap: "10px", 
                    alignItems: "flex-start", 
                    padding: "12px 16px", 
                    borderRadius: "6px",
                    backgroundColor: alert.type === "danger" ? "var(--danger-50)" : "var(--warning-50)",
                    border: `1px solid ${alert.type === "danger" ? "var(--danger-200)" : "var(--warning-200)"}`
                  }}
                >
                  <AlertTriangle 
                    size={18} 
                    style={{ 
                      color: alert.type === "danger" ? "var(--danger-600)" : "var(--warning-600)", 
                      flexShrink: 0,
                      marginTop: "2px"
                    }} 
                  />
                  <div>
                    <span style={{ 
                      fontWeight: "800", 
                      fontSize: "12.5px", 
                      color: alert.type === "danger" ? "var(--danger-800)" : "var(--warning-800)",
                      display: "block" 
                    }}>
                      [{alert.category}] {alert.title}
                    </span>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#334155" }}>
                      {alert.message}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}
        
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
          
          <Card style={{ borderLeft: "4px solid var(--primary-500)" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Construction Sites</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
              <span style={{ fontSize: "32px", fontWeight: "800", color: "var(--primary-950)" }}>{overallMetrics.totalSites}</span>
              <div style={{ fontSize: "12px", color: "var(--text-muted)", display: "flex", gap: "8px" }}>
                <span style={{ color: "var(--success-600)", fontWeight: "700" }}>{overallMetrics.activeSites} Active</span>
                <span>•</span>
                <span style={{ color: "var(--primary-600)", fontWeight: "700" }}>{overallMetrics.completedSites} Done</span>
              </div>
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid var(--danger-500)" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Schedule Delays</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
              <span style={{ fontSize: "32px", fontWeight: "800", color: "var(--danger-700)" }}>{overallMetrics.delayedSites}</span>
              <Badge status={overallMetrics.delayedSites > 0 ? "warning" : "success"}>
                {overallMetrics.delayedSites > 0 ? "Attention Required" : "On Track"}
              </Badge>
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid var(--success-500)" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Total Payments Received</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px" }}>
              <span style={{ fontSize: "24px", fontWeight: "800", color: "var(--success-700)" }}>{formatINR(overallMetrics.totalPaymentsReceived)}</span>
              <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Out of {formatINR(overallMetrics.totalProjectValue)} budget</span>
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid var(--accent-500)" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Total Expenses Spent</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "12px" }}>
              <span style={{ fontSize: "24px", fontWeight: "800", color: "var(--accent-700)" }}>{formatINR(overallMetrics.totalExpenses)}</span>
              <span style={{ fontSize: "12px", color: "var(--warning-600)", fontWeight: "600" }}>Owed suppliers: {formatINR(overallMetrics.pendingPayments)}</span>
            </div>
          </Card>

          <Card style={{ borderLeft: "4px solid #8b5cf6" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700", textTransform: "uppercase" }}>Project Records</span>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "12px" }}>
              <span style={{ fontSize: "32px", fontWeight: "800", color: "#6d28d9" }}>{documents.length}</span>
              <Link to="/superadmin/documents" style={{ fontSize: "12px", color: "var(--accent-700)", fontWeight: "700", textDecoration: "none" }}>
                {pendingDocs.length} Pending →
              </Link>
            </div>
          </Card>

        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", alignItems: "start" }}>
          
          <Card title="Overall Progress Ring">
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "16px 0" }}>
              <div style={{
                position: "relative",
                width: "150px",
                height: "150px",
                borderRadius: "50%",
                background: `conic-gradient(var(--primary-600) ${overallMetrics.overallProgressPercent}%, var(--primary-100) 0)`,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)"
              }}>
                <div style={{
                  width: "120px",
                  height: "120px",
                  borderRadius: "50%",
                  backgroundColor: "#ffffff",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <span style={{ fontSize: "32px", fontWeight: "900", color: "var(--primary-900)" }}>{overallMetrics.overallProgressPercent}%</span>
                  <span style={{ fontSize: "10px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>Corporate Avg</span>
                </div>
              </div>
              
              <div style={{ marginTop: "20px", display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Projects</span>
                  <span style={{ fontWeight: "700" }}>{overallMetrics.totalSites} sites</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Total Budget Value</span>
                  <span style={{ fontWeight: "700" }}>{formatINR(overallMetrics.totalProjectValue)}</span>
                </div>
              </div>
            </div>
          </Card>

          <Card title="Recent Corporate Operations Timeline" subtitle="Unified real-time activities log of field engineer check-ins, materials log, progress reports, and workflows.">
            {combinedTimeline.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", padding: "20px", textAlign: "center" }}>No logs recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "14px", maxHeight: "360px", overflowY: "auto", paddingRight: "6px" }}>
                {combinedTimeline.slice(0, 10).map((log, i) => {
                  const isSystem = log.isSystem;
                  
                  return (
                    <div key={log.id || i} style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                      <div style={{
                        width: "8px",
                        height: "8px",
                        borderRadius: "50%",
                        backgroundColor: isSystem ? "var(--primary-500)" : (log.type === "entry" ? "var(--success-500)" : "var(--danger-500)"),
                        marginTop: "6px",
                        flexShrink: 0
                      }} />
                      <div style={{ display: "flex", flexDirection: "column", flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px" }}>
                          <span style={{ fontWeight: "700", color: "var(--primary-900)" }}>{log.engineerName}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }} className="font-mono">{log.date} {log.time}</span>
                        </div>
                        <span style={{ fontSize: "12px", color: "#334155", marginTop: "2px" }}>
                          {log.description}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{log.details}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

        </div>

      </div>
    );
  };

  const renderSiteMonitoring = () => {
    const selectedSite = sites.find(s => s.id === selectedSiteId);
    
    // Resolve engineers and activity logs for selected site
    const siteEngineers = selectedSite?.assignedEngineers?.map(uid => engineersMap[uid] || "Unknown Engineer") || [];
    const siteActivities = activityLogs.filter(log => log.siteId === selectedSiteId);
    const siteDprs = allDprs.filter(d => d.siteId === selectedSiteId);
    const siteLabour = laborHistoryMap[selectedSiteId] || [];
    const siteMaterials = materials.filter(m => m.siteId === selectedSiteId);
    
    const financials = selectedSite ? getSiteFinancials(selectedSite, siteMaterials, siteLabour, siteDprs, labourMaster.categories, generalExpenses, labourPayments) : null;
    const isDelayed = selectedSite ? isSiteDelayed(selectedSite) : false;
    const plannedProgress = selectedSite ? calculatePlannedProgress(selectedSite.startDate, selectedSite.expectedEndDate) : 0;

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Site Selector control */}
        <Card title="Site Selector" subtitle="Choose a civil construction project to monitor assignments and operations">
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "center" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%", maxWidth: "450px" }}>
              <label htmlFor="site-select" style={{ fontSize: "12px", fontWeight: "700" }}>Active Construction Site</label>
              <select
                id="site-select"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "10px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontWeight: 600,
                  outline: "none"
                }}
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName} ({s.location})</option>
                ))}
              </select>
            </div>
            
            {selectedSite && (
              <div style={{ display: "flex", gap: "12px", marginTop: "20px" }}>
                <Badge status={selectedSite.status || "Planning"} />
                {isDelayed && <Badge status="danger">Delayed Schedule</Badge>}
              </div>
            )}
          </div>
        </Card>

        {selectedSite && financials && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", alignItems: "start" }}>
            
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
                  <h4 style={{ margin: 0, fontSize: "13px", fontWeight: "700", textTransform: "uppercase", color: "var(--primary-600)" }}>Financial Standings</h4>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "4px" }}>
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "6px" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Budget Value</span>
                      <strong style={{ fontSize: "14px", color: "var(--primary-900)" }}>{formatINR(financials.budget)}</strong>
                    </div>
                    <div style={{ backgroundColor: "#f8fafc", padding: "10px", borderRadius: "6px" }}>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Total Spent</span>
                      <strong style={{ fontSize: "14px", color: "var(--primary-900)" }}>{formatINR(financials.totalSpent)}</strong>
                    </div>
                  </div>
                </div>

              </div>
            </Card>

          </div>
        )}

        {/* Selected site activities list */}
        {selectedSite && (
          <Card title={`Recent Site Operations Timeline (${selectedSite.siteName})`}>
            {siteActivities.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No recent entry exit logs on record.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {siteActivities.slice(0, 5).map((log, idx) => (
                  <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <div>
                      <span style={{ fontWeight: "700", fontSize: "13px", color: "var(--primary-900)" }}>
                        {engineersMap[log.engineerId] || "Site Engineer"}
                      </span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "8px" }}>
                        ({log.address})
                      </span>
                    </div>
                    <div>
                      <Badge status={log.type === "entry" ? "success" : "pending"}>
                        {log.type.toUpperCase()}
                      </Badge>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "12px" }} className="font-mono">
                        {log.date} {log.time}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
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
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
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
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
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
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
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

import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  getDashboardMetrics, 
  getSites, 
  getSiteEngineers, 
  getActivityLogs, 
  getSystemActivities, 
  getCentralApprovals,
  getAllDocuments
} from "../services/firebaseService";
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
  FolderOpen
} from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import { Link } from "react-router-dom";

export default function AdminDashboard() {
  const { user } = useAuth();
  const [metrics, setMetrics] = useState({
    totalSites: 0,
    activeEngineers: 0,
    attendanceToday: 0,
    totalMaterials: 0,
    activeWorkers: 0
  });
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [activityLogs, setActivityLogs] = useState([]);
  const [systemActivities, setSystemActivities] = useState([]);
  const [approvals, setApprovals] = useState([]);
  const [documents, setDocuments] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

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

  const loadData = async () => {
    try {
      setLoading(true);
      
      const [
        counts, 
        fetchedSites, 
        fetchedEngineers, 
        fetchedLogs, 
        fetchedSysLogs, 
        fetchedApprovals,
        fetchedDocs
      ] = await Promise.all([
        getDashboardMetrics(),
        getSites(),
        getSiteEngineers(),
        getActivityLogs(),
        getSystemActivities(),
        getCentralApprovals(),
        getAllDocuments()
      ]);
      
      setMetrics(counts);
      setSites(fetchedSites);
      setEngineers(fetchedEngineers);
      setActivityLogs(fetchedLogs);
      setSystemActivities(fetchedSysLogs);
      setApprovals(fetchedApprovals);
      setDocuments(fetchedDocs);
    } catch (err) {
      console.error("Dashboard loading error:", err);
      showToast(`Failed to load metrics: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Map engineers by ID for quick lookups
  const engineersMap = {};
  engineers.forEach(eng => {
    engineersMap[eng.id] = eng.fullName;
  });

  // Calculate sites that have at least one assigned engineer
  const totalAssignedProjects = sites.filter(
    site => site.assignedEngineers && site.assignedEngineers.length > 0
  ).length;

  const pendingCount = approvals.filter(r => (r.status || "").toLowerCase() === "pending").length;

  // Compute Alerts and Reminders dynamically
  const alerts = [];
  
  // 1. Long Pending Approvals (Pending > 3 days)
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
          title: "Long Pending Approval Request",
          message: `${a.type} request from ${a.requestedBy} for ${a.siteName} has been pending for over 3 days.`
        });
      }
    }
  });

  // 1.5 Pending Document Verification Alert
  const pendingDocs = documents.filter(d => (d.status || "").toLowerCase() === "uploaded" || (d.status || "").toLowerCase() === "pending" || !d.status);
  if (pendingDocs.length > 0) {
    alerts.push({
      id: "alert_pending_docs",
      type: "warning",
      category: "Documents",
      title: "Pending Document Verification",
      message: `There are ${pendingDocs.length} uploaded project document(s) waiting for verification.`
    });
  }

  // 2. Missing Daily Progress Updates (Active sites with no updates in > 48h)
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
          title: "Missing Daily Progress Report",
          message: `No progress updates submitted for project "${site.siteName}" in the last 48 hours.`
        });
      }
    }
  });

  // 3. Delayed Projects (Site delayed scheduled milestone)
  sites.forEach(site => {
    if (site.status === "Delayed" || site.isSiteDelayed) {
      alerts.push({
        id: `alert_delay_${site.id}`,
        type: "danger",
        category: "Milestone",
        title: "Construction Project Schedule Delayed",
        message: `Project "${site.siteName}" milestone execution status has been flagged as delayed.`
      });
    }
  });

  // Combine site entry/exit logs with module system activities
  const mappedLogs = activityLogs.map(l => ({
    id: l.id,
    type: l.type, // "entry" or "exit"
    engineerId: l.engineerId,
    engineerName: engineersMap[l.engineerId] || "Unknown Engineer",
    siteId: l.siteId,
    siteName: sites.find(s => s.id === l.siteId)?.siteName || "Unknown Site",
    date: l.date,
    time: l.time,
    description: `Clocked ${l.type.toUpperCase()} at ${sites.find(s => s.id === l.siteId)?.siteName || "Site"}`,
    details: l.address || "No address resolved",
    timestamp: l.timestamp,
    isSystem: false
  }));

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
    details: `Module: ${s.moduleType} Action`,
    timestamp: s.createdAt,
    isSystem: true,
    moduleType: s.moduleType
  }));

  const combinedTimeline = [...mappedLogs, ...mappedSys]
    .sort((a, b) => {
      const tA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const tB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return tB - tA; // sorted descending
    })
    .filter(log => {
      if (filterSite && log.siteId !== filterSite) return false;
      if (filterEngineer && log.engineerId !== filterEngineer) return false;
      if (filterDate && log.date !== filterDate) return false;
      return true;
    });

  // Group timeline by date for display
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
      title="Overview Dashboard" 
      description="Executive summary of civil construction site operations, workforce levels, and resource tracking."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {sites.length === 0 && (
        <div className="info-alert" style={{ borderLeft: "4px solid var(--warning-500)", backgroundColor: "var(--warning-50)", margin: "0 0 24px 0", padding: "16px", borderRadius: "var(--radius-sm)" }}>
          <div className="info-text" style={{ color: "var(--warning-700)", fontWeight: "600" }}>
            <strong>No sites created yet!</strong> Please navigate to the <Link to="/admin/sites" style={{ color: "var(--warning-800)", fontWeight: "700", textDecoration: "underline" }}>Construction Sites</Link> page to register your first construction site.
          </div>
        </div>
      )}

      {/* Metrics Section */}
      <div className="metrics-hero-grid" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "20px" }}>
        
        <div className="metric-hero-card projects">
          <div className="metric-hero-header">
            <span className="metric-hero-title">Active Projects & Assignments</span>
            <div className="metric-hero-icon">
              <Building2 size={24} />
            </div>
          </div>
          <div className="metric-hero-main">
            <span className="metric-hero-value">{metrics.totalSites}</span>
            <span className="metric-hero-label">Total Sites</span>
          </div>
          <div className="metric-hero-footer">
            <div className="metric-hero-sub">
              <span className="metric-hero-sub-val">{totalAssignedProjects}</span>
              <span className="metric-hero-sub-label">Assigned Sites</span>
            </div>
            <div className="metric-hero-divider"></div>
            <div className="metric-hero-sub">
              <span className="metric-hero-sub-val">{metrics.activeEngineers}</span>
              <span className="metric-hero-sub-label">Active Engineers</span>
            </div>
          </div>
        </div>

        <div className="metric-hero-card operations">
          <div className="metric-hero-header">
            <span className="metric-hero-title">Operations & Workforce</span>
            <div className="metric-hero-icon">
              <Users size={24} />
            </div>
          </div>
          <div className="metric-hero-main">
            <span className="metric-hero-value">{metrics.attendanceToday}</span>
            <span className="metric-hero-label">Today's Attendance</span>
          </div>
          <div className="metric-hero-footer">
            <div className="metric-hero-sub">
              <span className="metric-hero-sub-val">{metrics.activeWorkers}</span>
              <span className="metric-hero-sub-label">Active Workers</span>
            </div>
            <div className="metric-hero-divider"></div>
            <div className="metric-hero-sub">
              <span className="metric-hero-sub-val">{metrics.totalMaterials}</span>
              <span className="metric-hero-sub-label">Materials Logged</span>
            </div>
          </div>
        </div>

        {/* Approvals dial card */}
        <div className="metric-hero-card approvals" style={{ 
          background: "linear-gradient(135deg, var(--warning-700) 0%, var(--warning-900) 100%)", 
          color: "#ffffff"
        }}>
          <div className="metric-hero-header">
            <span className="metric-hero-title" style={{ color: "rgba(255,255,255,0.9)" }}>Approvals & Audits Queue</span>
            <div className="metric-hero-icon" style={{ color: "#ffffff" }}>
              <ClipboardCheck size={24} />
            </div>
          </div>
          <div className="metric-hero-main">
            <span className="metric-hero-value" style={{ color: "#ffffff" }}>{pendingCount}</span>
            <span className="metric-hero-label" style={{ color: "rgba(255,255,255,0.8)" }}>Pending Actions</span>
          </div>
          <div className="metric-hero-footer" style={{ borderTop: "1px solid rgba(255,255,255,0.2)", paddingTop: "12px" }}>
            <Link to="/admin/approvals" style={{ color: "#ffffff", fontWeight: "700", fontSize: "13px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              Navigate to Approval Center →
            </Link>
          </div>
        </div>

      </div>

      {/* Alerts and Reminders Row */}
      {alerts.length > 0 && (
        <div style={{ marginTop: "24px" }}>
          <Card 
            title="Important Operations Alerts & Reminders" 
            subtitle="Automated alerts tracking delayed progress updates, long-pending workflows, and delayed timelines."
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
        </div>
      )}

      {/* Two-Column Dashboard Layout */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", marginTop: "24px", alignItems: "start" }}>
        
        {/* Left Column (2fr) */}
        <div style={{ flex: "2 1 600px", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Projects Overview Section */}
          <Card 
            variant="table" 
            title="Projects & Site Assignments Overview"
            headerActions={
              <Badge status="success">{sites.length} Active Projects</Badge>
            }
            className="w-full"
          >
            <table className="data-table" style={{ margin: "0" }}>
              <thead>
                <tr>
                  <th>Project / Site Name</th>
                  <th>Assigned Site Engineer</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Created Date</th>
                </tr>
              </thead>
              <tbody>
                {sites.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                      No registered construction sites or assignments found.
                    </td>
                  </tr>
                ) : (
                  sites.map((site) => {
                    const createdDateStr = site.createdAt
                      ? (site.createdAt.seconds
                          ? new Date(site.createdAt.seconds * 1000).toLocaleDateString()
                          : new Date(site.createdAt).toLocaleDateString())
                      : "N/A";
                    
                    return (
                      <tr key={site.id}>
                        <td style={{ fontWeight: 700, color: "var(--primary-900)" }}>{site.siteName}</td>
                        <td>
                          {site.assignedEngineers && site.assignedEngineers.length > 0 ? (
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                              {site.assignedEngineers.map(uid => {
                                const name = engineersMap[uid] || "Unknown Engineer";
                                return (
                                  <span 
                                    key={uid} 
                                    className="badge badge-completed" 
                                    style={{ 
                                      fontSize: "11px", 
                                      padding: "4px 8px",
                                      fontWeight: "600",
                                      backgroundColor: "var(--primary-100)",
                                      color: "var(--primary-800)",
                                      borderRadius: "var(--radius-sm)"
                                    }}
                                  >
                                    {name}
                                  </span>
                                );
                              })}
                            </div>
                          ) : (
                            <span style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
                              No Engineer Assigned
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            <MapPin size={14} className="text-muted" style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            <span style={{ fontSize: "13px" }}>{site.location}</span>
                          </div>
                        </td>
                        <td>
                          <Badge status={site.status || "Planning"} />
                        </td>
                        <td className="font-mono" style={{ fontSize: "13px" }}>{createdDateStr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>

          {/* Central Timeline */}
          <Card title="Unified Site Operations & System Activity History Timeline">
            
            {/* Timeline Filters */}
            <div style={{ 
              display: "grid", 
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", 
              gap: "16px", 
              marginBottom: "20px",
              padding: "16px",
              backgroundColor: "#f8fafc",
              borderRadius: "6px",
              border: "1px solid var(--border-color)"
            }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Filter by Project</label>
                <select 
                  value={filterSite} 
                  onChange={(e) => setFilterSite(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
                >
                  <option value="">All Projects</option>
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.siteName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Filter by Engineer</label>
                <select 
                  value={filterEngineer} 
                  onChange={(e) => setFilterEngineer(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
                >
                  <option value="">All Engineers</option>
                  {engineers.map(e => (
                    <option key={e.id} value={e.id}>{e.fullName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase" }}>Filter by Date</label>
                <input 
                  type="date"
                  value={filterDate}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "13px" }}
                />
              </div>
            </div>

            {sortedDates.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
                <Activity size={32} style={{ color: "var(--primary-300)", marginBottom: "8px" }} />
                <p>No matching activities or operations logged.</p>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "8px" }}>
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
                    <div key={dateStr} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      <div style={{ 
                        fontSize: "14px", 
                        fontWeight: "800", 
                        color: "var(--primary-900)", 
                        borderBottom: "2px solid var(--border-color)", 
                        paddingBottom: "4px",
                        display: "flex",
                        alignItems: "center",
                        gap: "6px"
                      }}>
                        <Calendar size={16} style={{ color: "var(--primary-600)" }} />
                        {formattedDate}
                      </div>
                      
                      <div style={{ 
                        position: "relative", 
                        paddingLeft: "20px", 
                        borderLeft: "2.5px solid var(--border-color)",
                        marginLeft: "10px",
                        display: "flex",
                        flexDirection: "column",
                        gap: "16px"
                      }}>
                        {logsForDate.map((log, index) => {
                          const isEntry = log.type === "entry";
                          const isExit = log.type === "exit";
                          const isSystem = log.isSystem;

                          return (
                            <div key={log.id || index} style={{ position: "relative" }}>
                              <div style={{ 
                                position: "absolute", 
                                left: "-28.5px", 
                                top: "2px", 
                                width: "14px", 
                                height: "14px", 
                                borderRadius: "50%", 
                                backgroundColor: isEntry ? "var(--success-500)" : (isExit ? "var(--danger-500)" : "var(--primary-600)"),
                                border: "3px solid #ffffff",
                                boxShadow: "0 0 0 2px " + (isEntry ? "var(--success-100)" : (isExit ? "var(--danger-100)" : "var(--primary-100)"))
                              }} />
                              
                              <div style={{ 
                                display: "flex", 
                                flexDirection: "column", 
                                gap: "4px",
                                padding: "12px 16px",
                                borderRadius: "var(--radius-sm)",
                                border: "1.5px solid " + (isEntry ? "var(--success-100)" : (isExit ? "var(--danger-100)" : "var(--primary-100)")),
                                backgroundColor: isEntry ? "rgba(34, 197, 94, 0.01)" : (isExit ? "rgba(239, 68, 68, 0.01)" : "rgba(30, 41, 59, 0.01)")
                              }}>
                                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", alignItems: "center" }}>
                                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                                    <span style={{ 
                                      fontWeight: "800", 
                                      fontSize: "11px", 
                                      color: isEntry ? "var(--success-600)" : (isExit ? "var(--danger-600)" : "var(--primary-700)"),
                                      backgroundColor: isEntry ? "var(--success-50)" : (isExit ? "var(--danger-50)" : "var(--primary-50)"),
                                      padding: "2px 8px",
                                      borderRadius: "12px",
                                      textTransform: "uppercase",
                                      letterSpacing: "0.5px"
                                    }}>
                                      {log.type.toUpperCase()}
                                    </span>
                                    <strong style={{ fontSize: "14px", color: "var(--primary-900)" }}>{log.engineerName}</strong>
                                  </div>
                                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "4px" }}>
                                    <Clock size={12} /> {log.time}
                                  </span>
                                </div>

                                <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginTop: "4px" }}>
                                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#1e293b" }}>
                                    {log.description}
                                  </span>
                                  <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                    {log.details}
                                  </span>
                                </div>
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
          </Card>

        </div>

        {/* Right Column (1fr) */}
        <div style={{ flex: "1 1 300px", display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Document Verification Action Items */}
          <Card title="Document Verification Tasks">
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "8px", 
                padding: "12px", 
                backgroundColor: pendingDocs.length > 0 ? "var(--warning-50)" : "var(--success-50)", 
                borderRadius: "6px", 
                border: pendingDocs.length > 0 ? "1px solid var(--warning-200)" : "1px solid var(--success-200)" 
              }}>
                {pendingDocs.length > 0 ? (
                  <>
                    <AlertTriangle size={18} style={{ color: "var(--warning-600)", flexShrink: 0 }} />
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--warning-800)" }}>
                      {pendingDocs.length} document(s) pending verification
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={18} style={{ color: "var(--success-600)", flexShrink: 0 }} />
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--success-800)" }}>
                      All documents are verified
                    </span>
                  </>
                )}
              </div>

              {pendingDocs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {pendingDocs.slice(0, 3).map(doc => (
                    <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "6px", backgroundColor: "#ffffff" }}>
                      <div style={{ minWidth: 0, marginRight: "8px" }}>
                        <div style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)" }} className="text-ellipsis">{doc.title}</div>
                        <p style={{ margin: 0, fontSize: "10.5px", color: "var(--text-muted)" }} className="text-ellipsis">{doc.siteName}</p>
                      </div>
                      <Link to="/admin/documents" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", textDecoration: "underline", flexShrink: 0 }}>
                        Verify
                      </Link>
                    </div>
                  ))}
                  {pendingDocs.length > 3 && (
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>
                      + {pendingDocs.length - 3} more pending documents
                    </span>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Recent Document Uploads timeline panel */}
          <Card 
            title="Recent Document Uploads" 
            headerActions={
              <Link to="/admin/documents" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", textDecoration: "none", display: "flex", alignItems: "center", gap: "2px" }}>
                <span>View all</span>
              </Link>
            }
          >
            {recentDocs.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px", fontSize: "13px" }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {recentDocs.map(doc => {
                  const isUploaded = doc.status === "Uploaded";
                  const isVerified = doc.status === "Verified";
                  return (
                    <div key={doc.id} style={{ display: "flex", gap: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                      <div style={{
                        backgroundColor: isVerified ? "var(--success-50)" : (isUploaded ? "var(--primary-50)" : "var(--danger-50)"),
                        color: isVerified ? "var(--success-600)" : (isUploaded ? "var(--primary-600)" : "var(--danger-600)"),
                        padding: "8px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "36px",
                        width: "36px",
                        flexShrink: 0
                      }}>
                        <FolderOpen size={20} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }} className="text-ellipsis">{doc.title}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{doc.category} • {doc.siteName}</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "4px" }}>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>By: {doc.uploadedBy}</span>
                          <Badge status={doc.status === "Uploaded" ? "pending" : (doc.status === "Verified" ? "success" : "danger")} style={{ fontSize: "9px", padding: "1px 6px" }}>
                            {doc.status}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>

        </div>
      </div>

      <Loading show={loading} text="Loading executive panel..." />
    </Layout>
  );
}

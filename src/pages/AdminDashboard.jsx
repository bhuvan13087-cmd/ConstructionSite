import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  onSnapshot, 
  collection, 
  query, 
  where, 
  limit 
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
  ArrowRight
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
    const siteIds = new Set(sites.map(s => s.id));
    return rawWorkers.filter(w => siteIds.has(w.siteId) || w.adminId === user?.uid).length;
  }, [sites, rawWorkers, user]);

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

    // 1. Sites Listener — filtered to this admin's sites (soft filter for legacy data)
    const adminUid = user?.uid || null;
    const unsubSites = onSnapshot(collection(db, "sites"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        // Soft filter: include sites with no createdByAdmin (legacy) or matching this admin
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

    // 2. Engineers Listener (with legacy fallback) — filtered to this admin's engineers
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

    // 5. Workers Listener
    const qWorkers = query(collection(db, "workers"), where("status", "==", "active"));
    const unsubWorkers = onSnapshot(qWorkers, (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      setRawWorkers(list);
    }, (err) => {
      console.error("Workers listener error:", err);
    });


    // 7. System Activities Listener (limit 50, sorted in-memory desc)
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
    };
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

  const combinedTimeline = [...mappedSys]
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
        <div style={{ borderLeft: "4px solid var(--warning-500)", backgroundColor: "var(--warning-100)", marginBottom: "20px", padding: "12px 16px", borderRadius: "var(--radius-sm)", display: "flex", alignItems: "center", gap: "10px" }}>
          <AlertTriangle size={16} style={{ color: "var(--warning-600)", flexShrink: 0 }} />
          <span style={{ color: "var(--warning-700)", fontWeight: "600", fontSize: "13px" }}>
            <strong>No sites created yet!</strong> Navigate to the <Link to="/admin/sites" style={{ color: "var(--warning-800)", fontWeight: "700", textDecoration: "underline" }}>Construction Sites</Link> page to register your first construction site.
          </span>
        </div>
      )}

      {/* ── TOP: Compact KPI Bar ── */}
      <div className="dash-kpi-bar" style={{ marginBottom: "20px" }}>

        <div className="dash-kpi-item">
          <div className="dash-kpi-icon" style={{ backgroundColor: "rgba(59,130,246,0.08)", color: "#3b82f6" }}>
            <Building2 size={17} />
          </div>
          <span className="dash-kpi-label">Total Sites</span>
          <span className="dash-kpi-value">{sites.length}</span>
          <span className="dash-kpi-sub">{totalAssignedProjects} assigned</span>
        </div>

        <div className="dash-kpi-item">
          <div className="dash-kpi-icon" style={{ backgroundColor: "rgba(16,185,129,0.08)", color: "#10b981" }}>
            <HardHat size={17} />
          </div>
          <span className="dash-kpi-label">Active Engineers</span>
          <span className="dash-kpi-value">{engineers.filter(e => e.status === "active").length}</span>
          <span className="dash-kpi-sub">Site personnel</span>
        </div>

        <div className="dash-kpi-item">
          <div className="dash-kpi-icon" style={{ backgroundColor: "rgba(249,115,22,0.08)", color: "#f97316" }}>
            <Users size={17} />
          </div>
          <span className="dash-kpi-label">Workforce &amp; Materials</span>
          <span className="dash-kpi-value">{metrics.attendanceToday}</span>
          <span className="dash-kpi-sub">{metrics.activeWorkers} workers active · {metrics.totalMaterials} logged</span>
        </div>

        <div className="dash-kpi-item" style={{ backgroundColor: pendingCount > 0 ? "hsl(38,90%,97%)" : undefined }}>
          <div className="dash-kpi-icon" style={{ backgroundColor: pendingCount > 0 ? "rgba(234,179,8,0.12)" : "rgba(16,185,129,0.08)", color: pendingCount > 0 ? "var(--warning-600)" : "var(--success-600)" }}>
            <ClipboardCheck size={17} />
          </div>
          <span className="dash-kpi-label">Pending Approvals</span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span className="dash-kpi-value" style={{ color: pendingCount > 0 ? "var(--warning-600)" : "var(--success-600)" }}>{pendingCount}</span>
            {pendingCount > 0 && (
              <span className="badge badge-danger" style={{ fontSize: "9px", padding: "1px 5px", lineHeight: "1" }}>Action</span>
            )}
          </div>
          <Link to="/admin/approvals" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", display: "flex", alignItems: "center", gap: "2px", marginTop: "2px", textDecoration: "none" }}>
            Review <ArrowRight size={10} />
          </Link>
        </div>

      </div>

      {/* ── MIDDLE: Two-Column Layout ── */}
      <div className="admin-dashboard-main-grid">

        {/* Left Column — Projects Table (2/3 width) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          <div className="dash-section-label"><span>Projects &amp; Assignments</span></div>

          <Card 
            variant="table" 
            headerActions={
              <Badge status="success">{sites.length} Projects</Badge>
            }
          >
            <table className="data-table" style={{ margin: "0" }}>
              <thead>
                <tr>
                  <th>Project / Site Name</th>
                  <th>Assigned Engineer</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Created</th>
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
                            <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                              {site.assignedEngineers.map(uid => {
                                const name = engineersMap[uid] || "Unknown Engineer";
                                return (
                                  <span 
                                    key={uid} 
                                    className="badge badge-completed" 
                                    style={{ 
                                      fontSize: "11px", 
                                      padding: "3px 7px",
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
                              Unassigned
                            </span>
                          )}
                        </td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
                            <MapPin size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                            <span style={{ fontSize: "13px" }}>{site.location}</span>
                          </div>
                        </td>
                        <td>
                          <Badge status={site.status || "Planning"} />
                        </td>
                        <td className="font-mono" style={{ fontSize: "12px" }}>{createdDateStr}</td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </Card>

        </div>

        {/* Right Column — Alerts + Docs (1/3 width) */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Alerts Panel */}
          {alerts.length > 0 && (
            <>
              <div className="dash-section-label"><span>Alerts &amp; Reminders</span></div>
              <Card style={{ borderLeft: "3px solid var(--danger-500)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  {alerts.slice(0, 5).map(alert => (
                    <div key={alert.id} className={`dash-alert-row ${alert.type}`}>
                      <AlertTriangle 
                        size={14} 
                        style={{ 
                          color: alert.type === "danger" ? "var(--danger-600)" : "var(--warning-600)", 
                          flexShrink: 0,
                          marginTop: "2px"
                        }} 
                      />
                      <div>
                        <span className="dash-alert-title">[{alert.category}] {alert.title}</span>
                        <p className="dash-alert-msg">{alert.message}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            </>
          )}

          {/* Document Verification Tasks */}
          <div className="dash-section-label"><span>Document Verification</span></div>
          <Card>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ 
                display: "flex", 
                alignItems: "center", 
                gap: "8px", 
                padding: "10px 12px", 
                backgroundColor: pendingDocs.length > 0 ? "var(--warning-100)" : "var(--success-50)", 
                borderRadius: "6px", 
                border: pendingDocs.length > 0 ? "1px solid var(--warning-500)" : "1px solid var(--success-100)" 
              }}>
                {pendingDocs.length > 0 ? (
                  <>
                    <AlertTriangle size={16} style={{ color: "var(--warning-600)", flexShrink: 0 }} />
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--warning-600)" }}>
                      {pendingDocs.length} document(s) pending
                    </span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={16} style={{ color: "var(--success-600)", flexShrink: 0 }} />
                    <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--success-600)" }}>
                      All documents verified
                    </span>
                  </>
                )}
              </div>

              {pendingDocs.length > 0 && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                  {pendingDocs.slice(0, 3).map(doc => (
                    <div key={doc.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "7px 10px", border: "1px solid var(--border-color)", borderRadius: "6px", backgroundColor: "#ffffff" }}>
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
                    <Link to="/admin/documents" style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center", display: "block" }}>
                      + {pendingDocs.length - 3} more pending
                    </Link>
                  )}
                </div>
              )}
            </div>
          </Card>

          {/* Recent Document Uploads */}
          <Card 
            title="Recent Uploads" 
            headerActions={
              <Link to="/admin/documents" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-600)", textDecoration: "none" }}>
                View all
              </Link>
            }
          >
            {recentDocs.length === 0 ? (
              <p style={{ textAlign: "center", color: "var(--text-muted)", padding: "12px", fontSize: "13px" }}>No documents uploaded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {recentDocs.map(doc => {
                  const isUploaded = doc.status === "Uploaded";
                  const isVerified = doc.status === "Verified";
                  return (
                    <div key={doc.id} style={{ display: "flex", gap: "10px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                      <div style={{
                        backgroundColor: isVerified ? "var(--success-50)" : (isUploaded ? "var(--primary-50)" : "var(--danger-50)"),
                        color: isVerified ? "var(--success-600)" : (isUploaded ? "var(--primary-600)" : "var(--danger-600)"),
                        padding: "7px",
                        borderRadius: "6px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        height: "32px",
                        width: "32px",
                        flexShrink: 0
                      }}>
                        <FolderOpen size={16} />
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                        <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--primary-900)" }} className="text-ellipsis">{doc.title}</span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{doc.category} • {doc.siteName}</span>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "2px" }}>
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

      {/* ── BOTTOM: Full-Width Activity Timeline ── */}
      <div className="dash-section-label" style={{ marginBottom: "16px" }}><span>Site Operations &amp; Activity Timeline</span></div>

      <Card>
        {/* Compact Inline Filter Bar */}
        <div style={{ 
          display: "flex", 
          flexWrap: "wrap",
          gap: "10px", 
          marginBottom: "18px",
          alignItems: "center",
          padding: "10px 14px",
          backgroundColor: "#f8fafc",
          borderRadius: "6px",
          border: "1px solid var(--border-color)"
        }}>
          <Filter size={14} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
          <select 
            value={filterSite} 
            onChange={(e) => setFilterSite(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "12.5px", flex: "1 1 160px" }}
          >
            <option value="">All Projects</option>
            {sites.map(s => (
              <option key={s.id} value={s.id}>{s.siteName}</option>
            ))}
          </select>

          <select 
            value={filterEngineer} 
            onChange={(e) => setFilterEngineer(e.target.value)}
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "12.5px", flex: "1 1 160px" }}
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
            style={{ padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", outline: "none", fontSize: "12.5px", flex: "1 1 140px" }}
          />

          {(filterSite || filterEngineer || filterDate) && (
            <button 
              type="button"
              onClick={() => { setFilterSite(""); setFilterEngineer(""); setFilterDate(""); }}
              style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff", fontSize: "12px", fontWeight: "600", color: "var(--text-muted)", cursor: "pointer" }}
            >
              Clear
            </button>
          )}
        </div>

        {sortedDates.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px" }}>
            <Activity size={32} style={{ color: "var(--primary-300)", marginBottom: "8px" }} />
            <p>No matching activities or operations logged.</p>
          </div>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
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
                <div key={dateStr} style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {/* Date Header */}
                  <div style={{ 
                    fontSize: "12px", 
                    fontWeight: "800", 
                    color: "var(--primary-700)", 
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    paddingBottom: "6px",
                    borderBottom: "1.5px solid var(--border-color)"
                  }}>
                    <Calendar size={13} style={{ color: "var(--primary-500)" }} />
                    {formattedDate}
                    <span style={{ marginLeft: "auto", fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>
                      {logsForDate.length} {logsForDate.length === 1 ? "event" : "events"}
                    </span>
                  </div>
                  
                  {/* Timeline Items */}
                  <div style={{ 
                    position: "relative", 
                    paddingLeft: "18px", 
                    borderLeft: "2px solid var(--border-color)",
                    marginLeft: "8px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px"
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
                            left: "-25px", 
                            top: "4px", 
                            width: "10px", 
                            height: "10px", 
                            borderRadius: "50%", 
                            backgroundColor: dotColor,
                            border: "2px solid #ffffff",
                            boxShadow: `0 0 0 2px ${dotColor}33`
                          }} />
                          
                          <div style={{ 
                            display: "flex", 
                            justifyContent: "space-between",
                            alignItems: "flex-start",
                            gap: "8px",
                            padding: "8px 12px",
                            borderRadius: "var(--radius-sm)",
                            border: "1px solid var(--border-color)",
                            backgroundColor: "#ffffff"
                          }}>
                            <div style={{ display: "flex", flexDirection: "column", gap: "3px", flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "7px", flexWrap: "wrap" }}>
                                <span style={{ 
                                  fontWeight: "800", 
                                  fontSize: "10px", 
                                  color: tagColor,
                                  backgroundColor: tagBg,
                                  padding: "1px 7px",
                                  borderRadius: "10px",
                                  textTransform: "uppercase",
                                  letterSpacing: "0.5px"
                                }}>
                                  {log.type.toUpperCase()}
                                </span>
                                <strong style={{ fontSize: "13px", color: "var(--primary-900)" }}>{log.engineerName}</strong>
                              </div>
                              <span style={{ fontSize: "12.5px", color: "#334155", fontWeight: "500" }}>{log.description}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{log.details}</span>
                            </div>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px", flexShrink: 0 }}>
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
      </Card>

      <Loading show={loading} text="Loading executive panel..." />
    </Layout>
  );
}

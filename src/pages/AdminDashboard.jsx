import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { getStoredConfig } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { getDashboardMetrics, getSites, getMaterialsDetailed, getLabourDailyCountsSummary } from "../services/firebaseService";
import { MapPin, Users, ClipboardCheck, FileText, Wifi, WifiOff, Package, ExternalLink } from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";

export default function AdminDashboard() {
  const { user, userProfile } = useAuth();
  const [metrics, setMetrics] = useState({
    totalSites: 0,
    activeEngineers: 0,
    attendanceToday: 0,
    totalMaterials: 0,
    activeWorkers: 0
  });
  const [sites, setSites] = useState([]);
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // Material tracking states
  const [selectedMaterialSiteId, setSelectedMaterialSiteId] = useState("");
  const [siteMaterials, setSiteMaterials] = useState([]);
  const [materialsLoading, setMaterialsLoading] = useState(false);

  // Labour auditing states
  const [selectedLabourSiteId, setSelectedLabourSiteId] = useState("");
  const [labourHistory, setLabourHistory] = useState([]);
  const [labourLoading, setLabourLoading] = useState(false);

  const config = getStoredConfig();
  const projectId = config?.projectId || "--";
  const adminEmail = user?.email || userProfile?.email || "admin@gmail.com";
  
  const [lastLoginStr, setLastLoginStr] = useState("First Session Access");

  useEffect(() => {
    if (userProfile?.lastLogin) {
      const lastLoginVal = userProfile.lastLogin;
      let dateObj;
      if (lastLoginVal.seconds) {
        dateObj = new Date(lastLoginVal.seconds * 1000);
      } else if (lastLoginVal instanceof Date) {
        dateObj = lastLoginVal;
      } else {
        dateObj = new Date(lastLoginVal);
      }
      setLastLoginStr(dateObj.toLocaleString());
    }
  }, [userProfile]);

  // Real-time network listener
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const counts = await getDashboardMetrics();
      setMetrics(counts);
      const fetchedSites = await getSites();
      setSites(fetchedSites);
      if (fetchedSites.length > 0) {
        setSelectedMaterialSiteId(prev => prev || fetchedSites[0].id);
        setSelectedLabourSiteId(prev => prev || fetchedSites[0].id);
      }
    } catch (err) {
      console.error("Dashboard loading error:", err);
      if (err.code === "permission-denied") {
        showToast("Access Denied: You do not have permission to view dashboard data.", "error");
      } else if (err.code === "unavailable" || err.message?.includes("offline") || !navigator.onLine) {
        showToast("Database Offline: Please check your network connection.", "error");
      } else {
        showToast(`Failed to load metrics: ${err.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Fetch materials whenever selected site changes
  useEffect(() => {
    const fetchSiteMaterials = async () => {
      if (!selectedMaterialSiteId) return;
      setMaterialsLoading(true);
      try {
        const mats = await getMaterialsDetailed(selectedMaterialSiteId);
        setSiteMaterials(mats);
      } catch (err) {
        console.error("Failed to load materials for admin:", err);
        showToast(`Failed to load materials: ${err.message}`, "error");
      } finally {
        setMaterialsLoading(false);
      }
    };

    fetchSiteMaterials();
  }, [selectedMaterialSiteId]);

  // Fetch labor workers and attendance summary logs when selected site changes
  useEffect(() => {
    const fetchLabourDataForAdmin = async () => {
      if (!selectedLabourSiteId) return;
      setLabourLoading(true);
      try {
        const history = await getLabourDailyCountsSummary(selectedLabourSiteId);
        setLabourHistory(history);
      } catch (err) {
        console.error("Failed to load labour data for admin:", err);
        showToast(`Failed to load labour records: ${err.message}`, "error");
      } finally {
        setLabourLoading(false);
      }
    };

    fetchLabourDataForAdmin();
  }, [selectedLabourSiteId]);

  return (
    <Layout title="Overview Dashboard" description="Real-time status of the Civil Construction Site control systems.">
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
            <strong>No sites created yet!</strong> Please navigate to the <a href="/admin/sites" style={{ color: "var(--warning-800)", fontWeight: "700", textDecoration: "underline" }}>Construction Sites</a> page to register your first construction site.
          </div>
        </div>
      )}

      {/* Metrics Section */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Sites</span>
            <div className="metric-icon-wrapper info">
              <MapPin size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.totalSites}</div>
          <p className="metric-subtext">Active construction projects</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Engineers</span>
            <div className="metric-icon-wrapper success">
              <Users size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.activeEngineers}</div>
          <p className="metric-subtext">Engineers on field</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Attendance Today</span>
            <div className="metric-icon-wrapper warning">
              <ClipboardCheck size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.attendanceToday}</div>
          <p className="metric-subtext">Today's present staff count</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Materials Logged</span>
            <div className="metric-icon-wrapper danger">
              <Package size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.totalMaterials}</div>
          <p className="metric-subtext">Total material logs recorded</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Workers</span>
            <div className="metric-icon-wrapper primary">
              <Users size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.activeWorkers}</div>
          <p className="metric-subtext">Active labor personnel count</p>
        </div>
      </div>

      {/* Connection Properties Panel */}
      <div className="dashboard-details">
        <Card 
          variant="accent" 
          title="Database Connection Details"
          headerActions={
            isOnline ? (
              <Badge status="success">
                <Wifi size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} /> Live
              </Badge>
            ) : (
              <Badge status="inactive">
                <WifiOff size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} /> Offline
              </Badge>
            )
          }
          className="w-full"
        >
          <div className="table-container">
            <table className="status-table" style={{ margin: "0" }}>
              <thead>
                <tr>
                  <th>Configuration Parameter</th>
                  <th>Value</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td>Firebase Project ID</td>
                  <td className="font-mono">{projectId}</td>
                </tr>
                <tr>
                  <td>Admin Authenticated Email</td>
                  <td>{adminEmail}</td>
                </tr>
                <tr>
                  <td>Last Login Event</td>
                  <td className="font-mono">{lastLoginStr}</td>
                </tr>
                <tr>
                  <td>Connection Status</td>
                  <td>
                    {isOnline ? (
                      <Badge status="success">Live Connection</Badge>
                    ) : (
                      <Badge status="inactive">Offline / Connection Error</Badge>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Created Sites Overview Table */}
      <div className="dashboard-details" style={{ marginTop: "24px" }}>
        <Card 
          variant="table" 
          title="Registered Construction Sites"
          headerActions={
            <Badge status="success">{sites.length} Projects</Badge>
          }
          className="w-full"
        >
          <table className="data-table" style={{ margin: "0" }}>
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Created Date</th>
              </tr>
            </thead>
            <tbody>
              {sites.length === 0 ? (
                <tr>
                  <td colSpan={4} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                    No sites registered in the database.
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
                      <td style={{ fontWeight: 700 }}>{site.siteName}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <MapPin size={14} className="text-muted" style={{ color: "var(--text-muted)" }} />
                          <span>{site.location}</span>
                        </div>
                      </td>
                      <td>
                        <Badge status={site.status || "Planning"} />
                      </td>
                      <td className="font-mono">{createdDateStr}</td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Material Tracking & Audits Section */}
      <div className="dashboard-details" style={{ marginTop: "24px" }}>
        <Card 
          variant="table" 
          title="Material Tracking & Audits"
          headerActions={
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Select Site:</span>
              <select
                value={selectedMaterialSiteId}
                onChange={(e) => setSelectedMaterialSiteId(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontWeight: 600,
                  fontSize: "13px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.siteName}</option>
                ))}
              </select>
              {materialsLoading ? (
                <Badge status="pending">Syncing...</Badge>
              ) : (
                <Badge status="success">{siteMaterials.length} Logged</Badge>
              )}
            </div>
          }
          className="w-full"
        >
          <table className="data-table" style={{ margin: "0" }}>
            <thead>
              <tr>
                <th>Material Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Supplier</th>
                <th>Receipt Date</th>
                <th>Added By Engineer</th>
                <th>Invoice</th>
              </tr>
            </thead>
            <tbody>
              {siteMaterials.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                    {materialsLoading ? "Synchronizing material records..." : "No material receipts recorded for this site."}
                  </td>
                </tr>
              ) : (
                siteMaterials.map((mat) => {
                  return (
                    <tr key={mat.id}>
                      <td style={{ fontWeight: 700 }}>
                        <div>
                          <span>{mat.materialName}</span>
                          {mat.notes && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal", marginTop: "2px" }}>
                              Note: {mat.notes}
                            </div>
                          )}
                        </div>
                      </td>
                      <td>
                        <Badge status="pending">{mat.category}</Badge>
                      </td>
                      <td style={{ fontWeight: 600 }}>
                        {mat.quantity} {mat.unit}{Number(mat.quantity) !== 1 ? 's' : ''}
                      </td>
                      <td>{mat.supplierName}</td>
                      <td className="font-mono">{mat.purchaseDate || "--"}</td>
                      <td style={{ fontWeight: 600, color: "var(--primary-800)" }}>{mat.engineerName}</td>
                      <td>
                        {mat.invoiceUrl ? (
                          <a 
                            href={mat.invoiceUrl} 
                            target="_blank" 
                            rel="noopener noreferrer" 
                            className="btn-icon"
                            style={{ 
                              display: "inline-flex", 
                              alignItems: "center", 
                              gap: "4px", 
                              color: "var(--accent-600)", 
                              fontSize: "12px",
                              fontWeight: 700,
                              textDecoration: "none"
                            }}
                          >
                            <ExternalLink size={14} />
                            <span>View Bill</span>
                          </a>
                        ) : (
                          <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>No Attachment</span>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>
      </div>

      {/* Labour Management & Audits Section */}
      <div className="dashboard-details" style={{ marginTop: "24px" }}>
        <Card 
          variant="table" 
          title="Labour Audits & Supervision"
          headerActions={
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Select Site:</span>
              <select
                value={selectedLabourSiteId}
                onChange={(e) => setSelectedLabourSiteId(e.target.value)}
                style={{
                  padding: "6px 12px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontWeight: 600,
                  fontSize: "13px",
                  outline: "none",
                  cursor: "pointer"
                }}
              >
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.siteName}</option>
                ))}
              </select>
              {labourLoading ? (
                <Badge status="pending">Loading...</Badge>
              ) : (
                <Badge status="success">{labourHistory.length} Days Logged</Badge>
              )}
            </div>
          }
          className="w-full"
        >
          <table className="data-table" style={{ margin: "0" }}>
            <thead>
              <tr>
                <th>Date</th>
                <th>Masons</th>
                <th>Helpers</th>
                <th>Painters</th>
                <th>Plumbers</th>
                <th>Electricians</th>
                <th>Others</th>
                <th style={{ fontWeight: "bold" }}>Total Workers</th>
              </tr>
            </thead>
            <tbody>
              {labourHistory.length === 0 ? (
                <tr>
                  <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                    {labourLoading ? "Loading labour database..." : "No worker counts registered for this site."}
                  </td>
                </tr>
              ) : (
                labourHistory.map((row) => (
                  <tr key={row.date}>
                    <td style={{ fontWeight: 700 }} className="font-mono">{row.date}</td>
                    <td>{row.Masons}</td>
                    <td>{row.Helpers}</td>
                    <td>{row.Painters}</td>
                    <td>{row.Plumbers}</td>
                    <td>{row.Electricians}</td>
                    <td>{row.Others}</td>
                    <td>
                      <Badge status="success">{row.total} Workers</Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Loading show={loading} text="Loading Dashboard..." />
    </Layout>
  );
}

import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { getDashboardMetrics, getSites, getSiteEngineers } from "../services/firebaseService";
import { MapPin, Users, ClipboardCheck, Package } from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";

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
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

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
      
      const fetchedEngineers = await getSiteEngineers();
      setEngineers(fetchedEngineers);
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

  // Map engineers by ID for quick lookups
  const engineersMap = {};
  engineers.forEach(eng => {
    engineersMap[eng.id] = eng.fullName;
  });

  // Calculate sites that have at least one assigned engineer
  const totalAssignedProjects = sites.filter(
    site => site.assignedEngineers && site.assignedEngineers.length > 0
  ).length;

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
            <strong>No sites created yet!</strong> Please navigate to the <a href="/admin/sites" style={{ color: "var(--warning-800)", fontWeight: "700", textDecoration: "underline" }}>Construction Sites</a> page to register your first construction site.
          </div>
        </div>
      )}

      {/* Metrics Section */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Construction Sites</span>
            <div className="metric-icon-wrapper info">
              <MapPin size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.totalSites}</div>
          <p className="metric-subtext">Active construction projects</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Site Engineers</span>
            <div className="metric-icon-wrapper success">
              <Users size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.activeEngineers}</div>
          <p className="metric-subtext">Engineers active on field</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Assigned Projects</span>
            <div className="metric-icon-wrapper primary">
              <ClipboardCheck size={20} />
            </div>
          </div>
          <div className="metric-value">{totalAssignedProjects}</div>
          <p className="metric-subtext">Sites with allocated managers</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Today's Attendance Summary</span>
            <div className="metric-icon-wrapper warning">
              <ClipboardCheck size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.attendanceToday}</div>
          <p className="metric-subtext">Present site representatives</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Materials Logged</span>
            <div className="metric-icon-wrapper danger">
              <Package size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.totalMaterials}</div>
          <p className="metric-subtext">Total inventory ledger receipts</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Workers Count</span>
            <div className="metric-icon-wrapper success" style={{ backgroundColor: "var(--success-50)", color: "var(--success-600)" }}>
              <Users size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.activeWorkers}</div>
          <p className="metric-subtext">Labor personnel at sites</p>
        </div>
      </div>

      {/* Projects & Site Assignments Overview Section */}
      <div className="dashboard-details" style={{ marginTop: "24px" }}>
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
      </div>

      <Loading show={loading} text="Loading Executive Overview..." />
    </Layout>
  );
}

import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { getDashboardMetrics, getSites, getSiteEngineers } from "../services/firebaseService";
import { MapPin, Users, ClipboardCheck, Package, Building2 } from "lucide-react";
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
            <strong>No sites created yet!</strong> Please navigate to the <Link to="/admin/sites" style={{ color: "var(--warning-800)", fontWeight: "700", textDecoration: "underline" }}>Construction Sites</Link> page to register your first construction site.
          </div>
        </div>
      )}

      {/* Metrics Section */}
      <div className="metrics-hero-grid">
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
              <ClipboardCheck size={24} />
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

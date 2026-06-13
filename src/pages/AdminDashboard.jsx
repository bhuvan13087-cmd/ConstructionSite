import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { getStoredConfig } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import { seedDefaultSites, getDashboardMetrics } from "../services/firebaseService";
import { MapPin, Users, ClipboardCheck, FileText, Wifi, WifiOff } from "lucide-react";
import Loading from "../components/common/Loading";

export default function AdminDashboard() {
  const { user, userProfile } = useAuth();
  const [metrics, setMetrics] = useState({
    totalSites: 0,
    activeEngineers: 0,
    attendanceToday: 0,
    totalExpenses: 0,
    dailyUpdates: 0
  });
  const [loading, setLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

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
      await seedDefaultSites();
      const counts = await getDashboardMetrics();
      setMetrics(counts);
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

  return (
    <Layout title="Overview Dashboard" description="Real-time status of the Civil Construction Site control systems.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
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
            <span className="metric-title">Total Expenses</span>
            <div className="metric-icon-wrapper danger">
              <span style={{ fontSize: "18px", fontWeight: "bold" }}>₹</span>
            </div>
          </div>
          <div className="metric-value">₹ {metrics.totalExpenses.toLocaleString("en-IN")}</div>
          <p className="metric-subtext">Total site expenses recorded</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Daily Updates</span>
            <div className="metric-icon-wrapper primary">
              <FileText size={20} />
            </div>
          </div>
          <div className="metric-value">{metrics.dailyUpdates}</div>
          <p className="metric-subtext">Daily site logs submitted</p>
        </div>
      </div>

      {/* Connection Properties Panel */}
      <div className="dashboard-details">
        <div className="detail-card" style={{ width: "100%" }}>
          <div className="card-header-accent">
            <h3>Database Connection Details</h3>
            {isOnline ? (
              <span className="badge badge-success">
                <Wifi size={12} style={{ marginRight: "4px" }} /> Live
              </span>
            ) : (
              <span className="badge badge-danger">
                <WifiOff size={12} style={{ marginRight: "4px" }} /> Offline
              </span>
            )}
          </div>
          <div className="card-body" style={{ padding: "0" }}>
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
                      <span className="badge badge-success" style={{ padding: "4px 8px" }}>Live Connection</span>
                    ) : (
                      <span className="badge badge-danger" style={{ padding: "4px 8px" }}>Offline / Connection Error</span>
                    )}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
      <Loading show={loading} text="Loading Dashboard..." />
    </Layout>
  );
}

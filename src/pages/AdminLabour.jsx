import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { getSites, getLabourDailyCountsSummary } from "../services/firebaseService";
import { Users, MapPin } from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";

export default function AdminLabour() {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [labourHistory, setLabourHistory] = useState([]);
  const [loading, setLoading] = useState(false);
  const [labourLoading, setLabourLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    const loadSites = async () => {
      try {
        setLoading(true);
        const fetchedSites = await getSites();
        setSites(fetchedSites);
        if (fetchedSites.length > 0) {
          setSelectedSiteId(fetchedSites[0].id);
        }
      } catch (err) {
        console.error("Failed to load sites:", err);
        showToast(`Failed to load sites: ${err.message}`, "error");
      } finally {
        setLoading(false);
      }
    };
    loadSites();
  }, []);

  useEffect(() => {
    const fetchLabourData = async () => {
      if (!selectedSiteId) return;
      setLabourLoading(true);
      try {
        const history = await getLabourDailyCountsSummary(selectedSiteId);
        setLabourHistory(history);
      } catch (err) {
        console.error("Failed to load labour logs:", err);
        showToast(`Failed to load logs: ${err.message}`, "error");
      } finally {
        setLabourLoading(false);
      }
    };
    fetchLabourData();
  }, [selectedSiteId]);

  return (
    <Layout 
      title="Labour Audits & Supervision" 
      description="Supervise daily headcount records for trade groups (Masons, Helpers, Electricians, Plumbers) registered on active sites."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        {/* Controls Card */}
        <Card title="Supervision Filter" subtitle="Select a construction site to view registered trade logs">
          <div className="form-group" style={{ maxWidth: "400px", margin: 0 }}>
            <label htmlFor="site-select">Select Construction Site</label>
            <div className="input-wrapper" style={{ marginTop: "4px" }}>
              <MapPin className="input-icon" size={16} />
              <select
                id="site-select"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "12px 14px 12px 40px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontWeight: 600,
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {sites.length === 0 ? (
                  <option value="">No sites available</option>
                ) : (
                  sites.map(site => (
                    <option key={site.id} value={site.id}>{site.siteName} ({site.location})</option>
                  ))
                )}
              </select>
            </div>
          </div>
        </Card>

        {/* Logs Table Card */}
        <Card 
          variant="table" 
          title="Daily Worker Headcount History"
          headerActions={
            labourLoading ? (
              <Badge status="pending">Loading...</Badge>
            ) : (
              <Badge status="success">{labourHistory.length} Days Logged</Badge>
            )
          }
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

      <Loading show={loading} text="Loading labour dashboard..." />
    </Layout>
  );
}

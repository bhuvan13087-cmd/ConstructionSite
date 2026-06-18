import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { getSites, getMaterialsDetailed } from "../services/firebaseService";
import { Package, ExternalLink, MapPin } from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";

export default function AdminMaterials() {
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [materials, setMaterials] = useState([]);
  const [loading, setLoading] = useState(false);
  const [materialsLoading, setMaterialsLoading] = useState(false);
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
    const fetchMaterials = async () => {
      if (!selectedSiteId) return;
      setMaterialsLoading(true);
      try {
        const logs = await getMaterialsDetailed(selectedSiteId);
        setMaterials(logs);
      } catch (err) {
        console.error("Failed to load material logs:", err);
        showToast(`Failed to load logs: ${err.message}`, "error");
      } finally {
        setMaterialsLoading(false);
      }
    };
    fetchMaterials();
  }, [selectedSiteId]);

  return (
    <Layout 
      title="Material Tracking & Audits" 
      description="Monitor and audit material ledger entries, supply counts, and receipt documentation registered by field engineers."
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
        <Card title="Audit Filter" subtitle="Select a construction site to view logged material shipments">
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
          title="Material Supply Logs"
          headerActions={
            materialsLoading ? (
              <Badge status="pending">Syncing...</Badge>
            ) : (
              <Badge status="success">{materials.length} Entries Logged</Badge>
            )
          }
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
              {materials.length === 0 ? (
                <tr>
                  <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                    {materialsLoading ? "Synchronizing material records..." : "No material receipts recorded for this site."}
                  </td>
                </tr>
              ) : (
                materials.map((mat) => (
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
                ))
              )}
            </tbody>
          </table>
        </Card>
      </div>

      <Loading show={loading} text="Loading materials dashboard..." />
    </Layout>
  );
}

import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  getSites, 
  getSiteEngineers, 
  getSiteAssignmentsDetailed, 
  assignEngineerToSite, 
  removeEngineerFromSite 
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import { 
  Plus, 
  Trash2, 
  UserCheck, 
  MapPin, 
  User
} from "lucide-react";

export default function SiteAssignments() {
  const { user } = useAuth();
  
  // State variables
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Form fields
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedEngineerId, setSelectedEngineerId] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      
      // Fetch sites, engineers, and detailed assignments list
      const fetchedSites = await getSites();
      setSites(fetchedSites);

      const fetchedEngineers = await getSiteEngineers();
      setEngineers(fetchedEngineers);

      const fetchedAssignments = await getSiteAssignmentsDetailed();
      setAssignments(fetchedAssignments);

      // Pre-select first values in dropdowns if available
      if (fetchedSites.length > 0) {
        setSelectedSiteId(prev => prev || fetchedSites[0].id);
      }
      // Filter for active engineers in the dropdown selection
      const activeEngineers = fetchedEngineers.filter(eng => eng.status === "active");
      if (activeEngineers.length > 0) {
        setSelectedEngineerId(prev => prev || activeEngineers[0].id);
      }

    } catch (err) {
      console.error("Assignments data loading failed:", err);
      if (err.code === "permission-denied") {
        showToast("Access Denied: You do not have permission to view site assignments.", "error");
      } else if (err.code === "unavailable" || err.message?.includes("offline")) {
        showToast("Database Connection Error: Please verify network status.", "error");
      } else {
        showToast(`Failed to load data: ${err.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Handle new assignment submission
  const handleAssignSubmit = async (e) => {
    e.preventDefault();

    if (!selectedSiteId) {
      showToast("Please select a construction site.", "error");
      return;
    }
    if (!selectedEngineerId) {
      showToast("Please select a site engineer.", "error");
      return;
    }

    // Validation: Verify if site selection exists
    const site = sites.find(s => s.id === selectedSiteId);
    if (!site) {
      showToast("Selected site is invalid.", "error");
      return;
    }

    // Validation: Verify if engineer selection is active
    const engineer = engineers.find(eng => eng.id === selectedEngineerId);
    if (!engineer) {
      showToast("Selected engineer does not exist.", "error");
      return;
    }
    if (engineer.status !== "active") {
      showToast("Cannot assign: Selected engineer is inactive.", "error");
      return;
    }

    // Validation: Check for duplicate assignments
    const isDuplicate = assignments.some(
      asg => asg.siteId === selectedSiteId && asg.engineerId === selectedEngineerId && asg.status === "active"
    );
    if (isDuplicate) {
      showToast(`This engineer is already assigned to "${site.siteName}".`, "error");
      return;
    }

    setLoading(true);
    try {
      const adminId = user?.uid || "admin";
      await assignEngineerToSite(selectedSiteId, selectedEngineerId, adminId);
      showToast("Site assignment created successfully!", "success");
      await loadData();
    } catch (err) {
      console.error("Assignment submission error:", err);
      if (err.code === "permission-denied") {
        showToast("Permission Denied: Only admins can assign engineers to sites.", "error");
      } else {
        showToast(err.message || "Failed to create assignment.", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  // Handle assignment removal
  const handleRemoveAssignment = async (asg) => {
    const confirmMessage = `Are you sure you want to remove "${asg.engineerName}" from "${asg.siteName}"?`;
    if (confirm(confirmMessage)) {
      setLoading(true);
      try {
        await removeEngineerFromSite(asg.id);
        showToast("Assignment removed successfully.", "success");
        await loadData();
      } catch (err) {
        console.error("Assignment deletion failed:", err);
        if (err.code === "permission-denied") {
          showToast("Permission Denied: Only admins can manage site allocations.", "error");
        } else {
          showToast(err.message || "Failed to delete assignment.", "error");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  // Filter for active engineers to prevent selecting inactive ones
  const activeEngineersList = engineers.filter(eng => eng.status === "active");

  return (
    <Layout title="Site Assignments" description="Manage construction site allocations for registered field engineers.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="assignment-grid">
        
        {/* LEFT COLUMN: Create Site Assignment Form */}
        <Card 
          variant="accent"
          title="Assign Engineer to Site"
        >
          <form onSubmit={handleAssignSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="assignment-site-select">Select Construction Site</label>
              <div className="input-wrapper" style={{ marginTop: "4px" }}>
                <MapPin className="input-icon" size={16} />
                <select
                  id="assignment-site-select"
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
                    <option value="">No sites registered</option>
                  ) : (
                    sites.map(site => (
                      <option key={site.id} value={site.id}>{site.siteName} ({site.location})</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="assignment-engineer-select">Select Active Engineer</label>
              <div className="input-wrapper" style={{ marginTop: "4px" }}>
                <User className="input-icon" size={16} />
                <select
                  id="assignment-engineer-select"
                  value={selectedEngineerId}
                  onChange={(e) => setSelectedEngineerId(e.target.value)}
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
                  {activeEngineersList.length === 0 ? (
                    <option value="">No active engineers available</option>
                  ) : (
                    activeEngineersList.map(eng => (
                      <option key={eng.id} value={eng.id}>{eng.fullName}</option>
                    ))
                  )}
                </select>
              </div>
            </div>

            <Button 
              type="submit" 
              icon={Plus}
              disabled={sites.length === 0 || activeEngineersList.length === 0}
              style={{ width: "100%", marginTop: "8px" }}
            >
              Create Assignment
            </Button>
          </form>
        </Card>

        {/* RIGHT COLUMN: Active Assignments table */}
        <Card variant="table" title="Active Site Allocations">
          <table className="data-table" style={{ margin: "0" }}>
            <thead>
              <tr>
                <th>Site Name</th>
                <th>Assigned Engineer</th>
                <th>Assignment Status</th>
                <th>Assigned Date</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                    No active site assignments found. Use the form to assign engineers.
                  </td>
                </tr>
              ) : (
                assignments.map((asg) => {
                  const assignedDateStr = asg.assignedAt
                    ? (asg.assignedAt.seconds
                        ? new Date(asg.assignedAt.seconds * 1000).toLocaleDateString()
                        : new Date(asg.assignedAt).toLocaleDateString())
                    : "N/A";

                  return (
                    <tr key={asg.id}>
                      <td style={{ fontWeight: 700 }}>{asg.siteName}</td>
                      <td>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--primary-800)" }}>{asg.engineerName}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "var(--font-family-body)" }}>{asg.engineerEmail}</div>
                        </div>
                      </td>
                      <td>
                        <Badge status={asg.status} />
                      </td>
                      <td className="font-mono">{assignedDateStr}</td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                          <button 
                            onClick={() => handleRemoveAssignment(asg)} 
                            className="btn-icon" 
                            title="Remove Assignment" 
                            style={{ color: "var(--danger-500)", width: "32px", height: "32px" }}
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </Card>

      </div>

      <Loading show={loading} text="Updating assignments..." />
    </Layout>
  );
}

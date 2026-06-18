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
import Modal from "../components/common/Modal";
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
  const [showAssignModal, setShowAssignModal] = useState(false);
  
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
      setShowAssignModal(false);
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

      {/* Toolbar actions */}
      <div className="subview-actions-header" style={{ justifyContent: "flex-end", marginBottom: "16px" }}>
        <Button onClick={() => setShowAssignModal(true)} id="btn-assign-engineer" icon={UserCheck} className="btn-add">
          Assign Engineer to Site
        </Button>
      </div>

      {/* Full width Active Assignments table */}
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
                  No active site assignments found. Click "Assign Engineer to Site" to make one.
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

      {/* MODAL: ASSIGN ENGINEER TO SITE */}
      <Modal
        isOpen={showAssignModal}
        onClose={() => setShowAssignModal(false)}
        title="Assign Engineer to Site"
        maxWidth="480px"
      >
        <form onSubmit={handleAssignSubmit} style={{ margin: 0, padding: 0 }}>
          <div className="form-group">
            <label htmlFor="assignment-site-select">Select Construction Site</label>
            <div className="input-wrapper" style={{ marginTop: "4px" }}>
              <MapPin className="input-icon" size={16} />
              <select
                id="assignment-site-select"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                required
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
                <option value="" disabled>-- Choose a Site --</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.siteName} ({site.location})</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group" style={{ marginTop: "16px" }}>
            <label htmlFor="assignment-engineer-select">Select Active Engineer</label>
            <div className="input-wrapper" style={{ marginTop: "4px" }}>
              <User className="input-icon" size={16} />
              <select
                id="assignment-engineer-select"
                value={selectedEngineerId}
                onChange={(e) => setSelectedEngineerId(e.target.value)}
                required
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
                <option value="" disabled>-- Choose an Engineer --</option>
                {activeEngineersList.map(eng => (
                  <option key={eng.id} value={eng.id}>{eng.fullName}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="modal-actions" style={{ margin: "24px -24px -24px -24px" }}>
            <Button variant="outline" onClick={() => setShowAssignModal(false)}>Cancel</Button>
            <Button 
              type="submit" 
              icon={Plus}
              disabled={sites.length === 0 || activeEngineersList.length === 0}
            >
              Assign Engineer
            </Button>
          </div>
        </form>
      </Modal>

      <Loading show={loading} text="Updating assignments..." />
    </Layout>
  );
}

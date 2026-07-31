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
  User,
  Search,
  Building2,
  Users,
  Layers
} from "lucide-react";

export default function SiteAssignments() {
  const { user, userProfile } = useAuth();
  
  // Custom Confirmation Modal state
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    details: null,
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "danger",
    onConfirm: null,
    isLoading: false
  });

  const showConfirmModal = (config) => {
    setConfirmModalState({
      isOpen: true,
      title: config.title || "Confirm Action",
      message: config.message || "Are you sure you want to proceed?",
      details: config.details || null,
      confirmText: config.confirmText || "Confirm",
      cancelText: config.cancelText || "Cancel",
      variant: config.variant || "danger",
      onConfirm: config.onConfirm || null,
      isLoading: false
    });
  };

  const closeConfirmModal = () => {
    setConfirmModalState(prev => ({ ...prev, isOpen: false, onConfirm: null }));
  };
  
  // State variables
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  
  // Search states
  const [siteSearchQuery, setSiteSearchQuery] = useState("");
  const [engineerSearchQuery, setEngineerSearchQuery] = useState("");
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState("");
  
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 5000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const adminId = userProfile?.uid || userProfile?.id || null;
      
      // Fetch sites, engineers, and detailed assignments list
      const fetchedSites = await getSites(adminId);
      setSites(fetchedSites);

      const fetchedEngineers = await getSiteEngineers(adminId);
      setEngineers(fetchedEngineers);

      const fetchedAssignments = await getSiteAssignmentsDetailed();
      setAssignments(fetchedAssignments);

      // Pre-select first values in list if available
      if (fetchedSites.length > 0) {
        setSelectedSiteId(prev => prev || fetchedSites[0].id);
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

  // Handle engineer assignment
  const handleAssign = async (siteId, engineerId) => {
    if (!siteId) {
      showToast("Please select a construction site.", "error");
      return;
    }
    if (!engineerId) {
      showToast("Please select a site engineer.", "error");
      return;
    }

    // Validation: Verify if site selection exists
    const site = sites.find(s => s.id === siteId);
    if (!site) {
      showToast("Selected site is invalid.", "error");
      return;
    }

    // Validation: Verify if engineer selection is active
    const engineer = engineers.find(eng => eng.id === engineerId);
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
      asg => asg.siteId === siteId && asg.engineerId === engineerId && asg.status === "active"
    );
    if (isDuplicate) {
      showToast(`This engineer is already assigned to "${site.siteName}".`, "error");
      return;
    }

    setLoading(true);
    try {
      const adminId = user?.uid || "admin";
      await assignEngineerToSite(siteId, engineerId, adminId);
      showToast(`Assigned ${engineer.fullName} to "${site.siteName}" successfully!`, "success");
      setSelectedEngineerId("");
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
    showConfirmModal({
      title: "Remove Site Assignment?",
      message: `Are you sure you want to remove "${asg.engineerName}" from "${asg.siteName}"?`,
      confirmText: "Remove Assignment",
      variant: "danger",
      onConfirm: async () => {
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
          closeConfirmModal();
        }
      }
    });
  };

  // Helper function to extract name initials
  const getInitials = (name) => {
    if (!name) return "EE";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Helper function to calculate engineer active projects workload
  const getWorkload = (engineerId) => {
    return assignments.filter(
      asg => asg.engineerId === engineerId && asg.status === "active"
    ).length;
  };

  // Filter lists based on search queries
  const activeEngineersList = engineers.filter(eng => eng.status === "active");

  const filteredSites = sites.filter(site => {
    const query = siteSearchQuery.toLowerCase().trim();
    return (
      site.siteName?.toLowerCase().includes(query) ||
      site.clientName?.toLowerCase().includes(query) ||
      site.location?.toLowerCase().includes(query)
    );
  });

  const filteredEngineers = activeEngineersList.filter(eng => {
    const query = engineerSearchQuery.toLowerCase().trim();
    return (
      eng.fullName?.toLowerCase().includes(query) ||
      eng.email?.toLowerCase().includes(query) ||
      eng.phoneNumber?.toLowerCase().includes(query)
    );
  });

  const filteredAssignments = assignments.filter(asg => {
    const query = assignmentSearchQuery.toLowerCase().trim();
    return (
      asg.siteName?.toLowerCase().includes(query) ||
      asg.engineerName?.toLowerCase().includes(query) ||
      asg.engineerEmail?.toLowerCase().includes(query) ||
      asg.location?.toLowerCase().includes(query)
    );
  });

  const selectedSite = sites.find(s => s.id === selectedSiteId);
  const selectedSiteAllocations = assignments.filter(
    asg => asg.siteId === selectedSiteId && asg.status === "active"
  );

  return (
    <Layout title="Site Assignments" description="Configure construction site allocations and manage field engineer deployments.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── 1. ENTERPRISE QUICK ASSIGNMENT BAR ── */}
      <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "20px 24px", marginBottom: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={18} style={{ color: "#f97316" }} /> Deploy Engineer to Site
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>Select a construction site and field engineer to establish site allocation</p>
          </div>
          <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", backgroundColor: "#f1f5f9", padding: "4px 10px", borderRadius: "20px" }}>
            {activeEngineersList.length} Active Engineers Available
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "16px", alignItems: "end" }}>
          {/* Site Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="assign-site-select" style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Construction Site</label>
            <select
              id="assign-site-select"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0f172a",
                outline: "none"
              }}
            >
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.siteName} ({s.location || "Location N/A"})
                </option>
              ))}
            </select>
          </div>

          {/* Engineer Select */}
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="assign-eng-select" style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Site Engineer</label>
            <select
              id="assign-eng-select"
              value={selectedEngineerId}
              onChange={(e) => setSelectedEngineerId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                fontWeight: "600",
                color: "#0f172a",
                outline: "none"
              }}
            >
              <option value="">-- Choose Engineer to Assign --</option>
              {activeEngineersList.map(eng => {
                const workload = getWorkload(eng.id);
                return (
                  <option key={eng.id} value={eng.id}>
                    {eng.fullName} ({workload} active site{workload === 1 ? "" : "s"})
                  </option>
                );
              })}
            </select>
          </div>

          {/* Action Button */}
          <div>
            <Button
              variant="primary"
              onClick={() => handleAssign(selectedSiteId, selectedEngineerId)}
              icon={Plus}
              style={{ padding: "10px 20px", height: "42px", fontWeight: "700", fontSize: "13px" }}
            >
              Assign Engineer
            </Button>
          </div>
        </div>
      </Card>



      {/* ── 3. MAIN WORKSPACE (SITE TEAMS + ALLOCATIONS TABLE) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "38% 60%", gap: "2%", marginBottom: "20px" }}>
        
        {/* LEFT COLUMN: SITE-WISE TEAM ALLOCATIONS */}
        <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px", display: "flex", flexDirection: "column", height: "560px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                <Building2 size={16} style={{ color: "#ea580c" }} /> Site Deployment Teams
              </h3>
              <span style={{ fontSize: "11px", color: "#64748b" }}>Site-wise assigned engineers list</span>
            </div>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#ea580c", backgroundColor: "#fff7ed", padding: "2px 8px", borderRadius: "100px" }}>
              {sites.length} Sites
            </span>
          </div>

          {/* Search */}
          <div className="input-wrapper" style={{ marginBottom: "12px" }}>
            <Search className="input-icon" size={15} />
            <input 
              type="text" 
              placeholder="Filter site..."
              value={siteSearchQuery}
              onChange={(e) => setSiteSearchQuery(e.target.value)}
              style={{ paddingLeft: "38px", fontSize: "12.5px" }}
            />
          </div>

          {/* Site Teams Roster */}
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "12px", paddingRight: "4px" }}>
            {filteredSites.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "20px", fontSize: "12px" }}>No matching sites found.</div>
            ) : (
              filteredSites.map(site => {
                const siteEngineers = assignments.filter(a => a.siteId === site.id && a.status === "active");
                const isSelected = site.id === selectedSiteId;

                return (
                  <div 
                    key={site.id} 
                    style={{ 
                      border: isSelected ? "1.5px solid #f97316" : "1px solid #e2e8f0", 
                      borderRadius: "10px", 
                      backgroundColor: isSelected ? "#fff7ed" : "#f8fafc",
                      padding: "12px 14px",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div 
                      onClick={() => setSelectedSiteId(site.id)}
                      style={{ cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}
                    >
                      <div>
                        <strong style={{ fontSize: "13px", color: "#0f172a" }}>{site.siteName}</strong>
                        <span style={{ display: "block", fontSize: "11px", color: "#64748b" }}>
                          <MapPin size={10} style={{ display: "inline", marginRight: "2px" }} /> {site.location}
                        </span>
                      </div>
                      <Badge status={site.status || "active"} />
                    </div>

                    {/* Assigned Personnel */}
                    {siteEngineers.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px", paddingTop: "8px", borderTop: "1px solid #cbd5e1" }}>
                        {siteEngineers.map(asg => (
                          <div 
                            key={asg.id} 
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "10px" }}>
                                {getInitials(asg.engineerName)}
                              </div>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>{asg.engineerName}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => handleRemoveAssignment(asg)}
                              style={{ color: "#ef4444", background: "none", border: "none", cursor: "pointer", padding: "2px" }}
                              title="Unassign Engineer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ display: "block", fontSize: "11px", color: "#94a3b8", fontStyle: "italic", marginTop: "4px" }}>
                        No engineer assigned yet. Select above to assign.
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* RIGHT COLUMN: ALLOCATIONS TABLE */}
        <Card variant="table" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden", display: "flex", flexDirection: "column", height: "560px" }}>
          <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>Active Site Allocations</h3>
              <span style={{ fontSize: "11.5px", color: "#64748b" }}>
                {filteredAssignments.length} total active assignment record(s)
              </span>
            </div>

            <div className="input-wrapper" style={{ width: "220px" }}>
              <Search className="input-icon" size={14} />
              <input 
                type="text" 
                placeholder="Search assignments..."
                value={assignmentSearchQuery}
                onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                style={{ paddingLeft: "34px", fontSize: "12px" }}
              />
            </div>
          </div>

          <div style={{ overflowX: "auto", flex: 1 }}>
            <table className="modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Site Name</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Assigned Engineer</th>
                  <th style={{ padding: "10px 14px", textAlign: "center", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Status</th>
                  <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Assigned Date</th>
                  <th style={{ padding: "10px 14px", textAlign: "right", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: "32px", fontSize: "12.5px" }}>
                      No active site allocations found.
                    </td>
                  </tr>
                ) : (
                  filteredAssignments.map((asg) => {
                    const assignedDateStr = asg.assignedAt
                      ? (asg.assignedAt.seconds
                          ? new Date(asg.assignedAt.seconds * 1000).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })
                          : new Date(asg.assignedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }))
                      : "Today";

                    return (
                      <tr key={asg.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px" }}>
                          <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block" }}>{asg.siteName}</strong>
                          <span style={{ fontSize: "10.5px", color: "#64748b" }}>{asg.location || "Site Location"}</span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "26px", height: "26px", borderRadius: "50%", backgroundColor: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "10px" }}>
                              {getInitials(asg.engineerName)}
                            </div>
                            <div>
                              <strong style={{ fontSize: "12px", color: "#0f172a", display: "block" }}>{asg.engineerName}</strong>
                              <span style={{ fontSize: "10px", color: "#64748b" }}>{asg.engineerEmail || "Engineer"}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <Badge status={asg.status || "active"} />
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "11px", color: "#64748b", fontFamily: "monospace" }}>
                          {assignedDateStr}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <button 
                            onClick={() => handleRemoveAssignment(asg)} 
                            className="btn-icon" 
                            title="Remove Allocation" 
                            style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", padding: "4px" }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </Card>

      </div>

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />

      <Loading show={loading} text="Updating assignments..." />
    </Layout>
  );
}

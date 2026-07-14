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
    <Layout title="Site Assignments" description="Manage construction site allocations for registered field engineers.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Metrics Row */}
      <div className="erp-kpi-grid" style={{ marginBottom: "24px" }}>
        <div className="erp-kpi-card" style={{ borderLeft: "4px solid var(--primary-500)" }}>
          <div className="erp-kpi-content">
            <span className="erp-kpi-label">Total Registered Sites</span>
            <span className="erp-kpi-num">{sites.length}</span>
            <span className="erp-kpi-footer">Registered project sites</span>
          </div>
        </div>

        <div className="erp-kpi-card" style={{ borderLeft: "4px solid var(--success-500)" }}>
          <div className="erp-kpi-content">
            <span className="erp-kpi-label">Active Field Engineers</span>
            <span className="erp-kpi-num">{activeEngineersList.length}</span>
            <span className="erp-kpi-footer">Field staff ready for assignments</span>
          </div>
        </div>

        <div className="erp-kpi-card" style={{ borderLeft: "4px solid var(--warning-500)" }}>
          <div className="erp-kpi-content">
            <span className="erp-kpi-label">Active Allocations</span>
            <span className="erp-kpi-num">{assignments.length}</span>
            <span className="erp-kpi-footer">Allocated project roles</span>
          </div>
        </div>
      </div>

      {/* Main Allocation Workspace */}
      <div className="assignments-workflow-container" style={{ marginBottom: "24px" }}>
        
        {/* Column 1: Construction Sites List */}
        <Card 
          variant="accent" 
          title="1. Select Project Site" 
          subtitle="Click a site card to review team assignments."
          style={{ height: "fit-content", maxHeight: "650px", display: "flex", flexDirection: "column" }}
        >
          <div className="sites-select-card" style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflow: "hidden" }}>
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search sites..."
                value={siteSearchQuery}
                onChange={(e) => setSiteSearchQuery(e.target.value)}
              />
            </div>

            <div className="site-picker-list" style={{ overflowY: "auto", flex: 1, maxHeight: "480px" }}>
              {filteredSites.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                  No construction sites match query.
                </div>
              ) : (
                filteredSites.map((site) => {
                  const isActive = site.id === selectedSiteId;
                  const assignedCount = assignments.filter(
                    asg => asg.siteId === site.id && asg.status === "active"
                  ).length;
                  
                  return (
                    <div 
                      key={site.id} 
                      className={`site-picker-item ${isActive ? "active" : ""}`}
                      onClick={() => { setSelectedSiteId(site.id); setSelectedEngineerId(""); }}
                      style={{ cursor: "pointer", padding: "12px", borderBottom: "1px solid var(--border-color)", borderLeft: isActive ? "4px solid var(--accent-600)" : "4px solid transparent" }}
                    >
                      <div className="site-picker-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                        <span className="site-picker-name" style={{ fontWeight: 700, fontSize: "13.5px" }}>{site.siteName}</span>
                        <Badge status={site.status || "Planning"} />
                      </div>
                      <div className="site-picker-meta" style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                        <div className="site-picker-loc" style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={11} />
                          <span>{site.location}</span>
                        </div>
                        <span style={{ fontWeight: 650, color: assignedCount > 0 ? "var(--accent-700)" : "var(--text-muted)" }}>
                          {assignedCount} {assignedCount === 1 ? "Staff" : "Staff"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        {/* Column 2: Assignment Workbench */}
        <Card 
          variant="accent" 
          title="2. Assignment Workbench" 
          subtitle="Configure personnel allocation and inspect site workloads."
        >
          {selectedSite ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
              {/* Selected site information banner */}
              <div style={{ padding: "16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <h4 style={{ margin: "0 0 6px 0", fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>{selectedSite.siteName}</h4>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", color: "var(--text-muted)", fontSize: "12px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={13} /> {selectedSite.location}
                  </span>
                  <span>Client: <strong>{selectedSite.clientName}</strong></span>
                </div>
              </div>

              {/* Workbench Actions */}
              <div style={{ padding: "20px", border: "2px dashed var(--border-color)", borderRadius: "8px", backgroundColor: "#fafbfc", textAlign: "center" }}>
                {selectedEngineerId && engineers.find(eng => eng.id === selectedEngineerId) ? (
                  (() => {
                    const selectedEngineer = engineers.find(eng => eng.id === selectedEngineerId);
                    return (
                      <div>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "12px" }}>
                          <div className="avatar-initials info" style={{ width: "40px", height: "40px", fontSize: "14px" }}>
                            {getInitials(selectedEngineer.fullName)}
                          </div>
                          <div style={{ textAlign: "left" }}>
                            <strong style={{ display: "block", color: "var(--primary-950)", fontSize: "14px" }}>{selectedEngineer.fullName}</strong>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{selectedEngineer.email}</span>
                          </div>
                        </div>

                        <p style={{ fontSize: "13px", color: "var(--primary-800)", margin: "0 0 16px 0", lineHeight: "1.4" }}>
                          Ready to assign <strong>{selectedEngineer.fullName}</strong> to <strong>{selectedSite.siteName}</strong>. 
                          Workload: {getWorkload(selectedEngineer.id)} &rarr; {getWorkload(selectedEngineer.id) + 1} active projects.
                        </p>

                        <div style={{ display: "flex", justifyContent: "center", gap: "10px" }}>
                          <Button 
                            variant="primary"
                            onClick={() => handleAssign(selectedSiteId, selectedEngineerId)}
                            icon={Plus}
                          >
                            Confirm Assignment
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setSelectedEngineerId("")}
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div>
                    <div style={{ display: "inline-flex", padding: "10px", borderRadius: "50%", backgroundColor: "var(--primary-50)", color: "var(--primary-600)", marginBottom: "10px" }}>
                      <UserCheck size={24} />
                    </div>
                    <h5 style={{ margin: "0 0 4px 0", fontSize: "14px", fontWeight: "750", color: "var(--primary-900)" }}>Assign Personnel</h5>
                    <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                      Select a field engineer from the roster on the right to configure site placement.
                    </p>
                  </div>
                )}
              </div>

              {/* Current site allocations */}
              <div>
                <strong style={{ fontSize: "11px", fontWeight: 750, color: "var(--primary-700)", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>
                  Current Site Team ({selectedSiteAllocations.length})
                </strong>
                {selectedSiteAllocations.length > 0 ? (
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {selectedSiteAllocations.map(asg => (
                      <div 
                        key={asg.id} 
                        style={{ 
                          display: "flex", 
                          alignItems: "center", 
                          justifyContent: "space-between",
                          backgroundColor: "#ffffff", 
                          border: "1px solid var(--border-color)",
                          padding: "10px 14px",
                          borderRadius: "6px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div className="avatar-initials info" style={{ width: "28px", height: "28px", fontSize: "10.5px" }}>
                            {getInitials(asg.engineerName)}
                          </div>
                          <div>
                            <span style={{ fontSize: "13px", fontWeight: 650, color: "var(--primary-900)" }}>{asg.engineerName}</span>
                            <span style={{ display: "block", fontSize: "10px", color: "var(--text-muted)" }}>{asg.engineerEmail}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(asg); }} 
                          className="btn-icon" 
                          style={{ color: "var(--danger-500)", border: "none", background: "none", cursor: "pointer" }}
                          title="Remove assignment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "16px", border: "1px dashed var(--border-color)", borderRadius: "6px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                    No engineer team members allocated.
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="empty-state-container">
              <div className="empty-state-icon">
                <Layers size={28} />
              </div>
              <h4 className="empty-state-title">Select a Construction Project</h4>
              <p className="empty-state-text">
                Please select a construction site from the list on the left to begin managing engineers allocation.
              </p>
            </div>
          )}
        </Card>

        {/* Column 3: Site Engineers Roster */}
        <Card 
          variant="accent" 
          title="3. Available Field Staff" 
          subtitle="Roster of active civil engineers for deployment."
          style={{ height: "fit-content", maxHeight: "650px", display: "flex", flexDirection: "column" }}
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "10px", flex: 1, overflow: "hidden" }}>
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search staff..."
                value={engineerSearchQuery}
                onChange={(e) => setEngineerSearchQuery(e.target.value)}
              />
            </div>

            <div className="engineer-picker-list" style={{ overflowY: "auto", flex: 1, maxHeight: "480px", display: "flex", flexDirection: "column", gap: "8px" }}>
              {filteredEngineers.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                  No engineers match query.
                </div>
              ) : (
                filteredEngineers.map((eng) => {
                  const isAssigned = selectedSiteAllocations.some(asg => asg.engineerId === eng.id);
                  const isSelected = eng.id === selectedEngineerId;
                  const workloadCount = getWorkload(eng.id);
                  
                  return (
                    <div 
                      key={eng.id} 
                      className={`engineer-picker-card ${isSelected ? "selected" : ""}`}
                      onClick={() => {
                        if (!isAssigned && selectedSiteId) {
                          setSelectedEngineerId(eng.id);
                        }
                      }}
                      style={{ 
                        cursor: isAssigned ? "not-allowed" : "pointer", 
                        padding: "10px", 
                        borderRadius: "6px", 
                        border: isSelected ? "2px solid var(--accent-600)" : "1px solid var(--border-color)",
                        backgroundColor: isAssigned ? "#f1f5f9" : (isSelected ? "var(--accent-50)" : "#ffffff"),
                        opacity: isAssigned ? 0.7 : 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between"
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <div className="avatar-initials info" style={{ width: "32px", height: "32px", fontSize: "11px" }}>
                          {getInitials(eng.fullName)}
                        </div>
                        <div>
                          <strong style={{ fontSize: "13px", color: "var(--primary-900)", display: "block" }}>{eng.fullName}</strong>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)", display: "block" }}>Workload: {workloadCount} site(s)</span>
                        </div>
                      </div>

                      <div>
                        {isAssigned ? (
                          <span style={{ fontSize: "11px", color: "var(--success-600)", fontWeight: "700" }}>Assigned</span>
                        ) : isSelected ? (
                          <span style={{ fontSize: "11px", color: "var(--accent-600)", fontWeight: "700" }}>Selected</span>
                        ) : (
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Deploy &rarr;</span>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>
      </div>

      {/* Bottom Card: Allocations List Table */}
      <Card variant="table" title="Active Site Allocations">
        <div style={{ padding: "0 24px 16px 24px" }}>
          <div className="assignments-table-header">
            <span className="field-hint" style={{ textTransform: "none", margin: 0 }}>
              Showing {filteredAssignments.length} allocation {filteredAssignments.length === 1 ? "record" : "records"}.
            </span>
            <div className="input-wrapper assignments-search-wrapper">
              <Search className="input-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search allocations by project, engineer name, email..."
                value={assignmentSearchQuery}
                onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                style={{ paddingLeft: "40px" }}
              />
            </div>
          </div>
        </div>

        <table className="data-table" style={{ margin: "0" }}>
          <thead>
            <tr>
              <th>Site Name</th>
              <th>Assigned Engineer</th>
              <th>Allocation Status</th>
              <th>Assigned Date</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredAssignments.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No active allocations found matching your search.
                </td>
              </tr>
            ) : (
              filteredAssignments.map((asg) => {
                const assignedDateStr = asg.assignedAt
                  ? (asg.assignedAt.seconds
                      ? new Date(asg.assignedAt.seconds * 1000).toLocaleDateString()
                      : new Date(asg.assignedAt).toLocaleDateString())
                  : "N/A";

                return (
                  <tr key={asg.id}>
                    <td>
                      <div>
                        <div style={{ fontWeight: 700, color: "var(--primary-900)" }}>{asg.siteName}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          <MapPin size={11} />
                          <span>{asg.location}</span>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div className="avatar-initials info" style={{ width: "32px", height: "32px", fontSize: "11px" }}>
                          {getInitials(asg.engineerName)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 700, color: "var(--primary-800)" }}>{asg.engineerName}</div>
                          <div style={{ fontSize: "11px", color: "var(--text-muted)" }}>{asg.engineerEmail}</div>
                        </div>
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
                          title="Remove Allocation" 
                          style={{ color: "var(--danger-500)" }}
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

      <Loading show={loading} text="Updating assignments..." />
    </Layout>
  );
}

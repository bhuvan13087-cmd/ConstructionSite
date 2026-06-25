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
  const { user } = useAuth();
  
  // State variables
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  
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
      
      // Fetch sites, engineers, and detailed assignments list
      const fetchedSites = await getSites();
      setSites(fetchedSites);

      const fetchedEngineers = await getSiteEngineers();
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
      <div className="metrics-grid" style={{ marginBottom: "24px" }}>
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Registered Sites</span>
            <div className="metric-icon-wrapper primary">
              <Building2 size={18} />
            </div>
          </div>
          <div className="metric-value">{sites.length}</div>
          <div className="metric-subtext">Registered project sites</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Field Engineers</span>
            <div className="metric-icon-wrapper success">
              <Users size={18} />
            </div>
          </div>
          <div className="metric-value">{activeEngineersList.length}</div>
          <div className="metric-subtext">Field staff ready for assignments</div>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Active Allocations</span>
            <div className="metric-icon-wrapper warning">
              <UserCheck size={18} />
            </div>
          </div>
          <div className="metric-value">{assignments.length}</div>
          <div className="metric-subtext">Allocated project roles</div>
        </div>
      </div>

      {/* Main Allocation Workspace */}
      <div className="assignments-split-layout" style={{ marginBottom: "24px" }}>
        
        {/* Left Column: Construction Site Selection */}
        <Card 
          variant="accent" 
          title="1. Select Construction Site" 
          subtitle="Search and click a site card to manage team allocation."
        >
          <div className="sites-select-card">
            <div className="search-input-wrapper">
              <Search className="search-icon" size={16} />
              <input 
                type="text" 
                placeholder="Search sites by name, location, or client..."
                value={siteSearchQuery}
                onChange={(e) => setSiteSearchQuery(e.target.value)}
              />
            </div>

            <div className="site-picker-list">
              {filteredSites.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px" }}>
                  No construction sites match search query.
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
                      onClick={() => setSelectedSiteId(site.id)}
                    >
                      <div className="site-picker-header">
                        <span className="site-picker-name">{site.siteName}</span>
                        <Badge status={site.status || "Planning"} />
                      </div>
                      <span className="site-picker-client">Client: {site.clientName || "N/A"}</span>
                      <div className="site-picker-meta">
                        <div className="site-picker-loc">
                          <MapPin size={13} />
                          <span>{site.location}</span>
                        </div>
                        <span style={{ fontWeight: 600, color: assignedCount > 0 ? "var(--accent-700)" : "var(--text-muted)" }}>
                          {assignedCount} {assignedCount === 1 ? "Engineer" : "Engineers"}
                        </span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </Card>

        {/* Right Column: Allocate Site Engineer */}
        <Card 
          variant="accent" 
          title="2. Allocate Field Engineer" 
          subtitle="View project team members and assign active field staff."
        >
          {selectedSite ? (
            <div className="engineers-selection-card">
              
              {/* Selected site details banner */}
              <div className="selected-site-banner">
                <h4>{selectedSite.siteName}</h4>
                <div style={{ display: "flex", gap: "16px", color: "var(--text-muted)", fontSize: "12px", marginTop: "4px" }}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <MapPin size={13} /> {selectedSite.location}
                  </span>
                  <span>|</span>
                  <span>Client: {selectedSite.clientName}</span>
                </div>
                
                {/* Active site team badges */}
                {selectedSiteAllocations.length > 0 ? (
                  <div style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                    <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-700)", textTransform: "uppercase" }}>
                      Current Team on Site:
                    </span>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                      {selectedSiteAllocations.map(asg => (
                        <div 
                          key={asg.id} 
                          style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            gap: "6px",
                            backgroundColor: "var(--accent-100)", 
                            color: "var(--accent-700)",
                            padding: "4px 10px",
                            borderRadius: "50px",
                            fontSize: "12px",
                            fontWeight: 600
                          }}
                        >
                          <User size={12} />
                          <span>{asg.engineerName}</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(asg); }} 
                            style={{ 
                              background: "none", 
                              border: "none", 
                              color: "var(--accent-700)", 
                              cursor: "pointer", 
                              padding: "0 2px",
                              display: "inline-flex",
                              alignItems: "center",
                              fontWeight: 700
                            }}
                            title="Remove assignment"
                          >
                            ×
                          </button>
                        </div>
                      ))}
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: "8px", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    No engineers assigned to this site yet.
                  </div>
                )}
              </div>

              {/* Engineer Search */}
              <div className="search-input-wrapper">
                <Search className="search-icon" size={16} />
                <input 
                  type="text" 
                  placeholder="Search available engineers by name, email, phone..."
                  value={engineerSearchQuery}
                  onChange={(e) => setEngineerSearchQuery(e.target.value)}
                />
              </div>

              {/* Available Active Engineers Grid */}
              <div className="engineer-picker-grid">
                {filteredEngineers.length === 0 ? (
                  <div style={{ gridColumn: "1 / -1", textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                    No active site engineers match search.
                  </div>
                ) : (
                  filteredEngineers.map((eng) => {
                    const isAssigned = selectedSiteAllocations.some(asg => asg.engineerId === eng.id);
                    const workloadCount = getWorkload(eng.id);
                    const isHighWorkload = workloadCount >= 3;
                    
                    return (
                      <div key={eng.id} className="engineer-picker-card">
                        <div className="engineer-profile-info">
                          <div className="initials-avatar-lg">
                            {getInitials(eng.fullName)}
                          </div>
                          <div className="engineer-picker-details">
                            <span className="engineer-picker-name">{eng.fullName}</span>
                            <span className="engineer-picker-email" title={eng.email}>{eng.email}</span>
                            <span className="engineer-picker-phone">{eng.phoneNumber || "No Phone Contact"}</span>
                          </div>
                        </div>
                        
                        <div className="engineer-card-footer">
                          <span 
                            className={`workload-count-badge ${isHighWorkload ? "high" : ""}`}
                            title={`Assigned to ${workloadCount} site(s)`}
                          >
                            {workloadCount} {workloadCount === 1 ? "site" : "sites"} assigned
                          </span>
                          
                          {isAssigned ? (
                            <span 
                              style={{ 
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "12px", 
                                color: "var(--success-600)", 
                                fontWeight: 700 
                              }}
                            >
                              ✓ Assigned
                            </span>
                          ) : (
                            <Button 
                              size="sm" 
                              onClick={() => handleAssign(selectedSiteId, eng.id)}
                              icon={Plus}
                              style={{ padding: "6px 12px", borderRadius: "var(--radius-sm)" }}
                            >
                              Assign
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
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
                        <div className="user-avatar" style={{ width: "32px", height: "32px", fontSize: "12px", borderRadius: "50%" }}>
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
                          style={{ color: "var(--danger-500)", width: "32px", height: "32px", borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center" }}
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

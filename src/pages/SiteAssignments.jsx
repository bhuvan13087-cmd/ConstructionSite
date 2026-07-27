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
    <Layout title="Site Assignments" description="Configure construction site allocations and manage field engineer deployments.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── 1. COMPACT KPI SUMMARY CARDS (EXACT 3 CARDS) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px", marginBottom: "20px" }}>
        
        {/* KPI 1: Total Sites */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Sites</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#f97316", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Building2 size={18} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{sites.length}</div>
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", display: "block" }}>Registered project locations</span>
        </div>

        {/* KPI 2: Available Engineers */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Available Engineers</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Users size={18} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
            {activeEngineersList.length}
          </div>
          <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "8px", display: "block", fontWeight: "600" }}>Active field engineers roster</span>
        </div>

        {/* KPI 3: Active Assignments */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
            <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Assignments</span>
            <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#e0f2fe", color: "#0369a1", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <UserCheck size={18} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "26px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
            {assignments.filter(a => a.status === "active").length}
          </div>
          <span style={{ fontSize: "11px", color: "#0369a1", marginTop: "8px", display: "block", fontWeight: "600" }}>Deploys actively assigned</span>
        </div>

      </div>

      {/* ── 2. BALANCED 3-COLUMN WORKSPACE LAYOUT (30% - 40% - 30%) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "30% 40% 30%", gap: "16px", marginBottom: "20px" }}>
        
        {/* LEFT PANEL (30%): PROJECT SITES */}
        <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 16px", display: "flex", flexDirection: "column", height: "580px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
              <Building2 size={16} style={{ color: "#ea580c" }} /> Project Sites
            </h3>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>{filteredSites.length} Sites</span>
          </div>

          {/* Search Bar */}
          <div className="input-wrapper" style={{ marginBottom: "12px" }}>
            <Search className="input-icon" size={15} />
            <input 
              type="text" 
              placeholder="Search site or client..."
              value={siteSearchQuery}
              onChange={(e) => setSiteSearchQuery(e.target.value)}
              style={{ paddingLeft: "38px", fontSize: "12.5px" }}
            />
          </div>

          {/* Sites Roster List */}
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
            {filteredSites.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "20px", fontSize: "12px" }}>No construction sites found.</div>
            ) : (
              filteredSites.map((site) => {
                const isActive = site.id === selectedSiteId;
                const assignedCount = assignments.filter(asg => asg.siteId === site.id && asg.status === "active").length;
                
                return (
                  <div 
                    key={site.id} 
                    onClick={() => { setSelectedSiteId(site.id); setSelectedEngineerId(""); }}
                    style={{ 
                      cursor: "pointer", 
                      padding: "10px 12px", 
                      borderRadius: "8px", 
                      border: isActive ? "1.5px solid #f97316" : "1px solid #e2e8f0", 
                      backgroundColor: isActive ? "#fff7ed" : "#ffffff",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <strong style={{ fontWeight: "700", fontSize: "13px", color: isActive ? "#c2410c" : "#0f172a" }}>{site.siteName}</strong>
                      <Badge status={site.status || "active"} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "#64748b" }}>
                      <span style={{ display: "flex", alignItems: "center", gap: "3px" }}>
                        <MapPin size={11} /> {site.location}
                      </span>
                      <span style={{ fontWeight: "700", color: assignedCount > 0 ? "#ea580c" : "#94a3b8" }}>
                        {assignedCount} Staff
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* CENTER PANEL (40%): ASSIGNMENT WORKSPACE */}
        <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px", display: "flex", flexDirection: "column", height: "580px" }}>
          <div style={{ marginBottom: "14px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
              <UserCheck size={16} style={{ color: "#2563eb" }} /> Assignment Workspace
            </h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "#64748b" }}>Deploy engineers and inspect active site teams</p>
          </div>

          {selectedSite ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", flex: 1, overflowY: "auto" }}>
              
              {/* Selected Site Summary Banner */}
              <div style={{ padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <strong style={{ fontSize: "14px", color: "#0f172a" }}>{selectedSite.siteName}</strong>
                  <span style={{ fontSize: "11px", color: "#64748b" }}>Client: <strong>{selectedSite.clientName || "Internal"}</strong></span>
                </div>
                <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "4px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <MapPin size={12} style={{ color: "#ea580c" }} /> {selectedSite.location}
                </div>
              </div>

              {/* Assignment Workbench / Drop Area */}
              <div style={{ padding: "18px", border: "2px dashed #cbd5e1", borderRadius: "10px", backgroundColor: "#fafbfc", textAlign: "center" }}>
                {selectedEngineerId && engineers.find(eng => eng.id === selectedEngineerId) ? (
                  (() => {
                    const selectedEngineer = engineers.find(eng => eng.id === selectedEngineerId);
                    return (
                      <div>
                        <div style={{ display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", marginBottom: "10px" }}>
                          <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: "800", fontSize: "12px" }}>
                            {getInitials(selectedEngineer.fullName)}
                          </div>
                          <div style={{ textAlign: "left" }}>
                            <strong style={{ display: "block", color: "#0f172a", fontSize: "13.5px" }}>{selectedEngineer.fullName}</strong>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>{selectedEngineer.email || "Site Engineer"}</span>
                          </div>
                        </div>

                        <p style={{ fontSize: "12px", color: "#334155", margin: "0 0 14px 0", lineHeight: "1.4" }}>
                          Ready to deploy <strong>{selectedEngineer.fullName}</strong> to <strong>{selectedSite.siteName}</strong>. 
                        </p>

                        <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                          <Button 
                            variant="primary"
                            onClick={() => handleAssign(selectedSiteId, selectedEngineerId)}
                            icon={Plus}
                            size="sm"
                          >
                            Confirm Assignment
                          </Button>
                          <Button 
                            variant="outline"
                            onClick={() => setSelectedEngineerId("")}
                            size="sm"
                          >
                            Cancel
                          </Button>
                        </div>
                      </div>
                    );
                  })()
                ) : (
                  <div>
                    <div style={{ width: "36px", height: "36px", borderRadius: "50%", backgroundColor: "#f1f5f9", color: "#64748b", display: "flex", alignItems: "center", justifyCenter: "center", margin: "0 auto 8px" }}>
                      <UserCheck size={20} />
                    </div>
                    <strong style={{ fontSize: "13px", color: "#0f172a", display: "block", marginBottom: "2px" }}>Deploy Personnel</strong>
                    <p style={{ margin: 0, fontSize: "11.5px", color: "#64748b" }}>
                      Select an engineer from the right roster to assign them to this site.
                    </p>
                  </div>
                )}
              </div>

              {/* CURRENT SITE TEAM */}
              <div>
                <div style={{ fontSize: "11.5px", fontWeight: "800", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: "8px" }}>
                  Current Site Team ({selectedSiteAllocations.length})
                </div>
                
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
                          border: "1px solid #e2e8f0",
                          padding: "8px 12px",
                          borderRadius: "8px"
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#e2e8f0", color: "#334155", display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: "800", fontSize: "10.5px" }}>
                            {getInitials(asg.engineerName)}
                          </div>
                          <div>
                            <span style={{ fontSize: "12.5px", fontWeight: "700", color: "#0f172a" }}>{asg.engineerName}</span>
                            <span style={{ display: "block", fontSize: "10.5px", color: "#64748b" }}>{asg.engineerEmail || "Site Engineer"}</span>
                          </div>
                        </div>
                        <button 
                          onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(asg); }} 
                          className="btn-icon" 
                          style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer", padding: "4px" }}
                          title="Remove assignment"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "14px", border: "1px dashed #e2e8f0", borderRadius: "8px", textAlign: "center", color: "#64748b", fontSize: "11.5px", fontStyle: "italic" }}>
                    No engineers allocated to this site yet.
                  </div>
                )}
              </div>

            </div>
          ) : (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b", margin: "auto" }}>
              <Layers size={32} style={{ color: "#cbd5e1", marginBottom: "8px" }} />
              <strong style={{ display: "block", fontSize: "14px", color: "#0f172a", marginBottom: "4px" }}>Select a Construction Project</strong>
              <span style={{ fontSize: "12px" }}>Choose a site from the left list to start managing engineer deployments.</span>
            </div>
          )}
        </Card>

        {/* RIGHT PANEL (30%): AVAILABLE ENGINEERS */}
        <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 16px", display: "flex", flexDirection: "column", height: "580px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={16} style={{ color: "#16a34a" }} /> Available Engineers
            </h3>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>{filteredEngineers.length} Staff</span>
          </div>

          {/* Search Bar */}
          <div className="input-wrapper" style={{ marginBottom: "12px" }}>
            <Search className="input-icon" size={15} />
            <input 
              type="text" 
              placeholder="Search staff name..."
              value={engineerSearchQuery}
              onChange={(e) => setEngineerSearchQuery(e.target.value)}
              style={{ paddingLeft: "38px", fontSize: "12.5px" }}
            />
          </div>

          {/* Engineer Roster Cards */}
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
            {filteredEngineers.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "20px", fontSize: "12px" }}>No site engineers match query.</div>
            ) : (
              filteredEngineers.map((eng) => {
                const isAssigned = selectedSiteAllocations.some(asg => asg.engineerId === eng.id);
                const isSelected = eng.id === selectedEngineerId;
                const workloadCount = getWorkload(eng.id);
                
                // Status badge string calculation: Active, Available, Busy, Assigned
                let statusLabel = "Available";
                let statusBg = "#dcfce7";
                let statusColor = "#16a34a";

                if (isAssigned) {
                  statusLabel = "Assigned";
                  statusBg = "#e0f2fe";
                  statusColor = "#0369a1";
                } else if (workloadCount > 1) {
                  statusLabel = "Busy";
                  statusBg = "#fef3c7";
                  statusColor = "#b45309";
                } else if (eng.status === "active") {
                  statusLabel = "Active";
                  statusBg = "#dcfce7";
                  statusColor = "#16a34a";
                }

                return (
                  <div 
                    key={eng.id} 
                    onClick={() => {
                      if (!isAssigned && selectedSiteId) {
                        setSelectedEngineerId(eng.id);
                      }
                    }}
                    style={{ 
                      cursor: isAssigned ? "default" : "pointer", 
                      padding: "10px 12px", 
                      borderRadius: "8px", 
                      border: isSelected ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                      backgroundColor: isAssigned ? "#f8fafc" : (isSelected ? "#eff6ff" : "#ffffff"),
                      opacity: isAssigned ? 0.75 : 1,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      transition: "all 0.15s ease"
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", minWidth: 0 }}>
                      <div style={{ width: "32px", height: "32px", borderRadius: "50%", backgroundColor: "#e2e8f0", color: "#0f172a", display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: "800", fontSize: "11px", flexShrink: 0 }}>
                        {getInitials(eng.fullName)}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block" }} className="text-ellipsis">{eng.fullName}</strong>
                        <span style={{ fontSize: "10.5px", color: "#64748b" }}>Workload: {workloadCount} site(s)</span>
                      </div>
                    </div>

                    <div style={{ flexShrink: 0 }}>
                      <span style={{ fontSize: "10.5px", fontWeight: "800", backgroundColor: statusBg, color: statusColor, padding: "2px 8px", borderRadius: "100px" }}>
                        {statusLabel}
                      </span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </Card>

      </div>

      {/* ── 3. BOTTOM ALLOCATIONS TABLE ── */}
      <Card variant="table" style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
        <div style={{ padding: "14px 20px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>Active Site Allocations</h3>
            <span style={{ fontSize: "11.5px", color: "#64748b" }}>
              Showing {filteredAssignments.length} allocation {filteredAssignments.length === 1 ? "record" : "records"}
            </span>
          </div>

          <div className="input-wrapper" style={{ width: "260px" }}>
            <Search className="input-icon" size={15} />
            <input 
              type="text" 
              placeholder="Search allocations..."
              value={assignmentSearchQuery}
              onChange={(e) => setAssignmentSearchQuery(e.target.value)}
              style={{ paddingLeft: "38px", fontSize: "12px" }}
            />
          </div>
        </div>

        <div style={{ overflowX: "auto" }}>
          <table className="modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Site Name</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Assigned Engineer</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Allocation Status</th>
                <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Assigned Date</th>
                <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Action</th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: "center", color: "#64748b", padding: "32px", fontSize: "13px" }}>
                    No active allocations found matching your search.
                  </td>
                </tr>
              ) : (
                filteredAssignments.map((asg) => {
                  const assignedDateStr = asg.assignedAt
                    ? (asg.assignedAt.seconds
                        ? new Date(asg.assignedAt.seconds * 1000).toLocaleDateString("en-GB")
                        : new Date(asg.assignedAt).toLocaleDateString("en-GB"))
                    : "Today";

                  return (
                    <tr key={asg.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "12px 16px" }}>
                        <strong style={{ fontSize: "13px", color: "#0f172a", display: "block" }}>{asg.siteName}</strong>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "flex", alignItems: "center", gap: "3px" }}>
                          <MapPin size={11} /> {asg.location || "Site Location"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#dbeafe", color: "#1e40af", display: "flex", alignItems: "center", justifyCenter: "center", fontWeight: "800", fontSize: "10.5px" }}>
                            {getInitials(asg.engineerName)}
                          </div>
                          <div>
                            <strong style={{ fontSize: "12.5px", color: "#0f172a", display: "block" }}>{asg.engineerName}</strong>
                            <span style={{ fontSize: "10.5px", color: "#64748b" }}>{asg.engineerEmail || "Site Engineer"}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 16px" }}>
                        <Badge status={asg.status || "active"} />
                      </td>
                      <td style={{ padding: "12px 16px", fontSize: "11.5px", color: "#64748b", fontFamily: "monospace" }}>
                        {assignedDateStr}
                      </td>
                      <td style={{ padding: "12px 16px", textAlign: "right" }}>
                        <button 
                          onClick={() => handleRemoveAssignment(asg)} 
                          className="btn-icon" 
                          title="Remove Allocation" 
                          style={{ color: "#ef4444", border: "none", background: "none", cursor: "pointer" }}
                        >
                          <Trash2 size={16} />
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

      <Loading show={loading} text="Updating assignments..." />
    </Layout>
  );
}

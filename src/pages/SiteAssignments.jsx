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
import ConfirmationModal from "../components/common/ConfirmationModal";
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

  // KPI metrics
  const totalAssignments = assignments.length;
  const uniqueSitesAssigned = [...new Set(assignments.map(a => a.siteId))].length;
  const uniqueEngineersDeployed = [...new Set(assignments.map(a => a.engineerId))].length;

  return (
    <Layout title="Site Assignments" description="Configure construction site allocations and manage field engineer deployments.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── KPI Summary Bar ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
        gap: "14px",
        marginBottom: "24px"
      }}>
        {[
          { label: "Total Assignments", value: totalAssignments, sub: "Active records", icon: "🔗", bg: "#fff7ed", border: "#ffedd5", color: "#c2410c" },
          { label: "Sites Deployed", value: uniqueSitesAssigned, sub: "With active engineers", icon: "🏗️", bg: "var(--primary-50)", border: "var(--border-color)", color: "var(--primary-800)" },
          { label: "Engineers Active", value: activeEngineersList.length, sub: "Ready to deploy", icon: "👷", bg: "var(--success-50)", border: "var(--success-100)", color: "var(--success-600)" },
          { label: "Engineers Deployed", value: uniqueEngineersDeployed, sub: "On active sites", icon: "✅", bg: "#fff7ed", border: "#ffedd5", color: "#c2410c" },
          { label: "Total Sites", value: sites.length, sub: "Registered projects", icon: "📍", bg: "var(--primary-50)", border: "var(--border-color)", color: "var(--primary-700)" }
        ].map((kpi, i) => (
          <div key={i} style={{
            background: kpi.bg,
            border: `1px solid ${kpi.border}`,
            borderRadius: "14px",
            padding: "16px 18px",
            boxShadow: "0 1px 4px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{kpi.label}</span>
              <span style={{ fontSize: "18px" }}>{kpi.icon}</span>
            </div>
            <div style={{ fontSize: "24px", fontWeight: "900", color: kpi.color, lineHeight: "1.1" }}>{kpi.value}</div>
            <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Quick Assignment Panel ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid var(--border-color)",
        borderRadius: "16px",
        boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
        padding: "20px 24px",
        marginBottom: "22px"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "18px", flexWrap: "wrap", gap: "12px" }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "8px" }}>
              <UserCheck size={18} style={{ color: "#ea580c" }} /> Deploy Engineer to Site
            </h3>
            <p style={{ margin: "3px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Select a construction site and field engineer to establish site allocation</p>
          </div>
          <span style={{
            fontSize: "11.5px",
            fontWeight: "700",
            color: "#c2410c",
            backgroundColor: "#fff7ed",
            border: "1px solid #ffedd5",
            padding: "4px 12px",
            borderRadius: "20px"
          }}>
            {activeEngineersList.length} Active Engineers
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "16px", alignItems: "end" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="assign-site-select" style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-700)", letterSpacing: "0.3px" }}>Construction Site</label>
            <select
              id="assign-site-select"
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--primary-50)",
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--primary-950)",
                outline: "none",
                cursor: "pointer"
              }}
            >
              {sites.map(s => (
                <option key={s.id} value={s.id}>
                  {s.siteName} ({s.location || "Location N/A"})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
            <label htmlFor="assign-eng-select" style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-700)", letterSpacing: "0.3px" }}>Site Engineer</label>
            <select
              id="assign-eng-select"
              value={selectedEngineerId}
              onChange={(e) => setSelectedEngineerId(e.target.value)}
              style={{
                width: "100%",
                padding: "10px 14px",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
                backgroundColor: "var(--primary-50)",
                fontSize: "13px",
                fontWeight: "600",
                color: "var(--primary-950)",
                outline: "none",
                cursor: "pointer"
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

          <div>
            <Button
              variant="primary"
              onClick={() => handleAssign(selectedSiteId, selectedEngineerId)}
              icon={Plus}
              style={{ padding: "10px 20px", height: "42px", fontWeight: "700", fontSize: "13px" }}
            >
              Assign
            </Button>
          </div>
        </div>
      </div>

      {/* ── Main Workspace: Site Teams + Allocations Table ── */}
      <div style={{ display: "grid", gridTemplateColumns: "38% 60%", gap: "2%", marginBottom: "20px" }}>

        {/* LEFT: Site-wise Teams Panel */}
        <div style={{
          background: "#ffffff",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
          padding: "18px",
          display: "flex",
          flexDirection: "column",
          height: "560px"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Building2 size={16} style={{ color: "#ea580c" }} /> Site Deployment Teams
              </h3>
              <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Site-wise assigned engineers</span>
            </div>
            <span style={{
              fontSize: "11px",
              fontWeight: "700",
              color: "#c2410c",
              backgroundColor: "#fff7ed",
              border: "1px solid #ffedd5",
              padding: "2px 10px",
              borderRadius: "100px"
            }}>
              {sites.length} Sites
            </span>
          </div>

          <div className="input-wrapper" style={{ marginBottom: "12px" }}>
            <Search className="input-icon" size={14} />
            <input
              type="text"
              placeholder="Filter sites..."
              value={siteSearchQuery}
              onChange={(e) => setSiteSearchQuery(e.target.value)}
              style={{ paddingLeft: "38px", fontSize: "12.5px" }}
            />
          </div>

          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "10px", paddingRight: "4px" }}>
            {filteredSites.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px", fontSize: "12px" }}>No matching sites found.</div>
            ) : (
              filteredSites.map(site => {
                const siteEngineers = assignments.filter(a => a.siteId === site.id && a.status === "active");
                const isSelected = site.id === selectedSiteId;

                return (
                  <div
                    key={site.id}
                    style={{
                      border: isSelected ? "1.5px solid #f97316" : "1px solid var(--border-color)",
                      borderRadius: "12px",
                      backgroundColor: isSelected ? "#fff7ed" : "var(--primary-50)",
                      padding: "12px 14px",
                      transition: "all 0.15s ease",
                      cursor: "pointer"
                    }}
                    onClick={() => setSelectedSiteId(site.id)}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: siteEngineers.length > 0 ? "10px" : 0 }}>
                      <div style={{ minWidth: 0 }}>
                        <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{site.siteName}</strong>
                        <span style={{ display: "flex", alignItems: "center", gap: "3px", fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                          <MapPin size={10} /> {site.location}
                        </span>
                      </div>
                      <Badge status={site.status || "active"} />
                    </div>

                    {siteEngineers.length > 0 ? (
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px", paddingTop: "8px", borderTop: "1px solid var(--border-color)" }}>
                        {siteEngineers.map(asg => (
                          <div
                            key={asg.id}
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#ffffff", padding: "6px 10px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                          >
                            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                              <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "10px", flexShrink: 0 }}>
                                {getInitials(asg.engineerName)}
                              </div>
                              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)" }}>{asg.engineerName}</span>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => { e.stopPropagation(); handleRemoveAssignment(asg); }}
                              style={{ color: "var(--danger-500)", background: "none", border: "none", cursor: "pointer", padding: "2px", display: "flex", alignItems: "center" }}
                              title="Unassign Engineer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <span style={{ display: "block", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic", marginTop: "4px" }}>
                        No engineers assigned yet.
                      </span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* RIGHT: Allocations Table */}
        <div style={{
          background: "#ffffff",
          border: "1px solid var(--border-color)",
          borderRadius: "16px",
          boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
          overflow: "hidden",
          display: "flex",
          flexDirection: "column",
          height: "560px"
        }}>
          <div style={{
            padding: "14px 18px",
            borderBottom: "1px solid var(--border-color)",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            backgroundColor: "var(--primary-50)",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div>
              <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Active Site Allocations</h3>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                {filteredAssignments.length} active assignment record(s)
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
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ background: "var(--primary-50)", borderBottom: "1px solid var(--border-color)" }}>
                  {["Site Name", "Assigned Engineer", "Status", "Assigned Date", "Action"].map((h, i) => (
                    <th key={i} style={{
                      padding: "10px 14px",
                      textAlign: i === 2 ? "center" : i === 4 ? "right" : "left",
                      fontSize: "11px",
                      fontWeight: "800",
                      color: "var(--primary-600)",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      whiteSpace: "nowrap"
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", padding: "40px", fontSize: "12.5px" }}>
                      <div style={{ fontSize: "28px", marginBottom: "8px" }}>📋</div>
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
                      <tr key={asg.id} style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.1s ease" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--primary-50)"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <td style={{ padding: "10px 14px" }}>
                          <strong style={{ fontSize: "12.5px", color: "var(--primary-950)", display: "block" }}>{asg.siteName}</strong>
                          <span style={{ fontSize: "10.5px", color: "var(--text-muted)" }}>{asg.location || "Site Location"}</span>
                        </td>
                        <td style={{ padding: "10px 14px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ width: "28px", height: "28px", borderRadius: "50%", backgroundColor: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: "800", fontSize: "10px", flexShrink: 0 }}>
                              {getInitials(asg.engineerName)}
                            </div>
                            <div>
                              <strong style={{ fontSize: "12px", color: "var(--primary-950)", display: "block" }}>{asg.engineerName}</strong>
                              <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{asg.engineerEmail || "Engineer"}</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <Badge status={asg.status || "active"} />
                        </td>
                        <td style={{ padding: "10px 14px", fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace", whiteSpace: "nowrap" }}>
                          {assignedDateStr}
                        </td>
                        <td style={{ padding: "10px 14px", textAlign: "right" }}>
                          <button
                            onClick={() => handleRemoveAssignment(asg)}
                            style={{
                              padding: "5px 10px",
                              borderRadius: "7px",
                              border: "1px solid var(--danger-100)",
                              backgroundColor: "var(--danger-50)",
                              color: "var(--danger-600)",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              fontSize: "11px",
                              fontWeight: "700",
                              transition: "background 0.15s ease"
                            }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--danger-100)"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--danger-50)"}
                            title="Remove Allocation"
                          >
                            <Trash2 size={12} /> Remove
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />
      <Loading show={loading} text="Updating assignments..." />
    </Layout>
  );
}

import React, { useState, useEffect, useRef } from "react";
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
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import ConfirmationModal from "../components/common/ConfirmationModal";
import ViewToggle from "../components/common/ViewToggle";
import { 
  Plus, 
  Trash2, 
  UserCheck, 
  MapPin, 
  Search, 
  Building2,
  ChevronDown,
  Check,
  Clock
} from "lucide-react";

// Production Custom Dropdown Component for Site & Engineer Assignments
function AssignmentDropdown({
  label,
  value,
  onChange,
  options = [],
  placeholder = "Select an option...",
  icon: Icon,
  searchPlaceholder = "Search..."
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const dropdownRef = useRef(null);

  // Close on outside click
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      document.addEventListener("touchstart", handleClickOutside);
    }
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Close on escape key
  useEffect(() => {
    function handleKeyDown(e) {
      if (e.key === "Escape") {
        setIsOpen(false);
      }
    }
    if (isOpen) {
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  const selectedOption = options.find(opt => opt.value === value);

  const filteredOptions = options.filter(opt => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return (
      (opt.label || "").toLowerCase().includes(q) ||
      (opt.sublabel || "").toLowerCase().includes(q)
    );
  });

  return (
    <div ref={dropdownRef} style={{ position: "relative", width: "100%", display: "flex", flexDirection: "column", gap: "6px" }}>
      {label && (
        <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-700, #334155)", letterSpacing: "0.3px" }}>
          {label}
        </label>
      )}

      {/* Dropdown Trigger */}
      <button
        type="button"
        onClick={() => {
          setIsOpen(!isOpen);
          setSearch("");
        }}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        style={{
          width: "100%",
          minHeight: "44px",
          padding: "8px 14px",
          borderRadius: "10px",
          border: isOpen ? "1.5px solid var(--accent-500, #f97316)" : "1.5px solid #cbd5e1",
          backgroundColor: "#ffffff",
          boxShadow: isOpen ? "0 0 0 3px var(--accent-100, #ffedd5)" : "0 1px 2px rgba(0,0,0,0.03)",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "10px",
          cursor: "pointer",
          textAlign: "left",
          transition: "all 0.15s ease",
          outline: "none"
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px", overflow: "hidden", flex: 1, minWidth: 0 }}>
          {Icon && <Icon size={16} style={{ color: "var(--accent-500, #f97316)", flexShrink: 0 }} />}
          {selectedOption ? (
            <div style={{ display: "flex", flexDirection: "column", gap: "1px", overflow: "hidden", minWidth: 0 }}>
              <span style={{ fontSize: "13px", fontWeight: "750", color: "#0f172a", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                {selectedOption.label}
              </span>
              {selectedOption.sublabel && (
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "500", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                  {selectedOption.sublabel}
                </span>
              )}
            </div>
          ) : (
            <span style={{ fontSize: "13px", color: "#94a3b8", fontWeight: "500" }}>
              {placeholder}
            </span>
          )}
        </div>

        <ChevronDown
          size={16}
          style={{
            color: isOpen ? "var(--accent-500, #f97316)" : "#64748b",
            transform: isOpen ? "rotate(180deg)" : "none",
            transition: "transform 0.2s ease",
            flexShrink: 0
          }}
        />
      </button>

      {/* Floating Dropdown Menu */}
      {isOpen && (
        <div
          role="listbox"
          style={{
            position: "absolute",
            top: "calc(100% + 6px)",
            left: 0,
            right: 0,
            zIndex: 100,
            backgroundColor: "#ffffff",
            borderRadius: "12px",
            border: "1px solid #cbd5e1",
            boxShadow: "0 10px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.06)",
            overflow: "hidden",
            display: "flex",
            flexDirection: "column"
          }}
        >
          {/* Internal search filter if options > 3 */}
          {options.length > 3 && (
            <div style={{ padding: "8px 10px", borderBottom: "1px solid #f1f5f9", backgroundColor: "#f8fafc" }}>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Search size={14} style={{ position: "absolute", left: "10px", color: "#94a3b8", pointerEvents: "none" }} />
                <input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder={searchPlaceholder}
                  autoFocus
                  style={{
                    width: "100%",
                    height: "32px",
                    padding: "4px 8px 4px 30px",
                    borderRadius: "6px",
                    border: "1px solid #e2e8f0",
                    backgroundColor: "#ffffff",
                    fontSize: "12px",
                    color: "#0f172a",
                    outline: "none"
                  }}
                  onClick={(e) => e.stopPropagation()}
                />
              </div>
            </div>
          )}

          {/* Options list */}
          <div style={{ maxHeight: "230px", overflowY: "auto", padding: "4px" }}>
            {filteredOptions.length === 0 ? (
              <div style={{ padding: "16px", textAlign: "center", fontSize: "12.5px", color: "#94a3b8" }}>
                No matching options found
              </div>
            ) : (
              filteredOptions.map((opt) => {
                const isSelected = opt.value === value;
                return (
                  <div
                    key={opt.value}
                    role="option"
                    aria-selected={isSelected}
                    onClick={() => {
                      onChange(opt.value);
                      setIsOpen(false);
                    }}
                    style={{
                      padding: "9px 12px",
                      borderRadius: "8px",
                      backgroundColor: isSelected ? "var(--accent-50, #fff7ed)" : "transparent",
                      color: isSelected ? "var(--accent-700, #c2410c)" : "#1e293b",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      gap: "8px",
                      transition: "background-color 0.12s ease"
                    }}
                    onMouseEnter={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                    }}
                  >
                    <div style={{ display: "flex", flexDirection: "column", gap: "2px", overflow: "hidden" }}>
                      <span style={{ fontSize: "13px", fontWeight: isSelected ? "750" : "600", textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>
                        {opt.label}
                      </span>
                      {opt.sublabel && (
                        <span style={{ fontSize: "11.5px", color: isSelected ? "var(--accent-600, #ea580c)" : "#64748b" }}>
                          {opt.sublabel}
                        </span>
                      )}
                    </div>
                    {isSelected && (
                      <Check size={15} style={{ color: "var(--accent-600, #ea580c)", flexShrink: 0 }} />
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

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
  
  // Search state
  const [assignmentSearchQuery, setAssignmentSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("normal"); // "normal" (table) | "grid"
  
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

  // Filter active engineers and assignments
  const activeEngineersList = engineers.filter(eng => eng.status === "active");

  const filteredAssignments = assignments.filter(asg => {
    const query = assignmentSearchQuery.toLowerCase().trim();
    return (
      asg.siteName?.toLowerCase().includes(query) ||
      asg.engineerName?.toLowerCase().includes(query) ||
      asg.engineerEmail?.toLowerCase().includes(query) ||
      asg.location?.toLowerCase().includes(query)
    );
  });

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

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px", alignItems: "end" }}>
          <AssignmentDropdown
            label="Construction Site"
            value={selectedSiteId}
            onChange={setSelectedSiteId}
            icon={Building2}
            placeholder="Choose a site to assign"
            searchPlaceholder="Search sites by name or location..."
            options={sites.map(s => ({
              value: s.id,
              label: s.siteName,
              sublabel: s.location || (s.clientName ? `Client: ${s.clientName}` : "Location N/A")
            }))}
          />

          <AssignmentDropdown
            label="Site Engineer"
            value={selectedEngineerId}
            onChange={setSelectedEngineerId}
            icon={UserCheck}
            placeholder="-- Choose Engineer to Assign --"
            searchPlaceholder="Search engineers by name or email..."
            options={activeEngineersList.map(eng => {
              const workload = getWorkload(eng.id);
              return {
                value: eng.id,
                label: eng.fullName,
                sublabel: `${workload} active site${workload === 1 ? "" : "s"}${eng.email ? ` • ${eng.email}` : ""}`
              };
            })}
          />

          <div style={{ display: "flex", alignItems: "flex-end" }}>
            <Button
              variant="primary"
              onClick={() => handleAssign(selectedSiteId, selectedEngineerId)}
              icon={Plus}
              style={{
                width: "100%",
                height: "44px",
                fontWeight: "750",
                fontSize: "13.5px",
                borderRadius: "10px",
                backgroundColor: "var(--accent-500, #f97316)",
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "6px",
                boxShadow: "0 1px 3px rgba(249,115,22,0.25)"
              }}
            >
              Assign Engineer
            </Button>
          </div>
        </div>
      </div>

      {/* ── Active Site Allocations (Full-Width Section) ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid var(--border-color)",
        borderRadius: "16px",
        boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        marginBottom: "20px"
      }}>
        <div style={{
          padding: "16px 20px",
          borderBottom: "1px solid var(--border-color)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          backgroundColor: "var(--primary-50)",
          flexWrap: "wrap",
          gap: "12px"
        }}>
          <div>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-950)", display: "flex", alignItems: "center", gap: "8px" }}>
              <Building2 size={17} style={{ color: "var(--accent-600, #ea580c)" }} /> Active Site Allocations
            </h3>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 500 }}>
              {filteredAssignments.length} active assignment record{filteredAssignments.length !== 1 ? "s" : ""}
            </span>
          </div>
          
          <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <div className="input-wrapper search-wrapper" style={{ width: "240px", maxWidth: "100%" }}>
              <Search className="input-icon" size={14} />
              <input
                type="text"
                placeholder="Search assignments..."
                value={assignmentSearchQuery}
                onChange={(e) => setAssignmentSearchQuery(e.target.value)}
                style={{ fontSize: "12.5px" }}
              />
            </div>
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
          </div>
        </div>

        {filteredAssignments.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px 20px", fontSize: "13px" }}>
            <div style={{ fontSize: "32px", marginBottom: "8px" }}>📋</div>
            <div style={{ fontWeight: "700", color: "var(--primary-800)", marginBottom: "4px" }}>
              {assignmentSearchQuery ? "No allocations match your search" : "No active site allocations found"}
            </div>
            <div style={{ fontSize: "12px" }}>
              {assignmentSearchQuery ? "Try searching for a different site or engineer name." : "Use the form above to deploy an engineer to a construction site."}
            </div>
          </div>
        ) : viewMode === "normal" ? (
          /* Normal / List (Table) View */
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "640px" }}>
              <thead>
                <tr style={{ background: "var(--primary-50)", borderBottom: "1px solid var(--border-color)" }}>
                  <th style={{ padding: "12px 18px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap", width: "28%" }}>Site Name</th>
                  <th style={{ padding: "12px 18px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap", width: "28%" }}>Assigned Engineer</th>
                  <th style={{ padding: "12px 18px", textAlign: "center", fontSize: "11px", fontWeight: "800", color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap", width: "14%" }}>Status</th>
                  <th style={{ padding: "12px 18px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap", width: "16%" }}>Assigned Date</th>
                  <th style={{ padding: "12px 18px", textAlign: "right", fontSize: "11px", fontWeight: "800", color: "var(--primary-600)", textTransform: "uppercase", letterSpacing: "0.5px", whiteSpace: "nowrap", width: "14%", paddingRight: "20px" }}>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredAssignments.map((asg) => {
                  const assignedDateStr = asg.assignedAt
                    ? (asg.assignedAt.seconds
                        ? new Date(asg.assignedAt.seconds * 1000).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })
                        : new Date(asg.assignedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }))
                    : "Today";

                  return (
                    <tr
                      key={asg.id}
                      style={{ borderBottom: "1px solid var(--border-color)", transition: "background 0.12s ease" }}
                      onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                    >
                      <td style={{ padding: "12px 18px" }}>
                        <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block" }}>{asg.siteName}</strong>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "var(--text-muted)", marginTop: "2px" }}>
                          <MapPin size={11} style={{ color: "var(--accent-500, #f97316)", flexShrink: 0 }} /> {asg.location || "Site Location"}
                        </span>
                      </td>
                      <td style={{ padding: "12px 18px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            backgroundColor: "var(--accent-50, #fff7ed)",
                            border: "1.5px solid var(--accent-100, #ffedd5)",
                            color: "var(--accent-700, #c2410c)",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "800",
                            fontSize: "11px",
                            flexShrink: 0
                          }}>
                            {getInitials(asg.engineerName)}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <strong style={{ fontSize: "13px", color: "var(--primary-950)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{asg.engineerName}</strong>
                            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{asg.engineerEmail || "Engineer"}</span>
                          </div>
                        </div>
                      </td>
                      <td style={{ padding: "12px 18px", textAlign: "center" }}>
                        <Badge status={asg.status || "active"} />
                      </td>
                      <td style={{ padding: "12px 18px", fontSize: "12px", color: "var(--primary-700)", fontWeight: 500, whiteSpace: "nowrap" }}>
                        {assignedDateStr}
                      </td>
                      <td style={{ padding: "12px 18px", textAlign: "right", paddingRight: "20px" }}>
                        <button
                          onClick={() => handleRemoveAssignment(asg)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: "7px",
                            border: "1px solid var(--danger-100)",
                            backgroundColor: "var(--danger-50)",
                            color: "var(--danger-600)",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            fontSize: "11.5px",
                            fontWeight: "700",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.backgroundColor = "var(--danger-100)";
                            e.currentTarget.style.borderColor = "var(--danger-200)";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.backgroundColor = "var(--danger-50)";
                            e.currentTarget.style.borderColor = "var(--danger-100)";
                          }}
                          title="Remove Allocation"
                        >
                          <Trash2 size={12} /> Remove
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* Grid View */
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
            gap: "16px",
            padding: "18px"
          }}>
            {filteredAssignments.map((asg) => {
              const assignedDateStr = asg.assignedAt
                ? (asg.assignedAt.seconds
                    ? new Date(asg.assignedAt.seconds * 1000).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" })
                    : new Date(asg.assignedAt).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" }))
                : "Today";

              return (
                <div
                  key={asg.id}
                  style={{
                    backgroundColor: "#ffffff",
                    border: "1px solid var(--border-color, #e2e8f0)",
                    borderRadius: "14px",
                    padding: "16px 18px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    transition: "box-shadow 0.15s ease, border-color 0.15s ease"
                  }}
                  onMouseEnter={e => {
                    e.currentTarget.style.boxShadow = "0 4px 12px rgba(0,0,0,0.06)";
                    e.currentTarget.style.borderColor = "#cbd5e1";
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.boxShadow = "0 2px 6px rgba(0,0,0,0.03)";
                    e.currentTarget.style.borderColor = "var(--border-color, #e2e8f0)";
                  }}
                >
                  {/* Card Header: Site & Status */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <h4 style={{ margin: 0, fontSize: "14.5px", fontWeight: "800", color: "var(--primary-950, #0f172a)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {asg.siteName}
                        </h4>
                        <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "var(--text-muted, #64748b)", marginTop: "3px" }}>
                          <MapPin size={12} style={{ color: "var(--accent-500, #f97316)", flexShrink: 0 }} /> {asg.location || "Site Location"}
                        </span>
                      </div>
                      <Badge status={asg.status || "active"} />
                    </div>

                    {/* Engineer Row */}
                    <div style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "10px",
                      marginTop: "12px",
                      padding: "10px 12px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "10px",
                      border: "1px solid #f1f5f9"
                    }}>
                      <div style={{
                        width: "34px",
                        height: "34px",
                        borderRadius: "50%",
                        backgroundColor: "var(--accent-50, #fff7ed)",
                        border: "1.5px solid var(--accent-100, #ffedd5)",
                        color: "var(--accent-700, #c2410c)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontWeight: "800",
                        fontSize: "11px",
                        flexShrink: 0
                      }}>
                        {getInitials(asg.engineerName)}
                      </div>
                      <div style={{ minWidth: 0, flex: 1 }}>
                        <strong style={{ fontSize: "13px", color: "var(--primary-950, #0f172a)", display: "block", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                          {asg.engineerName}
                        </strong>
                        <span style={{ fontSize: "11.5px", color: "var(--text-muted, #64748b)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", display: "block" }}>
                          {asg.engineerEmail || "Site Engineer"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer: Date & Remove Action */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    borderTop: "1px solid #f1f5f9",
                    paddingTop: "10px"
                  }}>
                    <span style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "11.5px", color: "var(--primary-700, #475569)", fontWeight: "500" }}>
                      <Clock size={12} style={{ color: "#94a3b8" }} /> {assignedDateStr}
                    </span>

                    <button
                      onClick={() => handleRemoveAssignment(asg)}
                      style={{
                        padding: "6px 12px",
                        borderRadius: "8px",
                        border: "1px solid var(--danger-100)",
                        backgroundColor: "var(--danger-50)",
                        color: "var(--danger-600)",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        fontSize: "11.5px",
                        fontWeight: "700",
                        transition: "all 0.15s ease"
                      }}
                      onMouseEnter={e => {
                        e.currentTarget.style.backgroundColor = "var(--danger-100)";
                        e.currentTarget.style.borderColor = "var(--danger-200)";
                      }}
                      onMouseLeave={e => {
                        e.currentTarget.style.backgroundColor = "var(--danger-50)";
                        e.currentTarget.style.borderColor = "var(--danger-100)";
                      }}
                      title="Remove Allocation"
                    >
                      <Trash2 size={12} /> Remove
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Table footer */}
        {filteredAssignments.length > 0 && (
          <div style={{
            borderTop: "1px solid var(--border-color)",
            padding: "10px 20px",
            background: "#f8fafc",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Showing {filteredAssignments.length} of {totalAssignments} allocation{totalAssignments !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>
      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />
      <Loading show={loading} text="Updating assignments..." />
    </Layout>
  );
}

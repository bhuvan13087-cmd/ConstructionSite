import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import EngineerActivityDashboard from "./EngineerActivityDashboard";
import { 
  getSiteEngineers, 
  updateEngineerStatus, 
  saveSiteEngineerProfile,
  getSites,
  getEngineerAttendanceAndLeaveStats,
  getEngineerLeaves,
  updateEngineerPasswordInDb,
  deleteSiteEngineer
} from "../services/firebaseService";
import { 
  registerEngineerAuth, 
  sendEngineerPasswordReset, 
  updateEngineerPasswordAuth 
} from "../firebase/auth";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
import { 
  Plus, 
  Search, 
  Eye, 
  EyeOff,
  Edit3, 
  Save, 
  User, 
  Mail, 
  Lock, 
  LockKeyhole,
  KeyRound,
  ShieldCheck,
  Phone,
  Trash2,
  Building2
} from "lucide-react";


export default function SiteEngineers() {
  const { userProfile } = useAuth();
  const [engineers, setEngineers] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

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

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  const [showDetailsModal, setShowDetailsModal] = useState(false);

  // Form Fields State
  const [formMode, setFormMode] = useState("add"); // "add" or "edit"
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formEmail, setFormEmail] = useState("");
  const [formPassword, setFormPassword] = useState("");
  const [formPhone, setFormPhone] = useState("");
  const [formHolidayAllowance, setFormHolidayAllowance] = useState(24);
  const [formSelectedSites, setFormSelectedSites] = useState([]);
  const [formOldSites, setFormOldSites] = useState([]); // to clear assignments on edit

  // Selected Engineer for Details Modal
  const [selectedEngineer, setSelectedEngineer] = useState(null);
  const [selectedEngineerStats, setSelectedEngineerStats] = useState(null);
  const [selectedEngineerLeaves, setSelectedEngineerLeaves] = useState([]);
  const [statsLoading, setStatsLoading] = useState(false);




  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const adminId = userProfile?.uid || userProfile?.id || null;
      const fetchedSites = await getSites(adminId);
      setSites(fetchedSites);

      const fetchedEngineers = await getSiteEngineers(adminId);
      setEngineers(fetchedEngineers);
    } catch (err) {
      console.error("Error loading engineers page data:", err);
      showToast(`Failed to load data: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Filtered Engineers
  const filteredEngineers = engineers.filter(eng => 
    eng.fullName?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    eng.email?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  // Toggle Engineer Active/Inactive Status
  const handleToggleStatus = async (id, currentStatus) => {
    const newStatus = currentStatus === "active" ? "inactive" : "active";
    setLoading(true);
    try {
      await updateEngineerStatus(id, newStatus);
      showToast(`Status updated to ${newStatus}.`, "success");
      // Reload engineers list
      const adminId = userProfile?.uid || userProfile?.id || null;
      const fetchedEngineers = await getSiteEngineers(adminId);
      setEngineers(fetchedEngineers);
    } catch (err) {
      console.error("Error toggling status:", err);
      showToast(`Failed to update status: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Delete Site Engineer completely from Database
  const handleDeleteEngineer = async (eng) => {
    showConfirmModal({
      title: "Delete Site Engineer?",
      message: `Are you sure you want to permanently delete engineer "${eng.fullName || eng.name || eng.email}"?`,
      details: "This will remove user authentication, site assignments, and engineer profile data.",
      confirmText: "Delete Engineer",
      variant: "danger",
      onConfirm: async () => {
        setLoading(true);
        try {
          await deleteSiteEngineer(eng.id, eng.email, eng.password);
          showToast("User deleted successfully", "success");
          await loadData();
        } catch (err) {
          console.error("Error deleting engineer:", err);
          showToast(`Failed to delete: ${err.message}`, "error");
        } finally {
          setLoading(false);
          closeConfirmModal();
        }
      }
    });
  };

  // Open Details Modal
  const handleOpenDetails = async (eng) => {
    setSelectedEngineer(eng);
    setShowDetailsModal(true);
    setSelectedEngineerStats(null);
    setSelectedEngineerLeaves([]);
    setStatsLoading(true);
    try {
      const stats = await getEngineerAttendanceAndLeaveStats(eng.id, eng.holidayAllowance || 24);
      setSelectedEngineerStats(stats);
      const leaves = await getEngineerLeaves(eng.id);
      setSelectedEngineerLeaves(leaves);
    } catch (err) {
      console.error("Error fetching stats:", err);
    } finally {
      setStatsLoading(false);
    }
  };

  // Open Form Modal - Add Mode
  const handleOpenAddModal = () => {
    setFormMode("add");
    setFormId("");
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
    setFormHolidayAllowance(24);
    setFormSelectedSites([]);
    setFormOldSites([]);
    setShowFormModal(true);
  };

  // Open Form Modal - Edit Mode
  const handleOpenEditModal = (eng) => {
    setFormMode("edit");
    setFormId(eng.id);
    setFormName(eng.fullName || "");
    setFormEmail(eng.email || "");
    setFormPassword("");
    setFormPhone(eng.phoneNumber || "");
    setFormHolidayAllowance(eng.holidayAllowance || 24);
    const assigned = eng.assignedSites || [];
    setFormSelectedSites(assigned);
    setFormOldSites(assigned);
    setShowFormModal(true);
  };

  // Handle Checkbox Selection
  const handleCheckboxChange = (siteId) => {
    setFormSelectedSites(prev => 
      prev.includes(siteId) 
        ? prev.filter(id => id !== siteId)
        : [...prev, siteId]
    );
  };

  // Form Submission (Add or Edit)
  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formMode === "add") {
        // Validation check
        if (!formPassword || formPassword.length < 6) {
          showToast("Password must be at least 6 characters.", "error");
          setLoading(false);
          return;
        }

        // 1. Create auth account via background secondary auth
        const createdUser = await registerEngineerAuth(formEmail.trim(), formPassword);
        const newUid = createdUser.uid;

        // 2. Save document to firestore and associate sites
        await saveSiteEngineerProfile(
          newUid, 
          formName.trim(), 
          formEmail.trim(), 
          formPhone.trim(), 
          formSelectedSites, 
          false,
          [],
          formHolidayAllowance,
          formPassword,
          userProfile?.uid || userProfile?.id || null
        );

        showToast("Site Engineer registered successfully.", "success");
      } else {
        // Edit Mode: save updates directly
        await saveSiteEngineerProfile(
          formId,
          formName.trim(),
          formEmail.trim(),
          formPhone.trim(),
          formSelectedSites,
          true,
          formOldSites,
          formHolidayAllowance
        );

        showToast("Site Engineer updated successfully.", "success");
      }

      setShowFormModal(false);
      await loadData();
    } catch (err) {
      console.error("Form action failed:", err);
      showToast(err.message || "Registration action failed.", "error");
    } finally {
      setLoading(false);
    }
  };

  if (selectedEngineerId) {
    return (
      <EngineerActivityDashboard 
        engineerId={selectedEngineerId} 
        onBack={() => setSelectedEngineerId(null)} 
      />
    );
  }

  return (
    <Layout title="Site Engineers" description="Manage Site Engineer security credentials and construction site assignments.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Toolbar header */}
      <div className="subview-actions-header">
        <div className="search-filter-bar">
          <div className="input-wrapper search-wrapper">
            <Search className="input-icon" size={16} />
            <input 
              type="text" 
              placeholder="Search engineers by name or email..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleOpenAddModal} id="btn-add-engineer" icon={Plus} className="btn-add">
          Add Engineer
        </Button>
      </div>

      {/* KPI Summary Bar */}
      {engineers.length > 0 && (
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
          gap: "14px",
          marginBottom: "24px"
        }}>
          {[
            { label: "Total Engineers", value: engineers.length, sub: "Registered accounts", icon: "👷", bg: "#fff7ed", border: "#ffedd5", color: "#c2410c" },
            { label: "Active", value: engineers.filter(e => e.status === "active").length, sub: "Currently enabled", icon: "✅", bg: "var(--success-50)", border: "var(--success-100)", color: "var(--success-600)" },
            { label: "Inactive", value: engineers.filter(e => e.status !== "active").length, sub: "Disabled accounts", icon: "⏸️", bg: "var(--primary-50)", border: "var(--border-color)", color: "var(--primary-700)" },
            { label: "Sites Covered", value: [...new Set(engineers.flatMap(e => e.assignedSites || []))].length, sub: "Unique site assignments", icon: "🏗️", bg: "var(--primary-50)", border: "var(--border-color)", color: "var(--primary-800)" }
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
      )}

      {/* Engineer Cards Grid */}
      {filteredEngineers.length === 0 ? (
        <div style={{
          textAlign: "center",
          padding: "64px 24px",
          background: "#fff",
          borderRadius: "16px",
          border: "1.5px dashed var(--border-color)",
          color: "var(--text-muted)"
        }}>
          <div style={{ fontSize: "40px", marginBottom: "12px" }}>👷</div>
          <div style={{ fontWeight: "700", fontSize: "15px", color: "var(--primary-800)" }}>No site engineers found</div>
          <div style={{ fontSize: "13px", marginTop: "6px" }}>Click "Add Engineer" to register one.</div>
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))", gap: "18px" }}>
          {filteredEngineers.map((eng) => {
            const isActive = eng.status === "active";
            const initials = eng.fullName ? eng.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "SE";
            const sitesCount = eng.assignedSites ? eng.assignedSites.length : 0;

            return (
              <div key={eng.id} style={{
                background: "#ffffff",
                borderRadius: "16px",
                border: `1px solid ${isActive ? "var(--border-color)" : "var(--danger-100)"}`,
                boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
                padding: "20px",
                display: "flex",
                flexDirection: "column",
                gap: "14px",
                transition: "box-shadow 0.2s ease, transform 0.2s ease"
              }}
                onMouseEnter={e => { e.currentTarget.style.boxShadow = "0 8px 24px rgba(15,23,42,0.10)"; e.currentTarget.style.transform = "translateY(-2px)"; }}
                onMouseLeave={e => { e.currentTarget.style.boxShadow = "0 2px 8px rgba(15,23,42,0.05)"; e.currentTarget.style.transform = "translateY(0)"; }}
              >
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                  <div
                    onClick={() => setSelectedEngineerId(eng.id)}
                    title="Click to view activity"
                    style={{
                      width: "46px",
                      height: "46px",
                      borderRadius: "50%",
                      backgroundColor: isActive ? "#fff7ed" : "var(--primary-100)",
                      border: `2px solid ${isActive ? "#ffedd5" : "var(--border-color)"}`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontWeight: "800",
                      fontSize: "14px",
                      color: isActive ? "#c2410c" : "var(--primary-500)",
                      cursor: "pointer",
                      flexShrink: 0,
                      transition: "transform 0.15s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.transform = "scale(1.08)"}
                    onMouseLeave={e => e.currentTarget.style.transform = "scale(1)"}
                  >{initials}</div>

                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div
                      onClick={() => setSelectedEngineerId(eng.id)}
                      style={{
                        fontWeight: "800",
                        fontSize: "14px",
                        color: "var(--primary-950)",
                        cursor: "pointer",
                        whiteSpace: "nowrap",
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        transition: "color 0.15s ease"
                      }}
                      onMouseEnter={e => e.currentTarget.style.color = "#ea580c"}
                      onMouseLeave={e => e.currentTarget.style.color = "var(--primary-950)"}
                    >{eng.fullName}</div>
                    <div style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{eng.email}</div>
                  </div>

                  {/* Status pill */}
                  <div style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 10px",
                    borderRadius: "20px",
                    backgroundColor: isActive ? "var(--success-50)" : "var(--danger-50)",
                    border: `1px solid ${isActive ? "var(--success-100)" : "var(--danger-100)"}`,
                    flexShrink: 0
                  }}>
                    <div style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: isActive ? "var(--success-500)" : "var(--danger-500)" }} />
                    <span style={{ fontSize: "11px", fontWeight: "700", color: isActive ? "var(--success-600)" : "var(--danger-600)" }}>
                      {isActive ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>

                {/* Info Row */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ padding: "8px 10px", backgroundColor: "var(--primary-50)", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Phone</div>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "var(--primary-900)", marginTop: "2px" }}>{eng.phoneNumber || "--"}</div>
                  </div>
                  <div style={{ padding: "8px 10px", backgroundColor: "#fff7ed", borderRadius: "8px", border: "1px solid #ffedd5" }}>
                    <div style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.4px" }}>Sites Assigned</div>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#c2410c", marginTop: "2px" }}>{sitesCount} Site{sitesCount !== 1 ? "s" : ""}</div>
                  </div>
                </div>

                {/* Actions */}
                <div style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "8px",
                  paddingTop: "10px",
                  borderTop: "1px solid var(--border-color)"
                }}>
                  <button
                    onClick={() => setSelectedEngineerId(eng.id)}
                    title="View Activity"
                    style={{
                      flex: 1,
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: "1px solid #ffedd5",
                      backgroundColor: "#fff7ed",
                      color: "#c2410c",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "#ffedd5"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "#fff7ed"}
                  >View Activity</button>
                  <button
                    onClick={() => handleOpenEditModal(eng)}
                    title="Edit Profile"
                    style={{
                      padding: "7px 12px",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "#ffffff",
                      color: "var(--primary-700)",
                      fontWeight: "700",
                      fontSize: "12px",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--primary-50)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "#ffffff"}
                  >
                    <Edit3 size={12} /> Edit
                  </button>
                  <button
                    onClick={() => handleDeleteEngineer(eng)}
                    title="Delete Engineer"
                    style={{
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid var(--danger-100)",
                      backgroundColor: "var(--danger-50)",
                      color: "var(--danger-600)",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "background 0.15s ease"
                    }}
                    onMouseEnter={e => e.currentTarget.style.backgroundColor = "var(--danger-100)"}
                    onMouseLeave={e => e.currentTarget.style.backgroundColor = "var(--danger-50)"}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* MODAL: ADD/EDIT SITE ENGINEER */}
      <Modal 
        isOpen={showFormModal} 
        onClose={() => setShowFormModal(false)} 
        title={formMode === "add" ? "Add Site Engineer" : "Edit Site Engineer"}
        maxWidth="600px"
      >
        <form onSubmit={handleFormSubmit} style={{ margin: 0, padding: 0 }}>
          {/* Offscreen dummy inputs to prevent browser autofill */}
          <input 
            type="text" 
            style={{ position: 'absolute', top: '-1000px', left: '-1000px' }} 
            aria-hidden="true" 
            tabIndex="-1" 
            name="prevent_autofill_email" 
          />
          <input 
            type="password" 
            style={{ position: 'absolute', top: '-1000px', left: '-1000px' }} 
            aria-hidden="true" 
            tabIndex="-1" 
            name="prevent_autofill_password" 
          />

          <div style={{ marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0, textTransform: "none", fontWeight: 500, lineHeight: 1.4 }}>
              {formMode === "add" 
                ? "Register a new site engineer profile, configure credentials, and assign active project sites." 
                : "Update the site engineer's contact information, holiday settings, and site allocations."}
            </p>
          </div>

          <div className="popup-form-grid">
            {/* Section 1: Profile Details */}
            <div className="popup-section-divider">
              <span>Profile Details</span>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="engineer-name">Full Name</label>
              <div className="input-wrapper">
                <User className="input-icon" size={16} />
                <input 
                  type="text" 
                  id="engineer-name" 
                  placeholder="John Doe" 
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  required 
                  autoComplete="new-name"
                />
              </div>
            </div>

            <div className="form-group" style={{ margin: 0 }}>
              <label htmlFor="engineer-phone">Phone Number</label>
              <div className="input-wrapper">
                <Phone className="input-icon" size={16} />
                <input 
                  type="tel" 
                  id="engineer-phone" 
                  placeholder="+91 9876543210" 
                  value={formPhone}
                  onChange={(e) => setFormPhone(e.target.value)}
                  required 
                  autoComplete="new-phone"
                />
              </div>
            </div>

            {/* Section 2: Account security & settings */}
            <div className="popup-section-divider">
              <span>Credentials & Settings</span>
            </div>

            {formMode === "add" ? (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="engineer-email">Email Address</label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={16} />
                    <input 
                      type="email" 
                      id="engineer-email" 
                      placeholder="john.doe@example.com" 
                      value={formEmail}
                      onChange={(e) => setFormEmail(e.target.value)}
                      required 
                      autoComplete="new-email"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="engineer-password">Initial Password</label>
                  <div className="input-wrapper">
                    <Lock className="input-icon" size={16} />
                    <input 
                      type="password" 
                      id="engineer-password" 
                      placeholder="Enter initial password (min 6 chars)"
                      value={formPassword}
                      onChange={(e) => setFormPassword(e.target.value)}
                      required 
                      autoComplete="new-password"
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0, gridColumn: "1 / -1" }}>
                  <label htmlFor="engineer-holidays">Annual Holiday Allowance</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      id="engineer-holidays" 
                      placeholder="24" 
                      min="0"
                      max="365"
                      value={formHolidayAllowance}
                      onChange={(e) => setFormHolidayAllowance(parseInt(e.target.value) || 0)}
                      required 
                    />
                  </div>
                  <p className="field-hint" style={{ margin: "4px 0 0 0" }}>Specify the number of paid/allowed leaves per year.</p>
                </div>
              </>
            ) : (
              <>
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="engineer-email">Email Address</label>
                  <div className="input-wrapper">
                    <Mail className="input-icon" size={16} style={{ opacity: 0.6 }} />
                    <input 
                      type="email" 
                      id="engineer-email" 
                      placeholder="john.doe@example.com" 
                      value={formEmail}
                      disabled={true}
                      required 
                    />
                  </div>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="engineer-holidays">Annual Holiday Allowance</label>
                  <div className="input-wrapper">
                    <input 
                      type="number" 
                      id="engineer-holidays" 
                      placeholder="24" 
                      min="0"
                      max="365"
                      value={formHolidayAllowance}
                      onChange={(e) => setFormHolidayAllowance(parseInt(e.target.value) || 0)}
                      required 
                    />
                  </div>
                </div>
              </>
            )}

            {/* Section 3: Project assignments check-cards */}
            <div className="popup-section-divider">
              <span>Project Assignments</span>
            </div>

            <div className="form-group" style={{ gridColumn: "1 / -1", margin: 0 }}>
              <label>Assign Construction Sites</label>
              <div className="site-check-card-grid">
                {sites.map(site => {
                  const isChecked = formSelectedSites.includes(site.id);
                  return (
                    <div 
                      key={site.id} 
                      className={`site-check-card ${isChecked ? "checked" : ""}`}
                      onClick={() => handleCheckboxChange(site.id)}
                    >
                      <div className="site-check-card-icon">
                        <Building2 size={16} />
                      </div>
                      <div className="site-check-card-details">
                        <span className="site-check-card-name">{site.siteName}</span>
                        <span className="site-check-card-loc">{site.location}</span>
                      </div>
                      <div className="site-check-checkbox">
                        <svg width="10" height="8" viewBox="0 0 10 8" fill="none" xmlns="http://www.w3.org/2000/svg">
                          <path d="M1 4L3.5 6.5L9 1" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                        </svg>
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="field-hint" style={{ marginTop: "8px" }}>Assign one or multiple construction sites to this engineer.</p>
            </div>
          </div>

          <div className="modal-actions" style={{ margin: "24px -24px -24px -24px" }}>
            <Button variant="outline" onClick={() => setShowFormModal(false)}>Cancel</Button>
            <Button type="submit" icon={Save}>
              Save Engineer
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: SITE ENGINEER DETAILS */}
      <Modal 
        isOpen={showDetailsModal} 
        onClose={() => setShowDetailsModal(false)} 
        title="Site Engineer Details"
        footer={<Button variant="outline" onClick={() => setShowDetailsModal(false)}>Close</Button>}
      >
        {selectedEngineer && (
          <div>
            <div className="detail-profile-header">
              <div className="detail-avatar">
                {selectedEngineer.fullName
                  ? selectedEngineer.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                  : "SE"}
              </div>
              <div className="detail-profile-meta">
                <h4>{selectedEngineer.fullName}</h4>
                <Badge status={selectedEngineer.status} />
              </div>
            </div>

             <div className="detail-grid">
              <div className="detail-info-item">
                <span className="detail-info-label">Email Address</span>
                <span className="detail-info-value font-mono">{selectedEngineer.email}</span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">Phone Number</span>
                <span className="detail-info-value">{selectedEngineer.phoneNumber || "--"}</span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">System Role</span>
                <span className="detail-info-value font-mono">Site Engineer</span>
              </div>
              <div className="detail-info-item">
                <span className="detail-info-label">Joined On</span>
                <span className="detail-info-value">
                  {selectedEngineer.createdAt 
                    ? (selectedEngineer.createdAt.seconds 
                        ? new Date(selectedEngineer.createdAt.seconds * 1000).toLocaleDateString() 
                        : new Date(selectedEngineer.createdAt).toLocaleDateString())
                    : "--"}
                </span>
              </div>
            </div>

            {/* Attendance & Holiday Stats Section */}
            <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              <h5 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }}>
                Attendance & Holiday Summary
              </h5>
              
              {statsLoading ? (
                <div style={{ padding: "16px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                  Retrieving attendance statistics...
                </div>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "16px" }}>
                  <div style={{ backgroundColor: "var(--primary-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>
                      Remaining Holidays
                    </span>
                    <strong style={{ fontSize: "18px", color: "var(--primary-950)", display: "block", marginTop: "4px" }}>
                      {selectedEngineerStats ? selectedEngineerStats.remainingHolidays : "--"}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                      of {selectedEngineer.holidayAllowance || 24} annual days
                    </span>
                  </div>
                  
                  <div style={{ backgroundColor: "var(--success-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>
                      Weekdays Worked (Month)
                    </span>
                    <strong style={{ fontSize: "18px", color: "var(--success-700)", display: "block", marginTop: "4px" }}>
                      {selectedEngineerStats ? selectedEngineerStats.weekdaysWorkedThisMonth : "--"}
                    </strong>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>
                      days checked present
                    </span>
                  </div>
                  
                  <div style={{ backgroundColor: "var(--danger-50)", padding: "12px", borderRadius: "8px", border: "1px solid var(--border-color)", gridColumn: "span 2" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>
                          Leaves Registered (Month / Year)
                        </span>
                        <strong style={{ fontSize: "18px", color: "var(--danger-600)", display: "block", marginTop: "4px" }}>
                          {selectedEngineerStats ? `${selectedEngineerStats.leavesThisMonth} / ${selectedEngineerStats.leavesThisYear}` : "-- / --"}
                        </strong>
                      </div>
                      <span style={{ fontSize: "11px", color: "var(--danger-700)", fontWeight: "600" }}>
                        Leave Days
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Logged Leaves List */}
            <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              <h5 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }}>
                Registered Leaves Log
              </h5>
              {statsLoading ? (
                <div style={{ padding: "8px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                  Loading logs...
                </div>
              ) : selectedEngineerLeaves.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                  No leave records logged.
                </p>
              ) : (
                <div style={{ maxHeight: "150px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "8px" }}>
                  {selectedEngineerLeaves.map(leave => (
                    <div key={leave.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#fff", border: "1px solid var(--border-color)", borderRadius: "6px" }}>
                      <div>
                        <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-950)", display: "block" }}>
                          {leave.date}
                        </span>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                          Reason: {leave.reason}
                        </span>
                      </div>
                      <Badge status="danger">Leave</Badge>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="detail-sites-section" style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              <h5>Assigned Construction Sites</h5>
              <ul className="detail-sites-list">
                {(!selectedEngineer.assignedSites || selectedEngineer.assignedSites.length === 0) ? (
                  <li style={{ backgroundColor: "transparent", border: "none", color: "var(--text-muted)", padding: 0 }}>
                    No construction sites assigned.
                  </li>
                ) : (
                  selectedEngineer.assignedSites.map(siteId => {
                    const site = sites.find(s => s.id === siteId);
                    return <li key={siteId}>{site ? site.siteName : `Site (ID: ${siteId})`}</li>;
                  })
                )}
              </ul>
            </div>

            {/* Administrative Actions */}
            <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              <h5 style={{ margin: "0 0 12px 0", fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }}>
                Administrative Controls
              </h5>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "10px", alignItems: "center" }}>
                <Button 
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleOpenEditModal(selectedEngineer);
                  }}
                  icon={Edit3}
                  variant="outline"
                  size="sm"
                >
                  Edit Profile
                </Button>
                
                <Button 
                  onClick={() => {
                    const newStatus = selectedEngineer.status === "active" ? "inactive" : "active";
                    showConfirmModal({
                      title: newStatus === "active" ? "Activate Engineer Account?" : "Deactivate Engineer Account?",
                      message: `Are you sure you want to change status to ${newStatus}?`,
                      confirmText: newStatus === "active" ? "Activate" : "Deactivate",
                      variant: newStatus === "active" ? "success" : "warning",
                      onConfirm: async () => {
                        await handleToggleStatus(selectedEngineer.id, selectedEngineer.status);
                        setSelectedEngineer(prev => ({
                          ...prev,
                          status: newStatus
                        }));
                        closeConfirmModal();
                      }
                    });
                  }}
                  variant="outline"
                  size="sm"
                >
                  {selectedEngineer.status === "active" ? "Deactivate Account" : "Activate Account"}
                </Button>

                <Button 
                  onClick={() => {
                    setShowDetailsModal(false);
                    handleDeleteEngineer(selectedEngineer);
                  }}
                  icon={Trash2}
                  style={{ backgroundColor: "var(--danger-600)", color: "#fff", borderColor: "var(--danger-700)", marginLeft: "auto" }}
                  size="sm"
                >
                  Delete Engineer
                </Button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />

      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

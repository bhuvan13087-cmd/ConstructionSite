import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import EngineerActivityDashboard from "./EngineerActivityDashboard";
import { 
  getSiteEngineers, 
  updateEngineerStatus, 
  saveSiteEngineerProfile,
  getSites,
  getEngineerAttendanceAndLeaveStats,
  getEngineerAttendanceHistory,
  getEngineerLeaves,
  updateEngineerPasswordInDb,
  deleteSiteEngineer
} from "../services/firebaseService";
import { calculateCoveredEngineers } from "../services/businessLogic";
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
import ViewToggle from "../components/common/ViewToggle";
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
  Building2,
  Users,
  UserCheck,
  UserX,
  LogIn,
  LogOut,
  Calendar
} from "lucide-react";


export default function SiteEngineers() {
  const { userProfile } = useAuth();
  const [engineers, setEngineers] = useState([]);
  const [sites, setSites] = useState([]);
  const [selectedEngineerId, setSelectedEngineerId] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [viewMode, setViewMode] = useState("normal");
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
  const [selectedEngineerAttendance, setSelectedEngineerAttendance] = useState([]);
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
      const [fetchedSites, fetchedEngineers] = await Promise.all([
        getSites(),
        getSiteEngineers()
      ]);
      setSites(fetchedSites);
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
      const fetchedEngineers = await getSiteEngineers();
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
    setSelectedEngineerAttendance([]);
    setStatsLoading(true);
    try {
      const [stats, leaves, attend] = await Promise.all([
        getEngineerAttendanceAndLeaveStats(eng.id, eng.holidayAllowance || 24),
        getEngineerLeaves(eng.id),
        getEngineerAttendanceHistory(eng.id)
      ]);
      setSelectedEngineerStats(stats);
      setSelectedEngineerLeaves(leaves);
      setSelectedEngineerAttendance(attend);
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
          formHolidayAllowance,
          "",
          userProfile?.uid || userProfile?.id || null
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

  // Derived counts for KPI strip
  const totalEngineers = engineers.length;
  const activeCount = engineers.filter(e => (e.status || "active").toLowerCase() === "active").length;
  const inactiveCount = engineers.filter(e => (e.status || "").toLowerCase() === "inactive").length;
  const siteCovered = calculateCoveredEngineers(engineers);

  return (
    <Layout title="Site Engineers" description="Manage Site Engineer security credentials and construction site assignments.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── Page Header ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginBottom: "18px",
        flexWrap: "wrap",
        gap: "12px"
      }}>
        <div>
          <h1 style={{
            fontFamily: "var(--font-family-title)",
            fontSize: "20px",
            fontWeight: "800",
            color: "var(--primary-950)",
            margin: 0,
            lineHeight: "1.2"
          }}>
            Site Engineers
          </h1>
          <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: "3px 0 0 0", fontWeight: 500 }}>
            Manage engineer profiles, credentials, and site deployments.
          </p>
        </div>
        <Button 
          onClick={handleOpenAddModal} 
          id="btn-add-engineer" 
          icon={Plus} 
          style={{
            width: "auto",
            padding: "8px 16px",
            fontSize: "13px",
            fontWeight: "600",
            borderRadius: "8px",
            display: "inline-flex",
            alignItems: "center",
            gap: "6px",
            boxShadow: "0 2px 6px rgba(249, 115, 22, 0.22)"
          }}
        >
          Add Engineer
        </Button>
      </div>

      {/* ── Summary Metric Cards ── */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "12px",
        marginBottom: "20px"
      }}>
        {[
          {
            label: "Total Engineers",
            value: totalEngineers,
            sub: "Registered accounts",
            icon: Users,
            iconBg: "var(--accent-50)",
            iconColor: "var(--brand-orange)",
            valColor: "var(--primary-950)"
          },
          {
            label: "Active",
            value: activeCount,
            sub: "Currently active",
            icon: UserCheck,
            iconBg: "#f0fdf4",
            iconColor: "var(--success-600)",
            valColor: "var(--success-600)"
          },
          {
            label: "Inactive",
            value: inactiveCount,
            sub: "Disabled / inactive",
            icon: UserX,
            iconBg: "#f8fafc",
            iconColor: "var(--text-muted)",
            valColor: "var(--text-muted)"
          },
          {
            label: "Site Covered",
            value: siteCovered,
            sub: "Total site assignments",
            icon: Building2,
            iconBg: "#fff7ed",
            iconColor: "#c2410c",
            valColor: "#c2410c"
          }
        ].map((card, idx) => {
          const IconComponent = card.icon;
          return (
            <div
              key={idx}
              style={{
                background: "#ffffff",
                border: "1px solid var(--border-color)",
                borderRadius: "10px",
                padding: "14px 16px",
                display: "flex",
                flexDirection: "column",
                gap: "4px",
                boxShadow: "var(--shadow-sm)"
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                <div style={{
                  width: "26px",
                  height: "26px",
                  borderRadius: "6px",
                  background: card.iconBg,
                  color: card.iconColor,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  flexShrink: 0
                }}>
                  <IconComponent size={14} />
                </div>
                <span style={{
                  fontSize: "11px",
                  fontWeight: "700",
                  color: "var(--text-muted)",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  whiteSpace: "nowrap"
                }}>
                  {card.label}
                </span>
              </div>
              <div style={{
                fontSize: "24px",
                fontWeight: "800",
                color: card.valColor,
                fontFamily: "var(--font-family-title)",
                lineHeight: "1.1"
              }}>
                {card.value}
              </div>
              <div style={{
                fontSize: "11.5px",
                color: "var(--text-muted)",
                fontWeight: "500",
                marginTop: "1px"
              }}>
                {card.sub}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Toolbar: Search & View Toggle ── */}
      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "10px",
        marginBottom: "12px",
        flexWrap: "wrap"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flex: 1, minWidth: "200px", maxWidth: "420px" }}>
          <div className="input-wrapper search-wrapper" style={{ flex: 1 }}>
            <Search className="input-icon" size={15} />
            <input
              type="text"
              placeholder="Search by name or email…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{ fontSize: "13px" }}
            />
          </div>
          {searchQuery && (
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: 600, whiteSpace: "nowrap" }}>
              {filteredEngineers.length} result{filteredEngineers.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <ViewToggle viewMode={viewMode} onChange={setViewMode} />
      </div>

      {/* ── Engineer Table / Grid ── */}
      <div style={{
        background: "#fff",
        border: "1px solid var(--border-color)",
        borderRadius: "14px",
        overflow: "hidden",
        boxShadow: "var(--shadow-sm)"
      }}>
        {filteredEngineers.length === 0 ? (
          <div style={{ textAlign: "center", padding: "56px 24px", color: "var(--text-muted)" }}>
            <div style={{ fontSize: "36px", marginBottom: "10px" }}>👷</div>
            <div style={{ fontWeight: "700", fontSize: "14px", color: "var(--primary-800)", marginBottom: "4px" }}>
              {searchQuery ? "No engineers match your search" : "No site engineers yet"}
            </div>
            <div style={{ fontSize: "12px" }}>
              {searchQuery ? "Try a different name or email." : `Click "Add Engineer" to register one.`}
            </div>
          </div>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px", padding: "16px" }}>
            {filteredEngineers.map((eng) => {
              const isActive = eng.status === "active";
              const initials = eng.fullName
                ? eng.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                : "SE";
              const sitesCount = eng.assignedSites ? eng.assignedSites.length : 0;

              return (
                <div
                  key={eng.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid var(--border-color)",
                    borderRadius: "12px",
                    padding: "16px",
                    boxShadow: "0 2px 6px rgba(0,0,0,0.03)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "14px",
                    transition: "all 0.15s ease"
                  }}
                >
                  <div>
                    {/* Header: Avatar, Name, Email & Status Badge */}
                    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: "10px", marginBottom: "12px" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <div
                          onClick={() => setSelectedEngineerId(eng.id)}
                          style={{
                            width: "38px",
                            height: "38px",
                            borderRadius: "10px",
                            background: isActive
                              ? "linear-gradient(135deg, #fff7ed, #ffedd5)"
                              : "linear-gradient(135deg, var(--primary-100), var(--primary-200))",
                            border: `1.5px solid ${isActive ? "#ffedd5" : "var(--border-color)"}`,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "800",
                            fontSize: "13px",
                            color: isActive ? "#c2410c" : "var(--primary-600)",
                            cursor: "pointer",
                            flexShrink: 0
                          }}
                        >
                          {initials}
                        </div>
                        <div>
                          <h4 
                            onClick={() => setSelectedEngineerId(eng.id)}
                            style={{ margin: 0, fontSize: "14px", fontWeight: "700", color: "#0f172a", cursor: "pointer" }}
                            onMouseEnter={e => e.currentTarget.style.color = "#ea580c"}
                            onMouseLeave={e => e.currentTarget.style.color = "#0f172a"}
                          >
                            {eng.fullName}
                          </h4>
                          <span style={{ fontSize: "11.5px", color: "var(--text-muted)", display: "block" }}>{eng.email}</span>
                        </div>
                      </div>
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        fontSize: "11px",
                        fontWeight: "700",
                        backgroundColor: isActive ? "var(--success-50)" : "var(--danger-50)",
                        color: isActive ? "var(--success-600)" : "var(--danger-600)",
                        border: `1px solid ${isActive ? "var(--success-100)" : "var(--danger-100)"}`
                      }}>
                        <span style={{
                          width: "5px",
                          height: "5px",
                          borderRadius: "50%",
                          backgroundColor: isActive ? "var(--success-500)" : "var(--danger-500)"
                        }} />
                        {isActive ? "Active" : "Inactive"}
                      </span>
                    </div>

                    {/* Details: Phone & Assigned Sites */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px", color: "#475569" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <Phone size={13} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                        <span>{eng.phoneNumber || "No phone number"}</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                        <span style={{ color: "#64748b" }}>Assigned Sites:</span>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          padding: "2px 8px",
                          borderRadius: "6px",
                          fontSize: "11px",
                          fontWeight: "700",
                          backgroundColor: sitesCount > 0 ? "#fff7ed" : "var(--primary-50)",
                          color: sitesCount > 0 ? "#c2410c" : "var(--primary-600)"
                        }}>
                          <Building2 size={11} />
                          {sitesCount} Site{sitesCount !== 1 ? "s" : ""}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                    <Button 
                      onClick={() => setSelectedEngineerId(eng.id)} 
                      variant="outline" 
                      style={{ height: "30px", padding: "0 10px", fontSize: "11.5px" }}
                    >
                      Activity
                    </Button>
                    <button
                      className="btn-icon btn-edit-action"
                      onClick={() => handleOpenEditModal(eng)}
                      title="Edit Profile"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#ea580c",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        transition: "transform 0.15s ease, color 0.15s ease",
                        outline: "none"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#c2410c"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#ea580c"; }}
                    >
                      <Edit3 size={16} />
                    </button>
                    <button
                      className="btn-icon btn-delete-action"
                      onClick={() => handleDeleteEngineer(eng)}
                      title="Delete Engineer"
                      style={{
                        background: "transparent",
                        border: "none",
                        color: "#dc2626",
                        cursor: "pointer",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        width: "28px",
                        height: "28px",
                        transition: "transform 0.15s ease, color 0.15s ease",
                        outline: "none"
                      }}
                      onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#b91c1c"; }}
                      onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#dc2626"; }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ minWidth: "640px" }}>
              <thead>
                <tr>
                  <th style={{ width: "30%", paddingLeft: "20px" }}>Engineer</th>
                  <th style={{ width: "18%" }}>Contact</th>
                  <th style={{ width: "12%", textAlign: "center" }}>Status</th>
                  <th style={{ width: "14%", textAlign: "center" }}>Sites Assigned</th>
                  <th style={{ width: "16%", textAlign: "right", paddingRight: "20px" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredEngineers.map((eng) => {
                  const isActive = eng.status === "active";
                  const initials = eng.fullName
                    ? eng.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                    : "SE";
                  const sitesCount = eng.assignedSites ? eng.assignedSites.length : 0;

                  return (
                    <tr
                      key={eng.id}
                      style={{ transition: "background 0.12s ease" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f8fafc"}
                      onMouseLeave={e => e.currentTarget.style.background = "transparent"}
                    >
                      {/* Engineer column */}
                      <td style={{ paddingLeft: "20px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "11px" }}>
                          <div
                            onClick={() => setSelectedEngineerId(eng.id)}
                            title="View Activity Dashboard"
                            style={{
                              width: "36px",
                              height: "36px",
                              borderRadius: "10px",
                              background: isActive
                                ? "linear-gradient(135deg, #fff7ed, #ffedd5)"
                                : "linear-gradient(135deg, var(--primary-100), var(--primary-200))",
                              border: `1.5px solid ${isActive ? "#ffedd5" : "var(--border-color)"}`,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "800",
                              fontSize: "12px",
                              color: isActive ? "#c2410c" : "var(--primary-600)",
                              cursor: "pointer",
                              flexShrink: 0,
                              transition: "transform 0.15s ease, box-shadow 0.15s ease",
                              userSelect: "none"
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; e.currentTarget.style.boxShadow = "0 2px 8px rgba(249,115,22,0.18)"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.boxShadow = "none"; }}
                          >
                            {initials}
                          </div>
                          <div style={{ minWidth: 0 }}>
                            <div
                              onClick={() => setSelectedEngineerId(eng.id)}
                              title="View Activity Dashboard"
                              style={{
                                fontWeight: "700",
                                fontSize: "13px",
                                color: "var(--primary-950)",
                                cursor: "pointer",
                                whiteSpace: "nowrap",
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                maxWidth: "200px",
                                transition: "color 0.12s ease"
                              }}
                              onMouseEnter={e => e.currentTarget.style.color = "#ea580c"}
                              onMouseLeave={e => e.currentTarget.style.color = "var(--primary-950)"}
                            >
                              {eng.fullName}
                            </div>
                            <div style={{
                              fontSize: "11.5px",
                              color: "var(--text-muted)",
                              fontWeight: 500,
                              whiteSpace: "nowrap",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              maxWidth: "200px",
                              marginTop: "1px"
                            }}>
                              {eng.email}
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact column */}
                      <td>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "5px",
                          fontSize: "12.5px",
                          color: "var(--primary-700)",
                          fontWeight: 600
                        }}>
                          <Phone size={12} style={{ color: "var(--text-muted)", flexShrink: 0 }} />
                          <span style={{ whiteSpace: "nowrap" }}>{eng.phoneNumber || "—"}</span>
                        </div>
                      </td>

                      {/* Status column */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 9px",
                          borderRadius: "20px",
                          fontSize: "11px",
                          fontWeight: "700",
                          backgroundColor: isActive ? "var(--success-50)" : "var(--danger-50)",
                          color: isActive ? "var(--success-600)" : "var(--danger-600)",
                          border: `1px solid ${isActive ? "var(--success-100)" : "var(--danger-100)"}`,
                          whiteSpace: "nowrap"
                        }}>
                          <span style={{
                            width: "5px",
                            height: "5px",
                            borderRadius: "50%",
                            backgroundColor: isActive ? "var(--success-500)" : "var(--danger-500)",
                            flexShrink: 0
                          }} />
                          {isActive ? "Active" : "Inactive"}
                        </span>
                      </td>

                      {/* Sites Assigned column */}
                      <td style={{ textAlign: "center" }}>
                        <span style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "5px",
                          padding: "3px 10px",
                          borderRadius: "8px",
                          fontSize: "12px",
                          fontWeight: "700",
                          backgroundColor: sitesCount > 0 ? "#fff7ed" : "var(--primary-50)",
                          color: sitesCount > 0 ? "#c2410c" : "var(--primary-600)",
                          border: `1px solid ${sitesCount > 0 ? "#ffedd5" : "var(--border-color)"}`,
                          whiteSpace: "nowrap"
                        }}>
                          <Building2 size={11} />
                          {sitesCount} Site{sitesCount !== 1 ? "s" : ""}
                        </span>
                      </td>

                      {/* Actions column */}
                      <td style={{ paddingRight: "20px" }}>
                        <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                          <button
                            className="btn-icon btn-view-action"
                            onClick={() => setSelectedEngineerId(eng.id)}
                            title="View Activity Dashboard"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#2563eb",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              transition: "transform 0.15s ease, color 0.15s ease",
                              outline: "none",
                              flexShrink: 0
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#1d4ed8"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#2563eb"; }}
                          >
                            <Eye size={15} />
                          </button>
                          <button
                            className="btn-icon btn-edit-action"
                            onClick={() => handleOpenEditModal(eng)}
                            title="Edit Profile"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#ea580c",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              transition: "transform 0.15s ease, color 0.15s ease",
                              outline: "none",
                              flexShrink: 0
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#c2410c"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#ea580c"; }}
                          >
                            <Edit3 size={15} />
                          </button>
                          <button
                            className="btn-icon btn-delete-action"
                            onClick={() => handleDeleteEngineer(eng)}
                            title="Delete Engineer"
                            style={{
                              background: "transparent",
                              border: "none",
                              color: "#dc2626",
                              cursor: "pointer",
                              display: "inline-flex",
                              alignItems: "center",
                              justifyContent: "center",
                              width: "28px",
                              height: "28px",
                              transition: "transform 0.15s ease, color 0.15s ease",
                              outline: "none",
                              flexShrink: 0
                            }}
                            onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.22)"; e.currentTarget.style.color = "#b91c1c"; }}
                            onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; e.currentTarget.style.color = "#dc2626"; }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
        {/* Table footer */}
        {filteredEngineers.length > 0 && (
          <div style={{
            borderTop: "1px solid var(--border-color)",
            padding: "9px 20px",
            background: "#f8fafc"
          }}>
            <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>
              Showing {filteredEngineers.length} of {totalEngineers} engineer{totalEngineers !== 1 ? "s" : ""}
            </span>
          </div>
        )}
      </div>

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

            {/* Attendance Records Section */}
            <div style={{ marginTop: "20px", borderTop: "1px solid var(--border-color)", paddingTop: "16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
                <h5 style={{ margin: 0, fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }}>
                  Recent Attendance Logs Across Sites
                </h5>
                <Button 
                  size="sm" 
                  variant="outline"
                  onClick={() => {
                    setShowDetailsModal(false);
                    setSelectedEngineerId(selectedEngineer.id);
                  }}
                  style={{ fontSize: "11px", padding: "4px 8px" }}
                >
                  View Full Logs
                </Button>
              </div>
              {statsLoading ? (
                <div style={{ padding: "8px", textAlign: "center", fontSize: "12px", color: "var(--text-muted)" }}>
                  Retrieving attendance logs...
                </div>
              ) : selectedEngineerAttendance.length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                  No attendance records logged for this engineer.
                </p>
              ) : (
                <div style={{ maxHeight: "240px", overflowY: "auto", overflowX: "auto", border: "1px solid var(--border-color)", borderRadius: "8px", backgroundColor: "#ffffff" }}>
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px", textAlign: "left" }}>
                    <thead>
                      <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border-color)" }}>
                        <th style={{ padding: "8px 10px", width: "46px", textAlign: "center", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Photo</th>
                        <th style={{ padding: "8px 10px", width: "140px", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Site Engineer</th>
                        <th style={{ padding: "8px 10px", width: "110px", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Date</th>
                        <th style={{ padding: "8px 10px", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Site</th>
                        <th style={{ padding: "8px 10px", width: "100px", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Check-in</th>
                        <th style={{ padding: "8px 10px", width: "100px", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Check-out</th>
                        <th style={{ padding: "8px 10px", width: "95px", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Status</th>
                        <th style={{ padding: "8px 10px", width: "105px", color: "#475569", fontWeight: "750", fontSize: "11px", textTransform: "uppercase" }}>Verification</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selectedEngineerAttendance.slice(0, 15).map((att, idx) => {
                        const siteObj = sites.find(s => s.id === att.siteId);
                        const siteName = att.siteName || (siteObj ? siteObj.siteName : (att.siteId ? `Site (ID: ${att.siteId})` : "General Site"));
                        const engName = att.engineerName || selectedEngineer?.fullName || "Site Engineer";
                        const recDate = att.date || att.attendanceDate || "--";
                        const checkInTime = att.checkInTimeFormatted || att.time || "--";
                        const checkOutTime = att.checkOutTimeFormatted;
                        const isCheckedOut = att.isCheckedOut || att.status === "checked_out" || Boolean(checkOutTime);
                        const photoUrl = att.photoUrl || att.checkInPhotoUrl;
                        const isVerified = att.verificationStatus === "verified" || att.isVerified;

                        return (
                          <tr 
                            key={att.id || `se_att_${idx}`} 
                            style={{ 
                              borderBottom: idx < Math.min(selectedEngineerAttendance.length, 15) - 1 ? "1px solid #f1f5f9" : "none" 
                            }}
                          >
                            <td style={{ padding: "6px 10px", textAlign: "center", verticalAlign: "middle" }}>
                              {photoUrl ? (
                                <img 
                                  src={photoUrl} 
                                  alt="Selfie"
                                  style={{ width: "32px", height: "32px", borderRadius: "6px", objectFit: "cover", border: "1px solid #cbd5e1" }}
                                />
                              ) : (
                                <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#f1f5f9", color: "#64748b", display: "inline-flex", alignItems: "center", justifyContent: "center", border: "1px solid #e2e8f0" }}>
                                  <Building2 size={14} />
                                </div>
                              )}
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              <strong style={{ fontSize: "12px", color: "var(--primary-950)", fontWeight: "750" }}>
                                {engName}
                              </strong>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              <span className="font-mono" style={{ fontWeight: "700", color: "#0f172a" }}>
                                {recDate}
                              </span>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle" }}>
                              <strong style={{ color: "#1e293b", fontSize: "12px", display: "block" }}>
                                {siteName}
                              </strong>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              <span className="font-mono" style={{ fontWeight: "700", color: "#15803d" }}>
                                {checkInTime}
                              </span>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              {checkOutTime ? (
                                <span className="font-mono" style={{ fontWeight: "700", color: "#3730a3" }}>
                                  {checkOutTime}
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontStyle: "italic" }}>—</span>
                              )}
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              <Badge status={isCheckedOut ? "info" : "success"}>
                                {isCheckedOut ? "Checked Out" : "Present"}
                              </Badge>
                            </td>
                            <td style={{ padding: "6px 10px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                              {isVerified ? (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10.5px", fontWeight: "700", color: "#059669", backgroundColor: "#ecfdf5", padding: "2px 6px", borderRadius: "10px", border: "1px solid #a7f3d0" }}>
                                  <ShieldCheck size={11} /> Verified
                                </span>
                              ) : (
                                <span style={{ display: "inline-flex", alignItems: "center", gap: "3px", fontSize: "10.5px", fontWeight: "600", color: "#64748b", backgroundColor: "#f1f5f9", padding: "2px 6px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                                  Logged
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
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

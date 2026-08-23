import React, { useState, useEffect } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { changeCurrentUserPassword } from "../firebase/auth";
import { updateAuthenticatedUserProfile } from "../services/firebaseService";
import DocumentsDashboard from "./DocumentsDashboard";
import {
  User,
  Shield,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  FolderOpen,
  Mail,
  Phone,
  Calendar,
  Clock,
  Sparkles,
  ChevronRight,
  Info,
  Pencil
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import Badge from "../components/common/Badge";

export default function Settings({ initialTab = "profile" }) {
  const [searchParams, setSearchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user, userProfile } = useAuth();

  const tabParam = searchParams.get("tab") || initialTab;
  const [activeTab, setActiveTab] = useState(tabParam === "documents" ? "documents" : "profile");

  // Synchronize URL query parameter with active tab
  useEffect(() => {
    const currentTab = searchParams.get("tab");
    if (currentTab === "documents" || currentTab === "profile") {
      setActiveTab(currentTab);
    }
  }, [searchParams]);

  const handleTabChange = (tabName) => {
    setActiveTab(tabName);
    setSearchParams({ tab: tabName });
  };

  // Toast state
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4500);
  };

  // ── Edit Profile Modal State ──
  const [isEditProfileModalOpen, setIsEditProfileModalOpen] = useState(false);
  const [editFullName, setEditFullName] = useState("");
  const [editPhoneNumber, setEditPhoneNumber] = useState("");
  const [editProfileError, setEditProfileError] = useState("");
  const [isSubmittingProfile, setIsSubmittingProfile] = useState(false);

  const handleOpenEditProfileModal = () => {
    setEditFullName(userProfile?.fullName || userProfile?.name || user?.displayName || "");
    setEditPhoneNumber(userProfile?.phoneNumber || userProfile?.phone || "");
    setEditProfileError("");
    setIsEditProfileModalOpen(true);
  };

  const handleCloseEditProfileModal = () => {
    if (isSubmittingProfile) return;
    setIsEditProfileModalOpen(false);
    setEditProfileError("");
  };

  const handleEditProfileSubmit = async (e) => {
    e.preventDefault();
    setEditProfileError("");

    const trimmedName = editFullName.trim();
    const trimmedPhone = editPhoneNumber.trim();

    if (!trimmedName) {
      setEditProfileError("Admin Name is required.");
      return;
    }

    setIsSubmittingProfile(true);
    try {
      const currentUid = user?.uid || userProfile?.uid || userProfile?.id;
      await updateAuthenticatedUserProfile(currentUid, {
        fullName: trimmedName,
        phoneNumber: trimmedPhone
      });

      showToast("Profile details updated successfully!", "success");
      handleCloseEditProfileModal();
    } catch (err) {
      console.error("Profile update error:", err);
      setEditProfileError(err.message || "Failed to update profile details.");
    } finally {
      setIsSubmittingProfile(false);
    }
  };

  // ── Change Password Modal State ──
  const [isPasswordModalOpen, setIsPasswordModalOpen] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [isSubmittingPassword, setIsSubmittingPassword] = useState(false);

  const handleOpenPasswordModal = () => {
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setShowCurrentPassword(false);
    setShowNewPassword(false);
    setShowConfirmPassword(false);
    setPasswordError("");
    setIsPasswordModalOpen(true);
  };

  const handleClosePasswordModal = () => {
    if (isSubmittingPassword) return;
    setIsPasswordModalOpen(false);
    setCurrentPassword("");
    setNewPassword("");
    setConfirmPassword("");
    setPasswordError("");
  };

  const handlePasswordSubmit = async (e) => {
    e.preventDefault();
    setPasswordError("");

    // Validation
    if (!currentPassword || !currentPassword.trim()) {
      setPasswordError("Please enter your current password.");
      return;
    }

    if (!newPassword || newPassword.length < 6) {
      setPasswordError("New password must be at least 6 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError("New password and confirmation password do not match.");
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError("New password must be different from your current password.");
      return;
    }

    setIsSubmittingPassword(true);
    try {
      await changeCurrentUserPassword(currentPassword, newPassword);
      showToast("Password updated successfully! Your new password is now active.", "success");
      handleClosePasswordModal();
    } catch (err) {
      setPasswordError(err.message || "Failed to update password. Please check your current password.");
    } finally {
      setIsSubmittingPassword(false);
    }
  };

  // Format initials
  const fullName = userProfile?.fullName || userProfile?.name || user?.displayName || (userProfile?.role === "admin" ? "Admin" : "Engineer");
  const getInitials = (name) => {
    if (!name) return "AD";
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) {
      return (parts[0][0] + parts[1][0]).toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  const roleTitle = userProfile?.role === "super_admin" || userProfile?.role === "superadmin"
    ? "Super Administrator"
    : userProfile?.role === "admin"
      ? "Administrator"
      : "Site Engineer";

  return (
    <Layout title="Settings & Profile" description="Manage your account profile, credentials, security, and project records.">
      {/* Toast Notification */}
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Navigation Header / Breadcrumbs */}
      <div style={{ marginBottom: "20px" }}>
        <div className="breadcrumb" style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)", marginBottom: "8px" }}>
          <span style={{ fontWeight: 600 }}>Settings</span>
          <ChevronRight size={13} />
          <span style={{ fontWeight: 700, color: "var(--primary-900)" }}>
            {activeTab === "profile" ? "Profile & Security" : "Project Documents"}
          </span>
        </div>

        {/* Tab Selector */}
        <div style={{
          display: "flex",
          gap: "8px",
          borderBottom: "1px solid var(--border-color)",
          paddingBottom: "12px",
          marginTop: "10px"
        }}>
          <button
            type="button"
            onClick={() => handleTabChange("profile")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: activeTab === "profile" ? "1px solid #fed7aa" : "1px solid transparent",
              backgroundColor: activeTab === "profile" ? "#fff7ed" : "transparent",
              color: activeTab === "profile" ? "#c2410c" : "var(--text-muted)",
              fontWeight: activeTab === "profile" ? "800" : "600",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <User size={16} />
            Profile &amp; Security
          </button>

          <button
            type="button"
            onClick={() => handleTabChange("documents")}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
              padding: "8px 16px",
              borderRadius: "8px",
              border: activeTab === "documents" ? "1px solid #fed7aa" : "1px solid transparent",
              backgroundColor: activeTab === "documents" ? "#fff7ed" : "transparent",
              color: activeTab === "documents" ? "#c2410c" : "var(--text-muted)",
              fontWeight: activeTab === "documents" ? "800" : "600",
              fontSize: "13px",
              cursor: "pointer",
              transition: "all 0.15s ease"
            }}
          >
            <FolderOpen size={16} />
            Project Documents
          </button>
        </div>
      </div>

      {activeTab === "profile" ? (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", maxWidth: "900px" }}>
          
          {/* ── Profile Overview Banner Card ── */}
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--border-color)",
            borderRadius: "16px",
            boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
            padding: "24px",
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "20px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "18px" }}>
              <div style={{
                width: "68px",
                height: "68px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-50, #fff7ed)",
                border: "2.5px solid var(--accent-200, #fed7aa)",
                color: "var(--accent-700, #c2410c)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "900",
                fontSize: "22px",
                boxShadow: "0 2px 6px rgba(194,65,12,0.12)",
                flexShrink: 0
              }}>
                {getInitials(fullName)}
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                  <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "900", color: "var(--primary-950)" }}>
                    {fullName}
                  </h2>
                  <span style={{
                    fontSize: "11px",
                    fontWeight: "800",
                    padding: "3px 10px",
                    borderRadius: "20px",
                    backgroundColor: "#eff6ff",
                    color: "#1d4ed8",
                    border: "1px solid #bfdbfe",
                    textTransform: "uppercase",
                    letterSpacing: "0.5px"
                  }}>
                    {roleTitle}
                  </span>
                  <Badge status={userProfile?.status || "active"} />
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Mail size={13} style={{ color: "var(--accent-500, #f97316)" }} />
                  {userProfile?.email || user?.email || "No email registered"}
                </p>
              </div>
            </div>

            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <Button
                variant="outline"
                icon={Pencil}
                onClick={handleOpenEditProfileModal}
                style={{
                  height: "42px",
                  fontWeight: "750",
                  fontSize: "13px",
                  borderRadius: "10px",
                  borderColor: "var(--accent-300, #fdba74)",
                  color: "var(--accent-700, #c2410c)",
                  backgroundColor: "#fff7ed"
                }}
              >
                Edit Profile
              </Button>

              <Button
                variant="primary"
                icon={KeyRound}
                onClick={handleOpenPasswordModal}
                style={{
                  height: "42px",
                  fontWeight: "750",
                  fontSize: "13px",
                  borderRadius: "10px",
                  backgroundColor: "var(--accent-500, #f97316)",
                  boxShadow: "0 2px 4px rgba(249,115,22,0.25)"
                }}
              >
                Change Password
              </Button>
            </div>
          </div>

          {/* ── Account Details & Security Grid ── */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
            
            {/* Account Details Card */}
            <div style={{
              background: "#ffffff",
              border: "1px solid var(--border-color)",
              borderRadius: "16px",
              boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              gap: "16px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <User size={18} style={{ color: "var(--accent-600, #ea580c)" }} />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-950)" }}>
                    Account Information
                  </h3>
                </div>
                <button
                  type="button"
                  onClick={handleOpenEditProfileModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "4px 9px",
                    borderRadius: "6px",
                    border: "1px solid var(--accent-200, #fed7aa)",
                    backgroundColor: "var(--accent-50, #fff7ed)",
                    color: "var(--accent-700, #c2410c)",
                    fontSize: "11.5px",
                    fontWeight: "750",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  title="Edit Profile Details"
                >
                  <Pencil size={12} /> Edit
                </button>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Full Name</span>
                  <strong style={{ color: "var(--primary-950)", fontWeight: "700" }}>{fullName}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Email Address</span>
                  <strong style={{ color: "var(--primary-950)", fontWeight: "700" }}>{userProfile?.email || user?.email || "—"}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Phone Contact</span>
                  <strong style={{ color: "var(--primary-950)", fontWeight: "700" }}>{userProfile?.phoneNumber || userProfile?.phone || "—"}</strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Assigned Role</span>
                  <strong style={{ color: "var(--primary-950)", fontWeight: "700", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    {roleTitle} <Lock size={12} style={{ color: "#94a3b8" }} title="Role is permanently protected" />
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f8fafc", paddingBottom: "8px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500" }}>Account Status</span>
                  <strong style={{ color: "#16a34a", fontWeight: "750", display: "flex", alignItems: "center", gap: "4px" }}>
                    <CheckCircle2 size={13} /> Active
                  </strong>
                </div>

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "4px" }}>
                  <span style={{ color: "var(--text-muted)", fontWeight: "500", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    User ID (UID) <Lock size={11} style={{ color: "#94a3b8" }} title="UID is immutable" />
                  </span>
                  <span style={{
                    fontSize: "11px",
                    fontFamily: "monospace",
                    backgroundColor: "#f1f5f9",
                    padding: "2px 6px",
                    borderRadius: "4px",
                    color: "#475569",
                    maxWidth: "180px",
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap"
                  }}>
                    {user?.uid || userProfile?.uid || "—"}
                  </span>
                </div>
              </div>
            </div>

            {/* Security & Password Card */}
            <div style={{
              background: "#ffffff",
              border: "1px solid var(--border-color)",
              borderRadius: "16px",
              boxShadow: "0 2px 8px rgba(15,23,42,0.05)",
              padding: "22px 24px",
              display: "flex",
              flexDirection: "column",
              justifyContent: "space-between",
              gap: "16px"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
                  <Shield size={18} style={{ color: "#16a34a" }} />
                  <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-950)" }}>
                    Security &amp; Password
                  </h3>
                </div>

                <p style={{ fontSize: "12.5px", color: "var(--text-muted)", lineHeight: "1.5", marginTop: "12px" }}>
                  Your password is securely managed and encrypted by Firebase Authentication. Keep your account protected by regularly updating your credentials.
                </p>

                <div style={{
                  backgroundColor: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: "10px",
                  padding: "12px 14px",
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  marginTop: "8px"
                }}>
                  <Lock size={16} style={{ color: "#64748b", flexShrink: 0 }} />
                  <div style={{ fontSize: "12px" }}>
                    <strong style={{ color: "var(--primary-950)", display: "block" }}>Password Protection</strong>
                    <span style={{ color: "var(--text-muted)" }}>Re-authentication is required to make password changes.</span>
                  </div>
                </div>
              </div>

              <div style={{ borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
                <Button
                  variant="outline"
                  icon={KeyRound}
                  onClick={handleOpenPasswordModal}
                  style={{
                    width: "100%",
                    height: "40px",
                    fontWeight: "750",
                    fontSize: "13px",
                    borderRadius: "8px",
                    borderColor: "var(--accent-300, #fdba74)",
                    color: "var(--accent-700, #c2410c)",
                    backgroundColor: "#fff7ed"
                  }}
                >
                  Change Password
                </Button>
              </div>
            </div>
          </div>

        </div>
      ) : (
        /* ── Project Documents Embedded View ── */
        <DocumentsDashboard />
      )}

      {/* ── Production-Safe Edit Profile Modal ── */}
      <Modal
        isOpen={isEditProfileModalOpen}
        onClose={handleCloseEditProfileModal}
        title="Edit Profile Information"
        maxWidth="480px"
      >
        <form onSubmit={handleEditProfileSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
            Update your personal contact information. Identity, role, and system permissions are protected and immutable.
          </p>

          {editProfileError && (
            <div style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              fontSize: "12px",
              color: "#b91c1c"
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{editProfileError}</span>
            </div>
          )}

          {/* Admin Name Field */}
          <div className="login-form-group">
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
              Admin Name <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <input
              type="text"
              value={editFullName}
              onChange={(e) => setEditFullName(e.target.value)}
              placeholder="Enter your full admin name"
              required
              style={{
                width: "100%",
                height: "40px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                fontSize: "13px",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Email Address (Read-Only Authentication Identity) */}
          <div className="login-form-group">
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
              <span>Email Address</span>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)", display: "inline-flex", alignItems: "center", gap: "3px" }}>
                <Lock size={11} style={{ color: "#94a3b8" }} /> Read-only (Login Identity)
              </span>
            </label>
            <div style={{
              width: "100%",
              height: "40px",
              padding: "0 12px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              backgroundColor: "#f8fafc",
              fontSize: "13px",
              color: "#475569",
              display: "flex",
              alignItems: "center",
              boxSizing: "border-box"
            }}>
              {userProfile?.email || user?.email || "—"}
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "3px" }}>
              Account email is managed as your primary login identity and cannot be edited.
            </span>
          </div>

          {/* Phone Contact Field */}
          <div className="login-form-group">
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
              Contact Number
            </label>
            <input
              type="tel"
              value={editPhoneNumber}
              onChange={(e) => setEditPhoneNumber(e.target.value)}
              placeholder="e.g. +91 98765 43210"
              style={{
                width: "100%",
                height: "40px",
                padding: "0 12px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                fontSize: "13px",
                boxSizing: "border-box"
              }}
            />
          </div>

          {/* Protected Fields Preview (Read-Only) */}
          <div style={{
            backgroundColor: "#f8fafc",
            border: "1px solid #e2e8f0",
            borderRadius: "10px",
            padding: "12px 14px",
            display: "flex",
            flexDirection: "column",
            gap: "8px"
          }}>
            <div style={{ fontSize: "11.5px", fontWeight: "750", color: "#475569", display: "flex", alignItems: "center", gap: "5px" }}>
              <Lock size={12} /> Protected Identity Attributes (Immutable)
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(130px, 1fr))", gap: "8px", fontSize: "11.5px" }}>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Role:</span>
                <strong style={{ color: "var(--primary-950)" }}>{roleTitle}</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block" }}>Status:</span>
                <strong style={{ color: "#16a34a" }}>Active</strong>
              </div>
              <div>
                <span style={{ color: "var(--text-muted)", display: "block" }}>UID:</span>
                <span style={{ fontFamily: "monospace", color: "#64748b" }}>{user?.uid?.slice(0, 10)}...</span>
              </div>
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "4px", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
            <Button
              type="button"
              variant="outline"
              onClick={handleCloseEditProfileModal}
              disabled={isSubmittingProfile}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingProfile}
              style={{
                backgroundColor: "var(--accent-500, #f97316)",
                fontWeight: "750"
              }}
            >
              {isSubmittingProfile ? "Saving Changes..." : "Save Changes"}
            </Button>
          </div>
        </form>
      </Modal>

      {/* ── Secure Change Password Modal ── */}
      <Modal
        isOpen={isPasswordModalOpen}
        onClose={handleClosePasswordModal}
        title="Change Password"
        maxWidth="440px"
      >
        <form onSubmit={handlePasswordSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
            Enter your current password to verify identity, then provide your new password.
          </p>

          {passwordError && (
            <div style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "10px 12px",
              display: "flex",
              alignItems: "flex-start",
              gap: "8px",
              fontSize: "12px",
              color: "#b91c1c"
            }}>
              <AlertCircle size={15} style={{ flexShrink: 0, marginTop: "2px" }} />
              <span>{passwordError}</span>
            </div>
          )}

          {/* Current Password Field */}
          <div className="login-form-group">
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
              Current Password <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showCurrentPassword ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="Enter current password"
                required
                autoComplete="current-password"
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "0 38px 0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }}
              />
              <button
                type="button"
                onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center"
                }}
                tabIndex={-1}
              >
                {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* New Password Field */}
          <div className="login-form-group">
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
              New Password <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showNewPassword ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="Enter new password (min. 6 characters)"
                required
                minLength={6}
                autoComplete="new-password"
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "0 38px 0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }}
              />
              <button
                type="button"
                onClick={() => setShowNewPassword(!showNewPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center"
                }}
                tabIndex={-1}
              >
                {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "3px" }}>
              Must be at least 6 characters.
            </span>
          </div>

          {/* Confirm New Password Field */}
          <div className="login-form-group">
            <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
              Confirm New Password <span style={{ color: "#ef4444" }}>*</span>
            </label>
            <div style={{ position: "relative" }}>
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password"
                required
                minLength={6}
                autoComplete="new-password"
                style={{
                  width: "100%",
                  height: "40px",
                  padding: "0 38px 0 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  fontSize: "13px",
                  boxSizing: "border-box"
                }}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                style={{
                  position: "absolute",
                  right: "10px",
                  top: "50%",
                  transform: "translateY(-50%)",
                  background: "none",
                  border: "none",
                  color: "#64748b",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center"
                }}
                tabIndex={-1}
              >
                {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
              </button>
            </div>
          </div>

          {/* Modal Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "14px" }}>
            <Button
              type="button"
              variant="outline"
              onClick={handleClosePasswordModal}
              disabled={isSubmittingPassword}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={isSubmittingPassword}
              style={{
                backgroundColor: "var(--accent-500, #f97316)",
                fontWeight: "750"
              }}
            >
              {isSubmittingPassword ? "Updating..." : "Update Password"}
            </Button>
          </div>
        </form>
      </Modal>
    </Layout>
  );
}

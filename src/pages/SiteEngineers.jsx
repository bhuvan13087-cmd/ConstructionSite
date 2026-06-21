import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
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
  Trash2
} from "lucide-react";


export default function SiteEngineers() {
  const [engineers, setEngineers] = useState([]);
  const [sites, setSites] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

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

  // Security / Password Management Modal States
  const [showSecurityModal, setShowSecurityModal] = useState(false);
  const [securityEngineer, setSecurityEngineer] = useState(null);
  const [otpSent, setOtpSent] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpVerified, setOtpVerified] = useState(false);
  const [otpError, setOtpError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showPlaintextPassword, setShowPlaintextPassword] = useState(false);
  const [securityLoading, setSecurityLoading] = useState(false);


  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const fetchedSites = await getSites();
      setSites(fetchedSites);

      const fetchedEngineers = await getSiteEngineers();
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
    if (window.confirm("Delete user permanently?")) {
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
      }
    }
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

  // Open Security Modal
  const handleOpenSecurityModal = (eng) => {
    setSecurityEngineer(eng);
    setOtpSent(false);
    setGeneratedOtp("");
    setEnteredOtp("");
    setOtpVerified(false);
    setOtpError("");
    setNewPassword("");
    setShowPlaintextPassword(false);
    setShowSecurityModal(true);
  };

  // Send Simulated OTP to Engineer
  const handleSendOtp = () => {
    if (!securityEngineer || !securityEngineer.phoneNumber) {
      showToast("Engineer must have a valid phone number registered.", "error");
      return;
    }
    setSecurityLoading(true);
    setOtpError("");

    setTimeout(() => {
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(code);
      setOtpSent(true);
      setSecurityLoading(false);
      
      // Beautiful alert notification in toast of the simulated code
      showToast(`[SMS GATEWAY] OTP code ${code} sent to ${securityEngineer.phoneNumber}`, "info");
    }, 800);
  };

  // Verify entered OTP
  const handleVerifyOtp = (e) => {
    e.preventDefault();
    if (enteredOtp.trim() === generatedOtp && generatedOtp !== "") {
      setOtpVerified(true);
      setOtpError("");
      showToast("Identity verified successfully.", "success");
    } else {
      setOtpError("Incorrect verification code. Please try again.");
    }
  };

  // Direct password update
  const handleUpdatePassword = async (e) => {
    e.preventDefault();
    if (!newPassword || newPassword.length < 6) {
      showToast("Password must be at least 6 characters.", "error");
      return;
    }
    setSecurityLoading(true);
    try {
      // 1. Update in Firebase Auth (if password was stored, we log in and change it)
      if (securityEngineer.password) {
        await updateEngineerPasswordAuth(
          securityEngineer.email,
          securityEngineer.password,
          newPassword
        );
      } else {
        // Fallback or warning if password not stored
        console.warn("Direct Auth update skipped: profile lacks recorded current password. Setting in DB only.");
      }

      // 2. Update in Firestore users profile
      await updateEngineerPasswordInDb(securityEngineer.id, newPassword);

      // 3. Update local state list so we have the password updated immediately
      setEngineers(prev => prev.map(eng => 
        eng.id === securityEngineer.id ? { ...eng, password: newPassword } : eng
      ));

      // 4. Update the selected security engineer object
      setSecurityEngineer(prev => ({ ...prev, password: newPassword }));

      showToast("Password updated successfully.", "success");
      setNewPassword("");
    } catch (err) {
      console.error("Password update error:", err);
      showToast(`Failed to update authentication credentials: ${err.message}`, "error");
    } finally {
      setSecurityLoading(false);
    }
  };

  // Trigger password reset email via standard Firebase method
  const handleSendResetEmail = async () => {
    setSecurityLoading(true);
    try {
      await sendEngineerPasswordReset(securityEngineer.email);
      showToast("Password reset email sent to engineer.", "success");
    } catch (err) {
      console.error("Reset email error:", err);
      showToast(`Failed to send email: ${err.message}`, "error");
    } finally {
      setSecurityLoading(false);
    }
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
          formPassword
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

      {/* Main Table */}
      <Card variant="table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Email</th>
              <th>Phone Number</th>
              <th>Status</th>
              <th>Assigned Sites</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredEngineers.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No site engineers found. Click "Add Engineer" to register one.
                </td>
              </tr>
            ) : (
              filteredEngineers.map((eng) => {
                const sitesCount = eng.assignedSites ? eng.assignedSites.length : 0;

                return (
                  <tr key={eng.id}>
                    <td style={{ fontWeight: 700 }}>{eng.fullName}</td>
                    <td className="font-mono">{eng.email}</td>
                    <td>{eng.phoneNumber || "--"}</td>
                    <td>
                      <Badge status={eng.status || "inactive"} />
                    </td>
                    <td>
                      <Badge status="pending">{sitesCount} Sites</Badge>
                    </td>
                    <td>
                      <div className="table-actions">
                        <button onClick={() => handleOpenDetails(eng)} className="btn-icon btn-view-action" title="View Details">
                          <Eye size={16} />
                        </button>
                        <button onClick={() => handleOpenEditModal(eng)} className="btn-icon btn-edit-action" title="Edit Profile">
                          <Edit3 size={16} />
                        </button>
                        <button onClick={() => handleOpenSecurityModal(eng)} className="btn-icon btn-security-action" title="Verify & Manage Password">
                          <LockKeyhole size={16} />
                        </button>
                        <button onClick={() => handleDeleteEngineer(eng)} className="btn-icon btn-delete-action" title="Delete Engineer" style={{ color: "var(--danger-500)" }}>
                          <Trash2 size={16} />
                        </button>
                        <label className="switch-control" title={eng.status === 'active' ? 'Deactivate' : 'Activate'}>
                          <input 
                            type="checkbox" 
                            className="toggle-status-action" 
                            checked={eng.status === 'active'}
                            onChange={() => handleToggleStatus(eng.id, eng.status)}
                          />
                          <span className="switch-slider"></span>
                        </label>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Card>

      {/* MODAL: ADD/EDIT SITE ENGINEER */}
      <Modal 
        isOpen={showFormModal} 
        onClose={() => setShowFormModal(false)} 
        title={formMode === "add" ? "Add Site Engineer" : "Edit Site Engineer"}
      >
        <form onSubmit={handleFormSubmit} style={{ margin: 0, padding: 0 }}>
          <div className="form-group">
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
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="engineer-email">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={16} />
              <input 
                type="email" 
                id="engineer-email" 
                placeholder="john.doe@example.com" 
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                disabled={formMode === "edit"}
                required 
              />
            </div>
          </div>

          {formMode === "add" && (
            <div className="form-group">
              <label htmlFor="engineer-password">Password</label>
              <div className="input-wrapper">
                <Lock className="input-icon" size={16} />
                <input 
                  type="password" 
                  id="engineer-password" 
                  placeholder="••••••••" 
                  value={formPassword}
                  onChange={(e) => setFormPassword(e.target.value)}
                  required 
                />
              </div>
              <p className="field-hint">Enter a security password (min 6 characters).</p>
            </div>
          )}

          <div className="form-group">
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
              />
            </div>
          </div>

          <div className="form-group">
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
            <p className="field-hint">Specify the number of paid/allowed leaves per year.</p>
          </div>

          <div className="form-group">
            <label>Assign Construction Sites</label>
            <div className="checkbox-grid">
              {sites.map(site => (
                <label key={site.id} className="checkbox-label">
                  <input 
                    type="checkbox" 
                    value={site.id} 
                    checked={formSelectedSites.includes(site.id)}
                    onChange={() => handleCheckboxChange(site.id)}
                  />
                  <span> {site.siteName}</span>
                </label>
              ))}
            </div>
            <p className="field-hint">Assign one or multiple sites to this engineer.</p>
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
          </div>
        )}
      </Modal>

      {/* MODAL: SECURITY VERIFICATION & CREDENTIAL MANAGEMENT */}
      <Modal
        isOpen={showSecurityModal}
        onClose={() => setShowSecurityModal(false)}
        title="Security Verification & Credentials"
        maxWidth="460px"
      >
        {securityEngineer && (
          <div>
            {!otpVerified ? (
              <div className="otp-verification-wrapper">
                <div className="otp-icon-wrapper">
                  <ShieldCheck size={28} />
                </div>
                <h4 className="otp-title">Identity Verification</h4>
                <p className="otp-subtitle">
                  To access security settings for <strong>{securityEngineer.fullName}</strong>, we must verify the request by sending an OTP to their registered number:
                  <strong style={{ display: "block", marginTop: "8px", fontSize: "14px", color: "var(--primary-900)" }}>
                    {securityEngineer.phoneNumber || "No phone number registered"}
                  </strong>
                </p>

                {otpSent && (
                  <div className="simulated-sms-banner">
                    <Mail className="sms-icon" size={18} />
                    <div className="sms-content">
                      <span><strong>[Simulated SMS Gateway]</strong> Code dispatched:</span>
                      <strong className="sms-code">{generatedOtp}</strong>
                    </div>
                  </div>
                )}

                {otpError && (
                  <div className="info-alert" style={{ borderLeft: "4px solid var(--danger-500)", backgroundColor: "var(--danger-50)", padding: "12px", borderRadius: "var(--radius-sm)", marginBottom: "20px", width: "100%", textAlign: "left" }}>
                    <span style={{ color: "var(--danger-600)", fontSize: "12px" }}>{otpError}</span>
                  </div>
                )}

                {!otpSent ? (
                  <Button 
                    onClick={handleSendOtp} 
                    isLoading={securityLoading}
                    icon={KeyRound}
                    style={{ width: "100%" }}
                  >
                    Send Verification Code
                  </Button>
                ) : (
                  <form onSubmit={handleVerifyOtp} style={{ width: "100%" }}>
                    <div className="form-group" style={{ alignItems: "center" }}>
                      <label htmlFor="entered-otp">Enter 6-Digit OTP</label>
                      <input
                        type="text"
                        id="entered-otp"
                        className="otp-input-field font-mono"
                        placeholder="000000"
                        maxLength={6}
                        value={enteredOtp}
                        onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ""))}
                        required
                        autoFocus
                      />
                    </div>
                    <Button 
                      type="submit" 
                      style={{ width: "100%", marginBottom: "12px" }}
                      isLoading={securityLoading}
                    >
                      Verify & Unlock
                    </Button>
                    <button 
                      type="button" 
                      className="btn-text"
                      onClick={handleSendOtp}
                      style={{ display: "block", width: "100%", textAlign: "center" }}
                    >
                      Resend Code
                    </button>
                  </form>
                )}
              </div>
            ) : (
              <div className="security-panel-unlocked">
                <div className="security-badge-success">
                  <ShieldCheck size={20} style={{ color: "var(--success-500)" }} />
                  <span>Administrator Verified Successfully</span>
                </div>

                <div className="form-group" style={{ marginBottom: "24px" }}>
                  <label>Current Account Password</label>
                  {securityEngineer.password ? (
                    <div className="password-display-box">
                      <span className="password-text">
                        {showPlaintextPassword ? securityEngineer.password : "••••••••"}
                      </span>
                      <button 
                        type="button" 
                        className="password-btn-toggle" 
                        onClick={() => setShowPlaintextPassword(!showPlaintextPassword)}
                        title={showPlaintextPassword ? "Hide password" : "Show password"}
                      >
                        {showPlaintextPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                      </button>
                    </div>
                  ) : (
                    <div className="password-display-box empty">
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic" }}>
                        Password not tracked in database.
                      </span>
                    </div>
                  )}
                  <p className="field-hint">Plaintext passwords are only visible for profiles created with tracking enabled.</p>
                </div>

                <form onSubmit={handleUpdatePassword} style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px", marginTop: "20px" }}>
                  <div className="form-group">
                    <label htmlFor="new-engineer-password">Change Password</label>
                    <div className="input-wrapper">
                      <Lock className="input-icon" size={16} />
                      <input
                        type="password"
                        id="new-engineer-password"
                        placeholder="Enter new password (min 6 chars)"
                        value={newPassword}
                        onChange={(e) => setNewPassword(e.target.value)}
                        required
                      />
                    </div>
                  </div>
                  <Button 
                    type="submit" 
                    icon={Save}
                    isLoading={securityLoading}
                    style={{ width: "100%", marginTop: "8px" }}
                  >
                    Update Password
                  </Button>
                </form>

                <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "20px", marginTop: "20px", textAlign: "center" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginBottom: "12px" }}>
                    Alternatively, send standard recovery link to engineer's inbox:
                  </span>
                  <Button 
                    variant="outline" 
                    onClick={handleSendResetEmail}
                    isLoading={securityLoading}
                    style={{ width: "100%" }}
                  >
                    Send Password Reset Email
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>

      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

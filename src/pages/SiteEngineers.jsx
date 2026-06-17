import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { 
  getSiteEngineers, 
  updateEngineerStatus, 
  saveSiteEngineerProfile,
  getSites
} from "../services/firebaseService";
import { registerEngineerAuth } from "../firebase/auth";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import { 
  Plus, 
  Search, 
  Eye, 
  Edit3, 
  Save, 
  User, 
  Mail, 
  Lock, 
  Phone 
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
  const [formSelectedSites, setFormSelectedSites] = useState([]);
  const [formOldSites, setFormOldSites] = useState([]); // to clear assignments on edit

  // Selected Engineer for Details Modal
  const [selectedEngineer, setSelectedEngineer] = useState(null);

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

  // Open Details Modal
  const handleOpenDetails = (eng) => {
    setSelectedEngineer(eng);
    setShowDetailsModal(true);
  };

  // Open Form Modal - Add Mode
  const handleOpenAddModal = () => {
    setFormMode("add");
    setFormId("");
    setFormName("");
    setFormEmail("");
    setFormPassword("");
    setFormPhone("");
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
          false
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
          formOldSites
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

            <div className="detail-sites-section">
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

      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

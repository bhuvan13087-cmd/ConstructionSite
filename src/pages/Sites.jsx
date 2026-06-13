import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { 
  getSites, 
  getSiteEngineers, 
  createSite, 
  updateSite, 
  deleteSite 
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Save, 
  X, 
  MapPin, 
  Users, 
  Building2 
} from "lucide-react";

export default function Sites() {
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // Modal States
  const [showFormModal, setShowFormModal] = useState(false);
  
  // Form Fields State
  const [formMode, setFormMode] = useState("add"); // "add" or "edit"
  const [formId, setFormId] = useState("");
  const [formName, setFormName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStatus, setFormStatus] = useState("active");
  const [formSelectedEngineers, setFormSelectedEngineers] = useState([]);
  const [formOldEngineers, setFormOldEngineers] = useState([]); // to clear associations on edit

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
      console.error("Error loading sites page data:", err);
      showToast(`Failed to load sites: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSites = sites.filter(site => 
    site.siteName?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    site.location?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleOpenAddModal = () => {
    setFormMode("add");
    setFormId("");
    setFormName("");
    setFormLocation("");
    setFormStatus("active");
    setFormSelectedEngineers([]);
    setFormOldEngineers([]);
    setShowFormModal(true);
  };

  const handleOpenEditModal = (site) => {
    setFormMode("edit");
    setFormId(site.id);
    setFormName(site.siteName || "");
    setFormLocation(site.location || "");
    setFormStatus(site.status || "active");
    const assigned = site.assignedEngineers || [];
    setFormSelectedEngineers(assigned);
    setFormOldEngineers(assigned);
    setShowFormModal(true);
  };

  const handleCheckboxChange = (engId) => {
    setFormSelectedEngineers(prev => 
      prev.includes(engId)
        ? prev.filter(id => id !== engId)
        : [...prev, engId]
    );
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (formMode === "add") {
        await createSite(
          formName.trim(), 
          formLocation.trim(), 
          formStatus, 
          formSelectedEngineers
        );
        showToast("Construction Site added successfully.", "success");
      } else {
        await updateSite(
          formId,
          formName.trim(),
          formLocation.trim(),
          formStatus,
          formSelectedEngineers,
          formOldEngineers
        );
        showToast("Construction Site updated successfully.", "success");
      }

      setShowFormModal(false);
      await loadData();
    } catch (err) {
      console.error("Form action failed:", err);
      showToast(err.message || "Failed to save site.", "error");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteSite = async (site) => {
    if (confirm(`Are you sure you want to delete the site "${site.siteName}"? This will clear all engineer assignments.`)) {
      setLoading(true);
      try {
        await deleteSite(site.id, site.assignedEngineers || []);
        showToast("Site deleted successfully.", "success");
        await loadData();
      } catch (err) {
        console.error("Deletion failed:", err);
        showToast(`Failed to delete site: ${err.message}`, "error");
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Layout title="Construction Sites" description="Manage active civil construction projects and allocate field engineers.">
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
              placeholder="Search sites by name or location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <button onClick={handleOpenAddModal} className="btn btn-primary btn-add">
          <Plus size={16} />
          <span>Add Site</span>
        </button>
      </div>

      {/* Main Table */}
      <div className="table-card">
        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th>Site ID</th>
                <th>Site Name</th>
                <th>Location</th>
                <th>Status</th>
                <th>Assigned Engineers</th>
                <th className="text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSites.length === 0 ? (
                <tr>
                  <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "30px" }}>
                    No construction sites found. Click "Add Site" to register one.
                  </td>
                </tr>
              ) : (
                filteredSites.map((site) => {
                  const statusClass = site.status === "active" ? "badge-success" : "badge-danger";
                  const statusText = site.status === "active" ? "Active" : "Inactive";
                  const assignedCount = site.assignedEngineers ? site.assignedEngineers.length : 0;

                  return (
                    <tr key={site.id}>
                      <td className="font-mono" style={{ fontWeight: 700 }}>{site.id}</td>
                      <td>{site.siteName}</td>
                      <td>
                        <span className="badge badge-pending">
                          <MapPin size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                          {site.location}
                        </span>
                      </td>
                      <td>
                        <span className={`badge ${statusClass}`}>{statusText}</span>
                      </td>
                      <td>
                        {assignedCount === 0 ? (
                          <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>Unassigned</span>
                        ) : (
                          <span className="badge badge-success">
                            <Users size={12} style={{ marginRight: "4px", verticalAlign: "middle" }} />
                            {assignedCount} Engineers
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions">
                          <button onClick={() => handleOpenEditModal(site)} className="btn-icon btn-edit-action" title="Edit Site">
                            <Edit3 size={16} />
                          </button>
                          <button onClick={() => handleDeleteSite(site)} className="btn-icon" title="Delete Site" style={{ color: "var(--danger-500)" }}>
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
        </div>
      </div>

      {/* MODAL: ADD/EDIT SITE */}
      {showFormModal && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card">
            <div className="modal-header">
              <h3>{formMode === "add" ? "Add Construction Site" : "Edit Construction Site"}</h3>
              <button onClick={() => setShowFormModal(false)} type="button" className="btn-close-modal">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleFormSubmit} className="modal-form">
              <div className="form-group">
                <label htmlFor="site-name">Site Name</label>
                <div className="input-wrapper">
                  <Building2 className="input-icon" size={16} />
                  <input 
                    type="text" 
                    id="site-name" 
                    placeholder="E.g., Greenwood Apartments" 
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="site-location">Location</label>
                <div className="input-wrapper">
                  <MapPin className="input-icon" size={16} />
                  <input 
                    type="text" 
                    id="site-location" 
                    placeholder="E.g., Sector 45" 
                    value={formLocation}
                    onChange={(e) => setFormLocation(e.target.value)}
                    required 
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="site-status">Status</label>
                <div className="input-wrapper">
                  <select 
                    id="site-status" 
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: "var(--radius-md)",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "var(--primary-50)",
                      outline: "none",
                      fontWeight: 500,
                      cursor: "pointer"
                    }}
                  >
                    <option value="active">Active Project</option>
                    <option value="inactive">Inactive Project</option>
                  </select>
                </div>
              </div>

              <div className="form-group">
                <label>Allocate Site Engineers</label>
                <div className="checkbox-grid">
                  {engineers.length === 0 ? (
                    <span style={{ color: "var(--text-muted)", fontSize: "13px", gridColumn: "1/-1" }}>
                      No active engineers available.
                    </span>
                  ) : (
                    engineers.map(eng => (
                      <label key={eng.id} className="checkbox-label">
                        <input 
                          type="checkbox" 
                          value={eng.id} 
                          checked={formSelectedEngineers.includes(eng.id)}
                          onChange={() => handleCheckboxChange(eng.id)}
                        />
                        <span> {eng.fullName}</span>
                      </label>
                    ))
                  )}
                </div>
                <p className="field-hint">Assign one or multiple engineers to manage this site.</p>
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowFormModal(false)} type="button" className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary">
                  <Save size={16} />
                  <span>Save Site</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

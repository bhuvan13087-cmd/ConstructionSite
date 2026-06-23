import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/layout/Layout";
import { 
  getSites, 
  createSite, 
  updateSite, 
  deleteSite,
  getSiteEngineers
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import { 
  Plus, 
  Search, 
  Edit3, 
  Trash2, 
  Save, 
  MapPin, 
  Building2,
  Calendar
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
  const [formClientName, setFormClientName] = useState("");
  const [formLocation, setFormLocation] = useState("");
  const [formStartDate, setFormStartDate] = useState("");
  const [formExpectedEndDate, setFormExpectedEndDate] = useState("");
  const [formStatus, setFormStatus] = useState("Planning");


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
      if (err.code === "permission-denied") {
        showToast("Access Denied: You do not have permission to view sites.", "error");
      } else if (err.code === "unavailable" || err.message?.includes("offline") || !navigator.onLine) {
        showToast("Database Offline: Please check your network connection.", "error");
      } else {
        showToast(`Failed to load sites: ${err.message}`, "error");
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const filteredSites = sites.filter(site => 
    site.siteName?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    site.clientName?.toLowerCase().includes(searchQuery.toLowerCase().trim()) ||
    site.location?.toLowerCase().includes(searchQuery.toLowerCase().trim())
  );

  const handleOpenAddModal = () => {
    setFormMode("add");
    setFormId("");
    setFormName("");
    setFormClientName("");
    setFormLocation("");
    setFormStartDate("");
    setFormExpectedEndDate("");
    setFormStatus("Planning");
    setShowFormModal(true);
  };

  const handleOpenEditModal = (site) => {
    setFormMode("edit");
    setFormId(site.id);
    setFormName(site.siteName || "");
    setFormClientName(site.clientName || "");
    setFormLocation(site.location || "");
    setFormStartDate(site.startDate || "");
    setFormExpectedEndDate(site.expectedEndDate || "");
    setFormStatus(site.status || "Planning");
    setShowFormModal(true);
  };

  const handleFormSubmit = async (e) => {
    e.preventDefault();

    // Validation checks
    if (!formName.trim()) {
      showToast("Site Name is required.", "error");
      return;
    }
    if (!formClientName.trim()) {
      showToast("Client Name is required.", "error");
      return;
    }
    if (!formLocation.trim()) {
      showToast("Site Address is required.", "error");
      return;
    }

    if (!formStartDate) {
      showToast("Start Date is required.", "error");
      return;
    }
    if (!formExpectedEndDate) {
      showToast("Expected End Date is required.", "error");
      return;
    }
    if (new Date(formExpectedEndDate) < new Date(formStartDate)) {
      showToast("Expected End Date cannot be before Start Date.", "error");
      return;
    }

    let rad = 100;
    if (formMode === "edit") {
      const existingSite = sites.find(s => s.id === formId);
      rad = existingSite ? Number(existingSite.radius || 100) : 100;
    }

    setLoading(true);
    try {
      if (formMode === "add") {
        const newSiteId = await createSite(
          formName.trim(), 
          formClientName.trim(), 
          formLocation.trim(), 
          formStartDate, 
          formExpectedEndDate, 
          formStatus,
          null,
          null,
          100
        );
        showToast("Construction Site added successfully.", "success");
        setShowFormModal(false);
        await loadData();
      } else {
        await updateSite(
          formId,
          formName.trim(),
          formClientName.trim(),
          formLocation.trim(),
          formStartDate,
          formExpectedEndDate,
          formStatus,
          rad
        );
        showToast("Construction Site updated successfully.", "success");
        setShowFormModal(false);
        await loadData();
      }
    } catch (err) {
      console.error("Form action failed:", err);
      if (err.code === "permission-denied") {
        showToast("Access Denied: You do not have permission to modify sites.", "error");
      } else if (err.code === "unavailable" || err.message?.includes("offline") || !navigator.onLine) {
        showToast("Database Offline: Please check your network connection.", "error");
      } else {
        showToast(err.message || "Failed to save site.", "error");
      }
    } finally {
      setLoading(false);
    }
  };



  const handleDeleteSite = async (site) => {
    if (confirm(`Are you sure you want to delete the site "${site.siteName}"?`)) {
      setLoading(true);
      try {
        await deleteSite(site.id);
        showToast("Site deleted successfully.", "success");
        await loadData();
      } catch (err) {
        console.error("Deletion failed:", err);
        if (err.code === "permission-denied") {
          showToast("Access Denied: You do not have permission to delete sites.", "error");
        } else if (err.code === "unavailable" || err.message?.includes("offline") || !navigator.onLine) {
          showToast("Database Offline: Please check your network connection.", "error");
        } else {
          showToast(`Failed to delete site: ${err.message}`, "error");
        }
      } finally {
        setLoading(false);
      }
    }
  };

  return (
    <Layout title="Construction Sites" description="Manage active civil construction projects and track details.">
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
              placeholder="Search sites by name, client, or location..." 
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
        </div>
        <Button onClick={handleOpenAddModal} icon={Plus} className="btn-add">
          Add Site
        </Button>
      </div>

      {/* Main Table */}
      <Card variant="table">
        <table className="data-table">
          <thead>
            <tr>
              <th>Site Name</th>
              <th>Client Name</th>
              <th>Location</th>
              <th>Start Date</th>
              <th>Expected End Date</th>
              <th>Status</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredSites.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                  No construction sites found. Click "Add Site" to register one.
                </td>
              </tr>
            ) : (
              filteredSites.map((site) => {
                return (
                  <tr key={site.id}>
                    <td style={{ fontWeight: 700 }}>{site.siteName}</td>
                    <td>{site.clientName || "--"}</td>
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <MapPin size={14} style={{ color: "var(--text-muted)" }} />
                        <span>{site.location}</span>
                      </div>
                    </td>
                    <td className="font-mono">{site.startDate || "--"}</td>
                    <td className="font-mono">{site.expectedEndDate || "--"}</td>
                    <td>
                      <Badge status={site.status || "Planning"} />
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
      </Card>

      {/* MODAL: ADD/EDIT SITE */}
      <Modal 
        isOpen={showFormModal} 
        onClose={() => setShowFormModal(false)} 
        title={formMode === "add" ? "Add Construction Site" : "Edit Construction Site"}
      >
        <form onSubmit={handleFormSubmit} style={{ margin: 0, padding: 0 }}>
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
            <label htmlFor="client-name">Client Name</label>
            <div className="input-wrapper">
              <Building2 className="input-icon" size={16} style={{ opacity: 0.6 }} />
              <input 
                type="text" 
                id="client-name" 
                placeholder="E.g., Greenwood Developers" 
                value={formClientName}
                onChange={(e) => setFormClientName(e.target.value)}
                required 
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="site-location">Site Address</label>
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



          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
            <div className="form-group">
              <label htmlFor="start-date">Start Date</label>
              <div className="input-wrapper">
                <Calendar className="input-icon" size={16} />
                <input 
                  type="date" 
                  id="start-date" 
                  value={formStartDate}
                  onChange={(e) => setFormStartDate(e.target.value)}
                  required 
                />
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="expected-end-date">Expected End Date</label>
              <div className="input-wrapper">
                <Calendar className="input-icon" size={16} />
                <input 
                  type="date" 
                  id="expected-end-date" 
                  value={formExpectedEndDate}
                  onChange={(e) => setFormExpectedEndDate(e.target.value)}
                  required 
                />
              </div>
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
                  padding: "12px 14px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  outline: "none",
                  fontWeight: 500,
                  cursor: "pointer"
                }}
              >
                <option value="Planning">Planning</option>
                <option value="Active">Active</option>
                <option value="Completed">Completed</option>
              </select>
            </div>
          </div>

          <div className="modal-actions" style={{ margin: "24px -24px -24px -24px" }}>
            <Button variant="outline" onClick={() => setShowFormModal(false)}>Cancel</Button>
            <Button type="submit" icon={Save}>
              Save Site
            </Button>
          </div>
        </form>
      </Modal>

      {/* MODAL: VIEW SITE LOCATION MAP */}


      <Loading show={loading} text="Processing Request..." />
    </Layout>
  );
}

import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  getSites, 
  getTodayUpdates, 
  saveDailyUpdate 
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import { 
  MapPin, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Mail, 
  User, 
  Shield, 
  Camera, 
  Upload, 
  Save, 
  X,
  Activity
} from "lucide-react";

export default function EngineerDashboard() {
  const { userProfile } = useAuth();
  
  // Dashboard states
  const [assignedSitesData, setAssignedSitesData] = useState([]);
  const [todayUpdatesData, setTodayUpdatesData] = useState([]);
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Daily Update Form modal states
  const [showFormModal, setShowFormModal] = useState(false);
  const [selectedSite, setSelectedSite] = useState(null);
  
  // Form input fields
  const [workDone, setWorkDone] = useState("");
  const [materialsReceived, setMaterialsReceived] = useState("");
  const [laborCount, setLaborCount] = useState("");
  const [issues, setIssues] = useState("");
  const [photoFile, setPhotoFile] = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Load dashboard data
  const loadDashboardData = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      // 1. Get all sites in the system
      const allSites = await getSites();
      
      // 2. Filter sites assigned to the current engineer
      const engineerAssignedSiteIds = userProfile.assignedSites || [];
      const filteredSites = allSites.filter(site => engineerAssignedSiteIds.includes(site.id));
      setAssignedSitesData(filteredSites);
      
      // 3. Load today's submitted progress updates for these sites
      if (filteredSites.length > 0) {
        const todayUpdates = await getTodayUpdates(filteredSites.map(s => s.id));
        setTodayUpdatesData(todayUpdates);
      } else {
        setTodayUpdatesData([]);
      }
    } catch (err) {
      console.error("Error loading Site Engineer Dashboard data:", err);
      showToast(`Failed to load data: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [userProfile]);

  // Calculations for metric cards
  const totalAssignedSites = assignedSitesData.length;
  
  // Completed updates = updates submitted for assigned sites today
  const completedUpdates = assignedSitesData.filter(site => 
    todayUpdatesData.some(update => update.siteId === site.id)
  ).length;
  
  const pendingUpdates = totalAssignedSites - completedUpdates;

  // Handle Photo selection & mockup preview
  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      setPhotoFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result); // Base64 data url for visual preview
      };
      reader.readAsDataURL(file);
    }
  };

  // Open progress update logger form
  const handleOpenForm = (site) => {
    setSelectedSite(site);
    
    // Check if there is an existing update for this site today to pre-populate
    const existingUpdate = todayUpdatesData.find(u => u.siteId === site.id);
    if (existingUpdate) {
      setWorkDone(existingUpdate.workDone || "");
      setMaterialsReceived(existingUpdate.materialsReceived || "");
      setLaborCount(existingUpdate.laborCount || "");
      setIssues(existingUpdate.issues || "");
      setPhotoFile(null);
      setPhotoPreview(existingUpdate.photoUrl || null);
    } else {
      setWorkDone("");
      setMaterialsReceived("");
      setLaborCount("");
      setIssues("");
      setPhotoFile(null);
      setPhotoPreview(null);
    }
    setShowFormModal(true);
  };

  // Handle Daily Progress Submit
  const handleSubmitProgress = async (e) => {
    e.preventDefault();
    if (!selectedSite || !userProfile) return;

    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      
      // Readying update structure for Firebase (including photo upload placeholder)
      const updatePayload = {
        siteId: selectedSite.id,
        siteName: selectedSite.siteName,
        date: todayStr,
        engineerId: userProfile.uid || userProfile.id || "",
        engineerName: userProfile.fullName || "Site Engineer",
        workDone: workDone.trim(),
        materialsReceived: materialsReceived.trim(),
        laborCount: laborCount || "0",
        issues: issues.trim(),
        // Photo upload placeholder: If a file is selected, store a placeholder string.
        // In a full implementation, this would be a Firebase Storage URL (e.g. storageRef.getDownloadURL())
        photoUrl: photoPreview ? photoPreview : "placeholder_no_photo.png",
        photoFileName: photoFile ? photoFile.name : (photoPreview ? "existing_photo" : "")
      };

      await saveDailyUpdate(updatePayload);
      showToast("Daily update logged successfully!", "success");
      setShowFormModal(false);
      await loadDashboardData();
    } catch (err) {
      console.error("Error submitting progress log:", err);
      showToast(`Submission failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Layout title="Engineer Dashboard" description="Control panel for logging daily construction progress and updating site status.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Profile summary header */}
      <div className="detail-card" style={{ marginBottom: "8px", borderLeft: "5px solid var(--accent-500)" }}>
        <div className="card-body" style={{ padding: "24px" }}>
          <div style={{ display: "flex", flexWrap: "wrap", gap: "24px", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div className="user-avatar" style={{ width: "56px", height: "56px", fontSize: "20px", borderRadius: "14px" }}>
                {userProfile?.fullName
                  ? userProfile.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()
                  : "SE"}
              </div>
              <div>
                <h3 style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-900)", display: "flex", alignItems: "center", gap: "8px" }}>
                  {userProfile?.fullName || "Site Engineer"}
                  <span className="badge badge-success" style={{ textTransform: "uppercase", fontSize: "10px" }}>
                    {userProfile?.status || "Active"}
                  </span>
                </h3>
                <p style={{ color: "var(--text-muted)", fontSize: "13px", display: "flex", alignItems: "center", gap: "4px" }}>
                  <Shield size={14} /> Registered Field Representative
                </p>
              </div>
            </div>
            
            <div style={{ display: "flex", gap: "20px", flexWrap: "wrap" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                <Mail size={16} style={{ color: "var(--text-muted)" }} />
                <span>{userProfile?.email}</span>
              </div>
              {userProfile?.phoneNumber && (
                <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "13px" }}>
                  <Phone size={16} style={{ color: "var(--text-muted)" }} />
                  <span>{userProfile.phoneNumber}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Metrics Cards */}
      <div className="metrics-grid">
        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Total Assigned Sites</span>
            <div className="metric-icon-wrapper info">
              <MapPin size={20} />
            </div>
          </div>
          <div className="metric-value" id="metric-assigned-sites">{totalAssignedSites}</div>
          <p className="metric-subtext">Sites assigned to your supervisor account</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Pending Updates</span>
            <div className="metric-icon-wrapper warning">
              <AlertCircle size={20} />
            </div>
          </div>
          <div className="metric-value" id="metric-pending-updates" style={{ color: pendingUpdates > 0 ? "var(--warning-500)" : "inherit" }}>
            {pendingUpdates}
          </div>
          <p className="metric-subtext">Assigned sites requiring logs today</p>
        </div>

        <div className="metric-card">
          <div className="metric-header">
            <span className="metric-title">Completed Updates</span>
            <div className="metric-icon-wrapper success">
              <CheckCircle2 size={20} />
            </div>
          </div>
          <div className="metric-value" id="metric-completed-updates" style={{ color: completedUpdates > 0 ? "var(--success-500)" : "inherit" }}>
            {completedUpdates}
          </div>
          <p className="metric-subtext">Updates submitted for today</p>
        </div>
      </div>

      {/* Assigned Sites Grid / Logs */}
      <div className="detail-card">
        <div className="card-header-accent">
          <h3 style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={18} style={{ color: "var(--accent-500)" }} /> Your Assigned Construction Sites & Status
          </h3>
          <span className="badge badge-pending" style={{ fontSize: "11px" }}>Today's Logs</span>
        </div>
        <div className="card-body" style={{ padding: "0" }}>
          {assignedSitesData.length === 0 ? (
            <div style={{ textAlign: "center", padding: "48px 24px", color: "var(--text-muted)" }}>
              <MapPin size={48} style={{ margin: "0 auto 16px", strokeWidth: 1.5, opacity: 0.6 }} />
              <p style={{ fontWeight: 600, fontSize: "16px", marginBottom: "4px" }}>No assigned sites</p>
              <p style={{ fontSize: "13px" }}>Please contact the system administrator to assign construction projects to your profile.</p>
            </div>
          ) : (
            <table className="status-table" style={{ margin: "0" }}>
              <thead>
                <tr>
                  <th>Site Name</th>
                  <th>Location</th>
                  <th>Site Status</th>
                  <th>Today's Update</th>
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {assignedSitesData.map(site => {
                  const todayUpdate = todayUpdatesData.find(u => u.siteId === site.id);
                  const isSubmitted = !!todayUpdate;
                  
                  return (
                    <tr key={site.id}>
                      <td style={{ fontWeight: 700 }}>{site.siteName}</td>
                      <td>{site.location}</td>
                      <td>
                        <span className={`badge ${site.status === "active" ? "badge-success" : "badge-danger"}`}>
                          {site.status === "active" ? "Active Site" : "Suspended"}
                        </span>
                      </td>
                      <td>
                        {isSubmitted ? (
                          <span className="badge badge-success" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <CheckCircle2 size={12} /> Logged
                          </span>
                        ) : (
                          <span className="badge badge-pending" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                            <AlertCircle size={12} /> Pending Log
                          </span>
                        )}
                      </td>
                      <td>
                        <div className="table-actions" style={{ justifyContent: "flex-end" }}>
                          <button 
                            onClick={() => handleOpenForm(site)}
                            className={`btn ${isSubmitted ? 'btn-outline' : 'btn-primary'}`}
                            style={{ width: "auto", padding: "8px 16px", fontSize: "12px", textTransform: "uppercase" }}
                            type="button"
                          >
                            <FileText size={14} />
                            <span>{isSubmitted ? "Edit Today's Log" : "Log Progress"}</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* MODAL: DAILY PROGRESS UPDATE FORM */}
      {showFormModal && selectedSite && (
        <div className="modal-overlay" style={{ display: "flex" }}>
          <div className="modal-card" style={{ maxWidth: "560px" }}>
            <div className="modal-header">
              <div>
                <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Log Daily Progress</h3>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Project: <strong>{selectedSite.siteName}</strong> ({selectedSite.location})
                </p>
              </div>
              <button onClick={() => setShowFormModal(false)} type="button" className="btn-close-modal">
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSubmitProgress} className="modal-form">
              <div className="form-group">
                <label htmlFor="work-done">Description of Work Completed</label>
                <textarea 
                  id="work-done" 
                  placeholder="Summarize structural work completed, inspections, concrete pours, painting, etc..."
                  value={workDone}
                  onChange={(e) => setWorkDone(e.target.value)}
                  required 
                />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                <div className="form-group">
                  <label htmlFor="labor-count">Labor Force Size</label>
                  <div className="input-wrapper">
                    <User className="input-icon" size={16} />
                    <input 
                      type="number" 
                      id="labor-count" 
                      placeholder="e.g. 15" 
                      min="0"
                      value={laborCount}
                      onChange={(e) => setLaborCount(e.target.value)}
                      required 
                    />
                  </div>
                </div>
                
                <div className="form-group">
                  <label htmlFor="materials-received">Materials Received</label>
                  <div className="input-wrapper">
                    <FileText className="input-icon" size={16} />
                    <input 
                      type="text" 
                      id="materials-received" 
                      placeholder="e.g. 50 bags cement, steel rods" 
                      value={materialsReceived}
                      onChange={(e) => setMaterialsReceived(e.target.value)}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="issues">Issues / Bottlenecks (Optional)</label>
                <div className="input-wrapper">
                  <AlertCircle className="input-icon" size={16} />
                  <input 
                    type="text" 
                    id="issues" 
                    placeholder="e.g. Heavy rain delay, machinery malfunction" 
                    value={issues}
                    onChange={(e) => setIssues(e.target.value)}
                  />
                </div>
              </div>

              {/* Photo upload component with mock payload */}
              <div className="form-group">
                <label>Site Progress Photo (Placeholder Upload)</label>
                <div style={{ display: "flex", gap: "16px", alignItems: "center", marginTop: "4px" }}>
                  <label 
                    style={{ 
                      flexShrink: 0,
                      cursor: "pointer", 
                      padding: "12px 16px", 
                      borderRadius: "var(--radius-sm)", 
                      border: "2px dashed var(--border-color)", 
                      display: "flex", 
                      alignItems: "center", 
                      gap: "8px", 
                      backgroundColor: "var(--primary-50)",
                      fontSize: "12px",
                      fontWeight: 700,
                      textTransform: "uppercase"
                    }}
                  >
                    <Camera size={16} />
                    <span>Select Site Image</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      style={{ display: "none" }} 
                      onChange={handlePhotoChange}
                    />
                  </label>
                  
                  <div style={{ flexGrow: 1, minWidth: 0 }}>
                    {photoFile ? (
                      <p style={{ fontSize: "12px", color: "var(--primary-800)", fontWeight: 600, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                        Selected: {photoFile.name} ({(photoFile.size / 1024).toFixed(1)} KB)
                      </p>
                    ) : photoPreview ? (
                      <p style={{ fontSize: "12px", color: "var(--success-600)", fontWeight: 600 }}>
                        ✓ Existing image placeholder loaded
                      </p>
                    ) : (
                      <p style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        No photo chosen. Upload placeholders help verify camera metadata integration.
                      </p>
                    )}
                  </div>
                </div>

                {photoPreview && (
                  <div style={{ marginTop: "12px", position: "relative", width: "100%", maxHeight: "140px", overflow: "hidden", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
                    <img 
                      src={photoPreview} 
                      alt="Site progress preview" 
                      style={{ width: "100%", height: "100%", objectFit: "cover" }}
                    />
                    <button 
                      type="button" 
                      onClick={() => { setPhotoFile(null); setPhotoPreview(null); }}
                      style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                    >
                      <X size={14} />
                    </button>
                  </div>
                )}
              </div>

              <div className="modal-actions">
                <button onClick={() => setShowFormModal(false)} type="button" className="btn btn-outline">Cancel</button>
                <button type="submit" className="btn btn-primary" id="btn-submit-progress">
                  <Save size={16} />
                  <span>Submit Update</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <Loading show={loading} text="Processing Dashboard Action..." />
    </Layout>
  );
}

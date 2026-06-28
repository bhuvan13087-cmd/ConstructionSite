import React, { useState, useEffect, useMemo, useRef } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getAssignedSitesForEngineer,
  getDocumentCategories,
  saveDocumentCategories,
  uploadDocument,
  getAllDocuments,
  verifyDocument,
  deleteDocument
} from "../services/firebaseService";
import {
  FolderOpen,
  FileText,
  Camera,
  Check,
  X,
  Plus,
  Search,
  Filter,
  Trash2,
  Download,
  Eye,
  Settings,
  AlertCircle,
  Calendar,
  User,
  MapPin,
  Clock,
  CheckCircle,
  FileCode,
  Paperclip,
  ChevronRight,
  Info,
  Upload
} from "lucide-react";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import Loading from "../components/common/Loading";

export default function DocumentsDashboard() {
  const { userProfile } = useAuth();
  const userId = userProfile?.uid || userProfile?.id || "";
  const userName = userProfile?.fullName || "Site User";
  const userRole = userProfile?.role || "site_engineer";
  
  // Checks
  const isSuperAdmin = userRole === "super_admin" || userRole === "superadmin";
  const isAdmin = userRole === "admin";
  const isEngineer = userRole === "site_engineer" || userRole === "engineer";
  const canVerify = isAdmin || isSuperAdmin;

  // Master Data
  const [sites, setSites] = useState([]);
  const [categories, setCategories] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState({ show: false, message: "", type: "success" });

  // Filters State
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSite, setFilterSite] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [filterUploader, setFilterUploader] = useState("");

  // Modals Open State
  const [isUploadOpen, setIsUploadOpen] = useState(false);
  const [isCategoriesOpen, setIsCategoriesOpen] = useState(false);
  const [selectedDoc, setSelectedDoc] = useState(null); // Lightbox/Detail view

  // Form States - New Document Upload
  const [uploadSiteId, setUploadSiteId] = useState("");
  const [uploadCategory, setUploadCategory] = useState("");
  const [uploadTitle, setUploadTitle] = useState("");
  const [uploadDesc, setUploadDesc] = useState("");
  const [uploadFile, setUploadFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form States - Categories Editor
  const [editedCategories, setEditedCategories] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");
  const [isSavingCategories, setIsSavingCategories] = useState(false);

  // Form States - Verification Comments
  const [verificationComments, setVerificationComments] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);

  // Trigger toast alert
  const showToast = (message, type = "success") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast({ show: false, message: "", type: "success" });
    }, 4000);
  };

  // Initial Data Load
  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        // Load categories
        const cats = await getDocumentCategories();
        setCategories(cats);
        setEditedCategories(cats);

        // Load sites based on role
        let sitesList = [];
        if (isEngineer) {
          sitesList = await getAssignedSitesForEngineer(userId);
        } else {
          sitesList = await getSites();
        }
        setSites(sitesList);

        // Auto select site if engineer has only one
        if (sitesList.length === 1) {
          setUploadSiteId(sitesList[0].id);
        }

        // Load documents
        await refreshDocumentsList(sitesList);

      } catch (err) {
        console.error("Error loading documents page:", err);
        showToast("Failed to load document system data", "error");
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [userId, userRole]);

  // Helper to reload docs list
  const refreshDocumentsList = async (currentSites = sites) => {
    try {
      const allDocs = await getAllDocuments();
      if (isEngineer) {
        const assignedIds = currentSites.map(s => s.id);
        const filteredDocs = allDocs.filter(d => assignedIds.includes(d.siteId));
        setDocuments(filteredDocs);
      } else {
        setDocuments(allDocs);
      }
    } catch (err) {
      console.error("Error refreshing docs:", err);
    }
  };

  // Base64 file converter
  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Optional validation (e.g. size limits)
    if (file.size > 5 * 1024 * 1024) {
      showToast("File is too large. Maximum size allowed is 5MB.", "error");
      e.target.value = null;
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setUploadFile({
        name: file.name,
        size: file.size,
        type: file.type,
        url: reader.result // Data URL base64
      });
      // Pre-fill title if empty
      if (!uploadTitle) {
        const cleanName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
        setUploadTitle(cleanName);
      }
    };
    reader.readAsDataURL(file);
  };

  // Upload Form Submit
  const handleUploadSubmit = async (e) => {
    e.preventDefault();
    if (!uploadSiteId) return showToast("Please select a construction site", "error");
    if (!uploadCategory) return showToast("Please select a category", "error");
    if (!uploadTitle.trim()) return showToast("Please enter a document title", "error");
    if (!uploadFile) return showToast("Please choose a file to upload", "error");

    const selectedSite = sites.find(s => s.id === uploadSiteId);
    if (!selectedSite) return showToast("Invalid site selection", "error");

    try {
      setIsUploading(true);
      await uploadDocument({
        siteId: uploadSiteId,
        siteName: selectedSite.siteName,
        category: uploadCategory,
        title: uploadTitle.trim(),
        description: uploadDesc.trim(),
        fileUrl: uploadFile.url,
        fileName: uploadFile.name,
        fileSize: uploadFile.size,
        uploadedBy: userName,
        uploadedById: userId,
        userRole: userRole
      });

      showToast("Document uploaded successfully and awaiting verification!");
      setIsUploadOpen(false);
      
      // Reset form
      setUploadTitle("");
      setUploadDesc("");
      setUploadFile(null);
      if (sites.length !== 1) setUploadSiteId("");
      setUploadCategory("");

      await refreshDocumentsList();
    } catch (err) {
      console.error("Error uploading document:", err);
      showToast("Failed to upload document", "error");
    } finally {
      setIsUploading(false);
    }
  };

  // Verification process (Accept / Reject)
  const handleVerifyStatus = async (status) => {
    if (!selectedDoc) return;
    try {
      setIsVerifying(true);
      await verifyDocument(
        selectedDoc.id,
        status,
        userId,
        userName,
        verificationComments.trim()
      );
      showToast(`Document successfully marked as ${status}`);
      setVerificationComments("");
      setSelectedDoc(null);
      await refreshDocumentsList();
    } catch (err) {
      console.error("Error verifying document:", err);
      showToast("Failed to complete verification request", "error");
    } finally {
      setIsVerifying(false);
    }
  };

  // Delete Document process
  const handleDeleteDoc = async (docId) => {
    if (!window.confirm("Are you sure you want to permanently delete this document and all its records? This cannot be undone.")) return;
    try {
      setLoading(true);
      await deleteDocument(docId, userId, userName);
      showToast("Document deleted successfully");
      setSelectedDoc(null);
      await refreshDocumentsList();
    } catch (err) {
      console.error("Error deleting document:", err);
      showToast("Failed to delete document", "error");
    } finally {
      setLoading(false);
    }
  };

  // Manage Categories Operations
  const handleAddCategory = () => {
    const cleanName = newCategoryName.trim();
    if (!cleanName) return;
    if (editedCategories.some(c => c.toLowerCase() === cleanName.toLowerCase())) {
      return showToast("Category already exists", "error");
    }
    setEditedCategories([...editedCategories, cleanName]);
    setNewCategoryName("");
  };

  const handleRemoveCategory = (catName) => {
    setEditedCategories(editedCategories.filter(c => c !== catName));
  };

  const handleSaveCategories = async () => {
    if (editedCategories.length === 0) {
      return showToast("You must maintain at least one category", "error");
    }
    try {
      setIsSavingCategories(true);
      await saveDocumentCategories(editedCategories);
      setCategories(editedCategories);
      showToast("Document categories updated successfully");
      setIsCategoriesOpen(false);
    } catch (err) {
      console.error("Error saving categories:", err);
      showToast("Failed to save categories", "error");
    } finally {
      setIsSavingCategories(false);
    }
  };

  // Filter & Search Documents list
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchSearch =
        doc.title?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.fileName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.category?.toLowerCase().includes(searchQuery.toLowerCase());

      const matchSite = filterSite ? doc.siteId === filterSite : true;
      const matchCategory = filterCategory ? doc.category === filterCategory : true;
      const matchStatus = filterStatus ? doc.status === filterStatus : true;
      const matchUploader = filterUploader
        ? doc.uploadedBy?.toLowerCase().includes(filterUploader.toLowerCase())
        : true;

      return matchSearch && matchSite && matchCategory && matchStatus && matchUploader;
    });
  }, [documents, searchQuery, filterSite, filterCategory, filterStatus, filterUploader]);

  // Statistics calculation for the header widgets
  const stats = useMemo(() => {
    const total = filteredDocuments.length;
    const pending = filteredDocuments.filter(d => d.status === "Uploaded" || d.status === "pending" || !d.status).length;
    const verified = filteredDocuments.filter(d => d.status === "Verified").length;
    const rejected = filteredDocuments.filter(d => d.status === "Rejected").length;
    return { total, pending, verified, rejected };
  }, [filteredDocuments]);

  // Helper to check if user has permission to delete this specific doc
  const canDeleteDoc = (doc) => {
    if (isSuperAdmin) return true;
    if (isAdmin) return true;
    return doc.uploadedById === userId;
  };

  // Formatting helpers
  const formatBytes = (bytes) => {
    if (!bytes) return "0 Bytes";
    const k = 1024;
    const sizes = ["Bytes", "KB", "MB"];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i];
  };

  const isImageFile = (doc) => {
    if (doc.fileUrl?.startsWith("data:image/")) return true;
    const name = doc.fileName?.toLowerCase() || "";
    return name.endsWith(".jpg") || name.endsWith(".jpeg") || name.endsWith(".png") || name.endsWith(".webp") || name.endsWith(".gif");
  };

  // Helper to render inline previews
  const renderDocPreview = (doc) => {
    if (isImageFile(doc)) {
      return (
        <div className="doc-preview-img-container">
          <img src={doc.fileUrl} alt={doc.title} className="doc-card-img" />
          <div className="doc-preview-overlay">
            <Eye size={20} className="overlay-icon" />
          </div>
        </div>
      );
    }
    
    // File Icon Picker based on name
    const fName = doc.fileName?.toLowerCase() || "";
    let fileColor = "#f1f5f9";
    let iconColor = "#64748b";
    let typeName = "DOC";
    
    if (fName.endsWith(".pdf")) {
      fileColor = "#fee2e2";
      iconColor = "#ef4444";
      typeName = "PDF";
    } else if (fName.endsWith(".xlsx") || fName.endsWith(".xls") || fName.endsWith(".csv")) {
      fileColor = "#dcfce7";
      iconColor = "#22c55e";
      typeName = "EXCEL";
    } else if (fName.endsWith(".doc") || fName.endsWith(".docx")) {
      fileColor = "#dbeafe";
      iconColor = "#3b82f6";
      typeName = "WORD";
    }

    return (
      <div className="doc-preview-file-container" style={{ backgroundColor: fileColor }}>
        <FileText size={48} style={{ color: iconColor }} />
        <span className="file-type-badge" style={{ backgroundColor: iconColor }}>{typeName}</span>
        <span className="file-name-label">{doc.fileName}</span>
      </div>
    );
  };

  return (
    <Layout>
      <div className="dashboard-container">
        {/* Toast Alert */}
        {toast.show && (
          <div className={`toast-notification ${toast.type}`}>
            <Info size={16} />
            <span>{toast.message}</span>
          </div>
        )}

        {/* Page Title & Navigation Banner */}
        <div className="dashboard-header-banner">
          <div>
            <div className="breadcrumb">
              <span className="breadcrumb-parent">Records Console</span>
              <ChevronRight size={12} />
              <span className="breadcrumb-current">Documents</span>
            </div>
            <h1 className="dashboard-title">
              <FolderOpen size={28} className="title-icon-decor" />
              Project Documents & Records
            </h1>
            <p className="dashboard-subtitle">
              Centralized repository for estimates, material bills, agreements, site photos, and payments proofs.
            </p>
          </div>
          <div className="dashboard-header-actions">
            {canVerify && (
              <Button
                variant="outline"
                icon={Settings}
                onClick={() => {
                  setEditedCategories([...categories]);
                  setIsCategoriesOpen(true);
                }}
                className="btn-categories-settings"
              >
                Categories
              </Button>
            )}
            <Button
              variant="primary"
              icon={Plus}
              onClick={() => setIsUploadOpen(true)}
              className="btn-upload-trigger"
            >
              Upload Document
            </Button>
          </div>
        </div>

        {/* Stats Counter Widgets Grid */}
        <div className="metrics-grid" style={{ gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", marginBottom: "24px" }}>
          <Card className="metric-card">
            <div className="metric-icon-wrapper" style={{ backgroundColor: "var(--accent-50)", color: "var(--accent-600)" }}>
              <FolderOpen size={20} />
            </div>
            <div className="metric-value">{stats.total}</div>
            <div className="metric-label">Total Documents</div>
          </Card>
          <Card className="metric-card">
            <div className="metric-icon-wrapper" style={{ backgroundColor: "var(--warning-100)", color: "var(--warning-600)" }}>
              <Clock size={20} />
            </div>
            <div className="metric-value">{stats.pending}</div>
            <div className="metric-label">Pending Verification</div>
          </Card>
          <Card className="metric-card">
            <div className="metric-icon-wrapper" style={{ backgroundColor: "var(--success-100)", color: "var(--success-600)" }}>
              <CheckCircle size={20} />
            </div>
            <div className="metric-value">{stats.verified}</div>
            <div className="metric-label">Verified Uploads</div>
          </Card>
          <Card className="metric-card">
            <div className="metric-icon-wrapper" style={{ backgroundColor: "var(--danger-100)", color: "var(--danger-600)" }}>
              <X size={20} />
            </div>
            <div className="metric-value">{stats.rejected}</div>
            <div className="metric-label">Rejected Records</div>
          </Card>
        </div>

        {/* Filter and Search Bar Controls */}
        <Card variant="default" className="filters-card" style={{ marginBottom: "24px", padding: "16px" }}>
          <div className="filters-toolbar-grid">
            <div className="filter-input-group search-group">
              <Search size={16} className="filter-icon" />
              <input
                type="text"
                placeholder="Search documents by title, file name, desc..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-field-input"
              />
            </div>
            <div className="filter-input-group">
              <MapPin size={16} className="filter-icon" />
              <select value={filterSite} onChange={(e) => setFilterSite(e.target.value)}>
                <option value="">All Sites</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.siteName}</option>
                ))}
              </select>
            </div>
            <div className="filter-input-group">
              <FolderOpen size={16} className="filter-icon" />
              <select value={filterCategory} onChange={(e) => setFilterCategory(e.target.value)}>
                <option value="">All Categories</option>
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
            <div className="filter-input-group">
              <AlertCircle size={16} className="filter-icon" />
              <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
                <option value="">All Statuses</option>
                <option value="Uploaded">Pending Verification</option>
                <option value="Verified">Verified</option>
                <option value="Rejected">Rejected</option>
              </select>
            </div>
            {canVerify && (
              <div className="filter-input-group">
                <User size={16} className="filter-icon" />
                <input
                  type="text"
                  placeholder="Uploader..."
                  value={filterUploader}
                  onChange={(e) => setFilterUploader(e.target.value)}
                  style={{ border: "none", outline: "none", width: "100%", fontSize: "13px" }}
                />
              </div>
            )}
            <button
              className="btn-clear-filters"
              onClick={() => {
                setSearchQuery("");
                setFilterSite("");
                setFilterCategory("");
                setFilterStatus("");
                setFilterUploader("");
              }}
              title="Reset all filters"
            >
              Reset Filters
            </button>
          </div>
        </Card>

        {/* Loading Spinner */}
        {loading ? (
          <Loading />
        ) : filteredDocuments.length === 0 ? (
          <div className="empty-state-card text-center" style={{ padding: "80px 20px" }}>
            <FileText size={56} style={{ color: "var(--text-muted)", opacity: 0.5, marginBottom: "16px" }} />
            <h3>No Documents Found</h3>
            <p style={{ color: "var(--text-muted)", maxWidth: "400px", margin: "8px auto" }}>
              We couldn't find any documents matching your active filters. Try resetting the filters or uploading a new file.
            </p>
          </div>
        ) : (
          /* Documents Grid */
          <div className="documents-cards-grid">
            {filteredDocuments.map(doc => (
              <div key={doc.id} className={`document-display-card status-${doc.status?.toLowerCase() || 'uploaded'}`} onClick={() => setSelectedDoc(doc)}>
                {/* Preview Banner */}
                {renderDocPreview(doc)}

                {/* Card Content info */}
                <div className="doc-card-body">
                  <div className="doc-tags-row">
                    <span className="doc-tag site-tag" title={doc.siteName}>
                      <MapPin size={10} />
                      {doc.siteName}
                    </span>
                    <span className="doc-tag category-tag">
                      {doc.category}
                    </span>
                  </div>
                  <h4 className="doc-card-title">{doc.title}</h4>
                  {doc.description && <p className="doc-card-desc">{doc.description}</p>}
                  
                  <div className="doc-card-meta">
                    <div className="meta-item" title={`Uploaded on ${doc.date}`}>
                      <Calendar size={12} />
                      <span>{doc.date}</span>
                    </div>
                    <div className="meta-item" title={`Size: ${formatBytes(doc.fileSize)}`}>
                      <Paperclip size={12} />
                      <span>{formatBytes(doc.fileSize)}</span>
                    </div>
                  </div>
                </div>

                {/* Card Footer status */}
                <div className="doc-card-footer">
                  <div className="uploader-info">
                    <div className="uploader-avatar">
                      {doc.uploadedBy?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <span className="uploader-name" title={`Uploaded by ${doc.uploadedBy}`}>{doc.uploadedBy}</span>
                  </div>
                  <Badge status={doc.status || "Uploaded"}>
                    {doc.status || "Uploaded"}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Modal: UPLOAD DOCUMENT */}
        <Modal
          isOpen={isUploadOpen}
          onClose={() => setIsUploadOpen(false)}
          title="Upload Project Document"
          maxWidth="550px"
        >
          <form onSubmit={handleUploadSubmit} className="login-form">
            <div className="form-group">
              <label>Construction Site <span style={{ color: 'var(--danger-500)' }}>*</span></label>
              <select
                value={uploadSiteId}
                onChange={(e) => setUploadSiteId(e.target.value)}
                required
                disabled={sites.length === 1}
              >
                <option value="">Select Construction Site</option>
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.siteName}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Document Category <span style={{ color: 'var(--danger-500)' }}>*</span></label>
              <select
                value={uploadCategory}
                onChange={(e) => setUploadCategory(e.target.value)}
                required
              >
                <option value="">Select Category</option>
                {categories.map((cat, idx) => (
                  <option key={idx} value={cat}>{cat}</option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label>Document Title <span style={{ color: 'var(--danger-500)' }}>*</span></label>
              <input
                type="text"
                placeholder="Enter title for the document"
                value={uploadTitle}
                onChange={(e) => setUploadTitle(e.target.value)}
                required
              />
            </div>

            <div className="form-group">
              <label>Description / Details</label>
              <textarea
                placeholder="Enter document reference details, billing notes, or comments..."
                value={uploadDesc}
                onChange={(e) => setUploadDesc(e.target.value)}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>Attachment File <span style={{ color: 'var(--danger-500)' }}>*</span> (Max 5MB)</label>
              <div className="file-uploader-dropzone">
                <input
                  type="file"
                  id="docFilePicker"
                  onChange={handleFileChange}
                  accept=".jpg,.jpeg,.png,.webp,.pdf,.doc,.docx,.xlsx,.xls,.csv"
                  className="hidden-file-input"
                  style={{ display: "none" }}
                  required
                />
                <label htmlFor="docFilePicker" className="file-upload-label">
                  <Upload size={32} style={{ color: "var(--accent-500)", marginBottom: "8px" }} />
                  {uploadFile ? (
                    <div style={{ textAlign: "center" }}>
                      <span className="file-uploaded-success-msg" style={{ fontWeight: 600, color: "var(--success-600)" }}>
                        {uploadFile.name}
                      </span>
                      <span className="file-size" style={{ display: "block", fontSize: "12px", color: "var(--text-muted)" }}>
                        {formatBytes(uploadFile.size)}
                      </span>
                    </div>
                  ) : (
                    <div>
                      <p style={{ fontWeight: 600, fontSize: "14px", color: "var(--primary-800)" }}>Choose file or snap photo</p>
                      <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                        Supports JPEG, PNG, WEBP, PDF, DOCX, XLSX
                      </p>
                    </div>
                  )}
                </label>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: "20px" }}>
              <Button variant="outline" onClick={() => setIsUploadOpen(false)} disabled={isUploading}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" isLoading={isUploading}>
                Upload Document
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal: MANAGE CATEGORIES (Admin & Super Admin only) */}
        <Modal
          isOpen={isCategoriesOpen}
          onClose={() => setIsCategoriesOpen(false)}
          title="Document Categories Management"
          maxWidth="500px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>
              Add, remove, and manage categories used for document categorization site-wide.
            </p>
            
            {/* Category Addition inputs */}
            <div style={{ display: "flex", gap: "8px" }}>
              <input
                type="text"
                placeholder="New Category (e.g. Audit)"
                value={newCategoryName}
                onChange={(e) => setNewCategoryName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddCategory()}
                style={{ flex: 1 }}
              />
              <Button variant="primary" icon={Plus} onClick={handleAddCategory}>
                Add
              </Button>
            </div>

            {/* List of active categories */}
            <div className="categories-list-container">
              {editedCategories.map((cat, idx) => (
                <div key={idx} className="category-item-row">
                  <span>{cat}</span>
                  <button
                    type="button"
                    className="btn-delete-category"
                    onClick={() => handleRemoveCategory(cat)}
                    title="Remove this category"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ))}
              {editedCategories.length === 0 && (
                <p style={{ color: "var(--danger-500)", fontSize: "12px", textAlign: "center" }}>
                  Please add at least one category to save.
                </p>
              )}
            </div>

            <div className="modal-actions">
              <Button variant="outline" onClick={() => setIsCategoriesOpen(false)} disabled={isSavingCategories}>
                Cancel
              </Button>
              <Button variant="success" onClick={handleSaveCategories} isLoading={isSavingCategories}>
                Save Categories List
              </Button>
            </div>
          </div>
        </Modal>

        {/* Modal: LIGHTBOX / DOCUMENT DETAIL PANEL */}
        {selectedDoc && (
          <Modal
            isOpen={!!selectedDoc}
            onClose={() => {
              setSelectedDoc(null);
              setVerificationComments("");
            }}
            title={selectedDoc.title}
            maxWidth="850px"
          >
            <div className="lightbox-split-container">
              {/* Left Column: Visual File Preview */}
              <div className="lightbox-preview-column">
                {isImageFile(selectedDoc) ? (
                  <div className="lightbox-img-wrapper">
                    <img src={selectedDoc.fileUrl} alt={selectedDoc.title} className="lightbox-full-img" />
                  </div>
                ) : (
                  <div className="lightbox-generic-file-preview">
                    <FileText size={96} style={{ color: "var(--accent-500)", marginBottom: "16px" }} />
                    <h4>{selectedDoc.fileName}</h4>
                    <p style={{ fontSize: "13px", color: "var(--text-muted)" }}>{formatBytes(selectedDoc.fileSize)}</p>
                    <a
                      href={selectedDoc.fileUrl}
                      download={selectedDoc.fileName}
                      className="btn btn-outline"
                      style={{ marginTop: "24px", display: "inline-flex", alignItems: "center", gap: "8px", textDecoration: "none", color: "inherit" }}
                    >
                      <Download size={16} />
                      Download File
                    </a>
                  </div>
                )}
              </div>

              {/* Right Column: Information & Audit Trail */}
              <div className="lightbox-details-column">
                <div className="detail-section">
                  <h4 className="detail-section-title">Document Information</h4>
                  <table className="info-table">
                    <tbody>
                      <tr>
                        <td>Site Name:</td>
                        <td><strong>{selectedDoc.siteName}</strong></td>
                      </tr>
                      <tr>
                        <td>Category:</td>
                        <td><Badge status="completed">{selectedDoc.category}</Badge></td>
                      </tr>
                      <tr>
                        <td>Uploader:</td>
                        <td>{selectedDoc.uploadedBy}</td>
                      </tr>
                      <tr>
                        <td>Upload Date:</td>
                        <td>{selectedDoc.date}</td>
                      </tr>
                      <tr>
                        <td>Status:</td>
                        <td><Badge status={selectedDoc.status || "Uploaded"}>{selectedDoc.status || "Uploaded"}</Badge></td>
                      </tr>
                    </tbody>
                  </table>
                  
                  {selectedDoc.description && (
                    <div style={{ marginTop: "12px" }}>
                      <label style={{ fontSize: "11px", fontWeight: 700, color: "var(--primary-700)", textTransform: "uppercase" }}>
                        Description
                      </label>
                      <p style={{ fontSize: "13px", color: "var(--primary-800)", marginTop: "4px", backgroundColor: "#f8fafc", padding: "10px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        {selectedDoc.description}
                      </p>
                    </div>
                  )}
                </div>

                {/* Audit Trail Verification Details */}
                {(selectedDoc.status === "Verified" || selectedDoc.status === "Rejected") && (
                  <div className="detail-section" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginTop: "16px" }}>
                    <h4 className="detail-section-title">Verification Details</h4>
                    <table className="info-table">
                      <tbody>
                        <tr>
                          <td>Action:</td>
                          <td>
                            <strong style={{ color: selectedDoc.status === "Verified" ? "var(--success-600)" : "var(--danger-600)" }}>
                              {selectedDoc.status}
                            </strong>
                          </td>
                        </tr>
                        <tr>
                          <td>Verified By:</td>
                          <td>{selectedDoc.verifiedBy || "Administrator"}</td>
                        </tr>
                        {selectedDoc.verifiedAt && (
                          <tr>
                            <td>Action Date:</td>
                            <td>{new Date(selectedDoc.verifiedAt.seconds * 1000).toLocaleString()}</td>
                          </tr>
                        )}
                        <tr>
                          <td>Comments:</td>
                          <td>{selectedDoc.comments || <em>No comments added.</em>}</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Verification Control Console (Admins only, only if pending) */}
                {canVerify && (selectedDoc.status === "Uploaded" || selectedDoc.status === "pending") && (
                  <div className="detail-section verification-panel" style={{ borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginTop: "16px" }}>
                    <h4 className="detail-section-title">Verification Workflow</h4>
                    <div className="form-group" style={{ marginBottom: "12px" }}>
                      <label>Verification Comments / Reason</label>
                      <textarea
                        placeholder="Add verification notes, receipt discrepancies, or approval confirmation..."
                        value={verificationComments}
                        onChange={(e) => setVerificationComments(e.target.value)}
                        rows={2}
                      />
                    </div>
                    <div style={{ display: "flex", gap: "10px" }}>
                      <Button
                        variant="danger"
                        icon={X}
                        onClick={() => handleVerifyStatus("Rejected")}
                        isLoading={isVerifying}
                        style={{ flex: 1 }}
                      >
                        Reject
                      </Button>
                      <Button
                        variant="success"
                        icon={Check}
                        onClick={() => handleVerifyStatus("Verified")}
                        isLoading={isVerifying}
                        style={{ flex: 1 }}
                      >
                        Verify
                      </Button>
                    </div>
                  </div>
                )}

                {/* Deletion Control */}
                {canDeleteDoc(selectedDoc) && (
                  <div style={{ marginTop: "auto", paddingTop: "24px", display: "flex", justifyContent: "flex-end" }}>
                    <Button
                      variant="danger"
                      icon={Trash2}
                      onClick={() => handleDeleteDoc(selectedDoc.id)}
                      size="sm"
                    >
                      Delete Document
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </Modal>
        )}
      </div>
    </Layout>
  );
}

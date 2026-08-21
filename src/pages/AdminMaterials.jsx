import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import ViewToggle from "../components/common/ViewToggle";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getMaterialsDetailed,
  updateMaterial,
  subscribeMaterialsDetailed,
  logMaterialUsage,
  logMaterialPayment,
  getMaterialTeams,
  saveMaterialTeams,
  subscribeMaterialTeams,
  createMaterialTeam,
  updateMaterialTeam,
  deleteMaterialTeam,
  addMaterialToTeam,
  updateMaterialInTeam,
  deleteMaterialFromTeam
} from "../services/firebaseService";
import {
  processMaterialPaymentAndDelivery,
  formatINR
} from "../services/businessLogic";
import {
  Package,
  Check,
  X,
  Plus,
  Edit2,
  DollarSign,
  FileText,
  TrendingUp,
  AlertCircle,
  Truck,
  Database,
  History,
  Calendar,
  Layers,
  MapPin,
  Clock,
  Printer,
  Trash2,
  Users,
  Search,
  ChevronDown,
  ChevronUp,
  Eye,
  ShieldAlert
} from "lucide-react";

export default function AdminMaterials() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("master"); // master, requests, inventory, payments
  const [viewMode, setViewMode] = useState("grid");
  const [loading, setLoading] = useState(true);
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("all");
  const [allMaterials, setAllMaterials] = useState([]);
  const [materialTeams, setMaterialTeams] = useState([]);
  const [teamSearch, setTeamSearch] = useState("");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Custom Confirmation Modal state for UI safety confirmations (Deactivate / Delete)
  const [confirmModalState, setConfirmModalState] = useState({
    isOpen: false,
    title: "",
    message: "",
    details: null,
    confirmText: "Confirm",
    cancelText: "Cancel",
    variant: "danger", // "danger", "warning"
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

  // View Team Details Popup Modal state
  const [showViewTeamModal, setShowViewTeamModal] = useState(false);
  const [viewingTeamId, setViewingTeamId] = useState(null);

  // Dynamic live viewing team synced with materialTeams state
  const activeViewingTeam = viewingTeamId
    ? (materialTeams.find(t => t.id === viewingTeamId) || null)
    : null;

  const handleOpenViewTeamModal = (team) => {
    setViewingTeamId(team.id);
    setShowViewTeamModal(true);
  };

  // Team Modals state
  const [showAddTeamModal, setShowAddTeamModal] = useState(false);
  const [newTeamName, setNewTeamName] = useState("");
  const [newTeamMaterials, setNewTeamMaterials] = useState([
    { id: 1, name: "", rate: "", unit: "Bag" }
  ]);

  const [showRenameTeamModal, setShowRenameTeamModal] = useState(false);
  const [targetTeam, setTargetTeam] = useState(null);
  const [renamingTeamName, setRenamingTeamName] = useState("");

  // Material within Team Modals state
  const [showAddMaterialModal, setShowAddMaterialModal] = useState(false);
  const [targetTeamForMat, setTargetTeamForMat] = useState(null);
  const [newMaterialForm, setNewMaterialForm] = useState({ type: "standard", name: "", unit: "Bag", rate: "", amount: "" });

  const [showEditMaterialModal, setShowEditMaterialModal] = useState(false);
  const [targetTeamForEditMat, setTargetTeamForEditMat] = useState(null);
  const [editingMaterial, setEditingMaterial] = useState({ id: "", name: "", type: "standard", unit: "Bag", rate: "", amount: "", status: "Active" });

  // Requisition Approval Modal state
  const [showApprovalModal, setShowApprovalModal] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState(null);
  const [approvalQty, setApprovalQty] = useState("");
  const [approvalCost, setApprovalCost] = useState("");
  
  // Usage Modal state
  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedInventoryItem, setSelectedInventoryItem] = useState(null);
  const [usageQty, setUsageQty] = useState("");
  const [usageDate, setUsageDate] = useState(new Date().toISOString().split("T")[0]);
  const [usageNotes, setUsageNotes] = useState("");
  
  // Payment Modal state
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [selectedPaymentItem, setSelectedPaymentItem] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(new Date().toISOString().split("T")[0]);
  const [payRef, setPayRef] = useState("");
  const [payNotes, setPayNotes] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    let isMounted = true;
    let unsubTeams = null;
    let unsubMaterials = null;
    
    const initSubscriptions = async () => {
      try {
        setLoading(true);
        const adminId = userProfile?.uid || userProfile?.id || null;
        const fetchedSites = await getSites(adminId);
        if (!isMounted) return;
        setSites(fetchedSites);
        
        unsubTeams = subscribeMaterialTeams((teamsList) => {
          if (isMounted) setMaterialTeams(teamsList || []);
        });
        
        unsubMaterials = subscribeMaterialsDetailed(null, (mats) => {
          if (isMounted) setAllMaterials(mats);
        });
      } catch (err) {
        console.error("Failed to load materials data:", err);
        if (isMounted) showToast(`Error syncing logs: ${err.message}`, "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    initSubscriptions();

    return () => {
      isMounted = false;
      if (unsubTeams) unsubTeams();
      if (unsubMaterials) unsubMaterials();
    };
  }, [userProfile]);

  const handleOpenAddTeamModal = () => {
    setNewTeamName("");
    setNewTeamMaterials([
      { id: 1, type: "standard", name: "", rate: "", amount: "", unit: "Bag" }
    ]);
    setShowAddTeamModal(true);
  };

  const handleAddMaterialRowInCreate = () => {
    setNewTeamMaterials(prev => [
      ...prev,
      { id: Date.now() + Math.random(), type: "standard", name: "", rate: "", amount: "", unit: "Bag" }
    ]);
  };

  const handleRemoveMaterialRowInCreate = (rowId) => {
    setNewTeamMaterials(prev => {
      const filtered = prev.filter(r => r.id !== rowId);
      return filtered.length === 0 ? [{ id: Date.now(), type: "standard", name: "", rate: "", amount: "", unit: "Bag" }] : filtered;
    });
  };

  const handleMaterialRowChangeInCreate = (rowId, field, value) => {
    setNewTeamMaterials(prev =>
      prev.map(r => r.id === rowId ? { ...r, [field]: value } : r)
    );
  };

  const handleAddTeam = async (e) => {
    e.preventDefault();
    const teamNameClean = newTeamName.trim();
    if (!teamNameClean) {
      showToast("Please enter a Material Team name.", "error");
      return;
    }

    const validMaterials = newTeamMaterials
      .filter(m => m.name && m.name.trim().length > 0)
      .map(m => {
        const isCustom = m.type === "custom";
        const amt = Number(isCustom ? m.amount : m.rate) || 0;
        return {
          id: m.id,
          name: m.name.trim(),
          type: isCustom ? "custom" : "standard",
          unit: isCustom ? "" : (m.unit || "Bag"),
          rate: amt,
          amount: amt,
          unitPrice: amt,
          status: "Active"
        };
      });

    if (validMaterials.length === 0) {
      showToast("Please add at least one material to the team.", "error");
      return;
    }

    try {
      await createMaterialTeam(teamNameClean, validMaterials);
      setNewTeamName("");
      setNewTeamMaterials([{ id: 1, type: "standard", name: "", rate: "", amount: "", unit: "Bag" }]);
      setShowAddTeamModal(false);
      showToast(`Material Team "${teamNameClean}" created successfully with ${validMaterials.length} materials!`, "success");
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleRenameTeam = async (e) => {
    e.preventDefault();
    if (!renamingTeamName.trim() || !targetTeam) return;
    try {
      await updateMaterialTeam(targetTeam.id, { name: renamingTeamName.trim() });
      setShowRenameTeamModal(false);
      setTargetTeam(null);
      setRenamingTeamName("");
      showToast("Material Team renamed successfully!", "success");
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleRequestDeleteTeam = (team) => {
    showConfirmModal({
      title: "Delete Material Team?",
      message: `Are you sure you want to permanently delete "${team.name}"?`,
      details: `This action will remove all ${(team.materials || []).length} configured materials under this team.`,
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteMaterialTeam(team.id);
          showToast(`Material Team "${team.name}" deleted successfully!`, "success");
          if (viewingTeamId === team.id) {
            setShowViewTeamModal(false);
            setViewingTeamId(null);
          }
        } catch (err) {
          showToast(`Failed: ${err.message}`, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  const handleAddMaterialToTeamSubmit = async (e) => {
    e.preventDefault();
    if (!targetTeamForMat || !newMaterialForm.name.trim()) return;
    try {
      const isCustom = newMaterialForm.type === "custom";
      const amt = Number(isCustom ? newMaterialForm.amount : newMaterialForm.rate) || 0;
      await addMaterialToTeam(targetTeamForMat.id, {
        name: newMaterialForm.name.trim(),
        type: isCustom ? "custom" : "standard",
        unit: isCustom ? "" : (newMaterialForm.unit || "Bag"),
        rate: amt,
        amount: amt,
        status: "Active"
      });
      setNewMaterialForm({ type: "standard", name: "", unit: "Bag", rate: "", amount: "" });
      setShowAddMaterialModal(false);
      setTargetTeamForMat(null);
      showToast(`Material added to team "${targetTeamForMat.name}" successfully!`, "success");
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleEditMaterialInTeamSubmit = async (e) => {
    e.preventDefault();
    if (!targetTeamForEditMat || !editingMaterial.name.trim()) return;
    try {
      const isCustom = editingMaterial.type === "custom";
      const amt = Number(isCustom ? editingMaterial.amount : editingMaterial.rate) || 0;
      await updateMaterialInTeam(targetTeamForEditMat.id, editingMaterial.id, {
        name: editingMaterial.name.trim(),
        type: isCustom ? "custom" : "standard",
        unit: isCustom ? "" : (editingMaterial.unit || "Bag"),
        rate: amt,
        amount: amt,
        status: editingMaterial.status
      });
      setShowEditMaterialModal(false);
      setTargetTeamForEditMat(null);
      setEditingMaterial({ id: "", name: "", type: "standard", unit: "Bag", rate: "", amount: "", status: "Active" });
      showToast("Material updated successfully!", "success");
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleRequestToggleMaterialStatus = (teamId, teamName, mat) => {
    if (mat.status === "Active") {
      showConfirmModal({
        title: "Deactivate Material?",
        message: `Are you sure you want to deactivate "${mat.name}" from "${teamName}"?`,
        details: "This material will no longer be available for new selections.",
        confirmText: "Deactivate",
        cancelText: "Cancel",
        variant: "warning",
        onConfirm: async () => {
          try {
            await updateMaterialInTeam(teamId, mat.id, { status: "Inactive" });
            showToast(`Material "${mat.name}" deactivated.`, "info");
          } catch (err) {
            showToast(`Failed: ${err.message}`, "error");
          } finally {
            closeConfirmModal();
          }
        }
      });
    } else {
      updateMaterialInTeam(teamId, mat.id, { status: "Active" })
        .then(() => showToast(`Material "${mat.name}" activated!`, "success"))
        .catch((err) => showToast(`Failed: ${err.message}`, "error"));
    }
  };

  const handleRequestDeleteMaterial = (teamId, teamName, mat) => {
    showConfirmModal({
      title: "Delete Material?",
      message: `Are you sure you want to permanently delete "${mat.name}" from "${teamName}"?`,
      details: "This material will be permanently removed from this team catalog.",
      confirmText: "Delete",
      cancelText: "Cancel",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteMaterialFromTeam(teamId, mat.id);
          showToast(`Material "${mat.name}" deleted successfully!`, "success");
        } catch (err) {
          showToast(`Failed: ${err.message}`, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  const handleOpenApproval = (req) => {
    setSelectedRequest(req);
    setApprovalQty(req.requiredQuantity || req.quantity || "0");
    
    // Calc fallback total cost
    let unitCost = 500;
    if (req.category === "Steel") unitCost = 5000;
    else if (req.category === "Sand") unitCost = 2500;
    else if (req.category === "Bricks") unitCost = 10;
    else if (req.category === "Cement") unitCost = 400;
    else if (req.category === "Other") unitCost = 1500;
    
    setApprovalCost((Number(req.requiredQuantity || req.quantity) * unitCost).toString());
    setShowApprovalModal(true);
  };

  const submitApproval = async (status) => {
    if (!selectedRequest) return;
    try {
      const updates = {
        status: status,
        approvedAt: new Date().toISOString(),
        approvedBy: "Admin"
      };
      
      if (status === "Approved") {
        updates.quantity = Number(approvalQty) || 0; // approved quantity mapped to field 'quantity'
        updates.totalAmount = Number(approvalCost) || 0;
      }
      
      await updateMaterial(selectedRequest.id, updates);
      showToast(`Material request ${status.toLowerCase()} successfully!`, "success");
      setShowApprovalModal(false);
      await loadData();
    } catch (err) {
      showToast(`Approval failed: ${err.message}`, "error");
    }
  };

  const handleOpenUsage = (item) => {
    setSelectedInventoryItem(item);
    setUsageQty("");
    setUsageNotes("");
    setShowUsageModal(true);
  };

  const submitUsage = async (e) => {
    e.preventDefault();
    if (!selectedInventoryItem || !usageQty) return;
    const qty = Number(usageQty);
    if (qty <= 0) return;
    if (qty > selectedInventoryItem.remainingStock) {
      showToast("Cannot consume more than available stock!", "error");
      return;
    }

    try {
      await logMaterialUsage(selectedInventoryItem.id, {
        quantity: qty,
        date: usageDate,
        notes: usageNotes
      });
      showToast("Material consumption logged successfully!", "success");
      setShowUsageModal(false);
      await loadData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleOpenPayment = (item) => {
    setSelectedPaymentItem(item);
    setPayAmount(item.pendingPayment.toString());
    setPayRef("");
    setPayNotes("");
    setShowPaymentModal(true);
  };

  const submitPayment = async (e) => {
    e.preventDefault();
    if (!selectedPaymentItem || !payAmount) return;
    const amt = Number(payAmount);
    if (amt <= 0) return;

    try {
      await logMaterialPayment(selectedPaymentItem.id, {
        amount: amt,
        date: payDate,
        reference: payRef,
        notes: payNotes
      });
      showToast("Supplier payment reference recorded!", "success");
      setShowPaymentModal(false);
      await loadData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  if (loading) {
    return (
      <Layout title="Materials ledger" description="Synchronizing master inventory records...">
        <Loading show={true} text="Initializing material ledger console..." />
      </Layout>
    );
  }

  // Process and filter material records
  const processedMaterials = allMaterials.map(processMaterialPaymentAndDelivery);
  
  const siteFiltered = processedMaterials.filter(m => {
    if (selectedSiteId === "all") return true;
    return m.siteId === selectedSiteId;
  });

  const pendingRequests = processedMaterials.filter(m => m.status === "pending" || m.status === "Pending" || !m.status);
  const inventoryList = siteFiltered.filter(m => m.status === "approved" || m.status === "Approved");
  const paymentsList = siteFiltered.filter(m => m.status === "approved" || m.status === "Approved");

  // Sum calculations
  const totalStockVal = inventoryList.reduce((acc, m) => acc + m.totalAmount, 0);
  const totalPaidVal = paymentsList.reduce((acc, m) => acc + m.paidAmount, 0);
  const totalPendingVal = paymentsList.reduce((acc, m) => acc + m.pendingPayment, 0);

  return (
    <Layout 
      title="Material Tracking & Corporate stock" 
      description="Monitor lookup registries, approve field requisitions, and audit supplier payments ledger."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Tabs list */}
      <div style={{ display: "flex", gap: "12px", borderBottom: "2px solid #e2e8f0", paddingBottom: "2px", marginBottom: "20px" }}>
        {[
          { id: "master", label: "Material Master lookup", icon: Database },
          { id: "inventory", label: "Inventory & Consumption", icon: Package },
          { id: "payments", label: "Supplier Payments ledger", icon: DollarSign }
        ].map(t => {
          const ActiveIcon = t.icon;
          const isActive = activeTab === t.id;
          return (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "10px 16px",
                border: "none",
                backgroundColor: "transparent",
                borderBottom: isActive ? "3px solid var(--primary-600)" : "3px solid transparent",
                color: isActive ? "var(--primary-750)" : "var(--text-muted)",
                fontWeight: isActive ? "800" : "600",
                cursor: "pointer",
                transition: "all 0.2s"
              }}
            >
              <ActiveIcon size={16} />
              <span>{t.label}</span>
            </button>
          );
        })}
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Global Filter Bar */}
        {activeTab !== "master" && activeTab !== "requests" && (
          <Card title="Site Filter" className="no-print">
            <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", alignItems: "flex-end" }}>
              <div className="form-group" style={{ margin: 0, minWidth: "250px" }}>
                <label htmlFor="site-select">Select Construction Site</label>
                <div className="input-wrapper" style={{ marginTop: "4px" }}>
                  <MapPin className="input-icon" size={16} />
                  <select
                    id="site-select"
                    value={selectedSiteId}
                    onChange={(e) => setSelectedSiteId(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 40px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-color)",
                      backgroundColor: "#ffffff",
                      fontWeight: 600,
                      outline: "none"
                    }}
                  >
                    <option value="all">All Corporate Sites</option>
                    {sites.map(site => (
                      <option key={site.id} value={site.id}>{site.siteName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button onClick={() => window.print()} variant="secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Printer size={16} />
                <span>Print Ledger</span>
              </Button>
            </div>
          </Card>
        )}

        {/* Tab content 1: Material Teams & Rates Configuration */}
        {activeTab === "master" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {/* Header / Summary Bar */}
            <div style={{
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "12px",
              padding: "20px 24px",
              boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "16px"
            }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>Material Teams</h2>
                  <span style={{ backgroundColor: "#fff7ed", color: "#ea580c", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "12px", border: "1px solid #ffedd5" }}>
                    {materialTeams.length} Registered Teams
                  </span>
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  Manage material teams, unit rates, and item catalogs. Click any team card to view or manage materials.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                <div style={{ position: "relative", minWidth: "200px" }}>
                  <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Search teams or materials..."
                    value={teamSearch}
                    onChange={(e) => setTeamSearch(e.target.value)}
                    style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px", outline: "none" }}
                  />
                </div>
                <ViewToggle viewMode={viewMode} onChange={setViewMode} />
                <Button
                  onClick={handleOpenAddTeamModal}
                  variant="primary"
                  style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px" }}
                >
                  <Plus size={16} />
                  <span>Create Team</span>
                </Button>
              </div>
            </div>

            {/* TEAM DISPLAY (GRID / NORMAL LIST) */}
            {materialTeams.length === 0 ? (
              <Card style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
                <Package size={36} style={{ color: "#94a3b8", marginBottom: "10px" }} />
                <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>No Material Teams Found</h4>
                <p style={{ margin: "0 0 16px 0", fontSize: "13px" }}>Click "+ Create Team" to setup trade material supply teams.</p>
                <Button onClick={handleOpenAddTeamModal} variant="primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                  <Plus size={16} />
                  <span>Create First Material Team</span>
                </Button>
              </Card>
            ) : viewMode === "grid" ? (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "18px" }}>
                {materialTeams
                  .filter(t => {
                    if (!teamSearch.trim()) return true;
                    const q = teamSearch.toLowerCase().trim();
                    const matchesTeam = (t.name || "").toLowerCase().includes(q);
                    const matchesMat = (t.materials || []).some(m => (m.name || "").toLowerCase().includes(q));
                    return matchesTeam || matchesMat;
                  })
                  .map(team => {
                    const mats = team.materials || [];

                    return (
                      <div
                        key={team.id}
                        style={{
                          background: "#ffffff",
                          border: "1px solid #e2e8f0",
                          borderRadius: "12px",
                          padding: "18px 20px",
                          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                          display: "flex",
                          flexDirection: "column",
                          justifyContent: "space-between",
                          gap: "14px",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div>
                          {/* Header: Team name & Status */}
                          <div 
                            style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px", cursor: "pointer" }}
                            onClick={() => handleOpenViewTeamModal(team)}
                          >
                            <div>
                              <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{team.name}</h3>
                              <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", marginTop: "2px", display: "block" }}>
                                Material Supply Team
                              </span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: "5px", color: "#16a34a", fontSize: "12px", fontWeight: "700" }}>
                              <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#16a34a" }}></span>
                              <span>Active</span>
                            </div>
                          </div>

                          {/* Stats summary badge outside (Labour Team presentation style) */}
                          <div 
                            style={{ 
                              display: "flex", 
                              alignItems: "center", 
                              gap: "10px",
                              padding: "12px 14px", 
                              backgroundColor: "#f8fafc", 
                              borderRadius: "8px", 
                              border: "1px solid #f1f5f9",
                              cursor: "pointer"
                            }}
                            onClick={() => handleOpenViewTeamModal(team)}
                          >
                            <div style={{ width: "32px", height: "32px", borderRadius: "8px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                              <Package size={18} />
                            </div>
                            <div>
                              <span style={{ fontSize: "10.5px", textTransform: "uppercase", fontWeight: "700", color: "#64748b", display: "block" }}>Total Materials</span>
                              <strong style={{ fontSize: "14px", color: "#0f172a" }}>
                                {mats.length} {mats.length === 1 ? "Material" : "Materials"}
                              </strong>
                            </div>
                          </div>
                        </div>

                        {/* Actions Bar */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "12px", borderTop: "1px solid #f1f5f9" }}>
                          <div style={{ display: "flex", gap: "6px" }}>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => handleOpenViewTeamModal(team)}
                              style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setEditingTeam(team);
                                setEditTeamName(team.name || "");
                                setShowEditTeamModal(true);
                              }}
                              style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                            >
                              <Edit2 size={13} />
                              <span>Edit</span>
                            </Button>
                          </div>

                          <button
                            type="button"
                            onClick={() => handleRequestDeleteTeam(team)}
                            style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "600" }}
                            title="Delete Team"
                          >
                            <Trash2 size={14} />
                            <span>Delete</span>
                          </button>
                        </div>

                      </div>
                    );
                  })}
              </div>
            ) : (
              <div style={{
                background: "#ffffff",
                border: "1px solid var(--border-color)",
                borderRadius: "14px",
                overflow: "hidden",
                boxShadow: "var(--shadow-sm)"
              }}>
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                    <thead>
                      <tr style={{ background: "var(--primary-50)", borderBottom: "1px solid var(--border-color)" }}>
                        <th style={{ width: "35%", paddingLeft: "20px" }}>Material Team</th>
                        <th style={{ width: "20%", textAlign: "center" }}>Status</th>
                        <th style={{ width: "25%", textAlign: "center" }}>Cataloged Materials</th>
                        <th style={{ width: "20%", textAlign: "right", paddingRight: "20px" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {materialTeams
                        .filter(t => {
                          if (!teamSearch.trim()) return true;
                          const q = teamSearch.toLowerCase().trim();
                          const matchesTeam = (t.name || "").toLowerCase().includes(q);
                          const matchesMat = (t.materials || []).some(m => (m.name || "").toLowerCase().includes(q));
                          return matchesTeam || matchesMat;
                        })
                        .map((team) => {
                          const mats = team.materials || [];
                          return (
                            <tr
                              key={team.id}
                              style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.12s ease" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                            >
                              <td style={{ paddingLeft: "20px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                                  <div style={{
                                    width: "34px",
                                    height: "34px",
                                    borderRadius: "8px",
                                    backgroundColor: "#fff7ed",
                                    border: "1px solid #ffedd5",
                                    color: "#c2410c",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    fontWeight: "800",
                                    fontSize: "12px",
                                    flexShrink: 0
                                  }}>
                                    <Package size={16} />
                                  </div>
                                  <div>
                                    <div 
                                      style={{ fontWeight: "700", fontSize: "13.5px", color: "#0f172a", cursor: "pointer" }}
                                      onClick={() => handleOpenViewTeamModal(team)}
                                    >
                                      {team.name}
                                    </div>
                                    <span style={{ fontSize: "11.5px", color: "#64748b" }}>Material Supply Team</span>
                                  </div>
                                </div>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "5px", color: "#16a34a", fontSize: "12px", fontWeight: "700" }}>
                                  <span style={{ display: "inline-block", width: "7px", height: "7px", borderRadius: "50%", backgroundColor: "#16a34a" }}></span>
                                  <span>Active</span>
                                </div>
                              </td>
                              <td style={{ textAlign: "center" }}>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "5px",
                                  padding: "3px 10px",
                                  borderRadius: "8px",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  backgroundColor: "#fff7ed",
                                  color: "#c2410c",
                                  border: "1px solid #ffedd5"
                                }}>
                                  {mats.length} {mats.length === 1 ? "Material" : "Materials"}
                                </span>
                              </td>
                              <td style={{ paddingRight: "20px", textAlign: "right" }}>
                                <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenViewTeamModal(team)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "#2563eb",
                                      cursor: "pointer",
                                      padding: "4px 6px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      transition: "transform 0.15s ease, color 0.15s ease",
                                      outline: "none"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.color = "#1d4ed8"; e.currentTarget.style.transform = "scale(1.08)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = "#2563eb"; e.currentTarget.style.transform = "scale(1)"; }}
                                    title="View Team"
                                  >
                                    <Eye size={14} />
                                    <span>View</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingTeam(team);
                                      setEditTeamName(team.name || "");
                                      setShowEditTeamModal(true);
                                    }}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "#ea580c",
                                      cursor: "pointer",
                                      padding: "4px 6px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      transition: "transform 0.15s ease, color 0.15s ease",
                                      outline: "none"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.color = "#c2410c"; e.currentTarget.style.transform = "scale(1.08)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = "#ea580c"; e.currentTarget.style.transform = "scale(1)"; }}
                                    title="Edit Team"
                                  >
                                    <Edit2 size={14} />
                                    <span>Edit</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleRequestDeleteTeam(team)}
                                    style={{
                                      background: "transparent",
                                      border: "none",
                                      color: "#dc2626",
                                      cursor: "pointer",
                                      padding: "4px 6px",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: "4px",
                                      fontSize: "12px",
                                      fontWeight: "700",
                                      transition: "transform 0.15s ease, color 0.15s ease",
                                      outline: "none"
                                    }}
                                    onMouseEnter={e => { e.currentTarget.style.color = "#b91c1c"; e.currentTarget.style.transform = "scale(1.08)"; }}
                                    onMouseLeave={e => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.transform = "scale(1)"; }}
                                    title="Delete Team"
                                  >
                                    <Trash2 size={14} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          );
                        })}
                    </tbody>
                  </table>
                </div>
                <div style={{ borderTop: "1px solid var(--border-color)", padding: "10px 20px", background: "#f8fafc" }}>
                  <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>
                    Showing {materialTeams.length} registered material team{materialTeams.length !== 1 ? "s" : ""}
                  </span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Tab content 2: Approvals Queue */}
        {activeTab === "requests" && (
          <Card title="Pending Field Requests approval queue" subtitle="Review, adjust and authorize site supply orders.">
            {pendingRequests.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>
                No pending requests in the approval queue.
              </p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
                  <thead>
                    <tr>
                      <th>Site Name</th>
                      <th>Material Name</th>
                      <th>Category</th>
                      <th style={{ textAlign: "right" }}>Required Quantity</th>
                      <th>Date Required</th>
                      <th>Engineer Note</th>
                      <th style={{ textAlign: "right" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pendingRequests.map(req => (
                      <tr key={req.id}>
                        <td style={{ fontWeight: "700" }}>{req.siteName || "Unknown Site"}</td>
                        <td style={{ fontWeight: "700" }}>{req.materialName}</td>
                        <td><Badge status="pending">{req.category}</Badge></td>
                        <td style={{ textAlign: "right", fontWeight: "700" }}>{req.requiredQuantity} {req.unit}</td>
                        <td className="font-mono">{req.purchaseDate || "--"}</td>
                        <td>{req.notes || "--"}</td>
                        <td style={{ textAlign: "right" }}>
                          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end" }}>
                            <Button 
                              variant="primary" 
                              size="sm" 
                              onClick={() => handleOpenApproval(req)}
                              style={{ display: "flex", alignItems: "center", gap: "4px" }}
                            >
                              <Check size={14} />
                              <span>Process</span>
                            </Button>
                            <Button 
                              variant="secondary" 
                              size="sm" 
                              onClick={() => { setSelectedRequest(req); submitApproval("Rejected"); }}
                              style={{ display: "flex", alignItems: "center", gap: "4px", color: "var(--danger-600)" }}
                            >
                              <X size={14} />
                              <span>Reject</span>
                            </Button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        )}

        {/* Tab content 3: Inventory & Stock */}
        {activeTab === "inventory" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Stats dials */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Inventory Investment</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--primary-900)", marginTop: "6px" }}>{formatINR(totalStockVal)}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>value of approved deliveries</span>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Stock Consumption Ratio</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--primary-900)", marginTop: "6px" }}>
                  {inventoryList.reduce((acc, m) => acc + m.consumedQuantity, 0)} Units
                </strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>consumed out of {inventoryList.reduce((acc, m) => acc + m.receivedQuantity, 0)} received</span>
              </Card>
            </div>

            {/* Inventory table */}
            <Card title="Site Stocks & Usage Ledger" subtitle="Lists approved shipments and remaining stocks.">
              {inventoryList.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>
                  No stocks registered for the selected filter.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Material Batch</th>
                        <th>Category</th>
                        <th style={{ textAlign: "right" }}>Approved</th>
                        <th style={{ textAlign: "right" }}>Received</th>
                        <th style={{ textAlign: "right" }}>Consumed</th>
                        <th style={{ textAlign: "right" }}>Remaining Stock</th>
                        <th>Standing</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {inventoryList.map(item => (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td style={{ fontWeight: "700" }}>
                              <div>
                                <span>{item.materialName}</span>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal", marginTop: "2px" }}>
                                  Site: <u>{item.siteName}</u> • Date: {item.purchaseDate || "--"}
                                </div>
                              </div>
                            </td>
                            <td><Badge status="pending">{item.category}</Badge></td>
                            <td style={{ textAlign: "right" }}>{item.requiredQuantity} {item.unit}</td>
                            <td style={{ textAlign: "right", fontWeight: "600" }}>{item.receivedQuantity} {item.unit}</td>
                            <td style={{ textAlign: "right", color: "var(--danger-700)" }}>{item.consumedQuantity} {item.unit}</td>
                            <td style={{ textAlign: "right", fontWeight: "700", color: "var(--success-700)" }}>{item.remainingStock} {item.unit}</td>
                            <td>
                              <Badge status={item.remainingStock > 0 ? "success" : "danger"}>
                                {item.remainingStock > 0 ? "In Stock" : "Stock Empty"}
                              </Badge>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleOpenUsage(item)}
                              >
                                Log Usage
                              </Button>
                            </td>
                          </tr>
                          
                          {/* Render Consumption/Usage History details if available */}
                          {item.usageHistory && item.usageHistory.length > 0 && (
                            <tr>
                              <td colSpan={8} style={{ padding: "8px 24px", backgroundColor: "#f8fafc" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-800)" }}>Usage Logs:</span>
                                  {item.usageHistory.map((u, ui) => (
                                    <div key={ui} style={{ fontSize: "11.5px", color: "#475569", display: "flex", gap: "10px" }}>
                                      <span className="font-mono">{u.date}</span>
                                      <strong>-{u.quantity} {item.unit}</strong>
                                      <span>({u.notes || "No notes"})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab content 4: Payments Ledger */}
        {activeTab === "payments" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Stats dials */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Material Cost</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--primary-900)", marginTop: "6px" }}>{formatINR(totalStockVal)}</strong>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Amount Paid</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--success-700)", marginTop: "6px" }}>{formatINR(totalPaidVal)}</strong>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Outstanding Balance</span>
                <strong style={{ fontSize: "28px", display: "block", color: "var(--danger-700)", marginTop: "6px" }}>{formatINR(totalPendingVal)}</strong>
              </Card>
            </div>

            {/* Payments table */}
            <Card title="Supplier Materials Payment ledger" subtitle="Monitor batch amounts, paid logs and remaining dues.">
              {paymentsList.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>
                  No materials invoices registered for the selected filter.
                </p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Material Item</th>
                        <th>Supplier</th>
                        <th style={{ textAlign: "right" }}>Total Cost</th>
                        <th style={{ textAlign: "right" }}>Amount Paid</th>
                        <th style={{ textAlign: "right" }}>Remaining Balance</th>
                        <th>Payment Status</th>
                        <th style={{ textAlign: "right" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {paymentsList.map(item => (
                        <React.Fragment key={item.id}>
                          <tr>
                            <td style={{ fontWeight: "700" }}>
                              <div>
                                <span>{item.materialName}</span>
                                <div style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal", marginTop: "2px" }}>
                                  Received: {item.receivedQuantity} {item.unit} • Site: <u>{item.siteName}</u>
                                </div>
                              </div>
                            </td>
                            <td style={{ fontWeight: "600" }}>{item.supplierName || "--"}</td>
                            <td style={{ textAlign: "right", fontWeight: "700" }}>{formatINR(item.totalAmount)}</td>
                            <td style={{ textAlign: "right", color: "var(--success-700)", fontWeight: "600" }}>{formatINR(item.paidAmount)}</td>
                            <td style={{ textAlign: "right", color: "var(--danger-700)", fontWeight: "700" }}>{formatINR(item.pendingPayment)}</td>
                            <td>
                              <Badge status={item.paymentStatus === "Paid" ? "success" : item.paymentStatus === "Partial Payment" ? "pending" : "danger"}>
                                {item.paymentStatus}
                              </Badge>
                            </td>
                            <td style={{ textAlign: "right" }}>
                              <Button 
                                variant="primary" 
                                size="sm" 
                                onClick={() => handleOpenPayment(item)}
                                disabled={item.pendingPayment === 0}
                              >
                                Log Payout
                              </Button>
                            </td>
                          </tr>
                          
                          {/* Payment history list if logged */}
                          {item.paymentHistory && item.paymentHistory.length > 0 && (
                            <tr>
                              <td colSpan={7} style={{ padding: "8px 24px", backgroundColor: "#f8fafc" }}>
                                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--success-700)" }}>Payout History Logs:</span>
                                  {item.paymentHistory.map((p, pi) => (
                                    <div key={pi} style={{ fontSize: "11.5px", color: "#475569", display: "flex", gap: "10px" }}>
                                      <span className="font-mono">{p.date}</span>
                                      <strong style={{ color: "var(--success-700)" }}>{formatINR(p.amount)}</strong>
                                      <span>(Ref: <u>{p.reference || "--"}</u> • {p.notes || "No notes"})</span>
                                    </div>
                                  ))}
                                </div>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>

      {/* Modal: Create Material Team (with inline dynamic material entry) */}
      <Modal
        isOpen={showAddTeamModal}
        onClose={() => setShowAddTeamModal(false)}
        title="Create Material Team"
        maxWidth="640px"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
            <Button type="button" variant="secondary" onClick={() => setShowAddTeamModal(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-team-form" variant="primary">
              Create Team
            </Button>
          </div>
        }
      >
        <form id="add-team-form" onSubmit={handleAddTeam} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "6px 0" }}>
          <div className="form-group">
            <label htmlFor="team-name" style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary-900)" }}>
              Team Name <span style={{ color: "var(--danger-600)" }}>*</span>
            </label>
            <input
              id="team-name"
              type="text"
              placeholder="e.g. Bhuvan Team, Arjun Mason, Karthik Team"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              required
              style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
            />
          </div>

          {/* Dynamic Inline Materials Table */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary-900)" }}>
                Configured Materials <span style={{ color: "var(--danger-600)" }}>*</span>
              </label>
              <button
                type="button"
                onClick={handleAddMaterialRowInCreate}
                style={{
                  background: "#fff7ed",
                  border: "1px solid #ffedd5",
                  color: "#ea580c",
                  fontWeight: "700",
                  fontSize: "12px",
                  padding: "5px 10px",
                  borderRadius: "6px",
                  cursor: "pointer",
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <Plus size={14} />
                <span>Add Material Row</span>
              </button>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxHeight: "280px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                    <th style={{ padding: "8px 10px", textAlign: "left", width: "110px" }}>Type</th>
                    <th style={{ padding: "8px 10px", textAlign: "left" }}>Material Name *</th>
                    <th style={{ padding: "8px 10px", textAlign: "right", width: "120px" }}>Rate / Amount (₹)</th>
                    <th style={{ padding: "8px 10px", textAlign: "left", width: "105px" }}>Unit</th>
                    <th style={{ padding: "8px 10px", textAlign: "center", width: "35px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {newTeamMaterials.map((row, idx) => {
                    const isCustom = row.type === "custom";
                    return (
                      <tr key={row.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "6px 8px" }}>
                          <select
                            value={row.type || "standard"}
                            onChange={(e) => handleMaterialRowChangeInCreate(row.id, "type", e.target.value)}
                            style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff", fontWeight: "600" }}
                          >
                            <option value="standard">Standard</option>
                            <option value="custom">Custom</option>
                          </select>
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="text"
                            placeholder={isCustom ? "e.g. Steel, Plumbing Pipe" : "e.g. Sand, Jelly, Cement"}
                            value={row.name}
                            onChange={(e) => handleMaterialRowChangeInCreate(row.id, "name", e.target.value)}
                            required={idx === 0}
                            style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            placeholder={isCustom ? "25000" : "800"}
                            value={isCustom ? (row.amount !== undefined ? row.amount : row.rate) : row.rate}
                            onChange={(e) => {
                              if (isCustom) {
                                handleMaterialRowChangeInCreate(row.id, "amount", e.target.value);
                                handleMaterialRowChangeInCreate(row.id, "rate", e.target.value);
                              } else {
                                handleMaterialRowChangeInCreate(row.id, "rate", e.target.value);
                              }
                            }}
                            style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", textAlign: "right" }}
                          />
                        </td>
                        <td style={{ padding: "6px 8px" }}>
                          {isCustom ? (
                            <span style={{ color: "#94a3b8", fontSize: "12px", fontWeight: "600", paddingLeft: "8px" }}>—</span>
                          ) : (
                            <select
                              value={row.unit || "Bag"}
                              onChange={(e) => handleMaterialRowChangeInCreate(row.id, "unit", e.target.value)}
                              style={{ width: "100%", padding: "7px 9px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", backgroundColor: "#ffffff" }}
                            >
                              <option value="Bag">Bag</option>
                              <option value="Ton">Ton</option>
                              <option value="Load">Load</option>
                              <option value="CFT">CFT</option>
                              <option value="Sqft">Sqft</option>
                              <option value="Piece">Piece</option>
                              <option value="Meter">Meter</option>
                              <option value="Unit">Unit</option>
                            </select>
                          )}
                        </td>
                        <td style={{ padding: "6px 8px", textAlign: "center" }}>
                          {newTeamMaterials.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveMaterialRowInCreate(row.id)}
                              style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px" }}
                              title="Remove row"
                            >
                              <Trash2 size={14} />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: View Team Details Popup */}
      <Modal
        isOpen={showViewTeamModal && !!activeViewingTeam}
        onClose={() => {
          setShowViewTeamModal(false);
          setViewingTeamId(null);
        }}
        title={activeViewingTeam ? `${activeViewingTeam.name} — Material Details` : "Material Team Details"}
        maxWidth="680px"
      >
        {activeViewingTeam && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "6px 0" }}>
            {/* Header Info & Add Material Action */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{activeViewingTeam.name}</h4>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: "100px" }}>
                    ● Active
                  </span>
                </div>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", marginTop: "2px", display: "block" }}>
                  {(activeViewingTeam.materials || []).length} Configured Materials
                </span>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => {
                  setTargetTeamForMat(activeViewingTeam);
                  setNewMaterialForm({ type: "standard", name: "", unit: "Bag", rate: "", amount: "" });
                  setShowAddMaterialModal(true);
                }}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "7px 14px" }}
              >
                <Plus size={15} />
                <span>+ Add Material</span>
              </Button>
            </div>

            {/* Materials Table */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxHeight: "380px", overflowY: "auto" }}>
              {(!activeViewingTeam.materials || activeViewingTeam.materials.length === 0) ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No materials configured for this team yet. Click <strong>"+ Add Material"</strong> above to add items and rates.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left" }}>Material</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", width: "140px" }}>Rate / Amount (₹)</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", width: "95px" }}>Unit</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", width: "100px" }}>Status</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", width: "130px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {activeViewingTeam.materials.map(mat => {
                      const isCustom = mat.type === "custom";
                      const displayAmount = Number(mat.amount !== undefined ? mat.amount : (mat.rate !== undefined ? mat.rate : mat.unitPrice || 0));
                      return (
                        <tr key={mat.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "10px 14px", fontWeight: "700", color: "#0f172a" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <span>{mat.name}</span>
                              {isCustom && (
                                <span style={{ fontSize: "10px", fontWeight: "800", color: "#4338ca", backgroundColor: "#e0e7ff", padding: "1px 6px", borderRadius: "4px" }}>
                                  Custom
                                </span>
                              )}
                            </div>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", color: "var(--success-700)", fontWeight: "800", fontSize: "13px" }}>
                            ₹{displayAmount.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "10px 14px" }}>
                            {isCustom ? (
                              <span style={{ color: "#94a3b8", fontWeight: "600", fontSize: "12px" }}>—</span>
                            ) : (
                              <span className="font-mono" style={{ backgroundColor: "#f1f5f9", padding: "2px 8px", borderRadius: "4px", fontSize: "11.5px", fontWeight: "600", color: "#475569" }}>
                                {mat.unit || "Unit"}
                              </span>
                            )}
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "center" }}>
                            <Badge status={mat.status === "Active" ? "success" : "danger"}>
                              {mat.status || "Active"}
                            </Badge>
                          </td>
                          <td style={{ padding: "10px 14px", textAlign: "right" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "6px" }}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setTargetTeamForEditMat(activeViewingTeam);
                                    setEditingMaterial({
                                      id: mat.id,
                                      name: mat.name,
                                      type: isCustom ? "custom" : "standard",
                                      unit: mat.unit || "Bag",
                                      rate: mat.rate !== undefined ? mat.rate : (mat.unitPrice || 0),
                                      amount: mat.amount !== undefined ? mat.amount : (mat.rate !== undefined ? mat.rate : (mat.unitPrice || 0)),
                                      status: mat.status || "Active"
                                    });
                                    setShowEditMaterialModal(true);
                                  }}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: "4px 6px",
                                    cursor: "pointer",
                                    color: "#ea580c",
                                    display: "flex",
                                    alignItems: "center",
                                    transition: "transform 0.15s ease, color 0.15s ease",
                                    outline: "none"
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.color = "#c2410c"; e.currentTarget.style.transform = "scale(1.15)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = "#ea580c"; e.currentTarget.style.transform = "scale(1)"; }}
                                  title="Edit Material"
                                  aria-label="Edit Material"
                                >
                                  <Edit2 size={15} />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRequestToggleMaterialStatus(activeViewingTeam.id, activeViewingTeam.name, mat)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: "4px 6px",
                                    cursor: "pointer",
                                    color: mat.status === "Active" ? "#c2410c" : "#16a34a",
                                    fontSize: "12px",
                                    fontWeight: "700",
                                    transition: "transform 0.15s ease, color 0.15s ease",
                                    outline: "none"
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.transform = "scale(1.08)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.transform = "scale(1)"; }}
                                  title={mat.status === "Active" ? "Deactivate Material" : "Activate Material"}
                                  aria-label={mat.status === "Active" ? "Deactivate Material" : "Activate Material"}
                                >
                                  {mat.status === "Active" ? "Deactivate" : "Activate"}
                                </button>
                                <button
                                  type="button"
                                  onClick={() => handleRequestDeleteMaterial(activeViewingTeam.id, activeViewingTeam.name, mat)}
                                  style={{
                                    background: "transparent",
                                    border: "none",
                                    padding: "4px 6px",
                                    cursor: "pointer",
                                    color: "#dc2626",
                                    display: "flex",
                                    alignItems: "center",
                                    transition: "transform 0.15s ease, color 0.15s ease",
                                    outline: "none"
                                  }}
                                  onMouseEnter={e => { e.currentTarget.style.color = "#b91c1c"; e.currentTarget.style.transform = "scale(1.15)"; }}
                                  onMouseLeave={e => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.transform = "scale(1)"; }}
                                  title="Delete Material"
                                  aria-label="Delete Material"
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
              )}
            </div>

            {/* Footer / Close Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              <Button type="button" variant="outline" onClick={() => { setShowViewTeamModal(false); setViewingTeamId(null); }}>
                Close
              </Button>
            </div>
          </div>
        )}
      </Modal>

      {/* Modal: Rename Material Team */}
      <Modal
        isOpen={showRenameTeamModal && !!targetTeam}
        onClose={() => {
          setShowRenameTeamModal(false);
          setTargetTeam(null);
        }}
        title={`Rename Material Team (${targetTeam?.name || ""})`}
        maxWidth="450px"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
            <Button type="button" variant="secondary" onClick={() => {
              setShowRenameTeamModal(false);
              setTargetTeam(null);
            }}>
              Cancel
            </Button>
            <Button type="submit" form="rename-team-form" variant="primary">
              Save Name
            </Button>
          </div>
        }
      >
        <form id="rename-team-form" onSubmit={handleRenameTeam}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="form-group">
              <label htmlFor="rename-team-name" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>New Team Name</label>
              <input
                id="rename-team-name"
                type="text"
                placeholder="e.g. Arjun Mason Contractors"
                value={renamingTeamName}
                onChange={(e) => setRenamingTeamName(e.target.value)}
                required
                style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Modal: Add Material to Team */}
      <Modal
        isOpen={showAddMaterialModal && !!targetTeamForMat}
        onClose={() => {
          setShowAddMaterialModal(false);
          setTargetTeamForMat(null);
        }}
        title={`Add Material to Team "${targetTeamForMat?.name || ""}"`}
        maxWidth="480px"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
            <Button type="button" variant="secondary" onClick={() => {
              setShowAddMaterialModal(false);
              setTargetTeamForMat(null);
            }}>
              Cancel
            </Button>
            <Button type="submit" form="add-mat-team-form" variant="primary">
              Add Material
            </Button>
          </div>
        }
      >
        <form id="add-mat-team-form" onSubmit={handleAddMaterialToTeamSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Material Type Selection */}
            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary-900)", marginBottom: "6px", display: "block" }}>
                Material Type <span style={{ color: "var(--danger-600)" }}>*</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setNewMaterialForm(prev => ({ ...prev, type: "standard" }))}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: newMaterialForm.type !== "custom" ? "2px solid #ea580c" : "1px solid #cbd5e1",
                    backgroundColor: newMaterialForm.type !== "custom" ? "#fff7ed" : "#ffffff",
                    color: newMaterialForm.type !== "custom" ? "#c2410c" : "#64748b",
                    fontWeight: "750",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Package size={15} />
                  <span>Standard Material</span>
                </button>
                <button
                  type="button"
                  onClick={() => setNewMaterialForm(prev => ({ ...prev, type: "custom" }))}
                  style={{
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: newMaterialForm.type === "custom" ? "2px solid #ea580c" : "1px solid #cbd5e1",
                    backgroundColor: newMaterialForm.type === "custom" ? "#fff7ed" : "#ffffff",
                    color: newMaterialForm.type === "custom" ? "#c2410c" : "#64748b",
                    fontWeight: "750",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <FileText size={15} />
                  <span>Custom</span>
                </button>
              </div>
            </div>

            {newMaterialForm.type === "custom" ? (
              /* Custom Material Fields: Custom Material Name & Bill Amount / Amount ONLY */
              <>
                <div className="form-group">
                  <label htmlFor="team-mat-custom-name" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Custom Material Name <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="team-mat-custom-name"
                    type="text"
                    placeholder="e.g. Steel, Plumbing Pipe"
                    value={newMaterialForm.name}
                    onChange={(e) => setNewMaterialForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="team-mat-custom-amount" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Bill Amount / Amount (₹) <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="team-mat-custom-amount"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 25000"
                    value={newMaterialForm.amount !== undefined && newMaterialForm.amount !== "" ? newMaterialForm.amount : newMaterialForm.rate}
                    onChange={(e) => setNewMaterialForm(prev => ({ ...prev, amount: e.target.value, rate: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    The entered amount represents the complete bill amount for this custom material.
                  </span>
                </div>
              </>
            ) : (
              /* Standard Material Fields: Material Name, Unit of Measure, Rate */
              <>
                <div className="form-group">
                  <label htmlFor="team-mat-name" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Material Name <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="team-mat-name"
                    type="text"
                    placeholder="e.g. Sand, Jelly, Cement, 10mm TMT Steel"
                    value={newMaterialForm.name}
                    onChange={(e) => setNewMaterialForm(prev => ({ ...prev, name: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="team-mat-unit" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Unit of Measure <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <select
                    id="team-mat-unit"
                    value={newMaterialForm.unit || "Bag"}
                    onChange={(e) => setNewMaterialForm(prev => ({ ...prev, unit: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "14px" }}
                  >
                    <option value="Bag">Bag</option>
                    <option value="Ton">Ton</option>
                    <option value="Load">Load</option>
                    <option value="CFT">CFT</option>
                    <option value="Sqft">Sqft</option>
                    <option value="Piece">Piece</option>
                    <option value="Meter">Meter</option>
                    <option value="Unit">Unit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="team-mat-rate" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Configured Rate (₹) <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="team-mat-rate"
                    type="number"
                    min="0"
                    step="any"
                    placeholder="e.g. 800"
                    value={newMaterialForm.rate}
                    onChange={(e) => setNewMaterialForm(prev => ({ ...prev, rate: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    This rate will auto-populate and calculate amount (Qty × Rate) when Site Engineers select this team.
                  </span>
                </div>
              </>
            )}
          </div>
        </form>
      </Modal>

      {/* Modal: Edit Material in Team */}
      <Modal
        isOpen={showEditMaterialModal && !!targetTeamForEditMat}
        onClose={() => {
          setShowEditMaterialModal(false);
          setTargetTeamForEditMat(null);
        }}
        title={`Edit Material — ${targetTeamForEditMat?.name || ""}`}
        maxWidth="480px"
        footer={
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", width: "100%" }}>
            <Button type="button" variant="secondary" onClick={() => {
              setShowEditMaterialModal(false);
              setTargetTeamForEditMat(null);
            }}>
              Cancel
            </Button>
            <Button type="submit" form="edit-mat-team-form" variant="primary">
              Save Changes
            </Button>
          </div>
        }
      >
        <form id="edit-mat-team-form" onSubmit={handleEditMaterialInTeamSubmit}>
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {/* Material Type Selection */}
            <div className="form-group">
              <label style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary-900)", marginBottom: "6px", display: "block" }}>
                Material Type <span style={{ color: "var(--danger-600)" }}>*</span>
              </label>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  type="button"
                  onClick={() => setEditingMaterial(prev => ({ ...prev, type: "standard" }))}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: editingMaterial.type !== "custom" ? "2px solid #ea580c" : "1px solid #cbd5e1",
                    backgroundColor: editingMaterial.type !== "custom" ? "#fff7ed" : "#ffffff",
                    color: editingMaterial.type !== "custom" ? "#c2410c" : "#64748b",
                    fontWeight: "750",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <Package size={15} />
                  <span>Standard Material</span>
                </button>
                <button
                  type="button"
                  onClick={() => setEditingMaterial(prev => ({ ...prev, type: "custom" }))}
                  style={{
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: editingMaterial.type === "custom" ? "2px solid #ea580c" : "1px solid #cbd5e1",
                    backgroundColor: editingMaterial.type === "custom" ? "#fff7ed" : "#ffffff",
                    color: editingMaterial.type === "custom" ? "#c2410c" : "#64748b",
                    fontWeight: "750",
                    fontSize: "13px",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: "6px"
                  }}
                >
                  <FileText size={15} />
                  <span>Custom</span>
                </button>
              </div>
            </div>

            {editingMaterial.type === "custom" ? (
              /* Custom Material: Custom Material Name & Bill Amount / Amount ONLY */
              <>
                <div className="form-group">
                  <label htmlFor="edit-mat-custom-name" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Custom Material Name <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="edit-mat-custom-name"
                    type="text"
                    value={editingMaterial.name}
                    onChange={(e) => setEditingMaterial(prev => ({ ...prev, name: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-mat-custom-amount" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Bill Amount / Amount (₹) <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="edit-mat-custom-amount"
                    type="number"
                    min="0"
                    step="any"
                    value={editingMaterial.amount !== undefined && editingMaterial.amount !== "" ? editingMaterial.amount : editingMaterial.rate}
                    onChange={(e) => setEditingMaterial(prev => ({ ...prev, amount: e.target.value, rate: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    The entered amount represents the complete bill amount for this custom material.
                  </span>
                </div>
              </>
            ) : (
              /* Standard Material: Name, Unit, Rate */
              <>
                <div className="form-group">
                  <label htmlFor="edit-mat-name" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Material Name <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="edit-mat-name"
                    type="text"
                    value={editingMaterial.name}
                    onChange={(e) => setEditingMaterial(prev => ({ ...prev, name: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="edit-mat-unit" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Unit of Measure <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <select
                    id="edit-mat-unit"
                    value={editingMaterial.unit || "Bag"}
                    onChange={(e) => setEditingMaterial(prev => ({ ...prev, unit: e.target.value }))}
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "14px" }}
                  >
                    <option value="Bag">Bag</option>
                    <option value="Ton">Ton</option>
                    <option value="Load">Load</option>
                    <option value="CFT">CFT</option>
                    <option value="Sqft">Sqft</option>
                    <option value="Piece">Piece</option>
                    <option value="Meter">Meter</option>
                    <option value="Unit">Unit</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="edit-mat-rate" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                    Configured Rate (₹) <span style={{ color: "var(--danger-600)" }}>*</span>
                  </label>
                  <input
                    id="edit-mat-rate"
                    type="number"
                    min="0"
                    step="any"
                    value={editingMaterial.rate}
                    onChange={(e) => setEditingMaterial(prev => ({ ...prev, rate: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "14px" }}
                  />
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                    Updating rate applies immediately to all future Site Engineer material usage entries.
                  </span>
                </div>
              </>
            )}

            <div className="form-group">
              <label htmlFor="edit-mat-status" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>Status</label>
              <select
                id="edit-mat-status"
                value={editingMaterial.status}
                onChange={(e) => setEditingMaterial(prev => ({ ...prev, status: e.target.value }))}
                style={{ width: "100%", padding: "10px 12px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "14px" }}
              >
                <option value="Active">Active</option>
                <option value="Inactive">Inactive</option>
              </select>
            </div>
          </div>
        </form>
      </Modal>


      {/* Modal: Process Requisition */}
      {showApprovalModal && selectedRequest && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Process Requisition Approval</h3>
              <button className="modal-close" onClick={() => setShowApprovalModal(false)}><X size={18} /></button>
            </div>
            <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                Project: <strong>{selectedRequest.siteName}</strong><br />
                Material: <strong>{selectedRequest.materialName} ({selectedRequest.category})</strong><br />
                Requested: <strong>{selectedRequest.requiredQuantity} {selectedRequest.unit}</strong> on {selectedRequest.purchaseDate || "--"}
              </p>
              
              <div className="form-group">
                <label htmlFor="approve-qty">Approved Quantity ({selectedRequest.unit})</label>
                <input
                  id="approve-qty"
                  type="number"
                  value={approvalQty}
                  onChange={(e) => setApprovalQty(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="approve-cost">Approved Budget / Total Cost (₹)</label>
                <input
                  id="approve-cost"
                  type="number"
                  value={approvalCost}
                  onChange={(e) => setApprovalCost(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                />
              </div>
            </div>
            <div className="modal-footer">
              <Button type="button" variant="secondary" onClick={() => setShowApprovalModal(false)}>Cancel</Button>
              <Button type="button" variant="primary" onClick={() => submitApproval("Approved")}>Approve Request</Button>
            </div>
          </div>
        </div>
      )}

      {/* Modal: Log stock Consumption */}
      {showUsageModal && selectedInventoryItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Log Material Consumption</h3>
              <button className="modal-close" onClick={() => setShowUsageModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitUsage}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                  Site: <strong>{selectedInventoryItem.siteName}</strong><br />
                  Material: <strong>{selectedInventoryItem.materialName}</strong><br />
                  In Stock: <strong>{selectedInventoryItem.remainingStock} {selectedInventoryItem.unit}</strong>
                </p>

                <div className="form-group">
                  <label htmlFor="usage-qty">Quantity Consumed ({selectedInventoryItem.unit})</label>
                  <input
                    id="usage-qty"
                    type="number"
                    min="0.1"
                    step="any"
                    max={selectedInventoryItem.remainingStock}
                    value={usageQty}
                    onChange={(e) => setUsageQty(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="usage-date">Date of Consumption</label>
                  <input
                    id="usage-date"
                    type="date"
                    value={usageDate}
                    onChange={(e) => setUsageDate(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="usage-notes">Usage Notes / Details</label>
                  <input
                    id="usage-notes"
                    type="text"
                    placeholder="e.g. Wing A column casting, blockwork curing"
                    value={usageNotes}
                    onChange={(e) => setUsageNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowUsageModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Log Consumed</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Log supplier payout */}
      {showPaymentModal && selectedPaymentItem && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Log Supplier Payout</h3>
              <button className="modal-close" onClick={() => setShowPaymentModal(false)}><X size={18} /></button>
            </div>
            <form onSubmit={submitPayment}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <p style={{ fontSize: "13px", color: "var(--text-muted)", margin: 0 }}>
                  Supplier: <strong>{selectedPaymentItem.supplierName}</strong><br />
                  Material: <strong>{selectedPaymentItem.materialName}</strong><br />
                  Pending Amount: <strong>{formatINR(selectedPaymentItem.pendingPayment)}</strong>
                </p>

                <div className="form-group">
                  <label htmlFor="pay-amt">Amount Paid (₹)</label>
                  <input
                    id="pay-amt"
                    type="number"
                    min="1"
                    max={selectedPaymentItem.pendingPayment}
                    value={payAmount}
                    onChange={(e) => setPayAmount(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pay-date">Payment Date</label>
                  <input
                    id="pay-date"
                    type="date"
                    value={payDate}
                    onChange={(e) => setPayDate(e.target.value)}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pay-ref">Transaction reference # (UPI / Check / Cash)</label>
                  <input
                    id="pay-ref"
                    type="text"
                    placeholder="e.g. TXN-9492193, Cash"
                    value={payRef}
                    onChange={(e) => setPayRef(e.target.value)}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="pay-notes">Additional Notes</label>
                  <input
                    id="pay-notes"
                    type="text"
                    placeholder="e.g. Part payment for structural steel batch"
                    value={payNotes}
                    onChange={(e) => setPayNotes(e.target.value)}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowPaymentModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Log Payment</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Confirmation Modal for UI Safety (Deactivate / Delete) */}
      <ConfirmationModal
        isOpen={confirmModalState.isOpen}
        onClose={closeConfirmModal}
        onConfirm={confirmModalState.onConfirm}
        title={confirmModalState.title}
        message={confirmModalState.message}
        details={confirmModalState.details}
        confirmText={confirmModalState.confirmText}
        cancelText={confirmModalState.cancelText}
        variant={confirmModalState.variant}
        isLoading={confirmModalState.isLoading}
      />

    </Layout>
  );
}

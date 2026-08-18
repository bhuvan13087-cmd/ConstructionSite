import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import ViewToggle from "../components/common/ViewToggle";
import SiteDetails from "./SiteDetails";
import { useAuth } from "../context/AuthContext";
import { 
  getSites, 
  getSiteEngineers, 
  getMaterialsDetailed, 
  getMaterialTransfersForSite, 
  getGeneralExpenses, 
  getLabourDailyCountsSummary, 
  getLabourPayments,
  getDailyUpdatesForSite,
  markSiteCompleted,
  reopenSite
} from "../services/firebaseService";
import { computeSitePendingItemsSummary } from "../services/businessLogic";
import { 
  Building2, 
  MapPin, 
  Users, 
  CheckCircle2, 
  AlertTriangle, 
  Archive, 
  Clock, 
  ArrowRight, 
  Search, 
  Filter, 
  RefreshCw, 
  Lock, 
  Unlock, 
  Eye, 
  Package, 
  Truck, 
  DollarSign, 
  FileText,
  AlertCircle,
  Check,
  X
} from "lucide-react";

export default function SiteCompletionDashboard() {
  const { userProfile } = useAuth();
  
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [allMaterials, setAllMaterials] = useState([]);
  const [allTransfers, setAllTransfers] = useState([]);
  const [allExpenses, setAllExpenses] = useState([]);
  const [allLabour, setAllLabour] = useState([]);
  const [allPayments, setAllPayments] = useState([]);
  const [allProgress, setAllProgress] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSiteIdForDetails, setSelectedSiteIdForDetails] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [activeTab, setActiveTab] = useState("completed"); // Default tab: "completed", options: "all", "active", "pending", "completed"
  const [viewMode, setViewMode] = useState("normal"); // "normal" (list) | "grid"
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // Completion Workflow Modal State
  const [completionModal, setCompletionModal] = useState({
    isOpen: false,
    site: null,
    step: 1, // 1: Audit Review, 2: Confirmation 1, 3: Confirmation 2
    acknowledgedPending: false,
    completionNotes: "",
    isSubmitting: false
  });

  // Reopen Site Modal State
  const [reopenModal, setReopenModal] = useState({
    isOpen: false,
    site: null,
    reopenNotes: "",
    isSubmitting: false
  });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async (isManual = false) => {
    if (isManual) setRefreshing(true);
    else setLoading(true);

    try {
      const [
        fetchedSites,
        fetchedEngineers,
        fetchedMaterials,
        fetchedTransfers,
        fetchedExpenses,
        fetchedLabour,
        fetchedPayments,
        fetchedProgress
      ] = await Promise.all([
        getSites(),
        getSiteEngineers(),
        getMaterialsDetailed(),
        getMaterialTransfersForSite(),
        getGeneralExpenses(),
        getLabourDailyCountsSummary(),
        getLabourPayments(),
        getDailyUpdatesForSite()
      ]);

      setSites(fetchedSites || []);
      setEngineers(fetchedEngineers || []);
      setAllMaterials(fetchedMaterials || []);
      setAllTransfers(fetchedTransfers || []);
      setAllExpenses(fetchedExpenses || []);
      setAllLabour(fetchedLabour || []);
      setAllPayments(fetchedPayments || []);
      setAllProgress(fetchedProgress || []);
    } catch (err) {
      console.error("Error loading site completion dashboard data:", err);
      showToast(`Failed to load data: ${err.message}`, "error");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  // Compute canonical pending summaries per site
  const siteSummaries = useMemo(() => {
    const map = {};
    sites.forEach(site => {
      const summary = computeSitePendingItemsSummary(
        site.id,
        allMaterials,
        allTransfers,
        allExpenses,
        allLabour,
        allPayments,
        allProgress
      );
      map[site.id] = summary;
    });
    return map;
  }, [sites, allMaterials, allTransfers, allExpenses, allLabour, allPayments, allProgress]);

  // Filtered Sites
  const filteredSites = useMemo(() => {
    return sites.filter(site => {
      // Tab filter
      const isCompleted = (site.status || "").toLowerCase() === "completed" || site.isCompleted === true;
      const summary = siteSummaries[site.id] || { hasPendingItems: false };

      if (activeTab === "active" && isCompleted) return false;
      if (activeTab === "completed" && !isCompleted) return false;
      if (activeTab === "pending" && !summary.hasPendingItems) return false;

      // Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesName = (site.siteName || "").toLowerCase().includes(q);
        const matchesClient = (site.clientName || "").toLowerCase().includes(q);
        const matchesLocation = (site.location || "").toLowerCase().includes(q);
        if (!matchesName && !matchesClient && !matchesLocation) return false;
      }

      return true;
    });
  }, [sites, siteSummaries, activeTab, searchQuery]);

  // Overall KPI Metrics
  const metrics = useMemo(() => {
    let activeCount = 0;
    let completedCount = 0;
    let pendingCount = 0;
    let totalBudget = 0;

    sites.forEach(site => {
      const isCompleted = (site.status || "").toLowerCase() === "completed" || site.isCompleted === true;
      const summary = siteSummaries[site.id];
      const budget = Number(site.budget || site.totalBudget || 0);

      totalBudget += budget;
      if (isCompleted) {
        completedCount++;
      } else {
        activeCount++;
      }

      if (summary?.hasPendingItems) {
        pendingCount++;
      }
    });

    return {
      totalSites: sites.length,
      activeCount,
      completedCount,
      pendingCount,
      totalBudget
    };
  }, [sites, siteSummaries]);

  // Open Completion Modal for a site
  const handleOpenCompletionModal = (site) => {
    const summary = siteSummaries[site.id];
    setCompletionModal({
      isOpen: true,
      site,
      step: 1,
      acknowledgedPending: !summary?.hasPendingItems,
      completionNotes: "",
      isSubmitting: false
    });
  };

  const handleCloseCompletionModal = () => {
    setCompletionModal({
      isOpen: false,
      site: null,
      step: 1,
      acknowledgedPending: false,
      completionNotes: "",
      isSubmitting: false
    });
  };

  // Submit Site Completion after Double Confirmation
  const handleConfirmCompletion = async () => {
    if (!completionModal.site) return;
    setCompletionModal(prev => ({ ...prev, isSubmitting: true }));

    try {
      await markSiteCompleted(completionModal.site.id, {
        completedBy: userProfile?.uid || "admin",
        completedByName: userProfile?.fullName || "Admin",
        notes: completionModal.completionNotes.trim()
      });

      showToast(`Site "${completionModal.site.siteName}" marked as Completed (Read-Only Archive).`, "success");
      handleCloseCompletionModal();
      await loadData();
    } catch (err) {
      console.error("Error completing site:", err);
      showToast(`Failed to mark site as completed: ${err.message}`, "error");
      setCompletionModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // Reopen Site
  const handleConfirmReopen = async () => {
    if (!reopenModal.site) return;
    setReopenModal(prev => ({ ...prev, isSubmitting: true }));

    try {
      await reopenSite(reopenModal.site.id, {
        reopenedBy: userProfile?.uid || "admin",
        reopenedByName: userProfile?.fullName || "Admin",
        notes: reopenModal.reopenNotes.trim()
      });

      showToast(`Site "${reopenModal.site.siteName}" reopened successfully and set to In Progress.`, "success");
      setReopenModal({ isOpen: false, site: null, reopenNotes: "", isSubmitting: false });
      await loadData();
    } catch (err) {
      console.error("Error reopening site:", err);
      showToast(`Failed to reopen site: ${err.message}`, "error");
      setReopenModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  // If inspecting a specific site in SiteDetails
  if (selectedSiteIdForDetails) {
    return (
      <SiteDetails 
        siteId={selectedSiteIdForDetails} 
        onBack={() => setSelectedSiteIdForDetails(null)} 
      />
    );
  }

  if (loading) {
    return (
      <Layout title="Completed Sites" description="Loading project lifecycle ledger...">
        <Loading show={true} text="Synchronizing project lifecycle database..." />
      </Layout>
    );
  }

  return (
    <Layout 
      title="Completed Sites" 
      description="Manage project lifecycle, audit unresolved pending items, and review read-only completed sites."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Top KPI Metric Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px" }}>
          
          {/* Card 1: Active Sites */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
            boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "var(--accent-600, #ea580c)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Active Ongoing Sites
              </span>
              <Building2 size={18} style={{ color: "var(--accent-500, #f97316)" }} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "900", color: "#0f172a", marginTop: "2px" }}>
              {metrics.activeCount}
            </div>
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: "600" }}>
              Ongoing operations & daily logs
            </span>
          </div>

          {/* Card 2: Completed & Archived */}
          <div style={{
            backgroundColor: "#f0fdf4",
            borderRadius: "14px",
            padding: "16px 18px",
            border: "1px solid #bbf7d0",
            boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Completed / Archived Sites
              </span>
              <Archive size={18} style={{ color: "#166534" }} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "900", color: "#14532d", marginTop: "2px" }}>
              {metrics.completedCount}
            </div>
            <span style={{ fontSize: "11.5px", color: "#15803d", fontWeight: "600" }}>
              Preserved in 100% read-only archive
            </span>
          </div>

          {/* Card 3: Sites with Pending Items */}
          <div style={{
            backgroundColor: metrics.pendingCount > 0 ? "var(--accent-50, #fff7ed)" : "#ffffff",
            borderRadius: "14px",
            padding: "16px 18px",
            border: metrics.pendingCount > 0 ? "1px solid var(--accent-100, #ffedd5)" : "1px solid #e2e8f0",
            boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: metrics.pendingCount > 0 ? "var(--accent-600, #ea580c)" : "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Sites with Pending Items
              </span>
              <AlertTriangle size={18} style={{ color: metrics.pendingCount > 0 ? "var(--accent-500, #f97316)" : "#94a3b8" }} />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "900", color: metrics.pendingCount > 0 ? "var(--accent-700, #c2410c)" : "#0f172a", marginTop: "2px" }}>
              {metrics.pendingCount}
            </div>
            <span style={{ fontSize: "11.5px", color: metrics.pendingCount > 0 ? "var(--accent-600, #ea580c)" : "#64748b", fontWeight: "600" }}>
              {metrics.pendingCount > 0 ? "Pending delivery, transfer or payout" : "Zero pending operational blockers"}
            </span>
          </div>

          {/* Card 4: Total Managed Sites */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "14px",
            padding: "16px 18px",
            border: "1px solid #e2e8f0",
            boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Managed Sites
              </span>
              <RefreshCw 
                size={16} 
                onClick={() => loadData(true)} 
                style={{ color: "var(--accent-500, #f97316)", cursor: "pointer", animation: refreshing ? "spin 0.8s linear infinite" : "none" }} 
              />
            </div>
            <div style={{ fontSize: "26px", fontWeight: "900", color: "#0f172a", marginTop: "2px" }}>
              {metrics.totalSites}
            </div>
            <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: "600" }}>
              Total portfolio across lifecycle
            </span>
          </div>

        </div>

        {/* Navigation Tabs & Search Toolbar */}
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "16px 20px",
          border: "1px solid #cbd5e1",
          boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
          display: "flex",
          flexDirection: "column",
          gap: "14px"
        }}>
          {/* Segmented Tab Controls */}
          <div style={{
            display: "flex",
            flexWrap: "wrap",
            gap: "8px",
            borderBottom: "1px solid #e2e8f0",
            paddingBottom: "12px"
          }}>
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "750",
                border: "none",
                cursor: "pointer",
                backgroundColor: activeTab === "all" ? "var(--accent-500, #f97316)" : "#f1f5f9",
                color: activeTab === "all" ? "#ffffff" : "#475569",
                transition: "all 0.15s ease"
              }}
            >
              All Sites ({metrics.totalSites})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("active")}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "750",
                border: "none",
                cursor: "pointer",
                backgroundColor: activeTab === "active" ? "var(--accent-500, #f97316)" : "#f1f5f9",
                color: activeTab === "active" ? "#ffffff" : "#475569",
                transition: "all 0.15s ease"
              }}
            >
              Active Sites ({metrics.activeCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("pending")}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "750",
                cursor: "pointer",
                backgroundColor: activeTab === "pending" ? "var(--accent-500, #f97316)" : (metrics.pendingCount > 0 ? "var(--accent-50, #fff7ed)" : "#f1f5f9"),
                color: activeTab === "pending" ? "#ffffff" : (metrics.pendingCount > 0 ? "var(--accent-600, #ea580c)" : "#475569"),
                border: activeTab === "pending" ? "none" : (metrics.pendingCount > 0 ? "1px solid var(--accent-100, #ffedd5)" : "none"),
                transition: "all 0.15s ease"
              }}
            >
              Sites with Pending Items ({metrics.pendingCount})
            </button>

            <button
              type="button"
              onClick={() => setActiveTab("completed")}
              style={{
                padding: "8px 16px",
                borderRadius: "20px",
                fontSize: "13px",
                fontWeight: "750",
                cursor: "pointer",
                backgroundColor: activeTab === "completed" ? "#166534" : "#f0fdf4",
                color: activeTab === "completed" ? "#ffffff" : "#166534",
                border: activeTab === "completed" ? "none" : "1px solid #bbf7d0",
                transition: "all 0.15s ease"
              }}
            >
              Completed / Archived ({metrics.completedCount})
            </button>
          </div>

          {/* Search Input & View Toggle Bar */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
            <div style={{ position: "relative", flex: 1, minWidth: "260px", display: "flex", alignItems: "center" }}>
              <Search size={18} style={{ position: "absolute", left: "14px", color: "var(--accent-500, #f97316)", pointerEvents: "none" }} />
              <input
                type="text"
                placeholder="Search by site name, client, or location..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  height: "42px",
                  padding: "8px 14px 8px 42px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "14px",
                  outline: "none",
                  color: "#0f172a"
                }}
              />
            </div>
            
            {/* View Mode Toggle: Small icon-only controls in top-right */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            </div>
          </div>
        </div>

        {/* Site Views (Normal / List View OR Grid View) */}
        {filteredSites.length === 0 ? (
          <div style={{
            textAlign: "center",
            padding: "48px 24px",
            backgroundColor: "#f8fafc",
            borderRadius: "16px",
            border: "1.5px dashed #cbd5e1",
            color: "#64748b",
            fontSize: "15px",
            fontWeight: "600"
          }}>
            {searchQuery ? "No sites match your search query." : "No sites found in this category."}
          </div>
        ) : viewMode === "normal" ? (
          /* Normal / List View */
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--border-color, #e2e8f0)",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm, 0 1px 3px rgba(0,0,0,0.04))"
          }}>
            <div className="table-container" style={{ overflowX: "auto" }}>
              <table className="admin-table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                <thead>
                  <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0", fontSize: "12px", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                    <th style={{ padding: "12px 16px", fontWeight: "750" }}>Site &amp; Location</th>
                    <th style={{ padding: "12px 16px", fontWeight: "750" }}>Client</th>
                    <th style={{ padding: "12px 16px", fontWeight: "750" }}>Assigned Engineers</th>
                    <th style={{ padding: "12px 16px", fontWeight: "750" }}>Status</th>
                    <th style={{ padding: "12px 16px", fontWeight: "750" }}>Progress</th>
                    <th style={{ padding: "12px 16px", fontWeight: "750" }}>Pending Items Audit</th>
                    <th style={{ padding: "12px 16px", fontWeight: "750", textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody style={{ fontSize: "13px" }}>
                  {filteredSites.map(site => {
                    const isCompleted = (site.status || "").toLowerCase() === "completed" || site.isCompleted === true;
                    const summary = siteSummaries[site.id] || { hasPendingItems: false, totalPendingCount: 0 };
                    const assignedEngs = engineers.filter(e => site.assignedEngineers && site.assignedEngineers.includes(e.id));
                    const progressPct = Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || (isCompleted ? 100 : 0)));

                    return (
                      <tr 
                        key={site.id} 
                        style={{ borderBottom: "1px solid #f1f5f9", transition: "background-color 0.15s ease" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}
                      >
                        <td style={{ padding: "14px 16px" }}>
                          <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>{site.siteName}</strong>
                          <span style={{ fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px", marginTop: "2px" }}>
                            <MapPin size={12} style={{ color: "var(--accent-500, #f97316)" }} /> {site.location || "Location not set"}
                          </span>
                        </td>
                        <td style={{ padding: "14px 16px", color: "#334155", fontWeight: "600" }}>
                          {site.clientName || "Internal Project"}
                        </td>
                        <td style={{ padding: "14px 16px", color: "#334155" }}>
                          {assignedEngs.length > 0 ? assignedEngs.map(e => e.fullName).join(", ") : <span style={{ color: "#94a3b8" }}>Unassigned</span>}
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {isCompleted ? (
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: "8px",
                              backgroundColor: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #bbf7d0",
                              fontSize: "11px",
                              fontWeight: "800",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              <Lock size={11} /> COMPLETED
                            </span>
                          ) : (
                            <span style={{
                              padding: "3px 8px",
                              borderRadius: "8px",
                              backgroundColor: "var(--accent-50, #fff7ed)",
                              color: "var(--accent-600, #ea580c)",
                              border: "1px solid var(--accent-100, #ffedd5)",
                              fontSize: "11px",
                              fontWeight: "800",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px"
                            }}>
                              <Building2 size={11} /> {site.status || "In Progress"}
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", minWidth: "120px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{ flex: 1, height: "6px", backgroundColor: "#f1f5f9", borderRadius: "100px", overflow: "hidden" }}>
                              <div style={{
                                width: `${progressPct}%`,
                                height: "100%",
                                backgroundColor: isCompleted ? "#16a34a" : "var(--accent-500, #f97316)"
                              }} />
                            </div>
                            <span style={{ fontSize: "12px", fontWeight: "750", color: isCompleted ? "#16a34a" : "var(--accent-600, #ea580c)" }}>
                              {progressPct}%
                            </span>
                          </div>
                        </td>
                        <td style={{ padding: "14px 16px" }}>
                          {summary.hasPendingItems ? (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              backgroundColor: "var(--accent-50, #fff7ed)",
                              color: "var(--accent-600, #ea580c)",
                              border: "1px solid var(--accent-100, #ffedd5)",
                              fontSize: "11.5px",
                              fontWeight: "750"
                            }}>
                              <AlertTriangle size={12} />
                              {summary.totalPendingCount} Unresolved
                            </span>
                          ) : (
                            <span style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              padding: "4px 8px",
                              borderRadius: "6px",
                              backgroundColor: "#f0fdf4",
                              color: "#166534",
                              border: "1px solid #bbf7d0",
                              fontSize: "11.5px",
                              fontWeight: "750"
                            }}>
                              <CheckCircle2 size={12} />
                              All Resolved
                            </span>
                          )}
                        </td>
                        <td style={{ padding: "14px 16px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "6px", justifyContent: "flex-end" }}>
                            <button
                              type="button"
                              onClick={() => setSelectedSiteIdForDetails(site.id)}
                              style={{
                                padding: "6px 12px",
                                borderRadius: "8px",
                                border: "1px solid #cbd5e1",
                                backgroundColor: "#ffffff",
                                color: "#334155",
                                fontSize: "12px",
                                fontWeight: "700",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                            >
                              <Eye size={13} />
                              <span>{isCompleted ? "Inspect" : "Details"}</span>
                            </button>
                            {!isCompleted ? (
                              <button
                                type="button"
                                onClick={() => handleOpenCompletionModal(site)}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  border: "none",
                                  backgroundColor: "var(--accent-500, #f97316)",
                                  color: "#ffffff",
                                  fontSize: "12px",
                                  fontWeight: "750",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                              >
                                <CheckCircle2 size={13} />
                                <span>Complete</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setReopenModal({ isOpen: true, site, reopenNotes: "", isSubmitting: false })}
                                style={{
                                  padding: "6px 12px",
                                  borderRadius: "8px",
                                  border: "1px solid #cbd5e1",
                                  backgroundColor: "#f8fafc",
                                  color: "#475569",
                                  fontSize: "12px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px"
                                }}
                              >
                                <Unlock size={13} />
                                <span>Reopen</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          /* Grid View */
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: "16px" }}>
            {filteredSites.map(site => {
              const isCompleted = (site.status || "").toLowerCase() === "completed" || site.isCompleted === true;
              const summary = siteSummaries[site.id] || { hasPendingItems: false, totalPendingCount: 0 };
              const assignedEngs = engineers.filter(e => site.assignedEngineers && site.assignedEngineers.includes(e.id));
              const progressPct = Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || (isCompleted ? 100 : 0)));

              return (
                <div key={site.id} style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  border: isCompleted ? "1.5px solid #bbf7d0" : (summary.hasPendingItems ? "1.5px solid var(--accent-100, #ffedd5)" : "1px solid #cbd5e1"),
                  padding: "20px",
                  boxShadow: "0px 2px 6px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  justifyContent: "space-between",
                  gap: "14px"
                }}>
                  {/* Header: Title & Status */}
                  <div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                          {site.siteName}
                        </h3>
                        <p style={{ margin: "3px 0 0 0", fontSize: "12.5px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                          <MapPin size={13} style={{ color: "var(--accent-500, #f97316)" }} /> {site.location || "Location not set"}
                        </p>
                      </div>

                      {isCompleted ? (
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "10px",
                          backgroundColor: "#f0fdf4",
                          color: "#166534",
                          border: "1px solid #bbf7d0",
                          fontSize: "11.5px",
                          fontWeight: "800",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          whiteSpace: "nowrap"
                        }}>
                          <Lock size={12} /> COMPLETED / ARCHIVE
                        </span>
                      ) : (
                        <span style={{
                          padding: "4px 10px",
                          borderRadius: "10px",
                          backgroundColor: "var(--accent-50, #fff7ed)",
                          color: "var(--accent-600, #ea580c)",
                          border: "1px solid var(--accent-100, #ffedd5)",
                          fontSize: "11.5px",
                          fontWeight: "800",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "4px",
                          whiteSpace: "nowrap"
                        }}>
                          <Building2 size={12} /> {site.status || "In Progress"}
                        </span>
                      )}
                    </div>

                    {/* Client & Assigned Engineers */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "10px" }}>
                      <div>
                        <span style={{ color: "#94a3b8", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", display: "block" }}>Client</span>
                        <strong style={{ color: "#334155" }}>{site.clientName || "Internal"}</strong>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ color: "#94a3b8", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase", display: "block" }}>Engineers</span>
                        <strong style={{ color: "#334155" }}>
                          {assignedEngs.length > 0 ? assignedEngs.map(e => e.fullName).join(", ") : "Unassigned"}
                        </strong>
                      </div>
                    </div>

                    {/* Progress Bar */}
                    <div style={{ marginTop: "10px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", fontWeight: "700", marginBottom: "4px" }}>
                        <span style={{ color: "#64748b" }}>Project Progress</span>
                        <span style={{ color: isCompleted ? "#16a34a" : "var(--accent-500, #f97316)" }}>{progressPct}%</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "100px", overflow: "hidden" }}>
                        <div style={{
                          width: `${progressPct}%`,
                          height: "100%",
                          backgroundColor: isCompleted ? "#16a34a" : "var(--accent-500, #f97316)",
                          transition: "width 0.3s ease"
                        }} />
                      </div>
                    </div>

                    {/* Canonical Pending Breakdown Box */}
                    <div style={{
                      marginTop: "12px",
                      padding: "10px 12px",
                      borderRadius: "10px",
                      backgroundColor: summary.hasPendingItems ? "var(--accent-50, #fff7ed)" : "#f8fafc",
                      border: summary.hasPendingItems ? "1px solid var(--accent-100, #ffedd5)" : "1px solid #e2e8f0",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "800",
                          textTransform: "uppercase",
                          color: summary.hasPendingItems ? "var(--accent-600, #ea580c)" : "#64748b",
                          display: "flex",
                          alignItems: "center",
                          gap: "4px"
                        }}>
                          {summary.hasPendingItems ? <AlertTriangle size={13} /> : <CheckCircle2 size={13} style={{ color: "#166534" }} />}
                          {summary.hasPendingItems ? `${summary.totalPendingCount} Unresolved Items` : "All Items Resolved"}
                        </span>
                      </div>

                      {summary.hasPendingItems ? (
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "11px" }}>
                          {summary.pendingDeliveries.length > 0 && (
                            <span style={{ backgroundColor: "var(--accent-100, #ffedd5)", color: "var(--accent-700, #c2410c)", padding: "2px 8px", borderRadius: "6px", fontWeight: "700" }}>
                              📦 {summary.pendingDeliveries.length} Deliveries Pending
                            </span>
                          )}
                          {summary.pendingTransfers.length > 0 && (
                            <span style={{ backgroundColor: "var(--accent-100, #ffedd5)", color: "var(--accent-700, #c2410c)", padding: "2px 8px", borderRadius: "6px", fontWeight: "700" }}>
                              🚚 {summary.pendingTransfers.length} Transfers in Transit
                            </span>
                          )}
                          {summary.pendingExpenses.length > 0 && (
                            <span style={{ backgroundColor: "var(--accent-100, #ffedd5)", color: "var(--accent-700, #c2410c)", padding: "2px 8px", borderRadius: "6px", fontWeight: "700" }}>
                              🧾 {summary.pendingExpenses.length} Expenses Unapproved
                            </span>
                          )}
                          {summary.netPayableLabour > 0 && (
                            <span style={{ backgroundColor: "var(--accent-100, #ffedd5)", color: "var(--accent-700, #c2410c)", padding: "2px 8px", borderRadius: "6px", fontWeight: "700" }}>
                              💰 ₹{summary.netPayableLabour.toLocaleString("en-IN")} Labour Payable
                            </span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: "11px", color: "#15803d", fontWeight: "600" }}>
                          Materials received, transfers settled, payments cleared.
                        </span>
                      )}
                    </div>

                    {/* Completion Metadata for Completed Sites */}
                    {isCompleted && (
                      <div style={{
                        marginTop: "10px",
                        padding: "8px 10px",
                        borderRadius: "8px",
                        backgroundColor: "#f0fdf4",
                        border: "1px solid #dcfce7",
                        fontSize: "11.5px",
                        color: "#166534"
                      }}>
                        <div><strong>Archived Date:</strong> {site.completedAt?.seconds ? new Date(site.completedAt.seconds * 1000).toLocaleDateString("en-IN") : "Completed"}</div>
                        {site.completedByName && <div><strong>Closed By:</strong> {site.completedByName}</div>}
                        {site.completionNotes && <div style={{ fontStyle: "italic", marginTop: "2px" }}>"{site.completionNotes}"</div>}
                      </div>
                    )}
                  </div>

                  {/* Actions Footer */}
                  <div style={{ display: "flex", gap: "10px", marginTop: "10px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
                    <button
                      type="button"
                      onClick={() => setSelectedSiteIdForDetails(site.id)}
                      style={{
                        flex: 1,
                        padding: "10px 14px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        backgroundColor: "#ffffff",
                        color: "#334155",
                        fontSize: "13px",
                        fontWeight: "750",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "6px",
                        transition: "all 0.15s ease"
                      }}
                    >
                      <Eye size={14} />
                      <span>{isCompleted ? "Inspect Archive" : "Site Details"}</span>
                    </button>

                    {!isCompleted ? (
                      <button
                        type="button"
                        onClick={() => handleOpenCompletionModal(site)}
                        style={{
                          flex: 1,
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "none",
                          backgroundColor: "var(--accent-500, #f97316)",
                          color: "#ffffff",
                          fontSize: "13px",
                          fontWeight: "750",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "6px",
                          boxShadow: "0px 1px 3px rgba(249,115,22,0.25)",
                          transition: "all 0.15s ease"
                        }}
                      >
                        <CheckCircle2 size={14} />
                        <span>Mark Completed</span>
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setReopenModal({ isOpen: true, site, reopenNotes: "", isSubmitting: false })}
                        style={{
                          padding: "10px 14px",
                          borderRadius: "10px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#f8fafc",
                          color: "#475569",
                          fontSize: "13px",
                          fontWeight: "750",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: "6px"
                        }}
                      >
                        <Unlock size={14} />
                        <span>Reopen</span>
                      </button>
                    )}
                  </div>

                </div>
              );
            })}
          </div>
        )}

      </div>

      {/* ===================================================================
          COMPLETION AUDIT & DOUBLE CONFIRMATION MODAL
          =================================================================== */}
      {completionModal.isOpen && completionModal.site && (() => {
        const site = completionModal.site;
        const summary = siteSummaries[site.id] || { hasPendingItems: false };

        return (
          <Modal
            isOpen={true}
            onClose={handleCloseCompletionModal}
            title={
              completionModal.step === 1 
                ? `Completion Audit Review: ${site.siteName}` 
                : completionModal.step === 2 
                  ? "Confirmation 1 of 2: Mark Site as Completed" 
                  : "Confirmation 2 of 2: Read-Only Archive Lock"
            }
            maxWidth="600px"
          >
            <div style={{ display: "flex", flexDirection: "column", gap: "18px", padding: "6px 0" }}>
              
              {/* STEP 1: PENDING AUDIT REVIEW */}
              {completionModal.step === 1 && (
                <>
                  <div style={{
                    padding: "14px 16px",
                    borderRadius: "12px",
                    backgroundColor: summary.hasPendingItems ? "var(--accent-50, #fff7ed)" : "#f0fdf4",
                    border: summary.hasPendingItems ? "1.5px solid var(--accent-100, #ffedd5)" : "1.5px solid #bbf7d0"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                      {summary.hasPendingItems ? (
                        <AlertTriangle size={18} style={{ color: "var(--accent-500, #f97316)" }} />
                      ) : (
                        <CheckCircle2 size={18} style={{ color: "#16a34a" }} />
                      )}
                      <strong style={{ fontSize: "14px", color: summary.hasPendingItems ? "var(--accent-700, #c2410c)" : "#166534" }}>
                        {summary.hasPendingItems ? "Unresolved Pending Operational Items Found" : "Zero Blockers — Ready for Completion"}
                      </strong>
                    </div>
                    <p style={{ margin: 0, fontSize: "13px", color: summary.hasPendingItems ? "var(--accent-600, #ea580c)" : "#15803d", lineHeight: "1.4" }}>
                      {summary.hasPendingItems 
                        ? "The canonical database indicates the following items are currently pending for this site. Review them before proceeding." 
                        : "All materials are fully received, transfers settled, and labour payments reconciled in the canonical database."}
                    </p>
                  </div>

                  {/* Itemized breakdown */}
                  {summary.hasPendingItems && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#64748b" }}>
                        Itemized Unresolved Breakdown:
                      </span>

                      {summary.pendingDeliveries.length > 0 && (
                        <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <strong style={{ fontSize: "13px", color: "var(--accent-600, #ea580c)", display: "block" }}>
                            📦 Material Deliveries Pending ({summary.pendingDeliveries.length}):
                          </strong>
                          <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "#334155" }}>
                            {summary.pendingDeliveries.map(m => (
                              <li key={m.id}>
                                {m.materialName}: {m.pending} {m.unit} pending delivery ({m.received}/{m.required} received)
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.pendingTransfers.length > 0 && (
                        <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <strong style={{ fontSize: "13px", color: "#0284c7", display: "block" }}>
                            🚚 Material Transfers in Transit ({summary.pendingTransfers.length}):
                          </strong>
                          <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "#334155" }}>
                            {summary.pendingTransfers.map(t => (
                              <li key={t.id}>
                                {t.materialName}: {t.pendingQuantity || t.transferQuantity} {t.unit} ({t.status})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.pendingExpenses.length > 0 && (
                        <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <strong style={{ fontSize: "13px", color: "#ca8a04", display: "block" }}>
                            🧾 General Expenses Awaiting Approval ({summary.pendingExpenses.length}):
                          </strong>
                          <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "#334155" }}>
                            {summary.pendingExpenses.map(e => (
                              <li key={e.id}>
                                {e.category || "Expense"}: ₹{Number(e.amount || 0).toLocaleString("en-IN")} ({e.description || "Pending"})
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      {summary.netPayableLabour > 0 && (
                        <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                          <strong style={{ fontSize: "13px", color: "#16a34a", display: "block" }}>
                            💰 Labour Payout Net Payable:
                          </strong>
                          <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#334155" }}>
                            Gross wage: ₹{summary.grossLabour.toLocaleString("en-IN")} | Advances paid: ₹{summary.advances.toLocaleString("en-IN")} | <strong>Net Balance: ₹{summary.netPayableLabour.toLocaleString("en-IN")}</strong>
                          </p>
                        </div>
                      )}

                      {/* Acknowledgment Checkbox */}
                      <label style={{
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "10px",
                        padding: "12px 14px",
                        borderRadius: "10px",
                        backgroundColor: "var(--accent-50, #fff7ed)",
                        border: "1px solid var(--accent-100, #ffedd5)",
                        cursor: "pointer",
                        marginTop: "6px"
                      }}>
                        <input
                          type="checkbox"
                          checked={completionModal.acknowledgedPending}
                          onChange={(e) => setCompletionModal(prev => ({ ...prev, acknowledgedPending: e.target.checked }))}
                          style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "var(--accent-500, #f97316)" }}
                        />
                        <span style={{ fontSize: "12.5px", color: "var(--accent-700, #c2410c)", fontWeight: "700", lineHeight: "1.4" }}>
                          I have reviewed the unresolved items above and consciously confirm proceeding with site completion.
                        </span>
                      </label>
                    </div>
                  )}

                  {/* Next Step Action */}
                  <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={handleCloseCompletionModal}
                      className="btn btn-outline"
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      disabled={summary.hasPendingItems && !completionModal.acknowledgedPending}
                      onClick={() => setCompletionModal(prev => ({ ...prev, step: 2 }))}
                      style={{
                        padding: "10px 18px",
                        borderRadius: "10px",
                        backgroundColor: (summary.hasPendingItems && !completionModal.acknowledgedPending) ? "#cbd5e1" : "var(--accent-500, #f97316)",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "14px",
                        fontWeight: "750",
                        cursor: (summary.hasPendingItems && !completionModal.acknowledgedPending) ? "not-allowed" : "pointer"
                      }}
                    >
                      Proceed to Confirmation →
                    </button>
                  </div>
                </>
              )}

              {/* STEP 2: CONFIRMATION 1 */}
              {completionModal.step === 2 && (
                <>
                  <div style={{
                    textAlign: "center",
                    padding: "24px 16px",
                    backgroundColor: "#f8fafc",
                    borderRadius: "14px",
                    border: "1px solid #e2e8f0"
                  }}>
                    <AlertCircle size={40} style={{ color: "var(--accent-500, #f97316)", margin: "0 auto 12px auto" }} />
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                      Are you sure you want to mark this site as completed?
                    </h3>
                    <p style={{ margin: 0, fontSize: "13.5px", color: "#64748b", lineHeight: "1.4" }}>
                      Site: <strong>{site.siteName}</strong> ({site.location})
                    </p>
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setCompletionModal(prev => ({ ...prev, step: 1 }))}
                      className="btn btn-outline"
                    >
                      ← Back to Review
                    </button>
                    <button
                      type="button"
                      onClick={() => setCompletionModal(prev => ({ ...prev, step: 3 }))}
                      style={{
                        padding: "10px 20px",
                        borderRadius: "10px",
                        backgroundColor: "var(--accent-500, #f97316)",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "14px",
                        fontWeight: "750",
                        cursor: "pointer"
                      }}
                    >
                      Yes, Continue →
                    </button>
                  </div>
                </>
              )}

              {/* STEP 3: CONFIRMATION 2 */}
              {completionModal.step === 3 && (
                <>
                  <div style={{
                    textAlign: "center",
                    padding: "24px 16px",
                    backgroundColor: "#f0fdf4",
                    borderRadius: "14px",
                    border: "1.5px solid #bbf7d0"
                  }}>
                    <Lock size={40} style={{ color: "#166534", margin: "0 auto 12px auto" }} />
                    <h3 style={{ margin: "0 0 8px 0", fontSize: "17px", fontWeight: "800", color: "#14532d" }}>
                      This will make the site's records read-only. Continue?
                    </h3>
                    <p style={{ margin: 0, fontSize: "13px", color: "#15803d", lineHeight: "1.4" }}>
                      All existing material logs, worker attendance, transfers, and DPRs will remain preserved in the database for historical reporting, but editing and new log entries will be locked.
                    </p>
                  </div>

                  <div>
                    <label style={{ fontSize: "12px", fontWeight: "750", color: "#475569", display: "block", marginBottom: "4px" }}>
                      Completion Notes / Handover Remarks (Optional)
                    </label>
                    <textarea
                      placeholder="e.g. Handed over to client on schedule with snag list cleared..."
                      value={completionModal.completionNotes}
                      onChange={(e) => setCompletionModal(prev => ({ ...prev, completionNotes: e.target.value }))}
                      rows={3}
                      style={{
                        width: "100%",
                        padding: "10px 12px",
                        borderRadius: "10px",
                        border: "1px solid #cbd5e1",
                        fontSize: "13px",
                        outline: "none",
                        boxSizing: "border-box"
                      }}
                    />
                  </div>

                  <div style={{ display: "flex", justifyContent: "space-between", gap: "10px", marginTop: "10px" }}>
                    <button
                      type="button"
                      onClick={() => setCompletionModal(prev => ({ ...prev, step: 2 }))}
                      className="btn btn-outline"
                      disabled={completionModal.isSubmitting}
                    >
                      ← Back
                    </button>
                    <button
                      type="button"
                      onClick={handleConfirmCompletion}
                      disabled={completionModal.isSubmitting}
                      style={{
                        padding: "12px 24px",
                        borderRadius: "10px",
                        backgroundColor: "#166534",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "14px",
                        fontWeight: "800",
                        cursor: completionModal.isSubmitting ? "not-allowed" : "pointer",
                        boxShadow: "0px 2px 6px rgba(22,101,52,0.25)"
                      }}
                    >
                      {completionModal.isSubmitting ? "Completing Site..." : "Confirm & Mark as Completed"}
                    </button>
                  </div>
                </>
              )}

            </div>
          </Modal>
        );
      })()}

      {/* ===================================================================
          REOPEN SITE CONFIRMATION MODAL
          =================================================================== */}
      {reopenModal.isOpen && reopenModal.site && (
        <ConfirmationModal
          isOpen={true}
          title={`Reopen Site: ${reopenModal.site.siteName}?`}
          message="Reopening will set the site back to 'In Progress' status and allow engineers and administrators to log new attendance, material, and progress records."
          confirmText={reopenModal.isSubmitting ? "Reopening..." : "Reopen Site"}
          variant="primary"
          isLoading={reopenModal.isSubmitting}
          onConfirm={handleConfirmReopen}
          onClose={() => setReopenModal({ isOpen: false, site: null, reopenNotes: "", isSubmitting: false })}
        />
      )}

    </Layout>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import { 
  resolveApprovalRequest,
  syncApprovalsFromLegacy,
  getSites
} from "../services/firebaseService";
import { 
  onSnapshot,
  collection,
  query,
  where
} from "firebase/firestore";
import { getFirebaseDb } from "../firebase/config";
import { useAuth } from "../context/AuthContext";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { 
  Check, 
  X, 
  Filter, 
  Calendar, 
  User, 
  Package, 
  MapPin, 
  Layers, 
  AlertCircle, 
  CreditCard,
  Users,
  Search,
  CheckCircle2,
  Clock,
  XCircle,
  RotateCcw,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown
} from "lucide-react";

export default function ApprovalsDashboard() {
  const { userProfile } = useAuth();

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

  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Data States
  const [engineers, setEngineers] = useState([]);
  const [sites, setSites] = useState([]);
  const [allRequests, setAllRequests] = useState([]);
  
  // Filter States
  const [searchQuery, setSearchQuery] = useState("");
  const [filterType, setFilterType] = useState("all"); // "all", "Leave", "Location", "Payment", "Labour"
  const [filterStatus, setFilterStatus] = useState("pending"); // "all", "pending", "approved", "rejected"
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [filterEngineer, setFilterEngineer] = useState("");
  const [filterSiteId, setFilterSiteId] = useState("");
  const [sortBy, setSortBy] = useState("date-desc");

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  useEffect(() => {
    const db = getFirebaseDb();
    setLoading(true);

    // Fetch sites for site-based filter
    getSites(null).then(s => setSites(s)).catch(err => console.warn("Failed loading sites for approvals:", err));

    const runLegacySync = async () => {
      try {
        await syncApprovalsFromLegacy();
      } catch (e) {
        console.warn("Legacy sync warning:", e);
      }
    };
    runLegacySync();

    let engineersLoaded = false;
    let approvalsLoaded = false;

    const checkLoadingComplete = () => {
      if (engineersLoaded && approvalsLoaded) {
        setLoading(false);
      }
    };

    let unsubLegacyEngineers = null;
    const unsubEngineers = onSnapshot(collection(db, "siteEngineers"), (snapshot) => {
      if (snapshot.empty) {
        if (unsubLegacyEngineers) unsubLegacyEngineers();
        const qLegacy = query(collection(db, "users"), where("role", "==", "site_engineer"));
        unsubLegacyEngineers = onSnapshot(qLegacy, (legacySnap) => {
          const list = [];
          legacySnap.forEach(docSnap => {
            const data = docSnap.data();
            list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
          });
          setEngineers(list);
          engineersLoaded = true;
          checkLoadingComplete();
        }, (err) => {
          console.error("Legacy engineers listener error:", err);
          engineersLoaded = true;
          checkLoadingComplete();
        });
      } else {
        if (unsubLegacyEngineers) {
          unsubLegacyEngineers();
          unsubLegacyEngineers = null;
        }
        const list = [];
        snapshot.forEach(docSnap => {
          const data = docSnap.data();
          list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
        });
        setEngineers(list);
        engineersLoaded = true;
        checkLoadingComplete();
      }
    }, (err) => {
      console.warn("siteEngineers listener error, falling back to legacy users:", err);
      if (unsubLegacyEngineers) unsubLegacyEngineers();
      const qLegacy = query(collection(db, "users"), where("role", "==", "site_engineer"));
      unsubLegacyEngineers = onSnapshot(qLegacy, (legacySnap) => {
        const list = [];
        legacySnap.forEach(docSnap => {
          const data = docSnap.data();
          list.push({ id: docSnap.id, uid: docSnap.id, fullName: data.name || data.fullName || "", ...data });
        });
        setEngineers(list);
        engineersLoaded = true;
        checkLoadingComplete();
      }, (e) => {
        console.error("Fallback engineers listener error:", e);
        engineersLoaded = true;
        checkLoadingComplete();
      });
    });

    const unsubApprovals = onSnapshot(collection(db, "approvals"), (snapshot) => {
      const list = [];
      snapshot.forEach(docSnap => {
        list.push({ id: docSnap.id, ...docSnap.data() });
      });
      list.sort((a, b) => {
        const tA = a.createdAt?.seconds || (a.createdAt ? new Date(a.createdAt).getTime() : 0);
        const tB = b.createdAt?.seconds || (b.createdAt ? new Date(b.createdAt).getTime() : 0);
        return tB - tA;
      });
      setAllRequests(list);
      approvalsLoaded = true;
      checkLoadingComplete();
    }, (err) => {
      console.error("Approvals listener error:", err);
      approvalsLoaded = true;
      checkLoadingComplete();
    });

    return () => {
      unsubEngineers();
      if (unsubLegacyEngineers) unsubLegacyEngineers();
      unsubApprovals();
    };
  }, [userProfile]);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterType, filterStatus, fromDate, toDate, filterEngineer, filterSiteId, sortBy]);

  // Summary Indicators Metrics
  const pendingCount = useMemo(() => allRequests.filter(r => r.type !== "Material" && ((r.status || "").toLowerCase() === "pending")).length, [allRequests]);
  const approvedCount = useMemo(() => allRequests.filter(r => r.type !== "Material" && ((r.status || "").toLowerCase() === "approved")).length, [allRequests]);
  const rejectedCount = useMemo(() => allRequests.filter(r => r.type !== "Material" && ((r.status || "").toLowerCase() === "rejected")).length, [allRequests]);
  const totalCount = useMemo(() => allRequests.filter(r => r.type !== "Material").length, [allRequests]);

  // Apply filters
  const filteredRequests = useMemo(() => {
    return allRequests.filter(r => {
      if (r.type === "Material") return false;

      const rStatus = (r.status || "").toLowerCase();
      const fStatus = filterStatus.toLowerCase();
      
      if (filterType !== "all" && r.type !== filterType) return false;
      if (filterStatus !== "all" && rStatus !== fStatus) return false;
      if (fromDate && r.requestDate && r.requestDate < fromDate) return false;
      if (toDate && r.requestDate && r.requestDate > toDate) return false;
      if (filterEngineer && r.engineerId !== filterEngineer) return false;
      if (filterSiteId && r.siteId !== filterSiteId) return false;

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = (r.requestedBy || "").toLowerCase().includes(q);
        const matchDesc = (r.details || "").toLowerCase().includes(q);
        const matchSite = (r.siteName || "").toLowerCase().includes(q);
        const matchType = (r.type || "").toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchSite && !matchType) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "date-desc") {
        return (b.requestDate || "").localeCompare(a.requestDate || "");
      }
      if (sortBy === "date-asc") {
        return (a.requestDate || "").localeCompare(b.requestDate || "");
      }
      return 0;
    });
  }, [allRequests, filterType, filterStatus, fromDate, toDate, filterEngineer, filterSiteId, searchQuery, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredRequests.length / pageSize) || 1;
  const paginatedRequests = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRequests.slice(start, start + pageSize);
  }, [filteredRequests, currentPage, pageSize]);

  const handleResetFilters = () => {
    setSearchQuery("");
    setFilterType("all");
    setFilterStatus("pending");
    setFromDate("");
    setToDate("");
    setFilterEngineer("");
    setFilterSiteId("");
    setSortBy("date-desc");
  };

  // Approval Handlers
  const handleApprove = async (req) => {
    showConfirmModal({
      title: `Approve ${req.type} Request?`,
      message: `Are you sure you want to approve this ${req.type} request from ${req.requestedBy || 'engineer'}?`,
      details: req.details ? `Details: ${req.details}` : null,
      confirmText: "Approve Request",
      variant: "success",
      onConfirm: async () => {
        setLoading(true);
        try {
          await resolveApprovalRequest(req.id, "Approved", userProfile?.id || "admin", userProfile?.fullName || "Admin User");
          showToast(`${req.type} request approved successfully.`, "success");
        } catch (err) {
          console.error("Approve failed:", err);
          showToast(`Approval failed: ${err.message}`, "error");
        } finally {
          setLoading(false);
          closeConfirmModal();
        }
      }
    });
  };

  const handleReject = async (req) => {
    showConfirmModal({
      title: `Reject ${req.type} Request?`,
      message: `Are you sure you want to reject this ${req.type} request from ${req.requestedBy || 'engineer'}?`,
      details: req.details ? `Details: ${req.details}` : null,
      confirmText: "Reject Request",
      variant: "danger",
      onConfirm: async () => {
        setLoading(true);
        try {
          await resolveApprovalRequest(req.id, "Rejected", userProfile?.id || "admin", userProfile?.fullName || "Admin User");
          showToast(`${req.type} request rejected.`, "info");
        } catch (err) {
          console.error("Reject failed:", err);
          showToast(`Rejection failed: ${err.message}`, "error");
        } finally {
          setLoading(false);
          closeConfirmModal();
        }
      }
    });
  };

  const hasActiveFilters = searchQuery || filterType !== "all" || filterStatus !== "pending" || fromDate || toDate || filterEngineer || filterSiteId;

  return (
    <Layout
      title="Approval Center"
      description="Review, authorize, and audit field requisitions, leave requests, location boundary setups, and wage payments."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── 1. CLEAN HEADER SECTION ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "20px 24px",
        marginBottom: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>Approval Center</h2>
              {pendingCount > 0 && (
                <span style={{ backgroundColor: "#fff7ed", color: "#ea580c", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "12px", border: "1px solid #ffedd5" }}>
                  {pendingCount} Pending Action
                </span>
              )}
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Review, authorize, and audit field requisitions, leave requests, location boundary setups, and wage payments.
            </p>
          </div>

          <Button onClick={() => window.print()} variant="outline" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <span>Print Audit Log</span>
          </Button>
        </div>
      </div>

      {/* ── 2. PENDING SUMMARY INDICATOR CARDS (4 COMPACT KPI CARDS) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
        
        {/* KPI 1: Pending Approvals */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Pending Approvals</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{pendingCount}</div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Requires admin action</span>
        </div>

        {/* KPI 2: Approved Requests */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Approved Requests</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{approvedCount}</div>
          <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px", display: "block", fontWeight: "600" }}>Authorized &amp; resolved</span>
        </div>

        {/* KPI 3: Rejected Requests */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Rejected Requests</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fef2f2", color: "#dc2626", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <XCircle size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{rejectedCount}</div>
          <span style={{ fontSize: "11px", color: "#dc2626", marginTop: "4px", display: "block", fontWeight: "600" }}>Declined by admin</span>
        </div>

        {/* KPI 4: Total Queue */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Queue</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{totalCount}</div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Total processed history</span>
        </div>

      </div>

      {/* ── 3. ADVANCED SEARCH & FILTER PANEL ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "16px 20px",
        marginBottom: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "14px", borderBottom: "1px solid #f1f5f9", paddingBottom: "10px" }}>
          <Filter size={15} style={{ color: "#ea580c" }} />
          <strong style={{ fontSize: "13px", color: "#0f172a" }}>Advanced Approvals Queue Filter Panel</strong>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px" }}>
          
          {/* Search Field */}
          <div>
            <label htmlFor="app-search" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Search Requisition</label>
            <div style={{ position: "relative" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                id="app-search"
                type="text"
                placeholder="Search employee, details..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", outline: "none" }}
              />
            </div>
          </div>

          {/* Approval Type */}
          <div>
            <label htmlFor="app-type" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Approval Type</label>
            <select 
              id="app-type"
              value={filterType} 
              onChange={(e) => setFilterType(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "12.5px", outline: "none", fontWeight: "600" }}
            >
              <option value="all">All Request Types</option>
              <option value="Leave">Leaves</option>
              <option value="Location">Locations</option>
              <option value="Payment">Payments &amp; Expenses</option>
            </select>
          </div>

          {/* Status Filter */}
          <div>
            <label htmlFor="app-status" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Status</label>
            <select 
              id="app-status"
              value={filterStatus} 
              onChange={(e) => setFilterStatus(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "12.5px", outline: "none", fontWeight: "600" }}
            >
              <option value="all">All Statuses</option>
              <option value="pending">Pending Review</option>
              <option value="approved">Approved</option>
              <option value="rejected">Rejected</option>
            </select>
          </div>

          {/* Site Filter */}
          <div>
            <label htmlFor="app-site" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Construction Site</label>
            <select 
              id="app-site"
              value={filterSiteId} 
              onChange={(e) => setFilterSiteId(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "12.5px", outline: "none", fontWeight: "600" }}
            >
              <option value="">All Construction Sites</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.siteName}</option>
              ))}
            </select>
          </div>

          {/* Engineer Filter */}
          <div>
            <label htmlFor="app-eng" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Site Engineer</label>
            <select 
              id="app-eng"
              value={filterEngineer} 
              onChange={(e) => setFilterEngineer(e.target.value)}
              style={{ width: "100%", padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "12.5px", outline: "none", fontWeight: "600" }}
            >
              <option value="">All Engineers</option>
              {engineers.map(e => (
                <option key={e.id} value={e.id}>{e.fullName}</option>
              ))}
            </select>
          </div>

          {/* From Date */}
          <div>
            <label htmlFor="app-from-date" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>From Date</label>
            <input 
              id="app-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none" }}
            />
          </div>

          {/* To Date */}
          <div>
            <label htmlFor="app-to-date" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>To Date</label>
            <input 
              id="app-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{ width: "100%", padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", outline: "none" }}
            />
          </div>

        </div>

        {hasActiveFilters && (
          <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", paddingTop: "10px", borderTop: "1px solid #f1f5f9" }}>
            <button
              type="button"
              onClick={handleResetFilters}
              style={{
                background: "transparent",
                border: "none",
                color: "#ea580c",
                fontSize: "12px",
                fontWeight: "700",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "4px"
              }}
            >
              <RotateCcw size={13} />
              <span>Reset Filters</span>
            </button>
          </div>
        )}
      </div>

      {/* ── 4. ENTERPRISE TABLE LAYOUT ── */}
      <Card noPadding style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        
        {/* Table Header Controls */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "#f8fafc" }}>
          <span style={{ fontWeight: "700", color: "#0f172a", fontSize: "13.5px" }}>
            Requisitions Queue ({filteredRequests.length} matching)
          </span>
          
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <ArrowUpDown size={14} style={{ color: "#64748b" }} />
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Sort:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", fontWeight: "600", color: "#0f172a", outline: "none" }}
              >
                <option value="date-desc">Requested Date (Newest)</option>
                <option value="date-asc">Requested Date (Oldest)</option>
              </select>
            </div>
            
            <Badge status={filterStatus === "pending" ? "pending" : "success"}>
              Filter: {filterStatus.toUpperCase()}
            </Badge>
          </div>
        </div>

        {/* Table Rendering */}
        {filteredRequests.length === 0 ? (
          <div style={{ textAlign: "center", padding: "48px 24px", color: "#64748b" }}>
            <AlertCircle size={36} style={{ color: "#94a3b8", marginBottom: "10px" }} />
            <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: "#1e293b" }}>No Approval Requests Found</h4>
            <p style={{ margin: 0, fontSize: "13px" }}>No requisition entries match the active filter criteria.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Type</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Employee</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Details / Specification</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Site / Location</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Requested Date</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedRequests.map((req, index) => {
                    const isPending = (req.status || "").toLowerCase() === "pending";
                    const isEven = index % 2 === 0;
                    
                    return (
                      <tr 
                        key={`${req.type}-${req.id}-${index}`}
                        style={{ 
                          backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                          borderBottom: "1px solid #f1f5f9"
                        }}
                      >
                        {/* Type */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                            {req.type === "Leave" && <Layers size={14} style={{ color: "#d97706" }} />}
                            {req.type === "Location" && <MapPin size={14} style={{ color: "#0284c7" }} />}
                            {req.type === "Payment" && <CreditCard size={14} style={{ color: "#16a34a" }} />}
                            {req.type === "Labour" && <Users size={14} style={{ color: "#dc2626" }} />}
                            <span style={{ fontWeight: "700", fontSize: "13px", color: "#0f172a" }}>{req.type}</span>
                          </div>
                        </td>

                        {/* Employee */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div style={{
                              width: "28px",
                              height: "28px",
                              borderRadius: "50%",
                              backgroundColor: "#fff7ed",
                              color: "#ea580c",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "700",
                              fontSize: "11px"
                            }}>
                              {(req.requestedBy || "SE").split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase()}
                            </div>
                            <span style={{ fontSize: "13px", color: "#0f172a", fontWeight: "600" }}>{req.requestedBy}</span>
                          </div>
                        </td>

                        {/* Details */}
                        <td style={{ padding: "12px 16px", maxWidth: "350px" }}>
                          <div style={{ fontSize: "12.5px", color: "#334155", fontWeight: "600", lineHeight: "1.4" }}>
                            {req.details}
                          </div>
                        </td>

                        {/* Site */}
                        <td style={{ padding: "12px 16px" }}>
                          <strong style={{ fontSize: "12.5px", color: req.siteName === "N/A" ? "#94a3b8" : "#0f172a" }}>
                            {req.siteName}
                          </strong>
                        </td>

                        {/* Date */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontFamily: "monospace", fontSize: "12px", color: "#475569" }}>
                            <Calendar size={13} style={{ color: "#94a3b8" }} />
                            <span>{req.requestDate}</span>
                          </div>
                        </td>

                        {/* Status Badge */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <Badge status={req.status}>
                            {req.status === "pending" || req.status === "Pending" ? "Pending Review" : req.status}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          {isPending ? (
                            <div style={{ display: "flex", justifyContent: "center", gap: "8px" }}>
                              <button 
                                type="button"
                                onClick={() => handleApprove(req)}
                                style={{ 
                                  border: "none",
                                  background: "transparent", 
                                  color: "#16a34a",
                                  padding: "4px 8px",
                                  fontSize: "12.5px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  transition: "transform 0.15s ease, color 0.15s ease",
                                  outline: "none"
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.color = "#15803d";
                                  e.currentTarget.style.transform = "scale(1.08)";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.color = "#16a34a";
                                  e.currentTarget.style.transform = "scale(1)";
                                }}
                                title="Approve Request"
                              >
                                <Check size={14} /> Approve
                              </button>
                              <button 
                                type="button"
                                onClick={() => handleReject(req)}
                                style={{ 
                                  border: "none", 
                                  background: "transparent",
                                  color: "#dc2626", 
                                  padding: "4px 8px",
                                  fontSize: "12.5px",
                                  fontWeight: "700",
                                  cursor: "pointer",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  transition: "transform 0.15s ease, color 0.15s ease",
                                  outline: "none"
                                }}
                                onMouseEnter={e => {
                                  e.currentTarget.style.color = "#b91c1c";
                                  e.currentTarget.style.transform = "scale(1.08)";
                                }}
                                onMouseLeave={e => {
                                  e.currentTarget.style.color = "#dc2626";
                                  e.currentTarget.style.transform = "scale(1)";
                                }}
                                title="Reject Request"
                              >
                                <X size={14} /> Reject
                              </button>
                            </div>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                              Audited
                            </span>
                          )}
                        </td>
                        
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls Footer */}
            <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "#f8fafc" }}>
              <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "500" }}>
                Showing {filteredRequests.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredRequests.length)} of {filteredRequests.length} requisitions
              </span>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <button
                  type="button"
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: currentPage === 1 ? "#f1f5f9" : "#ffffff",
                    color: currentPage === 1 ? "#94a3b8" : "#334155",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: currentPage === 1 ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <ChevronLeft size={14} />
                  <span>Previous</span>
                </button>

                <span style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a", padding: "0 8px" }}>
                  Page {currentPage} of {totalPages}
                </span>

                <button
                  type="button"
                  disabled={currentPage >= totalPages}
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: currentPage >= totalPages ? "#f1f5f9" : "#ffffff",
                    color: currentPage >= totalPages ? "#94a3b8" : "#334155",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <span>Next</span>
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>
          </>
        )}

      </Card>

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />

      <Loading show={loading} text="Updating approval state..." />
    </Layout>
  );
}

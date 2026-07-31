import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getMaterialsDetailed,
  getLabourDailyCountsSummary,
  getLabourPayments,
  getLabourMaster,
  getGeneralExpenses,
  saveGeneralExpense,
  approveGeneralExpense,
  logGeneralExpensePayment,
  saveLabourPayment,
  logMaterialPayment
} from "../services/firebaseService";
import {
  getSiteExpenseLedger
} from "../services/businessLogic";
import {
  DollarSign,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  Clock,
  Printer,
  Plus,
  X,
  CreditCard,
  Layers,
  Users,
  MapPin,
  Clipboard,
  Calendar,
  Check,
  Package,
  FileText,
  Search,
  Filter,
  Eye,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Truck,
  Building2
} from "lucide-react";

export default function AdminPayments() {
  const { userProfile } = useAuth();
  const [activeTab, setActiveTab] = useState("overview"); // overview, pending, payments, reports
  const [loading, setLoading] = useState(true);
  
  // Datasets
  const [sites, setSites] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState("");
  const [materials, setMaterials] = useState([]);
  const [labourHistory, setLabourHistory] = useState([]);
  const [labourPayments, setLabourPayments] = useState([]);
  const [labourMaster, setLabourMaster] = useState({});
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // Filter, Search, Date Range & Pagination States
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All"); // All, Labour, Material, Transport, Other
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [sortBy, setSortBy] = useState("date-desc"); // date-desc, date-asc, amount-desc, amount-asc
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Modals state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "Site Expense", amount: "", date: new Date().toISOString().split("T")[0], description: "", notes: "" });
  const [selectedExpenseDetail, setSelectedExpenseDetail] = useState(null);

  // Payout state
  const [payoutType, setPayoutType] = useState("material");
  const [selectedMaterialId, setSelectedMaterialId] = useState("");
  const [selectedGeneralExpenseId, setSelectedGeneralExpenseId] = useState("");
  const [payoutAmount, setPayoutAmount] = useState("");
  const [payoutDate, setPayoutDate] = useState(new Date().toISOString().split("T")[0]);
  const [payoutRef, setPayoutRef] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const loadData = async () => {
    try {
      setLoading(true);
      const adminId = userProfile?.uid || userProfile?.id || null;
      const [fetchedSites, fetchedLabourPayments, fetchedLabourMaster, fetchedGeneralExpenses, fetchedAllMaterials] = await Promise.all([
        getSites(adminId),
        getLabourPayments(adminId),
        getLabourMaster(adminId),
        getGeneralExpenses(),
        getMaterialsDetailed(null)
      ]);

      setSites(fetchedSites);
      setLabourPayments(fetchedLabourPayments);
      setLabourMaster(fetchedLabourMaster);
      setGeneralExpenses(fetchedGeneralExpenses);
      setMaterials(fetchedAllMaterials);

      if (fetchedSites.length > 0) {
        setSelectedSiteId(fetchedSites[0].id);
        const lh = await getLabourDailyCountsSummary(fetchedSites[0].id);
        setLabourHistory(lh);
      }
    } catch (err) {
      console.error("Failed to load payments ledger data:", err);
      showToast(`Database read error: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    const reloadSiteData = async () => {
      if (!selectedSiteId || selectedSiteId === "all") return;
      try {
        const lh = await getLabourDailyCountsSummary(selectedSiteId);
        setLabourHistory(lh);
      } catch (err) {
        console.error("Failed to reload site details:", err);
      }
    };
    reloadSiteData();
  }, [selectedSiteId]);

  // Reset pagination on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, categoryFilter, fromDate, toDate, sortBy, selectedSiteId]);

  const handleAddExpense = async (e) => {
    e.preventDefault();
    if (!newExpense.amount || !newExpense.description.trim()) return;
    try {
      await saveGeneralExpense({
        siteId: selectedSiteId,
        category: newExpense.category,
        amount: Number(newExpense.amount),
        date: newExpense.date,
        description: newExpense.description.trim(),
        notes: newExpense.notes.trim(),
        createdBy: "Admin",
        status: "Approved"
      });
      showToast("Site expense logged successfully!", "success");
      setShowAddExpenseModal(false);
      setNewExpense({ category: "Site Expense", amount: "", date: new Date().toISOString().split("T")[0], description: "", notes: "" });
      await loadData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handleApproveExpense = async (expenseId) => {
    try {
      await approveGeneralExpense(expenseId);
      showToast("General expense requisition approved!", "success");
      await loadData();
    } catch (err) {
      showToast(`Failed: ${err.message}`, "error");
    }
  };

  const handlePayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutAmount || Number(payoutAmount) <= 0) return;
    
    try {
      const amt = Number(payoutAmount);
      if (payoutType === "material") {
        if (!selectedMaterialId) {
          showToast("Please select a pending material invoice", "error");
          return;
        }
        await logMaterialPayment(selectedMaterialId, {
          amount: amt,
          date: payoutDate,
          reference: payoutRef,
          notes: payoutNotes
        });
      } else if (payoutType === "labour") {
        await saveLabourPayment({
          siteId: selectedSiteId,
          amount: amt,
          date: payoutDate,
          reference: payoutRef,
          notes: payoutNotes,
          loggedBy: "admin"
        }, userProfile?.uid || userProfile?.id || null);
      } else {
        if (!selectedGeneralExpenseId) {
          showToast("Please select an approved site expense invoice", "error");
          return;
        }
        await logGeneralExpensePayment(selectedGeneralExpenseId, {
          amount: amt,
          date: payoutDate,
          reference: payoutRef,
          notes: payoutNotes
        });
      }

      showToast("Payment transaction logged successfully!", "success");
      setPayoutAmount("");
      setPayoutRef("");
      setPayoutNotes("");
      await loadData();
    } catch (err) {
      showToast(`Payment failed: ${err.message}`, "error");
    }
  };

  const activeSite = sites.find(s => s.id === selectedSiteId);
  const ledger = activeSite ? getSiteExpenseLedger(activeSite, materials, labourHistory, generalExpenses, labourPayments, labourMaster.categories) : null;
  const pendingGeneralExpenseRequests = generalExpenses.filter(g => g.status === "Pending" || g.status === "pending");

  // Compile full expense list for table
  const allSiteExpenses = useMemo(() => {
    if (!ledger || !ledger.expensesList) return [];
    
    return ledger.expensesList.map(item => {
      let normCategory = "Other";
      const catLower = (item.category || "").toLowerCase();
      if (catLower.includes("labour")) normCategory = "Labour";
      else if (catLower.includes("material")) normCategory = "Material";
      else if (catLower.includes("transport") || catLower.includes("fuel") || catLower.includes("vehicle")) normCategory = "Transport";
      else if (catLower.includes("site") || catLower.includes("general")) normCategory = "Other";

      return {
        id: item.id || Math.random().toString(),
        date: item.date || "--",
        category: item.category || "Site Expense",
        normCategory: normCategory,
        name: item.name || "Expense Entry",
        description: item.description || "--",
        amount: item.amount || 0,
        addedBy: item.createdBy || item.loggedBy || "Site Admin",
        status: item.status || "Approved",
        rawItem: item
      };
    });
  }, [ledger]);

  // Filtered & sorted expense rows
  const filteredExpenses = useMemo(() => {
    return allSiteExpenses.filter(item => {
      // Category filter
      if (categoryFilter !== "All") {
        if (categoryFilter === "Labour" && item.normCategory !== "Labour") return false;
        if (categoryFilter === "Material" && item.normCategory !== "Material") return false;
        if (categoryFilter === "Transport" && item.normCategory !== "Transport") return false;
        if (categoryFilter === "Other" && (item.normCategory === "Labour" || item.normCategory === "Material" || item.normCategory === "Transport")) return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = item.name.toLowerCase().includes(q);
        const matchDesc = item.description.toLowerCase().includes(q);
        const matchCat = item.category.toLowerCase().includes(q);
        const matchAddedBy = item.addedBy.toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchCat && !matchAddedBy) return false;
      }

      // Date Range Filter
      if (fromDate && item.date !== "--" && item.date < fromDate) return false;
      if (toDate && item.date !== "--" && item.date > toDate) return false;

      return true;
    }).sort((a, b) => {
      if (sortBy === "date-desc") return (b.date || "").localeCompare(a.date || "");
      if (sortBy === "date-asc") return (a.date || "").localeCompare(b.date || "");
      if (sortBy === "amount-desc") return b.amount - a.amount;
      if (sortBy === "amount-asc") return a.amount - b.amount;
      return 0;
    });
  }, [allSiteExpenses, categoryFilter, searchQuery, fromDate, toDate, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredExpenses.length / pageSize) || 1;
  const paginatedExpenses = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredExpenses.slice(start, start + pageSize);
  }, [filteredExpenses, currentPage, pageSize]);

  // Compact 4 KPI Card Metrics
  const totalExpenseVal = ledger?.totalExpenses || 0;
  const labourExpenseVal = ledger?.labourExpenseTotal || 0;
  const materialExpenseVal = ledger?.materialExpenseTotal || 0;
  const otherExpenseVal = (ledger?.siteExpenseTotal || 0) + (ledger?.otherExpenseTotal || 0);

  return (
    <Layout 
      title="Site Expense Management" 
      description="Enterprise site-wise cost accounting, expenditure tracking, and payout auditing console."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── 1. PAGE HEADER (SITE METADATA, FILTERS & ACTION) ── */}
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
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>Site Expense Management</h2>
              {activeSite && (
                <span style={{ backgroundColor: "#fff7ed", color: "#c2410c", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "12px", border: "1px solid #ffedd5" }}>
                  {activeSite.siteName}
                </span>
              )}
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              {activeSite ? `Client: ${activeSite.clientName || "Direct Site"} • Location: ${activeSite.location || "On-site"}` : "Select a site to view expense ledger"}
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
            <Button onClick={() => setShowAddExpenseModal(true)} variant="primary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Plus size={16} />
              <span>Log Expense</span>
            </Button>
            <Button onClick={() => window.print()} variant="outline" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <Printer size={16} />
              <span>Print Statement</span>
            </Button>
          </div>
        </div>

        {/* Header Controls Bar (Site Selector, Date Range, Search) */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "14px", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
          
          {/* Site Selector */}
          <div>
            <label htmlFor="exp-site-select" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Construction Site</label>
            <div style={{ position: "relative" }}>
              <MapPin size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <select
                id="exp-site-select"
                value={selectedSiteId}
                onChange={(e) => setSelectedSiteId(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "600",
                  color: "#0f172a",
                  outline: "none"
                }}
              >
                {sites.map(site => (
                  <option key={site.id} value={site.id}>{site.siteName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* From Date */}
          <div>
            <label htmlFor="exp-from-date" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>From Date</label>
            <input
              id="exp-from-date"
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                fontWeight: "500",
                color: "#0f172a",
                outline: "none"
              }}
            />
          </div>

          {/* To Date */}
          <div>
            <label htmlFor="exp-to-date" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>To Date</label>
            <input
              id="exp-to-date"
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              style={{
                width: "100%",
                padding: "9px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                fontWeight: "500",
                color: "#0f172a",
                outline: "none"
              }}
            />
          </div>

          {/* Search Bar */}
          <div>
            <label htmlFor="exp-search-input" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Search Expense</label>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                id="exp-search-input"
                type="text"
                placeholder="Search description, category..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{
                  width: "100%",
                  padding: "9px 12px 9px 36px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "13px",
                  fontWeight: "500",
                  color: "#0f172a",
                  outline: "none"
                }}
              />
            </div>
          </div>

        </div>
      </div>

      {/* ── 2. COMPACT SUMMARY KPI CARDS (EXACTLY 4 COMPACT CARDS) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
        
        {/* Card 1: Total Expense */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Expense</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(totalExpenseVal)}</div>
          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>All site expenses combined</span>
        </div>

        {/* Card 2: Labour Expense */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Labour Expense</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(labourExpenseVal)}</div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Daily wages &amp; attendance</span>
        </div>

        {/* Card 3: Material Expense */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Material Expense</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#9333ea", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Package size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(materialExpenseVal)}</div>
          <span style={{ fontSize: "11px", color: "#9333ea", marginTop: "4px", display: "block", fontWeight: "600" }}>Materials &amp; deliveries</span>
        </div>

        {/* Card 4: Other Expense */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Other Expense</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Layers size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(otherExpenseVal)}</div>
          <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px", display: "block", fontWeight: "600" }}>Transport, fuel &amp; overheads</span>
        </div>

      </div>

      {/* ── 3. NAVIGATION TABS (EXPENDITURE LEDGER, REQUISITIONS, PAYOUT LOG, REPORTS) ── */}
      <div style={{ display: "flex", gap: "8px", borderBottom: "1px solid #e2e8f0", paddingBottom: "0", marginBottom: "20px" }}>
        {[
          { id: "overview", label: "Expenditure Ledger", icon: Clipboard },
          { id: "pending", label: `Pending Requisitions (${pendingGeneralExpenseRequests.length})`, icon: Clock },
          { id: "payments", label: "Record Payout Log", icon: CreditCard },
          { id: "reports", label: "Financial Reports", icon: FileText }
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
                padding: "10px 18px",
                border: "none",
                backgroundColor: "transparent",
                borderBottom: isActive ? "3px solid #f97316" : "3px solid transparent",
                color: isActive ? "#f97316" : "#64748b",
                fontWeight: isActive ? "700" : "600",
                fontSize: "13px",
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

      {/* ── 4. TAB CONTENT ── */}
      
      {/* TAB 1: EXPENDITURE LEDGER TABLE (MAIN LISTING VIEW) */}
      {activeTab === "overview" && (
        <Card noPadding style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          
          {/* Controls Bar: Category Pills & Sort Dropdown */}
          <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "#f8fafc" }}>
            
            {/* Category Filter Pills (All, Labour, Material, Transport, Other) */}
            <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginRight: "6px" }}>Category:</span>
              {["All", "Labour", "Material", "Transport", "Other"].map(cat => {
                const isSel = categoryFilter === cat;
                return (
                  <button
                    key={cat}
                    onClick={() => setCategoryFilter(cat)}
                    style={{
                      padding: "5px 14px",
                      borderRadius: "20px",
                      fontSize: "12px",
                      fontWeight: isSel ? "700" : "600",
                      border: isSel ? "1px solid #f97316" : "1px solid #cbd5e1",
                      backgroundColor: isSel ? "#fff7ed" : "#ffffff",
                      color: isSel ? "#ea580c" : "#475569",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            {/* Sort Controls */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <ArrowUpDown size={14} style={{ color: "#64748b" }} />
              <span style={{ fontSize: "12px", fontWeight: "600", color: "#64748b" }}>Sort By:</span>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                style={{
                  padding: "5px 10px",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "#0f172a",
                  outline: "none"
                }}
              >
                <option value="date-desc">Date (Newest First)</option>
                <option value="date-asc">Date (Oldest First)</option>
                <option value="amount-desc">Amount (High to Low)</option>
                <option value="amount-asc">Amount (Low to High)</option>
              </select>
            </div>

          </div>

          {/* Table Area */}
          {loading ? (
            <div style={{ padding: "40px", textAlign: "center" }}>
              <Loading text="Loading site expense ledger..." />
            </div>
          ) : filteredExpenses.length === 0 ? (
            <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
              <Layers size={36} style={{ color: "#94a3b8", marginBottom: "10px" }} />
              <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: "#1e293b" }}>No Expenses Found</h4>
              <p style={{ margin: 0, fontSize: "13px" }}>No site expense records match your current filters or date range.</p>
            </div>
          ) : (
            <>
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Date</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Category</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Description</th>
                      <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Amount</th>
                      <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Added By</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Status</th>
                      <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {paginatedExpenses.map((exp, idx) => {
                      const isEven = idx % 2 === 0;
                      
                      // Badge color mapping
                      let catBadgeBg = "#f1f5f9";
                      let catBadgeFg = "#475569";
                      if (exp.normCategory === "Labour") { catBadgeBg = "#fff7ed"; catBadgeFg = "#c2410c"; }
                      else if (exp.normCategory === "Material") { catBadgeBg = "#fff7ed"; catBadgeFg = "#ea580c"; }
                      else if (exp.normCategory === "Transport") { catBadgeBg = "#fff7ed"; catBadgeFg = "#c2410c"; }

                      return (
                        <tr 
                          key={exp.id || idx} 
                          style={{ 
                            backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                            borderBottom: "1px solid #f1f5f9",
                            transition: "background-color 0.15s ease"
                          }}
                        >
                          <td style={{ padding: "12px 16px", fontSize: "12.5px", fontWeight: "600", color: "#334155", fontFamily: "monospace" }}>
                            {exp.date}
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <span style={{ 
                              backgroundColor: catBadgeBg, 
                              color: catBadgeFg, 
                              fontSize: "11px", 
                              fontWeight: "700", 
                              padding: "3px 8px", 
                              borderRadius: "4px",
                              display: "inline-block"
                            }}>
                              {exp.category}
                            </span>
                          </td>
                          <td style={{ padding: "12px 16px" }}>
                            <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{exp.name}</div>
                            <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>{exp.description}</div>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "13.5px", fontWeight: "800", color: "#0f172a" }}>
                            {formatINR(exp.amount)}
                          </td>
                          <td style={{ padding: "12px 16px", fontSize: "12.5px", fontWeight: "600", color: "#475569" }}>
                            {exp.addedBy}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <Badge status={exp.status === "Approved" || exp.status === "approved" ? "success" : "pending"}>
                              {exp.status}
                            </Badge>
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => setSelectedExpenseDetail(exp)}
                              style={{
                                border: "1px solid #cbd5e1",
                                backgroundColor: "#ffffff",
                                borderRadius: "6px",
                                padding: "5px 10px",
                                fontSize: "12px",
                                fontWeight: "600",
                                color: "#334155",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px"
                              }}
                              title="View Details"
                            >
                              <Eye size={14} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Table Footer Pagination Controls */}
              <div style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "#f8fafc" }}>
                <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "500" }}>
                  Showing {filteredExpenses.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredExpenses.length)} of {filteredExpenses.length} expenses
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
      )}

      {/* TAB 2: PENDING REQUISITIONS */}
      {activeTab === "pending" && (
        <Card title="Pending Field Requisition Queue" subtitle="Review requests submitted by field engineers.">
          {pendingGeneralExpenseRequests.length === 0 ? (
            <p style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", padding: "32px" }}>No pending engineer requests.</p>
          ) : (
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0, width: "100%" }}>
                <thead>
                  <tr>
                    <th>Site Name</th>
                    <th>Category</th>
                    <th>Amount</th>
                    <th>Date</th>
                    <th>Description / Reason</th>
                    <th style={{ textAlign: "right" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {pendingGeneralExpenseRequests.map(req => (
                    <tr key={req.id}>
                      <td style={{ fontWeight: "700" }}>{sites.find(s => s.id === req.siteId)?.siteName || "Unknown"}</td>
                      <td><Badge status="pending">{req.category}</Badge></td>
                      <td style={{ fontWeight: "700" }}>{formatINR(req.amount)}</td>
                      <td className="font-mono">{req.date}</td>
                      <td>{req.description}</td>
                      <td style={{ textAlign: "right" }}>
                        <Button 
                          variant="primary" 
                          size="sm" 
                          onClick={() => handleApproveExpense(req.id)}
                        >
                          Approve
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>
      )}

      {/* TAB 3: RECORD PAYOUT LOG */}
      {activeTab === "payments" && ledger && (
        <Card title="Record Payout Log Entry" subtitle="Authorize cash payout reference tags against material bills, labour payroll, or site bills.">
          <form onSubmit={handlePayoutSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "600px" }}>
            
            <div className="form-group">
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", textTransform: "uppercase" }}>Choose Payout Category / Target</label>
              <div style={{ display: "flex", gap: "12px", marginTop: "8px" }}>
                {[
                  { id: "material", label: "Material Supplier", icon: Package },
                  { id: "labour", label: "Labour Payroll", icon: Users },
                  { id: "general", label: "General Site Bill", icon: Layers }
                ].map(opt => {
                  const OptIcon = opt.icon;
                  const isSel = payoutType === opt.id;
                  return (
                    <button
                      type="button"
                      key={opt.id}
                      onClick={() => { setPayoutType(opt.id); setPayoutAmount(""); }}
                      style={{
                        flex: 1,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px",
                        padding: "12px",
                        borderRadius: "8px",
                        border: isSel ? "2px solid #f97316" : "1px solid #cbd5e1",
                        backgroundColor: isSel ? "#fff7ed" : "#ffffff",
                        color: isSel ? "#ea580c" : "#475569",
                        fontWeight: "700",
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      <OptIcon size={16} />
                      <span>{opt.label}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Dynamic target selector dropdown */}
            {payoutType === "material" && (
              <div className="form-group">
                <label htmlFor="payout-target-mat">Select Pending Material Invoice Batch</label>
                <select
                  id="payout-target-mat"
                  value={selectedMaterialId}
                  onChange={(e) => {
                    setSelectedMaterialId(e.target.value);
                    const m = materials.find(x => x.id === e.target.value);
                    if (m) {
                      const proc = getSiteExpenseLedger(activeSite, materials, labourHistory, generalExpenses, labourPayments, labourMaster.categories).expensesList.find(el => el.id === m.id);
                      const paid = m.paidAmount || 0;
                      const total = proc ? proc.amount : 0;
                      setPayoutAmount(Math.max(0, total - paid).toString());
                    }
                  }}
                  required
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="">-- Choose Invoice Batch --</option>
                  {materials
                    .filter(m => m.siteId === selectedSiteId && (m.status === "approved" || m.status === "Approved"))
                    .map(m => {
                      const paid = Number(m.paidAmount) || 0;
                      const total = m.totalAmount || 0;
                      const bal = Math.max(0, total - paid);
                      if (bal <= 0) return null;
                      return (
                        <option key={m.id} value={m.id}>
                          {m.materialName} (Supplier: {m.supplierName}) • Unpaid Balance: {formatINR(bal)}
                        </option>
                      );
                    }).filter(Boolean)}
                </select>
              </div>
            )}

            {payoutType === "general" && (
              <div className="form-group">
                <label htmlFor="payout-target-gen">Select Unpaid Site Bill / Expense</label>
                <select
                  id="payout-target-gen"
                  value={selectedGeneralExpenseId}
                  onChange={(e) => {
                    setSelectedGeneralExpenseId(e.target.value);
                    const g = generalExpenses.find(x => x.id === e.target.value);
                    if (g) {
                      setPayoutAmount(Math.max(0, g.amount - (g.paidAmount || 0)).toString());
                    }
                  }}
                  required
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                >
                  <option value="">-- Choose Site Bill --</option>
                  {generalExpenses
                    .filter(g => g.siteId === selectedSiteId && (g.status === "approved" || g.status === "Approved"))
                    .map(g => {
                      const bal = g.amount - (g.paidAmount || 0);
                      if (bal <= 0) return null;
                      return (
                        <option key={g.id} value={g.id}>
                          {g.description} ({g.category}) • Unpaid Balance: {formatINR(bal)}
                        </option>
                      );
                    }).filter(Boolean)}
                </select>
              </div>
            )}

            <div className="form-group">
              <label htmlFor="pay-amount-in">Payout Amount (₹) <span style={{ color: "#ef4444" }}>*</span></label>
              <input
                id="pay-amount-in"
                type="number"
                placeholder="e.g. 50000"
                value={payoutAmount}
                onChange={(e) => setPayoutAmount(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="pay-date-in">Payment Date</label>
              <input
                id="pay-date-in"
                type="date"
                value={payoutDate}
                onChange={(e) => setPayoutDate(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="pay-ref-in">Transaction Reference (UPI ID / Check # / Cash details)</label>
              <input
                id="pay-ref-in"
                type="text"
                placeholder="e.g. UPI txn-92931, Check #1034"
                value={payoutRef}
                onChange={(e) => setPayoutRef(e.target.value)}
                style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="pay-notes-in">Payment Notes / Remarks</label>
              <input
                id="pay-notes-in"
                type="text"
                placeholder="e.g. Paid part salary, or clearing steel delivery bill"
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>

            <Button type="submit" variant="primary" style={{ marginTop: "10px" }}>Log Payment Entry</Button>
          </form>
        </Card>
      )}

      {/* TAB 4: FINANCIAL REPORTS */}
      {activeTab === "reports" && ledger && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <Card title="Accrued Cost Category Breakdown Report">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0, width: "100%" }}>
                <thead>
                  <tr>
                    <th>Expense Category</th>
                    <th style={{ textAlign: "right" }}>Total Cost Accrued</th>
                    <th style={{ textAlign: "right" }}>Total Paid Out</th>
                    <th style={{ textAlign: "right" }}>Outstanding Dues</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { cat: "Material Expense", cost: ledger.materialExpenseTotal, paid: ledger.materialPaidTotal },
                    { cat: "Labour Expense", cost: ledger.labourExpenseTotal, paid: ledger.labourPaidTotal },
                    { cat: "Site Expense", cost: ledger.siteExpenseTotal, paid: ledger.generalPaidTotal },
                    { cat: "Other Expense", cost: ledger.otherExpenseTotal, paid: 0 }
                  ].map((item, index) => (
                    <tr key={index}>
                      <td style={{ fontWeight: "700" }}>{item.cat}</td>
                      <td style={{ textAlign: "right", fontWeight: "700" }}>{formatINR(item.cost)}</td>
                      <td style={{ textAlign: "right", color: "#16a34a" }}>{formatINR(item.paid)}</td>
                      <td style={{ textAlign: "right", color: "#dc2626", fontWeight: "700" }}>{formatINR(Math.max(0, item.cost - item.paid))}</td>
                    </tr>
                  ))}
                  <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "800" }}>
                    <td>TOTAL NET COST</td>
                    <td style={{ textAlign: "right" }}>{formatINR(ledger.totalExpenses)}</td>
                    <td style={{ textAlign: "right" }}>{formatINR(ledger.totalPayments)}</td>
                    <td style={{ textAlign: "right", color: "#dc2626" }}>{formatINR(ledger.pendingPayments)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          <Card title="Supplier & Labor Payout History Log">
            {ledger.paymentsHistory.length === 0 ? (
              <p style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No payouts registered yet.</p>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0, width: "100%" }}>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Payment Category</th>
                      <th>Target Description</th>
                      <th>Reference #</th>
                      <th>Remarks / Notes</th>
                      <th style={{ textAlign: "right" }}>Amount Paid</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ledger.paymentsHistory.map((p, idx) => (
                      <tr key={idx}>
                        <td className="font-mono">{p.date}</td>
                        <td><Badge status="success">{p.category}</Badge></td>
                        <td style={{ fontWeight: "700" }}>{p.name}</td>
                        <td className="font-mono">{p.reference || "--"}</td>
                        <td>{p.notes || "--"}</td>
                        <td style={{ textAlign: "right", fontWeight: "700", color: "#16a34a" }}>{formatINR(p.amount)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </div>
      )}

      {/* ── 5. MODAL: ADD SITE EXPENSE ── */}
      {showAddExpenseModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Log General Site Expense</h3>
              <button className="modal-close" onClick={() => setShowAddExpenseModal(false)} type="button"><X size={18} /></button>
            </div>
            <form onSubmit={handleAddExpense}>
              <div className="modal-body" style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                
                <div className="form-group">
                  <label htmlFor="exp-category">Expense Category</label>
                  <select
                    id="exp-category"
                    value={newExpense.category}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, category: e.target.value }))}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}
                  >
                    <option value="Site Expense">Site Expense (fuel, water, transport)</option>
                    <option value="Other Expense">Other Expense (fees, emergency bills)</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="exp-desc">Description / Particulars</label>
                  <input
                    id="exp-desc"
                    type="text"
                    placeholder="e.g. Tanker water delivery, diesel for JCB"
                    value={newExpense.description}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, description: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="exp-amt">Amount (₹)</label>
                  <input
                    id="exp-amt"
                    type="number"
                    placeholder="e.g. 2500"
                    value={newExpense.amount}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, amount: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="exp-date">Date</label>
                  <input
                    id="exp-date"
                    type="date"
                    value={newExpense.date}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, date: e.target.value }))}
                    required
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>

                <div className="form-group">
                  <label htmlFor="exp-notes">Additional Notes</label>
                  <input
                    id="exp-notes"
                    type="text"
                    placeholder="e.g. Invoice #29381 from supplier"
                    value={newExpense.notes}
                    onChange={(e) => setNewExpense(prev => ({ ...prev, notes: e.target.value }))}
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
              <div className="modal-footer">
                <Button type="button" variant="secondary" onClick={() => setShowAddExpenseModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary">Log Expense</Button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ── 6. MODAL: EXPENSE DETAIL VIEW ── */}
      {selectedExpenseDetail && (
        <Modal
          isOpen={!!selectedExpenseDetail}
          onClose={() => setSelectedExpenseDetail(null)}
          title="Expense Entry Details"
          size="sm"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "4px 0" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Category</span>
                <div style={{ fontSize: "14px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>{selectedExpenseDetail.category}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Amount</span>
                <div style={{ fontSize: "18px", fontWeight: "800", color: "#ea580c", marginTop: "2px" }}>{formatINR(selectedExpenseDetail.amount)}</div>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Date</span>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a", fontFamily: "monospace" }}>{selectedExpenseDetail.date}</div>
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Status</span>
                <div><Badge status={selectedExpenseDetail.status === "Approved" || selectedExpenseDetail.status === "approved" ? "success" : "pending"}>{selectedExpenseDetail.status}</Badge></div>
              </div>
            </div>

            <div>
              <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Description / Item Name</span>
              <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>{selectedExpenseDetail.name}</div>
              <div style={{ fontSize: "12px", color: "#475569", marginTop: "4px", backgroundColor: "#f8fafc", padding: "8px 12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}>
                {selectedExpenseDetail.description || "No additional particulars."}
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Added By</span>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{selectedExpenseDetail.addedBy}</div>
              </div>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>Site Name</span>
                <div style={{ fontSize: "13px", fontWeight: "600", color: "#0f172a" }}>{activeSite?.siteName || "Selected Site"}</div>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
              <Button variant="primary" onClick={() => setSelectedExpenseDetail(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

    </Layout>
  );
}

function formatINR(val) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(val || 0);
}

import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
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
  FileText
} from "lucide-react";

export default function AdminPayments() {
  const [activeTab, setActiveTab] = useState("overview"); // overview, expenses, payments, reports
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

  // Modals / forms state
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [newExpense, setNewExpense] = useState({ category: "Site Expense", amount: "", date: new Date().toISOString().split("T")[0], description: "", notes: "" });

  const [payoutType, setPayoutType] = useState("material"); // material, labour, general
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
      const [fetchedSites, fetchedLabourPayments, fetchedLabourMaster, fetchedGeneralExpenses, fetchedAllMaterials] = await Promise.all([
        getSites(),
        getLabourPayments(),
        getLabourMaster(),
        getGeneralExpenses(),
        getMaterialsDetailed(null) // All sites materials
      ]);

      setSites(fetchedSites);
      setLabourPayments(fetchedLabourPayments);
      setLabourMaster(fetchedLabourMaster);
      setGeneralExpenses(fetchedGeneralExpenses);
      setMaterials(fetchedAllMaterials);

      if (fetchedSites.length > 0) {
        setSelectedSiteId(fetchedSites[0].id);
        
        // Fetch labour headcounts for first site
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

  // Reload site-specific data when site changes
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
        status: "Approved" // Directly approved since created by Admin
      });
      showToast("General site expense logged successfully!", "success");
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
        });
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

  return (
    <Layout 
      title="Corporate Payment & Expense ledger" 
      description="Monitor site-wise cash outflows, authorize engineer expenses, and audit consolidated payout records."
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
          { id: "overview", label: "Financial Ledger overview", icon: Clipboard },
          { id: "expenses", label: `Site Expenses & Requisitions (${pendingGeneralExpenseRequests.length})`, icon: Clock },
          { id: "payments", label: "Record Payout log", icon: CreditCard },
          { id: "reports", label: "Ledger Financial Reports", icon: FileText }
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
        
        {/* Global Site Selector */}
        {activeTab !== "expenses" && (
          <Card title="Site Selector" className="no-print">
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
                    {sites.map(site => (
                      <option key={site.id} value={site.id}>{site.siteName}</option>
                    ))}
                  </select>
                </div>
              </div>
              <Button onClick={() => window.print()} variant="secondary" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Printer size={16} />
                <span>Print Statement</span>
              </Button>
            </div>
          </Card>
        )}

        {/* Tab 1: Financial Overview */}
        {activeTab === "overview" && ledger && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Visual Dials Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "20px" }}>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Project Budget</span>
                <strong style={{ fontSize: "26px", display: "block", color: "var(--primary-900)", marginTop: "6px" }}>
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(ledger.totalBudget)}
                </strong>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Expenses Accrued</span>
                <strong style={{ fontSize: "26px", display: "block", color: "var(--danger-700)", marginTop: "6px" }}>
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(ledger.totalExpenses)}
                </strong>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Total Payouts Made</span>
                <strong style={{ fontSize: "26px", display: "block", color: "var(--success-700)", marginTop: "6px" }}>
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(ledger.totalPayments)}
                </strong>
              </Card>
              <Card>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Pending Supplier Dues</span>
                <strong style={{ fontSize: "26px", display: "block", color: "var(--accent-750)", marginTop: "6px" }}>
                  {new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(ledger.pendingPayments)}
                </strong>
              </Card>
            </div>

            {/* Combined Chronological Financial Timeline Ledger */}
            <Card title="Consolidated Site Financial Ledger Timeline" subtitle="Chonological ledger of accrued expenses and payment updates.">
              {ledger.expensesList.length === 0 && ledger.paymentsHistory.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>No transactions logged yet for this site.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                  {/* Concat, sort by date descending */}
                  {[
                    ...ledger.expensesList.map(e => ({ ...e, eventType: "Accrued Cost" })),
                    ...ledger.paymentsHistory.map(p => ({ ...p, eventType: "Payout Logged", amount: -p.amount }))
                  ]
                    .sort((a, b) => b.date.localeCompare(a.date))
                    .map((item, idx) => {
                      const isExpense = item.eventType === "Accrued Cost";
                      return (
                        <div 
                          key={idx} 
                          style={{ 
                            display: "flex", 
                            justifyContent: "space-between", 
                            alignItems: "center", 
                            padding: "12px 16px", 
                            borderLeft: isExpense ? "4.5px solid var(--danger-500)" : "4.5px solid var(--success-500)", 
                            backgroundColor: "#f8fafc", 
                            borderRadius: "4px" 
                          }}
                        >
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: isExpense ? "var(--danger-700)" : "var(--success-700)" }}>{item.eventType.toUpperCase()} • {item.category}</span>
                            <h4 style={{ margin: "2px 0 0 0", fontSize: "13.5px", fontWeight: "800", color: "var(--primary-950)" }}>{item.name}</h4>
                            <p style={{ margin: "2px 0 0 0", fontSize: "11.5px", color: "var(--text-muted)" }}>{item.description}</p>
                          </div>
                          <div style={{ textAlign: "right" }}>
                            <strong style={{ fontSize: "14px", color: isExpense ? "var(--danger-700)" : "var(--success-700)" }}>
                              {isExpense ? "+" : ""}{new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(Math.abs(item.amount))}
                            </strong>
                            <div className="font-mono" style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>{item.date}</div>
                          </div>
                        </div>
                      );
                    })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 2: General Expenses */}
        {activeTab === "expenses" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            
            {/* Pending approvals requests card */}
            <Card title="Pending Field Expenses Requisition queue" subtitle="Review requests submitted by Site Engineers.">
              {pendingGeneralExpenseRequests.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>No pending engineer requests.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0 }}>
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

            {/* Approved general site ledger list */}
            <Card 
              title="Approved General Site Bills & Bills Log" 
              headerActions={
                <Button onClick={() => setShowAddExpenseModal(true)} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Plus size={16} />
                  <span>Log Expense</span>
                </Button>
              }
            >
              {generalExpenses.filter(g => g.status === "Approved" || g.status === "approved").length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "32px" }}>No general expenses logged yet.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0 }}>
                    <thead>
                      <tr>
                        <th>Site Name</th>
                        <th>Category</th>
                        <th>Amount</th>
                        <th>Date</th>
                        <th>Description / Notes</th>
                        <th>Payout Status</th>
                      </tr>
                    </thead>
                    <tbody>
                      {generalExpenses
                        .filter(g => g.status === "Approved" || g.status === "approved")
                        .map(g => (
                          <tr key={g.id}>
                            <td style={{ fontWeight: "700" }}>{sites.find(s => s.id === g.siteId)?.siteName || "Unknown"}</td>
                            <td><Badge status="success">{g.category}</Badge></td>
                            <td style={{ fontWeight: "700" }}>{formatINR(g.amount)}</td>
                            <td className="font-mono">{g.date}</td>
                            <td>{g.description}</td>
                            <td>
                              <Badge status={g.paidAmount >= g.amount ? "success" : g.paidAmount > 0 ? "pending" : "danger"}>
                                {g.paidAmount >= g.amount ? "Paid" : g.paidAmount > 0 ? "Partially Paid" : "Unpaid"}
                              </Badge>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* Tab 3: Record Payout Log */}
        {activeTab === "payments" && ledger && (
          <Card title="Record Payout log entry" subtitle="Authorize cash payout reference tags against material bills, labour payroll, or site bills.">
            <form onSubmit={handlePayoutSubmit} style={{ display: "flex", flexDirection: "column", gap: "20px", maxWidth: "600px" }}>
              
              <div className="form-group">
                <label>Choose Payout Category / Target</label>
                <div style={{ display: "flex", gap: "16px", marginTop: "8px" }}>
                  {[
                    { id: "material", label: "Material Supplier", icon: Package },
                    { id: "labour", label: "Labour Wages/Payroll", icon: Users },
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
                          border: isSel ? "2.5px solid var(--primary-600)" : "1px solid var(--border-color)",
                          backgroundColor: isSel ? "var(--primary-50)" : "#ffffff",
                          color: isSel ? "var(--primary-900)" : "var(--text-muted)",
                          fontWeight: "800",
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
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
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
                    style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
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
                <label htmlFor="pay-amount-in">Payout Amount (₹) <span style={{ color: "var(--danger-500)" }}>*</span></label>
                <input
                  id="pay-amount-in"
                  type="number"
                  placeholder="e.g. 50000"
                  value={payoutAmount}
                  onChange={(e) => setPayoutAmount(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
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
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
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
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
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
                  style={{ width: "100%", padding: "10px", marginTop: "4px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
                />
              </div>

              <Button type="submit" variant="primary" style={{ marginTop: "10px" }}>Log Payment Entry</Button>
            </form>
          </Card>
        )}

        {/* Tab 4: Financial Reports */}
        {activeTab === "reports" && ledger && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="print-area">
            
            {/* Category Breakdown Table */}
            <Card title="Accrued Cost Category Breakdown report">
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0 }}>
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
                        <td style={{ textAlign: "right", color: "var(--success-700)" }}>{formatINR(item.paid)}</td>
                        <td style={{ textAlign: "right", color: "var(--danger-700)", fontWeight: "700" }}>{formatINR(Math.max(0, item.cost - item.paid))}</td>
                      </tr>
                    ))}
                    <tr style={{ backgroundColor: "#f1f5f9", fontWeight: "800" }}>
                      <td>TOTAL NET COST</td>
                      <td style={{ textAlign: "right" }}>{formatINR(ledger.totalExpenses)}</td>
                      <td style={{ textAlign: "right" }}>{formatINR(ledger.totalPayments)}</td>
                      <td style={{ textAlign: "right", color: "var(--danger-700)" }}>{formatINR(ledger.pendingPayments)}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </Card>

            {/* Payout History Ledger card */}
            <Card title="Corporate Supplier & Labor Payout History log">
              {ledger.paymentsHistory.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center", padding: "20px" }}>No payouts registered yet.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: 0 }}>
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
                          <td style={{ textAlign: "right", fontWeight: "700", color: "var(--success-700)" }}>{formatINR(p.amount)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </Card>
          </div>
        )}

      </div>

      {/* Modal: Add General Site Expense */}
      {showAddExpenseModal && (
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: "450px" }}>
            <div className="modal-header">
              <h3>Log General Site Expense</h3>
              <button className="modal-close" onClick={() => setShowAddExpenseModal(false)}><X size={18} /></button>
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
    </Layout>
  );
}

function formatINR(val) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(val);
}

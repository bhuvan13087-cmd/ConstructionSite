import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { 
  getSites, 
  getSiteEngineers, 
  getMaterialsDetailed, 
  getLabourDailyCountsSummary, 
  getAttendanceForSite, 
  getDailyUpdatesForSite, 
  subscribePhotosForSite, 
  updateMaterial,
  deleteMaterial,
  subscribeGeneralExpenses,
  getLabourPayments,
  saveLabourPayment,
  getLabourTeams
} from "../services/firebaseService";
import { processMaterialPaymentAndDelivery, formatProgress, generateWeeklyReportFromDprs, calculatePlannedProgress } from "../services/businessLogic";
import { 
  ArrowLeft, 
  Building2, 
  Calendar, 
  MapPin, 
  Users, 
  Package, 
  ClipboardCheck, 
  Camera, 
  FileText, 
  Printer, 
  Clock, 
  Filter, 
  Activity, 
  User, 
  Edit3, 
  Trash2, 
  DollarSign,
  Info,
  CheckCircle2,
  AlertCircle,
  X
} from "lucide-react";

export default function SiteDetails({ siteId, onBack }) {
  const [site, setSite] = useState(null);
  const [engineers, setEngineers] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labourHistory, setLabourHistory] = useState([]);
  const [attendance, setAttendance] = useState([]);
  const [progressUpdates, setProgressUpdates] = useState([]);
  const [photos, setPhotos] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [sitePayments, setSitePayments] = useState([]);
  const [teams, setTeams] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [showSiteInfoModal, setShowSiteInfoModal] = useState(false);
  const [showPendingActionsModal, setShowPendingActionsModal] = useState(false);

  const siteLabourFinancials = useMemo(() => {
    let grossAmount = 0;
    (labourHistory || []).forEach(row => {
      if (row.totalAmount) {
        grossAmount += Number(row.totalAmount) || 0;
      } else if (row.calculatedAmount) {
        grossAmount += Number(row.calculatedAmount) || 0;
      } else if (row.workerCount) {
        const wage = Number(row.dailyWage || row.wage || 500);
        const units = Number(row.customWorkUnits !== undefined ? row.customWorkUnits : (row.units || 1));
        grossAmount += Number(row.workerCount) * units * wage;
      } else {
        grossAmount += (Number(row.wage) || 500) * (Number(row.units) || 1);
      }
    });

    const advancePaid = (sitePayments || []).reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    const netPayable = Math.max(0, grossAmount - advancePaid);

    return {
      grossAmount,
      advancePaid,
      netPayable
    };
  }, [labourHistory, sitePayments]);

  const [advanceDate, setAdvanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [advanceAmount, setAdvanceAmount] = useState("");
  const [advanceNotes, setAdvanceNotes] = useState("");
  const [savingAdvance, setSavingAdvance] = useState(false);

  const autoTeam = useMemo(() => {
    if (teams && teams.length > 0) {
      const siteTeamId = site?.teamId;
      if (siteTeamId) {
        const found = teams.find(t => t.id === siteTeamId);
        if (found) return found;
      }
      const foundInAtt = (attendance || []).find(a => a.teamId);
      if (foundInAtt) {
        const found = teams.find(t => t.id === foundInAtt.teamId);
        if (found) return found;
      }
      if (teams[0]) return teams[0];
    }
    return {
      id: "auto_team",
      teamName: `${site?.siteName || "Site"} Workforce Team`
    };
  }, [teams, site, attendance]);

  const handleSaveLabourAdvance = async (e) => {
    e.preventDefault();
    if (!advanceAmount || isNaN(Number(advanceAmount)) || Number(advanceAmount) <= 0) {
      showToast("Please enter a valid advance amount.", "error");
      return;
    }
    setSavingAdvance(true);
    try {
      await saveLabourPayment({
        siteId,
        teamId: autoTeam.id,
        teamName: autoTeam.teamName,
        amount: Number(advanceAmount),
        date: advanceDate,
        notes: advanceNotes.trim()
      });
      showToast("Labour advance saved successfully!", "success");
      setAdvanceAmount("");
      setAdvanceNotes("");
      const refreshedPayments = await getLabourPayments(siteId);
      setSitePayments(refreshedPayments || []);
    } catch (err) {
      console.error("Failed to save advance:", err);
      showToast(`Failed to save advance: ${err.message}`, "error");
    } finally {
      setSavingAdvance(false);
    }
  };

  // Filters State
  const [materialDateFilter, setMaterialDateFilter] = useState("");
  const [materialNameFilter, setMaterialNameFilter] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");
  const [deliveryFilter, setDeliveryFilter] = useState("all");
  const [paymentFilter, setPaymentFilter] = useState("all");
  const [labourDateFilter, setLabourDateFilter] = useState("");


  // Material Edit Modal State
  const [selectedMaterialForEdit, setSelectedMaterialForEdit] = useState(null);
  const [showEditMaterialModal, setShowEditMaterialModal] = useState(false);
  const [editMaterialName, setEditMaterialName] = useState("");
  const [editCategory, setEditCategory] = useState("");
  const [editQuantity, setEditQuantity] = useState(0);
  const [editUnit, setEditUnit] = useState("");
  const [editSupplierName, setEditSupplierName] = useState("");
  const [editPurchaseDate, setEditPurchaseDate] = useState("");
  const [editNotes, setEditNotes] = useState("");
  const [editRequiredQuantity, setEditRequiredQuantity] = useState(0);
  const [editOrderedQuantity, setEditOrderedQuantity] = useState(0);
  const [editPaidQuantity, setEditPaidQuantity] = useState(0);
  const [savingEdit, setSavingEdit] = useState(false);

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  const handleOpenEditMaterial = (mat) => {
    setSelectedMaterialForEdit(mat);
    setEditMaterialName(mat.materialName || "");
    setEditCategory(mat.category || "");
    setEditQuantity(mat.receivedQuantity || mat.quantity || 0);
    setEditUnit(mat.unit || "unit");
    setEditSupplierName(mat.supplierName || "");
    setEditPurchaseDate(mat.purchaseDate || "");
    setEditNotes(mat.notes || "");
    setEditRequiredQuantity(mat.requiredQuantity !== undefined ? mat.requiredQuantity : (mat.receivedQuantity || mat.quantity || 0));
    setEditOrderedQuantity(mat.orderedQuantity !== undefined ? mat.orderedQuantity : (mat.receivedQuantity || mat.quantity || 0));
    setEditPaidQuantity(mat.paidQuantity !== undefined ? mat.paidQuantity : 0);
    setShowEditMaterialModal(true);
  };

  const handleEditMaterialSubmit = async (e) => {
    e.preventDefault();
    if (!selectedMaterialForEdit) return;
    setSavingEdit(true);
    try {
      await updateMaterial(selectedMaterialForEdit.id, {
        materialName: editMaterialName.trim(),
        category: editCategory.trim(),
        quantity: Number(editQuantity),
        unit: editUnit.trim(),
        supplierName: editSupplierName.trim(),
        purchaseDate: editPurchaseDate,
        notes: editNotes.trim(),
        requiredQuantity: Number(editRequiredQuantity),
        orderedQuantity: Number(editOrderedQuantity),
        paidQuantity: Number(editPaidQuantity)
      });
      showToast("Material tracking values updated successfully.", "success");
      setShowEditMaterialModal(false);
      await loadData();
    } catch (err) {
      console.error(err);
      showToast(`Failed to update tracking values: ${err.message}`, "error");
    } finally {
      setSavingEdit(false);
    }
  };

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

  const handleDeleteMaterialLog = async (materialId) => {
    showConfirmModal({
      title: "Delete Material Record?",
      message: "Are you sure you want to delete this material log record?",
      details: "This action cannot be undone.",
      confirmText: "Delete Log",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteMaterial(materialId);
          showToast("Material record deleted successfully.", "success");
          await loadData();
        } catch (err) {
          console.error(err);
          showToast(`Failed to delete record: ${err.message}`, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  const loadData = async () => {
    try {
      setLoading(true);
      // Fetch site details
      const fetchedSites = await getSites();
      const currentSite = fetchedSites.find(s => s.id === siteId);
      if (!currentSite) {
        showToast("Site not found.", "error");
        onBack();
        return;
      }
      setSite(currentSite);

      // Fetch all engineers
      const fetchedEngineers = await getSiteEngineers();
      const assigned = fetchedEngineers.filter(eng => 
        currentSite.assignedEngineers && currentSite.assignedEngineers.includes(eng.id)
      );
      setEngineers(assigned);

      // Fetch other site-specific logs in parallel
      const [
        mats,
        labour,
        attend,
        progress,
        payments,
        fetchedTeams
      ] = await Promise.all([
        getMaterialsDetailed(siteId),
        getLabourDailyCountsSummary(siteId),
        getAttendanceForSite(siteId),
        getDailyUpdatesForSite(siteId),
        getLabourPayments(siteId),
        getLabourTeams()
      ]);

      setMaterials(mats);
      setLabourHistory(labour);
      setAttendance(attend);
      setProgressUpdates(progress);
      setSitePayments(payments || []);
      setTeams(fetchedTeams || []);

    } catch (err) {
      console.error("Error loading site details:", err);
      showToast(`Error loading dashboard: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    const unsubscribe = subscribePhotosForSite(siteId, (pts) => {
      setPhotos(pts);
    });
    return () => unsubscribe();
  }, [siteId]);

  useEffect(() => {
    if (!siteId) return;
    const unsubscribe = subscribeGeneralExpenses((expList) => {
      const siteExp = expList.filter(e => e.siteId === siteId);
      setExpenses(siteExp);
    });
    return () => unsubscribe();
  }, [siteId]);

  if (loading) {
    return (
      <Layout title="Site Details" description="Loading detailed resource logs...">
        <Loading show={true} text="Synchronizing site databases..." />
      </Layout>
    );
  }

  if (!site) return null;

  // Map materials to include derived tracking values
  const processedMaterials = materials.map(mat => processMaterialPaymentAndDelivery(mat));

  // Filter materials based on all active filters
  const filteredMaterials = processedMaterials.filter(mat => {
    if (materialDateFilter && mat.purchaseDate !== materialDateFilter) return false;
    if (materialNameFilter && mat.materialName !== materialNameFilter) return false;
    if (supplierFilter && mat.supplierName !== supplierFilter) return false;
    if (deliveryFilter !== "all" && mat.deliveryStatus !== deliveryFilter) return false;
    if (paymentFilter !== "all" && mat.paymentStatus !== paymentFilter) return false;
    return true;
  });

  // Unique list of materials and suppliers for filters
  const uniqueMaterialNames = Array.from(new Set(processedMaterials.map(m => m.materialName))).filter(Boolean);
  const uniqueSuppliers = Array.from(new Set(processedMaterials.map(m => m.supplierName))).filter(Boolean);

  // Aggregated totals for summary boxes
  const totalRequired = processedMaterials.reduce((acc, mat) => acc + mat.requiredQuantity, 0);
  const totalReceived = processedMaterials.reduce((acc, mat) => acc + mat.receivedQuantity, 0);
  const totalPendingDel = processedMaterials.reduce((acc, mat) => acc + mat.pendingDelivery, 0);
  const totalPaid = processedMaterials.reduce((acc, mat) => acc + mat.paidQuantity, 0);
  const totalPendingPay = processedMaterials.reduce((acc, mat) => acc + mat.pendingPayment, 0);

  // Filter labour by date
  const filteredLabour = labourHistory.filter(row => {
    if (!labourDateFilter) return true;
    return row.date === labourDateFilter;
  });

  // Compute materials summary (aggregates for reports or overview)
  const materialsSummaryMap = {};
  processedMaterials.forEach(mat => {
    const key = mat.materialName?.toLowerCase().trim();
    if (!materialsSummaryMap[key]) {
      materialsSummaryMap[key] = { 
        name: mat.materialName, 
        required: 0, 
        received: 0, 
        pendingDel: 0, 
        paid: 0, 
        pendingPay: 0, 
        unit: mat.unit || "unit" 
      };
    }
    materialsSummaryMap[key].required += mat.requiredQuantity;
    materialsSummaryMap[key].received += mat.receivedQuantity;
    materialsSummaryMap[key].pendingDel += mat.pendingDelivery;
    materialsSummaryMap[key].paid += mat.paidQuantity;
    materialsSummaryMap[key].pendingPay += mat.pendingPayment;
  });
  const aggregatedMaterials = Object.values(materialsSummaryMap);

  // Compute labour total summary (supports both legacy headcount and new member attendance)
  const labourSummaryMap = { Masons: 0, Helpers: 0, Painters: 0, Plumbers: 0, Electricians: 0, Others: 0, totalDays: 0 };
  let laborSpent = 0;
  labourHistory.forEach(row => {
    if (row.memberId !== undefined) {
      laborSpent += (Number(row.wage) || 0) * (Number(row.units) || 0);
      const cat = row.categoryName || "";
      if (cat.includes("Mason")) labourSummaryMap.Masons += row.units;
      else if (cat.includes("Helper")) labourSummaryMap.Helpers += row.units;
      else if (cat.includes("Painter")) labourSummaryMap.Painters += row.units;
      else if (cat.includes("Plumber")) labourSummaryMap.Plumbers += row.units;
      else if (cat.includes("Electrician")) labourSummaryMap.Electricians += row.units;
      else labourSummaryMap.Others += row.units;
    } else {
      labourSummaryMap.Masons += row.Masons || 0;
      labourSummaryMap.Helpers += row.Helpers || 0;
      labourSummaryMap.Painters += row.Painters || 0;
      labourSummaryMap.Plumbers += row.Plumbers || 0;
      labourSummaryMap.Electricians += row.Electricians || 0;
      labourSummaryMap.Others += row.Others || 0;

      // Compute cost
      Object.keys(row).forEach(key => {
        if (key === "date" || key === "total" || key === "engineerId" || key === "id" || key === "siteId") return;
        const count = Number(row[key]) || 0;
        let rate = 600;
        if (key === "Masons") rate = 800;
        else if (key === "Helpers") rate = 500;
        else if (key === "Electricians" || key === "Plumbers" || key === "Painters") rate = 700;
        laborSpent += count * rate;
      });
    }
    labourSummaryMap.totalDays += 1;
  });

  const matSpent = processedMaterials.reduce((acc, m) => acc + ((m.receivedQuantity || m.quantity || 0) * (m.unitPrice || 0)), 0);
  const totalSpent = matSpent + laborSpent;
  
  // Canonical Budget Calculations (Strictly real data with no mock seed values)
  const actualBudget = site.budget !== undefined && site.budget !== null && site.budget !== "" ? Number(site.budget) : 0;
  const approvedExpenses = expenses.filter(e => e.status === "Approved" || e.status === "approved");
  const totalExpense = approvedExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const remainingBudget = actualBudget > 0 ? (actualBudget - totalExpense) : 0;
  const budgetUtilization = actualBudget > 0 ? (totalExpense / actualBudget) * 100 : 0;
  const budget = actualBudget;

  // CANONICAL OVERVIEW METRICS:
  const todayDateStr = new Date().toISOString().split("T")[0];

  // 1. Today Labour (actual workers logged today for this site)
  const todayAttendance = (attendance || []).filter(a => a.date === todayDateStr);
  const todayLabourRecords = (labourHistory || []).filter(l => l.date === todayDateStr);
  const todayLabourCount = todayAttendance.length > 0
    ? todayAttendance.reduce((sum, a) => sum + (Number(a.workerCount) || (a.memberId ? 1 : 0) || 1), 0)
    : (todayLabourRecords.length > 0 
        ? todayLabourRecords.reduce((sum, l) => sum + (Number(l.workerCount) || Number(l.units) || 1), 0) 
        : 0);

  // 2. Today Material (actual material entries logged today for this site)
  const todayMaterials = (materials || []).filter(m => (m.purchaseDate === todayDateStr || m.date === todayDateStr));
  const todayMaterialCount = todayMaterials.length;

  // 3. Today Expense (actual expense logged today for this site)
  const todayExpenses = (expenses || []).filter(e => e.date === todayDateStr);
  const todayExpenseSum = todayExpenses.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);

  // 4. Overall Progress (latest actual progress from DPR or site metadata)
  const latestProgressRecord = progressUpdates && progressUpdates.length > 0 ? progressUpdates[0] : null;
  const overallProgressPct = latestProgressRecord && latestProgressRecord.progress !== undefined && latestProgressRecord.progress !== null && latestProgressRecord.progress !== ""
    ? Math.min(100, Math.max(0, Number(latestProgressRecord.progress)))
    : Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || 0));

  // PENDING ACTIONS
  const pendingDprToday = !progressUpdates.some(p => p.date === todayDateStr);
  const pendingExpenseCount = expenses.filter(e => e.status === "Pending" || e.status === "pending").length;
  const pendingItemsList = [];
  if (pendingDprToday) {
    pendingItemsList.push({ title: "Today's Daily Progress (DPR)", status: "Pending submission for today", type: "dpr", linkTab: "progress" });
  }
  if (totalPendingDel > 0) {
    pendingItemsList.push({ title: "Material Deliveries", status: `${totalPendingDel} item(s) pending delivery`, type: "material", linkTab: "materials" });
  }
  if (pendingExpenseCount > 0) {
    pendingItemsList.push({ title: "Expense Approvals", status: `${pendingExpenseCount} expense(s) awaiting approval`, type: "expense", linkTab: "overview" });
  }
  if (siteLabourFinancials.netPayable > 0) {
    pendingItemsList.push({ title: "Labour Net Payable", status: `₹${siteLabourFinancials.netPayable.toLocaleString("en-IN")} pending payout`, type: "labour", linkTab: "labour_advance" });
  }

  // Visual Date Formatter for Overview (DD-MM-YYYY)
  const formatDateDDMMYYYY = (dateStr) => {
    if (!dateStr) return "--";
    if (typeof dateStr === "string") {
      const isoMatch = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
      if (isoMatch) {
        return `${isoMatch[3]}-${isoMatch[2]}-${isoMatch[1]}`;
      }
    }
    try {
      const d = new Date(dateStr);
      if (isNaN(d.getTime())) return String(dateStr);
      const day = String(d.getDate()).padStart(2, "0");
      const month = String(d.getMonth() + 1).padStart(2, "0");
      const year = d.getFullYear();
      return `${day}-${month}-${year}`;
    } catch {
      return String(dateStr);
    }
  };

  // Handle Print Action for Reports tab
  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "materials", label: "Material Log", icon: Package },
    { id: "labour", label: "Labour Log", icon: Users },
    { id: "labour_advance", label: "Labour Advance", icon: DollarSign },
    { id: "attendance", label: "Attendance", icon: ClipboardCheck },
    { id: "progress", label: "Progress", icon: FileText },
    { id: "photos", label: "Photos", icon: Camera },
    { id: "reports", label: "Reports", icon: Printer }
  ];

  return (
    <Layout 
      title={`Dashboard: ${site.siteName}`} 
      description={`Resource tracking, worker logs, and logistics audit ledger for ${site.location}.`}
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ===================================================================
          TAB: LABOUR ADVANCE (AUTOMATIC TEAM RESOLUTION)
          =================================================================== */}
      {activeTab === "labour_advance" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
          
          {/* Financial Summary KPI Cards */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "16px" }}>
            <Card style={{ borderLeft: "4px solid #0f172a" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase" }}>Gross Labour Amount</span>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a", marginTop: "6px", fontFamily: "monospace" }}>
                ₹{siteLabourFinancials.grossAmount.toLocaleString("en-IN")}
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>Total calculated from attendance</span>
            </Card>

            <Card style={{ borderLeft: "4px solid #eab308" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#854d0e", textTransform: "uppercase" }}>Total Advances Paid</span>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "#ca8a04", marginTop: "6px", fontFamily: "monospace" }}>
                ₹{siteLabourFinancials.advancePaid.toLocaleString("en-IN")}
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>Sum of advances issued for this site</span>
            </Card>

            <Card style={{ borderLeft: "4px solid var(--success-500)" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "var(--success-600)", textTransform: "uppercase" }}>Net Payable Amount</span>
              <div style={{ fontSize: "22px", fontWeight: "900", color: "var(--success-600)", marginTop: "6px", fontFamily: "monospace" }}>
                ₹{siteLabourFinancials.netPayable.toLocaleString("en-IN")}
              </div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>Gross Amount minus Advance Paid</span>
            </Card>
          </div>

          {/* Auto-Resolved Team Notice Banner */}
          <div style={{
            padding: "14px 18px",
            borderRadius: "10px",
            backgroundColor: "var(--primary-50)",
            border: "1px solid var(--border-color)",
            display: "flex",
            alignItems: "center",
            justify: "space-between",
            flexWrap: "wrap",
            gap: "10px"
          }}>
            <div>
              <span style={{ fontSize: "12px", fontWeight: "800", color: "#c2410c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Automatically Resolved Labour Team
              </span>
              <div style={{ fontSize: "15px", fontWeight: "900", color: "#0284c7", marginTop: "2px" }}>
                {autoTeam.teamName}
              </div>
              <span style={{ fontSize: "11.5px", color: "#c2410c" }}>
                Resolved automatically from site attendance records in Firestore. No manual team selection required.
              </span>
            </div>
            <Badge status="success">Auto-Resolved</Badge>
          </div>

          {/* Labour Advance Entry Form */}
          <Card title="Record New Labour Advance" subtitle={`Post an advance payment linked to ${site.siteName}`}>
            <form onSubmit={handleSaveLabourAdvance} style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px", alignItems: "flex-end" }}>
              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="adv-date" style={{ fontSize: "12px", fontWeight: "700" }}>Advance Date</label>
                <input
                  id="adv-date"
                  type="date"
                  value={advanceDate}
                  onChange={(e) => setAdvanceDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "4px" }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="adv-amt" style={{ fontSize: "12px", fontWeight: "700" }}>Advance Amount (₹)</label>
                <input
                  id="adv-amt"
                  type="number"
                  step="any"
                  min="1"
                  placeholder="e.g. 5000"
                  value={advanceAmount}
                  onChange={(e) => setAdvanceAmount(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "4px", fontWeight: "700" }}
                />
              </div>

              <div className="form-group" style={{ margin: 0 }}>
                <label htmlFor="adv-notes" style={{ fontSize: "12px", fontWeight: "700" }}>Notes / Remarks (Optional)</label>
                <input
                  id="adv-notes"
                  type="text"
                  placeholder="e.g. Weekly advance for Masons"
                  value={advanceNotes}
                  onChange={(e) => setAdvanceNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", marginTop: "4px" }}
                />
              </div>

              <div>
                <Button type="submit" disabled={savingAdvance} style={{ width: "100%", height: "42px" }}>
                  {savingAdvance ? "Saving..." : "Save Labour Advance"}
                </Button>
              </div>
            </form>
          </Card>

          {/* Advances History Table */}
          <Card
            variant="table"
            title="Labour Advance Transaction Ledger"
            headerActions={
              <Badge status="info">{sitePayments.length} Advances Logged</Badge>
            }
          >
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Advance Date</th>
                    <th>Auto-Resolved Team</th>
                    <th style={{ textAlign: "right" }}>Advance Amount (₹)</th>
                    <th>Notes / Remarks</th>
                    <th>Logged By</th>
                  </tr>
                </thead>
                <tbody>
                  {sitePayments.length === 0 ? (
                    <tr>
                      <td colSpan={5} style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "30px" }}>
                        No labour advances logged for this site yet.
                      </td>
                    </tr>
                  ) : (
                    sitePayments.map((p, idx) => (
                      <tr key={p.id || idx}>
                        <td className="font-mono">{p.date || "--"}</td>
                        <td style={{ fontWeight: "700" }}>{autoTeam.teamName}</td>
                        <td style={{ textAlign: "right", fontWeight: "800", color: "#ca8a04" }} className="font-mono">
                          ₹{(Number(p.amount) || 0).toLocaleString("en-IN")}
                        </td>
                        <td style={{ color: "var(--text-muted)", fontSize: "13px" }}>{p.notes || "—"}</td>
                        <td style={{ fontSize: "12px" }}>{p.loggedBy || "Admin"}</td>
                      </tr>
                    ))
                  )}
                </tbody>
                <tfoot>
                  <tr style={{ backgroundColor: "#f8fafc", fontWeight: "900" }}>
                    <td colSpan={2}>Total Advances Issued ({site.siteName})</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace", fontSize: "15px", color: "#ca8a04" }}>
                      ₹{siteLabourFinancials.advancePaid.toLocaleString("en-IN")}
                    </td>
                    <td colSpan={2}>—</td>
                  </tr>
                </tfoot>
              </table>
            </div>
          </Card>
        </div>
      )}

      {/* Header Bar */}
      <div className="no-print" style={{ backgroundColor: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", marginBottom: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <button type="button" onClick={onBack} className="btn btn-outline" style={{ padding: "6px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
              <ArrowLeft size={14} /> Back
            </button>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <h2 style={{ margin: 0, fontSize: "20px", fontWeight: "800", color: "#0f172a" }}>{site.siteName}</h2>
                <Badge status={site.status || "active"} />
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={13} style={{ color: "#ea580c" }} /> {site.location}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "24px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase" }}>Client</span>
              <strong style={{ color: "#0f172a", fontWeight: "700" }}>{site.clientName || "Internal Project"}</strong>
            </div>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase" }}>Assigned Engineer</span>
              <strong style={{ color: "#0f172a", fontWeight: "700" }}>{engineers.map(e => e.fullName).join(", ") || "Unassigned"}</strong>
            </div>
            <div style={{ fontSize: "12px", textAlign: "right" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase" }}>Progress</span>
              <strong style={{ color: "#16a34a", fontWeight: "800", fontSize: "16px" }}>{Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || 0))}%</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Sticky Tabs Switcher */}
      <div className="erp-tabs-list no-print" style={{ position: "sticky", top: "10px", zIndex: 90, backgroundColor: "#ffffff", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`erp-tab-button ${isActive ? "active" : ""}`}
            >
              <Icon size={14} style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }} />
              <span style={{ verticalAlign: "middle" }}>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Panels */}
      <div>
        
        {/* ===================================================================
            TAB: OVERVIEW
            =================================================================== */}
        {activeTab === "overview" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
            
            {/* COMPACT TOP ACTION / STATUS BAR */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              background: "#ffffff",
              border: "1px solid #e2e8f0",
              borderRadius: "10px",
              padding: "10px 16px"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a" }}>Today's Summary</span>
                <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>({formatDateDDMMYYYY(todayDateStr)})</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* Small Site Info Button */}
                <button
                  type="button"
                  onClick={() => setShowSiteInfoModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "5px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#334155",
                    fontSize: "12px",
                    fontWeight: "600",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f8fafc"; e.currentTarget.style.borderColor = "#94a3b8"; }}
                  onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; e.currentTarget.style.borderColor = "#cbd5e1"; }}
                >
                  <Building2 size={13} style={{ color: "#ea580c" }} />
                  <span>Site Info</span>
                </button>

                {/* Small Pending Actions Button */}
                <button
                  type="button"
                  onClick={() => setShowPendingActionsModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "6px 12px",
                    borderRadius: "6px",
                    border: pendingItemsList.length > 0 ? "1px solid #fed7aa" : "1px solid #bbf7d0",
                    backgroundColor: pendingItemsList.length > 0 ? "#fff7ed" : "#f0fdf4",
                    color: pendingItemsList.length > 0 ? "#ea580c" : "#16a34a",
                    fontSize: "12px",
                    fontWeight: "700",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                  onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                >
                  <ClipboardCheck size={13} />
                  <span>Pending Actions: {pendingItemsList.length}</span>
                </button>
              </div>
            </div>

            {/* EXACT 4 PRIMARY SUMMARY CARDS */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              
              {/* 1. TODAY LABOUR */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>TODAY LABOUR</span>
                  <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Users size={17} />
                  </div>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
                  {todayLabourCount}
                </div>
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", display: "block" }}>
                  {todayLabourCount > 0 ? `${todayLabourCount} worker${todayLabourCount !== 1 ? "s" : ""} logged today` : "0 workers logged today"}
                </span>
              </div>

              {/* 2. TODAY MATERIAL */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>TODAY MATERIAL</span>
                  <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Package size={17} />
                  </div>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
                  {todayMaterialCount}
                </div>
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", display: "block" }}>
                  {todayMaterialCount > 0 ? `${todayMaterialCount} material ${todayMaterialCount === 1 ? "entry" : "entries"} today` : "0 material entries today"}
                </span>
              </div>

              {/* 3. TODAY EXPENSE */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>TODAY EXPENSE</span>
                  <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#fef3c7", color: "#b45309", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <DollarSign size={17} />
                  </div>
                </div>
                <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
                  ₹{todayExpenseSum.toLocaleString("en-IN")}
                </div>
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", display: "block" }}>
                  {todayExpenses.length > 0 ? `${todayExpenses.length} expense ${todayExpenses.length === 1 ? "record" : "records"} today` : "₹0 logged today"}
                </span>
              </div>

              {/* 4. OVERALL PROGRESS */}
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>OVERALL PROGRESS</span>
                  <div style={{ width: "32px", height: "32px", borderRadius: "6px", backgroundColor: "#ffedd5", color: "#c2410c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Activity size={17} />
                  </div>
                </div>
                <div style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
                  {overallProgressPct}%
                </div>
                <span style={{ fontSize: "11px", color: "#64748b", marginTop: "8px", display: "block" }}>
                  {latestProgressRecord ? `Latest DPR: ${formatDateDDMMYYYY(latestProgressRecord.date)}` : "Current milestone status"}
                </span>
              </div>

            </div>

            {/* TWO COMPACT MAIN PANELS: PROGRESS SUMMARY & BUDGET SUMMARY */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "20px" }}>
              
              {/* PROGRESS SUMMARY */}
              <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                  <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "8px" }}>
                    <FileText size={16} style={{ color: "#ea580c" }} />
                    <span>Progress Summary</span>
                  </div>
                  <button 
                    type="button" 
                    onClick={() => setActiveTab("progress")} 
                    className="btn btn-outline" 
                    style={{ padding: "4px 10px", fontSize: "11.5px", fontWeight: "600" }}
                  >
                    View All DPRs →
                  </button>
                </div>

                {/* Progress bar */}
                <div style={{ marginBottom: "16px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700", marginBottom: "6px" }}>
                    <span style={{ color: "#475569" }}>Actual Completion</span>
                    <span style={{ color: "#ea580c", fontSize: "13px" }}>{overallProgressPct}%</span>
                  </div>
                  <div style={{ width: "100%", height: "8px", backgroundColor: "#f1f5f9", borderRadius: "100px", overflow: "hidden" }}>
                    <div style={{ width: `${overallProgressPct}%`, height: "100%", backgroundColor: "#ea580c", transition: "width 0.3s ease" }} />
                  </div>
                </div>

                {/* Latest actual DPR info */}
                {latestProgressRecord ? (
                  <div style={{ backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "14px 16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px", flexWrap: "wrap", gap: "6px" }}>
                      <strong style={{ fontSize: "13px", color: "#0f172a" }}>Work Update ({formatDateDDMMYYYY(latestProgressRecord.date)})</strong>
                      <span style={{ fontSize: "11px", fontWeight: "700", backgroundColor: "#dcfce7", color: "#16a34a", padding: "2px 8px", borderRadius: "100px" }}>
                        By: {latestProgressRecord.engineerName || "Site Engineer"}
                      </span>
                    </div>
                    <p style={{ margin: "0 0 6px 0", fontSize: "12.5px", color: "#334155", lineHeight: "1.45" }}>
                      {latestProgressRecord.workDone || latestProgressRecord.description || "Daily progress updates logged successfully."}
                    </p>
                    {latestProgressRecord.remarks && (
                      <div style={{ fontSize: "11.5px", color: "#64748b", fontStyle: "italic", borderTop: "1px solid #e2e8f0", paddingTop: "6px", marginTop: "6px" }}>
                        Remarks: {latestProgressRecord.remarks}
                      </div>
                    )}
                  </div>
                ) : (
                  <div style={{ textAlign: "center", padding: "24px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", color: "#64748b", fontSize: "12.5px" }}>
                    No daily progress reports logged for this site yet.
                  </div>
                )}
              </Card>

              {/* BUDGET SUMMARY */}
              <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "8px" }}>
                  <DollarSign size={16} style={{ color: "#16a34a" }} />
                  <span>Budget Summary</span>
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "600" }}>Total Budget</span>
                    <strong style={{ fontSize: "13.5px", color: "#0f172a", fontFamily: "monospace" }}>
                      {actualBudget > 0 ? `₹${actualBudget.toLocaleString("en-IN")}` : "Not Allocated"}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "600" }}>Total Used / Spent</span>
                    <strong style={{ fontSize: "13.5px", color: "#ea580c", fontFamily: "monospace" }}>
                      ₹{totalExpense.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                    <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "600" }}>Remaining Budget</span>
                    <strong style={{ fontSize: "13.5px", color: actualBudget > 0 ? (remainingBudget < 0 ? "#ef4444" : "#16a34a") : "#64748b", fontFamily: "monospace" }}>
                      {actualBudget > 0 ? `₹${remainingBudget.toLocaleString("en-IN")}` : "—"}
                    </strong>
                  </div>

                  {actualBudget > 0 && (
                    <div style={{ marginTop: "2px" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>
                        <span style={{ color: "#64748b" }}>Utilization</span>
                        <span style={{ color: budgetUtilization > 100 ? "#ef4444" : "#16a34a" }}>{budgetUtilization.toFixed(1)}%</span>
                      </div>
                      <div style={{ width: "100%", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "100px", overflow: "hidden" }}>
                        <div style={{ width: `${Math.min(budgetUtilization, 100)}%`, height: "100%", backgroundColor: budgetUtilization > 100 ? "#ef4444" : (budgetUtilization > 80 ? "#f97316" : "#16a34a") }} />
                      </div>
                    </div>
                  )}
                </div>
              </Card>

            </div>

          </div>
        )}

        {/* ===================================================================
            TAB: MATERIAL LOG
            =================================================================== */}
        {activeTab === "materials" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
            
            {/* Aggregated Totals boxes */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "16px" }}>
              <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Material Delivery Status</span>
                <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Total Required</span>
                    <strong style={{ fontSize: "20px", color: "var(--primary-900)" }}>{totalRequired}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Total Received</span>
                    <strong style={{ fontSize: "20px", color: "var(--success-700)" }}>{totalReceived}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Pending Delivery</span>
                    <strong style={{ fontSize: "20px", color: totalPendingDel > 0 ? "var(--warning-600)" : "var(--success-600)" }}>{totalPendingDel}</strong>
                  </div>
                </div>
              </div>

              <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Material Payment Status</span>
                <div style={{ display: "flex", gap: "24px", marginTop: "12px" }}>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Total Paid</span>
                    <strong style={{ fontSize: "20px", color: "var(--success-700)" }}>{totalPaid}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>Pending Payment</span>
                    <strong style={{ fontSize: "20px", color: totalPendingPay > 0 ? "var(--danger-600)" : "var(--success-600)" }}>{totalPendingPay}</strong>
                  </div>
                </div>
              </div>
            </div>

            {/* Advanced Filters */}
            <Card title="Advanced Material Filters" subtitle="Filter logs by material, supplier, date, delivery, or payment status">
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "16px", alignItems: "end" }}>
                
                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="filter-mat-name" style={{ fontSize: "11px", fontWeight: "700" }}>Material Name</label>
                  <select
                    id="filter-mat-name"
                    value={materialNameFilter}
                    onChange={(e) => setMaterialNameFilter(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#fff", marginTop: "4px", outline: "none" }}
                  >
                    <option value="">All Materials</option>
                    {uniqueMaterialNames.map(name => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="filter-supplier" style={{ fontSize: "11px", fontWeight: "700" }}>Supplier</label>
                  <select
                    id="filter-supplier"
                    value={supplierFilter}
                    onChange={(e) => setSupplierFilter(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#fff", marginTop: "4px", outline: "none" }}
                  >
                    <option value="">All Suppliers</option>
                    {uniqueSuppliers.map(sup => (
                      <option key={sup} value={sup}>{sup}</option>
                    ))}
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="filter-date" style={{ fontSize: "11px", fontWeight: "700" }}>Receipt Date</label>
                  <input
                    type="date"
                    id="filter-date"
                    value={materialDateFilter}
                    onChange={(e) => setMaterialDateFilter(e.target.value)}
                    style={{ width: "100%", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#fff", marginTop: "4px", outline: "none" }}
                  />
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="filter-delivery" style={{ fontSize: "11px", fontWeight: "700" }}>Delivery Status</label>
                  <select
                    id="filter-delivery"
                    value={deliveryFilter}
                    onChange={(e) => setDeliveryFilter(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#fff", marginTop: "4px", outline: "none" }}
                  >
                    <option value="all">All Deliveries</option>
                    <option value="Fully Delivered">Fully Delivered</option>
                    <option value="Pending Delivery">Pending Delivery</option>
                  </select>
                </div>

                <div className="form-group" style={{ margin: 0 }}>
                  <label htmlFor="filter-payment" style={{ fontSize: "11px", fontWeight: "700" }}>Payment Status</label>
                  <select
                    id="filter-payment"
                    value={paymentFilter}
                    onChange={(e) => setPaymentFilter(e.target.value)}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", backgroundColor: "#fff", marginTop: "4px", outline: "none" }}
                  >
                    <option value="all">All Payments</option>
                    <option value="Paid">Paid</option>
                    <option value="Partial Payment">Partial Payment</option>
                    <option value="Pending Payment">Pending Payment</option>
                  </select>
                </div>
              </div>
              {(materialDateFilter || materialNameFilter || supplierFilter || deliveryFilter !== "all" || paymentFilter !== "all") && (
                <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                  <Button variant="outline" size="sm" onClick={() => {
                    setMaterialDateFilter("");
                    setMaterialNameFilter("");
                    setSupplierFilter("");
                    setDeliveryFilter("all");
                    setPaymentFilter("all");
                  }}>
                    Clear Filters
                  </Button>
                </div>
              )}
            </Card>

            {/* List Table */}
            <Card 
              variant="table" 
              title="Material Logs Summary"
              headerActions={
                <Badge status="success">{filteredMaterials.length} Shipments Listed</Badge>
              }
            >
              <table className="data-table" style={{ margin: "0" }}>
                <thead>
                  <tr>
                    <th>Material / Spec</th>
                    <th>Supplier</th>
                    <th>Approval Status</th>
                    <th>Requirement vs Delivery</th>
                    <th>Payment Tracking</th>
                    <th>Receipt Date</th>
                    <th>Invoice / Slip</th>
                    <th className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredMaterials.length === 0 ? (
                    <tr>
                      <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                        No material logs found matching the selected filters.
                      </td>
                    </tr>
                  ) : (
                    filteredMaterials.map(mat => {
                      const isPendingDel = mat.deliveryStatus === "Pending Delivery";
                      const isPartialPay = mat.paymentStatus === "Partial Payment";
                      const isPendingPay = mat.paymentStatus === "Pending Payment";
                      
                      let payBadge = "success";
                      if (isPartialPay) payBadge = "pending";
                      if (isPendingPay) payBadge = "danger";

                      return (
                        <tr key={mat.id}>
                          <td style={{ fontWeight: 700 }}>
                            <div>
                              <span style={{ fontSize: "14px", color: "var(--primary-900)" }}>{mat.materialName}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal", display: "block" }}>Cat: {mat.category}</span>
                              {mat.notes && (
                                <div style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: "normal", marginTop: "2px" }}>
                                  Note: {mat.notes}
                                </div>
                              )}
                            </div>
                          </td>
                          <td>
                            <strong style={{ fontSize: "13px", color: "#334155" }}>{mat.supplierName || "--"}</strong>
                          </td>
                          <td>
                            <Badge status={mat.status || "approved"}>
                              {mat.status ? mat.status.toUpperCase() : "APPROVED"}
                            </Badge>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "2px", fontSize: "12.5px" }}>
                              <span>Required: <strong>{mat.requiredQuantity} {mat.unit || "unit"}s</strong></span>
                              <span>Received: <strong style={{ color: "var(--success-700)" }}>{mat.receivedQuantity} {mat.unit || "unit"}s</strong></span>
                              <span style={{ color: isPendingDel ? "var(--warning-600)" : "var(--success-600)", fontWeight: "600" }}>
                                Pending: {mat.pendingDelivery} {mat.unit || "unit"}s
                              </span>
                            </div>
                          </td>
                          <td>
                            <div style={{ display: "flex", flexDirection: "column", gap: "4px", fontSize: "12.5px" }}>
                              <Badge status={payBadge}>{mat.paymentStatus}</Badge>
                              <span style={{ fontSize: "11.5px", marginTop: "2px" }}>Paid: <strong>{mat.paidQuantity} {mat.unit || "unit"}s</strong></span>
                              <span style={{ fontSize: "11.5px", color: isPendingPay ? "var(--danger-600)" : "var(--text-muted)" }}>
                                Pending: <strong>{mat.pendingPayment} {mat.unit || "unit"}s</strong>
                              </span>
                            </div>
                          </td>
                          <td className="font-mono">{mat.purchaseDate || "--"}</td>
                          <td>
                            {mat.invoiceUrl ? (
                              <a href={mat.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-600)", fontWeight: "700", textDecoration: "none", fontSize: "13px" }}>
                                View Slip
                              </a>
                            ) : (
                              <span style={{ color: "var(--text-muted)", fontSize: "12px" }}>No Attachment</span>
                            )}
                          </td>
                          <td>
                            <div className="table-actions">
                              <button onClick={() => handleOpenEditMaterial(mat)} className="btn-icon btn-edit-action" title="Edit tracking values">
                                <Edit3 size={16} />
                              </button>
                              <button onClick={() => handleDeleteMaterialLog(mat.id)} className="btn-icon" title="Delete record" style={{ color: "var(--danger-500)" }}>
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

            {/* Modal: Admin Edit Material Tracking */}
            <Modal
              isOpen={showEditMaterialModal}
              onClose={() => setShowEditMaterialModal(false)}
              title="Edit Material Ledger & Tracking Details"
            >
              <form onSubmit={handleEditMaterialSubmit} style={{ margin: 0, padding: 0 }}>
                <div style={{ marginBottom: "16px", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>
                    Adjust requirement, ordering, delivery, and payment records for audits.
                  </p>
                </div>

                <div className="popup-form-grid" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px" }}>
                  
                  {/* Info block */}
                  <div className="form-group">
                    <label htmlFor="edit-name">Material Name</label>
                    <input 
                      type="text" 
                      id="edit-name" 
                      value={editMaterialName} 
                      onChange={(e) => setEditMaterialName(e.target.value)} 
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-supplier">Supplier Name</label>
                    <input 
                      type="text" 
                      id="edit-supplier" 
                      value={editSupplierName} 
                      onChange={(e) => setEditSupplierName(e.target.value)} 
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-cat">Category</label>
                    <input 
                      type="text" 
                      id="edit-cat" 
                      value={editCategory} 
                      onChange={(e) => setEditCategory(e.target.value)} 
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-unit">Unit (e.g. Bag, Load)</label>
                    <input 
                      type="text" 
                      id="edit-unit" 
                      value={editUnit} 
                      onChange={(e) => setEditUnit(e.target.value)} 
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-date">Receipt Date</label>
                    <input 
                      type="date" 
                      id="edit-date" 
                      value={editPurchaseDate} 
                      onChange={(e) => setEditPurchaseDate(e.target.value)} 
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div className="form-group" style={{ gridColumn: "span 2" }}>
                    <label htmlFor="edit-notes">Notes</label>
                    <textarea 
                      id="edit-notes" 
                      value={editNotes} 
                      onChange={(e) => setEditNotes(e.target.value)} 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)", minHeight: "60px" }}
                    />
                  </div>

                  {/* Section: Tracking quantities */}
                  <div style={{ gridColumn: "span 2", fontWeight: "800", fontSize: "13px", color: "var(--primary-800)", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px", marginTop: "8px" }}>
                    Delivery & Requirement Tracking
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-req">Required Quantity</label>
                    <input 
                      type="number" 
                      id="edit-req" 
                      value={editRequiredQuantity} 
                      onChange={(e) => setEditRequiredQuantity(Number(e.target.value))} 
                      min="0"
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-ord">Ordered Quantity</label>
                    <input 
                      type="number" 
                      id="edit-ord" 
                      value={editOrderedQuantity} 
                      onChange={(e) => setEditOrderedQuantity(Number(e.target.value))} 
                      min="0"
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-rec">Received Quantity (Deliveries)</label>
                    <input 
                      type="number" 
                      id="edit-rec" 
                      value={editQuantity} 
                      onChange={(e) => setEditQuantity(Number(e.target.value))} 
                      min="0"
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                  <div style={{ gridColumn: "span 2", fontWeight: "800", fontSize: "13px", color: "var(--primary-800)", borderBottom: "1px solid var(--border-color)", paddingBottom: "4px", marginTop: "8px" }}>
                    Payment Auditing
                  </div>

                  <div className="form-group">
                    <label htmlFor="edit-paid">Paid Quantity</label>
                    <input 
                      type="number" 
                      id="edit-paid" 
                      value={editPaidQuantity} 
                      onChange={(e) => setEditPaidQuantity(Number(e.target.value))} 
                      min="0"
                      required 
                      style={{ width: "100%", padding: "10px 12px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}
                    />
                  </div>

                </div>

                <div className="modal-actions" style={{ margin: "24px -24px -24px -24px" }}>
                  <Button variant="outline" onClick={() => setShowEditMaterialModal(false)}>Cancel</Button>
                  <Button type="submit" disabled={savingEdit}>
                    {savingEdit ? "Saving..." : "Save Changes"}
                  </Button>
                </div>
              </form>
            </Modal>

          </div>
        )}

        {/* ===================================================================
            TAB: LABOUR LOG
            =================================================================== */}
        {activeTab === "labour" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
            {/* Filter Section */}
            <Card title="Filter Logs" subtitle="Filter daily headcount logs by specific date">
              <div style={{ display: "flex", gap: "16px", alignItems: "center", flexWrap: "wrap" }}>
                <div className="form-group" style={{ margin: 0, minWidth: "240px" }}>
                  <label htmlFor="lab-date">Report Date</label>
                  <input
                    type="date"
                    id="lab-date"
                    value={labourDateFilter}
                    onChange={(e) => setLabourDateFilter(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "10px 12px",
                      borderRadius: "var(--radius-sm)",
                      border: "1px solid var(--border-color)",
                      outline: "none",
                      marginTop: "4px"
                    }}
                  />
                </div>
                {labourDateFilter && (
                  <Button variant="outline" onClick={() => setLabourDateFilter("")} style={{ marginTop: "20px" }}>
                    Clear Filter
                  </Button>
                )}
              </div>
            </Card>

            {/* List Table */}
            <Card 
              variant="table" 
              title="Daily Labour Headcount History"
              headerActions={
                <Badge status="success">{filteredLabour.length} Records Found</Badge>
              }
            >
              <table className="data-table" style={{ margin: "0" }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Type</th>
                    <th>Details</th>
                    <th style={{ textAlign: "right" }}>Attendance (Days)</th>
                    <th style={{ textAlign: "right" }}>Rate / Wage (₹)</th>
                    <th style={{ textAlign: "right" }}>Accrued Cost (₹)</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredLabour.length === 0 ? (
                    <tr>
                      <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                        No labour logs found for the selected filter.
                      </td>
                    </tr>
                  ) : (
                    filteredLabour.map((row, idx) => {
                      if (row.memberId !== undefined) {
                        // New member attendance
                        const cost = (Number(row.wage) || 0) * (Number(row.units) || 0);
                        return (
                          <tr key={row.id || idx}>
                            <td style={{ fontWeight: 700 }} className="font-mono">{row.date}</td>
                            <td><Badge status="success">Member Attendance</Badge></td>
                            <td>
                              <div style={{ display: "flex", flexDirection: "column" }}>
                                <span style={{ fontWeight: "700" }}>{row.memberName}</span>
                                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                                  ID: {row.memberId} | Team: {row.teamName} | Cat: {row.categoryName}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{row.units} Day</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>₹{row.wage}</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>₹{cost}</td>
                          </tr>
                        );
                      } else {
                        // Legacy headcount row
                        let dayCost = 0;
                        const details = [];
                        Object.keys(row).forEach(key => {
                          if (key === "date" || key === "total" || key === "engineerId" || key === "id" || key === "siteId") return;
                          const count = Number(row[key]) || 0;
                          if (count > 0) {
                            details.push(`${key}: ${count}`);
                            let rate = 600;
                            if (key === "Masons") rate = 800;
                            else if (key === "Helpers") rate = 500;
                            else if (key === "Electricians" || key === "Plumbers" || key === "Painters") rate = 700;
                            dayCost += count * rate;
                          }
                        });
                        return (
                          <tr key={row.id || idx} style={{ backgroundColor: "#f9fafb" }}>
                            <td style={{ fontWeight: 700 }} className="font-mono">{row.date}</td>
                            <td><Badge status="pending">Legacy Headcount</Badge></td>
                            <td>
                              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                                {details.join(" · ") || "0 Workers"}
                              </div>
                            </td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>{row.total || 0} Workers</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace" }}>--</td>
                            <td style={{ textAlign: "right", fontFamily: "monospace", fontWeight: "700" }}>₹{dayCost}</td>
                          </tr>
                        );
                      }
                    })
                  )}
                </tbody>
              </table>
            </Card>
          </div>
        )}

        {/* ===================================================================
            TAB: ATTENDANCE / ENTRY EXIT
            =================================================================== */}
        {activeTab === "attendance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
            <Card title="Engineer Attendance Records">
              {attendance.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>No attendance submissions found for this site.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {attendance.map((record, index) => {
                    const eng = engineers.find(e => e.id === record.engineerId) || { fullName: `Engineer (ID: ${record.engineerId})` };
                    return (
                      <div key={record.id || index} style={{
                        padding: "12px",
                        borderRadius: "8px",
                        backgroundColor: "var(--primary-50)",
                        border: "1px solid var(--border-color)",
                        display: "flex",
                        alignItems: "flex-start",
                        gap: "12px"
                      }}>
                        {record.photoUrl && (
                          <img 
                            src={record.photoUrl} 
                            alt="Selfie Verification" 
                            style={{ width: "40px", height: "40px", borderRadius: "6px", objectFit: "cover", flexShrink: 0, border: "1px solid var(--border-color)" }} 
                          />
                        )}
                        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1, gap: "2px" }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-900)" }}>{eng.fullName}</span>
                            <Badge status="success">Present</Badge>
                          </div>
                          <span style={{ fontSize: "11.5px", fontWeight: "600", color: "var(--primary-750)" }} className="font-mono">
                            Date: {record.date} ({record.time || "--"})
                          </span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                            Address: {record.address || "GPS Captured"}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ===================================================================
            TAB: PROGRESS
            =================================================================== */}
        {activeTab === "progress" && (() => {
          const planned = calculatePlannedProgress(site.startDate, site.expectedEndDate);
          let actual = 0;
          if (site.status === "Completed") {
            actual = 100;
          } else if (progressUpdates.length > 0) {
            const sorted = [...progressUpdates].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            actual = Number(String(sorted[0].progress).replace(/%/g, '')) || 0;
          }
          
          const gap = actual - planned;
          const statusText = gap >= 0 ? "Ahead of Schedule" : "Delayed";
          const statusBadge = gap >= 0 ? "success" : "danger";
          
          const weeklyReports = generateWeeklyReportFromDprs(progressUpdates);

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
              
              {/* Planned vs Actual summary */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(250px, 1fr))", gap: "20px" }}>
                <Card>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Planned Completion Date</span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                    <Calendar size={18} style={{ color: "var(--primary-600)" }} />
                    <span style={{ fontSize: "18px", fontWeight: "800", color: "var(--primary-900)" }} className="font-mono">{site.expectedEndDate || "No date set"}</span>
                  </div>
                </Card>

                <Card>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Milestone Progress comparison</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "8px" }}>
                    <div>
                      <span style={{ fontSize: "22px", fontWeight: "800", color: "var(--primary-900)" }}>{actual}%</span>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)", marginLeft: "4px" }}>actual</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "16px", fontWeight: "700", color: "var(--text-muted)" }}>vs {planned}%</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", marginLeft: "2px" }}>target</span>
                    </div>
                  </div>
                </Card>

                <Card>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700" }}>Schedule standing</span>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "8px" }}>
                    <Badge status={statusBadge}>{statusText}</Badge>
                    <span style={{ fontSize: "13px", fontWeight: "800", color: gap >= 0 ? "var(--success-700)" : "var(--danger-700)" }}>
                      {gap >= 0 ? `+${gap}%` : `${gap}%`}
                    </span>
                  </div>
                </Card>
              </div>

              {/* Weekly Reports checklist card */}
              <Card title="Auto-Generated Weekly Progress Reports" subtitle="Synthesized from daily site entries without duplication.">
                {weeklyReports.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic", textAlign: "center", padding: "10px" }}>
                    No weekly reports available.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {weeklyReports.map((report, idx) => (
                      <div key={idx} style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "16px", backgroundColor: "#f8fafc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", borderBottom: "1.5px solid var(--border-color)", paddingBottom: "8px", marginBottom: "10px" }}>
                          <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--primary-900)" }}>{report.weekLabel}</span>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--success-700)", backgroundColor: "var(--success-50)", padding: "2px 8px", borderRadius: "6px" }}>
                            Progress: {report.startProgress}% → {report.endProgress}% (Change: +{report.progressChange}%)
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", fontSize: "12.5px" }}>
                          <div>
                            <strong style={{ display: "block", color: "var(--primary-900)", marginBottom: "4px" }}>Completed Work:</strong>
                            <p style={{ margin: 0, color: "#334155" }}>{report.completedWork}</p>
                          </div>
                          <div>
                            <strong style={{ display: "block", color: "var(--primary-900)", marginBottom: "4px" }}>Pending Activities:</strong>
                            <p style={{ margin: 0, color: "#334155" }}>{report.pendingActivities}</p>
                          </div>
                        </div>
                        {report.delayReasons !== "No major issues faced" && (
                          <div style={{ marginTop: "12px", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--danger-50)", padding: "8px 12px", borderRadius: "6px", fontSize: "12px" }}>
                            <AlertCircle size={14} style={{ color: "var(--danger-600)", flexShrink: 0 }} />
                            <span style={{ color: "var(--danger-700)", fontWeight: "600" }}><strong>Delay issues faced:</strong> {report.delayReasons}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* Daily timeline logs detailed view */}
              <Card title="Daily Progress Timeline Logs" subtitle="Thorough inspection of entries registered by site engineer.">
                {progressUpdates.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                    No daily progress logs submitted yet for this site.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "24px", paddingLeft: "16px", borderLeft: "2.5px solid var(--primary-100)", marginLeft: "12px" }}>
                    {progressUpdates.map((update, index) => {
                      const eng = engineers.find(e => e.id === update.engineerId) || { fullName: `Engineer (ID: ${update.engineerId})` };
                      const formattedDate = update.createdAt?.seconds 
                        ? new Date(update.createdAt.seconds * 1000).toLocaleString()
                        : (update.createdAt ? new Date(update.createdAt).toLocaleString() : "--");

                      return (
                        <div key={update.id || index} style={{ position: "relative" }}>
                          <div style={{
                            position: "absolute",
                            left: "-25px",
                            top: "2px",
                            width: "15px",
                            height: "15px",
                            borderRadius: "50%",
                            backgroundColor: "var(--primary-600)",
                            border: "3px solid #ffffff",
                            boxShadow: "0 0 0 2px var(--primary-100)"
                          }} />
                          
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "700" }}>{update.date || formattedDate}</span>
                            <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--primary-750)", backgroundColor: "var(--primary-100)", padding: "2px 8px", borderRadius: "6px" }}>
                              {update.progress || "0%"} Completed
                            </span>
                          </div>
                          
                          <h4 style={{ margin: "6px 0 4px 0", fontSize: "14px", fontWeight: "700", color: "var(--primary-950)" }}>
                            Reported by {eng.fullName}
                          </h4>

                          {/* Expanded detailed notes */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "10px", padding: "14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid var(--border-color)", fontSize: "12.5px" }}>
                            <div>
                              <strong style={{ color: "var(--primary-900)" }}>Work Completed:</strong>
                              <p style={{ margin: "2px 0 0 0", color: "#334155" }}>{update.completedToday || update.description}</p>
                            </div>
                            {update.currentlyRunning && (
                              <div>
                                <strong style={{ color: "var(--primary-900)" }}>Work Currently Running:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155" }}>{update.currentlyRunning}</p>
                              </div>
                            )}
                            {update.materialsStatus && (
                              <div>
                                <strong style={{ color: "var(--primary-900)" }}>Materials/Work Status:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155" }}>{update.materialsStatus}</p>
                              </div>
                            )}
                            {update.problemsFaced && (
                              <div>
                                <strong style={{ color: "var(--danger-700)" }}>Problems Faced:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "var(--danger-800)" }}>{update.problemsFaced}</p>
                              </div>
                            )}
                            {update.pendingWork && (
                              <div>
                                <strong style={{ color: "var(--primary-900)" }}>Pending Work:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155" }}>{update.pendingWork}</p>
                              </div>
                            )}
                            {update.nextActivity && (
                              <div>
                                <strong style={{ color: "var(--primary-900)" }}>Next Planned Activity:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155" }}>{update.nextActivity}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </Card>

            </div>
          );
        })()}

        {/* ===================================================================
            TAB: PHOTOS
            =================================================================== */}
        {activeTab === "photos" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
            <Card title="Site Inspection Gallery">
              {photos.length === 0 ? (
                <p style={{ color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic", textAlign: "center", padding: "20px" }}>
                  No photos uploaded for this site.
                </p>
              ) : (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))",
                  gap: "16px"
                }}>
                  {photos.map((photo, index) => {
                    const eng = engineers.find(e => e.id === photo.engineerId) || { fullName: `Engineer (ID: ${photo.engineerId})` };
                    
                    return (
                      <div key={photo.id || index} style={{
                        borderRadius: "8px",
                        border: "1px solid var(--border-color)",
                        overflow: "hidden",
                        backgroundColor: "#ffffff",
                        boxShadow: "var(--shadow-sm)"
                      }}>
                        <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", cursor: "zoom-in" }}>
                          <img 
                            src={photo.imageUrl} 
                            alt={`Site visual upload ${index + 1}`}
                            onError={(e) => {
                              e.target.src = "https://images.unsplash.com/photo-1581094288338-2314dddb7eed?auto=format&fit=crop&w=400&q=80";
                            }}
                            style={{ width: "100%", height: "150px", objectFit: "cover" }}
                          />
                        </a>
                        <div style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px" }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)" }}>
                              Uploaded By: {photo.engineerName || eng.fullName}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                              Site: {photo.siteName || site?.siteName || "Unknown"}
                            </span>
                            {photo.photoType && (
                              <span style={{ fontSize: "10px", color: "var(--accent-600)", fontWeight: "600" }}>
                                Type: {photo.photoType}
                              </span>
                            )}
                          </div>
                          <div style={{ borderTop: "1px solid var(--border-color)", paddingTop: "6px", fontSize: "11px", color: "var(--text-muted)", fontWeight: "500" }}>
                            {photo.createdDate} at {photo.createdTime}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ===================================================================
            TAB: REPORTS (PRINTABLE AUDIT LEDGER)
            =================================================================== */}
        {activeTab === "reports" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            
            {/* Header Control for Report (Hidden in print) */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              backgroundColor: "var(--primary-50)",
              border: "1px solid var(--primary-200)",
              padding: "16px 20px",
              borderRadius: "8px"
            }} className="no-print">
              <div>
                <strong style={{ fontSize: "14px", color: "var(--primary-900)", display: "block" }}>Print Audit Summary</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>Format this page as a structured paper/PDF layout for reporting purposes.</span>
              </div>
              <Button onClick={handlePrint} icon={Printer} style={{ backgroundColor: "var(--primary-800)", color: "#ffffff" }}>
                Print Report
              </Button>
            </div>

            {/* Printable Report Document Card */}
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              padding: "32px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              gap: "24px"
            }} className="printable-report">
              
              {/* Document Header */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "3px solid #1e293b", paddingBottom: "16px" }}>
                <div>
                  <h1 style={{ margin: 0, fontSize: "22px", fontWeight: "900", color: "#0f172a" }}>SITE OPERATION AUDIT REPORT</h1>
                  <span style={{ fontSize: "13px", fontWeight: "600", color: "#475569" }}>Generated on {new Date().toLocaleDateString()}</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800", color: "#1e293b" }}>{site.siteName}</h2>
                  <span style={{ fontSize: "12px", color: "#475569" }}>Status: <strong>{site.status || "Planning"}</strong></span>
                </div>
              </div>

              {/* Site Specs Grid */}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "16px", backgroundColor: "#f8fafc", padding: "16px", borderRadius: "6px" }}>
                <div>
                  <span style={{ fontSize: "10px", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: "800" }}>Client Name</span>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>{site.clientName || "--"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: "800" }}>Location Address</span>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }}>{site.location}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: "800" }}>Start Date</span>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }} className="font-mono">{site.startDate || "--"}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "10px", color: "#64748b", display: "block", textTransform: "uppercase", fontWeight: "800" }}>Expected End Date</span>
                  <strong style={{ fontSize: "13px", color: "#0f172a" }} className="font-mono">{site.expectedEndDate || "--"}</strong>
                </div>
              </div>

              {/* Section 1: Materials Aggregated Consumption */}
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "800", borderBottom: "1.5px solid #cbd5e1", paddingBottom: "6px", marginBottom: "12px", color: "#0f172a" }}>
                  1. MATERIAL LEDGER SUMMARY (CONSOLIDATED INPUTS)
                </h3>
                {aggregatedMaterials.length === 0 ? (
                  <p style={{ fontStyle: "italic", fontSize: "12px", color: "#64748b" }}>No materials registered for this site.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                    <thead>
                      <tr style={{ borderBottom: "1px solid #94a3b8", textAlign: "left" }}>
                        <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569" }}>Material Name</th>
                        <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569", textAlign: "right" }}>Required</th>
                        <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569", textAlign: "right" }}>Received</th>
                        <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569", textAlign: "right" }}>Pending Delivery</th>
                        <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569", textAlign: "right" }}>Paid</th>
                        <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569", textAlign: "right" }}>Pending Payment</th>
                      </tr>
                    </thead>
                    <tbody>
                      {aggregatedMaterials.map((item, index) => (
                        <tr key={index} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "8px 4px", fontWeight: "700" }}>{item.name}</td>
                          <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "600" }}>{item.required} {item.unit}s</td>
                          <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "600" }}>{item.received} {item.unit}s</td>
                          <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "600" }}>{item.pendingDel} {item.unit}s</td>
                          <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "600" }}>{item.paid} {item.unit}s</td>
                          <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "600" }}>{item.pendingPay} {item.unit}s</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>

              {/* Section 2: Labour Days / Totals */}
              <div>
                <h3 style={{ fontSize: "14px", fontWeight: "800", borderBottom: "1.5px solid #cbd5e1", paddingBottom: "6px", marginBottom: "12px", color: "#0f172a" }}>
                  2. LABOR AUDIT REPORT (TOTAL WORKER-DAYS RECORDED)
                </h3>
                {labourHistory.length === 0 ? (
                  <p style={{ fontStyle: "italic", fontSize: "12px", color: "#64748b" }}>No labour headcount records found.</p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <div style={{ fontSize: "13px" }}>
                      Total Active Record Days: <strong>{labourSummaryMap.totalDays} Days</strong>
                    </div>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #94a3b8", textAlign: "left" }}>
                          <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569" }}>Trade Category</th>
                          <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569", textAlign: "right" }}>Total Worker-Days logged</th>
                          <th style={{ padding: "8px 4px", fontWeight: "800", color: "#475569", textAlign: "right" }}>Average Daily Workers</th>
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { key: "Masons", label: "Masons" },
                          { key: "Helpers", label: "Helpers" },
                          { key: "Painters", label: "Painters" },
                          { key: "Plumbers", label: "Plumbers" },
                          { key: "Electricians", label: "Electricians" },
                          { key: "Others", label: "Others" }
                        ].map((cat, idx) => {
                          const totalDays = labourSummaryMap.totalDays || 1;
                          const totalValue = labourSummaryMap[cat.key];
                          const avgValue = (totalValue / totalDays).toFixed(1);
                          return (
                            <tr key={idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "8px 4px", fontWeight: "700" }}>{cat.label}</td>
                              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "700" }}>{totalValue}</td>
                              <td style={{ padding: "8px 4px", textAlign: "right", fontWeight: "700" }}>{avgValue}</td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Signature block */}
              <div style={{ marginTop: "40px", borderTop: "1.5px dashed #cbd5e1", paddingTop: "24px", display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px" }}>
                <div>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Audited By (Admin Signature)</span>
                  <div style={{ height: "40px" }} />
                  <span style={{ fontSize: "12px", borderTop: "1px solid #64748b", display: "inline-block", minWidth: "180px", paddingTop: "4px" }}>Visvas Administration</span>
                </div>
                <div style={{ textAlign: "right" }}>
                  <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>Site Supervisor Sign-Off</span>
                  <div style={{ height: "40px" }} />
                  <span style={{ fontSize: "12px", borderTop: "1px solid #64748b", display: "inline-block", minWidth: "180px", paddingTop: "4px" }}>Project Engineer</span>
                </div>
              </div>

            </div>
          </div>
        )}

      </div>

      {/* MODAL: COMPACT SITE INFORMATION */}
      <Modal
        isOpen={showSiteInfoModal}
        onClose={() => setShowSiteInfoModal(false)}
        title="Site Information"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "12px", fontSize: "13px", padding: "4px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Site Name</span>
            <strong style={{ color: "#0f172a" }}>{site.siteName}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Client / Owner</span>
            <strong style={{ color: "#0f172a" }}>{site.clientName || "Internal Project"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Location</span>
            <strong style={{ color: "#0f172a", textAlign: "right", maxWidth: "260px" }}>{site.location || "—"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Assigned Engineer(s)</span>
            <strong style={{ color: "#0f172a" }}>{engineers.map(e => e.fullName).join(", ") || "Unassigned"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Project Status</span>
            <Badge status={(site.status || "Planning").toLowerCase()}>{site.status || "Planning"}</Badge>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Timeline</span>
            <strong style={{ color: "#0f172a" }}>{formatDateDDMMYYYY(site.startDate)} to {formatDateDDMMYYYY(site.expectedEndDate)}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>GPS Radius</span>
            <strong style={{ color: "#0f172a" }}>{site.radius ? `${site.radius}m` : "100m"}</strong>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Allocated Budget</span>
            <strong style={{ color: "#0f172a", fontFamily: "monospace" }}>
              {actualBudget > 0 ? `₹${actualBudget.toLocaleString("en-IN")}` : "Not Allocated"}
            </strong>
          </div>
        </div>
        <div style={{ marginTop: "18px", textAlign: "right" }}>
          <Button variant="outline" onClick={() => setShowSiteInfoModal(false)}>Close</Button>
        </div>
      </Modal>

      {/* MODAL: COMPACT PENDING ACTIONS */}
      <Modal
        isOpen={showPendingActionsModal}
        onClose={() => setShowPendingActionsModal(false)}
        title="Pending Site Actions"
      >
        <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "4px 0" }}>
          {pendingItemsList.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 16px", color: "#16a34a" }}>
              <CheckCircle2 size={32} style={{ margin: "0 auto 8px" }} />
              <div style={{ fontWeight: "700", fontSize: "14px" }}>All Actions Completed!</div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>No pending reports, deliveries, or approvals for this site.</div>
            </div>
          ) : (
            pendingItemsList.map((item, idx) => (
              <div
                key={idx}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  borderRadius: "8px",
                  border: "1px solid #e2e8f0",
                  backgroundColor: "#f8fafc"
                }}
              >
                <div>
                  <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a" }}>{item.title}</div>
                  <div style={{ fontSize: "11.5px", color: "#ea580c", fontWeight: "600" }}>{item.status}</div>
                </div>
                {item.linkTab && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setShowPendingActionsModal(false);
                      setActiveTab(item.linkTab);
                    }}
                    style={{ fontSize: "11.5px", padding: "4px 10px" }}
                  >
                    Resolve →
                  </Button>
                )}
              </div>
            ))
          )}
        </div>
        <div style={{ marginTop: "18px", textAlign: "right" }}>
          <Button variant="outline" onClick={() => setShowPendingActionsModal(false)}>Close</Button>
        </div>
      </Modal>

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />
    </Layout>
  );
}

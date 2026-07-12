import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
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
  subscribeGeneralExpenses
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
  Trash2
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
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

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

  const handleDeleteMaterialLog = async (materialId) => {
    if (confirm("Are you sure you want to delete this material log record? This action cannot be undone.")) {
      try {
        await deleteMaterial(materialId);
        showToast("Material record deleted successfully.", "success");
        await loadData();
      } catch (err) {
        console.error(err);
        showToast(`Failed to delete record: ${err.message}`, "error");
      }
    }
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
        progress
      ] = await Promise.all([
        getMaterialsDetailed(siteId),
        getLabourDailyCountsSummary(siteId),
        getAttendanceForSite(siteId),
        getDailyUpdatesForSite(siteId)
      ]);

      setMaterials(mats);
      setLabourHistory(labour);
      setAttendance(attend);
      setProgressUpdates(progress);

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

  // Materials spent
  const matSpent = processedMaterials.reduce((acc, m) => acc + ((m.receivedQuantity || m.quantity || 0) * (m.unitPrice || 0)), 0);

  const totalSpent = matSpent + laborSpent;
  let budget = site.budget !== undefined && site.budget !== null ? Number(site.budget) : null;
  if (budget === null || isNaN(budget)) {
    const siteSeed = site.id.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    budget = (50 + (siteSeed % 50)) * 100000;
  }
  
  // Dynamic Total Expense = Sum of all approved expenses for the selected site
  const approvedExpenses = expenses.filter(e => e.status === "Approved" || e.status === "approved");
  const totalExpense = approvedExpenses.reduce((acc, curr) => acc + (Number(curr.amount) || 0), 0);
  const remainingBudget = budget - totalExpense;
  const budgetUtilization = budget > 0 ? (totalExpense / budget) * 100 : 0;

  // Handle Print Action for Reports tab
  const handlePrint = () => {
    window.print();
  };

  const tabs = [
    { id: "overview", label: "Overview", icon: Building2 },
    { id: "materials", label: "Material Log", icon: Package },
    { id: "labour", label: "Labour Log", icon: Users },
    { id: "attendance", label: "Attendance / Entry Exit", icon: ClipboardCheck },
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

      {/* Header Back Bar */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }} className="no-print">
        <Button variant="outline" icon={ArrowLeft} onClick={onBack}>
          Back to Sites List
        </Button>
        <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>
          Site Status: <Badge status={site.status || "Planning"} />
        </span>
      </div>

      {/* Site Header Panel */}
      <div style={{
        backgroundColor: "#ffffff",
        borderRadius: "var(--radius-md)",
        border: "1px solid var(--border-color)",
        padding: "24px",
        marginBottom: "24px",
        boxShadow: "var(--shadow-sm)",
        display: "flex",
        flexDirection: "column",
        gap: "16px"
      }} className="no-print">
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "24px", fontWeight: "800", color: "var(--primary-950)" }}>{site.siteName}</h2>
            <p style={{ margin: "4px 0 0 0", fontSize: "14px", color: "var(--text-muted)", fontWeight: "500", display: "flex", alignItems: "center", gap: "6px" }}>
              <MapPin size={16} /> {site.location}
            </p>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "24px", textAlign: "right" }}>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Start Date</span>
              <strong style={{ fontSize: "14px", color: "var(--primary-900)" }} className="font-mono">{site.startDate || "--"}</strong>
            </div>
            <div>
              <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Expected End</span>
              <strong style={{ fontSize: "14px", color: "var(--primary-900)" }} className="font-mono">{site.expectedEndDate || "--"}</strong>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs Switcher */}
      <div style={{
        display: "flex",
        gap: "4px",
        borderBottom: "2px solid var(--border-color)",
        marginBottom: "24px",
        overflowX: "auto",
        paddingBottom: "2px"
      }} className="no-print">
        {tabs.map(tab => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                padding: "12px 20px",
                border: "none",
                backgroundColor: isActive ? "var(--primary-50)" : "transparent",
                color: isActive ? "var(--primary-750)" : "var(--text-muted)",
                fontSize: "14px",
                fontWeight: isActive ? "800" : "600",
                cursor: "pointer",
                borderBottom: isActive ? "3px solid var(--primary-600)" : "3px solid transparent",
                borderRadius: "var(--radius-sm) var(--radius-sm) 0 0",
                transition: "all 0.15s ease",
                whiteSpace: "nowrap"
              }}
            >
              <Icon size={16} />
              {tab.label}
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
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
            {/* Quick Metrics Grid */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: "16px" }}>
              <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Materials Shipments</span>
                <strong style={{ fontSize: "28px", color: "var(--primary-900)", display: "block", marginTop: "8px" }}>{materials.length}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>total registered ledger inputs</span>
              </div>
              <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Daily Labor Submissions</span>
                <strong style={{ fontSize: "28px", color: "var(--primary-900)", display: "block", marginTop: "8px" }}>{labourHistory.length}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>active days reported</span>
              </div>
              <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Progress Updates</span>
                <strong style={{ fontSize: "28px", color: "var(--primary-900)", display: "block", marginTop: "8px" }}>{progressUpdates.length}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>field progress milestones</span>
              </div>
              <div style={{ backgroundColor: "#ffffff", padding: "20px", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Uploaded Photos</span>
                <strong style={{ fontSize: "28px", color: "var(--primary-900)", display: "block", marginTop: "8px" }}>{photos.length}</strong>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "4px" }}>inspection snaps</span>
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
              {/* Budget Tracking Card */}
              <Card title="Financial & Budget Audit" subtitle="Real-time site budget utilization against actual expenses">
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "4px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Total Site Budget</span>
                    <span style={{ fontWeight: "800", color: "var(--primary-900)", fontFamily: "monospace" }}>₹{budget.toLocaleString("en-IN")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Total Approved Expense</span>
                    <span style={{ fontWeight: "800", color: "var(--primary-900)", fontFamily: "monospace" }}>₹{totalExpense.toLocaleString("en-IN")}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Remaining Budget</span>
                    <span style={{ fontWeight: "800", color: remainingBudget < 0 ? "var(--danger-700)" : "var(--success-700)", fontFamily: "monospace" }}>
                      ₹{remainingBudget.toLocaleString("en-IN")}
                    </span>
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", fontWeight: "700" }}>
                      <span style={{ color: "var(--text-muted)" }}>Budget Utilization</span>
                      <span style={{ color: budgetUtilization > 100 ? "var(--danger-700)" : (budgetUtilization > 80 ? "var(--warning-700)" : "var(--success-700)") }}>
                        {budgetUtilization.toFixed(1)}%
                      </span>
                    </div>
                    {/* Clean Progress Bar */}
                    <div style={{ width: "100%", height: "10px", backgroundColor: "#e2e8f0", borderRadius: "5px", overflow: "hidden" }}>
                      <div style={{
                        width: `${Math.min(budgetUtilization, 100)}%`,
                        height: "100%",
                        backgroundColor: budgetUtilization > 100 ? "#b3261e" : (budgetUtilization > 80 ? "#e65100" : "#2e7d32"),
                        borderRadius: "5px",
                        transition: "width 0.4s ease"
                      }} />
                    </div>
                  </div>
                  
                  {/* Warning Alerts */}
                  {budgetUtilization > 100 ? (
                    <div style={{ backgroundColor: "#fde8e8", border: "1px solid #f8b4b4", borderRadius: "8px", padding: "10px", color: "#b3261e", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertCircle size={16} /> ⚠️ DANGER: site expenses have exceeded 100% of the allocated budget!
                    </div>
                  ) : budgetUtilization > 80 ? (
                    <div style={{ backgroundColor: "#fff3e0", border: "1px solid #ffe0b2", borderRadius: "8px", padding: "10px", color: "#e65100", fontSize: "12px", fontWeight: "600", display: "flex", alignItems: "center", gap: "6px" }}>
                      <AlertCircle size={16} /> ⚠️ WARNING: site expenses have exceeded 80% of the allocated budget.
                    </div>
                  ) : null}
                </div>
              </Card>

              {/* Site Details card */}
              <Card title="Site Specifications">
                <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "4px 0" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Client / Owner</span>
                    <span style={{ fontWeight: "700", color: "var(--primary-900)" }}>{site.clientName || "--"}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Site Address</span>
                    <span style={{ fontWeight: "700", color: "var(--primary-900)", textAlign: "right", maxWidth: "200px" }}>{site.location}</span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Established GPS Coordinates</span>
                    <span style={{ fontWeight: "700", color: "var(--primary-900)", fontFamily: "monospace" }}>
                      {site.latitude && site.longitude ? `${Number(site.latitude).toFixed(6)}, ${Number(site.longitude).toFixed(6)}` : "Not Established"}
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", paddingBottom: "4px" }}>
                    <span style={{ fontWeight: "600", color: "var(--text-muted)" }}>Fence Radius</span>
                    <span style={{ fontWeight: "700", color: "var(--primary-900)" }}>{site.radius ? `${site.radius} meters` : "100 meters"}</span>
                  </div>
                </div>
              </Card>

              {/* Assigned Site Engineers card */}
              <Card title="Assigned Site Engineers" subtitle="Personnel designated to capture site records">
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {engineers.length === 0 ? (
                    <p style={{ color: "var(--text-muted)", fontSize: "14px", fontStyle: "italic", margin: 0 }}>
                      No engineers assigned to this site currently.
                    </p>
                  ) : (
                    engineers.map(eng => (
                      <div key={eng.id} style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "12px",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        backgroundColor: "var(--primary-50)",
                        border: "1px solid var(--border-color)"
                      }}>
                        <div style={{
                          width: "32px",
                          height: "32px",
                          borderRadius: "50%",
                          backgroundColor: "var(--primary-200)",
                          color: "var(--primary-800)",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontWeight: "800",
                          fontSize: "12px"
                        }}>
                          {eng.fullName ? eng.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "SE"}
                        </div>
                        <div style={{ display: "flex", flexDirection: "column", flexGrow: 1 }}>
                          <span style={{ fontSize: "13.5px", fontWeight: "700", color: "var(--primary-900)" }}>{eng.fullName}</span>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>{eng.email} • {eng.phoneNumber}</span>
                        </div>
                        <Badge status={eng.status || "active"} />
                      </div>
                    ))
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
                  <span style={{ fontSize: "12px", borderTop: "1px solid #64748b", display: "inline-block", minWidth: "180px", paddingTop: "4px" }}>Apex Administration</span>
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
    </Layout>
  );
}

import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import { useAuth } from "../context/AuthContext";
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
  getLabourTeams,
  subscribeMaterialsDetailed,
  subscribeMaterialTransfersForSite,
  subscribeLabourAttendanceRecords,
  markSiteCompleted,
  reopenSite
} from "../services/firebaseService";
import { 
  processMaterialPaymentAndDelivery, 
  formatProgress, 
  generateWeeklyReportFromDprs, 
  calculatePlannedProgress, 
  computeSitePendingItemsSummary,
  formatINR,
  getSiteBudget,
  formatDateDDMonthYYYY
} from "../services/businessLogic";
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
  AlertTriangle,
  X,
  Eye,
  Truck,
  ArrowRightLeft,
  Inbox,
  Lock,
  Unlock,
  Archive,
  Shield,
  ShieldCheck,
  LogIn,
  LogOut
} from "lucide-react";
import AdminAssistedEntryModal from "../components/common/AdminAssistedEntryModal";
import EngineerActivityDashboard from "./EngineerActivityDashboard";

// Date formatting helpers for 30-day range and ISO conversions
const formatDateForInput = (d) => {
  if (!d || isNaN(new Date(d).getTime())) return "";
  const dateObj = new Date(d);
  const year = dateObj.getFullYear();
  const month = String(dateObj.getMonth() + 1).padStart(2, '0');
  const day = String(dateObj.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const getInitial30DayRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: formatDateForInput(from),
    to: formatDateForInput(to)
  };
};

const formatDisplayDate = (dateVal) => {
  if (!dateVal) return "--";
  const s = String(dateVal).trim();
  const parts = s.split("-");
  if (parts.length === 3 && parts[0].length === 4) {
    const d = new Date(Number(parts[0]), Number(parts[1]) - 1, Number(parts[2]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  const slashParts = s.split("/");
  if (slashParts.length === 3) {
    const d = new Date(Number(slashParts[2]), Number(slashParts[1]) - 1, Number(slashParts[0]));
    if (!isNaN(d.getTime())) {
      return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
    }
  }
  return s;
};

const normalizeDateToISO = (dateVal) => {
  if (!dateVal) return "";
  const s = String(dateVal).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const parts = s.split("/");
  if (parts.length === 3) {
    const [d, m, y] = parts;
    return `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, '0');
    const day = String(parsed.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }
  return s;
};

export default function SiteDetails({ siteId, onBack }) {
  const { userProfile } = useAuth();
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
  const [siteTransfers, setSiteTransfers] = useState([]);
  
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("overview");
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  const [showSiteInfoModal, setShowSiteInfoModal] = useState(false);
  const [showPendingActionsModal, setShowPendingActionsModal] = useState(false);
  const [showAdminEntryModal, setShowAdminEntryModal] = useState(false);

  // Engineer Activity Dashboard navigation state
  const [selectedEngineerForActivity, setSelectedEngineerForActivity] = useState(null);

  // 30-Day Site Attendance History Modal State
  const [showSiteAttendanceModal, setShowSiteAttendanceModal] = useState(false);
  const [siteModalFromDate, setSiteModalFromDate] = useState(() => getInitial30DayRange().from);
  const [siteModalToDate, setSiteModalToDate] = useState(() => getInitial30DayRange().to);
  const [siteAppliedModalRange, setSiteAppliedModalRange] = useState(() => getInitial30DayRange());
  const [selectedAttendancePhotoModal, setSelectedAttendancePhotoModal] = useState(null);

  // Completion Workflow Modal State
  const [completionModal, setCompletionModal] = useState({
    isOpen: false,
    step: 1, // 1: Audit Review, 2: Confirmation 1, 3: Confirmation 2
    acknowledgedPending: false,
    completionNotes: "",
    isSubmitting: false
  });

  // Reopen Site Modal State
  const [reopenModal, setReopenModal] = useState({
    isOpen: false,
    reopenNotes: "",
    isSubmitting: false
  });

  const isSiteCompleted = (site?.status || "").toLowerCase() === "completed" || site?.isCompleted === true;

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
  const [labourDateFilter, setLabourDateFilter] = useState(new Date().toISOString().split("T")[0]);


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

  // Material Details Modal State
  const [selectedMaterialForDetails, setSelectedMaterialForDetails] = useState(null);
  const [showMaterialDetailsModal, setShowMaterialDetailsModal] = useState(false);

  // Material Transfers History & SubTab States
  const [materialSubTab, setMaterialSubTab] = useState("logs"); // "logs" | "transfers"
  const [transferFilterMode, setTransferFilterMode] = useState("all"); // "all" | "outgoing" | "incoming"

  const handleOpenMaterialDetails = (mat) => {
    setSelectedMaterialForDetails(mat);
    setShowMaterialDetailsModal(true);
  };

  // Labour Record Details Modal State
  const [selectedLabourForDetails, setSelectedLabourForDetails] = useState(null);
  const [showLabourDetailsModal, setShowLabourDetailsModal] = useState(false);

  const handleOpenLabourDetails = (record) => {
    setSelectedLabourForDetails(record);
    setShowLabourDetailsModal(true);
  };

  const pendingAudit = useMemo(() => {
    return computeSitePendingItemsSummary(
      siteId,
      materials,
      siteTransfers,
      expenses,
      labourHistory,
      sitePayments,
      progressUpdates
    );
  }, [siteId, materials, siteTransfers, expenses, labourHistory, sitePayments, progressUpdates]);

  const handleOpenCompletionModal = () => {
    setCompletionModal({
      isOpen: true,
      step: 1,
      acknowledgedPending: !pendingAudit.hasPendingItems,
      completionNotes: "",
      isSubmitting: false
    });
  };

  const handleConfirmCompletion = async () => {
    setCompletionModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await markSiteCompleted(siteId, {
        completedBy: userProfile?.uid || "admin",
        completedByName: userProfile?.fullName || "Admin",
        notes: completionModal.completionNotes.trim()
      });
      showToast(`Site marked as Completed (Read-Only Archive).`, "success");
      setCompletionModal({ isOpen: false, step: 1, acknowledgedPending: false, completionNotes: "", isSubmitting: false });
      await loadData();
    } catch (err) {
      console.error("Error completing site:", err);
      showToast(`Failed to complete site: ${err.message}`, "error");
      setCompletionModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

  const handleConfirmReopen = async () => {
    setReopenModal(prev => ({ ...prev, isSubmitting: true }));
    try {
      await reopenSite(siteId, {
        reopenedBy: userProfile?.uid || "admin",
        reopenedByName: userProfile?.fullName || "Admin",
        notes: reopenModal.reopenNotes.trim()
      });
      showToast(`Site reopened successfully and set to In Progress.`, "success");
      setReopenModal({ isOpen: false, reopenNotes: "", isSubmitting: false });
      await loadData();
    } catch (err) {
      console.error("Error reopening site:", err);
      showToast(`Failed to reopen site: ${err.message}`, "error");
      setReopenModal(prev => ({ ...prev, isSubmitting: false }));
    }
  };

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
      // Fetch all site details and related logs concurrently
      const [
        fetchedSites,
        fetchedEngineers,
        mats,
        labour,
        attend,
        progress,
        payments,
        fetchedTeams
      ] = await Promise.all([
        getSites(),
        getSiteEngineers(),
        getMaterialsDetailed(siteId),
        getLabourDailyCountsSummary(siteId),
        getAttendanceForSite(siteId),
        getDailyUpdatesForSite(siteId),
        getLabourPayments(siteId),
        getLabourTeams()
      ]);

      const currentSite = fetchedSites.find(s => s.id === siteId);
      if (!currentSite) {
        showToast("Site not found.", "error");
        onBack();
        return;
      }
      setSite(currentSite);

      const assigned = fetchedEngineers.filter(eng => {
        const isDirect = currentSite.assignedEngineers && (
          currentSite.assignedEngineers.includes(eng.id) ||
          currentSite.assignedEngineers.includes(eng.uid) ||
          currentSite.assignedEngineers.includes(eng.customId) ||
          currentSite.assignedEngineers.includes(eng.engineerId) ||
          (eng.email && currentSite.assignedEngineers.includes(eng.email))
        );
        const isReverse = Array.isArray(eng.assignedSites) && eng.assignedSites.includes(currentSite.id);
        return isDirect || isReverse;
      });
      setEngineers(assigned);

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

  useEffect(() => {
    if (!siteId) return;
    const unsubscribe = subscribeMaterialsDetailed(siteId, (mats) => {
      setMaterials(mats || []);
    });
    const unsubTransfers = subscribeMaterialTransfersForSite(siteId, (txs) => {
      setSiteTransfers(txs || []);
    });
    const unsubLabour = subscribeLabourAttendanceRecords(siteId, async () => {
      try {
        const freshLabour = await getLabourDailyCountsSummary(siteId);
        setLabourHistory(freshLabour || []);
      } catch (err) {
        console.error("Error updating site labour history:", err);
      }
    });
    return () => {
      unsubscribe();
      unsubTransfers();
      unsubLabour();
    };
  }, [siteId]);

  if (loading) {
    return (
      <Layout title="Site Details" description="Loading detailed resource logs...">
        <Loading show={true} text="Synchronizing site databases..." />
      </Layout>
    );
  }

  // If viewing a selected engineer's activity dashboard from Site Details
  if (selectedEngineerForActivity) {
    return (
      <EngineerActivityDashboard 
        engineerId={selectedEngineerForActivity} 
        onBack={() => setSelectedEngineerForActivity(null)} 
      />
    );
  }

  if (!site) return null;

  // Canonical Site Engineer Attendance records (deduplicated and sorted descending by date/time)
  const canonicalSiteEngineerAttendance = (attendance || [])
    .filter(r => 
      r.type !== "labour_attendance_lock" && 
      !String(r.id || "").startsWith("labour_lock_") && 
      !String(r.id || "").startsWith("lock_")
    )
    .sort((a, b) => {
      const dateA = normalizeDateToISO(a.date || a.attendanceDate || "");
      const dateB = normalizeDateToISO(b.date || b.attendanceDate || "");
      if (dateA !== dateB) return dateB.localeCompare(dateA);
      const timeA = a.timestamp?.seconds || (a.timestamp ? new Date(a.timestamp).getTime() : 0);
      const timeB = b.timestamp?.seconds || (b.timestamp ? new Date(b.timestamp).getTime() : 0);
      return timeB - timeA;
    });

  const latestSiteAttendanceRecord = canonicalSiteEngineerAttendance.length > 0 ? canonicalSiteEngineerAttendance[0] : null;

  const modalFilteredSiteAttendance = canonicalSiteEngineerAttendance.filter(rec => {
    const normDate = normalizeDateToISO(rec.date || rec.attendanceDate || "");
    if (!normDate) return false;
    if (siteAppliedModalRange.from && normDate < siteAppliedModalRange.from) return false;
    if (siteAppliedModalRange.to && normDate > siteAppliedModalRange.to) return false;
    return true;
  });

  const renderSiteAttendanceTable = (records = []) => {
    if (!records || records.length === 0) {
      return (
        <div style={{ padding: "32px 16px", textAlign: "center", backgroundColor: "var(--primary-50)", borderRadius: "8px", border: "1px dashed var(--border-color)" }}>
          <ClipboardCheck size={36} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "8px" }} />
          <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0 }}>
            No attendance records found for this site.
          </p>
        </div>
      );
    }

    return (
      <div style={{ 
        overflowX: "auto", 
        border: "1px solid var(--border-color)", 
        borderRadius: "8px", 
        backgroundColor: "#ffffff",
        boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
      }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px", textAlign: "left" }}>
          <thead>
            <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid var(--border-color)" }}>
              <th style={{ padding: "10px 12px", width: "56px", textAlign: "center", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Photo</th>
              <th style={{ padding: "10px 12px", width: "160px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Site Engineer</th>
              <th style={{ padding: "10px 12px", width: "125px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Date</th>
              <th style={{ padding: "10px 12px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Site</th>
              <th style={{ padding: "10px 12px", width: "115px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Check-in</th>
              <th style={{ padding: "10px 12px", width: "115px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Check-out</th>
              <th style={{ padding: "10px 12px", width: "120px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Status</th>
              <th style={{ padding: "10px 12px", width: "130px", color: "#475569", fontWeight: "750", fontSize: "11.5px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Verification</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record, idx) => {
              const eng = engineers.find(e => e.id === record.engineerId || e.id === record.userId) || { fullName: record.engineerName || `Engineer (ID: ${record.engineerId || record.userId})` };
              const recDate = record.date || record.attendanceDate || "--";
              const checkInTime = record.checkInTimeFormatted || record.time || "--";
              const checkOutTime = record.checkOutTimeFormatted;
              const isCheckedOut = record.isCheckedOut || record.status === "checked_out" || Boolean(checkOutTime);
              const photoUrl = record.photoUrl || record.checkInPhotoUrl;
              const isVerified = record.verificationStatus === "verified" || record.isVerified;

              return (
                <tr 
                  key={record.id || `site_att_row_${record.engineerId}_${recDate}_${idx}`} 
                  style={{ 
                    borderBottom: idx < records.length - 1 ? "1px solid #f1f5f9" : "none",
                    transition: "background-color 0.15s ease"
                  }}
                  onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                  onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                >
                  {/* Photo Column */}
                  <td style={{ padding: "8px 12px", textAlign: "center", verticalAlign: "middle" }}>
                    {photoUrl ? (
                      <img 
                        src={photoUrl} 
                        alt="Selfie"
                        onClick={() => setSelectedAttendancePhotoModal({ url: photoUrl, title: `Selfie Verification - ${eng.fullName} (${recDate})` })}
                        style={{
                          width: "36px",
                          height: "36px",
                          borderRadius: "6px",
                          objectFit: "cover",
                          border: "1px solid #cbd5e1",
                          cursor: "pointer",
                          display: "inline-block",
                          verticalAlign: "middle"
                        }}
                        title="Click to expand verification selfie"
                      />
                    ) : (
                      <div style={{
                        width: "36px",
                        height: "36px",
                        borderRadius: "6px",
                        backgroundColor: "#f1f5f9",
                        color: "#64748b",
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid #e2e8f0",
                        verticalAlign: "middle",
                        margin: "0 auto"
                      }}>
                        <ClipboardCheck size={16} />
                      </div>
                    )}
                  </td>

                  {/* Site Engineer Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <strong style={{ fontSize: "13px", color: "var(--primary-950)", fontWeight: "750" }}>
                      {eng.fullName}
                    </strong>
                  </td>

                  {/* Date Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <span className="font-mono" style={{ fontWeight: "700", color: "#0f172a", fontSize: "13px" }}>
                      {formatDisplayDate(recDate)}
                    </span>
                    {recDate !== formatDisplayDate(recDate) && (
                      <span className="font-mono" style={{ display: "block", fontSize: "10.5px", color: "#64748b" }}>
                        {recDate}
                      </span>
                    )}
                  </td>

                  {/* Site Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle" }}>
                    <strong style={{ color: "#1e293b", fontSize: "13px", display: "block" }}>
                      {site.siteName}
                    </strong>
                    <span style={{ fontSize: "11px", color: "#64748b" }}>
                      {eng.fullName}
                    </span>
                    {record.distance !== undefined && record.distance !== null && (
                      <span style={{ display: "block", fontSize: "10.5px", color: Number(record.distance) <= 500 ? "#15803d" : "#b45309", fontWeight: "600" }}>
                        🎯 {Math.round(record.distance)}m from site
                      </span>
                    )}
                  </td>

                  {/* Check-in Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                      <LogIn size={13} style={{ color: "#16a34a" }} />
                      <span className="font-mono" style={{ fontWeight: "700", color: "#15803d", fontSize: "12.5px" }}>
                        {checkInTime}
                      </span>
                    </div>
                  </td>

                  {/* Check-out Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    {checkOutTime ? (
                      <div style={{ display: "inline-flex", alignItems: "center", gap: "5px" }}>
                        <LogOut size={13} style={{ color: "#4338ca" }} />
                        <span className="font-mono" style={{ fontWeight: "700", color: "#3730a3", fontSize: "12.5px" }}>
                          {checkOutTime}
                        </span>
                      </div>
                    ) : isCheckedOut ? (
                      <span style={{ fontSize: "12px", color: "#4338ca", fontWeight: "600" }}>
                        Logged Out
                      </span>
                    ) : (
                      <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                        —
                      </span>
                    )}
                  </td>

                  {/* Status Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    <Badge status={isCheckedOut ? "info" : "success"}>
                      {isCheckedOut ? "Checked Out" : "Present"}
                    </Badge>
                  </td>

                  {/* Verification Column */}
                  <td style={{ padding: "8px 12px", verticalAlign: "middle", whiteSpace: "nowrap" }}>
                    {isVerified ? (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "#059669",
                        backgroundColor: "#ecfdf5",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        border: "1px solid #a7f3d0"
                      }}>
                        <ShieldCheck size={12} />
                        Verified
                      </span>
                    ) : (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "4px",
                        fontSize: "11px",
                        fontWeight: "600",
                        color: "#64748b",
                        backgroundColor: "#f1f5f9",
                        padding: "3px 8px",
                        borderRadius: "12px",
                        border: "1px solid #e2e8f0"
                      }}>
                        Logged
                      </span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  // Map materials to include derived tracking values strictly for this site
  const siteMaterials = materials.filter(m => m.siteId === siteId);
  const processedMaterials = siteMaterials.map(mat => processMaterialPaymentAndDelivery(mat));

  // Filter materials based on compact active filters
  const filteredMaterials = processedMaterials.filter(mat => {
    if (materialDateFilter && (mat.purchaseDate !== materialDateFilter && mat.transferDate !== materialDateFilter)) return false;
    if (deliveryFilter !== "all" && mat.deliveryStatus !== deliveryFilter) return false;
    if (paymentFilter !== "all" && mat.paymentStatus !== paymentFilter) return false;
    return true;
  });

  // Aggregated totals for summary boxes
  const hasRequiredQuantity = processedMaterials.some(m => m.requiredQuantity && m.requiredQuantity > (m.receivedQuantity || 0));
  const totalRequired = processedMaterials.reduce((acc, mat) => acc + (mat.requiredQuantity || 0), 0);
  const totalReceived = processedMaterials.reduce((acc, mat) => acc + (mat.receivedQuantity || 0), 0);
  const totalPendingDel = processedMaterials.reduce((acc, mat) => acc + (mat.pendingDelivery || 0), 0);
  const totalMaterialValue = processedMaterials.reduce((acc, mat) => acc + (mat.totalAmount || 0), 0);
  const totalPaid = processedMaterials.reduce((acc, mat) => acc + (mat.paidAmount || mat.paidQuantity || 0), 0);
  const totalPendingPay = processedMaterials.reduce((acc, mat) => acc + (mat.pendingPayment || 0), 0);

  // Filter labour by date (defaults to today's date)
  const filteredLabour = labourHistory.filter(row => {
    const rowDate = row.date || row.attendanceDate;
    if (!labourDateFilter) return true;
    return rowDate === labourDateFilter;
  });

  // Calculate Daily Labour Summary for the selected site and date directly from canonical records
  let dailyTotalWorkers = 0;
  let dailyPresent = 0;
  let dailyAbsent = 0;
  let dailyTotalWage = 0;
  let dailyTotalLabourCost = 0;

  filteredLabour.forEach(row => {
    if (row.memberId !== undefined || row.workerCount !== undefined || row.calculatedAmount !== undefined || row.totalAmount !== undefined) {
      const count = Number(row.workerCount !== undefined ? row.workerCount : 1) || 1;
      const customUnits = Number(row.customWorkUnits !== undefined ? row.customWorkUnits : (row.units !== undefined ? row.units : (row.attendanceType === "Half Day" ? 0.5 : 1.0))) || 1.0;
      const wage = Number(row.dailyWage !== undefined ? row.dailyWage : (row.wage || row.baseWage || 0));
      const earnedCost = Number(row.calculatedAmount !== undefined ? row.calculatedAmount : (row.totalAmount !== undefined ? row.totalAmount : (count * customUnits * wage))) || 0;

      dailyTotalWorkers += count;
      if (customUnits > 0) {
        dailyPresent += count;
      } else {
        dailyAbsent += count;
      }
      dailyTotalWage += (count * customUnits * wage);
      dailyTotalLabourCost += earnedCost;
    } else {
      // Legacy headcount row
      const legacyTotal = Number(row.total) || 0;
      dailyTotalWorkers += legacyTotal;
      dailyPresent += legacyTotal;
      let dayCost = 0;
      Object.keys(row).forEach(key => {
        if (key === "date" || key === "total" || key === "engineerId" || key === "id" || key === "siteId") return;
        const count = Number(row[key]) || 0;
        let rate = 600;
        if (key === "Masons") rate = 800;
        else if (key === "Helpers") rate = 500;
        else if (key === "Electricians" || key === "Plumbers" || key === "Painters") rate = 700;
        dayCost += count * rate;
      });
      dailyTotalWage += dayCost;
      dailyTotalLabourCost += dayCost;
    }
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
    if (row.memberId !== undefined || row.workerCount !== undefined || row.calculatedAmount !== undefined || row.totalAmount !== undefined) {
      const count = Number(row.workerCount !== undefined ? row.workerCount : 1) || 1;
      const customUnits = Number(row.customWorkUnits !== undefined ? row.customWorkUnits : (row.units !== undefined ? row.units : (row.attendanceType === "Half Day" ? 0.5 : 1.0))) || 1.0;
      const wage = Number(row.dailyWage !== undefined ? row.dailyWage : (row.wage || row.baseWage || 0));
      const cost = Number(row.calculatedAmount !== undefined ? row.calculatedAmount : (row.totalAmount !== undefined ? row.totalAmount : (count * customUnits * wage))) || 0;
      laborSpent += cost;
      const cat = row.categoryName || "";
      const totalRowUnits = count * customUnits;
      if (cat.includes("Mason")) labourSummaryMap.Masons += totalRowUnits;
      else if (cat.includes("Helper")) labourSummaryMap.Helpers += totalRowUnits;
      else if (cat.includes("Painter")) labourSummaryMap.Painters += totalRowUnits;
      else if (cat.includes("Plumber")) labourSummaryMap.Plumbers += totalRowUnits;
      else if (cat.includes("Electrician")) labourSummaryMap.Electricians += totalRowUnits;
      else labourSummaryMap.Others += totalRowUnits;
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
  const actualBudget = getSiteBudget(site);
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
    { id: "photos", label: "Photos", icon: Camera }
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

          {/* Labour Advance Entry Form or Read-Only Notice */}
          <Card title="Labour Advance Payments" subtitle={isSiteCompleted ? `Historical advance records for ${site.siteName} (Read-Only)` : `Post an advance payment linked to ${site.siteName}`}>
            {isSiteCompleted ? (
              <div style={{ padding: "14px 16px", backgroundColor: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", color: "#64748b", fontSize: "13px", fontWeight: "600", display: "flex", alignItems: "center", gap: "8px" }}>
                <Lock size={16} style={{ color: "#166534" }} />
                <span>This site is marked as Completed. New labour advances cannot be recorded in read-only archive mode.</span>
              </div>
            ) : (
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
            )}
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
                <Badge status={isSiteCompleted ? "completed" : (site.status || "active")}>
                  {isSiteCompleted ? "COMPLETED" : (site.status || "ACTIVE")}
                </Badge>
              </div>
              <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b", display: "flex", alignItems: "center", gap: "4px" }}>
                <MapPin size={13} style={{ color: "#ea580c" }} /> {site.location}
              </p>
            </div>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "18px", flexWrap: "wrap" }}>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase" }}>Client</span>
              <strong style={{ color: "#0f172a", fontWeight: "700" }}>{site.clientName || "Internal Project"}</strong>
            </div>
            <div style={{ fontSize: "12px" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase" }}>Assigned Engineer</span>
              {engineers.length === 0 ? (
                <strong style={{ color: "#0f172a", fontWeight: "700" }}>Unassigned</strong>
              ) : (
                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                  {engineers.map(e => (
                    <span key={e.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                      <strong style={{ color: "#0f172a", fontWeight: "700" }}>{e.fullName}</strong>
                      <button
                        type="button"
                        className="btn-icon btn-view-action"
                        onClick={() => setSelectedEngineerForActivity(e.id)}
                        title={`View ${e.fullName}'s activity dashboard`}
                        style={{
                          width: "20px",
                          height: "20px",
                          padding: 0,
                          display: "inline-flex",
                          alignItems: "center",
                          justifyContent: "center",
                          borderRadius: "4px",
                          border: "1px solid #bfdbfe",
                          backgroundColor: "#eff6ff",
                          color: "#2563eb",
                          cursor: "pointer"
                        }}
                      >
                        <Eye size={11} />
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div style={{ fontSize: "12px", textAlign: "right" }}>
              <span style={{ color: "#64748b", display: "block", fontSize: "10.5px", fontWeight: "700", textTransform: "uppercase" }}>Progress</span>
              <strong style={{ color: "#16a34a", fontWeight: "800", fontSize: "16px" }}>{isSiteCompleted ? 100 : Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || 0))}%</strong>
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
              {!isSiteCompleted && (
                <button
                  type="button"
                  onClick={() => setShowAdminEntryModal(true)}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1.5px solid #bfdbfe",
                    backgroundColor: "#eff6ff",
                    color: "#1d4ed8",
                    fontSize: "12.5px",
                    fontWeight: "750",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                  title="Record labour, materials, or progress on behalf of assigned engineer when unavailable"
                >
                  <Shield size={14} />
                  <span>Add Entry for Engineer</span>
                </button>
              )}

              {!isSiteCompleted ? (
                <button
                  type="button"
                  onClick={handleOpenCompletionModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "none",
                    backgroundColor: "#ea580c",
                    color: "#ffffff",
                    fontSize: "12.5px",
                    fontWeight: "750",
                    cursor: "pointer",
                    boxShadow: "0 1px 3px rgba(234,88,12,0.25)",
                    transition: "all 0.15s ease"
                  }}
                >
                  <CheckCircle2 size={14} />
                  <span>Mark as Completed</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setReopenModal({ isOpen: true, reopenNotes: "", isSubmitting: false })}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#f8fafc",
                    color: "#334155",
                    fontSize: "12.5px",
                    fontWeight: "750",
                    cursor: "pointer",
                    transition: "all 0.15s ease"
                  }}
                >
                  <Unlock size={14} />
                  <span>Reopen Site</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Prominent Read-Only Archive Banner if Site is Completed */}
      {isSiteCompleted && (
        <div className="no-print" style={{
          backgroundColor: "#f0fdf4",
          border: "1.5px solid #bbf7d0",
          borderRadius: "12px",
          padding: "14px 18px",
          marginBottom: "16px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: "12px",
          boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
        }}>
          <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{
              width: "36px",
              height: "36px",
              borderRadius: "8px",
              backgroundColor: "#dcfce7",
              color: "#166534",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0
            }}>
              <Lock size={20} />
            </div>
            <div>
              <strong style={{ fontSize: "14px", color: "#14532d", display: "block" }}>
                COMPLETED / READ-ONLY ARCHIVE
              </strong>
              <span style={{ fontSize: "12.5px", color: "#15803d" }}>
                Completed on {site.completedAt?.seconds ? new Date(site.completedAt.seconds * 1000).toLocaleDateString("en-IN") : "Record Complete"}{site.completedByName ? ` by ${site.completedByName}` : ""}. All historical materials, worker attendance, and reports are preserved in read-only mode.
              </span>
            </div>
          </div>
          <span style={{
            fontSize: "11.5px",
            fontWeight: "800",
            padding: "4px 10px",
            borderRadius: "8px",
            backgroundColor: "#dcfce7",
            color: "#166534",
            border: "1px solid #86efac"
          }}>
            Historical Ledger
          </span>
        </div>
      )}

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
                        {actualBudget > 0 ? formatINR(actualBudget) : "Not Allocated"}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "600" }}>Total Used / Spent</span>
                      <strong style={{ fontSize: "13.5px", color: "#ea580c", fontFamily: "monospace" }}>
                        {formatINR(totalExpense)}
                      </strong>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
                      <span style={{ fontSize: "12.5px", color: "#64748b", fontWeight: "600" }}>Remaining Budget</span>
                      <strong style={{ fontSize: "13.5px", color: actualBudget > 0 ? (remainingBudget < 0 ? "#ef4444" : "#16a34a") : "#64748b", fontFamily: "monospace" }}>
                        {actualBudget > 0 ? formatINR(remainingBudget) : "—"}
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
            TAB: MATERIAL LOG (SITE-SPECIFIC SINGLE SOURCE OF TRUTH)
            =================================================================== */}
        {activeTab === "materials" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
            
            {/* Top Compact Summary: Delivery & Payment Status */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "14px" }}>
              {/* Delivery Status Card */}
              <div style={{
                backgroundColor: "#ffffff",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>
                  Material Delivery Status
                </span>
                <div style={{ display: "flex", gap: "24px", alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Total Received</span>
                    <strong style={{ fontSize: "22px", color: "var(--success-700)", fontFamily: "monospace" }}>{totalReceived}</strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Pending Delivery</span>
                    <strong style={{ fontSize: "22px", color: totalPendingDel > 0 ? "#ea580c" : "var(--success-700)", fontFamily: "monospace" }}>
                      {totalPendingDel}
                    </strong>
                  </div>
                  {hasRequiredQuantity && (
                    <div>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Total Required</span>
                      <strong style={{ fontSize: "22px", color: "var(--primary-900)", fontFamily: "monospace" }}>{totalRequired}</strong>
                    </div>
                  )}
                </div>
              </div>

              {/* Material Value & Payment Status Card */}
              <div style={{
                backgroundColor: "#ffffff",
                padding: "16px 20px",
                borderRadius: "12px",
                border: "1px solid var(--border-color)",
                boxShadow: "0 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "10px"
              }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>
                  Material Value & Payments
                </span>
                <div style={{ display: "flex", gap: "24px", alignItems: "baseline", flexWrap: "wrap" }}>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Total Value</span>
                    <strong style={{ fontSize: "22px", color: "var(--primary-900)", fontFamily: "monospace" }}>
                      ₹{totalMaterialValue.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Total Paid</span>
                    <strong style={{ fontSize: "22px", color: "var(--success-700)", fontFamily: "monospace" }}>
                      ₹{totalPaid.toLocaleString("en-IN")}
                    </strong>
                  </div>
                  <div>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Pending Payment</span>
                    <strong style={{ fontSize: "22px", color: totalPendingPay > 0 ? "#dc2626" : "var(--success-700)", fontFamily: "monospace" }}>
                      ₹{totalPendingPay.toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>
              </div>
            </div>

            {/* View Sub-Tabs: Material Logs vs Transfer History */}
            <div style={{
              display: "flex",
              backgroundColor: "var(--primary-100)",
              padding: "4px",
              borderRadius: "24px",
              boxShadow: "inset 0px 1px 2px rgba(0,0,0,0.03)",
              gap: "4px",
              maxWidth: "380px"
            }}>
              <button
                type="button"
                onClick={() => setMaterialSubTab("logs")}
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  borderRadius: "20px",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: materialSubTab === "logs" ? "#ffffff" : "transparent",
                  color: materialSubTab === "logs" ? "#ea580c" : "#64748b",
                  boxShadow: materialSubTab === "logs" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                Material Logs ({filteredMaterials.length})
              </button>
              <button
                type="button"
                onClick={() => setMaterialSubTab("transfers")}
                style={{
                  flex: 1,
                  padding: "8px 14px",
                  borderRadius: "20px",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  border: "none",
                  cursor: "pointer",
                  backgroundColor: materialSubTab === "transfers" ? "#ffffff" : "transparent",
                  color: materialSubTab === "transfers" ? "#ea580c" : "#64748b",
                  boxShadow: materialSubTab === "transfers" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
                  transition: "all 0.2s ease"
                }}
              >
                Transfers ({siteTransfers.length})
              </button>
            </div>

            {/* ── VIEW 1: MATERIAL LOGS TABLE ── */}
            {materialSubTab === "logs" && (
              <>
                {/* Compact Useful Filter Toolbar */}
                <div style={{
                  backgroundColor: "#ffffff",
                  padding: "12px 16px",
                  borderRadius: "10px",
                  border: "1px solid var(--border-color)",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  flexWrap: "wrap"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                    <Filter size={15} style={{ color: "var(--text-muted)" }} />
                    <span style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>Filters:</span>
                  </div>

                  {/* Date Filter */}
                  <div style={{ minWidth: "140px" }}>
                    <input
                      type="date"
                      value={materialDateFilter}
                      onChange={(e) => setMaterialDateFilter(e.target.value)}
                      title="Filter by receipt / purchase date"
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", fontSize: "12px", outline: "none" }}
                    />
                  </div>

                  {/* Delivery Status Filter */}
                  <div style={{ minWidth: "150px" }}>
                    <select
                      value={deliveryFilter}
                      onChange={(e) => setDeliveryFilter(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", fontSize: "12px", backgroundColor: "#fff", outline: "none" }}
                    >
                      <option value="all">All Deliveries</option>
                      <option value="Fully Delivered">Fully Delivered</option>
                      <option value="Pending Delivery">Pending Delivery</option>
                      <option value="In Transit">In Transit</option>
                    </select>
                  </div>

                  {/* Payment Status Filter */}
                  <div style={{ minWidth: "150px" }}>
                    <select
                      value={paymentFilter}
                      onChange={(e) => setPaymentFilter(e.target.value)}
                      style={{ width: "100%", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", fontSize: "12px", backgroundColor: "#fff", outline: "none" }}
                    >
                      <option value="all">All Payments</option>
                      <option value="Paid">Paid</option>
                      <option value="Partial Payment">Partial Payment</option>
                      <option value="Pending Payment">Pending Payment</option>
                    </select>
                  </div>

                  {/* Clear Filters Button */}
                  {(materialDateFilter || deliveryFilter !== "all" || paymentFilter !== "all") && (
                    <button
                      type="button"
                      onClick={() => {
                        setMaterialDateFilter("");
                        setDeliveryFilter("all");
                        setPaymentFilter("all");
                      }}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--danger-600)",
                        fontSize: "12px",
                        fontWeight: "750",
                        cursor: "pointer",
                        padding: "4px 8px",
                        textDecoration: "underline"
                      }}
                    >
                      Clear Filters
                    </button>
                  )}
                </div>

                {/* Main Material Logs Table */}
                <Card 
                  variant="table" 
                  title="Material Log Summary"
                  subtitle="Showing material inventory entries, transfers, and shipments for this site."
                  headerActions={
                    <Badge status="success">{filteredMaterials.length} Records</Badge>
                  }
                >
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: "0" }}>
                  <thead>
                    <tr>
                      <th>Material</th>
                      <th style={{ textAlign: "right" }}>Quantity</th>
                      <th>Unit</th>
                      <th>Status</th>
                      <th style={{ textAlign: "right" }}>Amount</th>
                      <th style={{ textAlign: "center" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredMaterials.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: "center", color: "var(--text-muted)", padding: "36px 16px" }}>
                          <Package size={28} style={{ color: "#94a3b8", display: "block", margin: "0 auto 8px auto" }} />
                          <strong style={{ fontSize: "14px", color: "#475569", display: "block" }}>No material records yet for this site.</strong>
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>Recorded materials and transfers will appear here automatically.</span>
                        </td>
                      </tr>
                    ) : (
                      filteredMaterials.map(mat => {
                        const isTransfer = mat.type === "material_transfer" || mat.isIncomingTransfer;
                        const isApproved = mat.status === "Approved" || mat.status === "approved" || mat.status === "Received" || mat.status === "received";
                        const isCustomerAmountOnly = mat.materialType === "customer_amount_only" || mat.type === "customer_amount_only";
                        const isCustom = mat.materialType === "custom" || mat.type === "custom";
                        const isRateOnly = mat.materialType === "rate_only" || mat.type === "rate_only";
                        const isCustomerType = isCustom || isCustomerAmountOnly;
                        const amountNum = Number(mat.totalAmount !== undefined ? mat.totalAmount : (mat.amount !== undefined ? mat.amount : (mat.receivedQuantity * (mat.unitPrice || mat.rate || 0))));
                        const displayName = (mat.materialName || mat.title || "").trim() || (isCustomerAmountOnly ? "Customer Amount" : (isRateOnly ? "Rate Item" : "Material"));

                        return (
                          <tr 
                            key={mat.id}
                            onClick={() => handleOpenMaterialDetails(mat)}
                            style={{ cursor: "pointer", transition: "background-color 0.15s ease" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}
                          >
                            <td style={{ fontWeight: 700 }}>
                              <div>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "14px", color: "var(--primary-900)" }}>{displayName}</span>
                                  {isCustomerType && (
                                    <span style={{ fontSize: "10.5px", color: "#16a34a", backgroundColor: "#f0fdf4", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bbf7d0", fontWeight: "750" }}>
                                      {isCustomerAmountOnly ? "Customer Amount" : "Customer"}
                                    </span>
                                  )}
                                  {isRateOnly && (
                                    <span style={{ fontSize: "10.5px", color: "#7c3aed", backgroundColor: "#f5f3ff", padding: "1px 6px", borderRadius: "4px", border: "1px solid #ddd6fe", fontWeight: "750" }}>
                                      Rate Only
                                    </span>
                                  )}
                                  <span style={{ fontSize: "10.5px", color: "#ea580c", backgroundColor: "#fff7ed", padding: "1px 6px", borderRadius: "4px", border: "1px solid #fed7aa", fontWeight: "750" }}>
                                    {mat.category}
                                  </span>
                                  {isTransfer && (
                                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#1d4ed8", backgroundColor: "#eff6ff", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bfdbfe" }}>
                                      From {mat.sourceSiteName || "Other Site"}
                                    </span>
                                  )}
                                  {mat.transfersOut && mat.transfersOut.length > 0 && (
                                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#c2410c", backgroundColor: "#fff7ed", padding: "1px 6px", borderRadius: "4px", border: "1px solid #fed7aa" }}>
                                      Transferred Out ({mat.transferredOutQuantity || 0} {mat.unit})
                                    </span>
                                  )}
                                  {(mat.isAdminEntry || mat.createdVia === "admin_assisted_entry") && (
                                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#1d4ed8", backgroundColor: "#eff6ff", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bfdbfe" }} title={`Admin Override Entry by ${mat.createdByName || "Admin"}`}>
                                      🛡️ Admin Entry
                                    </span>
                                  )}
                                </div>
                                <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "normal", display: "block", marginTop: "2px" }}>
                                  {mat.purchaseDate || mat.transferDate ? `Date: ${mat.purchaseDate || mat.transferDate}` : ""} {mat.supplierName ? `• Supplier: ${mat.supplierName}` : ""}{mat.isAdminEntry ? ` • By Admin: ${mat.createdByName || "Admin"}` : ""}
                                </span>
                              </div>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "700" }}>
                              <span style={{ fontSize: "14px", color: mat.receivedQuantity > 0 ? "var(--success-700)" : "#475569" }}>
                                {mat.receivedQuantity || 0}
                              </span>
                              {mat.pendingDelivery > 0 && (
                                <span style={{ display: "block", fontSize: "10.5px", color: "#ea580c", fontWeight: "600" }}>
                                  ({mat.pendingDelivery} pending)
                                </span>
                              )}
                            </td>
                            <td style={{ color: "#475569", fontWeight: "600", fontSize: "13px" }}>
                              {mat.unit || "Unit"}
                            </td>
                            <td>
                              <Badge status={isApproved ? "success" : mat.status === "Rejected" ? "danger" : "pending"}>
                                {mat.deliveryStatus || (mat.status ? mat.status.toUpperCase() : "PENDING")}
                              </Badge>
                            </td>
                            <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", fontSize: "13.5px", color: "var(--primary-900)" }}>
                              ₹{amountNum.toLocaleString("en-IN")}
                            </td>
                            <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                              <div className="table-actions" style={{ justifyContent: "center" }}>
                                <button 
                                  onClick={() => handleOpenMaterialDetails(mat)} 
                                  className="btn-icon btn-view-action" 
                                  title="View complete details"
                                >
                                  <Eye size={16} />
                                </button>
                                {!isSiteCompleted && (
                                  <>
                                    <button 
                                      onClick={() => handleOpenEditMaterial(mat)} 
                                      className="btn-icon btn-edit-action" 
                                      title="Edit tracking values"
                                    >
                                      <Edit3 size={16} />
                                    </button>
                                    <button 
                                      onClick={() => handleDeleteMaterialLog(mat.id)} 
                                      className="btn-icon btn-delete-action" 
                                      title="Delete record"
                                    >
                                      <Trash2 size={16} />
                                    </button>
                                  </>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </Card>
          </>
        )}

        {/* ── VIEW 2: MATERIAL TRANSFERS HISTORY TABLE & LIST ── */}
        {materialSubTab === "transfers" && (() => {
          const outgoingCount = siteTransfers.filter(t => t.isOutgoing).length;
          const incomingCount = siteTransfers.filter(t => t.isIncoming).length;
          const displayedTransfers = siteTransfers.filter(t => {
            if (transferFilterMode === "outgoing") return t.isOutgoing;
            if (transferFilterMode === "incoming") return t.isIncoming;
            return true;
          });

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Filter pills */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
                <button
                  type="button"
                  onClick={() => setTransferFilterMode("all")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "750",
                    border: "1px solid",
                    borderColor: transferFilterMode === "all" ? "#ea580c" : "#e2e8f0",
                    backgroundColor: transferFilterMode === "all" ? "#ea580c" : "#ffffff",
                    color: transferFilterMode === "all" ? "#ffffff" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  All Transfers ({siteTransfers.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTransferFilterMode("outgoing")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "750",
                    border: "1px solid",
                    borderColor: transferFilterMode === "outgoing" ? "#2563eb" : "#e2e8f0",
                    backgroundColor: transferFilterMode === "outgoing" ? "#eff6ff" : "#ffffff",
                    color: transferFilterMode === "outgoing" ? "#1d4ed8" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  ↗ Outgoing ({outgoingCount})
                </button>
                <button
                  type="button"
                  onClick={() => setTransferFilterMode("incoming")}
                  style={{
                    padding: "6px 14px",
                    borderRadius: "20px",
                    fontSize: "12px",
                    fontWeight: "750",
                    border: "1px solid",
                    borderColor: transferFilterMode === "incoming" ? "#16a34a" : "#e2e8f0",
                    backgroundColor: transferFilterMode === "incoming" ? "#f0fdf4" : "#ffffff",
                    color: transferFilterMode === "incoming" ? "#15803d" : "#475569",
                    cursor: "pointer"
                  }}
                >
                  ↙ Incoming ({incomingCount})
                </button>
              </div>

              {/* Transfers Table / List Card */}
              <Card 
                variant="table" 
                title="Site Material Transfers History"
                subtitle="Track outgoing transfers to other sites and incoming transfers received at this site."
                headerActions={
                  <Badge status="success">{displayedTransfers.length} Records</Badge>
                }
              >
                <div style={{ overflowX: "auto" }}>
                  <table className="data-table" style={{ margin: "0" }}>
                    <thead>
                      <tr>
                        <th>Direction / Site</th>
                        <th>Material</th>
                        <th style={{ textAlign: "right" }}>Transferred</th>
                        <th style={{ textAlign: "right" }}>Received</th>
                        <th style={{ textAlign: "right" }}>Pending</th>
                        <th>Status</th>
                        <th>Date</th>
                        <th style={{ textAlign: "center" }}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {displayedTransfers.length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "36px 16px" }}>
                            <ArrowRightLeft size={28} style={{ color: "#94a3b8", display: "block", margin: "0 auto 8px auto" }} />
                            <strong style={{ fontSize: "14px", color: "#475569", display: "block" }}>
                              No {transferFilterMode !== "all" ? transferFilterMode : ""} material transfers found for this site.
                            </strong>
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                              All transfers originating from or destined for this site will be listed here.
                            </span>
                          </td>
                        </tr>
                      ) : (
                        displayedTransfers.map(tx => {
                          const isOutgoing = tx.isOutgoing;
                          const totalQty = tx.transferQuantity || 0;
                          const recQty = tx.receivedQuantity || 0;
                          const pendingQty = tx.pendingQuantity || 0;
                          const isCompleted = pendingQty === 0 || tx.status === "Received";

                          return (
                            <tr 
                              key={tx.id}
                              onClick={() => handleOpenMaterialDetails(tx)}
                              style={{ cursor: "pointer", transition: "background-color 0.15s ease" }}
                              onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                              onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}
                            >
                              <td>
                                <span style={{
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: "4px",
                                  fontSize: "11px",
                                  fontWeight: "800",
                                  color: isOutgoing ? "#1d4ed8" : "#15803d",
                                  backgroundColor: isOutgoing ? "#eff6ff" : "#f0fdf4",
                                  padding: "3px 8px",
                                  borderRadius: "6px",
                                  border: isOutgoing ? "1px solid #bfdbfe" : "1px solid #bbf7d0",
                                  textTransform: "uppercase"
                                }}>
                                  {isOutgoing ? `↗ OUTGOING TO ${tx.counterpartSiteName}` : `↙ INCOMING FROM ${tx.counterpartSiteName}`}
                                </span>
                              </td>
                              <td style={{ fontWeight: 700 }}>
                                <span style={{ fontSize: "14px", color: "var(--primary-900)" }}>{tx.materialName}</span>
                                <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>{tx.category}</span>
                              </td>
                              <td style={{ textAlign: "right", fontWeight: "700" }}>
                                {totalQty} {tx.unit}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: "700", color: "#16a34a" }}>
                                {recQty} {tx.unit}
                              </td>
                              <td style={{ textAlign: "right", fontWeight: "700", color: pendingQty > 0 ? "#ea580c" : "#16a34a" }}>
                                {pendingQty} {tx.unit}
                              </td>
                              <td>
                                <Badge status={isCompleted ? "success" : tx.status === "Partial Received" ? "pending" : "warning"}>
                                  {isCompleted ? "COMPLETED" : tx.status === "Partial Received" ? `PARTIAL (${recQty}/${totalQty})` : "IN TRANSIT"}
                                </Badge>
                              </td>
                              <td className="font-mono" style={{ fontSize: "12px" }}>
                                {tx.transferDate || tx.purchaseDate || "--"}
                              </td>
                              <td style={{ textAlign: "center" }} onClick={e => e.stopPropagation()}>
                                <button
                                  onClick={() => handleOpenMaterialDetails(tx)}
                                  className="btn-icon btn-view-action"
                                  title="View Transfer Details"
                                >
                                  <Eye size={16} />
                                </button>
                              </td>
                            </tr>
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </Card>
            </div>
          );
        })()}

        {/* Modal: Material Entry Complete Details */}
        {showMaterialDetailsModal && selectedMaterialForDetails && (() => {
              const row = selectedMaterialForDetails;
              const isTransfer = row.type === "material_transfer" || row.isIncomingTransfer;
              const isApproved = row.status === "Approved" || row.status === "approved" || row.status === "Received" || row.status === "received";
              const unitLabel = row.unit || "Unit";
              const rateNum = Number(row.unitPrice || row.rate || 0);
              const recNum = Number(row.receivedQuantity || row.quantity || 0);
              const reqNum = Number(row.requiredQuantity || row.transferQuantity || row.quantity || 0);
              const pendingNum = Number(row.pendingDelivery || 0);
              const amountNum = Number(row.totalAmount !== undefined ? row.totalAmount : (recNum * rateNum));

              return (
                <Modal
                  isOpen={showMaterialDetailsModal}
                  onClose={() => setShowMaterialDetailsModal(false)}
                  title="Material Record Details"
                  maxWidth="500px"
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    {/* Header Card */}
                    <div style={{
                      backgroundColor: "#f8fafc",
                      padding: "14px 16px",
                      borderRadius: "12px",
                      border: "1px solid #e2e8f0"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                        <div>
                          <span style={{ fontSize: "11px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase" }}>
                            {row.category || "General"}
                          </span>
                          <h3 style={{ margin: "2px 0 0 0", fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                            {row.materialName}
                          </h3>
                        </div>
                        <Badge status={isApproved ? "success" : row.status === "Rejected" ? "danger" : "pending"}>
                          {row.deliveryStatus || (row.status ? row.status.toUpperCase() : "APPROVED")}
                        </Badge>
                      </div>
                    </div>

                    {/* 4-Grid Quantities and Financials */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                          {isTransfer ? "Transferred Quantity" : "Total Required / Ordered"}
                        </span>
                        <strong style={{ fontSize: "15px", color: "#0f172a", marginTop: "2px", display: "block" }}>
                          {reqNum} {unitLabel}
                        </strong>
                      </div>

                      <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                          Received Quantity
                        </span>
                        <strong style={{ fontSize: "15px", color: "#16a34a", marginTop: "2px", display: "block" }}>
                          {recNum} {unitLabel}
                        </strong>
                      </div>

                      <div style={{ backgroundColor: "#ffffff", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                          Rate / Unit
                        </span>
                        <strong style={{ fontSize: "14px", color: "#0f172a", marginTop: "2px", display: "block", fontFamily: "monospace" }}>
                          ₹{rateNum.toLocaleString("en-IN")}
                        </strong>
                      </div>

                      <div style={{ backgroundColor: "#fff7ed", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fed7aa" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#c2410c", textTransform: "uppercase", display: "block" }}>
                          Total Amount
                        </span>
                        <strong style={{ fontSize: "16px", color: "#1e3a8a", marginTop: "2px", display: "block", fontFamily: "monospace" }}>
                          ₹{amountNum.toLocaleString("en-IN")}
                        </strong>
                      </div>
                    </div>

                    {/* Secondary Information Card */}
                    <div style={{ backgroundColor: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0", display: "flex", flexDirection: "column", gap: "6px", fontSize: "12.5px", color: "#334155" }}>
                      <div><strong>Supplier / Team:</strong> {row.supplierName || row.teamName || "--"}</div>
                      <div><strong>Record Date:</strong> {row.purchaseDate || row.transferDate || "--"}</div>
                      <div><strong>Payment Status:</strong> <Badge status={row.paymentStatus === "Paid" ? "success" : row.paymentStatus === "Partial Payment" ? "pending" : "danger"}>{row.paymentStatus || "Pending Payment"}</Badge></div>
                      {isTransfer && (
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "6px", marginTop: "4px" }}>
                          <strong>Transfer Details:</strong> Transferred from <u>{row.sourceSiteName || "Source Site"}</u> by {row.transferredByName || "Site Engineer"}
                        </div>
                      )}
                      {row.invoiceUrl && (
                        <div style={{ marginTop: "4px" }}>
                          <a href={row.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#0284c7", fontWeight: "750", textDecoration: "underline" }}>
                            📄 View Attached Invoice / Slip
                          </a>
                        </div>
                      )}
                      {row.notes && (
                        <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "6px", marginTop: "4px", fontStyle: "italic", color: "#64748b" }}>
                          "{row.notes}"
                        </div>
                      )}
                    </div>

                    {/* Transfers Out History (if any) */}
                    {row.transfersOut && row.transfersOut.length > 0 && (
                      <div style={{ backgroundColor: "#fff7ed", padding: "10px 12px", borderRadius: "8px", border: "1px solid #fed7aa", fontSize: "11.5px" }}>
                        <span style={{ fontWeight: "800", color: "#c2410c", display: "block", marginBottom: "4px" }}>
                          Transfers Out from this Material:
                        </span>
                        {row.transfersOut.map((t, idx) => (
                          <div key={idx} style={{ color: "#475569", marginBottom: "2px" }}>
                            • {t.date}: <strong>-{t.quantity} {unitLabel}</strong> to {t.toSiteName || "other site"} ({t.notes || "Transfer"})
                          </div>
                        ))}
                      </div>
                    )}

                    {/* Usage History (if any) */}
                    {row.usageHistory && row.usageHistory.length > 0 && (
                      <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "11.5px" }}>
                        <span style={{ fontWeight: "800", color: "#334155", display: "block", marginBottom: "4px" }}>
                          Stock Consumption Log:
                        </span>
                        {row.usageHistory.map((u, idx) => (
                          <div key={idx} style={{ color: "#475569", marginBottom: "2px" }}>
                            • {u.date}: <strong>-{u.quantity} {unitLabel}</strong> ({u.notes})
                          </div>
                        ))}
                      </div>
                    )}

                    <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => {
                          setShowMaterialDetailsModal(false);
                          handleOpenEditMaterial(row);
                        }}
                        style={{ flex: 1 }}
                      >
                        <Edit3 size={15} />
                        <span>Edit Record</span>
                      </Button>
                      <Button
                        type="button"
                        variant="primary"
                        onClick={() => setShowMaterialDetailsModal(false)}
                        style={{ flex: 1 }}
                      >
                        Close
                      </Button>
                    </div>
                  </div>
                </Modal>
              );
            })()}

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
            TAB: LABOUR LOG (SITE-SPECIFIC SINGLE SOURCE OF TRUTH)
            =================================================================== */}
        {activeTab === "labour" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }} className="no-print">
            
            {/* 1. Clean Single Date Filter */}
            <div style={{
              backgroundColor: "#ffffff",
              padding: "12px 16px",
              borderRadius: "10px",
              border: "1px solid var(--border-color)",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Calendar size={16} style={{ color: "var(--primary-600)" }} />
                <span style={{ fontSize: "13px", fontWeight: "750", color: "#1e293b" }}>Attendance Date:</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <input
                  type="date"
                  value={labourDateFilter}
                  onChange={(e) => setLabourDateFilter(e.target.value)}
                  style={{
                    padding: "7px 12px",
                    borderRadius: "6px",
                    border: "1px solid var(--border-color)",
                    fontSize: "13px",
                    fontWeight: "600",
                    outline: "none",
                    backgroundColor: "#f8fafc",
                    color: "#0f172a"
                  }}
                />
                {labourDateFilter !== new Date().toISOString().split("T")[0] && (
                  <button
                    type="button"
                    onClick={() => setLabourDateFilter(new Date().toISOString().split("T")[0])}
                    style={{
                      padding: "6px 12px",
                      borderRadius: "6px",
                      border: "1px solid #fed7aa",
                      backgroundColor: "#fff7ed",
                      color: "#ea580c",
                      fontSize: "12px",
                      fontWeight: "750",
                      cursor: "pointer"
                    }}
                  >
                    Today
                  </button>
                )}
              </div>
            </div>

            {/* 2. Compact Daily Labour Summary: Workers Today & Total Payment */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
              {/* Workers Today */}
              <div style={{
                backgroundColor: "#ffffff",
                padding: "14px 18px",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>
                  Workers Today
                </span>
                <strong style={{ fontSize: "22px", color: "var(--primary-900)", fontFamily: "monospace" }}>
                  {dailyTotalWorkers}
                </strong>
              </div>

              {/* Total Payment */}
              <div style={{
                backgroundColor: "#ffffff",
                padding: "14px 18px",
                borderRadius: "10px",
                border: "1px solid var(--border-color)",
                boxShadow: "0 1px 2px rgba(0,0,0,0.02)",
                display: "flex",
                flexDirection: "column",
                gap: "4px"
              }}>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "800", letterSpacing: "0.5px" }}>
                  Total Payment
                </span>
                <strong style={{ fontSize: "22px", color: "var(--success-700)", fontFamily: "monospace" }}>
                  ₹{dailyTotalLabourCost.toLocaleString("en-IN")}
                </strong>
              </div>
            </div>

            {/* 3. Labour Records Table Section */}
            <Card 
              variant="table"
              title={`Labour Records — ${(() => {
                if (!labourDateFilter) return "Selected Date";
                try {
                  const [y, m, d] = labourDateFilter.split("-");
                  if (y && m && d) return `${d}-${m}-${y}`;
                } catch (e) {}
                return labourDateFilter;
              })()}`}
              subtitle={`Showing verified workforce attendance and calculations for ${(() => {
                if (!labourDateFilter) return "the selected date";
                try {
                  const [y, m, d] = labourDateFilter.split("-");
                  if (y && m && d) return `${d}-${m}-${y}`;
                } catch (e) {}
                return labourDateFilter;
              })()}`}
              headerActions={
                <Badge status="success">{filteredLabour.length} Records</Badge>
              }
            >
              <div style={{ overflowX: "auto" }}>
                <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ backgroundColor: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ textAlign: "left", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569" }}>Labour / Worker</th>
                      <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569" }}>Quantity</th>
                      <th style={{ textAlign: "center", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569" }}>Days</th>
                      <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569" }}>Rate</th>
                      <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569" }}>Effective Rate</th>
                      <th style={{ textAlign: "left", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569" }}>Calculation</th>
                      <th style={{ textAlign: "right", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569" }}>Total Amount</th>
                      <th style={{ textAlign: "center", padding: "12px 16px", fontSize: "12px", fontWeight: "750", color: "#475569", width: "60px" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLabour.length === 0 ? (
                      <tr>
                        <td colSpan={8} style={{ textAlign: "center", color: "var(--text-muted)", padding: "36px 16px" }}>
                          <Users size={28} style={{ color: "#94a3b8", display: "block", margin: "0 auto 8px auto" }} />
                          <strong style={{ fontSize: "14px", color: "#475569", display: "block" }}>
                            No labour records found for {labourDateFilter || "this site"}.
                          </strong>
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                            Select another date above or record labour attendance from Site Engineer portal.
                          </span>
                        </td>
                      </tr>
                    ) : (
                      filteredLabour.map((row, idx) => {
                        const isMember = row.memberId !== undefined || row.workerCount !== undefined || row.categoryId !== undefined;
                        const count = Number(row.workerCount !== undefined ? row.workerCount : 1) || 1;
                        const customUnits = Number(
                          row.customWorkUnits !== undefined 
                            ? row.customWorkUnits 
                            : (row.units !== undefined 
                                ? row.units 
                                : (row.attendanceType === "Half Day" ? 0.5 : 1.0))
                        ) || 1.0;
                        const baseRate = Number(row.dailyWage !== undefined ? row.dailyWage : (row.wage || row.baseWage || 0));
                        const effectiveRate = baseRate * customUnits;
                        const hasCustomWorkers = Array.isArray(row.workerEntries) && row.workerEntries.length > 0;
                        const earnedPayment = Number(
                          row.calculatedAmount !== undefined 
                            ? row.calculatedAmount 
                            : (row.totalAmount !== undefined 
                                ? row.totalAmount 
                                : (count * effectiveRate))
                        ) || 0;

                        const workType = row.categoryName || row.name || (row.categoryId ? String(row.categoryId).replace(/^cat_/, '') : (isMember ? "Labour" : "General Headcount"));
                        const teamName = row.teamName || (row.teamId ? "Labour Team" : "");
                        const unitLabel = hasCustomWorkers 
                          ? "Custom Durations"
                          : (customUnits !== 1.0 
                              ? `${customUnits} days` 
                              : "1 day");
                        const rateLabel = customUnits !== 1.0 
                          ? `₹${baseRate.toLocaleString("en-IN")}/day` 
                          : (baseRate > 0 ? `₹${baseRate.toLocaleString("en-IN")}` : "--");
                        const calculationText = hasCustomWorkers
                          ? `${count} workers with custom durations = ₹${earnedPayment.toLocaleString("en-IN")}`
                          : `${count} × ₹${effectiveRate.toLocaleString("en-IN")} = ₹${earnedPayment.toLocaleString("en-IN")}`;

                        return (
                          <tr 
                            key={row.id || idx}
                            onClick={() => handleOpenLabourDetails(row)}
                            style={{ cursor: "pointer", transition: "background-color 0.15s ease", borderBottom: "1px solid #f1f5f9" }}
                            onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                            onMouseLeave={e => e.currentTarget.style.backgroundColor = ""}
                          >
                            {/* Labour / Worker */}
                            <td style={{ padding: "12px 16px" }}>
                              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                                <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                                  <span style={{ fontSize: "13.5px", fontWeight: "750", color: "#0f172a" }}>{workType}</span>
                                  {(row.isAdminEntry || row.createdVia === "admin_assisted_entry") && (
                                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#1d4ed8", backgroundColor: "#eff6ff", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bfdbfe" }} title={`Admin Override Entry by ${row.createdByName || "Admin"}`}>
                                      🛡️ Admin Entry
                                    </span>
                                  )}
                                  {hasCustomWorkers && (
                                    <span style={{ fontSize: "10px", fontWeight: "800", color: "#c2410c", backgroundColor: "#ffedd5", padding: "1px 6px", borderRadius: "4px" }}>
                                      {row.workerEntries.length} Custom Workers
                                    </span>
                                  )}
                                </div>
                                {teamName && (
                                  <span style={{ fontSize: "11px", color: "#64748b" }}>
                                    {teamName}
                                  </span>
                                )}
                              </div>
                            </td>

                            {/* Quantity */}
                            <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace", fontSize: "13.5px", fontWeight: "700", color: "#0f172a" }}>
                              {count}
                            </td>

                            {/* Unit / Duration */}
                            <td style={{ textAlign: "center", padding: "12px 16px", fontSize: "12px" }}>
                              <span style={{ backgroundColor: "#f1f5f9", color: "#334155", padding: "2px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontWeight: "700" }}>
                                {unitLabel}
                              </span>
                            </td>

                            {/* Rate */}
                            <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace", fontSize: "13px", color: "#475569" }}>
                              {rateLabel}
                            </td>

                            {/* Effective Rate */}
                            <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace", fontSize: "13.5px", fontWeight: "700", color: "#0f172a" }}>
                              {hasCustomWorkers ? "--" : `₹${effectiveRate.toLocaleString("en-IN")}`}
                            </td>

                            {/* Calculation */}
                            <td style={{ textAlign: "left", padding: "12px 16px", fontFamily: "monospace", fontSize: "12.5px", color: "#334155" }}>
                              {calculationText}
                            </td>

                            {/* Total Amount */}
                            <td style={{ textAlign: "right", padding: "12px 16px", fontFamily: "monospace", fontSize: "14px", fontWeight: "800", color: "#16a34a" }}>
                              ₹{earnedPayment.toLocaleString("en-IN")}
                            </td>

                            {/* Action */}
                            <td style={{ textAlign: "center", padding: "12px 16px" }} onClick={e => e.stopPropagation()}>
                              <button
                                onClick={() => handleOpenLabourDetails(row)}
                                className="btn-icon btn-view-action"
                                title="View Record Details"
                                style={{
                                  width: "32px",
                                  height: "32px",
                                  borderRadius: "6px",
                                  border: "1px solid #e2e8f0",
                                  backgroundColor: "#ffffff",
                                  display: "flex",
                                  alignItems: "center",
                                  justifyContent: "center",
                                  color: "#64748b",
                                  margin: "auto",
                                  cursor: "pointer"
                                }}
                              >
                                <Eye size={15} />
                              </button>
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>

              {/* Final Total Labour Amount Footer */}
              {filteredLabour.length > 0 && (
                <div style={{
                  padding: "16px 20px",
                  backgroundColor: "#f8fafc",
                  borderTop: "2px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: "12px"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <span style={{
                      fontSize: "12px",
                      fontWeight: "800",
                      textTransform: "uppercase",
                      letterSpacing: "0.5px",
                      color: "#334155"
                    }}>
                      FINAL TOTAL LABOUR AMOUNT
                    </span>
                    <span style={{
                      fontSize: "11px",
                      fontWeight: "750",
                      backgroundColor: "#e2e8f0",
                      color: "#475569",
                      padding: "2px 8px",
                      borderRadius: "6px"
                    }}>
                      {filteredLabour.length} Entries • {dailyTotalWorkers} Total Workers
                    </span>
                  </div>

                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "20px", fontWeight: "900", color: "#16a34a", fontFamily: "monospace" }}>
                      ₹{dailyTotalLabourCost.toLocaleString("en-IN")}
                    </span>
                  </div>
                </div>
              )}
            </Card>

            {/* Modal: Labour Record Details */}
            {showLabourDetailsModal && selectedLabourForDetails && (() => {
              const rec = selectedLabourForDetails;
              const isMember = rec.memberId !== undefined || rec.workerCount !== undefined || rec.categoryId !== undefined;
              const count = Number(rec.workerCount !== undefined ? rec.workerCount : 1) || 1;
              const customUnits = Number(
                rec.customWorkUnits !== undefined 
                  ? rec.customWorkUnits 
                  : (rec.units !== undefined 
                      ? rec.units 
                      : (rec.attendanceType === "Half Day" ? 0.5 : 1.0))
              ) || 1.0;
              const baseRate = Number(rec.dailyWage !== undefined ? rec.dailyWage : (rec.wage || rec.baseWage || 0));
              const effectiveRate = baseRate * customUnits;
              const hasCustomWorkers = Array.isArray(rec.workerEntries) && rec.workerEntries.length > 0;
              const earnedPayment = Number(
                rec.calculatedAmount !== undefined 
                  ? rec.calculatedAmount 
                  : (rec.totalAmount !== undefined 
                      ? rec.totalAmount 
                      : (count * effectiveRate))
              ) || 0;

              const workType = rec.categoryName || rec.name || (rec.categoryId ? String(rec.categoryId).replace(/^cat_/, '') : (isMember ? "Labour" : "General Headcount"));
              const teamName = rec.teamName || (rec.teamId ? "Labour Team" : "");
              const recordDate = rec.date || rec.attendanceDate || "--";

              return (
                <Modal
                  isOpen={showLabourDetailsModal}
                  onClose={() => setShowLabourDetailsModal(false)}
                  title="Labour Record Details"
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid var(--border-color)", paddingBottom: "12px" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>{workType}</h3>
                        <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>{teamName ? `Team: ${teamName}` : "Labour Entry"}</span>
                      </div>
                      <Badge status={earnedPayment > 0 ? "success" : "pending"}>
                        {rec.attendanceType || (earnedPayment > 0 ? "Present" : "Logged")}
                      </Badge>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", fontSize: "13px" }}>
                      <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Date</span>
                        <strong className="font-mono">{recordDate}</strong>
                      </div>
                      <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Base Rate</span>
                        <strong className="font-mono">{baseRate > 0 ? `₹${baseRate.toLocaleString("en-IN")} / day` : "--"}</strong>
                      </div>
                      <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Workers & Duration</span>
                        <strong className="font-mono">{count} worker(s) {hasCustomWorkers ? "(Custom Durations)" : `× ${customUnits} day(s)`}</strong>
                      </div>
                      <div style={{ backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block" }}>Effective Rate</span>
                        <strong className="font-mono">{hasCustomWorkers ? "Per Worker" : `₹${effectiveRate.toLocaleString("en-IN")} / worker`}</strong>
                      </div>
                      <div style={{ gridColumn: "1 / -1", backgroundColor: "#f0fdf4", padding: "12px 14px", borderRadius: "8px", border: "1px solid #bbf7d0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "11px", color: "#16a34a", display: "block", fontWeight: "700", textTransform: "uppercase" }}>Calculation</span>
                          <span style={{ fontSize: "13px", fontWeight: "800", color: "#0f172a", fontFamily: "monospace" }}>
                            {hasCustomWorkers ? `${count} workers customized` : `₹${effectiveRate.toLocaleString("en-IN")} × ${count} workers`} = ₹{earnedPayment.toLocaleString("en-IN")}
                          </span>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "11px", color: "#16a34a", display: "block", fontWeight: "700", textTransform: "uppercase" }}>Total Amount</span>
                          <strong style={{ fontSize: "18px", color: "#16a34a", fontFamily: "monospace" }}>₹{earnedPayment.toLocaleString("en-IN")}</strong>
                        </div>
                      </div>
                    </div>

                    {/* Individual Worker Details Table if workerEntries exist */}
                    {hasCustomWorkers && (
                      <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                        <span style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>
                          Individual Worker Durations Breakdown
                        </span>
                        <div style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          overflow: "hidden"
                        }}>
                          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                            <thead>
                              <tr style={{ backgroundColor: "#f1f5f9", borderBottom: "1px solid #e2e8f0" }}>
                                <th style={{ textAlign: "left", padding: "6px 10px", color: "#475569" }}>Worker</th>
                                <th style={{ textAlign: "center", padding: "6px 10px", color: "#475569" }}>Duration</th>
                                <th style={{ textAlign: "right", padding: "6px 10px", color: "#475569" }}>Wage</th>
                                <th style={{ textAlign: "right", padding: "6px 10px", color: "#475569" }}>Amount</th>
                              </tr>
                            </thead>
                            <tbody>
                              {rec.workerEntries.map((w, wIdx) => {
                                const wU = Number(w.customWorkUnits !== undefined ? w.customWorkUnits : (w.units || customUnits));
                                const wR = Number(w.dailyWage !== undefined ? w.dailyWage : (w.wage || baseRate));
                                const wA = Number(w.calculatedAmount !== undefined ? w.calculatedAmount : (wU * wR));
                                return (
                                  <tr key={wIdx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "6px 10px", fontWeight: "600", color: "#0f172a" }}>{w.workerName || `Worker ${wIdx + 1}`}</td>
                                    <td style={{ textAlign: "center", padding: "6px 10px", fontFamily: "monospace" }}>{wU} day(s)</td>
                                    <td style={{ textAlign: "right", padding: "6px 10px", fontFamily: "monospace" }}>₹{wR.toLocaleString("en-IN")}</td>
                                    <td style={{ textAlign: "right", padding: "6px 10px", fontWeight: "700", color: "#16a34a", fontFamily: "monospace" }}>₹{wA.toLocaleString("en-IN")}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    )}

                    {rec.markedBy && (
                      <div style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                        Marked by Engineer ID: {rec.markedBy}
                      </div>
                    )}

                    <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
                      <Button variant="outline" onClick={() => setShowLabourDetailsModal(false)}>
                        Close
                      </Button>
                    </div>
                  </div>
                </Modal>
              );
            })()}
          </div>
        )}

        {/* ===================================================================
            TAB: ATTENDANCE / ENTRY EXIT
            =================================================================== */}
        {activeTab === "attendance" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }} className="no-print">
            <Card 
              title="Site Attendance Overview"
              subtitle="Compact verified supervisor attendance summary for this project."
            >
              {latestSiteAttendanceRecord ? (
                <div style={{
                  padding: "18px",
                  backgroundColor: "#ffffff",
                  border: "1.5px solid var(--border-color)",
                  borderRadius: "12px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                }}>
                  {/* Header: Latest Badge, Engineer Name, Date, Status */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "12px", flexWrap: "wrap" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      {latestSiteAttendanceRecord.photoUrl || latestSiteAttendanceRecord.checkInPhotoUrl ? (
                        <img 
                          src={latestSiteAttendanceRecord.photoUrl || latestSiteAttendanceRecord.checkInPhotoUrl} 
                          alt="Selfie"
                          onClick={() => setSelectedAttendancePhotoModal({ 
                            url: latestSiteAttendanceRecord.photoUrl || latestSiteAttendanceRecord.checkInPhotoUrl, 
                            title: `Verification Selfie - ${(() => {
                              const eng = engineers.find(e => e.id === latestSiteAttendanceRecord.engineerId || e.id === latestSiteAttendanceRecord.userId);
                              return eng ? eng.fullName : (latestSiteAttendanceRecord.engineerName || "Site Engineer");
                            })()} (${latestSiteAttendanceRecord.date || latestSiteAttendanceRecord.attendanceDate})` 
                          })}
                          style={{
                            width: "48px",
                            height: "48px",
                            borderRadius: "10px",
                            objectFit: "cover",
                            flexShrink: 0,
                            border: "1.5px solid var(--border-color)",
                            cursor: "pointer"
                          }}
                          title="Click to view full selfie"
                        />
                      ) : (
                        <div style={{
                          width: "48px",
                          height: "48px",
                          borderRadius: "10px",
                          backgroundColor: "#eff6ff",
                          color: "#2563eb",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          flexShrink: 0,
                          border: "1px solid #bfdbfe"
                        }}>
                          <ClipboardCheck size={24} />
                        </div>
                      )}
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                          <span style={{ 
                            fontSize: "11px", 
                            fontWeight: "800", 
                            textTransform: "uppercase", 
                            color: "#2563eb", 
                            backgroundColor: "#dbeafe", 
                            padding: "2px 8px", 
                            borderRadius: "4px",
                            letterSpacing: "0.5px" 
                          }}>
                            Latest Attendance
                          </span>
                          <strong style={{ fontSize: "15px", color: "var(--primary-950)" }}>
                            {(() => {
                              const eng = engineers.find(e => e.id === latestSiteAttendanceRecord.engineerId || e.id === latestSiteAttendanceRecord.userId);
                              return eng ? eng.fullName : (latestSiteAttendanceRecord.engineerName || "Site Engineer");
                            })()}
                          </strong>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", marginTop: "3px", color: "var(--text-muted)", fontSize: "12px" }}>
                          <Calendar size={13} style={{ color: "var(--primary-600)" }} />
                          <span className="font-mono" style={{ fontWeight: "750", color: "#1e293b" }}>
                            {formatDisplayDate(latestSiteAttendanceRecord.date || latestSiteAttendanceRecord.attendanceDate)}
                          </span>
                          <span>•</span>
                          <span>{site.siteName}</span>
                        </div>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      {(latestSiteAttendanceRecord.isCheckedOut || latestSiteAttendanceRecord.status === "checked_out" || latestSiteAttendanceRecord.checkOutTimeFormatted) ? (
                        <Badge status="info">Checked Out</Badge>
                      ) : (
                        <Badge status="success">Present / On Site</Badge>
                      )}
                      {(latestSiteAttendanceRecord.verificationStatus === "verified" || latestSiteAttendanceRecord.isVerified) && (
                        <span style={{ 
                          display: "inline-flex", 
                          alignItems: "center", 
                          gap: "3px", 
                          fontSize: "10.5px", 
                          fontWeight: "700", 
                          color: "#059669", 
                          backgroundColor: "#ecfdf5", 
                          padding: "2px 8px", 
                          borderRadius: "12px", 
                          border: "1px solid #a7f3d0" 
                        }}>
                          <ShieldCheck size={12} />
                          Verified
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Quick Check-In / Check-Out strip */}
                  <div style={{
                    display: "grid",
                    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                    gap: "10px",
                    backgroundColor: "var(--primary-50)",
                    padding: "10px 14px",
                    borderRadius: "8px",
                    border: "1px solid var(--border-color)",
                    fontSize: "12px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: "#dcfce7", color: "#15803d", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <LogIn size={13} />
                      </div>
                      <div>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Check-In</span>
                        <strong className="font-mono" style={{ color: "var(--primary-900)", fontSize: "12.5px" }}>
                          {latestSiteAttendanceRecord.checkInTimeFormatted || latestSiteAttendanceRecord.time || "--"}
                        </strong>
                      </div>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <div style={{ width: "24px", height: "24px", borderRadius: "50%", backgroundColor: (latestSiteAttendanceRecord.isCheckedOut || latestSiteAttendanceRecord.checkOutTimeFormatted) ? "#e0e7ff" : "#f1f5f9", color: (latestSiteAttendanceRecord.isCheckedOut || latestSiteAttendanceRecord.checkOutTimeFormatted) ? "#4338ca" : "var(--text-muted)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                        <LogOut size={13} />
                      </div>
                      <div>
                        <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Check-Out</span>
                        <strong className="font-mono" style={{ color: (latestSiteAttendanceRecord.isCheckedOut || latestSiteAttendanceRecord.checkOutTimeFormatted) ? "#1e1b4b" : "var(--text-muted)", fontSize: "12.5px" }}>
                          {latestSiteAttendanceRecord.checkOutTimeFormatted || (latestSiteAttendanceRecord.isCheckedOut ? "Logged" : "On Site")}
                        </strong>
                      </div>
                    </div>
                  </div>

                  {/* Bottom Footer: GPS Location + Small View Attendance action */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "10px", borderTop: "1px solid var(--border-color)", paddingTop: "12px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11.5px", color: "var(--text-muted)" }}>
                      <MapPin size={13} style={{ color: "var(--primary-600)", flexShrink: 0 }} />
                      <span>{latestSiteAttendanceRecord.address || (latestSiteAttendanceRecord.latitude && latestSiteAttendanceRecord.longitude ? `Lat: ${Number(latestSiteAttendanceRecord.latitude).toFixed(5)}, Lng: ${Number(latestSiteAttendanceRecord.longitude).toFixed(5)}` : "GPS Captured")}</span>
                      {latestSiteAttendanceRecord.distance !== undefined && latestSiteAttendanceRecord.distance !== null && (
                        <span style={{ fontWeight: "750", color: Number(latestSiteAttendanceRecord.distance) <= 500 ? "#15803d" : "#b45309" }}>
                          • 🎯 {Math.round(latestSiteAttendanceRecord.distance)}m from site
                        </span>
                      )}
                    </div>

                    <Button
                      variant="primary"
                      size="sm"
                      icon={Calendar}
                      onClick={() => setShowSiteAttendanceModal(true)}
                      style={{
                        padding: "6px 14px",
                        fontSize: "12px",
                        fontWeight: "750"
                      }}
                    >
                      View Attendance
                    </Button>
                  </div>
                </div>
              ) : (
                <div style={{
                  padding: "32px 16px",
                  textAlign: "center",
                  backgroundColor: "var(--primary-50)",
                  borderRadius: "10px",
                  border: "1px dashed var(--border-color)"
                }}>
                  <ClipboardCheck size={36} style={{ color: "var(--text-muted)", opacity: 0.4, marginBottom: "8px" }} />
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", margin: "0 0 14px 0" }}>
                    No attendance records found for this site.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={Calendar}
                    onClick={() => setShowSiteAttendanceModal(true)}
                  >
                    View Attendance
                  </Button>
                </div>
              )}
            </Card>
          </div>
        )}

        {/* ===================================================================
            TAB: PROGRESS
            =================================================================== */}
        {activeTab === "progress" && (() => {
          const plannedProgressPct = calculatePlannedProgress(site.startDate, site.expectedEndDate);
          let actualProgressPct = 0;
          if (site.status === "Completed") {
            actualProgressPct = 100;
          } else if (progressUpdates && progressUpdates.length > 0) {
            const sorted = [...progressUpdates].sort((a, b) => (b.date || "").localeCompare(a.date || ""));
            actualProgressPct = Number(String(sorted[0].progress).replace(/%/g, '')) || 0;
          } else {
            actualProgressPct = Math.min(100, Math.max(0, Number(site.progress) || Number(site.completionPercentage) || 0));
          }
          
          // Calculate dynamic schedule difference
          const isCompleted = site.status === "Completed";
          let scheduleStatus = "On Schedule";
          let scheduleDetail = "";
          let scheduleBadge = "success";
          let diffDays = 0;

          if (isCompleted) {
            scheduleStatus = "Completed";
            scheduleDetail = "Project completed";
            scheduleBadge = "success";
          } else if (site.expectedEndDate) {
            const today = new Date();
            today.setHours(0, 0, 0, 0);
            const endParts = site.expectedEndDate.split("-");
            const endDate = endParts.length === 3 
              ? new Date(Number(endParts[0]), Number(endParts[1]) - 1, Number(endParts[2]))
              : new Date(site.expectedEndDate);
            endDate.setHours(0, 0, 0, 0);
            
            const diffTime = endDate.getTime() - today.getTime();
            diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
            
            if (diffDays < 0) {
              scheduleStatus = "Delayed";
              scheduleDetail = `${Math.abs(diffDays)} day${Math.abs(diffDays) === 1 ? "" : "s"} overdue`;
              scheduleBadge = "danger";
            } else if (diffDays === 0) {
              scheduleStatus = "Due Today";
              scheduleDetail = "Target completion date is today";
              scheduleBadge = "warning";
            } else {
              if (plannedProgressPct > 0 && actualProgressPct < plannedProgressPct - 5) {
                scheduleStatus = "Delayed";
                scheduleDetail = `${diffDays} day${diffDays === 1 ? "" : "s"} remaining (${plannedProgressPct - actualProgressPct}% behind milestone)`;
                scheduleBadge = "danger";
              } else if (actualProgressPct > plannedProgressPct + 5) {
                scheduleStatus = "Ahead of Schedule";
                scheduleDetail = `${diffDays} day${diffDays === 1 ? "" : "s"} remaining`;
                scheduleBadge = "success";
              } else {
                scheduleStatus = "On Schedule";
                scheduleDetail = `${diffDays} day${diffDays === 1 ? "" : "s"} remaining`;
                scheduleBadge = "success";
              }
            }
          } else {
            scheduleStatus = "Active";
            scheduleDetail = "No planned date set";
            scheduleBadge = "info";
          }
          
          const weeklyReports = generateWeeklyReportFromDprs(progressUpdates);
          const sortedProgressUpdates = [...(progressUpdates || [])].sort((a, b) => {
            const dateA = a.date || (a.createdAt?.seconds ? new Date(a.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
            const dateB = b.date || (b.createdAt?.seconds ? new Date(b.createdAt.seconds * 1000).toISOString().split("T")[0] : "");
            const cmp = dateB.localeCompare(dateA);
            if (cmp !== 0) return cmp;
            const tA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
            const tB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
            return tB - tA;
          });

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "20px" }} className="no-print">
              
              {/* 1. PLANNED COMPLETION DATE, 2. MILESTONE PROGRESS COMPARISON, 3. SCHEDULE STATUS */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "16px" }}>
                
                {/* 1. Planned Completion Date Card */}
                <Card>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px" }}>
                    Planned Completion Date
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px" }}>
                    <Calendar size={18} style={{ color: "#ea580c", flexShrink: 0 }} />
                    <span style={{ fontSize: "17px", fontWeight: "800", color: "#0f172a" }}>
                      {formatDateDDMonthYYYY(site.expectedEndDate || site.endDate || site.completionDate)}
                    </span>
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                    Target project milestone
                  </span>
                </Card>

                {/* 2. Milestone Progress Comparison Card */}
                <Card>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px" }}>
                      Milestone Progress Comparison
                    </span>
                    <span style={{ fontSize: "11.5px", fontWeight: "750", color: "#0f172a" }}>
                      Target: 100%
                    </span>
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginTop: "4px", marginBottom: "8px" }}>
                    <div>
                      <span style={{ fontSize: "22px", fontWeight: "900", color: "#0f172a" }}>{actualProgressPct}%</span>
                      <span style={{ fontSize: "12px", color: "#64748b", marginLeft: "4px", fontWeight: "600" }}>actual</span>
                    </div>
                    <div>
                      <span style={{ fontSize: "14px", fontWeight: "700", color: "#64748b" }}>vs {plannedProgressPct}%</span>
                      <span style={{ fontSize: "11px", color: "#94a3b8", marginLeft: "3px" }}>planned</span>
                    </div>
                  </div>
                  {/* Compact visual progress bar */}
                  <div style={{ width: "100%", height: "7px", backgroundColor: "#f1f5f9", borderRadius: "999px", overflow: "hidden" }}>
                    <div style={{
                      width: `${actualProgressPct}%`,
                      height: "100%",
                      backgroundColor: actualProgressPct >= plannedProgressPct ? "#16a34a" : "#ea580c",
                      borderRadius: "999px",
                      transition: "width 0.3s ease"
                    }} />
                  </div>
                </Card>

                {/* 3. Schedule Status Card */}
                <Card>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", textTransform: "uppercase", fontWeight: "700", letterSpacing: "0.5px" }}>
                    Schedule Status
                  </span>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                    <Badge status={scheduleBadge}>{scheduleStatus}</Badge>
                    {scheduleDetail && (
                      <span style={{
                        fontSize: "13px",
                        fontWeight: "750",
                        color: scheduleBadge === "danger" ? "#dc2626" : (scheduleBadge === "success" ? "#16a34a" : "#475569")
                      }}>
                        {scheduleDetail}
                      </span>
                    )}
                  </div>
                  <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>
                    {isCompleted ? "Project marked complete" : (diffDays < 0 ? "Timeline is currently delayed" : "Timeline pacing on track")}
                  </span>
                </Card>
              </div>

              {/* 4. Weekly Progress Report */}
              <Card title="Weekly Progress Report" subtitle="Synthesized from daily site entries without duplication.">
                {weeklyReports.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", textAlign: "center", padding: "16px", margin: 0 }}>
                    No progress recorded for this period
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                    {weeklyReports.map((report, idx) => (
                      <div key={idx} style={{ border: "1px solid var(--border-color)", borderRadius: "10px", padding: "14px 16px", backgroundColor: "#f8fafc" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px", marginBottom: "10px", gap: "8px" }}>
                          <div>
                            <span style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a" }}>{report.weekLabel}</span>
                            <span style={{ fontSize: "11.5px", color: "#64748b", marginLeft: "8px", fontWeight: "500" }}>
                              ({formatDateDDMonthYYYY(report.startDate)} – {formatDateDDMonthYYYY(report.endDate)})
                            </span>
                          </div>
                          <span style={{ fontSize: "12px", fontWeight: "750", color: "#16a34a", backgroundColor: "#f0fdf4", border: "1px solid #dcfce7", padding: "2px 8px", borderRadius: "6px" }}>
                            Progress: {report.startProgress}% → {report.endProgress}% (+{report.progressChange}%)
                          </span>
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "12px", fontSize: "12px" }}>
                          <div>
                            <strong style={{ display: "block", color: "#0f172a", marginBottom: "2px", fontWeight: "700" }}>Completed Work:</strong>
                            <p style={{ margin: 0, color: "#334155", lineHeight: "1.4" }}>{report.completedWork || "Standard daily site execution logged."}</p>
                          </div>
                          {report.pendingActivities && report.pendingActivities !== "None" && (
                            <div>
                              <strong style={{ display: "block", color: "#0f172a", marginBottom: "2px", fontWeight: "700" }}>Pending Activities:</strong>
                              <p style={{ margin: 0, color: "#334155", lineHeight: "1.4" }}>{report.pendingActivities}</p>
                            </div>
                          )}
                        </div>
                        {report.delayReasons && report.delayReasons !== "No major issues faced" && (
                          <div style={{ marginTop: "10px", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#fef2f2", border: "1px solid #fee2e2", padding: "6px 10px", borderRadius: "6px", fontSize: "11.5px" }}>
                            <AlertCircle size={13} style={{ color: "#dc2626", flexShrink: 0 }} />
                            <span style={{ color: "#991b1b", fontWeight: "600" }}><strong>Issues faced:</strong> {report.delayReasons}</span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              {/* 5. Daily Progress Timeline */}
              <Card title="Daily Progress Timeline" subtitle="Chronological site execution reports logged by field engineers.">
                {sortedProgressUpdates.length === 0 ? (
                  <p style={{ color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic", textAlign: "center", padding: "20px", margin: 0 }}>
                    No daily progress logs submitted yet for this site.
                  </p>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", paddingLeft: "16px", borderLeft: "2px solid #e2e8f0", marginLeft: "8px" }}>
                    {sortedProgressUpdates.map((update, index) => {
                      const eng = engineers.find(e => e.id === update.engineerId) || { fullName: update.engineerName || `Engineer (${update.engineerId?.slice(0, 6) || "ID"})` };
                      const displayDate = formatDateDDMonthYYYY(update.date || update.createdAt);

                      return (
                        <div key={update.id || index} style={{ position: "relative" }}>
                          {/* Timeline Dot */}
                          <div style={{
                            position: "absolute",
                            left: "-23px",
                            top: "4px",
                            width: "12px",
                            height: "12px",
                            borderRadius: "50%",
                            backgroundColor: "#ea580c",
                            border: "2.5px solid #ffffff",
                            boxShadow: "0 0 0 2px #ffedd5"
                          }} />
                          
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                            <span style={{ fontSize: "12.5px", color: "#0f172a", fontWeight: "800" }}>{displayDate}</span>
                            <span style={{ fontSize: "11.5px", fontWeight: "750", color: "#c2410c", backgroundColor: "#fff7ed", border: "1px solid #ffedd5", padding: "2px 8px", borderRadius: "6px" }}>
                              {update.progress !== undefined ? `${update.progress}% Completed` : "Progress Update"}
                            </span>
                          </div>
                          
                          <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px", fontWeight: "600" }}>
                            Reported by {eng.fullName}
                          </div>

                          {/* Detailed Notes */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px", padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0", fontSize: "12px" }}>
                            {(update.completedToday || update.workDone || update.description) && (
                              <div>
                                <strong style={{ color: "#0f172a", fontWeight: "700" }}>Work Completed:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155", lineHeight: "1.4" }}>{update.completedToday || update.workDone || update.description}</p>
                              </div>
                            )}
                            {update.currentlyRunning && (
                              <div>
                                <strong style={{ color: "#0f172a", fontWeight: "700" }}>Work Currently Running:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155", lineHeight: "1.4" }}>{update.currentlyRunning}</p>
                              </div>
                            )}
                            {update.materialsStatus && (
                              <div>
                                <strong style={{ color: "#0f172a", fontWeight: "700" }}>Materials/Work Status:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155", lineHeight: "1.4" }}>{update.materialsStatus}</p>
                              </div>
                            )}
                            {update.problemsFaced && (
                              <div>
                                <strong style={{ color: "#dc2626", fontWeight: "700" }}>Problems Faced:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#991b1b", lineHeight: "1.4" }}>{update.problemsFaced}</p>
                              </div>
                            )}
                            {update.pendingWork && (
                              <div>
                                <strong style={{ color: "#0f172a", fontWeight: "700" }}>Pending Work:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155", lineHeight: "1.4" }}>{update.pendingWork}</p>
                              </div>
                            )}
                            {update.nextActivity && (
                              <div>
                                <strong style={{ color: "#0f172a", fontWeight: "700" }}>Next Planned Activity:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155", lineHeight: "1.4" }}>{update.nextActivity}</p>
                              </div>
                            )}
                            {update.remarks && (
                              <div>
                                <strong style={{ color: "#0f172a", fontWeight: "700" }}>Remarks:</strong>
                                <p style={{ margin: "2px 0 0 0", color: "#334155", lineHeight: "1.4" }}>{update.remarks}</p>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "8px" }}>
            <span style={{ color: "#64748b", fontWeight: "600" }}>Assigned Engineer(s)</span>
            {engineers.length === 0 ? (
              <strong style={{ color: "#0f172a" }}>Unassigned</strong>
            ) : (
              <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap", justifyContent: "flex-end" }}>
                {engineers.map(e => (
                  <span key={e.id} style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
                    <strong style={{ color: "#0f172a" }}>{e.fullName}</strong>
                    <button
                      type="button"
                      className="btn-icon btn-view-action"
                      onClick={() => setSelectedEngineerForActivity(e.id)}
                      title={`View ${e.fullName}'s activity dashboard`}
                      style={{
                        width: "20px",
                        height: "20px",
                        padding: 0,
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        borderRadius: "4px",
                        border: "1px solid #bfdbfe",
                        backgroundColor: "#eff6ff",
                        color: "#2563eb",
                        cursor: "pointer"
                      }}
                    >
                      <Eye size={11} />
                    </button>
                  </span>
                ))}
              </div>
            )}
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
              {actualBudget > 0 ? formatINR(actualBudget) : "Not Allocated"}
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

      {/* ===================================================================
          COMPLETION AUDIT REVIEW & DOUBLE CONFIRMATION MODAL
          =================================================================== */}
      {completionModal.isOpen && (
        <Modal
          isOpen={true}
          onClose={() => setCompletionModal({ isOpen: false, step: 1, acknowledgedPending: false, completionNotes: "", isSubmitting: false })}
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
                  backgroundColor: pendingAudit.hasPendingItems ? "#fff7ed" : "#f0fdf4",
                  border: pendingAudit.hasPendingItems ? "1.5px solid #fed7aa" : "1.5px solid #bbf7d0"
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    {pendingAudit.hasPendingItems ? (
                      <AlertTriangle size={18} style={{ color: "#ea580c" }} />
                    ) : (
                      <CheckCircle2 size={18} style={{ color: "#166534" }} />
                    )}
                    <strong style={{ fontSize: "14px", color: pendingAudit.hasPendingItems ? "#9a3412" : "#166534" }}>
                      {pendingAudit.hasPendingItems ? "Unresolved Pending Operational Items Found" : "Zero Blockers — Ready for Completion"}
                    </strong>
                  </div>
                  <p style={{ margin: 0, fontSize: "13px", color: pendingAudit.hasPendingItems ? "#c2410c" : "#15803d", lineHeight: "1.4" }}>
                    {pendingAudit.hasPendingItems 
                      ? "The canonical database indicates the following items are currently pending for this site. Review them before proceeding." 
                      : "All materials are fully received, transfers settled, and labour payments reconciled in the canonical database."}
                  </p>
                </div>

                {/* Itemized breakdown */}
                {pendingAudit.hasPendingItems && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                    <span style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "#64748b" }}>
                      Itemized Unresolved Breakdown:
                    </span>

                    {pendingAudit.pendingDeliveries.length > 0 && (
                      <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <strong style={{ fontSize: "13px", color: "#ea580c", display: "block" }}>
                          📦 Material Deliveries Pending ({pendingAudit.pendingDeliveries.length}):
                        </strong>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "#334155" }}>
                          {pendingAudit.pendingDeliveries.map(m => (
                            <li key={m.id}>
                              {m.materialName}: {m.pending} {m.unit} pending delivery ({m.received}/{m.required} received)
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {pendingAudit.pendingTransfers.length > 0 && (
                      <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <strong style={{ fontSize: "13px", color: "#0284c7", display: "block" }}>
                          🚚 Material Transfers in Transit ({pendingAudit.pendingTransfers.length}):
                        </strong>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "#334155" }}>
                          {pendingAudit.pendingTransfers.map(t => (
                            <li key={t.id}>
                              {t.materialName}: {t.pendingQuantity || t.transferQuantity} {t.unit} ({t.status})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {pendingAudit.pendingExpenses.length > 0 && (
                      <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <strong style={{ fontSize: "13px", color: "#ca8a04", display: "block" }}>
                          🧾 General Expenses Awaiting Approval ({pendingAudit.pendingExpenses.length}):
                        </strong>
                        <ul style={{ margin: "4px 0 0 0", paddingLeft: "18px", fontSize: "12.5px", color: "#334155" }}>
                          {pendingAudit.pendingExpenses.map(e => (
                            <li key={e.id}>
                              {e.category || "Expense"}: ₹{Number(e.amount || 0).toLocaleString("en-IN")} ({e.description || "Pending"})
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {pendingAudit.netPayableLabour > 0 && (
                      <div style={{ padding: "10px 14px", borderRadius: "10px", backgroundColor: "#f8fafc", border: "1px solid #e2e8f0" }}>
                        <strong style={{ fontSize: "13px", color: "#166534", display: "block" }}>
                          💰 Labour Payout Net Payable:
                        </strong>
                        <p style={{ margin: "4px 0 0 0", fontSize: "12.5px", color: "#334155" }}>
                          Gross wage: ₹{pendingAudit.grossLabour.toLocaleString("en-IN")} | Advances paid: ₹{pendingAudit.advances.toLocaleString("en-IN")} | <strong>Net Balance: ₹{pendingAudit.netPayableLabour.toLocaleString("en-IN")}</strong>
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
                      backgroundColor: "#fff7ed",
                      border: "1px solid #fed7aa",
                      cursor: "pointer",
                      marginTop: "6px"
                    }}>
                      <input
                        type="checkbox"
                        checked={completionModal.acknowledgedPending}
                        onChange={(e) => setCompletionModal(prev => ({ ...prev, acknowledgedPending: e.target.checked }))}
                        style={{ marginTop: "3px", width: "16px", height: "16px", accentColor: "#ea580c" }}
                      />
                      <span style={{ fontSize: "12.5px", color: "#9a3412", fontWeight: "700", lineHeight: "1.4" }}>
                        I have reviewed the unresolved items above and consciously confirm proceeding with site completion.
                      </span>
                    </label>
                  </div>
                )}

                {/* Next Step Action */}
                <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "10px" }}>
                  <button
                    type="button"
                    onClick={() => setCompletionModal({ isOpen: false, step: 1, acknowledgedPending: false, completionNotes: "", isSubmitting: false })}
                    className="btn btn-outline"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    disabled={pendingAudit.hasPendingItems && !completionModal.acknowledgedPending}
                    onClick={() => setCompletionModal(prev => ({ ...prev, step: 2 }))}
                    style={{
                      padding: "10px 18px",
                      borderRadius: "10px",
                      backgroundColor: (pendingAudit.hasPendingItems && !completionModal.acknowledgedPending) ? "#cbd5e1" : "#ea580c",
                      color: "#ffffff",
                      border: "none",
                      fontSize: "14px",
                      fontWeight: "750",
                      cursor: (pendingAudit.hasPendingItems && !completionModal.acknowledgedPending) ? "not-allowed" : "pointer"
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
                  <AlertCircle size={40} style={{ color: "#ea580c", margin: "0 auto 12px auto" }} />
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
                      backgroundColor: "#ea580c",
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
      )}

      {/* ===================================================================
          REOPEN SITE CONFIRMATION MODAL
          =================================================================== */}
      {reopenModal.isOpen && (
        <ConfirmationModal
          isOpen={true}
          title={`Reopen Site: ${site.siteName}?`}
          message="Reopening will set the site back to 'In Progress' status and allow engineers and administrators to log new attendance, material, and progress records."
          confirmText={reopenModal.isSubmitting ? "Reopening..." : "Reopen Site"}
          variant="primary"
          isLoading={reopenModal.isSubmitting}
          onConfirm={handleConfirmReopen}
          onClose={() => setReopenModal({ isOpen: false, reopenNotes: "", isSubmitting: false })}
        />
      )}
      {/* ===================================================================
          ADMIN ASSISTED ENTRY MODAL (OVERRIDE WHEN ENGINEER IS UNAVAILABLE)
          =================================================================== */}
      {showAdminEntryModal && (
        <AdminAssistedEntryModal
          isOpen={showAdminEntryModal}
          onClose={() => setShowAdminEntryModal(false)}
          initialSiteId={siteId}
          onSuccess={() => {
            loadData();
            showToast("Admin entry saved and synced across system.", "success");
          }}
        />
      )}

      {/* ===================================================================
          SITE ATTENDANCE HISTORY (30-DAY RESPONSIVE MODAL)
          =================================================================== */}
      {showSiteAttendanceModal && (
        <Modal
          isOpen={true}
          onClose={() => setShowSiteAttendanceModal(false)}
          title="Attendance History — Last 30 Days"
          subtitle={`Canonical attendance records for ${site.siteName}`}
          maxWidth="900px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* Filter Date Range Control Strip */}
            <div style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
              backgroundColor: "var(--primary-50)",
              padding: "12px 16px",
              borderRadius: "8px",
              border: "1px solid var(--border-color)"
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label htmlFor="site-modal-from-date" style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>From:</label>
                  <input
                    type="date"
                    id="site-modal-from-date"
                    value={siteModalFromDate}
                    onChange={(e) => setSiteModalFromDate(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      fontSize: "12.5px",
                      outline: "none",
                      backgroundColor: "#ffffff"
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <label htmlFor="site-modal-to-date" style={{ fontSize: "12px", fontWeight: "700", color: "#334155" }}>To:</label>
                  <input
                    type="date"
                    id="site-modal-to-date"
                    value={siteModalToDate}
                    onChange={(e) => setSiteModalToDate(e.target.value)}
                    style={{
                      padding: "6px 10px",
                      borderRadius: "6px",
                      border: "1px solid var(--border-color)",
                      fontSize: "12.5px",
                      outline: "none",
                      backgroundColor: "#ffffff"
                    }}
                  />
                </div>

                <Button
                  variant="primary"
                  size="sm"
                  onClick={() => setSiteAppliedModalRange({ from: siteModalFromDate, to: siteModalToDate })}
                >
                  Apply / View
                </Button>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    const r = getInitial30DayRange();
                    setSiteModalFromDate(r.from);
                    setSiteModalToDate(r.to);
                    setSiteAppliedModalRange(r);
                  }}
                >
                  Last 30 Days
                </Button>
              </div>

              {/* Range Badge Summary */}
              <div style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                Range: <strong style={{ color: "#0f172a" }}>{formatDisplayDate(siteAppliedModalRange.from)}</strong> to <strong style={{ color: "#0f172a" }}>{formatDisplayDate(siteAppliedModalRange.to)}</strong>
                <span style={{ marginLeft: "8px", backgroundColor: "#e2e8f0", padding: "2px 8px", borderRadius: "10px", fontWeight: "700", color: "#334155" }}>
                  {modalFilteredSiteAttendance.length} record{modalFilteredSiteAttendance.length !== 1 ? "s" : ""}
                </span>
              </div>
            </div>

            {/* Attendance Records Table */}
            <div style={{ maxHeight: "60vh", overflowY: "auto" }}>
              {renderSiteAttendanceTable(modalFilteredSiteAttendance)}
            </div>

            {/* Modal Footer */}
            <div style={{ display: "flex", justifyContent: "flex-end", paddingTop: "10px", borderTop: "1px solid var(--border-color)" }}>
              <Button variant="outline" onClick={() => setShowSiteAttendanceModal(false)}>
                Close
              </Button>
            </div>

          </div>
        </Modal>
      )}

      {/* Modal for viewing expanded verification photo */}
      {selectedAttendancePhotoModal && (
        <Modal
          isOpen={true}
          onClose={() => setSelectedAttendancePhotoModal(null)}
          title={selectedAttendancePhotoModal.title || "Verification Photo"}
          maxWidth="500px"
        >
          <div style={{ textAlign: "center", padding: "8px" }}>
            <img 
              src={selectedAttendancePhotoModal.url} 
              alt="Verification selfie preview" 
              style={{ maxWidth: "100%", maxHeight: "65vh", borderRadius: "8px", objectFit: "contain", border: "1px solid var(--border-color)" }}
            />
            <div style={{ marginTop: "16px", display: "flex", justifyContent: "flex-end" }}>
              <Button variant="outline" onClick={() => setSelectedAttendancePhotoModal(null)}>Close</Button>
            </div>
          </div>
        </Modal>
      )}

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />
    </Layout>
  );
}

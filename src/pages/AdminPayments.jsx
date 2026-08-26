import React, { useState, useEffect, useMemo, useRef } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import Loading from "../components/common/Loading";
import Modal from "../components/common/Modal";
import ViewToggle from "../components/common/ViewToggle";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getLabourTeams,
  subscribeAllLabourAttendance,
  subscribePayrollStatuses,
  subscribeMaterialsDetailed,
  recordWorkerPayoutPayment,
  logMaterialPayment
} from "../services/firebaseService";
import { formatINR, formatDateDMY, resolveLabourRecordCalculations } from "../services/businessLogic";
import {
  CreditCard,
  Building2,
  Users,
  Package,
  Calendar,
  Search,
  CheckCircle2,
  Clock,
  ArrowLeft,
  ChevronRight,
  History,
  Printer,
  DollarSign,
  MapPin,
  X,
  Filter,
  Layers,
  ArrowUpDown
} from "lucide-react";

export default function AdminPayments() {
  const { userProfile } = useAuth();

  // Loading & Submitting State
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const isSubmittingRef = useRef(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // Canonical Datasets (Single Source of Truth)
  const [sites, setSites] = useState([]);
  const [teams, setTeams] = useState([]);
  const [labourAttendance, setLabourAttendance] = useState([]);
  const [payrollStatuses, setPayrollStatuses] = useState({});
  const [materials, setMaterials] = useState([]);

  // Level 1: Site Overview View Mode ("grid" | "normal")
  const [viewMode, setViewMode] = useState("grid");
  const [siteSearchQuery, setSiteSearchQuery] = useState("");
  const [siteStatusFilter, setSiteStatusFilter] = useState("All"); // "All" | "Fully Paid" | "Partially Paid" | "Unpaid"

  // Level 2: Selected Site ID (null = Overview, string = Detail)
  const [selectedSiteId, setSelectedSiteId] = useState(null);

  // Level 2: Category Tab ("Labor" | "Materials")
  const [activeCategoryTab, setActiveCategoryTab] = useState("Labor");

  // Level 2: Date Range Filter (From Date / To Date)
  const getFirstDayOfCurrentMonth = () => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  };
  const getTodayStr = () => new Date().toISOString().split("T")[0];

  const [fromDate, setFromDate] = useState(() => getFirstDayOfCurrentMonth());
  const [toDate, setToDate] = useState(() => getTodayStr());

  // Level 2: Table Search & Status Filters
  const [detailSearchQuery, setDetailSearchQuery] = useState("");
  const [detailStatusFilter, setDetailStatusFilter] = useState("All");

  // Payment Recording Modal State
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null);
  const [payAmount, setPayAmount] = useState("");
  const [payDate, setPayDate] = useState(() => getTodayStr());
  const [payMethod, setPayMethod] = useState("Cash"); // "Cash" | "UPI" | "Cheque" | "Bank Transfer"
  const [payReference, setPayReference] = useState("");
  const [payNotes, setPayNotes] = useState("");
  const [paymentError, setPaymentError] = useState("");

  // Payment History Drawer/Modal State
  const [showHistoryModal, setShowHistoryModal] = useState(false);
  const [historyTarget, setHistoryTarget] = useState(null);

  const showToastMsg = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Safe Date String Extractor (supporting Firestore Timestamps, Strings, Dates)
  const extractDateStr = (val) => {
    if (!val) return "";
    if (typeof val === "string") {
      if (val.includes("T")) return val.split("T")[0];
      const trimmed = val.trim();
      if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
      return trimmed;
    }
    if (val && typeof val === "object") {
      if (typeof val.seconds === "number") {
        return new Date(val.seconds * 1000).toISOString().split("T")[0];
      }
      if (typeof val.toDate === "function") {
        try {
          return val.toDate().toISOString().split("T")[0];
        } catch (e) {}
      }
      if (val instanceof Date && !isNaN(val.getTime())) {
        return val.toISOString().split("T")[0];
      }
    }
    if (typeof val === "number" && !isNaN(val)) {
      return new Date(val).toISOString().split("T")[0];
    }
    return "";
  };

  // Date Range Matcher
  const isDateInRange = (rawDate) => {
    const d = extractDateStr(rawDate);
    if (!d) return true;
    if (fromDate && d < fromDate) return false;
    if (toDate && d > toDate) return false;
    return true;
  };

  // Date Quick Presets
  const applyPreset = (preset) => {
    const today = getTodayStr();
    if (preset === "today") {
      setFromDate(today);
      setToDate(today);
    } else if (preset === "this_week") {
      const d = new Date();
      const day = d.getDay();
      const diff = d.getDate() - day + (day === 0 ? -6 : 1);
      const start = new Date(d.setDate(diff)).toISOString().split("T")[0];
      setFromDate(start);
      setToDate(today);
    } else if (preset === "this_month") {
      setFromDate(getFirstDayOfCurrentMonth());
      setToDate(today);
    } else if (preset === "last_30") {
      const d = new Date();
      d.setDate(d.getDate() - 30);
      setFromDate(d.toISOString().split("T")[0]);
      setToDate(today);
    } else if (preset === "all") {
      setFromDate("");
      setToDate("");
    }
  };

  // Load initial reference data
  useEffect(() => {
    let isMounted = true;
    const fetchBase = async () => {
      try {
        setLoading(true);
        const [fetchedSites, fetchedTeams] = await Promise.all([
          getSites(),
          getLabourTeams()
        ]);
        if (!isMounted) return;
        setSites(fetchedSites || []);
        setTeams(fetchedTeams || []);
      } catch (err) {
        console.error("Failed to load payments base data:", err);
        showToastMsg("Error loading base datasets: " + err.message, "error");
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchBase();
    return () => { isMounted = false; };
  }, []);

  // Real-time subscriptions to canonical Firestore datasets
  useEffect(() => {
    const unsubLabour = subscribeAllLabourAttendance(setLabourAttendance);
    const unsubPayroll = subscribePayrollStatuses(setPayrollStatuses);
    const unsubMaterials = subscribeMaterialsDetailed(null, setMaterials);

    return () => {
      if (typeof unsubLabour === "function") unsubLabour();
      if (typeof unsubPayroll === "function") unsubPayroll();
      if (typeof unsubMaterials === "function") unsubMaterials();
    };
  }, []);

  // ─────────────────────────────────────────────────────────────
  // CANONICAL STATUS RESOLUTION (Database-Verified, Zero Hardcoding)
  // ─────────────────────────────────────────────────────────────

  // Resolve material payment status strictly from canonical data
  const resolveMaterialRecord = (m) => {
    const totalPayable = Number(
      m.totalAmount !== undefined 
        ? m.totalAmount 
        : (m.totalCost !== undefined 
            ? m.totalCost 
            : (Number(m.quantity || 0) * Number(m.unitPrice || m.rate || m.unitCost || 0)))
    ) || 0;

    let verifiedPaid = 0;
    if (Array.isArray(m.paymentHistory) && m.paymentHistory.length > 0) {
      verifiedPaid = m.paymentHistory.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    } else if (m.paidAmount !== undefined && m.paidAmount !== null && Number(m.paidAmount) > 0) {
      verifiedPaid = Number(m.paidAmount);
    }

    verifiedPaid = Math.min(totalPayable, verifiedPaid);
    const pendingAmount = Math.max(0, totalPayable - verifiedPaid);

    let status = "Unpaid";
    if (totalPayable > 0 && pendingAmount === 0 && verifiedPaid >= totalPayable) {
      status = "Fully Paid";
    } else if (verifiedPaid > 0 && pendingAmount > 0) {
      status = "Partially Paid";
    } else {
      status = "Unpaid";
    }

    return {
      totalPayable,
      paidAmount: verifiedPaid,
      pendingAmount,
      status,
      payments: Array.isArray(m.paymentHistory) ? m.paymentHistory : []
    };
  };

  // Resolve single labour attendance record status strictly from canonical data
  const resolveLabourAttendanceRecord = (r) => {
    const { amount: totalPayable } = resolveLabourRecordCalculations(r);

    const dateStr = extractDateStr(r.attendanceDate) || extractDateStr(r.date) || "";
    const specificStatusKey = `labour_rec_${r.id}`;
    const legacyGroupKey = `labour_${r.teamId}_${r.categoryId}_day_${dateStr}`;
    const monthKey = dateStr.slice(0, 7);
    const legacyMonthKey = `labour_${r.teamId}_${r.categoryId}_month_${monthKey}`;

    const statusObj = payrollStatuses[specificStatusKey] || payrollStatuses[legacyGroupKey] || payrollStatuses[legacyMonthKey] || {};

    let verifiedPaid = 0;
    if (Array.isArray(statusObj.payments) && statusObj.payments.length > 0) {
      verifiedPaid = statusObj.payments.reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
    } else if (statusObj.paidAmount !== undefined && statusObj.paidAmount !== null && Number(statusObj.paidAmount) > 0) {
      verifiedPaid = Number(statusObj.paidAmount);
    } else if (statusObj.status === "Paid" && statusObj.amount && Number(statusObj.amount) > 0) {
      verifiedPaid = Number(statusObj.amount);
    }

    verifiedPaid = Math.min(totalPayable, verifiedPaid);
    const pendingAmount = Math.max(0, totalPayable - verifiedPaid);

    let status = "Unpaid";
    if (totalPayable > 0 && pendingAmount === 0 && verifiedPaid >= totalPayable) {
      status = "Fully Paid";
    } else if (verifiedPaid > 0 && pendingAmount > 0) {
      status = "Partially Paid";
    } else {
      status = "Unpaid";
    }

    return {
      rawKey: specificStatusKey,
      statusObj,
      totalPayable,
      paidAmount: verifiedPaid,
      pendingAmount,
      status,
      payments: Array.isArray(statusObj.payments) ? statusObj.payments : []
    };
  };

  // ─────────────────────────────────────────────────────────────
  // 1. SITE-WISE SUMMARY CALCULATION (LEVEL 1: MAIN OVERVIEW)
  // ─────────────────────────────────────────────────────────────
  const siteSummaries = useMemo(() => {
    const siteMap = new Map();

    sites.forEach(site => {
      if (!site || !site.id) return;

      // 1. Calculate Site Labour Obligations
      const siteLabourRecords = labourAttendance.filter(r => r.siteId === site.id && !r.id?.startsWith("labour_lock_") && r.type !== "labour_attendance_lock" && !r.lockedMetadata && r.type !== "lock");
      let siteLabourPayable = 0;
      let siteLabourPaid = 0;

      siteLabourRecords.forEach(r => {
        const res = resolveLabourAttendanceRecord(r);
        siteLabourPayable += res.totalPayable;
        siteLabourPaid += res.paidAmount;
      });

      const siteLabourPending = Math.max(0, siteLabourPayable - siteLabourPaid);
      let siteLabourStatus = "Unpaid";
      if (siteLabourPayable > 0 && siteLabourPending === 0 && siteLabourPaid >= siteLabourPayable) {
        siteLabourStatus = "Fully Paid";
      } else if (siteLabourPaid > 0 && siteLabourPending > 0) {
        siteLabourStatus = "Partially Paid";
      }

      // 2. Calculate Site Material Obligations
      const siteMaterials = materials.filter(m => m.siteId === site.id);
      let siteMaterialPayable = 0;
      let siteMaterialPaid = 0;

      siteMaterials.forEach(m => {
        const res = resolveMaterialRecord(m);
        siteMaterialPayable += res.totalPayable;
        siteMaterialPaid += res.paidAmount;
      });

      const siteMaterialPending = Math.max(0, siteMaterialPayable - siteMaterialPaid);
      let siteMaterialStatus = "Unpaid";
      if (siteMaterialPayable > 0 && siteMaterialPending === 0 && siteMaterialPaid >= siteMaterialPayable) {
        siteMaterialStatus = "Fully Paid";
      } else if (siteMaterialPaid > 0 && siteMaterialPending > 0) {
        siteMaterialStatus = "Partially Paid";
      }

      // 3. Overall Site Totals
      const totalPayable = siteLabourPayable + siteMaterialPayable;
      const totalPaid = siteLabourPaid + siteMaterialPaid;
      const totalPending = Math.max(0, totalPayable - totalPaid);

      let overallStatus = "Unpaid";
      if (totalPayable > 0 && totalPending === 0 && totalPaid >= totalPayable) {
        overallStatus = "Fully Paid";
      } else if (totalPaid > 0 && totalPending > 0) {
        overallStatus = "Partially Paid";
      }

      const completionRate = totalPayable > 0 ? Math.min(100, Math.round((totalPaid / totalPayable) * 100)) : 100;

      siteMap.set(site.id, {
        siteId: site.id,
        siteName: site.siteName || "Site " + site.id,
        location: site.location || site.address || "Active Worksites",
        totalPayable,
        totalPaid,
        totalPending,
        overallStatus,
        completionRate,
        labour: {
          payable: siteLabourPayable,
          paid: siteLabourPaid,
          pending: siteLabourPending,
          status: siteLabourStatus,
          recordsCount: siteLabourRecords.length
        },
        materials: {
          payable: siteMaterialPayable,
          paid: siteMaterialPaid,
          pending: siteMaterialPending,
          status: siteMaterialStatus,
          recordsCount: siteMaterials.length
        }
      });
    });

    return Array.from(siteMap.values());
  }, [sites, labourAttendance, materials, payrollStatuses]);

  // Filtered Site Summaries for Level 1
  const filteredSites = useMemo(() => {
    return siteSummaries.filter(site => {
      if (siteStatusFilter !== "All") {
        if (siteStatusFilter === "Unpaid" && site.overallStatus !== "Unpaid" && site.overallStatus !== "Pending") return false;
        if (siteStatusFilter === "Partially Paid" && site.overallStatus !== "Partially Paid") return false;
        if (siteStatusFilter === "Fully Paid" && site.overallStatus !== "Fully Paid") return false;
      }
      if (siteSearchQuery.trim()) {
        const q = siteSearchQuery.toLowerCase().trim();
        const matchName = site.siteName.toLowerCase().includes(q);
        const matchLoc = site.location.toLowerCase().includes(q);
        if (!matchName && !matchLoc) return false;
      }
      return true;
    });
  }, [siteSummaries, siteStatusFilter, siteSearchQuery]);

  // Global KPI Summary across All Sites
  const globalKpis = useMemo(() => {
    const totalPayable = siteSummaries.reduce((sum, s) => sum + s.totalPayable, 0);
    const totalPaid = siteSummaries.reduce((sum, s) => sum + s.totalPaid, 0);
    const totalPending = Math.max(0, totalPayable - totalPaid);
    const completionRate = totalPayable > 0 ? Math.min(100, Math.round((totalPaid / totalPayable) * 100)) : 100;

    const fullyPaidSites = siteSummaries.filter(s => s.overallStatus === "Fully Paid").length;
    const partialSites = siteSummaries.filter(s => s.overallStatus === "Partially Paid").length;
    const unpaidSites = siteSummaries.filter(s => s.overallStatus === "Unpaid" || s.overallStatus === "Pending").length;

    return {
      totalPayable,
      totalPaid,
      totalPending,
      completionRate,
      totalSitesCount: siteSummaries.length,
      fullyPaidSites,
      partialSites,
      unpaidSites
    };
  }, [siteSummaries]);

  // Selected Site Object for Level 2 Detail View
  const currentSelectedSite = useMemo(() => {
    if (!selectedSiteId) return null;
    return siteSummaries.find(s => s.siteId === selectedSiteId) || sites.find(s => s.id === selectedSiteId) || null;
  }, [selectedSiteId, siteSummaries, sites]);

  // ─────────────────────────────────────────────────────────────
  // 2. SITE DETAIL: LABOR CATEGORY RECORDS (DUPLICATE-SAFE)
  // ─────────────────────────────────────────────────────────────
  const currentSiteLabourRows = useMemo(() => {
    if (!selectedSiteId) return [];

    const siteRecords = labourAttendance.filter(r => {
      if (r.siteId !== selectedSiteId) return false;
      if (r.id?.startsWith("labour_lock_") || r.type === "labour_attendance_lock" || r.lockedMetadata || r.type === "lock") return false;
      const rDate = extractDateStr(r.attendanceDate) || extractDateStr(r.date) || "";
      if (!isDateInRange(rDate)) return false;
      return true;
    });

    const uniqueMap = new Map();

    siteRecords.forEach(r => {
      if (!r || !r.id) return;
      if (uniqueMap.has(r.id)) return;

      const teamObj = teams.find(t => t.id === r.teamId);
      const categoryObj = teamObj?.categories?.[r.categoryId];
      const categoryName = categoryObj ? categoryObj.name : (r.categoryName || r.categoryId || "Labour");

      const { workerCount: count, units: customUnits, wage: effectiveDailyWage } = resolveLabourRecordCalculations(r);

      const paymentRes = resolveLabourAttendanceRecord(r);
      const dateStr = extractDateStr(r.attendanceDate) || extractDateStr(r.date) || "";

      uniqueMap.set(r.id, {
        id: r.id,
        rawKey: paymentRes.rawKey,
        type: "Labor",
        workerName: categoryName,
        teamName: teamObj?.teamName || r.teamName || "Labour Team",
        dateLabel: dateStr ? formatDateDMY(dateStr) : "Attendance Log",
        rawDate: dateStr,
        workerCount: count,
        workUnits: customUnits,
        applicableRate: effectiveDailyWage,
        totalPayable: paymentRes.totalPayable,
        paidAmount: paymentRes.paidAmount,
        pendingAmount: paymentRes.pendingAmount,
        status: paymentRes.status,
        payments: paymentRes.payments,
        rawType: "labour",
        rawRecord: r
      });
    });

    const rows = Array.from(uniqueMap.values());
    rows.sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""));

    return rows.filter(row => {
      if (detailStatusFilter !== "All") {
        if (detailStatusFilter === "Unpaid" && row.status !== "Unpaid" && row.status !== "Pending") return false;
        if (detailStatusFilter === "Partially Paid" && row.status !== "Partially Paid") return false;
        if (detailStatusFilter === "Fully Paid" && row.status !== "Fully Paid") return false;
      }
      if (detailSearchQuery.trim()) {
        const q = detailSearchQuery.toLowerCase().trim();
        return row.workerName.toLowerCase().includes(q) || row.teamName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [selectedSiteId, labourAttendance, teams, payrollStatuses, fromDate, toDate, detailStatusFilter, detailSearchQuery]);

  // ─────────────────────────────────────────────────────────────
  // 3. SITE DETAIL: MATERIALS CATEGORY RECORDS (DUPLICATE-SAFE)
  // ─────────────────────────────────────────────────────────────
  const currentSiteMaterialRows = useMemo(() => {
    if (!selectedSiteId) return [];

    const siteMaterials = materials.filter(m => {
      if (m.siteId !== selectedSiteId) return false;
      const matDate = extractDateStr(m.deliveryDate) || extractDateStr(m.date) || extractDateStr(m.orderDate) || extractDateStr(m.createdAt) || "";
      if (!isDateInRange(matDate)) return false;
      return true;
    });

    const uniqueMap = new Map();

    siteMaterials.forEach(m => {
      if (!m || !m.id) return;
      if (uniqueMap.has(m.id)) return;

      const matRes = resolveMaterialRecord(m);
      const matDate = extractDateStr(m.deliveryDate) || extractDateStr(m.date) || extractDateStr(m.orderDate) || extractDateStr(m.createdAt) || "";

      uniqueMap.set(m.id, {
        id: m.id,
        rawKey: m.id,
        type: "Materials",
        materialName: m.materialName || m.name || "Material Item",
        supplierName: m.supplierName || m.vendor || "Material Supplier",
        deliveryDate: matDate ? formatDateDMY(matDate) : "Order Log",
        rawDate: matDate,
        quantityText: `${m.quantity || m.receivedQuantity || 0} ${m.unit || "Units"}`,
        unitRate: Number(m.unitPrice || m.rate || m.unitCost || 0),
        totalPayable: matRes.totalPayable,
        paidAmount: matRes.paidAmount,
        pendingAmount: matRes.pendingAmount,
        status: matRes.status,
        payments: matRes.payments,
        rawType: "material",
        materialId: m.id,
        rawRecord: m
      });
    });

    const rows = Array.from(uniqueMap.values());
    rows.sort((a, b) => (b.rawDate || "").localeCompare(a.rawDate || ""));

    return rows.filter(row => {
      if (detailStatusFilter !== "All") {
        if (detailStatusFilter === "Unpaid" && row.status !== "Unpaid" && row.status !== "Pending") return false;
        if (detailStatusFilter === "Partially Paid" && row.status !== "Partially Paid") return false;
        if (detailStatusFilter === "Fully Paid" && row.status !== "Fully Paid") return false;
      }
      if (detailSearchQuery.trim()) {
        const q = detailSearchQuery.toLowerCase().trim();
        return row.materialName.toLowerCase().includes(q) || row.supplierName.toLowerCase().includes(q);
      }
      return true;
    });
  }, [selectedSiteId, materials, fromDate, toDate, detailStatusFilter, detailSearchQuery]);

  // Site Category Summary Totals
  const siteCategoryKpis = useMemo(() => {
    const list = activeCategoryTab === "Labor" ? currentSiteLabourRows : currentSiteMaterialRows;
    const payable = list.reduce((sum, r) => sum + r.totalPayable, 0);
    const paid = list.reduce((sum, r) => sum + r.paidAmount, 0);
    const pending = Math.max(0, payable - paid);

    let status = "Unpaid";
    if (payable > 0 && pending === 0 && paid >= payable) status = "Fully Paid";
    else if (paid > 0 && pending > 0) status = "Partially Paid";

    return { payable, paid, pending, status, count: list.length };
  }, [activeCategoryTab, currentSiteLabourRows, currentSiteMaterialRows]);

  // ─────────────────────────────────────────────────────────────
  // 4. PAYMENT ACTION (IDEMPOTENT & MULTI-USER SAFE)
  // ─────────────────────────────────────────────────────────────
  const handleOpenPaymentModal = (row) => {
    setPaymentTarget(row);
    setPayAmount(row.pendingAmount > 0 ? String(row.pendingAmount) : "");
    setPayDate(getTodayStr());
    setPayMethod("Cash");
    setPayReference("");
    setPayNotes("");
    setPaymentError("");
    setShowPaymentModal(true);
  };

  const handleOpenHistoryModal = (row) => {
    setHistoryTarget(row);
    setShowHistoryModal(true);
  };

  const handleExecutePayment = async (e) => {
    e.preventDefault();
    if (!paymentTarget) return;
    if (isSubmittingRef.current || submitting) return;

    const numericAmount = Number(payAmount);
    if (!numericAmount || isNaN(numericAmount) || numericAmount <= 0) {
      setPaymentError("Please enter a valid payment amount greater than ₹0.");
      return;
    }

    if (numericAmount > paymentTarget.pendingAmount + 0.01) {
      setPaymentError(`Payment amount (₹${numericAmount.toLocaleString("en-IN")}) exceeds remaining pending amount (₹${paymentTarget.pendingAmount.toLocaleString("en-IN")}).`);
      return;
    }

    isSubmittingRef.current = true;
    setSubmitting(true);
    setPaymentError("");

    try {
      if (paymentTarget.rawType === "material") {
        await logMaterialPayment(paymentTarget.materialId, {
          amount: numericAmount,
          date: payDate,
          method: payMethod,
          reference: payReference,
          notes: payNotes,
          recordedBy: userProfile?.fullName || userProfile?.name || "Admin"
        });
        showToastMsg(`Material payment of ₹${numericAmount.toLocaleString("en-IN")} recorded successfully.`, "success");
      } else {
        await recordWorkerPayoutPayment(
          paymentTarget.rawKey,
          {
            amount: numericAmount,
            paymentDate: payDate,
            paymentMethod: payMethod,
            reference: payReference,
            notes: payNotes,
            recordedBy: userProfile?.fullName || userProfile?.name || "Admin"
          },
          paymentTarget.totalPayable
        );
        showToastMsg(`Labour payment of ₹${numericAmount.toLocaleString("en-IN")} recorded successfully.`, "success");
      }

      setShowPaymentModal(false);
      setPaymentTarget(null);
    } catch (err) {
      console.error("Payment submission failed:", err);
      setPaymentError("Payment recording failed: " + err.message);
      showToastMsg("Payment error: " + err.message, "error");
    } finally {
      isSubmittingRef.current = false;
      setSubmitting(false);
    }
  };

  const renderStatusBadge = (status) => {
    const norm = (status || "").toLowerCase().trim();
    if (norm === "fully paid" || norm === "paid") {
      return <Badge status="approved">Fully Paid</Badge>;
    }
    if (norm === "partially paid" || norm === "partial") {
      return <Badge status="warning">Partially Paid</Badge>;
    }
    return <Badge status="pending">Unpaid</Badge>;
  };

  return (
    <Layout
      title="Payments Dashboard"
      description="Manage worksite payment obligations, verified payment settlements, and disbursement records."
    >
      {/* ═══════════════════════════════════════════════════════════ */}
      {/* LEVEL 1: SITE-WISE PAYMENTS OVERVIEW                        */}
      {/* ═══════════════════════════════════════════════════════════ */}
      {!selectedSiteId ? (
        <>
          {/* Header Card with Native Filter Bar */}
          <div className="card" style={{ marginBottom: "20px" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>
                    Site-wise Payments
                  </h2>
                  <span style={{ backgroundColor: "#fff7ed", color: "#c2410c", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "12px", border: "1px solid #ffedd5" }}>
                    {filteredSites.length} Worksites
                  </span>
                </div>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
                  High-level overview of payment obligations and verified disbursements across all active worksites.
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                {/* ViewToggle Component */}
                <ViewToggle viewMode={viewMode} onChange={setViewMode} />

                {/* Print Button */}
                <Button onClick={() => window.print()} variant="outline" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Printer size={16} />
                  <span>Print Ledger</span>
                </Button>
              </div>
            </div>

            {/* Filter Controls Bar */}
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "14px", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
              {/* Search Worksite */}
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Search Worksite
                </label>
                <div style={{ position: "relative" }}>
                  <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                  <input
                    type="text"
                    placeholder="Search by site name or location..."
                    value={siteSearchQuery}
                    onChange={(e) => setSiteSearchQuery(e.target.value)}
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 36px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      backgroundColor: "#ffffff",
                      fontSize: "13px",
                      fontWeight: "500",
                      color: "#0f172a",
                      outline: "none",
                      boxSizing: "border-box"
                    }}
                  />
                </div>
              </div>

              {/* Status Filter */}
              <div>
                <label style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>
                  Payment Status
                </label>
                <select
                  value={siteStatusFilter}
                  onChange={(e) => setSiteStatusFilter(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "13px",
                    fontWeight: "600",
                    color: "#0f172a",
                    outline: "none"
                  }}
                >
                  <option value="All">All Worksites</option>
                  <option value="Unpaid">Unpaid Only</option>
                  <option value="Partially Paid">Partially Paid Only</option>
                  <option value="Fully Paid">Fully Paid Only</option>
                </select>
              </div>
            </div>
          </div>

          {/* Global KPI Summary Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
            gap: "16px",
            marginBottom: "20px"
          }}>
            {/* Total Payable */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Payable (All Sites)
              </span>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                ₹{globalKpis.totalPayable.toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                Across {globalKpis.totalSitesCount} active project worksites
              </div>
            </div>

            {/* Total Paid */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Paid (Verified)
              </span>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#15803d", marginTop: "4px" }}>
                ₹{globalKpis.totalPaid.toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                <span style={{ fontWeight: "700", color: "#16a34a" }}>{globalKpis.fullyPaidSites}</span> fully settled ({globalKpis.partialSites} partial)
              </div>
            </div>

            {/* Total Pending */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Total Pending
              </span>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#c2410c", marginTop: "4px" }}>
                ₹{globalKpis.totalPending.toLocaleString("en-IN")}
              </div>
              <div style={{ fontSize: "12px", color: "#64748b", marginTop: "6px" }}>
                <span style={{ fontWeight: "700", color: "#c2410c" }}>{globalKpis.unpaidSites + globalKpis.partialSites}</span> sites awaiting settlement
              </div>
            </div>

            {/* Settlement Progress */}
            <div className="card" style={{ padding: "18px 20px" }}>
              <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                Settlement Rate
              </span>
              <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "4px" }}>
                {globalKpis.completionRate}%
              </div>
              <div style={{ width: "100%", height: "6px", backgroundColor: "#f1f5f9", borderRadius: "99px", marginTop: "8px", overflow: "hidden" }}>
                <div style={{
                  width: `${globalKpis.completionRate}%`,
                  height: "100%",
                  backgroundColor: globalKpis.completionRate === 100 ? "#16a34a" : "#ea580c",
                  borderRadius: "99px"
                }} />
              </div>
            </div>
          </div>

          {/* Sites Container: Grid View vs List View */}
          {loading ? (
            <div className="card" style={{ padding: "40px", textAlign: "center" }}>
              <Loading show={true} text="Loading worksite payment obligations..." />
            </div>
          ) : filteredSites.length === 0 ? (
            <div className="card" style={{ padding: "48px 20px", textAlign: "center", color: "#64748b" }}>
              <Building2 size={36} color="#94a3b8" style={{ marginBottom: "8px" }} />
              <div style={{ fontSize: "15px", fontWeight: "750", color: "#1e293b" }}>No worksites found</div>
              <div style={{ fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                No worksites match the active filter criteria.
              </div>
            </div>
          ) : viewMode === "grid" ? (
            /* Grid View */
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>
              {filteredSites.map(site => {
                const initials = site.siteName ? site.siteName.split(" ").map(w => w[0]).join("").substring(0, 2).toUpperCase() : "CS";
                return (
                  <div
                    key={site.siteId}
                    className="card"
                    onClick={() => {
                      setSelectedSiteId(site.siteId);
                      setActiveCategoryTab("Labor");
                      setDetailStatusFilter("All");
                      setDetailSearchQuery("");
                    }}
                    style={{
                      cursor: "pointer",
                      padding: "18px",
                      transition: "transform 0.15s ease, box-shadow 0.15s ease",
                      display: "flex",
                      flexDirection: "column",
                      justifyContent: "space-between",
                      gap: "14px"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.boxShadow = "0 6px 18px rgba(0,0,0,0.06)";
                      e.currentTarget.style.transform = "translateY(-2px)";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.boxShadow = "";
                      e.currentTarget.style.transform = "none";
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <div style={{
                            width: "36px",
                            height: "36px",
                            borderRadius: "9px",
                            backgroundColor: "#fff7ed",
                            border: "1.5px solid #ffedd5",
                            color: "#c2410c",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            fontWeight: "800",
                            fontSize: "12px",
                            flexShrink: 0
                          }}>
                            {initials}
                          </div>
                          <div>
                            <h3 style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                              {site.siteName}
                            </h3>
                            <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                              <MapPin size={12} color="#ea580c" />
                              <span>{site.location}</span>
                            </div>
                          </div>
                        </div>
                        <div>
                          {renderStatusBadge(site.overallStatus)}
                        </div>
                      </div>

                      {/* Financial Metrics Summary Box */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "1fr 1fr 1fr",
                        gap: "8px",
                        backgroundColor: "#f8fafc",
                        borderRadius: "8px",
                        padding: "10px",
                        marginTop: "12px",
                        textAlign: "center",
                        border: "1px solid #f1f5f9"
                      }}>
                        <div>
                          <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Payable</span>
                          <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                            ₹{site.totalPayable.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Paid</span>
                          <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#15803d", marginTop: "2px" }}>
                            ₹{site.totalPaid.toLocaleString("en-IN")}
                          </div>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase" }}>Pending</span>
                          <div style={{ fontSize: "13.5px", fontWeight: "800", color: site.totalPending > 0 ? "#c2410c" : "#16a34a", marginTop: "2px" }}>
                            ₹{site.totalPending.toLocaleString("en-IN")}
                          </div>
                        </div>
                      </div>

                      {/* Category Quick Preview */}
                      <div style={{ display: "flex", flexDirection: "column", gap: "5px", marginTop: "10px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Users size={12} color="#2563eb" /> <strong>Labor:</strong> ₹{site.labour.payable.toLocaleString("en-IN")}
                          </span>
                          <span style={{ color: site.labour.pending > 0 ? "#c2410c" : "#16a34a", fontWeight: "700" }}>
                            {site.labour.pending > 0 ? `₹${site.labour.pending.toLocaleString("en-IN")} pending` : "Settled"}
                          </span>
                        </div>

                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", color: "#475569" }}>
                          <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                            <Package size={12} color="#16a34a" /> <strong>Materials:</strong> ₹{site.materials.payable.toLocaleString("en-IN")}
                          </span>
                          <span style={{ color: site.materials.pending > 0 ? "#c2410c" : "#16a34a", fontWeight: "700" }}>
                            {site.materials.pending > 0 ? `₹${site.materials.pending.toLocaleString("en-IN")} pending` : "Settled"}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Card Footer */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      paddingTop: "10px",
                      borderTop: "1px solid #f1f5f9",
                      color: "#ea580c",
                      fontSize: "12px",
                      fontWeight: "750"
                    }}>
                      <span>View Payments Detail</span>
                      <ChevronRight size={15} />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* List / Table View */
            <div className="table-card">
              <div style={{ overflowX: "auto" }}>
                <table className="table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                  <thead>
                    <tr style={{ background: "var(--primary-50, #f8fafc)", borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
                      <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Worksite Name</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Location</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Total Payable</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Total Paid</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Total Pending</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "center" }}>Overall Status</th>
                      <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "center" }}>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredSites.map(site => (
                      <tr
                        key={site.siteId}
                        onClick={() => {
                          setSelectedSiteId(site.siteId);
                          setActiveCategoryTab("Labor");
                          setDetailStatusFilter("All");
                          setDetailSearchQuery("");
                        }}
                        style={{
                          borderBottom: "1px solid #f1f5f9",
                          cursor: "pointer",
                          transition: "background-color 0.12s ease"
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.backgroundColor = "#f8fafc"}
                        onMouseLeave={(e) => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <td style={{ padding: "12px 16px", fontWeight: "700", color: "#0f172a" }}>
                          {site.siteName}
                        </td>
                        <td style={{ padding: "12px 16px", color: "#64748b" }}>
                          {site.location}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#0f172a" }}>
                          ₹{site.totalPayable.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "700", color: "#16a34a" }}>
                          ₹{site.totalPaid.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "right", fontWeight: "800", color: site.totalPending > 0 ? "#c2410c" : "#16a34a" }}>
                          ₹{site.totalPending.toLocaleString("en-IN")}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          {renderStatusBadge(site.overallStatus)}
                        </td>
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <Button size="small" variant="primary" style={{ padding: "5px 12px", fontSize: "12px" }}>
                            <span>View Detail</span>
                            <ChevronRight size={13} style={{ marginLeft: "4px" }} />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        /* ═══════════════════════════════════════════════════════════ */
        /* LEVEL 2: SITE PAYMENTS DETAIL (DATE RANGE + LABOR/MATERIALS) */
        /* ═══════════════════════════════════════════════════════════ */
        <>
          {/* Site Detail Header Card */}
          <div className="card" style={{ marginBottom: "20px" }}>
            {/* Back Navigation */}
            <div style={{ marginBottom: "14px" }}>
              <Button
                variant="outline"
                size="small"
                onClick={() => setSelectedSiteId(null)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <ArrowLeft size={14} />
                <span>Back to All Worksites</span>
              </Button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "16px" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0 }}>
                    {currentSelectedSite?.siteName} — Payments Detail
                  </h2>
                  {currentSelectedSite && renderStatusBadge(currentSelectedSite.overallStatus)}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px", fontSize: "13px", color: "#64748b", marginTop: "4px" }}>
                  <MapPin size={13} color="#ea580c" />
                  <span>{currentSelectedSite?.location}</span>
                </div>
              </div>

              <Button onClick={() => window.print()} variant="outline" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <Printer size={16} />
                <span>Print Site Ledger</span>
              </Button>
            </div>

            {/* ── DATE RANGE FILTER SECTION ── */}
            <div style={{
              marginTop: "18px",
              paddingTop: "16px",
              borderTop: "1px solid #f1f5f9",
              display: "flex",
              flexDirection: "column",
              gap: "10px"
            }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "10px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <Calendar size={15} color="#ea580c" />
                  <span style={{ fontSize: "12px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase" }}>Filter Date Range</span>
                </div>

                {/* Quick Presets */}
                <div style={{ display: "flex", gap: "4px", flexWrap: "wrap" }}>
                  {[
                    { key: "today", label: "Today" },
                    { key: "this_week", label: "This Week" },
                    { key: "this_month", label: "This Month" },
                    { key: "last_30", label: "Last 30 Days" },
                    { key: "all", label: "All Dates" }
                  ].map(btn => (
                    <button
                      key={btn.key}
                      type="button"
                      onClick={() => applyPreset(btn.key)}
                      style={{
                        padding: "4px 9px",
                        fontSize: "11.5px",
                        fontWeight: "700",
                        backgroundColor: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        borderRadius: "6px",
                        color: "#475569",
                        cursor: "pointer"
                      }}
                    >
                      {btn.label}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>From:</span>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => setFromDate(e.target.value)}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                </div>

                <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>To:</span>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => setToDate(e.target.value)}
                    style={{
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      fontWeight: "600",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                </div>

                {(fromDate || toDate) && (
                  <Button
                    variant="outline"
                    size="small"
                    onClick={() => { setFromDate(""); setToDate(""); }}
                    style={{ display: "inline-flex", alignItems: "center", gap: "4px", padding: "5px 9px", fontSize: "11.5px" }}
                  >
                    <X size={13} /> Clear
                  </Button>
                )}
              </div>
            </div>
          </div>

          {/* Category Navigation Tabs: Labor vs Materials */}
          <div style={{
            display: "flex",
            gap: "8px",
            marginBottom: "16px"
          }}>
            <button
              type="button"
              onClick={() => setActiveCategoryTab("Labor")}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "10px",
                border: activeCategoryTab === "Labor" ? "1.5px solid #ea580c" : "1px solid #e2e8f0",
                backgroundColor: activeCategoryTab === "Labor" ? "#fff7ed" : "#ffffff",
                color: activeCategoryTab === "Labor" ? "#c2410c" : "#475569",
                fontSize: "13px",
                fontWeight: activeCategoryTab === "Labor" ? "800" : "600",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <Users size={16} color={activeCategoryTab === "Labor" ? "#ea580c" : "#64748b"} />
              <span>Labor</span>
              <span style={{
                fontSize: "11px",
                fontWeight: "800",
                padding: "2px 7px",
                borderRadius: "6px",
                backgroundColor: activeCategoryTab === "Labor" ? "#ea580c" : "#f1f5f9",
                color: activeCategoryTab === "Labor" ? "#ffffff" : "#64748b"
              }}>
                {currentSiteLabourRows.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => setActiveCategoryTab("Materials")}
              style={{
                flex: 1,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "8px",
                padding: "10px 16px",
                borderRadius: "10px",
                border: activeCategoryTab === "Materials" ? "1.5px solid #ea580c" : "1px solid #e2e8f0",
                backgroundColor: activeCategoryTab === "Materials" ? "#fff7ed" : "#ffffff",
                color: activeCategoryTab === "Materials" ? "#c2410c" : "#475569",
                fontSize: "13px",
                fontWeight: activeCategoryTab === "Materials" ? "800" : "600",
                cursor: "pointer",
                transition: "all 0.15s ease"
              }}
            >
              <Package size={16} color={activeCategoryTab === "Materials" ? "#ea580c" : "#64748b"} />
              <span>Materials</span>
              <span style={{
                fontSize: "11px",
                fontWeight: "800",
                padding: "2px 7px",
                borderRadius: "6px",
                backgroundColor: activeCategoryTab === "Materials" ? "#ea580c" : "#f1f5f9",
                color: activeCategoryTab === "Materials" ? "#ffffff" : "#64748b"
              }}>
                {currentSiteMaterialRows.length}
              </span>
            </button>
          </div>

          {/* Category Summary KPI Cards */}
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "14px",
            marginBottom: "20px"
          }}>
            <div className="card" style={{ padding: "16px 18px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                {activeCategoryTab} Payable
              </span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", marginTop: "3px" }}>
                ₹{siteCategoryKpis.payable.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="card" style={{ padding: "16px 18px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>
                {activeCategoryTab} Paid
              </span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: "#15803d", marginTop: "3px" }}>
                ₹{siteCategoryKpis.paid.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="card" style={{ padding: "16px 18px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase" }}>
                {activeCategoryTab} Pending
              </span>
              <div style={{ fontSize: "20px", fontWeight: "800", color: siteCategoryKpis.pending > 0 ? "#c2410c" : "#16a34a", marginTop: "3px" }}>
                ₹{siteCategoryKpis.pending.toLocaleString("en-IN")}
              </div>
            </div>

            <div className="card" style={{ padding: "16px 18px", display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>
                {activeCategoryTab} Status
              </span>
              <div style={{ marginTop: "4px" }}>
                {renderStatusBadge(siteCategoryKpis.status)}
              </div>
            </div>
          </div>

          {/* Category Records Table (Duplicate-Safe) */}
          <div className="table-card">
            {/* Search & Status Filters */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "12px",
              padding: "16px 20px",
              borderBottom: "1px solid #f1f5f9"
            }}>
              <div style={{ position: "relative", minWidth: "240px", flex: 1, maxWidth: "380px" }}>
                <Search size={15} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
                <input
                  type="text"
                  placeholder={`Search ${activeCategoryTab === "Labor" ? "mason / worker / team..." : "material / supplier..."}`}
                  value={detailSearchQuery}
                  onChange={(e) => setDetailSearchQuery(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 12px 8px 34px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: "500",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "#64748b" }}>Status:</span>
                <select
                  value={detailStatusFilter}
                  onChange={(e) => setDetailStatusFilter(e.target.value)}
                  style={{
                    padding: "6px 10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12px",
                    fontWeight: "600",
                    color: "#0f172a",
                    outline: "none"
                  }}
                >
                  <option value="All">All Records</option>
                  <option value="Unpaid">Unpaid Only</option>
                  <option value="Partially Paid">Partially Paid Only</option>
                  <option value="Fully Paid">Fully Paid Only</option>
                </select>
              </div>
            </div>

            {/* Data Table */}
            <div style={{ overflowX: "auto" }}>
              <table className="table" style={{ width: "100%", borderCollapse: "collapse", textAlign: "left", fontSize: "13px" }}>
                <thead>
                  <tr style={{ background: "var(--primary-50, #f8fafc)", borderBottom: "1px solid var(--border-color, #e2e8f0)" }}>
                    {activeCategoryTab === "Labor" ? (
                      <>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Worker / Mason</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Team</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Date</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "center" }}>Count</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Rate (₹)</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Payable</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Paid</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Pending</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "center" }}>Status</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "center" }}>Actions</th>
                      </>
                    ) : (
                      <>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Material</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Supplier / Vendor</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Delivery Date</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569" }}>Quantity</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Rate (₹)</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Total Amount</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Paid Amount</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "right" }}>Pending</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "center" }}>Status</th>
                        <th style={{ padding: "12px 16px", fontWeight: "700", color: "#475569", textAlign: "center" }}>Actions</th>
                      </>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {activeCategoryTab === "Labor" ? (
                    currentSiteLabourRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                          <Users size={32} color="#94a3b8" style={{ marginBottom: "6px" }} />
                          <div style={{ fontWeight: "700", color: "#1e293b" }}>No Labour records found</div>
                          <div style={{ fontSize: "12px", marginTop: "2px" }}>No workforce attendance records match the selected date range.</div>
                        </td>
                      </tr>
                    ) : (
                      currentSiteLabourRows.map(row => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", fontWeight: "700", color: "#0f172a" }}>
                            {row.workerName}
                          </td>
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", color: "#475569" }}>
                            {row.teamName}
                          </td>
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", color: "#334155", fontWeight: "600" }}>
                            {row.dateLabel}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle", fontWeight: "700" }}>
                            {row.workerCount}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", color: "#475569" }}>
                            ₹{row.applicableRate.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", fontWeight: "700", color: "#0f172a" }}>
                            ₹{row.totalPayable.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", fontWeight: "700", color: "#16a34a" }}>
                            ₹{row.paidAmount.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", fontWeight: "800", color: row.pendingAmount > 0 ? "#c2410c" : "#16a34a" }}>
                            ₹{row.pendingAmount.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            {renderStatusBadge(row.status)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              {row.pendingAmount > 0 ? (
                                <Button
                                  size="small"
                                  variant="primary"
                                  onClick={() => handleOpenPaymentModal(row)}
                                  style={{ padding: "5px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                >
                                  <CreditCard size={13} />
                                  <span>Pay</span>
                                </Button>
                              ) : (
                                <span style={{ fontSize: "12px", fontWeight: "600", color: "#16a34a" }}>Settled</span>
                              )}

                              {row.payments && row.payments.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenHistoryModal(row)}
                                  title="View Disbursement History"
                                  style={{
                                    padding: "5px 8px",
                                    backgroundColor: "#f8fafc",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    color: "#475569",
                                    cursor: "pointer"
                                  }}
                                >
                                  <History size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  ) : (
                    currentSiteMaterialRows.length === 0 ? (
                      <tr>
                        <td colSpan={10} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                          <Package size={32} color="#94a3b8" style={{ marginBottom: "6px" }} />
                          <div style={{ fontWeight: "700", color: "#1e293b" }}>No Material records found</div>
                          <div style={{ fontSize: "12px", marginTop: "2px" }}>No material orders match the selected date range.</div>
                        </td>
                      </tr>
                    ) : (
                      currentSiteMaterialRows.map(row => (
                        <tr key={row.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", fontWeight: "700", color: "#0f172a" }}>
                            {row.materialName}
                          </td>
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", color: "#475569" }}>
                            {row.supplierName}
                          </td>
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", color: "#334155", fontWeight: "600" }}>
                            {row.deliveryDate}
                          </td>
                          <td style={{ padding: "12px 16px", verticalAlign: "middle", fontWeight: "600" }}>
                            {row.quantityText}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", color: "#475569" }}>
                            ₹{row.unitRate.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", fontWeight: "700", color: "#0f172a" }}>
                            ₹{row.totalPayable.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", fontWeight: "700", color: "#16a34a" }}>
                            ₹{row.paidAmount.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "right", verticalAlign: "middle", fontWeight: "800", color: row.pendingAmount > 0 ? "#c2410c" : "#16a34a" }}>
                            ₹{row.pendingAmount.toLocaleString("en-IN")}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            {renderStatusBadge(row.status)}
                          </td>
                          <td style={{ padding: "12px 16px", textAlign: "center", verticalAlign: "middle" }}>
                            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}>
                              {row.pendingAmount > 0 ? (
                                <Button
                                  size="small"
                                  variant="primary"
                                  onClick={() => handleOpenPaymentModal(row)}
                                  style={{ padding: "5px 12px", fontSize: "12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                                >
                                  <CreditCard size={13} />
                                  <span>Pay</span>
                                </Button>
                              ) : (
                                <span style={{ fontSize: "12px", fontWeight: "600", color: "#16a34a" }}>Settled</span>
                              )}

                              {row.payments && row.payments.length > 0 && (
                                <button
                                  type="button"
                                  onClick={() => handleOpenHistoryModal(row)}
                                  title="View Disbursement History"
                                  style={{
                                    padding: "5px 8px",
                                    backgroundColor: "#f8fafc",
                                    border: "1px solid #cbd5e1",
                                    borderRadius: "6px",
                                    color: "#475569",
                                    cursor: "pointer"
                                  }}
                                >
                                  <History size={13} />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {/* ── PAYMENT MODAL (IDEMPOTENT & MULTI-USER SAFE) ── */}
      {showPaymentModal && paymentTarget && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => !submitting && setShowPaymentModal(false)}
          title={`Disburse Payment for ${paymentTarget.rawType === "labour" ? `${paymentTarget.workerName} (${paymentTarget.teamName})` : `${paymentTarget.materialName} (${paymentTarget.supplierName})`}`}
          maxWidth="520px"
        >
          <form onSubmit={handleExecutePayment} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
            {/* Obligation Summary Banner */}
            <div style={{
              backgroundColor: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              padding: "12px 14px",
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: "8px",
              textAlign: "center"
            }}>
              <div>
                <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Obligation</span>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>
                  ₹{paymentTarget.totalPayable.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Already Paid</span>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#16a34a", marginTop: "2px" }}>
                  ₹{paymentTarget.paidAmount.toLocaleString("en-IN")}
                </div>
              </div>
              <div>
                <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase" }}>Remaining Pending</span>
                <div style={{ fontSize: "14px", fontWeight: "850", color: "#c2410c", marginTop: "2px" }}>
                  ₹{paymentTarget.pendingAmount.toLocaleString("en-IN")}
                </div>
              </div>
            </div>

            {/* Quick Amount Suggestion Chips */}
            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                Payment Amount (₹) <span style={{ color: "#ef4444" }}>*</span>
              </label>
              <div style={{ display: "flex", gap: "6px", marginBottom: "8px" }}>
                <button
                  type="button"
                  onClick={() => setPayAmount(String(paymentTarget.pendingAmount))}
                  style={{
                    flex: 1,
                    padding: "5px 8px",
                    backgroundColor: "#fff7ed",
                    border: "1px solid #ffedd5",
                    borderRadius: "6px",
                    color: "#c2410c",
                    fontSize: "11.5px",
                    fontWeight: "750",
                    cursor: "pointer"
                  }}
                >
                  Pay Full: ₹{paymentTarget.pendingAmount.toLocaleString("en-IN")}
                </button>
                {paymentTarget.pendingAmount > 100 && (
                  <button
                    type="button"
                    onClick={() => setPayAmount(String(Math.round(paymentTarget.pendingAmount / 2)))}
                    style={{
                      flex: 1,
                      padding: "5px 8px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      borderRadius: "6px",
                      color: "#475569",
                      fontSize: "11.5px",
                      fontWeight: "700",
                      cursor: "pointer"
                    }}
                  >
                    Pay 50%: ₹{Math.round(paymentTarget.pendingAmount / 2).toLocaleString("en-IN")}
                  </button>
                )}
              </div>

              <input
                type="number"
                min="1"
                max={paymentTarget.pendingAmount}
                step="any"
                required
                value={payAmount}
                onChange={(e) => {
                  setPayAmount(e.target.value);
                  setPaymentError("");
                }}
                placeholder="Enter amount in ₹"
                style={{
                  width: "100%",
                  padding: "9px 12px",
                  borderRadius: "8px",
                  border: paymentError ? "1.5px solid #ef4444" : "1px solid #cbd5e1",
                  fontSize: "15px",
                  fontWeight: "750",
                  color: "#0f172a",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
              {paymentError && (
                <div style={{ color: "#ef4444", fontSize: "11.5px", fontWeight: "600", marginTop: "4px" }}>
                  {paymentError}
                </div>
              )}
            </div>

            {/* Payment Date & Method (Cash / UPI / Cheque) */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                  Payment Date <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <input
                  type="date"
                  required
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    outline: "none",
                    boxSizing: "border-box"
                  }}
                />
              </div>

              <div>
                <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                  Payment Method <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={payMethod}
                  onChange={(e) => setPayMethod(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "12.5px",
                    fontWeight: "600",
                    outline: "none",
                    backgroundColor: "#ffffff",
                    boxSizing: "border-box"
                  }}
                >
                  <option value="Cash">Cash</option>
                  <option value="UPI">UPI</option>
                  <option value="Cheque">Cheque</option>
                  <option value="Bank Transfer">Bank Transfer / NEFT</option>
                </select>
              </div>
            </div>

            {/* Reference / Transaction ID (Optional) */}
            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                Reference / Transaction ID (Optional)
              </label>
              <input
                type="text"
                value={payReference}
                onChange={(e) => setPayReference(e.target.value)}
                placeholder="e.g. UPI Transaction ID / Cheque Reference #"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12.5px",
                  fontWeight: "500",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* Remarks / Notes (Optional) */}
            <div>
              <label style={{ display: "block", fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", marginBottom: "6px" }}>
                Remarks / Notes (Optional)
              </label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="e.g. Weekly wage disbursement"
                style={{
                  width: "100%",
                  padding: "8px 10px",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "12.5px",
                  fontWeight: "500",
                  outline: "none",
                  boxSizing: "border-box"
                }}
              />
            </div>

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <Button
                type="button"
                variant="outline"
                disabled={submitting}
                onClick={() => setShowPaymentModal(false)}
              >
                Cancel
              </Button>

              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                {submitting ? (
                  <>
                    <div style={{
                      width: "14px",
                      height: "14px",
                      border: "2px solid #ffffff",
                      borderTopColor: "transparent",
                      borderRadius: "50%",
                      animation: "spin 0.6s linear infinite"
                    }} />
                    <span>Processing...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 size={15} />
                    <span>Confirm Payment</span>
                  </>
                )}
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* ── PAYMENT AUDIT / HISTORY MODAL ── */}
      {showHistoryModal && historyTarget && (
        <Modal
          isOpen={showHistoryModal}
          onClose={() => setShowHistoryModal(false)}
          title={`Payment History — ${historyTarget.rawType === "labour" ? `${historyTarget.workerName} (${historyTarget.teamName})` : `${historyTarget.materialName} (${historyTarget.supplierName})`}`}
          maxWidth="560px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "14px", padding: "4px 0" }}>
            <div style={{
              backgroundColor: "#f8fafc",
              padding: "12px 14px",
              borderRadius: "8px",
              border: "1px solid #e2e8f0",
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center"
            }}>
              <div>
                <div style={{ fontSize: "11.5px", color: "#64748b", fontWeight: "600" }}>Total Obligation: ₹{historyTarget.totalPayable.toLocaleString("en-IN")}</div>
                <div style={{ fontSize: "13.5px", fontWeight: "800", color: "#0f172a" }}>Paid to Date: ₹{historyTarget.paidAmount.toLocaleString("en-IN")}</div>
              </div>
              <div>
                {renderStatusBadge(historyTarget.status)}
              </div>
            </div>

            <div style={{ fontSize: "12.5px", fontWeight: "750", color: "#334155" }}>
              Disbursement Log ({historyTarget.payments?.length || 0} Transactions)
            </div>

            {(!historyTarget.payments || historyTarget.payments.length === 0) ? (
              <div style={{ textAlign: "center", padding: "24px", color: "#64748b", fontSize: "13px" }}>
                No transaction records available.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "300px", overflowY: "auto" }}>
                {historyTarget.payments.map((p, idx) => (
                  <div
                    key={p.id || idx}
                    style={{
                      backgroundColor: "#ffffff",
                      border: "1px solid #e2e8f0",
                      borderRadius: "8px",
                      padding: "10px 12px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <span style={{ fontSize: "13.5px", fontWeight: "800", color: "#15803d" }}>
                          ₹{Number(p.amount || 0).toLocaleString("en-IN")}
                        </span>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "700",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "#f1f5f9",
                          color: "#475569"
                        }}>
                          {p.method || p.paymentMethod || "Cash"}
                        </span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>
                        Disbursed on {formatDateDMY(p.date || p.paymentDate)} {p.reference ? `• Ref: ${p.reference}` : ""}
                      </div>
                      {p.notes && (
                        <div style={{ fontSize: "11px", color: "#475569", marginTop: "2px", fontStyle: "italic" }}>
                          "{p.notes}"
                        </div>
                      )}
                    </div>

                    <div style={{ textAlign: "right", fontSize: "11px", color: "#94a3b8" }}>
                      {p.recordedAt ? (typeof p.recordedAt === "string" ? new Date(p.recordedAt).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' }) : (p.recordedAt?.seconds ? new Date(p.recordedAt.seconds * 1000).toLocaleTimeString("en-GB", { hour: '2-digit', minute: '2-digit' }) : "")) : ""}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "8px" }}>
              <Button
                variant="outline"
                size="small"
                onClick={() => setShowHistoryModal(false)}
              >
                Close
              </Button>
            </div>
          </div>
        </Modal>
      )}

      {/* Inline Spinner Animation */}
      <style>{`
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>
    </Layout>
  );
}

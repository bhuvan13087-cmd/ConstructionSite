import React, { useState, useEffect, useMemo } from "react";
import Layout from "../components/layout/Layout";
import Card from "../components/common/Card";
import Loading from "../components/common/Loading";
import Badge from "../components/common/Badge";
import Modal from "../components/common/Modal";
import Button from "../components/common/Button";
import { useAuth } from "../context/AuthContext";
import {
  getSites,
  getLabourTeams,
  getSiteEngineers,
  subscribeAllLabourAttendance,
  subscribeAllEngineerAttendance,
  subscribeAllEngineerLeaves,
  subscribePayrollStatuses,
  savePayrollStatus
} from "../services/firebaseService";
import { 
  DollarSign, 
  Calendar, 
  Users, 
  FileText, 
  Filter, 
  Layers, 
  CreditCard, 
  Edit3, 
  Save, 
  Search, 
  Eye, 
  CheckCircle2, 
  Clock, 
  MapPin, 
  ArrowUpDown, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  UserCheck, 
  Building2 
} from "lucide-react";

export default function PayrollSummary() {
  const { userProfile } = useAuth();

  // Loading states
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  // Datasets
  const [sites, setSites] = useState([]);
  const [teams, setTeams] = useState([]);
  const [engineers, setEngineers] = useState([]);
  
  // Real-time subscriptions
  const [labourAttendance, setLabourAttendance] = useState([]);
  const [engineerAttendance, setEngineerAttendance] = useState([]);
  const [engineerLeaves, setEngineerLeaves] = useState([]);
  const [payrollStatuses, setPayrollStatuses] = useState({});

  // Anchor Date for Daily, Weekly, Monthly breakdown calculations
  const [anchorDate, setAnchorDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Main list filters
  const [filterSiteId, setFilterSiteId] = useState("");
  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterEngineerId, setFilterEngineerId] = useState("");
  const [filterPaymentStatus, setFilterPaymentStatus] = useState(""); // Paid, Pending, or "" for All
  const [workerTypeFilter, setWorkerTypeFilter] = useState("All"); // All, Labour, Site Engineer

  // Table search & sort & pagination
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState("amount-desc"); // amount-desc, amount-asc, name-asc, name-desc
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;

  // Period filter for the detailed ledger tables
  const [filterPeriod, setFilterPeriod] = useState("Month"); // Month, Week, Custom Range
  const [filterMonth, setFilterMonth] = useState(() => {
    const now = new Date();
    const mm = String(now.getMonth() + 1).padStart(2, "0");
    return `${now.getFullYear()}-${mm}`;
  });
  const [filterWeekDate, setFilterWeekDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });
  const [filterStartDate, setFilterStartDate] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split("T")[0];
  });
  const [filterEndDate, setFilterEndDate] = useState(() => {
    return new Date().toISOString().split("T")[0];
  });

  // Modal State for recording payments & details
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null); // { key, name, salary, type, item }
  const [modalStatus, setModalStatus] = useState("Pending"); // Pending, Paid
  const [modalDate, setModalDate] = useState("");
  const [modalMethod, setModalMethod] = useState("Cash"); // Cash, Bank, UPI
  const [modalNotes, setModalNotes] = useState("");

  // Worker detail modal state
  const [selectedWorkerDetail, setSelectedWorkerDetail] = useState(null);

  const loadBaseData = async () => {
    try {
      setLoading(true);
      const adminId = userProfile?.role === "admin" ? userProfile.uid || userProfile.id : null;
      const [fetchedSites, fetchedTeams, fetchedEngineers] = await Promise.all([
        getSites(adminId),
        getLabourTeams(adminId),
        getSiteEngineers(adminId)
      ]);
      setSites(fetchedSites);
      setTeams(fetchedTeams);
      setEngineers(fetchedEngineers);
    } catch (err) {
      console.error("Failed to load base payroll data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBaseData();
  }, [userProfile]);

  useEffect(() => {
    const unsubLabour = subscribeAllLabourAttendance(setLabourAttendance);
    const unsubEngAtt = subscribeAllEngineerAttendance(setEngineerAttendance);
    const unsubEngLeaves = subscribeAllEngineerLeaves(setEngineerLeaves);
    const unsubPayroll = subscribePayrollStatuses(setPayrollStatuses);

    return () => {
      unsubLabour();
      unsubEngAtt();
      unsubEngLeaves();
      unsubPayroll();
    };
  }, []);

  // Reset pagination on filter change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, workerTypeFilter, filterPaymentStatus, filterSiteId, filterPeriod, filterMonth, sortBy]);

  // -------------------------------------------------------------
  // CALENDAR RANGE HELPERS
  // -------------------------------------------------------------
  const getWeekRange = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1);
    const start = new Date(d.setDate(diff));
    start.setHours(0, 0, 0, 0);

    const end = new Date(start);
    end.setDate(end.getDate() + 6);
    end.setHours(23, 59, 59, 999);
    return { start, end };
  };

  const isDateInWeek = (dateStr, targetDateStr) => {
    const { start, end } = getWeekRange(targetDateStr);
    const d = new Date(dateStr);
    return d >= start && d <= end;
  };

  const isDateInMonth = (dateStr, targetDateStr) => {
    return dateStr.substring(0, 7) === targetDateStr.substring(0, 7);
  };

  const getActiveMonthKey = () => {
    if (filterPeriod === "Month") return filterMonth;
    if (filterPeriod === "Week") return filterWeekDate.substring(0, 7);
    if (filterPeriod === "Custom Range") return filterStartDate.substring(0, 7);
    return new Date().toISOString().split("T")[0].substring(0, 7);
  };

  const isDateInPeriod = (dateStr) => {
    if (!dateStr) return false;

    if (filterPeriod === "Month") {
      return dateStr.startsWith(filterMonth);
    }

    if (filterPeriod === "Week") {
      if (!filterWeekDate) return true;
      const selectedDate = new Date(filterWeekDate);
      const day = selectedDate.getDay();
      const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1);
      const startOfWeek = new Date(selectedDate.setDate(diff));
      startOfWeek.setHours(0, 0, 0, 0);

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(endOfWeek.getDate() + 6);
      endOfWeek.setHours(23, 59, 59, 999);

      const d = new Date(dateStr);
      return d >= startOfWeek && d <= endOfWeek;
    }

    if (filterPeriod === "Custom Range") {
      if (filterStartDate && dateStr < filterStartDate) return false;
      if (filterEndDate && dateStr > filterEndDate) return false;
      return true;
    }

    return true;
  };

  // -------------------------------------------------------------
  // LABOUR SUMMARY PROCESSING
  // -------------------------------------------------------------
  const labourSummary = useMemo(() => {
    const summaryList = [];
    const monthKey = getActiveMonthKey();

    const filteredRecords = labourAttendance.filter(r => {
      if (!isDateInPeriod(r.attendanceDate)) return false;
      if (filterSiteId && r.siteId !== filterSiteId) return false;
      if (filterTeamId && r.teamId !== filterTeamId) return false;
      
      if (userProfile?.role === "admin") {
        return sites.some(s => s.id === r.siteId);
      }
      return true;
    });

    const groups = {};
    filteredRecords.forEach(r => {
      const key = `${r.teamId}_${r.categoryId}`;
      if (!groups[key]) {
        groups[key] = [];
      }
      groups[key].push(r);
    });

    Object.keys(groups).forEach(key => {
      const records = groups[key];
      const teamId = records[0].teamId;
      const categoryId = records[0].categoryId;

      const teamObj = teams.find(t => t.id === teamId);
      if (!teamObj) return;

      const categoryObj = teamObj.categories?.[categoryId];
      const categoryName = categoryObj ? categoryObj.name : categoryId;
      const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;

      let fullDays = 0;
      let halfDays = 0;

      records.forEach(r => {
        const count = Number(r.workerCount) || 1;
        if (r.attendanceType === "Full Day") {
          fullDays += count;
        } else if (r.attendanceType === "Half Day") {
          halfDays += count;
        } else {
          if (Number(r.attendanceValue) === 1.0) {
            fullDays += count;
          } else {
            halfDays += count;
          }
        }
      });

      const attendanceUnits = fullDays * 1.0 + halfDays * 0.5;
      const totalAmount = attendanceUnits * dailyWage;

      const statusKey = `labour_${teamId}_${categoryId}_${monthKey}`;
      const statusObj = payrollStatuses[statusKey] || { status: "Pending", paymentDate: "", paymentMethod: "", notes: "" };

      if (filterPaymentStatus && statusObj.status !== filterPaymentStatus) {
        return;
      }

      summaryList.push({
        teamId,
        categoryId,
        teamName: teamObj.teamName,
        category: categoryName,
        fullDays,
        halfDays,
        attendanceUnits,
        dailyWage,
        totalAmount,
        statusObj
      });
    });

    return summaryList;
  }, [labourAttendance, teams, filterSiteId, filterTeamId, sites, filterPeriod, filterMonth, filterWeekDate, filterStartDate, filterEndDate, filterPaymentStatus, payrollStatuses, userProfile]);

  // -------------------------------------------------------------
  // ENGINEER SUMMARY PROCESSING
  // -------------------------------------------------------------
  const engineerSummary = useMemo(() => {
    const summaryList = [];
    const monthKey = getActiveMonthKey();

    const activeEngineers = engineers.filter(eng => {
      if (filterEngineerId && eng.id !== filterEngineerId) return false;
      if (filterSiteId) {
        return eng.assignedSites && eng.assignedSites.includes(filterSiteId);
      }
      return true;
    });

    activeEngineers.forEach(eng => {
      const monthlySalary = Number(eng.monthlySalary) || Number(eng.salary) || 30000;
      const workingDays = Number(eng.workingDaysPerMonth) || Number(eng.workingDays) || 30;
      const dailySalary = monthlySalary / workingDays;

      const presentDays = engineerAttendance.filter(att => {
        if (att.engineerId !== eng.id) return false;
        if (!isDateInPeriod(att.date)) return false;
        if (filterSiteId && att.siteId !== filterSiteId) return false;
        return true;
      }).length;

      const engLeaves = engineerLeaves.filter(lv => {
        if (lv.engineerId !== eng.id) return false;
        if (!isDateInPeriod(lv.date)) return false;
        return lv.status === "approved" || lv.status === undefined;
      });

      const halfDays = engLeaves.filter(lv => lv.type === "half_day").length;
      const leaveDays = engLeaves.filter(lv => lv.type !== "half_day").length;

      const calculatedSalary = (presentDays * dailySalary) + (halfDays * dailySalary * 0.5);

      const assignedSitesNames = (eng.assignedSites || [])
        .map(sid => {
          const site = sites.find(s => s.id === sid);
          return site ? site.siteName : sid;
        })
        .join(", ") || "No Sites Assigned";

      const statusKey = `engineer_${eng.id}_${monthKey}`;
      const statusObj = payrollStatuses[statusKey] || { status: "Pending", paymentDate: "", paymentMethod: "", notes: "" };

      if (filterPaymentStatus && statusObj.status !== filterPaymentStatus) {
        return;
      }

      summaryList.push({
        id: eng.id,
        name: eng.fullName || eng.name || "Site Engineer",
        assignedSites: assignedSitesNames,
        monthlySalary,
        workingDays,
        presentDays,
        halfDays,
        leaveDays,
        dailySalary,
        calculatedSalary,
        statusObj
      });
    });

    return summaryList;
  }, [engineers, engineerAttendance, engineerLeaves, filterSiteId, filterEngineerId, sites, filterPeriod, filterMonth, filterWeekDate, filterStartDate, filterEndDate, filterPaymentStatus, payrollStatuses]);

  // -------------------------------------------------------------
  // UNIFIED PAYOUT ROWS FOR MASTER TABLE
  // -------------------------------------------------------------
  const unifiedPayoutRows = useMemo(() => {
    const rows = [];

    // Labour Rows
    labourSummary.forEach(item => {
      rows.push({
        id: `labour_${item.teamId}_${item.categoryId}`,
        type: "Labour",
        workerName: `${item.teamName} - ${item.category}`,
        category: item.category,
        siteName: filterSiteId ? (sites.find(s => s.id === filterSiteId)?.siteName || "Selected Site") : "All Active Sites",
        workingDaysText: `${item.attendanceUnits} Days`,
        fullDays: item.fullDays,
        halfDays: item.halfDays,
        dailyRate: item.dailyWage,
        grossAmount: item.totalAmount,
        advanceAmount: 0,
        finalPayableAmount: item.totalAmount,
        status: item.statusObj?.status || "Pending",
        statusObj: item.statusObj,
        rawItem: item,
        rawType: "labour"
      });
    });

    // Engineer Rows
    engineerSummary.forEach(item => {
      rows.push({
        id: `engineer_${item.id}`,
        type: "Site Engineer",
        workerName: item.name,
        category: "Engineer",
        siteName: item.assignedSites || "Assigned Sites",
        workingDaysText: `${item.presentDays} Days`,
        fullDays: item.presentDays,
        halfDays: item.halfDays,
        dailyRate: Math.round(item.dailySalary),
        grossAmount: item.calculatedSalary,
        advanceAmount: 0,
        finalPayableAmount: item.calculatedSalary,
        status: item.statusObj?.status || "Pending",
        statusObj: item.statusObj,
        rawItem: item,
        rawType: "engineer"
      });
    });

    return rows;
  }, [labourSummary, engineerSummary, filterSiteId, sites]);

  // Filtered & Sorted Rows
  const filteredPayoutRows = useMemo(() => {
    return unifiedPayoutRows.filter(row => {
      // Worker Type Filter (All, Labour, Site Engineer)
      if (workerTypeFilter !== "All" && row.type !== workerTypeFilter) {
        return false;
      }

      // Payment Status Filter (All, Pending, Paid)
      if (filterPaymentStatus && row.status !== filterPaymentStatus) {
        return false;
      }

      // Search Query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchName = row.workerName.toLowerCase().includes(q);
        const matchSite = row.siteName.toLowerCase().includes(q);
        const matchType = row.type.toLowerCase().includes(q);
        if (!matchName && !matchSite && !matchType) return false;
      }

      return true;
    }).sort((a, b) => {
      if (sortBy === "name-asc") return a.workerName.localeCompare(b.workerName);
      if (sortBy === "name-desc") return b.workerName.localeCompare(a.workerName);
      if (sortBy === "amount-desc") return b.finalPayableAmount - a.finalPayableAmount;
      if (sortBy === "amount-asc") return a.finalPayableAmount - b.finalPayableAmount;
      return 0;
    });
  }, [unifiedPayoutRows, workerTypeFilter, filterPaymentStatus, searchQuery, sortBy]);

  // Pagination calculation
  const totalPages = Math.ceil(filteredPayoutRows.length / pageSize) || 1;
  const paginatedPayoutRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredPayoutRows.slice(start, start + pageSize);
  }, [filteredPayoutRows, currentPage, pageSize]);

  // -------------------------------------------------------------
  // COMPACT KPI CARD METRICS (EXACTLY 4 COMPACT CARDS)
  // -------------------------------------------------------------
  const totalPendingAmount = useMemo(() => {
    return unifiedPayoutRows
      .filter(r => r.status === "Pending")
      .reduce((acc, r) => acc + r.finalPayableAmount, 0);
  }, [unifiedPayoutRows]);

  const totalPaidAmount = useMemo(() => {
    return unifiedPayoutRows
      .filter(r => r.status === "Paid")
      .reduce((acc, r) => acc + r.finalPayableAmount, 0);
  }, [unifiedPayoutRows]);

  const totalWorkers = useMemo(() => {
    return unifiedPayoutRows.length;
  }, [unifiedPayoutRows]);

  const currentPeriodAmount = useMemo(() => {
    return unifiedPayoutRows.reduce((acc, r) => acc + r.finalPayableAmount, 0);
  }, [unifiedPayoutRows]);

  // -------------------------------------------------------------
  // HANDLERS FOR PAYROLL EDIT & DETAILS MODALS
  // -------------------------------------------------------------
  const handleOpenPaymentModal = (row) => {
    const item = row.rawItem;
    const type = row.rawType;
    const monthKey = getActiveMonthKey();
    let key, name, salary;
    if (type === "labour") {
      key = `labour_${item.teamId}_${item.categoryId}_${monthKey}`;
      name = `${item.teamName} - ${item.category}`;
      salary = item.totalAmount;
    } else {
      key = `engineer_${item.id}_${monthKey}`;
      name = item.name;
      salary = item.calculatedSalary;
    }

    const existing = payrollStatuses[key] || {};
    setPaymentTarget({ key, name, salary, type, item, row });
    setModalStatus(existing.status || "Pending");
    setModalDate(existing.paymentDate || new Date().toISOString().split("T")[0]);
    setModalMethod(existing.paymentMethod || "Cash");
    setModalNotes(existing.notes || "");
    setShowPaymentModal(true);
  };

  const handleSavePaymentStatus = async (e) => {
    e.preventDefault();
    if (!paymentTarget) return;

    setSubmitting(true);
    try {
      await savePayrollStatus(paymentTarget.key, {
        status: modalStatus,
        paymentDate: modalStatus === "Paid" ? modalDate : "",
        paymentMethod: modalStatus === "Paid" ? modalMethod : "",
        notes: modalNotes,
        amount: paymentTarget.salary
      });
      setShowPaymentModal(false);
      if (selectedWorkerDetail && selectedWorkerDetail.id === paymentTarget.row?.id) {
        setSelectedWorkerDetail(prev => ({
          ...prev,
          status: modalStatus,
          statusObj: {
            status: modalStatus,
            paymentDate: modalStatus === "Paid" ? modalDate : "",
            paymentMethod: modalStatus === "Paid" ? modalMethod : "",
            notes: modalNotes
          }
        }));
      }
    } catch (err) {
      console.error("Failed to save payroll status:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Worker Payouts"
      description="Manage worker wage disbursements, engineer salaries, and attendance-based payouts across site locations."
    >
      {/* ── 1. HEADER SECTION (TITLE, FILTERS BAR) ── */}
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
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>Worker Payouts</h2>
              <span style={{ backgroundColor: "#fff7ed", color: "#c2410c", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "12px", border: "1px solid #ffedd5" }}>
                {filterPeriod === "Month" ? filterMonth : filterPeriod}
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Manage worker wage disbursements, engineer salaries, and attendance-based payouts across site locations.
            </p>
          </div>

          <Button onClick={() => window.print()} variant="outline" style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Printer size={16} />
            <span>Print Payout Roll</span>
          </Button>
        </div>

        {/* Filter Controls Bar */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "14px", marginTop: "18px", paddingTop: "16px", borderTop: "1px solid #f1f5f9" }}>
          
          {/* Construction Site Filter */}
          <div>
            <label htmlFor="payout-site-select" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Construction Site</label>
            <div style={{ position: "relative" }}>
              <MapPin size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <select
                id="payout-site-select"
                value={filterSiteId}
                onChange={(e) => setFilterSiteId(e.target.value)}
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
                <option value="">All Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Time Period Filter */}
          <div>
            <label htmlFor="payout-period-select" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Time Period</label>
            <select
              id="payout-period-select"
              value={filterPeriod}
              onChange={(e) => setFilterPeriod(e.target.value)}
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
              <option value="Month">Monthly Summary</option>
              <option value="Week">Weekly Summary</option>
              <option value="Custom Range">Custom Range</option>
            </select>
          </div>

          {/* Month / Period Specific Date Input */}
          {filterPeriod === "Month" && (
            <div>
              <label htmlFor="payout-month-input" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Select Month</label>
              <input
                id="payout-month-input"
                type="month"
                value={filterMonth}
                onChange={(e) => setFilterMonth(e.target.value)}
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
          )}

          {filterPeriod === "Week" && (
            <div>
              <label htmlFor="payout-week-input" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Week Date</label>
              <input
                id="payout-week-input"
                type="date"
                value={filterWeekDate}
                onChange={(e) => setFilterWeekDate(e.target.value)}
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
          )}

          {filterPeriod === "Custom Range" && (
            <>
              <div>
                <label htmlFor="payout-start-date" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Start Date</label>
                <input
                  id="payout-start-date"
                  type="date"
                  value={filterStartDate}
                  onChange={(e) => setFilterStartDate(e.target.value)}
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
              <div>
                <label htmlFor="payout-end-date" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>End Date</label>
                <input
                  id="payout-end-date"
                  type="date"
                  value={filterEndDate}
                  onChange={(e) => setFilterEndDate(e.target.value)}
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
            </>
          )}

          {/* Payment Status Filter */}
          <div>
            <label htmlFor="payout-status-select" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Payment Status</label>
            <select
              id="payout-status-select"
              value={filterPaymentStatus}
              onChange={(e) => setFilterPaymentStatus(e.target.value)}
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
              <option value="">All Statuses</option>
              <option value="Pending">Pending Only</option>
              <option value="Paid">Paid Only</option>
            </select>
          </div>

          {/* Search Input */}
          <div>
            <label htmlFor="payout-search-input" style={{ fontSize: "11.5px", fontWeight: "700", color: "#475569", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Search Worker</label>
            <div style={{ position: "relative" }}>
              <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                id="payout-search-input"
                type="text"
                placeholder="Search worker or team name..."
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

      {/* ── 2. SUMMARY KPI SECTION (EXACTLY 4 COMPACT EQUAL SIZE CARDS) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px", marginBottom: "20px" }}>
        
        {/* KPI 1: Total Pending Amount */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Pending Amount</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Clock size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(totalPendingAmount)}</div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Awaiting disbursement</span>
        </div>

        {/* KPI 2: Total Paid Amount */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Paid Amount</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <CheckCircle2 size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(totalPaidAmount)}</div>
          <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px", display: "block", fontWeight: "600" }}>Settled &amp; completed</span>
        </div>

        {/* KPI 3: Total Workers */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Workers</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <Users size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{totalWorkers}</div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Labour teams &amp; engineers</span>
        </div>

        {/* KPI 4: Current Period Amount */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Current Period Amount</span>
            <div style={{ width: "30px", height: "30px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <DollarSign size={16} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a" }}>{formatINR(currentPeriodAmount)}</div>
          <span style={{ fontSize: "11px", color: "#ea580c", marginTop: "4px", display: "block", fontWeight: "600" }}>Gross accrued payroll</span>
        </div>

      </div>

      {/* ── 3. MAIN WORKER PAYOUT DATA TABLE ── */}
      <Card noPadding style={{ border: "1px solid #e2e8f0", borderRadius: "12px", overflow: "hidden", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
        
        {/* Table Controls Header Bar (Worker Type Pills & Sort Dropdown) */}
        <div style={{ padding: "16px 20px", borderBottom: "1px solid #f1f5f9", display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "12px", background: "#f8fafc" }}>
          
          {/* Worker Type Filter Pills (All, Labour, Site Engineer) */}
          <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", marginRight: "6px" }}>Worker Type:</span>
            {["All", "Labour", "Site Engineer"].map(typeOpt => {
              const isSel = workerTypeFilter === typeOpt;
              return (
                <button
                  key={typeOpt}
                  onClick={() => setWorkerTypeFilter(typeOpt)}
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
                  {typeOpt}
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
              <option value="amount-desc">Payable Amount (High to Low)</option>
              <option value="amount-asc">Payable Amount (Low to High)</option>
              <option value="name-asc">Worker Name (A - Z)</option>
              <option value="name-desc">Worker Name (Z - A)</option>
            </select>
          </div>

        </div>

        {/* Data Table */}
        {loading ? (
          <div style={{ padding: "40px", textAlign: "center" }}>
            <Loading text="Loading worker payout records..." />
          </div>
        ) : filteredPayoutRows.length === 0 ? (
          <div style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
            <Users size={36} style={{ color: "#94a3b8", marginBottom: "10px" }} />
            <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: "#1e293b" }}>No Payout Records Found</h4>
            <p style={{ margin: 0, fontSize: "13px" }}>No worker payout records match your search or filter options.</p>
          </div>
        ) : (
          <>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0, width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Worker Name</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Worker Type</th>
                    <th style={{ padding: "12px 16px", textAlign: "left", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Site</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Working Days</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Gross Amount</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Advance Amount</th>
                    <th style={{ padding: "12px 16px", textAlign: "right", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Final Payable Amount</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Payment Status</th>
                    <th style={{ padding: "12px 16px", textAlign: "center", fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedPayoutRows.map((row, idx) => {
                    const isEven = idx % 2 === 0;
                    
                    return (
                      <tr 
                        key={row.id || idx}
                        style={{ 
                          backgroundColor: isEven ? "#ffffff" : "#f8fafc",
                          borderBottom: "1px solid #f1f5f9",
                          transition: "background-color 0.15s ease"
                        }}
                      >
                        {/* Worker Name */}
                        <td style={{ padding: "12px 16px" }}>
                          <div style={{ fontSize: "13.5px", fontWeight: "700", color: "#0f172a" }}>{row.workerName}</div>
                          <div style={{ fontSize: "11.5px", color: "#64748b", marginTop: "2px" }}>Category: {row.category}</div>
                        </td>

                        {/* Worker Type Badge */}
                        <td style={{ padding: "12px 16px" }}>
                          <span style={{ 
                            backgroundColor: row.type === "Labour" ? "#fff7ed" : "#fff7ed", 
                            color: row.type === "Labour" ? "#c2410c" : "#ea580c", 
                            fontSize: "11px", 
                            fontWeight: "700", 
                            padding: "3px 8px", 
                            borderRadius: "4px",
                            display: "inline-block"
                          }}>
                            {row.type}
                          </span>
                        </td>

                        {/* Site */}
                        <td style={{ padding: "12px 16px", fontSize: "12.5px", fontWeight: "600", color: "#334155" }}>
                          {row.siteName}
                        </td>

                        {/* Working Days */}
                        <td style={{ padding: "12px 16px", textAlign: "center", fontSize: "12.5px", fontWeight: "700", color: "#0f172a" }}>
                          {row.workingDaysText}
                        </td>

                        {/* Gross Amount */}
                        <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "13px", fontWeight: "600", color: "#475569", fontFamily: "monospace" }}>
                          {formatINR(row.grossAmount)}
                        </td>

                        {/* Advance Amount */}
                        <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "13px", fontWeight: "500", color: "#94a3b8", fontFamily: "monospace" }}>
                          ₹0
                        </td>

                        {/* Final Payable Amount */}
                        <td style={{ padding: "12px 16px", textAlign: "right", fontSize: "14px", fontWeight: "800", color: "#0f172a", fontFamily: "monospace" }}>
                          {formatINR(row.finalPayableAmount)}
                        </td>

                        {/* Payment Status */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <Badge status={row.status === "Paid" ? "success" : "pending"}>
                            {row.status}
                          </Badge>
                        </td>

                        {/* Actions */}
                        <td style={{ padding: "12px 16px", textAlign: "center" }}>
                          <div style={{ display: "flex", justifyContent: "center", gap: "6px" }}>
                            <button
                              type="button"
                              onClick={() => setSelectedWorkerDetail(row)}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: "4px 8px",
                                fontSize: "12.5px",
                                fontWeight: "700",
                                color: "#2563eb",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                transition: "transform 0.15s ease, color 0.15s ease",
                                outline: "none"
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = "#1d4ed8";
                                e.currentTarget.style.transform = "scale(1.08)";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = "#2563eb";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                              title="View Details"
                            >
                              <Eye size={15} />
                              <span>View</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleOpenPaymentModal(row)}
                              style={{
                                border: "none",
                                background: "transparent",
                                padding: "4px 8px",
                                fontSize: "12.5px",
                                fontWeight: "700",
                                color: row.status === "Paid" ? "#16a34a" : "#ea580c",
                                cursor: "pointer",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                transition: "transform 0.15s ease, color 0.15s ease",
                                outline: "none"
                              }}
                              onMouseEnter={e => {
                                e.currentTarget.style.color = row.status === "Paid" ? "#15803d" : "#c2410c";
                                e.currentTarget.style.transform = "scale(1.08)";
                              }}
                              onMouseLeave={e => {
                                e.currentTarget.style.color = row.status === "Paid" ? "#16a34a" : "#ea580c";
                                e.currentTarget.style.transform = "scale(1)";
                              }}
                              title="Record / Change Payment Status"
                            >
                              <CreditCard size={15} />
                              <span>{row.status === "Paid" ? "Paid" : "Pay"}</span>
                            </button>
                          </div>
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
                Showing {filteredPayoutRows.length > 0 ? (currentPage - 1) * pageSize + 1 : 0} to {Math.min(currentPage * pageSize, filteredPayoutRows.length)} of {filteredPayoutRows.length} worker payout records
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

      {/* ── 4. WORKER PAYOUT DETAILS MODAL VIEW ── */}
      {selectedWorkerDetail && (
        <Modal
          isOpen={!!selectedWorkerDetail}
          onClose={() => setSelectedWorkerDetail(null)}
          title="Worker Payout Statement & Details"
          size="md"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px 0" }}>
            
            {/* Worker & Site Info Banner */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", backgroundColor: "#f8fafc", padding: "14px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Worker / Beneficiary</span>
                <div style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{selectedWorkerDetail.workerName}</div>
                <div style={{ fontSize: "12px", color: "#475569", marginTop: "2px" }}>Type: {selectedWorkerDetail.type} • Category: {selectedWorkerDetail.category}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Status</span>
                <div style={{ marginTop: "4px" }}>
                  <Badge status={selectedWorkerDetail.status === "Paid" ? "success" : "pending"}>
                    {selectedWorkerDetail.status}
                  </Badge>
                </div>
              </div>
            </div>

            {/* Grid 1: Work Period & Attendance Summary */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              
              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Work Period &amp; Site</span>
                <div style={{ fontSize: "12.5px", fontWeight: "600", color: "#0f172a" }}>Site: {selectedWorkerDetail.siteName}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>Period: {filterPeriod === "Month" ? filterMonth : filterPeriod}</div>
              </div>

              <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "6px" }}>Attendance Breakdown</span>
                <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#0f172a" }}>Units: {selectedWorkerDetail.workingDaysText}</div>
                <div style={{ fontSize: "12px", color: "#64748b", marginTop: "4px" }}>
                  Full Days: {selectedWorkerDetail.fullDays} • Half Days: {selectedWorkerDetail.halfDays}
                </div>
              </div>

            </div>

            {/* Grid 2: Calculation Breakdown Table */}
            <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "14px" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block", marginBottom: "8px" }}>Payout Calculation Summary</span>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#475569" }}>Daily Wage / Rate Rate:</span>
                  <span style={{ fontWeight: "600", fontFamily: "monospace" }}>{formatINR(selectedWorkerDetail.dailyRate)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#475569" }}>Gross Calculated Wage:</span>
                  <span style={{ fontWeight: "600", fontFamily: "monospace" }}>{formatINR(selectedWorkerDetail.grossAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "13px" }}>
                  <span style={{ color: "#475569" }}>Advances &amp; Deductions:</span>
                  <span style={{ fontWeight: "600", color: "#16a34a", fontFamily: "monospace" }}>- {formatINR(selectedWorkerDetail.advanceAmount)}</span>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", fontWeight: "800", borderTop: "1px solid #e2e8f0", paddingTop: "8px", marginTop: "4px" }}>
                  <span style={{ color: "#0f172a" }}>Final Net Payable Amount:</span>
                  <span style={{ color: "#ea580c", fontFamily: "monospace", fontSize: "16px" }}>{formatINR(selectedWorkerDetail.finalPayableAmount)}</span>
                </div>
              </div>
            </div>

            {/* Payment Audit Record */}
            {selectedWorkerDetail.statusObj && selectedWorkerDetail.statusObj.status === "Paid" && (
              <div style={{ backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: "8px", padding: "12px" }}>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#166534", textTransform: "uppercase", display: "block" }}>Payment Audit Details</span>
                <div style={{ fontSize: "12.5px", fontWeight: "600", color: "#15803d", marginTop: "4px" }}>
                  Date: {selectedWorkerDetail.statusObj.paymentDate} • Method: {selectedWorkerDetail.statusObj.paymentMethod || "Cash"}
                </div>
                {selectedWorkerDetail.statusObj.notes && (
                  <div style={{ fontSize: "12px", color: "#166534", marginTop: "4px", fontStyle: "italic" }}>
                    Notes: "{selectedWorkerDetail.statusObj.notes}"
                  </div>
                )}
              </div>
            )}

            {/* Modal Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "12px" }}>
              <Button variant="outline" onClick={() => setSelectedWorkerDetail(null)}>Close</Button>
              <Button 
                variant="primary" 
                onClick={() => {
                  const targetRow = selectedWorkerDetail;
                  setSelectedWorkerDetail(null);
                  handleOpenPaymentModal(targetRow);
                }}
              >
                Update / Record Payment
              </Button>
            </div>

          </div>
        </Modal>
      )}

      {/* ── 5. RECORD PAYROLL PAYMENT MODAL ── */}
      {paymentTarget && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title="Record Worker Payment Status"
          size="sm"
        >
          <form onSubmit={handleSavePaymentStatus} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            
            <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <span style={{ fontSize: "11px", color: "#64748b", display: "block", fontWeight: "700", textTransform: "uppercase" }}>Worker / Category</span>
              <strong style={{ fontSize: "14px", color: "#0f172a", display: "block", marginTop: "2px" }}>{paymentTarget.name}</strong>
              
              <span style={{ fontSize: "11px", color: "#64748b", display: "block", marginTop: "8px", fontWeight: "700", textTransform: "uppercase" }}>Final Net Payable Amount</span>
              <strong style={{ fontSize: "16px", color: "#ea580c", display: "block", marginTop: "2px" }}>{formatINR(paymentTarget.salary)}</strong>
            </div>

            {/* Payment Status Option */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="modal-pay-status" style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Payment Status</label>
              <select
                id="modal-pay-status"
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value)}
                style={{ height: "38px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontWeight: "600" }}
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            {modalStatus === "Paid" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {/* Date Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="modal-pay-date" style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Payment Date</label>
                    <input
                      id="modal-pay-date"
                      type="date"
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      style={{ height: "38px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                      required
                    />
                  </div>

                  {/* Method Select */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label htmlFor="modal-pay-method" style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Payment Method</label>
                    <select
                      id="modal-pay-method"
                      value={modalMethod}
                      onChange={(e) => setModalMethod(e.target.value)}
                      style={{ height: "38px", padding: "6px 10px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank">Bank Transfer</option>
                      <option value="UPI">UPI Payout</option>
                    </select>
                  </div>
                </div>
              </>
            )}

            {/* Notes Textarea */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label htmlFor="modal-pay-notes" style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Payment Notes / Reference</label>
              <textarea
                id="modal-pay-notes"
                placeholder="Reference details, txn ID, receipt numbers..."
                rows={3}
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", resize: "none" }}
              />
            </div>

            {/* Form Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "8px" }}>
              <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button type="submit" icon={Save} style={{ backgroundColor: "#16a34a" }}>
                Save Payment Status
              </Button>
            </div>

          </form>
        </Modal>
      )}

      <Loading show={loading || submitting} text="Processing payroll metrics..." />
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

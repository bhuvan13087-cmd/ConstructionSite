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
import { DollarSign, Calendar, Users, FileText, Filter, Layers, CreditCard, Edit3, Save } from "lucide-react";

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

  // Modal State for recording payments
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [paymentTarget, setPaymentTarget] = useState(null); // { key, name, salary, type, item }
  const [modalStatus, setModalStatus] = useState("Pending"); // Pending, Paid
  const [modalDate, setModalDate] = useState("");
  const [modalMethod, setModalMethod] = useState("Cash"); // Cash, Bank, UPI
  const [modalNotes, setModalNotes] = useState("");

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

  // -------------------------------------------------------------
  // CALENDAR RANGE HELPERS (Anchor Date based)
  // -------------------------------------------------------------
  const getWeekRange = (dateStr) => {
    const d = new Date(dateStr);
    const day = d.getDay();
    const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Monday
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

  // -------------------------------------------------------------
  // DYNAMIC STATS (Daily, Weekly, Monthly breakdowns)
  // -------------------------------------------------------------
  const dynamicWages = useMemo(() => {
    let dailyLabour = 0;
    let weeklyLabour = 0;
    let monthlyLabour = 0;

    let dailyEngineer = 0;
    let weeklyEngineer = 0;
    let monthlyEngineer = 0;

    // 1. Calculate Labour Wages
    labourAttendance.forEach(r => {
      // Filter site/team
      if (filterSiteId && r.siteId !== filterSiteId) return;
      if (filterTeamId && r.teamId !== filterTeamId) return;

      // Enforce site assignment security for admin role
      if (userProfile?.role === "admin" && !sites.some(s => s.id === r.siteId)) {
        return;
      }

      // Find wage rate
      const teamObj = teams.find(t => t.id === r.teamId);
      const categoryObj = teamObj?.categories?.[r.categoryId];
      const dailyWage = categoryObj ? Number(categoryObj.baseWage) || 0 : 0;

      const count = Number(r.workerCount) || 1;
      const factor = r.attendanceType === "Half Day" ? 0.5 : 1.0;
      const amount = count * factor * dailyWage;

      // Daily
      if (r.attendanceDate === anchorDate) {
        dailyLabour += amount;
      }
      // Weekly
      if (isDateInWeek(r.attendanceDate, anchorDate)) {
        weeklyLabour += amount;
      }
      // Monthly
      if (isDateInMonth(r.attendanceDate, anchorDate)) {
        monthlyLabour += amount;
      }
    });

    // 2. Calculate Engineer Salaries
    engineers.forEach(eng => {
      if (filterEngineerId && eng.id !== filterEngineerId) return;
      if (filterSiteId && (!eng.assignedSites || !eng.assignedSites.includes(filterSiteId))) return;

      const monthlySalary = Number(eng.monthlySalary) || Number(eng.salary) || 30000;
      const workingDays = Number(eng.workingDaysPerMonth) || Number(eng.workingDays) || 30;
      const dailySalary = monthlySalary / workingDays;

      // Fetch attendance and leaves for this engineer
      const atts = engineerAttendance.filter(a => a.engineerId === eng.id);
      const lvs = engineerLeaves.filter(l => l.engineerId === eng.id && (l.status === "approved" || l.status === undefined));

      // Daily contribution
      const hasDailyCheckIn = atts.some(a => a.date === anchorDate);
      const hasDailyHalfLeave = lvs.some(l => l.date === anchorDate && l.type === "half_day");
      if (hasDailyCheckIn) {
        dailyEngineer += dailySalary;
      } else if (hasDailyHalfLeave) {
        dailyEngineer += dailySalary * 0.5;
      }

      // Weekly contribution
      atts.forEach(a => {
        if (isDateInWeek(a.date, anchorDate)) {
          weeklyEngineer += dailySalary;
        }
      });
      lvs.forEach(l => {
        if (l.type === "half_day" && isDateInWeek(l.date, anchorDate)) {
          weeklyEngineer += dailySalary * 0.5;
        }
      });

      // Monthly contribution
      atts.forEach(a => {
        if (isDateInMonth(a.date, anchorDate)) {
          monthlyEngineer += dailySalary;
        }
      });
      lvs.forEach(l => {
        if (l.type === "half_day" && isDateInMonth(l.date, anchorDate)) {
          monthlyEngineer += dailySalary * 0.5;
        }
      });
    });

    return {
      dailyLabour,
      weeklyLabour,
      monthlyLabour,
      dailyEngineer,
      weeklyEngineer,
      monthlyEngineer
    };
  }, [labourAttendance, engineerAttendance, engineerLeaves, engineers, teams, anchorDate, filterSiteId, filterTeamId, filterEngineerId, sites, userProfile]);

  // Helper: check if date is in filtered period for detailed table
  const isDateInPeriod = (dateStr) => {
    if (!dateStr) return false;

    if (filterPeriod === "Month") {
      return dateStr.startsWith(filterMonth);
    }

    if (filterPeriod === "Week") {
      if (!filterWeekDate) return true;
      const selectedDate = new Date(filterWeekDate);
      const day = selectedDate.getDay();
      const diff = selectedDate.getDate() - day + (day === 0 ? -6 : 1); // Monday
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

  // Helper: Get working days in the filtered period for detailed table
  const currentPeriodWorkingDays = useMemo(() => {
    if (filterPeriod === "Month") {
      const [year, month] = filterMonth.split("-").map(Number);
      return new Date(year, month, 0).getDate();
    }
    if (filterPeriod === "Week") {
      return 7;
    }
    if (filterPeriod === "Custom Range") {
      if (!filterStartDate || !filterEndDate) return 30;
      const start = new Date(filterStartDate);
      const end = new Date(filterEndDate);
      const diffTime = Math.abs(end - start);
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
      return isNaN(diffDays) ? 30 : diffDays;
    }
    return 30;
  }, [filterPeriod, filterMonth, filterWeekDate, filterStartDate, filterEndDate]);

  // -------------------------------------------------------------
  // LABOUR SUMMARY PROCESSING (for detailed period table)
  // -------------------------------------------------------------
  const labourSummary = useMemo(() => {
    const summaryList = [];
    const monthKey = getActiveMonthKey();

    // Filter attendance records by period, site and team
    const filteredRecords = labourAttendance.filter(r => {
      if (!isDateInPeriod(r.attendanceDate)) return false;
      if (filterSiteId && r.siteId !== filterSiteId) return false;
      if (filterTeamId && r.teamId !== filterTeamId) return false;
      
      // Enforce site assignment security for admin role
      if (userProfile?.role === "admin") {
        return sites.some(s => s.id === r.siteId);
      }
      return true;
    });

    // Group records by teamId & categoryId
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
          // Legacy check
          if (Number(r.attendanceValue) === 1.0) {
            fullDays += count;
          } else {
            halfDays += count;
          }
        }
      });

      const attendanceUnits = fullDays * 1.0 + halfDays * 0.5;
      const totalAmount = attendanceUnits * dailyWage;

      // Extract Payment Status
      const statusKey = `labour_${teamId}_${categoryId}_${monthKey}`;
      const statusObj = payrollStatuses[statusKey] || { status: "Pending", paymentDate: "", paymentMethod: "", notes: "" };

      // Apply Payment Status Filter
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
  // ENGINEER SUMMARY PROCESSING (for detailed period table)
  // -------------------------------------------------------------
  const engineerSummary = useMemo(() => {
    const summaryList = [];
    const monthKey = getActiveMonthKey();

    // Filter engineers
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

      // Filter attendance check-ins inside this period
      const presentDays = engineerAttendance.filter(att => {
        if (att.engineerId !== eng.id) return false;
        if (!isDateInPeriod(att.date)) return false;
        if (filterSiteId && att.siteId !== filterSiteId) return false;
        return true;
      }).length;

      // Filter leaves inside this period
      const engLeaves = engineerLeaves.filter(lv => {
        if (lv.engineerId !== eng.id) return false;
        if (!isDateInPeriod(lv.date)) return false;
        return lv.status === "approved" || lv.status === undefined;
      });

      const halfDays = engLeaves.filter(lv => lv.type === "half_day").length;
      const leaveDays = engLeaves.filter(lv => lv.type !== "half_day").length;

      const calculatedSalary = (presentDays * dailySalary) + (halfDays * dailySalary * 0.5);

      // Resolve site names
      const assignedSitesNames = (eng.assignedSites || [])
        .map(sid => {
          const site = sites.find(s => s.id === sid);
          return site ? site.siteName : sid;
        })
        .join(", ") || "No Sites Assigned";

      // Extract Payment Status
      const statusKey = `engineer_${eng.id}_${monthKey}`;
      const statusObj = payrollStatuses[statusKey] || { status: "Pending", paymentDate: "", paymentMethod: "", notes: "" };

      // Apply Payment Status Filter
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

  // Aggregate stats
  const labourDetailedTotal = useMemo(() => {
    return labourSummary.reduce((acc, curr) => acc + curr.totalAmount, 0);
  }, [labourSummary]);

  const engineerDetailedTotal = useMemo(() => {
    return engineerSummary.reduce((acc, curr) => acc + curr.calculatedSalary, 0);
  }, [engineerSummary]);

  // -------------------------------------------------------------
  // HANDLERS FOR PAYROLL EDIT MODAL
  // -------------------------------------------------------------
  const handleOpenPaymentModal = (item, type) => {
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
    setPaymentTarget({ key, name, salary, type, item });
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
    } catch (err) {
      console.error("Failed to save payroll status:", err);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Layout
      title="Production Salary & Payroll Management"
      description="Record payments, audits, and verify pending balances across sites and engineers."
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Dynamic Payroll Breakdowns Section */}
        <Card title="Live Salary Calculation Ledger" subtitle="Anchor Date selects the base calendar date to calculate dynamic breakdowns.">
          <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap", marginBottom: "16px" }}>
            <label style={{ fontSize: "13px", fontWeight: "700", color: "var(--text-muted)" }}>Anchor Calculation Date:</label>
            <input
              type="date"
              value={anchorDate}
              onChange={(e) => setAnchorDate(e.target.value)}
              style={{
                height: "38px",
                padding: "4px 12px",
                borderRadius: "8px",
                border: "1px solid var(--border-color)",
                fontWeight: "600",
                fontSize: "13.5px"
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "20px" }}>
            
            {/* Labour Payouts Summary Card */}
            <div style={{ border: "1px solid var(--border-color)", borderRadius: "14px", padding: "16px", backgroundColor: "#fcfcff" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "800", color: "var(--primary-800)", display: "flex", alignItems: "center", gap: "6px" }}>
                <Layers size={16} /> Labour Workforce Wage accruals
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "600" }}>Daily Total (Anchor Date)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "14px" }}>₹{dynamicWages.dailyLabour.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "600" }}>Weekly Total (Anchor Week)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "14px", color: "var(--primary-700)" }}>₹{dynamicWages.weeklyLabour.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "700" }}>Monthly Total (Anchor Month)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "15px", color: "var(--primary-800)" }}>₹{dynamicWages.monthlyLabour.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>

            {/* Engineer Salaries Summary Card */}
            <div style={{ border: "1px solid var(--border-color)", borderRadius: "14px", padding: "16px", backgroundColor: "#fcfcff" }}>
              <h4 style={{ margin: "0 0 12px 0", fontSize: "14px", fontWeight: "800", color: "#2e7d32", display: "flex", alignItems: "center", gap: "6px" }}>
                <Users size={16} /> Site Engineers Salary payouts
              </h4>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "600" }}>Daily Rate Total (Anchor Date)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "14px" }}>₹{dynamicWages.dailyEngineer.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "6px" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "600" }}>Weekly Payout (Anchor Week)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "14px", color: "#2e7d32" }}>₹{dynamicWages.weeklyEngineer.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12.5px", color: "var(--text-muted)", fontWeight: "700" }}>Monthly Payout (Anchor Month)</span>
                  <strong style={{ fontFamily: "monospace", fontSize: "15px", color: "#1b5e20" }}>₹{dynamicWages.monthlyEngineer.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
                </div>
              </div>
            </div>

          </div>
        </Card>

        {/* Scope Filters */}
        <Card title="Payroll Scope Filters" subtitle="Configure dates, sites, and payment status to filter summaries below.">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
            gap: "16px"
          }}>
            {/* Site Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Construction Site</span>
              <select
                value={filterSiteId}
                onChange={(e) => setFilterSiteId(e.target.value)}
                style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                <option value="">All Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            {/* Team Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Labour Team</span>
              <select
                value={filterTeamId}
                onChange={(e) => setFilterTeamId(e.target.value)}
                style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                <option value="">All Teams</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.teamName}</option>
                ))}
              </select>
            </div>

            {/* Site Engineer Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Site Engineer</span>
              <select
                value={filterEngineerId}
                onChange={(e) => setFilterEngineerId(e.target.value)}
                style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                <option value="">All Engineers</option>
                {engineers.map(eng => (
                  <option key={eng.id} value={eng.id}>{eng.fullName || eng.name || "Site Engineer"}</option>
                ))}
              </select>
            </div>

            {/* Payment Status Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Payment Status</span>
              <select
                value={filterPaymentStatus}
                onChange={(e) => setFilterPaymentStatus(e.target.value)}
                style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                <option value="">All Statuses</option>
                <option value="Paid">Paid Only</option>
                <option value="Pending">Pending Only</option>
              </select>
            </div>

            {/* Period selector */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Time Period</span>
              <select
                value={filterPeriod}
                onChange={(e) => setFilterPeriod(e.target.value)}
                style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                <option value="Month">Monthly Summary</option>
                <option value="Week">Weekly Summary</option>
                <option value="Custom Range">Custom Range</option>
              </select>
            </div>

            {/* Period Specific inputs */}
            {filterPeriod === "Month" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Select Month</span>
                <input
                  type="month"
                  value={filterMonth}
                  onChange={(e) => setFilterMonth(e.target.value)}
                  style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                />
              </div>
            )}

            {filterPeriod === "Week" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Select Week Date</span>
                <input
                  type="date"
                  value={filterWeekDate}
                  onChange={(e) => setFilterWeekDate(e.target.value)}
                  style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                />
              </div>
            )}

            {filterPeriod === "Custom Range" && (
              <>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Start Date</span>
                  <input
                    type="date"
                    value={filterStartDate}
                    onChange={(e) => setFilterStartDate(e.target.value)}
                    style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                  />
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>End Date</span>
                  <input
                    type="date"
                    value={filterEndDate}
                    onChange={(e) => setFilterEndDate(e.target.value)}
                    style={{ height: "40px", padding: "8px 12px", borderRadius: "8px", border: "1px solid var(--border-color)" }}
                  />
                </div>
              </>
            )}
          </div>

          {(filterSiteId || filterTeamId || filterEngineerId || filterPaymentStatus || filterPeriod !== "Month") && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setFilterSiteId("");
                  setFilterTeamId("");
                  setFilterEngineerId("");
                  setFilterPaymentStatus("");
                  setFilterPeriod("Month");
                }}
                style={{ backgroundColor: "transparent", color: "var(--primary-800)", border: "none", fontSize: "12.5px", fontWeight: "700", cursor: "pointer" }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </Card>

        {/* Labour Summary Card */}
        <Card title="Labour Workforce Wage & Payout Status" variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Labour Team</th>
                  <th>Category</th>
                  <th style={{ textAlign: "center" }}>Full Days</th>
                  <th style={{ textAlign: "center" }}>Half Days</th>
                  <th style={{ textAlign: "center" }}>Attendance Units</th>
                  <th style={{ textAlign: "right" }}>Daily Wage</th>
                  <th style={{ textAlign: "right" }}>Wages Accrued</th>
                  <th style={{ textAlign: "center" }}>Payment Status</th>
                  <th>Payment Details</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {labourSummary.length === 0 ? (
                  <tr>
                    <td colSpan={10} style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "20px" }}>
                      No labor attendance or payment records match the selected scope.
                    </td>
                  </tr>
                ) : (
                  labourSummary.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: "700" }}>{item.teamName}</td>
                      <td>{item.category}</td>
                      <td style={{ textAlign: "center" }}>{item.fullDays}</td>
                      <td style={{ textAlign: "center" }}>{item.halfDays}</td>
                      <td style={{ textAlign: "center", fontWeight: "600" }}>{item.attendanceUnits}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>₹{item.dailyWage}</td>
                      <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--primary-700)" }}>
                        ₹{item.totalAmount.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Badge status={item.statusObj.status === "Paid" ? "success" : "pending"}>
                          {item.statusObj.status}
                        </Badge>
                      </td>
                      <td style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                        {item.statusObj.status === "Paid" ? (
                          <>
                            {item.statusObj.paymentDate} • {item.statusObj.paymentMethod}
                            {item.statusObj.notes && <span style={{ display: "block", fontStyle: "italic" }}>"{item.statusObj.notes}"</span>}
                          </>
                        ) : "--"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Button
                          size="small"
                          variant="outline"
                          icon={Edit3}
                          onClick={() => handleOpenPaymentModal(item, "labour")}
                        >
                          Record Payment
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
                {labourSummary.length > 0 && (
                  <tr style={{ backgroundColor: "#f9f9fa", fontWeight: "800" }}>
                    <td colSpan={6}>Labour Wage Accrual Total</td>
                    <td colSpan={4} style={{ textAlign: "left", fontFamily: "monospace", color: "var(--primary-800)" }}>
                      ₹{labourDetailedTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>

        {/* Site Engineer Summary Card */}
        <Card title="Site Engineer Salary & Payout Status" variant="table">
          <div style={{ overflowX: "auto" }}>
            <table className="data-table" style={{ margin: 0 }}>
              <thead>
                <tr>
                  <th>Engineer Name</th>
                  <th>Assigned Site(s)</th>
                  <th style={{ textAlign: "right" }}>Monthly Salary</th>
                  <th style={{ textAlign: "center" }}>Working Days</th>
                  <th style={{ textAlign: "center" }}>Present Days</th>
                  <th style={{ textAlign: "center" }}>Half Days</th>
                  <th style={{ textAlign: "center" }}>Leave Days</th>
                  <th style={{ textAlign: "right" }}>Daily Salary rate</th>
                  <th style={{ textAlign: "right" }}>Calculated Salary</th>
                  <th style={{ textAlign: "center" }}>Payment Status</th>
                  <th>Payment Details</th>
                  <th style={{ textAlign: "center" }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {engineerSummary.length === 0 ? (
                  <tr>
                    <td colSpan={12} style={{ textAlign: "center", color: "var(--text-muted)", fontStyle: "italic", padding: "20px" }}>
                      No Site Engineers registered or matched by filter.
                    </td>
                  </tr>
                ) : (
                  engineerSummary.map((item, idx) => (
                    <tr key={idx}>
                      <td style={{ fontWeight: "700" }}>{item.name}</td>
                      <td style={{ fontSize: "12px", color: "var(--text-muted)" }}>{item.assignedSites}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>₹{item.monthlySalary.toLocaleString()}</td>
                      <td style={{ textAlign: "center" }}>{item.workingDays}</td>
                      <td style={{ textAlign: "center", color: "var(--success-700)", fontWeight: "600" }}>{item.presentDays}</td>
                      <td style={{ textAlign: "center", color: "var(--warning-700)" }}>{item.halfDays}</td>
                      <td style={{ textAlign: "center", color: "var(--danger-700)" }}>{item.leaveDays}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>₹{item.dailySalary.toFixed(2)}</td>
                      <td style={{ textAlign: "right", fontWeight: "700", fontFamily: "monospace", color: "var(--success-700)" }}>
                        ₹{item.calculatedSalary.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Badge status={item.statusObj.status === "Paid" ? "success" : "pending"}>
                          {item.statusObj.status}
                        </Badge>
                      </td>
                      <td style={{ fontSize: "11.5px", color: "var(--text-muted)" }}>
                        {item.statusObj.status === "Paid" ? (
                          <>
                            {item.statusObj.paymentDate} • {item.statusObj.paymentMethod}
                            {item.statusObj.notes && <span style={{ display: "block", fontStyle: "italic" }}>"{item.statusObj.notes}"</span>}
                          </>
                        ) : "--"}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <Button
                          size="small"
                          variant="outline"
                          icon={Edit3}
                          onClick={() => handleOpenPaymentModal(item, "engineer")}
                        >
                          Record Payment
                        </Button>
                      </td>
                    </tr>
                  ))
                )}
                {engineerSummary.length > 0 && (
                  <tr style={{ backgroundColor: "#f9f9fa", fontWeight: "800" }}>
                    <td colSpan={8}>Engineer Salary Accrual Total</td>
                    <td colSpan={4} style={{ textAlign: "left", fontFamily: "monospace", color: "var(--success-700)" }}>
                      ₹{engineerDetailedTotal.toLocaleString("en-IN", { maximumFractionDigits: 2 })}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Record Payment Status Modal */}
      {paymentTarget && (
        <Modal
          isOpen={showPaymentModal}
          onClose={() => setShowPaymentModal(false)}
          title={`Record Payroll Payment Status`}
          maxWidth="500px"
        >
          <form onSubmit={handleSavePaymentStatus} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            
            <div style={{ backgroundColor: "#f9f9fa", padding: "12px", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
              <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block" }}>Beneficiary / Category</span>
              <strong style={{ fontSize: "14px", color: "var(--text-main)" }}>{paymentTarget.name}</strong>
              
              <span style={{ fontSize: "12px", color: "var(--text-muted)", display: "block", marginTop: "8px" }}>Calculated Salary Payout (Dynamic)</span>
              <strong style={{ fontSize: "16px", color: "var(--success-700)" }}>₹{paymentTarget.salary.toLocaleString("en-IN", { maximumFractionDigits: 2 })}</strong>
            </div>

            {/* Payment Status Option */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Status</label>
              <select
                value={modalStatus}
                onChange={(e) => setModalStatus(e.target.value)}
                style={{ height: "38px", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
              >
                <option value="Pending">Pending</option>
                <option value="Paid">Paid</option>
              </select>
            </div>

            {modalStatus === "Paid" && (
              <>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                  {/* Date Input */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Date</label>
                    <input
                      type="date"
                      value={modalDate}
                      onChange={(e) => setModalDate(e.target.value)}
                      style={{ height: "38px", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
                      required
                    />
                  </div>

                  {/* Method Select */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Method</label>
                    <select
                      value={modalMethod}
                      onChange={(e) => setModalMethod(e.target.value)}
                      style={{ height: "38px", padding: "6px 10px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
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
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Notes (Optional)</label>
              <textarea
                placeholder="Reference details, transaction ID, receipt numbers..."
                rows={3}
                value={modalNotes}
                onChange={(e) => setModalNotes(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid var(--border-color)", resize: "none" }}
              />
            </div>

            {/* Form Actions */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px" }}>
              <Button type="button" variant="outline" onClick={() => setShowPaymentModal(false)}>
                Cancel
              </Button>
              <Button type="submit" icon={Save} style={{ backgroundColor: "var(--success-700)" }}>
                Save Payment Status
              </Button>
            </div>

          </form>
        </Modal>
      )}

      <Loading show={loading || submitting} text="Loading dynamic payroll metrics..." />
    </Layout>
  );
}

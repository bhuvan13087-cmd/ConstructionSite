import React, { useState, useEffect, useMemo } from "react";
import {
  X,
  Shield,
  Calendar,
  Building2,
  HardHat,
  Users,
  Package,
  FileText,
  AlertCircle,
  CheckCircle2,
  Plus,
  Trash2,
  Lock,
  Clock,
  Info
} from "lucide-react";
import { Modal } from "./Modal";
import Button from "./Button";
import { useAuth } from "../../context/AuthContext";
import {
  getSites,
  getSiteEngineers,
  getLabourTeams,
  getMaterialTeams,
  checkLabourSubmissionStatus,
  submitAdminAssistedLabourAttendance,
  submitAdminAssistedMaterialEntry,
  submitAdminAssistedProgressReport
} from "../../services/firebaseService";

export default function AdminAssistedEntryModal({
  isOpen,
  onClose,
  initialSiteId = "",
  initialDate = "",
  onSuccess
}) {
  const { userProfile, user } = useAuth();

  // Navigation / Tabs
  const [activeTab, setActiveTab] = useState("labour"); // "labour", "materials", "progress"
  const [loadingInitial, setLoadingInitial] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });

  // Common Context Form
  const [sites, setSites] = useState([]);
  const [engineers, setEngineers] = useState([]);
  const [selectedSiteId, setSelectedSiteId] = useState(initialSiteId || "");
  const [selectedDate, setSelectedDate] = useState(initialDate || new Date().toISOString().split("T")[0]);
  const [selectedEngineerId, setSelectedEngineerId] = useState("");
  const [overrideReason, setOverrideReason] = useState("Site Engineer on Leave / Absent");

  // 1. Labour Tab States
  const [labourTeams, setLabourTeams] = useState([]);
  const [selectedLabourTeamId, setSelectedLabourTeamId] = useState("");
  const [labourAttendanceRows, setLabourAttendanceRows] = useState([]);
  const [labourLockStatus, setLabourLockStatus] = useState({ submitted: false });
  const [checkingLabourLock, setCheckingLabourLock] = useState(false);

  // 2. Materials Tab States
  const [materialTeams, setMaterialTeams] = useState([]);
  const [selectedMaterialTeamId, setSelectedMaterialTeamId] = useState("");
  const [materialRows, setMaterialRows] = useState([]);

  // 3. Progress Tab States
  const [progressData, setProgressData] = useState({
    description: "",
    progress: 0,
    completedToday: "",
    currentlyRunning: "",
    problemsFaced: "",
    pendingWork: "",
    nextActivity: ""
  });

  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  };

  // Load Sites, Engineers, and Teams on modal open
  useEffect(() => {
    if (!isOpen) return;

    const loadData = async () => {
      setLoadingInitial(true);
      try {
        const [sitesData, engineersData, lTeams, mTeams] = await Promise.all([
          getSites(),
          getSiteEngineers(),
          getLabourTeams(),
          getMaterialTeams()
        ]);
        setSites(sitesData || []);
        setEngineers(engineersData || []);
        setLabourTeams(lTeams || []);
        setMaterialTeams(mTeams || []);

        if (initialSiteId) {
          setSelectedSiteId(initialSiteId);
        } else if (sitesData && sitesData.length > 0 && !selectedSiteId) {
          setSelectedSiteId(sitesData[0].id);
        }

        if (initialDate) {
          setSelectedDate(initialDate);
        }
      } catch (err) {
        console.error("Failed to load initial admin entry data:", err);
        showToast("Failed to load metadata: " + err.message, "error");
      } finally {
        setLoadingInitial(false);
      }
    };

    loadData();
  }, [isOpen, initialSiteId, initialDate]);

  // Selected site object
  const currentSite = useMemo(() => {
    return sites.find(s => s.id === selectedSiteId) || null;
  }, [sites, selectedSiteId]);

  // Resolve assigned engineers for the selected site
  const siteAssignedEngineers = useMemo(() => {
    if (!currentSite) return [];
    const directAssignedIds = currentSite.assignedEngineers || [];
    
    // Check both site.assignedEngineers array and engineer.assignedSites
    const matched = engineers.filter(eng => {
      const isDirect = directAssignedIds.includes(eng.id);
      const isReverse = Array.isArray(eng.assignedSites) && eng.assignedSites.includes(currentSite.id);
      return isDirect || isReverse;
    });

    if (matched.length === 0 && engineers.length > 0) {
      // Fallback to active engineers if no explicit assignment exists
      return engineers.filter(e => e.status === "active");
    }
    return matched;
  }, [currentSite, engineers]);

  // Auto-select assigned engineer when site changes
  useEffect(() => {
    if (siteAssignedEngineers.length > 0) {
      const exists = siteAssignedEngineers.some(e => e.id === selectedEngineerId);
      if (!exists) {
        setSelectedEngineerId(siteAssignedEngineers[0].id);
      }
    } else {
      setSelectedEngineerId("");
    }
  }, [siteAssignedEngineers]);

  // Selected assigned engineer object
  const assignedEngineer = useMemo(() => {
    return engineers.find(e => e.id === selectedEngineerId) || null;
  }, [engineers, selectedEngineerId]);

  // Handle Labour Team selection & initialize attendance rows
  useEffect(() => {
    if (!selectedLabourTeamId) {
      setLabourAttendanceRows([]);
      setLabourLockStatus({ submitted: false });
      return;
    }

    const team = labourTeams.find(t => t.id === selectedLabourTeamId);
    let cats = [];
    if (team?.categories) {
      if (Array.isArray(team.categories)) {
        cats = team.categories;
      } else {
        cats = Object.entries(team.categories).map(([k, v]) => ({ id: k, ...v }));
      }
    }

    const rows = cats.map(cat => {
      const wage = Number(cat.wage || cat.salaryAmount || cat.baseWage || 0);
      return {
        categoryId: cat.id,
        categoryName: cat.name || "Category",
        workerCount: 0,
        customWorkUnits: 1.0,
        units: 1.0,
        dailyWage: wage,
        wage: wage,
        calculatedAmount: 0
      };
    });
    setLabourAttendanceRows(rows);

    // Check lock status for this Site + Date + Team
    if (selectedSiteId && selectedDate && selectedLabourTeamId) {
      setCheckingLabourLock(true);
      checkLabourSubmissionStatus(selectedSiteId, selectedDate, selectedLabourTeamId)
        .then(status => {
          setLabourLockStatus(status);
        })
        .catch(() => {
          setLabourLockStatus({ submitted: false });
        })
        .finally(() => {
          setCheckingLabourLock(false);
        });
    }
  }, [selectedLabourTeamId, selectedSiteId, selectedDate, labourTeams]);

  // Update Labour Worker Count
  const handleLabourCountChange = (categoryId, delta) => {
    if (labourLockStatus.submitted) return;
    setLabourAttendanceRows(prev => prev.map(row => {
      if (row.categoryId !== categoryId) return row;
      const newCount = Math.max(0, (row.workerCount || 0) + delta);
      const units = Math.max(0.01, Number(row.customWorkUnits || 1.0));
      const wage = Number(row.dailyWage || 0);
      return {
        ...row,
        workerCount: newCount,
        calculatedAmount: newCount * units * wage
      };
    }));
  };

  // Update Labour Work Units
  const handleLabourUnitsChange = (categoryId, unitsStr) => {
    if (labourLockStatus.submitted) return;
    const units = Math.max(0.01, Number(unitsStr) || 1.0);
    setLabourAttendanceRows(prev => prev.map(row => {
      if (row.categoryId !== categoryId) return row;
      const count = Number(row.workerCount || 0);
      const wage = Number(row.dailyWage || 0);
      return {
        ...row,
        customWorkUnits: units,
        units: units,
        calculatedAmount: count * units * wage
      };
    }));
  };

  // Handle Material Team selection
  const handleSelectMaterialTeam = (teamId) => {
    setSelectedMaterialTeamId(teamId);
    if (!teamId) return;

    const team = materialTeams.find(t => t.id === teamId);
    const activeMats = (team?.materials || []).filter(m => m.status !== "Inactive");

    if (activeMats.length > 0) {
      const newRows = activeMats.map(m => {
        const isCustom = m.type === "custom";
        const isRateOnly = m.type === "rate_only";
        const amt = Number(m.amount !== undefined ? m.amount : (m.rate !== undefined ? m.rate : m.unitPrice)) || 0;
        const displayName = (m.title || m.name || m.materialName || "").trim() || (isRateOnly ? "Rate Item" : "Material");
        return {
          id: `mat_row_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
          materialId: m.id,
          materialName: displayName,
          title: m.title || displayName,
          category: team.name || "General",
          teamId: team.id,
          teamName: team.name,
          type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
          unit: (isCustom || isRateOnly) ? "" : (m.unit || "Unit"),
          rate: amt,
          unitPrice: amt,
          quantity: (isCustom || isRateOnly) ? 1 : "",
          amount: amt,
          supplierName: m.supplierName || team.name || "Supplier",
          notes: ""
        };
      });
      setMaterialRows(newRows);
    }
  };

  // Add custom material row
  const handleAddCustomMaterialRow = () => {
    setMaterialRows(prev => [
      ...prev,
      {
        id: `mat_custom_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
        materialName: "",
        category: "Custom",
        teamId: selectedMaterialTeamId || null,
        teamName: materialTeams.find(t => t.id === selectedMaterialTeamId)?.name || "General",
        type: "custom",
        unit: "Item",
        rate: 0,
        unitPrice: 0,
        quantity: 1,
        amount: 0,
        supplierName: "",
        notes: ""
      }
    ]);
  };

  // Update material row value
  const handleMaterialRowChange = (rowId, field, value) => {
    setMaterialRows(prev => prev.map(row => {
      if (row.id !== rowId) return row;
      const updated = { ...row, [field]: value };
      const qty = Number(updated.quantity) || 0;
      const rate = Number(updated.rate) || 0;
      updated.unitPrice = rate;
      if (updated.type === "rate_only" || updated.type === "custom") {
        updated.amount = Number(updated.amount) > 0 ? Number(updated.amount) : rate;
      } else {
        updated.amount = qty * rate;
      }
      return updated;
    }));
  };

  // Remove material row
  const handleRemoveMaterialRow = (rowId) => {
    setMaterialRows(prev => prev.filter(r => r.id !== rowId));
  };

  // Submit Labour Attendance (Admin Override)
  const handleSubmitLabour = async (e) => {
    e.preventDefault();
    if (!selectedSiteId) {
      showToast("Please choose a construction site.", "error");
      return;
    }
    if (!selectedDate) {
      showToast("Please select attendance date.", "error");
      return;
    }
    if (!selectedEngineerId) {
      showToast("Please specify the assigned Site Engineer.", "error");
      return;
    }
    if (!selectedLabourTeamId) {
      showToast("Please select a Labour Team.", "error");
      return;
    }

    const activeRows = labourAttendanceRows.filter(r => Number(r.workerCount) > 0);
    if (activeRows.length === 0) {
      showToast("Please enter worker count for at least one trade category.", "error");
      return;
    }

    const team = labourTeams.find(t => t.id === selectedLabourTeamId);
    const teamName = team?.teamName || team?.name || "Labour Team";

    setSubmitting(true);
    try {
      await submitAdminAssistedLabourAttendance({
        siteId: selectedSiteId,
        dateStr: selectedDate,
        assignedEngineerId: selectedEngineerId,
        teamId: selectedLabourTeamId,
        teamName,
        attendanceRows: activeRows,
        adminUser: userProfile || { uid: user?.uid, fullName: "Admin" },
        reason: overrideReason
      });

      showToast(`Labour attendance for "${teamName}" submitted & locked on behalf of ${assignedEngineer?.fullName || "Site Engineer"}.`, "success");
      setLabourLockStatus({ submitted: true });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to submit admin assisted labour attendance:", err);
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Material Entry (Admin Override)
  const handleSubmitMaterials = async (e) => {
    e.preventDefault();
    if (!selectedSiteId) {
      showToast("Please choose a construction site.", "error");
      return;
    }
    if (!selectedDate) {
      showToast("Please select entry date.", "error");
      return;
    }
    if (!selectedEngineerId) {
      showToast("Please specify the assigned Site Engineer.", "error");
      return;
    }

    const validItems = materialRows.filter(r => ((r.materialName || r.title || "").trim() || r.type === "rate_only") && (r.type === "custom" || r.type === "rate_only" || Number(r.quantity) > 0));
    if (validItems.length === 0) {
      showToast("Please enter at least one valid material with quantity/amount.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await submitAdminAssistedMaterialEntry({
        siteId: selectedSiteId,
        dateStr: selectedDate,
        assignedEngineerId: selectedEngineerId,
        items: validItems,
        adminUser: userProfile || { uid: user?.uid, fullName: "Admin" },
        reason: overrideReason
      });

      showToast(`Material entry with ${validItems.length} item(s) submitted & locked on behalf of ${assignedEngineer?.fullName || "Site Engineer"}.`, "success");
      setMaterialRows([]);
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to submit admin assisted material entry:", err);
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // Submit Progress Report (Admin Override)
  const handleSubmitProgress = async (e) => {
    e.preventDefault();
    if (!selectedSiteId || !selectedDate || !selectedEngineerId) {
      showToast("Please fill all required fields.", "error");
      return;
    }
    if (!progressData.description.trim() && !progressData.completedToday.trim()) {
      showToast("Please provide progress description or work completed today.", "error");
      return;
    }

    setSubmitting(true);
    try {
      await submitAdminAssistedProgressReport({
        siteId: selectedSiteId,
        dateStr: selectedDate,
        assignedEngineerId: selectedEngineerId,
        description: progressData.description,
        progress: progressData.progress,
        additionalNotes: progressData,
        adminUser: userProfile || { uid: user?.uid, fullName: "Admin" },
        reason: overrideReason
      });

      showToast(`Daily Progress Report logged on behalf of ${assignedEngineer?.fullName || "Site Engineer"}.`, "success");
      setProgressData({
        description: "",
        progress: 0,
        completedToday: "",
        currentlyRunning: "",
        problemsFaced: "",
        pendingWork: "",
        nextActivity: ""
      });
      if (onSuccess) onSuccess();
    } catch (err) {
      console.error("Failed to submit admin assisted progress report:", err);
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title="Add Entry for Engineer (Admin Override)"
      maxWidth="780px"
    >
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        
        {/* Toast alert */}
        {toast.show && (
          <div style={{
            padding: "10px 14px",
            borderRadius: "10px",
            fontSize: "13px",
            fontWeight: "700",
            backgroundColor: toast.type === "error" ? "#fef2f2" : (toast.type === "success" ? "#f0fdf4" : "#eff6ff"),
            color: toast.type === "error" ? "#b91c1c" : (toast.type === "success" ? "#166534" : "#1d4ed8"),
            border: `1px solid ${toast.type === "error" ? "#fca5a5" : (toast.type === "success" ? "#bbf7d0" : "#bfdbfe")}`,
            display: "flex",
            alignItems: "center",
            gap: "8px"
          }}>
            {toast.type === "error" ? <AlertCircle size={16} /> : <CheckCircle2 size={16} />}
            <span>{toast.message}</span>
          </div>
        )}

        {/* Audit Context & Guarantee Banner */}
        <div style={{
          backgroundColor: "#eff6ff",
          borderRadius: "14px",
          border: "1.5px solid #bfdbfe",
          padding: "14px 18px",
          display: "flex",
          flexDirection: "column",
          gap: "8px"
        }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <Shield size={18} style={{ color: "#2563eb" }} />
              <strong style={{ fontSize: "14px", color: "#1e40af" }}>
                Admin Assisted Entry Mode
              </strong>
            </div>
            <span style={{
              fontSize: "11px",
              fontWeight: "750",
              padding: "2px 8px",
              borderRadius: "6px",
              backgroundColor: "#dbeafe",
              color: "#1e40af"
            }}>
              Date-Specific Override
            </span>
          </div>
          <p style={{ margin: 0, fontSize: "12.5px", color: "#1e3a8a", lineHeight: "1.4" }}>
            Recording legitimate site activity on behalf of the assigned Site Engineer. <strong>Permanent site assignment remains unchanged.</strong> All created records will be audited as <em>"Created by Admin ({userProfile?.fullName || "Admin"})"</em>.
          </p>
        </div>

        {/* Common Context Selectors (Site, Date, Assigned Engineer, Reason) */}
        <div style={{
          backgroundColor: "#f8fafc",
          borderRadius: "12px",
          border: "1px solid #e2e8f0",
          padding: "16px",
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "12px"
        }}>
          {/* Site Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: "750", color: "#475569", textTransform: "uppercase" }}>
              Construction Site *
            </label>
            <select
              value={selectedSiteId}
              onChange={(e) => setSelectedSiteId(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff" }}
            >
              <option value="">-- Select Construction Site --</option>
              {sites.map(s => (
                <option key={s.id} value={s.id}>{s.siteName || s.name}</option>
              ))}
            </select>
          </div>

          {/* Date Selector */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: "750", color: "#475569", textTransform: "uppercase" }}>
              Entry Date *
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
              style={{ padding: "7.5px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff" }}
            />
          </div>

          {/* Assigned Engineer Selector (On whose behalf Admin is logging) */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: "750", color: "#475569", textTransform: "uppercase" }}>
              Assigned Site Engineer *
            </label>
            <select
              value={selectedEngineerId}
              onChange={(e) => setSelectedEngineerId(e.target.value)}
              style={{ padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff" }}
            >
              <option value="">-- Select Assigned Engineer --</option>
              {siteAssignedEngineers.map(eng => (
                <option key={eng.id} value={eng.id}>
                  {eng.fullName} ({eng.email || "Assigned"})
                </option>
              ))}
            </select>
          </div>

          {/* Reason / Note */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            <label style={{ fontSize: "11.5px", fontWeight: "750", color: "#475569", textTransform: "uppercase" }}>
              Override Reason / Context
            </label>
            <input
              type="text"
              value={overrideReason}
              onChange={(e) => setOverrideReason(e.target.value)}
              placeholder="e.g. Engineer on leave, absent, emergency coverage"
              style={{ padding: "7.5px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px", backgroundColor: "#ffffff" }}
            />
          </div>
        </div>

        {/* Activity Tab Buttons (Labour, Material, DPR) */}
        <div style={{
          display: "flex",
          backgroundColor: "#f1f5f9",
          padding: "4px",
          borderRadius: "10px",
          gap: "4px"
        }}>
          <button
            type="button"
            onClick={() => setActiveTab("labour")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === "labour" ? "#ffffff" : "transparent",
              color: activeTab === "labour" ? "#ea580c" : "#64748b",
              fontWeight: "750",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: activeTab === "labour" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer"
            }}
          >
            <HardHat size={16} />
            <span>Labour Attendance</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("materials")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === "materials" ? "#ffffff" : "transparent",
              color: activeTab === "materials" ? "#ea580c" : "#64748b",
              fontWeight: "750",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: activeTab === "materials" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer"
            }}
          >
            <Package size={16} />
            <span>Material Entry</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("progress")}
            style={{
              flex: 1,
              padding: "10px",
              borderRadius: "8px",
              border: "none",
              backgroundColor: activeTab === "progress" ? "#ffffff" : "transparent",
              color: activeTab === "progress" ? "#ea580c" : "#64748b",
              fontWeight: "750",
              fontSize: "13px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "6px",
              boxShadow: activeTab === "progress" ? "0 1px 3px rgba(0,0,0,0.08)" : "none",
              cursor: "pointer"
            }}
          >
            <FileText size={16} />
            <span>Daily Progress (DPR)</span>
          </button>
        </div>

        {/* -------------------------------------------------------------
            TAB 1: LABOUR ATTENDANCE
            ------------------------------------------------------------- */}
        {activeTab === "labour" && (
          <form onSubmit={handleSubmitLabour} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>
                Select Labour Team *
              </label>
              <select
                value={selectedLabourTeamId}
                onChange={(e) => setSelectedLabourTeamId(e.target.value)}
                style={{ padding: "9px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13.5px" }}
              >
                <option value="">-- Choose Labour Team --</option>
                {labourTeams.map(t => (
                  <option key={t.id} value={t.id}>{t.teamName || t.name}</option>
                ))}
              </select>
            </div>

            {/* Lock status banner if already submitted */}
            {labourLockStatus.submitted && (
              <div style={{
                backgroundColor: "#fef2f2",
                color: "#b91c1c",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1px solid #fca5a5",
                fontSize: "13px",
                fontWeight: "700",
                display: "flex",
                alignItems: "center",
                gap: "8px"
              }}>
                <Lock size={16} />
                <span>This Labour Team's attendance for {selectedDate} is already SUBMITTED & LOCKED. Duplicate submission is prevented.</span>
              </div>
            )}

            {/* Category Rows */}
            {selectedLabourTeamId && labourAttendanceRows.length > 0 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto", paddingRight: "4px" }}>
                {labourAttendanceRows.map(row => (
                  <div
                    key={row.categoryId}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "10px",
                      border: row.workerCount > 0 ? "1.5px solid #ea580c" : "1px solid #e2e8f0",
                      padding: "12px 14px",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <strong style={{ fontSize: "14px", color: "#0f172a", display: "block" }}>{row.categoryName}</strong>
                      <span style={{ fontSize: "11.5px", color: "#166534", fontWeight: "700" }}>
                        ₹{row.dailyWage.toLocaleString("en-IN")} / Day
                      </span>
                    </div>

                    <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
                      {/* Work Units Input */}
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Units:</span>
                        <input
                          type="number"
                          step="0.1"
                          min="0.1"
                          value={row.customWorkUnits}
                          onChange={(e) => handleLabourUnitsChange(row.categoryId, e.target.value)}
                          disabled={labourLockStatus.submitted}
                          style={{ width: "55px", padding: "4px 6px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", textAlign: "center" }}
                        />
                      </div>

                      {/* Count increment / decrement */}
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <button
                          type="button"
                          onClick={() => handleLabourCountChange(row.categoryId, -1)}
                          disabled={row.workerCount <= 0 || labourLockStatus.submitted}
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            border: "1.5px solid #ea580c",
                            backgroundColor: row.workerCount <= 0 ? "#f1f5f9" : "#fff7ed",
                            color: row.workerCount <= 0 ? "#94a3b8" : "#ea580c",
                            fontWeight: "800",
                            cursor: row.workerCount <= 0 ? "not-allowed" : "pointer"
                          }}
                        >
                          -
                        </button>
                        <span style={{ fontSize: "15px", fontWeight: "800", minWidth: "24px", textAlign: "center" }}>
                          {row.workerCount}
                        </span>
                        <button
                          type="button"
                          onClick={() => handleLabourCountChange(row.categoryId, 1)}
                          disabled={labourLockStatus.submitted}
                          style={{
                            width: "32px",
                            height: "32px",
                            borderRadius: "50%",
                            border: "1.5px solid #ea580c",
                            backgroundColor: "#ea580c",
                            color: "#ffffff",
                            fontWeight: "800",
                            cursor: "pointer"
                          }}
                        >
                          +
                        </button>
                      </div>

                      {/* Row calculated amount */}
                      <div style={{ minWidth: "80px", textAlign: "right" }}>
                        <strong style={{ fontSize: "13.5px", color: row.calculatedAmount > 0 ? "#ea580c" : "#64748b" }}>
                          ₹{row.calculatedAmount.toLocaleString("en-IN")}
                        </strong>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Labour Summary Bar */}
            {selectedLabourTeamId && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fff7ed",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1.5px solid #fed7aa"
              }}>
                <span style={{ fontSize: "13px", fontWeight: "750", color: "#c2410c" }}>
                  Total Workers: {labourAttendanceRows.reduce((s, r) => s + (Number(r.workerCount) || 0), 0)}
                </span>
                <strong style={{ fontSize: "16px", color: "#1e3a8a" }}>
                  Total Cost: ₹{labourAttendanceRows.reduce((s, r) => s + (Number(r.calculatedAmount) || 0), 0).toLocaleString("en-IN")}
                </strong>
              </div>
            )}

            {/* Submit Action */}
            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || labourLockStatus.submitted || labourAttendanceRows.every(r => (Number(r.workerCount) || 0) <= 0)}
                style={{ backgroundColor: "#ea580c", borderColor: "#ea580c" }}
              >
                {submitting ? "Submitting..." : "Submit & Lock Labour Attendance"}
              </Button>
            </div>
          </form>
        )}

        {/* -------------------------------------------------------------
            TAB 2: MATERIAL ENTRY
            ------------------------------------------------------------- */}
        {activeTab === "materials" && (
          <form onSubmit={handleSubmitMaterials} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
              <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>
                  Load from Material Team (Optional)
                </label>
                <select
                  value={selectedMaterialTeamId}
                  onChange={(e) => handleSelectMaterialTeam(e.target.value)}
                  style={{ padding: "8px 12px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
                >
                  <option value="">-- Choose Material Team --</option>
                  {materialTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.name || t.teamName}</option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={handleAddCustomMaterialRow}
                style={{
                  padding: "9px 14px",
                  borderRadius: "8px",
                  border: "1.5px dashed #ea580c",
                  backgroundColor: "#fff7ed",
                  color: "#ea580c",
                  fontWeight: "750",
                  fontSize: "12.5px",
                  display: "flex",
                  alignItems: "center",
                  gap: "6px",
                  cursor: "pointer"
                }}
              >
                <Plus size={14} />
                <span>+ Custom Material</span>
              </button>
            </div>

            {/* Material Items List */}
            {materialRows.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "32px",
                backgroundColor: "#f8fafc",
                borderRadius: "12px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
                fontSize: "13px"
              }}>
                No materials selected. Select a Material Team or click "+ Custom Material" above.
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "280px", overflowY: "auto" }}>
                {materialRows.map(row => (
                  <div
                    key={row.id}
                    style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      padding: "10px 12px",
                      display: "grid",
                      gridTemplateColumns: "2fr 1fr 1fr 1fr auto",
                      gap: "8px",
                      alignItems: "center"
                    }}
                  >
                    <div>
                      <input
                        type="text"
                        placeholder="Material Name"
                        value={row.materialName}
                        onChange={(e) => handleMaterialRowChange(row.id, "materialName", e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", fontWeight: "700" }}
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        placeholder="Quantity"
                        value={row.quantity}
                        onChange={(e) => handleMaterialRowChange(row.id, "quantity", e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
                      />
                    </div>

                    <div>
                      <input
                        type="number"
                        placeholder="Rate (₹)"
                        value={row.rate}
                        onChange={(e) => handleMaterialRowChange(row.id, "rate", e.target.value)}
                        style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
                      />
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <strong style={{ fontSize: "13px", color: "#ea580c" }}>
                        ₹{Number(row.amount || 0).toLocaleString("en-IN")}
                      </strong>
                    </div>

                    <div>
                      <button
                        type="button"
                        onClick={() => handleRemoveMaterialRow(row.id)}
                        style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px" }}
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Material Summary */}
            {materialRows.length > 0 && (
              <div style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                backgroundColor: "#fff7ed",
                padding: "12px 16px",
                borderRadius: "10px",
                border: "1.5px solid #fed7aa"
              }}>
                <span style={{ fontSize: "13px", fontWeight: "750", color: "#c2410c" }}>
                  Total Items: {materialRows.filter(r => (r.materialName || "").trim()).length}
                </span>
                <strong style={{ fontSize: "16px", color: "#1e3a8a" }}>
                  Total Amount: ₹{materialRows.reduce((sum, r) => sum + (Number(r.amount) || 0), 0).toLocaleString("en-IN")}
                </strong>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting || materialRows.length === 0}
                style={{ backgroundColor: "#ea580c", borderColor: "#ea580c" }}
              >
                {submitting ? "Submitting..." : "Submit & Lock Material Entry"}
              </Button>
            </div>
          </form>
        )}

        {/* -------------------------------------------------------------
            TAB 3: DAILY PROGRESS REPORT (DPR)
            ------------------------------------------------------------- */}
        {activeTab === "progress" && (
          <form onSubmit={handleSubmitProgress} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>
                Work Completed Today *
              </label>
              <textarea
                rows={2}
                value={progressData.completedToday}
                onChange={(e) => setProgressData(prev => ({ ...prev, completedToday: e.target.value }))}
                placeholder="Details of structural/finishing tasks completed today..."
                style={{ padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>
                  Currently Running Activity
                </label>
                <input
                  type="text"
                  value={progressData.currentlyRunning}
                  onChange={(e) => setProgressData(prev => ({ ...prev, currentlyRunning: e.target.value }))}
                  placeholder="e.g. 2nd floor slab curing"
                  style={{ padding: "7.5px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>
                  Overall Progress % (0 - 100)
                </label>
                <input
                  type="number"
                  min="0"
                  max="100"
                  value={progressData.progress}
                  onChange={(e) => setProgressData(prev => ({ ...prev, progress: Number(e.target.value) || 0 }))}
                  style={{ padding: "7.5px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <label style={{ fontSize: "12px", fontWeight: "750", color: "#334155" }}>
                Onsite Blockers / Problems Faced
              </label>
              <textarea
                rows={2}
                value={progressData.problemsFaced}
                onChange={(e) => setProgressData(prev => ({ ...prev, problemsFaced: e.target.value }))}
                placeholder="Material shortage, rain delay, machinery breakdown..."
                style={{ padding: "8px 10px", borderRadius: "8px", border: "1.5px solid #cbd5e1", fontSize: "13px" }}
              />
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "6px" }}>
              <Button type="button" variant="outline" onClick={onClose}>
                Cancel
              </Button>
              <Button
                type="submit"
                variant="primary"
                disabled={submitting}
                style={{ backgroundColor: "#ea580c", borderColor: "#ea580c" }}
              >
                {submitting ? "Saving..." : "Save Daily Progress Report"}
              </Button>
            </div>
          </form>
        )}

      </div>
    </Modal>
  );
}

import React, { useState, useEffect } from "react";
import Layout from "../components/layout/Layout";
import {
  getSites,
  getLabourDailyCountsSummary,
  getLabourPayments,
  saveLabourPayment,
  getLabourTeams,
  subscribeLabourTeams,
  createLabourTeam,
  updateLabourTeam,
  deleteLabourTeam,
  addLabourCategoryToTeam,
  updateLabourCategoryInTeam,
  deleteLabourCategoryFromTeam,
  addLabourMemberToCategory,
  updateLabourMemberInCategory,
  deleteLabourMemberFromCategory,
  subscribeAllLabourAttendance
} from "../services/firebaseService";
import {
  getLabourDisplayName,
  calculateLabourFinancials
} from "../services/businessLogic";
import {
  Users,
  Plus,
  Edit2,
  DollarSign,
  Calendar,
  AlertCircle,
  FileText,
  UserPlus,
  Trash2,
  Save,
  X,
  Search
} from "lucide-react";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";
import { useAuth } from "../context/AuthContext";

export default function AdminLabour() {
  const { userProfile } = useAuth();
  
  // App states
  const [activeTab, setActiveTab] = useState("master"); // master, assignments, salary
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Datasets
  const [sites, setSites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [labourMaster, setLabourMaster] = useState({ categories: {}, history: [] });
  const [payments, setPayments] = useState([]);
  const [allLabourHistory, setAllLabourHistory] = useState({}); // siteId -> history

  // New Team Master states
  const [teams, setTeams] = useState([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);

  useEffect(() => {
    if (teams.length > 0 && !selectedTeamId) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  const [newCatName, setNewCatName] = useState("");
  const [newCatWage, setNewCatWage] = useState("");
  const [newCatType, setNewCatType] = useState("Daily");
  const [editingCatKey, setEditingCatKey] = useState(null);
  const [editingWage, setEditingWage] = useState("");

  const [newMemberId, setNewMemberId] = useState("");
  const [newMemberName, setNewMemberName] = useState("");
  const [newMemberSalary, setNewMemberSalary] = useState("");
  const [editingMemberId, setEditingMemberId] = useState(null);
  const [editingMemberName, setEditingMemberName] = useState("");
  const [editingMemberSalary, setEditingMemberSalary] = useState("");
  
  // Tab 2: Assignment Form states (retained for backward compatibility or placeholder)
  const [newWorkerName, setNewWorkerName] = useState("");
  const [newWorkerPhone, setNewWorkerPhone] = useState("");
  const [newWorkerCategory, setNewWorkerCategory] = useState("");
  const [newWorkerSiteId, setNewWorkerSiteId] = useState("");
  const [newWorkerJoinDate, setNewWorkerJoinDate] = useState(new Date().toISOString().split("T")[0]);

  // Tab 3: Salary Form states
  const [paymentSiteId, setPaymentSiteId] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().split("T")[0]);
  const [paymentReference, setPaymentReference] = useState("");
  const [paymentNotes, setPaymentNotes] = useState("");

  // Tab 4: Attendance History states
  const [allLabourAttendance, setAllLabourAttendance] = useState([]);
  const [adminFilterSiteId, setAdminFilterSiteId] = useState("");
  const [adminFilterDate, setAdminFilterDate] = useState("");
  const [adminFilterTeamId, setAdminFilterTeamId] = useState("");

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
      const [fetchedSites, fetchedTeams, fetchedPayments] = await Promise.all([
        getSites(adminId),
        getLabourTeams(adminId),
        getLabourPayments(adminId)
      ]);

      const safeSites = Array.isArray(fetchedSites) ? fetchedSites : [];
      const safeTeams = Array.isArray(fetchedTeams) ? fetchedTeams : [];
      const safePayments = Array.isArray(fetchedPayments) ? fetchedPayments : [];

      setSites(safeSites);
      setTeams(safeTeams);
      setPayments(safePayments);

      // Flatten teams members to populate legacy workers state for backward compatibility/reporting
      const flattenedWorkers = [];
      fetchedTeams.forEach(team => {
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            if (cat.members) {
              Object.keys(cat.members).forEach(memberId => {
                const mem = cat.members[memberId];
                flattenedWorkers.push({
                  id: mem.memberId,
                  workerName: mem.name,
                  category: cat.name,
                  categoryName: cat.name,
                  phoneNumber: "",
                  joiningDate: "--",
                  status: "active",
                  teamId: team.id,
                  teamName: team.teamName,
                  salary: mem.salary
                });
              });
            }
          });
        }
      });
      setWorkers(flattenedWorkers);

      // Populate categories map for fallback logic in calculations
      const categoriesMap = {};
      fetchedTeams.forEach(team => {
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            categoriesMap[cat.name] = {
              name: cat.name,
              wage: cat.baseWage,
              type: cat.paymentType,
              status: "Active"
            };
          });
        }
      });
      setLabourMaster({ categories: categoriesMap, history: [] });

      if (fetchedSites.length > 0) {
        setPaymentSiteId(fetchedSites[0].id);
        setNewWorkerSiteId(fetchedSites[0].id);
      }

      // Fetch labor daily histories (both legacy headcounts & new member attendance logs)
      const historyPromises = fetchedSites.map(s => getLabourDailyCountsSummary(s.id));
      const histories = await Promise.all(historyPromises);
      
      const histMap = {};
      histories.forEach((hist, index) => {
        const siteId = fetchedSites[index].id;
        histMap[siteId] = hist;
      });
      setAllLabourHistory(histMap);

    } catch (err) {
      console.error("Failed to load records:", err);
      showToast(`Failed to load data: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const adminId = userProfile?.uid || userProfile?.id || null;
    loadData();
    const unsubscribe = subscribeLabourTeams((teamsList) => {
      setTeams(teamsList);
      
      // Update workers state when teams change in real-time
      const flattenedWorkers = [];
      teamsList.forEach(team => {
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            if (cat.members) {
              Object.keys(cat.members).forEach(memberId => {
                const mem = cat.members[memberId];
                flattenedWorkers.push({
                  id: mem.memberId,
                  workerName: mem.name,
                  category: cat.name,
                  categoryName: cat.name,
                  phoneNumber: "",
                  joiningDate: "--",
                  status: "active",
                  teamId: team.id,
                  teamName: team.teamName,
                  salary: mem.salary
                });
              });
            }
          });
        }
      });
      setWorkers(flattenedWorkers);

      // Re-map categories
      const categoriesMap = {};
      teamsList.forEach(team => {
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            categoriesMap[cat.name] = {
              name: cat.name,
              wage: cat.baseWage,
              type: cat.paymentType,
              status: "Active"
            };
          });
        }
      });
      setLabourMaster({ categories: categoriesMap, history: [] });
    }, adminId);
    return () => unsubscribe();
  }, [userProfile]);

  useEffect(() => {
    const unsubscribeAllAttendance = subscribeAllLabourAttendance((records) => {
      setAllLabourAttendance(records);
    });
    return () => unsubscribeAllAttendance();
  }, []);

  // -------------------------------------------------------------
  // TEAM HANDLERS
  // -------------------------------------------------------------
  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!newTeamName.trim()) {
      showToast("Team Name cannot be empty.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const adminId = userProfile?.uid || userProfile?.id || null;
      await createLabourTeam(newTeamName.trim(), adminId);
      showToast(`Labour Team "${newTeamName}" created successfully!`, "success");
      setNewTeamName("");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRenameTeam = async (teamId) => {
    if (!editingTeamName.trim()) {
      showToast("Team Name cannot be empty.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const adminId = userProfile?.uid || userProfile?.id || null;
      await updateLabourTeam(teamId, editingTeamName.trim(), adminId);
      showToast("Team renamed successfully.", "success");
      setEditingTeamId(null);
      setEditingTeamName("");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteTeam = async (teamId, name) => {
    if (!confirm(`Are you sure you want to permanently delete Team "${name}"? This will delete all its categories and members.`)) return;
    setSubmitting(true);
    try {
      await deleteLabourTeam(teamId);
      showToast(`Team "${name}" deleted.`, "success");
      if (selectedTeamId === teamId) {
        setSelectedTeamId("");
        setSelectedCategoryId("");
      }
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // CATEGORY HANDLERS
  // -------------------------------------------------------------
  const handleAddCategory = async (e) => {
    e.preventDefault();
    if (!selectedTeamId) {
      showToast("Please select a Labour Team first.", "error");
      return;
    }
    const name = newCatName.trim();
    const wage = Number(newCatWage);
    if (!name) {
      showToast("Category Name is required.", "error");
      return;
    }
    if (isNaN(wage) || wage <= 0) {
      showToast("Base Wage must be a positive number.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await addLabourCategoryToTeam(selectedTeamId, {
        name,
        paymentType: newCatType,
        baseWage: wage
      });
      showToast(`Category "${name}" added to selected Team.`, "success");
      setNewCatName("");
      setNewCatWage("");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateCategoryWage = async (catId) => {
    const wage = Number(editingWage);
    if (isNaN(wage) || wage <= 0) {
      showToast("Wage rate must be a positive number.", "error");
      return;
    }
    const team = teams.find(t => t.id === selectedTeamId);
    if (!team) return;
    const cat = team.categories[catId];
    setSubmitting(true);
    try {
      await updateLabourCategoryInTeam(selectedTeamId, catId, {
        paymentType: cat.paymentType,
        baseWage: wage
      });
      showToast("Category wage updated.", "success");
      setEditingCatKey(null);
      setEditingWage("");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategoryFromTeam = async (catId, catName) => {
    if (!confirm(`Are you sure you want to permanently delete Category "${catName}"? This will delete all its members immediately.`)) return;
    setSubmitting(true);
    try {
      await deleteLabourCategoryFromTeam(selectedTeamId, catId);
      showToast(`Category "${catName}" deleted.`, "success");
      if (selectedCategoryId === catId) {
        setSelectedCategoryId("");
      }
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // MEMBER HANDLERS
  // -------------------------------------------------------------
  const handleAddMember = async (e) => {
    e.preventDefault();
    if (!selectedTeamId || !selectedCategoryId) {
      showToast("Please select a Team and Category first.", "error");
      return;
    }
    const memId = newMemberId.trim();
    const name = newMemberName.trim();
    const salary = Number(newMemberSalary);
    if (!memId) {
      showToast("Member ID is required.", "error");
      return;
    }
    if (!name) {
      showToast("Member Name is required.", "error");
      return;
    }
    if (isNaN(salary) || salary <= 0) {
      showToast("Salary/Wage must be a positive number.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const adminId = userProfile?.uid || userProfile?.id || null;
      await addLabourMemberToCategory(selectedTeamId, selectedCategoryId, {
        memberId: memId,
        name,
        salary
      }, adminId);
      showToast(`Member "${name}" registered successfully!`, "success");
      setNewMemberId("");
      setNewMemberName("");
      setNewMemberSalary("");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleUpdateMember = async (memberId) => {
    const name = editingMemberName.trim();
    const salary = Number(editingMemberSalary);
    if (!name) {
      showToast("Name is required.", "error");
      return;
    }
    if (isNaN(salary) || salary <= 0) {
      showToast("Salary must be a positive number.", "error");
      return;
    }
    setSubmitting(true);
    try {
      await updateLabourMemberInCategory(selectedTeamId, selectedCategoryId, memberId, {
        name,
        salary
      });
      showToast("Member details updated.", "success");
      setEditingMemberId(null);
      setEditingMemberName("");
      setEditingMemberSalary("");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteMember = async (memberId, name) => {
    if (!confirm(`Are you sure you want to delete member "${name}"?`)) return;
    setSubmitting(true);
    try {
      await deleteLabourMemberFromCategory(selectedTeamId, selectedCategoryId, memberId);
      showToast(`Member "${name}" removed.`, "success");
      await loadData();
    } catch (err) {
      showToast(err.message, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // -------------------------------------------------------------
  // RENDERS
  // -------------------------------------------------------------
  // -------------------------------------------------------------
  // RENDERS
  // -------------------------------------------------------------
  const renderMasterTab = () => {
    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    const selectedCategory = selectedTeam?.categories?.[selectedCategoryId];

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Top Header Section */}
        <div className="erp-page-header-container" style={{ margin: 0, paddingBottom: "12px" }}>
          <div className="erp-page-title-group">
            <h2 className="erp-page-header-title" style={{ fontSize: "20px" }}>
              <Users size={22} style={{ color: "var(--accent-600)" }} />
              Subcontractor Teams & Skill Category Master
            </h2>
            <p className="erp-page-header-subtitle">
              Configure labour workforce teams, daily base wages, payment cycles, and registered workers.
            </p>
          </div>
          <div className="erp-page-header-actions">
            <Button onClick={() => setShowCreateTeamModal(true)} icon={Plus}>
              Create Labour Team
            </Button>
          </div>
        </div>

        {/* 3-Panel Dashboard Layout */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "310px 1fr 310px",
          gap: "20px",
          alignItems: "start"
        }} className="erp-three-panel-layout">

          {/* ===================================================================
              LEFT PANEL (30% approx): LABOUR TEAMS LIST
              =================================================================== */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <Card 
              title="Labour Teams" 
              subtitle="Registered subcontractor groups"
              headerActions={<Badge status="info">{teams.length} Teams</Badge>}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                {teams.length === 0 ? (
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "24px 12px", fontSize: "13px", fontStyle: "italic" }}>
                    No Labour Teams configured yet.
                  </div>
                ) : (
                  teams.map(team => {
                    const isSelected = selectedTeamId === team.id;
                    const catCount = Object.keys(team.categories || {}).length;
                    let totalWorkers = 0;
                    if (team.categories) {
                      Object.values(team.categories).forEach(c => {
                        totalWorkers += Number(c.workerCount) || (c.members ? Object.keys(c.members).length : 0) || 1;
                      });
                    }

                    return (
                      <div
                        key={team.id}
                        onClick={() => {
                          setSelectedTeamId(team.id);
                          setSelectedCategoryId("");
                        }}
                        style={{
                          padding: "14px 16px",
                          borderRadius: "10px",
                          border: isSelected ? "2px solid var(--accent-600)" : "1px solid var(--border-color)",
                          backgroundColor: isSelected ? "#fffbeb" : "#ffffff",
                          cursor: "pointer",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px",
                          boxShadow: isSelected ? "var(--shadow-md)" : "var(--shadow-sm)",
                          transition: "all 0.2s ease"
                        }}
                      >
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                          <div>
                            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: isSelected ? "var(--accent-700)" : "var(--primary-950)" }}>
                              {team.teamName}
                            </h4>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px", display: "block" }}>
                              Subcontractor / Labour Group
                            </span>
                          </div>
                          {isSelected && <Badge status="warning">Selected</Badge>}
                        </div>

                        <div style={{ display: "flex", gap: "12px", fontSize: "12px", color: "var(--primary-800)", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                          <span><strong>{catCount}</strong> Categories</span>
                          <span>•</span>
                          <span><strong>{totalWorkers}</strong> Workers</span>
                        </div>

                        <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }} onClick={(e) => e.stopPropagation()}>
                          <Button 
                            variant="outline" 
                            size="sm"
                            onClick={() => {
                              setSelectedTeamId(team.id);
                              setSelectedCategoryId("");
                            }}
                          >
                            View Details
                          </Button>
                          <Button 
                            variant="text" 
                            size="sm"
                            onClick={() => {
                              setEditingTeamId(team.id);
                              setEditingTeamName(team.teamName);
                            }}
                            style={{ color: "var(--text-muted)" }}
                          >
                            <Edit2 size={13} />
                          </Button>
                          <Button 
                            variant="text" 
                            size="sm"
                            onClick={() => handleDeleteTeam(team.id, team.teamName)}
                            style={{ color: "var(--danger-600)" }}
                          >
                            <Trash2 size={13} />
                          </Button>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>
          </div>

          {/* ===================================================================
              CENTER PANEL (45% approx): SELECTED TEAM DETAILS & CATEGORIES
              =================================================================== */}
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {!selectedTeam ? (
              <Card title="Team Details">
                <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                  Please select a Labour Team from the left panel to view categories and rates.
                </div>
              </Card>
            ) : (
              <>
                <Card 
                  title={`Skill Categories — ${selectedTeam.teamName}`}
                  subtitle="Configured categories, payment cycles, and base daily rates"
                  headerActions={<Badge status="success">{Object.keys(selectedTeam.categories || {}).length} Categories</Badge>}
                >
                  {Object.keys(selectedTeam.categories || {}).length === 0 ? (
                    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontStyle: "italic" }}>
                      No skill categories added to <strong>{selectedTeam.teamName}</strong> yet.
                      <br />
                      Use the <strong>Quick Add Category</strong> form on the right to add daily rate categories.
                    </div>
                  ) : (
                    <div style={{ overflowX: "auto" }}>
                      <table className="data-table" style={{ margin: 0 }}>
                        <thead>
                          <tr>
                            <th>Category Name</th>
                            <th>Cycle Type</th>
                            <th style={{ textAlign: "right" }}>Daily Base Wage</th>
                            <th style={{ textAlign: "right" }}>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {Object.keys(selectedTeam.categories).map((catId) => {
                            const cat = selectedTeam.categories[catId];
                            const isCatSelected = selectedCategoryId === catId;
                            const isEditingWage = editingCatKey === catId;
                            const wage = Number(cat.baseWage || cat.wage) || 0;

                            return (
                              <tr 
                                key={catId}
                                style={{ backgroundColor: isCatSelected ? "#fefce8" : "transparent" }}
                              >
                                <td>
                                  <div style={{ fontWeight: "700", color: "var(--primary-950)" }}>
                                    {cat.name}
                                  </div>
                                </td>
                                <td>
                                  <Badge status="pending">{cat.paymentType || "Daily"}</Badge>
                                </td>
                                <td style={{ textAlign: "right", fontWeight: "800" }} className="font-mono">
                                  {isEditingWage ? (
                                    <div style={{ display: "flex", gap: "4px", justifyContent: "flex-end", alignItems: "center" }}>
                                      <input
                                        type="number"
                                        value={editingWage}
                                        onChange={(e) => setEditingWage(e.target.value)}
                                        style={{ width: "90px", padding: "4px 8px", fontSize: "12px", border: "1px solid var(--border-color)", borderRadius: "4px", fontWeight: "700" }}
                                      />
                                      <button onClick={() => handleUpdateCategoryWage(catId)} style={{ border: "none", background: "none", color: "var(--success-600)", cursor: "pointer" }}><Save size={14} /></button>
                                      <button onClick={() => setEditingCatKey(null)} style={{ border: "none", background: "none", color: "var(--text-muted)", cursor: "pointer" }}><X size={14} /></button>
                                    </div>
                                  ) : (
                                    <span style={{ color: "var(--success-700)" }}>₹{wage.toLocaleString("en-IN")}</span>
                                  )}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      onClick={() => {
                                        setEditingCatKey(catId);
                                        setEditingWage(wage);
                                      }}
                                    >
                                      Edit Wage
                                    </Button>
                                    <Button
                                      variant="text"
                                      size="sm"
                                      onClick={() => handleDeleteCategoryFromTeam(catId, cat.name)}
                                      style={{ color: "var(--danger-600)" }}
                                    >
                                      <Trash2 size={13} />
                                    </Button>
                                  </div>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </Card>
              </>
            )}
          </div>

          {/* ===================================================================
              RIGHT PANEL (25% approx): QUICK ADD CATEGORY (STICKY)
              =================================================================== */}
          <div style={{ position: "sticky", top: "20px" }}>
            <Card 
              title="Quick Add Category" 
              subtitle="Add category & base daily rate"
              style={{ borderLeft: "4px solid var(--accent-600)" }}
            >
              <form onSubmit={handleAddCategory} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                
                {/* Selected Team Notice */}
                <div style={{
                  padding: "10px 12px",
                  borderRadius: "6px",
                  backgroundColor: selectedTeam ? "#f0f9ff" : "#fef2f2",
                  border: `1px solid ${selectedTeam ? "#bae6fd" : "#fecaca"}`,
                  fontSize: "12px",
                  fontWeight: "700",
                  color: selectedTeam ? "#0369a1" : "#991b1b"
                }}>
                  {selectedTeam ? `Selected Team: ${selectedTeam.teamName}` : "⚠️ Select a Labour Team first!"}
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
                    Category Label
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Mason (Senior)"
                    value={newCatName}
                    onChange={(e) => setNewCatName(e.target.value)}
                    disabled={!selectedTeam}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", fontSize: "13px", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
                    Daily Base Wage (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="1"
                    placeholder="e.g. 850"
                    value={newCatWage}
                    onChange={(e) => setNewCatWage(e.target.value)}
                    disabled={!selectedTeam}
                    required
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", fontSize: "13px", fontWeight: "700", outline: "none" }}
                  />
                </div>

                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-900)", display: "block", marginBottom: "4px" }}>
                    Payment Cycle Type
                  </label>
                  <select
                    value={newCatType}
                    onChange={(e) => setNewCatType(e.target.value)}
                    disabled={!selectedTeam}
                    style={{ width: "100%", padding: "10px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", fontSize: "13px", backgroundColor: "#ffffff", outline: "none" }}
                  >
                    <option value="Daily">Daily Rate</option>
                    <option value="Weekly">Weekly Cycle</option>
                    <option value="Monthly">Monthly Salary</option>
                  </select>
                </div>

                <Button
                  type="submit"
                  variant="primary"
                  disabled={!selectedTeam || submitting}
                  style={{ width: "100%", height: "44px", marginTop: "6px", fontSize: "13px", fontWeight: "800" }}
                >
                  {submitting ? "Saving..." : "Save Category"}
                </Button>
              </form>
            </Card>
          </div>

        </div>

        {/* Modal for Create Labour Team */}
        <Modal
          show={showCreateTeamModal}
          onClose={() => setShowCreateTeamModal(false)}
          title="Create New Labour Subcontractor Team"
        >
          <form onSubmit={async (e) => {
            await handleCreateTeam(e);
            setShowCreateTeamModal(false);
          }}>
            <div className="form-group">
              <label htmlFor="modal-team-name" style={{ fontWeight: "700", fontSize: "13px" }}>Subcontractor / Team Name</label>
              <input
                id="modal-team-name"
                type="text"
                placeholder="e.g. UltraTech Contractors"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", marginTop: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div className="modal-footer" style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => setShowCreateTeamModal(false)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Creating..." : "Create Team"}
              </Button>
            </div>
          </form>
        </Modal>

        {/* Modal for Rename Labour Team */}
        <Modal
          show={!!editingTeamId}
          onClose={() => setEditingTeamId(null)}
          title="Rename Labour Team"
        >
          <form onSubmit={async (e) => {
            e.preventDefault();
            await handleRenameTeam(editingTeamId);
          }}>
            <div className="form-group">
              <label htmlFor="modal-rename-name" style={{ fontWeight: "700", fontSize: "13px" }}>Team Name</label>
              <input
                id="modal-rename-name"
                type="text"
                value={editingTeamName}
                onChange={(e) => setEditingTeamName(e.target.value)}
                required
                style={{ width: "100%", padding: "10px", marginTop: "6px", borderRadius: "6px", border: "1px solid #cbd5e1" }}
              />
            </div>
            <div className="modal-footer" style={{ marginTop: "20px", display: "flex", gap: "10px", justifyContent: "flex-end" }}>
              <Button type="button" variant="secondary" onClick={() => setEditingTeamId(null)}>Cancel</Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Saving..." : "Save Rename"}
              </Button>
            </div>
          </form>
        </Modal>

      </div>
    );
  };

  const renderAssignmentsTab = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        <Card title="Company Labour Registry Lookup" subtitle="Hierarchical breakdown of all registered Labour Teams, Categories and Members.">
          <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
            {teams.length === 0 ? (
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "32px" }}>
                No Labour Teams configured in the Master tab.
              </div>
            ) : (
              teams.map(team => {
                const cats = team.categories ? Object.values(team.categories) : [];
                return (
                  <div key={team.id} style={{ border: "1px solid var(--border-color)", borderRadius: "8px", padding: "20px", backgroundColor: "#fcfcfc" }}>
                    <h3 style={{ margin: "0 0 16px 0", color: "var(--primary-900)", fontWeight: "800", fontSize: "18px", borderBottom: "1.5px solid var(--border-color)", paddingBottom: "8px" }}>
                      {team.teamName}
                    </h3>
                    {cats.length === 0 ? (
                      <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px", margin: 0 }}>No categories registered inside this team.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                        {cats.map(cat => {
                          const membersList = cat.members ? Object.values(cat.members) : [];
                          return (
                            <div key={cat.id} style={{ marginLeft: "12px", borderLeft: "2px solid var(--primary-200)", paddingLeft: "16px" }}>
                              <h4 style={{ margin: "0 0 8px 0", color: "var(--primary-700)", fontWeight: "700", fontSize: "14.5px" }}>
                                {cat.name} <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-muted)" }}>(Base Wage: ₹{cat.baseWage} / Cycle: {cat.paymentType})</span>
                              </h4>
                              {membersList.length === 0 ? (
                                <p style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "12px", margin: 0 }}>No workers registered in this category.</p>
                              ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "12px" }}>
                                  {membersList.map(m => (
                                    <div key={m.memberId} style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "#ffffff", border: "1px solid var(--border-color)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <div style={{ display: "flex", flexDirection: "column" }}>
                                        <span style={{ fontWeight: "700", fontSize: "12.5px" }}>{m.name}</span>
                                        <span style={{ fontSize: "10.5px", fontFamily: "monospace", color: "var(--text-muted)" }}>ID: {m.memberId}</span>
                                      </div>
                                      <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--success-700)", fontFamily: "monospace" }}>₹{m.salary}</span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>
      </div>
    );
  };

  const renderSalaryTab = () => {
    // Generate site-wise financials
    const siteLabourFinancials = sites.map(site => {
      const hist = allLabourHistory[site.id] || [];
      const stats = calculateLabourFinancials(site.id, hist, labourMaster.categories, payments);
      return {
        site,
        stats
      };
    });

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "24px", alignItems: "start" }}>
        
        {/* Log Payment Form */}
        <Card title="Log Labour Salary Payment">
          <form onSubmit={handleLogPayment} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="pay-site" style={{ fontSize: "12.5px", fontWeight: "700" }}>Construction Site</label>
              <select
                id="pay-site"
                value={paymentSiteId}
                onChange={(e) => setPaymentSiteId(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", backgroundColor: "#ffffff" }}
              >
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="pay-amount" style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Amount (₹)</label>
                <input
                  id="pay-amount"
                  type="number"
                  placeholder="e.g. 15000"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <label htmlFor="pay-date" style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Date</label>
                <input
                  id="pay-date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  style={{ padding: "9px", borderRadius: "6px", border: "1px solid var(--border-color)" }}
                />
              </div>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="pay-ref" style={{ fontSize: "12.5px", fontWeight: "700" }}>Payment Reference / Receipt ID</label>
              <input
                id="pay-ref"
                type="text"
                placeholder="e.g. TXN-1928374 or Cash"
                value={paymentReference}
                onChange={(e) => setPaymentReference(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <label htmlFor="pay-notes" style={{ fontSize: "12.5px", fontWeight: "700" }}>Additional Notes</label>
              <textarea
                id="pay-notes"
                placeholder="Details of payout..."
                rows={3}
                value={paymentNotes}
                onChange={(e) => setPaymentNotes(e.target.value)}
                style={{ padding: "10px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
            </div>

            <Button type="submit" icon={DollarSign} style={{ marginTop: "10px", backgroundColor: "var(--primary-800)" }}>
              Log Payment
            </Button>
          </form>
        </Card>

        {/* Ledger overview & payment history logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Ledger Table */}
          <Card title="Corporate Site-wise Labor Salary Audit Ledger" variant="table">
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ margin: 0 }}>
                <thead>
                  <tr>
                    <th>Site Name</th>
                    <th style={{ textAlign: "right" }}>Total Wages Owed</th>
                    <th style={{ textAlign: "right" }}>Total Paid Out</th>
                    <th style={{ textAlign: "right" }}>Pending Balance</th>
                  </tr>
                </thead>
                <tbody>
                  {siteLabourFinancials.map(({ site, stats }) => (
                    <tr key={site.id}>
                      <td style={{ fontWeight: "700" }}>{site.siteName}</td>
                      <td style={{ textAlign: "right", fontFamily: "monospace" }}>₹{stats.totalCost}</td>
                      <td style={{ textAlign: "right", color: "var(--success-700)", fontFamily: "monospace" }}>₹{stats.paidAmount}</td>
                      <td style={{ textAlign: "right", color: "var(--danger-700)", fontWeight: "700", fontFamily: "monospace" }}>₹{stats.pendingAmount}</td>
                    </tr>
                  ))}
                  
                  {/* Totals */}
                  <tr style={{ backgroundColor: "var(--primary-50)", fontWeight: "800" }}>
                    <td>Aggregate Summary</td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                      ₹{siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.totalCost, 0)}
                    </td>
                    <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                      ₹{siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.paidAmount, 0)}
                    </td>
                    <td style={{ textAlign: "right", color: "var(--danger-800)", fontFamily: "monospace" }}>
                      ₹{siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.pendingAmount, 0)}
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>
          </Card>

          {/* Payment history list */}
          <Card title="Corporate Labor Payout Transaction History">
            {payments.length === 0 ? (
              <p style={{ color: "var(--text-muted)", fontStyle: "italic", textAlign: "center" }}>No payout transactions recorded yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "300px", overflowY: "auto" }}>
                {payments.map((p, idx) => {
                  const site = sites.find(s => s.id === p.siteId) || { siteName: "Unknown Site" };
                  return (
                    <div key={p.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px", fontSize: "12.5px" }}>
                      <div>
                        Paid <strong style={{ color: "var(--success-700)" }}>₹{p.amount}</strong> to workers at <strong>{site.siteName}</strong>
                        <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>Ref: {p.reference || "none"} | Notes: {p.notes || "none"}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", alignItems: "end", fontSize: "11px", color: "var(--text-muted)" }}>
                        <span>By: {p.loggedBy}</span>
                        <span className="font-mono">{p.date}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // ATTENDANCE HISTORY TAB
  // -------------------------------------------------------------
  const renderAttendanceTab = () => {
    const filteredAttendance = allLabourAttendance.filter(r => {
      if (adminFilterSiteId && r.siteId !== adminFilterSiteId) {
        return false;
      }
      if (adminFilterDate && r.attendanceDate !== adminFilterDate) {
        return false;
      }
      if (adminFilterTeamId && r.teamId !== adminFilterTeamId) {
        return false;
      }
      const isAllowedSite = sites.some(s => s.id === r.siteId);
      return isAllowedSite;
    });

    let totalFullDay = 0;
    let totalHalfDay = 0;
    let totalLabour = 0;
    let totalUnits = 0;

    filteredAttendance.forEach(r => {
      const count = Number(r.workerCount) || (r.workerName ? 1 : 0);
      const units = r.units !== undefined && r.units !== null && !isNaN(Number(r.units))
        ? Number(r.units)
        : (count * (r.attendanceType === "Half Day" ? 0.5 : 1.0));

      totalUnits += units;
      totalLabour += count;

      const wUnit = r.workUnit !== undefined ? Number(r.workUnit) : (r.attendanceType === "Half Day" ? 0.5 : 1.0);
      if (wUnit === 1.0 || r.attendanceType === "Full Day") {
        totalFullDay += count;
      } else if (wUnit === 0.5 || r.attendanceType === "Half Day") {
        totalHalfDay += count;
      }
    });

    const getEntryTimeStr = (record) => {
      if (!record.createdAt) return "-";
      let dateObj;
      if (record.createdAt.seconds) {
        dateObj = new Date(record.createdAt.seconds * 1000);
      } else {
        dateObj = new Date(record.createdAt);
      }
      if (isNaN(dateObj.getTime())) return "-";
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
        
        {/* Dynamic Summary Stats Grid */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))",
          gap: "16px",
          width: "100%"
        }}>
          <div style={{
            backgroundColor: "#e8f5e9",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #c8e6c9",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: "750", color: "#2e7d32", textTransform: "uppercase", letterSpacing: "0.5px" }}>Full Day Workers</span>
            <span style={{ fontSize: "24px", fontWeight: "900", color: "#1b5e20" }}>{totalFullDay}</span>
          </div>

          <div style={{
            backgroundColor: "#fff3e0",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #ffe0b2",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: "750", color: "#e65100", textTransform: "uppercase", letterSpacing: "0.5px" }}>Half Day Workers</span>
            <span style={{ fontSize: "24px", fontWeight: "900", color: "#e65100" }}>{totalHalfDay}</span>
          </div>

          <div style={{
            backgroundColor: "#e0f2fe",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #bae6fd",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: "750", color: "#0369a1", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Work Units</span>
            <span style={{ fontSize: "24px", fontWeight: "900", color: "#0284c7" }}>{totalUnits % 1 === 0 ? totalUnits : totalUnits.toFixed(2)}</span>
          </div>

          <div style={{
            backgroundColor: "#f3edf7",
            borderRadius: "16px",
            padding: "16px",
            border: "1px solid #e7e0ec",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: "750", color: "#6750a4", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Headcount</span>
            <span style={{ fontSize: "24px", fontWeight: "900", color: "#6750a4" }}>{totalLabour}</span>
          </div>
        </div>

        {/* Filters Card */}
        <Card title="Filter Site Attendance History" subtitle="Filter real-time attendance logs for assigned construction sites.">
          <div style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
            gap: "16px"
          }}>
            {/* Site Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Construction Site</span>
              <select
                value={adminFilterSiteId}
                onChange={(e) => setAdminFilterSiteId(e.target.value)}
                style={{
                  height: "40px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: "600",
                  outline: "none",
                  color: "var(--text-main)"
                }}
              >
                <option value="">All Sites</option>
                {sites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            </div>

            {/* Date Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Date Filter</span>
              <input 
                type="date"
                value={adminFilterDate}
                onChange={(e) => setAdminFilterDate(e.target.value)}
                style={{
                  height: "40px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: "600",
                  outline: "none",
                  color: "var(--text-main)"
                }}
              />
            </div>

            {/* Team Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Subcontractor Team</span>
              <select
                value={adminFilterTeamId}
                onChange={(e) => setAdminFilterTeamId(e.target.value)}
                style={{
                  height: "40px",
                  padding: "8px 12px",
                  borderRadius: "8px",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontSize: "13.5px",
                  fontWeight: "600",
                  outline: "none",
                  color: "var(--text-main)"
                }}
              >
                <option value="">All Subcontractor Teams</option>
                {teams.map(t => (
                  <option key={t.id} value={t.id}>{t.teamName}</option>
                ))}
              </select>
            </div>
          </div>

          {/* Reset Filters */}
          {(adminFilterSiteId || adminFilterDate || adminFilterTeamId) && (
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px" }}>
              <button
                type="button"
                onClick={() => {
                  setAdminFilterSiteId("");
                  setAdminFilterDate("");
                  setAdminFilterTeamId("");
                }}
                style={{
                  backgroundColor: "transparent",
                  color: "var(--primary-800)",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: "700",
                  cursor: "pointer",
                  padding: "4px 8px"
                }}
              >
                Clear Filters
              </button>
            </div>
          )}
        </Card>

        {/* History Cards Logs */}
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--text-main)" }}>Detailed Attendance Logs</h3>
          
          {filteredAttendance.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "48px 24px",
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              border: "1px dashed var(--border-color)",
              color: "var(--text-muted)",
              fontSize: "14px"
            }}>
              No attendance records found matching the current filters.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "16px" }}>
              {filteredAttendance.map((record, index) => {
                const site = sites.find(s => s.id === record.siteId) || { siteName: "Unknown Site" };
                const team = teams.find(t => t.id === record.teamId) || { teamName: "Unknown Team" };
                
                let catName = "Unknown";
                if (team.categories && team.categories[record.categoryId]) {
                  catName = team.categories[record.categoryId].name;
                } else if (record.categoryId) {
                  catName = record.categoryId;
                }
                
                const workerCount = record.workerCount !== undefined ? record.workerCount : 1;
                const recWorkUnit = record.workUnit !== undefined ? Number(record.workUnit) : (record.attendanceType === "Half Day" ? 0.5 : 1.0);
                const recTotalUnits = record.units !== undefined ? Number(record.units) : (workerCount * recWorkUnit);
                
                let formattedDate = record.attendanceDate;
                try {
                  const [y, m, d] = record.attendanceDate.split("-");
                  if (y && m && d) formattedDate = `${d}-${m}-${y}`;
                } catch (e) {}

                return (
                  <div key={record.id || index} style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "16px",
                    border: "1px solid var(--border-color)",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    boxShadow: "0px 1px 3px rgba(0,0,0,0.05)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <span style={{ fontSize: "14px", fontWeight: "800", color: "var(--text-main)" }}>
                        {site.siteName}
                      </span>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: "700",
                        color: "var(--success-700)",
                        backgroundColor: "var(--success-50)",
                        padding: "2px 8px",
                        borderRadius: "12px"
                      }}>
                        Present
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12.5px", color: "var(--text-muted)" }}>
                      <span>Date: <strong>{formattedDate}</strong></span>
                      <span>Time: {getEntryTimeStr(record)}</span>
                    </div>

                    <div style={{ fontSize: "13px", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                      Team: <strong style={{ color: "var(--text-main)" }}>{team.teamName}</strong> | Category: <strong style={{ color: "var(--text-main)" }}>{catName}</strong>
                    </div>

                    {/* Counts Grid */}
                    <div style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(3, 1fr)",
                      gap: "6px",
                      backgroundColor: "#f9f9fa",
                      borderRadius: "10px",
                      padding: "8px",
                      textAlign: "center",
                      marginTop: "4px"
                    }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "9px", fontWeight: "700", color: "var(--text-muted)" }}>Headcount</span>
                        <span style={{ fontSize: "12.5px", fontWeight: "800", color: "var(--text-main)" }}>{workerCount}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "9px", fontWeight: "700", color: "var(--text-muted)" }}>Work Unit</span>
                        <span style={{ fontSize: "12.5px", fontWeight: "800", color: "var(--success-600)" }}>{recWorkUnit}</span>
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                        <span style={{ fontSize: "9px", fontWeight: "700", color: "var(--text-muted)" }}>Total Units</span>
                        <span style={{ fontSize: "12.5px", fontWeight: "800", color: "var(--primary-700)" }}>{recTotalUnits}</span>
                      </div>
                    </div>

                    <div style={{ fontSize: "11px", color: "var(--text-muted)", borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "4px", textAlign: "right" }}>
                      Logged By: {record.loggedBy || "Site Engineer"}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

      </div>
    );
  };

  return (
    <Layout
      title="Labour & Wage Administration console"
      description="Define corporate trade wage rates, assign workers to site checklists, and track pending salary balances."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* Tabs Menu navigation */}
      <div className="erp-tabs-list no-print" style={{ marginBottom: "24px" }}>
        <button
          onClick={() => setActiveTab("master")}
          className={`erp-tab-button ${activeTab === "master" ? "active" : ""}`}
        >
          <Users size={14} style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }} />
          <span style={{ verticalAlign: "middle" }}>Labour Master</span>
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          className={`erp-tab-button ${activeTab === "assignments" ? "active" : ""}`}
        >
          <Plus size={14} style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }} />
          <span style={{ verticalAlign: "middle" }}>Labour Assignments</span>
        </button>
        <button
          onClick={() => setActiveTab("salary")}
          className={`erp-tab-button ${activeTab === "salary" ? "active" : ""}`}
        >
          <DollarSign size={14} style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }} />
          <span style={{ verticalAlign: "middle" }}>Salary Management</span>
        </button>
        <button
          onClick={() => setActiveTab("attendance")}
          className={`erp-tab-button ${activeTab === "attendance" ? "active" : ""}`}
        >
          <Calendar size={14} style={{ marginRight: "6px", display: "inline-block", verticalAlign: "middle" }} />
          <span style={{ verticalAlign: "middle" }}>Attendance History</span>
        </button>
      </div>

      {activeTab === "master" && renderMasterTab()}
      {activeTab === "assignments" && renderAssignmentsTab()}
      {activeTab === "salary" && renderSalaryTab()}
      {activeTab === "attendance" && renderAttendanceTab()}

      <Loading show={loading || submitting} text="Processing labour operations..." />
    </Layout>
  );
}

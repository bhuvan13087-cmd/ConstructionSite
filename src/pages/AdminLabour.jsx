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
  UserCheck,
  Activity,
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

  // Search states for teams and members filtering
  const [teamSearchQuery, setTeamSearchQuery] = useState("");
  const [memberSearchQuery, setMemberSearchQuery] = useState("");

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

      setSites(fetchedSites);
      setTeams(fetchedTeams);
      setPayments(fetchedPayments);

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
  const renderMasterTab = () => {
    const selectedTeam = teams.find(t => t.id === selectedTeamId);
    const selectedCategory = selectedTeam?.categories?.[selectedCategoryId];

    // Filter teams by search
    const filteredTeams = teams.filter(t => 
      t.teamName?.toLowerCase().includes(teamSearchQuery.toLowerCase().trim())
    );

    return (
      <div style={{ display: "grid", gridTemplateColumns: "30% 70%", gap: "20px", alignItems: "start" }}>
        
        {/* LEFT PANEL (30%): LABOUR TEAMS */}
        <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 16px", display: "flex", flexDirection: "column", height: "650px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
              <Users size={16} style={{ color: "#2563eb" }} /> Labour Teams
            </h3>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>{teams.length} Teams</span>
          </div>

          {/* New Team Creation Form */}
          <form onSubmit={handleCreateTeam} style={{ display: "flex", gap: "8px", marginBottom: "12px" }}>
            <input
              type="text"
              placeholder="New Team Name"
              value={newTeamName}
              onChange={(e) => setNewTeamName(e.target.value)}
              style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
            />
            <Button type="submit" size="sm" style={{ backgroundColor: "#2563eb", padding: "8px 12px" }}>
              <Plus size={16} />
            </Button>
          </form>

          {/* Team Search Input */}
          <div className="input-wrapper" style={{ marginBottom: "12px" }}>
            <Search className="input-icon" size={14} />
            <input 
              type="text" 
              placeholder="Search teams..."
              value={teamSearchQuery}
              onChange={(e) => setTeamSearchQuery(e.target.value)}
              style={{ paddingLeft: "36px", fontSize: "12px" }}
            />
          </div>

          {/* Teams List */}
          <div style={{ overflowY: "auto", flex: 1, display: "flex", flexDirection: "column", gap: "8px", paddingRight: "4px" }}>
            {filteredTeams.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "24px", fontSize: "12px" }}>
                No Labour Teams found.
              </div>
            ) : (
              filteredTeams.map(team => {
                const isSelected = selectedTeamId === team.id;
                const isEditing = editingTeamId === team.id;
                const catCount = Object.keys(team.categories || {}).length;
                let workerCount = 0;
                if (team.categories) {
                  Object.values(team.categories).forEach(c => {
                    workerCount += Object.keys(c.members || {}).length;
                  });
                }

                return (
                  <div
                    key={team.id}
                    onClick={() => {
                      if (!isEditing) {
                        setSelectedTeamId(team.id);
                        setSelectedCategoryId("");
                      }
                    }}
                    style={{
                      padding: "12px 14px",
                      borderRadius: "8px",
                      border: isSelected ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                      backgroundColor: isSelected ? "#eff6ff" : "#ffffff",
                      cursor: "pointer",
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      transition: "all 0.15s ease"
                    }}
                  >
                    {isEditing ? (
                      <div style={{ display: "flex", gap: "6px", width: "100%", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                        <input
                          type="text"
                          value={editingTeamName}
                          onChange={(e) => setEditingTeamName(e.target.value)}
                          style={{ flex: 1, padding: "4px 8px", fontSize: "12.5px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                        />
                        <button
                          onClick={() => handleRenameTeam(team.id)}
                          style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", padding: "4px" }}
                        >
                          <Save size={15} />
                        </button>
                        <button
                          onClick={() => {
                            setEditingTeamId(null);
                            setEditingTeamName("");
                          }}
                          style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
                        >
                          <X size={15} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div style={{ display: "flex", flexDirection: "column" }}>
                          <strong style={{ fontSize: "13px", color: isSelected ? "#1e40af" : "#0f172a" }}>
                            {team.teamName}
                          </strong>
                          <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                            {catCount} Categories • {workerCount} Workers
                          </span>
                        </div>
                        
                        <div style={{ display: "flex", gap: "4px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            onClick={() => {
                              setEditingTeamId(team.id);
                              setEditingTeamName(team.teamName);
                            }}
                            style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "4px" }}
                            title="Edit team name"
                          >
                            <Edit2 size={13} />
                          </button>
                          <button
                            onClick={() => handleDeleteTeam(team.id, team.teamName)}
                            style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "4px" }}
                            title="Delete team"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </Card>

        {/* RIGHT PANEL (70%): TEAM INFORMATION & WORKER MASTER */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          {selectedTeam ? (
            <>
              {/* TEAM INFORMATION CARD */}
              <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{selectedTeam.teamName}</h3>
                    <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>
                      Trade workforce group configuration & worker roster
                    </p>
                  </div>
                  <div style={{ display: "flex", gap: "12px" }}>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: "700", display: "block" }}>Categories</span>
                      <strong style={{ fontSize: "14px", color: "#0f172a" }}>{Object.keys(selectedTeam.categories || {}).length}</strong>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "10.5px", color: "#64748b", textTransform: "uppercase", fontWeight: "700", display: "block" }}>Status</span>
                      <Badge status="active" />
                    </div>
                  </div>
                </div>
              </Card>

              {/* TRADE CATEGORIES CARD */}
              <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
                <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "14px", display: "flex", alignItems: "center", gap: "6px" }}>
                  <Users size={16} style={{ color: "#ea580c" }} /> Trade Categories in "{selectedTeam.teamName}"
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px", alignItems: "start" }}>
                  
                  {/* Categories List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {!selectedTeam.categories || Object.keys(selectedTeam.categories).length === 0 ? (
                      <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "12px", padding: "16px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        No categories configured for this team yet. Add one on the right.
                      </div>
                    ) : (
                      Object.keys(selectedTeam.categories).map(catId => {
                        const cat = selectedTeam.categories[catId];
                        const isCatSelected = selectedCategoryId === catId;
                        const isEditingCat = editingCatKey === catId;

                        return (
                          <div
                            key={catId}
                            onClick={() => {
                              if (!isEditingCat) {
                                setSelectedCategoryId(catId);
                              }
                            }}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "8px",
                              border: isCatSelected ? "1.5px solid #2563eb" : "1px solid #e2e8f0",
                              backgroundColor: isCatSelected ? "#eff6ff" : "#ffffff",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <strong style={{ fontSize: "13px", color: isCatSelected ? "#1e40af" : "#0f172a" }}>{cat.name}</strong>
                              <span style={{ fontSize: "11px", color: "#64748b", marginTop: "2px" }}>
                                Cycle: {cat.paymentType} • Base Wage: ₹{cat.baseWage}
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: "6px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                              {isEditingCat ? (
                                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                  <input
                                    type="number"
                                    value={editingWage}
                                    placeholder="Wage"
                                    onChange={(e) => setEditingWage(e.target.value)}
                                    style={{ width: "70px", padding: "4px 6px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                                  />
                                  <button
                                    onClick={() => handleUpdateCategoryWage(catId)}
                                    style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer", padding: "2px" }}
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingCatKey(null);
                                      setEditingWage("");
                                    }}
                                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                                  >
                                    <X size={14} />
                                  </button>
                                </div>
                              ) : (
                                <>
                                  <button
                                    onClick={() => {
                                      setEditingCatKey(catId);
                                      setEditingWage(cat.baseWage);
                                    }}
                                    style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer", padding: "2px" }}
                                    title="Edit wage rate"
                                  >
                                    <Edit2 size={13} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategoryFromTeam(catId, cat.name)}
                                    style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", padding: "2px" }}
                                    title="Delete category"
                                  >
                                    <Trash2 size={13} />
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>

                  {/* Add Category Form */}
                  <form onSubmit={handleAddCategory} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                    <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>Add Trade Category</strong>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Category Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Mason, Painter"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Base Wage (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 700"
                        value={newCatWage}
                        onChange={(e) => setNewCatWage(e.target.value)}
                        style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Cycle Type</label>
                      <select
                        value={newCatType}
                        onChange={(e) => setNewCatType(e.target.value)}
                        style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px", backgroundColor: "#ffffff" }}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                    <Button type="submit" size="sm" style={{ marginTop: "4px", backgroundColor: "#2563eb" }}>
                      Add Category
                    </Button>
                  </form>
                </div>
              </Card>

              {/* MEMBERS MASTER TABLE CARD */}
              {selectedCategory ? (
                <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "14px" }}>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", display: "flex", alignItems: "center", gap: "6px" }}>
                      <UserCheck size={16} style={{ color: "#16a34a" }} /> Members Master in "{selectedCategory.name}"
                    </div>
                    <div className="input-wrapper" style={{ width: "200px" }}>
                      <Search className="input-icon" size={13} />
                      <input 
                        type="text" 
                        placeholder="Search member..."
                        value={memberSearchQuery}
                        onChange={(e) => setMemberSearchQuery(e.target.value)}
                        style={{ paddingLeft: "34px", fontSize: "11.5px" }}
                      />
                    </div>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1.4fr 1fr", gap: "20px", alignItems: "start" }}>
                    
                    {/* Members List Table */}
                    <div style={{ overflowX: "auto" }}>
                      {!selectedCategory.members || Object.keys(selectedCategory.members).length === 0 ? (
                        <div style={{ color: "#64748b", fontStyle: "italic", fontSize: "12px", padding: "16px", textAlign: "center", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          No members registered in this category. Register one on the right.
                        </div>
                      ) : (
                        <table className="modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                          <thead>
                            <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                              <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "10.5px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>ID</th>
                              <th style={{ padding: "8px 10px", textAlign: "left", fontSize: "10.5px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Worker Name</th>
                              <th style={{ padding: "8px 10px", textAlign: "right", fontSize: "10.5px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Wage</th>
                              <th style={{ padding: "8px 10px", textAlign: "center", fontSize: "10.5px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.values(selectedCategory.members)
                              .filter(m => m.name?.toLowerCase().includes(memberSearchQuery.toLowerCase().trim()) || m.memberId?.toLowerCase().includes(memberSearchQuery.toLowerCase().trim()))
                              .map(member => {
                                const isEditingMem = editingMemberId === member.memberId;
                                return (
                                  <tr key={member.memberId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                                    <td style={{ padding: "8px 10px", fontSize: "11px", fontFamily: "monospace", color: "#64748b" }}>{member.memberId}</td>
                                    <td style={{ padding: "8px 10px" }}>
                                      {isEditingMem ? (
                                        <input
                                          type="text"
                                          value={editingMemberName}
                                          onChange={(e) => setEditingMemberName(e.target.value)}
                                          style={{ width: "100px", padding: "4px", fontSize: "12px", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                                        />
                                      ) : (
                                        <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>{member.name}</strong>
                                      )}
                                    </td>
                                    <td style={{ padding: "8px 10px", textAlign: "right", fontFamily: "monospace", fontSize: "12px", fontWeight: "700", color: "#16a34a" }}>
                                      {isEditingMem ? (
                                        <input
                                          type="number"
                                          value={editingMemberSalary}
                                          onChange={(e) => setEditingMemberSalary(e.target.value)}
                                          style={{ width: "70px", padding: "4px", fontSize: "12px", textAlign: "right", border: "1px solid #cbd5e1", borderRadius: "4px" }}
                                        />
                                      ) : (
                                        `₹${member.salary}`
                                      )}
                                    </td>
                                    <td style={{ padding: "8px 10px", textAlign: "center" }}>
                                      <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                        {isEditingMem ? (
                                          <>
                                            <button
                                              onClick={() => handleUpdateMember(member.memberId)}
                                              style={{ background: "none", border: "none", color: "#16a34a", cursor: "pointer" }}
                                            >
                                              <Save size={13} />
                                            </button>
                                            <button
                                              onClick={() => {
                                                setEditingMemberId(null);
                                                setEditingMemberName("");
                                                setEditingMemberSalary("");
                                              }}
                                              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                                            >
                                              <X size={13} />
                                            </button>
                                          </>
                                        ) : (
                                          <>
                                            <button
                                              onClick={() => {
                                                setEditingMemberId(member.memberId);
                                                setEditingMemberName(member.name);
                                                setEditingMemberSalary(member.salary);
                                              }}
                                              style={{ background: "none", border: "none", color: "#64748b", cursor: "pointer" }}
                                              title="Edit member"
                                            >
                                              <Edit2 size={12} />
                                            </button>
                                            <button
                                              onClick={() => handleDeleteMember(member.memberId, member.name)}
                                              style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer" }}
                                              title="Delete member"
                                            >
                                              <Trash2 size={12} />
                                            </button>
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                          </tbody>
                        </table>
                      )}
                    </div>

                    {/* Add Member Form */}
                    <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                      <strong style={{ fontSize: "12.5px", color: "#0f172a" }}>Register Worker Member</strong>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Member ID</label>
                        <input
                          type="text"
                          placeholder="e.g. L001"
                          value={newMemberId}
                          onChange={(e) => setNewMemberId(e.target.value)}
                          style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Full Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Ramesh Kumar"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Wage / Salary (₹)</label>
                        <input
                          type="number"
                          placeholder={`Default: ${selectedCategory.baseWage}`}
                          value={newMemberSalary}
                          onChange={(e) => setNewMemberSalary(e.target.value)}
                          style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                        />
                      </div>

                      <Button type="submit" size="sm" icon={UserPlus} style={{ marginTop: "4px", backgroundColor: "#2563eb" }}>
                        Register Member
                      </Button>
                    </form>

                  </div>
                </Card>
              ) : (
                <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "20px", textAlign: "center", color: "#64748b", fontSize: "12.5px" }}>
                  Select a category card above to view and manage its registered worker members.
                </Card>
              )}
            </>
          ) : (
            <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "40px", textAlign: "center", color: "#64748b" }}>
              <Users size={32} style={{ color: "#cbd5e1", marginBottom: "8px" }} />
              <strong style={{ display: "block", fontSize: "14px", color: "#0f172a", marginBottom: "4px" }}>Select a Labour Team</strong>
              <span style={{ fontSize: "12px" }}>Choose a labour team from the left panel to configure categories and worker members.</span>
            </Card>
          )}
        </div>

      </div>
    );
  };

  const renderAssignmentsTab = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "20px" }}>
          <div style={{ marginBottom: "16px" }}>
            <h3 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>Company Labour Registry Lookup</h3>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "#64748b" }}>Hierarchical breakdown of all registered Labour Teams, Categories and Members.</p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            {teams.length === 0 ? (
              <div style={{ textAlign: "center", color: "#64748b", padding: "32px", fontSize: "13px" }}>
                No Labour Teams configured in the Master tab.
              </div>
            ) : (
              teams.map(team => {
                const cats = team.categories ? Object.values(team.categories) : [];
                return (
                  <div key={team.id} style={{ border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px", backgroundColor: "#f8fafc" }}>
                    <h4 style={{ margin: "0 0 12px 0", color: "#0f172a", fontWeight: "800", fontSize: "15px", borderBottom: "1px solid #e2e8f0", paddingBottom: "8px" }}>
                      {team.teamName}
                    </h4>
                    {cats.length === 0 ? (
                      <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "12px", margin: 0 }}>No categories registered inside this team.</p>
                    ) : (
                      <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                        {cats.map(cat => {
                          const membersList = cat.members ? Object.values(cat.members) : [];
                          return (
                            <div key={cat.id || cat.name} style={{ marginLeft: "8px", borderLeft: "2px solid #3b82f6", paddingLeft: "14px" }}>
                              <h5 style={{ margin: "0 0 8px 0", color: "#1e40af", fontWeight: "700", fontSize: "13.5px" }}>
                                {cat.name} <span style={{ fontSize: "11px", fontWeight: "600", color: "#64748b" }}>(Base Wage: ₹{cat.baseWage} / Cycle: {cat.paymentType})</span>
                              </h5>
                              {membersList.length === 0 ? (
                                <p style={{ color: "#64748b", fontStyle: "italic", fontSize: "11.5px", margin: 0 }}>No workers registered in this category.</p>
                              ) : (
                                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "10px" }}>
                                  {membersList.map(m => (
                                    <div key={m.memberId} style={{ padding: "8px 12px", borderRadius: "6px", backgroundColor: "#ffffff", border: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                                      <div style={{ display: "flex", flexDirection: "column" }}>
                                        <strong style={{ fontSize: "12px", color: "#0f172a" }}>{m.name}</strong>
                                        <span style={{ fontSize: "10.5px", fontFamily: "monospace", color: "#64748b" }}>ID: {m.memberId}</span>
                                      </div>
                                      <span style={{ fontSize: "12px", fontWeight: "800", color: "#16a34a", fontFamily: "monospace" }}>₹{m.salary}</span>
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

    const totalWagesOwed = siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.totalCost, 0);
    const totalPaidOut = siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.paidAmount, 0);
    const totalPendingBal = siteLabourFinancials.reduce((acc, curr) => acc + curr.stats.pendingAmount, 0);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Salary Summary Cards */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "16px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Wages Owed</span>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#0f172a", marginTop: "4px", fontFamily: "monospace" }}>
              ₹{totalWagesOwed.toLocaleString("en-IN")}
            </div>
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>Cumulative labour cost</span>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Paid Out</span>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#16a34a", marginTop: "4px", fontFamily: "monospace" }}>
              ₹{totalPaidOut.toLocaleString("en-IN")}
            </div>
            <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px", display: "block" }}>Total disbursements logged</span>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Pending Balance</span>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#ef4444", marginTop: "4px", fontFamily: "monospace" }}>
              ₹{totalPendingBal.toLocaleString("en-IN")}
            </div>
            <span style={{ fontSize: "11px", color: "#ef4444", marginTop: "4px", display: "block" }}>Unsettled labour balance</span>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 2fr", gap: "20px", alignItems: "start" }}>
          
          {/* Log Payment Form */}
          <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
            <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "14px" }}>Log Labour Salary Payment</div>
            <form onSubmit={handleLogPayment} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="pay-site" style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b" }}>Construction Site</label>
                <select
                  id="pay-site"
                  value={paymentSiteId}
                  onChange={(e) => setPaymentSiteId(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff", fontSize: "12.5px" }}
                >
                  {sites.map(s => (
                    <option key={s.id} value={s.id}>{s.siteName}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="pay-amount" style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b" }}>Amount (₹)</label>
                  <input
                    id="pay-amount"
                    type="number"
                    placeholder="e.g. 15000"
                    value={paymentAmount}
                    onChange={(e) => setPaymentAmount(e.target.value)}
                    style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                  />
                </div>

                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label htmlFor="pay-date" style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b" }}>Payment Date</label>
                  <input
                    id="pay-date"
                    type="date"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="pay-ref" style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b" }}>Reference / Receipt ID</label>
                <input
                  id="pay-ref"
                  type="text"
                  placeholder="e.g. TXN-1928374 or Cash"
                  value={paymentReference}
                  onChange={(e) => setPaymentReference(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label htmlFor="pay-notes" style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b" }}>Notes</label>
                <textarea
                  id="pay-notes"
                  placeholder="Details of payout..."
                  rows={2}
                  value={paymentNotes}
                  onChange={(e) => setPaymentNotes(e.target.value)}
                  style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", outline: "none", fontSize: "12.5px" }}
                />
              </div>

              <Button type="submit" icon={DollarSign} style={{ marginTop: "4px", backgroundColor: "#16a34a" }}>
                Log Payment
              </Button>
            </form>
          </Card>

          {/* Ledger Table & Payout Logs */}
          <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
            <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", overflow: "hidden" }}>
              <div style={{ padding: "14px 18px", borderBottom: "1px solid #e2e8f0", backgroundColor: "#f8fafc" }}>
                <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>Site-wise Salary Audit Ledger</h3>
              </div>
              <div style={{ overflowX: "auto" }}>
                <table className="modern-table" style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Site Name</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Wages Owed</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Paid Out</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", fontSize: "11px", fontWeight: "800", color: "#475569", textTransform: "uppercase" }}>Pending Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {siteLabourFinancials.map(({ site, stats }) => (
                      <tr key={site.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontSize: "12.5px", fontWeight: "700", color: "#0f172a" }}>{site.siteName}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", fontSize: "12.5px" }}>₹{stats.totalCost.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#16a34a", fontFamily: "monospace", fontSize: "12.5px", fontWeight: "700" }}>₹{stats.paidAmount.toLocaleString("en-IN")}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", color: "#ef4444", fontWeight: "700", fontFamily: "monospace", fontSize: "12.5px" }}>₹{stats.pendingAmount.toLocaleString("en-IN")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </Card>

            <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "18px 20px" }}>
              <div style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", marginBottom: "12px" }}>Payout Transaction History</div>
              {payments.length === 0 ? (
                <p style={{ color: "#64748b", fontStyle: "italic", textAlign: "center", fontSize: "12px", margin: 0 }}>No payout transactions recorded yet.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", maxHeight: "250px", overflowY: "auto" }}>
                  {payments.map((p, idx) => {
                    const site = sites.find(s => s.id === p.siteId) || { siteName: "Unknown Site" };
                    return (
                      <div key={p.id || idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px", fontSize: "12px" }}>
                        <div>
                          Paid <strong style={{ color: "#16a34a" }}>₹{p.amount?.toLocaleString("en-IN")}</strong> to <strong>{site.siteName}</strong>
                          <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Ref: {p.reference || "N/A"}</span>
                        </div>
                        <div style={{ textAlign: "right", fontSize: "10.5px", color: "#64748b" }}>
                          <span>{p.date}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          </div>

        </div>
      </div>
    );
  };

  // -------------------------------------------------------------
  // ATTENDANCE HISTORY TAB
  // -------------------------------------------------------------
  const renderAttendanceTab = () => {
    const filteredAttendance = allLabourAttendance.filter(r => {
      if (adminFilterSiteId && r.siteId !== adminFilterSiteId) return false;
      if (adminFilterDate && r.attendanceDate !== adminFilterDate) return false;
      if (adminFilterTeamId && r.teamId !== adminFilterTeamId) return false;
      return sites.some(s => s.id === r.siteId);
    });

    let totalFullDay = 0;
    let totalHalfDay = 0;
    let totalLabour = 0;
    let totalLabourCost = 0;

    filteredAttendance.forEach(r => {
      const count = Number(r.workerCount) || (r.workerName ? 1 : 0);
      const units = Number(r.customWorkUnits !== undefined ? r.customWorkUnits : (r.units !== undefined ? r.units : (r.attendanceType === "Half Day" ? 0.5 : 1.0))) || 1.0;
      const wage = Number(r.dailyWage || r.wage || 0);
      const cost = r.calculatedAmount !== undefined && r.calculatedAmount !== null ? Number(r.calculatedAmount) : (count * units * wage);

      if (r.attendanceType === "Full Day" || units >= 1) totalFullDay += count;
      else if (r.attendanceType === "Half Day" || units === 0.5) totalHalfDay += count;
      totalLabourCost += cost;
      totalLabour += count;
    });

    const getEntryTimeStr = (record) => {
      if (!record.createdAt) return "-";
      let dateObj = record.createdAt.seconds ? new Date(record.createdAt.seconds * 1000) : new Date(record.createdAt);
      if (isNaN(dateObj.getTime())) return "-";
      return dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* Dynamic Summary Stats Row */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "16px" }}>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Check-ins</span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", marginTop: "2px" }}>{totalLabour}</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", textTransform: "uppercase" }}>Full Day Shifts</span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#16a34a", marginTop: "2px" }}>{totalFullDay}</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#b45309", textTransform: "uppercase" }}>Half Day Shifts</span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#b45309", marginTop: "2px" }}>{totalHalfDay}</div>
          </div>
          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 18px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#2563eb", textTransform: "uppercase" }}>Calculated Cost</span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#2563eb", marginTop: "2px", fontFamily: "monospace" }}>₹{totalLabourCost.toLocaleString("en-IN")}</div>
          </div>
        </div>

        {/* Filter Controls Card */}
        <Card style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", padding: "16px 20px" }}>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr auto", gap: "12px", alignItems: "end" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Construction Site</label>
              <select
                value={adminFilterSiteId}
                onChange={(e) => setAdminFilterSiteId(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
              >
                <option value="">All Construction Sites</option>
                {sites.map(s => <option key={s.id} value={s.id}>{s.siteName}</option>)}
              </select>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Attendance Date</label>
              <input
                type="date"
                value={adminFilterDate}
                onChange={(e) => setAdminFilterDate(e.target.value)}
                style={{ padding: "7px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
              />
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "3px" }}>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "#64748b" }}>Labour Team</label>
              <select
                value={adminFilterTeamId}
                onChange={(e) => setAdminFilterTeamId(e.target.value)}
                style={{ padding: "8px 10px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12.5px" }}
              >
                <option value="">All Labour Teams</option>
                {teams.map(t => <option key={t.id} value={t.id}>{t.teamName}</option>)}
              </select>
            </div>

            {(adminFilterSiteId || adminFilterDate || adminFilterTeamId) && (
              <Button type="button" variant="outline" size="sm" onClick={() => { setAdminFilterSiteId(""); setAdminFilterDate(""); setAdminFilterTeamId(""); }}>
                Clear Filters
              </Button>
            )}
          </div>
        </Card>

        {/* Detailed Attendance Logs Grid */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>Detailed Attendance Logs</h3>
          
          {filteredAttendance.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px dashed #cbd5e1", color: "#64748b", fontSize: "12.5px" }}>
              No attendance logs found matching the selected filters.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: "14px" }}>
              {filteredAttendance.map((record, index) => {
                const site = sites.find(s => s.id === record.siteId) || { siteName: "Unknown Site" };
                const team = teams.find(t => t.id === record.teamId) || { teamName: "Unknown Team" };
                const workerCount = record.workerCount !== undefined ? record.workerCount : 1;

                return (
                  <div key={record.id || index} style={{ backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "14px", display: "flex", flexDirection: "column", gap: "8px", boxShadow: "0 2px 6px rgba(0,0,0,0.03)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>{site.siteName}</strong>
                      <span style={{ fontSize: "10.5px", fontWeight: "700", color: "#16a34a", backgroundColor: "#dcfce7", padding: "2px 8px", borderRadius: "100px" }}>
                        Present
                      </span>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11.5px", color: "#64748b" }}>
                      <span>Date: <strong>{record.attendanceDate}</strong></span>
                      <span>Time: {getEntryTimeStr(record)}</span>
                    </div>

                    <div style={{ fontSize: "12px", color: "#475569", borderTop: "1px solid #f1f5f9", paddingTop: "6px" }}>
                      Team: <strong style={{ color: "#0f172a" }}>{team.teamName}</strong>
                    </div>

                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "6px 10px", borderRadius: "6px", fontSize: "11.5px" }}>
                      <span style={{ color: "#64748b" }}>Worker Count</span>
                      <strong style={{ color: "#0f172a" }}>{workerCount} workers</strong>
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
      title="Labour Management"
      description="Define trade teams, assign workers to site checklists, and manage field payroll."
    >
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* ── TOP SUMMARY CARDS (EXACT 5 COMPACT CARDS) ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: "14px", marginBottom: "20px" }}>
        
        {/* Card 1: Total Labour Teams */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Teams</span>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#eff6ff", color: "#2563eb", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Users size={16} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{teams.length}</div>
          <span style={{ fontSize: "10.5px", color: "#64748b", marginTop: "6px", display: "block" }}>Trade labor groups</span>
        </div>

        {/* Card 2: Total Workers */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Workers</span>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <UserCheck size={16} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{workers.length}</div>
          <span style={{ fontSize: "10.5px", color: "#16a34a", marginTop: "6px", display: "block", fontWeight: "600" }}>Registered workforce</span>
        </div>

        {/* Card 3: Active Workers Today */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Active Today</span>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Activity size={16} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
            {allLabourAttendance.filter(r => r.attendanceDate === new Date().toISOString().split("T")[0]).length}
          </div>
          <span style={{ fontSize: "10.5px", color: "#ea580c", marginTop: "6px", display: "block", fontWeight: "600" }}>On-site active workers</span>
        </div>

        {/* Card 4: Pending Salary */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Pending Salary</span>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#fef2f2", color: "#ef4444", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <DollarSign size={16} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "20px", fontWeight: "800", color: "#ef4444", lineHeight: "1", fontFamily: "monospace" }}>
            ₹{sites.reduce((acc, site) => {
              const hist = allLabourHistory[site.id] || [];
              const stats = calculateLabourFinancials(site.id, hist, labourMaster.categories, payments);
              return acc + stats.pendingAmount;
            }, 0).toLocaleString("en-IN")}
          </div>
          <span style={{ fontSize: "10.5px", color: "#64748b", marginTop: "6px", display: "block" }}>Unsettled wages</span>
        </div>

        {/* Card 5: Attendance Today */}
        <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "14px 16px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Attendance Today</span>
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#f3e8ff", color: "#8b5cf6", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Calendar size={16} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
            {allLabourAttendance.filter(r => r.attendanceDate === new Date().toISOString().split("T")[0]).length}
          </div>
          <span style={{ fontSize: "10.5px", color: "#8b5cf6", marginTop: "6px", display: "block", fontWeight: "600" }}>Check-ins logged</span>
        </div>

      </div>

      {/* Sticky Tabs Navigation */}
      <div className="erp-tabs-list no-print" style={{ position: "sticky", top: "10px", zIndex: 90, backgroundColor: "#ffffff", border: "1px solid #e2e8f0", padding: "8px 12px", borderRadius: "12px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)", marginBottom: "20px" }}>
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
          <span style={{ verticalAlign: "middle" }}>Attendance</span>
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

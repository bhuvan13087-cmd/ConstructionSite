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
  deleteLabourMemberFromCategory
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
  X
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

    return (
      <div style={{ display: "grid", gridTemplateColumns: "1.2fr 2fr", gap: "24px", alignItems: "start" }}>
        
        {/* Left Column: Teams List & Creation */}
        <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
          <Card title="Labour Teams" subtitle="Group and manage labor workforces">
            <form onSubmit={handleCreateTeam} style={{ display: "flex", gap: "8px", marginBottom: "16px" }}>
              <input
                type="text"
                placeholder="New Team Name"
                value={newTeamName}
                onChange={(e) => setNewTeamName(e.target.value)}
                style={{ flex: 1, padding: "8px 12px", borderRadius: "6px", border: "1px solid var(--border-color)", outline: "none" }}
              />
              <Button type="submit" size="sm" style={{ backgroundColor: "var(--primary-800)" }}>
                <Plus size={16} />
              </Button>
            </form>

            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {teams.length === 0 ? (
                <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px", fontSize: "13px" }}>
                  No Labour Teams configured.
                </div>
              ) : (
                teams.map(team => {
                  const isSelected = selectedTeamId === team.id;
                  const isEditing = editingTeamId === team.id;

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
                        border: isSelected ? "2px solid var(--primary-600)" : "1px solid var(--border-color)",
                        backgroundColor: isSelected ? "var(--primary-50)" : "#ffffff",
                        cursor: "pointer",
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        transition: "all 0.2s ease"
                      }}
                    >
                      {isEditing ? (
                        <div style={{ display: "flex", gap: "6px", width: "100%", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                          <input
                            type="text"
                            value={editingTeamName}
                            onChange={(e) => setEditingTeamName(e.target.value)}
                            style={{ flex: 1, padding: "4px 8px", fontSize: "13px", border: "1px solid var(--border-color)", borderRadius: "4px" }}
                          />
                          <button
                            onClick={() => handleRenameTeam(team.id)}
                            style={{ background: "none", border: "none", color: "var(--success-600)", cursor: "pointer", padding: "4px" }}
                          >
                            <Save size={15} />
                          </button>
                          <button
                            onClick={() => {
                              setEditingTeamId(null);
                              setEditingTeamName("");
                            }}
                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "4px" }}
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: "flex", flexDirection: "column" }}>
                            <span style={{ fontWeight: "700", color: isSelected ? "var(--primary-900)" : "var(--text-main)" }}>
                              {team.teamName}
                            </span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                              {Object.keys(team.categories || {}).length} Categories
                            </span>
                          </div>
                          
                          <div style={{ display: "flex", gap: "6px" }} onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => {
                                setEditingTeamId(team.id);
                                setEditingTeamName(team.teamName);
                              }}
                              style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                            >
                              <Edit2 size={13} />
                            </button>
                            <button
                              onClick={() => handleDeleteTeam(team.id, team.teamName)}
                              style={{ background: "none", border: "none", color: "var(--danger-600)", cursor: "pointer", padding: "2px" }}
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
        </div>

        {/* Right Column: Categories and Members details */}
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          {selectedTeam ? (
            <>
              {/* Category configuration inside selected Team */}
              <Card 
                title={`Categories in "${selectedTeam.teamName}"`} 
                subtitle="Select a category to view/register members."
              >
                <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "20px", alignItems: "start" }}>
                  
                  {/* Category List */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                    {!selectedTeam.categories || Object.keys(selectedTeam.categories).length === 0 ? (
                      <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px", padding: "8px" }}>
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
                              borderRadius: "6px",
                              border: isCatSelected ? "1.5px solid var(--primary-600)" : "1px solid var(--border-color)",
                              backgroundColor: isCatSelected ? "var(--primary-50)" : "#fdfdfd",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center"
                            }}
                          >
                            <div style={{ display: "flex", flexDirection: "column" }}>
                              <span style={{ fontWeight: "700", fontSize: "13.5px" }}>{cat.name}</span>
                              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                                Cycle: {cat.paymentType} | Base: ₹{cat.baseWage}
                              </span>
                            </div>

                            <div style={{ display: "flex", gap: "8px", alignItems: "center" }} onClick={(e) => e.stopPropagation()}>
                              {isEditingCat ? (
                                <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
                                  <input
                                    type="number"
                                    value={editingWage}
                                    placeholder="Wage"
                                    onChange={(e) => setEditingWage(e.target.value)}
                                    style={{ width: "70px", padding: "4px 6px", fontSize: "12px", border: "1px solid var(--border-color)", borderRadius: "4px" }}
                                  />
                                  <button
                                    onClick={() => handleUpdateCategoryWage(catId)}
                                    style={{ background: "none", border: "none", color: "var(--success-600)", cursor: "pointer", padding: "2px" }}
                                  >
                                    <Save size={14} />
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingCatKey(null);
                                      setEditingWage("");
                                    }}
                                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
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
                                    style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer", padding: "2px" }}
                                  >
                                    <Edit2 size={12} />
                                  </button>
                                  <button
                                    onClick={() => handleDeleteCategoryFromTeam(catId, cat.name)}
                                    style={{ background: "none", border: "none", color: "var(--danger-600)", cursor: "pointer", padding: "2px" }}
                                  >
                                    <Trash2 size={12} />
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
                  <form onSubmit={handleAddCategory} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", borderLeft: "1px solid var(--border-color)" }}>
                    <h5 style={{ margin: 0, fontWeight: "800", color: "var(--primary-800)" }}>Add Category</h5>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700" }}>Category Label</label>
                      <input
                        type="text"
                        placeholder="e.g. Mason, Painter"
                        value={newCatName}
                        onChange={(e) => setNewCatName(e.target.value)}
                        style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", outline: "none", fontSize: "13px" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700" }}>Base Wage (₹)</label>
                      <input
                        type="number"
                        placeholder="e.g. 700"
                        value={newCatWage}
                        onChange={(e) => setNewCatWage(e.target.value)}
                        style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", outline: "none", fontSize: "13px" }}
                      />
                    </div>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "11px", fontWeight: "700" }}>Cycle Type</label>
                      <select
                        value={newCatType}
                        onChange={(e) => setNewCatType(e.target.value)}
                        style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", fontSize: "13px", backgroundColor: "#ffffff" }}
                      >
                        <option value="Daily">Daily</option>
                        <option value="Weekly">Weekly</option>
                        <option value="Monthly">Monthly</option>
                      </select>
                    </div>
                    <Button type="submit" size="sm" style={{ marginTop: "6px", backgroundColor: "var(--primary-800)" }}>
                      Add Category
                    </Button>
                  </form>
                </div>
              </Card>

              {/* Members configuration inside selected Category */}
              {selectedCategory ? (
                <Card 
                  title={`Members in "${selectedCategory.name}"`}
                  subtitle={`Manage registered team members`}
                >
                  <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "20px", alignItems: "start" }}>
                    
                    {/* Members List Table */}
                    <div style={{ overflowX: "auto" }}>
                      {!selectedCategory.members || Object.keys(selectedCategory.members).length === 0 ? (
                        <div style={{ color: "var(--text-muted)", fontStyle: "italic", fontSize: "13px", padding: "8px" }}>
                          No members registered in this category. Register one on the right.
                        </div>
                      ) : (
                        <table className="data-table" style={{ margin: 0 }}>
                          <thead>
                            <tr>
                              <th>ID</th>
                              <th>Name</th>
                              <th style={{ textAlign: "right" }}>Wage/Salary</th>
                              <th style={{ textAlign: "center" }}>Actions</th>
                            </tr>
                          </thead>
                          <tbody>
                            {Object.values(selectedCategory.members).map(member => {
                              const isEditingMem = editingMemberId === member.memberId;
                              return (
                                <tr key={member.memberId}>
                                  <td className="font-mono" style={{ fontSize: "12px" }}>{member.memberId}</td>
                                  <td>
                                    {isEditingMem ? (
                                      <input
                                        type="text"
                                        value={editingMemberName}
                                        onChange={(e) => setEditingMemberName(e.target.value)}
                                        style={{ width: "90px", padding: "4px", fontSize: "12px" }}
                                      />
                                    ) : (
                                      <span style={{ fontWeight: "700" }}>{member.name}</span>
                                    )}
                                  </td>
                                  <td style={{ textAlign: "right", fontFamily: "monospace" }}>
                                    {isEditingMem ? (
                                      <input
                                        type="number"
                                        value={editingMemberSalary}
                                        onChange={(e) => setEditingMemberSalary(e.target.value)}
                                        style={{ width: "70px", padding: "4px", fontSize: "12px", textAlign: "right" }}
                                      />
                                    ) : (
                                      `₹${member.salary}`
                                    )}
                                  </td>
                                  <td>
                                    <div style={{ display: "flex", gap: "6px", justifyContent: "center" }}>
                                      {isEditingMem ? (
                                        <>
                                          <button
                                            onClick={() => handleUpdateMember(member.memberId)}
                                            style={{ background: "none", border: "none", color: "var(--success-600)", cursor: "pointer" }}
                                          >
                                            <Save size={13} />
                                          </button>
                                          <button
                                            onClick={() => {
                                              setEditingMemberId(null);
                                              setEditingMemberName("");
                                              setEditingMemberSalary("");
                                            }}
                                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
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
                                            style={{ background: "none", border: "none", color: "var(--text-muted)", cursor: "pointer" }}
                                          >
                                            <Edit2 size={12} />
                                          </button>
                                          <button
                                            onClick={() => handleDeleteMember(member.memberId, member.name)}
                                            style={{ background: "none", border: "none", color: "var(--danger-600)", cursor: "pointer" }}
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
                    <form onSubmit={handleAddMember} style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "14px", borderLeft: "1px solid var(--border-color)" }}>
                      <h5 style={{ margin: 0, fontWeight: "800", color: "var(--primary-800)" }}>Register Member</h5>
                      
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700" }}>Labour Member ID</label>
                        <input
                          type="text"
                          placeholder="e.g. L001"
                          value={newMemberId}
                          onChange={(e) => setNewMemberId(e.target.value)}
                          style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", outline: "none", fontSize: "13px" }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700" }}>Full Name</label>
                        <input
                          type="text"
                          placeholder="e.g. Ramesh Kumar"
                          value={newMemberName}
                          onChange={(e) => setNewMemberName(e.target.value)}
                          style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", outline: "none", fontSize: "13px" }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "11px", fontWeight: "700" }}>Specific Wage/Salary (₹)</label>
                        <input
                          type="number"
                          placeholder={`Default: ${selectedCategory.baseWage}`}
                          value={newMemberSalary}
                          onChange={(e) => setNewMemberSalary(e.target.value)}
                          style={{ padding: "8px", borderRadius: "4px", border: "1px solid var(--border-color)", outline: "none", fontSize: "13px" }}
                        />
                      </div>

                      <Button type="submit" size="sm" icon={UserPlus} style={{ marginTop: "6px", backgroundColor: "var(--primary-800)" }}>
                        Register Member
                      </Button>
                    </form>
                  </div>
                </Card>
              ) : (
                <Card>
                  <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "16px", fontStyle: "italic", fontSize: "13px" }}>
                    Select a category from the card above to register or view its members.
                  </div>
                </Card>
              )}
            </>
          ) : (
            <Card>
              <div style={{ textAlign: "center", color: "var(--text-muted)", padding: "48px", fontSize: "14px", fontWeight: "600" }}>
                Please select a Labour Team from the left panel to configure its categories and workers.
              </div>
            </Card>
          )}
        </div>

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
      <div className="tab-menu" style={{ display: "flex", gap: "14px", borderBottom: "2px solid var(--border-color)", paddingBottom: "2px", marginBottom: "24px" }}>
        <button
          onClick={() => setActiveTab("master")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            fontWeight: "700",
            fontSize: "14px",
            color: activeTab === "master" ? "var(--primary-800)" : "var(--text-muted)",
            borderBottom: activeTab === "master" ? "3px solid var(--primary-800)" : "3px solid transparent",
            cursor: "pointer"
          }}
        >
          Labour Master
        </button>
        <button
          onClick={() => setActiveTab("assignments")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            fontWeight: "700",
            fontSize: "14px",
            color: activeTab === "assignments" ? "var(--primary-800)" : "var(--text-muted)",
            borderBottom: activeTab === "assignments" ? "3px solid var(--primary-800)" : "3px solid transparent",
            cursor: "pointer"
          }}
        >
          Labour Assignments
        </button>
        <button
          onClick={() => setActiveTab("salary")}
          style={{
            padding: "10px 18px",
            border: "none",
            background: "none",
            fontWeight: "700",
            fontSize: "14px",
            color: activeTab === "salary" ? "var(--primary-800)" : "var(--text-muted)",
            borderBottom: activeTab === "salary" ? "3px solid var(--primary-800)" : "3px solid transparent",
            cursor: "pointer"
          }}
        >
          Salary Management
        </button>
      </div>

      {activeTab === "master" && renderMasterTab()}
      {activeTab === "assignments" && renderAssignmentsTab()}
      {activeTab === "salary" && renderSalaryTab()}

      <Loading show={loading || submitting} text="Processing labour operations..." />
    </Layout>
  );
}

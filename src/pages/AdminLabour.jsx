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
  calculateLabourFinancials,
  formatINR,
  calculateTotalWorkers
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
  Search,
  Eye,
  Shield
} from "lucide-react";
import Button from "../components/common/Button";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Badge from "../components/common/Badge";
import { Modal } from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import ViewToggle from "../components/common/ViewToggle";
import AdminAssistedEntryModal from "../components/common/AdminAssistedEntryModal";
import { useAuth } from "../context/AuthContext";

export default function AdminLabour() {
  const { userProfile } = useAuth();
  const [showAdminEntryModal, setShowAdminEntryModal] = useState(false);
  
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
  
  // App states
  const [activeTab, setActiveTab] = useState("master"); // master, assignments, salary
  const [viewMode, setViewMode] = useState("grid");
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
  const totalWorkersCount = React.useMemo(() => calculateTotalWorkers(teams), [teams]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [newTeamName, setNewTeamName] = useState("");
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [editingTeamName, setEditingTeamName] = useState("");
  const [teamSearchQuery, setTeamSearchQuery] = useState("");

  // View Team Modal State
  const [showViewTeamModal, setShowViewTeamModal] = useState(false);
  const [viewingTeam, setViewingTeam] = useState(null);

  // Add Labour Sub-Modal State (inside View page)
  const [showAddLabourModal, setShowAddLabourModal] = useState(false);
  const [newLabourType, setNewLabourType] = useState("");
  const [newLabourWage, setNewLabourWage] = useState("750");
  const [newLabourCycle, setNewLabourCycle] = useState("Daily");

  // Edit Single Labour Entry Modal State (inside View Team modal)
  const [showEditLabourModal, setShowEditLabourModal] = useState(false);
  const [editingLabourCat, setEditingLabourCat] = useState(null);
  const [editLabourName, setEditLabourName] = useState("");
  const [editLabourWage, setEditLabourWage] = useState("750");
  const [editLabourCycle, setEditLabourCycle] = useState("Daily");

  // Dynamic live viewingTeam derivation synced with teams state
  const activeViewingTeam = viewingTeam ? (teams.find(t => t.id === viewingTeam.id) || viewingTeam) : null;

  // Create Team Modal State
  const [showCreateTeamModal, setShowCreateTeamModal] = useState(false);
  const [modalTeamName, setModalTeamName] = useState("");
  const [modalCategories, setModalCategories] = useState([
    { id: 1, name: "", amount: "750", paymentType: "Daily" }
  ]);

  // Edit Team Modal State
  const [showEditTeamModal, setShowEditTeamModal] = useState(false);
  const [editingTeam, setEditingTeam] = useState(null);
  const [editTeamName, setEditTeamName] = useState("");
  const [editCategories, setEditCategories] = useState([]);

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
            const membersObj = cat.members && typeof cat.members === "object" ? cat.members : {};
            const memberKeys = Object.keys(membersObj);
            if (memberKeys.length > 0) {
              memberKeys.forEach(memberId => {
                const mem = membersObj[memberId];
                flattenedWorkers.push({
                  id: mem.memberId || memberId,
                  workerName: mem.name,
                  category: cat.name,
                  categoryName: cat.name,
                  phoneNumber: mem.phoneNumber || "",
                  joiningDate: "--",
                  status: "active",
                  teamId: team.id,
                  teamName: team.teamName,
                  salary: mem.salary || cat.baseWage
                });
              });
            } else {
              flattenedWorkers.push({
                id: cat.id || catId,
                workerName: cat.name,
                category: cat.name,
                categoryName: cat.name,
                phoneNumber: "",
                joiningDate: "--",
                status: "active",
                teamId: team.id,
                teamName: team.teamName,
                salary: cat.baseWage
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
      // Deduplicate teamsList by ID to maintain single source of truth
      const uniqueMap = new Map();
      (teamsList || []).forEach(t => {
        if (t && t.id) uniqueMap.set(t.id, t);
      });
      const deduplicatedList = Array.from(uniqueMap.values());
      setTeams(deduplicatedList);
      
      // Update workers state when teams change in real-time
      const flattenedWorkers = [];
      teamsList.forEach(team => {
        if (team.categories) {
          Object.keys(team.categories).forEach(catId => {
            const cat = team.categories[catId];
            const membersObj = cat.members && typeof cat.members === "object" ? cat.members : {};
            const memberKeys = Object.keys(membersObj);
            if (memberKeys.length > 0) {
              memberKeys.forEach(memberId => {
                const mem = membersObj[memberId];
                flattenedWorkers.push({
                  id: mem.memberId || memberId,
                  workerName: mem.name,
                  category: cat.name,
                  categoryName: cat.name,
                  phoneNumber: mem.phoneNumber || "",
                  joiningDate: "--",
                  status: "active",
                  teamId: team.id,
                  teamName: team.teamName,
                  salary: mem.salary || cat.baseWage
                });
              });
            } else {
              flattenedWorkers.push({
                id: cat.id || catId,
                workerName: cat.name,
                category: cat.name,
                categoryName: cat.name,
                phoneNumber: "",
                joiningDate: "--",
                status: "active",
                teamId: team.id,
                teamName: team.teamName,
                salary: cat.baseWage
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

  const handleLogPayment = async (e) => {
    e.preventDefault();
    if (!paymentSiteId) {
      showToast("Please select a construction site.", "error");
      return;
    }
    const amt = Number(paymentAmount);
    if (isNaN(amt) || amt <= 0) {
      showToast("Please enter a valid payment amount.", "error");
      return;
    }
    setSubmitting(true);
    try {
      const adminId = userProfile?.uid || userProfile?.id || null;
      await saveLabourPayment({
        siteId: paymentSiteId,
        amount: amt,
        date: paymentDate,
        reference: paymentReference,
        notes: paymentNotes,
        loggedBy: userProfile?.fullName || "Admin"
      }, adminId);
      showToast("Labour payment logged successfully!", "success");
      setPaymentAmount("");
      setPaymentReference("");
      setPaymentNotes("");
      await loadData();
    } catch (err) {
      console.error("Error logging payment:", err);
      showToast(`Failed to log payment: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

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

  const handleCreateTeamModalSubmit = async (e) => {
    e.preventDefault();
    const nameClean = modalTeamName.trim();
    if (!nameClean) {
      showToast("Please enter a Team Name.", "error");
      return;
    }

    const validCategories = modalCategories.filter(c => c.name && c.name.trim().length > 0);
    if (validCategories.length === 0) {
      showToast("Please enter at least one Labour Type / Category.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const adminId = userProfile?.uid || userProfile?.id || null;
      // 1. Create Team in Firestore
      const teamId = await createLabourTeam(nameClean, adminId);
      
      // 2. Add each Category using unified addLabourCategoryToTeam helper
      for (const c of validCategories) {
        const catName = c.name.trim();
        const amountNum = Number(c.amount) || 750;
        const cycle = ["Daily", "Weekly", "Monthly"].includes(c.paymentType) ? c.paymentType : "Daily";

        await addLabourCategoryToTeam(teamId, {
          name: catName,
          baseWage: amountNum,
          paymentType: cycle
        });
      }

      showToast(`Labour Team "${nameClean}" created successfully!`, "success");
      setShowCreateTeamModal(false);
      setModalTeamName("");
      setModalCategories([{ id: Date.now(), name: "", amount: "750", paymentType: "Daily" }]);

      // 3. Authoritative re-fetch directly from Firestore (single source of truth)
      const freshTeams = await getLabourTeams(adminId);
      
      // Deduplicate by ID to guarantee single entry
      const uniqueMap = new Map();
      freshTeams.forEach(t => {
        if (t && t.id) uniqueMap.set(t.id, t);
      });
      const deduplicatedTeams = Array.from(uniqueMap.values());

      setTeams(deduplicatedTeams);

      // 4. Instantly open View Modal for the newly created team
      const freshCreatedTeam = deduplicatedTeams.find(t => t.id === teamId);
      if (freshCreatedTeam) {
        setViewingTeam(freshCreatedTeam);
        setShowViewTeamModal(true);
      }

    } catch (err) {
      showToast(`Failed to create team: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  // VIEW TEAM & ADD LABOUR HANDLERS
  const handleOpenViewModal = (team) => {
    setViewingTeam(team);
    setShowViewTeamModal(true);
  };

  const handleAddLabourToTeamSubmit = async (e) => {
    e.preventDefault();
    if (!activeViewingTeam) return;

    const typeClean = newLabourType.trim();
    if (!typeClean) {
      showToast("Please enter a Labour Type / Category.", "error");
      return;
    }

    const wageNum = Number(newLabourWage);
    if (isNaN(wageNum) || wageNum <= 0) {
      showToast("Please enter a valid Wage Amount.", "error");
      return;
    }

    const targetTeamId = activeViewingTeam.id;
    const cycle = ["Daily", "Weekly", "Monthly"].includes(newLabourCycle) ? newLabourCycle : "Daily";

    setSubmitting(true);
    try {
      // 1. Save to Firestore
      await addLabourCategoryToTeam(targetTeamId, {
        name: typeClean,
 baseWage: wageNum,
        paymentType: cycle
      });

      // 2. Optimistic local state update (0ms UI lag)
      const tempCatId = `cat_${Date.now()}`;
      const newCatObj = {
        id: tempCatId,
        name: typeClean,
        baseWage: wageNum,
        paymentType: cycle,
        members: {}
      };

      setTeams(prevTeams => prevTeams.map(t => {
        if (t.id === targetTeamId) {
          const updatedCategories = { ...(t.categories || {}), [tempCatId]: newCatObj };
          return { ...t, categories: updatedCategories };
        }
        return t;
      }));

      setViewingTeam(prev => {
        if (prev && prev.id === targetTeamId) {
          const updatedCategories = { ...(prev.categories || {}), [tempCatId]: newCatObj };
          return { ...prev, categories: updatedCategories };
        }
        return prev;
      });

      showToast(`Labour "${typeClean}" added to ${activeViewingTeam.teamName}!`, "success");
      setNewLabourType("");
      setNewLabourWage("750");
      setNewLabourCycle("Daily");
      setShowAddLabourModal(false);

      // 3. Authoritative re-fetch
      const adminId = userProfile?.uid || userProfile?.id || null;
      const fetchedTeams = await getLabourTeams(adminId);
      setTeams(fetchedTeams);
    } catch (err) {
      showToast(`Failed to add labour: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEditLabourModal = (teamId, catId, catVal) => {
    const nameVal = catVal.name || catId;
    const wageVal = String(catVal.baseWage || 750);
    const cycleVal = ["Daily", "Weekly", "Monthly"].includes(catVal.paymentType) ? catVal.paymentType : "Daily";

    setEditingLabourCat({
      teamId,
      catId,
      name: nameVal,
      baseWage: wageVal,
      paymentType: cycleVal
    });
    setEditLabourName(nameVal);
    setEditLabourWage(wageVal);
    setEditLabourCycle(cycleVal);
    setShowEditLabourModal(true);
  };

  const handleSaveEditLabourSubmit = async (e) => {
    e.preventDefault();
    if (!editingLabourCat) return;

    const nameClean = editLabourName.trim();
    if (!nameClean) {
      showToast("Please enter a Labour Type / Category.", "error");
      return;
    }

    const wageNum = Number(editLabourWage);
    if (isNaN(wageNum) || wageNum <= 0) {
      showToast("Please enter a valid wage amount greater than 0.", "error");
      return;
    }

    const cycle = ["Daily", "Weekly", "Monthly"].includes(editLabourCycle) ? editLabourCycle : "Daily";

    setSubmitting(true);
    try {
      const { teamId, catId } = editingLabourCat;

      // 1. Update in Firestore
      await updateLabourCategoryInTeam(teamId, catId, {
        name: nameClean,
        baseWage: wageNum,
        paymentType: cycle
      });

      // 2. Optimistic local state update
      setTeams(prevTeams => prevTeams.map(t => {
        if (t.id === teamId) {
          const currentCat = t.categories?.[catId] || {};
          const updatedCat = { ...currentCat, name: nameClean, baseWage: wageNum, paymentType: cycle };
          return { ...t, categories: { ...(t.categories || {}), [catId]: updatedCat } };
        }
        return t;
      }));

      setViewingTeam(prev => {
        if (prev && prev.id === teamId) {
          const currentCat = prev.categories?.[catId] || {};
          const updatedCat = { ...currentCat, name: nameClean, baseWage: wageNum, paymentType: cycle };
          return { ...prev, categories: { ...(prev.categories || {}), [catId]: updatedCat } };
        }
        return prev;
      });

      showToast(`Labour "${nameClean}" updated successfully!`, "success");
      setShowEditLabourModal(false);
      setEditingLabourCat(null);

      // 3. Authoritative re-fetch
      await loadData();
    } catch (err) {
      showToast(`Failed to update labour: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteCategoryInViewModal = async (catId, catName) => {
    if (!activeViewingTeam) return;
    showConfirmModal({
      title: "Delete Category Entry?",
      message: `Delete labour category "${catName}" from ${activeViewingTeam.teamName}?`,
      confirmText: "Delete Category",
      variant: "danger",
      onConfirm: async () => {
        const targetTeamId = activeViewingTeam.id;
        setSubmitting(true);
        try {
          await deleteLabourCategoryFromTeam(targetTeamId, catId);
          showToast(`Category "${catName}" deleted.`, "success");
          setTeams(prevTeams => prevTeams.map(t => {
            if (t.id === targetTeamId) {
              const updated = { ...(t.categories || {}) };
              delete updated[catId];
              return { ...t, categories: updated };
            }
            return t;
          }));

          setViewingTeam(prev => {
            if (prev && prev.id === targetTeamId) {
              const updated = { ...(prev.categories || {}) };
              delete updated[catId];
              return { ...prev, categories: updated };
            }
            return prev;
          });
          await loadData();
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          setSubmitting(false);
          closeConfirmModal();
        }
      }
    });
  };

  // EDIT TEAM MODAL HANDLERS
  const handleOpenEditModal = (team) => {
    setEditingTeam(team);
    setEditTeamName(team.teamName || "");

    const categoryList = [];
    if (team.categories) {
      Object.entries(team.categories).forEach(([catId, catVal]) => {
        categoryList.push({
          categoryId: catId,
          name: catVal.name || catId,
          amount: String(catVal.baseWage || 750),
          paymentType: ["Daily", "Weekly", "Monthly"].includes(catVal.paymentType) ? catVal.paymentType : "Daily",
          isNew: false
        });
      });
    }

    if (categoryList.length === 0) {
      categoryList.push({
        categoryId: `new_${Date.now()}`,
        name: "",
        amount: "750",
        paymentType: "Daily",
        isNew: true
      });
    }

    setEditCategories(categoryList);
    setShowEditTeamModal(true);
  };

  const handleSaveEditTeam = async (e) => {
    e.preventDefault();
    if (!editingTeam) return;
    const nameClean = editTeamName.trim();
    if (!nameClean) {
      showToast("Please enter a Team Name.", "error");
      return;
    }

    const validCategories = editCategories.filter(c => c.name && c.name.trim().length > 0);
    if (validCategories.length === 0) {
      showToast("Please enter at least one Labour Type / Category.", "error");
      return;
    }

    setSubmitting(true);
    try {
      const adminId = userProfile?.uid || userProfile?.id || null;
      // 1. Rename team if changed
      if (nameClean !== editingTeam.teamName) {
        await updateLabourTeam(editingTeam.id, nameClean, adminId);
      }

      // 2. Save or update categories
      for (const c of validCategories) {
        const catName = c.name.trim();
        const amountNum = Number(c.amount) || 750;
        const cycle = ["Daily", "Weekly", "Monthly"].includes(c.paymentType) ? c.paymentType : "Daily";

        const existingCategoryKey = editingTeam.categories
          ? Object.keys(editingTeam.categories).find(key => key === c.categoryId || (editingTeam.categories[key]?.name || "").toLowerCase() === catName.toLowerCase())
          : null;

        if (existingCategoryKey) {
          await updateLabourCategoryInTeam(editingTeam.id, existingCategoryKey, {
            baseWage: amountNum,
            paymentType: cycle
          });
        } else {
          await addLabourCategoryToTeam(editingTeam.id, {
            name: catName,
            baseWage: amountNum,
            paymentType: cycle
          });
        }
      }

      showToast(`Labour Team "${nameClean}" saved successfully!`, "success");
      setShowEditTeamModal(false);
      setEditingTeam(null);
      await loadData();
    } catch (err) {
      showToast(`Failed to update team: ${err.message}`, "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleRemoveCategoryInEditModal = async (index) => {
    const targetCat = editCategories[index];
    if (targetCat && targetCat.categoryId && !targetCat.isNew && editingTeam) {
      try {
        await deleteLabourCategoryFromTeam(editingTeam.id, targetCat.categoryId);
        showToast(`Category "${targetCat.name}" deleted.`, "info");
      } catch (err) {
        console.error("Error deleting category from Firestore:", err);
      }
    }
    setEditCategories(prev => prev.filter((_, idx) => idx !== index));
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
    showConfirmModal({
      title: "Delete Labour Team?",
      message: `Are you sure you want to permanently delete Team "${name}"?`,
      details: "This will remove all categories and members assigned to this team.",
      confirmText: "Delete Team",
      variant: "danger",
      onConfirm: async () => {
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
          closeConfirmModal();
        }
      }
    });
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
    showConfirmModal({
      title: "Delete Labour Category?",
      message: `Are you sure you want to permanently delete Category "${catName}"?`,
      details: "This will remove all members assigned to this category immediately.",
      confirmText: "Delete Category",
      variant: "danger",
      onConfirm: async () => {
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
          closeConfirmModal();
        }
      }
    });
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
    showConfirmModal({
      title: "Remove Member?",
      message: `Are you sure you want to delete member "${name}"?`,
      confirmText: "Remove Member",
      variant: "danger",
      onConfirm: async () => {
        setSubmitting(true);
        try {
          await deleteLabourMemberFromCategory(selectedTeamId, selectedCategoryId, memberId);
          showToast(`Member "${name}" removed.`, "success");
          await loadData();
        } catch (err) {
          showToast(err.message, "error");
        } finally {
          setSubmitting(false);
          closeConfirmModal();
        }
      }
    });
  };

  // -------------------------------------------------------------
  // RENDERS
  // -------------------------------------------------------------
  const renderMasterTab = () => {
    // Deduplicate teams by unique ID to prevent duplicate card rendering
    const uniqueTeamsMap = new Map();
    teams.forEach(t => {
      if (t && t.id) uniqueTeamsMap.set(t.id, t);
    });
    const uniqueTeams = Array.from(uniqueTeamsMap.values());

    // Filter teams by search
    const filteredTeams = uniqueTeams.filter(t => 
      t.teamName?.toLowerCase().includes(teamSearchQuery.toLowerCase().trim())
    );

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
        
        {/* HEADER SECTION */}
        <div style={{
          background: "#ffffff",
          border: "1px solid #e2e8f0",
          borderRadius: "12px",
          padding: "20px 24px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "16px"
        }}>
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <h2 style={{ fontSize: "20px", fontWeight: "800", color: "#0f172a", margin: 0, letterSpacing: "-0.3px" }}>Labour Teams</h2>
              <span style={{ backgroundColor: "#fff7ed", color: "#ea580c", fontSize: "11px", fontWeight: "700", padding: "3px 10px", borderRadius: "12px", border: "1px solid #ffedd5" }}>
                {teams.length} Registered Teams
              </span>
            </div>
            <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#64748b" }}>
              Manage trade workforce teams, assigned skill categories, daily amounts, and worker rosters.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <div style={{ position: "relative", minWidth: "200px" }}>
              <Search size={15} style={{ position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
              <input
                type="text"
                placeholder="Search teams..."
                value={teamSearchQuery}
                onChange={(e) => setTeamSearchQuery(e.target.value)}
                style={{ width: "100%", padding: "8px 10px 8px 32px", borderRadius: "8px", border: "1px solid #cbd5e1", fontSize: "12.5px", outline: "none" }}
              />
            </div>
            <ViewToggle viewMode={viewMode} onChange={setViewMode} />
            <Button
              onClick={() => setShowCreateTeamModal(true)}
              variant="primary"
              style={{ display: "flex", alignItems: "center", gap: "6px", padding: "9px 16px" }}
            >
              <Plus size={16} />
              <span>Create Team</span>
            </Button>
          </div>
        </div>

        {/* TEAM DISPLAY (GRID / NORMAL LIST) */}
        {filteredTeams.length === 0 ? (
          <Card style={{ padding: "48px 24px", textAlign: "center", color: "#64748b" }}>
            <Users size={36} style={{ color: "#94a3b8", marginBottom: "10px" }} />
            <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "700", color: "#0f172a" }}>No Labour Teams Found</h4>
            <p style={{ margin: "0 0 16px 0", fontSize: "13px" }}>Click "+ Create Team" to setup trade workforce teams.</p>
            <Button onClick={() => setShowCreateTeamModal(true)} variant="primary" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
              <Plus size={16} />
              <span>Create First Labour Team</span>
            </Button>
          </Card>
        ) : viewMode === "grid" ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "20px" }}>
            {filteredTeams.map((team) => {
              const categoriesCount = team.categories ? Object.keys(team.categories).length : 0;

              return (
                <div
                  key={team.id}
                  style={{
                    background: "#ffffff",
                    border: "1px solid #e2e8f0",
                    borderRadius: "12px",
                    padding: "20px",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    gap: "16px"
                  }}
                >
                  <div>
                    {/* Header: Team name & Status */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px", marginBottom: "12px" }}>
                      <div>
                        <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{team.teamName}</h3>
                        <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600", marginTop: "2px", display: "block" }}>
                          Trade Labour Team
                        </span>
                      </div>
                      <Badge status="active">Active</Badge>
                    </div>

                    {/* Stats summary badge outside */}
                    <div style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px 14px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px solid #f1f5f9" }}>
                      <Users size={18} style={{ color: "#ea580c" }} />
                      <div>
                        <span style={{ fontSize: "10.5px", textTransform: "uppercase", fontWeight: "700", color: "#64748b", display: "block" }}>Total Labour</span>
                        <strong style={{ fontSize: "14px", color: "#0f172a" }}>{categoriesCount} {categoriesCount === 1 ? "Category" : "Categories"}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Actions Bar */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", paddingTop: "14px", borderTop: "1px solid #f1f5f9" }}>
                    <div style={{ display: "flex", gap: "6px" }}>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenViewModal(team)}
                        style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <Eye size={13} />
                        <span>View</span>
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleOpenEditModal(team)}
                        style={{ fontSize: "12px", padding: "6px 12px", display: "inline-flex", alignItems: "center", gap: "4px" }}
                      >
                        <Edit2 size={13} />
                        <span>Edit</span>
                      </Button>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDeleteTeam(team.id, team.teamName)}
                      style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center", gap: "4px", fontSize: "12px", fontWeight: "600" }}
                      title="Delete team"
                    >
                      <Trash2 size={14} />
                      <span>Delete</span>
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        ) : (
          <div style={{
            background: "#ffffff",
            border: "1px solid var(--border-color)",
            borderRadius: "14px",
            overflow: "hidden",
            boxShadow: "var(--shadow-sm)"
          }}>
            <div style={{ overflowX: "auto" }}>
              <table className="data-table" style={{ width: "100%", borderCollapse: "collapse", minWidth: "600px" }}>
                <thead>
                  <tr style={{ background: "var(--primary-50)", borderBottom: "1px solid var(--border-color)" }}>
                    <th style={{ width: "35%", paddingLeft: "20px" }}>Labour Team</th>
                    <th style={{ width: "20%", textAlign: "center" }}>Status</th>
                    <th style={{ width: "25%", textAlign: "center" }}>Labour Categories</th>
                    <th style={{ width: "20%", textAlign: "right", paddingRight: "20px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredTeams.map((team) => {
                    const categoriesCount = team.categories ? Object.keys(team.categories).length : 0;
                    return (
                      <tr
                        key={team.id}
                        style={{ borderBottom: "1px solid #f1f5f9", transition: "background 0.12s ease" }}
                        onMouseEnter={e => e.currentTarget.style.backgroundColor = "#f8fafc"}
                        onMouseLeave={e => e.currentTarget.style.backgroundColor = "transparent"}
                      >
                        <td style={{ paddingLeft: "20px" }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                            <div style={{
                              width: "34px",
                              height: "34px",
                              borderRadius: "8px",
                              backgroundColor: "#fff7ed",
                              border: "1px solid #ffedd5",
                              color: "#c2410c",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontWeight: "800",
                              fontSize: "12px",
                              flexShrink: 0
                            }}>
                              <Users size={16} />
                            </div>
                            <div>
                              <div style={{ fontWeight: "700", fontSize: "13.5px", color: "#0f172a" }}>
                                {team.teamName}
                              </div>
                              <span style={{ fontSize: "11.5px", color: "#64748b" }}>Trade Labour Team</span>
                            </div>
                          </div>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <Badge status="active">Active</Badge>
                        </td>
                        <td style={{ textAlign: "center" }}>
                          <span style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "5px",
                            padding: "3px 10px",
                            borderRadius: "8px",
                            fontSize: "12px",
                            fontWeight: "700",
                            backgroundColor: "#fff7ed",
                            color: "#c2410c",
                            border: "1px solid #ffedd5"
                          }}>
                            {categoriesCount} {categoriesCount === 1 ? "Category" : "Categories"}
                          </span>
                        </td>
                        <td style={{ paddingRight: "20px", textAlign: "right" }}>
                          <div style={{ display: "inline-flex", alignItems: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenViewModal(team)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#2563eb",
                                cursor: "pointer",
                                padding: "4px 6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "12px",
                                fontWeight: "700",
                                transition: "transform 0.15s ease, color 0.15s ease",
                                outline: "none"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = "#1d4ed8"; e.currentTarget.style.transform = "scale(1.08)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "#2563eb"; e.currentTarget.style.transform = "scale(1)"; }}
                              title="View Team"
                            >
                              <Eye size={14} />
                              <span>View</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenEditModal(team)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#ea580c",
                                cursor: "pointer",
                                padding: "4px 6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "12px",
                                fontWeight: "700",
                                transition: "transform 0.15s ease, color 0.15s ease",
                                outline: "none"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = "#c2410c"; e.currentTarget.style.transform = "scale(1.08)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "#ea580c"; e.currentTarget.style.transform = "scale(1)"; }}
                              title="Edit Team"
                            >
                              <Edit2 size={14} />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteTeam(team.id, team.teamName)}
                              style={{
                                background: "transparent",
                                border: "none",
                                color: "#dc2626",
                                cursor: "pointer",
                                padding: "4px 6px",
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                fontSize: "12px",
                                fontWeight: "700",
                                transition: "transform 0.15s ease, color 0.15s ease",
                                outline: "none"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = "#b91c1c"; e.currentTarget.style.transform = "scale(1.08)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.transform = "scale(1)"; }}
                              title="Delete team"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ borderTop: "1px solid var(--border-color)", padding: "10px 20px", background: "#f8fafc" }}>
              <span style={{ fontSize: "11.5px", color: "var(--text-muted)", fontWeight: 600 }}>
                Showing {filteredTeams.length} of {teams.length} team{teams.length !== 1 ? "s" : ""}
              </span>
            </div>
          </div>
        )}

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
                            <div key={cat.id || cat.name} style={{ marginLeft: "8px", borderLeft: "2px solid #ea580c", paddingLeft: "14px" }}>
                              <h5 style={{ margin: "0 0 8px 0", color: "#c2410c", fontWeight: "700", fontSize: "13.5px" }}>
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
              {formatINR(totalWagesOwed)}
            </div>
            <span style={{ fontSize: "11px", color: "#64748b", marginTop: "4px", display: "block" }}>Cumulative labour cost</span>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Total Paid Out</span>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#16a34a", marginTop: "4px", fontFamily: "monospace" }}>
              {formatINR(totalPaidOut)}
            </div>
            <span style={{ fontSize: "11px", color: "#16a34a", marginTop: "4px", display: "block" }}>Total disbursements logged</span>
          </div>

          <div style={{ background: "#ffffff", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px 20px", boxShadow: "0 2px 8px rgba(0,0,0,0.04)" }}>
            <span style={{ fontSize: "11.5px", fontWeight: "700", color: "#64748b", textTransform: "uppercase" }}>Pending Balance</span>
            <div style={{ fontSize: "24px", fontWeight: "800", color: "#ef4444", marginTop: "4px", fontFamily: "monospace" }}>
              {formatINR(totalPendingBal)}
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
            <span style={{ fontSize: "11px", fontWeight: "700", color: "#ea580c", textTransform: "uppercase" }}>Calculated Cost</span>
            <div style={{ fontSize: "22px", fontWeight: "800", color: "#ea580c", marginTop: "2px", fontFamily: "monospace" }}>₹{totalLabourCost.toLocaleString("en-IN")}</div>
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
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "8px" }}>
            <h3 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>Detailed Attendance Logs</h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowAdminEntryModal(true)}
              style={{ display: "flex", alignItems: "center", gap: "6px", backgroundColor: "#eff6ff", borderColor: "#bfdbfe", color: "#1d4ed8", fontWeight: "750" }}
            >
              <Shield size={14} />
              <span>Add Entry for Engineer</span>
            </Button>
          </div>
          
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
                      <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                        <strong style={{ fontSize: "13.5px", color: "#0f172a" }}>{site.siteName}</strong>
                        {(record.isAdminEntry || record.createdVia === "admin_assisted_entry") && (
                          <span style={{ fontSize: "10px", fontWeight: "800", color: "#1d4ed8", backgroundColor: "#eff6ff", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bfdbfe" }} title={`Admin Override Entry by ${record.createdByName || "Admin"}`}>
                            🛡️ Admin Entry
                          </span>
                        )}
                      </div>
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
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyCenter: "center" }}>
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
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "flex", alignItems: "center", justifyContent: "center" }}>
              <UserCheck size={16} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>{totalWorkersCount}</div>
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
            <div style={{ width: "28px", height: "28px", borderRadius: "6px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyCenter: "center" }}>
              <Calendar size={16} style={{ margin: "auto" }} />
            </div>
          </div>
          <div style={{ fontSize: "22px", fontWeight: "800", color: "#0f172a", lineHeight: "1" }}>
            {allLabourAttendance.filter(r => r.attendanceDate === new Date().toISOString().split("T")[0]).length}
          </div>
          <span style={{ fontSize: "10.5px", color: "#ea580c", marginTop: "6px", display: "block", fontWeight: "600" }}>Check-ins logged</span>
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

      {/* ── VIEW LABOUR TEAM & ADD LABOUR MODAL ── */}
      <Modal
        isOpen={showViewTeamModal}
        onClose={() => {
          setShowViewTeamModal(false);
          setViewingTeam(null);
        }}
        title={activeViewingTeam ? `View Team: ${activeViewingTeam.teamName}` : "View Labour Team"}
        maxWidth="720px"
      >
        {activeViewingTeam && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
            
            {/* Header info & Add Labour action */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", backgroundColor: "#f8fafc", padding: "12px 16px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{activeViewingTeam.teamName}</h4>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                  {Object.keys(activeViewingTeam.categories || {}).length} Registered Labour Categories
                </span>
              </div>

              <Button
                type="button"
                variant="primary"
                size="sm"
                onClick={() => setShowAddLabourModal(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px", fontSize: "12.5px", padding: "7px 14px" }}
              >
                <Plus size={15} />
                <span>+ Add Labour</span>
              </Button>
            </div>

            {/* Read-Only Labour Table */}
            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxHeight: "360px", overflowY: "auto" }}>
              {!activeViewingTeam.categories || Object.keys(activeViewingTeam.categories).length === 0 ? (
                <div style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "13px" }}>
                  No labour entries configured for this team yet. Click <strong>"+ Add Labour"</strong> above to add entries.
                </div>
              ) : (
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12.5px" }}>
                  <thead>
                    <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                      <th style={{ padding: "10px 14px", textAlign: "left" }}>Labour Type / Category</th>
                      <th style={{ padding: "10px 14px", textAlign: "right", width: "140px" }}>Wage Amount (₹)</th>
                      <th style={{ padding: "10px 14px", textAlign: "left", width: "140px" }}>Payment Cycle</th>
                      <th style={{ padding: "10px 14px", textAlign: "center", width: "90px" }}>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(activeViewingTeam.categories).map(([catId, catVal]) => (
                      <tr key={catId} style={{ borderBottom: "1px solid #f1f5f9" }}>
                        <td style={{ padding: "10px 14px", fontWeight: "700", color: "#0f172a" }}>{catVal.name || catId}</td>
                        <td style={{ padding: "10px 14px", textAlign: "right", fontFamily: "monospace", color: "#16a34a", fontWeight: "800" }}>₹{catVal.baseWage || 750}</td>
                        <td style={{ padding: "10px 14px", color: "#475569", fontWeight: "600" }}>{catVal.paymentType || "Daily"}</td>
                        <td style={{ padding: "10px 14px", textAlign: "center" }}>
                          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "8px" }}>
                            <button
                              type="button"
                              onClick={() => handleOpenEditLabourModal(activeViewingTeam.id, catId, catVal)}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: "4px 6px",
                                cursor: "pointer",
                                color: "#ea580c",
                                display: "flex",
                                alignItems: "center",
                                transition: "transform 0.15s ease, color 0.15s ease",
                                outline: "none"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = "#c2410c"; e.currentTarget.style.transform = "scale(1.15)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "#ea580c"; e.currentTarget.style.transform = "scale(1)"; }}
                              title="Edit category entry"
                            >
                              <Edit2 size={15} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteCategoryInViewModal(catId, catVal.name || catId)}
                              style={{
                                background: "transparent",
                                border: "none",
                                padding: "4px 6px",
                                color: "#dc2626",
                                cursor: "pointer",
                                display: "flex",
                                alignItems: "center",
                                transition: "transform 0.15s ease, color 0.15s ease",
                                outline: "none"
                              }}
                              onMouseEnter={e => { e.currentTarget.style.color = "#b91c1c"; e.currentTarget.style.transform = "scale(1.15)"; }}
                              onMouseLeave={e => { e.currentTarget.style.color = "#dc2626"; e.currentTarget.style.transform = "scale(1)"; }}
                              title="Delete category entry"
                            >
                              <Trash2 size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Close Button */}
            <div style={{ display: "flex", justifyContent: "flex-end", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              <Button type="button" variant="outline" onClick={() => setShowViewTeamModal(false)}>Close</Button>
            </div>

          </div>
        )}
      </Modal>

      {/* ── ADD LABOUR SUB-MODAL (INSIDE VIEW) ── */}
      <Modal
        isOpen={showAddLabourModal}
        onClose={() => setShowAddLabourModal(false)}
        title={activeViewingTeam ? `Add Labour Entry to: ${activeViewingTeam.teamName}` : "Add Labour Entry"}
        maxWidth="500px"
      >
        <form onSubmit={handleAddLabourToTeamSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
          
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Labour Type / Category *</label>
            <input
              type="text"
              placeholder="e.g. Mason, Welder, Helper, Painter"
              value={newLabourType}
              onChange={(e) => setNewLabourType(e.target.value)}
              required
              style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Wage Amount (₹) *</label>
              <input
                type="number"
                placeholder="750"
                value={newLabourWage}
                onChange={(e) => setNewLabourWage(e.target.value)}
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
              />
            </div>

            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Payment Cycle *</label>
              <select
                value={newLabourCycle}
                onChange={(e) => setNewLabourCycle(e.target.value)}
                style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none", backgroundColor: "#ffffff" }}
              >
                <option value="Daily">Daily</option>
                <option value="Weekly">Weekly</option>
                <option value="Monthly">Monthly</option>
              </select>
            </div>
          </div>

          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
            <Button type="button" variant="outline" onClick={() => setShowAddLabourModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Saving..." : "Save Labour Entry"}
            </Button>
          </div>

        </form>
      </Modal>

      {/* ── EDIT SINGLE LABOUR SUB-MODAL (INSIDE VIEW) ── */}
      <Modal
        isOpen={showEditLabourModal && !!editingLabourCat}
        onClose={() => {
          setShowEditLabourModal(false);
          setEditingLabourCat(null);
        }}
        title={editingLabourCat ? `Edit Labour Entry: ${editingLabourCat.name}` : "Edit Labour Entry"}
        maxWidth="500px"
      >
        {editingLabourCat && (
          <form onSubmit={handleSaveEditLabourSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Labour Type / Category *</label>
              <input
                type="text"
                placeholder="e.g. Mason, Welder, Helper, Painter"
                value={editLabourName}
                onChange={(e) => setEditLabourName(e.target.value)}
                required
                style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Wage Amount (₹) *</label>
                <input
                  type="number"
                  placeholder="750"
                  value={editLabourWage}
                  onChange={(e) => setEditLabourWage(e.target.value)}
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
                />
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Payment Cycle *</label>
                <select
                  value={editLabourCycle}
                  onChange={(e) => setEditLabourCycle(e.target.value)}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none", backgroundColor: "#ffffff" }}
                >
                  <option value="Daily">Daily</option>
                  <option value="Weekly">Weekly</option>
                  <option value="Monthly">Monthly</option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              <Button type="button" variant="outline" onClick={() => {
                setShowEditLabourModal(false);
                setEditingLabourCat(null);
              }}>
                Cancel
              </Button>
              <Button type="submit" variant="primary" disabled={submitting}>
                {submitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        )}
      </Modal>

      {/* ── EDIT LABOUR TEAM MODAL (MODIFY EXISTING ENTRIES ONLY) ── */}
      <Modal
        isOpen={showEditTeamModal}
        onClose={() => {
          setShowEditTeamModal(false);
          setEditingTeam(null);
        }}
        title={editingTeam ? `Edit Team: ${editingTeam.teamName}` : "Edit Team"}
        maxWidth="680px"
      >
        {editingTeam && (
          <form onSubmit={handleSaveEditTeam} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
            
            {/* Header info & Team Name */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", gap: "16px" }}>
              <div style={{ flex: 1 }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Team Name *</label>
                <input
                  type="text"
                  placeholder="e.g. Bhuwan Team"
                  value={editTeamName}
                  onChange={(e) => setEditTeamName(e.target.value)}
                  required
                  style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
                />
              </div>

              <div style={{ backgroundColor: "#fff7ed", color: "#ea580c", padding: "8px 14px", borderRadius: "8px", border: "1px solid #ffedd5", textAlign: "center" }}>
                <span style={{ fontSize: "10.5px", textTransform: "uppercase", fontWeight: "700", display: "block" }}>Existing Entries</span>
                <strong style={{ fontSize: "16px" }}>{editCategories.filter(c => c.name && c.name.trim()).length} Entries</strong>
              </div>
            </div>

            {/* Labour Categories Table (Modify Existing Entries) */}
            <div>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "8px" }}>Modify Existing Labour Entries</label>

              <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxHeight: "320px", overflowY: "auto" }}>
                {editCategories.length === 0 ? (
                  <div style={{ padding: "24px", textAlign: "center", color: "#94a3b8", fontSize: "12.5px" }}>
                    No entries in this team.
                  </div>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                    <thead>
                      <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                        <th style={{ padding: "8px 12px", textAlign: "left" }}>Labour Type / Category *</th>
                        <th style={{ padding: "8px 12px", textAlign: "right", width: "130px" }}>Wage Amount (₹)</th>
                        <th style={{ padding: "8px 12px", textAlign: "left", width: "140px" }}>Payment Cycle</th>
                        <th style={{ padding: "8px 12px", textAlign: "center", width: "50px" }}></th>
                      </tr>
                    </thead>
                    <tbody>
                      {editCategories.map((c, idx) => (
                        <tr key={c.categoryId || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "6px 12px" }}>
                            <input
                              type="text"
                              placeholder="e.g. Mason, Helper"
                              value={c.name}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditCategories(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                            />
                          </td>
                          <td style={{ padding: "6px 12px" }}>
                            <input
                              type="number"
                              placeholder="750"
                              value={c.amount}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditCategories(prev => prev.map((item, i) => i === idx ? { ...item, amount: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", textAlign: "right" }}
                            />
                          </td>
                          <td style={{ padding: "6px 12px" }}>
                            <select
                              value={c.paymentType}
                              onChange={(e) => {
                                const val = e.target.value;
                                setEditCategories(prev => prev.map((item, i) => i === idx ? { ...item, paymentType: val } : item));
                              }}
                              style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff" }}
                            >
                              <option value="Daily">Daily</option>
                              <option value="Weekly">Weekly</option>
                              <option value="Monthly">Monthly</option>
                            </select>
                          </td>
                          <td style={{ padding: "6px 12px", textAlign: "center" }}>
                            <button
                              type="button"
                              onClick={() => handleRemoveCategoryInEditModal(idx)}
                              style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px" }}
                              title="Delete entry"
                            >
                              <Trash2 size={14} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
            </div>

            {/* Actions Footer */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
              <button
                type="button"
                onClick={() => {
                  handleDeleteTeam(editingTeam.id, editingTeam.teamName);
                  setShowEditTeamModal(false);
                }}
                style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", fontSize: "12.5px", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}
              >
                <Trash2 size={15} />
                <span>Delete Team</span>
              </button>

              <div style={{ display: "flex", gap: "10px" }}>
                <Button type="button" variant="outline" onClick={() => setShowEditTeamModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" disabled={submitting}>
                  {submitting ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            </div>

          </form>
        )}
      </Modal>

      {/* ── CREATE LABOUR TEAM MODAL ── */}
      <Modal
        isOpen={showCreateTeamModal}
        onClose={() => setShowCreateTeamModal(false)}
        title="Create New Labour Team"
        maxWidth="680px"
      >
        <form onSubmit={handleCreateTeamModalSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "10px 0" }}>
          
          {/* Team Name */}
          <div>
            <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Team Name *</label>
            <input
              type="text"
              placeholder="e.g. Bhuwan Team"
              value={modalTeamName}
              onChange={(e) => setModalTeamName(e.target.value)}
              required
              style={{ width: "100%", padding: "9px 12px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "13px", outline: "none" }}
            />
          </div>

          {/* Labour Entries List */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
              <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>Labour Entries & Wages</label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setModalCategories(prev => [
                    ...prev,
                    { id: Date.now(), name: "", amount: "750", paymentType: "Daily" }
                  ]);
                }}
                style={{ fontSize: "12px", padding: "4px 10px" }}
              >
                <Plus size={14} style={{ marginRight: "4px" }} /> Add Entry
              </Button>
            </div>

            <div style={{ border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", maxHeight: "280px", overflowY: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
                <thead>
                  <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                    <th style={{ padding: "8px 12px", textAlign: "left" }}>Labour Type / Category *</th>
                    <th style={{ padding: "8px 12px", textAlign: "right", width: "130px" }}>Wage Amount (₹)</th>
                    <th style={{ padding: "8px 12px", textAlign: "left", width: "140px" }}>Payment Cycle</th>
                    <th style={{ padding: "8px 12px", textAlign: "center", width: "40px" }}></th>
                  </tr>
                </thead>
                <tbody>
                  {modalCategories.map((c, idx) => (
                    <tr key={c.id || idx} style={{ borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          type="text"
                          placeholder="e.g. Mason, Woman Helper, Helper"
                          value={c.name}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModalCategories(prev => prev.map((item, i) => i === idx ? { ...item, name: val } : item));
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px" }}
                        />
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <input
                          type="number"
                          placeholder="750"
                          value={c.amount}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModalCategories(prev => prev.map((item, i) => i === idx ? { ...item, amount: val } : item));
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", textAlign: "right" }}
                        />
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <select
                          value={c.paymentType}
                          onChange={(e) => {
                            const val = e.target.value;
                            setModalCategories(prev => prev.map((item, i) => i === idx ? { ...item, paymentType: val } : item));
                          }}
                          style={{ width: "100%", padding: "6px 8px", borderRadius: "6px", border: "1px solid #cbd5e1", fontSize: "12px", backgroundColor: "#ffffff" }}
                        >
                          <option value="Daily">Daily</option>
                          <option value="Weekly">Weekly</option>
                          <option value="Monthly">Monthly</option>
                        </select>
                      </td>
                      <td style={{ padding: "6px 12px", textAlign: "center" }}>
                        {modalCategories.length > 1 && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalCategories(prev => prev.filter((_, i) => i !== idx));
                            }}
                            style={{ background: "transparent", border: "none", color: "#dc2626", cursor: "pointer", padding: "4px" }}
                            title="Remove entry"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Actions */}
          <div style={{ display: "flex", justifyContent: "flex-end", gap: "10px", marginTop: "12px", paddingTop: "12px", borderTop: "1px solid #e2e8f0" }}>
            <Button type="button" variant="outline" onClick={() => setShowCreateTeamModal(false)}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={submitting}>
              {submitting ? "Creating..." : "Create Team"}
            </Button>
          </div>

        </form>
      </Modal>

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />

      {showAdminEntryModal && (
        <AdminAssistedEntryModal
          isOpen={showAdminEntryModal}
          onClose={() => setShowAdminEntryModal(false)}
        />
      )}

    </Layout>
  );
}

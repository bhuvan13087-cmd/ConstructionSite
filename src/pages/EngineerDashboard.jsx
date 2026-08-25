import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  getSites,
  getAssignedSitesForEngineer, 
  getTodayAttendance,
  markAttendance,
  markCheckOut,
  saveSitePhoto,
  getSitePhotos,
  subscribePhotosForSite,
  saveDailyProgressReport,
  getDailyUpdatesForEngineer,
  calculateDistanceMeters,
  addMaterial,
  getMaterialsDetailed,
  saveLabourDailyCounts,
  getLabourDailyCounts,
  saveLabourMemberAttendance,
  getLabourMemberAttendance,
  getLabourTeams,
  subscribeLabourTeams,
  getLabourDailyCountsHistory,
  getLabourDailyEntries,
  saveLabourDailyEntries,
  subscribeLabourCategories,
  subscribeMaterialMaster,
  subscribeMaterialsDetailed,
  getMaterialTeams,
  subscribeMaterialTeams,
  getEngineerAttendanceAndLeaveStats,
  logEngineerLeave,
  getEngineerLeaves,
  deleteEngineerLeave,
  deleteMaterial,
  deleteLabourDailyCounts,
  deleteDailyProgressReport,
  updateSiteLocation,
  reverseGeocodeLatLng,
  getEngineerAttendanceHistory,
  updateEngineerPasswordInDb,
  getLabourMaster,
  getMaterialMaster,
  logMaterialUsage,
  getGeneralExpenses,
  subscribeGeneralExpenses,
  saveGeneralExpense,
  getLabourPayments,
  getLabourDailyCountsSummary,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
  saveLabourAttendanceRecord,
  deleteLabourAttendanceRecord,
  getLabourAttendanceRecords,
  subscribeLabourAttendanceRecords,
  getLabourLocksForSite,
  getAttendanceForSite,
  checkLabourSubmissionStatus,
  checkLabourDateSequenceStatus,
  submitLabourAttendance,
  markLabourNoWork,
  checkMaterialSubmissionStatus,
  saveBulkMaterialEntry,
  updateMaterial,
  transferMaterialBetweenSites,
  receiveMaterialTransfer,
  subscribeMaterialTransfersForSite,
  hasVerifiedAttendanceForDate,
  verifyEngineerAttendanceGate,
  subscribeTodayAttendance
} from "../services/firebaseService.js";
import { verifyTNLocation, verifySiteGeofence, hasPermission, getLabourDisplayName, processMaterialPaymentAndDelivery, getSiteExpenseLedger, formatINR, formatDateDMY } from "../services/businessLogic";
import { updateEngineerPasswordAuth } from "../firebase/auth";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import SelectWithOthers from "../components/common/SelectWithOthers";
import Modal from "../components/common/Modal";
import ConfirmationModal from "../components/common/ConfirmationModal";
import CivilEngineerLogo from "../components/common/CivilEngineerLogo";
import AttendanceGateBlockedCard from "../components/common/AttendanceGateBlockedCard";
import { 
  MapPin, 
  FileText, 
  CheckCircle2, 
  AlertCircle, 
  Phone, 
  Mail, 
  Shield, 
  Camera, 
  Upload, 
  Save, 
  X, 
  ClipboardCheck, 
  Percent, 
  Calendar, 
  AlertTriangle, 
  Package, 
  Users, 
  Search, 
  Plus, 
  Minus, 
  Trash2, 
  Clock, 
  Briefcase, 
  Sliders, 
  TrendingUp, 
  Activity, 
  ChevronRight, 
  LayoutDashboard, 
  LogOut, 
  HardHat, 
  Lock, 
  Eye, 
  EyeOff, 
  ArrowRightCircle, 
  ArrowLeftCircle, 
  DollarSign, 
  History, 
  Truck, 
  Layers, 
  Edit2, 
  Edit,
  ArrowRightLeft,
  Inbox,
  ChevronDown,
  ChevronUp,
  Check
} from "lucide-react";
import { useNavigate } from "react-router-dom";
import EXIF from "exif-js";

// Helper to read and parse EXIF GPS data and timestamps from images
const readPhotoMetadata = (file) => {
  return new Promise((resolve) => {
    if (!file) {
      resolve({ hasGps: false });
      return;
    }
    
    EXIF.getData(file, function() {
      const lat = EXIF.getTag(this, "GPSLatitude");
      const lon = EXIF.getTag(this, "GPSLongitude");
      const latRef = EXIF.getTag(this, "GPSLatitudeRef");
      const lonRef = EXIF.getTag(this, "GPSLongitudeRef");
      const dateTimeStr = EXIF.getTag(this, "DateTimeOriginal") || EXIF.getTag(this, "DateTime");

      if (!lat || !lon) {
        resolve({ hasGps: false });
        return;
      }

      // Convert DMS to DD
      const getVal = (val) => {
        if (typeof val === 'number') return val;
        if (val && typeof val === 'object') {
          if (val.numerator !== undefined && val.denominator !== undefined) {
            return val.denominator !== 0 ? val.numerator / val.denominator : 0;
          }
        }
        return parseFloat(val) || 0;
      };

      const convertDMSToDD = (dms, ref) => {
        if (!dms || dms.length < 3) return null;
        const d = getVal(dms[0]);
        const m = getVal(dms[1]);
        const s = getVal(dms[2]);
        let dd = d + m / 60 + s / 3600;
        if (ref === "S" || ref === "W") {
          dd = -dd;
        }
        return dd;
      };

      const decimalLat = convertDMSToDD(lat, latRef);
      const decimalLng = convertDMSToDD(lon, lonRef);
      
      let photoTime = null;
      if (dateTimeStr) {
        // Format YYYY:MM:DD HH:MM:SS
        const parts = dateTimeStr.split(" ");
        if (parts.length === 2) {
          const dateParts = parts[0].split(":");
          const timeParts = parts[1].split(":");
          if (dateParts.length === 3 && timeParts.length === 3) {
            photoTime = new Date(
              parseInt(dateParts[0], 10),
              parseInt(dateParts[1], 10) - 1,
              parseInt(dateParts[2], 10),
              parseInt(timeParts[0], 10),
              parseInt(timeParts[1], 10),
              parseInt(timeParts[2], 10)
            );
          }
        }
      }

      resolve({
        hasGps: true,
        lat: decimalLat,
        lng: decimalLng,
        timestamp: photoTime
      });
    });
  });
};

// Geocode and Address System utilities moved to firebaseService.js

export default function EngineerDashboard({ tab = "dashboard" }) {
  const { userProfile, logout, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const currentEngineerId = userProfile?.uid || userProfile?.id || "";
  
  // Loader & Toast states
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: "", type: "info" });
  
  // Database datasets
  const [assignedSites, setAssignedSites] = useState([]);
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [sitePhotos, setSitePhotos] = useState([]);
  const [dailyUpdates, setDailyUpdates] = useState([]);
  const [materials, setMaterials] = useState([]);
  const [labourMaster, setLabourMaster] = useState({ categories: {}, history: [] });
  const [activeSiteId, setActiveSiteId] = useState("");
  const [savedSiteLocation, setSavedSiteLocation] = useState(null);
  const [allSitesAttendance, setAllSitesAttendance] = useState([]);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  const [allSites, setAllSites] = useState([]);
  const [historyFilter, setHistoryFilter] = useState("this-week");
  const [customStartDate, setCustomStartDate] = useState(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split("T")[0]);
  const [customEndDate, setCustomEndDate] = useState(new Date().toISOString().split("T")[0]);
  const [selectedRecord, setSelectedRecord] = useState(null);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  
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

  // State to track pending return tab after completing attendance
  const [pendingUnlockTab, setPendingUnlockTab] = useState(null);

  // Memory Cache for unlocked Site + Engineer + Date combinations (Prevents re-locking within working session)
  const [unlockedGates, setUnlockedGates] = useState({});

  // Production Attendance Verification Gate Check for Site + Date + Engineer (Strict Engineer-Specific)
  const isAttendanceVerifiedForSiteAndDate = (siteId, dateStr) => {
    if (!currentEngineerId || !dateStr || !siteId) return false;
    const cleanSiteId = String(siteId).trim();
    const cleanDateStr = String(dateStr).trim();
    const cleanEngineerId = String(currentEngineerId).trim();
    if (!cleanSiteId || !cleanEngineerId || !cleanDateStr) return false;
    const gateKey = `${cleanSiteId}_${cleanEngineerId}_${cleanDateStr}`;

    const candidateEngIds = new Set([
      cleanEngineerId,
      userProfile?.uid,
      userProfile?.id,
      userProfile?.customId,
      userProfile?.engineerId
    ].filter(Boolean).map(String));

    // 1. Check in-memory unlocked cache for this exact Site + Engineer + Date
    if (unlockedGates[gateKey]) {
      return true;
    }

    // 2. Check todayAttendance if site, date, and engineer match and status is valid
    if (todayAttendance) {
      const todayDate = String(todayAttendance.date || todayAttendance.attendanceDate || "").trim();
      const todaySite = String(todayAttendance.siteId || "").trim();
      const todayEng = String(todayAttendance.engineerId || todayAttendance.userId || "").trim();
      if (todayDate === cleanDateStr && todaySite === cleanSiteId && todayEng && candidateEngIds.has(todayEng)) {
        if (todayAttendance.type !== "labour_attendance_lock" && !todayAttendance.id?.startsWith("labour_lock_")) {
          const isPresent = todayAttendance.status === "present" || todayAttendance.status === "checked_out" || todayAttendance.status === "verified";
          const isVerified = todayAttendance.verificationStatus === "verified" || todayAttendance.verificationStatus === "success" || isPresent || Boolean(todayAttendance.time && todayAttendance.time !== "--");
          const isNotRejected = todayAttendance.status !== "absent" && todayAttendance.status !== "rejected" && todayAttendance.status !== "cancelled" && todayAttendance.status !== "failed";
          if (isVerified && isNotRejected) {
            if (!unlockedGates[gateKey]) {
              setUnlockedGates(prev => ({ ...prev, [gateKey]: true }));
            }
            return true;
          }
        }
      }
    }

    // 3. Check allSitesAttendance (populated from canonical attendance collection)
    const match = (allSitesAttendance || []).find(r => {
      // Exclude labour submission locks
      if (r.type === "labour_attendance_lock" || (r.id && r.id.startsWith("labour_lock_"))) {
        return false;
      }
      const recDate = String(r.date || r.attendanceDate || "").trim();
      const recUser = String(r.engineerId || r.userId || "").trim();
      const recSite = String(r.siteId || "").trim();
      
      const isSameSite = recSite === cleanSiteId;
      const isSameDate = recDate === cleanDateStr;
      const isSameEng = recUser && candidateEngIds.has(recUser);
      const isPresent = r.status === "present" || r.status === "checked_out" || r.status === "verified";
      const isVerified = r.verificationStatus === "verified" || r.verificationStatus === "success" || isPresent || Boolean(r.time && r.time !== "--");
      const isNotRejected = r.status !== "absent" && r.status !== "rejected" && r.status !== "cancelled" && r.status !== "failed";
      return isSameSite && isSameDate && isSameEng && isVerified && isNotRejected;
    });

    if (match) {
      if (!unlockedGates[gateKey]) {
        setUnlockedGates(prev => ({ ...prev, [gateKey]: true }));
      }
      return true;
    }

    return false;
  };

  const handleOpenAttendanceGate = (targetSectionTab) => {
    setPendingUnlockTab(targetSectionTab);
    setAttendanceMode("checkin");
    handleResetVerification();
    navigate("/engineer/attendance");
  };
  
  const getLastAttendanceForSite = (siteId) => {
    if (!allSitesAttendance || allSitesAttendance.length === 0) {
      return "No attendance recorded";
    }
    const siteAtt = allSitesAttendance.filter(record => record.siteId === siteId);
    if (siteAtt.length === 0) {
      return "No attendance recorded";
    }
    // Sort by date (YYYY-MM-DD) descending
    siteAtt.sort((a, b) => b.date.localeCompare(a.date));
    const last = siteAtt[0];
    try {
      const dateObj = new Date(last.date);
      const formattedDate = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
      return `Last checked in: ${formattedDate}`;
    } catch (e) {
      return `Last checked in: ${last.date}`;
    }
  };

  const [showEngineerLocationSetupModal, setShowEngineerLocationSetupModal] = useState(false);
  const [engineerLocationSubmitting, setEngineerLocationSubmitting] = useState(false);
  const [engineerLocationError, setEngineerLocationError] = useState("");
  const [engineerRadius, setEngineerRadius] = useState("100");
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profileModalView, setProfileModalView] = useState("details"); // "details" or "changePassword"
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [passwordChangeLoading, setPasswordChangeLoading] = useState(false);
  const [passwordChangeError, setPasswordChangeError] = useState("");
  const [passwordChangeSuccess, setPasswordChangeSuccess] = useState("");

  // Personal stats & leaves states
  const [personalStats, setPersonalStats] = useState(null);
  const [loggedLeaves, setLoggedLeaves] = useState([]);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveReason, setLeaveReason] = useState("Personal Leave");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  const [showLeaveModal, setShowLeaveModal] = useState(false);
  
  const handleCloseLeaveModal = () => {
    setLeaveDate(new Date().toISOString().split("T")[0]);
    setLeaveReason("Personal Leave");
    setShowLeaveModal(false);
  };

  const handleCloseMaterialModal = () => {
    setMaterialName("");
    setMaterialCategory("Cement");
    setCustomMaterialCategory("");
    setMaterialQuantity("");
    setMaterialUnit("Bag");
    setMaterialUnitPrice(0);
    setMaterialSupplier("");
    setMaterialPurchaseDate(new Date().toISOString().split("T")[0]);
    setMaterialNotes("");
    setMaterialInvoiceFile(null);
    setMaterialInvoicePreview(null);
    setMaterialFlow("list");
    setMaterialStep(1);
  };
  
  // Mock GPS controls removed for production

  // Dynamic Labour Categories
  const [categories, setCategories] = useState([]);
  const [labourEntries, setLabourEntries] = useState([]);
  const [newCategoryName, setNewCategoryName] = useState("");

  // Synchronous submission refs to prevent rapid-click / 0ms double submissions
  const isMountedRef = useRef(true);
  const attendanceSubmittingRef = useRef(false);
  const bulkMaterialSubmittingRef = useRef(false);
  const labourSubmittingRef = useRef(false);
  const materialSubmittingRef = useRef(false);
  const photoSubmittingRef = useRef(false);
  const progressSubmittingRef = useRef(false);
  const expenseSubmittingRef = useRef(false);
  const savingResolvePendingRef = useRef(false);
  const savingTransferRef = useRef(false);
  const savingReceiveTransferRef = useRef(false);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Form inputs states
  // 1. Today's Attendance Check-in
  const [attendanceSubmitting, setAttendanceSubmitting] = useState(false);
  const [attendancePhotoFile, setAttendancePhotoFile] = useState(null);
  const [attendancePhotoPreview, setAttendancePhotoPreview] = useState(null);
  const [attendancePhotoUploaded, setAttendancePhotoUploaded] = useState(false);
  const [attendancePhotoUploading, setAttendancePhotoUploading] = useState(false);
  const [uploadedAttendancePhotoUrl, setUploadedAttendancePhotoUrl] = useState("");
  const [attendancePhotoLat, setAttendancePhotoLat] = useState(null);
  const [attendancePhotoLng, setAttendancePhotoLng] = useState(null);
  const [verificationStatus, setVerificationStatus] = useState(null); // null, "pending", "success", "failed"
  const [verificationDetails, setVerificationDetails] = useState(null);
  const [photoGpsLat, setPhotoGpsLat] = useState(null);
  const [photoGpsLng, setPhotoGpsLng] = useState(null);
  const [photoTimestamp, setPhotoTimestamp] = useState(null);
  const [photoAddress, setPhotoAddress] = useState("");
  const [locationCheckStatus, setLocationCheckStatus] = useState("unchecked"); // "unchecked", "checking", "warning", "granted"
  const [deviceCoords, setDeviceCoords] = useState(null); // { latitude, longitude }
  const [locationError, setLocationError] = useState("");
  const [attendanceMode, setAttendanceMode] = useState("checkin"); // "checkin" or "checkout"
  const [hasAutoChecked, setHasAutoChecked] = useState(false);
  const [notifications, setNotifications] = useState([]);

  // Camera WebRTC States
  const [cameraActive, setCameraActive] = useState(false);
  const [cameraFacingMode, setCameraFacingMode] = useState("user"); // "user" or "environment"
  const [cameraStream, setCameraStream] = useState(null);
  const [cameraError, setCameraError] = useState("");
  const videoRef = useRef(null);

  // 2. Daily Labour Counts
  const [labourDate, setLabourDate] = useState(new Date().toISOString().split("T")[0]);
  const [countsMap, setCountsMap] = useState({
    Mason: 0,
    Helper: 0,
    Electrician: 0,
    Plumber: 0,
    Painter: 0,
    Other: 0
  });
  const [labourHistory, setLabourHistory] = useState([]);
  const [labourHistoryLoading, setLabourHistoryLoading] = useState(false);
  const [labourSaving, setLabourSaving] = useState(false);
  const [showLabourSpecifyModal, setShowLabourSpecifyModal] = useState(false);
  const [labourSpecifyText, setLabourSpecifyText] = useState("");
  const [pendingLabourCount, setPendingLabourCount] = useState(1);
  const [labourTeams, setLabourTeams] = useState([]);
  const [selectedLabourTeamId, setSelectedLabourTeamId] = useState("");
  
  // Workforce submit and lock states (Site-Level Lock & Sequential Date Enforcement)
  const [lockedDates, setLockedDates] = useState(new Set());
  const [labourSubmitting, setLabourSubmitting] = useState(false);
  const [isLabourLocked, setIsLabourLocked] = useState(false);
  const [labourLockInfo, setLabourLockInfo] = useState(null);
  const [labourDateSequenceStatus, setLabourDateSequenceStatus] = useState({ allowed: true, status: "editable" });
  const isLabourSubmitted = isLabourLocked;
  const [attendanceRows, setAttendanceRows] = useState([]);
  const [labourHistoryRecords, setLabourHistoryRecords] = useState([]);
  const [activeWorkforceSubTab, setActiveWorkforceSubTab] = useState("new-entry"); // "new-entry" or "history"
  const [expandedDates, setExpandedDates] = useState([]);

  const fetchLabourLockStatus = async (teamId = selectedLabourTeamId) => {
    if (!activeSiteId || !labourDate) {
      setIsLabourLocked(false);
      setLabourLockInfo(null);
      setLabourDateSequenceStatus({ allowed: true, status: "editable" });
      return { submitted: false };
    }
    try {
      const [lockStatus, seqStatus] = await Promise.all([
        checkLabourSubmissionStatus(activeSiteId, labourDate, teamId),
        checkLabourDateSequenceStatus(activeSiteId, labourDate)
      ]);
      const isSubmitted = Boolean(lockStatus && lockStatus.submitted) || Boolean(seqStatus && seqStatus.status === "locked");
      if (isMountedRef.current) {
        setIsLabourLocked(isSubmitted);
        setLabourLockInfo(isSubmitted ? lockStatus : null);
        setLabourDateSequenceStatus(seqStatus || { allowed: !isSubmitted, status: isSubmitted ? "locked" : "editable" });
      }
      return lockStatus;
    } catch (err) {
      console.error("Error checking labour submission and sequence status:", err);
      if (isMountedRef.current) {
        setIsLabourLocked(false);
        setLabourLockInfo(null);
        setLabourDateSequenceStatus({ allowed: true, status: "editable" });
      }
      return { submitted: false };
    }
  };

  const loadLockedDates = async () => {
    if (!activeSiteId) {
      setLockedDates(new Set());
      return;
    }
    try {
      const records = await getLabourLocksForSite(activeSiteId);
      const locked = new Set();
      (records || []).forEach(r => {
        if (r.status === "submitted" || r.locked || r.submitted) {
          const d = r.date || r.attendanceDate;
          if (d) {
            locked.add(d);
            if (r.teamId) {
              locked.add(`${d}_${r.teamId}`);
            }
          }
        }
      });
      if (isMountedRef.current) {
        setLockedDates(locked);
      }
    } catch (err) {
      console.error("Failed to load locked dates:", err);
    }
  };

  useEffect(() => {
    loadLockedDates();
  }, [activeSiteId]);

  // Synchronize labour lock status whenever activeSite, date, or team changes
  useEffect(() => {
    if (activeSiteId && labourDate) {
      fetchLabourLockStatus(selectedLabourTeamId);
    }
  }, [activeSiteId, labourDate, selectedLabourTeamId]);
  const [editingRecordId, setEditingRecordId] = useState(null);
  const [editingName, setEditingName] = useState("");
  const [editingValue, setEditingValue] = useState(1.0);
  const [editingCount, setEditingCount] = useState(1);
  const [editingType, setEditingType] = useState("Full Day");
  const [attendanceSelections, setAttendanceSelections] = useState({});
  const [workUnitsSelections, setWorkUnitsSelections] = useState({});
  const [workModeSelections, setWorkModeSelections] = useState({});
  const [savingRecordKeys, setSavingRecordKeys] = useState({});
  const [expandedWorkerCategories, setExpandedWorkerCategories] = useState({});
  const [filterDate, setFilterDate] = useState("");
  const [filterDateMode, setFilterDateMode] = useState("This Month");
  const [filterTeamId, setFilterTeamId] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [filterSearch, setFilterSearch] = useState("");
  const [memberAttendanceUnits, setMemberAttendanceUnits] = useState({});

  // 3. Material Received fields
  const [materialName, setMaterialName] = useState("");
  const [materialCategory, setMaterialCategory] = useState("Cement");
  const [customMaterialCategory, setCustomMaterialCategory] = useState("");
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [materialUnit, setMaterialUnit] = useState("Bag");
  const [materialSupplier, setMaterialSupplier] = useState("");
  const [materialPurchaseDate, setMaterialPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [materialNotes, setMaterialNotes] = useState("");
  const [materialInvoiceFile, setMaterialInvoiceFile] = useState(null);
  const [materialInvoicePreview, setMaterialInvoicePreview] = useState(null);
  const [materialSubmitting, setMaterialSubmitting] = useState(false);
  const [materialUnitPrice, setMaterialUnitPrice] = useState(0);
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const comboboxRef = useRef(null);
  const [materialFlow, setMaterialFlow] = useState("list"); // "list" or "add"
  const [materialStep, setMaterialStep] = useState(1); // 1: category, 2: name, 3: details/invoice
  const [moreSubView, setMoreSubView] = useState("menu"); // "menu", "photos", "progress", "profile"
  
  // Material search & filter state
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialDateFilter, setMaterialDateFilter] = useState("");
  const [materialTabMode, setMaterialTabMode] = useState("entry"); // "entry" or "logs"

  // 4. Site Progress Photo fields
  const [sitePhotoFile, setSitePhotoFile] = useState(null);
  const [sitePhotoPreview, setSitePhotoPreview] = useState(null);
  const [photoSubmitting, setPhotoSubmitting] = useState(false);

  // 5. Daily Progress Log fields
  const [workDescription, setWorkDescription] = useState("");
  const [progressPercent, setProgressPercent] = useState(50);
  const [progressPhotoFile, setProgressPhotoFile] = useState(null);
  const [progressPhotoPreview, setProgressPhotoPreview] = useState(null);
  const [issuesText, setIssuesText] = useState("");
  const [notesText, setNotesText] = useState("");
  const [progressDate, setProgressDate] = useState(new Date().toISOString().split("T")[0]);
  const [currentlyRunning, setCurrentlyRunning] = useState("");
  const [materialsStatus, setMaterialsStatus] = useState("");
  const [pendingWork, setPendingWork] = useState("");
  const [nextActivity, setNextActivity] = useState("");
  const [progressSubmitting, setProgressSubmitting] = useState(false);

  // 6. Material Master, Teams & Consumption state variables
  const [materialMaster, setMaterialMaster] = useState([]);
  const [materialTeams, setMaterialTeams] = useState([]);
  const [selectedMaterialTeamId, setSelectedMaterialTeamId] = useState("");
  const [isMaterialTeamDropdownOpen, setIsMaterialTeamDropdownOpen] = useState(false);
  const materialTeamDropdownRef = useRef(null);
  const [materialUsageRows, setMaterialUsageRows] = useState([]);
  const [showDeliveryModal, setShowDeliveryModal] = useState(false);
  const [selectedMatDelivery, setSelectedMatDelivery] = useState(null);
  const [deliveryRecQty, setDeliveryRecQty] = useState("");
  const [deliverySupplierVal, setDeliverySupplierVal] = useState("");
  const [deliveryPhotoFile, setDeliveryPhotoFile] = useState(null);
  const [deliveryPhotoPreview, setDeliveryPhotoPreview] = useState("");

  const [showUsageModal, setShowUsageModal] = useState(false);
  const [selectedMatUsage, setSelectedMatUsage] = useState(null);
  const [usageQtyVal, setUsageQtyVal] = useState("");
  const [usageDateVal, setUsageDateVal] = useState(new Date().toISOString().split("T")[0]);
  const [usageNotesVal, setUsageNotesVal] = useState("");

  // Bulk Material Entry states
  const [bulkMaterialDate, setBulkMaterialDate] = useState(new Date().toISOString().split("T")[0]);
  const [bulkMaterialSubmitting, setBulkMaterialSubmitting] = useState(false);

  // Material Pending Tracking States
  const [showPendingModal, setShowPendingModal] = useState(false);
  const [pendingDate, setPendingDate] = useState(new Date().toISOString().split("T")[0]);
  const [pendingTeamId, setPendingTeamId] = useState("");
  const [pendingMaterialId, setPendingMaterialId] = useState("");
  const [pendingTotalQty, setPendingTotalQty] = useState("");
  const [pendingReceivedQty, setPendingReceivedQty] = useState("");
  const [pendingSupplier, setPendingSupplier] = useState("");
  const [pendingNotes, setPendingNotes] = useState("");
  const [savingPending, setSavingPending] = useState(false);

  // Material Pending Resolution States
  const [showResolvePendingModal, setShowResolvePendingModal] = useState(false);
  const [selectedPendingRecord, setSelectedPendingRecord] = useState(null);
  const [newlyReceivedQty, setNewlyReceivedQty] = useState("");
  const [savingResolvePending, setSavingResolvePending] = useState(false);

  // Material Row Details Modal State
  const [showMaterialDetailsModal, setShowMaterialDetailsModal] = useState(false);
  const [selectedMaterialForDetails, setSelectedMaterialForDetails] = useState(null);

  // Generic Custom Material Entry Modal States
  const [showCustomMaterialModal, setShowCustomMaterialModal] = useState(false);
  const [customMatName, setCustomMatName] = useState("");
  const [customMatAmount, setCustomMatAmount] = useState("");
  const [customMatNotes, setCustomMatNotes] = useState("");
  const [editingCustomRowId, setEditingCustomRowId] = useState(null);

  // Material Transfer States
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferMaterialId, setTransferMaterialId] = useState("");
  const [transferQuantity, setTransferQuantity] = useState("");
  const [transferDestSiteId, setTransferDestSiteId] = useState("");
  const [transferDate, setTransferDate] = useState(new Date().toISOString().split("T")[0]);
  const [transferNotes, setTransferNotes] = useState("");
  const [savingTransfer, setSavingTransfer] = useState(false);

  // Material Receive Transfer States
  const [showReceiveTransferModal, setShowReceiveTransferModal] = useState(false);
  const [selectedTransferForReceive, setSelectedTransferForReceive] = useState(null);
  const [receiveQuantity, setReceiveQuantity] = useState("");
  const [receiveDate, setReceiveDate] = useState(new Date().toISOString().split("T")[0]);
  const [receiveNotes, setReceiveNotes] = useState("");
  const [savingReceiveTransfer, setSavingReceiveTransfer] = useState(false);

  // Material Transfers List & Filter States
  const [siteTransfers, setSiteTransfers] = useState([]);
  const [transferFilterMode, setTransferFilterMode] = useState("all"); // "all" | "outgoing" | "incoming"

  // 7. General Expense states
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [labourPayments, setLabourPayments] = useState([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseCustomer, setExpenseCustomer] = useState("");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");
  const [expenseErrors, setExpenseErrors] = useState({});
  const [expenseSubmitting, setExpenseSubmitting] = useState(false);

  // Helper to trigger toast messages
  const showToast = (message, type = "info") => {
    setToast({ show: true, message, type });
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4500);
  };

  // Main loader for data sync
  const loadDashboardData = async () => {
    if (!userProfile) return;
    
    setLoading(true);
    try {
      const todayStr = new Date().toISOString().split("T")[0];
      const engineerId = userProfile.uid || userProfile.id || "";
      
      // Load assigned sites, all sites, personal engineer records, and attendance history in parallel
      const [
        filteredSites,
        sites,
        stats,
        leaves,
        history
      ] = await Promise.all([
        getAssignedSitesForEngineer(engineerId).catch(err => { console.error("Failed to load assigned sites:", err); return []; }),
        getSites().catch(err => { console.error("Failed to load all sites:", err); return []; }),
        getEngineerAttendanceAndLeaveStats(engineerId, userProfile.holidayAllowance || 24).catch(err => { console.error("Failed to load personal stats:", err); return null; }),
        getEngineerLeaves(engineerId).catch(err => { console.error("Failed to load leaves:", err); return []; }),
        getEngineerAttendanceHistory(engineerId).catch(err => { console.error("Failed to load attendance history:", err); return []; })
      ]);

      setAssignedSites(filteredSites);
      setAllSites(sites);
      if (stats) setPersonalStats(stats);
      setLoggedLeaves(leaves);
      setAllSitesAttendance(history);

      if (filteredSites.length > 0) {
        let currentActiveId = activeSiteId;
        if (filteredSites.length === 1) {
          currentActiveId = filteredSites[0].id;
          if (activeSiteId !== currentActiveId) setActiveSiteId(currentActiveId);
        } else if (!activeSiteId) {
          currentActiveId = filteredSites[0].id;
          setActiveSiteId(currentActiveId);
        } else {
          const isAssigned = filteredSites.some(s => s.id === activeSiteId);
          if (!isAssigned) {
            console.warn(`Unauthorized site access attempt: site ${activeSiteId} is not assigned to engineer ${engineerId}`);
            currentActiveId = filteredSites[0].id;
            setActiveSiteId(currentActiveId);
          }
        }

        // Fetch site-specific attendance and records concurrently in parallel for currentActiveId
        const [
          attendance,
          updates,
          siteMats,
          ge,
          lp,
          lh,
          lm,
          userNotifications
        ] = await Promise.all([
          getTodayAttendance(engineerId, todayStr, currentActiveId).catch(() => null),
          getDailyUpdatesForEngineer(engineerId, currentActiveId).catch(() => []),
          getMaterialsDetailed(currentActiveId).catch(() => []),
          getGeneralExpenses(currentActiveId).catch(() => []),
          getLabourPayments(currentActiveId).catch(() => []),
          getLabourDailyCountsSummary(currentActiveId).catch(() => []),
          getLabourMaster().catch(() => null),
          getNotifications(engineerId).catch(() => [])
        ]);

        setTodayAttendance(attendance || null);
        if (attendance && String(attendance.siteId || "").trim() === String(currentActiveId).trim()) {
          const unlockedKey = `${currentActiveId}_${engineerId}_${todayStr}`;
          setUnlockedGates(prev => ({
            ...prev,
            [unlockedKey]: true
          }));
        }

        setDailyUpdates(updates);
        setMaterials(siteMats);
        setGeneralExpenses(ge);
        setLabourPayments(lp);
        setLabourHistory(lh);
        if (lm) setLabourMaster(lm);
        setNotifications(userNotifications || []);
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [userProfile, activeSiteId]);

  // Fetch Existing Attendance Records for site + date + team
  useEffect(() => {
    if (!activeSiteId || !labourDate || !selectedLabourTeamId) {
      setAttendanceRows([]);
      return;
    }
    const fetchExistingRecords = async () => {
      try {
        setLabourHistoryLoading(true);
        const records = await getLabourAttendanceRecords(activeSiteId, labourDate, selectedLabourTeamId);
        const isSubmitted = (records || []).some(r => r.locked === true || r.status === "submitted" || r.submitted === true);
        if (isSubmitted && isMountedRef.current) {
          setIsLabourLocked(true);
        }
        const loadedRows = records.map(r => ({
          id: r.id,
          categoryId: r.categoryId,
          categoryName: r.categoryName || "",
          workerCount: r.workerCount !== undefined ? Number(r.workerCount) : 1,
          customWorkUnits: r.customWorkUnits !== undefined ? Number(r.customWorkUnits) : (r.units !== undefined ? Number(r.units) : 1.0),
          units: r.units !== undefined ? Number(r.units) : (r.customWorkUnits !== undefined ? Number(r.customWorkUnits) : 1.0),
          dailyWage: Number(r.dailyWage || r.wage || 0),
          workerEntries: Array.isArray(r.workerEntries) ? r.workerEntries : [],
          calculatedAmount: Number(r.calculatedAmount || r.totalAmount || 0),
          attendanceType: r.attendanceType || `${r.customWorkUnits || r.units || 1.0} Units`,
          dbId: r.id,
          isSaving: false,
          isSaved: true
        }));
        if (isMountedRef.current) {
          setAttendanceRows(loadedRows);
        }
      } catch (err) {
        console.error("Failed to load existing labour attendance records:", err);
        showToast("Error loading attendance: " + err.message, "error");
      } finally {
        if (isMountedRef.current) {
          setLabourHistoryLoading(false);
        }
      }
    };
    fetchExistingRecords();
  }, [activeSiteId, labourDate, selectedLabourTeamId]);

  useEffect(() => {
    if (!activeSiteId) {
      setLabourHistoryRecords([]);
      return;
    }
    const unsubscribe = subscribeLabourAttendanceRecords(activeSiteId, (records) => {
      if (isMountedRef.current) {
        setLabourHistoryRecords(records || []);
        if (labourDate && selectedLabourTeamId) {
          const teamRecords = (records || []).filter(r => 
            (r.attendanceDate === labourDate || r.date === labourDate) && 
            r.teamId === selectedLabourTeamId
          );
          if (teamRecords.some(r => r.locked === true || r.status === "submitted" || r.submitted === true)) {
            setIsLabourLocked(true);
          }
        }
      }
    });
    return () => unsubscribe();
  }, [activeSiteId, labourDate, selectedLabourTeamId]);

  useEffect(() => {
    if (!activeSiteId) {
      setLabourTeams([]);
      return;
    }
    
    // Subscribe to all company labour teams in real-time
    const unsubscribe = subscribeLabourTeams((teamsList) => {
      setLabourTeams(teamsList || []);
      // Preserve user-selected team only if it still exists; do NOT auto-select by default
      setSelectedLabourTeamId(prev => {
        if (!prev) return "";
        const exists = (teamsList || []).some(t => t.id === prev);
        return exists ? prev : "";
      });
    });
    
    return () => unsubscribe();
  }, [activeSiteId]);

  useEffect(() => {
    if (!activeSiteId) {
      setSitePhotos([]);
      return;
    }
    const unsubscribe = subscribePhotosForSite(activeSiteId, (photos) => {
      setSitePhotos(photos);
    });
    return () => unsubscribe();
  }, [activeSiteId]);

  // Load saved location for active site
  useEffect(() => {
    if (assignedSites && assignedSites.length > 0) {
      const site = assignedSites.find(s => s.id === activeSiteId) || assignedSites[0];
      if (site && site.latitude !== undefined && site.latitude !== null && site.longitude !== undefined && site.longitude !== null) {
        setSavedSiteLocation({
          latitude: site.latitude,
          longitude: site.longitude,
          address: site.location,
          accuracy: site.locationAccuracy || 0
        });
      } else {
        setSavedSiteLocation(null);
      }
    } else {
      setSavedSiteLocation(null);
    }
  }, [assignedSites, activeSiteId]);

  // Reset auto-check when active site changes
  useEffect(() => {
    setHasAutoChecked(false);
  }, [activeSiteId]);

  // Automatic Location Request when Attendance is opened
  useEffect(() => {
    const isMarkedForActiveSite = todayAttendance && String(todayAttendance.siteId || "").trim() === String(activeSiteId || "").trim();
    if (tab === "attendance" && activeSiteId && savedSiteLocation && !isMarkedForActiveSite && !hasAutoChecked) {
      setHasAutoChecked(true);
      handlePreCaptureCheck();
    }
  }, [tab, activeSiteId, savedSiteLocation, todayAttendance, hasAutoChecked]);

  // Clean up and reset verification state when navigating away from the attendance tab
  useEffect(() => {
    if (tab !== "attendance") {
      handleResetVerification();
      setAttendanceMode("checkin");
    }
  }, [tab]);

  // Close combobox suggestions when clicking outside
  useEffect(() => {
    function handleClickOutside(event) {
      if (comboboxRef.current && !comboboxRef.current.contains(event.target)) {
        setIsSuggestionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  // Sync sub-view under More tab with route parameter
  useEffect(() => {
    if (tab === "photos") {
      setMoreSubView("photos");
    } else if (tab === "progress") {
      setMoreSubView("progress");
    } else if (tab === "profile") {
      setMoreSubView("profile");
    } else {
      setMoreSubView("menu");
    }
  }, [tab]);

  // Subscribe to active categories and material master in real-time
  useEffect(() => {
    const unsubscribeLabour = subscribeLabourCategories((categoriesMap) => {
      const activeCats = Object.keys(categoriesMap)
        .filter(id => categoriesMap[id].status === "Active")
        .map(id => ({
          id,
          name: categoriesMap[id].name,
          wage: categoriesMap[id].wage,
          type: categoriesMap[id].type
        }));
      setCategories(activeCats);
    });

    const unsubscribeMatTeams = subscribeMaterialTeams((teamsList) => {
      setMaterialTeams(teamsList || []);
      // Keep materialMaster in sync for any legacy components
      const flat = [];
      (teamsList || []).forEach(t => {
        (t.materials || []).forEach(m => {
          flat.push({ ...m, category: t.name, teamId: t.id, teamName: t.name });
        });
      });
      setMaterialMaster(flat);
    });

    return () => {
      unsubscribeLabour();
      unsubscribeMatTeams();
    };
  }, []);

  // Real-time synchronization for engineer's daily attendance scoped by active site
  useEffect(() => {
    const engineerId = userProfile?.uid || userProfile?.id;
    if (!engineerId || !activeSiteId) return;
    const todayStr = new Date().toISOString().split("T")[0];

    const unsubscribe = subscribeTodayAttendance(engineerId, todayStr, (topRecord) => {
      if (topRecord && String(topRecord.siteId || "").trim() === String(activeSiteId).trim()) {
        setTodayAttendance(topRecord);
        const unlockedKey = `${activeSiteId}_${engineerId}_${todayStr}`;
        setUnlockedGates(prev => ({
          ...prev,
          [unlockedKey]: true
        }));
      } else {
        setTodayAttendance(null);
      }
    }, activeSiteId);

    return () => {
      if (typeof unsubscribe === "function") unsubscribe();
    };
  }, [userProfile, activeSiteId]);

  // Real-time synchronization for general expenses
  useEffect(() => {
    const unsubExpenses = subscribeGeneralExpenses((expensesList) => {
      if (expensesList && Array.isArray(expensesList)) {
        setGeneralExpenses(expensesList);
      }
    });
    return () => {
      if (typeof unsubExpenses === "function") unsubExpenses();
    };
  }, []);

  // Real-time synchronization for site materials logs
  useEffect(() => {
    if (!activeSiteId) return;
    const unsubSiteMats = subscribeMaterialsDetailed(activeSiteId, (siteMats) => {
      setMaterials(siteMats);
    });
    const unsubTransfers = subscribeMaterialTransfersForSite(activeSiteId, (txs) => {
      setSiteTransfers(txs || []);
    });
    return () => {
      unsubSiteMats();
      unsubTransfers();
    };
  }, [activeSiteId]);

  // Synchronize material usage rows with latest team master rates in real-time
  useEffect(() => {
    if (!selectedMaterialTeamId || materialTeams.length === 0) return;
    const team = materialTeams.find(t => t.id === selectedMaterialTeamId);
    if (!team) return;

    setMaterialUsageRows(prev => {
      if (prev.length === 0) {
        const activeMats = (team.materials || []).filter(m => m.status !== "Inactive");
        return activeMats.map(m => {
          const isCustom = m.type === "custom";
          const amt = Number(m.amount !== undefined ? m.amount : (m.rate !== undefined ? m.rate : m.unitPrice)) || 0;
          return {
            rowId: `row_${m.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            materialId: m.id,
            materialName: m.name,
            type: isCustom ? "custom" : "standard",
            unit: isCustom ? "" : (m.unit || "Bag"),
            rate: amt,
            amount: amt,
            quantity: isCustom ? 1 : ""
          };
        });
      }
      return prev.map(row => {
        const mat = (team.materials || []).find(m => m.id === row.materialId);
        if (mat) {
          const isCustom = mat.type === "custom";
          const amt = Number(mat.amount !== undefined ? mat.amount : (mat.rate !== undefined ? mat.rate : mat.unitPrice)) || 0;
          return {
            ...row,
            materialName: mat.name,
            type: isCustom ? "custom" : "standard",
            unit: isCustom ? "" : (mat.unit || "Bag"),
            rate: amt,
            amount: amt
          };
        }
        return row;
      });
    });
  }, [materialTeams, selectedMaterialTeamId]);

  // Close Material Team dropdown when tapping outside
  useEffect(() => {
    const handleMaterialTeamOutsideClick = (e) => {
      if (materialTeamDropdownRef.current && !materialTeamDropdownRef.current.contains(e.target)) {
        setIsMaterialTeamDropdownOpen(false);
      }
    };
    if (isMaterialTeamDropdownOpen) {
      document.addEventListener("mousedown", handleMaterialTeamOutsideClick);
      document.addEventListener("touchstart", handleMaterialTeamOutsideClick);
    }
    return () => {
      document.removeEventListener("mousedown", handleMaterialTeamOutsideClick);
      document.removeEventListener("touchstart", handleMaterialTeamOutsideClick);
    };
  }, [isMaterialTeamDropdownOpen]);

  // Check Labour Attendance submission status for selected site, date, and team
  useEffect(() => {
    let isCurrent = true;
    setIsLabourLocked(false);
    setLabourLockInfo(null);

    if (activeSiteId && labourDate && selectedLabourTeamId) {
      checkLabourSubmissionStatus(activeSiteId, labourDate, selectedLabourTeamId).then(lockStatus => {
        if (isCurrent) {
          const isSubmitted = Boolean(lockStatus && lockStatus.submitted);
          setIsLabourLocked(isSubmitted);
          setLabourLockInfo(isSubmitted ? lockStatus : null);
        }
      }).catch(err => {
        if (isCurrent) {
          console.error("Error checking labour submission status:", err);
          setIsLabourLocked(false);
          setLabourLockInfo(null);
        }
      });
    }

    return () => {
      isCurrent = false;
    };
  }, [activeSiteId, labourDate, selectedLabourTeamId]);

  // Sync labour entries & historical summary whenever active site or select date changes
  useEffect(() => {
    const fetchLabourDataAndHistory = async () => {
      if (!activeSiteId || !labourDate) return;
      setLabourHistoryLoading(true);
      try {
        const entries = await getLabourDailyEntries(activeSiteId, labourDate);
        setLabourEntries(entries);
        
        const hist = await getLabourDailyCountsHistory(activeSiteId);
        setLabourHistory(hist);
      } catch (err) {
        console.error("Labour statistics load error:", err);
      } finally {
        setLabourHistoryLoading(false);
      }
    };
    fetchLabourDataAndHistory();
  }, [activeSiteId, labourDate]);

  // Derive countsMap automatically from labourEntries
  useEffect(() => {
    const newCounts = {};
    categories.forEach(cat => {
      newCounts[cat.name] = 0;
    });
    labourEntries.forEach(entry => {
      const cat = categories.find(c => c.id === entry.categoryId);
      const catName = cat ? cat.name : (entry.categoryName || "Other");
      newCounts[catName] = (newCounts[catName] || 0) + 1;
    });
    setCountsMap(newCounts);
  }, [labourEntries, categories]);

  // Handle local photo files base64 parsing with automatic canvas compression
  const handleFileChange = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        showToast("Please upload an image file.", "error");
        return;
      }
      
      const reader = new FileReader();
      reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
          // Production constraints: max 1200px dimensions to prevent high storage bills
          const MAX_WIDTH = 1200;
          const MAX_HEIGHT = 1200;
          let width = img.width;
          let height = img.height;
          
          if (width > height) {
            if (width > MAX_WIDTH) {
              height = Math.round((height * MAX_WIDTH) / width);
              width = MAX_WIDTH;
            }
          } else {
            if (height > MAX_HEIGHT) {
              width = Math.round((width * MAX_HEIGHT) / height);
              height = MAX_HEIGHT;
            }
          }
          
          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          
          const compressedDataUrl = canvas.toDataURL("image/jpeg", 0.75);
          setPreview(compressedDataUrl);
          
          canvas.toBlob((blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: "image/jpeg",
                lastModified: Date.now()
              });
              setFile(compressedFile);
            } else {
              setFile(file);
            }
          }, "image/jpeg", 0.75);
        };
        img.src = event.target.result;
      };
      reader.readAsDataURL(file);
    }
  };

  const getDeviceLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation is not supported by your browser."));
        return;
      }

      let watchId = null;
      let bestPosition = null;
      
      const timeoutId = setTimeout(() => {
        if (watchId !== null) {
          navigator.geolocation.clearWatch(watchId);
        }
        if (bestPosition) {
          if (bestPosition.coords.accuracy <= 30) {
            resolve({
              latitude: bestPosition.coords.latitude,
              longitude: bestPosition.coords.longitude,
              accuracy: bestPosition.coords.accuracy
            });
          } else {
            reject(new Error(`GPS accuracy is poor (${Math.round(bestPosition.coords.accuracy)}m). Attendance requires high-accuracy GPS (<= 30m). Please stand in an open area and ensure precise location is enabled on your device.`));
          }
        } else {
          reject(new Error("Device GPS search timed out. Please ensure precise location services are enabled and active."));
        }
      }, 7000);

      watchId = navigator.geolocation.watchPosition(
        (position) => {
          // Check timestamp to verify it's a live GPS location
          const age = Date.now() - position.timestamp;
          if (age > 10000) {
            // Ignore cached positions older than 10 seconds
            return;
          }

          const { accuracy } = position.coords;
          
          if (!bestPosition || accuracy < bestPosition.coords.accuracy) {
            bestPosition = position;
          }
          
          // Target excellent accuracy (e.g. 15 meters or better) to resolve immediately
          if (accuracy <= 15) {
            clearTimeout(timeoutId);
            navigator.geolocation.clearWatch(watchId);
            resolve({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              accuracy: accuracy
            });
          }
        },
        (error) => {
          clearTimeout(timeoutId);
          if (watchId !== null) {
            navigator.geolocation.clearWatch(watchId);
          }
          let msg = "Unable to detect current location. Please enable GPS and try again.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied. Please reset browser location permissions and try again.";
          }
          const err = new Error(msg);
          err.code = error.code;
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 }
      );
    });
  };

  const handleSetSiteLocationClick = async () => {
    setEngineerLocationError("");
    setEngineerLocationSubmitting(true);
    
    try {
      const coords = await getDeviceLocation();
      const lat = coords.latitude;
      const lng = coords.longitude;
      const accuracy = coords.accuracy || 10;
      const engineerId = userProfile.uid || userProfile.id || "";
      const deviceDetails = navigator.userAgent || "Unknown Device";
      
      const geocode = await reverseGeocodeLatLng(lat, lng);
      const isValidTN = verifyTNLocation(lat, lng, geocode);
      
      if (!isValidTN) {
        setEngineerLocationError("Attendance allowed only inside Tamil Nadu location");
        setEngineerLocationSubmitting(false);
        return;
      }

      await updateSiteLocation(
        activeSiteId,
        lat,
        lng,
        geocode.fullAddress,
        accuracy,
        engineerId,
        deviceDetails,
        Number(engineerRadius) || 100,
        new Date().toISOString(),
        geocode.area || "",
        geocode.street || ""
      );
      
      await loadDashboardData();
      showToast("Location submitted for Admin approval", "success");
      setShowEngineerLocationSetupModal(false);
    } catch (err) {
      console.error("Save location error:", err);
      setEngineerLocationError(err.message || "Site Verification Failed");
    } finally {
      setEngineerLocationSubmitting(false);
    }
  };



  const handlePreCaptureCheck = async () => {
    setLocationError("");
    setLocationCheckStatus("checking");

    try {
      const coords = await getDeviceLocation();
      setDeviceCoords(coords);
      
      const site = assignedSites.find(s => s.id === activeSiteId);
      verifySiteLocation(coords, site);
    } catch (error) {
      console.warn("Location check failed:", error);
      setLocationCheckStatus("warning");
      setLocationError(error.message || "GPS Disabled");
    }
  };

  const handleEnableLocation = async () => {
    await handlePreCaptureCheck();
  };

  const verifySiteLocation = async (coords, site) => {
    if (!site) {
      setVerificationStatus("failed");
      setVerificationDetails({
        message: "Site Verification Failed",
        details: "No assigned site selected",
        isLocationConfigError: false
      });
      setLocationCheckStatus("granted");
      return;
    }

    // 1. Check if site assignment has saved location
    if (!savedSiteLocation) {
      setVerificationStatus("failed");
      setVerificationDetails({
        message: "Location Not Set",
        details: "Site location is not configured. Setup required.",
        isLocationConfigError: true
      });
      setLocationCheckStatus("granted");
      return;
    }

    // 2. Check if device location is available
    if (!coords || coords.latitude === undefined || coords.latitude === null) {
      setVerificationStatus("failed");
      setVerificationDetails({
        message: "GPS Disabled",
        details: "Please turn ON device location",
        isLocationConfigError: false
      });
      setLocationError("GPS Disabled");
      setLocationCheckStatus("warning");
      return;
    }

    const lat = coords.latitude;
    const lng = coords.longitude;

    try {
      // 3. State Validation (Tamil Nadu, India) - Local coordinates verification to avoid Nominatim network call overhead
      const geocode = {
        fullAddress: `Lat: ${lat.toFixed(6)}, Lng: ${lng.toFixed(6)}`,
        state: "Tamil Nadu",
        country: "India"
      };
      const isValidTN = verifyTNLocation(lat, lng, geocode);

      if (!isValidTN) {
        setVerificationStatus("failed");
        setVerificationDetails({
          message: "Outside Tamil Nadu",
          details: "Attendance allowed only inside Tamil Nadu location",
          isLocationConfigError: false
        });
        setLocationCheckStatus("granted");
        return;
      }

      // 4. Geofence Validation - strictly 50 meters for Phase 7
      const geofenceResult = verifySiteGeofence(coords, savedSiteLocation, 50);

      if (geofenceResult.status === "success") {
        setVerificationStatus("success");
        setVerificationDetails({
          message: "Site Verified Successfully",
          expectedSiteName: site.siteName,
          expectedAddress: savedSiteLocation.address || site.location,
          capturedAddress: geocode.fullAddress,
          distance: geofenceResult.distance
        });
      } else {
        setVerificationStatus("failed");
        setVerificationDetails({
          message: geofenceResult.message,
          details: geofenceResult.details,
          expectedSiteName: site.siteName,
          expectedAddress: savedSiteLocation.address || site.location,
          capturedAddress: geocode.fullAddress,
          distance: geofenceResult.distance,
          allowedRadius: geofenceResult.allowedRadius
        });
      }
      setLocationCheckStatus("granted");
    } catch (err) {
      console.error("Verification logic exception:", err);
      setVerificationStatus("failed");
      setVerificationDetails({
        message: "Site Verification Failed",
        details: "An error occurred during verification",
        isLocationConfigError: false
      });
      setLocationCheckStatus("granted");
    }
  };

  const handleResetVerification = () => {
    stopWebRTCCamera();
    setAttendancePhotoFile(null);
    setAttendancePhotoPreview(null);
    setVerificationStatus(null);
    setVerificationDetails(null);
    setPhotoGpsLat(null);
    setPhotoGpsLng(null);
    setPhotoTimestamp(null);
    setPhotoAddress("");
    setLocationCheckStatus("unchecked");
    setDeviceCoords(null);
    setAttendanceMode("checkin");
  };

  const startWebRTCCamera = async (facingMode) => {
    setCameraError("");
    setCameraActive(true);
    setCameraFacingMode(facingMode);

    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
    }

    try {
      const constraints = {
        video: {
          facingMode: facingMode === "user" ? "user" : "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      };
      
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      setCameraStream(stream);
      
      setTimeout(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      }, 100);
    } catch (err) {
      console.error("WebRTC camera stream access failed:", err);
      setCameraError("Camera Permission Required");
    }
  };

  const toggleCameraFacingMode = () => {
    const newFacingMode = cameraFacingMode === "user" ? "environment" : "user";
    startWebRTCCamera(newFacingMode);
  };

  const stopWebRTCCamera = () => {
    if (cameraStream) {
      cameraStream.getTracks().forEach(track => track.stop());
      setCameraStream(null);
    }
    setCameraActive(false);
    setCameraError("");
  };

  const capturePhotoFromStream = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth || 640;
    canvas.height = video.videoHeight || 480;
    const ctx = canvas.getContext("2d");
    
    if (cameraFacingMode === "user") {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const compressedBase64 = canvas.toDataURL("image/jpeg", 0.7);
    
    setAttendancePhotoPreview(compressedBase64);
    stopWebRTCCamera();
  };

  const handleMarkAttendance = async (e) => {
    if (e) e.preventDefault();
    if (attendanceSubmitting || attendanceSubmittingRef.current) return;
    if (!activeSiteId) {
      showToast("Please select your active site.", "error");
      return;
    }
    if (verificationStatus !== "success" || !attendancePhotoPreview) {
      showToast("Verification is required before marking attendance.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === activeSiteId);
    if (!site) {
      showToast("Active site check failed.", "error");
      return;
    }

    const todayStr = new Date().toISOString().split("T")[0];
    attendanceSubmittingRef.current = true;
    setAttendanceSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      if (!deviceCoords || deviceCoords.latitude === undefined || deviceCoords.latitude === null) {
        showToast("Please enable location access", "error");
        if (isMountedRef.current) setAttendanceSubmitting(false);
        attendanceSubmittingRef.current = false;
        return;
      }
      const lat = deviceCoords.latitude;
      const lng = deviceCoords.longitude;
      const accuracy = deviceCoords.accuracy || 10;
      const distance = verificationDetails?.distance !== undefined ? verificationDetails.distance : null;

      await saveSitePhoto(engineerId, activeSiteId, attendancePhotoPreview, lat, lng, "Attendance");

      const res = await markAttendance(
        engineerId, 
        activeSiteId, 
        todayStr, 
        lat, 
        lng, 
        accuracy,
        verificationDetails?.capturedAddress || "",
        attendancePhotoPreview, 
        "verified",
        distance
      );
      showToast(`Checked in present at ${site.siteName}!`, "success");

      const unlockedKey = `${activeSiteId}_${engineerId}_${todayStr}`;
      if (isMountedRef.current) {
        setUnlockedGates(prev => ({ ...prev, [unlockedKey]: true }));
        if (res) setTodayAttendance(res);
        handleResetVerification();
      }

      await loadDashboardData();

      if (pendingUnlockTab) {
        const destTab = pendingUnlockTab;
        if (isMountedRef.current) setPendingUnlockTab(null);
        navigate(`/engineer/${destTab}`);
      }
    } catch (err) {
      console.error("Mark attendance error:", err);
      showToast(err.message || "Failed to complete attendance transaction.", "error");
    } finally {
      attendanceSubmittingRef.current = false;
      if (isMountedRef.current) {
        setAttendanceSubmitting(false);
      }
    }
  };

  const handleMarkNotificationRead = async (id) => {
    try {
      await markNotificationAsRead(id);
      const engineerId = userProfile.uid || userProfile.id || "";
      const userNotifications = await getNotifications(engineerId);
      setNotifications(userNotifications || []);
    } catch (e) {
      console.error("Failed to dismiss notification:", e);
    }
  };

  // Log Leave Handler
  const handleLogLeave = async (e) => {
    e.preventDefault();
    if (!leaveDate) {
      showToast("Please choose leave date.", "error");
      return;
    }
    const engineerId = userProfile.uid || userProfile.id || "";
    
    // Safety check: Cannot log leave if checked present on that date
    try {
      const checkInExist = await getTodayAttendance(engineerId, leaveDate);
      if (checkInExist) {
        showToast("Cannot log leave: You checked in present on this date.", "error");
        return;
      }
    } catch (err) {
      console.warn("Attendance validation check failed:", err);
    }

    setLeaveSubmitting(true);
    try {
      await logEngineerLeave(engineerId, leaveDate, leaveReason.trim());
      showToast(`Leave registered successfully for ${leaveDate}!`, "success");
      
      // Refresh statistics and leaves
      await loadDashboardData();
      handleCloseLeaveModal();
    } catch (err) {
      console.error("Leave logging failed:", err);
      showToast(err.message || "Failed to log leave.", "error");
    } finally {
      setLeaveSubmitting(false);
    }
  };

  // Cancel / Delete Leave Handler
  const handleDeleteLeave = async (leaveId) => {
    showConfirmModal({
      title: "Cancel Leave Request?",
      message: "Are you sure you want to cancel this leave record?",
      confirmText: "Cancel Leave",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteEngineerLeave(leaveId);
          showToast("Deleted successfully", "success");
          await loadDashboardData();
        } catch (err) {
          console.error("Failed to cancel leave:", err);
          showToast("Failed to cancel leave: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  // Change Password Handler for Site Engineer
  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setPasswordChangeError("");
    setPasswordChangeSuccess("");

    if (!currentPassword) {
      setPasswordChangeError("Current password is required.");
      return;
    }
    if (newPassword.length < 6) {
      setPasswordChangeError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setPasswordChangeError("New passwords do not match.");
      return;
    }

    setPasswordChangeLoading(true);
    try {
      const email = userProfile.email;
      const uid = userProfile.uid || userProfile.id;

      // 1. Verify current password and update in Auth
      await updateEngineerPasswordAuth(email, currentPassword, newPassword);

      // 2. Clear any plaintext passwords in Firestore profile (and update timestamp)
      await updateEngineerPasswordInDb(uid, newPassword);

      setPasswordChangeSuccess("Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmNewPassword("");
      showToast("Password updated successfully.", "success");
      
      // Auto return to profile details after 2 seconds
      setTimeout(() => {
        setProfileModalView("details");
        setPasswordChangeSuccess("");
      }, 2000);

    } catch (err) {
      console.error("Password change failed:", err);
      let errMsg = "Failed to change password. Please check your current password.";
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        errMsg = "Incorrect current password.";
      } else if (err.message) {
        errMsg = err.message;
      }
      setPasswordChangeError(errMsg);
    } finally {
      setPasswordChangeLoading(false);
    }
  };

  // Delete Material Entry Handler
  const handleDeleteMaterial = async (materialId) => {
    const mObj = materials.find(m => m.id === materialId);
    if (!mObj) return;
    if (mObj.engineerId !== currentEngineerId) {
      showToast("Security error: You can only delete your own records.", "error");
      return;
    }
    showConfirmModal({
      title: "Delete Material Entry?",
      message: "Are you sure you want to delete this material log?",
      confirmText: "Delete Log",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteMaterial(materialId);
          showToast("Deleted successfully", "success");
          await loadDashboardData();
        } catch (err) {
          console.error("Failed to delete material:", err);
          showToast("Failed to delete: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  // Delete Labour Counts Log Handler
  const handleDeleteLabourLog = async (dateStr) => {
    const historyRow = labourHistory.find(h => h.date === dateStr);
    if (!historyRow) return;
    if (historyRow.engineerId && historyRow.engineerId !== currentEngineerId) {
      showToast("Security error: You can only delete your own records.", "error");
      return;
    }
    showConfirmModal({
      title: "Delete Labour Record?",
      message: `Are you sure you want to delete labour count logs for ${dateStr}?`,
      confirmText: "Delete Entries",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteLabourDailyCounts(activeSiteId, dateStr);
          showToast("Deleted successfully", "success");
          const hist = await getLabourDailyCountsHistory(activeSiteId);
          setLabourHistory(hist);
          await loadDashboardData();
        } catch (err) {
          console.error("Failed to delete labour counts:", err);
          showToast("Failed to delete: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  // Delete Progress DPR Log Handler
  const handleDeleteProgressLog = async (reportId) => {
    const report = dailyUpdates.find(r => r.id === reportId);
    if (!report) return;
    if (report.engineerId !== currentEngineerId) {
      showToast("Security error: You can only delete your own records.", "error");
      return;
    }
    showConfirmModal({
      title: "Delete Daily Progress Report?",
      message: "Are you sure you want to delete this progress report?",
      confirmText: "Delete Report",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteDailyProgressReport(reportId);
          showToast("Deleted successfully", "success");
          await loadDashboardData();
        } catch (err) {
          console.error("Failed to delete progress report:", err);
          showToast("Failed to delete: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  // Toggle individual worker custom durations panel per category
  const toggleExpandWorkerCategory = (categoryId) => {
    setExpandedWorkerCategories(prev => ({
      ...prev,
      [categoryId]: !prev[categoryId]
    }));
  };

  // Count-based worker attendance handlers with custom work units & daily wage
  const handleCountChange = async (categoryId, customUnitsVal, increment) => {
    if (isLabourSubmitted) {
      const isSubByMe = Boolean(userProfile && (labourLockInfo?.submittedBy === currentEngineerId || labourLockInfo?.submittedBy === userProfile?.uid || labourLockInfo?.submittedBy === userProfile?.id));
      const msg = isSubByMe
        ? "Cannot modify count: You have already submitted and locked attendance for this date."
        : `Cannot modify count: Attendance for this site on this date was already submitted by ${labourLockInfo?.submittedByName || "another engineer"}.`;
      showToast(msg, "error");
      return;
    }
    if (labourDateSequenceStatus && !labourDateSequenceStatus.allowed) {
      showToast(labourDateSequenceStatus.message || "Please submit the previous pending date first.", "warning");
      return;
    }

    const key = `${categoryId}`;
    if (savingRecordKeys[key]) return; // Synchronous guard per category

    const units = Math.max(0.01, Number(customUnitsVal) || 1.0);
    const selectedTeamObj = labourTeams.find(t => t.id === selectedLabourTeamId);
    const teamName = selectedTeamObj?.name || selectedTeamObj?.teamName || "Labour Team";
    const cat = categories.find(c => c.id === categoryId) || (selectedTeamObj?.categories ? (Array.isArray(selectedTeamObj.categories) ? selectedTeamObj.categories.find(c => c.id === categoryId) : (selectedTeamObj.categories[categoryId] || Object.values(selectedTeamObj.categories).find(c => c.id === categoryId))) : null);
    const dailyWage = Number(cat?.wage || cat?.salaryAmount || cat?.baseWage || 0);

    const record = attendanceRows.find(r => r.categoryId === categoryId);
    const currentCount = record ? Number(record.workerCount) || 0 : 0;
    const newCount = Math.max(0, currentCount + increment);

    if (newCount === currentCount) return;

    setSavingRecordKeys(prev => ({ ...prev, [key]: true }));

    try {
      if (newCount === 0) {
        if (record && record.dbId) {
          await deleteLabourAttendanceRecord(record.dbId);
        }
        if (isMountedRef.current) {
          setAttendanceRows(prev => prev.filter(r => r.categoryId !== categoryId));
        }
      } else {
        const registeredMembers = cat?.members ? (Array.isArray(cat.members) ? cat.members : Object.values(cat.members)) : [];
        let updatedWorkerEntries = [];
        if (record && Array.isArray(record.workerEntries) && record.workerEntries.length > 0) {
          if (newCount < record.workerEntries.length) {
            updatedWorkerEntries = record.workerEntries.slice(0, newCount);
          } else if (newCount > record.workerEntries.length) {
            updatedWorkerEntries = [...record.workerEntries];
            for (let i = record.workerEntries.length; i < newCount; i++) {
              const memberObj = registeredMembers[i];
              updatedWorkerEntries.push({
                workerId: memberObj?.memberId || memberObj?.id || `worker_${i + 1}`,
                workerName: memberObj?.name || `${cat?.name || "Worker"} ${i + 1}`,
                customWorkUnits: units,
                units: units,
                dailyWage,
                wage: dailyWage,
                calculatedAmount: units * dailyWage
              });
            }
          } else {
            updatedWorkerEntries = record.workerEntries;
          }
        }

        const calculatedAmount = updatedWorkerEntries.length > 0
          ? updatedWorkerEntries.reduce((sum, w) => sum + (Number(w.calculatedAmount) || (w.units * w.wage)), 0)
          : (newCount * units * dailyWage);

        const dbId = await saveLabourAttendanceRecord(record?.dbId || null, {
          siteId: activeSiteId,
          teamId: selectedLabourTeamId,
          teamName,
          categoryId,
          categoryName: cat?.name || "",
          attendanceDate: labourDate,
          workerCount: newCount,
          customWorkUnits: units,
          units: units,
          dailyWage,
          wage: dailyWage,
          workerEntries: updatedWorkerEntries,
          calculatedAmount,
          attendanceType: updatedWorkerEntries.length > 0 ? `${newCount} Workers (Custom Units)` : `${units} Units`,
          createdBy: currentEngineerId
        });

        if (isMountedRef.current) {
          setAttendanceRows(prev => {
            const exists = prev.some(r => r.categoryId === categoryId);
            if (exists) {
              return prev.map(r => r.categoryId === categoryId ? { ...r, workerCount: newCount, customWorkUnits: units, units, dailyWage, workerEntries: updatedWorkerEntries, calculatedAmount, dbId, isSaved: true } : r);
            } else {
              return [...prev, { id: dbId, categoryId, categoryName: cat?.name || "", workerCount: newCount, customWorkUnits: units, units, dailyWage, workerEntries: updatedWorkerEntries, calculatedAmount, dbId, isSaved: true }];
            }
          });
        }
      }
    } catch (err) {
      console.error("Failed to sync attendance count:", err);
      showToast("Sync failed: " + err.message, "error");
    } finally {
      if (isMountedRef.current) {
        setSavingRecordKeys(prev => ({ ...prev, [key]: false }));
      }
    }
  };

  const handleWorkUnitsChange = async (categoryId, newUnitsStr) => {
    if (isLabourSubmitted) {
      const isSubByMe = Boolean(userProfile && (labourLockInfo?.submittedBy === currentEngineerId || labourLockInfo?.submittedBy === userProfile?.uid || labourLockInfo?.submittedBy === userProfile?.id));
      const msg = isSubByMe
        ? "Cannot modify work units: You have already submitted and locked attendance for this date."
        : `Cannot modify work units: Attendance for this site on this date was already submitted by ${labourLockInfo?.submittedByName || "another engineer"}.`;
      showToast(msg, "error");
      return;
    }
    if (labourDateSequenceStatus && !labourDateSequenceStatus.allowed) {
      showToast(labourDateSequenceStatus.message || "Please submit the previous pending date first.", "warning");
      return;
    }
    const units = Math.max(0.01, Number(newUnitsStr) || 1.0);
    setWorkUnitsSelections(prev => ({ ...prev, [categoryId]: newUnitsStr }));

    const record = attendanceRows.find(r => r.categoryId === categoryId);
    if (record && record.workerCount > 0) {
      const selectedTeamObj = labourTeams.find(t => t.id === selectedLabourTeamId);
      const teamName = selectedTeamObj?.name || selectedTeamObj?.teamName || "Labour Team";
      const cat = categories.find(c => c.id === categoryId) || (selectedTeamObj?.categories ? (Array.isArray(selectedTeamObj.categories) ? selectedTeamObj.categories.find(c => c.id === categoryId) : (selectedTeamObj.categories[categoryId] || Object.values(selectedTeamObj.categories).find(c => c.id === categoryId))) : null);
      const dailyWage = Number(cat?.wage || cat?.salaryAmount || cat?.baseWage || 0);

      let updatedWorkerEntries = [];
      if (Array.isArray(record.workerEntries) && record.workerEntries.length > 0) {
        updatedWorkerEntries = record.workerEntries.map(w => {
          const wUnits = w.customWorkUnits !== undefined ? Number(w.customWorkUnits) : units;
          const wWage = w.dailyWage !== undefined ? Number(w.dailyWage) : dailyWage;
          return {
            ...w,
            customWorkUnits: wUnits,
            units: wUnits,
            dailyWage: wWage,
            wage: wWage,
            calculatedAmount: wUnits * wWage
          };
        });
      }

      const calculatedAmount = updatedWorkerEntries.length > 0
        ? updatedWorkerEntries.reduce((sum, w) => sum + (Number(w.calculatedAmount) || (w.units * w.wage)), 0)
        : (record.workerCount * units * dailyWage);

      try {
        const dbId = await saveLabourAttendanceRecord(record.dbId, {
          siteId: activeSiteId,
          teamId: selectedLabourTeamId,
          teamName,
          categoryId,
          categoryName: cat?.name || "",
          attendanceDate: labourDate,
          workerCount: record.workerCount,
          customWorkUnits: units,
          units: units,
          dailyWage,
          wage: dailyWage,
          workerEntries: updatedWorkerEntries,
          calculatedAmount,
          attendanceType: updatedWorkerEntries.length > 0 ? `${record.workerCount} Workers (Custom Units)` : `${units} Units`,
          createdBy: currentEngineerId
        });

        setAttendanceRows(prev => prev.map(r => r.categoryId === categoryId ? {
          ...r,
          customWorkUnits: units,
          units,
          workerEntries: updatedWorkerEntries,
          calculatedAmount,
          dbId,
          isSaved: true
        } : r));
      } catch (err) {
        console.error("Failed to update work units:", err);
      }
    }
  };

  // Configure custom duration for a specific worker inside a category
  const handleWorkerCustomDurationChange = async (categoryId, workerIndex, newUnitsStr, customWorkerName = null) => {
    if (isLabourSubmitted) {
      const isSubByMe = Boolean(userProfile && (labourLockInfo?.submittedBy === currentEngineerId || labourLockInfo?.submittedBy === userProfile?.uid || labourLockInfo?.submittedBy === userProfile?.id));
      const msg = isSubByMe
        ? "Cannot modify duration: You have already submitted and locked attendance for this date."
        : `Cannot modify duration: Attendance for this site on this date was already submitted by ${labourLockInfo?.submittedByName || "another engineer"}.`;
      showToast(msg, "error");
      return;
    }
    if (labourDateSequenceStatus && !labourDateSequenceStatus.allowed) {
      showToast(labourDateSequenceStatus.message || "Please submit the previous pending date first.", "warning");
      return;
    }
    const newUnit = Math.max(0.01, Number(newUnitsStr) || 1.0);
    const record = attendanceRows.find(r => r.categoryId === categoryId);
    if (!record || record.workerCount <= 0) return;

    const selectedTeamObj = labourTeams.find(t => t.id === selectedLabourTeamId);
    const teamName = selectedTeamObj?.name || selectedTeamObj?.teamName || "Labour Team";
    const cat = categories.find(c => c.id === categoryId) || (selectedTeamObj?.categories ? (Array.isArray(selectedTeamObj.categories) ? selectedTeamObj.categories.find(c => c.id === categoryId) : (selectedTeamObj.categories[categoryId] || Object.values(selectedTeamObj.categories).find(c => c.id === categoryId))) : null);
    const dailyWage = Number(cat?.wage || cat?.salaryAmount || cat?.baseWage || 0);
    const registeredMembers = cat?.members ? (Array.isArray(cat.members) ? cat.members : Object.values(cat.members)) : [];
    const defaultUnits = Number(record.customWorkUnits !== undefined ? record.customWorkUnits : (record.units !== undefined ? record.units : 1.0)) || 1.0;

    const currentWorkerEntries = [];
    for (let i = 0; i < record.workerCount; i++) {
      const existingEntry = (record.workerEntries || [])[i];
      const memberObj = registeredMembers[i];
      const wId = existingEntry?.workerId || memberObj?.memberId || memberObj?.id || `worker_${i + 1}`;
      const wName = (i === workerIndex && customWorkerName) ? customWorkerName : (existingEntry?.workerName || memberObj?.name || `${cat?.name || "Worker"} ${i + 1}`);
      const wUnits = (i === workerIndex) ? newUnit : (existingEntry?.customWorkUnits !== undefined ? Number(existingEntry.customWorkUnits) : defaultUnits);
      const wWage = existingEntry?.dailyWage !== undefined ? Number(existingEntry.dailyWage) : dailyWage;
      const wAmount = wUnits * wWage;

      currentWorkerEntries.push({
        workerId: wId,
        workerName: wName,
        customWorkUnits: wUnits,
        units: wUnits,
        dailyWage: wWage,
        wage: wWage,
        calculatedAmount: wAmount
      });
    }

    const calculatedAmount = currentWorkerEntries.reduce((sum, w) => sum + w.calculatedAmount, 0);

    try {
      const dbId = await saveLabourAttendanceRecord(record.dbId, {
        siteId: activeSiteId,
        teamId: selectedLabourTeamId,
        teamName,
        categoryId,
        categoryName: cat?.name || "",
        attendanceDate: labourDate,
        workerCount: record.workerCount,
        customWorkUnits: defaultUnits,
        units: defaultUnits,
        dailyWage,
        wage: dailyWage,
        workerEntries: currentWorkerEntries,
        calculatedAmount,
        attendanceType: `${record.workerCount} Workers (Custom Units)`,
        createdBy: currentEngineerId
      });

      if (isMountedRef.current) {
        setAttendanceRows(prev => prev.map(r => r.categoryId === categoryId ? {
          ...r,
          workerEntries: currentWorkerEntries,
          calculatedAmount,
          dbId,
          isSaved: true
        } : r));
      }
    } catch (err) {
      console.error("Failed to update worker duration:", err);
      showToast("Failed to update worker duration: " + err.message, "error");
    }
  };

  // Helper to check if a specific team attendance record is locked on a date
  const isTeamLockedOnDate = (dateStr, teamId) => {
    if (!dateStr) return false;
    if (teamId && lockedDates.has(`${dateStr}_${teamId}`)) return true;
    if (lockedDates.has(dateStr)) return true;
    return false;
  };

  // Attendance History event handlers
  const handleStartEditHistoryRecord = (record) => {
    setEditingRecordId(record.id);
    if (record.workerCount !== undefined) {
      setEditingCount(record.workerCount);
      setEditingType(record.attendanceType || "Full Day");
    } else {
      setEditingName(record.workerName);
      setEditingValue(record.attendanceValue);
    }
  };

  const handleSaveHistoryRecord = async (recordId) => {
    const record = labourHistoryRecords.find(r => r.id === recordId);
    if (!record) return;
    if (isTeamLockedOnDate(record.attendanceDate, record.teamId)) {
      showToast("Cannot edit: This team's attendance is submitted and locked.", "error");
      return;
    }

    if (record.workerCount !== undefined) {
      const count = Number(editingCount);
      if (isNaN(count) || count <= 0) {
        showToast("Count must be greater than 0.", "error");
        return;
      }
      try {
        await saveLabourAttendanceRecord(recordId, {
          attendanceDate: record.attendanceDate,
          siteId: record.siteId,
          teamId: record.teamId,
          teamName: record.teamName || "",
          categoryId: record.categoryId,
          workerCount: count,
          attendanceType: editingType,
          createdBy: record.createdBy || currentEngineerId
        });
        setEditingRecordId(null);
        showToast("Attendance record updated successfully.", "success");
      } catch (err) {
        console.error("Failed to update record:", err);
        showToast("Failed to update record: " + err.message, "error");
      }
      return;
    }

    const workerNameClean = editingName.trim();
    if (!workerNameClean) {
      showToast("Worker Name cannot be empty.", "error");
      return;
    }

    const hasDuplicate = labourHistoryRecords.some(r => 
      r.attendanceDate === record.attendanceDate &&
      r.workerName.toLowerCase().trim() === workerNameClean.toLowerCase() &&
      r.id !== recordId
    );
    if (hasDuplicate) {
      showToast(`Worker "${workerNameClean}" already has an attendance record on this date.`, "error");
      return;
    }

    if (workerNameClean === record.workerName && Number(editingValue) === Number(record.attendanceValue)) {
      setEditingRecordId(null);
      return;
    }

    try {
      await saveLabourAttendanceRecord(recordId, {
        attendanceDate: record.attendanceDate,
        siteId: record.siteId,
        teamId: record.teamId,
        teamName: record.teamName || "",
        categoryId: record.categoryId,
        workerName: workerNameClean,
        attendanceValue: Number(editingValue),
        createdBy: record.createdBy || currentEngineerId
      });
      setEditingRecordId(null);
      showToast("Attendance record updated successfully.", "success");
    } catch (err) {
      console.error("Failed to update record:", err);
      showToast("Failed to update record: " + err.message, "error");
    }
  };

  const handleDeleteHistoryRecord = async (recordId) => {
    const record = labourHistoryRecords.find(r => r.id === recordId);
    if (!record) return;
    if (isTeamLockedOnDate(record.attendanceDate, record.teamId)) {
      showToast("Cannot delete: This team's attendance is submitted and locked.", "error");
      return;
    }
    showConfirmModal({
      title: "Delete Worker Record?",
      message: "Are you sure you want to delete this worker record?",
      confirmText: "Delete Record",
      variant: "danger",
      onConfirm: async () => {
        try {
          await deleteLabourAttendanceRecord(recordId);
          showToast("Record deleted successfully.", "success");
        } catch (err) {
          console.error("Failed to delete record:", err);
          showToast("Failed to delete: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  const handleDeleteCategoryHistoryRecords = async (dateStr, teamId, categoryId) => {
    if (isTeamLockedOnDate(dateStr, teamId)) {
      showToast("Cannot delete: This team's attendance is submitted and locked.", "error");
      return;
    }
    showConfirmModal({
      title: "Delete Category Attendance?",
      message: `Are you sure you want to delete all attendance records for this category on ${dateStr}?`,
      confirmText: "Delete Category Entries",
      variant: "danger",
      onConfirm: async () => {
        const recordsToDelete = labourHistoryRecords.filter(r => 
          r.attendanceDate === dateStr && 
          r.teamId === teamId && 
          r.categoryId === categoryId
        );

        if (recordsToDelete.length === 0) {
          closeConfirmModal();
          return;
        }

        try {
          await Promise.all(recordsToDelete.map(r => deleteLabourAttendanceRecord(r.id)));
          showToast("Category attendance deleted successfully.", "success");
        } catch (err) {
          console.error("Failed to delete category records:", err);
          showToast("Failed to delete category records: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  const handleDeleteTeamHistoryRecords = async (dateStr, teamId) => {
    if (isTeamLockedOnDate(dateStr, teamId)) {
      showToast("Cannot delete: This team's attendance is submitted and locked.", "error");
      return;
    }
    showConfirmModal({
      title: "Delete Team Attendance?",
      message: `Are you sure you want to delete the entire team's attendance for ${dateStr}?`,
      confirmText: "Delete Team Records",
      variant: "danger",
      onConfirm: async () => {
        const recordsToDelete = labourHistoryRecords.filter(r => 
          r.attendanceDate === dateStr && 
          r.teamId === teamId
        );

        if (recordsToDelete.length === 0) {
          closeConfirmModal();
          return;
        }

        try {
          await Promise.all(recordsToDelete.map(r => deleteLabourAttendanceRecord(r.id)));
          showToast("Team attendance deleted successfully.", "success");
        } catch (err) {
          console.error("Failed to delete team records:", err);
          showToast("Failed to delete team records: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  // Submit workforce attendance per Site + Date + Team
  const handleLabourSubmit = async () => {
    if (labourSubmitting || labourSubmittingRef.current) return;
    if (!activeSiteId) {
      showToast("Please choose active project.", "error");
      return;
    }
    if (!selectedLabourTeamId) {
      showToast("Please select a labour team.", "error");
      return;
    }
    if (attendanceRows.length === 0) {
      showToast("Please add at least one workforce count before submitting.", "error");
      return;
    }

    const selectedTeamObj = labourTeams.find(t => t.id === selectedLabourTeamId);
    const teamName = selectedTeamObj?.name || selectedTeamObj?.teamName || "Labour Team";
    
    // Duplicate Prevention Check directly against database for this Site + Date + Team
    const freshCheck = await checkLabourSubmissionStatus(activeSiteId, labourDate, selectedLabourTeamId);
    if (freshCheck && freshCheck.submitted) {
      if (isMountedRef.current) {
        setIsLabourLocked(true);
        setLabourLockInfo(freshCheck);
      }
      const isSubByMe = Boolean(userProfile && (freshCheck.submittedBy === currentEngineerId || freshCheck.submittedBy === userProfile?.uid || freshCheck.submittedBy === userProfile?.id));
      const msg = isSubByMe
        ? `Attendance for "${teamName}" on this date has already been submitted and locked by you.`
        : `Attendance for "${teamName}" on this date was already submitted by ${freshCheck.submittedByName || "another engineer"}.`;
      showToast(msg, "warning");
      return;
    }

    // Sequential Date Rule Check
    const freshSeqCheck = await checkLabourDateSequenceStatus(activeSiteId, labourDate);
    if (freshSeqCheck && !freshSeqCheck.allowed) {
      if (isMountedRef.current) {
        setLabourDateSequenceStatus(freshSeqCheck);
      }
      showToast(freshSeqCheck.message || "Please submit the previous pending date first.", "warning");
      return;
    }

    const displayDate = formatDateDMY(labourDate);

    showConfirmModal({
      title: `Submit "${teamName}" Attendance?`,
      message: `You are about to submit ${teamName}'s labour attendance record for ${displayDate}.`,
      details: "After submission, editing and modifications will be locked for this Team and Date.",
      confirmText: "Submit & Lock",
      cancelText: "Cancel",
      variant: "lock",
      onConfirm: async () => {
        if (labourSubmitting || labourSubmittingRef.current) return;
        labourSubmittingRef.current = true;
        setLabourSubmitting(true);
        try {
          // Double check database inside modal confirm to prevent race condition duplicates
          const reCheck = await checkLabourSubmissionStatus(activeSiteId, labourDate, selectedLabourTeamId);
          if (reCheck && reCheck.submitted) {
            if (isMountedRef.current) {
              setIsLabourLocked(true);
              setLabourLockInfo(reCheck);
            }
            const isSubByMe = Boolean(userProfile && (reCheck.submittedBy === currentEngineerId || reCheck.submittedBy === userProfile?.uid || reCheck.submittedBy === userProfile?.id));
            const msg = isSubByMe
              ? `Attendance for "${teamName}" on this date was already submitted and locked by you.`
              : `Attendance for "${teamName}" on this date was already submitted by ${reCheck.submittedByName || "another engineer"}.`;
            showToast(msg, "warning");
            closeConfirmModal();
            return;
          }

          const reSeqCheck = await checkLabourDateSequenceStatus(activeSiteId, labourDate);
          if (reSeqCheck && !reSeqCheck.allowed) {
            if (isMountedRef.current) {
              setLabourDateSequenceStatus(reSeqCheck);
            }
            showToast(reSeqCheck.message || "Please submit the previous pending date first.", "warning");
            closeConfirmModal();
            return;
          }

          const currentEngineerName = userProfile?.fullName || userProfile?.name || userProfile?.displayName || currentUser?.displayName || userProfile?.email || currentUser?.email || "Site Engineer";
          const currentEngineerEmail = userProfile?.email || currentUser?.email || "";
          await submitLabourAttendance(activeSiteId, labourDate, currentEngineerId, selectedLabourTeamId, attendanceRows, currentEngineerName, currentEngineerEmail);
          showToast(`"${teamName}" attendance submitted and locked successfully.`, "success");
          if (isMountedRef.current) {
            setIsLabourLocked(true);
          }
          await fetchLabourLockStatus(selectedLabourTeamId);
          await loadLockedDates(); // Reload locked dates
          await loadDashboardData();
        } catch (err) {
          console.error("Failed to submit workforce attendance:", err);
          showToast("Submission failed: " + err.message, "error");
        } finally {
          labourSubmittingRef.current = false;
          if (isMountedRef.current) {
            setLabourSubmitting(false);
          }
          closeConfirmModal();
        }
      }
    });
  };

  const handlePromptNoWork = async () => {
    if (!activeSiteId || !labourDate) return;
    if (isLabourSubmitted) {
      showToast("This date is already submitted and locked.", "warning");
      return;
    }

    // Sequential Date Rule Check
    const freshSeqCheck = await checkLabourDateSequenceStatus(activeSiteId, labourDate);
    if (freshSeqCheck && !freshSeqCheck.allowed) {
      if (isMountedRef.current) {
        setLabourDateSequenceStatus(freshSeqCheck);
      }
      showToast(freshSeqCheck.message || "Please submit the previous pending date first.", "warning");
      return;
    }

    const displayDate = formatDateDMY(labourDate);

    showConfirmModal({
      title: `Mark ${displayDate} as No Work?`,
      message: `You are about to mark ${displayDate} as a Non-Working Day for this site.`,
      details: "No workforce attendance will be recorded. The date will be locked, and the next working date will become eligible for entry.",
      confirmText: "Confirm No Work",
      cancelText: "Cancel",
      variant: "lock",
      onConfirm: async () => {
        try {
          const currentEngineerName = userProfile?.fullName || userProfile?.name || userProfile?.displayName || currentUser?.displayName || userProfile?.email || currentUser?.email || "Site Engineer";
          const currentEngineerEmail = userProfile?.email || currentUser?.email || "";
          await markLabourNoWork(activeSiteId, labourDate, currentEngineerId, currentEngineerName, "No Work / Non-Working Day", currentEngineerEmail);
          showToast(`Date ${displayDate} marked as No Work and locked successfully.`, "success");
          if (isMountedRef.current) {
            setIsLabourLocked(true);
          }
          await fetchLabourLockStatus(selectedLabourTeamId);
          await loadLockedDates();
          await loadDashboardData();
        } catch (err) {
          console.error("Failed to mark date as No Work:", err);
          showToast("Failed to mark No Work: " + err.message, "error");
        } finally {
          closeConfirmModal();
        }
      }
    });
  };

  // 4. Material Usage Row & Selection Handlers
  const handleSelectMaterialTeam = (teamId) => {
    setSelectedMaterialTeamId(teamId);
    if (!teamId) {
      setMaterialUsageRows([]);
      return;
    }
    const team = materialTeams.find(t => t.id === teamId);
    const activeMats = (team?.materials || []).filter(m => m.status !== "Inactive");

    if (activeMats.length > 0) {
      setMaterialUsageRows(activeMats.map(m => {
        const isCustom = m.type === "custom";
        const isRateOnly = m.type === "rate_only";
        const amt = Number(m.amount !== undefined ? m.amount : (m.rate !== undefined ? m.rate : m.unitPrice)) || 0;
        const displayName = (m.title || m.name || "").trim() || (isRateOnly ? "Rate Item" : "Material");
        return {
          rowId: `row_${m.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          materialId: m.id,
          materialName: displayName,
          title: m.title || displayName,
          type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
          unit: (isCustom || isRateOnly) ? "" : (m.unit || "Bag"),
          rate: amt,
          amount: amt,
          quantity: (isCustom || isRateOnly) ? 1 : ""
        };
      }));
    } else {
      setMaterialUsageRows([]);
    }
  };

  const handleAddMaterialRow = () => {
    const team = materialTeams.find(t => t.id === selectedMaterialTeamId);
    const activeMats = (team?.materials || []).filter(m => m.status !== "Inactive");
    if (!activeMats || activeMats.length === 0) {
      showToast("No active materials configured for this team.", "error");
      return;
    }

    const existingMatIds = new Set(materialUsageRows.map(r => r.materialId));
    const availableMats = activeMats.filter(m => !existingMatIds.has(m.id));

    if (availableMats.length === 0) {
      showToast("All materials for this team are already in the list. You can edit quantities or remove unneeded rows.", "info");
      return;
    }

    const nextMat = availableMats[0];
    const isCustom = nextMat.type === "custom";
    const isRateOnly = nextMat.type === "rate_only";
    const amt = Number(nextMat.amount !== undefined ? nextMat.amount : (nextMat.rate !== undefined ? nextMat.rate : nextMat.unitPrice)) || 0;
    const displayName = (nextMat.title || nextMat.name || "").trim() || (isRateOnly ? "Rate Item" : "Material");

    setMaterialUsageRows(prev => [
      ...prev,
      {
        rowId: `row_${nextMat.id}_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        materialId: nextMat.id,
        materialName: displayName,
        title: nextMat.title || displayName,
        type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
        unit: (isCustom || isRateOnly) ? "" : (nextMat.unit || "Bag"),
        rate: amt,
        amount: amt,
        quantity: (isCustom || isRateOnly) ? 1 : ""
      }
    ]);
  };

  const handleMaterialRowChange = (rowId, newMatId) => {
    const team = materialTeams.find(t => t.id === selectedMaterialTeamId);
    const mat = (team?.materials || []).find(m => m.id === newMatId);
    if (!mat) return;

    // Strict duplicate check across other rows in current unsaved list
    const isDuplicate = materialUsageRows.some(row => row.rowId !== rowId && row.materialId === newMatId);
    if (isDuplicate) {
      showToast(`"${mat.name || mat.title || "Item"}" is already in your usage list.`, "warning");
      return;
    }

    const isCustom = mat.type === "custom";
    const isRateOnly = mat.type === "rate_only";
    const amt = Number(mat.amount !== undefined ? mat.amount : (mat.rate !== undefined ? mat.rate : mat.unitPrice)) || 0;
    const displayName = (mat.title || mat.name || "").trim() || (isRateOnly ? "Rate Item" : "Material");

    setMaterialUsageRows(prev => prev.map(row => {
      if (row.rowId === rowId) {
        return {
          ...row,
          materialId: mat.id,
          materialName: displayName,
          title: mat.title || displayName,
          type: isRateOnly ? "rate_only" : (isCustom ? "custom" : "standard"),
          unit: (isCustom || isRateOnly) ? "" : (mat.unit || "Bag"),
          rate: amt,
          amount: amt,
          quantity: (isCustom || isRateOnly) ? 1 : ""
        };
      }
      return row;
    }));
  };

  const handleEditMaterialRow = (rowId) => {
    const inputEl = document.getElementById(`qty-input-${rowId}`);
    if (inputEl) {
      inputEl.focus();
      if (inputEl.select) inputEl.select();
    }
  };

  const handleRemoveMaterialRow = (rowId) => {
    setMaterialUsageRows(prev => prev.filter(row => row.rowId !== rowId));
  };

  const handleQuantityRowChange = (rowId, qtyVal) => {
    setMaterialUsageRows(prev => prev.map(row => {
      if (row.rowId === rowId) {
        return { ...row, quantity: qtyVal };
      }
      return row;
    }));
  };

  // Open Generic Custom / Customer Material Modal
  const handleOpenCustomMaterialModal = (existingRow = null) => {
    if (!selectedMaterialTeamId) {
      showToast("Please select a Material Team first.", "warning");
      return;
    }
    if (existingRow) {
      setEditingCustomRowId(existingRow.rowId);
      setCustomMatName(existingRow.title !== undefined ? existingRow.title : (existingRow.type === "customer_amount_only" ? "" : (existingRow.materialName || "")));
      setCustomMatAmount(String(existingRow.amount !== undefined ? existingRow.amount : (existingRow.rate || "")));
      setCustomMatNotes(existingRow.notes || "");
    } else {
      setEditingCustomRowId(null);
      setCustomMatName("");
      setCustomMatAmount("");
      setCustomMatNotes("");
    }
    setShowCustomMaterialModal(true);
  };

  // Save / Add Generic Custom / Customer Material to current usage list
  const handleSaveCustomMaterial = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const trimmedName = customMatName.trim();
    const amtNum = Number(customMatAmount);
    if (!customMatAmount || isNaN(amtNum) || amtNum <= 0) {
      showToast("Please enter a valid amount greater than 0.", "error");
      return;
    }

    const isCustomerAmountOnly = !trimmedName;
    const finalType = isCustomerAmountOnly ? "customer_amount_only" : "custom";
    const displayName = trimmedName || "Customer Amount";

    if (editingCustomRowId) {
      setMaterialUsageRows(prev => prev.map(row => {
        if (row.rowId === editingCustomRowId) {
          return {
            ...row,
            materialName: displayName,
            title: trimmedName,
            type: finalType,
            unit: "—",
            rate: amtNum,
            amount: amtNum,
            quantity: 1,
            notes: customMatNotes.trim()
          };
        }
        return row;
      }));
      showToast(trimmedName ? `Updated "${trimmedName}" (₹${amtNum.toLocaleString("en-IN")})` : `Updated Customer Amount (₹${amtNum.toLocaleString("en-IN")})`, "success");
    } else {
      // Check if matching row exists
      const existingIndex = trimmedName ? materialUsageRows.findIndex(r => (r.title || r.materialName || "").toLowerCase() === trimmedName.toLowerCase()) : -1;
      if (existingIndex >= 0) {
        setMaterialUsageRows(prev => prev.map((row, idx) => {
          if (idx === existingIndex) {
            return {
              ...row,
              materialName: displayName,
              title: trimmedName,
              type: finalType,
              unit: "—",
              rate: amtNum,
              amount: amtNum,
              quantity: 1,
              notes: customMatNotes.trim()
            };
          }
          return row;
        }));
        showToast(`Updated "${trimmedName}" with amount ₹${amtNum.toLocaleString("en-IN")}`, "success");
      } else {
        const team = materialTeams.find(t => t.id === selectedMaterialTeamId);
        const matchingTeamMat = trimmedName ? (team?.materials || []).find(m => (m.name || "").toLowerCase() === trimmedName.toLowerCase()) : null;
        const newCustomRow = {
          rowId: `row_custom_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
          materialId: matchingTeamMat?.id || `cust_${Date.now()}`,
          materialName: displayName,
          title: trimmedName,
          type: finalType,
          unit: "—",
          rate: amtNum,
          amount: amtNum,
          quantity: 1,
          notes: customMatNotes.trim()
        };
        setMaterialUsageRows(prev => [...prev, newCustomRow]);
        showToast(trimmedName ? `Added "${trimmedName}" (₹${amtNum.toLocaleString("en-IN")})` : `Added Customer Amount (₹${amtNum.toLocaleString("en-IN")})`, "success");
      }
    }

    setShowCustomMaterialModal(false);
    setEditingCustomRowId(null);
    setCustomMatName("");
    setCustomMatAmount("");
    setCustomMatNotes("");
  };

  // Save Material Usage
  const handleBulkMaterialSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (bulkMaterialSubmitting || bulkMaterialSubmittingRef.current) return;

    if (!bulkMaterialDate || !bulkMaterialDate.trim()) {
      showToast("Please select a date before submitting.", "error");
      return;
    }

    if (!activeSiteId) {
      showToast("Please select construction site.", "error");
      return;
    }

    if (!selectedMaterialTeamId) {
      showToast("Please select a Material Team.", "error");
      return;
    }

    const currentTeam = materialTeams.find(t => t.id === selectedMaterialTeamId);
    if (!currentTeam) {
      showToast("No configured Material Team found. Please contact Admin.", "error");
      return;
    }

    const itemsToSave = [];
    materialUsageRows.forEach(row => {
      const isCustom = row.type === "custom";
      const isCustomerAmountOnly = row.type === "customer_amount_only";
      const isRateOnly = row.type === "rate_only";
      if (isCustom || isCustomerAmountOnly || isRateOnly) {
        const itemAmt = Number(row.amount !== undefined ? row.amount : row.rate) || 0;
        const cleanTitle = (row.title || "").trim();
        const cleanName = cleanTitle || (row.materialName || "").trim() || (isCustomerAmountOnly ? "Customer Amount" : (isRateOnly ? "Rate Item" : "Customer"));
        itemsToSave.push({
          teamId: currentTeam.id,
          teamName: currentTeam.name,
          materialName: cleanName,
          title: cleanTitle,
          type: isCustomerAmountOnly ? "customer_amount_only" : (isRateOnly ? "rate_only" : "custom"),
          materialType: isCustomerAmountOnly ? "customer_amount_only" : (isRateOnly ? "rate_only" : "custom"),
          category: currentTeam.name,
          unit: "",
          unitPrice: itemAmt,
          rate: itemAmt,
          amount: itemAmt,
          quantity: 1,
          requiredQuantity: 1,
          totalAmount: itemAmt,
          notes: row.notes || `${isCustomerAmountOnly ? "Customer Amount" : (isRateOnly ? "Rate Only" : "Customer")} entry for ${currentTeam.name} on ${bulkMaterialDate}`
        });
      } else {
        const qtyStr = row.quantity;
        const qtyNum = Number(qtyStr);
        if (qtyStr !== undefined && qtyStr !== null && qtyStr !== "" && !isNaN(qtyNum) && qtyNum > 0) {
          const itemRate = Number(row.rate) || 0;
          itemsToSave.push({
            teamId: currentTeam.id,
            teamName: currentTeam.name,
            materialName: row.materialName,
            type: "standard",
            materialType: "standard",
            category: currentTeam.name,
            unit: row.unit || "Unit",
            unitPrice: itemRate,
            rate: itemRate,
            quantity: qtyNum,
            totalAmount: qtyNum * itemRate
          });
        }
      }
    });

    if (itemsToSave.length === 0) {
      showToast(`Please enter a quantity greater than 0 for standard materials or include customer/rate only materials under "${currentTeam.name}".`, "error");
      return;
    }

    bulkMaterialSubmittingRef.current = true;
    setBulkMaterialSubmitting(true);
    try {
      const engineerId = currentEngineerId || userProfile?.uid || userProfile?.id || "";
      await saveBulkMaterialEntry({
        siteId: activeSiteId,
        dateStr: bulkMaterialDate,
        engineerId,
        teamId: currentTeam.id,
        teamName: currentTeam.name,
        items: itemsToSave
      });

      showToast(`Material entry submitted & locked for "${currentTeam.name}" (${itemsToSave.length} item${itemsToSave.length !== 1 ? "s" : ""})!`, "success");

      // Reset form standard quantities and remove custom / customer_amount_only / rate_only items that were just submitted so engineer can add more materials
      if (isMountedRef.current) {
        setMaterialUsageRows(prev => prev.filter(r => r.type !== "custom" && r.type !== "customer_amount_only" && r.type !== "rate_only").map(r => ({ ...r, quantity: "" })));
      }

      await loadDashboardData();
    } catch (err) {
      console.error("Bulk material submit error:", err);
      showToast(`Submission failed: ${err.message}`, "error");
    } finally {
      bulkMaterialSubmittingRef.current = false;
      if (isMountedRef.current) {
        setBulkMaterialSubmitting(false);
      }
    }
  };

  // Open Track Pending Modal
  const handleOpenPendingModal = () => {
    if (!activeSiteId) {
      showToast("Please select an active construction site first.", "error");
      return;
    }
    setPendingDate(bulkMaterialDate || new Date().toISOString().split("T")[0]);
    const teamIdToUse = selectedMaterialTeamId || (materialTeams.length > 0 ? materialTeams[0].id : "");
    setPendingTeamId(teamIdToUse);
    const initialTeam = materialTeams.find(t => t.id === teamIdToUse);
    const firstMat = (initialTeam?.materials || []).find(m => m.status !== "Inactive");
    setPendingMaterialId(firstMat ? firstMat.id : "");
    setPendingTotalQty("");
    setPendingReceivedQty("");
    setPendingSupplier(initialTeam?.name || "");
    setPendingNotes("");
    setShowPendingModal(true);
  };

  // Save New Pending Material Record
  const handleSavePendingMaterial = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (savingPending) return;

    if (!activeSiteId) {
      showToast("Please select construction site.", "error");
      return;
    }
    if (!pendingDate) {
      showToast("Please select report date.", "error");
      return;
    }
    if (!pendingTeamId) {
      showToast("Please select a Material Team.", "error");
      return;
    }
    if (!pendingMaterialId) {
      showToast("Please select a Material.", "error");
      return;
    }
    const totQty = Number(pendingTotalQty);
    if (!pendingTotalQty || isNaN(totQty) || totQty <= 0) {
      showToast("Please enter a valid Total Quantity greater than 0.", "error");
      return;
    }
    const recQty = pendingReceivedQty === "" ? 0 : Number(pendingReceivedQty);
    if (isNaN(recQty) || recQty < 0) {
      showToast("Received Quantity cannot be negative.", "error");
      return;
    }
    if (recQty > totQty) {
      showToast("Received Quantity cannot exceed Total Quantity.", "error");
      return;
    }

    const currentTeam = materialTeams.find(t => t.id === pendingTeamId);
    const selectedMat = (currentTeam?.materials || []).find(m => m.id === pendingMaterialId);
    if (!selectedMat) {
      showToast("Selected material not found in team configuration.", "error");
      return;
    }

    const pendingQty = Math.max(0, totQty - recQty);
    const unitCost = Number(selectedMat.rate || selectedMat.amount || selectedMat.unitPrice) || 0;
    const isCustom = selectedMat.type === "custom";
    const totalAmount = isCustom ? unitCost : (recQty > 0 ? recQty * unitCost : totQty * unitCost);

    setSavingPending(true);
    try {
      const engineerId = currentEngineerId || userProfile?.uid || userProfile?.id || "";
      await addMaterial({
        siteId: activeSiteId,
        engineerId,
        teamId: currentTeam.id,
        teamName: currentTeam.name,
        materialName: selectedMat.name,
        materialType: isCustom ? "custom" : "standard",
        category: currentTeam.name,
        unit: isCustom ? "" : (selectedMat.unit || "Unit"),
        quantity: recQty, // actual received quantity
        requiredQuantity: totQty, // total ordered quantity
        orderedQuantity: totQty,
        pendingDelivery: pendingQty,
        isPendingDelivery: pendingQty > 0,
        unitPrice: unitCost,
        rate: unitCost,
        amount: totalAmount,
        totalAmount: totalAmount,
        supplierName: pendingSupplier.trim() || currentTeam.name || "Material Supplier",
        purchaseDate: pendingDate,
        notes: pendingNotes.trim() || `Material Pending Entry: ${recQty}/${totQty} ${selectedMat.unit || "units"} received on ${pendingDate} (Pending: ${pendingQty})`,
        status: "Approved",
        type: "material_log"
      });

      showToast(`Pending record saved for ${selectedMat.name} (Pending: ${pendingQty} ${selectedMat.unit || ""})`, "success");
      setShowPendingModal(false);
      await loadDashboardData();
    } catch (err) {
      console.error("Save pending error:", err);
      showToast(`Failed to save pending record: ${err.message}`, "error");
    } finally {
      setSavingPending(false);
    }
  };

  // Open Resolve Existing Pending Modal
  const handleOpenResolvePending = (mat) => {
    setSelectedPendingRecord(mat);
    const currentPending = Number(mat.pendingDelivery) || Math.max(0, (Number(mat.requiredQuantity || mat.orderedQuantity) || 0) - (Number(mat.receivedQuantity || mat.quantity) || 0));
    setNewlyReceivedQty(currentPending > 0 ? String(currentPending) : "");
    setShowResolvePendingModal(true);
  };

  // Submit Resolve Pending Delivery
  const handleResolvePendingSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (savingResolvePending || savingResolvePendingRef.current || !selectedPendingRecord) return;

    const newlyRec = Number(newlyReceivedQty);
    if (!newlyReceivedQty || isNaN(newlyRec) || newlyRec <= 0) {
      showToast("Please enter a valid received quantity greater than 0.", "error");
      return;
    }

    const currentRec = Number(selectedPendingRecord.receivedQuantity !== undefined ? selectedPendingRecord.receivedQuantity : selectedPendingRecord.quantity) || 0;
    const totalReq = Number(selectedPendingRecord.requiredQuantity || selectedPendingRecord.orderedQuantity) || (currentRec + (Number(selectedPendingRecord.pendingDelivery) || 0));
    const updatedRec = currentRec + newlyRec;

    if (updatedRec > totalReq) {
      showToast(`Total received (${updatedRec}) cannot exceed ordered total (${totalReq}).`, "error");
      return;
    }

    const updatedPending = Math.max(0, totalReq - updatedRec);

    savingResolvePendingRef.current = true;
    setSavingResolvePending(true);
    try {
      const todayIso = new Date().toISOString().split("T")[0];
      const appendNote = `\n[${todayIso}] Received +${newlyRec} ${selectedPendingRecord.unit || ""}. Total received: ${updatedRec}/${totalReq} (Remaining pending: ${updatedPending})`;
      
      await updateMaterial(selectedPendingRecord.id, {
        quantity: updatedRec, // Canonical received quantity
        receivedQuantity: updatedRec,
        requiredQuantity: totalReq,
        orderedQuantity: totalReq,
        pendingDelivery: updatedPending,
        isPendingDelivery: updatedPending > 0,
        deliveryStatus: updatedPending === 0 ? "Fully Delivered" : "Partial Delivery",
        notes: (selectedPendingRecord.notes || "") + appendNote
      });

      showToast(
        updatedPending === 0 
          ? `Delivery completed! ${selectedPendingRecord.materialName} is now fully received (${totalReq} ${selectedPendingRecord.unit || ""}).` 
          : `Updated delivery for ${selectedPendingRecord.materialName}. Remaining pending: ${updatedPending} ${selectedPendingRecord.unit || ""}.`,
        "success"
      );
      if (isMountedRef.current) setShowResolvePendingModal(false);
      await loadDashboardData();
    } catch (err) {
      console.error("Resolve pending error:", err);
      showToast(`Failed to update delivery: ${err.message}`, "error");
    } finally {
      savingResolvePendingRef.current = false;
      if (isMountedRef.current) {
        setSavingResolvePending(false);
      }
    }
  };

  // Open Material Row Details Modal
  const handleOpenMaterialDetails = (row) => {
    setSelectedMaterialForDetails(row);
    setShowMaterialDetailsModal(true);
  };

  // Open Material Transfer Modal
  const handleOpenTransferModal = (preselectedMat = null) => {
    if (!activeSiteId) {
      showToast("Please select an active construction site first.", "error");
      return;
    }

    const availableSiteMats = materials
      .filter(m => m && m.siteId === activeSiteId)
      .map(m => processMaterialPaymentAndDelivery(m))
      .filter(m => m.remainingStock > 0);

    if (availableSiteMats.length === 0) {
      showToast("No available material stock at this site to transfer.", "warning");
      return;
    }

    const otherSites = allSites.filter(s => s.id !== activeSiteId);
    if (otherSites.length === 0) {
      showToast("No other destination sites available for transfer.", "warning");
      return;
    }

    const matToUse = preselectedMat && availableSiteMats.some(m => m.id === preselectedMat.id)
      ? preselectedMat.id
      : availableSiteMats[0].id;

    setTransferDate(bulkMaterialDate || new Date().toISOString().split("T")[0]);
    setTransferMaterialId(matToUse);
    setTransferDestSiteId(otherSites[0].id);
    setTransferQuantity("");
    setTransferNotes("");
    setShowTransferModal(true);
  };

  // Submit Material Transfer
  const handleTransferSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (savingTransfer || savingTransferRef.current) return;

    if (!activeSiteId) {
      showToast("Please select source construction site.", "error");
      return;
    }

    if (!transferDestSiteId) {
      showToast("Please select a destination site.", "error");
      return;
    }

    if (transferDestSiteId === activeSiteId) {
      showToast("Destination site cannot be the same as the source site.", "error");
      return;
    }

    if (!transferMaterialId) {
      showToast("Please select a material to transfer.", "error");
      return;
    }

    const transferQtyNum = Number(transferQuantity);
    if (!transferQuantity || isNaN(transferQtyNum) || transferQtyNum <= 0) {
      showToast("Please enter a valid transfer quantity greater than 0.", "error");
      return;
    }

    const rawMat = materials.find(m => m.id === transferMaterialId);
    if (!rawMat) {
      showToast("Selected material record not found.", "error");
      return;
    }

    const processedMat = processMaterialPaymentAndDelivery(rawMat);
    if (transferQtyNum > processedMat.remainingStock) {
      showToast(`Transfer quantity (${transferQtyNum}) exceeds available stock (${processedMat.remainingStock} ${processedMat.unit || "units"}).`, "error");
      return;
    }

    const currentSiteObj = assignedSites.find(s => s.id === activeSiteId) || allSites.find(s => s.id === activeSiteId);
    const destSiteObj = allSites.find(s => s.id === transferDestSiteId);
    const engineerId = currentEngineerId || userProfile?.uid || "";
    const engineerName = userProfile?.fullName || userProfile?.name || "Site Engineer";

    savingTransferRef.current = true;
    setSavingTransfer(true);
    try {
      await transferMaterialBetweenSites({
        sourceSiteId: activeSiteId,
        sourceSiteName: currentSiteObj?.siteName || "Source Site",
        destinationSiteId: transferDestSiteId,
        destinationSiteName: destSiteObj?.siteName || "Destination Site",
        sourceMaterialId: transferMaterialId,
        transferQuantity: transferQtyNum,
        transferDate: transferDate || new Date().toISOString().split("T")[0],
        engineerId,
        engineerName,
        notes: transferNotes.trim()
      });

      showToast(`Successfully transferred ${transferQtyNum} ${processedMat.unit || ""} to ${destSiteObj?.siteName || "Destination Site"}!`, "success");
      if (isMountedRef.current) setShowTransferModal(false);
      await loadDashboardData();
    } catch (err) {
      console.error("Transfer error:", err);
      showToast(`Transfer failed: ${err.message}`, "error");
    } finally {
      savingTransferRef.current = false;
      if (isMountedRef.current) {
        setSavingTransfer(false);
      }
    }
  };

  // Open Receive Material Transfer Modal
  const handleOpenReceiveTransfer = (transferRecord) => {
    setSelectedTransferForReceive(transferRecord);
    const totalTransferred = Number(transferRecord.transferQuantity || transferRecord.requiredQuantity || transferRecord.orderedQuantity) || 0;
    const previouslyReceived = Number(transferRecord.quantity) || 0;
    const pendingToReceive = Math.max(0, totalTransferred - previouslyReceived);
    setReceiveQuantity(pendingToReceive > 0 ? pendingToReceive.toString() : "");
    setReceiveDate(bulkMaterialDate || new Date().toISOString().split("T")[0]);
    setReceiveNotes("");
    setShowReceiveTransferModal(true);
  };

  // Submit Material Transfer Receipt
  const handleReceiveTransferSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (savingReceiveTransfer || savingReceiveTransferRef.current || !selectedTransferForReceive) return;

    const rxQtyNum = Number(receiveQuantity);
    if (!receiveQuantity || isNaN(rxQtyNum) || rxQtyNum <= 0) {
      showToast("Please enter a valid receive quantity greater than 0.", "error");
      return;
    }

    const totalTransferred = Number(selectedTransferForReceive.transferQuantity || selectedTransferForReceive.requiredQuantity || selectedTransferForReceive.orderedQuantity) || 0;
    const previouslyReceived = Number(selectedTransferForReceive.quantity) || 0;
    const currentPending = Math.max(0, totalTransferred - previouslyReceived);

    if (rxQtyNum > currentPending) {
      showToast(`Receive quantity (${rxQtyNum}) cannot exceed pending quantity (${currentPending} ${selectedTransferForReceive.unit || "units"}).`, "error");
      return;
    }

    const engineerId = currentEngineerId || userProfile?.uid || "";
    const engineerName = userProfile?.fullName || userProfile?.name || "Site Engineer";

    savingReceiveTransferRef.current = true;
    setSavingReceiveTransfer(true);
    try {
      const res = await receiveMaterialTransfer({
        transferId: selectedTransferForReceive.id,
        receivedQuantity: rxQtyNum,
        receiveDate: receiveDate || new Date().toISOString().split("T")[0],
        engineerId,
        engineerName,
        notes: receiveNotes.trim()
      });

      showToast(
        res.isFullyReceived
          ? `Receipt confirmed! Full ${res.receivedQuantity} ${selectedTransferForReceive.unit || ""} received from ${selectedTransferForReceive.sourceSiteName || "source site"}.`
          : `Partial receipt recorded (+${rxQtyNum} ${selectedTransferForReceive.unit || ""}). Remaining pending: ${res.pendingQuantity} ${selectedTransferForReceive.unit || ""}.`,
        "success"
      );
      if (isMountedRef.current) setShowReceiveTransferModal(false);
      await loadDashboardData();
    } catch (err) {
      console.error("Receive transfer error:", err);
      showToast(`Receive failed: ${err.message}`, "error");
    } finally {
      savingReceiveTransferRef.current = false;
      if (isMountedRef.current) {
        setSavingReceiveTransfer(false);
      }
    }
  };

  const handleMaterialSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (materialSubmitting || materialSubmittingRef.current) return;
    if (!activeSiteId) {
      showToast("Please choose active project.", "error");
      return;
    }
    if (!materialName.trim()) {
      showToast("Material Name is required.", "error");
      return;
    }
    if (materialCategory === "Other" && !customMaterialCategory.trim()) {
      showToast("Please specify the custom material category.", "error");
      return;
    }
    if (!materialQuantity || isNaN(Number(materialQuantity)) || Number(materialQuantity) <= 0) {
      showToast("Quantity must be greater than 0.", "error");
      return;
    }
    if (!materialSupplier.trim()) {
      showToast("Supplier Company details required.", "error");
      return;
    }
    
    materialSubmittingRef.current = true;
    setMaterialSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      const categoryToSave = materialCategory === "Other" ? customMaterialCategory.trim() : materialCategory;
      await addMaterial({
        siteId: activeSiteId,
        engineerId,
        materialName: materialName.trim(),
        category: categoryToSave,
        requiredQuantity: Number(materialQuantity),
        quantity: 0,
        unit: materialUnit,
        unitPrice: materialUnitPrice || 0,
        supplierName: materialSupplier.trim() || "Pending Quote",
        purchaseDate: materialPurchaseDate,
        notes: materialNotes.trim(),
        invoiceUrl: materialInvoicePreview || "",
        status: "Pending" // Awaiting Admin approval
      });

      showToast("Material request submitted for Admin approval!", "success");
      handleCloseMaterialModal();
      await loadDashboardData();
    } catch (err) {
      console.error("Material submit error:", err);
      showToast(`Material submit failed: ${err.message}`, "error");
    } finally {
      materialSubmittingRef.current = false;
      if (isMountedRef.current) {
        setMaterialSubmitting(false);
      }
    }
  };

  // 5. Upload Geotagged Progress Photo
  const handlePhotoUpload = async (e) => {
    e.preventDefault();
    if (photoSubmitting || photoSubmittingRef.current) return;
    if (!activeSiteId) {
      showToast("Please select construction site.", "error");
      return;
    }
    if (!sitePhotoPreview) {
      showToast("Please select or capture photo file.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === activeSiteId);
    if (!site) {
      showToast("Selected site check failed.", "error");
      return;
    }

    const siteLat = Number(site.latitude || 28.5355);
    const siteLng = Number(site.longitude || 77.3910);
    const siteRadius = Number(site.radius || 500);

    photoSubmittingRef.current = true;
    setPhotoSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      
      const position = await getDeviceLocation();
      const userLat = position.latitude;
      const userLng = position.longitude;

      // Check distance
      const distance = calculateDistanceMeters(siteLat, siteLng, userLat, userLng);
      if (distance > siteRadius) {
        throw new Error(
          `Location Verification Error: You are ${Math.round(distance)}m away from ${site.siteName}. ` +
          `Allowed radius is ${siteRadius}m.`
        );
      }

      await saveSitePhoto(engineerId, activeSiteId, sitePhotoPreview, userLat, userLng, "Site Photo");
      showToast("Geotagged site photo uploaded to feed!", "success");

      if (isMountedRef.current) {
        setSitePhotoFile(null);
        setSitePhotoPreview(null);
      }
      await loadDashboardData();
    } catch (err) {
      console.error("Progress photo upload error:", err);
      showToast(err.message || "Failed to save photo.", "error");
    } finally {
      photoSubmittingRef.current = false;
      if (isMountedRef.current) {
        setPhotoSubmitting(false);
      }
    }
  };

  // 6. Submit Daily Progress updates
  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    if (progressSubmitting || progressSubmittingRef.current) return;
    if (!activeSiteId) {
      showToast("Please choose target project.", "error");
      return;
    }
    if (!workDescription.trim()) {
      showToast("Work description details required.", "error");
      return;
    }

    progressSubmittingRef.current = true;
    setProgressSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      const photoIds = [];

      // Save progressive log photo if attached
      if (progressPhotoPreview) {
        const site = assignedSites.find(s => s.id === activeSiteId);
        const lat = site ? Number(site.latitude) : 28.5355;
        const lng = site ? Number(site.longitude) : 77.3910;
        const photoId = await saveSitePhoto(engineerId, activeSiteId, progressPhotoPreview, lat, lng, "Progress Photo");
        photoIds.push(photoId);
      }

      // Format description to store work completed, issues, notes in same string
      const compiledDescription = 
        `Work Completed Today: ${workDescription.trim()}` +
        `\n\nCurrently Running: ${currentlyRunning.trim() || "None"}` +
        `\n\nMaterials/Work Status: ${materialsStatus.trim() || "None"}` +
        `\n\nProblems Faced: ${issuesText.trim() || "None"}` +
        `\n\nPending Work: ${pendingWork.trim() || "None"}` +
        `\n\nNext Planned Activity: ${nextActivity.trim() || "None"}` +
        `\n\nRemarks/Notes: ${notesText.trim() || "None"}`;

      await saveDailyProgressReport(
        engineerId,
        activeSiteId,
        compiledDescription,
        `${progressPercent}%`,
        photoIds,
        {
          completedToday: workDescription.trim(),
          currentlyRunning: currentlyRunning.trim(),
          materialsStatus: materialsStatus.trim(),
          problemsFaced: issuesText.trim(),
          pendingWork: pendingWork.trim(),
          nextActivity: nextActivity.trim(),
          date: progressDate
        }
      );

      showToast("Daily progress updates logged successfully!", "success");
      if (isMountedRef.current) {
        setWorkDescription("");
        setProgressPercent(50);
        setIssuesText("");
        setNotesText("");
        setCurrentlyRunning("");
        setMaterialsStatus("");
        setPendingWork("");
        setNextActivity("");
        setProgressPhotoFile(null);
        setProgressPhotoPreview(null);
      }

      await loadDashboardData();
    } catch (err) {
      console.error("Progress report log failed:", err);
      showToast(`Sync failed: ${err.message}`, "error");
    } finally {
      progressSubmittingRef.current = false;
      if (isMountedRef.current) {
        setProgressSubmitting(false);
      }
    }
  };

  // Full Screen Alert if no sites assigned
  if (assignedSites.length === 0 && !loading) {
    return (
      <div className="mobile-app-container">
        <div className="mobile-app-frame">
          <header className="mobile-app-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <CivilEngineerLogo size={24} />
              <h3>Visvas Builders</h3>
            </div>
          </header>
          <div className="mobile-app-content" style={{ display: "flex", flexDirection: "column", gap: "16px", justifyContent: "center" }}>
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              padding: "16px",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              alignItems: "center",
              gap: "16px"
            }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "50%",
                backgroundColor: "var(--accent-50)",
                color: "var(--accent-600)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "16px"
              }}>
                {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>{userProfile?.fullName || "Site Engineer"}</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>{userProfile?.email}</p>
              </div>
            </div>

            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--radius-md)",
              padding: "32px 16px",
              textAlign: "center",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "12px"
            }}>
              <AlertTriangle size={36} style={{ color: "var(--danger-500)" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-900)", margin: 0 }}>No Worksite Assigned</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", margin: 0, lineHeight: "1.5" }}>
                You do not currently have any active construction sites allocated. Please contact the project administrator to assign a site to your user profile.
              </p>
              <button
                type="button"
                className="mobile-btn-large"
                onClick={() => logout()}
                style={{ backgroundColor: "var(--danger-500)", marginTop: "12px" }}
              >
                <LogOut size={16} />
                <span>Logout Account</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Select Site Screen if multiple sites and none selected yet
  if (!activeSiteId && assignedSites.length > 1 && !loading) {
    return (
      <div className="mobile-app-container">
        {toast.show && (
          <div id="toast-container" className="toast-container">
            <div className={`toast toast-${toast.type}`}>
              <span className="toast-message">{toast.message}</span>
            </div>
          </div>
        )}
        <div className="mobile-app-frame">
          <header className="mobile-app-header" style={{ justifyContent: "space-between", height: "64px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <CivilEngineerLogo size={24} />
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-900)", margin: 0 }}>Visvas Builders</h3>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
              <div style={{
                width: "28px",
                height: "28px",
                borderRadius: "50%",
                backgroundColor: "var(--primary-100)",
                color: "var(--primary-800)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "12px"
              }}>
                {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
              </div>
            </div>
          </header>
          <div className="mobile-app-content" style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "16px" }}>
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              backgroundColor: "#ffffff",
              padding: "16px",
              borderRadius: "var(--radius-md)",
              border: "1px solid var(--border-color)",
              boxShadow: "var(--shadow-sm)",
              marginBottom: "4px"
            }}>
              <div style={{
                width: "44px",
                height: "44px",
                borderRadius: "50%",
                backgroundColor: "rgba(249, 115, 22, 0.1)",
                color: "var(--construction-orange)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "18px",
                border: "1px solid rgba(249, 115, 22, 0.2)"
              }}>
                {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                  {userProfile?.fullName || "Site Engineer"}
                </h4>
                <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
                  {userProfile?.email || "engineer@visvasbuilders.com"}
                </p>
              </div>
            </div>

            <div style={{ marginBottom: "4px" }}>
              <h4 style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-950)", margin: "0 0 4px 0" }}>My Assigned Sites</h4>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Select a construction worksite to open your dashboard.</p>
            </div>
            
            <div className="site-selection-list" style={{ overflowY: "auto", flex: 1, paddingBottom: "20px" }}>
              {assignedSites.map(site => {
                const lastAtt = getLastAttendanceForSite(site.id);
                return (
                  <div 
                    key={site.id} 
                    className="site-card-premium"
                    onClick={() => setActiveSiteId(site.id)}
                  >
                    <div className="site-card-premium-header">
                      <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                        <h4 className="site-card-premium-name">{site.siteName}</h4>
                        <div className="site-badge-group">
                          <span className={`site-badge-pill ${(site.status || 'Active').toLowerCase()}`}>
                            {site.status || "Active"}
                          </span>
                          <span className={`site-badge-pill ${site.locationStatus === "Verified" ? "verified" : "not-set"}`}>
                            {site.locationStatus === "Verified" ? "Location Verified" : "Location Not Set"}
                          </span>
                        </div>
                      </div>
                      <div style={{
                        width: "40px",
                        height: "40px",
                        borderRadius: "10px",
                        backgroundColor: "rgba(249, 115, 22, 0.08)",
                        color: "var(--construction-orange)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        border: "1px solid rgba(249, 115, 22, 0.15)",
                        flexShrink: 0
                      }}>
                        <HardHat size={22} />
                      </div>
                    </div>

                    <div className="site-card-premium-details">
                      <div className="site-card-detail-item" style={{ display: "flex", alignItems: "start", gap: "8px", fontSize: "12.5px" }}>
                        <MapPin size={14} className="site-card-detail-icon" style={{ marginTop: "2px" }} />
                        <span style={{ lineHeight: "1.4" }}>Location: <strong>{site.location || "No Address Set"}</strong></span>
                      </div>
                      <div className="site-card-detail-item" style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12.5px" }}>
                        <Calendar size={14} className="site-card-detail-icon" />
                        <span><strong>{lastAtt}</strong></span>
                      </div>
                    </div>

                    <button 
                      type="button" 
                      className="site-card-btn-open"
                      style={{ width: "100%", textTransform: "none", letterSpacing: "normal" }}
                    >
                      <span>Open Site</span>
                      <ChevronRight size={16} />
                    </button>
                  </div>
                );
              })}
            </div>

            <button
              type="button"
              className="mobile-btn-large"
              onClick={() => logout()}
              style={{ backgroundColor: "var(--danger-500)", color: "#ffffff", marginTop: "auto", display: "flex", alignItems: "center", gap: "8px", padding: "14px" }}
            >
              <LogOut size={16} />
              <span>Logout Account</span>
            </button>
          </div>
        </div>
        <Loading show={loading} text="Synchronizing Worksite Database..." />
      </div>
    );
  }

  // Active site variables
  const currentSite = assignedSites.find(s => s.id === activeSiteId) || assignedSites[0];
  const isCurrentSiteCompleted = (currentSite?.status || "").toLowerCase() === "completed" || currentSite?.isCompleted === true;

  // Helper title mapping
  const pageTitles = {
    dashboard: "Dashboard Overview",
    attendance: "Labour Attendance Tracker",
    labour: "Labour & Team Management",
    material: "Material Receipts Inventory",
    photos: "Site Inspection Photos",
    progress: "Daily Progress Log Feed"
  };
  const currentCategorySuggestions = materialMaster
    .filter(m => m.status === "Active" && m.category === materialCategory)
    .map(m => m.name);
  const filteredSuggestions = currentCategorySuggestions.filter(sug => {
    if (!materialName.trim() || currentCategorySuggestions.some(option => option.toLowerCase() === materialName.trim().toLowerCase())) {
      return true;
    }
    return sug.toLowerCase().includes(materialName.toLowerCase().trim());
  });

  const renderSubmittedLocationDetails = (site) => {
    if (!site) return null;
    
    const isPending = site.locationStatus === "Pending Approval";
    const isRejected = site.locationStatus === "Rejected";
    const isVerified = site.locationStatus === "Verified";
    
    let statusText = "No Setup Request";
    if (isPending) {
      statusText = "Waiting for Admin Approval";
    } else if (isVerified) {
      statusText = "Approved";
    } else if (isRejected) {
      statusText = "Rejected";
    }
    
    const lat = isVerified ? site.latitude : site.proposedLatitude;
    const lng = isVerified ? site.longitude : site.proposedLongitude;
    const address = isVerified ? site.location : site.proposedLocation;
    const area = isVerified ? "" : site.proposedArea;
    const street = isVerified ? "" : site.proposedStreet;
    const submittedDate = isVerified ? site.locationCreatedDate : site.proposedLocationCreatedDate;

    if (lat === undefined || lat === null) return null;

    return (
      <div style={{ 
        marginTop: "12px", 
        padding: "12px", 
        backgroundColor: "#ffffff", 
        borderRadius: "8px", 
        border: "1px solid var(--border-color, #e2e8f0)",
        display: "flex",
        flexDirection: "column",
        gap: "8px",
        boxShadow: "0 1px 3px 0 rgba(0, 0, 0, 0.05)"
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #f1f5f9", paddingBottom: "6px" }}>
          <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted, #64748b)" }}>Submitted Location Details</span>
          <span style={{ 
            fontSize: "11.5px", 
            fontWeight: "700", 
            padding: "2px 8px", 
            borderRadius: "12px",
            backgroundColor: isPending ? "var(--warning-50)" : isRejected ? "var(--danger-50)" : "var(--success-50)",
            color: isPending ? "var(--warning-700)" : isRejected ? "var(--danger-700)" : "var(--success-700)",
            border: `1px solid ${isPending ? "var(--warning-200)" : isRejected ? "var(--danger-200)" : "var(--success-200)"}`
          }}>
            {statusText}
          </span>
        </div>
        
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          <div>
            <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "600" }}>LATITUDE</span>
            <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "700", color: "#1e293b" }}>{lat ? Number(lat).toFixed(6) : "--"}</span>
          </div>
          <div>
            <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "600" }}>LONGITUDE</span>
            <span style={{ fontSize: "12px", fontFamily: "monospace", fontWeight: "700", color: "#1e293b" }}>{lng ? Number(lng).toFixed(6) : "--"}</span>
          </div>
        </div>

        <div>
          <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "600" }}>REVERSE GEOCODED ADDRESS</span>
          <span style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b", lineHeight: "1.4" }}>{address || "Fetching address..."}</span>
        </div>

        {(street || area) && (
          <div style={{ display: "grid", gridTemplateColumns: street && area ? "1fr 1fr" : "1fr", gap: "8px" }}>
            {street && (
              <div>
                <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "600" }}>STREET</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b" }}>{street}</span>
              </div>
            )}
            {area && (
              <div>
                <span style={{ display: "block", fontSize: "10px", color: "#64748b", fontWeight: "600" }}>AREA</span>
                <span style={{ fontSize: "12px", fontWeight: "600", color: "#1e293b" }}>{area}</span>
              </div>
            )}
          </div>
        )}

        {submittedDate && (
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "6px", fontSize: "11px" }}>
            <span style={{ color: "#64748b", fontWeight: "500" }}>SUBMITTED ON</span>
            <span style={{ fontWeight: "600", color: "#1e293b" }}>
              {new Date(submittedDate).toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" })}
            </span>
          </div>
        )}
      </div>
    );
  };

  // Attendance History Helpers and Views
  const getTodayStr = () => new Date().toISOString().split("T")[0];

  const getDatesForThisWeek = () => {
    const dates = [];
    const todayStr = getTodayStr();
    const todayParts = todayStr.split("-");
    const today = new Date(Date.UTC(parseInt(todayParts[0], 10), parseInt(todayParts[1], 10) - 1, parseInt(todayParts[2], 10)));
    
    const currentDay = today.getUTCDay(); // 0 is Sunday, 1 is Monday...
    const distanceToMonday = currentDay === 0 ? 6 : currentDay - 1;
    
    const monday = new Date(today);
    monday.setUTCDate(today.getUTCDate() - distanceToMonday);
    
    let current = new Date(monday);
    while (current <= today) {
      dates.push(current.toISOString().split("T")[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates.reverse();
  };

  const getDatesForThisMonth = () => {
    const dates = [];
    const todayStr = getTodayStr();
    const todayParts = todayStr.split("-");
    const today = new Date(Date.UTC(parseInt(todayParts[0], 10), parseInt(todayParts[1], 10) - 1, parseInt(todayParts[2], 10)));
    
    const startOfMonth = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), 1));
    
    let current = new Date(startOfMonth);
    while (current <= today) {
      dates.push(current.toISOString().split("T")[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates.reverse();
  };

  const getDatesForCustomRange = (startStr, endStr) => {
    if (!startStr || !endStr) return [];
    const dates = [];
    const startParts = startStr.split("-");
    const endParts = endStr.split("-");
    
    const start = new Date(Date.UTC(parseInt(startParts[0], 10), parseInt(startParts[1], 10) - 1, parseInt(startParts[2], 10)));
    const end = new Date(Date.UTC(parseInt(endParts[0], 10), parseInt(endParts[1], 10) - 1, parseInt(endParts[2], 10)));
    
    const todayStr = getTodayStr();
    const todayParts = todayStr.split("-");
    const today = new Date(Date.UTC(parseInt(todayParts[0], 10), parseInt(todayParts[1], 10) - 1, parseInt(todayParts[2], 10)));
    
    const cappedEnd = end > today ? today : end;
    if (start > cappedEnd) return [];

    let current = new Date(start);
    while (current <= cappedEnd) {
      dates.push(current.toISOString().split("T")[0]);
      current.setUTCDate(current.getUTCDate() + 1);
    }
    return dates.reverse();
  };

  const getStatusTheme = (status) => {
    switch (status) {
      case "Present":
        return {
          bg: "#f0fdf4",
          border: "1px solid #bbf7d0",
          color: "#15803d",
          badgeBg: "#dcfce7",
          badgeColor: "#166534",
          statusText: "Present"
        };
      case "Leave":
        return {
          bg: "#fff7ed",
          border: "1px solid #fed7aa",
          color: "#c2410c",
          badgeBg: "#ffedd5",
          badgeColor: "#9a3412",
          statusText: "Leave"
        };
      case "Absent":
      default:
        return {
          bg: "#fef2f2",
          border: "1px solid #fecaca",
          color: "#b91c1c",
          badgeBg: "#fee2e2",
          badgeColor: "#991b1b",
          statusText: "Absent"
        };
    }
  };

  const formatToIndianDate = (dateStr, timestamp) => {
    if (timestamp) {
      let dateObj;
      if (timestamp.toDate && typeof timestamp.toDate === "function") {
        dateObj = timestamp.toDate();
      } else if (timestamp.seconds !== undefined) {
        dateObj = new Date(timestamp.seconds * 1000);
      } else {
        dateObj = new Date(timestamp);
      }
      if (!isNaN(dateObj.getTime())) {
        return dateObj.toLocaleDateString('en-IN', {
          timeZone: 'Asia/Kolkata',
          day: '2-digit',
          month: '2-digit',
          year: 'numeric'
        }).replace(/\//g, '/');
      }
    }
    
    if (dateStr) {
      const parts = dateStr.split("-");
      if (parts.length === 3) {
        return `${parts[2]}/${parts[1]}/${parts[0]}`;
      }
    }
    return dateStr || "--";
  };

  const formatToIndianTime = (timestamp) => {
    if (!timestamp) return { date: "--", time: "--" };
    
    let dateObj;
    if (timestamp.toDate && typeof timestamp.toDate === "function") {
      dateObj = timestamp.toDate();
    } else if (timestamp.seconds !== undefined) {
      dateObj = new Date(timestamp.seconds * 1000);
    } else {
      dateObj = new Date(timestamp);
    }
    
    if (isNaN(dateObj.getTime())) {
      return { date: "--", time: "--" };
    }

    const timeStr = dateObj.toLocaleTimeString('en-IN', {
      timeZone: 'Asia/Kolkata',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    return { time: timeStr };
  };

  const getEntryTime = (record) => {
    if (!record) return "--";
    if (record.time) return record.time;
    if (record.timestamp) {
      const local = formatToIndianTime(record.timestamp);
      return local.time;
    }
    return "--";
  };

  const renderHistoryDetailsModalContent = () => {
    if (!selectedRecord) return null;
    const { dateStr, status, attRecord, leaveRecord, siteName, radiusStatus, displayDate } = selectedRecord;
    const theme = getStatusTheme(status);

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px", padding: "4px" }}>
        <div style={{
          padding: "12px",
          borderRadius: "8px",
          backgroundColor: theme.bg,
          border: theme.border,
          textAlign: "center"
        }}>
          <span style={{
            fontSize: "14px",
            fontWeight: "800",
            color: theme.badgeColor,
            textTransform: "uppercase",
            letterSpacing: "0.5px"
          }}>
            {theme.statusText}
          </span>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
            <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Date</span>
            <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--primary-900)" }}>{displayDate}</span>
          </div>

          {status === "Present" && attRecord && (
            <>
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Entry Time</span>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--primary-900)" }}>{getEntryTime(attRecord)}</span>
              </div>
              
              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Assigned Site</span>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--primary-900)" }}>{siteName}</span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>GPS Coordinates</span>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--primary-900)", fontFamily: "monospace" }}>
                  {attRecord.latitude?.toFixed(6)}, {attRecord.longitude?.toFixed(6)}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>GPS Accuracy</span>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--primary-900)" }}>
                  {attRecord.gpsAccuracy ? `${attRecord.gpsAccuracy}m` : "N/A"}
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>GPS Verification Status</span>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--success-600)" }}>
                  Verified
                </span>
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>50m Radius Verification</span>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: radiusStatus.includes("Failed") ? "var(--danger-600)" : "var(--success-600)" }}>
                  {radiusStatus}
                </span>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Captured Location Address</span>
                <span style={{ fontSize: "12px", color: "var(--primary-900)", lineHeight: "1.4" }}>
                  {attRecord.address || "No address logged."}
                </span>
              </div>

              {attRecord.photoUrl && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", marginTop: "8px" }}>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Attendance Photo</span>
                  <div style={{ width: "100%", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)", height: "240px" }}>
                    <a href={attRecord.photoUrl} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={attRecord.photoUrl} 
                        alt="Attendance" 
                        style={{ width: "100%", height: "100%", objectFit: "cover" }} 
                      />
                    </a>
                  </div>
                </div>
              )}
            </>
          )}

          {status === "Leave" && leaveRecord && (
            <>
              <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Reason for Leave</span>
                <span style={{ fontSize: "13px", color: "var(--primary-900)", lineHeight: "1.4" }}>
                  {leaveRecord.reason || "Personal Leave"}
                </span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", borderTop: "1px solid var(--border-color)", paddingTop: "8px" }}>
                <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>GPS Verification</span>
                <span style={{ fontSize: "12.5px", fontWeight: "700", color: "var(--text-muted)" }}>N/A (Approved Leave)</span>
              </div>
            </>
          )}

          {status === "Absent" && (
            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              <span style={{ fontSize: "12.5px", color: "var(--danger-600)", fontWeight: "600", lineHeight: "1.4" }}>
                No check-in or approved leave was recorded for this date.
              </span>
            </div>
          )}
        </div>

        <button
          type="button"
          onClick={() => {
            setIsHistoryModalOpen(false);
            setSelectedRecord(null);
          }}
          className="mobile-btn-large primary"
          style={{ width: "100%", marginTop: "12px" }}
        >
          Close Details
        </button>
      </div>
    );
  };

  const renderAttendanceHistoryView = () => {
    let datesList = [];
    const todayStr = getTodayStr();
    
    if (historyFilter === "today") {
      datesList = [todayStr];
    } else if (historyFilter === "this-week") {
      datesList = getDatesForThisWeek();
    } else if (historyFilter === "this-month") {
      datesList = getDatesForThisMonth();
    } else if (historyFilter === "custom") {
      datesList = getDatesForCustomRange(customStartDate, customEndDate);
    }
    
    const attendanceMap = new Map(allSitesAttendance.map(r => [r.date, r]));
    const approvedLeaveDates = new Set(loggedLeaves.filter(l => l.status === "approved").map(l => l.date));
    const leavesMap = new Map(loggedLeaves.map(l => [l.date, l]));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        <div style={{
          display: "flex",
          backgroundColor: "var(--primary-100)",
          borderRadius: "8px",
          padding: "4px",
          gap: "4px"
        }}>
          {["today", "this-week", "this-month", "custom"].map(f => (
            <button
              key={f}
              type="button"
              onClick={() => setHistoryFilter(f)}
              style={{
                flex: 1,
                padding: "8px 4px",
                borderRadius: "6px",
                fontSize: "12px",
                fontWeight: "700",
                border: "none",
                cursor: "pointer",
                backgroundColor: historyFilter === f ? "#ffffff" : "transparent",
                color: historyFilter === f ? "var(--primary-900)" : "var(--text-muted)",
                boxShadow: historyFilter === f ? "0 1px 3px rgba(0,0,0,0.1)" : "none",
                transition: "all 0.2s"
              }}
            >
              {f === "today" ? "Today" : f === "this-week" ? "This Week" : f === "this-month" ? "This Month" : "Custom"}
            </button>
          ))}
        </div>

        {historyFilter === "custom" && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: "10px",
            backgroundColor: "#ffffff",
            padding: "12px",
            borderRadius: "8px",
            border: "1px solid var(--border-color)"
          }}>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>Start Date</label>
              <input
                type="date"
                value={customStartDate}
                max={todayStr}
                onChange={(e) => setCustomStartDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "12px"
                }}
              />
            </div>
            <div>
              <label style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)", display: "block", marginBottom: "4px" }}>End Date</label>
              <input
                type="date"
                value={customEndDate}
                max={todayStr}
                onChange={(e) => setCustomEndDate(e.target.value)}
                style={{
                  width: "100%",
                  padding: "8px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "6px",
                  fontSize: "12px"
                }}
              />
            </div>
          </div>
        )}

        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr",
          gap: "8px",
          backgroundColor: "var(--primary-900)",
          color: "#ffffff",
          padding: "12px",
          borderRadius: "12px",
          textAlign: "center"
        }}>
          {(() => {
            let presentCount = 0;
            let leaveCount = 0;
            let absentCount = 0;
            
            datesList.forEach(d => {
              if (attendanceMap.has(d)) presentCount++;
              else if (approvedLeaveDates.has(d)) leaveCount++;
              else absentCount++;
            });

            return (
              <>
                <div>
                  <span style={{ fontSize: "10px", opacity: 0.8, display: "block", textTransform: "uppercase" }}>Present</span>
                  <strong style={{ fontSize: "18px", fontWeight: "800", color: "#86efac" }}>{presentCount}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "10px", opacity: 0.8, display: "block", textTransform: "uppercase" }}>Leave</span>
                  <strong style={{ fontSize: "18px", fontWeight: "800", color: "#fcd34d" }}>{leaveCount}</strong>
                </div>
                <div>
                  <span style={{ fontSize: "10px", opacity: 0.8, display: "block", textTransform: "uppercase" }}>Absent</span>
                  <strong style={{ fontSize: "18px", fontWeight: "800", color: "#fca5a5" }}>{absentCount}</strong>
                </div>
              </>
            );
          })()}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {datesList.length === 0 ? (
            <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-muted)", fontSize: "13px", fontStyle: "italic" }}>
              No dates in the selected range.
            </div>
          ) : (
            datesList.map(dateStr => {
              const attRecord = attendanceMap.get(dateStr);
              const isApprovedLeave = approvedLeaveDates.has(dateStr);
              const leaveRecord = leavesMap.get(dateStr);
              
              let status = "Absent";
              if (attRecord) {
                status = "Present";
              } else if (isApprovedLeave) {
                status = "Leave";
              }
              
              const theme = getStatusTheme(status);
              const displayDate = formatToIndianDate(dateStr, attRecord?.timestamp);
              const siteObj = attRecord ? allSites.find(s => s.id === attRecord.siteId) : null;
              const siteName = siteObj ? siteObj.siteName : (attRecord ? "Registered Site" : "--");
              
              let radiusStatus = "--";
              let radiusColor = "var(--text-muted)";
              if (status === "Present" && attRecord) {
                const distance = attRecord.distance;
                if (distance !== undefined && distance !== null) {
                  if (distance <= 50) {
                    radiusStatus = `Within 50m (${Math.round(distance)}m)`;
                    radiusColor = "var(--success-600)";
                  } else {
                    radiusStatus = `Outside 50m (${Math.round(distance)}m)`;
                    radiusColor = "var(--danger-600)";
                  }
                } else {
                  if (siteObj && siteObj.latitude && siteObj.longitude && attRecord.latitude && attRecord.longitude) {
                    const dist = calculateDistanceMeters(
                      Number(siteObj.latitude),
                      Number(siteObj.longitude),
                      attRecord.latitude,
                      attRecord.longitude
                    );
                    if (dist <= 50) {
                      radiusStatus = `Within 50m (${Math.round(dist)}m)`;
                      radiusColor = "var(--success-600)";
                    } else {
                      radiusStatus = `Outside 50m (${Math.round(dist)}m)`;
                      radiusColor = "var(--danger-600)";
                    }
                  } else {
                    radiusStatus = "Verified (Legacy)";
                    radiusColor = "var(--success-600)";
                  }
                }
              }

              return (
                <div 
                  key={dateStr}
                  onClick={() => {
                    setSelectedRecord({ dateStr, status, attRecord, leaveRecord, siteName, radiusStatus, displayDate });
                    setIsHistoryModalOpen(true);
                  }}
                  style={{
                    backgroundColor: theme.bg,
                    border: theme.border,
                    borderRadius: "12px",
                    padding: "16px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                    cursor: "pointer",
                    boxShadow: "var(--shadow-sm)",
                    transition: "transform 0.15s ease",
                  }}
                  className="attendance-history-card"
                >
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <strong style={{ fontSize: "14px", color: "var(--primary-900)", display: "block" }}>
                        {displayDate}
                      </strong>
                      <span style={{ fontSize: "12px", color: "var(--text-muted)" }}>
                        {status === "Present" ? `Site: ${siteName}` : status === "Leave" ? "Leave Approved" : "Absent / No Activity"}
                      </span>
                    </div>
                    <span style={{
                      padding: "4px 10px",
                      borderRadius: "50px",
                      fontSize: "11px",
                      fontWeight: "700",
                      backgroundColor: theme.badgeBg,
                      color: theme.badgeColor,
                      textTransform: "uppercase"
                    }}>
                      {theme.statusText}
                    </span>
                  </div>

                  {status === "Present" && attRecord && (
                    <div style={{
                      display: "flex",
                      gap: "12px",
                      alignItems: "center",
                      borderTop: "1px solid var(--border-color)",
                      paddingTop: "10px",
                      marginTop: "4px"
                    }}>
                      {attRecord.photoUrl ? (
                        <div style={{ width: "40px", height: "40px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)", flexShrink: 0 }}>
                          <img src={attRecord.photoUrl} alt="Attendance" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        </div>
                      ) : (
                        <div style={{ width: "40px", height: "40px", borderRadius: "6px", backgroundColor: "var(--primary-100)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Camera size={16} style={{ color: "var(--primary-600)" }} />
                        </div>
                      )}
                      <div style={{ display: "flex", flexDirection: "column", gap: "2px", flex: 1, minWidth: 0 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-950)" }}>
                            Checked In: {getEntryTime(attRecord)}
                          </span>
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "2px" }}>
                          <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "2px" }}>
                            <MapPin size={10} /> {attRecord.latitude?.toFixed(4)}, {attRecord.longitude?.toFixed(4)}
                          </span>
                          <span style={{ fontSize: "11px", color: radiusColor, fontWeight: "600" }}>
                            Radius: {radiusStatus}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {status === "Leave" && leaveRecord && (
                    <div style={{
                      borderTop: "1px solid var(--border-color)",
                      paddingTop: "8px",
                      fontSize: "11.5px",
                      color: "var(--text-muted)",
                      marginTop: "4px"
                    }}>
                      <strong>Reason:</strong> {leaveRecord.reason || "Personal Leave"}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>

        <Modal
          isOpen={isHistoryModalOpen}
          onClose={() => {
            setIsHistoryModalOpen(false);
            setSelectedRecord(null);
          }}
          title="Attendance Record Details"
          maxWidth="420px"
        >
          {selectedRecord && renderHistoryDetailsModalContent()}
        </Modal>

      </div>
    );
  };

  // Mobile UI Render Views
  const renderHomeView = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Completed Site Read-Only Banner */}
        {isCurrentSiteCompleted && (
          <div style={{
            backgroundColor: "#f0fdf4",
            border: "1.5px solid #bbf7d0",
            borderRadius: "14px",
            padding: "14px 16px",
            display: "flex",
            alignItems: "center",
            gap: "10px",
            boxShadow: "0 1px 3px rgba(0,0,0,0.03)"
          }}>
            <Lock size={20} style={{ color: "#166534", flexShrink: 0 }} />
            <div>
              <strong style={{ fontSize: "13px", color: "#14532d", display: "block" }}>
                COMPLETED / READ-ONLY ARCHIVE
              </strong>
              <span style={{ fontSize: "11.5px", color: "#15803d" }}>
                This site has been marked as Completed by Admin. Historical logs remain viewable, but new operational entries are locked.
              </span>
            </div>
          </div>
        )}

        {/* Site Card */}
        <div className="mobile-site-card">
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mobile-site-card-badge">
              {isCurrentSiteCompleted ? "Completed / Archive" : "Active Assignment"}
            </span>
            {isCurrentSiteCompleted && (
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#166534", backgroundColor: "#f0fdf4", border: "1px solid #bbf7d0", padding: "2px 8px", borderRadius: "100px", display: "inline-flex", alignItems: "center", gap: "4px" }}>
                <Lock size={11} /> Read-Only
              </span>
            )}
          </div>
          <h4 className="mobile-site-card-title">{currentSite ? currentSite.siteName : "No Assigned Worksite"}</h4>
          {currentSite && (
            <p className="mobile-site-card-loc">
              <MapPin size={14} /> {currentSite.location}
            </p>
          )}
          
          {assignedSites.length > 1 && (
            <select
              className="mobile-site-card-select"
              value={activeSiteId}
              onChange={(e) => setActiveSiteId(e.target.value)}
            >
              {assignedSites.map(s => (
                <option key={s.id} value={s.id}>{s.siteName}</option>
              ))}
            </select>
          )}

          {currentSite && currentSite.locationStatus === "Verified" && (
            <div style={{ marginTop: "12px", borderTop: "1px dashed var(--border-color)", paddingTop: "8px" }}>
              <button
                type="button"
                onClick={() => setShowLocationDetails(!showLocationDetails)}
                style={{
                  background: "none",
                  border: "none",
                  color: "#ffffff",
                  fontSize: "12px",
                  fontWeight: "750",
                  cursor: "pointer",
                  padding: 0,
                  display: "flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                {showLocationDetails ? "Hide Location Details" : "View Established Location Details"}
              </button>
              {showLocationDetails && renderSubmittedLocationDetails(currentSite)}
            </div>
          )}
        </div>

        {/* Attendance checklist widget */}
        {(() => {
          const isMarkedForActiveSite = todayAttendance && String(todayAttendance.siteId || "").trim() === String(activeSiteId || "").trim();
          return (
            <div className={`mobile-attendance-card ${isMarkedForActiveSite ? 'checked' : 'unchecked'}`} style={{ height: "auto", padding: "16px" }}>
              <div className="mobile-attendance-left">
                <span className="mobile-attendance-status-label">Your Attendance Status</span>
                <div className={`mobile-attendance-status-val ${isMarkedForActiveSite ? 'checked' : 'unchecked'}`}>
                  {isMarkedForActiveSite ? '✓ Checked In Present' : '✗ Not Marked Today'}
                </div>
                {isMarkedForActiveSite && (
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                    Check-In: {todayAttendance.time || "Today"}
                  </span>
                )}
                <button
                  type="button"
                  onClick={() => navigate("/engineer/attendance-history")}
                  style={{
                    background: "none",
                    border: "none",
                    color: "var(--primary-700)",
                    fontSize: "11.5px",
                    fontWeight: "700",
                    cursor: "pointer",
                    padding: 0,
                    marginTop: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <History size={12} /> View Attendance History →
                </button>
              </div>
              {!isMarkedForActiveSite && savedSiteLocation && (
                <button 
                  type="button" 
                  onClick={() => {
                    setAttendanceMode("checkin");
                    navigate("/engineer/attendance");
                  }} 
                  className="mobile-attendance-btn"
                >
                  Check In
                </button>
              )}
            </div>
          );
        })()}

        {!savedSiteLocation && (
          <div className="mobile-attendance-card" style={{ border: "1.5px dashed var(--danger-500)", backgroundColor: "var(--danger-50)", flexDirection: "column", alignItems: "stretch", gap: "12px", height: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={18} style={{ color: "var(--danger-600)" }} />
                <span style={{ fontWeight: "800", color: "var(--primary-900)", fontSize: "14px" }}>Site GPS Coordinates Not Set</span>
              </div>
              <Badge status="inactive">Action Required</Badge>
            </div>
            <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
              The official coordinates for this site have not been set by the Admin yet. Please contact your administrator to configure the location on the Admin Panel.
            </p>
          </div>
        )}



        {/* Quick Actions Grid */}
        <div style={{ marginTop: "8px" }}>
          <span className="mobile-form-label">Field Quick Operations</span>
          <div className="mobile-quick-action-grid">
            
            {/* Check In Action */}
            {(() => {
              const isMarkedForActiveSite = todayAttendance && String(todayAttendance.siteId || "").trim() === String(activeSiteId || "").trim();
              return (
                <button 
                  type="button"
                  className="mobile-action-card attendance"
                  onClick={() => {
                    setAttendanceMode("checkin");
                    navigate("/engineer/attendance");
                  }}
                  disabled={!!isMarkedForActiveSite}
                  style={{ opacity: isMarkedForActiveSite ? 0.5 : 1, border: "none", cursor: isMarkedForActiveSite ? "not-allowed" : "pointer" }}
                >
                  <div className="mobile-action-icon-wrapper" style={{ backgroundColor: "var(--success-50)", color: "var(--success-700)" }}>
                    <ClipboardCheck size={20} />
                  </div>
                  <span className="mobile-action-title">Check In</span>
                </button>
              );
            })()}


            {/* Add Progress */}
            <button 
              type="button"
              className="mobile-action-card progress" 
              onClick={() => navigate("/engineer/progress")}
              style={{ border: "none", cursor: "pointer" }}
            >
              <div className="mobile-action-icon-wrapper" style={{ backgroundColor: "var(--primary-50)", color: "var(--primary-700)" }}>
                <TrendingUp size={20} />
              </div>
              <span className="mobile-action-title">Add Progress</span>
            </button>

            {/* Upload Photo */}
            <button 
              type="button"
              className="mobile-action-card photos" 
              onClick={() => navigate("/engineer/photos")}
              style={{ border: "none", cursor: "pointer" }}
            >
              <div className="mobile-action-icon-wrapper" style={{ backgroundColor: "var(--accent-50)", color: "var(--accent-700)" }}>
                <Camera size={20} />
              </div>
              <span className="mobile-action-title">Upload Photo</span>
            </button>

            {/* View Tasks */}
            <button 
              type="button"
              className="mobile-action-card labour" 
              onClick={() => navigate("/engineer/more")}
              style={{ border: "none", cursor: "pointer" }}
            >
              <div className="mobile-action-icon-wrapper" style={{ backgroundColor: "#f1f5f9", color: "#475569" }}>
                <Sliders size={20} />
              </div>
              <span className="mobile-action-title">View Tasks & Tools</span>
            </button>

          </div>
        </div>

        {/* Notification Center */}
        {notifications && notifications.length > 0 && (
          <div style={{ marginTop: "12px" }}>
            <span className="mobile-form-label">Alerts & Field Updates</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "6px" }}>
              {notifications.slice(0, 3).map((notif) => (
                <div 
                  key={notif.id} 
                  style={{
                    backgroundColor: notif.isRead ? "#f8fafc" : "#fff7ed",
                    border: `1.5px solid ${notif.isRead ? "var(--border-color)" : "#ffedd5"}`,
                    padding: "12px",
                    borderRadius: "8px",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "flex-start",
                    gap: "8px"
                  }}
                >
                  <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                      <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: notif.isRead ? "var(--text-muted)" : "var(--primary-700)" }}>
                        {notif.moduleType || "Notification"}
                      </span>
                      {!notif.isRead && (
                        <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "var(--primary-600)" }} />
                      )}
                    </div>
                    <strong style={{ fontSize: "13px", color: "var(--primary-950)" }}>{notif.title}</strong>
                    <span style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "2px" }}>{notif.description}</span>
                  </div>
                  {!notif.isRead && (
                    <button
                      type="button"
                      onClick={() => handleMarkNotificationRead(notif.id)}
                      style={{
                        background: "none",
                        border: "none",
                        color: "var(--primary-600)",
                        fontSize: "11px",
                        fontWeight: "700",
                        cursor: "pointer",
                        padding: "2px 6px"
                      }}
                    >
                      Dismiss
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAttendanceView = () => {
    // 1. If today's attendance for active site is already marked / completed, ALWAYS render the confirmed card
    const isMarkedForActiveSite = todayAttendance && String(todayAttendance.siteId || "").trim() === String(activeSiteId || "").trim();
    if (isMarkedForActiveSite) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Site Check-In Verification</h4>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Today Attendance — Marked / Completed</p>
          </div>

          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            padding: "24px 16px",
            boxShadow: "var(--shadow-sm)",
            textAlign: "center",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            gap: "16px"
          }}>
            <div style={{
              width: "56px",
              height: "56px",
              borderRadius: "50%",
              backgroundColor: "var(--success-50)",
              color: "var(--success-600)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center"
            }}>
              <CheckCircle2 size={32} />
            </div>
            <div>
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--success-700)" }}>
                Today Attendance Marked / Completed
              </h4>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                You are marked present at the construction site today.
              </p>
            </div>
            
            <div style={{
              width: "100%",
              backgroundColor: "var(--primary-50)",
              borderRadius: "8px",
              border: "1px solid var(--border-color)",
              padding: "12px",
              textAlign: "left",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              fontSize: "12px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Worksite:</span>
                <strong style={{ color: "var(--primary-900)" }}>
                  {(() => {
                    const checkInSite = assignedSites.find(s => s.id === todayAttendance.siteId);
                    return checkInSite ? checkInSite.siteName : currentSite?.siteName || "Assigned Site";
                  })()}
                </strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Check-In Time:</span>
                <strong style={{ color: "var(--primary-900)" }}>{todayAttendance.time || "Today"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Status:</span>
                <strong style={{ color: "var(--success-700)", textTransform: "capitalize" }}>{todayAttendance.status || "Present"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Check-In GPS:</span>
                <strong style={{ color: "var(--primary-900)", wordBreak: "break-all", textAlign: "right" }}>{todayAttendance.address || todayAttendance.gpsLocationAddress || (todayAttendance.latitude ? `${Number(todayAttendance.latitude).toFixed(4)}, ${Number(todayAttendance.longitude).toFixed(4)}` : "Verified Boundary")}</strong>
              </div>
            </div>

            {todayAttendance.photoUrl && (
              <div style={{ width: "100%", height: "160px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <img src={todayAttendance.photoUrl} alt="Checked in verification" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>
        </div>
      );
    }

    if (!savedSiteLocation) {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ textAlign: "center", marginBottom: "8px" }}>
            <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Site Check-In Verification</h4>
            <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Enforce location-tagged photo capture within worksite boundaries</p>
          </div>
          <div className="mobile-attendance-card" style={{ border: "1.5px dashed var(--danger-500)", backgroundColor: "var(--danger-50)", flexDirection: "column", alignItems: "stretch", gap: "12px", height: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <MapPin size={18} style={{ color: "var(--danger-600)" }} />
                <span style={{ fontWeight: "800", color: "var(--primary-900)", fontSize: "14px" }}>Site GPS Coordinates Not Set</span>
              </div>
              <Badge status="inactive">Action Required</Badge>
            </div>
            <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", lineHeight: "1.5", textAlign: "left" }}>
              The official coordinates for this construction worksite have not been set by the Admin yet. Please request your administrator to configure the GPS location using Google Maps in the Admin Control Panel.
            </p>
          </div>
        </div>
      );
    }

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            {locationCheckStatus === "unchecked" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", justifyContent: "center", padding: "32px 16px", backgroundColor: "#ffffff", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{
                  width: "64px",
                  height: "64px",
                  borderRadius: "50%",
                  backgroundColor: "var(--accent-50)",
                  color: "var(--accent-600)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  marginBottom: "8px"
                }}>
                  <ClipboardCheck size={36} />
                </div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Worksite Attendance</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", textAlign: "center", maxWidth: "280px" }}>
                  Verify your location and take a photo to check in for today's shift.
                </p>
                <button
                  type="button"
                  className="mobile-btn-large"
                  onClick={() => {
                    setAttendanceMode("checkin");
                    handlePreCaptureCheck();
                  }}
                  style={{ marginTop: "12px", width: "100%" }}
                >
                  Mark Attendance
                </button>
              </div>
            )}

            {locationCheckStatus === "checking" && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px", alignItems: "center", justifyContent: "center", padding: "48px 16px", backgroundColor: "#ffffff", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <div className="loader" style={{ borderTopColor: "var(--accent-600)" }} />
                <span style={{ fontSize: "14px", fontWeight: "700", color: "var(--primary-800)" }}>Checking your site location...</span>
                <span style={{ fontSize: "11px", color: "var(--text-muted)", textAlign: "center" }}>Please hold on while we retrieve high accuracy GPS coordinates.</span>
              </div>
            )}

            {locationCheckStatus === "warning" && (
              <div style={{
                backgroundColor: "#ffffff",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                padding: "24px 16px",
                boxShadow: "var(--shadow-sm)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px"
              }}>
                <div style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "var(--danger-50)",
                  color: "var(--danger-600)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <AlertTriangle size={32} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Location Access Required</h4>
                  <p style={{ margin: "6px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Location access is required to verify your site attendance.
                  </p>
                </div>
                
                {locationError && (
                  <div style={{
                    backgroundColor: "var(--danger-50)",
                    color: "var(--danger-600)",
                    padding: "12px 14px",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--danger-100)",
                    fontSize: "12px",
                    textAlign: "left",
                    width: "100%",
                    lineHeight: "1.4"
                  }}>
                    <strong>Status:</strong> {locationError}
                    <div style={{ marginTop: "8px", fontSize: "11px", opacity: 0.9 }}>
                      💡 <strong>How to enable:</strong> Make sure your device GPS/Location switch is turned ON. If permission is blocked, go to browser settings, reset location permissions for this site, and refresh.
                    </div>
                  </div>
                )}

                <button
                  type="button"
                  onClick={handleEnableLocation}
                  className="mobile-btn-large"
                  style={{ width: "100%" }}
                >
                  <MapPin size={18} />
                  <span>Enable Location</span>
                </button>
              </div>
            )}

            {locationCheckStatus === "granted" && verificationStatus === "success" && (
              <>
                {!attendancePhotoPreview ? (
                  <div style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    padding: "24px 16px",
                    boxShadow: "var(--shadow-sm)",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "16px"
                  }}>
                    <div style={{
                      width: "56px",
                      height: "56px",
                      borderRadius: "50%",
                      backgroundColor: "var(--success-50)",
                      color: "var(--success-600)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center"
                    }}>
                      <CheckCircle2 size={32} />
                    </div>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--success-700)" }}>Site Verified Successfully</h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                        You are physically present within the allowed boundary of this worksite.
                      </p>
                    </div>

                    <div style={{
                      width: "100%",
                      backgroundColor: "var(--primary-50)",
                      borderRadius: "8px",
                      border: "1px solid var(--border-color)",
                      padding: "12px",
                      textAlign: "left",
                      fontSize: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "6px"
                    }}>
                      <div><strong>Assigned Site:</strong> {verificationDetails?.expectedSiteName}</div>
                      <div><strong>Address:</strong> {verificationDetails?.capturedAddress}</div>
                      <div><strong>Distance:</strong> {verificationDetails?.distance} meters from center</div>
                    </div>

                    <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--text-muted)", textTransform: "uppercase" }}>Capture Attendance Photo</span>

                    <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                      <button
                        type="button"
                        className="mobile-btn-large"
                        style={{ flex: 1 }}
                        onClick={() => startWebRTCCamera("user")}
                      >
                        <Camera size={18} />
                        <span>Front Camera</span>
                      </button>
                      <button
                        type="button"
                        className="mobile-btn-large"
                        style={{ flex: 1 }}
                        onClick={() => startWebRTCCamera("environment")}
                      >
                        <Camera size={18} />
                        <span>Back Camera</span>
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{
                    backgroundColor: "#ffffff",
                    borderRadius: "var(--radius-md)",
                    border: "1px solid var(--border-color)",
                    padding: "16px",
                    boxShadow: "var(--shadow-sm)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "14px"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <span style={{ fontSize: "12px", fontWeight: "800", textTransform: "uppercase", color: "var(--text-muted)" }}>GPS Result</span>
                      <Badge status="success">Location Verified</Badge>
                    </div>

                    <div style={{ width: "100%", height: "200px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)", position: "relative" }}>
                      <img src={attendancePhotoPreview} alt="Captured Check-in" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      <button
                        type="button"
                        onClick={() => setAttendancePhotoPreview(null)}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          backgroundColor: "rgba(0,0,0,0.6)",
                          color: "#ffffff",
                          border: "none",
                          borderRadius: "50%",
                          width: "28px",
                          height: "28px",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer"
                        }}
                      >
                        <X size={16} />
                      </button>
                    </div>

                    <div style={{
                      backgroundColor: "var(--success-50)",
                      borderRadius: "8px",
                      border: "1.5px solid var(--success-100)",
                      padding: "12px",
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                      fontSize: "12px",
                      color: "var(--success-800)"
                    }}>
                      <div style={{ fontWeight: "700" }}>✓ Site Verified: {verificationDetails?.expectedSiteName}</div>
                      <div><strong>Location:</strong> {verificationDetails?.capturedAddress}</div>
                      <div><strong>Distance:</strong> {verificationDetails?.distance} meters from center</div>
                    </div>

                    <div style={{ display: "flex", gap: "10px" }}>
                      <button
                        type="button"
                        className="mobile-btn-large"
                        style={{ backgroundColor: "var(--primary-200)", color: "var(--primary-800)", flex: 1, boxShadow: "none" }}
                        onClick={() => setAttendancePhotoPreview(null)}
                      >
                        Retake
                      </button>
                      <button
                        type="button"
                        onClick={handleMarkAttendance}
                        disabled={attendanceSubmitting}
                        className="mobile-btn-large success"
                        style={{ flex: 1.5 }}
                      >
                        {attendanceSubmitting ? "Submitting..." : attendanceMode === "checkout" ? "Submit Check Out" : "Submit Present"}
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {locationCheckStatus === "granted" && verificationStatus === "failed" && (
              <div style={{
                backgroundColor: "#ffffff",
                borderRadius: "var(--radius-md)",
                border: "1px solid var(--border-color)",
                padding: "24px 16px",
                boxShadow: "var(--shadow-sm)",
                textAlign: "center",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                gap: "16px"
              }}>
                <div style={{
                  width: "56px",
                  height: "56px",
                  borderRadius: "50%",
                  backgroundColor: "var(--danger-50)",
                  color: "var(--danger-600)",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center"
                }}>
                  <AlertCircle size={32} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--danger-600)" }}>
                    {verificationDetails?.message || "Site Verification Failed"}
                  </h4>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    {verificationDetails?.details || "Site verification failed. Please try again."}
                  </p>
                </div>

                {!verificationDetails?.isLocationConfigError && verificationDetails?.distance !== undefined && (
                  <div style={{
                    width: "100%",
                    backgroundColor: "var(--danger-50)",
                    borderRadius: "8px",
                    border: "1px solid var(--danger-100)",
                    padding: "14px 12px",
                    textAlign: "left",
                    fontSize: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                    color: "var(--danger-700)",
                    lineHeight: "1.4"
                  }}>
                    <div><strong>Assigned Site:</strong> {verificationDetails?.expectedSiteName || "N/A"}</div>
                    <div><strong>Current Location:</strong> {verificationDetails?.capturedAddress || "N/A"}</div>
                    <div><strong>Distance difference:</strong> {verificationDetails?.distance} meters away (Allowed: {verificationDetails?.allowedRadius || 100}m)</div>
                  </div>
                )}

                <div style={{ display: "flex", gap: "10px", width: "100%", marginTop: "8px" }}>
                  <button
                    type="button"
                    onClick={handleResetVerification}
                    className="mobile-btn-large"
                    style={{ backgroundColor: "var(--primary-200)", color: "var(--primary-800)", flex: 1, boxShadow: "none" }}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={handleEnableLocation}
                    className="mobile-btn-large"
                    style={{ backgroundColor: "var(--danger-600)", color: "#ffffff", flex: 1.5 }}
                  >
                    Try Again
                  </button>
                </div>
              </div>
            )}
      </div>
    );
  };

  const renderMaterialView = () => {
    // Production Attendance Verification Gate Check
    const effectiveMaterialDate = bulkMaterialDate || new Date().toISOString().split("T")[0];
    const isVerified = isAttendanceVerifiedForSiteAndDate(activeSiteId, effectiveMaterialDate);
    if (!isVerified) {
      const siteObj = assignedSites.find(s => s.id === activeSiteId) || currentSite;
      return (
        <AttendanceGateBlockedCard
          siteName={siteObj?.siteName || "Current Worksite"}
          dateStr={effectiveMaterialDate}
          sectionTitle="Materials & Inventory Logs"
          onMarkAttendance={() => handleOpenAttendanceGate("material")}
          isToday={effectiveMaterialDate === new Date().toISOString().split("T")[0]}
        />
      );
    }

    const sitePendingMaterials = materials
      .filter(m => m && m.siteId === activeSiteId)
      .map(m => processMaterialPaymentAndDelivery(m))
      .filter(m => m.pendingDelivery > 0);

    const activeMaterials = materials
      .filter(m => m && m.siteId === activeSiteId)
      .filter(m => {
        const query = (materialSearch || "").toLowerCase().trim();
        if (!query) return true;
        const mName = String(m.materialName || m.title || "").toLowerCase();
        const mCat = String(m.category || m.teamName || "").toLowerCase();
        const mSup = String(m.supplierName || "").toLowerCase();
        return (
          mName.includes(query) ||
          mCat.includes(query) ||
          mSup.includes(query)
        );
      })
      .filter(m => {
        if (!materialDateFilter) return true;
        return m.purchaseDate === materialDateFilter;
      });
    const handleOpenDelivery = (m) => {
      setSelectedMatDelivery(m);
      setDeliveryRecQty(m.pendingDelivery.toString());
      setDeliverySupplierVal(m.supplierName === "Pending Quote" ? "" : m.supplierName);
      setDeliveryPhotoFile(null);
      setDeliveryPhotoPreview("");
      setShowDeliveryModal(true);
    };

    const handleOpenUsage = (m) => {
      setSelectedMatUsage(m);
      setUsageQtyVal("");
      setUsageNotesVal("");
      setShowUsageModal(true);
    };

    const handleDeliverySubmit = async (e) => {
      e.preventDefault();
      if (!selectedMatDelivery || !deliveryRecQty) return;
      const qty = Number(deliveryRecQty);
      if (qty <= 0) return;

      try {
        let finalPhoto = selectedMatDelivery.invoiceUrl;
        if (deliveryPhotoPreview) {
          finalPhoto = deliveryPhotoPreview;
        }

        const newRecQty = selectedMatDelivery.receivedQuantity + qty;
        await updateMaterial(selectedMatDelivery.id, {
          quantity: newRecQty, // actual received maps to 'quantity'
          supplierName: deliverySupplierVal.trim() || selectedMatDelivery.supplierName,
          invoiceUrl: finalPhoto
        });

        showToast("Material delivery quantity updated!", "success");
        setShowDeliveryModal(false);
        await loadDashboardData();
      } catch (err) {
        showToast(`Failed: ${err.message}`, "error");
      }
    };

    const handleUsageSubmit = async (e) => {
      e.preventDefault();
      if (!selectedMatUsage || !usageQtyVal) return;
      const qty = Number(usageQtyVal);
      if (qty <= 0) return;
      if (qty > selectedMatUsage.remainingStock) {
        showToast("Consumption cannot exceed remaining stock!", "error");
        return;
      }

      try {
        await logMaterialUsage(selectedMatUsage.id, {
          quantity: qty,
          date: usageDateVal,
          notes: usageNotesVal
        });

        showToast("Material consumption logged successfully!", "success");
        setShowUsageModal(false);
        await loadDashboardData();
      } catch (err) {
        showToast(`Failed: ${err.message}`, "error");
      }
    };

    const handleDeliveryPhotoChange = (e) => {
      const file = e.target.files[0];
      if (file) {
        const reader = new FileReader();
        reader.onloadend = () => {
          setDeliveryPhotoPreview(reader.result);
        };
        reader.readAsDataURL(file);
      }
    };

    const activeTeamMaterialsCount = materialTeams.reduce(
      (acc, t) => acc + (t.materials || []).filter(m => m.status !== "Inactive").length,
      0
    );

    const filteredTeams = materialTeams
      .map(t => ({
        ...t,
        materials: (t.materials || []).filter(m => m.status !== "Inactive").filter(m => {
          const query = materialSearch.toLowerCase().trim();
          if (!query) return true;
          return (m.name || "").toLowerCase().includes(query) || (t.name || "").toLowerCase().includes(query);
        })
      }))
      .filter(t => {
        if (!materialSearch.trim()) return true;
        return t.materials.length > 0 || (t.name || "").toLowerCase().includes(materialSearch.toLowerCase().trim());
      });

    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: "'Outfit', 'Inter', sans-serif",
        color: "#1c1b1f",
        maxWidth: "640px",
        margin: "0 auto",
        padding: "8px 4px 80px 4px"
      }}>
        {/* ── SUB-TABS: RECORD USAGE vs PENDING MATERIALS vs SITE LOGS ── */}
        <div style={{
          display: "flex",
          backgroundColor: "#f1f5f9",
          padding: "4px",
          borderRadius: "24px",
          boxShadow: "inset 0px 1px 2px rgba(0,0,0,0.03)",
          gap: "4px"
        }}>
          <button
            type="button"
            onClick={() => setMaterialTabMode("entry")}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "750",
              border: "none",
              cursor: "pointer",
              backgroundColor: materialTabMode === "entry" ? "#ffffff" : "transparent",
              color: materialTabMode === "entry" ? "#ea580c" : "#64748b",
              boxShadow: materialTabMode === "entry" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap"
            }}
          >
            Record Usage
          </button>
          <button
            type="button"
            onClick={() => setMaterialTabMode("pending")}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "750",
              border: "none",
              cursor: "pointer",
              backgroundColor: materialTabMode === "pending" ? "#ffffff" : "transparent",
              color: materialTabMode === "pending" ? "#ea580c" : "#64748b",
              boxShadow: materialTabMode === "pending" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              whiteSpace: "nowrap"
            }}
          >
            <span>Pending</span>
            {sitePendingMaterials.length > 0 && (
              <span style={{
                backgroundColor: materialTabMode === "pending" ? "#ea580c" : "#cbd5e1",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "800",
                padding: "1px 6px",
                borderRadius: "100px"
              }}>
                {sitePendingMaterials.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMaterialTabMode("transfers")}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "750",
              border: "none",
              cursor: "pointer",
              backgroundColor: materialTabMode === "transfers" ? "#ffffff" : "transparent",
              color: materialTabMode === "transfers" ? "#ea580c" : "#64748b",
              boxShadow: materialTabMode === "transfers" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.2s ease",
              display: "inline-flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "5px",
              whiteSpace: "nowrap"
            }}
          >
            <span>Transfers</span>
            {siteTransfers.length > 0 && (
              <span style={{
                backgroundColor: materialTabMode === "transfers" ? "#ea580c" : "#cbd5e1",
                color: "#ffffff",
                fontSize: "11px",
                fontWeight: "800",
                padding: "1px 6px",
                borderRadius: "100px"
              }}>
                {siteTransfers.length}
              </span>
            )}
          </button>
          <button
            type="button"
            onClick={() => setMaterialTabMode("logs")}
            style={{
              flex: 1,
              padding: "10px 8px",
              borderRadius: "20px",
              fontSize: "13px",
              fontWeight: "750",
              border: "none",
              cursor: "pointer",
              backgroundColor: materialTabMode === "logs" ? "#ffffff" : "transparent",
              color: materialTabMode === "logs" ? "#ea580c" : "#64748b",
              boxShadow: materialTabMode === "logs" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.2s ease",
              whiteSpace: "nowrap"
            }}
          >
            Logs ({activeMaterials.length})
          </button>
        </div>

        {/* ── SUB-TAB 1: RECORD MATERIAL USAGE ENTRY ── */}
        {materialTabMode === "entry" && (
          <form onSubmit={handleBulkMaterialSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            
            {/* 1. Date Selector Card */}
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "16px 20px",
              border: "1px solid #cbd5e1",
              boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <label htmlFor="material-entry-date" style={{
                fontSize: "12px",
                fontWeight: "750",
                color: "#ea580c",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Usage Date
              </label>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Calendar size={20} style={{ position: "absolute", left: "12px", color: "#ea580c", pointerEvents: "none" }} />
                <input 
                  id="material-entry-date"
                  type="date" 
                  value={bulkMaterialDate} 
                  onChange={(e) => setBulkMaterialDate(e.target.value)} 
                  className="no-native-calendar-icon"
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "12px 14px 12px 44px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "15px",
                    outline: "none",
                    color: "#0f172a",
                    fontWeight: "600",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            {/* 2. Selected Team Dropdown Card */}
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "16px 20px",
              border: "1px solid #cbd5e1",
              boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "8px",
              position: "relative",
              zIndex: isMaterialTeamDropdownOpen ? 30 : 1
            }}>
              <label htmlFor="select-material-team-dropdown" style={{
                fontSize: "12px",
                fontWeight: "750",
                color: "#ea580c",
                textTransform: "uppercase",
                letterSpacing: "0.5px"
              }}>
                Selected Team
              </label>
              
              <div 
                ref={materialTeamDropdownRef}
                style={{ position: "relative", width: "100%", maxWidth: "100%" }}
              >
                {/* Responsive Dropdown Trigger */}
                <button
                  type="button"
                  id="select-material-team-trigger"
                  onClick={() => setIsMaterialTeamDropdownOpen(!isMaterialTeamDropdownOpen)}
                  style={{
                    width: "100%",
                    minHeight: "48px",
                    padding: "10px 14px 10px 44px",
                    borderRadius: "12px",
                    border: isMaterialTeamDropdownOpen ? "1.5px solid #ea580c" : "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "15px",
                    outline: "none",
                    color: "#0f172a",
                    fontWeight: "600",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    gap: "8px",
                    cursor: "pointer",
                    textAlign: "left",
                    boxShadow: isMaterialTeamDropdownOpen ? "0 0 0 3px rgba(234, 88, 12, 0.12)" : "none",
                    transition: "border-color 0.15s ease, box-shadow 0.15s ease",
                    boxSizing: "border-box"
                  }}
                >
                  <Users size={20} style={{ position: "absolute", left: "12px", color: "#ea580c", pointerEvents: "none" }} />
                  
                  <span style={{
                    flex: 1,
                    minWidth: 0,
                    overflow: "hidden",
                    textOverflow: "ellipsis",
                    whiteSpace: "nowrap",
                    color: selectedMaterialTeamId ? "#0f172a" : "#64748b",
                    fontSize: "15px",
                    fontWeight: selectedMaterialTeamId ? "600" : "500"
                  }}>
                    {(() => {
                      const selectedTeam = materialTeams.find(t => t.id === selectedMaterialTeamId);
                      if (!selectedTeam) return "-- Select Material Team --";
                      const activeCount = (selectedTeam.materials || []).filter(m => m.status !== "Inactive").length;
                      return `${selectedTeam.name} (${activeCount} material${activeCount !== 1 ? "s" : ""})`;
                    })()}
                  </span>

                  <ChevronDown
                    size={18}
                    style={{
                      color: "#ea580c",
                      flexShrink: 0,
                      transform: isMaterialTeamDropdownOpen ? "rotate(180deg)" : "rotate(0deg)",
                      transition: "transform 0.2s ease"
                    }}
                  />
                </button>

                {/* Dropdown Options Popup Menu */}
                {isMaterialTeamDropdownOpen && (
                  <div
                    id="material-team-dropdown-list"
                    style={{
                      position: "absolute",
                      top: "calc(100% + 6px)",
                      left: 0,
                      right: 0,
                      width: "100%",
                      maxWidth: "100%",
                      backgroundColor: "#ffffff",
                      borderRadius: "12px",
                      border: "1px solid #cbd5e1",
                      boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
                      zIndex: 60,
                      maxHeight: "260px",
                      overflowY: "auto",
                      WebkitOverflowScrolling: "touch",
                      boxSizing: "border-box",
                      padding: "6px"
                    }}
                  >
                    {/* Default None option */}
                    <div
                      role="option"
                      aria-selected={!selectedMaterialTeamId}
                      onClick={() => {
                        handleSelectMaterialTeam("");
                        setIsMaterialTeamDropdownOpen(false);
                      }}
                      style={{
                        padding: "10px 12px",
                        borderRadius: "8px",
                        cursor: "pointer",
                        fontSize: "14px",
                        fontWeight: "600",
                        color: !selectedMaterialTeamId ? "#ea580c" : "#64748b",
                        backgroundColor: !selectedMaterialTeamId ? "#fff7ed" : "transparent",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        transition: "background-color 0.15s ease",
                        marginBottom: "2px",
                        boxSizing: "border-box"
                      }}
                    >
                      <span style={{ fontSize: "14px", fontWeight: "600" }}>
                        -- Select Material Team --
                      </span>
                      {!selectedMaterialTeamId && (
                        <Check size={16} style={{ color: "#ea580c", flexShrink: 0 }} />
                      )}
                    </div>

                    {materialTeams.length === 0 ? (
                      <div style={{
                        padding: "14px 12px",
                        textAlign: "center",
                        fontSize: "13px",
                        color: "#94a3b8",
                        fontWeight: "500"
                      }}>
                        No material teams available
                      </div>
                    ) : (
                      materialTeams.map((team) => {
                        const isSelected = team.id === selectedMaterialTeamId;
                        const activeMatsCount = (team.materials || []).filter(m => m.status !== "Inactive").length;

                        return (
                          <div
                            key={team.id}
                            role="option"
                            aria-selected={isSelected}
                            onClick={() => {
                              handleSelectMaterialTeam(team.id);
                              setIsMaterialTeamDropdownOpen(false);
                            }}
                            style={{
                              padding: "10px 12px",
                              borderRadius: "8px",
                              cursor: "pointer",
                              backgroundColor: isSelected ? "#fff7ed" : "transparent",
                              border: isSelected ? "1px solid #fed7aa" : "1px solid transparent",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "space-between",
                              gap: "8px",
                              transition: "background-color 0.15s ease",
                              marginBottom: "2px",
                              boxSizing: "border-box",
                              width: "100%"
                            }}
                            onMouseEnter={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "#f8fafc";
                            }}
                            onMouseLeave={(e) => {
                              if (!isSelected) e.currentTarget.style.backgroundColor = "transparent";
                            }}
                          >
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "2px",
                              minWidth: 0,
                              flex: 1
                            }}>
                              <span style={{
                                fontSize: "14px",
                                fontWeight: isSelected ? "700" : "600",
                                color: isSelected ? "#c2410c" : "#0f172a",
                                lineHeight: "1.3",
                                wordBreak: "break-word",
                                overflowWrap: "anywhere"
                              }}>
                                {team.name}
                              </span>
                              <span style={{
                                fontSize: "11px",
                                fontWeight: "500",
                                color: isSelected ? "#ea580c" : "#64748b"
                              }}>
                                {activeMatsCount} material{activeMatsCount !== 1 ? "s" : ""}
                              </span>
                            </div>

                            {isSelected && (
                              <Check size={18} style={{ color: "#ea580c", flexShrink: 0, marginLeft: "6px" }} />
                            )}
                          </div>
                        );
                      })
                    )}
                  </div>
                )}

                {/* Hidden native select for form accessibility and element lookup */}
                <select
                  id="select-material-team-dropdown"
                  value={selectedMaterialTeamId}
                  onChange={(e) => handleSelectMaterialTeam(e.target.value)}
                  style={{ display: "none" }}
                  aria-hidden="true"
                  tabIndex={-1}
                >
                  <option value="">-- Select Material Team --</option>
                  {materialTeams.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({(t.materials || []).filter(m => m.status !== "Inactive").length} materials)
                    </option>
                  ))}
                </select>
              </div>
            </div>
            {/* 3. Materials Table Section (Only after selecting team) */}
            {!selectedMaterialTeamId ? (
              <div style={{
                textAlign: "center",
                padding: "48px 24px",
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
                fontSize: "14px",
                fontWeight: "600"
              }}>
                Please select a Material Team above to record material usage.
              </div>
            ) : (() => {
              const selectedTeam = materialTeams.find(t => t.id === selectedMaterialTeamId);
              const teamMaterials = (selectedTeam?.materials || []).filter(m => m.status !== "Inactive");

              if (teamMaterials.length === 0) {
                return (
                  <div style={{
                    textAlign: "center",
                    padding: "48px 24px",
                    backgroundColor: "#ffffff",
                    borderRadius: "16px",
                    border: "1px dashed #ef4444",
                    color: "#b91c1c",
                    fontSize: "14px",
                    fontWeight: "600"
                  }}>
                    No active materials configured for "{selectedTeam?.name}" by Admin.
                  </div>
                );
              }

              const grandTotalAmount = materialUsageRows.reduce((acc, row) => {
                if (row.type === "custom" || row.type === "customer_amount_only" || row.type === "rate_only") {
                  return acc + (Number(row.amount !== undefined ? row.amount : row.rate) || 0);
                }
                const q = Number(row.quantity) || 0;
                const r = Number(row.rate) || 0;
                return acc + (q * r);
              }, 0);

              const itemsWithQtyCount = materialUsageRows.filter(r => r.type === "custom" || r.type === "customer_amount_only" || r.type === "rate_only" || (Number(r.quantity) || 0) > 0).length;

              return (
                <div style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  padding: "16px 20px",
                  border: "1px solid #cbd5e1",
                  boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
                  display: "flex",
                  flexDirection: "column",
                  gap: "14px"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "10px" }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <h4 style={{ 
                        margin: 0, 
                        fontSize: "15px", 
                        fontWeight: "800", 
                        color: "#0f172a",
                        lineHeight: "1.3",
                        wordBreak: "break-word",
                        whiteSpace: "normal"
                      }}>
                        {selectedTeam?.name} Materials
                      </h4>
                      <span style={{ fontSize: "11.5px", color: "#64748b", fontWeight: "600", display: "block", marginTop: "2px" }}>
                        Configured master rates
                      </span>
                    </div>
                    <span style={{ 
                      fontSize: "11px", 
                      fontWeight: "750", 
                      color: "#ea580c", 
                      backgroundColor: "#fff7ed", 
                      padding: "4px 8px", 
                      borderRadius: "12px", 
                      border: "1px solid #ffedd5",
                      whiteSpace: "nowrap",
                      flexShrink: 0,
                      lineHeight: "1.2"
                    }}>
                      {teamMaterials.length} Available Items
                    </span>
                  </div>

                  {/* Clean Strict CSS Grid Table */}
                  {materialUsageRows.length === 0 ? (
                    <div style={{ textAlign: "center", padding: "28px 16px", backgroundColor: "#f8fafc", borderRadius: "8px", border: "1px dashed #cbd5e1" }}>
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)", fontStyle: "italic" }}>
                        No materials in current list. Click "+ Add Material" below to select and add materials.
                      </p>
                    </div>
                  ) : (
                    <div style={{ border: "1px solid #e2e8f0", borderRadius: "10px", overflow: "hidden", backgroundColor: "#ffffff", width: "100%", boxSizing: "border-box" }}>
                      {/* Fixed 4-Column Header Grid */}
                      <div style={{
                        display: "grid",
                        gridTemplateColumns: "minmax(0, 2.2fr) minmax(60px, 1fr) minmax(46px, 0.7fr) minmax(40px, 0.6fr)",
                        alignItems: "center",
                        background: "#f8fafc",
                        padding: "10px 8px",
                        borderBottom: "1.5px solid #e2e8f0",
                        color: "#475569",
                        fontSize: "12px",
                        fontWeight: "750",
                        gap: "6px"
                      }}>
                        <div style={{ textAlign: "left", paddingLeft: "4px" }}>Material</div>
                        <div style={{ textAlign: "center" }}>Quantity</div>
                        <div style={{ textAlign: "center" }}>Unit</div>
                        <div style={{ textAlign: "center" }}>Action</div>
                      </div>

                      {/* Fixed 4-Column Row Grids */}
                      <div>
                        {materialUsageRows.map((row) => {
                          const isCustom = row.type === "custom";
                          const isCustomerAmountOnly = row.type === "customer_amount_only";
                          const isRateOnly = row.type === "rate_only";
                          const isSpecial = isCustom || isCustomerAmountOnly || isRateOnly;
                          const isCustomerType = isCustom || isCustomerAmountOnly;
                          const qtyNum = Number(row.quantity) || 0;

                          return (
                            <div
                              key={row.rowId}
                              style={{
                                display: "grid",
                                gridTemplateColumns: "minmax(0, 2.2fr) minmax(60px, 1fr) minmax(46px, 0.7fr) minmax(40px, 0.6fr)",
                                alignItems: "center",
                                padding: "8px 8px",
                                borderBottom: "1px solid #f1f5f9",
                                backgroundColor: (isSpecial || qtyNum > 0) ? "#fffaf5" : "#ffffff",
                                gap: "6px"
                              }}
                            >
                              {/* 1. Material Name & Custom / Rate Only Details */}
                              <div style={{ minWidth: 0, width: "100%", display: "flex", flexDirection: "column", gap: "2px" }}>
                                <div style={{
                                  display: "flex",
                                  alignItems: "center",
                                  gap: "6px",
                                  width: "100%",
                                  padding: "2px 2px",
                                  minHeight: "28px",
                                  boxSizing: "border-box",
                                  flexWrap: "wrap"
                                }}>
                                  <span style={{
                                    fontSize: "13px",
                                    fontWeight: "750",
                                    color: "#0f172a",
                                    lineHeight: "1.3",
                                    wordBreak: "break-word",
                                    userSelect: "text"
                                  }}>
                                    {row.materialName || (isCustomerAmountOnly ? "Customer Amount" : (isRateOnly ? "Rate Item" : "Select Material"))}
                                  </span>
                                  {isCustomerType && (
                                    <span style={{
                                      fontSize: "10.5px",
                                      fontWeight: "750",
                                      color: "#16a34a",
                                      backgroundColor: "#f0fdf4",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      border: "1px solid #bbf7d0",
                                      whiteSpace: "nowrap"
                                    }}>
                                      {isCustomerAmountOnly ? "Customer Amount" : "Customer"}
                                    </span>
                                  )}
                                  {isRateOnly && (
                                    <span style={{
                                      fontSize: "10.5px",
                                      fontWeight: "750",
                                      color: "#7c3aed",
                                      backgroundColor: "#f5f3ff",
                                      padding: "1px 6px",
                                      borderRadius: "4px",
                                      border: "1px solid #ddd6fe",
                                      whiteSpace: "nowrap"
                                    }}>
                                      Rate Only
                                    </span>
                                  )}
                                </div>

                                {/* Custom / Rate Only amount subtitle & details trigger */}
                                <div style={{ paddingLeft: "2px", display: "flex", alignItems: "center", gap: "8px" }}>
                                  {isSpecial ? (
                                    <span 
                                      onClick={() => isCustomerType ? handleOpenCustomMaterialModal(row) : null}
                                      style={{
                                        fontSize: "12px",
                                        fontWeight: "750",
                                        color: isRateOnly ? "#7c3aed" : "#16a34a",
                                        fontFamily: "monospace",
                                        cursor: isCustomerType ? "pointer" : "default",
                                        textDecoration: isCustomerType ? "underline" : "none",
                                        textUnderlineOffset: "2px"
                                      }}
                                      title={isCustomerType ? "Tap to edit amount / title" : "Fixed configured rate"}
                                    >
                                      ₹{(Number(row.amount !== undefined ? row.amount : row.rate) || 0).toLocaleString("en-IN")}
                                    </span>
                                  ) : null}
                                  <span
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenMaterialDetails(row);
                                    }}
                                    style={{
                                      display: "inline-flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      color: "#ea580c",
                                      cursor: "pointer",
                                      padding: "1px 4px 1px 0"
                                    }}
                                    title="View Rate & Amount details"
                                    aria-label="View Rate & Amount details"
                                  >
                                    <Eye size={12} style={{ color: "#ea580c" }} />
                                  </span>
                                </div>
                              </div>

                              {/* 2. Quantity Input / Uniform Box */}
                              <div 
                                style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                {isSpecial ? (
                                  <div 
                                    onClick={() => isCustomerType ? handleOpenCustomMaterialModal(row) : null}
                                    title={isCustomerType ? "Customer fixed entry - tap to edit amount" : "Rate Only fixed entry"}
                                    style={{
                                      width: "100%",
                                      maxWidth: "60px",
                                      height: "36px",
                                      boxSizing: "border-box",
                                      borderRadius: "6px",
                                      border: isRateOnly ? "1.5px solid #ddd6fe" : "1.5px solid #bbf7d0",
                                      backgroundColor: isRateOnly ? "#f5f3ff" : "#f0fdf4",
                                      display: "flex",
                                      alignItems: "center",
                                      justifyContent: "center",
                                      fontSize: "13px",
                                      fontWeight: "750",
                                      color: isRateOnly ? "#7c3aed" : "#16a34a",
                                      cursor: isCustomerType ? "pointer" : "default"
                                    }}
                                  >
                                    1
                                  </div>
                                ) : (
                                  <input
                                    id={`qty-input-${row.rowId}`}
                                    type="number"
                                    min="0"
                                    step="any"
                                    placeholder="0"
                                    value={row.quantity}
                                    onClick={(e) => e.stopPropagation()}
                                    onChange={(e) => handleQuantityRowChange(row.rowId, e.target.value)}
                                    disabled={bulkMaterialSubmitting}
                                    style={{
                                      width: "100%",
                                      maxWidth: "60px",
                                      height: "36px",
                                      boxSizing: "border-box",
                                      padding: "6px 4px",
                                      borderRadius: "6px",
                                      border: qtyNum > 0 ? "1.5px solid #ea580c" : "1px solid #cbd5e1",
                                      fontSize: "13px",
                                      fontWeight: "750",
                                      textAlign: "center",
                                      backgroundColor: "#ffffff",
                                      outline: "none"
                                    }}
                                  />
                                )}
                              </div>

                              {/* 3. Unit / Uniform Box */}
                              <div style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}>
                                <span className="font-mono" style={{
                                  backgroundColor: "#f1f5f9",
                                  padding: "3px 6px",
                                  borderRadius: "4px",
                                  fontSize: "11px",
                                  fontWeight: "750",
                                  color: isSpecial ? "#94a3b8" : "#475569",
                                  whiteSpace: "nowrap",
                                  textAlign: "center",
                                  minWidth: "32px",
                                  display: "inline-block"
                                }}>
                                  {isSpecial ? "—" : (row.unit || "Unit")}
                                </span>
                              </div>

                              {/* 4. Action */}
                              <div 
                                style={{ width: "100%", display: "flex", justifyContent: "center", alignItems: "center" }}
                                onClick={(e) => e.stopPropagation()}
                              >
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleRemoveMaterialRow(row.rowId);
                                  }}
                                  disabled={bulkMaterialSubmitting}
                                  style={{
                                    background: "#fef2f2",
                                    border: "1px solid #fecaca",
                                    borderRadius: "8px",
                                    width: "36px",
                                    height: "36px",
                                    color: "#dc2626",
                                    cursor: "pointer",
                                    display: "flex",
                                    alignItems: "center",
                                    justifyContent: "center",
                                    padding: "0",
                                    transition: "all 0.15s ease"
                                  }}
                                  aria-label="Delete item from list"
                                >
                                  <Trash2 size={15} />
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* + Add Material & + Custom Action Buttons */}
                  {(() => {
                    const existingMatIds = new Set(materialUsageRows.map(r => r.materialId));
                    const remainingCount = teamMaterials.filter(m => !existingMatIds.has(m.id)).length;
                    const allAdded = remainingCount === 0;

                    return (
                      <div style={{ display: "flex", gap: "10px", width: "100%" }}>
                        {/* + Add Material Button */}
                        <button
                          type="button"
                          onClick={handleAddMaterialRow}
                          disabled={bulkMaterialSubmitting || allAdded}
                          style={{
                            flex: 1,
                            boxSizing: "border-box",
                            backgroundColor: allAdded ? "#f8fafc" : "#fff7ed",
                            border: allAdded ? "1px dashed #cbd5e1" : "1.5px dashed #ea580c",
                            color: allAdded ? "#64748b" : "#ea580c",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "750",
                            cursor: allAdded ? "not-allowed" : "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            transition: "all 0.15s ease"
                          }}
                          aria-label={allAdded ? "All materials for this team have been added" : "Add another standard material"}
                        >
                          {allAdded ? <Check size={15} style={{ color: "#64748b" }} /> : <Plus size={15} />}
                          <span>{allAdded ? "All Standard Added" : "+ Add Material"}</span>
                        </button>

                        {/* + Customer Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenCustomMaterialModal()}
                          disabled={bulkMaterialSubmitting}
                          style={{
                            flex: 1,
                            boxSizing: "border-box",
                            backgroundColor: "#f0fdf4",
                            border: "1.5px dashed #16a34a",
                            color: "#16a34a",
                            padding: "10px 14px",
                            borderRadius: "10px",
                            fontSize: "13px",
                            fontWeight: "750",
                            cursor: "pointer",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            transition: "all 0.15s ease"
                          }}
                          aria-label="Add customer material or service with amount"
                        >
                          <Plus size={15} />
                          <span>+ Customer</span>
                        </button>
                      </div>
                    );
                  })()}

                  {/* Running Total & Submit Footer */}
                  <div style={{ display: "flex", flexDirection: "column", gap: "16px", borderTop: "1px solid #e2e8f0", paddingTop: "16px", marginTop: "4px" }}>
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      padding: "16px",
                      backgroundColor: "#fff7ed",
                      borderRadius: "14px",
                      border: "1px solid #ffedd5"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <div>
                          <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "750", color: "#ea580c", letterSpacing: "0.5px", display: "block" }}>
                            {selectedTeam?.name} Usage Summary
                          </span>
                          <strong style={{ fontSize: "14px", color: "#0f172a", display: "block", marginTop: "2px" }}>
                            {itemsWithQtyCount} {itemsWithQtyCount === 1 ? "Material Item" : "Material Items"}
                          </strong>
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "11px", textTransform: "uppercase", fontWeight: "750", color: "#64748b", letterSpacing: "0.5px", display: "block" }}>
                            Total Amount
                          </span>
                          <strong style={{ fontSize: "18px", color: "#1e3a8a", fontWeight: "800" }}>
                            ₹{grandTotalAmount.toLocaleString("en-IN")}
                          </strong>
                        </div>
                      </div>

                      {/* Equal-Width Symmetrical Button Pair */}
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", width: "100%" }}>
                        {/* Compact Pending Action Button */}
                        <button
                          type="button"
                          onClick={handleOpenPendingModal}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            height: "38px",
                            padding: "0 12px",
                            borderRadius: "8px",
                            border: "1.5px solid #ea580c",
                            backgroundColor: "#ffffff",
                            color: "#ea580c",
                            fontSize: "13px",
                            fontWeight: "750",
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#fff7ed"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
                          title="Record material with pending balance delivery"
                        >
                          <Clock size={15} />
                          <span>Pending</span>
                        </button>

                        {/* Compact Transfer Action Button */}
                        <button
                          type="button"
                          onClick={() => handleOpenTransferModal()}
                          style={{
                            flex: 1,
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "center",
                            gap: "6px",
                            height: "38px",
                            padding: "0 12px",
                            borderRadius: "8px",
                            border: "1.5px solid #0284c7",
                            backgroundColor: "#ffffff",
                            color: "#0284c7",
                            fontSize: "13px",
                            fontWeight: "750",
                            cursor: "pointer",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                            transition: "all 0.15s ease"
                          }}
                          onMouseEnter={e => { e.currentTarget.style.backgroundColor = "#f0f9ff"; }}
                          onMouseLeave={e => { e.currentTarget.style.backgroundColor = "#ffffff"; }}
                          title="Transfer material to another construction site"
                        >
                          <ArrowRightLeft size={15} />
                          <span>Transfer</span>
                        </button>
                      </div>
                    </div>

                    <Button
                      type="submit"
                      variant="primary"
                      disabled={itemsWithQtyCount === 0 || bulkMaterialSubmitting}
                      style={{
                        width: "100%",
                        height: "48px",
                        fontSize: "15px",
                        fontWeight: "800",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        gap: "8px"
                      }}
                    >
                      <Save size={18} />
                      <span>
                        {bulkMaterialSubmitting
                          ? "Submitting..."
                          : itemsWithQtyCount === 0
                          ? "Enter Quantities to Submit"
                          : `Submit Material Usage (₹${grandTotalAmount.toLocaleString("en-IN")})`}
                      </span>
                    </Button>
                  </div>
                </div>
              );
            })()}
          </form>
        )}

        {/* ACTIVE PENDING DELIVERIES SECTION (ENTRY VIEW & LOGS VIEW) */}
        {sitePendingMaterials.length > 0 && (
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "16px",
            padding: "16px 18px",
            border: "1px solid #fed7aa",
            boxShadow: "0px 1px 4px rgba(234, 88, 12, 0.08)",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "28px", height: "28px", borderRadius: "8px", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Clock size={16} />
                </div>
                <div>
                  <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                    Pending Material Deliveries
                  </h4>
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: "600" }}>
                    Awaiting remaining shipment arrivals
                  </span>
                </div>
              </div>
              <span style={{ fontSize: "11px", fontWeight: "800", color: "#ea580c", backgroundColor: "#fff7ed", padding: "2px 8px", borderRadius: "100px", border: "1px solid #fed7aa" }}>
                {sitePendingMaterials.length} Pending
              </span>
            </div>

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {sitePendingMaterials.map(pendingItem => {
                return (
                  <div
                    key={pendingItem.id}
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "10px 12px",
                      backgroundColor: "#f8fafc",
                      borderRadius: "10px",
                      border: "1px solid #e2e8f0",
                      flexWrap: "wrap",
                      gap: "8px"
                    }}
                  >
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                        <strong style={{ fontSize: "13px", color: "#0f172a" }}>{pendingItem.materialName}</strong>
                        <span style={{ fontSize: "10px", fontWeight: "750", color: "#64748b", textTransform: "uppercase", backgroundColor: "#e2e8f0", padding: "1px 5px", borderRadius: "4px" }}>
                          {pendingItem.category}
                        </span>
                      </div>
                      <div style={{ fontSize: "11.5px", color: "#475569", marginTop: "3px" }}>
                        Total: <strong>{pendingItem.requiredQuantity} {pendingItem.unit}</strong> | Received: <strong style={{ color: "#16a34a" }}>{pendingItem.receivedQuantity} {pendingItem.unit}</strong> | Pending: <strong style={{ color: "#ea580c" }}>{pendingItem.pendingDelivery} {pendingItem.unit}</strong>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleOpenResolvePending(pendingItem)}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: "5px",
                        padding: "6px 12px",
                        borderRadius: "6px",
                        backgroundColor: "#ea580c",
                        color: "#ffffff",
                        border: "none",
                        fontSize: "12px",
                        fontWeight: "750",
                        cursor: "pointer",
                        boxShadow: "0 1px 2px rgba(234,88,12,0.2)",
                        transition: "all 0.15s ease"
                      }}
                      onMouseEnter={e => e.currentTarget.style.opacity = "0.9"}
                      onMouseLeave={e => e.currentTarget.style.opacity = "1"}
                    >
                      <Truck size={13} />
                      <span>Log Received</span>
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ── SUB-TAB 2: PENDING MATERIALS ── */}
        {materialTabMode === "pending" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Header Card */}
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              flexWrap: "wrap",
              gap: "10px",
              padding: "14px 18px",
              backgroundColor: "#ffffff",
              borderRadius: "14px",
              border: "1px solid #fed7aa",
              boxShadow: "0 1px 3px rgba(234,88,12,0.06)"
            }}>
              <div>
                <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
                  Active Pending Materials
                </h4>
                <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                  {sitePendingMaterials.length} {sitePendingMaterials.length === 1 ? "material item" : "material items"} awaiting balance delivery
                </span>
              </div>
              <button
                type="button"
                onClick={handleOpenPendingModal}
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px",
                  padding: "8px 14px",
                  borderRadius: "8px",
                  backgroundColor: "#ea580c",
                  color: "#ffffff",
                  border: "none",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  cursor: "pointer",
                  boxShadow: "0 1px 3px rgba(234,88,12,0.25)",
                  transition: "all 0.15s ease"
                }}
              >
                <Plus size={15} />
                <span>+ Track New Pending</span>
              </button>
            </div>

            {/* List of Pending Items */}
            {sitePendingMaterials.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "48px 20px",
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                border: "1px dashed #cbd5e1"
              }}>
                <div style={{ width: "44px", height: "44px", borderRadius: "12px", backgroundColor: "#f0fdf4", color: "#16a34a", display: "inline-flex", alignItems: "center", justifyContent: "center", marginBottom: "8px" }}>
                  <CheckCircle2 size={24} />
                </div>
                <h4 style={{ margin: "0 0 4px 0", fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
                  No Pending Material Balances
                </h4>
                <p style={{ margin: "0 0 14px 0", fontSize: "13px", color: "#64748b" }}>
                  All material deliveries for this site are up to date and fully received.
                </p>
                <button
                  type="button"
                  onClick={handleOpenPendingModal}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "8px 14px",
                    borderRadius: "8px",
                    backgroundColor: "#fff7ed",
                    border: "1px solid #fed7aa",
                    color: "#ea580c",
                    fontSize: "12.5px",
                    fontWeight: "750",
                    cursor: "pointer"
                  }}
                >
                  <Plus size={14} />
                  <span>Track a New Pending Shipment</span>
                </button>
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                {sitePendingMaterials.map(pendingItem => {
                  const isTransfer = pendingItem.type === "material_transfer" || pendingItem.isIncomingTransfer;
                  return (
                    <div
                      key={pendingItem.id}
                      style={{
                        backgroundColor: "#ffffff",
                        borderRadius: "14px",
                        padding: "16px",
                        border: isTransfer ? "1.5px solid #bbf7d0" : "1px solid #fed7aa",
                        boxShadow: isTransfer ? "0px 1px 4px rgba(22, 163, 74, 0.08)" : "0px 1px 3px rgba(234, 88, 12, 0.06)",
                        display: "flex",
                        flexDirection: "column",
                        gap: "10px"
                      }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                        <div>
                          <span style={{ fontSize: "10.5px", fontWeight: "800", color: isTransfer ? "#16a34a" : "#64748b", textTransform: "uppercase" }}>
                            {isTransfer ? `Incoming Transfer • ${pendingItem.category}` : pendingItem.category}
                          </span>
                          <h4 style={{ margin: "2px 0 0 0", fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>
                            {pendingItem.materialName}
                          </h4>
                        </div>
                        <span style={{
                          fontSize: "11px",
                          fontWeight: "800",
                          color: isTransfer ? "#15803d" : "#ea580c",
                          backgroundColor: isTransfer ? "#f0fdf4" : "#fff7ed",
                          padding: "3px 8px",
                          borderRadius: "6px",
                          border: isTransfer ? "1px solid #bbf7d0" : "1px solid #fed7aa"
                        }}>
                          {isTransfer ? `From ${pendingItem.sourceSiteName || "Other Site"}` : "Pending Delivery"}
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "12px", backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                        <div>
                          <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>
                            {isTransfer ? "Transferred" : "Total Ordered"}
                          </span>
                          <strong>{pendingItem.requiredQuantity || pendingItem.transferQuantity} {pendingItem.unit}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Received So Far</span>
                          <strong style={{ color: "#16a34a" }}>{pendingItem.receivedQuantity || 0} {pendingItem.unit}</strong>
                        </div>
                        <div>
                          <span style={{ fontSize: "10.5px", color: "#c2410c", display: "block" }}>
                            {isTransfer ? "Pending to Receive" : "Current Pending"}
                          </span>
                          <strong style={{ color: "#ea580c", fontSize: "13px" }}>{pendingItem.pendingDelivery} {pendingItem.unit}</strong>
                        </div>
                      </div>

                      {pendingItem.notes && (
                        <div style={{ fontSize: "11.5px", color: "#64748b", fontStyle: "italic" }}>
                          "{pendingItem.notes.split("\n")[0]}"
                        </div>
                      )}

                      <div style={{ display: "flex", justifyContent: "flex-end", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                        {isTransfer ? (
                          <button
                            type="button"
                            onClick={() => handleOpenReceiveTransfer(pendingItem)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 14px",
                              borderRadius: "8px",
                              backgroundColor: "#16a34a",
                              color: "#ffffff",
                              border: "none",
                              fontSize: "12.5px",
                              fontWeight: "750",
                              cursor: "pointer",
                              boxShadow: "0 1px 2px rgba(22,163,74,0.25)"
                            }}
                          >
                            <Inbox size={14} />
                            <span>Receive Transfer</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => handleOpenResolvePending(pendingItem)}
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "6px",
                              padding: "8px 14px",
                              borderRadius: "8px",
                              backgroundColor: "#ea580c",
                              color: "#ffffff",
                              border: "none",
                              fontSize: "12.5px",
                              fontWeight: "750",
                              cursor: "pointer",
                              boxShadow: "0 1px 2px rgba(234,88,12,0.2)"
                            }}
                          >
                            <Truck size={14} />
                            <span>Update / Receive Balance</span>
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── SUB-TAB 2.5: MATERIAL TRANSFERS HISTORY & SITE-SCOPED REFLECTION ── */}
        {materialTabMode === "transfers" && (() => {
          const outgoingCount = siteTransfers.filter(t => t.isOutgoing).length;
          const incomingCount = siteTransfers.filter(t => t.isIncoming).length;
          const displayedTransfers = siteTransfers.filter(t => {
            if (transferFilterMode === "outgoing") return t.isOutgoing;
            if (transferFilterMode === "incoming") return t.isIncoming;
            return true;
          });

          return (
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* Filter Pills */}
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
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

              {/* Transfer Cards List */}
              {displayedTransfers.length === 0 ? (
                <div style={{ textAlign: "center", padding: "36px 16px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                  <ArrowRightLeft size={32} style={{ color: "#94a3b8", display: "block", margin: "0 auto 8px auto" }} />
                  <strong style={{ fontSize: "14px", color: "#475569", display: "block" }}>
                    No {transferFilterMode !== "all" ? transferFilterMode : ""} material transfers recorded for this site yet.
                  </strong>
                  <span style={{ fontSize: "12px", color: "#94a3b8" }}>
                    Use the Transfer button to transfer materials to another site.
                  </span>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
                  {displayedTransfers.map(tx => {
                    const isOutgoing = tx.isOutgoing;
                    const isIncoming = tx.isIncoming;
                    const totalQty = tx.transferQuantity || 0;
                    const recQty = tx.receivedQuantity || 0;
                    const pendingQty = tx.pendingQuantity || 0;
                    const isCompleted = pendingQty === 0 || tx.status === "Received";

                    return (
                      <div
                        key={tx.id}
                        style={{
                          backgroundColor: "#ffffff",
                          borderRadius: "14px",
                          padding: "16px",
                          border: isOutgoing ? "1.5px solid #bfdbfe" : "1.5px solid #bbf7d0",
                          boxShadow: "0px 1px 4px rgba(0,0,0,0.04)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px"
                        }}
                      >
                        {/* Header with Direction badge & Status */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: "8px", flexWrap: "wrap" }}>
                          <div>
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
                            <h4 style={{ margin: "4px 0 0 0", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                              {tx.materialName} <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>({tx.category})</span>
                            </h4>
                          </div>

                          <Badge status={isCompleted ? "success" : tx.status === "Partial Received" ? "pending" : "warning"}>
                            {isCompleted ? "COMPLETED" : tx.status === "Partial Received" ? `PARTIAL (${recQty}/${totalQty})` : "IN TRANSIT"}
                          </Badge>
                        </div>

                        {/* 3-Grid Stats */}
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "12px", backgroundColor: "#f8fafc", padding: "10px 12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}>
                          <div>
                            <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Transferred</span>
                            <strong>{totalQty} {tx.unit}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Received So Far</span>
                            <strong style={{ color: "#16a34a" }}>{recQty} {tx.unit}</strong>
                          </div>
                          <div>
                            <span style={{ fontSize: "10.5px", color: pendingQty > 0 ? "#c2410c" : "#16a34a", display: "block" }}>
                              {isOutgoing ? "Pending Receipt" : "Pending to Receive"}
                            </span>
                            <strong style={{ color: pendingQty > 0 ? "#ea580c" : "#16a34a", fontSize: "13px" }}>
                              {pendingQty} {tx.unit}
                            </strong>
                          </div>
                        </div>

                        {/* Meta & notes */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11.5px", color: "#64748b", flexWrap: "wrap", gap: "4px" }}>
                          <span>Date: {tx.transferDate || tx.purchaseDate || "--"} • Transferred by {tx.transferredByName || "Site Engineer"}</span>
                          {tx.notes && <span style={{ fontStyle: "italic" }}>"{tx.notes.split("\n")[0]}"</span>}
                        </div>

                        {/* Bottom action / status note */}
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                          {isIncoming && pendingQty > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleOpenReceiveTransfer(tx)}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "6px",
                                padding: "8px 14px",
                                borderRadius: "8px",
                                backgroundColor: "#16a34a",
                                color: "#ffffff",
                                border: "none",
                                fontSize: "12.5px",
                                fontWeight: "750",
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(22,163,74,0.25)",
                                marginLeft: "auto"
                              }}
                            >
                              <Inbox size={14} />
                              <span>Receive Transfer ({pendingQty} remaining)</span>
                            </button>
                          ) : isIncoming && isCompleted ? (
                            <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={14} />
                              All {totalQty} {tx.unit} Received & Counted in Site Stock
                            </span>
                          ) : isOutgoing && pendingQty > 0 ? (
                            <span style={{ fontSize: "12px", color: "#ea580c", fontWeight: "600", display: "flex", alignItems: "center", gap: "4px" }}>
                              <Clock size={14} />
                              {pendingQty} {tx.unit} Awaiting Receipt at {tx.counterpartSiteName}
                            </span>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#16a34a", fontWeight: "700", display: "flex", alignItems: "center", gap: "4px" }}>
                              <CheckCircle2 size={14} />
                              Received by {tx.counterpartSiteName}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── SUB-TAB 3: SITE LOGS & HISTORY ── */}
        {materialTabMode === "logs" && (
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Search bar & filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border-color)", padding: "8px 12px", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff" }}>
                <Search size={16} style={{ color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  placeholder="Search site material logs, suppliers..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  style={{ border: "none", outline: "none", width: "100%", fontSize: "13px", padding: 0, margin: 0 }}
                />
              </div>
              <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
                <div style={{ flex: 1 }}>
                  <input 
                    type="date" 
                    value={materialDateFilter} 
                    onChange={(e) => setMaterialDateFilter(e.target.value)} 
                    style={{ width: "100%", padding: "8px 12px", border: "1.5px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "12px", height: "38px" }}
                  />
                </div>
                {materialDateFilter && (
                  <button 
                    type="button" 
                    onClick={() => setMaterialDateFilter("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--danger-600)",
                      fontSize: "12px",
                      fontWeight: "700",
                      cursor: "pointer",
                      textDecoration: "underline"
                    }}
                  >
                    Clear Date
                  </button>
                )}
              </div>
            </div>

            {/* Site Requisitions & Logs List */}
            {activeMaterials.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid var(--border-color)" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>No material logs matching filter criteria.</p>
              </div>
            ) : (
              activeMaterials.map(m => {
                const processed = processMaterialPaymentAndDelivery(m);
                const isApproved = processed.status === "Approved" || processed.status === "approved" || processed.status === "Received" || processed.status === "received";
                const isTransfer = processed.type === "material_transfer" || processed.isIncomingTransfer;
                
                return (
                  <div key={processed.id} className="mobile-material-card" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: "6px" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
                          <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-600)", textTransform: "uppercase" }}>{processed.category}</span>
                          {isTransfer && (
                            <span style={{ fontSize: "10px", fontWeight: "800", color: "#1d4ed8", backgroundColor: "#eff6ff", padding: "1px 6px", borderRadius: "4px", border: "1px solid #bfdbfe" }}>
                              Transferred from {processed.sourceSiteName || "Other Site"}
                            </span>
                          )}
                          {processed.transfersOut && processed.transfersOut.length > 0 && (
                            <span style={{ fontSize: "10px", fontWeight: "800", color: "#c2410c", backgroundColor: "#fff7ed", padding: "1px 6px", borderRadius: "4px", border: "1px solid #fed7aa" }}>
                              Transferred Out ({processed.transferredOutQuantity || 0} {processed.unit})
                            </span>
                          )}
                        </div>
                        <h4 style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>{processed.materialName}</h4>
                      </div>
                      <Badge status={isApproved ? "success" : processed.status === "Rejected" ? "danger" : "pending"}>
                        {processed.status ? processed.status.toUpperCase() : "PENDING"}
                      </Badge>
                    </div>

                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px", color: "#475569" }}>
                      <div>
                        <strong>{isTransfer ? "Transferred:" : "Required:"}</strong> {processed.requiredQuantity} {processed.unit}
                      </div>
                      <div>
                        <strong>Received:</strong> {processed.receivedQuantity} {processed.unit}
                      </div>
                      <div>
                        <strong>Remaining Stock:</strong> <span style={{ color: "var(--success-700)", fontWeight: "700" }}>{processed.remainingStock} {processed.unit}</span>
                      </div>
                      <div>
                        <strong>Delivery Status:</strong> <span style={{ fontWeight: "700" }}>{processed.deliveryStatus}</span>
                      </div>
                    </div>

                    {processed.notes && (
                      <p style={{ margin: "4px 0 0 0", fontSize: "11px", fontStyle: "italic", color: "var(--text-muted)", backgroundColor: "#f8fafc", padding: "6px 10px", borderRadius: "6px" }}>
                        "{processed.notes.split("\n")[0]}"
                      </p>
                    )}

                    {/* Actions for approved material records */}
                    {isApproved && (
                      <div style={{ display: "flex", gap: "8px", marginTop: "8px", borderTop: "1px solid #f1f5f9", paddingTop: "8px" }}>
                        <button
                          type="button"
                          onClick={() => handleOpenDelivery(processed)}
                          style={{ flex: 1, padding: "8px 10px", backgroundColor: "var(--primary-50)", border: "none", borderRadius: "6px", color: "var(--primary-750)", fontSize: "11.5px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                        >
                          <Truck size={14} />
                          <span>Log Delivery</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleOpenUsage(processed)}
                          style={{ flex: 1, padding: "8px 10px", backgroundColor: "var(--accent-50)", border: "none", borderRadius: "6px", color: "var(--accent-750)", fontSize: "11.5px", fontWeight: "800", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: "4px" }}
                        >
                          <Layers size={14} />
                          <span>Log Usage</span>
                        </button>
                      </div>
                    )}

                    {/* usage history list log */}
                    {processed.usageHistory && processed.usageHistory.length > 0 && (
                      <div style={{ marginTop: "6px", backgroundColor: "#f8fafc", padding: "8px", borderRadius: "6px", fontSize: "10.5px" }}>
                        <span style={{ fontWeight: "800", color: "var(--primary-750)", display: "block", marginBottom: "4px" }}>Stock Usage History:</span>
                        {processed.usageHistory.map((u, ui) => (
                          <div key={ui} style={{ color: "#475569", marginBottom: "2px" }}>
                            • {u.date}: <strong>-{u.quantity} {processed.unit}</strong> ({u.notes})
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        )}

        {/* Modal: Log Delivery */}
        {showDeliveryModal && selectedMatDelivery && (
          <Modal
            isOpen={showDeliveryModal}
            onClose={() => setShowDeliveryModal(false)}
            title="Log Material Shipment Delivery"
            maxWidth="450px"
          >
            <form onSubmit={handleDeliverySubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "12.5px", color: "#475569", margin: 0 }}>
                Material: <strong>{selectedMatDelivery.materialName}</strong><br />
                Pending Delivery: <strong>{selectedMatDelivery.pendingDelivery} {selectedMatDelivery.unit}</strong>
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Quantity Received Today</span>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max={selectedMatDelivery.pendingDelivery}
                  value={deliveryRecQty}
                  onChange={(e) => setDeliveryRecQty(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Supplier Name</span>
                <input
                  type="text"
                  placeholder="Enter supplier company..."
                  value={deliverySupplierVal}
                  onChange={(e) => setDeliverySupplierVal(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Attach Challan / Receipt Photo</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleDeliveryPhotoChange}
                  style={{ fontSize: "12px" }}
                />
                {deliveryPhotoPreview && (
                  <img
                    src={deliveryPhotoPreview}
                    alt="Challan Challan"
                    style={{ width: "100%", maxHeight: "150px", objectFit: "cover", borderRadius: "8px", marginTop: "6px" }}
                  />
                )}
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => setShowDeliveryModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Delivery</Button>
              </div>
            </form>
          </Modal>
        )}

        {/* Modal: Log Usage */}
        {showUsageModal && selectedMatUsage && (
          <Modal
            isOpen={showUsageModal}
            onClose={() => setShowUsageModal(false)}
            title="Log Stock Consumption"
            maxWidth="450px"
          >
            <form onSubmit={handleUsageSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ fontSize: "12.5px", color: "#475569", margin: 0 }}>
                Material: <strong>{selectedMatUsage.materialName}</strong><br />
                Available Stock: <strong>{selectedMatUsage.remainingStock} {selectedMatUsage.unit}</strong>
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Quantity Consumed</span>
                <input
                  type="number"
                  step="any"
                  min="0.1"
                  max={selectedMatUsage.remainingStock}
                  value={usageQtyVal}
                  onChange={(e) => setUsageQtyVal(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Consumption Date</span>
                <input
                  type="date"
                  value={usageDateVal}
                  onChange={(e) => setUsageDateVal(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Usage details / Notes</span>
                <input
                  type="text"
                  placeholder="e.g. Columns casting, structural curing"
                  value={usageNotesVal}
                  onChange={(e) => setUsageNotesVal(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => setShowUsageModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Save Log</Button>
              </div>
            </form>
          </Modal>
        )}

        {/* MODAL: TRACK PENDING MATERIAL */}
        {showPendingModal && (
          <Modal
            isOpen={showPendingModal}
            onClose={() => !savingPending && setShowPendingModal(false)}
            title="Track Pending Material"
            maxWidth="480px"
          >
            <form onSubmit={handleSavePendingMaterial} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              {/* 1. Report Date */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                  Report Date
                </label>
                <input
                  type="date"
                  value={pendingDate}
                  onChange={(e) => setPendingDate(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                    outline: "none"
                  }}
                />
              </div>

              {/* 2. Material Team */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                  Material Team
                </label>
                <select
                  value={pendingTeamId}
                  onChange={(e) => {
                    const newTeamId = e.target.value;
                    setPendingTeamId(newTeamId);
                    const team = materialTeams.find(t => t.id === newTeamId);
                    const firstMat = (team?.materials || []).find(m => m.status !== "Inactive");
                    setPendingMaterialId(firstMat ? firstMat.id : "");
                    setPendingSupplier(team?.name || "");
                  }}
                  required
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "8px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    color: "#0f172a",
                    outline: "none",
                    backgroundColor: "#ffffff"
                  }}
                >
                  <option value="">-- Select Material Team --</option>
                  {materialTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.name}</option>
                  ))}
                </select>
              </div>

              {/* 3. Material (Belonging to selected team) */}
              {(() => {
                const teamObj = materialTeams.find(t => t.id === pendingTeamId);
                const teamMats = (teamObj?.materials || []).filter(m => m.status !== "Inactive");
                const selectedMatObj = teamMats.find(m => m.id === pendingMaterialId);
                const unitLabel = selectedMatObj?.unit || "Units";

                const totalNum = Number(pendingTotalQty) || 0;
                const recNum = Number(pendingReceivedQty) || 0;
                const autoPendingQty = Math.max(0, totalNum - recNum);

                return (
                  <>
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                        Material
                      </label>
                      <select
                        value={pendingMaterialId}
                        onChange={(e) => setPendingMaterialId(e.target.value)}
                        required
                        disabled={teamMats.length === 0}
                        style={{
                          width: "100%",
                          height: "42px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "14px",
                          fontWeight: "600",
                          color: "#0f172a",
                          outline: "none",
                          backgroundColor: "#ffffff"
                        }}
                      >
                        {teamMats.length === 0 ? (
                          <option value="">No materials configured for this team</option>
                        ) : (
                          teamMats.map(m => (
                            <option key={m.id} value={m.id}>
                              {m.name} {m.unit ? `(${m.unit})` : ""} — ₹{m.rate || m.amount || m.unitPrice || 0}
                            </option>
                          ))
                        )}
                      </select>
                    </div>

                    {/* 4. Total Quantity & Received Quantity Side by Side */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>
                          Total Quantity ({unitLabel})
                        </label>
                        <input
                          type="number"
                          min="0.01"
                          step="any"
                          placeholder="e.g. 100"
                          value={pendingTotalQty}
                          onChange={(e) => setPendingTotalQty(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            height: "42px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1.5px solid #cbd5e1",
                            fontSize: "15px",
                            fontWeight: "700",
                            color: "#0f172a",
                            outline: "none"
                          }}
                        />
                      </div>

                      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                        <label style={{ fontSize: "12px", fontWeight: "700", color: "#0f172a" }}>
                          Received Quantity ({unitLabel})
                        </label>
                        <input
                          type="number"
                          min="0"
                          max={totalNum > 0 ? totalNum : undefined}
                          step="any"
                          placeholder="e.g. 50"
                          value={pendingReceivedQty}
                          onChange={(e) => setPendingReceivedQty(e.target.value)}
                          required
                          style={{
                            width: "100%",
                            height: "42px",
                            padding: "8px 12px",
                            borderRadius: "8px",
                            border: "1.5px solid #cbd5e1",
                            fontSize: "15px",
                            fontWeight: "700",
                            color: "#16a34a",
                            outline: "none"
                          }}
                        />
                      </div>
                    </div>

                    {/* 5. Automatically Calculated Pending Quantity (Live Display) */}
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "12px 14px",
                      backgroundColor: "#fff7ed",
                      borderRadius: "10px",
                      border: "1.5px solid #fed7aa"
                    }}>
                      <div>
                        <span style={{ fontSize: "11px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Automatically Calculated
                        </span>
                        <div style={{ fontSize: "13px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                          Pending Quantity
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span style={{ fontSize: "20px", fontWeight: "900", color: "#ea580c", fontFamily: "monospace" }}>
                          {autoPendingQty} {unitLabel}
                        </span>
                        <span style={{ fontSize: "11px", color: "#64748b", display: "block" }}>
                          ({totalNum} Total - {recNum} Received)
                        </span>
                      </div>
                    </div>

                    {/* Notes / Remarks */}
                    <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                      <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                        Notes / Supplier (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Balance shipment arriving tomorrow"
                        value={pendingNotes}
                        onChange={(e) => setPendingNotes(e.target.value)}
                        style={{
                          width: "100%",
                          height: "40px",
                          padding: "8px 12px",
                          borderRadius: "8px",
                          border: "1px solid #cbd5e1",
                          fontSize: "13px",
                          outline: "none"
                        }}
                      />
                    </div>
                  </>
                );
              })()}

              <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => setShowPendingModal(false)}
                  disabled={savingPending}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  disabled={savingPending || !pendingTotalQty}
                  style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                >
                  <Save size={16} />
                  <span>{savingPending ? "Saving..." : "Save Pending Record"}</span>
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* MODAL: RESOLVE / UPDATE PENDING MATERIAL */}
        {showResolvePendingModal && selectedPendingRecord && (
          <Modal
            isOpen={showResolvePendingModal}
            onClose={() => !savingResolvePending && setShowResolvePendingModal(false)}
            title="Receive Pending Material Shipment"
            maxWidth="480px"
          >
            {(() => {
              const currentRec = Number(selectedPendingRecord.receivedQuantity !== undefined ? selectedPendingRecord.receivedQuantity : selectedPendingRecord.quantity) || 0;
              const totalReq = Number(selectedPendingRecord.requiredQuantity || selectedPendingRecord.orderedQuantity) || (currentRec + (Number(selectedPendingRecord.pendingDelivery) || 0));
              const currentPending = Math.max(0, totalReq - currentRec);
              const newlyRecNum = Number(newlyReceivedQty) || 0;
              const newTotalRec = currentRec + newlyRecNum;
              const updatedRemainingPending = Math.max(0, totalReq - newTotalRec);
              const unit = selectedPendingRecord.unit || "Units";

              return (
                <form onSubmit={handleResolvePendingSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                  <div style={{ backgroundColor: "#f8fafc", padding: "12px 14px", borderRadius: "10px", border: "1px solid #e2e8f0" }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#0f172a" }}>
                        {selectedPendingRecord.materialName}
                      </h4>
                      <span style={{ fontSize: "11px", fontWeight: "700", color: "#ea580c", backgroundColor: "#fff7ed", padding: "2px 8px", borderRadius: "6px" }}>
                        {selectedPendingRecord.category}
                      </span>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "12px", marginTop: "8px", color: "#475569" }}>
                      <div>Total Ordered: <strong>{totalReq} {unit}</strong></div>
                      <div>Previously Received: <strong style={{ color: "#16a34a" }}>{currentRec} {unit}</strong></div>
                      <div>Current Pending: <strong style={{ color: "#ea580c" }}>{currentPending} {unit}</strong></div>
                      <div>Report Date: <strong>{selectedPendingRecord.purchaseDate || "--"}</strong></div>
                    </div>
                  </div>

                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "750", color: "#0f172a" }}>
                      Newly Received Quantity Today ({unit})
                    </label>
                    <input
                      type="number"
                      min="0.01"
                      max={currentPending}
                      step="any"
                      placeholder={`Enter quantity up to ${currentPending}`}
                      value={newlyReceivedQty}
                      onChange={(e) => setNewlyReceivedQty(e.target.value)}
                      required
                      autoFocus
                      style={{
                        width: "100%",
                        height: "44px",
                        padding: "8px 12px",
                        borderRadius: "8px",
                        border: "1.5px solid #ea580c",
                        fontSize: "16px",
                        fontWeight: "700",
                        color: "#0f172a",
                        outline: "none"
                      }}
                    />
                  </div>

                  {/* Live Automatic Recalculation Summary */}
                  <div style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "12px 14px",
                    backgroundColor: updatedRemainingPending === 0 ? "#f0fdf4" : "#fff7ed",
                    borderRadius: "10px",
                    border: updatedRemainingPending === 0 ? "1.5px solid #bbf7d0" : "1.5px solid #fed7aa"
                  }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: updatedRemainingPending === 0 ? "#16a34a" : "#ea580c", textTransform: "uppercase" }}>
                        {updatedRemainingPending === 0 ? "Status After Update: FULLY DELIVERED" : "Status After Update: PARTIAL DELIVERY"}
                      </span>
                      <div style={{ fontSize: "12.5px", fontWeight: "700", color: "#0f172a", marginTop: "2px" }}>
                        New Total Received: <span style={{ color: "#16a34a" }}>{newTotalRec} {unit}</span>
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "18px", fontWeight: "900", color: updatedRemainingPending === 0 ? "#16a34a" : "#ea580c", fontFamily: "monospace" }}>
                        Pending: {updatedRemainingPending} {unit}
                      </span>
                    </div>
                  </div>

                  <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setShowResolvePendingModal(false)}
                      disabled={savingResolvePending}
                      style={{ flex: 1 }}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      variant="primary"
                      disabled={savingResolvePending || !newlyReceivedQty || newlyRecNum <= 0}
                      style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px" }}
                    >
                      <Truck size={16} />
                      <span>{savingResolvePending ? "Updating..." : "Update Material Delivery"}</span>
                    </Button>
                  </div>
                </form>
              );
            })()}
          </Modal>
        )}

        {/* MODAL / BOTTOM SHEET: MATERIAL ROW DETAILS */}
        {showMaterialDetailsModal && selectedMaterialForDetails && (() => {
          const row = selectedMaterialForDetails;
          const isCustom = row.type === "custom";
          const qtyNum = isCustom ? 1 : (Number(row.quantity) || 0);
          const rateNum = Number((isCustom && row.amount !== undefined) ? row.amount : (row.rate || 0));
          const amountNum = isCustom ? rateNum : (qtyNum * rateNum);
          const unitLabel = isCustom ? "Fixed Bill" : (row.unit || "Unit");

          return (
            <Modal
              isOpen={showMaterialDetailsModal}
              onClose={() => setShowMaterialDetailsModal(false)}
              title="Material Details"
              maxWidth="420px"
              centered={true}
            >
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {/* Header Title Card */}
                <div style={{
                  backgroundColor: "#fff7ed",
                  padding: "14px 16px",
                  borderRadius: "12px",
                  border: "1px solid #ffedd5"
                }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {isCustom ? "Custom Item" : "Material Item"}
                    </span>
                    <h3 style={{ margin: "3px 0 0 0", fontSize: "16px", fontWeight: "800", color: "#0f172a", wordBreak: "break-word" }}>
                      {row.materialName}
                    </h3>
                  </div>
                </div>

                {/* 4 Details Cards / 2-Column Labeled Grid Pattern */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "10px"
                }}>
                  {/* Unit */}
                  <div style={{
                    backgroundColor: "#f8fafc",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0"
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                      Unit
                    </span>
                    <strong style={{ fontSize: "14px", color: "#0f172a", marginTop: "2px", display: "block" }}>
                      {unitLabel}
                    </strong>
                  </div>

                  {/* Rate */}
                  <div style={{
                    backgroundColor: "#f8fafc",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0"
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                      Rate / Unit
                    </span>
                    <strong style={{ fontSize: "14px", color: "#16a34a", marginTop: "2px", display: "block", fontFamily: "monospace" }}>
                      ₹{rateNum.toLocaleString("en-IN")}
                    </strong>
                  </div>

                  {/* Quantity */}
                  <div style={{
                    backgroundColor: "#f8fafc",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #e2e8f0"
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                      Entered Quantity
                    </span>
                    <strong style={{ fontSize: "15px", color: qtyNum > 0 ? "#ea580c" : "#0f172a", marginTop: "2px", display: "block" }}>
                      {qtyNum} {unitLabel}
                    </strong>
                  </div>

                  {/* Total Amount */}
                  <div style={{
                    backgroundColor: "#fff7ed",
                    padding: "12px",
                    borderRadius: "10px",
                    border: "1px solid #fed7aa"
                  }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#c2410c", textTransform: "uppercase", display: "block" }}>
                      Calculated Amount
                    </span>
                    <strong style={{ fontSize: "16px", color: "#1e3a8a", marginTop: "2px", display: "block", fontFamily: "monospace" }}>
                      ₹{amountNum.toLocaleString("en-IN")}
                    </strong>
                  </div>
                </div>

                {/* Action button inside details */}
                <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                  {isCustom && (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        setShowMaterialDetailsModal(false);
                        handleOpenCustomMaterialModal(row);
                      }}
                      style={{ flex: 1, height: "42px", fontWeight: "750", borderColor: "#16a34a", color: "#16a34a" }}
                    >
                      Edit Custom Amount
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="primary"
                    onClick={() => setShowMaterialDetailsModal(false)}
                    style={{ flex: 1, height: "42px", fontWeight: "750" }}
                  >
                    Close Details
                  </Button>
                </div>
              </div>
            </Modal>
          );
        })()}

        {/* MODAL: ADD / EDIT GENERIC CUSTOM / CUSTOMER MATERIAL */}
        {showCustomMaterialModal && (
          <Modal
            isOpen={showCustomMaterialModal}
            onClose={() => {
              setShowCustomMaterialModal(false);
              setEditingCustomRowId(null);
            }}
            title={editingCustomRowId ? "Edit Customer / Custom Entry" : "Customer / Custom Material Entry"}
            maxWidth="440px"
            centered={true}
          >
            <form onSubmit={handleSaveCustomMaterial} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              {/* Team header badge */}
              <div style={{
                backgroundColor: "#fff7ed",
                padding: "12px 14px",
                borderRadius: "10px",
                border: "1px solid #ffedd5",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center"
              }}>
                <span style={{ fontSize: "12px", fontWeight: "750", color: "#ea580c" }}>
                  Team: {materialTeams.find(t => t.id === selectedMaterialTeamId)?.name || "Selected Team"}
                </span>
                <span style={{ fontSize: "11px", fontWeight: "700", color: "#16a34a", backgroundColor: "#f0fdf4", padding: "2px 8px", borderRadius: "10px", border: "1px solid #bbf7d0" }}>
                  Customer Entry
                </span>
              </div>

              {/* Suggested Quick Chips (e.g. Plumber, Electrician, JCB, Mixer, etc.) */}
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "6px" }}>
                  Suggested Items / Services (Optional)
                </label>
                <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                  {["Plumber", "Electrician", "Carpenter", "Painter", "JCB", "Mixer", "Water Tanker", "Steel Wire"].map(chip => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setCustomMatName(chip)}
                      style={{
                        backgroundColor: customMatName === chip ? "#ea580c" : "#f1f5f9",
                        color: customMatName === chip ? "#ffffff" : "#334155",
                        border: "1px solid",
                        borderColor: customMatName === chip ? "#ea580c" : "#cbd5e1",
                        borderRadius: "16px",
                        padding: "4px 10px",
                        fontSize: "12px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.15s ease"
                      }}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
              </div>

              {/* Material / Service Title (OPTIONAL) */}
              <div className="form-group">
                <label htmlFor="custom-mat-name" style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary-900)" }}>
                  Material / Service Title <span style={{ fontSize: "11.5px", fontWeight: "400", color: "var(--text-muted)" }}>(Optional)</span>
                </label>
                <input
                  id="custom-mat-name"
                  type="text"
                  placeholder="e.g. Plumber, JCB, Concrete Mixer (Optional)"
                  value={customMatName}
                  onChange={(e) => setCustomMatName(e.target.value)}
                  autoFocus
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    marginTop: "4px",
                    borderRadius: "8px",
                    border: "1.5px solid #cbd5e1",
                    fontSize: "14px",
                    fontWeight: "600",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
                <span style={{ fontSize: "11.5px", color: "var(--text-muted)", marginTop: "3px", display: "block" }}>
                  If omitted, entry is saved as "Customer Amount" with your specified amount.
                </span>
              </div>

              {/* Amount (REQUIRED) */}
              <div className="form-group">
                <label htmlFor="custom-mat-amount" style={{ fontWeight: 700, fontSize: "13px", color: "var(--primary-900)" }}>
                  Amount (₹) <span style={{ color: "var(--danger-600)" }}>*</span>
                </label>
                <div style={{ position: "relative", marginTop: "4px" }}>
                  <span style={{
                    position: "absolute",
                    left: "12px",
                    top: "50%",
                    transform: "translateY(-50%)",
                    fontSize: "15px",
                    fontWeight: "750",
                    color: "#64748b"
                  }}>
                    ₹
                  </span>
                  <input
                    id="custom-mat-amount"
                    type="number"
                    min="0.01"
                    step="any"
                    placeholder="e.g. 5000"
                    value={customMatAmount}
                    onChange={(e) => setCustomMatAmount(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      padding: "10px 12px 10px 28px",
                      borderRadius: "8px",
                      border: "1.5px solid #cbd5e1",
                      fontSize: "15px",
                      fontWeight: "750",
                      boxSizing: "border-box",
                      outline: "none"
                    }}
                  />
                </div>
                <span style={{ fontSize: "11.5px", color: "#64748b", marginTop: "4px", display: "block" }}>
                  Enter the actual customer amount / bill for this record.
                </span>
              </div>

              {/* Optional Notes */}
              <div className="form-group">
                <label htmlFor="custom-mat-notes" style={{ fontWeight: 600, fontSize: "13px", color: "var(--primary-900)" }}>
                  Notes / Work Details <span style={{ fontSize: "11px", color: "#94a3b8" }}>(Optional)</span>
                </label>
                <input
                  id="custom-mat-notes"
                  type="text"
                  placeholder="e.g. 4 hours plumbing service on site"
                  value={customMatNotes}
                  onChange={(e) => setCustomMatNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    marginTop: "4px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                    outline: "none"
                  }}
                />
              </div>

              {/* Buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setShowCustomMaterialModal(false);
                    setEditingCustomRowId(null);
                  }}
                  style={{ flex: 1, height: "42px", fontWeight: "700" }}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  variant="primary"
                  style={{ flex: 1, height: "42px", fontWeight: "750", backgroundColor: "#16a34a", borderColor: "#16a34a" }}
                >
                  {editingCustomRowId ? "Update Entry" : "Save Entry"}
                </Button>
              </div>
            </form>
          </Modal>
        )}

        {/* MODAL: TRANSFER MATERIAL TO ANOTHER SITE */}
        {showTransferModal && (() => {
          const availableSiteMats = materials
            .filter(m => m.siteId === activeSiteId)
            .map(m => processMaterialPaymentAndDelivery(m))
            .filter(m => m.remainingStock > 0);

          const selectedMat = availableSiteMats.find(m => m.id === transferMaterialId) || availableSiteMats[0];
          const availStock = selectedMat ? selectedMat.remainingStock : 0;
          const unitLabel = selectedMat?.unit || "Units";
          const transferQtyNum = Number(transferQuantity) || 0;
          const remainingAfterTransfer = Math.max(0, availStock - transferQtyNum);
          const otherSites = allSites.filter(s => s.id !== activeSiteId);
          const destSite = otherSites.find(s => s.id === transferDestSiteId);
          const isValidTransfer = transferQtyNum > 0 && transferQtyNum <= availStock && transferDestSiteId && transferDestSiteId !== activeSiteId;

          return (
            <Modal
              isOpen={showTransferModal}
              onClose={() => !savingTransfer && setShowTransferModal(false)}
              title="Transfer Material to Another Site"
              maxWidth="480px"
            >
              <form onSubmit={handleTransferSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* 1. Date */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                    Transfer Date
                  </label>
                  <input
                    type="date"
                    value={transferDate}
                    onChange={(e) => setTransferDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                </div>

                {/* 2. Source Material Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                    Select Material from Current Site
                  </label>
                  <select
                    value={transferMaterialId}
                    onChange={(e) => setTransferMaterialId(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13.5px",
                      fontWeight: "700",
                      color: "#0f172a",
                      outline: "none",
                      backgroundColor: "#ffffff"
                    }}
                  >
                    {availableSiteMats.map(m => (
                      <option key={m.id} value={m.id}>
                        {m.materialName} ({m.category}) — Available: {m.remainingStock} {m.unit}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 3. Available Quantity Info */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "10px 14px",
                  backgroundColor: "#f0f9ff",
                  borderRadius: "8px",
                  border: "1px solid #bae6fd"
                }}>
                  <span style={{ fontSize: "12px", fontWeight: "700", color: "#0369a1" }}>
                    Current Available at this Site:
                  </span>
                  <strong style={{ fontSize: "15px", color: "#0284c7", fontFamily: "monospace" }}>
                    {availStock} {unitLabel}
                  </strong>
                </div>

                {/* 4. Destination Site Selection */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                    Destination Construction Site
                  </label>
                  <select
                    value={transferDestSiteId}
                    onChange={(e) => setTransferDestSiteId(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13.5px",
                      fontWeight: "700",
                      color: "#0f172a",
                      outline: "none",
                      backgroundColor: "#ffffff"
                    }}
                  >
                    {otherSites.map(s => (
                      <option key={s.id} value={s.id}>
                        {s.siteName} {s.city ? `(${s.city})` : ""}
                      </option>
                    ))}
                  </select>
                </div>

                {/* 5. Transfer Quantity Input */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12.5px", fontWeight: "750", color: "#0f172a" }}>
                    Transfer Quantity ({unitLabel})
                  </label>
                  <input
                    type="number"
                    min="0.01"
                    max={availStock}
                    step="any"
                    placeholder={`Enter quantity (max ${availStock})`}
                    value={transferQuantity}
                    onChange={(e) => setTransferQuantity(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: transferQtyNum > availStock ? "1.5px solid #ef4444" : "1.5px solid #0284c7",
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                  {transferQtyNum > availStock && (
                    <span style={{ fontSize: "11.5px", color: "#dc2626", fontWeight: "600" }}>
                      ⚠️ Transfer quantity cannot exceed available stock ({availStock} {unitLabel}).
                    </span>
                  )}
                </div>

                {/* 6. Live Stock Balance Calculation */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  backgroundColor: "#f8fafc",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0"
                }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: "#64748b", textTransform: "uppercase" }}>
                      Source Stock Balance After Transfer
                    </span>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      {availStock} Current − {transferQtyNum || 0} Transferred
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block" }}>
                      New Available Stock
                    </span>
                    <strong style={{ fontSize: "17px", color: "#0f172a", fontFamily: "monospace" }}>
                      {remainingAfterTransfer} {unitLabel}
                    </strong>
                  </div>
                </div>

                {/* 7. Notes / Remarks */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                    Transfer Notes / Vehicle / Challan Ref (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Urgent structural requirement, Vehicle TN-58-1234"
                    value={transferNotes}
                    onChange={(e) => setTransferNotes(e.target.value)}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none"
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowTransferModal(false)}
                    disabled={savingTransfer}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingTransfer || !isValidTransfer}
                    style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", backgroundColor: "#0284c7" }}
                  >
                    <ArrowRightLeft size={16} />
                    <span>{savingTransfer ? "Transferring..." : "Confirm & Transfer"}</span>
                  </Button>
                </div>
              </form>
            </Modal>
          );
        })()}

        {/* MODAL: RECEIVE INCOMING MATERIAL TRANSFER */}
        {showReceiveTransferModal && selectedTransferForReceive && (() => {
          const item = selectedTransferForReceive;
          const totalTransferred = Number(item.transferQuantity || item.requiredQuantity || item.orderedQuantity) || 0;
          const previouslyReceived = Number(item.quantity) || 0;
          const currentPending = Math.max(0, totalTransferred - previouslyReceived);
          const receiveQtyNum = Number(receiveQuantity) || 0;
          const newTotalReceived = previouslyReceived + receiveQtyNum;
          const remainingPending = Math.max(0, currentPending - receiveQtyNum);
          const unitLabel = item.unit || "Units";
          const isValidReceive = receiveQtyNum > 0 && receiveQtyNum <= currentPending;

          return (
            <Modal
              isOpen={showReceiveTransferModal}
              onClose={() => !savingReceiveTransfer && setShowReceiveTransferModal(false)}
              title="Confirm Material Transfer Receipt"
              maxWidth="480px"
            >
              <form onSubmit={handleReceiveTransferSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                {/* Source and Material Info Card */}
                <div style={{
                  backgroundColor: "#f0fdf4",
                  padding: "14px",
                  borderRadius: "12px",
                  border: "1.5px solid #bbf7d0"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: "11px", fontWeight: "800", color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                        Incoming Transfer
                      </span>
                      <h4 style={{ margin: "2px 0 0 0", fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                        {item.materialName} ({item.category})
                      </h4>
                    </div>
                    <span style={{
                      backgroundColor: "#ffffff",
                      padding: "3px 8px",
                      borderRadius: "6px",
                      border: "1px solid #bbf7d0",
                      fontSize: "11px",
                      fontWeight: "750",
                      color: "#16a34a"
                    }}>
                      From: {item.sourceSiteName || "Source Site"}
                    </span>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "12px", marginTop: "10px", paddingTop: "8px", borderTop: "1px solid #dcfce7", color: "#334155" }}>
                    <div>
                      <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Transferred</span>
                      <strong>{totalTransferred} {unitLabel}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "10.5px", color: "#64748b", display: "block" }}>Previously Received</span>
                      <strong style={{ color: "#16a34a" }}>{previouslyReceived} {unitLabel}</strong>
                    </div>
                    <div>
                      <span style={{ fontSize: "10.5px", color: "#c2410c", display: "block" }}>Pending to Receive</span>
                      <strong style={{ color: "#ea580c" }}>{currentPending} {unitLabel}</strong>
                    </div>
                  </div>
                </div>

                {/* 1. Date */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                    Receipt Date
                  </label>
                  <input
                    type="date"
                    value={receiveDate}
                    onChange={(e) => setReceiveDate(e.target.value)}
                    required
                    style={{
                      width: "100%",
                      height: "42px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "14px",
                      fontWeight: "600",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                </div>

                {/* 2. Receive Quantity Input */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <label style={{ fontSize: "12.5px", fontWeight: "750", color: "#0f172a" }}>
                      Quantity Received Now ({unitLabel})
                    </label>
                    <button
                      type="button"
                      onClick={() => setReceiveQuantity(currentPending.toString())}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#0284c7",
                        fontSize: "11.5px",
                        fontWeight: "700",
                        cursor: "pointer",
                        padding: 0,
                        textDecoration: "underline"
                      }}
                    >
                      Receive All ({currentPending})
                    </button>
                  </div>
                  <input
                    type="number"
                    min="0.01"
                    max={currentPending}
                    step="any"
                    placeholder={`Enter received quantity up to ${currentPending}`}
                    value={receiveQuantity}
                    onChange={(e) => setReceiveQuantity(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: "100%",
                      height: "44px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: receiveQtyNum > currentPending ? "1.5px solid #ef4444" : "1.5px solid #16a34a",
                      fontSize: "16px",
                      fontWeight: "700",
                      color: "#0f172a",
                      outline: "none"
                    }}
                  />
                  {receiveQtyNum > currentPending && (
                    <span style={{ fontSize: "11.5px", color: "#dc2626", fontWeight: "600" }}>
                      ⚠️ Receive quantity cannot exceed pending balance ({currentPending} {unitLabel}).
                    </span>
                  )}
                </div>

                {/* 3. Automatic Status & Live Calculation */}
                <div style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  padding: "12px 14px",
                  backgroundColor: remainingPending === 0 && isValidReceive ? "#f0fdf4" : "#fff7ed",
                  borderRadius: "10px",
                  border: remainingPending === 0 && isValidReceive ? "1.5px solid #bbf7d0" : "1.5px solid #fed7aa"
                }}>
                  <div>
                    <span style={{ fontSize: "11px", fontWeight: "800", color: remainingPending === 0 && isValidReceive ? "#16a34a" : "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                      {remainingPending === 0 && isValidReceive
                        ? "Status: COMPLETED (Full Receipt)"
                        : "Status: PARTIAL RECEIPT (Remains Pending)"}
                    </span>
                    <div style={{ fontSize: "12px", color: "#64748b", marginTop: "2px" }}>
                      New Total Received at Site: <strong style={{ color: "#16a34a" }}>{newTotalReceived} {unitLabel}</strong>
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", display: "block" }}>
                      Remaining Pending
                    </span>
                    <strong style={{ fontSize: "18px", color: remainingPending === 0 && isValidReceive ? "#16a34a" : "#ea580c", fontFamily: "monospace" }}>
                      {remainingPending} {unitLabel}
                    </strong>
                  </div>
                </div>

                {/* 4. Notes / Remarks */}
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569" }}>
                    Receipt Notes / Remarks (Optional)
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Received in good condition, checked count"
                    value={receiveNotes}
                    onChange={(e) => setReceiveNotes(e.target.value)}
                    style={{
                      width: "100%",
                      height: "40px",
                      padding: "8px 12px",
                      borderRadius: "8px",
                      border: "1px solid #cbd5e1",
                      fontSize: "13px",
                      outline: "none"
                    }}
                  />
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "6px" }}>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => setShowReceiveTransferModal(false)}
                    disabled={savingReceiveTransfer}
                    style={{ flex: 1 }}
                  >
                    Cancel
                  </Button>
                  <Button
                    type="submit"
                    variant="primary"
                    disabled={savingReceiveTransfer || !isValidReceive}
                    style={{ flex: 2, display: "flex", alignItems: "center", justifyContent: "center", gap: "6px", backgroundColor: "#16a34a" }}
                  >
                    <Inbox size={16} />
                    <span>{savingReceiveTransfer ? "Confirming..." : "Confirm & Receive"}</span>
                  </Button>
                </div>
              </form>
            </Modal>
          );
        })()}
      </div>
    );
  };
  const renderExpensesView = () => {
    const currentSiteObj = assignedSites.find(s => s.id === activeSiteId);
    if (!currentSiteObj) {
      return (
        <div style={{ textAlign: "center", padding: "32px 16px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>Please select a construction site.</p>
        </div>
      );
    }

    const ledger = getSiteExpenseLedger(currentSiteObj, materials, labourHistory, generalExpenses, labourPayments, labourMaster?.categories || {});
    const myExpenses = (generalExpenses || [])
      .filter(g => g.siteId === activeSiteId)
      .sort((a, b) => (b.date || "").localeCompare(a.date || ""));

    const handleSaveExpense = async (e) => {
      if (e) e.preventDefault();
      
      const errors = {};
      if (!expenseCustomer || !expenseCustomer.trim()) {
        errors.customer = "Customer is required.";
      }
      const amt = Number(expenseAmount);
      if (!expenseAmount || isNaN(amt) || amt <= 0) {
        errors.amount = "Please enter a valid positive amount.";
      }
      if (!expenseDate || !expenseDate.trim()) {
        errors.date = "Please select an expense date.";
      }

      setExpenseErrors(errors);
      if (Object.keys(errors).length > 0) {
        return;
      }

      if (expenseSubmitting || expenseSubmittingRef.current) return;
      expenseSubmittingRef.current = true;
      setExpenseSubmitting(true);
      try {
        await saveGeneralExpense({
          siteId: activeSiteId,
          category: "Site Expense",
          customer: expenseCustomer.trim(),
          amount: amt,
          date: expenseDate,
          description: expenseDesc.trim(),
          notes: expenseNotes.trim(),
          createdBy: userProfile?.fullName || "Site Engineer",
          engineerId: userProfile?.uid || userProfile?.id || "",
          status: "Pending"
        });

        showToast("Expense submitted successfully!", "success");
        if (isMountedRef.current) {
          setShowAddExpenseModal(false);
          setExpenseCustomer("");
          setExpenseAmount("");
          setExpenseDate(new Date().toISOString().split("T")[0]);
          setExpenseDesc("");
          setExpenseNotes("");
          setExpenseErrors({});
        }
        await loadDashboardData();
      } catch (err) {
        showToast(`Submission failed: ${err.message}`, "error");
      } finally {
        expenseSubmittingRef.current = false;
        if (isMountedRef.current) {
          setExpenseSubmitting(false);
        }
      }
    };

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        
        {/* Stats card */}
        <div className="mobile-stats-card" style={{ display: "flex", flexDirection: "column", gap: "12px", padding: "16px", backgroundColor: "var(--primary-900)", color: "#ffffff", borderRadius: "12px" }}>
          <div>
            <span style={{ fontSize: "11px", opacity: 0.8, textTransform: "uppercase" }}>Total Site Budget</span>
            <h2 style={{ margin: "4px 0 0 0", fontSize: "28px", fontWeight: "800" }}>{formatINR(ledger.totalBudget)}</h2>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", borderTop: "1px solid rgba(255,255,255,0.15)", paddingTop: "12px", fontSize: "12px" }}>
            <div>
              <span style={{ opacity: 0.8 }}>Expenses Accrued:</span>
              <div style={{ fontWeight: "800", fontSize: "13px", marginTop: "2px", color: "#fca5a5" }}>{formatINR(ledger.totalExpenses)}</div>
            </div>
            <div>
              <span style={{ opacity: 0.8 }}>Payments Recv:</span>
              <div style={{ fontWeight: "800", fontSize: "13px", marginTop: "2px", color: "#86efac" }}>{formatINR(ledger.totalPayments)}</div>
            </div>
            <div style={{ gridColumn: "span 2" }}>
              <span style={{ opacity: 0.8 }}>Remaining Balance:</span>
              <div style={{ fontWeight: "800", fontSize: "14px", marginTop: "2px", color: "#93c5fd" }}>{formatINR(ledger.remainingBalance)}</div>
            </div>
          </div>
        </div>

        {/* Expenses List Header */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: 0, fontSize: "14.5px", fontWeight: "800", color: "var(--primary-950)" }}>Requisitions Summary</h4>
          <button
            type="button"
            onClick={() => {
              setExpenseCustomer("");
              setExpenseAmount("");
              setExpenseDate(new Date().toISOString().split("T")[0]);
              setExpenseDesc("");
              setExpenseNotes("");
              setExpenseErrors({});
              setShowAddExpenseModal(true);
            }}
            style={{
              padding: "7px 14px",
              backgroundColor: "#ea580c",
              color: "#ffffff",
              border: "none",
              borderRadius: "8px",
              fontSize: "12.5px",
              fontWeight: "750",
              cursor: "pointer",
              display: "inline-flex",
              alignItems: "center",
              gap: "6px"
            }}
          >
            <Plus size={15} /> Expense
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {myExpenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-color)", display: "flex", flexDirection: "column", alignItems: "center", gap: "10px" }}>
              <div style={{ width: "42px", height: "42px", borderRadius: "50%", backgroundColor: "#fff7ed", color: "#ea580c", display: "flex", alignItems: "center", justifyContent: "center" }}>
                <DollarSign size={20} />
              </div>
              <p style={{ margin: 0, fontSize: "13px", fontWeight: "600", color: "var(--text-muted)" }}>No Expense request logged</p>
              <button
                type="button"
                onClick={() => {
                  setExpenseCustomer("");
                  setExpenseAmount("");
                  setExpenseDate(new Date().toISOString().split("T")[0]);
                  setExpenseDesc("");
                  setExpenseNotes("");
                  setExpenseErrors({});
                  setShowAddExpenseModal(true);
                }}
                style={{
                  marginTop: "4px",
                  padding: "7px 16px",
                  backgroundColor: "#ea580c",
                  color: "#ffffff",
                  border: "none",
                  borderRadius: "8px",
                  fontSize: "12.5px",
                  fontWeight: "750",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "6px"
                }}
              >
                <Plus size={15} /> Expense
              </button>
            </div>
          ) : (
            myExpenses.map(exp => (
              <div key={exp.id} className="mobile-material-card" style={{ padding: "14px", display: "flex", flexDirection: "column", gap: "8px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-color)", boxShadow: "0 1px 2px rgba(0,0,0,0.03)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "12.5px", color: "#0f172a", fontWeight: "800" }}>
                    {exp.customer || "Expense Entry"}
                  </span>
                  <Badge status={exp.status === "Approved" ? "success" : exp.status === "Rejected" ? "danger" : "pending"}>
                    {exp.status ? exp.status.toUpperCase() : "PENDING"}
                  </Badge>
                </div>

                {exp.description && (
                  <div style={{ fontSize: "13px", fontWeight: "600", color: "#334155" }}>
                    {exp.description}
                  </div>
                )}

                {exp.notes && (
                  <div style={{ fontSize: "11.5px", color: "#64748b", fontStyle: "italic" }}>
                    Note: {exp.notes}
                  </div>
                )}

                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", color: "#64748b", borderTop: "1px solid #f1f5f9", paddingTop: "8px", marginTop: "2px" }}>
                  <span>Amount: <strong style={{ color: "#0f172a", fontSize: "13px" }}>{formatINR(exp.amount)}</strong></span>
                  <span className="font-mono" style={{ fontWeight: "600", color: "#475569" }}>{exp.date}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Request New Expense */}
        {showAddExpenseModal && (
          <Modal
            isOpen={showAddExpenseModal}
            onClose={() => {
              setShowAddExpenseModal(false);
              setExpenseErrors({});
            }}
            title="Request Site Expense"
            maxWidth="400px"
          >
            <form onSubmit={handleSaveExpense} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              {/* 1. Customer (Required) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="mobile-form-label" style={{ fontWeight: "700", fontSize: "12.5px", color: "#0f172a" }}>
                  Customer <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter customer / vendor name"
                  value={expenseCustomer}
                  onChange={(e) => {
                    setExpenseCustomer(e.target.value);
                    if (expenseErrors.customer) setExpenseErrors(prev => ({ ...prev, customer: "" }));
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${expenseErrors.customer ? "#dc2626" : "#cbd5e1"}`,
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
                {expenseErrors.customer && (
                  <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: "600" }}>{expenseErrors.customer}</span>
                )}
              </div>

              {/* 2. Amount (Required) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="mobile-form-label" style={{ fontWeight: "700", fontSize: "12.5px", color: "#0f172a" }}>
                  Amount (₹) <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  min="1"
                  step="any"
                  value={expenseAmount}
                  onChange={(e) => {
                    setExpenseAmount(e.target.value);
                    if (expenseErrors.amount) setExpenseErrors(prev => ({ ...prev, amount: "" }));
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${expenseErrors.amount ? "#dc2626" : "#cbd5e1"}`,
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
                {expenseErrors.amount && (
                  <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: "600" }}>{expenseErrors.amount}</span>
                )}
              </div>

              {/* 3. Date (Required) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="mobile-form-label" style={{ fontWeight: "700", fontSize: "12.5px", color: "#0f172a" }}>
                  Date <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => {
                    setExpenseDate(e.target.value);
                    if (expenseErrors.date) setExpenseErrors(prev => ({ ...prev, date: "" }));
                  }}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: `1px solid ${expenseErrors.date ? "#dc2626" : "#cbd5e1"}`,
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
                {expenseErrors.date && (
                  <span style={{ color: "#dc2626", fontSize: "11px", fontWeight: "600" }}>{expenseErrors.date}</span>
                )}
              </div>

              {/* 4. Description (Optional) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="mobile-form-label" style={{ fontWeight: "700", fontSize: "12.5px", color: "#475569" }}>
                  Description <span style={{ color: "#94a3b8", fontWeight: "400", fontSize: "11.5px" }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Enter details or purpose"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
              </div>

              {/* 5. Additional Notes (Optional) */}
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <label className="mobile-form-label" style={{ fontWeight: "700", fontSize: "12.5px", color: "#475569" }}>
                  Additional Notes <span style={{ color: "#94a3b8", fontWeight: "400", fontSize: "11.5px" }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  placeholder="Any additional remarks"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    outline: "none"
                  }}
                />
              </div>

              {/* Action Buttons */}
              <div style={{ display: "flex", gap: "10px", marginTop: "10px" }}>
                <Button 
                  type="button" 
                  variant="outline" 
                  style={{ flex: 1 }} 
                  onClick={() => {
                    setShowAddExpenseModal(false);
                    setExpenseErrors({});
                  }}
                >
                  Cancel
                </Button>
                <button 
                  type="submit" 
                  disabled={expenseSubmitting}
                  style={{
                    flex: 1,
                    padding: "10px",
                    backgroundColor: "#ea580c",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "13px",
                    fontWeight: "750",
                    cursor: "pointer",
                    opacity: expenseSubmitting ? 0.7 : 1
                  }}
                >
                  {expenseSubmitting ? "Submitting..." : "Submit Expense"}
                </button>
              </div>

            </form>
          </Modal>
        )}

      </div>
    );
  };


  const renderLabourView = () => {
    const isSequenceBlocked = !isLabourSubmitted && Boolean(labourDateSequenceStatus && !labourDateSequenceStatus.allowed);
    const isFormDisabled = isLabourSubmitted || isSequenceBlocked;
    const isNoWorkDate = Boolean(labourLockInfo?.isNoWork || labourLockInfo?.noWork || labourLockInfo?.status === "no_work");

    const isSubmittedByCurrentEngineer = Boolean(
      isLabourSubmitted && userProfile && labourLockInfo?.submittedBy &&
      (labourLockInfo.submittedBy === currentEngineerId ||
       labourLockInfo.submittedBy === userProfile?.uid ||
       labourLockInfo.submittedBy === userProfile?.id ||
       labourLockInfo.submittedBy === userProfile?.engineerId ||
       labourLockInfo.submittedBy === userProfile?.customId ||
       (labourLockInfo?.submittedByEmail && userProfile?.email && String(labourLockInfo.submittedByEmail).toLowerCase() === String(userProfile.email).toLowerCase()))
    );
    const submitterDisplayName = isSubmittedByCurrentEngineer
      ? "You"
      : (labourLockInfo?.submittedByName || "Site Engineer");
    const submitterDisplayEmail = isSubmittedByCurrentEngineer
      ? (userProfile?.email || currentUser?.email || "")
      : (labourLockInfo?.submittedByEmail || "");

    const selectedTeam = labourTeams.find(t => t.id === selectedLabourTeamId);
    const teamCategories = selectedTeam?.categories ? Object.values(selectedTeam.categories) : [];
    
    // Sort categories alphabetically by name
    teamCategories.sort((a, b) => (a.name || "").localeCompare(b.name || ""));

    return (
      <div style={{
        display: "flex",
        flexDirection: "column",
        gap: "20px",
        fontFamily: "'Outfit', 'Inter', sans-serif",
        color: "#1c1b1f",
        maxWidth: "600px",
        margin: "0 auto",
        padding: "8px 4px 80px 4px"
      }}>
        {/* Segmented Control (Orange / Light Grey Production Theme) */}
        <div style={{
          display: "flex",
          backgroundColor: "#f1f5f9",
          borderRadius: "24px",
          padding: "4px",
          gap: "4px",
          border: "1px solid #cbd5e1",
          boxShadow: "inset 0px 1px 2px rgba(0,0,0,0.03)",
          width: "100%",
          boxSizing: "border-box"
        }}>
          <button
            type="button"
            onClick={() => setActiveWorkforceSubTab("new-entry")}
            style={{
              flex: 1,
              padding: "10px 8px",
              minHeight: "42px",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "750",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeWorkforceSubTab === "new-entry" ? "#ffffff" : "transparent",
              color: activeWorkforceSubTab === "new-entry" ? "#ea580c" : "#64748b",
              boxShadow: activeWorkforceSubTab === "new-entry" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.2s ease",
              textAlign: "center",
              boxSizing: "border-box",
              whiteSpace: "nowrap"
            }}
          >
            Record Attendance
          </button>
          <button
            type="button"
            onClick={() => setActiveWorkforceSubTab("history")}
            style={{
              flex: 1,
              padding: "10px 8px",
              minHeight: "42px",
              borderRadius: "20px",
              fontSize: "14px",
              fontWeight: "750",
              border: "none",
              cursor: "pointer",
              backgroundColor: activeWorkforceSubTab === "history" ? "#ffffff" : "transparent",
              color: activeWorkforceSubTab === "history" ? "#ea580c" : "#64748b",
              boxShadow: activeWorkforceSubTab === "history" ? "0px 1px 3px rgba(0,0,0,0.12)" : "none",
              transition: "all 0.2s ease",
              textAlign: "center",
              boxSizing: "border-box",
              whiteSpace: "nowrap"
            }}
          >
            Attendance History
          </button>
        </div>

        {activeWorkforceSubTab === "history" ? (
          renderLabourAttendanceHistoryView()
        ) : (
          <>
            {/* Date Selector */}
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "16px",
              padding: "16px 20px",
              border: "1px solid #cbd5e1",
              boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
              display: "flex",
              flexDirection: "column",
              gap: "8px"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <label style={{
                  fontSize: "12px",
                  fontWeight: "750",
                  color: "#ea580c",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  Attendance Date
                </label>
                {!isLabourSubmitted && !isSequenceBlocked && (
                  <button
                    type="button"
                    onClick={handlePromptNoWork}
                    style={{
                      display: "inline-flex",
                      alignItems: "center",
                      gap: "4px",
                      padding: "3px 10px",
                      borderRadius: "8px",
                      backgroundColor: "#f8fafc",
                      border: "1px solid #cbd5e1",
                      color: "#64748b",
                      fontSize: "11.5px",
                      fontWeight: "750",
                      cursor: "pointer",
                      transition: "all 0.15s ease"
                    }}
                    onMouseEnter={(e) => {
                      e.currentTarget.style.backgroundColor = "#fef2f2";
                      e.currentTarget.style.borderColor = "#fca5a5";
                      e.currentTarget.style.color = "#b91c1c";
                    }}
                    onMouseLeave={(e) => {
                      e.currentTarget.style.backgroundColor = "#f8fafc";
                      e.currentTarget.style.borderColor = "#cbd5e1";
                      e.currentTarget.style.color = "#64748b";
                    }}
                    title="Mark this date as a non-working day for this site"
                  >
                    <span>🚫</span>
                    <span>Mark No Work</span>
                  </button>
                )}
              </div>
              <div 
                style={{
                  position: "relative",
                  display: "flex",
                  alignItems: "center",
                  width: "100%",
                  cursor: "pointer"
                }}
                onClick={() => {
                  const el = document.getElementById("labour-attendance-date-input");
                  if (el) {
                    try {
                      if (typeof el.showPicker === "function") {
                        el.showPicker();
                      } else {
                        el.focus();
                      }
                    } catch (err) {
                      el.focus();
                    }
                  }
                }}
              >
                <Calendar size={20} style={{ position: "absolute", left: "14px", color: "#ea580c", pointerEvents: "none", zIndex: 2 }} />
                <input 
                  id="labour-attendance-date-input"
                  type="date" 
                  value={labourDate} 
                  onChange={(e) => setLabourDate(e.target.value)} 
                  onClick={(e) => {
                    try {
                      if (typeof e.target.showPicker === "function") {
                        e.target.showPicker();
                      }
                    } catch (err) {}
                  }}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "12px 14px 12px 44px",
                    borderRadius: "12px",
                    border: "1.5px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "15px",
                    outline: "none",
                    color: "#0f172a",
                    fontWeight: "600",
                    cursor: "pointer",
                    boxSizing: "border-box"
                  }}
                />
              </div>
            </div>

            {/* Team Selector - Hidden if date is marked No Work */}
            {!isNoWorkDate && (
              <div style={{
                backgroundColor: "#ffffff",
                borderRadius: "16px",
                padding: "16px 20px",
                border: "1px solid #cbd5e1",
                boxShadow: "0px 1px 3px rgba(0,0,0,0.04)",
                display: "flex",
                flexDirection: "column",
                gap: "8px"
              }}>
                <label style={{
                  fontSize: "12px",
                  fontWeight: "750",
                  color: "#ea580c",
                  textTransform: "uppercase",
                  letterSpacing: "0.5px"
                }}>
                  Labour Team
                </label>
                <select
                  value={selectedLabourTeamId}
                  onChange={(e) => setSelectedLabourTeamId(e.target.value)}
                  style={{
                    width: "100%",
                    height: "48px",
                    padding: "12px 14px",
                    borderRadius: "12px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    fontSize: "15px",
                    outline: "none",
                    color: "#0f172a",
                    fontWeight: "600"
                  }}
                >
                  <option value="">-- Select Labour Team --</option>
                  {labourTeams.map(t => (
                    <option key={t.id} value={t.id}>{t.teamName}</option>
                  ))}
                </select>
              </div>
            )}

            {/* Categories & Dynamic Rows list */}
            {isNoWorkDate ? (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{
                  backgroundColor: "#f8fafc",
                  color: "#334155",
                  padding: "16px 20px",
                  borderRadius: "16px",
                  border: "1.5px solid #cbd5e1",
                  fontSize: "14px",
                  fontWeight: "700",
                  textAlign: "center",
                  display: "flex",
                  flexDirection: "column",
                  gap: "6px"
                }}>
                  <div style={{ fontSize: "15px", fontWeight: "850", color: "#0f172a" }}>
                    {isSubmittedByCurrentEngineer ? "🚫 Marked as No Work by you" : `🚫 Marked as No Work by ${submitterDisplayName}`}
                  </div>
                  <div style={{ fontSize: "12.5px", color: "#475569", fontWeight: "500" }}>
                    {isSubmittedByCurrentEngineer 
                      ? "This date was confirmed as a Non-Working / No Work day for this site by you. Normal labour entries are locked."
                      : `This date was confirmed as a Non-Working / No Work day for this site by ${submitterDisplayName}. Normal labour entries are locked.`}
                  </div>
                  {labourLockInfo && (
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#475569", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                      <div>
                        <span style={{ fontWeight: "750" }}>
                          Marked by: {isSubmittedByCurrentEngineer ? "You" : submitterDisplayName}
                        </span>
                        {submitterDisplayEmail && !isSubmittedByCurrentEngineer && (
                          <span style={{ marginLeft: "6px", color: "#64748b", fontWeight: "500" }}>
                            ({submitterDisplayEmail})
                          </span>
                        )}
                      </div>
                      {labourLockInfo.submittedAt && (
                        <span style={{ fontSize: "11.5px", opacity: 0.85 }}>
                          Marked: {
                            labourLockInfo.submittedAt?.seconds
                              ? new Date(labourLockInfo.submittedAt.seconds * 1000).toLocaleString("en-GB")
                              : (typeof labourLockInfo.submittedAt === "string" || labourLockInfo.submittedAt instanceof Date
                                ? new Date(labourLockInfo.submittedAt).toLocaleString("en-GB")
                                : formatDateDMY(labourDate))
                          }
                        </span>
                      )}
                    </div>
                  )}
                </div>

                <div style={{
                  textAlign: "center",
                  padding: "36px 20px",
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #cbd5e1",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  gap: "10px",
                  boxShadow: "0px 1px 3px rgba(0,0,0,0.04)"
                }}>
                  <div style={{ fontSize: "36px" }}>🏖️</div>
                  <div style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                    Non-Working Day / No Labour Recorded
                  </div>
                  <div style={{ fontSize: "13px", color: "#64748b", maxWidth: "420px", lineHeight: "1.4" }}>
                    This date has been explicitly marked as No Work for this site. The sequential date rule is satisfied, and the next working date can be submitted normally.
                  </div>
                </div>
              </div>
            ) : !selectedLabourTeamId ? (
              <div style={{
                textAlign: "center",
                padding: "48px 24px",
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                border: "1px dashed #cbd5e1",
                color: "#64748b",
                fontSize: "15px",
                fontWeight: "600"
              }}>
                Please select a Labour Team to record attendance
              </div>
            ) : teamCategories.length === 0 ? (
              <div style={{
                textAlign: "center",
                padding: "48px 24px",
                backgroundColor: "#ffffff",
                borderRadius: "20px",
                border: "1px dashed #ef4444",
                color: "#b91c1c",
                fontSize: "15px",
                fontWeight: "600"
              }}>
                No categories configured for this Team by Admin
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                {isLabourSubmitted && (
                  <div style={{
                    backgroundColor: "#fef2f2",
                    color: "#991b1b",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    border: "1px solid #fecaca",
                    fontSize: "14px",
                    fontWeight: "700",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}>
                    <div style={{ fontSize: "15px", fontWeight: "850", color: "#b91c1c" }}>
                      {isSubmittedByCurrentEngineer ? "🔒 Submitted by you" : "🔒 Already Submitted"}
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#7f1d1d", fontWeight: "500" }}>
                      {isSubmittedByCurrentEngineer 
                        ? "Workforce attendance has been submitted and locked by you for this site and date. Normal editing and resubmission are disabled."
                        : `Workforce attendance for this site and date has already been submitted by ${submitterDisplayName}. No duplicate submissions are permitted.`}
                    </div>
                    {labourLockInfo && (
                      <div style={{ fontSize: "12px", fontWeight: "600", color: "#991b1b", marginTop: "4px", display: "flex", flexDirection: "column", gap: "2px", alignItems: "center" }}>
                        <div>
                          <span style={{ fontWeight: "750" }}>
                            Submitted by: {isSubmittedByCurrentEngineer ? "You" : submitterDisplayName}
                          </span>
                          {submitterDisplayEmail && !isSubmittedByCurrentEngineer && (
                            <span style={{ marginLeft: "6px", color: "#7f1d1d", fontWeight: "500" }}>
                              ({submitterDisplayEmail})
                            </span>
                          )}
                        </div>
                        {labourLockInfo.submittedAt && (
                          <span style={{ fontSize: "11.5px", opacity: 0.85 }}>
                            Submitted: {
                              labourLockInfo.submittedAt?.seconds
                                ? new Date(labourLockInfo.submittedAt.seconds * 1000).toLocaleString("en-GB")
                                : (typeof labourLockInfo.submittedAt === "string" || labourLockInfo.submittedAt instanceof Date
                                  ? new Date(labourLockInfo.submittedAt).toLocaleString("en-GB")
                                  : formatDateDMY(labourDate))
                            }
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {isSequenceBlocked && (
                  <div style={{
                    backgroundColor: "#fffbeb",
                    color: "#92400e",
                    padding: "16px 20px",
                    borderRadius: "16px",
                    border: "1px solid #fde68a",
                    fontSize: "14px",
                    fontWeight: "700",
                    textAlign: "center",
                    display: "flex",
                    flexDirection: "column",
                    gap: "6px"
                  }}>
                    <div style={{ fontSize: "14px", fontWeight: "800", color: "#b45309" }}>
                      ⚠️ Please submit the previous pending date first
                    </div>
                    <div style={{ fontSize: "12.5px", color: "#78350f", fontWeight: "500" }}>
                      {labourDateSequenceStatus.requiredDate 
                        ? `Attendance for previous required date (${formatDateDMY(labourDateSequenceStatus.requiredDate)}) must be submitted and locked before recording attendance for ${formatDateDMY(labourDate)}.`
                        : (labourDateSequenceStatus.message || "Please submit the previous pending date first.")}
                    </div>
                    {labourDateSequenceStatus.requiredDate && (
                      <div style={{ marginTop: "6px" }}>
                        <button
                          type="button"
                          onClick={() => setLabourDate(labourDateSequenceStatus.requiredDate)}
                          style={{
                            padding: "6px 16px",
                            borderRadius: "10px",
                            backgroundColor: "#ea580c",
                            color: "#ffffff",
                            border: "none",
                            fontSize: "12.5px",
                            fontWeight: "750",
                            cursor: "pointer",
                            boxShadow: "0 1px 3px rgba(234,88,12,0.3)",
                            transition: "all 0.15s ease"
                          }}
                        >
                          Switch to Date {formatDateDMY(labourDateSequenceStatus.requiredDate)}
                        </button>
                      </div>
                    )}
                  </div>
                )}

                {teamCategories.map(cat => {
                  const record = attendanceRows.find(r => r.categoryId === cat.id);
                  const count = record ? record.workerCount : 0;
                  const currentUnitsStr = workUnitsSelections[cat.id] !== undefined ? workUnitsSelections[cat.id] : (record?.customWorkUnits || record?.units || "1.0");
                  const currentUnits = Math.max(0.01, Number(currentUnitsStr) || 1.0);
                  const dailyWage = Number(cat.wage || cat.salaryAmount || cat.baseWage || 0);
                  const rowAmount = (record?.calculatedAmount !== undefined && record.calculatedAmount !== null) ? Number(record.calculatedAmount) : (count * currentUnits * dailyWage);
                  const isSaving = savingRecordKeys[`${cat.id}`] || false;
                  const hasCustomEntries = record?.workerEntries && record.workerEntries.length > 0;
                  const isExpanded = expandedWorkerCategories[cat.id] !== undefined ? expandedWorkerCategories[cat.id] : hasCustomEntries;
                  
                  return (
                    <div key={cat.id} style={{
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      border: count > 0 ? "1.5px solid #ea580c" : "1px solid #cbd5e1",
                      padding: "18px 20px",
                      boxShadow: "0px 1px 3px rgba(0, 0, 0, 0.05)",
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px"
                    }}>
                      {/* Category Header & Wage Info */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        borderBottom: "1px solid #e2e8f0",
                        paddingBottom: "8px"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>
                            {cat.name}
                          </span>
                          {isSaving && (
                            <span style={{
                              width: "14px",
                              height: "14px",
                              border: "2px solid #ea580c",
                              borderTop: "2px solid transparent",
                              borderRadius: "50%",
                              animation: "spin 0.8s linear infinite",
                              display: "inline-block"
                            }} />
                          )}
                        </div>
                        <div style={{ textAlign: "right" }}>
                          <span style={{ fontSize: "12px", fontWeight: "750", color: "#166534", backgroundColor: "#f0fdf4", padding: "4px 8px", borderRadius: "8px" }}>
                            {dailyWage > 0 ? `₹${dailyWage.toLocaleString("en-IN")} / Day` : "Wage Pending Setup"}
                          </span>
                        </div>
                      </div>

                      {/* Count increment/decrement section */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "4px 0"
                      }}>
                        <span style={{ fontSize: "14px", fontWeight: "700", color: "#334155" }}>
                          Worker Count : <span style={{ fontSize: "16px", color: "#0f172a", marginLeft: "4px", fontWeight: "800" }}>{count}</span>
                        </span>

                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <button
                            type="button"
                            onClick={() => handleCountChange(cat.id, currentUnitsStr, -1)}
                            disabled={count <= 0 || isSaving || isFormDisabled}
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              border: (count <= 0 || isFormDisabled) ? "1px solid #cbd5e1" : "1.5px solid #ea580c",
                              backgroundColor: (count <= 0 || isFormDisabled) ? "#f1f5f9" : "#fff7ed",
                              color: (count <= 0 || isFormDisabled) ? "#94a3b8" : "#ea580c",
                              fontWeight: "900",
                              cursor: (count <= 0 || isFormDisabled) ? "not-allowed" : "pointer",
                              fontSize: "20px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              outline: "none",
                              transition: "all 0.15s ease"
                            }}
                          >
                            -
                          </button>

                          <button
                            type="button"
                            onClick={() => handleCountChange(cat.id, currentUnitsStr, 1)}
                            disabled={isSaving || isFormDisabled}
                            style={{
                              width: "40px",
                              height: "40px",
                              borderRadius: "50%",
                              border: isFormDisabled ? "1px solid #cbd5e1" : "1.5px solid #ea580c",
                              backgroundColor: isFormDisabled ? "#f1f5f9" : "#ea580c",
                              color: isFormDisabled ? "#94a3b8" : "#ffffff",
                              fontWeight: "900",
                              cursor: isFormDisabled ? "not-allowed" : "pointer",
                              fontSize: "20px",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              outline: "none",
                              transition: "all 0.15s ease"
                            }}
                          >
                            +
                          </button>
                        </div>
                      </div>

                      {/* Work Units & Calculated Amount Section */}
                      <div style={{
                        display: "flex",
                        flexDirection: "column",
                        gap: "8px",
                        borderTop: "1px solid #e2e8f0",
                        paddingTop: "12px"
                      }}>
                        <div style={{
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "space-between",
                          gap: "12px",
                          padding: "10px 14px",
                          backgroundColor: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0"
                        }}>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <span style={{ fontSize: "12px", fontWeight: "750", color: "#64748b", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                              Default Duration
                            </span>
                            <input
                              type="number"
                              step="any"
                              min="0.01"
                              placeholder="1.0"
                              value={currentUnitsStr}
                              onChange={(e) => handleWorkUnitsChange(cat.id, e.target.value)}
                              disabled={isFormDisabled}
                              style={{
                                width: "72px",
                                height: "36px",
                                boxSizing: "border-box",
                                padding: "6px 8px",
                                borderRadius: "8px",
                                border: "1.5px solid #ea580c",
                                fontSize: "14px",
                                fontWeight: "800",
                                textAlign: "center",
                                backgroundColor: isFormDisabled ? "#f1f5f9" : "#ffffff",
                                outline: "none"
                              }}
                            />
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "#64748b", textTransform: "uppercase", display: "block" }}>
                              Total Amount
                            </span>
                            <span style={{ fontSize: "16px", fontWeight: "850", color: rowAmount > 0 ? "#ea580c" : "#0f172a" }}>
                              ₹{rowAmount.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Individual Worker / Custom Durations Expandable Section */}
                      {count > 0 && (
                        <div style={{
                          borderTop: "1px dashed #e2e8f0",
                          paddingTop: "10px",
                          display: "flex",
                          flexDirection: "column",
                          gap: "8px"
                        }}>
                          <div
                            onClick={() => toggleExpandWorkerCategory(cat.id)}
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              cursor: "pointer",
                              userSelect: "none"
                            }}
                          >
                            <span style={{ fontSize: "12.5px", fontWeight: "750", color: "#475569" }}>
                              Worker-Level Customization ({count} {count === 1 ? "worker" : "workers"})
                            </span>
                            <span style={{ fontSize: "12px", color: "#ea580c", fontWeight: "800" }}>
                              {isExpanded ? "▲ Hide" : "▼ Specify Individual Durations"}
                            </span>
                          </div>

                          {isExpanded && (
                            <div style={{
                              display: "flex",
                              flexDirection: "column",
                              gap: "8px",
                              backgroundColor: "#f8fafc",
                              padding: "12px",
                              borderRadius: "12px",
                              border: "1px solid #e2e8f0"
                            }}>
                              <div style={{ display: "grid", gridTemplateColumns: "1fr 64px 64px 72px", gap: "6px", fontSize: "11px", fontWeight: "750", color: "#64748b", textTransform: "uppercase", paddingBottom: "4px", borderBottom: "1px solid #e2e8f0" }}>
                                <span>Worker Name</span>
                                <span style={{ textAlign: "center" }}>Units</span>
                                <span style={{ textAlign: "right" }}>Wage</span>
                                <span style={{ textAlign: "right" }}>Subtotal</span>
                              </div>

                              {Array.from({ length: count }).map((_, idx) => {
                                const workerEntry = (record?.workerEntries || [])[idx];
                                const workerName = workerEntry?.workerName || `${cat.name} ${idx + 1}`;
                                const workerUnits = workerEntry?.customWorkUnits !== undefined ? workerEntry.customWorkUnits : currentUnits;
                                const workerWage = workerEntry?.dailyWage !== undefined ? workerEntry.dailyWage : dailyWage;
                                const workerAmount = workerEntry?.calculatedAmount !== undefined ? workerEntry.calculatedAmount : (workerUnits * workerWage);

                                return (
                                  <div key={idx} style={{
                                    display: "grid",
                                    gridTemplateColumns: "1fr 64px 64px 72px",
                                    gap: "6px",
                                    alignItems: "center"
                                  }}>
                                    <div style={{ display: "flex", alignItems: "center", gap: "6px", overflow: "hidden" }}>
                                      <div style={{
                                        width: "18px",
                                        height: "18px",
                                        borderRadius: "50%",
                                        backgroundColor: "#ea580c",
                                        color: "#ffffff",
                                        display: "flex",
                                        alignItems: "center",
                                        justifyContent: "center",
                                        fontSize: "10px",
                                        fontWeight: "800",
                                        flexShrink: 0
                                      }}>
                                        {idx + 1}
                                      </div>
                                      <span style={{ fontSize: "12px", fontWeight: "700", color: "#1e293b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                        {workerName}
                                      </span>
                                    </div>
                                    <input
                                      type="number"
                                      step="any"
                                      min="0.01"
                                      value={workerUnits}
                                      onChange={(e) => handleWorkerCustomDurationChange(cat.id, idx, e.target.value, workerName)}
                                      disabled={isFormDisabled}
                                      style={{
                                        width: "60px",
                                        height: "30px",
                                        boxSizing: "border-box",
                                        padding: "4px 6px",
                                        borderRadius: "6px",
                                        border: "1px solid #cbd5e1",
                                        fontSize: "12px",
                                        fontWeight: "800",
                                        textAlign: "center",
                                        backgroundColor: isFormDisabled ? "#f1f5f9" : "#ffffff",
                                        outline: "none"
                                      }}
                                    />
                                    <span style={{ fontSize: "12px", color: "#64748b", textAlign: "right" }}>₹{workerWage.toLocaleString("en-IN")}</span>
                                    <span style={{ fontSize: "13px", fontWeight: "800", textAlign: "right" }}>₹{workerAmount.toLocaleString("en-IN")}</span>
                                  </div>
                                );
                              })}

                              <div style={{
                                display: "flex",
                                justifyContent: "space-between",
                                alignItems: "center",
                                borderTop: "1px solid #e2e8f0",
                                paddingTop: "8px",
                                marginTop: "4px",
                                fontSize: "12px",
                                fontWeight: "800",
                                color: "#0f172a"
                              }}>
                                <span>Category Combined Total</span>
                                <span style={{ color: "#ea580c", fontSize: "14px" }}>
                                  ₹{rowAmount.toLocaleString("en-IN")}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                    </div>
                  );
                })}

                {/* Production Workforce Summary Dashboard (Consistent Color-per-Metric) */}
                {(() => {
                  let totalWorkers = 0;
                  let presentCategoriesCount = 0;
                  let totalWorkUnits = 0;
                  let totalLabourCost = 0;

                  attendanceRows.forEach(r => {
                    const count = Number(r.workerCount) || 0;
                    if (count > 0) presentCategoriesCount += 1;
                    const units = Number(r.customWorkUnits !== undefined ? r.customWorkUnits : (r.units !== undefined ? r.units : 1.0)) || 1.0;
                    const wage = Number(r.dailyWage || r.wage || 0);
                    const cost = r.calculatedAmount !== undefined && r.calculatedAmount !== null ? Number(r.calculatedAmount) : (count * units * wage);

                    totalWorkers += count;
                    totalWorkUnits += count * units;
                    totalLabourCost += cost;
                  });

                  const avgUnits = totalWorkers > 0 ? (totalWorkUnits / totalWorkers).toFixed(2) : "0.00";

                  return (
                    <div style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "14px",
                      padding: "20px",
                      backgroundColor: "#ffffff",
                      borderRadius: "16px",
                      border: "1.5px solid #cbd5e1",
                      boxShadow: "0px 2px 6px rgba(0,0,0,0.04)",
                      marginTop: "10px"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                        <span style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                          Workforce Daily Summary
                        </span>
                        <span style={{
                          fontSize: "12px",
                          fontWeight: "750",
                          padding: "4px 10px",
                          borderRadius: "12px",
                          backgroundColor: isLabourSubmitted ? (isNoWorkDate ? "#f8fafc" : "#fef2f2") : (isSequenceBlocked ? "#fffbeb" : "#f0fdf4"),
                          color: isLabourSubmitted ? (isNoWorkDate ? "#334155" : "#b91c1c") : (isSequenceBlocked ? "#b45309" : "#166534"),
                          border: isLabourSubmitted ? (isNoWorkDate ? "1px solid #cbd5e1" : "1px solid #fca5a5") : (isSequenceBlocked ? "1px solid #fde68a" : "1px solid #bbf7d0"),
                          display: "flex",
                          alignItems: "center",
                          gap: "6px",
                          whiteSpace: "nowrap",
                          flexShrink: 0,
                          lineHeight: "1.2"
                        }}>
                          {isLabourSubmitted 
                            ? (isNoWorkDate
                                ? (isSubmittedByCurrentEngineer ? "🚫 No Work (You)" : `🚫 No Work (${submitterDisplayName})`)
                                : (isSubmittedByCurrentEngineer ? "🔒 Submitted by you" : `🔒 Submitted by ${submitterDisplayName}`)) 
                            : (isSequenceBlocked ? "⚠️ Sequence Blocked" : "🟢 Open & Editable")}
                        </span>
                      </div>

                      {/* Metric Grid (Consistent 2x2 with clear color mapping) */}
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div style={{ backgroundColor: "#fff7ed", padding: "12px", borderRadius: "12px", textAlign: "center", border: "1px solid #ffedd5" }}>
                          <span style={{ fontSize: "11px", fontWeight: "750", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Workers</span>
                          <div style={{ fontSize: "20px", fontWeight: "900", color: "#9a3412", marginTop: "2px" }}>{totalWorkers}</div>
                        </div>

                        <div style={{ backgroundColor: "#f0f9ff", padding: "12px", borderRadius: "12px", textAlign: "center", border: "1px solid #e0f2fe" }}>
                          <span style={{ fontSize: "11px", fontWeight: "750", color: "#0284c7", textTransform: "uppercase", letterSpacing: "0.5px" }}>Active Groups</span>
                          <div style={{ fontSize: "20px", fontWeight: "900", color: "#0369a1", marginTop: "2px" }}>{presentCategoriesCount}</div>
                        </div>

                        <div style={{ backgroundColor: "#f8fafc", padding: "12px", borderRadius: "12px", textAlign: "center", border: "1px solid #e2e8f0" }}>
                          <span style={{ fontSize: "11px", fontWeight: "750", color: "#475569", textTransform: "uppercase", letterSpacing: "0.5px" }}>Avg Work Units</span>
                          <div style={{ fontSize: "20px", fontWeight: "900", color: "#0f172a", marginTop: "2px" }}>{avgUnits}</div>
                        </div>

                        <div style={{ backgroundColor: "#fefce8", padding: "12px", borderRadius: "12px", textAlign: "center", border: "1px solid #fef9c3" }}>
                          <span style={{ fontSize: "11px", fontWeight: "750", color: "#ca8a04", textTransform: "uppercase", letterSpacing: "0.5px" }}>Work Units Sum</span>
                          <div style={{ fontSize: "20px", fontWeight: "900", color: "#854d0e", marginTop: "2px" }}>{totalWorkUnits.toFixed(2)}</div>
                        </div>
                      </div>

                      {/* Total Cost Informational Banner (Distinct from Action Button) */}
                      <div style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        padding: "14px 18px",
                        backgroundColor: "#fff7ed",
                        borderRadius: "12px",
                        border: "1.5px solid #fed7aa"
                      }}>
                        <span style={{ fontSize: "13px", fontWeight: "750", textTransform: "uppercase", letterSpacing: "0.5px", color: "#c2410c" }}>
                          Calculated Amount
                        </span>
                        <span style={{ fontSize: "22px", fontWeight: "900", color: "#1e3a8a" }}>
                          ₹{totalLabourCost.toLocaleString("en-IN")}
                        </span>
                      </div>
                    </div>
                  );
                })()}

                {!isLabourSubmitted && (
                  <button
                    type="button"
                    onClick={handleLabourSubmit}
                    disabled={labourSubmitting || attendanceRows.length === 0 || isSequenceBlocked}
                    style={{
                      width: "100%",
                      padding: "14px 16px",
                      borderRadius: "14px",
                      backgroundColor: (labourSubmitting || attendanceRows.length === 0 || isSequenceBlocked) ? "#f1f5f9" : "#ea580c",
                      color: (labourSubmitting || attendanceRows.length === 0 || isSequenceBlocked) ? "#94a3b8" : "#ffffff",
                      border: (labourSubmitting || attendanceRows.length === 0 || isSequenceBlocked) ? "1px solid #cbd5e1" : "none",
                      fontSize: "16px",
                      fontWeight: "750",
                      cursor: (labourSubmitting || attendanceRows.length === 0 || isSequenceBlocked) ? "not-allowed" : "pointer",
                      marginTop: "16px",
                      boxShadow: (labourSubmitting || attendanceRows.length === 0 || isSequenceBlocked) ? "none" : "0px 2px 6px rgba(234,88,12,0.25)",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {labourSubmitting ? "Submitting..." : (isSequenceBlocked ? "Please submit the previous pending date first" : "Submit Attendance")}
                  </button>
                )}
              </div>
            )}
          </>
        )}
        
        {/* CSS Keyframes for Spin Loader */}
        <style dangerouslySetInnerHTML={{__html: `
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
        `}} />
      </div>
    );
  };

  const renderLabourAttendanceHistoryView = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    
    const getYesterdayStr = () => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return d.toISOString().split("T")[0];
    };
    const yesterdayStr = getYesterdayStr();

    const getStartOfWeek = () => {
      const today = new Date();
      const day = today.getDay();
      const diff = today.getDate() - day + (day === 0 ? -6 : 1);
      const monday = new Date(today.setDate(diff));
      monday.setHours(0,0,0,0);
      return monday;
    };
    const startOfWeek = getStartOfWeek();

    const thisMonthPrefix = new Date().toISOString().slice(0, 7);

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

    // 1. Filter records in memory
    const filteredRecords = labourHistoryRecords.filter(r => {
      if (r.createdBy && r.createdBy !== currentEngineerId) {
        return false;
      }

      if (filterSearch.trim()) {
        const queryStr = filterSearch.trim().toLowerCase();
        const teamObj = labourTeams.find(t => t.id === r.teamId);
        const catObj = teamObj?.categories?.[r.categoryId] || categories.find(c => c.id === r.categoryId);
        const catName = catObj ? catObj.name : (r.categoryName || "");
        
        const workerNameMatch = r.workerName && r.workerName.toLowerCase().includes(queryStr);
        const categoryNameMatch = catName && catName.toLowerCase().includes(queryStr);
        if (!workerNameMatch && !categoryNameMatch) {
          return false;
        }
      }

      // Date Range Filters
      if (filterDateMode === "Today") {
        if (r.attendanceDate !== todayStr) return false;
      } else if (filterDateMode === "Yesterday") {
        if (r.attendanceDate !== yesterdayStr) return false;
      } else if (filterDateMode === "This Week") {
        const rDate = new Date(r.attendanceDate);
        rDate.setHours(0,0,0,0);
        if (rDate < startOfWeek) return false;
      } else if (filterDateMode === "This Month") {
        if (!r.attendanceDate || !r.attendanceDate.startsWith(thisMonthPrefix)) return false;
      } else if (filterDateMode === "Custom Date") {
        if (filterDate && r.attendanceDate !== filterDate) return false;
      }

      if (filterTeamId && r.teamId !== filterTeamId) {
        return false;
      }
      if (filterCategory && r.categoryId !== filterCategory) {
        return false;
      }
      return true;
    });

    // 2. Calculate dynamic grand totals from filtered records
    let grandTotalWorkers = 0;
    let grandTotalWorkUnits = 0;
    let grandTotalLabourCost = 0;

    filteredRecords.forEach(r => {
      const count = Number(r.workerCount) || (r.workerName ? 1 : 0);
      const units = Number(r.customWorkUnits !== undefined ? r.customWorkUnits : (r.units !== undefined ? r.units : (r.attendanceType === "Half Day" ? 0.5 : 1.0))) || 1.0;
      const teamObj = labourTeams.find(t => t.id === r.teamId);
      const catObj = teamObj?.categories?.[r.categoryId] || categories.find(c => c.id === r.categoryId);
      const wage = Number(r.dailyWage || r.wage || catObj?.wage || catObj?.salaryAmount || catObj?.baseWage || 0);
      const cost = r.calculatedAmount !== undefined && r.calculatedAmount !== null ? Number(r.calculatedAmount) : (count * units * wage);

      grandTotalWorkers += count;
      grandTotalWorkUnits += count * units;
      grandTotalLabourCost += cost;
    });

    // 3. Group by Date
    const groupedByDate = {};
    filteredRecords.forEach(r => {
      const date = r.attendanceDate || "Unknown Date";
      if (!groupedByDate[date]) {
        groupedByDate[date] = [];
      }
      groupedByDate[date].push(r);
    });

    const sortedDates = Object.keys(groupedByDate).sort((a, b) => b.localeCompare(a));

    const allCategories = [];
    const catSeen = new Set();
    labourTeams.forEach(t => {
      if (t.categories) {
        Object.values(t.categories).forEach(c => {
          if (!catSeen.has(c.name)) {
            catSeen.add(c.name);
            allCategories.push({ id: c.id, name: c.name });
          }
        });
      }
    });
    allCategories.sort((a, b) => a.name.localeCompare(b.name));

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
        
        {/* Production Grand Total Summary Cards (Aligned Color-Per-Metric Theme) */}
        <div style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr",
          gap: "10px",
          width: "100%"
        }}>
          <div style={{
            backgroundColor: "#fff7ed",
            borderRadius: "14px",
            padding: "14px 16px",
            border: "1px solid #ffedd5",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: "750", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>Grand Total Workers</span>
            <span style={{ fontSize: "22px", fontWeight: "900", color: "#9a3412" }}>{grandTotalWorkers}</span>
          </div>

          <div style={{
            backgroundColor: "#fefce8",
            borderRadius: "14px",
            padding: "14px 16px",
            border: "1px solid #fef9c3",
            display: "flex",
            flexDirection: "column",
            gap: "4px"
          }}>
            <span style={{ fontSize: "11px", fontWeight: "750", color: "#ca8a04", textTransform: "uppercase", letterSpacing: "0.5px" }}>Total Work Units</span>
            <span style={{ fontSize: "22px", fontWeight: "900", color: "#854d0e" }}>{grandTotalWorkUnits.toFixed(2)}</span>
          </div>

          <div style={{
            gridColumn: "1 / -1",
            backgroundColor: "#f0fdf4",
            borderRadius: "14px",
            padding: "14px 16px",
            border: "1px solid #dcfce7",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center"
          }}>
            <div>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#166534", textTransform: "uppercase", letterSpacing: "0.5px", display: "block" }}>Grand Total Cost</span>
              <span style={{ fontSize: "12px", color: "#15803d", fontWeight: "600" }}>Total calculated workforce expense</span>
            </div>
            <span style={{ fontSize: "22px", fontWeight: "900", color: "#14532d" }}>₹{grandTotalLabourCost.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {/* Filters Card */}
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "16px",
          padding: "18px",
          border: "1px solid #cbd5e1",
          display: "flex",
          flexDirection: "column",
          gap: "14px",
          boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.04)"
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "#ea580c", textTransform: "uppercase", letterSpacing: "0.5px" }}>
              Filter & Search History
            </h4>
            {(filterSearch || (filterDateMode === "Custom Date" && filterDate) || filterDateMode !== "This Month" || filterTeamId || filterCategory) && (
              <button
                type="button"
                onClick={() => {
                  setFilterSearch("");
                  setFilterDate("");
                  setFilterDateMode("This Month");
                  setFilterTeamId("");
                  setFilterCategory("");
                }}
                style={{
                  backgroundColor: "#fff7ed",
                  color: "#ea580c",
                  border: "1px solid #ffedd5",
                  borderRadius: "8px",
                  fontSize: "12px",
                  fontWeight: "750",
                  cursor: "pointer",
                  padding: "4px 10px"
                }}
              >
                Clear Filters
              </button>
            )}
          </div>
          
          {/* Search Input */}
          <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
            <Search size={18} style={{ position: "absolute", left: "14px", color: "#ea580c", pointerEvents: "none" }} />
            <input 
              type="text"
              placeholder="Search category name..."
              value={filterSearch}
              onChange={(e) => setFilterSearch(e.target.value)}
              style={{
                width: "100%",
                height: "44px",
                padding: "8px 12px 8px 42px",
                borderRadius: "12px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "14px",
                outline: "none",
                color: "#0f172a"
              }}
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
            {/* Time Period Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#475569" }}>Time Period</span>
              <select
                value={filterDateMode}
                onChange={(e) => setFilterDateMode(e.target.value)}
                style={{
                  height: "42px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                  color: "#0f172a",
                  fontWeight: "600"
                }}
              >
                <option value="Today">Today</option>
                <option value="Yesterday">Yesterday</option>
                <option value="This Week">This Week</option>
                <option value="This Month">This Month</option>
                <option value="Custom Date">Custom Date</option>
              </select>
            </div>

            {/* Custom Date Picker */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px", opacity: filterDateMode === "Custom Date" ? 1 : 0.5 }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#475569" }}>Custom Date</span>
              <div style={{ position: "relative", display: "flex", alignItems: "center" }}>
                <Calendar size={16} style={{ position: "absolute", left: "12px", color: "#ea580c", pointerEvents: "none" }} />
                <input 
                  type="date"
                  className="no-native-calendar-icon"
                  value={filterDate}
                  disabled={filterDateMode !== "Custom Date"}
                  onChange={(e) => setFilterDate(e.target.value)}
                  style={{
                    width: "100%",
                    height: "42px",
                    padding: "8px 12px 8px 38px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: filterDateMode === "Custom Date" ? "#ffffff" : "#f1f5f9",
                    fontSize: "13px",
                    outline: "none",
                    color: "#0f172a"
                  }}
                />
              </div>
            </div>

            {/* Category Filter */}
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontSize: "11px", fontWeight: "750", color: "#475569" }}>Category Filter</span>
              <select
                value={filterCategory}
                onChange={(e) => setFilterCategory(e.target.value)}
                style={{
                  height: "42px",
                  padding: "8px 12px",
                  borderRadius: "10px",
                  border: "1px solid #cbd5e1",
                  backgroundColor: "#ffffff",
                  fontSize: "13px",
                  outline: "none",
                  color: "#0f172a",
                  fontWeight: "600"
                }}
              >
                <option value="">All Categories</option>
                {allCategories.map(c => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* History Timeline Cards */}
        <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          {sortedDates.length === 0 ? (
            <div style={{
              textAlign: "center",
              padding: "40px 20px",
              backgroundColor: "#f8fafc",
              borderRadius: "16px",
              border: "1.5px dashed #cbd5e1",
              color: "#64748b",
              fontSize: "14px",
              fontWeight: "600"
            }}>
              {labourHistoryRecords.length === 0 
                ? "No workforce attendance records recorded yet." 
                : "No attendance records match your filter criteria."}
            </div>
          ) : (
            sortedDates.map(dateStr => {
              const records = groupedByDate[dateStr];
              const isLocked = records.some(r => r.status === "submitted" || r.locked || isTeamLockedOnDate(dateStr, r.teamId));

              let dateWorkers = 0;
              let dateCost = 0;

              records.forEach(r => {
                const count = Number(r.workerCount) || 1;
                const units = Number(r.customWorkUnits !== undefined ? r.customWorkUnits : (r.units !== undefined ? r.units : 1.0)) || 1.0;
                const teamObj = labourTeams.find(t => t.id === r.teamId);
                const catObj = teamObj?.categories?.[r.categoryId] || categories.find(c => c.id === r.categoryId);
                const wage = Number(r.dailyWage || r.wage || catObj?.wage || catObj?.salaryAmount || catObj?.baseWage || 0);
                const cost = r.calculatedAmount !== undefined && r.calculatedAmount !== null ? Number(r.calculatedAmount) : (count * units * wage);

                dateWorkers += count;
                dateCost += cost;
              });

              let displayDateStr = dateStr;
              try {
                const [y, m, d] = dateStr.split("-");
                if (y && m && d) displayDateStr = `${d}-${m}-${y}`;
              } catch (e) {}

              return (
                <div key={dateStr} style={{
                  backgroundColor: "#ffffff",
                  borderRadius: "16px",
                  border: "1px solid #cbd5e1",
                  boxShadow: "0px 2px 6px rgba(0, 0, 0, 0.04)",
                  overflow: "hidden"
                }}>
                  {/* Date Card Header */}
                  <div style={{
                    padding: "16px 20px",
                    backgroundColor: "#f8fafc",
                    borderBottom: "1px solid #e2e8f0",
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center"
                  }}>
                    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                      <Calendar size={20} style={{ color: "#ea580c" }} />
                      <span style={{ fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>{displayDateStr}</span>
                      <span style={{
                        fontSize: "11px",
                        fontWeight: "750",
                        padding: "2px 8px",
                        borderRadius: "10px",
                        backgroundColor: isLocked ? "#fef2f2" : "#f0fdf4",
                        color: isLocked ? "#b91c1c" : "#166534",
                        border: isLocked ? "1px solid #fca5a5" : "1px solid #bbf7d0"
                      }}>
                        {isLocked ? "🔒 Team Locked" : "🟢 Open"}
                      </span>
                    </div>

                    <div style={{ textAlign: "right" }}>
                      <span style={{ fontSize: "14px", fontWeight: "900", color: "#ea580c" }}>
                        ₹{dateCost.toLocaleString("en-IN")}
                      </span>
                      <div style={{ fontSize: "11px", color: "#64748b", fontWeight: "700" }}>
                        {dateWorkers} Workers
                      </div>
                    </div>
                  </div>

                  {/* List of Category Entries */}
                  <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
                    {records.map(record => {
                      const count = Number(record.workerCount) || 1;
                      const units = Number(record.customWorkUnits !== undefined ? record.customWorkUnits : (record.units !== undefined ? record.units : 1.0)) || 1.0;
                      const teamObj = labourTeams.find(t => t.id === record.teamId);
                      const teamName = teamObj ? (teamObj.name || teamObj.teamName) : (record.teamName || "Labour Team");
                      const catObj = teamObj?.categories?.[record.categoryId] || categories.find(c => c.id === record.categoryId);
                      const catName = catObj ? catObj.name : (record.categoryName || record.category || "Labour Category");
                      const wage = Number(record.dailyWage || record.wage || catObj?.wage || catObj?.salaryAmount || catObj?.baseWage || 0);
                      const cost = record.calculatedAmount !== undefined && record.calculatedAmount !== null ? Number(record.calculatedAmount) : (count * units * wage);
                      const recordLocked = record.status === "submitted" || record.locked || isTeamLockedOnDate(record.attendanceDate, record.teamId);

                      return (
                        <div key={record.id || `${record.categoryId}_${record.attendanceDate}`} style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          padding: "14px 16px",
                          backgroundColor: "#f8fafc",
                          borderRadius: "12px",
                          border: "1px solid #e2e8f0"
                        }}>
                          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
                              <span style={{ fontSize: "15px", fontWeight: "800", color: "#0f172a" }}>{catName}</span>
                              <span style={{
                                fontSize: "11px",
                                fontWeight: "750",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                backgroundColor: "#f0fdf4",
                                color: "#166534",
                                border: "1px solid #bbf7d0"
                              }}>
                                {teamName}
                              </span>
                              <span style={{
                                fontSize: "11px",
                                fontWeight: "750",
                                padding: "2px 8px",
                                borderRadius: "6px",
                                backgroundColor: "#fff7ed",
                                color: "#c2410c",
                                border: "1px solid #ffedd5"
                              }}>
                                {units} Work Unit(s)
                              </span>
                              {recordLocked && (
                                <span style={{
                                  fontSize: "10.5px",
                                  fontWeight: "700",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#fef2f2",
                                  color: "#b91c1c",
                                  border: "1px solid #fca5a5"
                                }}>
                                  🔒 Locked
                                </span>
                              )}
                              {(record.isAdminEntry || record.createdVia === "admin_assisted_entry") && (
                                <span style={{
                                  fontSize: "10.5px",
                                  fontWeight: "750",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  backgroundColor: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe"
                                }} title={`Entered by Admin (${record.createdByName || "Admin"}) on your behalf`}>
                                  🛡️ Admin Entry
                                </span>
                              )}
                            </div>
                            <span style={{ fontSize: "12px", color: "#64748b", fontWeight: "600" }}>
                              {count} Worker(s) @ ₹{wage.toLocaleString("en-IN")} / Day
                            </span>
                            <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                              Submitted at {getEntryTimeStr(record)} by {record.isAdminEntry ? `Admin (${record.createdByName || "Admin"}) on your behalf` : (record.createdBy || "Engineer")}
                            </span>
                          </div>

                          <div style={{ textAlign: "right" }}>
                            <span style={{ fontSize: "16px", fontWeight: "900", color: "#ea580c" }}>
                              Calculated Amount: ₹{cost.toLocaleString("en-IN")}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    );
  };



  const renderMoreView = () => {
    if (moreSubView === "menu") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* User profile card (Interactive) */}
          <button 
            type="button" 
            className="more-profile-card"
            onClick={() => setIsProfileModalOpen(true)}
          >
            <div className="more-profile-avatar">
              {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
            </div>
            <div className="more-profile-info">
              <h4 className="more-profile-name">{userProfile?.fullName || "Site Engineer"}</h4>
              <p className="more-profile-email">{userProfile?.email}</p>
              <span className="more-profile-tag">View Profile Details</span>
            </div>
            <ChevronRight size={18} style={{ color: "var(--primary-600)", flexShrink: 0 }} />
          </button>

          {/* Android dashboard card grid */}
          <div className="dashboard-grid">
            <button type="button" className="dashboard-card" onClick={() => navigate("/engineer/photos")}>
              <div className="dashboard-card-icon-wrapper photos">
                <Camera size={22} />
              </div>
              <h4 className="dashboard-card-title">Site Photos</h4>
              <p className="dashboard-card-desc">Capture and view georeferenced progress photo logs.</p>
            </button>

            <button type="button" className="dashboard-card" onClick={() => navigate("/engineer/progress")}>
              <div className="dashboard-card-icon-wrapper progress">
                <FileText size={22} />
              </div>
              <h4 className="dashboard-card-title">Daily DPR</h4>
              <p className="dashboard-card-desc">Log structural progress logs and onsite blockers.</p>
            </button>

            <button type="button" className="dashboard-card" onClick={() => navigate("/engineer/expenses")}>
              <div className="dashboard-card-icon-wrapper progress" style={{ backgroundColor: "var(--success-50)", color: "var(--success-700)" }}>
                <DollarSign size={22} />
              </div>
              <h4 className="dashboard-card-title">Expenses Log</h4>
              <p className="dashboard-card-desc">Log field expenses and view site budget status.</p>
            </button>

            <button type="button" className="dashboard-card" onClick={() => navigate("/engineer/profile")}>
              <div className="dashboard-card-icon-wrapper leaves">
                <Calendar size={22} />
              </div>
              <h4 className="dashboard-card-title">Leaves Log</h4>
              <p className="dashboard-card-desc">Log holiday requests and audit leaves summary stats.</p>
            </button>

            <button type="button" className="dashboard-card" onClick={() => navigate("/engineer/attendance-history")}>
              <div className="dashboard-card-icon-wrapper photos" style={{ backgroundColor: "var(--primary-50)", color: "var(--primary-700)" }}>
                <History size={22} />
              </div>
              <h4 className="dashboard-card-title">Attendance History</h4>
              <p className="dashboard-card-desc">View your historical attendance, status, and GPS metrics.</p>
            </button>

            <button type="button" className="dashboard-card" onClick={() => logout()}>
              <div className="dashboard-card-icon-wrapper logout">
                <LogOut size={22} />
              </div>
              <h4 className="dashboard-card-title">Logout</h4>
              <p className="dashboard-card-desc">Securely exit the site management console terminal.</p>
            </button>
          </div>
        </div>
      );
    }

    if (moreSubView === "photos") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="more-subview-header">
            <button 
              type="button" 
              onClick={() => navigate("/engineer/more")}
              className="more-back-btn"
            >
              ← Back
            </button>
            <h4 className="more-subview-title">Site Inspection Photos</h4>
          </div>

          {/* Photo form */}
          <div className="more-content-card">
            <span className="mobile-form-label">Upload Geotagged Progress Photo</span>
            <form onSubmit={handlePhotoUpload} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "4px" }}>
              <label style={{ 
                display: "flex", 
                flexDirection: "column", 
                alignItems: "center", 
                gap: "8px", 
                padding: "24px 16px", 
                border: "2px dashed var(--border-color)", 
                borderRadius: "12px", 
                cursor: "pointer", 
                backgroundColor: "var(--primary-50)",
                textAlign: "center"
              }}>
                <Camera size={32} style={{ color: "var(--primary-600)" }} />
                <span style={{ fontSize: "13px", fontWeight: "700", color: "var(--primary-800)" }}>Choose or Capture Photo</span>
                <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setSitePhotoFile, setSitePhotoPreview)} />
              </label>
              
              {sitePhotoPreview && (
                <div style={{ position: "relative", width: "100%", height: "180px", borderRadius: "10px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                  <img src={sitePhotoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => { setSitePhotoFile(null); setSitePhotoPreview(null); }} style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(15, 23, 42, 0.75)", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
                </div>
              )}

              <button
                type="submit"
                className="login-submit-btn"
                disabled={photoSubmitting || !sitePhotoPreview}
              >
                {photoSubmitting ? "Uploading..." : "Upload Photo"}
              </button>
            </form>
          </div>

          {/* Photo gallery */}
          <div>
            <span className="mobile-form-label" style={{ marginBottom: "8px", display: "block" }}>Inspection Photo Gallery</span>
            {sitePhotos.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 16px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>No photos uploaded for this site yet.</p>
              </div>
            ) : (
              <div className="mobile-photo-grid">
                {sitePhotos.map(photo => (
                  <div key={photo.id} className="mobile-photo-card" style={{ position: "relative", borderRadius: "10px", overflow: "hidden" }}>
                    <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img 
                        src={photo.imageUrl} 
                        alt="Progress inspection" 
                        onError={(e) => {
                          e.target.src = "https://images.unsplash.com/photo-1581094288338-2314dddb7eed?auto=format&fit=crop&w=400&q=80";
                        }}
                        className="mobile-photo-img" 
                        style={{ height: "120px", objectFit: "cover", width: "100%" }} 
                      />
                    </a>
                    <div className="mobile-photo-info" style={{ padding: "10px", display: "flex", flexDirection: "column", gap: "2px" }}>
                      <span className="mobile-photo-time" style={{ fontWeight: "700" }}>
                        {photo.createdDate} at {photo.createdTime}
                      </span>
                      <div className="mobile-photo-loc" style={{ fontSize: "11px", color: "var(--text-muted)" }}>
                        GPS: {Number(photo.latitude).toFixed(4)}, {Number(photo.longitude).toFixed(4)}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    if (moreSubView === "progress") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="more-subview-header">
            <button 
              type="button" 
              onClick={() => navigate("/engineer/more")}
              className="more-back-btn"
            >
              ← Back
            </button>
            <h4 className="more-subview-title">Daily Progress DPR Log</h4>
          </div>

          {/* Progress updates Form */}
          <div className="more-content-card">
            <form onSubmit={handleProgressSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              
              <div>
                <span className="mobile-form-label">Estimated Progress Completed ({progressPercent}%)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "6px" }}>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(Number(e.target.value))}
                    style={{ flexGrow: 1, accentColor: "#f97316", cursor: "pointer", height: "6px", backgroundColor: "#e2e8f0", borderRadius: "3px" }}
                  />
                  <span className="badge badge-success" style={{ fontWeight: 800, fontSize: "12px", minWidth: "46px", textAlign: "center", border: "none", backgroundColor: "var(--success-50)", color: "var(--success-700)" }}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Report Date</span>
                <input 
                  type="date" 
                  value={progressDate}
                  onChange={(e) => setProgressDate(e.target.value)}
                  style={{ padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "100%", margin: 0, outline: "none", backgroundColor: "#f8fafc" }}
                />
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Work Completed Today</span>
                <textarea 
                  className="mobile-textarea"
                  placeholder="Describe pours completed, walls built, structures finished..."
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  required 
                  style={{ minHeight: "80px", borderRadius: "10px", padding: "12px" }}
                />
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Work Currently Running</span>
                <textarea 
                  className="mobile-textarea"
                  placeholder="e.g., Excavation of wing B, plastering work..."
                  value={currentlyRunning}
                  onChange={(e) => setCurrentlyRunning(e.target.value)}
                  style={{ minHeight: "80px", borderRadius: "10px", padding: "12px" }}
                />
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Materials / Work Status</span>
                <input 
                  type="text" 
                  placeholder="e.g., Cement stock adequate, shuttering in progress..."
                  value={materialsStatus}
                  onChange={(e) => setMaterialsStatus(e.target.value)}
                  style={{ padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "100%", margin: 0, outline: "none", backgroundColor: "#f8fafc" }}
                />
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Problems Faced / Delay Obstacles</span>
                <input 
                  type="text" 
                  placeholder="E.g. Delay due to cement delivery lag..."
                  value={issuesText}
                  onChange={(e) => setIssuesText(e.target.value)}
                  style={{ padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "100%", margin: 0, outline: "none", backgroundColor: "#f8fafc" }}
                />
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Pending Work</span>
                <input 
                  type="text" 
                  placeholder="e.g., Wing A second floor slab casting..."
                  value={pendingWork}
                  onChange={(e) => setPendingWork(e.target.value)}
                  style={{ padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "100%", margin: 0, outline: "none", backgroundColor: "#f8fafc" }}
                />
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Next Planned Activity</span>
                <input 
                  type="text" 
                  placeholder="e.g., Curing, starting brickwork for column C..."
                  value={nextActivity}
                  onChange={(e) => setNextActivity(e.target.value)}
                  style={{ padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "100%", margin: 0, outline: "none", backgroundColor: "#f8fafc" }}
                />
              </div>

              <div className="login-form-group">
                <span className="mobile-form-label">Additional Remarks / Notes</span>
                <input 
                  type="text" 
                  placeholder="E.g. Inspector checked reinforcement today..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  style={{ padding: "12px 14px", border: "1.5px solid #cbd5e1", borderRadius: "10px", fontSize: "14px", width: "100%", margin: 0, outline: "none", backgroundColor: "#f8fafc" }}
                />
              </div>

              <div>
                <span className="mobile-form-label">Attach Progress Photo (Optional)</span>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "6px" }}>
                  <label style={{ cursor: "pointer", padding: "8px 14px", borderRadius: "8px", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--primary-50)", fontSize: "12px", fontWeight: 700 }}>
                    <Camera size={14} />
                    <span>Choose Photo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setProgressPhotoFile, setProgressPhotoPreview)} />
                  </label>
                  <span style={{ fontSize: "12px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                    {progressPhotoFile ? progressPhotoFile.name : "No photo chosen"}
                  </span>
                </div>
                {progressPhotoPreview && (
                  <div style={{ marginTop: "10px", position: "relative", width: "100px", height: "70px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={progressPhotoPreview} alt="Work preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setProgressPhotoFile(null); setProgressPhotoPreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(15, 23, 42, 0.75)", color: "#fff", border: "none", borderRadius: "50%", width: "18px", height: "18px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="login-submit-btn"
                disabled={progressSubmitting}
              >
                {progressSubmitting ? "Submitting..." : "Submit Progress Log"}
              </button>
            </form>
          </div>

          {/* DPR timeline */}
          <div>
            <span className="mobile-form-label" style={{ marginBottom: "10px", display: "block" }}>DPR Reports History</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {dailyUpdates.filter(u => u.siteId === activeSiteId).length === 0 ? (
                <div style={{ textAlign: "center", padding: "32px 16px", backgroundColor: "#ffffff", borderRadius: "12px", border: "1px solid var(--border-color)", boxShadow: "var(--shadow-sm)" }}>
                  <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>No daily reports submitted yet.</p>
                </div>
              ) : (
                dailyUpdates.filter(u => u.siteId === activeSiteId).map(row => {
                  const lines = row.description.split("\\n\\n");
                  const workLine = lines[0]?.replace("Work Completed: ", "") || row.description;
                  const issuesLine = lines[1]?.replace("Issues/Blockers: ", "");
                  const notesLine = lines[2]?.replace("Notes/Remarks: ", "");
                  const progressValue = parseInt(row.progress) || 0;
                  const isCompleted = progressValue >= 70;
                  const hasIssues = issuesLine && issuesLine !== "None" && issuesLine !== "";
                  
                  return (
                    <div 
                      key={row.id} 
                      className={`dpr-timeline-log ${isCompleted ? "completed" : ""} ${hasIssues ? "warning-state" : ""}`}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span className="font-mono" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-800)" }}>
                          {row.createdAt?.seconds 
                            ? new Date(row.createdAt.seconds * 1000).toLocaleDateString()
                            : new Date(row.createdAt).toLocaleDateString()}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="badge badge-success" style={{ fontWeight: "800", fontSize: "11px", backgroundColor: isCompleted ? "var(--success-50)" : "var(--primary-50)", color: isCompleted ? "var(--success-700)" : "var(--primary-800)", border: "none" }}>{row.progress}</span>
                          {row.engineerId === currentEngineerId && (
                            <button 
                              type="button" 
                              onClick={() => handleDeleteProgressLog(row.id)}
                              style={{ border: "none", backgroundColor: "transparent", color: "var(--danger-500)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                              title="Delete Progress Log"
                            >
                              <Trash2 size={16} />
                            </button>
                          )}
                        </div>
                      </div>
                      
                      <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--primary-950)", lineHeight: "1.4" }}>
                        <strong>Work:</strong> {workLine}
                      </p>
                      {hasIssues && (
                        <p style={{ margin: "4px 0", fontSize: "13px", color: "var(--danger-600)", lineHeight: "1.4" }}>
                          <strong>Issues:</strong> {issuesLine}
                        </p>
                      )}
                      {notesLine && notesLine !== "None" && (
                        <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--text-muted)", fontStyle: "italic", lineHeight: "1.4" }}>
                          <strong>Notes:</strong> {notesLine}
                        </p>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>
      );
    }

    if (moreSubView === "profile") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div className="more-subview-header">
            <button 
              type="button" 
              onClick={() => navigate("/engineer/more")}
              className="more-back-btn"
            >
              ← Back
            </button>
            <h4 className="more-subview-title">Profile & Leaves Summary</h4>
          </div>

          {/* Leaves stats widget */}
          <div className="more-content-card">
            <div className="leaves-tiles-grid">
              <div className="leaves-tile remaining">
                <span className="leaves-tile-label">Remaining Holidays</span>
                <strong className="leaves-tile-value">
                  {personalStats ? personalStats.remainingHolidays : "--"}
                </strong>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "600" }}>of {userProfile?.holidayAllowance || 24} annual days</span>
              </div>
              <div className="leaves-tile worked">
                <span className="leaves-tile-label">Days Worked (Month)</span>
                <strong className="leaves-tile-value">
                  {personalStats ? personalStats.weekdaysWorkedThisMonth : "--"}
                </strong>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", fontWeight: "600" }}>checked present</span>
              </div>
            </div>
            
            <div className="leaves-tile taken" style={{ flexDirection: "row", justifyContent: "space-between", alignItems: "center", padding: "14px 18px", textAlign: "left" }}>
              <div>
                <span className="leaves-tile-label">Leaves Taken (Month / Year)</span>
                <strong style={{ fontSize: "16px", color: "var(--danger-700)", fontFamily: "'Outfit', sans-serif", fontWeight: "800", display: "block", marginTop: "2px" }}>
                  {personalStats ? `${personalStats.leavesThisMonth} / ${personalStats.leavesThisYear}` : "-- / --"}
                </strong>
              </div>
              <span className="badge badge-danger" style={{ fontWeight: "800", fontSize: "11px", backgroundColor: "#fecaca", color: "#b91c1c", border: "none" }}>Leave days</span>
            </div>
          </div>

          {/* Request Leave Trigger Button */}
          <button
            type="button"
            className="mobile-btn-large"
            onClick={() => setShowLeaveModal(true)}
            style={{ marginBottom: "8px" }}
          >
            <Plus size={18} />
            <span>Request Leave</span>
          </button>

          {/* Log Leave Form Modal */}
          <Modal
            isOpen={showLeaveModal}
            onClose={handleCloseLeaveModal}
            title="Request Leave Day"
            maxWidth="400px"
          >
            <form onSubmit={handleLogLeave} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <p style={{ margin: 0, fontSize: "12.5px", color: "var(--text-muted)", lineHeight: "1.5" }}>
                Select the desired date and describe the reason for your leave request.
              </p>

              <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="login-form-group">
                  <label style={{ fontSize: "11px", color: "#334155", fontWeight: "700", display: "block", marginBottom: "4px" }}>Leave Date</label>
                  <input 
                    type="date" 
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    required
                    style={{ padding: "10px", fontSize: "13px", width: "100%", borderRadius: "8px", border: "1.5px solid #cbd5e1", outline: "none", backgroundColor: "#f8fafc" }}
                  />
                </div>
                <div className="login-form-group">
                  <label style={{ fontSize: "11px", color: "#334155", fontWeight: "700", display: "block", marginBottom: "4px" }}>Leave Reason</label>
                  <SelectWithOthers
                    options={[
                      { value: "Personal Leave", label: "Personal" },
                      { value: "Sick Leave", label: "Sick Leave" },
                      { value: "Vacation", label: "Vacation" }
                    ]}
                    value={leaveReason}
                    onChange={setLeaveReason}
                    othersValue="Other"
                    placeholder="E.g. Family Function Leave..."
                    label="Specify Leave Type"
                    required={true}
                    selectStyle={{ padding: "8px 10px", fontSize: "13px", width: "100%", borderRadius: "8px", border: "1.5px solid #cbd5e1", backgroundColor: "#f8fafc", height: "41px", outline: "none" }}
                    inputStyle={{ padding: "10px 12px", fontSize: "13px", borderRadius: "8px", border: "1.5px solid #cbd5e1", outline: "none" }}
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <Button
                  type="button"
                  variant="outline"
                  style={{ flex: 1 }}
                  onClick={handleCloseLeaveModal}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={leaveSubmitting}
                  style={{ flex: 1.5 }}
                >
                  {leaveSubmitting ? "Submitting..." : "Log Leave Day"}
                </Button>
              </div>
            </form>
          </Modal>

          {/* Logged Leaves history */}
          {loggedLeaves.length > 0 && (
            <div>
              <span className="mobile-form-label" style={{ marginBottom: "8px", display: "block" }}>Logged Leaves History</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {loggedLeaves.map(leave => (
                  <div key={leave.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "10px", boxShadow: "var(--shadow-sm)" }}>
                    <div>
                      <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--primary-900)" }}>{leave.date}</span>
                      <span style={{ fontSize: "11px", color: "var(--text-muted)", display: "block", marginTop: "2px" }}>{leave.reason}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteLeave(leave.id)}
                      style={{ border: "none", backgroundColor: "transparent", color: "var(--danger-500)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      );
    }

    return null;
  };

  return (
    <div className="mobile-app-container">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      <div className="mobile-app-frame">
        {/* Specify Labour Category Modal removed since categories sync directly from the master collection */}

        {/* Full Viewport WebRTC Camera Overlay */}
        {cameraActive && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "#000000",
            zIndex: 1000,
            display: "flex",
            flexDirection: "column",
            justifyContent: "space-between",
            padding: "20px"
          }}>
            {/* Camera Header */}
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", color: "#ffffff" }}>
              <span style={{ fontSize: "14px", fontWeight: "700" }}>
                {cameraFacingMode === "user" ? "Front Camera (Selfie)" : "Back Camera (Site)"}
              </span>
              <button 
                type="button" 
                onClick={stopWebRTCCamera}
                style={{ background: "none", border: "none", color: "#ffffff", padding: "8px", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
              >
                <X size={24} />
              </button>
            </div>

            {/* Video Preview */}
            <div style={{
              flex: 1,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              overflow: "hidden",
              borderRadius: "12px",
              backgroundColor: "#111827",
              margin: "20px 0",
              position: "relative"
            }}>
              {cameraError ? (
                <div style={{ color: "var(--danger-400)", padding: "20px", textAlign: "center" }}>
                  <AlertTriangle size={36} style={{ margin: "0 auto 12px" }} />
                  <p style={{ margin: 0, fontSize: "13px" }}>{cameraError}</p>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  autoPlay
                  playsInline
                  muted
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                    transform: cameraFacingMode === "user" ? "scaleX(-1)" : "none"
                  }}
                />
              )}
            </div>

            {/* Controls */}
            <div style={{
              display: "flex",
              justifyContent: "space-around",
              alignItems: "center",
              paddingBottom: "10px"
            }}>
              {/* Toggle camera facing mode */}
              <button
                type="button"
                onClick={toggleCameraFacingMode}
                disabled={!!cameraError}
                style={{
                  background: "rgba(255,255,255,0.2)",
                  border: "none",
                  borderRadius: "50%",
                  width: "48px",
                  height: "48px",
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer"
                }}
              >
                <Sliders size={20} />
              </button>

              {/* Capture trigger */}
              <button
                type="button"
                onClick={capturePhotoFromStream}
                disabled={!!cameraError}
                style={{
                  background: "#ffffff",
                  border: "none",
                  borderRadius: "50%",
                  width: "72px",
                  height: "72px",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  boxShadow: "0 0 15px rgba(255,255,255,0.4)"
                }}
              >
                <div style={{
                  width: "58px",
                  height: "58px",
                  borderRadius: "50%",
                  border: "2px solid #000000",
                  backgroundColor: "#ffffff"
                }} />
              </button>

              {/* Spacer */}
              <div style={{ width: "48px" }} />
            </div>
          </div>
        )}
        {/* Top Header */}
        <header className="mobile-app-header" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "12px 16px", height: "auto", flexWrap: "wrap", gap: "8px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <CivilEngineerLogo size={22} />
            <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--primary-900)", margin: 0 }}>
              {tab === "attendance" ? "Attendance" : 
               tab === "attendance-history" ? "My Attendance History" :
               tab === "material" ? "Materials" : 
               tab === "labour" ? "Workforce" : 
               tab === "expenses" ? "Financials & Expenses" : 
               ["more", "photos", "progress", "profile"].includes(tab) ? "More Tools" : "Visvas Builders"}
            </h3>
          </div>

          {assignedSites.length > 1 && (
            <div style={{ display: "flex", alignItems: "center", backgroundColor: "var(--accent-50)", padding: "4px 8px", borderRadius: "6px", border: "1px solid var(--accent-100)", position: "relative" }}>
              <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--accent-800)", marginRight: "4px" }}>Current Site:</span>
              <select
                value={activeSiteId}
                onChange={(e) => setActiveSiteId(e.target.value)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: "11px",
                  fontWeight: "800",
                  color: "var(--accent-900)",
                  paddingRight: "14px",
                  cursor: "pointer",
                  appearance: "none",
                  outline: "none",
                  fontFamily: "inherit"
                }}
              >
                {assignedSites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
              <span style={{ position: "absolute", right: "6px", pointerEvents: "none", fontSize: "8px", color: "var(--accent-700)" }}>▼</span>
            </div>
          )}

          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }} className="font-mono">
              {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
            <div style={{
              width: "26px",
              height: "26px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-50)",
              color: "var(--accent-700)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontWeight: "800",
              fontSize: "11px"
            }}>
              {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
            </div>
          </div>
        </header>

        {/* Scrollable View Content */}
        <div className="mobile-app-content">
          {tab === "attendance" && renderAttendanceView()}
          {tab === "attendance-history" && renderAttendanceHistoryView()}
          {tab === "material" && renderMaterialView()}
          {tab === "labour" && renderLabourView()}
          {tab === "expenses" && renderExpensesView()}
          {["more", "photos", "progress", "profile"].includes(tab) && renderMoreView()}
          {(tab === "dashboard" || !tab) && renderHomeView()}
        </div>

        {/* Bottom Navigation */}
        <nav className="mobile-bottom-nav">
          <button 
            type="button" 
            className={`mobile-nav-btn ${tab === "dashboard" || !tab ? "active" : ""}`}
            onClick={() => navigate("/engineer")}
          >
            <div className="mobile-nav-indicator">
              <LayoutDashboard size={20} />
            </div>
            <span>Home</span>
          </button>

          <button 
            type="button" 
            className={`mobile-nav-btn ${tab === "attendance" ? "active" : ""}`}
            onClick={() => navigate("/engineer/attendance")}
          >
            <div className="mobile-nav-indicator">
              <ClipboardCheck size={20} />
            </div>
            <span>Attendance</span>
          </button>

          <button 
            type="button" 
            className={`mobile-nav-btn ${tab === "material" ? "active" : ""}`}
            onClick={() => navigate("/engineer/material")}
          >
            <div className="mobile-nav-indicator">
              <Package size={20} />
            </div>
            <span>Materials</span>
          </button>

          <button 
            type="button" 
            className={`mobile-nav-btn ${tab === "labour" ? "active" : ""}`}
            onClick={() => navigate("/engineer/labour")}
          >
            <div className="mobile-nav-indicator">
              <Users size={20} />
            </div>
            <span>Labour</span>
          </button>

          <button 
            type="button" 
            className={`mobile-nav-btn ${["more", "photos", "progress", "profile", "attendance-history"].includes(tab) ? "active" : ""}`}
            onClick={() => navigate("/engineer/more")}
          >
            <div className="mobile-nav-indicator">
              <Sliders size={20} />
            </div>
            <span>More</span>
          </button>
        </nav>
        {/* User Profile Details Modal */}
        <Modal
          isOpen={isProfileModalOpen}
          onClose={() => {
            setIsProfileModalOpen(false);
            setProfileModalView("details");
            setCurrentPassword("");
            setNewPassword("");
            setConfirmNewPassword("");
            setShowCurrentPassword(false);
            setShowNewPassword(false);
            setShowConfirmNewPassword(false);
            setPasswordChangeError("");
            setPasswordChangeSuccess("");
          }}
          title={profileModalView === "details" ? "Engineer Profile Details" : "Change Security Password"}
          maxWidth="380px"
          className="modal-overlay login-modal-overlay"
        >
          <div className="profile-details-modal-content">
            {authLoading ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: "12px" }}>
                <div className="loader-spinner" style={{ width: "32px", height: "32px", border: "3px solid var(--border-color)", borderTopColor: "var(--construction-orange)", borderRadius: "50%", animation: "spin 1s linear infinite" }}></div>
                <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>Synchronizing Profile...</span>
              </div>
            ) : !userProfile ? (
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "40px 20px", gap: "12px", textAlign: "center" }}>
                <AlertCircle size={36} style={{ color: "var(--danger-500)" }} />
                <h4 style={{ fontSize: "14px", fontWeight: "800", color: "#0f172a", margin: 0 }}>Profile Load Error</h4>
                <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: 0 }}>Could not fetch engineer profile from the database. Please verify internet access and log in again.</p>
              </div>
            ) : profileModalView === "details" ? (
              <>
                <div className="profile-details-header">
                  <div className="profile-details-avatar">
                    {userProfile.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
                  </div>
                  <h3 className="profile-details-name">{userProfile.fullName || "Site Engineer"}</h3>
                  <span className="profile-details-role">
                    {userProfile.role === "site_engineer" || userProfile.role === "engineer" ? "Site Engineer" : userProfile.role || "Engineer"}
                  </span>
                </div>
                
                <div className="profile-details-grid">
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Corporate Email</span>
                    <span className="profile-detail-value">{userProfile.email || "engineer@gmail.com"}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Username</span>
                    <span className="profile-detail-value">@{userProfile.username || "engineer"}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Account Status</span>
                    <span className="profile-detail-value status-active" style={{ textTransform: "capitalize" }}>{userProfile.status || "active"}</span>
                  </div>
                  <div className="profile-detail-item">
                    <span className="profile-detail-label">Annual Holiday Allowance</span>
                    <span className="profile-detail-value">{userProfile.holidayAllowance || 24} Days</span>
                  </div>
                </div>

                <Button
                  variant="outline"
                  icon={Lock}
                  onClick={() => setProfileModalView("changePassword")}
                  style={{ width: "100%", marginTop: "20px" }}
                >
                  Change Password
                </Button>
              </>
            ) : (
              <form onSubmit={handlePasswordChange} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <button
                  type="button"
                  className="more-back-btn"
                  onClick={() => {
                    setProfileModalView("details");
                    setPasswordChangeError("");
                    setPasswordChangeSuccess("");
                  }}
                  style={{ alignSelf: "flex-start", marginBottom: "4px" }}
                >
                  ← Back to Profile
                </button>

                {passwordChangeError && (
                  <div className="info-alert" style={{ borderLeft: "4px solid var(--danger-500)", backgroundColor: "var(--danger-50)", padding: "10px", borderRadius: "6px" }}>
                    <span style={{ color: "var(--danger-600)", fontSize: "12px", fontWeight: "600" }}>{passwordChangeError}</span>
                  </div>
                )}

                {passwordChangeSuccess && (
                  <div className="info-alert" style={{ borderLeft: "4px solid var(--success-500)", backgroundColor: "var(--success-50)", padding: "10px", borderRadius: "6px" }}>
                    <span style={{ color: "var(--success-600)", fontSize: "12px", fontWeight: "600" }}>{passwordChangeSuccess}</span>
                  </div>
                )}

                <div className="login-form-group">
                  <label htmlFor="current-password" style={{ fontSize: "11px", color: "#334155", fontWeight: "700", display: "block", marginBottom: "4px" }}>Current Password</label>
                  <div className="login-input-wrapper">
                    <Lock className="login-input-icon" size={16} />
                    <input
                      type={showCurrentPassword ? "text" : "password"}
                      id="current-password"
                      className="login-input-field"
                      placeholder="••••••••"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                      className="login-password-toggle-btn"
                      aria-label={showCurrentPassword ? "Hide password" : "Show password"}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="login-form-group">
                  <label htmlFor="new-password" style={{ fontSize: "11px", color: "#334155", fontWeight: "700", display: "block", marginBottom: "4px" }}>New Password (min 6 chars)</label>
                  <div className="login-input-wrapper">
                    <Lock className="login-input-icon" size={16} />
                    <input
                      type={showNewPassword ? "text" : "password"}
                      id="new-password"
                      className="login-input-field"
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="login-password-toggle-btn"
                      aria-label={showNewPassword ? "Hide password" : "Show password"}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <div className="login-form-group">
                  <label htmlFor="confirm-new-password" style={{ fontSize: "11px", color: "#334155", fontWeight: "700", display: "block", marginBottom: "4px" }}>Confirm New Password</label>
                  <div className="login-input-wrapper">
                    <Lock className="login-input-icon" size={16} />
                    <input
                      type={showConfirmNewPassword ? "text" : "password"}
                      id="confirm-new-password"
                      className="login-input-field"
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmNewPassword(!showConfirmNewPassword)}
                      className="login-password-toggle-btn"
                      aria-label={showConfirmNewPassword ? "Hide password" : "Show password"}
                      style={{ background: "none", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      {showConfirmNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  isLoading={passwordChangeLoading}
                  style={{ width: "100%", marginTop: "8px" }}
                >
                  Update Password
                </Button>
              </form>
            )}
          </div>
        </Modal>
      </div>

      <ConfirmationModal {...confirmModalState} onClose={closeConfirmModal} />

      <Loading show={loading} text="Synchronizing Worksite Database..." />
    </div>
  );
}

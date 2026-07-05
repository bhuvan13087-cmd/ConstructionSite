import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
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
  getLabourDailyCountsHistory,
  getLabourDailyEntries,
  saveLabourDailyEntries,
  subscribeLabourCategories,
  getEngineerAttendanceAndLeaveStats,
  logEngineerLeave,
  getEngineerLeaves,
  deleteEngineerLeave,
  deleteMaterial,
  deleteLabourDailyCounts,
  deleteDailyProgressReport,
  deleteSitePhoto,
  updateSiteLocation,
  reverseGeocodeLatLng,
  getEngineerAttendanceHistory,
  updateEngineerPasswordInDb,
  getLabourMaster,
  getMaterialMaster,
  logMaterialUsage,
  getGeneralExpenses,
  saveGeneralExpense,
  getLabourPayments,
  getLabourDailyCountsSummary,
  getNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead
} from "../services/firebaseService";
import { verifyTNLocation, verifySiteGeofence, hasPermission, getLabourDisplayName, processMaterialPaymentAndDelivery, getSiteExpenseLedger } from "../services/businessLogic";
import { updateEngineerPasswordAuth } from "../firebase/auth";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import SelectWithOthers from "../components/common/SelectWithOthers";
import Modal from "../components/common/Modal";
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
  DollarSign
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

const categorySuggestions = {
  Cement: ["UltraTech Cement", "ACC Cement", "OPC 53 Grade Cement", "PPC Cement", "White Cement", "Sulphate Resistant Cement"],
  Steel: ["Tata Steel", "TMT Rebars 12mm", "TMT Rebars 16mm", "Binding Wire", "Structural Steel Section"],
  Sand: ["River Sand (Fine)", "M-Sand (Manufactured)", "Coarse Sand (Plastering)"],
  Bricks: ["Red Clay Bricks", "Fly Ash Bricks", "AAC Light Blocks", "Solid Concrete Blocks"],
  Other: ["Pipes & Fittings", "Painting Primer", "Waterproofing Chemical", "Electrical PVC Conduit"]
};

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
  const [activeSiteId, setActiveSiteId] = useState("");
  const [savedSiteLocation, setSavedSiteLocation] = useState(null);
  const [allSitesAttendance, setAllSitesAttendance] = useState([]);
  const [showLocationDetails, setShowLocationDetails] = useState(false);
  
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
  const [isSuggestionsOpen, setIsSuggestionsOpen] = useState(false);
  const comboboxRef = useRef(null);
  const [materialFlow, setMaterialFlow] = useState("list"); // "list" or "add"
  const [materialStep, setMaterialStep] = useState(1); // 1: category, 2: name, 3: details/invoice
  const [moreSubView, setMoreSubView] = useState("menu"); // "menu", "photos", "progress", "profile"
  
  // Material search & filter state
  const [materialSearch, setMaterialSearch] = useState("");
  const [materialDateFilter, setMaterialDateFilter] = useState("");

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

  // 6. Material Master & Consumption state variables
  const [materialMaster, setMaterialMaster] = useState([]);
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

  // 7. General Expense states
  const [generalExpenses, setGeneralExpenses] = useState([]);
  const [labourPayments, setLabourPayments] = useState([]);
  const [showAddExpenseModal, setShowAddExpenseModal] = useState(false);
  const [expenseCategory, setExpenseCategory] = useState("Site Expense");
  const [expenseAmount, setExpenseAmount] = useState("");
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split("T")[0]);
  const [expenseDesc, setExpenseDesc] = useState("");
  const [expenseNotes, setExpenseNotes] = useState("");

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
      
      // Load assigned construction sites
      const filteredSites = await getAssignedSitesForEngineer(engineerId);
      setAssignedSites(filteredSites);

      // Fetch personal stats, leaves, and attendance history
      try {
        const stats = await getEngineerAttendanceAndLeaveStats(engineerId, userProfile.holidayAllowance || 24);
        setPersonalStats(stats);
        const leaves = await getEngineerLeaves(engineerId);
        setLoggedLeaves(leaves);
        const history = await getEngineerAttendanceHistory(engineerId);
        setAllSitesAttendance(history);
      } catch (err) {
        console.error("Failed to load personal stats/leaves/history:", err);
      }

      if (filteredSites.length > 0) {
        let currentActiveId = activeSiteId;
        if (filteredSites.length === 1) {
          currentActiveId = filteredSites[0].id;
          setActiveSiteId(currentActiveId);
        } else if (!activeSiteId) {
          // If multiple sites and none selected yet, leave activeSiteId empty
          setActiveSiteId("");
          setTodayAttendance(null);
          setSitePhotos([]);
          setDailyUpdates([]);
          setMaterials([]);
          setLoading(false);
          return;
        } else {
          const isAssigned = filteredSites.some(s => s.id === activeSiteId);
          if (!isAssigned) {
            console.warn(`Unauthorized site access attempt: site ${activeSiteId} is not assigned to engineer ${engineerId}`);
            currentActiveId = filteredSites[0].id;
            setActiveSiteId(currentActiveId);
          }
        }

        // Fetch today's check-in attendance across all sites
        const attendance = await getTodayAttendance(engineerId, todayStr);
        setTodayAttendance(attendance);
        

        
        // Fetch daily updates (site-segregated)
        const updates = await getDailyUpdatesForEngineer(engineerId, currentActiveId);
        setDailyUpdates(updates);

        // Fetch material receipts (site-segregated)
        const siteMats = await getMaterialsDetailed(currentActiveId);
        setMaterials(siteMats);

        // Fetch general expenses, labour history, and payments
        // Derive adminId from the assigned site's createdByAdmin for payment scoping
        try {
          const adminId = filteredSites.length > 0 ? (filteredSites[0].createdByAdmin || null) : null;
          const [ge, lp, lh] = await Promise.all([
            getGeneralExpenses(currentActiveId),
            getLabourPayments(adminId, currentActiveId),
            getLabourDailyCountsSummary(currentActiveId)
          ]);
          setGeneralExpenses(ge);
          setLabourPayments(lp);
          setLabourHistory(lh);
        } catch (e) {
          console.error("Failed to load financials:", e);
        }



        // Fetch notifications for the engineer
        try {
          const userNotifications = await getNotifications(engineerId);
          setNotifications(userNotifications || []);
        } catch (e) {
          console.error("Failed to load notifications:", e);
        }
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
      // Suppressed background database check warning to prevent false synchronization notifications.
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [userProfile, activeSiteId]);

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
    if (tab === "attendance" && activeSiteId && savedSiteLocation && !todayAttendance && !hasAutoChecked) {
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

  // Subscribe to active categories in real-time
  useEffect(() => {
    const unsubscribe = subscribeLabourCategories((categoriesMap) => {
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

    const loadMaterials = async () => {
      try {
        const mm = await getMaterialMaster();
        setMaterialMaster(mm);
      } catch (err) {
        console.error("Failed to load material master:", err);
      }
    };
    loadMaterials();

    return () => unsubscribe();
  }, []);

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
    setAttendanceSubmitting(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      if (!deviceCoords || deviceCoords.latitude === undefined || deviceCoords.latitude === null) {
        showToast("Please enable location access", "error");
        setAttendanceSubmitting(false);
        return;
      }
      const lat = deviceCoords.latitude;
      const lng = deviceCoords.longitude;
      const accuracy = deviceCoords.accuracy || 10;
      const distance = verificationDetails?.distance !== undefined ? verificationDetails.distance : null;

      await saveSitePhoto(engineerId, activeSiteId, attendancePhotoPreview, lat, lng, "Attendance");

      await markAttendance(
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

      handleResetVerification();

      await loadDashboardData();
    } catch (err) {
      console.error("Mark attendance error:", err);
      showToast(err.message || "Failed to complete attendance transaction.", "error");
    } finally {
      setAttendanceSubmitting(false);
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
    if (window.confirm("Delete this entry?")) {
      try {
        await deleteEngineerLeave(leaveId);
        showToast("Deleted successfully", "success");
        await loadDashboardData();
      } catch (err) {
        console.error("Failed to cancel leave:", err);
        showToast("Failed to cancel leave: " + err.message, "error");
      }
    }
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
    if (window.confirm("Delete this entry?")) {
      try {
        await deleteMaterial(materialId);
        showToast("Deleted successfully", "success");
        await loadDashboardData();
      } catch (err) {
        console.error("Failed to delete material:", err);
        showToast("Failed to delete: " + err.message, "error");
      }
    }
  };

  // Delete Labour Counts Log Handler
  const handleDeleteLabourLog = async (dateStr) => {
    const historyRow = labourHistory.find(h => h.date === dateStr);
    if (!historyRow) return;
    if (historyRow.engineerId && historyRow.engineerId !== currentEngineerId) {
      showToast("Security error: You can only delete your own records.", "error");
      return;
    }
    if (window.confirm("Delete this entry?")) {
      try {
        await deleteLabourDailyCounts(activeSiteId, dateStr);
        showToast("Deleted successfully", "success");
        const hist = await getLabourDailyCountsHistory(activeSiteId);
        setLabourHistory(hist);
        await loadDashboardData();
      } catch (err) {
        console.error("Failed to delete labour counts:", err);
        showToast("Failed to delete: " + err.message, "error");
      }
    }
  };

  // Delete Progress DPR Log Handler
  const handleDeleteProgressLog = async (reportId) => {
    const report = dailyUpdates.find(r => r.id === reportId);
    if (!report) return;
    if (report.engineerId !== currentEngineerId) {
      showToast("Security error: You can only delete your own records.", "error");
      return;
    }
    if (window.confirm("Delete this entry?")) {
      try {
        await deleteDailyProgressReport(reportId);
        showToast("Deleted successfully", "success");
        await loadDashboardData();
      } catch (err) {
        console.error("Failed to delete progress report:", err);
        showToast("Failed to delete: " + err.message, "error");
      }
    }
  };

  // Delete Site Inspection Photo Handler
  const handleDeleteSitePhoto = async (photoId) => {
    const photo = sitePhotos.find(p => p.id === photoId);
    if (!photo) return;
    if (photo.engineerId !== currentEngineerId) {
      showToast("Security error: You can only delete your own records.", "error");
      return;
    }
    if (window.confirm("Delete this entry?")) {
      try {
        await deleteSitePhoto(photoId);
        showToast("Deleted successfully", "success");
        await loadDashboardData();
      } catch (err) {
        console.error("Failed to delete photo:", err);
        showToast("Failed to delete: " + err.message, "error");
      }
    }
  };

  // 3. Save Labour Counts Attendance
  const handleSaveLabourCounts = async (e) => {
    if (e) e.preventDefault();
    if (!activeSiteId) {
      showToast("Please select active construction site.", "error");
      return;
    }
    if (!labourDate) {
      showToast("Please choose daily record date.", "error");
      return;
    }
    if (!confirm(`Are you sure you want to save the daily labour attendance counts for ${labourDate}?`)) {
      return;
    }

    setLabourSaving(true);
    try {
      const engineerId = userProfile.uid || userProfile.id || "";
      await saveLabourDailyEntries(activeSiteId, engineerId, labourDate, labourEntries);
      showToast(`Labour counts updated successfully for ${labourDate}!`, "success");
      
      const hist = await getLabourDailyCountsHistory(activeSiteId);
      setLabourHistory(hist);
    } catch (err) {
      console.error("Labour sync failed:", err);
      showToast(`Sync failed: ${err.message}`, "error");
    } finally {
      setLabourSaving(false);
    }
  };

  const handleIncrementLabour = (category) => {
    setLabourEntries(prev => {
      const catEntries = prev.filter(e => e.categoryId === category.id);
      
      let nextNum = 1;
      if (catEntries.length > 0) {
        const numbers = catEntries.map(e => {
          const parts = e.displayName.split(" ");
          const num = parseInt(parts[parts.length - 1], 10);
          return isNaN(num) ? 0 : num;
        });
        nextNum = Math.max(...numbers) + 1;
      }
      
      const newEntry = {
        categoryId: category.id,
        categoryName: category.name,
        displayName: `${category.name} ${nextNum}`,
        siteId: activeSiteId,
        engineerId: userProfile?.uid || userProfile?.id || "",
        date: labourDate
      };
      
      return [...prev, newEntry];
    });
  };

  const handleDecrementLabour = (categoryId) => {
    setLabourEntries(prev => {
      const catEntries = prev.filter(e => e.categoryId === categoryId);
      if (catEntries.length === 0) return prev;
      
      const lastEntry = catEntries[catEntries.length - 1];
      return prev.filter(e => e !== lastEntry);
    });
  };

  const handleRemoveSpecificEntry = (entryToRemove) => {
    setLabourEntries(prev => prev.filter(e => e !== entryToRemove));
  };

  // 4. Save Material Receipt
  const handleMaterialSubmit = async (e) => {
    e.preventDefault();
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
      setMaterialSubmitting(false);
    }
  };

  // 5. Upload Geotagged Progress Photo
  const handlePhotoUpload = async (e) => {
    e.preventDefault();
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

      setSitePhotoFile(null);
      setSitePhotoPreview(null);
      await loadDashboardData();
    } catch (err) {
      console.error("Progress photo upload error:", err);
      showToast(err.message || "Failed to save photo.", "error");
    } finally {
      setPhotoSubmitting(false);
    }
  };

  // 6. Submit Daily Progress updates
  const handleProgressSubmit = async (e) => {
    e.preventDefault();
    if (!activeSiteId) {
      showToast("Please choose target project.", "error");
      return;
    }
    if (!workDescription.trim()) {
      showToast("Work description details required.", "error");
      return;
    }

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

      await loadDashboardData();
    } catch (err) {
      console.error("Progress report log failed:", err);
      showToast(`Sync failed: ${err.message}`, "error");
    } finally {
      setProgressSubmitting(false);
    }
  };

  // Full Screen Alert if no sites assigned
  if (assignedSites.length === 0 && !loading) {
    return (
      <div className="mobile-app-container">
        <div className="mobile-app-frame">
          <header className="mobile-app-header">
            <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
              <HardHat size={22} style={{ color: "var(--accent-600)" }} />
              <h3>Apex Build</h3>
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
              <HardHat size={22} style={{ color: "var(--construction-orange)" }} />
              <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-900)", margin: 0 }}>Apex Build</h3>
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
                  {userProfile?.email || "engineer@apex.com"}
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

  // Helper title mapping
  const pageTitles = {
    dashboard: "Dashboard Overview",
    attendance: "Labour Attendance Tracker",
    labour: "Labour & Team Management",
    material: "Material Receipts Inventory",
    photos: "Site Inspection Photos",
    progress: "Daily Progress Log Feed"
  };
  const currentCategorySuggestions = categorySuggestions[materialCategory] || [];
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

  // Mobile UI Render Views
  const renderHomeView = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Site Card */}
        <div className="mobile-site-card">
          <span className="mobile-site-card-badge">Active Assignment</span>
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
                  color: "var(--accent-700)",
                  fontSize: "12px",
                  fontWeight: "700",
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
        <div className="mobile-attendance-card" style={{ height: "auto", padding: "16px" }}>
          <div className="mobile-attendance-left">
            <span className="mobile-attendance-status-label">Your Attendance Status</span>
            <div className={`mobile-attendance-status-val ${todayAttendance ? 'checked' : 'unchecked'}`}>
              {todayAttendance ? '✓ Checked In Present' : '✗ Not Checked In Yet'}
            </div>
            {todayAttendance && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                Check-In: {todayAttendance.time || "Today"}
              </span>
            )}
          </div>
          {!todayAttendance && savedSiteLocation && (
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
            <button 
              type="button"
              className="mobile-action-card attendance"
              onClick={() => {
                setAttendanceMode("checkin");
                navigate("/engineer/attendance");
              }}
              disabled={!!todayAttendance}
              style={{ opacity: todayAttendance ? 0.5 : 1, border: "none", cursor: todayAttendance ? "not-allowed" : "pointer" }}
            >
              <div className="mobile-action-icon-wrapper" style={{ backgroundColor: "var(--success-50)", color: "var(--success-700)" }}>
                <ClipboardCheck size={20} />
              </div>
              <span className="mobile-action-title">Check In</span>
            </button>


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

            {/* Create Material Request */}
            <button 
              type="button"
              className="mobile-action-card materials" 
              onClick={() => navigate("/engineer/material")}
              style={{ border: "none", cursor: "pointer" }}
            >
              <div className="mobile-action-icon-wrapper" style={{ backgroundColor: "var(--warning-50)", color: "var(--warning-700)" }}>
                <Package size={20} />
              </div>
              <span className="mobile-action-title">Request Material</span>
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
                    backgroundColor: notif.isRead ? "#f8fafc" : "#eff6ff",
                    border: `1.5px solid ${notif.isRead ? "var(--border-color)" : "#bfdbfe"}`,
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
        <div style={{ textAlign: "center", marginBottom: "8px" }}>
          <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>Site Check-In Verification</h4>
          <p style={{ margin: "2px 0 0 0", fontSize: "12px", color: "var(--text-muted)" }}>Enforce location-tagged photo capture within worksite boundaries</p>
        </div>

        {todayAttendance ? (
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
                Check-In Confirmed
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
                <span style={{ color: "var(--text-muted)" }}>Check-In GPS:</span>
                <strong style={{ color: "var(--primary-900)", wordBreak: "break-all", textAlign: "right" }}>{todayAttendance.gpsLocationAddress || (todayAttendance.latitude ? `${Number(todayAttendance.latitude).toFixed(4)}, ${Number(todayAttendance.longitude).toFixed(4)}` : "Verified Boundary")}</strong>
              </div>
            </div>

            {todayAttendance.photoUrl && (
              <div style={{ width: "100%", height: "160px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                <img src={todayAttendance.photoUrl} alt="Checked in verification" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              </div>
            )}
          </div>
        ) : (
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
        )}
      </div>
    );
  };

  const renderMaterialView = () => {
    const activeMaterials = materials
      .filter(m => m.siteId === activeSiteId)
      .filter(m => {
        const query = materialSearch.toLowerCase().trim();
        if (!query) return true;
        return (
          m.materialName.toLowerCase().includes(query) ||
          m.category.toLowerCase().includes(query) ||
          m.supplierName.toLowerCase().includes(query)
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

    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Search bar & filter */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border-color)", padding: "8px 12px", borderRadius: "var(--radius-md)", backgroundColor: "#ffffff" }}>
            <Search size={16} style={{ color: "var(--text-muted)" }} />
            <input 
              type="text" 
              placeholder="Search materials, suppliers..."
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

        {/* List display */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {activeMaterials.length === 0 ? (
            <div style={{ textAlign: "center", padding: "32px 16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>No material logs matching filter criteria.</p>
            </div>
          ) : (
            activeMaterials.map(m => {
              const processed = processMaterialPaymentAndDelivery(m);
              const isApproved = processed.status === "Approved" || processed.status === "approved";
              
              return (
                <div key={processed.id} className="mobile-material-card" style={{ display: "flex", flexDirection: "column", gap: "8px", padding: "14px", backgroundColor: "#ffffff", borderRadius: "10px", border: "1px solid var(--border-color)" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-600)", textTransform: "uppercase" }}>{processed.category}</span>
                      <h4 style={{ margin: "2px 0 0 0", fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>{processed.materialName}</h4>
                    </div>
                    <Badge status={processed.status === "Approved" ? "success" : processed.status === "Rejected" ? "danger" : "pending"}>
                      {processed.status ? processed.status.toUpperCase() : "PENDING"}
                    </Badge>
                  </div>

                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", fontSize: "12px", borderTop: "1px solid #f1f5f9", paddingTop: "8px", color: "#475569" }}>
                    <div>
                      <strong>Required:</strong> {processed.requiredQuantity} {processed.unit}
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
                      "{processed.notes}"
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

        <button
          type="button"
          className="mobile-btn-large"
          onClick={() => {
            setMaterialFlow("add");
            setMaterialStep(1);
          }}
          style={{ position: "sticky", bottom: "16px", zIndex: 10, boxShadow: "0 4px 10px rgba(14, 165, 233, 0.3)" }}
        >
          <Plus size={18} />
          <span>Log New Material</span>
        </button>

        {/* Modal for adding material */}
        <Modal
          isOpen={materialFlow === "add"}
          onClose={handleCloseMaterialModal}
          title="Log New Material"
          maxWidth="460px"
        >
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <div className="mobile-step-indicator" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)" }}>Step {materialStep} of 3</span>
              <div style={{ display: "flex", gap: "6px" }}>
                <div className={`mobile-step-dot ${materialStep >= 1 ? 'active' : ''}`} />
                <div className={`mobile-step-dot ${materialStep >= 2 ? 'active' : ''}`} />
                <div className={`mobile-step-dot ${materialStep >= 3 ? 'active' : ''}`} />
              </div>
            </div>

            {/* Step 1: Category selection */}
            {materialStep === 1 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <span className="mobile-form-label">Choose Material Category</span>
                <div className="mobile-category-list">
                  {Array.from(new Set(materialMaster.filter(m => m.status === "Active").map(m => m.category))).concat("Other").map(cat => {
                    const emojis = {
                      Cement: "🧱",
                      Steel: "🧬",
                      Sand: "⏳",
                      Bricks: "🧱",
                      Other: "📦"
                    };
                    const emoji = emojis[cat] || "📦";
                    return (
                      <div 
                        key={cat} 
                        className={`mobile-category-item ${materialCategory === cat ? 'active' : ''}`}
                        onClick={() => {
                          setMaterialCategory(cat);
                          setMaterialName(""); 
                          setMaterialStep(2);
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
                          <span style={{ fontSize: "20px" }}>{emoji}</span>
                          <span>{cat}</span>
                        </div>
                        <ChevronRight size={18} />
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Name Input */}
            {materialStep === 2 && (
              <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div>
                  <span className="mobile-form-label">Material Category: <strong style={{ color: "var(--accent-600)" }}>{materialCategory}</strong></span>
                </div>

                {materialCategory === "Other" && (
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    <span className="mobile-form-label">Specify Material Category <span style={{ color: "var(--danger-500)" }}>*</span></span>
                    <input
                      type="text"
                      placeholder="E.g. Glass, Wood, Tiles"
                      value={customMaterialCategory}
                      onChange={(e) => setCustomMaterialCategory(e.target.value)}
                      required
                      style={{
                        height: "42px",
                        padding: "10px 12px",
                        border: "1.5px solid var(--accent-500)",
                        borderRadius: "var(--radius-sm)",
                        fontSize: "14px",
                        outline: "none",
                        backgroundColor: "#ffffff"
                      }}
                    />
                  </div>
                )}

                <div style={{ position: "relative" }} ref={comboboxRef}>
                  <span className="mobile-form-label">Material Name</span>
                  <div className="input-wrapper" style={{ marginTop: "4px" }}>
                    <Package size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder={materialCategory === "Other" ? "Enter custom material name..." : "Search or type material name..."}
                      value={materialName}
                      onChange={(e) => {
                        setMaterialName(e.target.value);
                        setIsSuggestionsOpen(true);
                      }}
                      onFocus={() => setIsSuggestionsOpen(true)}
                      required 
                      autoComplete="off"
                      style={{ height: "42px", paddingLeft: "40px" }}
                    />
                  </div>
                  
                  {isSuggestionsOpen && materialCategory !== "Other" && (
                    <div style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      zIndex: 50,
                      backgroundColor: "#ffffff",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      boxShadow: "var(--shadow-md)",
                      maxHeight: "180px",
                      overflowY: "auto",
                      marginTop: "4px"
                    }}>
                      {materialMaster.filter(m => m.status === "Active" && m.category === materialCategory).map(m => m.name).length > 0 ? (
                        materialMaster.filter(m => m.status === "Active" && m.category === materialCategory).map(m => m.name).map(sug => {
                          const isSelected = materialName.trim().toLowerCase() === sug.toLowerCase();
                          return (
                            <button
                              type="button"
                              key={sug}
                              onClick={() => {
                                setMaterialName(sug);
                                setIsSuggestionsOpen(false);
                              }}
                              style={{
                                display: "block",
                                width: "100%",
                                padding: "10px 14px",
                                textAlign: "left",
                                backgroundColor: isSelected ? "var(--accent-50)" : "#ffffff",
                                color: isSelected ? "var(--accent-700)" : "var(--primary-800)",
                                border: "none",
                                borderBottom: "1px solid #f1f5f9",
                                fontWeight: isSelected ? "700" : "500",
                                fontSize: "13px",
                                cursor: "pointer"
                              }}
                            >
                              {sug}
                            </button>
                          );
                        })
                      ) : (
                        <div style={{ padding: "10px 14px", color: "var(--text-muted)", fontSize: "12px", fontStyle: "italic" }}>
                          Using custom name: "{materialName}"
                        </div>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <Button
                    type="button"
                    variant="outline"
                    style={{ flex: 1 }}
                    onClick={() => setMaterialStep(1)}
                  >
                    Back
                  </Button>
                  <Button
                    type="button"
                    style={{ flex: 1 }}
                    disabled={!materialName.trim()}
                    onClick={() => setMaterialStep(3)}
                  >
                    Next Step
                  </Button>
                </div>
              </div>
            )}

            {/* Step 3: Logistics details */}
            {materialStep === 3 && (
              <form onSubmit={handleMaterialSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--text-muted)" }}>Category & Name:</span>
                  <strong style={{ fontSize: "14px", color: "var(--primary-900)" }}>{materialCategory} • {materialName}</strong>
                </div>

                {/* Units selection */}
                <div>
                  <span className="mobile-form-label">Unit Type</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "4px" }}>
                    {["Bag", "Kg", "Ton", "Load", "Pieces", "Meter", "Unit"].map(unitOption => (
                      <button
                        type="button"
                        key={unitOption}
                        onClick={() => setMaterialUnit(unitOption)}
                        style={{
                          flex: "1 0 auto",
                          padding: "8px 12px",
                          borderRadius: "6px",
                          border: materialUnit === unitOption ? "2px solid var(--accent-600)" : "1px solid var(--border-color)",
                          backgroundColor: materialUnit === unitOption ? "var(--accent-50)" : "#ffffff",
                          color: materialUnit === unitOption ? "var(--accent-700)" : "var(--primary-800)",
                          fontWeight: "700",
                          fontSize: "12px",
                          cursor: "pointer"
                        }}
                      >
                        {unitOption}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Counter */}
                <div>
                  <span className="mobile-form-label">Quantity</span>
                  <div style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                    height: "44px",
                    marginTop: "4px"
                  }}>
                    <button
                      type="button"
                      onClick={() => setMaterialQuantity(prev => Math.max(0, (Number(prev) || 0) - 10))}
                      style={{
                        padding: "0 14px",
                        border: "none",
                        background: "var(--primary-50)",
                        color: "var(--danger-600)",
                        cursor: "pointer",
                        fontWeight: "800",
                        fontSize: "14px",
                        borderRight: "1px solid var(--border-color)"
                      }}
                    >
                      -10
                    </button>
                    <input 
                      type="number" 
                      placeholder="0.0"
                      min="0.01"
                      step="any"
                      value={materialQuantity}
                      onChange={(e) => setMaterialQuantity(e.target.value)}
                      required 
                      style={{
                        border: "none",
                        outline: "none",
                        textAlign: "center",
                        flex: 1,
                        fontSize: "16px",
                        fontWeight: "800",
                        color: "var(--primary-950)",
                        backgroundColor: "transparent",
                        margin: 0,
                        padding: 0
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => setMaterialQuantity(prev => (Number(prev) || 0) + 10)}
                      style={{
                        padding: "0 14px",
                        border: "none",
                        background: "var(--primary-50)",
                        color: "var(--success-600)",
                        cursor: "pointer",
                        fontWeight: "800",
                        fontSize: "14px",
                        borderLeft: "1px solid var(--border-color)"
                      }}
                    >
                      +10
                    </button>
                  </div>
                </div>

                {/* Supplier */}
                <div>
                  <span className="mobile-form-label">Supplier Company</span>
                  <div className="input-wrapper">
                    <Briefcase size={18} className="input-icon" />
                    <input 
                      type="text" 
                      placeholder="Enter supplier name..."
                      value={materialSupplier}
                      onChange={(e) => setMaterialSupplier(e.target.value)}
                      required 
                      style={{ height: "42px", paddingLeft: "40px" }}
                    />
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px" }}>
                    {["UltraTech Suppliers Ltd", "TATA Steel Corp", "National Quarries", "City Brick Kiln Co."].map(sug => (
                      <button
                        type="button"
                        key={sug}
                        onClick={() => setMaterialSupplier(sug)}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "16px",
                          border: "1px solid var(--border-color)",
                          backgroundColor: materialSupplier === sug ? "var(--primary-100)" : "#ffffff",
                          color: materialSupplier === sug ? "var(--primary-800)" : "var(--text-muted)",
                          fontSize: "11px",
                          fontWeight: "600",
                          cursor: "pointer"
                        }}
                      >
                        {sug}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Date */}
                <div>
                  <span className="mobile-form-label">Receipt Date</span>
                  <div className="input-wrapper">
                    <Calendar size={18} className="input-icon" />
                    <input 
                      type="date" 
                      value={materialPurchaseDate}
                      onChange={(e) => setMaterialPurchaseDate(e.target.value)}
                      required 
                      style={{ height: "42px", paddingLeft: "40px" }}
                    />
                  </div>
                </div>

                {/* Notes */}
                <div>
                  <span className="mobile-form-label">Remarks / Notes</span>
                  <textarea 
                    className="mobile-textarea"
                    placeholder="Challan number, inspection info, etc..."
                    value={materialNotes}
                    onChange={(e) => setMaterialNotes(e.target.value)}
                    style={{ minHeight: "50px" }}
                  />
                </div>

                {/* Invoice Photo */}
                <div>
                  <span className="mobile-form-label">Upload Challan Photo</span>
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                    <label style={{ 
                      display: "flex", 
                      flexDirection: "column", 
                      alignItems: "center", 
                      gap: "6px", 
                      padding: "20px 16px", 
                      border: "2px dashed var(--border-color)", 
                      borderRadius: "8px", 
                      cursor: "pointer", 
                      backgroundColor: "var(--primary-50)",
                      textAlign: "center"
                    }}>
                      <Camera size={24} style={{ color: "var(--primary-600)" }} />
                      <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-800)" }}>Choose or Capture Photo</span>
                      <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setMaterialInvoiceFile, setMaterialInvoicePreview)} />
                    </label>
                    {materialInvoicePreview && (
                      <div style={{ position: "relative", width: "100px", height: "70px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)", alignSelf: "center" }}>
                        <img src={materialInvoicePreview} alt="Invoice preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                        <button type="button" onClick={() => { setMaterialInvoiceFile(null); setMaterialInvoicePreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Form Actions */}
                <div style={{ display: "flex", gap: "10px", marginTop: "12px" }}>
                  <Button
                    type="button"
                    variant="outline"
                    style={{ flex: 1 }}
                    onClick={() => setMaterialStep(2)}
                  >
                    Back
                  </Button>
                  <Button
                    type="submit"
                    style={{ flex: 1 }}
                    disabled={materialSubmitting}
                  >
                    {materialSubmitting ? "Saving..." : "Save Delivery"}
                  </Button>
                </div>
              </form>
            )}
          </div>
        </Modal>
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

    const formatINR = (val) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val);

    const ledger = getSiteExpenseLedger(currentSiteObj, materials, labourHistory, generalExpenses, labourPayments, labourMaster?.categories || {});
    const myExpenses = generalExpenses.filter(g => g.siteId === activeSiteId);

    const handleSaveExpense = async (e) => {
      e.preventDefault();
      if (!expenseAmount || !expenseDesc.trim()) return;
      try {
        await saveGeneralExpense({
          siteId: activeSiteId,
          category: expenseCategory,
          amount: Number(expenseAmount),
          date: expenseDate,
          description: expenseDesc.trim(),
          notes: expenseNotes.trim(),
          createdBy: userProfile?.fullName || "Engineer",
          status: "Pending" // Require Admin approval
        });
        showToast("Expense requisition submitted to Admin!", "success");
        setShowAddExpenseModal(false);
        setExpenseAmount("");
        setExpenseDesc("");
        setExpenseNotes("");
        await loadDashboardData();
      } catch (err) {
        showToast(`Submission failed: ${err.message}`, "error");
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

        {/* Expenses List */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--primary-950)" }}>Requisitions Summary</h4>
          <button
            type="button"
            onClick={() => setShowAddExpenseModal(true)}
            style={{
              padding: "6px 12px",
              backgroundColor: "var(--primary-100)",
              color: "var(--primary-800)",
              border: "none",
              borderRadius: "6px",
              fontSize: "12px",
              fontWeight: "800",
              cursor: "pointer"
            }}
          >
            + Request
          </button>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
          {myExpenses.length === 0 ? (
            <div style={{ textAlign: "center", padding: "24px 16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>No expense requests logged yet.</p>
            </div>
          ) : (
            myExpenses.map(exp => (
              <div key={exp.id} className="mobile-material-card" style={{ padding: "12px", display: "flex", flexDirection: "column", gap: "6px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-600)" }}>{exp.category}</span>
                  <Badge status={exp.status === "Approved" ? "success" : exp.status === "Rejected" ? "danger" : "pending"}>
                    {exp.status ? exp.status.toUpperCase() : "PENDING"}
                  </Badge>
                </div>
                <h4 style={{ margin: 0, fontSize: "13.5px", fontWeight: "800" }}>{exp.description}</h4>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", color: "var(--text-muted)", marginTop: "4px" }}>
                  <span>Requested Amount: <strong>{formatINR(exp.amount)}</strong></span>
                  <span className="font-mono">{exp.date}</span>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Modal: Request New Expense */}
        {showAddExpenseModal && (
          <Modal
            isOpen={showAddExpenseModal}
            onClose={() => setShowAddExpenseModal(false)}
            title="Request Site Expense Requisition"
            maxWidth="380px"
          >
            <form onSubmit={handleSaveExpense} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Expense Category</span>
                <select
                  value={expenseCategory}
                  onChange={(e) => setExpenseCategory(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1", backgroundColor: "#ffffff" }}
                >
                  <option value="Site Expense">Site Expense (fuel, water, transport)</option>
                  <option value="Other Expense">Other Expense (fees, emergency bills)</option>
                </select>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Description / Particulars</span>
                <input
                  type="text"
                  placeholder="e.g. diesel for backup generator"
                  value={expenseDesc}
                  onChange={(e) => setExpenseDesc(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Amount Required (₹)</span>
                <input
                  type="number"
                  placeholder="e.g. 1500"
                  value={expenseAmount}
                  onChange={(e) => setExpenseAmount(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Date Needed</span>
                <input
                  type="date"
                  value={expenseDate}
                  onChange={(e) => setExpenseDate(e.target.value)}
                  required
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Additional notes</span>
                <input
                  type="text"
                  placeholder="e.g. urgent generator backup"
                  value={expenseNotes}
                  onChange={(e) => setExpenseNotes(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <Button type="button" variant="outline" style={{ flex: 1 }} onClick={() => setShowAddExpenseModal(false)}>Cancel</Button>
                <Button type="submit" variant="primary" style={{ flex: 1 }}>Submit Request</Button>
              </div>
            </form>
          </Modal>
        )}

      </div>
    );
  };

  const renderLabourView = () => {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        {/* Date Selector */}
        <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span className="mobile-form-label" style={{ margin: 0 }}>Labour Count Date</span>
            {assignedSites.length > 1 && (
              <select
                value={activeSiteId}
                onChange={(e) => setActiveSiteId(e.target.value)}
                style={{
                  padding: "4px 8px",
                  borderRadius: "4px",
                  border: "1px solid var(--border-color)",
                  fontSize: "12px",
                  fontWeight: "600",
                  color: "var(--primary-800)",
                  backgroundColor: "#fff"
                }}
              >
                {assignedSites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            )}
          </div>
          <div className="input-wrapper" style={{ marginTop: "4px" }}>
            <Calendar size={18} className="input-icon" />
            <input 
              type="date" 
              value={labourDate} 
              onChange={(e) => setLabourDate(e.target.value)} 
              required 
              style={{ height: "42px", padding: "10px 14px 10px 40px", fontSize: "14px" }}
            />
          </div>
        </div>

        {/* Workforce headcounts */}
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <span className="mobile-form-label">Worker Headcounts</span>
          {categories.map(cat => {
            const catEntries = labourEntries.filter(e => e.categoryId === cat.id);
            const currentVal = catEntries.length;
            const emojis = {
              Mason: "👷",
              Helper: "🧱",
              Electrician: "🔧",
              Plumber: "🚰",
              Painter: "🖌️",
              Other: "📋"
            };
            const emoji = emojis[cat.name] || "🔨";
            
            return (
              <div key={cat.id} className="mobile-labour-card" style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", width: "100%" }}>
                  <div className="mobile-labour-info" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "20px" }}>{emoji}</span>
                    <span className="mobile-labour-name" style={{ fontWeight: "700" }}>{getLabourDisplayName(cat.name)}</span>
                  </div>
                  
                  <div className="counter-control" style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                    <button
                      type="button"
                      className="counter-btn"
                      onClick={() => handleDecrementLabour(cat.id)}
                      disabled={currentVal === 0}
                      style={{ opacity: currentVal === 0 ? 0.5 : 1 }}
                    >
                      <Minus size={14} />
                    </button>
                    <span style={{ fontWeight: "800", fontSize: "15px", width: "30px", textAlign: "center" }}>{currentVal}</span>
                    <button
                      type="button"
                      className="counter-btn"
                      onClick={() => handleIncrementLabour(cat)}
                    >
                      <Plus size={14} />
                    </button>
                  </div>
                </div>

                {/* List of numbered entries for this category */}
                {catEntries.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px", paddingLeft: "28px" }}>
                    {catEntries.map((entry, index) => (
                      <span
                        key={index}
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "6px",
                          backgroundColor: "var(--primary-50)",
                          color: "var(--primary-800)",
                          padding: "4px 10px",
                          borderRadius: "16px",
                          fontSize: "12.5px",
                          fontWeight: "600",
                          border: "1px solid var(--primary-100)"
                        }}
                      >
                        {entry.displayName}
                        <button
                          type="button"
                          onClick={() => handleRemoveSpecificEntry(entry)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--danger-500)",
                            cursor: "pointer",
                            padding: 0,
                            display: "inline-flex",
                            alignItems: "center",
                            fontSize: "14px",
                            lineHeight: 1
                          }}
                          title="Remove entry"
                        >
                          &times;
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>

        {/* Workforce Total Count */}
        <div style={{
          backgroundColor: "var(--primary-900)",
          color: "#ffffff",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          boxShadow: "var(--shadow-md)",
          marginTop: "16px"
        }}>
          <div>
            <span style={{ fontSize: "11px", opacity: 0.8, textTransform: "uppercase", fontWeight: "700", display: "block" }}>Total Workers Present</span>
            <span style={{ fontSize: "18px", fontWeight: "800", color: "var(--accent-400)" }}>
              {Object.values(countsMap).reduce((sum, val) => sum + (val || 0), 0)} Workers
            </span>
          </div>
          <button
            type="button"
            className="mobile-attendance-btn"
            style={{ backgroundColor: "var(--accent-500)", color: "var(--primary-950)", fontSize: "12px", fontWeight: "800" }}
            onClick={handleSaveLabourCounts}
            disabled={labourSaving}
          >
            {labourSaving ? "Saving..." : "Save Counts"}
          </button>
        </div>

        {/* History logs */}
        <div style={{ marginTop: "24px" }}>
          <span className="mobile-form-label">Workforce History Logs</span>
          {labourHistoryLoading ? (
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", padding: "16px" }}>Loading logs...</div>
          ) : labourHistory.length === 0 ? (
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-muted)", padding: "16px" }}>No past records found.</div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              {labourHistory.map(row => (
                <div key={row.date} style={{
                  padding: "12px 16px",
                  border: "1px solid var(--border-color)",
                  borderRadius: "var(--radius-md)",
                  backgroundColor: "#ffffff",
                  boxShadow: "var(--shadow-sm)"
                }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                    <span className="font-mono" style={{ fontWeight: "800", color: "var(--primary-900)", fontSize: "13px" }}>{row.date}</span>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge badge-success" style={{ fontWeight: "800", fontSize: "11px", backgroundColor: "var(--success-50)", color: "var(--success-700)", border: "none" }}>{row.total} Workers</span>
                      {row.engineerId === currentEngineerId && (
                        <button 
                          type="button" 
                          onClick={() => handleDeleteLabourLog(row.date)}
                          style={{ border: "none", backgroundColor: "transparent", color: "var(--danger-500)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                          title="Delete Labour Log"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "11px", color: "var(--text-muted)" }}>
                    {Object.entries(row).map(([k, v]) => {
                      if (["date", "total", "id", "siteId", "createdAt", "updatedAt", "engineerId"].includes(k)) return null;
                      let masterKey = k;
                      if (k === "Masons") masterKey = "Mason";
                      if (k === "Helpers") masterKey = "Helper";
                      if (k === "Painters") masterKey = "Painter";
                      if (k === "Plumbers") masterKey = "Plumber";
                      if (k === "Electricians") masterKey = "Electrician";
                      if (k === "Others") masterKey = "Other";
                      return <span key={k}>{getLabourDisplayName(masterKey)}: {v}</span>;
                    }).filter(Boolean).reduce((prev, curr) => [prev, <span key={Math.random()}>•</span>, curr], [])}
                  </div>
                </div>
              ))}
            </div>
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
                    {photo.engineerId === currentEngineerId && (
                      <button 
                        type="button" 
                        onClick={() => handleDeleteSitePhoto(photo.id)}
                        style={{
                          position: "absolute",
                          top: "8px",
                          right: "8px",
                          border: "none",
                          backgroundColor: "rgba(255, 255, 255, 0.9)",
                          color: "var(--danger-600)",
                          borderRadius: "50%",
                          width: "28px",
                          height: "28px",
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.2)",
                          zIndex: 2
                        }}
                        title="Delete Photo"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
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
            <HardHat size={20} style={{ color: "var(--accent-600)" }} />
            <h3 style={{ fontSize: "15px", fontWeight: "800", color: "var(--primary-900)", margin: 0 }}>
              {tab === "attendance" ? "Attendance" : 
               tab === "material" ? "Materials" : 
               tab === "labour" ? "Workforce" : 
               tab === "expenses" ? "Financials & Expenses" : 
               ["more", "photos", "progress", "profile"].includes(tab) ? "More Tools" : "Apex Build"}
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
            className={`mobile-nav-btn ${["more", "photos", "progress", "profile"].includes(tab) ? "active" : ""}`}
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

      <Loading show={loading} text="Synchronizing Worksite Database..." />
    </div>
  );
}

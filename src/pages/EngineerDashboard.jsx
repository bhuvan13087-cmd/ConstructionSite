import React, { useState, useEffect, useRef } from "react";
import Layout from "../components/layout/Layout";
import { useAuth } from "../context/AuthContext";
import { 
  getAssignedSitesForEngineer, 
  getTodayAttendance,
  markAttendance,
  saveSitePhoto,
  getSitePhotos,
  saveDailyProgressReport,
  getDailyUpdatesForEngineer,
  calculateDistanceMeters,
  addMaterial,
  getMaterialsDetailed,
  saveLabourDailyCounts,
  getLabourDailyCounts,
  getLabourDailyCountsHistory,
  getEngineerAttendanceAndLeaveStats,
  logEngineerLeave,
  getEngineerLeaves,
  deleteEngineerLeave,
  deleteMaterial,
  deleteLabourDailyCounts,
  deleteDailyProgressReport,
  deleteSitePhoto
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
import SelectWithOthers from "../components/common/SelectWithOthers";
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
  HardHat
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

// Fallback reverse geocoding address generator
function getMockAddress(lat, lng, site) {
  if (site) {
    const R = 6371e3; // Earth's radius in meters
    const lat1 = Number(site.latitude || 28.5355);
    const lon1 = Number(site.longitude || 77.3910);
    const lat2 = Number(lat);
    const lon2 = Number(lng);
    const phi1 = (lat1 * Math.PI) / 180;
    const phi2 = (lat2 * Math.PI) / 180;
    const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
    const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;
    const a =
      Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
      Math.cos(phi1) * Math.cos(phi2) *
      Math.sin(deltaLambda / 2) * Math.sin(deltaLambda / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    const dist = R * c;

    if (dist <= Number(site.radius || 100)) {
      return `${site.location} (Matched Boundary)`;
    }
  }
  return `Sector ${Math.floor(Math.abs(lat) % 100)}, Near Plaza, City Circle (Lat: ${Number(lat).toFixed(4)}, Lng: ${Number(lng).toFixed(4)})`;
}

// Reverse geocode via free public API with mock fallback
async function getReverseGeocode(lat, lng, site) {
  try {
    const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`, {
      headers: {
        'Accept-Language': 'en'
      }
    });
    if (res.ok) {
      const data = await res.json();
      if (data && data.display_name) {
        return data.display_name;
      }
    }
  } catch (e) {
    console.warn("Reverse geocode failed, using mock address:", e);
  }
  return getMockAddress(lat, lng, site);
}

const categorySuggestions = {
  Cement: ["UltraTech Cement", "ACC Cement", "OPC 53 Grade Cement", "PPC Cement", "White Cement", "Sulphate Resistant Cement"],
  Steel: ["Tata Steel", "TMT Rebars 12mm", "TMT Rebars 16mm", "Binding Wire", "Structural Steel Section"],
  Sand: ["River Sand (Fine)", "M-Sand (Manufactured)", "Coarse Sand (Plastering)"],
  Bricks: ["Red Clay Bricks", "Fly Ash Bricks", "AAC Light Blocks", "Solid Concrete Blocks"],
  Other: ["Pipes & Fittings", "Painting Primer", "Waterproofing Chemical", "Electrical PVC Conduit"]
};

export default function EngineerDashboard({ tab = "dashboard" }) {
  const { userProfile, logout } = useAuth();
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

  // Personal stats & leaves states
  const [personalStats, setPersonalStats] = useState(null);
  const [loggedLeaves, setLoggedLeaves] = useState([]);
  const [leaveDate, setLeaveDate] = useState(new Date().toISOString().split("T")[0]);
  const [leaveReason, setLeaveReason] = useState("Personal Leave");
  const [leaveSubmitting, setLeaveSubmitting] = useState(false);
  
  // Geolocation mock control (highly useful for remote developer testing)
  const [mockLocation, setMockLocation] = useState(true);

  // Dynamic Labour Categories
  const [categories, setCategories] = useState(["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"]);
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
  const [mockCase, setMockCase] = useState("valid"); // "valid", "different", "nogps", "nopermission", "old"
  const [locationCheckStatus, setLocationCheckStatus] = useState("unchecked"); // "unchecked", "checking", "warning", "granted"
  const [deviceCoords, setDeviceCoords] = useState(null); // { latitude, longitude }
  const [locationError, setLocationError] = useState("");

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
  const [progressSubmitting, setProgressSubmitting] = useState(false);

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

      // Fetch personal stats and leaves
      try {
        const stats = await getEngineerAttendanceAndLeaveStats(engineerId, userProfile.holidayAllowance || 24);
        setPersonalStats(stats);
        const leaves = await getEngineerLeaves(engineerId);
        setLoggedLeaves(leaves);
      } catch (err) {
        console.error("Failed to load personal attendance/leave stats:", err);
      }

      if (filteredSites.length > 0) {
        // Fallback or default active site
        const defaultSiteId = activeSiteId || filteredSites[0].id;
        setActiveSiteId(defaultSiteId);
        
        // Fetch today's check-in attendance
        const attendance = await getTodayAttendance(engineerId, todayStr);
        setTodayAttendance(attendance);
        
        // Fetch site photos
        const photos = await getSitePhotos(engineerId);
        setSitePhotos(photos);
        
        // Fetch daily updates
        const updates = await getDailyUpdatesForEngineer(engineerId);
        setDailyUpdates(updates);

        // Fetch material receipts
        const fetchedMaterials = [];
        for (const site of filteredSites) {
          const siteMats = await getMaterialsDetailed(site.id);
          fetchedMaterials.push(...siteMats);
        }
        setMaterials(fetchedMaterials);
      }
    } catch (err) {
      console.error("Dashboard data load error:", err);
      showToast(`Database synchronization failed: ${err.message}`, "error");
    } finally {
      setLoading(false);
    }
  };

  // Sync data on component mount and profile changes
  useEffect(() => {
    loadDashboardData();
  }, [userProfile]);

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

  // Sync labour counts & historical summary whenever active site or select date changes
  useEffect(() => {
    const fetchLabourCountsAndHistory = async () => {
      if (!activeSiteId || !labourDate) return;
      setLabourHistoryLoading(true);
      try {
        const counts = await getLabourDailyCounts(activeSiteId, labourDate);
        const hist = await getLabourDailyCountsHistory(activeSiteId);
        setLabourHistory(hist);

        // Incorporate custom categories present in fetched data
        setCategories(prev => {
          const newCats = [...prev];
          Object.keys(counts).forEach(cat => {
            if (!newCats.includes(cat)) {
              newCats.push(cat);
            }
          });

          // Build updated counts map with fallback to zero
          setCountsMap(current => {
            const updated = {};
            newCats.forEach(cat => {
              updated[cat] = counts[cat] || 0;
            });
            return updated;
          });

          return newCats;
        });
      } catch (err) {
        console.error("Labour statistics load error:", err);
      } finally {
        setLabourHistoryLoading(false);
      }
    };

    fetchLabourCountsAndHistory();
  }, [activeSiteId, labourDate]);

  // Handle local photo files base64 parsing
  const handleFileChange = (e, setFile, setPreview) => {
    const file = e.target.files[0];
    if (file) {
      setFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setPreview(reader.result);
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
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy
          });
        },
        (error) => {
          let msg = "Unable to detect current location. Please enable GPS and try again.";
          if (error.code === error.PERMISSION_DENIED) {
            msg = "Location permission denied.";
          }
          const err = new Error(msg);
          err.code = error.code;
          reject(err);
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    });
  };

  const handlePreCaptureCheck = async () => {
    setLocationError("");
    setLocationCheckStatus("checking");

    try {
      if (mockLocation) {
        // Simulate real GPS sensor retrieval time
        await new Promise(resolve => setTimeout(resolve, 1500));

        if (mockCase === "nopermission") {
          throw { code: 1, message: "Location permission denied." };
        } else if (mockCase === "gps_off") {
          throw { code: 2, message: "Unable to detect current location. Please enable GPS and try again." };
        }
        
        const site = assignedSites.find(s => s.id === activeSiteId) || assignedSites[0];
        const siteLat = Number(site?.latitude || 28.5355);
        const siteLng = Number(site?.longitude || 77.3910);
        
        const coords = mockCase === "different" 
          ? { latitude: siteLat + 0.05, longitude: siteLng + 0.05, accuracy: 15 } 
          : { latitude: siteLat + 0.0001, longitude: siteLng + 0.0001, accuracy: 5 };
          
        setDeviceCoords(coords);
        verifySiteLocation(coords, site);
        return;
      }

      if (navigator.permissions && navigator.permissions.query) {
        try {
          const permission = await navigator.permissions.query({ name: 'geolocation' });
          if (permission.state === 'denied') {
            throw { code: 1, message: "Location permission denied." };
          }
        } catch (e) {
          console.warn("navigator.permissions.query for geolocation not supported:", e);
        }
      }

      const coords = await getDeviceLocation();
      setDeviceCoords(coords);
      
      const site = assignedSites.find(s => s.id === activeSiteId);
      verifySiteLocation(coords, site);

    } catch (err) {
      console.warn("Location check failed:", err);
      setLocationCheckStatus("warning");
      if (err.code === 1) {
        setLocationError("Location permission denied. Please allow location access in your browser settings.");
      } else {
        setLocationError(err.message || "Location access is required to verify your site attendance.");
      }
    }
  };

  const handleEnableLocation = async () => {
    await handlePreCaptureCheck();
  };

  const verifySiteLocation = (coords, site) => {
    if (!site) {
      setVerificationStatus("failed");
      setVerificationDetails({
        message: "No assigned site selected"
      });
      setLocationCheckStatus("granted");
      return;
    }

    const siteLat = Number(site.latitude || 28.5355);
    const siteLng = Number(site.longitude || 77.3910);
    const siteRadius = Number(site.radius || 100);

    const distance = calculateDistanceMeters(siteLat, siteLng, coords.latitude, coords.longitude);
    
    getReverseGeocode(coords.latitude, coords.longitude, site).then(capturedAddress => {
      const isWithinRadius = distance <= siteRadius;
      
      if (isWithinRadius) {
        setVerificationStatus("success");
        setVerificationDetails({
          message: "Site Verified Successfully",
          expectedSiteName: site.siteName,
          expectedAddress: site.location,
          capturedAddress: capturedAddress,
          distance: Math.round(distance)
        });
      } else {
        setVerificationStatus("failed");
        setVerificationDetails({
          message: "Location mismatch",
          expectedSiteName: site.siteName,
          expectedAddress: site.location,
          capturedAddress: capturedAddress,
          distance: Math.round(distance),
          allowedRadius: siteRadius
        });
      }
      setLocationCheckStatus("granted");
    }).catch(err => {
      console.error("Reverse geocoding error:", err);
      const isWithinRadius = distance <= siteRadius;
      if (isWithinRadius) {
        setVerificationStatus("success");
        setVerificationDetails({
          message: "Site Verified Successfully",
          expectedSiteName: site.siteName,
          expectedAddress: site.location,
          capturedAddress: `Lat: ${Number(coords.latitude).toFixed(4)}, Lng: ${Number(coords.longitude).toFixed(4)}`,
          distance: Math.round(distance)
        });
      } else {
        setVerificationStatus("failed");
        setVerificationDetails({
          message: "Location mismatch",
          expectedSiteName: site.siteName,
          expectedAddress: site.location,
          capturedAddress: `Lat: ${Number(coords.latitude).toFixed(4)}, Lng: ${Number(coords.longitude).toFixed(4)}`,
          distance: Math.round(distance),
          allowedRadius: siteRadius
        });
      }
      setLocationCheckStatus("granted");
    });
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
      setCameraError("Failed to access camera stream. Please check camera permissions in browser settings.");
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
      const lat = deviceCoords ? deviceCoords.latitude : Number(site.latitude || 28.5355);
      const lng = deviceCoords ? deviceCoords.longitude : Number(site.longitude || 77.3910);
      const photoGpsLocation = { latitude: lat, longitude: lng };

      await saveSitePhoto(engineerId, activeSiteId, attendancePhotoPreview, lat, lng);

      await markAttendance(
        engineerId, 
        activeSiteId, 
        todayStr, 
        lat, 
        lng, 
        attendancePhotoPreview, 
        photoGpsLocation, 
        "verified"
      );

      showToast(`Checked in present at ${site.siteName}!`, "success");
      handleResetVerification();

      await loadDashboardData();
    } catch (err) {
      console.error("Mark attendance error:", err);
      showToast(err.message || "Failed to complete check-in.", "error");
    } finally {
      setAttendanceSubmitting(false);
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
      setLeaveDate(new Date().toISOString().split("T")[0]);
      setLeaveReason("Personal Leave");
      
      // Refresh statistics and leaves
      await loadDashboardData();
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
      
      // Filter out any undefined categories and map countsMap cleanly
      const submitMap = {};
      categories.forEach(cat => {
        submitMap[cat] = Number(countsMap[cat]) || 0;
      });

      await saveLabourDailyCounts(activeSiteId, engineerId, labourDate, submitMap);
      showToast(`Labour counts updated successfully for ${labourDate}!`, "success");
      
      // Refresh historical logs
      const hist = await getLabourDailyCountsHistory(activeSiteId);
      setLabourHistory(hist);
    } catch (err) {
      console.error("Labour sync failed:", err);
      showToast(`Sync failed: ${err.message}`, "error");
    } finally {
      setLabourSaving(false);
    }
  };

  // Add custom category type
  const handleAddLabourCategory = (e) => {
    e.preventDefault();
    const cleanName = newCategoryName.trim();
    if (!cleanName) {
      showToast("Please specify a category label.", "error");
      return;
    }
    
    // Capitalize category name nicely
    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);

    if (categories.includes(formattedName)) {
      showToast("Category type already exists.", "error");
      return;
    }

    const updated = [...categories, formattedName];
    setCategories(updated);
    setCountsMap(prev => ({
      ...prev,
      [formattedName]: 0
    }));
    
    // Save to LocalStorage for user persistence
    localStorage.setItem("labour_categories", JSON.stringify(updated));
    setNewCategoryName("");
    showToast(`Added category: ${formattedName}. You can now input attendance count.`, "success");
  };

  // Delete/hide custom category
  const handleDeleteLabourCategory = (categoryName) => {
    if (["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"].includes(categoryName)) {
      showToast("Cannot remove core labour categories.", "error");
      return;
    }
    if (confirm(`Remove custom category "${categoryName}"? This hides it from inputs (saved counts remain in database).`)) {
      const updated = categories.filter(c => c !== categoryName);
      setCategories(updated);
      setCountsMap(prev => {
        const copy = { ...prev };
        delete copy[categoryName];
        return copy;
      });
      localStorage.setItem("labour_categories", JSON.stringify(updated));
      showToast(`Removed category "${categoryName}" from active tracker list.`, "success");
    }
  };

  const handleOtherLabourInteract = (intendedCount) => {
    setLabourSpecifyText("");
    setPendingLabourCount(intendedCount);
    setShowLabourSpecifyModal(true);
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
        quantity: Number(materialQuantity),
        unit: materialUnit,
        supplierName: materialSupplier.trim(),
        purchaseDate: materialPurchaseDate,
        notes: materialNotes.trim(),
        invoiceUrl: materialInvoicePreview || ""
      });

      showToast("Material receipt logged successfully!", "success");
      
      // Reset forms
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
      let userLat = siteLat;
      let userLng = siteLng;

      if (!mockLocation) {
        const position = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, {
            enableHighAccuracy: true,
            timeout: 10000
          });
        });
        userLat = position.coords.latitude;
        userLng = position.coords.longitude;
      }

      // Check distance
      const distance = calculateDistanceMeters(siteLat, siteLng, userLat, userLng);
      if (distance > siteRadius) {
        throw new Error(
          `Location Verification Error: You are ${Math.round(distance)}m away from ${site.siteName}. ` +
          `Allowed radius is ${siteRadius}m. Enable 'Mock Location' to bypass.`
        );
      }

      await saveSitePhoto(engineerId, activeSiteId, sitePhotoPreview, userLat, userLng);
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
        await saveSitePhoto(engineerId, activeSiteId, progressPhotoPreview, lat, lng);
        photoIds.push("progress_log_attached_photo");
      }

      // Format description to store work completed, issues, notes in same string
      const compiledDescription = 
        `Work Completed: ${workDescription.trim()}` +
        `\n\nIssues/Blockers: ${issuesText.trim() ? issuesText.trim() : "None"}` +
        `\n\nNotes/Remarks: ${notesText.trim() ? notesText.trim() : "None"}`;

      await saveDailyProgressReport(
        engineerId,
        activeSiteId,
        compiledDescription,
        `${progressPercent}%`,
        photoIds
      );

      showToast("Daily progress updates logged successfully!", "success");
      setWorkDescription("");
      setProgressPercent(50);
      setIssuesText("");
      setNotesText("");
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
        </div>

        {/* Attendance checklist widget */}
        <div className="mobile-attendance-card">
          <div className="mobile-attendance-left">
            <span className="mobile-attendance-status-label">Your Check-In</span>
            <div className={`mobile-attendance-status-val ${todayAttendance ? 'checked' : 'unchecked'}`}>
              {todayAttendance ? '✓ Checked In Present' : '✗ Not Checked In Yet'}
            </div>
            {todayAttendance && (
              <span style={{ fontSize: "11px", color: "var(--text-muted)", marginTop: "2px" }}>
                Time: {todayAttendance.checkInTime || todayAttendance.timestamp || "Today"}
              </span>
            )}
          </div>
          {!todayAttendance && (
            <button 
              type="button" 
              onClick={() => navigate("/engineer/attendance")} 
              className="mobile-attendance-btn"
            >
              Check In
            </button>
          )}
        </div>

        {/* Developer options */}
        <div style={{
          backgroundColor: "#ffffff",
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-color)",
          padding: "14px",
          fontSize: "12px",
          display: "flex",
          flexDirection: "column",
          gap: "10px",
          boxShadow: "var(--shadow-sm)"
        }}>
          <label style={{ display: "flex", alignItems: "center", gap: "8px", fontWeight: "700", color: "var(--accent-700)", cursor: "pointer", margin: 0 }}>
            <input 
              type="checkbox" 
              checked={mockLocation} 
              onChange={(e) => setMockLocation(e.target.checked)} 
              style={{ margin: 0 }}
            />
            <span>Bypass GPS Geofence (Mocking)</span>
          </label>
          {mockLocation && (
            <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
              <span style={{ fontWeight: "700", color: "#b45309" }}>Simulate Test Case:</span>
              <select
                value={mockCase}
                onChange={(e) => setMockCase(e.target.value)}
                style={{
                  padding: "6px",
                  borderRadius: "4px",
                  border: "1px solid #d97706",
                  backgroundColor: "#ffffff",
                  fontWeight: "600",
                  color: "#b45309",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                <option value="valid">1. Correct Site Photo (Match)</option>
                <option value="different">2. Different Location Photo (Mismatch)</option>
                <option value="nogps">3. Gallery Image without GPS (No GPS)</option>
                <option value="nopermission">4. No Location Permission (Warning)</option>
                <option value="gps_off">5. GPS Off / Unavailable (Warning)</option>
                <option value="old">6. Old Photo (Timestamp Mismatch)</option>
              </select>
            </div>
          )}
        </div>

        {/* Quick Actions Grid */}
        <div style={{ marginTop: "8px" }}>
          <span className="mobile-form-label">Quick Operations</span>
          <div className="mobile-quick-action-grid">
            <div className="mobile-action-card attendance" onClick={() => navigate("/engineer/attendance")}>
              <div className="mobile-action-icon-wrapper">
                <ClipboardCheck size={20} />
              </div>
              <span className="mobile-action-title">Take Attendance</span>
            </div>
            
            <div className="mobile-action-card materials" onClick={() => navigate("/engineer/material")}>
              <div className="mobile-action-icon-wrapper">
                <Package size={20} />
              </div>
              <span className="mobile-action-title">Add Material</span>
            </div>
            
            <div className="mobile-action-card labour" onClick={() => navigate("/engineer/labour")}>
              <div className="mobile-action-icon-wrapper">
                <Users size={20} />
              </div>
              <span className="mobile-action-title">Add Labour</span>
            </div>
            
            <div className="mobile-action-card progress" onClick={() => navigate("/engineer/progress")}>
              <div className="mobile-action-icon-wrapper">
                <FileText size={20} />
              </div>
              <span className="mobile-action-title">Upload Progress</span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderAttendanceView = () => {
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
              <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--success-700)" }}>Check-In Confirmed</h4>
              <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>You are marked present at the construction site today.</p>
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
                <strong style={{ color: "var(--primary-900)" }}>{currentSite?.siteName}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>Verified Time:</span>
                <strong style={{ color: "var(--primary-900)" }}>{todayAttendance.checkInTime || todayAttendance.timestamp || "Today"}</strong>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: "var(--text-muted)" }}>GPS Location:</span>
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
                  onClick={handlePreCaptureCheck}
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
                        {attendanceSubmitting ? "Submitting..." : "Submit Present"}
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
                  <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "var(--danger-600)" }}>Location mismatch</h4>
                  <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    Your detected coordinates do not match the assigned worksite location boundary.
                  </p>
                </div>

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
            const currentVal = countsMap[cat] || 0;
            const emojis = {
              Mason: "👷",
              Helper: "🧱",
              Electrician: "🔧",
              Plumber: "🚰",
              Painter: "🖌️",
              Other: "📋"
            };
            const emoji = emojis[cat] || "🔨";
            const isCore = ["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"].includes(cat);
            
            return (
              <div key={cat} className="mobile-labour-card">
                <div className="mobile-labour-info">
                  <span style={{ fontSize: "20px" }}>{emoji}</span>
                  <div>
                    <span className="mobile-labour-name">{cat}</span>
                    {!isCore && (
                      <button
                        type="button"
                        onClick={() => handleDeleteLabourCategory(cat)}
                        style={{
                          marginLeft: "8px",
                          background: "none",
                          border: "none",
                          color: "var(--danger-500)",
                          fontSize: "11px",
                          cursor: "pointer",
                          textDecoration: "underline",
                          padding: 0
                        }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="counter-control">
                  <button
                    type="button"
                    className="counter-btn"
                    onClick={() => setCountsMap(prev => ({ ...prev, [cat]: Math.max(0, currentVal - 1) }))}
                  >
                    <Minus size={14} />
                  </button>
                  <input
                    type="number"
                    value={currentVal}
                    onChange={(e) => {
                      const val = Math.max(0, parseInt(e.target.value, 10) || 0);
                      if (cat === "Other" && val > 0) {
                        handleOtherLabourInteract(val);
                      } else {
                        setCountsMap(prev => ({ ...prev, [cat]: val }));
                      }
                    }}
                    className="counter-value"
                    style={{
                      width: "44px",
                      border: "none",
                      textAlign: "center",
                      fontWeight: "800",
                      fontSize: "15px",
                      color: "var(--primary-950)",
                      background: "transparent",
                      outline: "none",
                      padding: 0,
                      margin: 0
                    }}
                  />
                  <button
                    type="button"
                    className="counter-btn"
                    onClick={() => {
                      if (cat === "Other") {
                        handleOtherLabourInteract(currentVal + 1);
                      } else {
                        setCountsMap(prev => ({ ...prev, [cat]: currentVal + 1 }));
                      }
                    }}
                  >
                    <Plus size={14} />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        {/* Add custom trade category */}
        <div style={{
          backgroundColor: "#ffffff",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
          padding: "16px",
          boxShadow: "var(--shadow-sm)",
          marginTop: "8px"
        }}>
          <span className="mobile-form-label">Add Custom Worker Type</span>
          <div style={{ display: "flex", gap: "8px", marginTop: "6px" }}>
            <input
              type="text"
              placeholder="E.g. Welder, Carpenter"
              value={newCategoryName}
              onChange={(e) => setNewCategoryName(e.target.value)}
              style={{
                flex: 1,
                padding: "8px 12px",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                fontSize: "13px",
                outline: "none",
                margin: 0
              }}
            />
            <button
              type="button"
              onClick={handleAddLabourCategory}
              style={{
                padding: "8px 16px",
                backgroundColor: "var(--accent-50)",
                color: "var(--accent-700)",
                border: "1px solid var(--accent-200)",
                borderRadius: "var(--radius-sm)",
                fontSize: "13px",
                fontWeight: "700",
                cursor: "pointer"
              }}
            >
              Add
            </button>
          </div>
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
                      return <span key={k}>{k}: {v}</span>;
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

  const renderMaterialView = () => {
    if (materialFlow === "list") {
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
                  style={{ width: "100%", padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "12px", height: "38px" }}
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
              activeMaterials.map(m => (
                <div key={m.id} className="mobile-material-card">
                  <div className="mobile-material-header">
                    <div>
                      <span className="mobile-material-detail-label" style={{ color: "var(--accent-600)", fontSize: "10px" }}>{m.category}</span>
                      <h4 className="mobile-material-title" style={{ margin: "2px 0 0 0" }}>{m.materialName}</h4>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                      <span className="badge badge-completed" style={{ fontSize: "11px", fontWeight: "800", backgroundColor: "var(--primary-100)", color: "var(--primary-800)" }}>
                        {m.quantity} {m.unit}s
                      </span>
                      {m.engineerId === currentEngineerId && (
                        <button 
                          type="button" 
                          onClick={() => handleDeleteMaterial(m.id)}
                          style={{ border: "none", backgroundColor: "transparent", color: "var(--danger-500)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                          title="Delete Material Log"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                  
                  <div className="mobile-material-details" style={{ marginTop: "12px", borderTop: "1px solid var(--border-color)", paddingTop: "10px" }}>
                    <div className="mobile-material-detail-item">
                      <span className="mobile-material-detail-label">Supplier</span>
                      <span className="mobile-material-detail-value">{m.supplierName}</span>
                    </div>
                    <div className="mobile-material-detail-item" style={{ textAlign: "right" }}>
                      <span className="mobile-material-detail-label">Delivery Date</span>
                      <span className="mobile-material-detail-value">{m.purchaseDate}</span>
                    </div>
                  </div>

                  {m.notes && (
                    <p style={{ margin: "10px 0 0 0", fontSize: "11px", color: "var(--text-muted)", backgroundColor: "var(--primary-50)", padding: "6px 10px", borderRadius: "4px", fontStyle: "italic" }}>
                      "{m.notes}"
                    </p>
                  )}

                  {m.invoiceUrl && (
                    <div style={{ marginTop: "10px", display: "flex", justifyContent: "flex-end" }}>
                      <a href={m.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: "11px", color: "var(--accent-600)", fontWeight: "800", textDecoration: "underline" }}>
                        View Challan Photo
                      </a>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>

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
        </div>
      );
    }

    // Material receipt wizard flow
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
        <div className="mobile-steps-header">
          <div className="mobile-step-indicator">
            <span>Step {materialStep} of 3</span>
            <div style={{ display: "flex", gap: "6px" }}>
              <div className={`mobile-step-dot ${materialStep >= 1 ? 'active' : ''}`} />
              <div className={`mobile-step-dot ${materialStep >= 2 ? 'active' : ''}`} />
              <div className={`mobile-step-dot ${materialStep >= 3 ? 'active' : ''}`} />
            </div>
          </div>
          <button 
            type="button" 
            onClick={() => {
              setMaterialFlow("list");
              setMaterialStep(1);
            }}
            style={{ background: "none", border: "none", color: "var(--danger-500)", fontSize: "12px", fontWeight: "700", cursor: "pointer" }}
          >
            Cancel
          </button>
        </div>

        {/* Step 1: Category selection */}
        {materialStep === 1 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <span className="mobile-form-label">Choose Material Category</span>
            <div className="mobile-category-list">
              {["Cement", "Steel", "Sand", "Bricks", "Other"].map(cat => {
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
                  {filteredSuggestions.length > 0 ? (
                    filteredSuggestions.map(sug => {
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
              <button
                type="button"
                className="mobile-btn-large"
                style={{ backgroundColor: "var(--primary-200)", color: "var(--primary-800)", flex: 1, boxShadow: "none" }}
                onClick={() => setMaterialStep(1)}
              >
                Back
              </button>
              <button
                type="button"
                className="mobile-btn-large"
                style={{ flex: 1 }}
                disabled={!materialName.trim()}
                onClick={() => setMaterialStep(3)}
              >
                Next Step
              </button>
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
                {["Bag", "Kg", "Ton", "Load", "Pieces"].map(unitOption => (
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
              <button
                type="button"
                className="mobile-btn-large"
                style={{ backgroundColor: "var(--primary-200)", color: "var(--primary-800)", flex: 1, boxShadow: "none" }}
                onClick={() => setMaterialStep(2)}
              >
                Back
              </button>
              <button
                type="submit"
                className="mobile-btn-large"
                style={{ flex: 1 }}
                disabled={materialSubmitting}
              >
                {materialSubmitting ? "Saving..." : "Save Delivery"}
              </button>
            </div>
          </form>
        )}
      </div>
    );
  };

  const renderMoreView = () => {
    if (moreSubView === "menu") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          {/* User profile card */}
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
              color: "var(--accent-700)",
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
              <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--accent-600)", textTransform: "uppercase" }}>Civil Engineer Panel</span>
            </div>
          </div>

          {/* Menu stack */}
          <div className="mobile-menu-list">
            <button type="button" className="mobile-menu-item" onClick={() => navigate("/engineer/photos")}>
              <div className="mobile-menu-left">
                <Camera size={18} style={{ color: "var(--primary-600)" }} />
                <span>Site Photos Gallery</span>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
            </button>

            <button type="button" className="mobile-menu-item" onClick={() => navigate("/engineer/progress")}>
              <div className="mobile-menu-left">
                <FileText size={18} style={{ color: "var(--primary-600)" }} />
                <span>Daily Progress DPR</span>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
            </button>

            <button type="button" className="mobile-menu-item" onClick={() => navigate("/engineer/profile")}>
              <div className="mobile-menu-left">
                <Calendar size={18} style={{ color: "var(--primary-600)" }} />
                <span>Profile & Leaves Log</span>
              </div>
              <ChevronRight size={16} style={{ color: "var(--text-muted)" }} />
            </button>

            <button type="button" className="mobile-menu-item danger" onClick={() => logout()}>
              <div className="mobile-menu-left">
                <LogOut size={18} style={{ color: "var(--danger-500)" }} />
                <span>Logout Account</span>
              </div>
              <ChevronRight size={16} style={{ color: "var(--danger-500)" }} />
            </button>
          </div>
        </div>
      );
    }

    if (moreSubView === "photos") {
      return (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button 
              type="button" 
              onClick={() => navigate("/engineer/more")}
              style={{ border: "none", background: "none", color: "var(--primary-800)", padding: 0, display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px", fontWeight: "700" }}
            >
              ← Back
            </button>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-900)" }}>Site Inspection Photos</h4>
          </div>

          {/* Photo form */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "16px", boxShadow: "var(--shadow-sm)" }}>
            <span className="mobile-form-label">Upload Geotagged Progress Photo</span>
            <form onSubmit={handlePhotoUpload} style={{ display: "flex", flexDirection: "column", gap: "12px", marginTop: "8px" }}>
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
                <Camera size={28} style={{ color: "var(--primary-600)" }} />
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-800)" }}>Choose or Capture Photo</span>
                <input type="file" accept="image/*" capture="environment" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setSitePhotoFile, setSitePhotoPreview)} />
              </label>
              
              {sitePhotoPreview && (
                <div style={{ position: "relative", width: "100%", height: "160px", borderRadius: "6px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                  <img src={sitePhotoPreview} alt="Preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button type="button" onClick={() => { setSitePhotoFile(null); setSitePhotoPreview(null); }} style={{ position: "absolute", top: "6px", right: "6px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "22px", height: "22px", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={12} /></button>
                </div>
              )}

              <button
                type="submit"
                className="mobile-btn-large"
                disabled={photoSubmitting || !sitePhotoPreview}
                style={{ padding: "12px" }}
              >
                {photoSubmitting ? "Uploading..." : "Upload Photo"}
              </button>
            </form>
          </div>

          {/* Photo gallery */}
          <div>
            <span className="mobile-form-label">Inspection Photo Gallery</span>
            {sitePhotos.filter(p => p.siteId === activeSiteId).length === 0 ? (
              <div style={{ textAlign: "center", padding: "24px 16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>No photos uploaded for this site yet.</p>
              </div>
            ) : (
              <div className="mobile-photo-grid">
                {sitePhotos.filter(p => p.siteId === activeSiteId).map(photo => (
                  <div key={photo.id} className="mobile-photo-card" style={{ position: "relative" }}>
                    <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer">
                      <img src={photo.imageUrl} alt="Progress inspection" className="mobile-photo-img" />
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
                          backgroundColor: "rgba(255, 255, 255, 0.8)",
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
                    <div className="mobile-photo-info">
                      <span className="mobile-photo-time">
                        {photo.capturedAt?.seconds 
                          ? new Date(photo.capturedAt.seconds * 1000).toLocaleDateString()
                          : new Date(photo.capturedAt).toLocaleDateString()}
                      </span>
                      <div className="mobile-photo-loc">GPS: {Number(photo.latitude).toFixed(4)}, {Number(photo.longitude).toFixed(4)}</div>
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button 
              type="button" 
              onClick={() => navigate("/engineer/more")}
              style={{ border: "none", background: "none", color: "var(--primary-800)", padding: 0, display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px", fontWeight: "700" }}
            >
              ← Back
            </button>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-900)" }}>Daily Progress DPR Log</h4>
          </div>

          {/* Progress updates Form */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "16px", boxShadow: "var(--shadow-sm)" }}>
            <form onSubmit={handleProgressSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              <div>
                <span className="mobile-form-label">Estimated Progress Completed ({progressPercent}%)</span>
                <div style={{ display: "flex", alignItems: "center", gap: "10px", marginTop: "4px" }}>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(Number(e.target.value))}
                    style={{ flexGrow: 1, accentColor: "var(--accent-50)", cursor: "pointer", height: "6px" }}
                  />
                  <span className="badge badge-success" style={{ fontWeight: 800, fontSize: "12px", minWidth: "46px", textAlign: "center", border: "none" }}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div>
                <span className="mobile-form-label">Work Completed Today</span>
                <textarea 
                  className="mobile-textarea"
                  placeholder="Describe pours completed, walls built, etc..."
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  required 
                  style={{ minHeight: "60px" }}
                />
              </div>

              <div>
                <span className="mobile-form-label">Issues / Delay Obstacles</span>
                <input 
                  type="text" 
                  placeholder="E.g. Delay due to cement delivery lag..."
                  value={issuesText}
                  onChange={(e) => setIssuesText(e.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "13px", width: "100%", margin: 0 }}
                />
              </div>

              <div>
                <span className="mobile-form-label">Notes / Instructions</span>
                <input 
                  type="text" 
                  placeholder="E.g. Inspector checked reinforcement today..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                  style={{ padding: "8px 12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", fontSize: "13px", width: "100%", margin: 0 }}
                />
              </div>

              <div>
                <span className="mobile-form-label">Attach Progress Photo (Optional)</span>
                <div style={{ display: "flex", gap: "10px", alignItems: "center", marginTop: "4px" }}>
                  <label style={{ cursor: "pointer", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--primary-50)", fontSize: "11px", fontWeight: 700 }}>
                    <Camera size={14} />
                    <span>Choose Photo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setProgressPhotoFile, setProgressPhotoPreview)} />
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "160px" }}>
                    {progressPhotoFile ? progressPhotoFile.name : "No photo chosen"}
                  </span>
                </div>
                {progressPhotoPreview && (
                  <div style={{ marginTop: "8px", position: "relative", width: "100px", height: "70px", borderRadius: "4px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={progressPhotoPreview} alt="Work preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setProgressPhotoFile(null); setProgressPhotoPreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center" }}><X size={10} /></button>
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="mobile-btn-large"
                disabled={progressSubmitting}
                style={{ padding: "12px" }}
              >
                {progressSubmitting ? "Submitting..." : "Submit Progress Log"}
              </button>
            </form>
          </div>

          {/* DPR timeline */}
          <div>
            <span className="mobile-form-label">DPR Reports History</span>
            <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
              {dailyUpdates.filter(u => u.siteId === activeSiteId).length === 0 ? (
                <div style={{ textAlign: "center", padding: "24px 16px", backgroundColor: "#ffffff", borderRadius: "8px", border: "1px solid var(--border-color)" }}>
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>No daily reports submitted yet.</p>
                </div>
              ) : (
                dailyUpdates.filter(u => u.siteId === activeSiteId).map(row => {
                  const lines = row.description.split("\\n\\n");
                  const workLine = lines[0]?.replace("Work Completed: ", "") || row.description;
                  const issuesLine = lines[1]?.replace("Issues/Blockers: ", "");
                  const notesLine = lines[2]?.replace("Notes/Remarks: ", "");
                  
                  return (
                    <div key={row.id} style={{
                      padding: "12px 16px",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      backgroundColor: "#ffffff",
                      boxShadow: "var(--shadow-sm)"
                    }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                        <span className="font-mono" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-800)" }}>
                          {row.createdAt?.seconds 
                            ? new Date(row.createdAt.seconds * 1000).toLocaleDateString()
                            : new Date(row.createdAt).toLocaleDateString()}
                        </span>
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <span className="badge badge-success" style={{ fontWeight: "800", fontSize: "11px", backgroundColor: "var(--success-50)", color: "var(--success-700)", border: "none" }}>{row.progress}</span>
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
                      
                      <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--primary-950)" }}>
                        <strong>Work:</strong> {workLine}
                      </p>
                      {issuesLine && issuesLine !== "None" && (
                        <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--danger-600)" }}>
                          <strong>Issues:</strong> {issuesLine}
                        </p>
                      )}
                      {notesLine && notesLine !== "None" && (
                        <p style={{ margin: "4px 0", fontSize: "11px", color: "var(--text-muted)", fontStyle: "italic" }}>
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
          <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
            <button 
              type="button" 
              onClick={() => navigate("/engineer/more")}
              style={{ border: "none", background: "none", color: "var(--primary-800)", padding: 0, display: "flex", alignItems: "center", cursor: "pointer", fontSize: "14px", fontWeight: "700" }}
            >
              ← Back
            </button>
            <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-900)" }}>Profile & Leaves Summary</h4>
          </div>

          {/* Leaves stats widget */}
          <div style={{
            backgroundColor: "#ffffff",
            borderRadius: "var(--radius-md)",
            border: "1px solid var(--border-color)",
            padding: "16px",
            boxShadow: "var(--shadow-sm)",
            display: "flex",
            flexDirection: "column",
            gap: "12px"
          }}>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ backgroundColor: "var(--primary-50)", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Remaining Holidays</span>
                <strong style={{ fontSize: "18px", color: "var(--primary-950)", display: "block", marginTop: "2px" }}>
                  {personalStats ? personalStats.remainingHolidays : "--"}
                </strong>
                <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>of {userProfile?.holidayAllowance || 24} annual days</span>
              </div>
              <div style={{ backgroundColor: "var(--success-50)", padding: "10px", borderRadius: "6px", textAlign: "center" }}>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Days Worked (Month)</span>
                <strong style={{ fontSize: "18px", color: "var(--success-700)", display: "block", marginTop: "2px" }}>
                  {personalStats ? personalStats.weekdaysWorkedThisMonth : "--"}
                </strong>
                <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>checked present</span>
              </div>
            </div>
            
            <div style={{ backgroundColor: "var(--danger-50)", padding: "10px 12px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>Leaves Taken (Month / Year)</span>
                <strong style={{ fontSize: "14px", color: "var(--danger-600)" }}>
                  {personalStats ? `${personalStats.leavesThisMonth} / ${personalStats.leavesThisYear}` : "-- / --"}
                </strong>
              </div>
              <span style={{ fontSize: "10px", color: "var(--danger-700)", fontWeight: "700" }}>Leave days</span>
            </div>
          </div>

          {/* Log Leave Form */}
          <div style={{ backgroundColor: "#ffffff", borderRadius: "var(--radius-md)", border: "1px solid var(--border-color)", padding: "16px", boxShadow: "var(--shadow-sm)" }}>
            <span className="mobile-form-label">Request / Log Leave Day</span>
            <form onSubmit={handleLogLeave} style={{ display: "flex", flexDirection: "column", gap: "10px", marginTop: "8px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px" }}>
                <div>
                  <label style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", display: "block", marginBottom: "2px" }}>Date</label>
                  <input 
                    type="date" 
                    value={leaveDate}
                    onChange={(e) => setLeaveDate(e.target.value)}
                    required
                    style={{ padding: "6px", fontSize: "12px", width: "100%", borderRadius: "4px", border: "1px solid var(--border-color)" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", display: "block", marginBottom: "2px" }}>Reason</label>
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
                    selectStyle={{ padding: "4px 6px", fontSize: "12px", width: "100%", borderRadius: "4px", border: "1px solid var(--border-color)", backgroundColor: "#fff", height: "30px" }}
                    inputStyle={{ padding: "6px", fontSize: "12px", borderRadius: "4px", border: "1.5px solid var(--accent-500)" }}
                  />
                </div>
              </div>
              <button type="submit" disabled={leaveSubmitting} className="mobile-btn-large" style={{ padding: "10px", fontSize: "12px" }}>
                {leaveSubmitting ? "Submitting..." : "Log Leave Day"}
              </button>
            </form>
          </div>

          {/* Logged Leaves history */}
          {loggedLeaves.length > 0 && (
            <div>
              <span className="mobile-form-label">Logged Leaves History</span>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {loggedLeaves.map(leave => (
                  <div key={leave.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 12px", backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)" }}>
                    <div>
                      <span style={{ fontSize: "12px", fontWeight: "800", color: "var(--primary-900)" }}>{leave.date}</span>
                      <span style={{ fontSize: "10px", color: "var(--text-muted)", display: "block" }}>{leave.reason}</span>
                    </div>
                    <button 
                      type="button" 
                      onClick={() => handleDeleteLeave(leave.id)}
                      style={{ border: "none", backgroundColor: "transparent", color: "var(--danger-500)", cursor: "pointer", padding: "4px", display: "flex", alignItems: "center" }}
                    >
                      <Trash2 size={14} />
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
        {/* Specify Labour Category Modal */}
        {showLabourSpecifyModal && (
          <div style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            zIndex: 1100,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "16px"
          }}>
            <div style={{
              backgroundColor: "#ffffff",
              borderRadius: "var(--radius-md)",
              padding: "20px",
              width: "100%",
              maxWidth: "320px",
              boxShadow: "var(--shadow-lg)",
              display: "flex",
              flexDirection: "column",
              gap: "14px"
            }}>
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-900)" }}>Specify Labour Category</h4>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)", lineHeight: "1.4" }}>
                Please enter the trade or type for this worker headcount (e.g. Welder, Carpenter).
              </p>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <span className="mobile-form-label">Labour Type <span style={{ color: "var(--danger-500)" }}>*</span></span>
                <input
                  type="text"
                  placeholder="E.g. Welder, Carpenter"
                  value={labourSpecifyText}
                  onChange={(e) => setLabourSpecifyText(e.target.value)}
                  required
                  style={{
                    width: "100%",
                    padding: "10px 12px",
                    border: "1.5px solid var(--accent-500)",
                    borderRadius: "var(--radius-sm)",
                    fontSize: "14px",
                    outline: "none",
                    backgroundColor: "#ffffff"
                  }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                <button
                  type="button"
                  className="mobile-btn-large"
                  style={{ backgroundColor: "var(--primary-200)", color: "var(--primary-800)", flex: 1, padding: "10px", fontSize: "12px", boxShadow: "none" }}
                  onClick={() => setShowLabourSpecifyModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="mobile-btn-large success"
                  style={{ flex: 1.5, padding: "10px", fontSize: "12px" }}
                  onClick={() => {
                    const cleanName = labourSpecifyText.trim();
                    if (!cleanName) {
                      showToast("Please specify the labour type.", "error");
                      return;
                    }
                    const formattedName = cleanName.charAt(0).toUpperCase() + cleanName.slice(1);
                    
                    // Update categories
                    setCategories(prev => {
                      const updated = prev.includes(formattedName) ? prev : [...prev, formattedName];
                      // Save to local storage for persistence
                      localStorage.setItem("labour_categories", JSON.stringify(updated));
                      return updated;
                    });

                    // Update countsMap
                    setCountsMap(prev => ({
                      ...prev,
                      [formattedName]: (prev[formattedName] || 0) + pendingLabourCount,
                      Other: 0
                    }));

                    setShowLabourSpecifyModal(false);
                    showToast(`Added custom labour category: ${formattedName} with count ${pendingLabourCount}`, "success");
                  }}
                >
                  Save Trade
                </button>
              </div>
            </div>
          </div>
        )}

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
        <header className="mobile-app-header">
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <HardHat size={22} style={{ color: "var(--accent-600)" }} />
            <h3 style={{ fontSize: "16px", fontWeight: "800", color: "var(--primary-900)" }}>
              {tab === "attendance" ? "Attendance" : 
               tab === "material" ? "Materials" : 
               tab === "labour" ? "Workforce" : 
               ["more", "photos", "progress", "profile"].includes(tab) ? "More Tools" : "Apex Build"}
            </h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontWeight: "600" }} className="font-mono">
              {new Date().toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
            </span>
            <div style={{
              width: "28px",
              height: "28px",
              borderRadius: "50%",
              backgroundColor: "var(--accent-50)",
              color: "var(--accent-700)",
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

        {/* Scrollable View Content */}
        <div className="mobile-app-content">
          {tab === "attendance" && renderAttendanceView()}
          {tab === "material" && renderMaterialView()}
          {tab === "labour" && renderLabourView()}
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
      </div>

      <Loading show={loading} text="Synchronizing Worksite Database..." />
    </div>
  );
}

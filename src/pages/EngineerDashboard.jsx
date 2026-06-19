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
  deleteEngineerLeave
} from "../services/firebaseService";
import Loading from "../components/common/Loading";
import Card from "../components/common/Card";
import Button from "../components/common/Button";
import Badge from "../components/common/Badge";
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
  ChevronRight
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
  Cement: ["OPC 53 Grade Cement", "PPC Cement", "White Cement", "Sulphate Resistant Cement"],
  Steel: ["TMT Rebars 12mm", "TMT Rebars 16mm", "Binding Wire", "Structural Steel Section"],
  Sand: ["River Sand (Fine)", "M-Sand (Manufactured)", "Coarse Sand (Plastering)"],
  Bricks: ["Red Clay Bricks", "Fly Ash Bricks", "AAC Light Blocks", "Solid Concrete Blocks"],
  Other: ["Pipes & Fittings", "Painting Primer", "Waterproofing Chemical", "Electrical PVC Conduit"]
};

export default function EngineerDashboard({ tab = "dashboard" }) {
  const { userProfile } = useAuth();
  const navigate = useNavigate();
  
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

  // 3. Material Received fields
  const [materialName, setMaterialName] = useState("");
  const [materialCategory, setMaterialCategory] = useState("Cement");
  const [materialQuantity, setMaterialQuantity] = useState("");
  const [materialUnit, setMaterialUnit] = useState("Bag");
  const [materialSupplier, setMaterialSupplier] = useState("");
  const [materialPurchaseDate, setMaterialPurchaseDate] = useState(new Date().toISOString().split("T")[0]);
  const [materialNotes, setMaterialNotes] = useState("");
  const [materialInvoiceFile, setMaterialInvoiceFile] = useState(null);
  const [materialInvoicePreview, setMaterialInvoicePreview] = useState(null);
  const [materialSubmitting, setMaterialSubmitting] = useState(false);
  
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

  const fileInputRef = useRef(null);

  const getDeviceLocation = () => {
    return new Promise((resolve, reject) => {
      if (!navigator.geolocation) {
        reject(new Error("Geolocation not supported by browser."));
        return;
      }
      navigator.geolocation.getCurrentPosition(
        (position) => {
          resolve({
            latitude: position.coords.latitude,
            longitude: position.coords.longitude
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
        if (mockCase === "nopermission") {
          throw { code: 1, message: "Location permission denied." };
        } else if (mockCase === "gps_off") {
          throw { code: 2, message: "Unable to detect current location. Please enable GPS and try again." };
        }
        
        const site = assignedSites.find(s => s.id === activeSiteId) || assignedSites[0];
        const siteLat = Number(site?.latitude || 28.5355);
        const siteLng = Number(site?.longitude || 77.3910);
        
        const coords = mockCase === "different" 
          ? { latitude: siteLat + 0.05, longitude: siteLng + 0.05 } 
          : { latitude: siteLat + 0.0001, longitude: siteLng + 0.0001 };
          
        setDeviceCoords(coords);
        setLocationCheckStatus("granted");
        
        // Trigger file input click programmatically after UI state update
        setTimeout(() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }, 150);
        return;
      }

      const coords = await getDeviceLocation();
      setDeviceCoords(coords);
      setLocationCheckStatus("granted");
      
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }, 150);

    } catch (err) {
      console.warn("Location check failed:", err);
      setLocationCheckStatus("warning");
      setLocationError(err.message || "Location access is required to verify your site attendance.");
    }
  };

  const handleEnableLocation = async () => {
    setLocationError("");
    try {
      if (mockLocation) {
        if (mockCase === "nopermission") {
          setLocationError("Location permission denied. Please select a valid test case to proceed.");
          return;
        } else if (mockCase === "gps_off") {
          setLocationError("Unable to detect current location. Please enable GPS and try again.");
          return;
        }
        
        const site = assignedSites.find(s => s.id === activeSiteId) || assignedSites[0];
        const siteLat = Number(site?.latitude || 28.5355);
        const siteLng = Number(site?.longitude || 77.3910);
        const coords = mockCase === "different" 
          ? { latitude: siteLat + 0.05, longitude: siteLng + 0.05 } 
          : { latitude: siteLat + 0.0001, longitude: siteLng + 0.0001 };

        setDeviceCoords(coords);
        setLocationCheckStatus("granted");
        setTimeout(() => {
          if (fileInputRef.current) {
            fileInputRef.current.click();
          }
        }, 150);
        return;
      }

      const coords = await getDeviceLocation();
      setDeviceCoords(coords);
      setLocationCheckStatus("granted");
      
      setTimeout(() => {
        if (fileInputRef.current) {
          fileInputRef.current.click();
        }
      }, 150);
    } catch (err) {
      console.warn("Location enable query failed:", err);
      setLocationError(err.message || "Unable to detect current location. Please enable GPS and try again.");
    }
  };

  const handleCancelLocationPrecheck = () => {
    setLocationCheckStatus("unchecked");
    setLocationError("");
    setDeviceCoords(null);
  };

  // 1. Staff check-in verification photo upload & validation flow
  const handleAttendancePhotoChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (!activeSiteId) {
      showToast("Please select your active site first.", "error");
      return;
    }

    const site = assignedSites.find(s => s.id === activeSiteId);
    if (!site) {
      showToast("Target site check failed.", "error");
      return;
    }

    setAttendancePhotoFile(file);
    
    // Create preview
    const reader = new FileReader();
    reader.onloadend = () => {
      setAttendancePhotoPreview(reader.result);
    };
    reader.readAsDataURL(file);

    // Start verification
    setAttendancePhotoUploading(true);
    setVerificationStatus("pending");
    setVerificationDetails(null);

    try {
      let metadata = null;

      if (mockLocation) {
        // Mocked verification path based on mockCase
        if (mockCase === "nogps") {
          metadata = { hasGps: false };
        } else if (mockCase === "old") {
          metadata = {
            hasGps: true,
            lat: Number(site.latitude || 28.5355),
            lng: Number(site.longitude || 77.3910),
            timestamp: new Date(Date.now() - 2 * 60 * 60 * 1000) // 2 hours old
          };
        } else if (mockCase === "different") {
          metadata = {
            hasGps: true,
            lat: Number(site.latitude || 28.5355) + 0.05, // ~15km away
            lng: Number(site.longitude || 77.3910) + 0.05,
            timestamp: new Date()
          };
        } else {
          // valid
          metadata = {
            hasGps: true,
            lat: Number(site.latitude || 28.5355) + 0.0001, // very close
            lng: Number(site.longitude || 77.3910) + 0.0001,
            timestamp: new Date()
          };
        }
      } else {
        // Real EXIF reading path
        metadata = await readPhotoMetadata(file);
      }

      if (!metadata || !metadata.hasGps) {
        setVerificationStatus("failed");
        setVerificationDetails({
          message: "Invalid photo",
          isNoGps: true
        });
        return;
      }

      // Check timestamp
      const now = new Date();
      const photoTime = metadata.timestamp || now;
      const ageMs = Math.abs(now.getTime() - photoTime.getTime());
      const isOld = ageMs > 5 * 60 * 1000; // 5 minutes threshold

      if (isOld) {
        setVerificationStatus("failed");
        setVerificationDetails({
          message: "Old photo detected",
          isOld: true
        });
        return;
      }

      // Geofence check using both live coordinates and photo GPS coordinates
      const siteLat = Number(site.latitude || 28.5355);
      const siteLng = Number(site.longitude || 77.3910);
      const siteRadius = Number(site.radius || 100);
      
      const userLat = deviceCoords ? deviceCoords.latitude : siteLat;
      const userLng = deviceCoords ? deviceCoords.longitude : siteLng;
      
      const liveDistance = calculateDistanceMeters(siteLat, siteLng, userLat, userLng);
      const photoDistance = calculateDistanceMeters(siteLat, siteLng, metadata.lat, metadata.lng);
      
      // Get Location Address of live device location
      const capturedAddress = await getReverseGeocode(userLat, userLng, site);

      // Set locations to display
      setPhotoGpsLat(metadata.lat);
      setPhotoGpsLng(metadata.lng);
      setPhotoTimestamp(photoTime);
      setPhotoAddress(capturedAddress);

      const isLiveValid = liveDistance <= siteRadius;
      const isPhotoValid = photoDistance <= siteRadius;

      if (!isLiveValid || !isPhotoValid) {
        const largerDist = Math.max(Math.round(liveDistance), Math.round(photoDistance));
        setVerificationStatus("failed");
        setVerificationDetails({
          message: "Location mismatch",
          expectedSiteName: site.siteName,
          expectedAddress: site.location,
          capturedAddress: capturedAddress,
          distance: largerDist,
          liveDistance: Math.round(liveDistance),
          photoDistance: Math.round(photoDistance)
        });
      } else {
        setVerificationStatus("success");
        setVerificationDetails({
          message: "Site Verified Successfully",
          expectedSiteName: site.siteName,
          expectedAddress: site.location,
          capturedAddress: capturedAddress,
          distance: Math.round(liveDistance)
        });
      }

    } catch (err) {
      console.error("Photo verification error:", err);
      setVerificationStatus("failed");
      setVerificationDetails({
        message: err.message || "Failed to read location information."
      });
    } finally {
      setAttendancePhotoUploading(false);
    }
  };

  const handleResetVerification = () => {
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

  // 2. Execute Staff Check-In Attendance after successful verification
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

      // Save progressive log photo to the site inspection feed
      await saveSitePhoto(engineerId, activeSiteId, attendancePhotoPreview, lat, lng);

      // Save present attendance log
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
    if (confirm("Are you sure you want to cancel this leave record?")) {
      try {
        await deleteEngineerLeave(leaveId);
        showToast("Leave record removed successfully.", "success");
        await loadDashboardData();
      } catch (err) {
        console.error("Failed to cancel leave:", err);
        showToast("Failed to cancel leave: " + err.message, "error");
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
      await addMaterial({
        siteId: activeSiteId,
        engineerId,
        materialName: materialName.trim(),
        category: materialCategory,
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
      setMaterialQuantity("");
      setMaterialUnit("Bag");
      setMaterialSupplier("");
      setMaterialPurchaseDate(new Date().toISOString().split("T")[0]);
      setMaterialNotes("");
      setMaterialInvoiceFile(null);
      setMaterialInvoicePreview(null);

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
      <Layout title="Site Engineer Dashboard" description="Construction Field representative portal.">
        <div style={{ display: "flex", flexDirection: "column", gap: "24px", padding: "16px" }}>
          <Card title="Engineer Profile" style={{ borderLeft: "5px solid var(--accent-500)" }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "16px", alignItems: "center" }}>
              <div className="user-avatar" style={{ width: "50px", height: "50px", fontSize: "18px", borderRadius: "12px" }}>
                {userProfile?.fullName ? userProfile.fullName.split(" ").map(n => n[0]).join("").substring(0, 2).toUpperCase() : "SE"}
              </div>
              <div>
                <h4 style={{ margin: 0, fontSize: "16px", fontWeight: "700" }}>{userProfile?.fullName || "Site Engineer"}</h4>
                <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>{userProfile?.email}</p>
              </div>
            </div>
          </Card>
          <Card style={{ padding: "40px 20px", textAlign: "center", borderTop: "4px solid var(--danger-500)" }}>
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
              <AlertTriangle size={36} style={{ color: "var(--danger-500)" }} />
              <h3 style={{ fontSize: "18px", fontWeight: "700", color: "var(--primary-900)", margin: 0 }}>No Worksite Assigned</h3>
              <p style={{ color: "var(--text-muted)", fontSize: "13px", maxWidth: "400px", margin: "0 auto", lineHeight: "1.5" }}>
                You do not currently have any active construction sites allocated. Please contact the project administrator to assign a site to your user profile.
              </p>
            </div>
          </Card>
        </div>
      </Layout>
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

  return (
    <Layout title={pageTitles[tab] || "Site Engineer Dashboard"} description="Record construction field operations, labour stats, and delivery records.">
      {toast.show && (
        <div id="toast-container" className="toast-container">
          <div className={`toast toast-${toast.type}`}>
            <span className="toast-message">{toast.message}</span>
          </div>
        </div>
      )}

      {/* TOP SELECTOR & DEV OPTIONS PANEL */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        justifyContent: "space-between",
        alignItems: "center",
        gap: "16px",
        padding: "16px",
        backgroundColor: "#ffffff",
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        marginBottom: "24px",
        boxShadow: "0 1px 3px rgba(0,0,0,0.05)"
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px", flex: "1 1 auto", minWidth: "250px" }}>
          <div style={{
            backgroundColor: "var(--accent-50)",
            padding: "8px",
            borderRadius: "var(--radius-sm)",
            color: "var(--accent-600)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center"
          }}>
            <MapPin size={20} />
          </div>
          <div style={{ flexGrow: 1 }}>
            <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)" }}>
              Active Project Worksite
            </span>
            {assignedSites.length === 1 ? (
              <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "700", color: "var(--primary-900)" }}>
                {assignedSites[0].siteName}
              </h4>
            ) : (
              <select
                value={activeSiteId}
                onChange={(e) => setActiveSiteId(e.target.value)}
                style={{
                  display: "block",
                  width: "100%",
                  padding: "4px 8px",
                  borderRadius: "var(--radius-sm)",
                  border: "1px solid var(--border-color)",
                  backgroundColor: "#ffffff",
                  fontSize: "14px",
                  fontWeight: "600",
                  color: "var(--primary-900)",
                  cursor: "pointer",
                  outline: "none"
                }}
              >
                {assignedSites.map(s => (
                  <option key={s.id} value={s.id}>{s.siteName}</option>
                ))}
              </select>
            )}
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "16px", flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>
            <Calendar size={14} style={{ color: "var(--accent-500)" }} />
            <span>Today: {new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}</span>
          </div>

          <label style={{
            display: "inline-flex",
            alignItems: "center",
            gap: "8px",
            fontSize: "12px",
            fontWeight: "700",
            color: "var(--accent-600)",
            cursor: "pointer",
            userSelect: "none",
            backgroundColor: "var(--accent-50)",
            padding: "6px 12px",
            borderRadius: "var(--radius-sm)",
            border: "1px solid var(--accent-200)"
          }}>
            <input 
              type="checkbox" 
              checked={mockLocation} 
              onChange={(e) => setMockLocation(e.target.checked)} 
              style={{ cursor: "pointer" }}
            />
            <span>Bypass GPS Geofence (Mocking)</span>
          </label>

          {mockLocation && (
            <div style={{
              display: "flex",
              alignItems: "center",
              gap: "8px",
              fontSize: "12px",
              backgroundColor: "#fef3c7",
              border: "1px solid #fcd34d",
              padding: "6px 12px",
              borderRadius: "var(--radius-sm)"
            }}>
              <span style={{ fontWeight: "700", color: "#b45309" }}>Simulate Test Case:</span>
              <select
                value={mockCase}
                onChange={(e) => setMockCase(e.target.value)}
                style={{
                  padding: "2px 6px",
                  borderRadius: "4px",
                  border: "1px solid #d97706",
                  backgroundColor: "#ffffff",
                  fontSize: "12px",
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
      </div>

      {/* RENDER DYNAMIC MODULE TABS */}

      {/* A) OVERVIEW DASHBOARD TAB */}
      {tab === "dashboard" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          {/* Welcome Banner */}
          <div style={{
            background: "linear-gradient(135deg, var(--primary-900) 0%, var(--primary-950) 100%)",
            color: "#ffffff",
            padding: "24px",
            borderRadius: "var(--radius-md)",
            display: "flex",
            flexWrap: "wrap",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "16px"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: "16px" }}>
              <div style={{
                width: "48px",
                height: "48px",
                borderRadius: "12px",
                backgroundColor: "var(--accent-500)",
                color: "var(--primary-950)",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontWeight: "800",
                fontSize: "18px"
              }}>
                {userProfile?.fullName ? userProfile.fullName.charAt(0).toUpperCase() : "E"}
              </div>
              <div>
                <h2 style={{ margin: 0, fontSize: "18px", fontWeight: "800" }}>Welcome Back, {userProfile?.fullName || "Site Engineer"}</h2>
                <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "#94a3b8" }}>Civil Representative • Active duty</p>
              </div>
            </div>
            {currentSite && (
              <div style={{ backgroundColor: "rgba(255,255,255,0.08)", padding: "10px 16px", borderRadius: "8px", border: "1px solid rgba(255,255,255,0.12)" }}>
                <span style={{ display: "block", fontSize: "10px", color: "#94a3b8", fontWeight: "700", textTransform: "uppercase" }}>Selected Site</span>
                <strong style={{ fontSize: "14px", color: "var(--accent-400)" }}>{currentSite.siteName}</strong>
              </div>
            )}
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            {/* Project Details Card */}
            {currentSite && (
              <Card title="Assigned Site Information" icon={MapPin} style={{ borderLeft: "5px solid var(--accent-500)" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                    <div>
                      <h4 style={{ margin: 0, fontSize: "15px", fontWeight: "800", color: "var(--primary-950)" }}>{currentSite.siteName}</h4>
                      <p style={{ margin: "4px 0 0 0", fontSize: "13px", color: "var(--text-muted)" }}>{currentSite.location}</p>
                    </div>
                    <Badge status={currentSite.status || "Planning"} />
                  </div>
                  <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />
                  <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Client Name:</span>
                      <span style={{ fontWeight: "600", color: "var(--primary-800)" }}>{currentSite.clientName || "--"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Start Date:</span>
                      <span style={{ fontWeight: "600" }} className="font-mono">{currentSite.startDate || "--"}</span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between" }}>
                      <span style={{ color: "var(--text-muted)" }}>Expected Completion:</span>
                      <span style={{ fontWeight: "600" }} className="font-mono">{currentSite.expectedEndDate || "--"}</span>
                    </div>
                  </div>
                </div>
              </Card>
            )}

            {/* Today's Attendance Summary (Staff check-in) */}
            <Card title="Today's Attendance Status" icon={ClipboardCheck} style={{ borderLeft: "5px solid var(--primary-500)" }}>
              {todayAttendance ? (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px", alignItems: "center", textAlign: "center", padding: "10px 0" }}>
                  <div style={{ width: "40px", height: "40px", borderRadius: "50%", backgroundColor: "var(--success-50)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <CheckCircle2 size={24} style={{ color: "var(--success-500)" }} />
                  </div>
                  <div>
                    <h4 style={{ fontWeight: "700", color: "var(--primary-950)", margin: 0, fontSize: "14px" }}>Attendance Verified & Present</h4>
                    <p style={{ fontSize: "12px", color: "var(--text-muted)", marginTop: "4px" }}>
                      Checked in: <strong>{todayAttendance.checkInTime?.seconds 
                        ? new Date(todayAttendance.checkInTime.seconds * 1000).toLocaleTimeString()
                        : new Date(todayAttendance.checkInTime).toLocaleTimeString()}</strong>
                    </p>
                    {todayAttendance.photoUrl && (
                      <div style={{ marginTop: "10px", width: "120px", height: "90px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)", margin: "10px auto 0 auto" }}>
                        <img src={todayAttendance.photoUrl} alt="Check-in Selfie" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                  {/* Stage 1: Location pre-check or warning */}
                  {locationCheckStatus === "unchecked" && (
                    <>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px", backgroundColor: "var(--danger-50)", padding: "10px", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--danger-500)" }}>
                        <AlertCircle size={16} style={{ color: "var(--danger-500)", flexShrink: 0 }} />
                        <span style={{ fontSize: "12px", color: "var(--danger-700)", fontWeight: "600" }}>
                          Staff check-in is pending for today.
                        </span>
                      </div>

                      <div style={{ border: "1px dashed var(--border-color)", padding: "12px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary-50)", textAlign: "center" }}>
                        <p style={{ fontSize: "12px", color: "var(--text-muted)", marginBottom: "12px" }}>
                          GPS verification is required before capturing your site selfie.
                        </p>
                        <Button 
                          type="button" 
                          onClick={handlePreCaptureCheck} 
                          icon={Camera} 
                          style={{ padding: "10px 20px", fontSize: "13px", fontWeight: "700" }}
                        >
                          Capture Site Photo
                        </Button>
                      </div>
                    </>
                  )}

                  {locationCheckStatus === "checking" && (
                    <div style={{ border: "1px solid var(--border-color)", padding: "20px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary-50)", textAlign: "center" }}>
                      <div className="spinner-small" style={{ border: "2px solid rgba(0,0,0,0.1)", borderTop: "2px solid var(--primary-600)", borderRadius: "50%", width: "24px", height: "24px", animation: "spin 1s linear infinite", margin: "0 auto 12px auto" }} />
                      <span style={{ fontSize: "13px", color: "var(--text-muted)", fontWeight: "600" }}>Checking device GPS and permissions...</span>
                    </div>
                  )}

                  {locationCheckStatus === "warning" && (
                    <div style={{ 
                      padding: "20px", 
                      border: "1px solid var(--danger-200)", 
                      borderRadius: "var(--radius-sm)", 
                      backgroundColor: "var(--danger-50)", 
                      borderLeft: "4px solid var(--danger-500)",
                      display: "flex", 
                      flexDirection: "column", 
                      gap: "14px"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                        <AlertTriangle size={24} style={{ color: "var(--danger-500)" }} />
                        <h4 style={{ margin: 0, fontSize: "14px", fontWeight: "800", color: "var(--danger-800)" }}>
                          Location Access Required
                        </h4>
                      </div>
                      
                      <p style={{ margin: 0, fontSize: "13px", color: "var(--danger-700)", lineHeight: "1.5" }}>
                        Location access is required to verify your site attendance.
                      </p>

                      {locationError && (
                        <div style={{ fontSize: "12px", color: "var(--danger-600)", fontWeight: "600", backgroundColor: "rgba(239, 68, 68, 0.08)", padding: "8px", borderRadius: "4px" }}>
                          {locationError}
                        </div>
                      )}

                      <div style={{ display: "flex", gap: "10px", marginTop: "4px" }}>
                        <Button 
                          type="button" 
                          onClick={handleEnableLocation}
                          style={{ 
                            flex: 1, 
                            backgroundColor: "var(--danger-600)", 
                            color: "#ffffff",
                            fontSize: "12px",
                            padding: "8px 12px"
                          }}
                        >
                          Enable Location
                        </Button>
                        <Button 
                          type="button" 
                          onClick={handleCancelLocationPrecheck}
                          variant="outline"
                          style={{ 
                            flex: 1,
                            fontSize: "12px",
                            padding: "8px 12px"
                          }}
                        >
                          Cancel
                        </Button>
                      </div>
                    </div>
                  )}

                  {/* Stage 2: Camera Capture (once coordinates are received and permission is granted) */}
                  {locationCheckStatus === "granted" && (
                    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                      {!attendancePhotoPreview ? (
                        <div style={{ border: "1px dashed var(--border-color)", padding: "16px", borderRadius: "var(--radius-sm)", backgroundColor: "var(--success-50)", textAlign: "center" }}>
                          <p style={{ fontSize: "12px", color: "var(--success-700)", fontWeight: "700", marginBottom: "12px" }}>
                            ✓ Live Location Obtained Successfully!
                          </p>
                          <label style={{ 
                            display: "inline-flex", 
                            alignItems: "center", 
                            gap: "8px", 
                            padding: "10px 20px", 
                            border: "1px solid var(--success-200)", 
                            borderRadius: "var(--radius-sm)", 
                            cursor: "pointer", 
                            backgroundColor: "#ffffff",
                            fontSize: "13px",
                            fontWeight: "700",
                            color: "var(--success-800)",
                            boxShadow: "0 1px 2px rgba(0,0,0,0.05)"
                          }}>
                            <Camera size={18} style={{ color: "var(--success-600)" }} />
                            <span>Capture Selfie Now</span>
                            <input 
                              type="file" 
                              accept="image/*" 
                              capture="environment" 
                              style={{ display: "none" }} 
                              ref={fileInputRef}
                              onChange={handleAttendancePhotoChange} 
                            />
                          </label>
                        </div>
                      ) : (
                        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                          {/* Photo Preview */}
                          <div style={{ position: "relative", width: "100%", height: "180px", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-color)", backgroundColor: "#000" }}>
                            <img src={attendancePhotoPreview} alt="Selfie preview" style={{ width: "100%", height: "100%", objectFit: "contain" }} />
                            <button 
                              type="button" 
                              onClick={handleResetVerification} 
                              style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}
                            >
                              <X size={14} />
                            </button>
                          </div>

                          {/* Loader during EXIF processing */}
                          {attendancePhotoUploading && (
                            <div style={{ display: "flex", alignItems: "center", gap: "8px", padding: "12px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary-50)" }}>
                              <div className="spinner-small" style={{ border: "2px solid rgba(0,0,0,0.1)", borderTop: "2px solid var(--primary-600)", borderRadius: "50%", width: "16px", height: "16px", animation: "spin 1s linear infinite" }} />
                              <span style={{ fontSize: "12px", color: "var(--text-muted)", fontWeight: "600" }}>Verifying live GPS location & photo EXIF...</span>
                            </div>
                          )}

                          {/* Verification: SUCCESS CARD */}
                          {verificationStatus === "success" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", backgroundColor: "var(--success-50)", border: "1px solid var(--success-200)", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--success-500)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--success-700)", fontWeight: "800", fontSize: "14px" }}>
                                <CheckCircle2 size={18} />
                                <span>Site Verified Successfully</span>
                              </div>
                              <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px", color: "var(--success-800)" }}>
                                <div style={{ fontWeight: "600" }}>✓ Site Name: {currentSite.siteName}</div>
                                <div>✓ Address matched: {photoAddress}</div>
                                <div>✓ Distance from site: {verificationDetails.distance === 0 ? "On Site" : `${verificationDetails.distance} meters`}</div>
                              </div>
                              
                              <Button 
                                type="button" 
                                onClick={handleMarkAttendance} 
                                isLoading={attendanceSubmitting} 
                                icon={ClipboardCheck} 
                                style={{ 
                                  marginTop: "6px",
                                  backgroundColor: "var(--success-600)",
                                  color: "#ffffff"
                                }}
                              >
                                Continue Attendance Entry
                              </Button>
                            </div>
                          )}

                          {/* Verification: FAILURE CARD */}
                          {verificationStatus === "failed" && (
                            <div style={{ display: "flex", flexDirection: "column", gap: "10px", padding: "16px", backgroundColor: "var(--danger-50)", border: "1px solid var(--danger-200)", borderRadius: "var(--radius-sm)", borderLeft: "4px solid var(--danger-500)" }}>
                              <div style={{ display: "flex", alignItems: "center", gap: "8px", color: "var(--danger-700)", fontWeight: "800", fontSize: "14px" }}>
                                <AlertCircle size={18} />
                                <span>
                                  {verificationDetails.isNoPermission ? "Location Permission Blocked" : 
                                   verificationDetails.isNoGps ? "Invalid Photo" : 
                                   verificationDetails.isOld ? "Old Photo Detected" : "Location Mismatch"}
                                </span>
                              </div>

                              <div style={{ fontSize: "12px", color: "var(--danger-800)", display: "flex", flexDirection: "column", gap: "6px" }}>
                                {verificationDetails.isNoPermission && (
                                  <span>Please enable location services and grant permission to allow geo-tagged captures.</span>
                                )}
                                
                                {verificationDetails.isNoGps && (
                                  <span>No GPS coordinates found in image metadata. Please capture a new geo-tagged photo using your camera.</span>
                                )}

                                {verificationDetails.isOld && (
                                  <span>Photo timestamp is too old. Please capture a new live site photo.</span>
                                )}

                                {!verificationDetails.isNoPermission && !verificationDetails.isNoGps && !verificationDetails.isOld && (
                                  <>
                                    <div><strong>Expected Site:</strong> {verificationDetails.expectedSiteName} ({verificationDetails.expectedAddress})</div>
                                    <div><strong>Captured Location:</strong> {verificationDetails.capturedAddress}</div>
                                    <div><strong>Device Distance:</strong> {verificationDetails.liveDistance} meters away</div>
                                    <div><strong>Photo GPS Distance:</strong> {verificationDetails.photoDistance} meters away</div>
                                    <div style={{ color: "var(--danger-700)", fontWeight: "600", marginTop: "4px" }}>
                                      Please capture photo from assigned site location.
                                    </div>
                                  </>
                                )}
                              </div>
                              
                              <label style={{ 
                                display: "inline-flex", 
                                alignItems: "center", 
                                justifyContent: "center",
                                gap: "8px", 
                                padding: "8px 16px", 
                                border: "1px solid var(--danger-300)", 
                                borderRadius: "var(--radius-sm)", 
                                cursor: "pointer", 
                                backgroundColor: "#ffffff",
                                fontSize: "12px",
                                fontWeight: "700",
                                color: "var(--danger-700)",
                                textAlign: "center",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                marginTop: "6px"
                              }}>
                                <Camera size={14} />
                                <span>Retake Photo</span>
                                <input 
                                  type="file" 
                                  accept="image/*" 
                                  capture="environment" 
                                  style={{ display: "none" }} 
                                  ref={fileInputRef}
                                  onChange={handleAttendancePhotoChange} 
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}
            </Card>

            {/* My Leaves & Holidays summary card */}
            <Card title="My Leaves & Holiday Summary" icon={Calendar} style={{ borderLeft: "5px solid var(--accent-600)" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                
                {/* Stats block */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                  <div style={{ backgroundColor: "var(--primary-50)", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>
                      Remaining Holidays
                    </span>
                    <strong style={{ fontSize: "16px", color: "var(--primary-950)", display: "block", marginTop: "2px" }}>
                      {personalStats ? personalStats.remainingHolidays : "--"}
                    </strong>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                      of {userProfile?.holidayAllowance || 24} annual days
                    </span>
                  </div>

                  <div style={{ backgroundColor: "var(--success-50)", padding: "8px", borderRadius: "6px", textAlign: "center" }}>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>
                      Weekdays Worked (Month)
                    </span>
                    <strong style={{ fontSize: "16px", color: "var(--success-700)", display: "block", marginTop: "2px" }}>
                      {personalStats ? personalStats.weekdaysWorkedThisMonth : "--"}
                    </strong>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)" }}>
                      days checked present
                    </span>
                  </div>
                </div>

                <div style={{ backgroundColor: "var(--danger-50)", padding: "8px 12px", borderRadius: "6px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div>
                    <span style={{ fontSize: "9px", color: "var(--text-muted)", display: "block", textTransform: "uppercase", fontWeight: "700" }}>
                      Leaves Taken (Month / Year)
                    </span>
                    <strong style={{ fontSize: "14px", color: "var(--danger-600)" }}>
                      {personalStats ? `${personalStats.leavesThisMonth} / ${personalStats.leavesThisYear}` : "-- / --"}
                    </strong>
                  </div>
                  <span style={{ fontSize: "10px", color: "var(--danger-700)", fontWeight: "700" }}>Leave days</span>
                </div>

                <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />

                {/* Log Leave Inline Form */}
                <form onSubmit={handleLogLeave} style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                  <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-800)", textTransform: "uppercase" }}>Log a Leave Day</span>
                  <div style={{ display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "8px" }}>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", display: "block", marginBottom: "2px" }}>Date</label>
                      <input 
                        type="date" 
                        value={leaveDate}
                        onChange={(e) => setLeaveDate(e.target.value)}
                        required
                        style={{ padding: "4px 6px", fontSize: "12px", width: "100%", borderRadius: "4px", border: "1px solid var(--border-color)" }}
                      />
                    </div>
                    <div>
                      <label style={{ fontSize: "10px", color: "var(--text-muted)", fontWeight: "600", display: "block", marginBottom: "2px" }}>Reason</label>
                      <select 
                        value={leaveReason}
                        onChange={(e) => setLeaveReason(e.target.value)}
                        style={{ padding: "4px 6px", fontSize: "12px", width: "100%", borderRadius: "4px", border: "1px solid var(--border-color)", backgroundColor: "#fff" }}
                      >
                        <option value="Personal Leave">Personal</option>
                        <option value="Sick Leave">Sick Leave</option>
                        <option value="Vacation">Vacation</option>
                        <option value="Other">Other</option>
                      </select>
                    </div>
                  </div>
                  <Button type="submit" isLoading={leaveSubmitting} style={{ padding: "6px 12px", fontSize: "11px", width: "100%" }}>
                    Record Leave Date
                  </Button>
                </form>

                {/* Logged Leaves Scroll list */}
                {loggedLeaves.length > 0 && (
                  <>
                    <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: "4px 0" }} />
                    <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-800)", textTransform: "uppercase" }}>My Leaves History</span>
                    <div style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "6px" }}>
                      {loggedLeaves.map(leave => (
                        <div key={leave.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", backgroundColor: "#fff", border: "1px solid var(--border-color)", borderRadius: "4px" }}>
                          <div>
                            <span style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-950)", display: "block" }}>{leave.date}</span>
                            <span style={{ fontSize: "10px", color: "var(--text-muted)" }}>{leave.reason}</span>
                          </div>
                          <button 
                            type="button" 
                            onClick={() => handleDeleteLeave(leave.id)}
                            style={{ 
                              border: "none", 
                              backgroundColor: "transparent", 
                              color: "var(--danger-500)", 
                              cursor: "pointer", 
                              padding: "4px",
                              display: "flex",
                              alignItems: "center"
                            }} 
                            title="Cancel Leave"
                          >
                            <Trash2 size={13} style={{ display: "inline-block" }} />
                          </button>
                        </div>
                      ))}
                    </div>
                  </>
                )}

              </div>
            </Card>

          </div>

          {/* Quick Stats Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px" }}>
            
            {/* Labour Summary Card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--primary-600)", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Labour Present Today</span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "800", color: "var(--primary-900)" }}>
                  {Object.values(countsMap).reduce((sum, val) => sum + (val || 0), 0)} Workers
                </h3>
              </div>
              <div style={{ backgroundColor: "var(--primary-50)", padding: "8px", borderRadius: "50%", color: "var(--primary-600)" }}>
                <Users size={20} />
              </div>
            </div>

            {/* Material Summary Card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--accent-600)", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Material Logged</span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "800", color: "var(--primary-900)" }}>
                  {materials.filter(m => m.siteId === activeSiteId).length} Deliveries
                </h3>
              </div>
              <div style={{ backgroundColor: "var(--accent-50)", padding: "8px", borderRadius: "50%", color: "var(--accent-600)" }}>
                <Package size={20} />
              </div>
            </div>

            {/* Photo Logs Card */}
            <div style={{ backgroundColor: "#ffffff", border: "1px solid var(--border-color)", borderLeft: "4px solid var(--info-600)", padding: "16px", borderRadius: "8px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <span style={{ fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)" }}>Site Photos Captured</span>
                <h3 style={{ margin: "4px 0 0 0", fontSize: "20px", fontWeight: "800", color: "var(--primary-900)" }}>
                  {sitePhotos.filter(p => p.siteId === activeSiteId).length} Images
                </h3>
              </div>
              <div style={{ backgroundColor: "var(--info-50)", padding: "8px", borderRadius: "50%", color: "var(--info-600)" }}>
                <Camera size={20} />
              </div>
            </div>

          </div>

          {/* Recent site activities & timelines */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            {/* Recent Progress Logs */}
            <Card title="Recent Work Updates" icon={FileText} headerActions={<Button onClick={() => navigate("/engineer/progress")} variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Manage</Button>}>
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "250px", overflowY: "auto" }}>
                {dailyUpdates.filter(u => u.siteId === activeSiteId).length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", margin: "16px 0" }}>No updates recorded yet.</p>
                ) : (
                  dailyUpdates.filter(u => u.siteId === activeSiteId).slice(0, 3).map(update => {
                    // Extract title description (handles formatted description)
                    const lines = update.description.split("\n\n");
                    const workCompleted = lines[0]?.replace("Work Completed: ", "") || update.description;
                    
                    return (
                      <div key={update.id} style={{ padding: "10px", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", backgroundColor: "var(--primary-50)" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: "11px", fontWeight: "700", marginBottom: "4px" }}>
                          <span className="font-mono text-muted">
                            {update.createdAt?.seconds 
                              ? new Date(update.createdAt.seconds * 1000).toLocaleDateString()
                              : new Date(update.createdAt).toLocaleDateString()}
                          </span>
                          <span style={{ color: "var(--success-600)" }}>{update.progress} Done</span>
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", color: "var(--primary-950)", overflow: "hidden", textOverflow: "ellipsis", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>
                          {workCompleted}
                        </p>
                      </div>
                    );
                  })
                )}
              </div>
            </Card>

            {/* Recent Photos */}
            <Card title="Recent Photo Gallery" icon={Camera} headerActions={<Button onClick={() => navigate("/engineer/photos")} variant="outline" style={{ padding: "4px 8px", fontSize: "11px" }}>Upload</Button>}>
              {sitePhotos.filter(p => p.siteId === activeSiteId).length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", margin: "16px 0" }}>No photos uploaded yet.</p>
              ) : (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  {sitePhotos.filter(p => p.siteId === activeSiteId).slice(0, 2).map(photo => (
                    <div key={photo.id} style={{ border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)", overflow: "hidden", backgroundColor: "#fff" }}>
                      <div style={{ height: "100px" }}>
                        <img src={photo.imageUrl} alt="Inspection" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                      </div>
                      <div style={{ padding: "6px", fontSize: "10px" }}>
                        <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                          {photo.capturedAt?.seconds 
                            ? new Date(photo.capturedAt.seconds * 1000).toLocaleDateString()
                            : new Date(photo.capturedAt).toLocaleDateString()}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Card>

          </div>

        </div>
      )}

      {/* B) ATTENDANCE MODULE TAB (Daily Labour Attendance Tracking) */}
      {tab === "attendance" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          
          {/* Main Attendance Input */}
          <Card title="Labour Attendance Check-In" icon={ClipboardCheck} style={{ borderLeft: "5px solid var(--primary-600)" }}>
            <form onSubmit={handleSaveLabourCounts} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
              <div className="form-group">
                <label htmlFor="labour-date">Supervisor Check-In Date</label>
                <div className="input-wrapper">
                  <Calendar size={18} className="input-icon" />
                  <input 
                    type="date" 
                    id="labour-date" 
                    value={labourDate} 
                    onChange={(e) => setLabourDate(e.target.value)} 
                    required 
                  />
                </div>
              </div>

              <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
                <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase" }}>Today's Workers</span>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))", gap: "16px", marginTop: "4px" }}>
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
                    return (
                      <div key={cat} style={{
                        display: "flex",
                        flexDirection: "column",
                        justifyContent: "space-between",
                        gap: "12px",
                        padding: "16px",
                        backgroundColor: "#ffffff",
                        border: "1px solid var(--border-color)",
                        borderRadius: "12px",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.02)"
                      }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                          <span style={{ fontSize: "24px" }}>{emoji}</span>
                          <div>
                            <span style={{ fontWeight: "800", color: "var(--primary-900)", fontSize: "14px", display: "block" }}>{cat}</span>
                            <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Worker Category</span>
                          </div>
                        </div>
                        
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", backgroundColor: "var(--primary-50)", padding: "6px 12px", borderRadius: "8px", border: "1px solid var(--primary-100)" }}>
                          <button
                            type="button"
                            onClick={() => setCountsMap(prev => ({ ...prev, [cat]: Math.max(0, currentVal - 1) }))}
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              border: "1px solid var(--border-color)",
                              backgroundColor: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontWeight: "800",
                              color: "var(--danger-600)",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                              fontSize: "16px"
                            }}
                          >
                            <Minus size={14} />
                          </button>
                          
                          <input
                            type="number"
                            value={currentVal}
                            min="0"
                            onChange={(e) => {
                              const val = Math.max(0, parseInt(e.target.value) || 0);
                              setCountsMap(prev => ({ ...prev, [cat]: val }));
                            }}
                            style={{
                              width: "70px",
                              height: "32px",
                              textAlign: "center",
                              fontWeight: "800",
                              fontSize: "15px",
                              border: "none",
                              background: "transparent",
                              margin: 0,
                              outline: "none",
                              color: "var(--primary-950)"
                            }}
                          />

                          <button
                            type="button"
                            onClick={() => setCountsMap(prev => ({ ...prev, [cat]: currentVal + 1 }))}
                            style={{
                              width: "32px",
                              height: "32px",
                              borderRadius: "50%",
                              border: "1px solid var(--border-color)",
                              backgroundColor: "#ffffff",
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              cursor: "pointer",
                              fontWeight: "800",
                              color: "var(--success-600)",
                              boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                              fontSize: "16px"
                            }}
                          >
                            <Plus size={14} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Autocalculate Summary Box */}
              <div style={{
                padding: "16px",
                backgroundColor: "var(--primary-900)",
                color: "#ffffff",
                borderRadius: "12px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                boxShadow: "0 4px 6px -1px rgba(0,0,0,0.1)",
                marginTop: "16px",
                border: "1px solid var(--primary-950)"
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <Users size={20} style={{ color: "var(--accent-400)" }} />
                  <div>
                    <span style={{ fontSize: "14px", fontWeight: "700", display: "block" }}>Total Workers Present</span>
                    <span style={{ fontSize: "11px", opacity: 0.8 }}>Sum of all categories</span>
                  </div>
                </div>
                <strong style={{ fontSize: "20px", color: "var(--accent-400)" }}>
                  {Object.values(countsMap).reduce((sum, val) => sum + (val || 0), 0)} Workers
                </strong>
              </div>

              <Button type="submit" isLoading={labourSaving} icon={Save} style={{ width: "100%", padding: "12px", fontSize: "14px" }}>
                Save Daily Attendance Counts
              </Button>
            </form>
          </Card>

          {/* Historical Logs List */}
          <Card title="Attendance Counts History" icon={Clock}>
            {labourHistoryLoading ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "16px" }}>Syncing database logs...</p>
            ) : labourHistory.length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "16px" }}>No historical daily counts registered yet.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "10px", maxHeight: "400px", overflowY: "auto" }}>
                {labourHistory.map(row => (
                  <div key={row.date} style={{
                    padding: "12px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 2px rgba(0,0,0,0.02)"
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
                      <span className="font-mono" style={{ fontWeight: "700", color: "var(--primary-950)" }}>{row.date}</span>
                      <Badge status="success">{row.total} Workers</Badge>
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", fontSize: "11px" }}>
                      <span style={{ padding: "3px 6px", backgroundColor: "var(--primary-50)", borderRadius: "4px", color: "var(--primary-700)" }}>Masons: {row.Masons}</span>
                      <span style={{ padding: "3px 6px", backgroundColor: "var(--primary-50)", borderRadius: "4px", color: "var(--primary-700)" }}>Helpers: {row.Helpers}</span>
                      <span style={{ padding: "3px 6px", backgroundColor: "var(--primary-50)", borderRadius: "4px", color: "var(--primary-700)" }}>Others: {row.Others}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* C) LABOUR MANAGEMENT MODULE TAB */}
      {tab === "labour" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "24px" }}>
          
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
            
            {/* Add Labour Category Card */}
            <Card title="Add Labour Category" icon={Plus} style={{ borderLeft: "5px solid var(--accent-500)" }}>
              <form onSubmit={handleAddLabourCategory} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
                <div className="form-group">
                  <label htmlFor="new-category-input">New Category Name</label>
                  <div className="input-wrapper">
                    <Plus size={18} className="input-icon" />
                    <input 
                      type="text" 
                      id="new-category-input"
                      placeholder="E.g., Welder, Carpenter, Supervisor"
                      value={newCategoryName}
                      onChange={(e) => setNewCategoryName(e.target.value)}
                      required 
                    />
                  </div>
                </div>
                <Button type="submit" icon={Plus} style={{ width: "100%" }}>
                  Add Category Type
                </Button>
              </form>
            </Card>

            {/* Manage Labour Types */}
            <Card title="Manage Labour Types" icon={Sliders}>
              <p style={{ margin: "0 0 12px 0", fontSize: "12px", color: "var(--text-muted)" }}>
                Core system categories are locked. Custom added types can be removed below.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
                {categories.map(cat => {
                  const isCore = ["Mason", "Helper", "Electrician", "Plumber", "Painter", "Other"].includes(cat);
                  return (
                    <div key={cat} style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      padding: "8px 12px",
                      border: "1px solid var(--border-color)",
                      borderRadius: "var(--radius-sm)",
                      backgroundColor: isCore ? "var(--primary-50)" : "#ffffff"
                    }}>
                      <span style={{ fontSize: "13px", fontWeight: "600", color: "var(--primary-900)" }}>
                        {cat} {isCore && <span style={{ fontSize: "10px", color: "var(--text-muted)", marginLeft: "4px" }}>(Core)</span>}
                      </span>
                      {!isCore && (
                        <button 
                          type="button" 
                          onClick={() => handleDeleteLabourCategory(cat)}
                          style={{
                            background: "none",
                            border: "none",
                            color: "var(--danger-500)",
                            cursor: "pointer",
                            padding: "4px"
                          }}
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </Card>

          </div>

          {/* Today's Labour Summary Cards */}
          <Card title="Today's Labour Summary" icon={Users} variant="accent">
            <p style={{ margin: "0 0 16px 0", fontSize: "13px", color: "var(--text-muted)" }}>
              Detailed counts breakdown logged for <strong>{new Date().toISOString().split("T")[0]}</strong>.
            </p>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))", gap: "16px" }}>
              {categories.map(cat => {
                const count = countsMap[cat] || 0;
                return (
                  <div key={cat} style={{
                    padding: "16px",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    backgroundColor: "#ffffff",
                    textAlign: "center",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                    borderTop: "3px solid var(--primary-500)"
                  }}>
                    <span style={{ display: "block", fontSize: "11px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-muted)", marginBottom: "4px" }}>
                      {cat}
                    </span>
                    <strong style={{ fontSize: "22px", color: "var(--primary-950)" }}>
                      {count} <span style={{ fontSize: "12px", fontWeight: "normal", color: "var(--text-muted)" }}>Workers</span>
                    </strong>
                  </div>
                );
              })}
            </div>
          </Card>

        </div>
      )}

      {/* D) MATERIAL MANAGEMENT MODULE TAB */}
      {tab === "material" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
          
          {/* Add Material Log */}
          <Card title="Log Material Received" icon={Plus} style={{ borderLeft: "5px solid var(--accent-500)" }}>
            <form onSubmit={handleMaterialSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              <div className="form-group">
                <label>Material Category</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                  {["Cement", "Steel", "Sand", "Bricks", "Other"].map(catOption => (
                    <button
                      type="button"
                      key={catOption}
                      onClick={() => {
                        setMaterialCategory(catOption);
                        setMaterialName("");
                      }}
                      style={{
                        flex: "1 0 auto",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: materialCategory === catOption ? "2px solid var(--accent-600)" : "1px solid var(--border-color)",
                        backgroundColor: materialCategory === catOption ? "var(--accent-50)" : "#ffffff",
                        color: materialCategory === catOption ? "var(--accent-700)" : "var(--primary-800)",
                        fontWeight: "700",
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: materialCategory === catOption ? "0 2px 4px rgba(14, 165, 233, 0.1)" : "none"
                      }}
                    >
                      {catOption}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label>Unit</label>
                <div style={{ display: "flex", flexWrap: "wrap", gap: "8px", marginTop: "4px" }}>
                  {["Bag", "Kg", "Ton", "Load", "Pieces"].map(unitOption => (
                    <button
                      type="button"
                      key={unitOption}
                      onClick={() => setMaterialUnit(unitOption)}
                      style={{
                        flex: "1 0 auto",
                        padding: "10px 14px",
                        borderRadius: "8px",
                        border: materialUnit === unitOption ? "2px solid var(--accent-600)" : "1px solid var(--border-color)",
                        backgroundColor: materialUnit === unitOption ? "var(--accent-50)" : "#ffffff",
                        color: materialUnit === unitOption ? "var(--accent-700)" : "var(--primary-800)",
                        fontWeight: "700",
                        fontSize: "13px",
                        cursor: "pointer",
                        transition: "all var(--transition-fast)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        boxShadow: materialUnit === unitOption ? "0 2px 4px rgba(14, 165, 233, 0.1)" : "none"
                      }}
                    >
                      {unitOption}
                    </button>
                  ))}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="material-name">Material Name</label>
                <div className="input-wrapper">
                  <Package size={18} className="input-icon" />
                  <input 
                    type="text" 
                    id="material-name"
                    placeholder="Select Suggestion below or enter custom name..."
                    value={materialName}
                    onChange={(e) => setMaterialName(e.target.value)}
                    required 
                  />
                </div>
                
                {/* Suggestions list for Material Name */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                  {(categorySuggestions[materialCategory] || []).map(sug => (
                    <button
                      type="button"
                      key={sug}
                      onClick={() => setMaterialName(sug)}
                      style={{
                        padding: "4px 10px",
                        borderRadius: "16px",
                        border: "1px solid var(--border-color)",
                        backgroundColor: materialName === sug ? "var(--primary-100)" : "#ffffff",
                        color: materialName === sug ? "var(--primary-800)" : "var(--text-muted)",
                        fontSize: "11px",
                        fontWeight: "600",
                        cursor: "pointer",
                        transition: "all 0.2s"
                      }}
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: "flex", gap: "12px", alignItems: "flex-end" }}>
                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="material-quantity">Quantity</label>
                  <div style={{
                    display: "flex",
                    alignItems: "stretch",
                    borderRadius: "var(--radius-sm)",
                    border: "1px solid var(--border-color)",
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                    height: "42px",
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
                        borderRight: "1px solid var(--border-color)",
                        transition: "background var(--transition-fast)"
                      }}
                    >
                      -10
                    </button>
                    <input 
                      type="number" 
                      id="material-quantity"
                      placeholder="Qty"
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
                        fontSize: "15px",
                        fontWeight: "700",
                        color: "var(--primary-950)",
                        backgroundColor: "transparent",
                        margin: 0,
                        padding: 0,
                        boxShadow: "none"
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
                        borderLeft: "1px solid var(--border-color)",
                        transition: "background var(--transition-fast)"
                      }}
                    >
                      +10
                    </button>
                  </div>
                </div>

                <div className="form-group" style={{ flex: 1, margin: 0 }}>
                  <label htmlFor="material-date">Receipt Date</label>
                  <div className="input-wrapper" style={{ marginTop: "4px" }}>
                    <Calendar size={18} className="input-icon" />
                    <input 
                      type="date" 
                      id="material-date"
                      value={materialPurchaseDate}
                      onChange={(e) => setMaterialPurchaseDate(e.target.value)}
                      required 
                      style={{ height: "42px" }}
                    />
                  </div>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="material-supplier">Supplier Name</label>
                <div className="input-wrapper">
                  <Briefcase size={18} className="input-icon" />
                  <input 
                    type="text" 
                    id="material-supplier"
                    placeholder="Select suggestion or type..."
                    value={materialSupplier}
                    onChange={(e) => setMaterialSupplier(e.target.value)}
                    required 
                  />
                </div>
                
                {/* Supplier Suggestions */}
                <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "6px" }}>
                  {(() => {
                    const uniqueSuppliers = Array.from(new Set(materials.map(m => m.supplierName).filter(Boolean)));
                    const defaultSuppliers = ["UltraTech Suppliers Ltd", "TATA Steel Corp", "National Quarries", "City Brick Kiln Co."];
                    const list = Array.from(new Set([...uniqueSuppliers.slice(0, 2), ...defaultSuppliers])).slice(0, 4);
                    return list.map(sug => (
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
                    ));
                  })()}
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="material-notes">Notes (Optional)</label>
                <textarea 
                  id="material-notes"
                  placeholder="Inspection notes, challan number, etc..."
                  value={materialNotes}
                  onChange={(e) => setMaterialNotes(e.target.value)}
                  style={{ minHeight: "50px" }}
                />
              </div>

              <div className="form-group">
                <label>Upload Material Photo</label>
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
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-800)" }}>Choose or Capture Challan Photo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setMaterialInvoiceFile, setMaterialInvoicePreview)} />
                  </label>
                  {materialInvoiceFile && (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--success-600)", textAlign: "center" }}>
                      Selected: {materialInvoiceFile.name}
                    </span>
                  )}
                </div>
                {materialInvoicePreview && (
                  <div style={{ marginTop: "8px", position: "relative", width: "100px", height: "70px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={materialInvoicePreview} alt="Invoice preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setMaterialInvoiceFile(null); setMaterialInvoicePreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                  </div>
                )}
              </div>

              <Button type="submit" isLoading={materialSubmitting} icon={Save} style={{ width: "100%", marginTop: "4px" }}>
                Save Material Log
              </Button>
            </form>
          </Card>

          {/* Search & Filter Material History */}
          <Card title="Material Inventory History" icon={Package}>
            
            {/* Searching Filters */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", marginBottom: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", border: "1px solid var(--border-color)", padding: "4px 10px", borderRadius: "8px", backgroundColor: "#ffffff" }}>
                <Search size={16} style={{ color: "var(--text-muted)" }} />
                <input 
                  type="text" 
                  placeholder="Search item name, supplier, category..."
                  value={materialSearch}
                  onChange={(e) => setMaterialSearch(e.target.value)}
                  style={{ border: "none", outline: "none", width: "100%", fontSize: "13px", padding: "6px 0", margin: 0 }}
                />
              </div>
              
              <div className="form-group" style={{ margin: 0 }}>
                <label style={{ fontSize: "11px", fontWeight: "700" }}>Filter by Date</label>
                <input 
                  type="date" 
                  value={materialDateFilter} 
                  onChange={(e) => setMaterialDateFilter(e.target.value)} 
                />
                {materialDateFilter && (
                  <button 
                    type="button" 
                    onClick={() => setMaterialDateFilter("")}
                    style={{
                      background: "none",
                      border: "none",
                      color: "var(--danger-600)",
                      fontSize: "11px",
                      cursor: "pointer",
                      textDecoration: "underline",
                      padding: "4px 0",
                      alignSelf: "flex-start"
                    }}
                  >
                    Clear Date Filter
                  </button>
                )}
              </div>
            </div>

            {/* List of Deliveries */}
            <div style={{ display: "flex", flexDirection: "column", gap: "12px", maxHeight: "450px", overflowY: "auto" }}>
              {materials
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
                })
                .length === 0 ? (
                  <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                    No material delivery logs match current filters.
                  </p>
                ) : (
                  materials
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
                    })
                    .map(m => {
                      const getRelativeDateStr = (dateStr) => {
                        const today = new Date().toISOString().split("T")[0];
                        const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
                        if (dateStr === today) return "Today";
                        if (dateStr === yesterday) return "Yesterday";
                        return dateStr;
                      };
                      return (
                        <div key={m.id} style={{
                          padding: "16px",
                          border: "1px solid var(--border-color)",
                          borderRadius: "12px",
                          backgroundColor: "#ffffff",
                          boxShadow: "0 2px 4px rgba(0,0,0,0.02)",
                          display: "flex",
                          flexDirection: "column",
                          gap: "10px"
                        }}>
                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                            <div>
                              <span style={{ fontSize: "11px", fontWeight: "800", color: "var(--primary-700)", textTransform: "uppercase", letterSpacing: "0.5px" }}>
                                {m.category}
                              </span>
                              <strong style={{ display: "block", fontSize: "14px", color: "var(--primary-950)", marginTop: "2px" }}>
                                {m.materialName}
                              </strong>
                            </div>
                            <Badge status="success" style={{ padding: "6px 12px", borderRadius: "20px", fontWeight: "800", fontSize: "13px" }}>
                              {m.quantity} {m.unit}s
                            </Badge>
                          </div>

                          <hr style={{ border: 0, borderTop: "1px solid var(--border-color)", margin: 0 }} />

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "11px" }}>
                            <span style={{ color: "var(--text-muted)" }}>
                              Supplier: <strong style={{ color: "var(--primary-900)" }}>{m.supplierName}</strong>
                            </span>
                            <span style={{ fontWeight: "700", color: "var(--accent-600)" }}>
                              {getRelativeDateStr(m.purchaseDate)}
                            </span>
                          </div>

                          {m.notes && (
                            <div style={{ fontSize: "11px", color: "var(--text-muted)", backgroundColor: "var(--primary-50)", padding: "8px", borderRadius: "6px", fontStyle: "italic" }}>
                              "{m.notes}"
                            </div>
                          )}

                          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", color: "var(--text-muted)" }}>
                            <span>Added by {m.engineerName || "Site Engineer"}</span>
                            {m.invoiceUrl && (
                              <a href={m.invoiceUrl} target="_blank" rel="noopener noreferrer" style={{ color: "var(--accent-600)", fontWeight: "800", textDecoration: "underline" }}>
                                View Bill Photo
                              </a>
                            )}
                          </div>
                        </div>
                      );
                    })
                )}
            </div>
          </Card>
        </div>
      )}

      {/* E) SITE PHOTO MODULE TAB */}
      {tab === "photos" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "24px" }}>
          
          {/* Capture Site Photo */}
          <Card title="Capture Progress Photo" icon={Camera} style={{ borderLeft: "5px solid var(--primary-600)" }}>
            <form onSubmit={handlePhotoUpload} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <p style={{ margin: 0, fontSize: "12px", color: "var(--text-muted)" }}>
                Geotag and timestamp are recorded automatically.
              </p>
              
              <div className="form-group">
                <label>Site Picture Source</label>
                <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "4px" }}>
                  <label style={{ 
                    display: "flex", 
                    flexDirection: "column", 
                    alignItems: "center", 
                    gap: "6px", 
                    padding: "24px 16px", 
                    border: "2px dashed var(--border-color)", 
                    borderRadius: "8px", 
                    cursor: "pointer", 
                    backgroundColor: "var(--primary-50)" 
                  }}>
                    <Camera size={32} style={{ color: "var(--text-muted)" }} />
                    <span style={{ fontSize: "12px", fontWeight: "700", color: "var(--primary-800)" }}>Choose or Capture Photo</span>
                    <input 
                      type="file" 
                      accept="image/*" 
                      capture="environment" 
                      style={{ display: "none" }} 
                      onChange={(e) => handleFileChange(e, setSitePhotoFile, setSitePhotoPreview)} 
                    />
                  </label>
                  {sitePhotoFile && (
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--success-600)", textAlign: "center" }}>
                      Selected: {sitePhotoFile.name}
                    </span>
                  )}
                </div>

                {sitePhotoPreview && (
                  <div style={{ marginTop: "12px", position: "relative", width: "100%", height: "180px", borderRadius: "8px", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={sitePhotoPreview} alt="Site preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setSitePhotoFile(null); setSitePhotoPreview(null); }} style={{ position: "absolute", top: "8px", right: "8px", backgroundColor: "rgba(0,0,0,0.6)", color: "#fff", border: "none", borderRadius: "50%", width: "24px", height: "24px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={14} /></button>
                  </div>
                )}
              </div>

              <Button type="submit" isLoading={photoSubmitting} icon={Upload} disabled={!sitePhotoPreview} style={{ width: "100%" }}>
                Upload Geotagged Photo
              </Button>
            </form>
          </Card>

          {/* Photo Gallery Grid */}
          <Card title="Site Photos Gallery" icon={Camera}>
            {sitePhotos.filter(p => p.siteId === activeSiteId).length === 0 ? (
              <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "24px" }}>
                No site photos logged for this project yet.
              </p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", maxHeight: "450px", overflowY: "auto" }}>
                {sitePhotos.filter(p => p.siteId === activeSiteId).map(photo => (
                  <div key={photo.id} style={{
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    overflow: "hidden",
                    backgroundColor: "#ffffff",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.02)"
                  }}>
                    <a href={photo.imageUrl} target="_blank" rel="noopener noreferrer" style={{ display: "block", height: "110px" }}>
                      <img src={photo.imageUrl} alt="Progress inspection" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    </a>
                    <div style={{ padding: "8px", fontSize: "10px", display: "flex", flexDirection: "column", gap: "4px" }}>
                      <span className="font-mono" style={{ color: "var(--text-muted)" }}>
                        {photo.capturedAt?.seconds 
                          ? new Date(photo.capturedAt.seconds * 1000).toLocaleString()
                          : new Date(photo.capturedAt).toLocaleString()}
                      </span>
                      <span style={{ fontWeight: "700", color: "var(--accent-600)" }}>
                        GPS: {Number(photo.latitude).toFixed(5)}, {Number(photo.longitude).toFixed(5)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* F) DAILY PROGRESS MODULE TAB */}
      {tab === "progress" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(360px, 1fr))", gap: "24px" }}>
          
          {/* Submit progress updates */}
          <Card title="Log Daily Progress Updates" icon={Plus} style={{ borderLeft: "5px solid var(--primary-600)" }}>
            <form onSubmit={handleProgressSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              
              <div className="form-group">
                <label>Estimated Progress Completed</label>
                <div style={{ display: "flex", alignItems: "center", gap: "12px", marginTop: "4px" }}>
                  <input 
                    type="range" 
                    min="0" 
                    max="100" 
                    value={progressPercent}
                    onChange={(e) => setProgressPercent(Number(e.target.value))}
                    style={{ flexGrow: 1, accentColor: "var(--accent-500)", cursor: "pointer", height: "6px" }}
                  />
                  <span className="badge badge-success" style={{ fontWeight: 800, fontSize: "12px", minWidth: "46px", textAlign: "center" }}>
                    {progressPercent}%
                  </span>
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="work-completed">Work Completed Today</label>
                <textarea 
                  id="work-completed" 
                  placeholder="Describe pours completed, walls built, etc..."
                  value={workDescription}
                  onChange={(e) => setWorkDescription(e.target.value)}
                  required 
                  style={{ minHeight: "80px" }}
                />
              </div>

              <div className="form-group">
                <label htmlFor="issues-obstacles">Issues / Delay Obstacles</label>
                <input 
                  type="text" 
                  id="issues-obstacles"
                  placeholder="E.g. Material shortage, heavy rain delays..."
                  value={issuesText}
                  onChange={(e) => setIssuesText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label htmlFor="progress-notes">Notes / Special Instructions</label>
                <input 
                  type="text" 
                  id="progress-notes"
                  placeholder="E.g. Structural engineer inspected the footings..."
                  value={notesText}
                  onChange={(e) => setNotesText(e.target.value)}
                />
              </div>

              <div className="form-group">
                <label>Attach Work Photo (Optional)</label>
                <div style={{ display: "flex", gap: "12px", alignItems: "center", marginTop: "4px" }}>
                  <label style={{ cursor: "pointer", padding: "8px 12px", borderRadius: "var(--radius-sm)", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", gap: "6px", backgroundColor: "var(--primary-50)", fontSize: "11px", fontWeight: 700 }}>
                    <Camera size={14} />
                    <span>Choose Photo</span>
                    <input type="file" accept="image/*" style={{ display: "none" }} onChange={(e) => handleFileChange(e, setProgressPhotoFile, setProgressPhotoPreview)} />
                  </label>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", maxWidth: "160px" }}>
                    {progressPhotoFile ? progressPhotoFile.name : "No file attached"}
                  </span>
                </div>
                {progressPhotoPreview && (
                  <div style={{ marginTop: "8px", position: "relative", width: "100px", height: "70px", borderRadius: "var(--radius-sm)", overflow: "hidden", border: "1px solid var(--border-color)" }}>
                    <img src={progressPhotoPreview} alt="Work preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button type="button" onClick={() => { setProgressPhotoFile(null); setProgressPhotoPreview(null); }} style={{ position: "absolute", top: "2px", right: "2px", backgroundColor: "rgba(0,0,0,0.7)", color: "#fff", border: "none", borderRadius: "50%", width: "16px", height: "16px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer" }}><X size={10} /></button>
                  </div>
                )}
              </div>

              <Button type="submit" isLoading={progressSubmitting} icon={Save} style={{ width: "100%" }}>
                Submit Daily Progress Report
              </Button>
            </form>
          </Card>

          {/* Progress logs timeline */}
          <Card title="Progress Reports History" icon={FileText}>
            <div style={{ display: "flex", flexDirection: "column", gap: "16px", maxHeight: "450px", overflowY: "auto", paddingLeft: "10px" }}>
              {dailyUpdates.filter(u => u.siteId === activeSiteId).length === 0 ? (
                <p style={{ fontSize: "12px", color: "var(--text-muted)", textAlign: "center", padding: "24px 0" }}>
                  No reports logged for this project yet.
                </p>
              ) : (
                dailyUpdates.filter(u => u.siteId === activeSiteId).map((row) => {
                  // Parse description strings
                  const lines = row.description.split("\n\n");
                  const workLine = lines[0]?.replace("Work Completed: ", "") || row.description;
                  const issuesLine = lines[1]?.replace("Issues/Blockers: ", "");
                  const notesLine = lines[2]?.replace("Notes/Remarks: ", "");

                  return (
                    <div key={row.id} style={{
                      position: "relative",
                      paddingLeft: "20px",
                      borderLeft: "2px solid var(--primary-200)",
                      paddingBottom: "8px"
                    }}>
                      {/* Timeline dot */}
                      <div style={{
                        position: "absolute",
                        left: "-6px",
                        top: "4px",
                        width: "10px",
                        height: "10px",
                        borderRadius: "50%",
                        backgroundColor: "var(--primary-600)",
                        border: "2px solid #fff"
                      }} />
                      
                      <div style={{
                        padding: "12px",
                        backgroundColor: "var(--primary-50)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "8px",
                        boxShadow: "0 1px 2px rgba(0,0,0,0.01)"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
                          <span className="font-mono" style={{ fontSize: "11px", fontWeight: "700", color: "var(--primary-900)" }}>
                            {row.createdAt?.seconds 
                              ? new Date(row.createdAt.seconds * 1000).toLocaleDateString()
                              : new Date(row.createdAt).toLocaleDateString()}
                          </span>
                          <Badge status="success">{row.progress}</Badge>
                        </div>
                        
                        <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--primary-950)" }}>
                          <strong>Work Completed:</strong> {workLine}
                        </p>
                        
                        {issuesLine && issuesLine !== "None" && (
                          <p style={{ margin: "4px 0", fontSize: "12px", color: "var(--danger-700)" }}>
                            <strong>Issues:</strong> {issuesLine}
                          </p>
                        )}

                        {notesLine && notesLine !== "None" && (
                          <p style={{ margin: "4px 0", fontSize: "11px", color: "var(--text-muted)" }}>
                            <strong>Notes:</strong> {notesLine}
                          </p>
                        )}
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </Card>
        </div>
      )}

      <Loading show={loading} text="Synchronizing Worksite Database..." />
    </Layout>
  );
}

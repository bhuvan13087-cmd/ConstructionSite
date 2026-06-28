import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "../firebase/auth";
import { createUserProfile, getUserByEmail, getUserByPhone, resetUserPasswordInAuthEmulator } from "../services/firebaseService";
import { useAuth } from "../context/AuthContext";
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  KeyRound, 
  Users, 
  ClipboardCheck, 
  Package, 
  Camera, 
  Activity, 
  FileText, 
  ArrowRight, 
  MapPin, 
  Phone,
  CheckCircle,
  Building2,
  LockKeyhole,
  CheckCircle2,
  Shield,
  HelpCircle,
  Info,
  Eye,
  EyeOff
} from "lucide-react";
import CivilEngineerLogo from "../components/common/CivilEngineerLogo";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";

// Redesigned Civil Engineering Hero Illustration showing tower crane, blueprint, timeline, and geofence
const HeroVisual = () => (
  <svg width="500" height="460" viewBox="0 0 500 460" fill="none" xmlns="http://www.w3.org/2000/svg" className="landing-hero-visual-svg" style={{ overflow: "visible", maxWidth: "100%" }}>
    <defs>
      <linearGradient id="blueprintGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0ea5e9" stopOpacity="0.05" />
        <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.15" />
      </linearGradient>
      <linearGradient id="structureGrad" x1="0%" y1="100%" x2="0%" y2="0%">
        <stop offset="0%" stopColor="var(--accent-600, #0284c7)" stopOpacity="0.8" />
        <stop offset="100%" stopColor="var(--accent-400, #38bdf8)" stopOpacity="0.3" />
      </linearGradient>
      <linearGradient id="orangeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f97316" />
        <stop offset="100%" stopColor="#ea580c" />
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="4" result="blur" />
        <feComposite in="SourceGraphic" in2="blur" operator="over" />
      </filter>
    </defs>

    {/* Blueprint Sheet Background */}
    <rect x="10" y="10" width="480" height="440" rx="12" fill="url(#blueprintGrad)" stroke="rgba(14, 165, 233, 0.3)" strokeWidth="2" />
    
    {/* Architectural Blueprint Grid */}
    <g stroke="rgba(14, 165, 233, 0.12)" strokeWidth="1">
      <line x1="10" y1="50" x2="490" y2="50" />
      <line x1="10" y1="100" x2="490" y2="100" />
      <line x1="10" y1="150" x2="490" y2="150" />
      <line x1="10" y1="200" x2="490" y2="200" strokeWidth="1.5" stroke="rgba(14, 165, 233, 0.2)" />
      <line x1="10" y1="250" x2="490" y2="250" />
      <line x1="10" y1="300" x2="490" y2="300" />
      <line x1="10" y1="350" x2="490" y2="350" />
      <line x1="10" y1="400" x2="490" y2="400" strokeWidth="1.5" stroke="rgba(14, 165, 233, 0.2)" />
      
      <line x1="50" y1="10" x2="50" y2="450" />
      <line x1="100" y1="10" x2="100" y2="450" />
      <line x1="150" y1="10" x2="150" y2="450" />
      <line x1="200" y1="10" x2="200" y2="450" strokeWidth="1.5" stroke="rgba(14, 165, 233, 0.2)" />
      <line x1="250" y1="10" x2="250" y2="450" />
      <line x1="300" y1="10" x2="300" y2="450" />
      <line x1="350" y1="10" x2="350" y2="450" strokeWidth="1.5" stroke="rgba(14, 165, 233, 0.2)" />
      <line x1="400" y1="10" x2="400" y2="450" />
      <line x1="450" y1="10" x2="450" y2="450" />
    </g>

    {/* Measurement Ruler Markings */}
    <g stroke="rgba(14, 165, 233, 0.3)" strokeWidth="1">
      <path d="M 20 20 L 480 20" />
      <path d="M 20 20 L 20 440" />
      <path d="M 50 20 v 6 M 100 20 v 6 M 150 20 v 6 M 200 20 v 8 M 250 20 v 6 M 300 20 v 6 M 350 20 v 6 M 400 20 v 8 M 450 20 v 6" />
      <path d="M 20 50 h 6 M 20 100 h 6 M 20 150 h 6 M 20 200 h 8 M 20 250 h 6 M 20 300 h 6 M 20 350 h 6 M 20 400 h 8 M 20 450 h 6" />
    </g>
    
    {/* Drafting Compass Concept */}
    <g stroke="rgba(14, 165, 233, 0.15)" strokeWidth="1.5" fill="none" opacity="0.6">
      <circle cx="120" cy="180" r="60" strokeDasharray="4 4" />
      <line x1="120" y1="100" x2="120" y2="260" />
      <line x1="60" y1="180" x2="180" y2="180" />
    </g>

    {/* Building Structure Columns & Pillars */}
    <g fill="url(#structureGrad)">
      <rect x="230" y="240" width="40" height="170" rx="2" />
      <rect x="280" y="180" width="45" height="230" rx="2" />
      <rect x="335" y="110" width="50" height="300" rx="2" />
      <rect x="395" y="280" width="45" height="130" rx="2" />
    </g>
    
    {/* Wireframe Structural Lines */}
    <g stroke="#0ea5e9" strokeWidth="2" fill="none">
      <line x1="220" y1="410" x2="450" y2="410" strokeWidth="3" strokeLinecap="round" />
      <line x1="220" y1="350" x2="450" y2="350" />
      <line x1="220" y1="290" x2="450" y2="290" />
      <line x1="270" y1="230" x2="450" y2="230" />
      <line x1="270" y1="180" x2="450" y2="180" />
      <line x1="330" y1="110" x2="390" y2="110" />
      
      <line x1="230" y1="240" x2="230" y2="410" strokeDasharray="3 3" />
      <line x1="270" y1="240" x2="270" y2="410" />
      <line x1="325" y1="180" x2="325" y2="410" />
      <line x1="385" y1="110" x2="385" y2="410" />
      <line x1="440" y1="280" x2="440" y2="410" />
      
      {/* Cross Bracing */}
      <g stroke="rgba(14, 165, 233, 0.35)" strokeWidth="1.5">
        <line x1="280" y1="410" x2="325" y2="350" />
        <line x1="325" y1="410" x2="280" y2="350" />
        <line x1="280" y1="350" x2="325" y2="290" />
        <line x1="325" y1="350" x2="280" y2="290" />
        
        <line x1="335" y1="410" x2="385" y2="350" />
        <line x1="385" y1="410" x2="335" y2="350" />
        <line x1="335" y1="350" x2="385" y2="290" />
        <line x1="385" y1="350" x2="335" y2="290" />
        <line x1="335" y1="290" x2="385" y2="230" />
        <line x1="385" y1="290" x2="335" y2="230" />
        <line x1="335" y1="230" x2="385" y2="180" />
        <line x1="385" y1="230" x2="335" y2="180" />
        <line x1="335" y1="180" x2="385" y2="110" />
        <line x1="385" y1="180" x2="335" y2="110" />
      </g>
    </g>

    {/* Tower Crane (Transform Origin centered at mast slewing unit) */}
    <g className="blueprint-crane" stroke="#0ea5e9" strokeWidth="2.5" fill="none" style={{ transformOrigin: "180px 82px" }}>
      <line x1="180" y1="80" x2="180" y2="410" strokeWidth="3" />
      <g stroke="rgba(14, 165, 233, 0.5)" strokeWidth="1">
        <line x1="170" y1="80" x2="190" y2="80" />
        <line x1="170" y1="80" x2="170" y2="410" />
        <line x1="190" y1="80" x2="190" y2="410" />
        <line x1="170" y1="120" x2="190" y2="150" />
        <line x1="170" y1="150" x2="190" y2="120" />
        <line x1="170" y1="190" x2="190" y2="220" />
        <line x1="170" y1="220" x2="190" y2="190" />
        <line x1="170" y1="260" x2="190" y2="290" />
        <line x1="170" y1="290" x2="190" y2="260" />
        <line x1="170" y1="330" x2="190" y2="360" />
        <line x1="170" y1="360" x2="190" y2="330" />
      </g>
      
      <rect x="168" y="70" width="24" height="12" rx="1" fill="url(#orangeGrad)" stroke="none" />
      <circle cx="180" cy="76" r="3" fill="#fff" />
      <path d="M174 70 L180 30 L186 70" />
      
      <line x1="70" y1="82" x2="330" y2="82" strokeWidth="3" />
      <rect x="80" y="86" width="22" height="15" fill="var(--slate-600, #475569)" stroke="none" />
      
      <line x1="180" y1="30" x2="110" y2="82" strokeWidth="1.5" />
      <line x1="180" y1="30" x2="260" y2="82" strokeWidth="1.5" />
      
      <line x1="280" y1="82" x2="280" y2="190" stroke="#ea580c" strokeWidth="1.5" strokeDasharray="3" />
      <path d="M 276 190 L 280 196 L 284 190" stroke="#ea580c" strokeWidth="2" />
      
      <g filter="url(#glow)">
        <rect x="245" y="196" width="70" height="10" rx="1" fill="url(#orangeGrad)" stroke="none" />
        <line x1="250" y1="196" x2="280" y2="190" stroke="#ea580c" strokeWidth="1" />
        <line x1="310" y1="196" x2="280" y2="190" stroke="#ea580c" strokeWidth="1" />
      </g>
    </g>

    {/* Project Timeline Gantt Chart UI Card Overlay */}
    <g transform="translate(35, 270)">
      <rect x="0" y="0" width="165" height="110" rx="8" fill="#1e293b" fillOpacity="0.95" stroke="rgba(14, 165, 233, 0.4)" strokeWidth="1.5" />
      <text x="12" y="20" fill="#fff" fontSize="10" fontWeight="bold" fontFamily="sans-serif">PROJECT TIMELINE</text>
      <text x="12" y="32" fill="#0ea5e9" fontSize="8" fontFamily="sans-serif">Site B - Phase 3</text>
      
      <rect x="12" y="46" width="120" height="5" rx="2.5" fill="rgba(255,255,255,0.1)" />
      <rect x="12" y="46" width="120" height="5" rx="2.5" fill="#10b981" />
      <text x="12" y="42" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="sans-serif">Foundation: 100%</text>

      <rect x="12" y="66" width="120" height="5" rx="2.5" fill="rgba(255,255,255,0.1)" />
      <rect x="12" y="66" width="78" height="5" rx="2.5" fill="#f97316" />
      <text x="12" y="62" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="sans-serif">Framing Structure: 65%</text>

      <rect x="12" y="86" width="120" height="5" rx="2.5" fill="rgba(255,255,255,0.1)" />
      <rect x="12" y="86" width="18" height="5" rx="2.5" fill="#38bdf8" />
      <text x="12" y="82" fill="rgba(255,255,255,0.6)" fontSize="7" fontFamily="sans-serif">Electrical / Plumbing: 15%</text>
    </g>

    {/* GPS Geofenced Coordinates Verification Overlay */}
    <g transform="translate(280, 40)">
      <rect x="0" y="0" width="165" height="55" rx="8" fill="#1e293b" fillOpacity="0.95" stroke="rgba(249, 115, 22, 0.4)" strokeWidth="1.5" />
      <circle cx="18" cy="27" r="6" fill="#f97316" className="blueprint-pulse" />
      <circle cx="18" cy="27" r="2" fill="#fff" />
      <text x="32" y="22" fill="#fff" fontSize="9" fontWeight="bold" fontFamily="sans-serif">GEOFENCE SECURITY</text>
      <text x="32" y="34" fill="rgba(255,255,255,0.7)" fontSize="8" fontFamily="monospace">Radius: 200m Active</text>
      <text x="32" y="44" fill="#10b981" fontSize="8" fontFamily="monospace">Status: Auto-Verified</text>
    </g>

    {/* Pulsing blueprint node connections */}
    <g fill="#f97316">
      <circle cx="335" cy="110" r="4.5" className="blueprint-pulse" />
      <circle cx="385" cy="110" r="4.5" className="blueprint-pulse" style={{ animationDelay: "0.5s" }} />
      <circle cx="280" cy="180" r="4.5" className="blueprint-pulse" style={{ animationDelay: "1s" }} />
      
      <circle cx="335" cy="110" r="9" stroke="#f97316" strokeWidth="1" opacity="0.4" fill="none" />
      <circle cx="280" cy="180" r="9" stroke="#f97316" strokeWidth="1" opacity="0.4" fill="none" />
    </g>
  </svg>
);

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isLoginModalOpen, setIsLoginModalOpen] = useState(false);
  
  // Forgot Password / OTP States
  const [loginView, setLoginView] = useState("login"); // "login", "forgotPassword", "verifyOtp", "resetPassword"
  const [forgotEmail, setForgotEmail] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [enteredOtp, setEnteredOtp] = useState("");
  const [otpError, setOtpError] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmNewPassword, setConfirmNewPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmNewPassword, setShowConfirmNewPassword] = useState(false);
  const [resetUserId, setResetUserId] = useState("");
  const [resetUserPhone, setResetUserPhone] = useState("");
  const [resetSuccess, setResetSuccess] = useState("");
  
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading) {
      if (user && userProfile) {
        if (userProfile.status !== "active") {
          setError("Account is inactive.");
          setLoading(false);
        } else if (userProfile.role === "super_admin" || userProfile.role === "superadmin") {
          navigate("/superadmin");
        } else if (userProfile.role === "admin") {
          navigate("/admin");
        } else if (userProfile.role === "site_engineer" || userProfile.role === "engineer") {
          navigate("/engineer");
        } else {
          setError("Access denied. Unauthorized role.");
          setLoading(false);
        }
      } else if (user && !userProfile) {
        setError("Database record not found.");
        setLoading(false);
      } else {
        setLoading(false);
      }
    }
  }, [user, userProfile, authLoading, navigate]);

  const openLoginModal = () => {
    setError("");
    setShowPassword(false);
    setLoginView("login");
    setForgotEmail("");
    setOtpCode("");
    setEnteredOtp("");
    setOtpError("");
    setNewPassword("");
    setConfirmNewPassword("");
    setShowNewPassword(false);
    setShowConfirmNewPassword(false);
    setResetUserId("");
    setResetUserPhone("");
    setResetSuccess("");
    setIsLoginModalOpen(true);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      localStorage.setItem("is_session_active", "true");
      await signIn(email.trim(), password);
    } catch (err) {
      // If sign-in fails, check if we need to auto-create the default admin account
      if (email.trim() === "admin@gmail.com" && password === "123456") {
        try {
          localStorage.setItem("is_session_active", "true");
          const userCredential = await signUp(email.trim(), password);
          const user = userCredential.user;

          // Write admin profile document
          await createUserProfile(user.uid, {
            fullName: "Admin User",
            username: "admin",
            role: "admin",
            status: "active",
            email: email.trim(),
            isFirstLogin: false
          });
          return;
        } catch (createErr) {
          localStorage.removeItem("is_session_active");
          console.error("Auto-provisioning failed:", createErr);
          if (createErr.code === "auth/email-already-in-use") {
            setError("Incorrect password");
          } else {
            setError(createErr.message);
          }
          setLoading(false);
          return;
        }
      }

      localStorage.removeItem("is_session_active");
      console.error("Login Error:", err);
      let userFriendlyMsg = "Login failed. Please try again.";
      if (err.code === "auth/wrong-password" || err.code === "auth/invalid-credential") {
        userFriendlyMsg = "Incorrect password";
      } else if (err.code === "auth/user-not-found" || err.code === "auth/invalid-email") {
        userFriendlyMsg = "Account not found";
      } else if (err.code === "auth/network-request-failed") {
        userFriendlyMsg = "Connection failed";
      } else {
        userFriendlyMsg = err.message;
      }
      setError(userFriendlyMsg);
      setLoading(false);
    }
  };

  // Forgot Password Flow Handlers
  const handleForgotPasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const inputVal = forgotEmail.trim();
      let profile = null;
      if (inputVal.includes("@")) {
        profile = await getUserByEmail(inputVal);
        if (!profile) {
          throw new Error("No engineer profile found with this corporate email address.");
        }
      } else {
        profile = await getUserByPhone(inputVal);
        if (!profile) {
          throw new Error("No engineer profile found with this registered phone number.");
        }
      }
      
      if (profile.role !== "site_engineer" && profile.role !== "engineer") {
        throw new Error("Only site engineer accounts can perform password self-reset.");
      }
      if (profile.status !== "active") {
        throw new Error("This account is inactive. Please contact the administrator.");
      }

      // Generate OTP and save info
      const code = Math.floor(100000 + Math.random() * 900000).toString();
      setOtpCode(code);
      setResetUserId(profile.uid || profile.id);
      setResetUserPhone(profile.phoneNumber || "No phone number registered");
      setLoginView("verifyOtp");
      setEnteredOtp("");
      setOtpError("");
      
      console.log(`[Simulated SMS/Email Gateway] OTP Code: ${code}`);
    } catch (err) {
      console.error("Forgot password request failed:", err);
      setError(err.message || "Failed to process forgot password request.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtpSubmit = (e) => {
    e.preventDefault();
    setOtpError("");

    if (enteredOtp === otpCode && otpCode !== "") {
      setLoginView("resetPassword");
      setError("");
    } else {
      setOtpError("Incorrect 6-digit verification code. Please try again.");
    }
  };

  const handleResetPasswordSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setResetSuccess("");

    if (newPassword.length < 6) {
      setError("New password must be at least 6 characters.");
      return;
    }
    if (newPassword !== confirmNewPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    try {
      // 1. Update Auth password via emulator API
      await resetUserPasswordInAuthEmulator(resetUserId, newPassword);

      // 2. Clear Firestore password field if any was stored
      await updateEngineerPasswordInDb(resetUserId, newPassword);

      setResetSuccess("Password reset completed successfully!");
      setNewPassword("");
      setConfirmNewPassword("");
      
      // Navigate back to login view after 3 seconds
      setTimeout(() => {
        setLoginView("login");
        setResetSuccess("");
        // Auto fill email field
        setEmail(forgotEmail);
      }, 3000);
    } catch (err) {
      console.error("Reset password failed:", err);
      setError(err.message || "Failed to complete password reset.");
    } finally {
      setLoading(false);
    }
  };

  const handleSmoothScroll = (e, targetId) => {
    e.preventDefault();
    const element = document.getElementById(targetId);
    if (element) {
      const offset = 80; // height of the sticky header
      const bodyRect = document.body.getBoundingClientRect().top;
      const elementRect = element.getBoundingClientRect().top;
      const elementPosition = elementRect - bodyRect;
      const offsetPosition = elementPosition - offset;
      
      window.scrollTo({
        top: offsetPosition,
        behavior: "smooth"
      });
    }
  };

  const featuresList = [
    {
      icon: Building2,
      title: "Site Management",
      desc: "Register construction sites, define boundaries, configure localized details, and monitor real-time completion status."
    },
    {
      icon: Users,
      title: "Labour Attendance Tracking",
      desc: "Supervise field workforces with granular categorizations. Mark headcounts for masons, helpers, electricians, painters, and custom trades."
    },
    {
      icon: Package,
      title: "Material Management",
      desc: "Document material supply deliveries, supplier invoices, categories, exact quantities, and keep photographic record of bills."
    },
    {
      icon: ClipboardCheck,
      title: "Daily Site Updates",
      desc: "Record site operations, current completed percentages, critical blockers, and operational notes directly from the ground."
    },
    {
      icon: Camera,
      title: "Geo-Tagged Site Photos",
      desc: "Capture construction progress verified with automatic geolocation coordinates (GPS Geofencing) and server timestamp tracking."
    },
    {
      icon: Activity,
      title: "Engineer Monitoring",
      desc: "Admin oversight over site allocations. Monitor site-engineer login events, profile status, and overall field activity."
    },
    {
      icon: FileText,
      title: "Reports & Audits",
      desc: "Generate comprehensive logs for material ledger records and labour workforce historical audit charts."
    },
    {
      icon: Shield,
      title: "Geofence Verification",
      desc: "Secure operations by enforcing that check-ins and photos occur within the designated worksite radius."
    },
    {
      icon: Info,
      title: "Offline Resilience",
      desc: "View database connection alerts and sync field updates reliably, designed to handle site connectivity issues."
    }
  ];

  return (
    <div className="landing-page-container">
      {/* Sticky Header Navbar */}
      <header className="landing-navbar">
        <a href="#home" onClick={(e) => handleSmoothScroll(e, "home")} className="landing-brand">
          <CivilEngineerLogo size={32} className="landing-brand-icon" />
          <span>Apex Build</span>
        </a>
        <nav>
          <ul className="landing-nav-links">
            <li><a href="#home" onClick={(e) => handleSmoothScroll(e, "home")} className="landing-nav-link">Home</a></li>
            <li><a href="#features" onClick={(e) => handleSmoothScroll(e, "features")} className="landing-nav-link">Features</a></li>
            <li><a href="#about" onClick={(e) => handleSmoothScroll(e, "about")} className="landing-nav-link">About</a></li>
            <li><a href="#contact" onClick={(e) => handleSmoothScroll(e, "contact")} className="landing-nav-link">Contact</a></li>
          </ul>
        </nav>
        <div className="landing-nav-actions">
          <Button 
            variant="outline" 
            size="sm" 
            onClick={openLoginModal}
            id="nav-login-btn"
            className="landing-nav-login-btn"
          >
            Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section id="home" className="landing-hero">
        <div className="landing-hero-content">
          <span className="landing-hero-tag">Enterprise Platform</span>
          <h1 className="landing-hero-title">
            Complete Construction <span>Site Management</span> Platform
          </h1>
          <p className="landing-hero-subtitle">
            Manage sites, workforce, materials, attendance and daily progress from one powerful, secure civil engineering command system.
          </p>
          <div className="landing-hero-buttons">
            <Button variant="primary" size="lg" onClick={openLoginModal} id="hero-login-btn" className="landing-hero-login-btn">
               Login to Console
            </Button>
            <Button variant="outline" size="lg" onClick={(e) => handleSmoothScroll(e, "features")} id="hero-explore-btn" className="landing-hero-explore-btn">
               Explore Features
            </Button>
          </div>
        </div>
        <div className="landing-hero-visual">
          <HeroVisual />
        </div>
      </section>

      {/* Stats Section */}
      <section className="landing-stats">
        <div className="landing-stats-grid">
          <div className="landing-stat-card">
            <div className="landing-stat-number">150<span>+</span></div>
            <div className="landing-stat-label">Active Projects</div>
          </div>
          <div className="landing-stat-card">
            <div className="landing-stat-number">5,000<span>+</span></div>
            <div className="landing-stat-label">Workforce Managed</div>
          </div>
          <div className="landing-stat-card">
            <div className="landing-stat-number">12k<span>+</span></div>
            <div className="landing-stat-label">Material Logs</div>
          </div>
          <div className="landing-stat-card">
            <div className="landing-stat-number">99.9<span>%</span></div>
            <div className="landing-stat-label">System Uptime</div>
          </div>
        </div>
      </section>

      {/* Features Grid Section */}
      <section id="features" className="landing-section" style={{ borderBottom: "1px solid var(--border-color)" }}>
        <div className="landing-section-header">
          <span className="landing-section-tag">Capabilities</span>
          <h2 className="landing-section-title">Built for Civil Infrastructure</h2>
          <p className="landing-section-subtitle">
            A comprehensive suite of tools designed to synchronize offices and sites, minimizing resource delays and keeping projects on budget.
          </p>
        </div>
        <div className="landing-features-grid">
          {featuresList.map((feat, idx) => {
            const IconComponent = feat.icon;
            return (
              <div key={idx} className="landing-feature-card">
                <div className="landing-feature-icon">
                  <IconComponent size={24} />
                </div>
                <h3 className="landing-feature-title">{feat.title}</h3>
                <p className="landing-feature-desc">{feat.desc}</p>
              </div>
            );
          })}
        </div>
      </section>

      {/* About Section */}
      <section id="about" className="landing-section" style={{ borderBottom: "1px solid var(--border-color)" }}>
        <div className="landing-about-wrapper">
          <div className="landing-about-content">
            <span className="landing-section-tag">About Apex Group</span>
            <h2 className="landing-section-title" style={{ textAlign: "left" }}>Pioneering Infrastructure Digitization</h2>
            <p className="landing-section-subtitle" style={{ margin: "0", textAlign: "left" }}>
              Apex Construction Group is a leading provider of civil engineering and heavy infrastructure works. Our software platform enables project managers, administrators, and site engineers to collaborate transparently on site progress.
            </p>
            <p className="landing-section-subtitle" style={{ margin: "0", textAlign: "left", fontSize: "14px" }}>
              By centralizing labour logs, inventory arrivals, and geo-tagged inspectorial photos, we eliminate coordinate bottlenecks and ensure regulatory accountability across all our building zones.
            </p>
          </div>
          <div className="landing-about-visual">
            <div className="landing-about-visual-blueprint"></div>
            <p className="landing-about-quote">
              "We don't just build skyscrapers and highways; we build the digital infrastructure that guarantees their safety and efficiency."
            </p>
            <div className="landing-about-author">
              Marcus Vance
              <span className="landing-about-title">VP of Operations, Apex Build</span>
            </div>
          </div>
        </div>
      </section>

      {/* Contact Section */}
      <section id="contact" className="landing-section">
        <div className="landing-section-header">
          <span className="landing-section-tag">Support Desk</span>
          <h2 className="landing-section-title">Get in Touch</h2>
          <p className="landing-section-subtitle">
            Have questions about site allocations or corporate access? Contact our systems administrator.
          </p>
        </div>
        <div className="landing-contact-wrapper">
          <div className="landing-contact-info">
            <div className="landing-contact-item">
              <div className="landing-contact-icon">
                <MapPin size={20} />
              </div>
              <div className="landing-contact-details">
                <h4>Corporate HQ</h4>
                <p>100 Construction Plaza, Midtown Manhattan, New York, NY</p>
              </div>
            </div>
            <div className="landing-contact-item">
              <div className="landing-contact-icon">
                <Phone size={20} />
              </div>
              <div className="landing-contact-details">
                <h4>System Integration Support</h4>
                <p>+1 (800) 555-0199 (Mon-Fri, 9AM - 6PM EST)</p>
              </div>
            </div>
            <div className="landing-contact-item">
              <div className="landing-contact-icon">
                <Mail size={20} />
              </div>
              <div className="landing-contact-details">
                <h4>Administrator Email</h4>
                <p>support@apexconstruction.com</p>
              </div>
            </div>
          </div>

          <form className="landing-contact-form" onSubmit={(e) => { e.preventDefault(); alert("Enterprise contact query simulated. Thank you!"); }}>
            <div className="landing-contact-form-group">
              <label htmlFor="contact-name" className="landing-contact-label">Full Name</label>
              <input type="text" id="contact-name" placeholder="John Doe" required className="landing-contact-input" />
            </div>
            <div className="landing-contact-form-group">
              <label htmlFor="contact-email" className="landing-contact-label">Corporate Email</label>
              <input type="email" id="contact-email" placeholder="j.doe@apex.com" required className="landing-contact-input" />
            </div>
            <div className="landing-contact-form-group">
              <label htmlFor="contact-message" className="landing-contact-label">Message Details</label>
              <textarea id="contact-message" placeholder="Describe your inquiry..." rows={4} required className="landing-contact-textarea"></textarea>
            </div>
            <Button variant="primary" type="submit" className="landing-contact-submit-btn">
              Send Inquiry
            </Button>
          </form>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="landing-footer-grid">
          <div className="landing-footer-brand">
            <a href="#home" onClick={(e) => handleSmoothScroll(e, "home")} className="landing-brand" style={{ color: "var(--primary-900)" }}>
              <CivilEngineerLogo size={28} className="landing-brand-icon" />
              <span>Apex Build</span>
            </a>
            <p style={{ fontSize: "13px", lineHeight: "1.5" }}>
              Digital engineering control systems for scale constructions.
            </p>
          </div>
          <div className="landing-footer-col">
            <h4>Solutions</h4>
            <ul className="landing-footer-links">
              <li><a href="#features" onClick={(e) => handleSmoothScroll(e, "features")}>Site Auditing</a></li>
              <li><a href="#features" onClick={(e) => handleSmoothScroll(e, "features")}>Labour Verification</a></li>
              <li><a href="#features" onClick={(e) => handleSmoothScroll(e, "features")}>Supply Chain Logs</a></li>
            </ul>
          </div>
          <div className="landing-footer-col">
            <h4>Quick Links</h4>
            <ul className="landing-footer-links">
              <li><a href="#home" onClick={(e) => handleSmoothScroll(e, "home")}>Home Page</a></li>
              <li><a href="#features" onClick={(e) => handleSmoothScroll(e, "features")}>Platform Features</a></li>
              <li><a href="#about" onClick={(e) => handleSmoothScroll(e, "about")}>About Apex Group</a></li>
            </ul>
          </div>
          <div className="landing-footer-col">
            <h4>Control Terminals</h4>
            <ul className="landing-footer-links">
              <li><a href="#login" onClick={(e) => { e.preventDefault(); openLoginModal(); }}>Admin Console</a></li>
              <li><a href="#login" onClick={(e) => { e.preventDefault(); openLoginModal(); }}>Engineer Dashboard</a></li>
            </ul>
          </div>
        </div>
        <div className="landing-footer-bottom">
          <span>&copy; {new Date().getFullYear()} Apex Construction Group. All rights reserved.</span>
          <span>Security Level: Enterprise Grade Encrypted</span>
        </div>
      </footer>

      <Modal
        isOpen={isLoginModalOpen}
        onClose={() => {
          setIsLoginModalOpen(false);
          setShowPassword(false);
          setLoginView("login");
          setError("");
        }}
        closeOnOverlayClick={false}
        title={
          loginView === "login" 
            ? "Apex Console Login" 
            : loginView === "forgotPassword" 
              ? "Recover Credentials" 
              : loginView === "verifyOtp"
                ? "Verify Mobile OTP"
                : "Reset Account Password"
        }
        maxWidth="440px"
        className="modal-overlay login-modal-overlay"
      >
        <div className="login-modal-container">
          {/* Saas-style construction header */}
          <div className="login-header">
            <div className="login-logo-badge">
              <CivilEngineerLogo size={28} className="login-logo-icon" />
            </div>
            <h3 className="login-title">
              {loginView === "login" && "Welcome to Apex Console"}
              {loginView === "forgotPassword" && "Forgot Password"}
              {loginView === "verifyOtp" && "Enter Verification Code"}
              {loginView === "resetPassword" && "Create New Password"}
            </h3>
            <p className="login-subtitle">
              {loginView === "login" && "Provide your credentials to manage or verify construction site operations."}
              {loginView === "forgotPassword" && "Provide your registered corporate email to receive a mobile verification code."}
              {loginView === "verifyOtp" && `A simulated SMS verification code has been dispatched to ${resetUserPhone}.`}
              {loginView === "resetPassword" && "Set a new secure password for your site engineer account."}
            </p>
          </div>

          {error && (
            <div className="login-error-alert">
              <Info size={18} className="login-error-icon" />
              <div className="login-error-content">
                <span className="login-error-title">Authorization Failed</span>
                <span className="login-error-message">{error}</span>
              </div>
            </div>
          )}

          {resetSuccess && (
            <div className="info-alert" style={{ borderLeft: "4px solid var(--success-500)", backgroundColor: "var(--success-50)", padding: "12px", borderRadius: "8px", display: "flex", gap: "10px", alignItems: "center", marginBottom: "16px" }}>
              <CheckCircle2 size={18} style={{ color: "var(--success-600)", flexShrink: 0 }} />
              <span style={{ color: "var(--success-700)", fontSize: "13px", fontWeight: "600" }}>{resetSuccess}</span>
            </div>
          )}

          {loginView === "login" && (
            <form onSubmit={handleSubmit} className="login-form-content">
              <div className="login-form-group">
                <label htmlFor="modal-email" className="login-field-label">Corporate Email Address</label>
                <div className="login-input-wrapper">
                  <Mail className="login-input-icon" size={18} />
                  <input
                    type="email"
                    id="modal-email"
                    className="login-input-field"
                    placeholder="admin@gmail.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>

              <div className="login-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                  <label htmlFor="modal-password" className="login-field-label" style={{ margin: 0 }}>Security Password</label>
                  <button
                    type="button"
                    onClick={() => {
                      setLoginView("forgotPassword");
                      setError("");
                    }}
                    style={{ background: "none", border: "none", color: "var(--primary-600)", fontSize: "12px", fontWeight: "600", cursor: "pointer", padding: 0 }}
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="login-input-wrapper">
                  <Lock className="login-input-icon" size={18} />
                  <input
                    type={showPassword ? "text" : "password"}
                    id="modal-password"
                    className="login-input-field password-field"
                    placeholder="••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="login-password-toggle-btn"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                id="btn-login-submit" 
                icon={KeyRound} 
                isLoading={loading}
                className="login-submit-btn"
              >
                {loading ? "Authenticating Credentials..." : "Authorize & Sign In"}
              </Button>
            </form>
          )}

          {loginView === "forgotPassword" && (
            <form onSubmit={handleForgotPasswordSubmit} className="login-form-content">
              <div className="login-form-group">
                <label htmlFor="forgot-email" className="login-field-label">Corporate Email or Phone Number</label>
                <div className="login-input-wrapper">
                  <Mail className="login-input-icon" size={18} />
                  <input
                    type="text"
                    id="forgot-email"
                    className="login-input-field"
                    placeholder="engineer@example.com or +91 9876543210"
                    value={forgotEmail}
                    onChange={(e) => setForgotEmail(e.target.value)}
                    required
                  />
                </div>
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setLoginView("login");
                    setError("");
                  }}
                  style={{ flex: 1 }}
                >
                  Cancel
                </Button>
                <Button 
                  type="submit" 
                  isLoading={loading}
                  style={{ flex: 1.5 }}
                >
                  Send OTP Code
                </Button>
              </div>
            </form>
          )}

          {loginView === "verifyOtp" && (
            <form onSubmit={handleVerifyOtpSubmit} className="login-form-content">
              {/* Simulated SMS Banner */}
              <div className="simulated-sms-banner" style={{ display: "flex", alignItems: "center", gap: "10px", padding: "12px", backgroundColor: "var(--primary-50)", border: "1px solid var(--primary-200)", borderRadius: "8px", marginBottom: "16px" }}>
                <Mail className="sms-icon" size={18} style={{ color: "var(--primary-600)" }} />
                <div className="sms-content" style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
                  <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>[Simulated SMS Gateway] Code dispatched:</span>
                  <strong className="sms-code" style={{ fontSize: "14px", color: "var(--primary-900)", fontFamily: "monospace", letterSpacing: "1px" }}>{otpCode}</strong>
                </div>
              </div>

              {otpError && (
                <div className="info-alert" style={{ borderLeft: "4px solid var(--danger-500)", backgroundColor: "var(--danger-50)", padding: "10px", borderRadius: "6px", marginBottom: "16px" }}>
                  <span style={{ color: "var(--danger-600)", fontSize: "12px", fontWeight: "600" }}>{otpError}</span>
                </div>
              )}

              <div className="login-form-group">
                <label htmlFor="entered-otp" className="login-field-label">Enter 6-Digit OTP</label>
                <input
                  type="text"
                  id="entered-otp"
                  className="login-input-field font-mono"
                  placeholder="000000"
                  maxLength={6}
                  value={enteredOtp}
                  onChange={(e) => setEnteredOtp(e.target.value.replace(/\D/g, ""))}
                  required
                  autoFocus
                  style={{ textAlign: "center", fontSize: "18px", letterSpacing: "4px" }}
                />
              </div>

              <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
                <Button 
                  type="button" 
                  variant="outline"
                  onClick={() => {
                    setLoginView("forgotPassword");
                    setError("");
                  }}
                  style={{ flex: 1 }}
                >
                  Back
                </Button>
                <Button 
                  type="submit" 
                  style={{ flex: 1.5 }}
                >
                  Verify Code
                </Button>
              </div>
            </form>
          )}

          {loginView === "resetPassword" && (
            <form onSubmit={handleResetPasswordSubmit} className="login-form-content">
              <div className="login-form-group">
                <label htmlFor="new-reset-password" className="login-field-label">New Password (min 6 chars)</label>
                <div className="login-input-wrapper">
                  <Lock className="login-input-icon" size={18} />
                  <input
                    type={showNewPassword ? "text" : "password"}
                    id="new-reset-password"
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
                  >
                    {showNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <div className="login-form-group">
                <label htmlFor="confirm-reset-password" className="login-field-label">Confirm New Password</label>
                <div className="login-input-wrapper">
                  <Lock className="login-input-icon" size={18} />
                  <input
                    type={showConfirmNewPassword ? "text" : "password"}
                    id="confirm-reset-password"
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
                  >
                    {showConfirmNewPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                  </button>
                </div>
              </div>

              <Button 
                type="submit" 
                isLoading={loading}
                className="login-submit-btn"
              >
                Reset Password & Login
              </Button>
            </form>
          )}
        </div>
      </Modal>

      {/* Global overlay loading spinner during routing transitions */}
      <Loading show={loading} text="Authorizing..." />
    </div>
  );
}

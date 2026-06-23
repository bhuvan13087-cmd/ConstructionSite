import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "../firebase/auth";
import { createUserProfile } from "../services/firebaseService";
import { useAuth } from "../context/AuthContext";
import { 
  ShieldCheck, 
  Mail, 
  Lock, 
  KeyRound, 
  HardHat, 
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
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";
import Modal from "../components/common/Modal";

// Interactive Animated SVG Hero Visual representing a construction structure & crane
const HeroVisual = () => (
  <svg width="480" height="420" viewBox="0 0 500 500" fill="none" xmlns="http://www.w3.org/2000/svg" className="landing-hero-visual-svg" style={{ overflow: "visible", maxWidth: "100%" }}>
    {/* Blueprint structural background grid */}
    <g stroke="rgba(14, 165, 233, 0.15)" strokeWidth="1">
      <line x1="50" y1="450" x2="450" y2="450" />
      <line x1="100" y1="50" x2="100" y2="450" strokeDasharray="3" />
      <line x1="200" y1="50" x2="200" y2="450" strokeDasharray="3" />
      <line x1="300" y1="50" x2="300" y2="450" strokeDasharray="3" />
      <line x1="400" y1="50" x2="400" y2="450" strokeDasharray="3" />
      <line x1="50" y1="100" x2="450" y2="100" strokeDasharray="3" />
      <line x1="50" y1="200" x2="450" y2="200" strokeDasharray="3" />
      <line x1="50" y1="300" x2="450" y2="300" strokeDasharray="3" />
      <line x1="50" y1="400" x2="450" y2="400" strokeDasharray="3" />
    </g>
    
    {/* Skyscraper scaffolding outline */}
    <g stroke="rgba(249, 115, 22, 0.7)" strokeWidth="2.5" fill="none" className="blueprint-scaffold">
      <rect x="160" y="160" width="180" height="290" rx="4" />
      <rect x="190" y="90" width="120" height="70" rx="2" />
      
      {/* Structural Cross beams (bracing) */}
      <line x1="160" y1="160" x2="340" y2="450" />
      <line x1="340" y1="160" x2="160" y2="450" />
      <line x1="190" y1="90" x2="310" y2="160" />
      <line x1="310" y1="90" x2="190" y2="160" />
      
      {/* Floor levels */}
      <line x1="160" y1="250" x2="340" y2="250" />
      <line x1="160" y1="350" x2="340" y2="350" />
    </g>

    {/* Dynamic Construction Crane */}
    <g className="blueprint-crane" stroke="#0ea5e9" strokeWidth="2.5" fill="none">
      {/* Vertical Mast */}
      <line x1="100" y1="120" x2="100" y2="450" />
      <line x1="90" y1="120" x2="110" y2="120" />
      <line x1="100" y1="120" x2="75" y2="450" strokeDasharray="4" opacity="0.4" />
      
      {/* Horizontal Jib */}
      <line x1="25" y1="140" x2="280" y2="140" />
      <line x1="100" y1="120" x2="25" y2="140" />
      <line x1="100" y1="120" x2="200" y2="140" />
      
      {/* Hook trolley lines */}
      <line x1="240" y1="140" x2="240" y2="240" stroke="#f97316" strokeWidth="1.5" strokeDasharray="3" />
      <circle cx="240" cy="243" r="4.5" fill="#f97316" className="blueprint-pulse" />
    </g>

    {/* Construction node intersection points */}
    <g fill="#f97316">
      <circle cx="160" y="160" r="4" />
      <circle cx="340" y="160" r="4" />
      <circle cx="160" y="450" r="4.5" />
      <circle cx="340" y="450" r="4.5" />
      <circle cx="190" y="90" r="3.5" className="blueprint-pulse" style={{ animationDelay: "0.4s" }} />
      <circle cx="310" y="90" r="3.5" className="blueprint-pulse" style={{ animationDelay: "0.8s" }} />
      <circle cx="250" cy="300" r="5" className="blueprint-pulse" style={{ fill: "#0ea5e9" }} />
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
  
  const { user, userProfile, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!authLoading) {
      if (user && userProfile) {
        if (userProfile.status !== "active") {
          setError("Account is inactive.");
          setLoading(false);
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
          <HardHat size={32} className="landing-brand-icon" />
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
              <HardHat size={28} className="landing-brand-icon" />
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
        }}
        closeOnOverlayClick={false}
        title="Apex Console Login"
        maxWidth="440px"
        className="modal-overlay login-modal-overlay"
      >
        <div className="login-modal-container">
          {/* Saas-style construction header */}
          <div className="login-header">
            <div className="login-logo-badge">
              <HardHat size={28} className="login-logo-icon" />
            </div>
            <h3 className="login-title">Welcome to Apex Console</h3>
            <p className="login-subtitle">
              Provide your credentials to manage or verify construction site operations.
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
              <label htmlFor="modal-password" className="login-field-label">Security Password</label>
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
        </div>
      </Modal>

      {/* Global overlay loading spinner during routing transitions */}
      <Loading show={loading} text="Authorizing..." />
    </div>
  );
}

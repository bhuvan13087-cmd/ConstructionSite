import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { signIn, signUp } from "../firebase/auth";
import { createUserProfile } from "../services/firebaseService";
import { useAuth } from "../context/AuthContext";
import { ShieldCheck, Mail, Lock, KeyRound } from "lucide-react";
import Loading from "../components/common/Loading";
import Button from "../components/common/Button";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      await signIn(email.trim(), password);
    } catch (err) {
      // If sign-in fails, check if we need to auto-create the default admin account
      if (email.trim() === "admin@gmail.com" && password === "123456") {
        try {
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

  return (
    <div className="app-container" style={{ display: "flex", justifyContent: "center", alignItems: "center", minHeight: "100vh" }}>
      <section className="view-card" style={{ display: "block" }}>
        <div className="header-block">
          <div className="logo-wrapper">
            <ShieldCheck className="logo-icon" size={48} />
          </div>
          <h1 className="view-title">Construction Site</h1>
          <p className="view-subtitle">Admin Security Terminal</p>
        </div>

        {error && (
          <div className="info-alert" style={{ borderLeft: "4px solid var(--danger-500)", backgroundColor: "var(--danger-50)" }}>
            <div className="info-text" style={{ color: "var(--danger-600)" }}>
              <strong>Error:</strong> {error}
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} className="login-form">
          <div className="form-group">
            <label htmlFor="login-email">Email Address</label>
            <div className="input-wrapper">
              <Mail className="input-icon" size={16} />
              <input
                type="email"
                id="login-email"
                placeholder="admin@gmail.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="login-password">Security Password</label>
            <div className="input-wrapper">
              <Lock className="input-icon" size={16} />
              <input
                type="password"
                id="login-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <Button 
            type="submit" 
            id="btn-login-submit" 
            icon={KeyRound} 
            isLoading={loading}
            style={{ width: "100%", marginTop: "8px" }}
          >
            Authorize & Enter
          </Button>
        </form>
      </section>
      <Loading show={loading} text="Authorizing..." />
    </div>
  );
}

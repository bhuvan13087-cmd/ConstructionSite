import React, { useEffect } from "react";
import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import Loading from "./Loading";

export default function ProtectedRoute({ allowedRoles = ["admin"] }) {
  const { user, userProfile, loading, logout } = useAuth();

  useEffect(() => {
    if (user && userProfile) {
      if (userProfile.status !== "active") {
        console.warn("Inactive user account: logging out.");
        logout();
      }
    }
  }, [user, userProfile, logout]);

  if (loading) {
    return <Loading show={true} text="Verifying Account..." />;
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (user && !userProfile) {
    // Let the default admin account through so the dashboard can auto-provision the profile document if needed
    if (user.email === "admin@gmail.com" && allowedRoles.includes("admin")) {
      return <Outlet />;
    }
    // Force logout if profile is missing for a regular user to prevent infinite loading/unauthorized access
    logout();
    return <Navigate to="/login" replace />;
  }

  if (userProfile.status !== "active") {
    return <Navigate to="/login" replace />;
  }

  if (!allowedRoles.includes(userProfile.role)) {
    // Redirect authorized users to their respective home dashboard instead of logging out
    if (userProfile.role === "super_admin" || userProfile.role === "superadmin") {
      return <Navigate to="/superadmin" replace />;
    } else if (userProfile.role === "admin") {
      return <Navigate to="/admin" replace />;
    } else if (userProfile.role === "site_engineer" || userProfile.role === "engineer") {
      return <Navigate to="/engineer" replace />;
    } else {
      // Unknown or unhandled role, log out
      logout();
      return <Navigate to="/login" replace />;
    }
  }

  return <Outlet />;
}

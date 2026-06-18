import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import AdminDashboard from "../pages/AdminDashboard";
import SiteEngineers from "../pages/SiteEngineers";
import Sites from "../pages/Sites";
import SiteAssignments from "../pages/SiteAssignments";
import EngineerDashboard from "../pages/EngineerDashboard";
import ProtectedRoute from "../components/common/ProtectedRoute";
import { useAuth } from "../context/AuthContext";

export default function AppRoutes() {
  const { user, userProfile } = useAuth();

  return (
    <Routes>
      {/* Landing / Login routes */}
      <Route path="/" element={<Login />} />
      <Route path="/login" element={<Login />} />

      {/* Protected Admin Dashboard Area */}
      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route path="/admin" element={<AdminDashboard />} />
        <Route path="/admin/engineers" element={<SiteEngineers />} />
        <Route path="/admin/sites" element={<Sites />} />
        <Route path="/admin/assignments" element={<SiteAssignments />} />
      </Route>

      {/* Protected Site Engineer Area */}
      <Route element={<ProtectedRoute allowedRoles={["site_engineer", "engineer"]} />}>
        <Route path="/engineer" element={<EngineerDashboard tab="dashboard" />} />
        <Route path="/engineer/attendance" element={<EngineerDashboard tab="attendance" />} />
        <Route path="/engineer/labour" element={<EngineerDashboard tab="labour" />} />
        <Route path="/engineer/material" element={<EngineerDashboard tab="material" />} />
        <Route path="/engineer/photos" element={<EngineerDashboard tab="photos" />} />
        <Route path="/engineer/progress" element={<EngineerDashboard tab="progress" />} />
      </Route>

      {/* Fallback route redirection */}
      <Route 
        path="*" 
        element={
          user 
            ? (userProfile?.role === "admin" 
                ? <Navigate to="/admin" replace /> 
                : <Navigate to="/engineer" replace />)
            : <Navigate to="/login" replace />
        } 
      />
    </Routes>
  );
}

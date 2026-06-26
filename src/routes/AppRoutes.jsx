import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import AdminDashboard from "../pages/AdminDashboard";
import SiteEngineers from "../pages/SiteEngineers";
import Sites from "../pages/Sites";
import SiteAssignments from "../pages/SiteAssignments";
import AdminMaterials from "../pages/AdminMaterials";
import AdminLabour from "../pages/AdminLabour";
import EngineerDashboard from "../pages/EngineerDashboard";
import ApprovalsDashboard from "../pages/ApprovalsDashboard";
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
        <Route path="/admin/approvals" element={<ApprovalsDashboard />} />
        <Route path="/admin/engineers" element={<SiteEngineers />} />
        <Route path="/admin/sites" element={<Sites />} />
        <Route path="/admin/assignments" element={<SiteAssignments />} />
        <Route path="/admin/materials" element={<Navigate to="/admin/sites" replace />} />
        <Route path="/admin/labour" element={<Navigate to="/admin/sites" replace />} />
      </Route>

      {/* Protected Site Engineer Area */}
      <Route element={<ProtectedRoute allowedRoles={["site_engineer", "engineer"]} />}>
        <Route path="/engineer" element={<EngineerDashboard tab="dashboard" />} />
        <Route path="/engineer/attendance" element={<EngineerDashboard tab="attendance" />} />
        <Route path="/engineer/labour" element={<EngineerDashboard tab="labour" />} />
        <Route path="/engineer/material" element={<EngineerDashboard tab="material" />} />
        <Route path="/engineer/photos" element={<EngineerDashboard tab="photos" />} />
        <Route path="/engineer/progress" element={<EngineerDashboard tab="progress" />} />
        <Route path="/engineer/more" element={<EngineerDashboard tab="more" />} />
        <Route path="/engineer/profile" element={<EngineerDashboard tab="profile" />} />
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

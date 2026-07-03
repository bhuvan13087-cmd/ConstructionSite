import React from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import Login from "../pages/Login";
import AdminDashboard from "../pages/AdminDashboard";
import SiteEngineers from "../pages/SiteEngineers";
import Sites from "../pages/Sites";
import SiteAssignments from "../pages/SiteAssignments";
import AdminMaterials from "../pages/AdminMaterials";
import AdminLabour from "../pages/AdminLabour";
import AdminPayments from "../pages/AdminPayments";
import EngineerDashboard from "../pages/EngineerDashboard";
import ApprovalsDashboard from "../pages/ApprovalsDashboard";
import SuperAdminDashboard from "../pages/SuperAdminDashboard";
import DocumentsDashboard from "../pages/DocumentsDashboard";
import ReportsDashboard from "../pages/ReportsDashboard";
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
        <Route path="/admin/materials" element={<AdminMaterials />} />
        <Route path="/admin/labour" element={<AdminLabour />} />
        <Route path="/admin/payments" element={<AdminPayments />} />
        <Route path="/admin/documents" element={<DocumentsDashboard />} />
        <Route path="/admin/reports" element={<ReportsDashboard />} />
      </Route>

      {/* Protected Site Engineer Area */}
      <Route element={<ProtectedRoute allowedRoles={["site_engineer", "engineer"]} />}>
        <Route path="/engineer" element={<EngineerDashboard tab="dashboard" />} />
        <Route path="/engineer/attendance" element={<EngineerDashboard tab="attendance" />} />
        <Route path="/engineer/labour" element={<EngineerDashboard tab="labour" />} />
        <Route path="/engineer/material" element={<EngineerDashboard tab="material" />} />
        <Route path="/engineer/photos" element={<EngineerDashboard tab="photos" />} />
        <Route path="/engineer/progress" element={<EngineerDashboard tab="progress" />} />
        <Route path="/engineer/expenses" element={<EngineerDashboard tab="expenses" />} />
        <Route path="/engineer/more" element={<EngineerDashboard tab="more" />} />
        <Route path="/engineer/profile" element={<EngineerDashboard tab="profile" />} />
        <Route path="/engineer/documents" element={<DocumentsDashboard />} />
      </Route>

      {/* Protected Super Admin Area */}
      <Route element={<ProtectedRoute allowedRoles={["super_admin", "superadmin"]} />}>
        <Route path="/superadmin" element={<SuperAdminDashboard tab="dashboard" />} />
        <Route path="/superadmin/sites" element={<SuperAdminDashboard tab="sites" />} />
        <Route path="/superadmin/finance" element={<SuperAdminDashboard tab="finance" />} />
        <Route path="/superadmin/progress" element={<SuperAdminDashboard tab="progress" />} />
        <Route path="/superadmin/approvals" element={<SuperAdminDashboard tab="approvals" />} />
        <Route path="/superadmin/reports" element={<ReportsDashboard />} />
        <Route path="/superadmin/documents" element={<DocumentsDashboard />} />
      </Route>

      {/* Fallback route redirection */}
      <Route 
        path="*" 
        element={
          user && userProfile
            ? (userProfile.role === "super_admin" || userProfile.role === "superadmin"
                ? <Navigate to="/superadmin" replace />
                : (userProfile.role === "admin" 
                    ? <Navigate to="/admin" replace /> 
                    : <Navigate to="/engineer" replace />))
            : <Navigate to="/login" replace />
        } 
      />
    </Routes>
  );
}

import React, { useState } from "react";
import Sidebar from "./Sidebar";
import Navbar from "./Navbar";

export default function Layout({ children, title, description }) {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className={`dashboard-layout ${sidebarOpen ? "sidebar-open" : ""}`} style={{ minHeight: "100vh" }}>
      {sidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setSidebarOpen(false)} />
      )}
      <Sidebar isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <main className="main-content">
        <Navbar 
          title={title} 
          description={description} 
          onToggleSidebar={() => setSidebarOpen(!sidebarOpen)} 
        />
        <div style={{ width: "100%", flex: 1, display: "flex", flexDirection: "column" }}>
          {children}
        </div>
      </main>
    </div>
  );
}

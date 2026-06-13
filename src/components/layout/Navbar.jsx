import React, { useState, useEffect } from "react";
import { Clock, Menu } from "lucide-react";

export default function Navbar({ title = "Dashboard", description = "Control Panel", onToggleSidebar }) {
  const [time, setTime] = useState("");

  useEffect(() => {
    const updateClock = () => {
      const now = new Date();
      setTime(now.toLocaleTimeString());
    };
    
    updateClock();
    const interval = setInterval(updateClock, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <header className="top-bar">
      <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
        <button className="sidebar-toggle-btn" onClick={onToggleSidebar} type="button">
          <Menu size={20} />
        </button>
        <div className="page-title-area">
          <h2 className="page-title" id="page-title">{title}</h2>
          <p className="page-description" id="page-description">{description}</p>
        </div>
      </div>
      <div className="system-time" id="system-time">
        <Clock size={16} />
        <span id="time-display">{time || "--:--:--"}</span>
      </div>
    </header>
  );
}

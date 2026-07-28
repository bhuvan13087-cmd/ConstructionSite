import React, { useState } from "react";
import { Search, Filter, X, RotateCcw } from "lucide-react";
import Button from "./Button";

export default function SiteFilterBar({
  searchQuery = "",
  onSearchChange = () => {},
  statusFilter = "all",
  onStatusChange = () => {},
  engineerFilter = "",
  onEngineerChange = () => {},
  engineers = [],
  fromDate = "",
  onFromDateChange = () => {},
  toDate = "",
  onToDateChange = () => {},
  progressFilter = "all",
  onProgressChange = () => {},
  onReset = () => {},
  onApply = () => {}
}) {
  const [isMobileDrawerOpen, setIsMobileDrawerOpen] = useState(false);

  const hasActiveFilters = searchQuery || statusFilter !== "all" || engineerFilter || fromDate || toDate || progressFilter !== "all";

  return (
    <>
      {/* CSS Rule for Responsive Mobile Filter Trigger */}
      <style>{`
        @media (max-width: 768px) {
          .desktop-filters-group {
            display: none !important;
          }
          .mobile-filter-trigger {
            display: inline-flex !important;
          }
        }
      `}</style>

      {/* ── DESKTOP SINGLE CLEAN FILTER BAR ── */}
      <div style={{
        background: "#ffffff",
        border: "1px solid #e2e8f0",
        borderRadius: "12px",
        padding: "14px 18px",
        marginBottom: "20px",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)"
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "12px", flexWrap: "wrap" }}>
          
          {/* Main Search Input */}
          <div style={{ flex: "1 1 240px", position: "relative", minWidth: "220px" }}>
            <Search size={16} style={{ position: "absolute", left: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8" }} />
            <input
              type="text"
              placeholder="Search by site, client, or location..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              style={{
                width: "100%",
                padding: "8px 12px 8px 36px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "13px",
                fontWeight: "500",
                color: "#0f172a",
                outline: "none"
              }}
            />
          </div>

          {/* Desktop Compact Filters Group */}
          <div className="desktop-filters-group" style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            
            {/* Status Filter */}
            <select
              value={statusFilter}
              onChange={(e) => onStatusChange(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "12.5px",
                fontWeight: "600",
                color: "#0f172a",
                outline: "none"
              }}
            >
              <option value="all">All Statuses</option>
              <option value="Planning">Planning</option>
              <option value="Active">Active</option>
              <option value="Completed">Completed</option>
              <option value="On Hold">On Hold</option>
            </select>

            {/* Engineer Filter */}
            <select
              value={engineerFilter}
              onChange={(e) => onEngineerChange(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "12.5px",
                fontWeight: "600",
                color: "#0f172a",
                outline: "none",
                maxWidth: "160px"
              }}
            >
              <option value="">All Engineers</option>
              {engineers.map(eng => (
                <option key={eng.id || eng.uid} value={eng.id || eng.uid}>{eng.fullName || eng.name}</option>
              ))}
            </select>

            {/* Progress Filter */}
            <select
              value={progressFilter}
              onChange={(e) => onProgressChange(e.target.value)}
              style={{
                padding: "8px 12px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                backgroundColor: "#ffffff",
                fontSize: "12.5px",
                fontWeight: "600",
                color: "#0f172a",
                outline: "none"
              }}
            >
              <option value="all">All Progress</option>
              <option value="0-25">0% - 25%</option>
              <option value="25-50">25% - 50%</option>
              <option value="50-75">50% - 75%</option>
              <option value="75-100">75% - 100%</option>
            </select>

            {/* Date Inputs */}
            <input
              type="date"
              title="From Date"
              value={fromDate}
              onChange={(e) => onFromDateChange(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0f172a",
                outline: "none"
              }}
            />
            <span style={{ fontSize: "12px", color: "#94a3b8" }}>to</span>
            <input
              type="date"
              title="To Date"
              value={toDate}
              onChange={(e) => onToDateChange(e.target.value)}
              style={{
                padding: "7px 10px",
                borderRadius: "8px",
                border: "1px solid #cbd5e1",
                fontSize: "12px",
                fontWeight: "500",
                color: "#0f172a",
                outline: "none"
              }}
            />

            {/* Actions */}
            <Button variant="primary" size="sm" onClick={onApply} style={{ height: "34px", padding: "0 14px" }}>
              Apply
            </Button>

            {hasActiveFilters && (
              <button
                type="button"
                onClick={onReset}
                style={{
                  background: "transparent",
                  border: "none",
                  color: "#ea580c",
                  fontSize: "12px",
                  fontWeight: "700",
                  cursor: "pointer",
                  display: "inline-flex",
                  alignItems: "center",
                  gap: "4px"
                }}
              >
                <RotateCcw size={13} />
                <span>Reset</span>
              </button>
            )}

          </div>

          {/* Mobile Filter Button */}
          <button
            type="button"
            className="mobile-filter-trigger"
            onClick={() => setIsMobileDrawerOpen(true)}
            style={{
              display: "none",
              alignItems: "center",
              gap: "6px",
              padding: "8px 14px",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              backgroundColor: "#f8fafc",
              fontSize: "13px",
              fontWeight: "700",
              color: "#0f172a",
              cursor: "pointer"
            }}
          >
            <Filter size={15} />
            <span>Filters</span>
            {hasActiveFilters && <span style={{ width: "6px", height: "6px", borderRadius: "50%", backgroundColor: "#ea580c" }} />}
          </button>

        </div>
      </div>

      {/* MOBILE FILTER DRAWER / BOTTOM SHEET */}
      {isMobileDrawerOpen && (
        <div style={{
          position: "fixed",
          inset: 0,
          backgroundColor: "rgba(15, 23, 42, 0.5)",
          zIndex: 9999,
          display: "flex",
          justifyContent: "flex-end",
          alignItems: "flex-end"
        }}>
          <div style={{
            background: "#ffffff",
            width: "100%",
            maxWidth: "420px",
            maxHeight: "85vh",
            borderTopLeftRadius: "16px",
            borderTopRightRadius: "16px",
            padding: "20px",
            overflowY: "auto",
            boxShadow: "0 -4px 20px rgba(0,0,0,0.15)",
            display: "flex",
            flexDirection: "column",
            gap: "16px"
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "1px solid #e2e8f0", paddingBottom: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                <Filter size={18} style={{ color: "#ea580c" }} />
                <h3 style={{ margin: 0, fontSize: "16px", fontWeight: "800", color: "#0f172a" }}>Filter Construction Sites</h3>
              </div>
              <button type="button" onClick={() => setIsMobileDrawerOpen(false)} style={{ border: "none", background: "transparent", cursor: "pointer", color: "#64748b" }}>
                <X size={20} />
              </button>
            </div>

            {/* Mobile Form Fields */}
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Status</label>
                <select
                  value={statusFilter}
                  onChange={(e) => onStatusChange(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                >
                  <option value="all">All Statuses</option>
                  <option value="Planning">Planning</option>
                  <option value="Active">Active</option>
                  <option value="Completed">Completed</option>
                  <option value="On Hold">On Hold</option>
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Site Engineer</label>
                <select
                  value={engineerFilter}
                  onChange={(e) => onEngineerChange(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                >
                  <option value="">All Engineers</option>
                  {engineers.map(eng => (
                    <option key={eng.id || eng.uid} value={eng.id || eng.uid}>{eng.fullName || eng.name}</option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>Progress Range</label>
                <select
                  value={progressFilter}
                  onChange={(e) => onProgressChange(e.target.value)}
                  style={{ width: "100%", padding: "10px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                >
                  <option value="all">All Progress</option>
                  <option value="0-25">0% - 25%</option>
                  <option value="25-50">25% - 50%</option>
                  <option value="50-75">50% - 75%</option>
                  <option value="75-100">75% - 100%</option>
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>From Date</label>
                  <input
                    type="date"
                    value={fromDate}
                    onChange={(e) => onFromDateChange(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
                <div>
                  <label style={{ fontSize: "12px", fontWeight: "700", color: "#475569", display: "block", marginBottom: "4px" }}>To Date</label>
                  <input
                    type="date"
                    value={toDate}
                    onChange={(e) => onToDateChange(e.target.value)}
                    style={{ width: "100%", padding: "8px", borderRadius: "8px", border: "1px solid #cbd5e1" }}
                  />
                </div>
              </div>
            </div>

            {/* Mobile Actions */}
            <div style={{ display: "flex", gap: "10px", marginTop: "10px", borderTop: "1px solid #e2e8f0", paddingTop: "14px" }}>
              <Button
                variant="outline"
                style={{ flex: 1 }}
                onClick={() => {
                  onReset();
                  setIsMobileDrawerOpen(false);
                }}
              >
                Reset
              </Button>
              <Button
                variant="primary"
                style={{ flex: 1 }}
                onClick={() => {
                  onApply();
                  setIsMobileDrawerOpen(false);
                }}
              >
                Apply Filters
              </Button>
            </div>

          </div>
        </div>
      )}
    </>
  );
}

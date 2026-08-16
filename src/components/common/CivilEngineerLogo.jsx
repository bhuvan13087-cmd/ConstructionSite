import React from "react";

export default function CivilEngineerLogo({ size = 24, className = "", style = {} }) {
  const dimension = typeof size === "number" ? `${size}px` : size;
  return (
    <img 
      src="/app-icon.png" 
      alt="Visvas Builders" 
      width={typeof size === "number" ? size : 24} 
      height={typeof size === "number" ? size : 24} 
      className={`brand-logo-img ${className}`}
      style={{
        width: dimension,
        height: dimension,
        minWidth: dimension,
        minHeight: dimension,
        objectFit: "contain",
        borderRadius: "6px",
        display: "inline-block",
        verticalAlign: "middle",
        flexShrink: 0,
        ...style
      }} 
    />
  );
}

export { CivilEngineerLogo as AppLogo, CivilEngineerLogo as VisvasLogo };

import React, { useState, useEffect } from "react";

export default function SelectWithOthers({
  options = [], // [{ value: 'Personal Leave', label: 'Personal' }, ...]
  value = "",
  onChange,
  othersValue = "Other", // Can be "Other" or "Others"
  placeholder = "Please specify...",
  label = "Specify custom value",
  id,
  selectStyle = {},
  inputStyle = {},
  required = false
}) {
  const optionValues = options.map(opt => opt.value);
  const isOthersValue = value && !optionValues.includes(value);
  
  const [selectedDropdown, setSelectedDropdown] = useState(
    isOthersValue ? othersValue : (value || "")
  );
  const [specifyText, setSpecifyText] = useState(
    isOthersValue ? value : ""
  );

  // Sync state if prop value changes externally
  useEffect(() => {
    const isOthers = value && !optionValues.includes(value);
    if (isOthers) {
      setSelectedDropdown(othersValue);
      setSpecifyText(value);
    } else {
      setSelectedDropdown(value || "");
      setSpecifyText("");
    }
  }, [value, options, othersValue]);

  const handleSelectChange = (e) => {
    const val = e.target.value;
    setSelectedDropdown(val);
    if (val === othersValue) {
      // Trigger onChange with custom text (currently empty or whatever it was)
      onChange(specifyText);
    } else {
      setSpecifyText("");
      onChange(val);
    }
  };

  const handleInputChange = (e) => {
    const val = e.target.value;
    setSpecifyText(val);
    onChange(val);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "8px", width: "100%" }}>
      <select
        id={id}
        value={selectedDropdown}
        onChange={handleSelectChange}
        required={required}
        style={{
          width: "100%",
          padding: "8px 10px",
          borderRadius: "var(--radius-sm)",
          border: "1px solid var(--border-color)",
          backgroundColor: "#ffffff",
          fontWeight: 600,
          cursor: "pointer",
          outline: "none",
          ...selectStyle
        }}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value={othersValue}>Others</option>
      </select>

      {selectedDropdown === othersValue && (
        <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
          <label style={{ fontSize: "10px", fontWeight: "700", color: "var(--primary-700)", textTransform: "uppercase", display: "block" }}>
            {label} <span style={{ color: "var(--danger-500)" }}>*</span>
          </label>
          <input
            type="text"
            value={specifyText}
            onChange={handleInputChange}
            placeholder={placeholder}
            required={required}
            style={{
              width: "100%",
              padding: "8px 10px",
              border: "1.5px solid var(--accent-500)",
              borderRadius: "var(--radius-sm)",
              fontSize: "13px",
              outline: "none",
              backgroundColor: "#ffffff",
              ...inputStyle
            }}
          />
        </div>
      )}
    </div>
  );
}

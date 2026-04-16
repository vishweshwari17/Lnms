import React from 'react';

const SeverityBadge = ({ sev }) => {
  const styles = {
    Critical: "bg-red-50 text-red-600 border-red-200",
    Major: "bg-amber-50 text-amber-600 border-amber-200",
    Minor: "bg-blue-50 text-blue-600 border-blue-200",
    Warning: "bg-orange-50 text-orange-600 border-orange-200",
    Info: "bg-indigo-50 text-indigo-600 border-indigo-200",
    Clear: "bg-emerald-50 text-emerald-600 border-emerald-200"
  };

  const currentStyle = styles[sev] || "bg-gray-50 text-gray-600 border-gray-200";

  return (
    <span className={`label-badge px-2.5 py-0.5 rounded-full border shadow-sm ${currentStyle}`}>
      {sev || "Unknown"}
    </span>
  );
};

export default SeverityBadge;

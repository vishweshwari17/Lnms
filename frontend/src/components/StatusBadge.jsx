import React from 'react';
import { CheckCircle, Clock, AlertCircle, ShieldAlert, XCircle } from 'lucide-react';

const StatusBadge = ({ status }) => {
  const normalized = String(status || "").trim().toUpperCase();
  
  const config = {
    OPEN: { color: "text-rose-600 bg-rose-50 border-rose-100", icon: <ShieldAlert size={12} />, label: "Active", pulse: true },
    ACTIVE: { color: "text-rose-600 bg-rose-50 border-rose-100", icon: <ShieldAlert size={12} />, label: "Active", pulse: true },
    ACK: { color: "text-amber-600 bg-amber-50 border-amber-100", icon: <Clock size={12} />, label: "Acknowledged" },
    RESOLVED: { color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: <CheckCircle size={12} />, label: "Resolved" },
    CLOSED: { color: "text-slate-500 bg-slate-50 border-slate-100", icon: <XCircle size={12} />, label: "Closed" },
    INACTIVE: { color: "text-slate-500 bg-slate-50 border-slate-100", icon: <XCircle size={12} />, label: "Inactive" },
    UP: { color: "text-emerald-600 bg-emerald-50 border-emerald-100", icon: <CheckCircle size={12} />, label: "Up" },
    DOWN: { color: "text-rose-600 bg-rose-50 border-rose-100", icon: <AlertCircle size={12} />, label: "Down", pulse: true },
  };

  const current = config[normalized] || { color: "bg-gray-50 text-gray-600 border-gray-100", label: status, icon: null };

  return (
    <span className={`label-badge flex items-center w-fit gap-1.5 px-2.5 py-0.5 rounded-full border shadow-sm transition-all ${current.color} ${current.pulse ? 'animate-pulse' : ''}`}>
      {current.icon}
      {current.label}
    </span>
  );
};

export default StatusBadge;

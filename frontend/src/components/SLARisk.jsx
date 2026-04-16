import React from 'react';

export default function SLARisk() {
  const risks = [
    { label: "Critical Risk", value: 3, total: 20, color: "bg-rose-500", text: "text-rose-600", bg: "bg-rose-50" },
    { label: "Major Risk", value: 5, total: 20, color: "bg-amber-500", text: "text-amber-600", bg: "bg-amber-50" },
    { label: "SLA Compliant", value: 12, total: 20, color: "bg-emerald-500", text: "text-emerald-600", bg: "bg-emerald-50" }
  ];

  return (
    <div className="space-y-6">
      {risks.map((risk, idx) => (
        <div key={idx} className="group">
          <div className="flex justify-between items-end mb-2">
            <div>
               <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.15em] leading-none mb-1">{risk.label}</p>
               <h4 className={`text-xl font-black tracking-tighter ${risk.text}`}>{risk.value} <span className="text-xs opacity-50 font-medium">Assets</span></h4>
            </div>
            <span className="text-[10px] font-black text-slate-300">LIMIT: {risk.total}</span>
          </div>

          <div className="flex gap-1 h-3">
            {[...Array(15)].map((_, i) => {
               const percentage = (risk.value / risk.total) * 15;
               const isActive = i < percentage;
               return (
                 <div 
                   key={i} 
                   className={`flex-1 rounded-sm transition-all duration-500 ${isActive ? risk.color : 'bg-slate-100'}`}
                   style={{ 
                     opacity: isActive ? 1 : 0.2,
                     boxShadow: isActive ? `0 0 8px ${risk.color.replace('bg-', '')}` : 'none'
                   }} 
                 />
               );
            })}
          </div>
        </div>
      ))}

      <div className="pt-4 border-t border-slate-50 flex justify-between items-center">
        <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Global Priority</span>
        <button className="text-[9px] font-black text-blue-600 uppercase tracking-widest hover:underline">Full Analytics</button>
      </div>
    </div>
  );
}
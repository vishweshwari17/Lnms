import React from 'react';
import { ChevronDown } from 'lucide-react';

const FilterSelect = ({ value, onChange, options, label }) => {
  return (
    <div className="flex flex-col gap-1.5">
      {label && <span className="section-title !mb-0 text-[9px]">{label}</span>}
      <div className="relative group">
        <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="appearance-none bg-white border border-slate-200 rounded-xl px-4 py-2 pr-10 body-text font-bold outline-none cursor-pointer focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all shadow-sm w-full min-w-[120px]"
        >
          {options.map(opt => (
            <option key={opt} value={opt}>
              {opt === 'All' ? `All ${label}s` : opt}
            </option>
          ))}
        </select>
        <ChevronDown 
          size={14} 
          className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 group-hover:text-blue-500 transition-colors pointer-events-none" 
        />
      </div>
    </div>
  );
};

export default FilterSelect;

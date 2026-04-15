import { useEffect, useState, useCallback } from "react";
import { 
  FaExclamationCircle, 
  FaCheckCircle, 
  FaClock, 
  FaSearch, 
  FaFilter, 
  FaSyncAlt,
  FaArrowRight,
  FaDesktop,
  FaInfoCircle,
  FaTimes
} from "react-icons/fa";
import { 
  getIncidents, 
  acknowledgeIncident, 
  updateIncidentStatus 
} from "../api/api";
import toast from "react-hot-toast";

export default function IncidentDashboard() {
  const [incidents, setIncidents] = useState([]);
  const [summary, setSummary] = useState({ total: 0, critical: 0, breached: 0 });
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [lastUpdated, setLastUpdated] = useState(new Date());
  
  const [selectedIncident, setSelectedIncident] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const fetchIncidents = useCallback(async (isAutoRefresh = false) => {
    if (!isAutoRefresh) setLoading(true);
    try {
      const res = await getIncidents({
        status: statusFilter === "All" ? undefined : statusFilter,
        severity: severityFilter === "All" ? undefined : severityFilter,
        device_name: search || undefined,
        limit: 100
      });
      setIncidents(res.data.incidents || []);
      setSummary(res.data.summary || { total: 0, critical: 0, breached: 0 });
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Failed to fetch incidents", err);
      if (!isAutoRefresh) toast.error("Failed to load incidents");
    } finally {
      if (!isAutoRefresh) setLoading(false);
    }
  }, [statusFilter, severityFilter, search]);

  useEffect(() => {
    fetchIncidents();
  }, [fetchIncidents]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchIncidents(true);
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchIncidents]);

  const handleAck = async (id) => {
    if (!window.confirm("Acknowledge this incident?")) return;
    try {
      await acknowledgeIncident(id);
      toast.success("Incident Acknowledged");
      fetchIncidents(true);
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const handleResolve = async (id) => {
    const note = window.prompt("Enter resolution note:");
    if (note === null) return;
    try {
      await updateIncidentStatus(id, "RESOLVED");
      toast.success("Incident Resolved");
      fetchIncidents(true);
    } catch (err) {
      toast.error("Action failed");
    }
  };

  const openDetail = (incident) => {
    setSelectedIncident(incident);
    setIsModalOpen(true);
  };

  return (
    <div className="p-8 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        
        {/* HEADER */}
        <div className="flex justify-between items-end mb-10">
          <div>
             <div className="flex items-center gap-3 mb-2">
                <div className="w-10 h-10 bg-indigo-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-indigo-100">
                   <FaExclamationCircle size={20} />
                </div>
                <h1 className="text-3xl font-black tracking-tight text-slate-900 uppercase">Incident Dashboard</h1>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] ml-14">
                Operational Intelligence &bull; Last updated: {lastUpdated.toLocaleTimeString()}
             </p>
          </div>
          
          <button 
            onClick={() => fetchIncidents()}
            className="flex items-center gap-2 bg-white text-slate-600 px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest shadow-sm border border-slate-100 hover:bg-slate-50 transition-all active:scale-95 creative-hover"
          >
            <FaSyncAlt className={loading ? "animate-spin" : ""} />
            Refresh Feed
          </button>
        </div>

        {/* SUMMARY CARDS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
          <SummaryCard label="Total Active Incidents" value={summary.total} icon={<FaExclamationTriangle />} color="blue" />
          <SummaryCard label="Critical Severity" value={summary.critical} icon={<FaExclamationTriangle />} color="rose" />
          <SummaryCard label="SLA Breached" value={summary.breached} icon={<FaClock />} color="amber" />
        </div>

        {/* FILTERS */}
        <div className="bg-white p-6 rounded-[2.5rem] shadow-xl shadow-slate-200/30 mb-10 border border-slate-50 flex flex-wrap gap-6 items-center">
           <div className="relative flex-1 min-w-[300px]">
              <FaSearch className="absolute left-6 top-1/2 -translate-y-1/2 text-slate-300" />
              <input 
                 type="text"
                 placeholder="Search by device or ticket ID..."
                 value={search}
                 onChange={(e) => setSearch(e.target.value)}
                 className="w-full bg-slate-50 border-none rounded-2xl px-14 py-4 focus:ring-4 focus:ring-indigo-50 transition-all font-bold text-slate-700 placeholder-slate-300 shadow-inner"
              />
           </div>
           <div className="flex gap-4">
              <FilterSelect label="Severity" value={severityFilter} onChange={setSeverityFilter} options={["All", "Critical", "Major", "Minor"]} />
              <FilterSelect label="Status" value={statusFilter} onChange={setStatusFilter} options={["All", "OPEN", "ACK", "RESOLVED"]} />
           </div>
        </div>

        {/* INCIDENT TABLE */}
        <div className="card !p-0 overflow-hidden creative-hover">
           <table className="w-full text-left border-collapse">
              <thead>
                 <tr className="bg-gray-50 border-b border-gray-100 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    <th className="px-10 py-8">Ticket ID</th>
                    <th className="px-10 py-8">Device / Host</th>
                    <th className="px-10 py-8 text-center">Severity</th>
                    <th className="px-10 py-8 text-center">Status</th>
                    <th className="px-10 py-8 text-center">SLA Status</th>
                    <th className="px-10 py-8">Created</th>
                    <th className="px-10 py-8 text-right">Actions</th>
                 </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                 {loading && incidents.length === 0 ? (
                    <tr><td colSpan="7" className="py-24 text-center text-slate-300 font-black uppercase tracking-widest animate-pulse">Syncing Mission Grid...</td></tr>
                 ) : incidents.length === 0 ? (
                    <tr><td colSpan="7" className="py-24 text-center text-slate-300 font-black uppercase tracking-widest">No Incidents Reported</td></tr>
                 ) : incidents.map((inc) => (
                    <tr key={inc.id} className="hover:bg-blue-50/50 transition-all group cursor-pointer" onClick={() => openDetail(inc)}>
                       <td className="px-10 py-6">
                          <div className="text-blue-600 font-black text-xs uppercase tracking-tighter">{inc.ticket_id || `#${inc.id}`}</div>
                       </td>
                       <td className="px-10 py-6">
                          <div className="font-black text-slate-900 text-sm uppercase tracking-tight group-hover:text-blue-600 transition-colors">{inc.device}</div>
                          <div className="text-[10px] font-bold text-slate-400 mt-1 uppercase tracking-wider">{inc.ip_address}</div>
                       </td>
                       <td className="px-10 py-8 text-center">
                          <SeverityBadge severity={inc.severity} />
                       </td>
                       <td className="px-10 py-8 text-center">
                          <StatusBadge status={inc.status} />
                       </td>
                       <td className="px-10 py-8 text-center">
                          <div className={`inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest ${
                             inc.sla_status === 'Red' ? 'bg-rose-50 text-rose-600' : 
                             inc.sla_status === 'Yellow' ? 'bg-amber-50 text-amber-600' : 'bg-emerald-50 text-emerald-600'
                          }`}>
                             <FaClock size={10} />
                             {inc.sla_remaining > 0 ? `${inc.sla_remaining}m` : 'BREACHED'}
                          </div>
                       </td>
                       <td className="px-10 py-8">
                          <div className="text-[10px] font-black text-slate-500 uppercase">{new Date(inc.created_time).toLocaleString()}</div>
                       </td>
                       <td className="px-10 py-8 text-right" onClick={(e) => e.stopPropagation()}>
                          <div className="flex justify-end gap-2">
                             {inc.status === 'OPEN' && (
                                <ActionButton label="ACK" color="blue" onClick={() => handleAck(inc.id)} icon={<FaCheckCircle />} />
                             )}
                             {inc.status !== 'RESOLVED' && (
                                <ActionButton label="FIX" color="emerald" onClick={() => handleResolve(inc.id)} icon={<FaCheckCircle />} />
                             )}
                             <button 
                                onClick={() => openDetail(inc)}
                                className="w-10 h-10 bg-slate-50 text-slate-400 rounded-xl flex items-center justify-center hover:bg-slate-100 transition-colors"
                             >
                                <FaArrowRight size={12} />
                             </button>
                          </div>
                       </td>
                    </tr>
                 ))}
              </tbody>
           </table>
        </div>
      </div>

      {/* DETAIL MODAL */}
      {isModalOpen && selectedIncident && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-slate-900/60 backdrop-blur-md">
           <div className="bg-white w-full max-w-2xl rounded-[3rem] shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-300">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
                 <div className="flex items-center gap-4">
                    <span className="bg-blue-600 text-white px-4 py-1.5 rounded-2xl text-[10px] font-black uppercase tracking-widest">{selectedIncident.ticket_id || `#${selectedIncident.id}`}</span>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Incident Details</h3>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-300 hover:text-slate-600 transition-colors"><FaTimes size={20} /></button>
              </div>
              
              <div className="p-10 space-y-8">
                 <div className="grid grid-cols-2 gap-8">
                    <DetailItem label="Asset" value={selectedIncident.device} icon={<FaDesktop />} />
                    <DetailItem label="Network Address" value={selectedIncident.ip_address} icon={<FaInfoCircle />} />
                    <DetailItem label="Severity" value={selectedIncident.severity} icon={<FaExclamationCircle />} />
                    <DetailItem label="Status" value={selectedIncident.status} icon={<FaInfoCircle />} />
                 </div>
                 
                 <div className="p-8 bg-slate-50 rounded-[2rem] border border-slate-100">
                    <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Event Description</h4>
                    <p className="text-slate-600 font-medium leading-relaxed">{selectedIncident.title || "No extended description available."}</p>
                 </div>
                 
                 <div className="flex justify-end gap-3 pt-4">
                    <button 
                       onClick={() => setIsModalOpen(false)}
                       className="px-8 py-4 bg-slate-100 text-slate-600 rounded-2xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all"
                    >
                       Close
                    </button>
                    {selectedIncident.status === 'OPEN' && (
                       <button onClick={() => { handleAck(selectedIncident.id); setIsModalOpen(false); }} className="px-8 py-4 bg-blue-600 text-white rounded-2xl font-black text-xs uppercase tracking-widest shadow-lg shadow-blue-100">ACK Now</button>
                    )}
                 </div>
              </div>
           </div>
        </div>
      )}
    </div>
  );
}

function SummaryCard({ label, value, icon, color }) {
  const colors = {
     blue: "bg-blue-600 shadow-blue-100",
     rose: "bg-rose-500 shadow-rose-100",
     amber: "bg-amber-500 shadow-amber-100"
  };
  
  return (
    <div className="bg-white p-8 rounded-[2.5rem] shadow-xl shadow-slate-200/30 border border-slate-50 flex items-center justify-between group hover:translate-y-[-5px] transition-all duration-300">
       <div>
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{label}</p>
          <p className="text-4xl font-black text-slate-900 tracking-tighter">{value}</p>
       </div>
       <div className={`w-16 h-16 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl ${colors[color]} group-hover:scale-110 transition-transform`}>
          {icon}
       </div>
    </div>
  );
}

function FilterSelect({ label, value, onChange, options }) {
  return (
    <div className="flex items-center gap-3 bg-slate-50 px-6 py-3 rounded-2xl border border-slate-100 shadow-inner">
       <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{label}</span>
       <select 
          value={value} 
          onChange={(e) => onChange(e.target.value)}
          className="bg-transparent border-none p-0 text-[11px] font-black text-slate-600 focus:ring-0 uppercase cursor-pointer"
       >
          {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
       </select>
    </div>
  );
}

function SeverityBadge({ severity }) {
  const colors = {
     Critical: "text-rose-600 bg-rose-50 border-rose-100",
     Major: "text-amber-600 bg-amber-50 border-amber-100",
     Minor: "text-indigo-600 bg-indigo-50 border-indigo-100"
  };
  return (
    <span className={`px-4 py-1.5 rounded-full text-[9px] font-black uppercase tracking-widest border ${colors[severity] || 'text-slate-400 bg-slate-50 border-slate-100'}`}>
       {severity}
    </span>
  );
}

function StatusBadge({ status }) {
  const colors = {
     OPEN: "text-rose-600",
     ACK: "text-indigo-600",
     RESOLVED: "text-emerald-600"
  };
  return (
    <div className="flex items-center justify-center gap-2">
       <div className={`w-2 h-2 rounded-full ${status === 'RESOLVED' ? 'bg-emerald-500' : status === 'ACK' ? 'bg-indigo-500' : 'bg-rose-500'}`} />
       <span className={`text-[10px] font-black uppercase tracking-widest ${colors[status] || 'text-slate-400'}`}>{status}</span>
    </div>
  );
}

function ActionButton({ label, color, onClick, icon }) {
  const colors = {
     indigo: "text-indigo-600 border-indigo-100 hover:bg-indigo-600 hover:text-white",
     emerald: "text-emerald-600 border-emerald-100 hover:bg-emerald-600 hover:text-white"
  };
  return (
    <button 
       onClick={onClick}
       className={`px-4 py-2 border rounded-xl font-black text-[10px] uppercase tracking-widest transition-all ${colors[color]}`}
    >
       {label}
    </button>
  );
}

function DetailItem({ label, value, icon }) {
  return (
    <div className="flex items-center gap-4">
       <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 shadow-inner">
          {icon}
       </div>
       <div>
          <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{label}</p>
          <p className="text-xs font-black text-slate-800 uppercase tracking-tight">{value}</p>
       </div>
    </div>
  );
}

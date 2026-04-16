import { useEffect, useState, useCallback } from "react";
import api, { getTickets, getAlarms, getCorrelated } from "../api/api";
import LiveAlarmStream from "../components/LiveStream";
import NetworkHealth from "../components/NetworkHealth";
import SLARisk from "../components/SLARisk";
import { 
  FaExclamationTriangle, 
  FaTicketAlt, 
  FaLayerGroup,
  FaMicrochip,
  FaSyncAlt,
  FaLink
} from "react-icons/fa";
import KPICard from "../components/KPICard";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";

export default function Dashboard() {
  const [stats, setStats] = useState({ devices: 0, alarms: 0, tickets: 0, extra: 0, critical: 0 });
  const [recentTickets, setRecentTickets] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(new Date());
  const [loading, setLoading] = useState(true);

  const fetchDashboard = useCallback(async (isRefresh = false) => {
    if (!isRefresh) setLoading(true);
    try {
      const [ticketsRes, alarmsRes, correlatedRes] = await Promise.all([
        getTickets(),
        getAlarms(),
        getCorrelated()
      ]);
      const tickets = Array.isArray(ticketsRes.data) ? ticketsRes.data : (ticketsRes.data?.tickets ?? []);
      const alarms  = Array.isArray(alarmsRes.data)  ? alarmsRes.data  : (alarmsRes.data?.alarms  ?? []);
      const correlated = Array.isArray(correlatedRes.data) ? correlatedRes.data : [];

      setStats({
        devices:  new Set(alarms.map(a => a.device_name)).size,
        alarms:   alarms.filter(a => ["OPEN"].includes(a.status?.toUpperCase())).length,
        tickets:  tickets.filter(t => ["OPEN", "ACK"].includes(t.status?.toUpperCase())).length,
        extra:    correlated.length,
        critical: tickets.filter(t => t.severity_original === "Critical" && ["OPEN"].includes(t.status?.toUpperCase())).length,
      });

      setRecentTickets(
        [...tickets]
          .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
          .slice(0, 8)
      );
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      if (!isRefresh) setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(() => fetchDashboard(true), 10000);
    return () => clearInterval(id);
  }, [fetchDashboard]);

  const healthScore = Math.max(0, 100 - stats.critical * 5);

  return (
    <div className="space-y-8">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="page-title tracking-tighter uppercase">Operations Command</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mt-1 flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
             Elite Network Intelligence &bull; Active Signal
          </p>
        </div>
        
        <div className="flex items-center gap-8 relative z-10">
           <div className="text-right">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Last Updated</p>
              <p className="text-sm font-black tabular-nums text-slate-700">{lastUpdated.toLocaleTimeString()}</p>
           </div>
           <button 
             onClick={() => fetchDashboard()}
             className="w-12 h-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 group active:scale-95"
           >
             <FaSyncAlt className={`${loading ? "animate-spin" : ""} group-hover:rotate-180 transition-transform duration-500`} size={16} />
           </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-5">
          <KPICard 
             label="Nodes Monitored" 
             value={stats.devices} 
             icon={<FaLayerGroup />} 
             color="blue" 
             trend={[65, 59, 80, 81, 56, 55, 40]}
             loading={loading}
          />
          <KPICard 
             label="Active Alarms" 
             value={stats.alarms} 
             icon={<FaExclamationTriangle />} 
             color="rose" 
             trend={[20, 30, 45, 35, 25, 40, 50]}
             loading={loading}
          />
          <KPICard 
             label="Open Tickets" 
             value={stats.tickets} 
             icon={<FaTicketAlt />} 
             color="amber" 
             trend={[10, 15, 12, 18, 14, 16, 20]} 
             loading={loading}
          />
          <KPICard 
             label="Correlated" 
             value={stats.extra} 
             icon={<FaLink />} 
             color="blue" 
             trend={[2, 4, 3, 6, 5, 8, 7]} 
             loading={loading}
          />
          <KPICard 
             label="Critical Risk" 
             value={stats.critical} 
             icon={<FaMicrochip />} 
             color="red" 
             trend={[1, 0, 2, 1, 3, 2, 1]}
             loading={loading}
          />
      </div>

      {/* ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card creative-hover">
           <div className="flex justify-between items-center mb-6">
              <h3 className="section-title mb-0">Network Health Score</h3>
              <span className="label-badge text-emerald-600 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-100 italic">Live Tracking</span>
           </div>
           <NetworkHealth healthScore={healthScore} />
        </div>

        <div className="card creative-hover">
           <div className="flex justify-between items-center mb-6">
              <h3 className="section-title mb-0">SLA Performance Monitor</h3>
              <span className="label-badge text-blue-600 bg-blue-50 px-3 py-1 rounded-full border border-blue-100 font-black">24h History</span>
           </div>
           <SLARisk />
        </div>
      </div>

      {/* LIVE FEED + RECENT ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="lg:col-span-1 card shadow-xl border-none bg-slate-900 text-white overflow-hidden relative">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-500 via-purple-500 to-rose-500" />
            <h3 className="section-title !text-slate-400 mb-6 font-black">Live Event Stream</h3>
            <LiveAlarmStream />
         </div>

         <div className="lg:col-span-3 card !p-0 overflow-hidden shadow-sm border-slate-100">
            <div className="px-8 py-6 border-b border-slate-50 bg-slate-50/30 flex justify-between items-center">
               <div>
                  <h3 className="section-title mb-1">Recent Incident Logs</h3>
                  <p className="small-meta font-bold uppercase tracking-tighter opacity-70">Synchronized with global dispatch</p>
               </div>
               <button className="text-[10px] font-black text-blue-600 hover:tracking-widest transition-all uppercase tracking-tighter">View Master Registry</button>
            </div>
            
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-slate-50/50">
                        <th className="table-header table-cell">ID</th>
                        <th className="table-header table-cell">Asset Entity</th>
                        <th className="table-header table-cell">Severity</th>
                        <th className="table-header table-cell">Lifecycle</th>
                        <th className="table-header table-cell">Description</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                     {loading ? (
                        <tr><td colSpan="5" className="table-cell text-center py-20 text-slate-400 animate-pulse font-black uppercase tracking-widest">Hydrating data vectors...</td></tr>
                     ) : recentTickets.length === 0 ? (
                        <tr><td colSpan="5" className="table-cell text-center py-20 text-slate-400 font-bold">No Active Incidents Detected</td></tr>
                     ) : recentTickets.map((t, idx) => (
                        <tr key={idx} className="group cursor-pointer">
                           <td className="table-cell font-black text-blue-primary group-hover:underline">
                              {(t.ticket_id || t.global_ticket_id || "TR-X").slice(0, 10)}
                           </td>
                           <td className="table-cell font-bold text-slate-700">{t.device_name}</td>
                           <td className="table-cell"><SeverityBadge sev={t.severity_original} /></td>
                           <td className="table-cell"><StatusBadge status={t.status} /></td>
                           <td className="table-cell truncate max-w-[250px] small-meta font-medium">{t.title}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         </div>
      </div>
    </div>
  );
}

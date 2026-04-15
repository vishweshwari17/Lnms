import { useEffect, useState, useCallback } from "react";
import api, { getTickets, getAlarms, getCorrelated } from "../api/api";
import LiveAlarmStream from "../components/LiveStream";
import NetworkHealth from "../components/NetworkHealth";
import SLARisk from "../components/SLARisk";
import { 
  FaNetworkWired, 
  FaExclamationTriangle, 
  FaTicketAlt, 
  FaShieldAlt, 
  FaChartLine, 
  FaBolt,
  FaCogs,
  FaLayersGroup,
  FaMicrochip
} from "react-icons/fa";
import Sparkline from "../components/Sparkline";

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
    <div className="space-y-6">
      {/* HEADER SECTION */}
      <div className="flex justify-between items-center bg-gradient-to-r from-white to-blue-50/50 p-8 rounded-3xl border border-blue-100 shadow-sm">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tighter uppercase">Operations Command</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mt-1">
             Elite Network Intelligence &bull; Standard Signal
          </p>
        </div>
        
        <div className="flex items-center gap-6">
           <div className="text-right">
              <p className="text-[9px] font-black uppercase text-slate-400 tracking-widest leading-none mb-1">Last Sync</p>
              <p className="text-xs font-black tabular-nums text-slate-700">{lastUpdated.toLocaleTimeString()}</p>
           </div>
           <button 
             onClick={() => fetchDashboard()}
             className="w-10 h-10 bg-blue-600 text-white rounded-xl flex items-center justify-center hover:bg-blue-500 transition-all shadow-lg shadow-blue-600/20 group"
           >
             <FaSyncAlt className={`${loading ? "animate-spin" : ""} group-hover:scale-110`} size={14} />
           </button>
        </div>
      </div>

      {/* STAT CARDS */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <PremiumKPICard 
             label="Total Infrastructure" 
             value={stats.total_devices} 
             icon={<FaLayersGroup size={24} />} 
             color="blue" 
             trend={stats.trends?.total_devices}
          />
          <PremiumKPICard 
             label="Active Alarms" 
             value={stats.active_alarms} 
             icon={<FaExclamationTriangle size={24} />} 
             color="rose" 
             trend={stats.trends?.active_alarms}
          />
          <PremiumKPICard label="Pending Tickets" value={stats.tickets} icon={<FaTicketAlt />} color="amber" trend={[10, 15, 12, 18, 14, 16]} />
          <PremiumKPICard label="Correlated" value={stats.extra} icon={<FaLink />} color="blue" trend={[2, 4, 3, 6, 5, 8]} />
          <PremiumKPICard 
             label="Critical Risk" 
             value={stats.critical_risk} 
             icon={<FaMicrochip size={24} />} 
             color="amber" 
             trend={stats.trends?.critical_risk}
          />
      </div>

      {/* ANALYTICS GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="card creative-hover">
           <div className="flex justify-between items-center mb-4">
              <h3 className="section-title mb-0">Network Health</h3>
              <span className="label-badge text-emerald-600 bg-emerald-50 px-2 py-1 rounded">Stable</span>
           </div>
           <NetworkHealth healthScore={healthScore} />
        </div>

        <div className="card creative-hover">
           <div className="flex justify-between items-center mb-4">
              <h3 className="section-title mb-0">SLA Risk Monitor</h3>
              <span className="label-badge text-blue-600 bg-blue-50 px-2 py-1 rounded font-black">Active Grid</span>
           </div>
           <SLARisk />
        </div>
      </div>

      {/* LIVE FEED + RECENT ACTIONS */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
         <div className="lg:col-span-1 card">
            <h3 className="section-title mb-4">Live Stream</h3>
            <LiveAlarmStream />
         </div>

         <div className="lg:col-span-3 card !p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50 flex justify-between items-center">
               <h3 className="section-title mb-0">Recent Incidents</h3>
               <button className="label-badge text-blue-primary hover:underline">View All</button>
            </div>
            
            <div className="overflow-x-auto">
               <table className="w-full text-left">
                  <thead>
                     <tr className="bg-gray-50 border-b border-gray-100">
                        <th className="table-header table-cell">ID</th>
                        <th className="table-header table-cell">Asset</th>
                        <th className="table-header table-cell">Severity</th>
                        <th className="table-header table-cell">Status</th>
                        <th className="table-header table-cell">Title</th>
                     </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-50">
                     {loading ? (
                        <tr><td colSpan="5" className="table-cell text-center body-text animate-pulse py-10">Syncing data...</td></tr>
                     ) : recentTickets.length === 0 ? (
                        <tr><td colSpan="5" className="table-cell text-center body-text py-10 text-gray-400">No Active Incidents</td></tr>
                     ) : recentTickets.map((t, idx) => (
                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors cursor-pointer body-text">
                           <td className="table-cell font-bold text-blue-primary">
                              {(t.ticket_id || t.global_ticket_id || "TR-X").slice(0, 10)}
                           </td>
                           <td className="table-cell font-medium">{t.device_name}</td>
                           <td className="table-cell"><SeverityBadge sev={t.severity_original} /></td>
                           <td className="table-cell"><StatusBadge status={t.status} /></td>
                           <td className="table-cell truncate max-w-[200px] small-meta">{t.title}</td>
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

function PremiumKPICard({ label, value, icon, color, trend }) {
  const colorMap = {
     blue: "text-blue-600 border-blue-100 bg-white creative-hover shadow-blue-900/5",
     rose: "text-rose-600 border-rose-100 bg-white creative-hover shadow-rose-900/5",
     amber: "text-amber-600 border-amber-100 bg-white creative-hover shadow-amber-900/5"
   };

  const sparkColorMap = {
     blue: "#3b82f6",
     rose: "#f43f5e",
     amber: "#fbbf24"
  };
  
  return (
    <div className={`card p-6 flex flex-col gap-4 group transition-all ${colorMap[color] || colorMap.blue}`}>
       <div className="flex justify-between items-start">
          <div className="p-3 bg-blue-50 rounded-2xl border border-blue-100 transition-all group-hover:scale-110 group-hover:bg-blue-600 group-hover:text-white group-hover:border-blue-700">
             {icon}
          </div>
          <Sparkline data={trend} color={sparkColorMap[color] || "#3b82f6"} />
       </div>
       <div>
          <p className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 mb-1">{label}</p>
          <div className="flex items-baseline gap-2">
             <p className="text-3xl font-black tracking-tighter tabular-nums text-blue-900">{value}</p>
             <div className="flex items-center gap-1 text-[8px] font-bold text-emerald-500 bg-emerald-50 px-1.5 py-0.5 rounded">
                <FaChartLine size={8} /> +12%
             </div>
          </div>
       </div>
    </div>
  );
}

function SeverityBadge({ sev }) {
  const styles = {
    Critical: "bg-red-50 text-red-600",
    Major: "bg-amber-50 text-amber-600",
    Minor: "bg-blue-50 text-blue-600",
    Warning: "bg-gray-50 text-gray-600"
  };
  return (
    <span className={`label-badge px-2 py-0.5 rounded border border-current opacity-90 ${styles[sev] || styles.Warning}`}>
       {sev}
    </span>
  );
}

function StatusBadge({ status }) {
  const color = status?.toLowerCase() === 'closed' ? 'bg-emerald-500' : 'bg-red-500';
  return (
    <div className="flex items-center gap-2">
       <div className={`w-2 h-2 rounded-full ${color}`} />
       <span className="label-badge">{status}</span>
    </div>
  );
}

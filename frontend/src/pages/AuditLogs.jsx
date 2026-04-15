import { useEffect, useState } from "react";
import { getAuditLogs } from "../api/api";
import { 
  History, Clock, User, Activity, 
  Hash, Search, Calendar, RefreshCcw,
  ShieldCheck, ArrowUpRight
} from "lucide-react";
import toast from "react-hot-toast";
import dayjs from "dayjs";

export default function AuditLogs() {
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const fetchLogs = async () => {
    setLoading(true);
    try {
      const res = await getAuditLogs();
      setLogs(Array.isArray(res.data) ? res.data : []);
    } catch (error) {
      console.error("Error fetching audit logs:", error);
      toast.error("Security matrix sync failed");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
  }, []);

  const filteredLogs = logs.filter(log => 
    log.user_name?.toLowerCase().includes(search.toLowerCase()) ||
    log.action?.toLowerCase().includes(search.toLowerCase()) ||
    log.entity_type?.toLowerCase().includes(search.toLowerCase()) ||
    String(log.entity_id).includes(search)
  );

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center premium-card p-6">
        <div>
          <h1 className="page-title mb-1">System Audit Matrix</h1>
          <p className="small-meta uppercase tracking-widest text-blue-500">Cryptographic Activity Ledger & Immutable Logs</p>
        </div>
        <div className="flex gap-4">
           <button 
             onClick={fetchLogs} 
             className="w-10 h-10 bg-white border border-slate-100 rounded-xl flex items-center justify-center text-slate-400 hover:text-blue-600 transition-all shadow-sm"
           >
             <RefreshCcw size={16} className={loading ? "animate-spin" : ""} />
           </button>
           <div className="flex items-center gap-2 px-3 py-1.5 bg-emerald-50 border border-emerald-100 rounded-xl">
             <ShieldCheck size={16} className="text-emerald-600" />
             <span className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Logs Verified</span>
           </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="premium-card p-4 flex flex-col md:flex-row justify-between items-center gap-4">
         <div className="relative w-full md:w-96">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300" />
            <input 
              type="text" 
              placeholder="Filter audit ledger by operative or action..." 
              value={search} 
              onChange={e => setSearch(e.target.value)}
              className="w-full bg-slate-50 border border-slate-100 rounded-xl pl-12 pr-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 transition-all"
            />
         </div>
         <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-4 py-2 bg-slate-50 border border-slate-100 rounded-xl">
               <Calendar size={14} className="text-slate-400" />
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Retention: 90 Days</span>
            </div>
         </div>
      </div>

      {/* LEDGER TABLE */}
      <div className="premium-card p-0 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Timestamp</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Operative</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Action Ledger</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Entity Matrix</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">Node ID</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {loading ? (
                <tr>
                   <td colSpan={5} className="px-6 py-20 text-center">
                      <div className="flex flex-col items-center gap-4">
                         <RefreshCcw size={32} className="text-blue-500 animate-spin opacity-20" />
                         <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-400">Synchronizing Ledger...</p>
                      </div>
                   </td>
                </tr>
              ) : filteredLogs.length === 0 ? (
                <tr>
                   <td colSpan={5} className="px-6 py-20 text-center">
                      <History size={32} className="text-slate-200 mx-auto mb-3" />
                      <p className="text-sm font-bold text-slate-400">No records found in the current matrix</p>
                   </td>
                </tr>
              ) : (
                filteredLogs.map((log) => (
                  <tr key={log.log_id} className="hover:bg-slate-50 transition-all group group/row">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-3">
                         <div className="w-8 h-8 rounded-lg bg-slate-50 flex items-center justify-center text-slate-400 group-hover/row:bg-blue-50 group-hover/row:text-blue-500 transition-colors">
                            <Clock size={14} />
                         </div>
                         <div>
                            <div className="text-xs font-black text-slate-700">{dayjs(log.created_at).format("DD MMM YYYY")}</div>
                            <div className="text-[10px] font-bold text-slate-400 tabular-nums">{dayjs(log.created_at).format("HH:mm:ss")}</div>
                         </div>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <div className="w-2 h-2 rounded-full bg-blue-400 shadow-[0_0_8px_rgba(96,165,250,0.6)]" />
                         <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                           {log.user_name}
                         </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="text-xs font-bold text-slate-600 bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-100 inline-block group-hover/row:bg-white transition-all">
                        {log.action}
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                         <Activity size={12} className="text-slate-400" />
                         <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">
                           {log.entity_type}
                         </span>
                      </div>
                    </td>

                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2 text-blue-600 underline-offset-4 hover:underline cursor-pointer group/id">
                        <Hash size={12} className="text-blue-400" />
                        <span className="text-xs font-black tabular-nums">{log.entity_id}</span>
                        <ArrowUpRight size={10} className="opacity-0 group-hover/id:opacity-100 transition-opacity" />
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        <div className="bg-slate-50/50 px-6 py-4 border-t border-slate-100 flex justify-between items-center">
           <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">Entity Resolution System v4.0</p>
           <p className="text-[10px] font-black uppercase tracking-widest text-blue-400">{filteredLogs.length} Records Retrieved</p>
        </div>
      </div>
    </div>
  );
}
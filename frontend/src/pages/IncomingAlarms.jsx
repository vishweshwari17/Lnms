import { useEffect, useState, useCallback, useRef } from "react";
import { getAlarms, updateAlarmStatus } from "../api/api";
import { useNavigate } from "react-router-dom";
import { 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  RefreshCcw, 
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  Bell,
  ExternalLink,
  Bot
} from "lucide-react";
import dayjs from "dayjs";
import relativeTime from "dayjs/plugin/relativeTime";
import toast from "react-hot-toast";

import KPICard from "../components/KPICard";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";
import FilterSelect from "../components/FilterSelect";

dayjs.extend(relativeTime);

export default function IncomingAlarms() {
  const [alarms, setAlarms] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [totalPages, setTotalPages] = useState(1);
  
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  
  const navigate = useNavigate();
  const prevAlarmIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  const fetchAlarms = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page,
        limit,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };
      
      const res = await getAlarms(params);
      const data = res.data;
      
      setAlarms(data.alarms);
      setTotal(data.total);
      setTotalPages(data.total_pages);
      
      if (!isFirstLoad.current) {
        const newAlarms = data.alarms.filter(a => !prevAlarmIds.current.has(a.alarm_id));
        if (newAlarms.length > 0) {
          newAlarms.forEach(a => {
            toast.custom((t) => (
              <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex border-l-4 border-rose-500 text-white`}>
                <div className="flex-1 w-0 p-4">
                  <div className="flex items-start">
                    <div className="flex-shrink-0 pt-0.5 text-rose-500">
                      <Bell size={20} />
                    </div>
                    <div className="ml-3 flex-1">
                      <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">Alarm Event</p>
                      <p className="mt-1 text-sm font-bold">{a.alarm_name}</p>
                      <p className="mt-1 text-xs text-slate-400">{a.device_name} &bull; {a.severity}</p>
                    </div>
                  </div>
                </div>
                <div className="flex border-l border-slate-800">
                  <button onClick={() => toast.dismiss(t.id)} className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-black text-slate-400 hover:text-white transition-colors uppercase">Dismiss</button>
                </div>
              </div>
            ), { duration: 6000 });
          });
        }
      }
      
      prevAlarmIds.current = new Set(data.alarms.map(a => a.alarm_id));
      isFirstLoad.current = false;
    } catch (err) {
      console.error("Failed to fetch alarms:", err);
    } finally {
      setLoading(false);
    }
  }, [page, limit, startDate, endDate]);

  useEffect(() => {
    fetchAlarms();
    const interval = setInterval(fetchAlarms, 30000);
    return () => clearInterval(interval);
  }, [fetchAlarms]);

  const filteredAlarms = alarms.filter(a => {
    const matchesSearch = !search || 
      a.device_name?.toLowerCase().includes(search.toLowerCase()) || 
      a.alarm_name?.toLowerCase().includes(search.toLowerCase()) ||
      a.alarm_id?.toLowerCase().includes(search.toLowerCase());
    
    const matchesSeverity = severityFilter === "All" || a.severity === severityFilter;
    const matchesStatus = statusFilter === "All" || a.status === statusFilter;
    
    return matchesSearch && matchesSeverity && matchesStatus;
  });

  const handleAction = async (e, id, status) => {
    e.stopPropagation();
    try {
      await updateAlarmStatus(id, status);
      fetchAlarms();
    } catch (err) {
      console.error(err);
    }
  };

  const navigateToDetail = (alarm) => {
    if (alarm.ticket_id) {
      navigate(`/tickets/${alarm.ticket_id}`);
    } else {
      navigate(`/alarms/${alarm.alarm_id}`);
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-rose-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="page-title tracking-tighter uppercase">Signals Tracker</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-rose-600 mt-1 flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-rose-500 rounded-full animate-pulse" />
             Infrastructure Fault Spectrum
          </p>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <button 
            onClick={() => fetchAlarms()}
            className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-500 hover:text-blue-600 transition-all hover:shadow-xl active:scale-95"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <span className="w-2 h-2 bg-rose-500 rounded-full animate-pulse shadow-rose-200 shadow-lg" />
            <span className="text-[11px] font-black text-rose-600 uppercase tracking-widest">Active Scan</span>
          </div>
        </div>
      </div>

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <KPICard label="Volume Pool" value={total} color="blue" icon={<AlertTriangle />} loading={loading} />
        <KPICard label="Critical" value={loading ? "..." : alarms.filter(a => a.severity === "Critical").length} color="rose" icon={<Zap />} loading={loading} />
        <KPICard label="Major Alerts" value={loading ? "..." : alarms.filter(a => a.severity === "Major").length} color="amber" icon={<Clock />} loading={loading} />
        <KPICard label="Resolution Rate" value={loading ? "..." : alarms.filter(a => a.status === "RESOLVED").length} color="green" icon={<CheckCircle />} loading={loading} />
      </div>

      {/* FILTERS & SEARCH */}
      <div className="card shadow-sm border-slate-100 p-8 space-y-8">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div className="flex flex-wrap gap-4 items-end flex-1">
             <div className="flex flex-col gap-1.5 flex-1 min-w-[300px]">
               <span className="section-title !mb-0 text-[9px]">Asset Search</span>
               <div className="relative">
                 <Bot className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   type="text"
                   placeholder="Identify by Device ID, Name or IP..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3 body-text font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                 />
               </div>
             </div>

             <FilterSelect value={severityFilter} onChange={setSeverityFilter} options={["All", "Critical", "Major", "Minor"]} label="Severity Filter" />
             <FilterSelect value={statusFilter} onChange={setStatusFilter} options={["All", "OPEN", "ACK", "RESOLVED"]} label="State Filter" />
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5">
               <span className="section-title !mb-0 text-[9px]">Timeline Range</span>
               <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                  <Calendar size={14} className="text-slate-400" />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-xs font-black outline-none" />
                  <span className="text-[10px] font-black text-slate-300">TO</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-xs font-black outline-none" />
               </div>
            </div>

            <button 
              onClick={() => { setSearch(""); setSeverityFilter("All"); setStatusFilter("All"); setStartDate(""); setEndDate(""); }}
              className="px-6 py-3 text-[10px] font-black text-slate-400 hover:text-rose-600 transition-colors uppercase tracking-widest"
            >
              Flush Filters
            </button>
          </div>
        </div>

        {/* TABLE Area */}
        <div className="overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="table-header table-cell">Entity ID</th>
                <th className="table-header table-cell">Entity Specs</th>
                <th className="table-header table-cell">Fault Vector</th>
                <th className="table-header table-cell">Severity</th>
                <th className="table-header table-cell">Condition</th>
                <th className="table-header table-cell">Timestamp</th>
                <th className="table-header table-cell text-center">Operations</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center py-20 animate-pulse font-black text-slate-300 uppercase tracking-widest">Compiling signal data...</td></tr>
              ) : filteredAlarms.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-20">
                    <Zap className="mx-auto text-slate-200 mb-4" size={48} />
                    <p className="body-text font-black text-slate-400 uppercase tracking-widest">No signals intercepted</p>
                  </td>
                </tr>
              ) : (
                filteredAlarms.map((a) => (
                  <tr key={a.alarm_id} className="hover:bg-slate-50/50 cursor-pointer transition-colors group" onClick={() => navigateToDetail(a)}>
                    <td className="table-cell font-black text-blue-primary text-xs uppercase">{a.alarm_id.slice(0, 8)}</td>
                    <td className="table-cell">
                      <div className="font-bold text-slate-900">{a.device_name}</div>
                      <div className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">{a.ip_address}</div>
                    </td>
                    <td className="table-cell">
                      <div className="font-bold text-slate-700">{a.alarm_name}</div>
                      <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full uppercase tracking-tighter">{a.source || "LNMS"}</span>
                    </td>
                    <td className="table-cell"><SeverityBadge sev={a.severity} /></td>
                    <td className="table-cell"><StatusBadge status={a.status} /></td>
                    <td className="table-cell">
                      <div className="font-bold text-slate-700">{dayjs(a.created_at).format("DD MMM, HH:mm")}</div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{dayjs(a.created_at).fromNow()}</div>
                    </td>
                    <td className="table-cell" onClick={(e) => e.stopPropagation()}>
                       <div className="flex justify-center items-center gap-3">
                          {a.status !== "RESOLVED" && (
                            <>
                              <button onClick={(e) => handleAction(e, a.alarm_id, "Ack")} className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl bg-transparent transition-all"><Clock size={16} /></button>
                              <button onClick={(e) => handleAction(e, a.alarm_id, "Resolved")} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl bg-transparent transition-all"><CheckCircle size={16} /></button>
                            </>
                          )}
                          <button className="p-2 text-blue-primary hover:bg-blue-50 rounded-xl bg-transparent transition-all"><ExternalLink size={16} /></button>
                       </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="flex flex-col sm:flex-row justify-between items-center gap-6 pt-6 px-2">
          <div className="flex items-center gap-6">
             <div className="flex items-center gap-3">
               <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Density</span>
               <select value={limit} onChange={(e) => { setLimit(Number(e.target.value)); setPage(1); }} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-black outline-none cursor-pointer">
                 {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} ROWS</option>)}
               </select>
             </div>
             <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
               Entry { (page-1)*limit + 1} &mdash; {Math.min(page*limit, total)} OF {total}
             </span>
          </div>

          <div className="flex items-center gap-3">
            <button disabled={page === 1} onClick={() => setPage(p => Math.max(1, p - 1))} className="w-10 h-10 flex items-center justify-center border border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-20 transition-colors"><ChevronLeft size={16} /></button>
            <div className="flex items-center gap-1.5">
               {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || (p >= page - 1 && p <= page + 1)).map((p, i, arr) => (
                  <div key={p} className="flex items-center gap-1.5">
                    {i > 0 && p - arr[i-1] > 1 && <span className="text-slate-300 px-1 font-black">...</span>}
                    <button onClick={() => setPage(p)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${page === p ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-400 hover:bg-slate-50"}`}>{p}</button>
                  </div>
                ))}
            </div>
            <button disabled={page === totalPages} onClick={() => setPage(p => Math.min(totalPages, p + 1))} className="w-10 h-10 flex items-center justify-center border border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-20 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

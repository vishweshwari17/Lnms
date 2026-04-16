import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api, { getTickets, acknowledgeTicket, resolveTicket } from "../api/api";
import { 
  Plus, 
  Search, 
  RefreshCcw, 
  ChevronLeft, 
  ChevronRight, 
  Ticket as TicketIcon, 
  Bell, 
  CheckCircle, 
  Clock,
  Zap,
  Calendar,
  ExternalLink
} from "lucide-react";
import toast from "react-hot-toast";

import KPICard from "../components/KPICard";
import SeverityBadge from "../components/SeverityBadge";
import StatusBadge from "../components/StatusBadge";
import FilterSelect from "../components/FilterSelect";

const SEVERITY_ORDER = { Critical: 3, Major: 2, Minor: 1, Warning: 0 };
const VALID_FILTER_STATUSES = ["All", "OPEN", "ACK", "RESOLVED", "CLOSED"];

export default function Tickets() {
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  const [filter, setFilter] = useState("All");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [search, setSearch] = useState("");
  const [sortSeverity, setSortSeverity] = useState(false);
  
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");

  const prevTicketIds = useRef(new Set());
  const isFirstLoad = useRef(true);

  const fetchTickets = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        page: currentPage,
        limit: rowsPerPage,
        start_date: startDate || undefined,
        end_date: endDate || undefined,
      };
      const res = await getTickets(params);
      if (res?.data) {
        const data = res.data;
        setTickets(data.tickets);
        setTotal(data.total);
        setTotalPages(data.total_pages);

        if (!isFirstLoad.current) {
          const newTickets = data.tickets.filter(t => !prevTicketIds.current.has(t.ticket_id));
          if (newTickets.length > 0) {
            newTickets.forEach(t => {
              toast.custom((toastObj) => (
                <div className={`${toastObj.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-slate-900 shadow-2xl rounded-2xl pointer-events-auto flex border-l-4 border-blue-500 text-white`}>
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5 text-blue-500">
                        <Bell size={20} />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-[10px] font-black uppercase text-slate-400 tracking-widest">New Ticket</p>
                        <p className="mt-1 text-sm font-bold">{t.title}</p>
                        <p className="mt-1 text-xs text-slate-400">{t.device_name} &bull; {t.severity_calculated}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-slate-800">
                    <button onClick={() => toast.dismiss(toastObj.id)} className="w-full border border-transparent rounded-none rounded-r-2xl p-4 flex items-center justify-center text-xs font-black text-slate-400 hover:text-white transition-colors uppercase">Dismiss</button>
                  </div>
                </div>
              ), { duration: 6000 });
            });
          }
        }
        
        prevTicketIds.current = new Set(data.tickets.map(t => t.ticket_id));
        isFirstLoad.current = false;
      }
    } catch (err) {
      console.error("Ticket fetch error:", err);
    } finally {
      setLoading(false);
    }
  }, [currentPage, rowsPerPage, startDate, endDate]);

  useEffect(() => {
    fetchTickets();
    const id = setInterval(fetchTickets, 30000);
    return () => clearInterval(id);
  }, [fetchTickets]);

  const handleAck = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    try {
      await acknowledgeTicket(id);
      toast.success("Engagement logged");
      fetchTickets();
    } catch (err) {
      toast.error("Operation failed");
    }
  };

  const handleResolve = async (e, id) => {
    e.preventDefault();
    e.stopPropagation();
    const notes = window.prompt("Tactical resolution notes:");
    if (notes === null) return;
    try {
      await resolveTicket(id, { resolution_notes: notes });
      toast.success("Incident resolved");
      fetchTickets();
    } catch (err) {
      toast.error("Resolution failure");
    }
  };

  const counts = {
    open: tickets.filter(t => t.status === "OPEN").length,
    ack: tickets.filter(t => t.status === "ACK").length,
    resolved: tickets.filter(t => t.status === "RESOLVED").length,
    critical: tickets.filter(t => t.severity_calculated === "Critical").length
  };

  const filteredTickets = useMemo(() => {
    let data = [...tickets];
    if (filter !== "All") data = data.filter(t => t.status === filter);
    if (severityFilter !== "All") data = data.filter(t => t.severity_calculated === severityFilter);
    if (search) {
      const term = search.toLowerCase();
      data = data.filter(t =>
        t.global_ticket_id?.toLowerCase().includes(term) ||
        t.ticket_id?.toLowerCase().includes(term) ||
        t.device_name?.toLowerCase().includes(term) ||
        t.title?.toLowerCase().includes(term)
      );
    }
    return data;
  }, [tickets, filter, severityFilter, search]);

  const sortedTickets = useMemo(() => {
    if (!sortSeverity) return filteredTickets;
    return [...filteredTickets].sort((a, b) => (SEVERITY_ORDER[b.severity_calculated] || 0) - (SEVERITY_ORDER[a.severity_calculated] || 0));
  }, [filteredTickets, sortSeverity]);

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="page-title tracking-tighter uppercase">Incident Registry</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-indigo-600 mt-1 flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-indigo-500 rounded-full animate-pulse shadow-indigo-200 shadow-lg" />
             Strategic Dispatch &bull; LNMS Operations Tier 1
          </p>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
          <button 
            onClick={() => fetchTickets()}
            className="w-12 h-12 bg-white border border-slate-100 rounded-2xl flex items-center justify-center text-slate-500 hover:text-indigo-600 transition-all hover:shadow-xl active:scale-95 group"
          >
            <RefreshCcw size={18} className={loading ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"} />
          </button>
          <div className="flex items-center gap-3 px-4 py-2 bg-slate-50 rounded-2xl border border-slate-100">
            <Zap size={14} className="text-indigo-500 animate-pulse" />
            <span className="text-[11px] font-black text-indigo-600 uppercase tracking-widest">Master Auth</span>
          </div>
        </div>
      </div>

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <KPICard label="Active Pool" value={total} color="blue" icon={<TicketIcon />} loading={loading} trend={[20, 22, 18, 25, 23, 27]} />
        <KPICard label="Critical" value={counts.critical} color="red" icon={<Zap />} loading={loading} trend={[5, 8, 4, 9, 6, 10]} />
        <KPICard label="Acknowledged" value={counts.ack} color="amber" icon={<Clock />} loading={loading} trend={[10, 12, 11, 14, 13, 15]} />
        <KPICard label="Resolved Today" value={counts.resolved} color="green" icon={<CheckCircle />} loading={loading} trend={[100, 105, 102, 108, 110, 115]} />
      </div>

      {/* FILTERS & SEARCH */}
      <div className="card shadow-sm border-slate-100 p-8 space-y-8">
        <div className="flex flex-col lg:flex-row justify-between gap-6">
          <div className="flex flex-wrap gap-4 items-end flex-1">
             <div className="flex flex-col gap-1.5 flex-1 min-w-[300px]">
               <span className="section-title !mb-0 text-[9px]">Insight Search</span>
               <div className="relative">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                 <input 
                   type="text"
                   placeholder="Identify by Ticket Code, Subject or Host..."
                   value={search}
                   onChange={(e) => setSearch(e.target.value)}
                   className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3 body-text font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
                 />
               </div>
             </div>

             <FilterSelect value={filter} onChange={setFilter} options={VALID_FILTER_STATUSES} label="Lifecycle Status" />
             <FilterSelect value={severityFilter} onChange={setSeverityFilter} options={["All", "Critical", "Major", "Minor"]} label="Priority Profile" />
          </div>

          <div className="flex flex-wrap gap-4 items-end">
            <div className="flex flex-col gap-1.5">
               <span className="section-title !mb-0 text-[9px]">Temporal Range</span>
               <div className="flex items-center gap-3 px-4 py-3 bg-slate-50 border border-slate-100 rounded-2xl">
                  <Calendar size={14} className="text-slate-400" />
                  <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="bg-transparent text-xs font-black outline-none" />
                  <span className="text-[10px] font-black text-slate-300">TO</span>
                  <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="bg-transparent text-xs font-black outline-none" />
               </div>
            </div>

            <button 
              onClick={() => { setSearch(""); setSeverityFilter("All"); setFilter("All"); setStartDate(""); setEndDate(""); }}
              className="px-6 py-3 text-[10px] font-black text-slate-400 hover:text-rose-600 transition-colors uppercase tracking-widest"
            >
              Reset Registry
            </button>
          </div>
        </div>

        {/* TABLE Area */}
        <div className="overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="table-header table-cell">Ticket ID</th>
                <th className="table-header table-cell">Incident Subject</th>
                <th className="table-header table-cell">Asset Origin</th>
                <th className="table-header table-cell cursor-pointer group" onClick={() => setSortSeverity(s => !s)}>
                   <div className="flex items-center gap-2">
                     Priority {sortSeverity ? "↓" : "↕"}
                   </div>
                </th>
                <th className="table-header table-cell text-center">Lifecycle</th>
                <th className="table-header table-cell text-center text-slate-300">Sync Status</th>
                <th className="table-header table-cell text-right">Ops</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan={7} className="table-cell text-center py-20 animate-pulse font-black text-slate-300 uppercase tracking-widest">Hydrating data vectors...</td></tr>
              ) : sortedTickets.length === 0 ? (
                <tr>
                  <td colSpan={7} className="table-cell text-center py-20">
                    <TicketIcon className="mx-auto text-slate-200 mb-4" size={48} />
                    <p className="body-text font-black text-slate-400 uppercase tracking-widest">No active logs</p>
                  </td>
                </tr>
              ) : (
                sortedTickets.map((t) => (
                  <tr key={t.ticket_id} className="hover:bg-slate-50/50 cursor-pointer transition-colors group" onClick={() => navigate(`/tickets/${t.ticket_id}`)}>
                    <td className="table-cell font-black text-blue-primary text-xs uppercase">{t.ticket_id.slice(0, 10)}</td>
                    <td className="table-cell">
                      <div className="font-bold text-slate-900 group-hover:text-blue-600 transition-colors">{t.title}</div>
                      <div className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">{new Date(t.created_at).toLocaleString()}</div>
                    </td>
                    <td className="table-cell">
                      <div className="font-bold text-slate-700">{t.device_name}</div>
                      <div className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">{t.ip_address || "UNMAPPED"}</div>
                    </td>
                    <td className="table-cell"><SeverityBadge sev={t.severity_calculated} /></td>
                    <td className="table-cell"><div className="flex justify-center"><StatusBadge status={t.status} /></div></td>
                    <td className="table-cell align-middle">
                       <div className="flex justify-center items-center gap-2 opacity-50">
                          <div className={`w-1.5 h-1.5 rounded-full ${t.sync_status === 'synced' ? 'bg-emerald-500' : 'bg-amber-500 animate-pulse'}`} />
                          <span className="text-[9px] font-black uppercase">{t.sync_status || 'pending'}</span>
                       </div>
                    </td>
                    <td className="table-cell text-right" onClick={(e) => e.stopPropagation()}>
                       <div className="flex justify-end items-center gap-3">
                          {t.status === "OPEN" && (
                            <button onClick={(e) => handleAck(e, t.ticket_id)} className="p-2 text-amber-500 hover:bg-amber-50 rounded-xl bg-transparent transition-all"><Clock size={16} /></button>
                          )}
                          {t.status !== "RESOLVED" && t.status !== "CLOSED" && (
                            <button onClick={(e) => handleResolve(e, t.ticket_id)} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl bg-transparent transition-all"><CheckCircle size={16} /></button>
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
               <select value={rowsPerPage} onChange={(e) => { setRowsPerPage(Number(e.target.value)); setCurrentPage(1); }} className="bg-slate-50 border border-slate-100 rounded-xl px-3 py-1.5 text-xs font-black outline-none cursor-pointer">
                 {[10, 25, 50, 100].map(n => <option key={n} value={n}>{n} LOGS</option>)}
               </select>
             </div>
             <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                LOG { (currentPage-1)*rowsPerPage + 1} &mdash; {Math.min(currentPage*rowsPerPage, total)} OF {total}
             </p>
          </div>

          <div className="flex items-center gap-3">
            <button disabled={currentPage === 1} onClick={() => setCurrentPage(p => Math.max(1, p - 1))} className="w-10 h-10 flex items-center justify-center border border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-20 transition-colors"><ChevronLeft size={16} /></button>
            <div className="flex items-center gap-1.5">
               {Array.from({ length: totalPages }, (_, i) => i + 1).filter(p => p === 1 || p === totalPages || (p >= currentPage - 1 && p <= currentPage + 1)).map((p, i, arr) => (
                  <div key={p} className="flex items-center gap-1.5">
                    {i > 0 && p - arr[i-1] > 1 && <span className="text-slate-300 px-1 font-black">...</span>}
                    <button onClick={() => setCurrentPage(p)} className={`w-10 h-10 rounded-xl text-xs font-black transition-all ${currentPage === p ? "bg-slate-900 text-white shadow-xl shadow-slate-200" : "text-slate-400 hover:bg-slate-50"}`}>{p}</button>
                  </div>
                ))}
            </div>
            <button disabled={currentPage === totalPages} onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} className="w-10 h-10 flex items-center justify-center border border-slate-100 rounded-xl hover:bg-slate-50 disabled:opacity-20 transition-colors"><ChevronRight size={16} /></button>
          </div>
        </div>
      </div>
    </div>
  );
}

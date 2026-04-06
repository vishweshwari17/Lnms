// src/pages/Tickets.jsx  (LNMS)
import { useEffect, useState, useMemo, useCallback, useRef } from "react";
import { Link } from "react-router-dom";
import api, { getTickets } from "../api/api";
import StatusBadge from "../components/StatusBadge";
import { Calendar, Search, Filter, RefreshCcw, ChevronLeft, ChevronRight, Ticket as TicketIcon, Bell } from "lucide-react";
import toast from "react-hot-toast";

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

  const formatTime = (time) => {
    if (!time) return "\u2014";
    return new Date(time).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata",
      year: "numeric", month: "numeric", day: "numeric",
      hour: "2-digit", minute: "2-digit", hour12: true,
    });
  };

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

        // Check for new tickets
        if (!isFirstLoad.current) {
          const newTickets = data.tickets.filter(t => !prevTicketIds.current.has(t.ticket_id));
          if (newTickets.length > 0) {
            newTickets.forEach(t => {
              toast.custom((toastObj) => (
                <div className={`${toastObj.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-white shadow-2xl rounded-[1.5rem] pointer-events-auto flex ring-1 ring-black ring-opacity-5 border-l-8 border-indigo-500`}>
                  <div className="flex-1 w-0 p-4">
                    <div className="flex items-start">
                      <div className="flex-shrink-0 pt-0.5 text-indigo-500">
                        <Bell size={24} />
                      </div>
                      <div className="ml-3 flex-1">
                        <p className="text-xs font-black text-slate-400 uppercase tracking-widest">New Ticket Generated</p>
                        <p className="mt-1 text-sm font-bold text-slate-900">{t.title}</p>
                        <p className="mt-1 text-xs text-slate-500 font-medium">{t.device_name} — {t.severity_calculated}</p>
                      </div>
                    </div>
                  </div>
                  <div className="flex border-l border-gray-200">
                    <button onClick={() => toast.dismiss(toastObj.id)} className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-black text-indigo-600 hover:text-indigo-500 focus:outline-none">Close</button>
                  </div>
                </div>
              ), { duration: 6000 });
            });
          }
        }
        
        // Update refs
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

  const openCount = tickets.filter(t => t.status === "OPEN").length;
  const ackCount = tickets.filter(t => t.status === "ACK").length;
  const resolvedCount = tickets.filter(t => t.status === "RESOLVED").length;
  const closedCount = tickets.filter(t => t.status === "CLOSED").length;
  const syncedCount = tickets.filter(t => t.sync_status === "synced").length;
  const pendingCount = tickets.filter(t => t.sync_status === "pending").length;

  const filteredTickets = useMemo(() => {
    let data = [...tickets];
    if (filter !== "All") {
      data = data.filter(t => t.status === filter);
    }
    if (severityFilter !== "All") {
      data = data.filter(t => t.severity_calculated === severityFilter);
    }
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
    return [...filteredTickets].sort(
      (a, b) =>
        (SEVERITY_ORDER[b.severity_calculated] || 0) -
        (SEVERITY_ORDER[a.severity_calculated] || 0)
    );
  }, [filteredTickets, sortSeverity]);

  return (
    <div className="p-8 bg-slate-50 min-h-screen font-sans">
      <div className="flex justify-between items-center mb-10">
        <div>
          <h1 className="text-3xl font-extrabold text-slate-900 tracking-tight">Support Tickets</h1>
          <p className="text-slate-500 mt-1 uppercase text-[10px] font-black tracking-widest">Unified Helpdesk Dashboard</p>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={() => fetchTickets()}
            className="p-2 bg-white rounded-xl shadow-sm border border-slate-100 text-slate-500 hover:text-indigo-600 transition-colors"
          >
            <RefreshCcw size={20} className={loading ? "animate-spin" : ""} />
          </button>
          <div className="flex items-center bg-white px-4 py-2 rounded-2xl shadow-sm border border-slate-100">
            <span className="w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse mr-2.5" />
            <span className="text-slate-600 text-sm font-semibold tracking-tight">Live Auto-Sync</span>
          </div>
        </div>
      </div>

      <div className="grid fgrid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6 mb-10">
        <KPI title="Total Tickets" value={total} color="bg-indigo-50 text-indigo-700 border-indigo-100" />
        <KPI title="Open" value={openCount} color="bg-red-50 text-red-700 border-red-100" />
        <KPI title="Acknowledged" value={ackCount} color="bg-amber-50 text-amber-700 border-amber-100" />
        <KPI title="Resolved" value={resolvedCount} color="bg-emerald-50 text-emerald-700 border-emerald-100" />
        <KPI title="Synced" value={syncedCount} color="bg-blue-50 text-blue-700 border-blue-100" />
        <KPI title="Pending" value={pendingCount} color="bg-orange-50 text-orange-700 border-orange-100" />
      </div>

      <div className="bg-white rounded-[2.5rem] shadow-xl shadow-slate-200/40 p-8 border border-slate-100 overflow-hidden relative">
        <div className="flex flex-col lg:flex-row justify-between gap-6 mb-8">
          <div className="flex flex-wrap gap-2 p-1.5 bg-slate-50 rounded-2xl w-fit">
            {VALID_FILTER_STATUSES.map(tab => (
              <button
                key={tab}
                onClick={() => setFilter(tab)}
                className={
                  "px-6 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest transition-all duration-300 " +
                  (filter === tab
                    ? "bg-indigo-600 text-white shadow-xl shadow-indigo-200 scale-105"
                    : "text-slate-400 hover:text-slate-600 hover:bg-white")
                }
              >
                {tab === "All" ? "All" : tab}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-4 items-center">
            {/* Date Filters */}
            <div className="flex items-center gap-2 bg-slate-50 p-1 rounded-2xl shadow-inner border border-slate-100">
               <div className="relative flex items-center">
                 <Calendar className="absolute left-3 text-slate-400" size={14} />
                 <input 
                   type="date"
                   value={startDate}
                   onChange={(e) => { setStartDate(e.target.value); setCurrentPage(1); }}
                   className="pl-9 pr-3 py-2 bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 outline-none cursor-pointer"
                 />
               </div>
               <span className="text-slate-300 font-bold">to</span>
               <div className="relative flex items-center">
                 <Calendar className="absolute left-3 text-slate-400" size={14} />
                 <input 
                   type="date"
                   value={endDate}
                   onChange={(e) => { setEndDate(e.target.value); setCurrentPage(1); }}
                   className="pl-9 pr-3 py-2 bg-transparent border-none text-[11px] font-black uppercase tracking-widest text-slate-600 focus:ring-0 outline-none cursor-pointer"
                 />
               </div>
            </div>

            <div className="relative group">
              <input
                type="text"
                placeholder="Quick search..."
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="pl-12 pr-6 py-3 bg-slate-50 border-transparent rounded-[1.25rem] w-80 focus:ring-4 focus:ring-indigo-100 focus:bg-white transition-all duration-500 outline-none font-bold text-slate-700 placeholder-slate-300 shadow-inner"
              />
              <span className="absolute left-5 top-3.5 opacity-30 group-focus-within:opacity-100 transition-opacity"><Search size={18} /></span>
            </div>
            
            <select
              value={severityFilter}
              onChange={e => setSeverityFilter(e.target.value)}
              className="px-6 py-3 bg-slate-50 border-transparent rounded-[1.25rem] focus:ring-4 focus:ring-indigo-100 focus:bg-white font-black text-[11px] uppercase tracking-widest text-slate-500 transition-all cursor-pointer outline-none shadow-inner"
            >
              <option value="All">All Severity</option>
              <option>Critical</option>
              <option>Major</option>
              <option>Minor</option>
            </select>
          </div>
        </div>

        <div className="overflow-x-auto rounded-3xl border border-slate-100 shadow-inner bg-slate-50/20">
          <table className="w-full text-sm border-collapse">
            <thead className="bg-indigo-600 text-indigo-50">
              <tr>
                <th className="px-8 py-5 text-left font-black text-[10px] uppercase tracking-[0.2em]">ID</th>
                <th className="px-8 py-5 text-left font-black text-[10px] uppercase tracking-[0.2em]">Ticket Details</th>
                <th className="px-8 py-5 text-left font-black text-[10px] uppercase tracking-[0.2em]">Device</th>
                <th
                  className="px-8 py-5 text-left font-black text-[10px] uppercase tracking-[0.2em] cursor-pointer hover:text-white transition-colors"
                  onClick={() => setSortSeverity(s => !s)}
                >
                  Severity {sortSeverity ? "↓" : "↕"}
                </th>
                <th className="px-8 py-5 text-left font-black text-[10px] uppercase tracking-[0.2em]">Status</th>
                <th className="px-8 py-5 text-left font-black text-[10px] uppercase tracking-[0.2em]">Synchronization</th>
                <th className="px-8 py-5 text-center font-black text-[10px] uppercase tracking-[0.2em]">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {loading ? (
                <tr>
                  <td colSpan={7} className="text-center py-32">
                    <RefreshCcw className="animate-spin text-indigo-600 mx-auto mb-4" size={40} />
                    <p className="font-bold text-slate-400 uppercase tracking-widest text-xs">Loading tickets...</p>
                  </td>
                </tr>
              ) : sortedTickets.map(ticket => {
                const ticketIdentifier = ticket.ticket_id || ticket.global_ticket_id;
                return (
                  <tr key={ticketIdentifier} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-6 font-mono text-[10px] text-indigo-500 font-black">
                      {ticketIdentifier.slice(0, 16)}
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-black text-slate-800 text-base leading-tight group-hover:text-indigo-600 transition-colors">{ticket.title}</div>
                      <div className="text-[10px] font-bold text-slate-300 mt-1.5 uppercase tracking-wider">{formatTime(ticket.created_at)}</div>
                    </td>
                    <td className="px-8 py-6">
                      <div className="font-bold text-slate-600">{ticket.device_name}</div>
                      <div className="text-[10px] text-slate-400 font-medium">{ticket.ip_address || "No IP Linked"}</div>
                    </td>
                    <td className="px-8 py-6">
                      <SeverityBadge sev={ticket.severity_calculated} />
                    </td>
                    <td className="px-8 py-6">
                      <StatusBadge status={ticket.status} />
                    </td>
                    <td className="px-8 py-6">
                      <div className="flex flex-col gap-1.5">
                        <SyncBadge status={ticket.sync_status || "pending"} />
                        {!ticket.sent_to_cnms_at && (
                          <span className="text-[9px] font-black text-orange-500 uppercase tracking-tighter ml-1">⏱ PUSH PENDING</span>
                        )}
                      </div>
                    </td>
                    <td className="px-8 py-6 text-center">
                      <Link
                        to={"/tickets/" + ticketIdentifier}
                        className="inline-flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-full hover:bg-indigo-500 hover:rotate-12 hover:scale-110 transition-all duration-300 shadow-lg shadow-indigo-100"
                      >
                        →
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {!loading && sortedTickets.length === 0 && (
                <tr>
                  <td colSpan={7} className="text-center py-32">
                    <div className="text-6xl mb-6 grayscale opacity-20"><TicketIcon size={64} className="mx-auto" /></div>
                    <div className="text-xl font-black text-slate-900 tracking-tight">No tickets found</div>
                    <div className="text-sm text-slate-400 font-bold mt-2">Try adjusting your filters or search terms</div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="flex flex-col md:flex-row justify-between items-center gap-8 mt-12 px-2">
          <div className="flex items-center gap-6 bg-slate-50 px-6 py-3 rounded-2xl shadow-inner">
            <div className="flex items-center gap-3">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.15em]">Page Size</span>
              <select
                value={rowsPerPage}
                onChange={e => {
                  setRowsPerPage(Number(e.target.value));
                  setCurrentPage(1);
                }}
                className="bg-white border-transparent rounded-xl text-xs font-black px-4 py-1.5 shadow-sm outline-none cursor-pointer focus:ring-2 focus:ring-indigo-500"
              >
                {[10, 25, 50, 100].map(n => (
                  <option key={n} value={n}>{n}</option>
                ))}
              </select>
            </div>
            <div className="w-px h-6 bg-slate-200" />
            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
              Showing <span className="text-indigo-600 font-black">{(currentPage - 1) * rowsPerPage + 1}</span> - <span className="text-indigo-600 font-black">{Math.min(currentPage * rowsPerPage, total)}</span> of <span className="text-indigo-600 font-black">{total}</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={() => setCurrentPage(p => Math.max(p - 1, 1))}
              disabled={currentPage === 1}
              className="w-12 h-12 flex items-center justify-center bg-white border-2 border-slate-100 text-slate-900 rounded-2xl disabled:opacity-20 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm group"
            >
              <ChevronLeft size={20} className="group-hover:-translate-x-1 transition-transform" />
            </button>

            <div className="flex gap-2 items-center">
              {Array.from({ length: totalPages }, (_, i) => {
                const pageNum = i + 1;
                if (
                  pageNum === 1 ||
                  pageNum === totalPages ||
                  (pageNum >= currentPage - 1 && pageNum <= currentPage + 1)
                ) {
                  return (
                    <button
                      key={i}
                      onClick={() => setCurrentPage(pageNum)}
                      className={
                        "min-w-[48px] h-[48px] flex items-center justify-center text-xs font-black rounded-2xl transition-all duration-300 " +
                        (currentPage === pageNum
                          ? "bg-indigo-600 text-white shadow-2xl shadow-indigo-200 scale-110 -translate-y-1"
                          : "bg-white border-2 border-slate-50 text-slate-400 hover:border-slate-200 hover:text-slate-600")
                      }
                    >
                      {pageNum}
                    </button>
                  );
                } else if (
                  pageNum === currentPage - 2 ||
                  pageNum === currentPage + 2
                ) {
                  return <span key={i} className="text-slate-200 font-black mx-1">···</span>;
                }
                return null;
              })}
            </div>

            <button
              onClick={() => setCurrentPage(p => Math.min(p + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="w-12 h-12 flex items-center justify-center bg-white border-2 border-slate-100 text-slate-900 rounded-2xl disabled:opacity-20 hover:border-indigo-600 hover:text-indigo-600 transition-all shadow-sm group"
            >
              <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function KPI({ title, value, color }) {
  return (
    <div className={`p-8 rounded-[2rem] border-2 transition-all duration-500 hover:translate-y-[-5px] cursor-default group relative overflow-hidden ${color}`}>
      <div className="absolute top-[-20%] right-[-10%] w-32 h-32 bg-white/10 rounded-full blur-3xl group-hover:scale-150 transition-transform duration-1000" />
      <p className="text-[9px] font-black uppercase tracking-[0.25em] mb-3 opacity-60 group-hover:opacity-100 transition-opacity">{title}</p>
      <p className="text-4xl font-black tracking-tighter leading-none group-hover:scale-110 transition-transform origin-left">{value.toLocaleString()}</p>
    </div>
  );
}

function SeverityBadge({ sev }) {
  const styles = {
    Critical: "bg-red-500 text-white shadow-red-200",
    Major: "bg-orange-500 text-white shadow-orange-200",
    Minor: "bg-amber-500 text-white shadow-amber-200",
    Warning: "bg-blue-500 text-white shadow-blue-200",
  };
  const s = styles[sev] || "bg-slate-400 text-white shadow-slate-200";
  return (
    <span className={`px-4 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-[0.15em] shadow-lg ${s} transition-all duration-300 hover:scale-105 hover:brightness-110`}>
      {sev || "—"}
    </span>
  );
}

function SyncBadge({ status }) {
  const styles = {
    synced: "bg-emerald-500",
    pending: "bg-amber-500",
    out_of_sync: "bg-rose-500",
    conflict: "bg-purple-600",
  };
  const labels = {
    synced: "Synced", pending: "Waiting", out_of_sync: "Drift", conflict: "Sync Err",
  };
  const key = status?.toLowerCase() in styles ? status.toLowerCase() : "pending";
  return (
    <div className="flex items-center gap-2">
      <div className={`w-1.5 h-1.5 rounded-full ${styles[key]} animate-pulse`} />
      <span className="text-[10px] font-black uppercase tracking-widest text-slate-500">{labels[key]}</span>
    </div>
  );
}

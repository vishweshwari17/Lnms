// src/pages/TicketDetails.jsx  ─ LNMS
// LNMS = RIGHT side (teal/green bubbles) | CNMS = LEFT side (white bubbles)
//
// ID FLOW (LNMS side):
//   useParams() gives the shared/global ticket identifier from the URL
//   ticket.ticket_id        = canonical LNMS identifier
//   ticket.global_ticket_id = optional mirror field from CNMS payloads
//
// ALL API calls use  id  from useParams() — never ticket.id

import { useEffect, useRef, useState, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { getTicket, addComment } from "../api/api";
import {
  ArrowLeft, Send, CheckCheck, RefreshCw,
  Wifi, WifiOff, AlertTriangle,
} from "lucide-react";

/* ─── helpers ─── */
const fmtFull = (d) =>
  d ? new Date(d).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
    year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
  }) : "—";

const fmtTime = (d) =>
  d ? new Date(d).toLocaleTimeString("en-IN", {
    timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", hour12: true,
  }) : "";

/* ─── normalise status string to uppercase key ─── */
const normalizeStatus = (raw) => {
  const v = String(raw || "").trim().toUpperCase();
  if (["ACK", "ACKNOWLEDGED"].includes(v)) return "ACK";
  if (["RESOLVED", "RESOLVE"].includes(v))  return "RESOLVED";
  if (v === "CLOSED")                        return "CLOSED";
  return "OPEN";
};

/* ─── who "owns" this side ─── */
// On LNMS, messages from LNMS / USER / ADMIN appear on the RIGHT (teal)
const isMine = (sender) =>
  ["LNMS", "USER", "ADMIN"].includes((sender ?? "").toUpperCase());

/* ─── colours ─── */
const SEV = { Critical: "#ef4444", Major: "#f97316", Minor: "#eab308", Warning: "#3b82f6" };
const STATUS = {
  OPEN:     { c: "#3b82f6", bg: "#eff6ff", label: "Open" },
  ACK:      { c: "#f97316", bg: "#fff7ed", label: "Acknowledged" },
  RESOLVED: { c: "#22c55e", bg: "#f0fdf4", label: "Resolved" },
  CLOSED:   { c: "#6b7280", bg: "#f9fafb", label: "Closed" },
};

/* ─── SyncBadge ─── */
const SYNC_STYLE = {
  synced:      "bg-emerald-100 text-emerald-700 border-emerald-200",
  pending:     "bg-amber-100   text-amber-700   border-amber-200",
  out_of_sync: "bg-orange-100  text-orange-700  border-orange-200",
  conflict:    "bg-red-100     text-red-700     border-red-200",
};
const SYNC_LABEL = { synced: "Synced", pending: "Pending", out_of_sync: "Out of Sync", conflict: "Conflict" };

function SyncBadge({ status }) {
  return (
    <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${SYNC_STYLE[status] || SYNC_STYLE.pending}`}>
      {SYNC_LABEL[status] || "Pending"}
    </span>
  );
}

/* ─── sync status derivation ─── */
function getSyncStatus(ticket, messages) {
  if (!ticket)                              return "pending";
  if (ticket.sync_conflict || ticket.conflict) return "conflict";
  if (ticket.out_of_sync || ticket.sync_pending) return "out_of_sync";
  if (!ticket.sent_to_cnms_at && !ticket.last_synced_at) return "pending";

  const lastMsg  = messages.reduce((t, m) =>
    m.created_at ? Math.max(t, new Date(m.created_at).getTime()) : t, 0);
  const lastSync = ticket.last_synced_at ? new Date(ticket.last_synced_at).getTime() : 0;
  if (lastMsg && lastSync && lastMsg > lastSync) return "out_of_sync";

  return "synced";
}

/* ─── StatusPill ─── */
function StatusPill({ status }) {
  const m = STATUS[status] || STATUS.OPEN;
  return (
    <span style={{ color: m.c, background: m.bg, border: `1.5px solid ${m.c}30` }}
      className="inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-xs font-semibold">
      <span style={{ background: m.c }} className="w-1.5 h-1.5 rounded-full" />
      {m.label}
    </span>
  );
}

/* ─── Chat Bubble ─── */
function Bubble({ msg }) {
  const sender   = msg.sender || "UNKNOWN";
  const isSystem = sender.toUpperCase() === "SYSTEM";
  const mine     = isMine(sender);

  if (isSystem) {
    return (
      <div className="flex justify-center my-2">
        <span className="bg-gray-100 text-gray-500 text-[11px] px-3 py-1 rounded-full border border-gray-200">
          {msg.message}
        </span>
      </div>
    );
  }

  // LNMS → RIGHT (teal).  CNMS → LEFT (blue avatar, white bubble)
  const initials = sender.toUpperCase() === "CNMS" ? "CN" : sender.slice(0, 2).toUpperCase();
  const avatarBg = mine ? "#0d9488" : "#1d4ed8";

  return (
    <div className={`flex items-end gap-2 mb-2 ${mine ? "flex-row-reverse" : "flex-row"}`}>
      <div className="w-7 h-7 rounded-full flex-shrink-0 flex items-center justify-center mb-0.5"
        style={{ background: avatarBg }}>
        <span className="text-white text-[9px] font-bold">{initials}</span>
      </div>
      <div className={`flex flex-col max-w-[68%] ${mine ? "items-end" : "items-start"}`}>
        <span className="text-[10px] text-gray-400 mb-0.5 px-1">{sender}</span>
        <div style={{
          background:   mine ? "linear-gradient(135deg,#0d9488,#0891b2)" : "#ffffff",
          color:        mine ? "#fff" : "#1f2937",
          borderRadius: mine ? "16px 4px 16px 16px" : "4px 16px 16px 16px",
          boxShadow:    mine ? "0 2px 10px #0d948833" : "0 1px 4px #0000001a",
          border:       mine ? "none" : "1px solid #e5e7eb",
        }} className="px-3.5 py-2 text-sm leading-relaxed break-words">
          {msg.message}
        </div>
        <div className="flex items-center gap-1 mt-0.5 px-1">
          <span className="text-[10px] text-gray-400">{fmtTime(msg.created_at)}</span>
          {mine && <CheckCheck size={11} className="text-teal-300" />}
        </div>
      </div>
    </div>
  );
}

/* ═══════════════ MAIN ═══════════════ */
export default function TicketDetails() {
  // ✅  id  = canonical ticket identifier from URL — used for every API call
  const { id }   = useParams();
  const navigate = useNavigate();

  const [ticket,   setTicket]   = useState(null);
  const [messages, setMessages] = useState([]);
  const [input,    setInput]    = useState("");
  const [loading,  setLoading]  = useState(true);
  const [sending,  setSending]  = useState(false);
  const [online,   setOnline]   = useState(true);

  const chatRef  = useRef(null);
  const inputRef = useRef(null);

  /* ── fetch ticket + messages from LNMS backend ── */
  const fetchTicket = useCallback(async (silent = false) => {
    if (!id) {
      setTicket(null);
      setMessages([]);
      setLoading(false);
      return;
    }
    if (!silent) setLoading(true);
    try {
      // GET /tickets/:id  →  returns ticket + messages[] (fixed in LNMS tickets.py)
      const res = await getTicket(id);
      const t   = res.data;
      setTicket(t);
      setMessages(Array.isArray(t.messages) ? t.messages : []);
      setOnline(true);
    } catch {
      setOnline(false);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [id]);

  useEffect(() => { fetchTicket(); }, [fetchTicket]);

  /* ── auto-scroll ── */
  useEffect(() => {
    if (chatRef.current)
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
  }, [messages]);

  /* ── poll every 5 s to pick up CNMS messages + status changes ── */
  useEffect(() => {
    const t = setInterval(() => fetchTicket(true), 5000);
    return () => clearInterval(t);
  }, [fetchTicket]);

  /* ── send message (LNMS → saved locally + forwarded to CNMS) ── */
  const sendMessage = async () => {
    const msg = input.trim();
    if (!msg || sending || !id) return;
    setSending(true);

    // Optimistic bubble while request is in-flight
    const opt = {
      id: `opt-${Date.now()}`, sender: "LNMS",
      message: msg, created_at: new Date().toISOString(),
    };
    setMessages(p => [...p, opt]);
    setInput("");

    try {
      // ✅ POST /tickets/:id/messages — id from useParams (always correct)
      await addComment(id, { message: msg, sender: "LNMS" });
      await fetchTicket(true);    // replace optimistic with real data
    } catch {
      setMessages(p => p.filter(m => m.id !== opt.id));
      setInput(msg);
    } finally {
      setSending(false);
      inputRef.current?.focus();
    }
  };

  const onKey = (e) => {
    if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); sendMessage(); }
  };

  /* ── loading / error ── */
  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="flex flex-col items-center gap-3">
        <div className="w-10 h-10 rounded-full border-4 border-teal-600 border-t-transparent animate-spin" />
        <span className="text-sm text-gray-400">Loading ticket…</span>
      </div>
    </div>
  );

  if (!ticket) return (
    <div className="flex items-center justify-center min-h-screen bg-gray-100">
      <div className="text-center">
        <AlertTriangle size={40} className="text-orange-400 mx-auto mb-3" />
        <p className="text-gray-600 font-medium">Ticket not found</p>
        <button onClick={() => navigate(-1)}
          className="mt-4 text-teal-600 text-sm hover:underline">← Back</button>
      </div>
    </div>
  );

  const status     = normalizeStatus(ticket.status);
  const isResolved = ["RESOLVED", "CLOSED"].includes(status);
  const syncStatus = getSyncStatus(ticket, messages);
  const displayTicketId = ticket.ticket_id || ticket.global_ticket_id;

  const tsRows = [
    { l: "Created",      v: ticket.created_at },
    { l: "Updated",      v: ticket.updated_at },
    { l: "Sent to CNMS", v: ticket.sent_to_cnms_at },
    { l: "Resolved",     v: ticket.resolved_at },
    { l: "Last Synced",  v: ticket.last_synced_at || ticket.synced_at },
  ].filter(r => r.v);

  return (
    <div className="p-5 bg-gray-100 min-h-screen" style={{ fontFamily: "'DM Sans',system-ui,sans-serif" }}>

      {/* HEADER */}
      <div className="flex items-center justify-between mb-5">
        <button onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-teal-700 transition-colors">
          <ArrowLeft size={15} /> Back to Tickets
        </button>
        <div className="flex items-center gap-2">
          <SyncBadge status={syncStatus} />
          {online
            ? <span className="flex items-center gap-1.5 text-xs text-green-600 bg-green-50 border border-green-200 px-2.5 py-1 rounded-full">
                <Wifi size={11} /> Live
              </span>
            : <span className="flex items-center gap-1.5 text-xs text-red-500 bg-red-50 border border-red-200 px-2.5 py-1 rounded-full">
                <WifiOff size={11} /> Offline
              </span>
          }
          <button onClick={() => fetchTicket()}
            className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-teal-600 border border-gray-200 bg-white px-3 py-1.5 rounded-lg">
            <RefreshCw size={12} /> Refresh
          </button>
        </div>
      </div>

      {/* TOP CARD */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6 mb-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-gray-800">{ticket.title}</h1>
            <p className="text-xs text-gray-400 font-mono mt-0.5">
              {displayTicketId}
            </p>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-5 text-sm">
          {[
            { l: "Device",   v: ticket.device_name },
            { l: "Status",   v: <StatusPill status={status} /> },
            { l: "Severity", v: (
              <span className="font-semibold" style={{ color: SEV[ticket.severity] || "#6b7280" }}>
                {ticket.severity || ticket.severity_calculated || "—"}
              </span>
            )},
            { l: "Created",  v: fmtFull(ticket.created_at) },
          ].map(({ l, v }) => (
            <div key={l}>
              <p className="text-xs text-gray-400 mb-0.5">{l}</p>
              <div className="font-semibold text-gray-800 text-sm">{v || "—"}</div>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-5">
          {/* sync tracking */}
          <div className="border border-gray-100 rounded-xl p-4 bg-slate-50">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Sync Tracking</p>
            <p className="font-semibold text-slate-900 text-sm">
              {syncStatus === "synced"      ? "In sync with CNMS" :
               syncStatus === "conflict"    ? "Conflict detected"  :
               syncStatus === "out_of_sync" ? "Out of sync"        : "Sync pending"}
            </p>
            <p className="text-xs text-slate-500 mt-1">
              {syncStatus === "synced"
                ? "Status, messages, and timestamps are aligned between LNMS and CNMS."
                : syncStatus === "conflict"
                ? "LNMS and CNMS contain conflicting updates. Manual review needed."
                : syncStatus === "out_of_sync"
                ? "A recent update is waiting to propagate to CNMS."
                : "This ticket has not yet been confirmed as synced to CNMS."}
            </p>
          </div>

          {/* resolution notes — updated by CNMS when resolving */}
          <div className="border border-gray-100 rounded-xl p-4 bg-slate-50">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Resolution Notes</p>
            <p className="text-sm text-slate-700 whitespace-pre-wrap">
              {ticket.resolution_notes || ticket.resolution_note || "No resolution notes yet"}
            </p>
          </div>

          {/* timestamps */}
          <div className="border border-gray-100 rounded-xl p-4 bg-slate-50">
            <p className="text-[10px] uppercase tracking-widest text-gray-400 mb-2">Timestamps</p>
            {tsRows.length === 0
              ? <p className="text-xs text-slate-400">No timestamps available</p>
              : <div className="space-y-1.5">
                  {tsRows.map(r => (
                    <div key={r.l} className="flex justify-between gap-2 text-xs">
                      <span className="text-slate-400 shrink-0">{r.l}</span>
                      <span className="text-slate-700 text-right font-mono">{fmtFull(r.v)}</span>
                    </div>
                  ))}
                </div>
            }
          </div>
        </div>
      </div>

      {/* CHAT CARD */}
      <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden flex flex-col"
        style={{ height: "calc(100vh - 480px)", minHeight: 380 }}>

        <div className="flex items-center justify-between px-5 py-3.5 border-b border-gray-100 bg-gradient-to-r from-teal-50/60 to-white">
          <div>
            <div className="font-semibold text-gray-800 text-sm">Ticket Conversation</div>
            <div className="flex items-center gap-1.5 text-xs text-gray-400 mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />
              {/* LNMS polls for CNMS messages every 5 s */}
              Polling CNMS messages every 5 seconds
            </div>
          </div>
          <span className="text-xs text-gray-400 bg-gray-100 rounded-full px-2.5 py-1">
            {messages.length} msg{messages.length !== 1 ? "s" : ""}
          </span>
        </div>

        {/* messages list */}
        <div ref={chatRef}
          className="flex-1 overflow-y-auto px-4 py-4"
          style={{ background: "linear-gradient(180deg,#f0fdf9 0%,#fff 100%)" }}>
          {messages.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-3 opacity-40">
              <div className="w-12 h-12 rounded-full bg-gray-100 flex items-center justify-center">
                <Send size={20} className="text-gray-400" />
              </div>
              <p className="text-sm text-gray-500 text-center">No messages yet.<br />Start the conversation.</p>
            </div>
          ) : (
            messages.map((m, i) => <Bubble key={m.id || i} msg={m} />)
          )}
        </div>

        {/* input */}
        <div className="px-4 py-3 border-t border-gray-100 bg-white">
          <div className="flex items-end gap-2">
            <textarea
              ref={inputRef}
              rows={1}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={onKey}
              disabled={isResolved}
              placeholder={isResolved ? "Ticket is resolved" : "Type a message… (Enter to send)"}
              style={{ resize: "none", maxHeight: 100 }}
              className="flex-1 border border-gray-200 rounded-2xl px-4 py-2.5 text-sm focus:outline-none focus:border-teal-400 focus:ring-2 focus:ring-teal-100 transition-all disabled:bg-gray-50 disabled:text-gray-400"
            />
            <button onClick={sendMessage}
              disabled={!input.trim() || sending || isResolved}
              className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 transition-all active:scale-95 disabled:opacity-40"
              style={{ background: "linear-gradient(135deg,#0d9488,#0891b2)", boxShadow: "0 4px 12px #0d948844" }}>
              <Send size={14} color="white" />
            </button>
          </div>
          <p className="text-[10px] text-gray-400 mt-1.5 ml-1">
            {/* LNMS sends messages; CNMS messages appear on the left */}
            LNMS messages sync to CNMS in real-time
          </p>
        </div>
      </div>

      <div className="text-center text-xs text-gray-300 mt-3">
        Ticket ID: {displayTicketId}
      </div>
    </div>
  );
}

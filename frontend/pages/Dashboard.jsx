import { useEffect, useState } from "react";
import api, { getTickets, getAlarms, getCorrelated } from "../api/api";
import LiveAlarmStream from "../components/LiveStream";
import NetworkHealth from "../components/NetworkHealth";
import SLARisk from "../components/SLARisk";

// ── Animated counter ──────────────────────────────────────────────────────────
function useCountUp(target, duration = 800) {
  const [val, setVal] = useState(0);
  useEffect(() => {
    let start = 0;
    const step = target / (duration / 16);
    const timer = setInterval(() => {
      start += step;
      if (start >= target) { setVal(target); clearInterval(timer); }
      else setVal(Math.floor(start));
    }, 16);
    return () => clearInterval(timer);
  }, [target]);
  return val;
}

// ── Stat Card ─────────────────────────────────────────────────────────────────
function StatCard({ label, value, accent, icon, delay = 0 }) {
  const animated = useCountUp(value);
  return (
    <div style={{
      background: "#fff",
      borderRadius: 16,
      padding: "22px 24px",
      boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)",
      borderLeft: `4px solid ${accent}`,
      position: "relative",
      overflow: "hidden",
      animation: `fadeUp 0.5s ease ${delay}s both`,
      cursor: "default",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
      onMouseEnter={e => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = `0 8px 30px rgba(0,0,0,0.1), 0 0 0 1px ${accent}25`;
      }}
      onMouseLeave={e => {
        e.currentTarget.style.transform = "";
        e.currentTarget.style.boxShadow = "0 1px 3px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)";
      }}
    >
      <div style={{
        position: "absolute", top: -16, right: -16,
        width: 72, height: 72, borderRadius: "50%",
        background: accent + "12", pointerEvents: "none"
      }} />
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
        <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em" }}>
          {label}
        </p>
        <div style={{
          width: 36, height: 36, borderRadius: 10,
          background: accent + "15", display: "flex",
          alignItems: "center", justifyContent: "center", fontSize: 18
        }}>
          {icon}
        </div>
      </div>
      <p style={{ margin: 0, fontSize: 38, fontWeight: 800, color: "#0f172a", lineHeight: 1, fontVariantNumeric: "tabular-nums" }}>
        {animated}
      </p>
    </div>
  );
}

// ── Severity badge ────────────────────────────────────────────────────────────
const SEV = {
  Critical: { bg: "#fef2f2", color: "#dc2626", border: "#fecaca" },
  Major:    { bg: "#fff7ed", color: "#ea580c", border: "#fed7aa" },
  Minor:    { bg: "#fefce8", color: "#ca8a04", border: "#fef08a" },
  Warning:  { bg: "#eff6ff", color: "#2563eb", border: "#bfdbfe" },
};

function SeverityBadge({ sev }) {
  const s = SEV[sev] || { bg: "#f1f5f9", color: "#64748b", border: "#e2e8f0" };
  return (
    <span style={{
      background: s.bg, color: s.color, border: `1px solid ${s.border}`,
      borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700,
      display: "inline-flex", alignItems: "center", gap: 5, whiteSpace: "nowrap"
    }}>
      <span style={{
        width: 6, height: 6, borderRadius: "50%", background: s.color,
        animation: sev === "Critical" ? "blink 1.2s infinite" : "none"
      }} />
      {sev || "—"}
    </span>
  );
}

// ── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }) {
  const map = {
    Open:          { bg: "#fef2f2", color: "#dc2626" },
    Closed:        { bg: "#f0fdf4", color: "#16a34a" },
    "In Progress": { bg: "#fffbeb", color: "#d97706" },
    Ack:           { bg: "#f0f9ff", color: "#0369a1" },
  };
  const s = map[status] || { bg: "#f1f5f9", color: "#64748b" };
  return (
    <span style={{ background: s.bg, color: s.color, borderRadius: 20, padding: "3px 10px", fontSize: 11, fontWeight: 700 }}>
      {status || "—"}
    </span>
  );
}

// ── Shimmer skeleton ──────────────────────────────────────────────────────────
function Skeleton({ h = 48 }) {
  return (
    <div style={{
      height: h, borderRadius: 8,
      background: "linear-gradient(90deg,#f1f5f9 25%,#e2e8f0 50%,#f1f5f9 75%)",
      backgroundSize: "200% 100%",
      animation: "shimmer 1.4s infinite"
    }} />
  );
}

// ── Main ──────────────────────────────────────────────────────────────────────
export default function Dashboard() {
  const [stats, setStats] = useState({ devices: 0, alarms: 0, tickets: 0, critical: 0 });
  const [recentTickets, setRecentTickets] = useState([]);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [loading, setLoading] = useState(true);

  const fetchDashboard = async () => {
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
        correlated: correlated.length,
        critical: tickets.filter(t => t.severity_original === "Critical" && ["OPEN"].includes(t.status?.toUpperCase())).length,
      });

      setRecentTickets(
        [...tickets]
          .sort((a, b) => new Date(b.created_at ?? 0) - new Date(a.created_at ?? 0))
          .slice(0, 6)
      );
      setLastUpdated(new Date());
    } catch (err) {
      console.error("Dashboard fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboard();
    const id = setInterval(fetchDashboard, 10000);
    return () => clearInterval(id);
  }, []);

  const healthScore = Math.max(0, 100 - stats.critical * 5);

  const card = {
    background: "#fff",
    borderRadius: 16,
    padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.06), 0 4px 16px rgba(0,0,0,0.04)",
  };

  const th = {
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: "#e0e7ff",
    textTransform: "uppercase",
    letterSpacing: "0.07em",
    borderBottom: "2px solid #4338ca",
    whiteSpace: "nowrap",
  };

  const td = {
    padding: "13px 14px",
    borderBottom: "1px solid #f8fafc",
    fontSize: 13,
    verticalAlign: "middle",
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@500;600&family=Syne:wght@700;800&family=DM+Sans:ital,opsz,wght@0,9..40,400;0,9..40,500;0,9..40,600;0,9..40,700&display=swap');
        @keyframes fadeUp   { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:none} }
        @keyframes shimmer  { 0%{background-position:-200% 0} 100%{background-position:200% 0} }
        @keyframes blink    { 0%,100%{opacity:1} 50%{opacity:0.3} }
        @keyframes glow     { 0%,100%{box-shadow:0 0 0 3px #10b98130} 50%{box-shadow:0 0 0 6px #10b98118} }
        .trow:hover td { background:#f8fafc; }
      `}</style>

      <div style={{ padding: "28px 32px", background: "#f1f5f9", minHeight: "100vh", fontFamily: "'DM Sans',sans-serif" }}>

        {/* ── Header ── */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-end", marginBottom: 28 }}>
          <div>
            <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.1em" }}>
              TCS · Network Operations
            </p>
            <h1 style={{ margin: "3px 0 0", fontSize: 26, fontWeight: 800, color: "#0f172a", fontFamily: "'Syne',sans-serif", letterSpacing: "-0.02em" }}>
              Operations Dashboard
            </h1>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            {lastUpdated && (
              <p style={{ margin: 0, fontSize: 11, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace" }}>
                ↻ {lastUpdated.toLocaleTimeString()}
              </p>
            )}
            <div style={{ display: "flex", alignItems: "center", gap: 7, background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 20, padding: "6px 14px" }}>
              <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#10b981", animation: "glow 2s infinite" }} />
              <span style={{ fontSize: 12, color: "#16a34a", fontWeight: 600 }}>All Systems Operational</span>
            </div>
          </div>
        </div>

        {/* ── Stat Cards ── */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(5,1fr)", gap: 16, marginBottom: 24 }}>
          <StatCard label="Total Devices"   value={stats.devices}  accent="#3b82f6" icon="🖥️"  delay={0}    />
          <StatCard label="Open Alarms"     value={stats.alarms}   accent="#ef4444" icon="🔔"  delay={0.07} />
          <StatCard label="Open Tickets"    value={stats.tickets}  accent="#f59e0b" icon="🎫"  delay={0.14} />
          <StatCard label="Correlated"      value={stats.correlated || 0} accent="#10b981" icon="🖇️" delay={0.18} />
          <StatCard label="Critical Alerts" value={stats.critical} accent="#8b5cf6" icon="⚠️" delay={0.21} />
        </div>

        {/* ── Health + SLA ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginBottom: 24 }}>
          <div style={card}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Network Health Score</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>Overall performance index</p>
            </div>
            <NetworkHealth healthScore={healthScore} />
          </div>
          <div style={card}>
            <div style={{ marginBottom: 16 }}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>SLA Risk Monitor</p>
              <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>Risk level distribution</p>
            </div>
            <SLARisk />
          </div>
        </div>

        {/* ── Live Stream + Recent Tickets ── */}
        <div style={{ display: "grid", gridTemplateColumns: "380px 1fr", gap: 16 }}>

          {/* Live stream */}
          <div style={card}>
            <LiveAlarmStream />
          </div>

          {/* Recent Tickets */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 18 }}>
              <div>
                <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Recent Tickets</p>
                <p style={{ margin: "2px 0 0", fontSize: 12, color: "#94a3b8" }}>Latest {recentTickets.length} tickets</p>
              </div>
              <a href="/tickets" style={{
                fontSize: 12, color: "#3b82f6", fontWeight: 600,
                textDecoration: "none", background: "#eff6ff",
                padding: "6px 14px", borderRadius: 20,
                border: "1px solid #bfdbfe"
              }}>
                View all →
              </a>
            </div>

            {loading ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[1,2,3,4].map(i => <Skeleton key={i} />)}
              </div>
            ) : recentTickets.length === 0 ? (
              <div style={{ textAlign: "center", padding: "48px 0", color: "#94a3b8" }}>
                <div style={{ fontSize: 36, marginBottom: 10 }}>🎫</div>
                <p style={{ margin: 0, fontWeight: 600 }}>No tickets yet</p>
                <p style={{ margin: "4px 0 0", fontSize: 12 }}>Tickets will appear here as alarms are processed</p>
              </div>
            ) : (
              <div style={{ overflowX: "auto" }}>
                <table style={{ width: "100%", borderCollapse: "collapse" }}>
                  <thead>
                    <tr style={{ background: "#4f46e5" }}>
                      <th style={th}>Ticket ID</th>
                      <th style={th}>Device</th>
                      <th style={th}>Title</th>
                      <th style={th}>Severity</th>
                      <th style={th}>Status</th>
                      <th style={th}>Created</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentTickets.map(t => (
                      <tr key={t.ticket_id || t.global_ticket_id} className="trow" style={{ cursor: "pointer" }}>
                        <td style={td}>
                          <span style={{
                            fontFamily: "'JetBrains Mono',monospace",
                            fontSize: 11, color: "#3b82f6", fontWeight: 600,
                            background: "#eff6ff", padding: "3px 8px", borderRadius: 6
                          }}>
                            {(t.ticket_id || t.global_ticket_id || "—").slice(0, 16)}
                          </span>
                        </td>
                        <td style={{ ...td, fontWeight: 600, color: "#1e293b" }}>
                          {t.device_name || "—"}
                        </td>
                        <td style={{ ...td, color: "#64748b", maxWidth: 180 }}>
                          <span style={{ display: "block", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                            {t.title || "—"}
                          </span>
                        </td>
                        <td style={td}>
                          <SeverityBadge sev={t.severity_original} />
                        </td>
                        <td style={td}>
                          <StatusBadge status={t.status} />
                        </td>
                        <td style={{ ...td, color: "#94a3b8", fontFamily: "'JetBrains Mono',monospace", fontSize: 11 }}>
                          {t.created_at
                            ? new Date(t.created_at).toLocaleDateString("en-GB", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })
                            : "—"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}

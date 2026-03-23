import { useEffect, useState, useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  Legend,
  CartesianGrid,
} from "recharts";

/* ==============================
   MOCK DATA (Replace with API)
================================ */

const severityData = [
  { name: "Critical", value: 12 },
  { name: "Major", value: 20 },
  { name: "Minor", value: 35 },
  { name: "Warning", value: 15 },
];

const trendData = [
  { day: "Mon", tickets: 12 },
  { day: "Tue", tickets: 18 },
  { day: "Wed", tickets: 10 },
  { day: "Thu", tickets: 25 },
  { day: "Fri", tickets: 15 },
  { day: "Sat", tickets: 20 },
  { day: "Sun", tickets: 14 },
];

const mockTickets = [
  { id: "INC001", host: "Server-01", severity: "Critical", timeOpen: "4h", risk: 95 },
  { id: "INC002", host: "Router-02", severity: "Major", timeOpen: "2h", risk: 75 },
  { id: "INC003", host: "Switch-03", severity: "Critical", timeOpen: "6h", risk: 98 },
  { id: "INC004", host: "Firewall-01", severity: "Minor", timeOpen: "1h", risk: 45 },
  { id: "INC005", host: "Server-04", severity: "Major", timeOpen: "3h", risk: 70 },
];

/* ==============================
   MAIN COMPONENT
================================ */

export default function Dashboard() {
  const [tickets, setTickets] = useState(mockTickets);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");

  /* Simulated Auto Refresh */
  useEffect(() => {
    const interval = setInterval(() => {
      console.log("Auto Refresh Triggered");
    }, 10000);
    return () => clearInterval(interval);
  }, []);

  /* Filtering + Search */
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      const matchSearch =
        t.id.toLowerCase().includes(search.toLowerCase()) ||
        t.host.toLowerCase().includes(search.toLowerCase());

      const matchSeverity =
        severityFilter === "All" || t.severity === severityFilter;

      return matchSearch && matchSeverity;
    });
  }, [tickets, search, severityFilter]);

  const severityColors = {
    Critical: "#dc2626",
    Major: "#f97316",
    Minor: "#eab308",
    Warning: "#22c55e",
  };

  return (
   <div className="space-y-10 bg-gray-100">


<h1 className="text-3xl font-bold text-gray-800 mb-8">
Incident Monitoring Dashboard
</h1>
      {/* ================= KPI SECTION ================= */}
      <div className="grid grid-cols-2 md:grid-cols-3 xl:grid-cols-6 gap-6">
        {[
          { label: "Open Incidents", value: 67, color: "text-red-600" },
          { label: "Critical", value: 12, color: "text-red-700" },
          { label: "Major", value: 20, color: "text-orange-600" },
          { label: "Resolved Today", value: 18, color: "text-green-600" },
          { label: "SLA Breached", value: 5, color: "text-red-500" },
          { label: "Avg Resolution (hrs)", value: "3.2", color: "text-blue-600" },
        ].map((kpi, index) => (
          <div
            key={index}
            className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 hover:shadow-md transition"
          >
            <p className="text-xs text-gray-500 uppercase">{kpi.label}</p>
            <p className={`text-3xl font-bold mt-2 ${kpi.color}`}>
              {kpi.value}
            </p>
          </div>
        ))}
      </div>

      {/* ================= CHART SECTION ================= */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">

        {/* Trend Chart */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4 text-gray-800">
            Incident Trend (Last 7 Days)
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={trendData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="day" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="tickets" stroke="#2563eb" strokeWidth={3} />
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Severity Pie */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
          <h2 className="text-lg font-bold mb-4 text-gray-800">
            Severity Distribution
          </h2>

          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={severityData}
                dataKey="value"
                nameKey="name"
                outerRadius={100}
                label
              >
                {severityData.map((entry, index) => (
                  <Cell
                    key={index}
                    fill={severityColors[entry.name]}
                  />
                ))}
              </Pie>
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ================= FILTER PANEL ================= */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-grey-200 flex flex-col md:flex-row gap-4 md:items-center md:justify-between">

        <input
          type="text"
          placeholder="Search Ticket ID / Host"
          className="border px-4 py-2 rounded-lg w-full md:w-1/3"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <select
          className="border px-4 py-2 rounded-lg w-full md:w-1/4"
          value={severityFilter}
          onChange={(e) => setSeverityFilter(e.target.value)}
        >
          <option value="All">All Severity</option>
          <option value="Critical">Critical</option>
          <option value="Major">Major</option>
          <option value="Minor">Minor</option>
        </select>

        <button
          onClick={() => {
            const csv = tickets
              .map((t) => `${t.id},${t.host},${t.severity},${t.risk}`)
              .join("\n");
            const blob = new Blob([csv], { type: "text/csv" });
            const link = document.createElement("a");
            link.href = URL.createObjectURL(blob);
            link.download = "tickets.csv";
            link.click();
          }}
          className="bg-blue-600 text-white px-5 py-2 rounded-lg hover:bg-blue-700"
        >
          Export CSV
        </button>
      </div>

        {/* ================= HIGH RISK TABLE ================= */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200 overflow-x-auto">
        <h2 className="text-lg font-bold mb-4 text-black-800">
          High Risk Incidents
        </h2>

        <table className="w-full text-left">
          <thead>
            <tr className="border-b text-sm text-gray-600">
              <th className="py-3">Ticket</th>
              <th>Host</th>
              <th>Severity</th>
              <th>Time Open</th>
              <th>Risk Score</th>
            </tr>
          </thead>

          <tbody>
            {filteredTickets.map((t, i) => (
              <tr
                key={i}
                className="border-b hover:bg-gray-50 transition"
              >
                <td className="py-3 font-semibold">{t.id}</td>
                <td>{t.host}</td>
                <td>
                  <span
                    className="px-3 py-1 rounded-full text-white text-xs font-bold"
                    style={{ backgroundColor: severityColors[t.severity] }}
                  >
                    {t.severity}
                  </span>
                </td>
                <td>{t.timeOpen}</td>
                <td className="font-bold">{t.risk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ================= LIVE FEED ================= */}
      <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-200">
        <h2 className="text-lg font-bold mb-4 text-gray-800">
          Live Incident Feed
        </h2>

        <ul className="space-y-3 text-sm">
          <li className="text-red-600 font-semibold">
            New Critical Incident on Server-01
          </li>
          <li className="text-orange-600">
            Ticket INC002 escalated
          </li>
          <li className="text-green-600">
            Ticket INC003 resolved
          </li>
        </ul>
      </div>

    </div>
  );
} 
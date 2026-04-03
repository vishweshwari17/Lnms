import { useEffect, useState } from "react";
import { getAlarms, updateAlarmStatus } from "../api/api";
import { useNavigate } from "react-router-dom";

export default function Alarms() {
  const [alarms, setAlarms] = useState([]);
  const [filteredAlarms, setFilteredAlarms] = useState([]);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");
  const [rowsPerPage, setRowsPerPage] = useState(25);
  const [page, setPage] = useState(1);
  const [now, setNow] = useState(Date.now());

  const navigate = useNavigate();

  // ✅ Normalize status
  const normalizeStatus = (status) => {
    if (!status) return "OPEN";
    const s = status.toUpperCase();
    if (["OPEN", "ACTIVE"].includes(s)) return "OPEN";
    if (["ACK", "ACKNOWLEDGED"].includes(s)) return "ACK";
    if (["RESOLVED", "CLOSED"].includes(s)) return "RESOLVED";
    return "OPEN";
  };

  useEffect(() => {
    fetchAlarms();
    const interval = setInterval(fetchAlarms, 30000);
    const timeInterval = setInterval(() => setNow(Date.now()), 60000);

    return () => {
      clearInterval(interval);
      clearInterval(timeInterval);
    };
  }, []);

  useEffect(() => {
    filterData();
  }, [alarms, search, severityFilter, statusFilter]);

  const fetchAlarms = async () => {
    try {
      const res = await getAlarms();

      // ✅ Deduplicate
      const unique = {};
      res.data.forEach(a => {
        const key = a.raw_id || a.alarm_id;
        if (!unique[key]) unique[key] = a;
      });

      const newData = Object.values(unique);

      // ✅ Prevent unnecessary rerender
      setAlarms(prev => {
        if (JSON.stringify(prev) === JSON.stringify(newData)) return prev;
        return newData;
      });

    } catch (err) {
      console.error(err);
    }
  };

  const handleAction = async (id, status) => {
    try {
      await updateAlarmStatus(id, status);
      fetchAlarms();
    } catch (err) {
      console.error(err);
    }
  };

  const filterData = () => {
    let data = [...alarms];

    if (severityFilter !== "All") {
      data = data.filter(a => a.severity === severityFilter);
    }

    if (statusFilter !== "All") {
      data = data.filter(a =>
        normalizeStatus(a.status) === statusFilter
      );
    }

    if (search) {
      data = data.filter(a =>
        a.device_name?.toLowerCase().includes(search.toLowerCase()) ||
        a.alarm_name?.toLowerCase().includes(search.toLowerCase())
      );
    }

    setFilteredAlarms(data);
    setPage(1);
  };

  const getDuration = (timeStr) => {
    if (!timeStr) return "-";
    const diff = now - new Date(timeStr).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 60) return `${mins}m`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ${mins % 60}m`;
    return `${Math.floor(hrs / 24)}d ${hrs % 24}h`;
  };

  const badge = (text, color) => (
    <span className={`px-3 py-1 text-xs font-semibold rounded-full ${color}`}>
      {text}
    </span>
  );

  const indexOfLast = page * rowsPerPage;
  const currentRows = filteredAlarms.slice(indexOfLast - rowsPerPage, indexOfLast);
  const totalPages = Math.ceil(filteredAlarms.length / rowsPerPage);

  return (
    <div className="p-6 bg-gray-100 min-h-screen">

      <h1 className="text-2xl font-bold mb-6 flex items-center gap-2">
        🚨 <span>Network Alarms Dashboard</span>
      </h1>

      <div className="grid grid-cols-4 gap-5 mb-6">
        <Card title="Total Alarms" value={alarms.length} />
        <Card title="Critical" value={alarms.filter(a => a.severity === "Critical").length} red />
        <Card title="Major" value={alarms.filter(a => a.severity === "Major").length} orange />
        <Card title="Minor" value={alarms.filter(a => a.severity === "Minor").length} yellow />
      </div>

      <div className="bg-white p-4 rounded-xl shadow mb-6 flex flex-wrap gap-3 items-center justify-between">

        <input
          className="border px-3 py-2 rounded w-64"
          placeholder="Search device or alarm..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        <div className="flex gap-3">

          <select onChange={(e) => setSeverityFilter(e.target.value)} className="border px-3 py-2 rounded">
            <option value="All">All Severity</option>
            <option>Critical</option>
            <option>Major</option>
            <option>Minor</option>
          </select>

          <select onChange={(e) => setStatusFilter(e.target.value)} className="border px-3 py-2 rounded">
            <option value="All">All Status</option>
            <option value="OPEN">ACTIVE</option>
            <option value="ACK">ACK</option>
            <option value="RESOLVED">RESOLVED</option>
          </select>

          <select value={rowsPerPage} onChange={(e) => setRowsPerPage(Number(e.target.value))} className="border px-3 py-2 rounded">
            {[10, 25, 50, 100].map(n => (<option key={n}>{n} / page</option>))}
          </select>

          <button onClick={() => { setSearch(""); setSeverityFilter("All"); setStatusFilter("All") }} className="bg-gray-200 px-4 py-2 rounded">
            Reset
          </button>

        </div>
      </div>

      <div className="bg-white rounded-xl shadow overflow-hidden">

        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-gray-600 text-xs uppercase">
            <tr>
              <th className="p-3 text-left">ID</th>
              <th>Source</th>
              <th>Device</th>
              <th>Type</th>
              <th>Severity</th>
              <th>Alarm</th>
              <th>Status</th>
              <th>Duration</th>
              <th className="text-center">Actions</th>
            </tr>
          </thead>

          <tbody>
            {currentRows.map(a => {
              const status = normalizeStatus(a.status);

              return (
                <tr
                  key={a.raw_id || a.alarm_id}
                  className="border-t hover:bg-gray-50 cursor-pointer"
                  onClick={() => navigate(`/alarms/${a.alarm_id}`)}
                >
                  <td className="p-3 font-medium">{a.alarm_id}</td>
                  <td>{a.source || "LNMS"}</td>
                  <td className="font-semibold">{a.device_name}</td>
                  <td>{a.alarm_type}</td>

                  <td>
                    {a.severity === "Critical" && badge("Critical", "bg-red-100 text-red-600")}
                    {a.severity === "Major" && badge("Major", "bg-orange-100 text-orange-600")}
                    {a.severity === "Minor" && badge("Minor", "bg-yellow-100 text-yellow-700")}
                  </td>

                  <td>{a.alarm_name}</td>

                  <td>
                    {status === "RESOLVED"
                      ? badge("Resolved", "bg-green-100 text-green-600")
                      : status === "ACK"
                        ? badge("Acknowledged", "bg-yellow-100 text-yellow-700")
                        : badge("Active", "bg-red-100 text-red-600")}
                  </td>

                  <td>{getDuration(a.problem_time || a.created_at)}</td>

                  <td className="text-center">
                    <div className="flex justify-center gap-2">

                      <button onClick={(e) => { e.stopPropagation(); handleAction(a.alarm_id, "Ack") }} className="px-3 py-1 text-xs bg-yellow-400 rounded">
                        Ack
                      </button>

                      <button onClick={(e) => { e.stopPropagation(); handleAction(a.alarm_id, "Resolved") }} className="px-3 py-1 text-xs bg-green-500 text-white rounded">
                        Resolve
                      </button>

                    </div>
                  </td>

                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function Card({ title, value, red, orange, yellow }) {
  const bg = red ? "bg-red-100" : orange ? "bg-orange-100" : yellow ? "bg-yellow-100" : "bg-white";
  return (
    <div className={`p-4 rounded-xl shadow ${bg}`}>
      <p className="text-sm text-gray-600">{title}</p>
      <h2 className="text-2xl font-bold">{value}</h2>
    </div>
  );
}
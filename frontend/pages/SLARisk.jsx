
import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";

function SLARisk() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [severityFilter, setSeverityFilter] = useState("All");
  const navigate = useNavigate();

  /* ---------------- FETCH DATA ---------------- */

  const fetchRisk = async () => {
    try {
      const res = await api.get("/sla/risk");

      // Ensure array always
      const result = Array.isArray(res.data)
        ? res.data
        : res.data?.data || [];

      setData(result);
    } catch (err) {
      console.error("Failed to fetch SLA risk data", err);
      setData([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchRisk();

    const interval = setInterval(fetchRisk, 10000);
    return () => clearInterval(interval);
  }, []);

  /* ---------------- FILTER ---------------- */

  const filteredData = useMemo(() => {
    if (!Array.isArray(data)) return [];

    if (severityFilter === "All") return data;

    return data.filter(
      (item) => item.severity_original === severityFilter
    );
  }, [data, severityFilter]);

  /* ---------------- EXPORT CSV ---------------- */

  const exportCSV = () => {
    if (!filteredData.length) return;

    const headers = [
      "Ticket ID",
      "Remaining Time",
      "Risk %",
      "Severity",
    ];

    const rows = filteredData.map((item) => [
      item.ticket_id,
      item.remaining_time,
      item.risk_percentage,
      item.severity_original,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," +
      [headers, ...rows].map((e) => e.join(",")).join("\n");

    const link = document.createElement("a");
    link.href = encodeURI(csvContent);
    link.download = "sla_risk_report.csv";
    document.body.appendChild(link);
    link.click();
  };

  /* ---------------- RISK COUNTS ---------------- */

  const highRisk = filteredData.filter(
    (d) => d.risk_percentage >= 80
  ).length;

  const mediumRisk = filteredData.filter(
    (d) => d.risk_percentage >= 50 && d.risk_percentage < 80
  ).length;

  /* ---------------- TREND GRAPH ---------------- */

  const renderTrend = (risk = 0) => {
    const bars = [risk - 10, risk - 5, risk - 2, risk];

    return (
      <div className="flex items-end gap-1 h-10">
        {bars.map((value, index) => (
          <div
            key={index}
            className="w-2 bg-indigo-400 rounded"
            style={{ height: `${Math.max(5, value / 2)}px` }}
          />
        ))}
      </div>
    );
  };

  /* ---------------- UI ---------------- */

  return (
    <div className="p-8 bg-gray-50 min-h-screen">
      <div className="max-w-7xl mx-auto">

        {/* HEADER */}

        <div className="flex justify-between items-center mb-8">

          <div>
            <h1 className="text-3xl font-bold text-gray-800">
              SLA Risk Intelligence
            </h1>

            <p className="text-sm text-gray-500">
              Predictive breach monitoring & escalation engine
            </p>
          </div>

          <button
            onClick={exportCSV}
            className="bg-indigo-600 text-white px-4 py-2 rounded-lg hover:bg-indigo-700 transition"
          >
            Export Report
          </button>

        </div>

        {/* FILTER */}

        <div className="mb-6 flex gap-4 items-center">

          <label className="text-sm text-gray-600">
            Filter by Severity:
          </label>

          <select
            value={severityFilter}
            onChange={(e) => setSeverityFilter(e.target.value)}
            className="border px-3 py-2 rounded-lg text-sm"
          >
            <option value="All">All</option>
            <option value="Critical">Critical</option>
            <option value="Major">Major</option>
            <option value="Minor">Minor</option>
          </select>

        </div>

        {/* LOADING */}

        {loading && (
          <div className="text-center text-gray-400 py-20">
            Loading SLA Risk Data...
          </div>
        )}

        {/* SUMMARY CARDS */}

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Total Active SLAs</p>
              <p className="text-3xl font-bold text-gray-800 mt-2">
                {filteredData.length}
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">High Risk</p>
              <p className="text-3xl font-bold text-red-600 mt-2">
                {highRisk}
              </p>
            </div>

            <div className="bg-white p-6 rounded-xl shadow">
              <p className="text-gray-500 text-sm">Medium Risk</p>
              <p className="text-3xl font-bold text-orange-500 mt-2">
                {mediumRisk}
              </p>
            </div>

          </div>
        )}

        {/* TABLE */}

        {!loading && filteredData.length > 0 && (

          <div className="bg-white rounded-xl shadow overflow-hidden">

            <table className="min-w-full text-sm">

              <thead className="bg-gray-100 text-gray-600 uppercase text-xs">

                <tr>
                  <th className="px-6 py-4 text-left">Ticket</th>
                  <th className="px-6 py-4 text-left">Countdown</th>
                  <th className="px-6 py-4 text-left">Risk %</th>
                  <th className="px-6 py-4 text-left">Trend</th>
                  <th className="px-6 py-4 text-left">Escalation</th>
                </tr>

              </thead>

              <tbody>

                {filteredData.map((item) => {

                  const isEscalated = item.risk_percentage >= 85;

                  return (

                    <tr
                      key={item.ticket_id}
                      onClick={() =>
                        navigate(`/tickets/${item.ticket_id}`)
                      }
                      className="border-t hover:bg-gray-50 cursor-pointer transition"
                    >

                      <td className="px-6 py-4 font-semibold text-indigo-600">
                        #{item.ticket_id}
                      </td>

                      <td className="px-6 py-4 text-red-600 font-medium">
                        {item.remaining_time} mins
                      </td>

                      <td className="px-6 py-4 w-56">

                        <div className="w-full bg-gray-200 rounded-full h-3">

                          <div
                            className={`h-3 rounded-full ${
                              item.risk_percentage >= 80
                                ? "bg-red-500"
                                : item.risk_percentage >= 50
                                ? "bg-orange-400"
                                : "bg-green-500"
                            }`}
                            style={{
                              width: `${item.risk_percentage}%`,
                            }}
                          />

                        </div>

                        <p className="text-xs text-gray-500 mt-1">
                          {item.risk_percentage}%
                        </p>

                      </td>

                      <td className="px-6 py-4">
                        {renderTrend(item.risk_percentage)}
                      </td>

                      <td className="px-6 py-4">

                        {isEscalated ? (
                          <span className="px-3 py-1 text-xs rounded-full bg-red-100 text-red-600 font-semibold">
                            Escalated 🚨
                          </span>
                        ) : (
                          <span className="px-3 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
                            Monitoring
                          </span>
                        )}

                      </td>

                    </tr>

                  );
                })}

              </tbody>

            </table>

          </div>
        )}

        {!loading && filteredData.length === 0 && (

          <div className="bg-white p-8 rounded-xl shadow text-center">

            <p className="text-gray-400">
              No SLA risk data available.
            </p>

          </div>
        )}

      </div>
    </div>
  );
}

export default SLARisk;

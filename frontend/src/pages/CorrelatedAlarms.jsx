import React, { useState, useEffect, Fragment, useMemo } from "react";
import api from "../api/api";
import { useNavigate } from "react-router-dom";

const CorrelatedAlarms = () => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [severityFilter, setSeverityFilter] = useState("All");
  const [expandedRow, setExpandedRow] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const navigate = useNavigate();

  useEffect(() => {
    fetchCorrelatedAlarms();
  }, []);

  const fetchCorrelatedAlarms = async () => {
    try {
      const response = await api.get("correlated-alarms/");
      setData(response.data || []);
    } catch (error) {
      console.error("Error fetching correlated alarms:", error);
    } finally {
      setLoading(false);
    }
  };

  const getSeverityStyle = (severity) => {
    switch (severity?.toLowerCase()) {
      case "critical":
        return "bg-red-500 text-white shadow-red-200";
      case "major":
        return "bg-orange-500 text-white shadow-orange-200";
      case "minor":
        return "bg-amber-500 text-white shadow-amber-200";
      case "warning":
        return "bg-blue-500 text-white shadow-blue-200";
      default:
        return "bg-slate-400 text-white shadow-slate-200";
    }
  };

  const filteredData = useMemo(() => {
    return data.filter((item) => {
      const matchesSeverity =
        severityFilter === "All" || item.severity === severityFilter;

      const matchesSearch =
        item.device_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.root_alarm_name?.toLowerCase().includes(search.toLowerCase()) ||
        item.correlation_id?.toString().includes(search);

      return matchesSeverity && matchesSearch;
    });
  }, [data, search, severityFilter]);

  const totalPages = Math.ceil(filteredData.length / rowsPerPage);

  const paginatedData = filteredData.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const totalRelated = filteredData.reduce(
    (acc, item) => acc + (item.total_alarms || 0),
    0
  );

  const criticalCount = filteredData.filter(
    (item) => item.severity === "Critical"
  ).length;

  return (
    <div className="p-6 bg-slate-50 min-h-screen font-sans">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-black text-slate-900 tracking-tighter uppercase">
              Correlated Alarms
            </h2>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mt-2">
              Root Cause Analysis Engine
            </p>
          </div>
          <div className="bg-indigo-600 px-6 py-2.5 rounded-xl shadow-lg shadow-indigo-100">
            <span className="text-white text-[10px] font-black uppercase tracking-widest">Active Clusters: {data.length}</span>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-md shadow-slate-200/50 mb-6 flex flex-wrap gap-4 items-center border border-slate-50">
          <div className="relative flex-1 min-w-[280px]">
            <input
              type="text"
              placeholder="Filter by ID, device or root cause..."
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="w-full bg-slate-50 border-none rounded-xl px-12 py-3 focus:ring-4 focus:ring-indigo-50 transition-all font-bold text-slate-700 placeholder-slate-300 shadow-inner"
            />
            <span className="absolute left-6 top-4.5 opacity-30 text-xl">🔍</span>
          </div>

          <select
            value={severityFilter}
            onChange={(e) => {
              setSeverityFilter(e.target.value);
              setCurrentPage(1);
            }}
            className="bg-slate-50 border-none rounded-xl px-6 py-3 focus:ring-4 focus:ring-indigo-50 transition-all font-black text-[10px] uppercase tracking-widest text-slate-500 cursor-pointer shadow-inner"
          >
            <option value="All">All Severities</option>
            <option value="Critical">Critical Only</option>
            <option value="Major">Major Only</option>
            <option value="Minor">Minor Only</option>
          </select>
        </div>

        {!loading && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-10">
            <SummaryCard label="Correlation Groups" value={filteredData.length} accent="bg-indigo-500" />
            <SummaryCard label="Critical Clusters" value={criticalCount} accent="bg-red-500" />
            <SummaryCard label="Suppressed Events" value={totalRelated - filteredData.length} accent="bg-emerald-500" />
          </div>
        )}

        <div className="bg-white rounded-[2rem] shadow-xl shadow-slate-200/30 overflow-hidden border border-slate-100">
          <table className="min-w-full border-collapse">
            <thead className="bg-indigo-600 text-indigo-50">
              <tr>
                <th className="px-8 py-4 text-left font-black text-[9px] uppercase tracking-widest">ID</th>
                <th className="px-8 py-4 text-left font-black text-[9px] uppercase tracking-widest">Root Candidate</th>
                <th className="px-8 py-4 text-left font-black text-[9px] uppercase tracking-widest">Endpoint</th>
                <th className="px-8 py-4 text-left font-black text-[9px] uppercase tracking-widest">Criticality</th>
                <th className="px-8 py-4 text-center font-black text-[9px] uppercase tracking-widest">Cluster size</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedData.map((item) => (
                <Fragment key={item.correlation_id}>
                  <tr
                    className="hover:bg-slate-50/80 cursor-pointer transition-all duration-300 group"
                    onClick={() => setExpandedRow(expandedRow === item.correlation_id ? null : item.correlation_id)}
                  >
                    <td className="px-8 py-5 font-black text-indigo-600 text-[10px]">
                      CID-{item.correlation_id}
                    </td>
                    <td className="px-8 py-5">
                      <div className="font-black text-slate-800 text-base tracking-tight group-hover:text-indigo-600 transition-colors uppercase">{item.root_alarm_name || "Diagnostic Group"}</div>
                      <div className="text-[9px] font-black text-slate-300 mt-1 uppercase tracking-[0.1em]">Automated RCA</div>
                    </td>
                    <td className="px-8 py-5 font-bold text-slate-500 text-xs">
                      {item.device_name || "Network Core"}
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-4 py-1.5 text-[8px] font-black uppercase tracking-[0.1em] rounded-lg shadow-md inline-block ${getSeverityStyle(item.severity)}`}>
                        {item.severity}
                      </span>
                    </td>
                    <td className="px-8 py-5 text-center">
                       <div className="inline-flex items-center justify-center w-10 h-10 bg-indigo-600 text-white rounded-xl font-black text-sm shadow-lg group-hover:bg-indigo-500 group-hover:scale-105 transition-all duration-300">
                        {item.total_alarms}
                       </div>
                    </td>
                  </tr>

                  {expandedRow === item.correlation_id && (
                    <tr className="bg-slate-50/30">
                      <td colSpan="5" className="px-12 py-10">
                        <div className="flex justify-between items-center mb-8">
                           <div className="h-px flex-1 bg-slate-200" />
                           <h4 className="px-6 font-black text-slate-400 text-[10px] uppercase tracking-[0.4em]">Member Alarms</h4>
                           <div className="h-px flex-1 bg-slate-200" />
                        </div>

                        {item.related_alarms?.length > 0 ? (
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {item.related_alarms.map((alarm) => (
                              <div key={alarm.alarm_id} className="bg-white p-6 rounded-3xl shadow-sm border border-slate-100 flex items-center gap-5 hover:shadow-md transition-shadow">
                                <div className={`w-3 h-3 rounded-full ${alarm.severity === 'Critical' ? 'bg-red-500 shadow-red-200 shadow-lg' : 'bg-amber-500 shadow-amber-200 shadow-lg'}`} />
                                <div>
                                  <div className="text-[11px] font-black text-slate-800 uppercase tracking-wider">{alarm.alarm_name}</div>
                                  <div className="text-[10px] font-bold text-slate-400 mt-0.5">{alarm.device_name} &bull; {new Date(alarm.timestamp).toLocaleTimeString()}</div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="p-10 text-center bg-white rounded-3xl border-2 border-dashed border-slate-200">
                            <p className="text-xs font-black text-slate-300 uppercase tracking-widest italic font-mono">No detailed cluster logs available for this epoch</p>
                          </div>
                        )}
                        

                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>

          <div className="flex flex-col md:flex-row justify-between items-center p-6 bg-white border-t border-slate-50 gap-6">
            <div className="flex items-center gap-4 bg-slate-50 px-5 py-2.5 rounded-xl shadow-inner">
                <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Page Depth</span>
                <select
                    value={rowsPerPage}
                    onChange={e => {
                        setRowsPerPage(Number(e.target.value));
                        setCurrentPage(1);
                    }}
                    className="bg-white border-none rounded-lg text-[10px] font-black px-3 py-1.5 cursor-pointer focus:ring-2 focus:ring-indigo-50 shadow-sm"
                >
                    {[10, 25, 50].map(n => (
                    <option key={n} value={n}>{n} Units</option>
                    ))}
                </select>
            </div>

            <div className="flex items-center gap-4">
                <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage((prev) => prev - 1)}
                className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-900 rounded-xl border-2 border-transparent hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-20 transition-all group shadow-sm"
                >
                <span className="group-hover:-translate-x-1 transition-transform text-lg">←</span>
                </button>

                <div className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-black text-[10px] shadow-lg shadow-indigo-50 tracking-widest">
                {currentPage} / {totalPages || 1}
                </div>

                <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage((prev) => prev + 1)}
                className="w-10 h-10 flex items-center justify-center bg-slate-50 text-slate-900 rounded-xl border-2 border-transparent hover:border-indigo-600 hover:text-indigo-600 disabled:opacity-20 transition-all group shadow-sm"
                >
                <span className="group-hover:translate-x-1 transition-transform text-lg">→</span>
                </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

function SummaryCard({ label, value, accent }) {
    return (
        <div className="bg-white p-6 rounded-[2rem] shadow-xl shadow-slate-200/30 relative overflow-hidden group hover:translate-y-[-4px] transition-all duration-500 border border-slate-50">
            <div className={`absolute top-0 right-0 w-32 h-32 ${accent} opacity-[0.04] rounded-full translate-x-10 translate-y--10 blur-3xl group-hover:opacity-[0.10] transition-all duration-1000`} />
            <p className="text-[10px] font-black uppercase text-slate-400 tracking-[0.2em] mb-2">{label}</p>
            <p className="text-3xl font-black text-slate-900 tracking-tighter leading-none group-hover:scale-105 transition-transform duration-300 origin-left">{value}</p>
        </div>
    );
}

export default CorrelatedAlarms;

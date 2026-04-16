import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/api";
import { 
  FaServer, 
  FaSyncAlt, 
  FaDesktop, 
  FaNetworkWired,
  FaArrowRight,
  FaSearch
} from "react-icons/fa";
import toast from "react-hot-toast";

import KPICard from "../components/KPICard";
import StatusBadge from "../components/StatusBadge";
import FilterSelect from "../components/FilterSelect";

export default function DevicesDashboard() {
  const navigate = useNavigate();
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("All");
  const [statusFilter, setStatusFilter] = useState("All");

  const fetchDevices = async () => {
    try {
      const res = await api.get("devices", {
        params: {
          search: search || undefined,
          type: typeFilter === "All" ? undefined : typeFilter,
          status: statusFilter === "All" ? undefined : statusFilter
        }
      });
      setDevices(res.data.devices || []);
    } catch (err) {
      console.error("Failed to fetch devices", err);
      toast.error("Asset registry inaccessible");
    } finally {
      setLoading(false);
    }
  };

  const handleSync = async () => {
    setSyncing(true);
    const syncToast = toast.loading("Scanning network perimeter...");
    try {
      await api.post("devices/sync");
      toast.success("Infrastructure synchronized", { id: syncToast });
      fetchDevices();
    } catch (err) {
      console.error("Sync failed", err);
      toast.error("Synchronization failure", { id: syncToast });
    } finally {
      setSyncing(false);
    }
  };

  useEffect(() => {
    fetchDevices();
  }, [search, typeFilter, statusFilter]);

  const counts = {
    total: devices.length,
    routers: devices.filter(d => d.type?.toLowerCase().includes("router")).length,
    servers: devices.filter(d => d.type?.toLowerCase().includes("server") || d.type?.toLowerCase().includes("host")).length,
    active: devices.filter(d => d.status === "ACTIVE").length,
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-blue-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="page-title tracking-tighter uppercase">Inventory Core</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-blue-600 mt-1 flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-blue-600 rounded-full animate-pulse" />
             Active Asset Management &bull; {counts.total} Nodes Discovered
          </p>
        </div>
        
        <button 
          onClick={handleSync}
          disabled={syncing}
          className="relative z-10 flex items-center gap-3 bg-slate-900 text-white px-6 py-3 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 disabled:opacity-50 active:scale-95 group"
        >
          <FaSyncAlt className={`${syncing ? "animate-spin" : "group-hover:rotate-180 transition-transform duration-500"}`} />
          {syncing ? "Scanning Vectors..." : "Sync Infrastructure"}
        </button>
      </div>

      {/* KPI SECTION */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-5">
        <KPICard label="Total Capacity" value={counts.total} color="blue" icon={<FaNetworkWired />} loading={loading} />
        <KPICard label="Active Nodes" value={counts.active} color="green" icon={<FaDesktop />} loading={loading} />
        <KPICard label="Route Vectors" value={counts.routers} color="amber" icon={<FaNetworkWired />} loading={loading} />
        <KPICard label="Compute Units" value={counts.servers} color="blue" icon={<FaServer />} loading={loading} />
      </div>

      {/* FILTERS */}
      <div className="card shadow-sm border-slate-100 p-8 space-y-8">
        <div className="flex flex-wrap gap-6 items-end">
          <div className="flex flex-col gap-1.5 flex-1 min-w-[300px]">
            <span className="section-title !mb-0 text-[9px]">Identity Filter</span>
            <div className="relative">
              <FaSearch className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
              <input
                type="text"
                placeholder="Search Hostname, IP Address or Mac..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full bg-slate-50 border border-slate-100 rounded-2xl pl-12 pr-6 py-3 body-text font-bold outline-none focus:ring-4 focus:ring-blue-50 transition-all"
              />
            </div>
          </div>
          <FilterSelect value={typeFilter} onChange={setTypeFilter} options={["All", "SNMP", "Router", "Switch", "Server"]} label="Category" />
          <FilterSelect value={statusFilter} onChange={setStatusFilter} options={["All", "ACTIVE", "INACTIVE"]} label="Operational State" />
        </div>

        {/* TABLE */}
        <div className="overflow-hidden border border-slate-100 rounded-2xl">
          <table className="w-full">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="table-header table-cell">Asset ID</th>
                <th className="table-header table-cell">Metadata & Network</th>
                <th className="table-header table-cell">System Class</th>
                <th className="table-header table-cell">Physical Vector</th>
                <th className="table-header table-cell text-center">Status</th>
                <th className="table-header table-cell text-right">Insight</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {loading ? (
                <tr><td colSpan="6" className="table-cell text-center py-20 animate-pulse font-black text-slate-300 uppercase tracking-widest">Hydrating asset registry...</td></tr>
              ) : devices.length === 0 ? (
                <tr>
                   <td colSpan="6" className="table-cell text-center py-20">
                     <FaServer className="mx-auto text-slate-200 mb-4" size={48} />
                     <p className="body-text font-black text-slate-400 uppercase tracking-widest">No assets intercepted</p>
                   </td>
                </tr>
              ) : devices.map((device) => (
                <tr key={device.id} className="transition-colors cursor-pointer group hover:bg-slate-50/50" onClick={() => navigate(`/devices/${device.id}`)}>
                  <td className="table-cell font-black text-blue-primary text-xs uppercase">
                    DEV-{device.id.toString().padStart(4, '0')}
                  </td>
                  <td className="table-cell">
                    <div className="font-bold text-slate-900">{device.hostname}</div>
                    <div className="text-[10px] font-black text-slate-400 tracking-tighter uppercase">{device.ip_address}</div>
                  </td>
                  <td className="table-cell">
                    <span className="text-[10px] font-black text-slate-500 bg-slate-100 px-2.5 py-1 rounded-full uppercase tracking-tighter">
                       {device.type || "IP Node"}
                    </span>
                  </td>
                  <td className="table-cell text-xs font-bold text-slate-500">{device.location || "UNMAPPED"}</td>
                  <td className="table-cell">
                    <div className="flex justify-center">
                       <StatusBadge status={device.status} />
                    </div>
                  </td>
                  <td className="table-cell text-right">
                    <button className="w-10 h-10 flex items-center justify-center text-slate-300 group-hover:text-blue-600 group-hover:bg-blue-50 rounded-xl transition-all">
                      <FaArrowRight size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

import { useEffect, useState } from "react";
import { 
  getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  getAdminDevices, createAdminDevice, updateAdminDevice, deleteAdminDevice 
} from "../api/api";
import { 
  UserPlus, Server, Edit2, Trash2, Shield, 
  Settings, Database, Search, CheckCircle, 
  Users
} from "lucide-react";
import toast from "react-hot-toast";
import FilterSelect from "../components/FilterSelect";

const roleColors = {
  ADMIN: "bg-blue-50 text-blue-600 border-blue-100",
  NOC: "bg-emerald-50 text-emerald-600 border-emerald-100",
  L1: "bg-purple-50 text-purple-600 border-purple-100",
  L2: "bg-amber-50 text-amber-600 border-amber-100"
};

const deviceTypeColors = {
  Router: "bg-sky-50 text-sky-600 border-sky-100",
  Switch: "bg-teal-50 text-teal-600 border-teal-100",
  Firewall: "bg-rose-50 text-rose-600 border-rose-100",
  Server: "bg-indigo-50 text-indigo-600 border-indigo-100"
};

export default function Administration() {
  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState({ users: false, devices: false });

  const [userForm, setUserForm] = useState({ username: "", email: "", role: "NOC" });
  const [deviceForm, setDeviceForm] = useState({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" });

  const [editingUser, setEditingUser] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);

  const [searchUser, setSearchUser] = useState("");
  const [searchDevice, setSearchDevice] = useState("");

  useEffect(() => {
    fetchUsers();
    fetchDevices();
  }, []);

  const fetchUsers = async () => {
    setLoading(l => ({ ...l, users: true }));
    try {
      const res = await getAdminUsers();
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error("User registry offline");
    } finally {
      setLoading(l => ({ ...l, users: false }));
    }
  };

  const fetchDevices = async () => {
    setLoading(l => ({ ...l, devices: true }));
    try {
      const res = await getAdminDevices();
      setDevices(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error("Infrastructure registry offline");
    } finally {
      setLoading(l => ({ ...l, devices: false }));
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateAdminUser(editingUser, userForm);
        toast.success(`Identity "${userForm.username}" re-provisioned`);
      } else {
        await createAdminUser(userForm);
        toast.success(`Identity "${userForm.username}" provisioned`);
      }
      setUserForm({ username: "", email: "", role: "NOC" });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error("User governance failure");
    }
  };

  const handleDeviceSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await updateAdminDevice(editingDevice, deviceForm);
        toast.success(`Node "${deviceForm.device_name}" re-mapped`);
      } else {
        await createAdminDevice(deviceForm);
        toast.success(`Node "${deviceForm.device_name}" deployed`);
      }
      setDeviceForm({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" });
      setEditingDevice(null);
      fetchDevices();
    } catch (err) {
      toast.error("Topology update failure");
    }
  };

  const deleteUserRecord = async (id, name) => {
    if (!window.confirm(`Terminate identity access for "${name}"?`)) return;
    try {
      await deleteAdminUser(id);
      toast.success("Identity purged");
      fetchUsers();
    } catch {
      toast.error("Termination failed");
    }
  };

  const deleteDeviceRecord = async (id, name) => {
    if (!window.confirm(`Decommission node "${name}"?`)) return;
    try {
      await deleteAdminDevice(id);
      toast.success("Node decommissioned");
      fetchDevices();
    } catch {
      toast.error("Decommissioning failure");
    }
  };

  return (
    <div className="space-y-8">
      {/* HEADER */}
      <div className="flex justify-between items-center bg-white p-8 rounded-3xl border border-slate-100 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-slate-50/50 rounded-full blur-3xl -mr-32 -mt-32 pointer-events-none" />
        
        <div className="relative z-10">
          <h1 className="page-title tracking-tighter uppercase">Systems Governance</h1>
          <p className="text-[10px] font-black uppercase tracking-[0.4em] text-slate-500 mt-1 flex items-center gap-2">
             <span className="w-1.5 h-1.5 bg-slate-900 rounded-full animate-pulse shadow-lg" />
             Strategic Protocol Management &bull; Admin Level L3
          </p>
        </div>
        
        <div className="flex items-center gap-4 relative z-10">
           <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 rounded-2xl border border-slate-800 shadow-xl shadow-slate-200">
             <Shield size={16} className="text-blue-400" />
             <span className="text-[10px] font-black text-white uppercase tracking-widest">Enclave Mode</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* USER MANAGEMENT SECTION */}
        <div className="space-y-8">
          <div className="card !p-8 border-slate-100 shadow-sm group">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600 shadow-inner group-hover:scale-110 transition-transform">
                <Users size={28} />
              </div>
              <div>
                 <h2 className="text-lg font-black tracking-tight text-slate-900">{editingUser ? "Edit System Identity" : "Provision New Identity"}</h2>
                 <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">Multi-factor Governance protocol</p>
              </div>
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <FormInput label="Operative Username" value={userForm.username} onChange={v => setUserForm({...userForm, username: v})} placeholder="e.g. operator_main" />
                <FormInput label="Secure Email" value={userForm.email} onChange={v => setUserForm({...userForm, email: v})} placeholder="e.g. ops@lnms.pro" type="email" />
              </div>
              <div className="grid grid-cols-1">
                 <FormSelect label="Governance Role" value={userForm.role} onChange={v => setUserForm({...userForm, role: v})} options={["ADMIN", "NOC", "L1", "L2"]} />
              </div>
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 py-3.5 bg-slate-900 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200 flex items-center justify-center gap-2 active:scale-95">
                  {editingUser ? <CheckCircle size={14}/> : <UserPlus size={14}/>}
                  {editingUser ? "Commit Identity" : "Provision Identity"}
                </button>
                {editingUser && (
                  <button type="button" onClick={() => { setEditingUser(null); setUserForm({ username: "", email: "", role: "NOC" }); }} className="px-6 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                )}
              </div>
            </form>
          </div>

          <div className="card !p-0 overflow-hidden border-slate-100 shadow-sm">
            <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Identity Registry</h3>
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" placeholder="Scan registry..." value={searchUser} onChange={e => setSearchUser(e.target.value)} className="bg-white border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-4 focus:ring-blue-50 outline-none w-56 font-bold" />
               </div>
            </div>
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr>
                    <th className="table-header table-cell">Identity ID</th>
                    <th className="table-header table-cell">Permission</th>
                    <th className="table-header table-cell text-center">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.filter(u => u.username.toLowerCase().includes(searchUser.toLowerCase())).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="table-cell">
                        <div className="font-bold text-slate-800 text-sm">{u.username}</div>
                        <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{u.email}</div>
                      </td>
                      <td className="table-cell">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${roleColors[u.role] || "bg-slate-50 text-slate-500 border-slate-100"}`}>
                           {u.role}
                         </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex justify-center gap-3">
                           <button onClick={() => { setEditingUser(u.id); setUserForm({username: u.username, email: u.email, role: u.role}); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-xl transition-all"><Edit2 size={14}/></button>
                           <button onClick={() => deleteUserRecord(u.id, u.username)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* DEVICE MANAGEMENT SECTION */}
        <div className="space-y-8">
          <div className="card !p-8 border-slate-100 shadow-sm border-l-emerald-500 border-l-4 group">
            <div className="flex items-center gap-4 mb-8">
              <div className="w-14 h-14 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600 shadow-inner group-hover:scale-110 transition-transform">
                <Server size={28} />
              </div>
              <div>
                 <h2 className="text-lg font-black tracking-tight text-slate-900">{editingDevice ? "Modify Infrastructure" : "Map New Node"}</h2>
                 <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">Topology Integration Framework</p>
              </div>
            </div>

            <form onSubmit={handleDeviceSubmit} className="space-y-5">
              <div className="grid grid-cols-2 gap-5">
                <FormInput label="Internal Label" value={deviceForm.device_name} onChange={v => setDeviceForm({...deviceForm, device_name: v})} placeholder="e.g. CORE-RT-01" />
                <FormInput label="Network Hostname" value={deviceForm.hostname} onChange={v => setDeviceForm({...deviceForm, hostname: v})} placeholder="e.g. core-sw-pune" />
              </div>
              <div className="grid grid-cols-2 gap-5">
                 <FormInput label="IPv4 Endpoint" value={deviceForm.ip_address} onChange={v => setDeviceForm({...deviceForm, ip_address: v})} placeholder="192.168.1.1" />
                 <FormSelect label="Switch Layer" value={deviceForm.device_type} onChange={v => setDeviceForm({...deviceForm, device_type: v})} options={["Router", "Switch", "Firewall", "Server"]} />
              </div>
              <FormInput label="Physical Vector" value={deviceForm.location} onChange={v => setDeviceForm({...deviceForm, location: v})} placeholder="e.g. DC-01, Rack-4A" />
              <div className="flex gap-4 pt-4">
                <button type="submit" className="flex-1 py-3.5 bg-emerald-600 text-white rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-xl shadow-emerald-100 flex items-center justify-center gap-2 active:scale-95">
                  {editingDevice ? <CheckCircle size={14}/> : <Database size={14}/>}
                  {editingDevice ? "Update Topology" : "Integrate Node"}
                </button>
                {editingDevice && (
                  <button type="button" onClick={() => { setEditingDevice(null); setDeviceForm({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" }); }} className="px-6 py-3.5 bg-slate-100 text-slate-500 rounded-2xl font-black text-[10px] uppercase tracking-widest hover:bg-slate-200 transition-all">Cancel</button>
                )}
              </div>
            </form>
          </div>

          <div className="card !p-0 overflow-hidden border-slate-100 shadow-sm">
            <div className="px-8 py-6 border-b border-slate-50 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">Node Matrix</h3>
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input type="text" placeholder="Search node..." value={searchDevice} onChange={e => setSearchDevice(e.target.value)} className="bg-white border border-slate-100 rounded-xl pl-9 pr-4 py-2 text-xs focus:ring-4 focus:ring-emerald-50 outline-none w-56 font-bold" />
               </div>
            </div>
            <div className="overflow-x-auto max-h-[450px]">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr>
                    <th className="table-header table-cell">Identity</th>
                    <th className="table-header table-cell">Endpoint</th>
                    <th className="table-header table-cell">Layer</th>
                    <th className="table-header table-cell text-center">Ops</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {devices.filter(d => d.device_name.toLowerCase().includes(searchDevice.toLowerCase())).map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="table-cell">
                        <div className="font-bold text-slate-800 text-sm">{d.device_name}</div>
                        <div className="text-[9px] text-slate-400 font-black uppercase tracking-widest whitespace-nowrap">{d.location}</div>
                      </td>
                      <td className="table-cell">
                        <div className="font-mono text-xs text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-lg inline-block">{d.ip_address}</div>
                        <div className="text-[9px] text-slate-400 italic mt-1 font-bold">{d.hostname}</div>
                      </td>
                      <td className="table-cell">
                         <span className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border ${deviceTypeColors[d.device_type] || "bg-slate-50 text-slate-500 border-slate-100"}`}>
                           {d.device_type}
                         </span>
                      </td>
                      <td className="table-cell">
                        <div className="flex justify-center gap-3">
                           <button onClick={() => { setEditingDevice(d.id); setDeviceForm({device_name: d.device_name, hostname: d.hostname, ip_address: d.ip_address, device_type: d.device_type, location: d.location}); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-xl transition-all"><Edit2 size={14}/></button>
                           <button onClick={() => deleteDeviceRecord(d.id, d.device_name)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"><Trash2 size={14}/></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}

function FormInput({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div className="space-y-2">
       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
       <input 
         type={type}
         value={value}
         onChange={e => onChange(e.target.value)}
         placeholder={placeholder}
         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all placeholder:text-slate-300"
       />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-2">
       <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
       <div className="relative group">
          <select 
            value={value}
            onChange={e => onChange(e.target.value)}
            className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-black outline-none focus:bg-white focus:ring-4 focus:ring-blue-50 focus:border-blue-400 transition-all cursor-pointer appearance-none"
          >
            {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
          </select>
          <div className="absolute right-4 top-1/2 -translate-y-1/2 pointer-events-none text-slate-400">
             <Settings size={12} className="animate-spin-slow" />
          </div>
       </div>
    </div>
  );
}
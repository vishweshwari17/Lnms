import { useEffect, useState } from "react";
import { 
  getAdminUsers, createAdminUser, updateAdminUser, deleteAdminUser,
  getAdminDevices, createAdminDevice, updateAdminDevice, deleteAdminDevice 
} from "../api/api";
import { 
  UserPlus, Server, Edit2, Trash2, Shield, 
  Settings, Database, Cpu, Search, CheckCircle, 
  XCircle, Filter, Activity, Users, Globe
} from "lucide-react";
import toast from "react-hot-toast";

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
      toast.error("Failed to load users");
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
      toast.error("Failed to load devices");
    } finally {
      setLoading(l => ({ ...l, devices: false }));
    }
  };

  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await updateAdminUser(editingUser, userForm);
        toast.success(`User "${userForm.username}" updated`);
      } else {
        await createAdminUser(userForm);
        toast.success(`User "${userForm.username}" created`);
      }
      setUserForm({ username: "", email: "", role: "NOC" });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "User operation failed");
    }
  };

  const handleDeviceSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await updateAdminDevice(editingDevice, deviceForm);
        toast.success(`Device "${deviceForm.device_name}" updated`);
      } else {
        await createAdminDevice(deviceForm);
        toast.success(`Device "${deviceForm.device_name}" added`);
      }
      setDeviceForm({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" });
      setEditingDevice(null);
      fetchDevices();
    } catch (err) {
      toast.error(err?.response?.data?.detail || "Device operation failed");
    }
  };

  const deleteUserRecord = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    try {
      await deleteAdminUser(id);
      toast.success("User deleted");
      fetchUsers();
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const deleteDeviceRecord = async (id, name) => {
    if (!window.confirm(`Delete device "${name}"?`)) return;
    try {
      await deleteAdminDevice(id);
      toast.success("Device deleted");
      fetchDevices();
    } catch {
      toast.error("Failed to delete device");
    }
  };

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex justify-between items-center premium-card p-6">
        <div>
          <h1 className="page-title mb-1">Administration Portal</h1>
          <p className="small-meta uppercase tracking-widest text-blue-500">Global System Orchestration & User Governance</p>
        </div>
        <div className="flex gap-4">
           <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 border border-blue-100 rounded-xl">
             <Shield size={16} className="text-blue-600" />
             <span className="text-[10px] font-black text-blue-600 uppercase tracking-widest">Admin Mode</span>
           </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* USER MANAGEMENT SECTION */}
        <div className="space-y-6">
          <div className="premium-card p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-blue-50 flex items-center justify-center text-blue-600">
                <Users size={24} />
              </div>
              <div>
                 <h2 className="card-title text-slate-800">{editingUser ? "Edit System Operative" : "Provision New Operative"}</h2>
                 <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">HRP-Secure Access provisioning</p>
              </div>
            </div>

            <form onSubmit={handleUserSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput 
                  label="Username" 
                  value={userForm.username} 
                  onChange={v => setUserForm({...userForm, username: v})} 
                  placeholder="e.g. operator_main"
                />
                <FormInput 
                  label="Email Address" 
                  value={userForm.email} 
                  onChange={v => setUserForm({...userForm, email: v})} 
                  placeholder="e.g. ops@lnms.pro"
                  type="email"
                />
              </div>
              <FormSelect 
                label="Assigned Role" 
                value={userForm.role}
                onChange={v => setUserForm({...userForm, role: v})}
                options={["ADMIN", "NOC", "L1", "L2"]}
              />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-2">
                  {editingUser ? <CheckCircle size={16}/> : <UserPlus size={16}/>}
                  {editingUser ? "Update Identity" : "Provision Operative"}
                </button>
                {editingUser && (
                  <button type="button" onClick={() => { setEditingUser(null); setUserForm({ username: "", email: "", role: "NOC" }); }} className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="premium-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Operative Directory</h3>
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Filter operatives..." 
                    value={searchUser} 
                    onChange={e => setSearchUser(e.target.value)}
                    className="bg-white border border-slate-100 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-blue-100 outline-none w-48 font-medium"
                  />
               </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Role</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {users.filter(u => u.username.toLowerCase().includes(searchUser.toLowerCase())).map(u => (
                    <tr key={u.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-sm">{u.username}</div>
                        <div className="text-[10px] text-slate-400 font-medium">{u.email}</div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${roleColors[u.role] || "bg-slate-50 text-slate-500 border-slate-100"}`}>
                           {u.role}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                           <button onClick={() => { setEditingUser(u.id); setUserForm({username: u.username, email: u.email, role: u.role}); }} className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-all"><Edit2 size={14}/></button>
                           <button onClick={() => deleteUserRecord(u.id, u.username)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14}/></button>
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
        <div className="space-y-6">
          <div className="premium-card p-6 border-l-emerald-500 border-l-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 flex items-center justify-center text-emerald-600">
                <Server size={24} />
              </div>
              <div>
                 <h2 className="card-title text-slate-800">{editingDevice ? "Modify Infrastructure" : "Register Node"}</h2>
                 <p className="text-[10px] uppercase font-black text-slate-400 tracking-widest mt-1">Network Topology Integration</p>
              </div>
            </div>

            <form onSubmit={handleDeviceSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <FormInput 
                  label="Device Identity" 
                  value={deviceForm.device_name} 
                  onChange={v => setDeviceForm({...deviceForm, device_name: v})} 
                  placeholder="e.g. CORE-RT-01"
                />
                <FormInput 
                  label="Hostname" 
                  value={deviceForm.hostname} 
                  onChange={v => setDeviceForm({...deviceForm, hostname: v})} 
                  placeholder="e.g. core-sw-pune"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <FormInput 
                  label="IPv4 Address" 
                  value={deviceForm.ip_address} 
                  onChange={v => setDeviceForm({...deviceForm, ip_address: v})} 
                  placeholder="192.168.1.1"
                />
                <FormSelect 
                  label="Matrix Layer" 
                  value={deviceForm.device_type}
                  onChange={v => setDeviceForm({...deviceForm, device_type: v})}
                  options={["Router", "Switch", "Firewall", "Server"]}
                />
              </div>
              <FormInput 
                label="Physical Location" 
                value={deviceForm.location} 
                onChange={v => setDeviceForm({...deviceForm, location: v})} 
                placeholder="e.g. DC-01, Rack-4A"
              />
              <div className="flex gap-3 pt-2">
                <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-lg shadow-emerald-100 flex items-center justify-center gap-2">
                  {editingDevice ? <CheckCircle size={16}/> : <Database size={16}/>}
                  {editingDevice ? "Commit Changes" : "Deploy Node"}
                </button>
                {editingDevice && (
                  <button type="button" onClick={() => { setEditingDevice(null); setDeviceForm({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" }); }} className="px-4 py-3 bg-slate-100 text-slate-500 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-200 transition-all">
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="premium-card p-0 overflow-hidden">
            <div className="px-6 py-4 border-b border-slate-100 flex justify-between items-center bg-slate-50/50">
               <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Node Matrix</h3>
               <div className="relative">
                  <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-300" />
                  <input 
                    type="text" 
                    placeholder="Search node..." 
                    value={searchDevice} 
                    onChange={e => setSearchDevice(e.target.value)}
                    className="bg-white border border-slate-100 rounded-lg pl-9 pr-3 py-1.5 text-xs focus:ring-2 focus:ring-emerald-100 outline-none w-48 font-medium"
                  />
               </div>
            </div>
            <div className="overflow-x-auto max-h-[400px] custom-scrollbar">
              <table className="w-full text-left">
                <thead className="sticky top-0 bg-white shadow-sm z-10">
                  <tr>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Identity</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Path</th>
                    <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Layer</th>
                    <th className="px-6 py-4 text-center text-[10px] font-black uppercase tracking-widest text-slate-400">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {devices.filter(d => d.device_name.toLowerCase().includes(searchDevice.toLowerCase())).map(d => (
                    <tr key={d.id} className="hover:bg-slate-50/50 transition-colors group">
                      <td className="px-6 py-4">
                        <div className="font-bold text-slate-800 text-sm">{d.device_name}</div>
                        <div className="text-[10px] text-slate-400 font-medium uppercase tracking-widest">{d.location}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-mono text-xs text-blue-600 bg-blue-50/50 px-2 py-0.5 rounded-md inline-block">{d.ip_address}</div>
                        <div className="text-[9px] text-slate-400 italic mt-1">{d.hostname}</div>
                      </td>
                      <td className="px-6 py-4">
                         <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-widest border ${deviceTypeColors[d.device_type] || "bg-slate-50 text-slate-500 border-slate-100"}`}>
                           {d.device_type}
                         </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex justify-center gap-2">
                           <button onClick={() => { setEditingDevice(d.id); setDeviceForm({device_name: d.device_name, hostname: d.hostname, ip_address: d.ip_address, device_type: d.device_type, location: d.location}); }} className="p-2 text-emerald-500 hover:bg-emerald-50 rounded-lg transition-all"><Edit2 size={14}/></button>
                           <button onClick={() => deleteDeviceRecord(d.id, d.device_name)} className="p-2 text-rose-500 hover:bg-rose-50 rounded-lg transition-all"><Trash2 size={14}/></button>
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
    <div className="space-y-1.5">
       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
       <input 
         type={type}
         value={value}
         onChange={e => onChange(e.target.value)}
         placeholder={placeholder}
         className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-medium outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all placeholder:text-slate-300"
       />
    </div>
  );
}

function FormSelect({ label, value, onChange, options }) {
  return (
    <div className="space-y-1.5">
       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">{label}</label>
       <select 
         value={value}
         onChange={e => onChange(e.target.value)}
         className="w-full bg-slate-50 border border-slate-100 rounded-xl px-4 py-2.5 text-sm font-bold outline-none focus:bg-white focus:ring-2 focus:ring-blue-100 focus:border-blue-400 transition-all cursor-pointer"
       >
         {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
       </select>
    </div>
  );
}
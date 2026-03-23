import { useEffect, useState } from "react";
import axios from "axios";
import { FaTrash, FaEdit, FaUserPlus, FaServer, FaCheck, FaTimes, FaSearch } from "react-icons/fa";

const API = "http://localhost:8000/admin";
// ── Toast ────────────────────────────────────────────────────────────────────
function Toast({ toasts, remove }) {
  return (
    <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10 }}>
      {toasts.map(t => (
        <div key={t.id} style={{
          display: "flex", alignItems: "center", gap: 10,
          padding: "12px 18px", borderRadius: 10, minWidth: 260, maxWidth: 340,
          background: t.type === "success" ? "#0f766e" : "#dc2626",
          color: "#fff", fontSize: 14, fontWeight: 500,
          boxShadow: "0 4px 20px rgba(0,0,0,0.2)",
          animation: "slideIn 0.3s ease"
        }}>
          {t.type === "success" ? <FaCheck size={14} /> : <FaTimes size={14} />}
          <span style={{ flex: 1 }}>{t.message}</span>
          <button onClick={() => remove(t.id)} style={{ background: "none", border: "none", color: "#fff", cursor: "pointer", opacity: 0.7 }}>✕</button>
        </div>
      ))}
    </div>
  );
}

function useToast() {
  const [toasts, setToasts] = useState([]);
  const add = (message, type = "success") => {
    const id = Date.now();
    setToasts(p => [...p, { id, message, type }]);
    setTimeout(() => setToasts(p => p.filter(t => t.id !== id)), 3500);
  };
  const remove = (id) => setToasts(p => p.filter(t => t.id !== id));
  return { toasts, success: m => add(m, "success"), error: m => add(m, "error"), remove };
}

// ── Badge ─────────────────────────────────────────────────────────────────────
const roleBadge = { ADMIN: "#1e40af", NOC: "#0f766e", L1: "#7c3aed", L2: "#b45309" };
const typeBadge = { Router: "#0369a1", Switch: "#0f766e", Firewall: "#dc2626", Server: "#7c3aed" };

function Badge({ label, colorMap }) {
  const bg = colorMap[label] || "#6b7280";
  return (
    <span style={{
      background: bg + "18", color: bg, border: `1px solid ${bg}40`,
      borderRadius: 6, padding: "2px 10px", fontSize: 11, fontWeight: 700,
      letterSpacing: "0.04em", textTransform: "uppercase"
    }}>{label}</span>
  );
}

// ── Field ─────────────────────────────────────────────────────────────────────
function Field({ label, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      <label style={{ fontSize: 11, fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.06em" }}>{label}</label>
      {children}
    </div>
  );
}

const inputStyle = {
  border: "1.5px solid #e2e8f0", borderRadius: 8, padding: "9px 12px",
  fontSize: 14, outline: "none", background: "#f8fafc", color: "#1e293b",
  transition: "border-color 0.15s",
  width: "100%", boxSizing: "border-box"
};

const selectStyle = { ...inputStyle, cursor: "pointer" };

// ── Main Component ────────────────────────────────────────────────────────────
export default function Administration() {
  const toast = useToast();

  const [users, setUsers] = useState([]);
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState({ users: false, devices: false });

  const [userForm, setUserForm] = useState({ username: "", email: "", role: "NOC" });
  const [deviceForm, setDeviceForm] = useState({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" });

  const [editingUser, setEditingUser] = useState(null);
  const [editingDevice, setEditingDevice] = useState(null);

  const [searchUser, setSearchUser] = useState("");
  const [searchDevice, setSearchDevice] = useState("");

  useEffect(() => { fetchUsers(); fetchDevices(); }, []);

  const fetchUsers = async () => {
    setLoading(l => ({ ...l, users: true }));
    try {
      const res = await axios.get(`${API}/users`);
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
      const res = await axios.get(`${API}/devices`);
      setDevices(Array.isArray(res.data) ? res.data : []);
    } catch (e) {
      toast.error("Failed to load devices");
    } finally {
      setLoading(l => ({ ...l, devices: false }));
    }
  };

  // ── User CRUD ───────────────────────────────────────────────────────────────
  const handleUserSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingUser) {
        await axios.put(`${API}/users/${editingUser}`, userForm);
        toast.success(`User "${userForm.username}" updated successfully`);
      } else {
        await axios.post(`${API}/users`, userForm);
        toast.success(`User "${userForm.username}" created successfully`);
      }
      setUserForm({ username: "", email: "", role: "NOC" });
      setEditingUser(null);
      fetchUsers();
    } catch (err) {
      const msg = err?.response?.data?.detail || "User operation failed";
      toast.error(msg);
    }
  };

  const handleEditUser = (u) => {
    setUserForm({ username: u.username, email: u.email, role: u.role });
    setEditingUser(u.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteUser = async (id, name) => {
    if (!window.confirm(`Delete user "${name}"?`)) return;
    try {
      await axios.delete(`${API}/users/${id}`);
      toast.success(`User "${name}" deleted`);
      fetchUsers();
    } catch {
      toast.error("Failed to delete user");
    }
  };

  const cancelEditUser = () => {
    setUserForm({ username: "", email: "", role: "NOC" });
    setEditingUser(null);
  };

  // ── Device CRUD ─────────────────────────────────────────────────────────────
  const handleDeviceSubmit = async (e) => {
    e.preventDefault();
    try {
      if (editingDevice) {
        await axios.put(`${API}/devices/${editingDevice}`, deviceForm);
        toast.success(`Device "${deviceForm.device_name}" updated successfully`);
      } else {
        await axios.post(`${API}/devices`, deviceForm);
        toast.success(`Device "${deviceForm.device_name}" added successfully`);
      }
      setDeviceForm({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" });
      setEditingDevice(null);
      fetchDevices();
    } catch (err) {
      const msg = err?.response?.data?.detail || "Device operation failed";
      toast.error(msg);
    }
  };

  const handleEditDevice = (d) => {
    setDeviceForm({ device_name: d.device_name, hostname: d.hostname, ip_address: d.ip_address, device_type: d.device_type, location: d.location });
    setEditingDevice(d.id);
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const deleteDevice = async (id, name) => {
    if (!window.confirm(`Delete device "${name}"?`)) return;
    try {
      await axios.delete(`${API}/devices/${id}`);
      toast.success(`Device "${name}" deleted`);
      fetchDevices();
    } catch {
      toast.error("Failed to delete device");
    }
  };

  const cancelEditDevice = () => {
    setDeviceForm({ device_name: "", hostname: "", ip_address: "", device_type: "Router", location: "" });
    setEditingDevice(null);
  };

  // ── Filters ─────────────────────────────────────────────────────────────────
  const filteredUsers = users.filter(u =>
    u.username?.toLowerCase().includes(searchUser.toLowerCase()) ||
    u.email?.toLowerCase().includes(searchUser.toLowerCase())
  );
  const filteredDevices = devices.filter(d =>
    d.device_name?.toLowerCase().includes(searchDevice.toLowerCase()) ||
    d.ip_address?.toLowerCase().includes(searchDevice.toLowerCase())
  );

  // ── Styles ───────────────────────────────────────────────────────────────────
  const card = {
    background: "#fff", borderRadius: 14, padding: 24,
    boxShadow: "0 1px 3px rgba(0,0,0,0.07), 0 4px 16px rgba(0,0,0,0.04)",
    border: "1px solid #f1f5f9"
  };

  const btnPrimary = (color) => ({
    background: color, color: "#fff", border: "none", borderRadius: 8,
    padding: "10px 0", width: "100%", fontSize: 14, fontWeight: 600,
    cursor: "pointer", transition: "opacity 0.15s", letterSpacing: "0.02em"
  });

  const btnSecondary = {
    background: "#f1f5f9", color: "#64748b", border: "1px solid #e2e8f0",
    borderRadius: 8, padding: "10px 0", width: "100%", fontSize: 14,
    fontWeight: 600, cursor: "pointer"
  };

  const iconBtn = (color) => ({
    background: color + "12", color, border: `1px solid ${color}30`,
    borderRadius: 6, padding: "6px 8px", cursor: "pointer", fontSize: 12,
    transition: "background 0.15s"
  });

  const thStyle = {
    padding: "10px 12px", textAlign: "left", fontSize: 11,
    fontWeight: 700, color: "#94a3b8", textTransform: "uppercase",
    letterSpacing: "0.06em", borderBottom: "2px solid #f1f5f9",
    whiteSpace: "nowrap"
  };

  const tdStyle = {
    padding: "11px 12px", fontSize: 13, color: "#334155",
    borderBottom: "1px solid #f8fafc", verticalAlign: "middle"
  };

  return (
    <>
      <style>{`
        @keyframes slideIn { from { transform: translateX(40px); opacity: 0; } to { transform: none; opacity: 1; } }
        input:focus, select:focus { border-color: #3b82f6 !important; background: #fff !important; box-shadow: 0 0 0 3px #3b82f620; }
        tr:hover td { background: #f8fafc; }
        button:hover { opacity: 0.85; }
      `}</style>

      <Toast toasts={toast.toasts} remove={toast.remove} />

      <div style={{ padding: "32px", background: "#f8fafc", minHeight: "100vh", fontFamily: "'DM Sans', sans-serif" }}>

        {/* Header */}
        <div style={{ marginBottom: 28 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: "#0f172a", margin: 0 }}>Administration</h1>
          <p style={{ color: "#64748b", marginTop: 4, fontSize: 14 }}>Manage system users and network devices</p>
        </div>

        {/* ── FORMS ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 24 }}>

          {/* User Form */}
          <div style={{ ...card, borderTop: `3px solid #3b82f6` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: "8px 10px", color: "#3b82f6" }}><FaUserPlus size={16} /></div>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  {editingUser ? "Edit User" : "Create User"}
                </h2>
                {editingUser && <p style={{ margin: 0, fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>● Editing mode</p>}
              </div>
            </div>

            <form onSubmit={handleUserSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <Field label="Username">
                <input style={inputStyle} placeholder="e.g. john_doe" value={userForm.username}
                  onChange={e => setUserForm({ ...userForm, username: e.target.value })} required autoComplete="off" />
              </Field>
              <Field label="Email">
                <input style={inputStyle} type="email" placeholder="e.g. john@company.com" value={userForm.email}
                  onChange={e => setUserForm({ ...userForm, email: e.target.value })} required autoComplete="off" />
              </Field>
              <Field label="Role">
                <select style={selectStyle} value={userForm.role} onChange={e => setUserForm({ ...userForm, role: e.target.value })}>
                  <option value="ADMIN">ADMIN</option>
                  <option value="NOC">NOC</option>
                  <option value="L1">L1</option>
                  <option value="L2">L2</option>
                </select>
              </Field>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" style={btnPrimary("#3b82f6")}>
                  {editingUser ? "Update User" : "Create User"}
                </button>
                {editingUser && (
                  <button type="button" onClick={cancelEditUser} style={{ ...btnSecondary, width: "auto", padding: "10px 16px" }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          {/* Device Form */}
          <div style={{ ...card, borderTop: `3px solid #10b981` }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 20 }}>
              <div style={{ background: "#ecfdf5", borderRadius: 8, padding: "8px 10px", color: "#10b981" }}><FaServer size={16} /></div>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>
                  {editingDevice ? "Edit Device" : "Add Device"}
                </h2>
                {editingDevice && <p style={{ margin: 0, fontSize: 11, color: "#f59e0b", fontWeight: 600 }}>● Editing mode</p>}
              </div>
            </div>

            <form onSubmit={handleDeviceSubmit} style={{ display: "flex", flexDirection: "column", gap: 14 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Device Name">
                  <input style={inputStyle} placeholder="e.g. Cisco-Edge" value={deviceForm.device_name}
                    onChange={e => setDeviceForm({ ...deviceForm, device_name: e.target.value })} required autoComplete="off" />
                </Field>
                <Field label="Hostname">
                  <input style={inputStyle} placeholder="e.g. core-router-1" value={deviceForm.hostname}
                    onChange={e => setDeviceForm({ ...deviceForm, hostname: e.target.value })} required autoComplete="off" />
                </Field>
                <Field label="IP Address">
                  <input style={inputStyle} placeholder="e.g. 192.168.1.1" value={deviceForm.ip_address}
                    onChange={e => setDeviceForm({ ...deviceForm, ip_address: e.target.value })} required autoComplete="off" />
                </Field>
                <Field label="Device Type">
                  <select style={selectStyle} value={deviceForm.device_type} onChange={e => setDeviceForm({ ...deviceForm, device_type: e.target.value })}>
                    <option>Router</option><option>Switch</option><option>Firewall</option><option>Server</option>
                  </select>
                </Field>
              </div>
              <Field label="Location">
                <input style={inputStyle} placeholder="e.g. DC1 - Rack A3" value={deviceForm.location}
                  onChange={e => setDeviceForm({ ...deviceForm, location: e.target.value })} required autoComplete="off" />
              </Field>
              <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
                <button type="submit" style={btnPrimary("#10b981")}>
                  {editingDevice ? "Update Device" : "Add Device"}
                </button>
                {editingDevice && (
                  <button type="button" onClick={cancelEditDevice} style={{ ...btnSecondary, width: "auto", padding: "10px 16px" }}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>

        {/* ── TABLES ROW ── */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

          {/* Users Table */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Users</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{users.length} total</p>
              </div>
              <div style={{ position: "relative" }}>
                <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 12 }} />
                <input placeholder="Search..." value={searchUser} onChange={e => setSearchUser(e.target.value)}
                  style={{ ...inputStyle, width: 180, paddingLeft: 30, fontSize: 13 }} />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle}>Username</th>
                    <th style={thStyle}>Email</th>
                    <th style={thStyle}>Role</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.users ? (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 32 }}>Loading...</td></tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr><td colSpan={4} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 32 }}>
                      {searchUser ? "No users match your search" : "No users found"}
                    </td></tr>
                  ) : filteredUsers.map(u => (
                    <tr key={u.id}>
                      <td style={{ ...tdStyle, fontWeight: 600, color: "#1e293b" }}>{u.username}</td>
                      <td style={{ ...tdStyle, color: "#64748b" }}>{u.email}</td>
                      <td style={tdStyle}><Badge label={u.role} colorMap={roleBadge} /></td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button onClick={() => handleEditUser(u)} style={iconBtn("#3b82f6")} title="Edit"><FaEdit /></button>
                          <button onClick={() => deleteUser(u.id, u.username)} style={iconBtn("#ef4444")} title="Delete"><FaTrash /></button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Devices Table */}
          <div style={card}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h2 style={{ margin: 0, fontSize: 15, fontWeight: 700, color: "#1e293b" }}>Devices</h2>
                <p style={{ margin: 0, fontSize: 12, color: "#94a3b8" }}>{devices.length} total</p>
              </div>
              <div style={{ position: "relative" }}>
                <FaSearch style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontSize: 12 }} />
                <input placeholder="Search..." value={searchDevice} onChange={e => setSearchDevice(e.target.value)}
                  style={{ ...inputStyle, width: 180, paddingLeft: 30, fontSize: 13 }} />
              </div>
            </div>

            <div style={{ overflowX: "auto" }}>
              <table style={{ width: "100%", borderCollapse: "collapse" }}>
                <thead>
                  <tr style={{ background: "#f8fafc" }}>
                    <th style={thStyle}>Device</th>
                    <th style={thStyle}>IP</th>
                    <th style={thStyle}>Type</th>
                    <th style={thStyle}>Location</th>
                    <th style={{ ...thStyle, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading.devices ? (
                    <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 32 }}>Loading...</td></tr>
                  ) : filteredDevices.length === 0 ? (
                    <tr><td colSpan={5} style={{ ...tdStyle, textAlign: "center", color: "#94a3b8", padding: 32 }}>
                      {searchDevice ? "No devices match your search" : "No devices found"}
                    </td></tr>
                  ) : filteredDevices.map(d => (
                    <tr key={d.id}>
                      <td style={tdStyle}>
                        <div style={{ fontWeight: 600, color: "#1e293b" }}>{d.device_name}</div>
                        <div style={{ fontSize: 11, color: "#94a3b8" }}>{d.hostname}</div>
                      </td>
                      <td style={{ ...tdStyle, fontFamily: "monospace", fontSize: 12, color: "#0369a1" }}>{d.ip_address}</td>
                      <td style={tdStyle}><Badge label={d.device_type} colorMap={typeBadge} /></td>
                      <td style={{ ...tdStyle, color: "#64748b", fontSize: 12 }}>{d.location}</td>
                      <td style={{ ...tdStyle, textAlign: "center" }}>
                        <div style={{ display: "flex", gap: 6, justifyContent: "center" }}>
                          <button onClick={() => handleEditDevice(d)} style={iconBtn("#3b82f6")} title="Edit"><FaEdit /></button>
                          <button onClick={() => deleteDevice(d.id, d.device_name)} style={iconBtn("#ef4444")} title="Delete"><FaTrash /></button>
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
    </>
  );
}
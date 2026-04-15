import axios from "axios";
const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const LNMS_BASE = `http://${hostname}:8000/api/`; 
const API = axios.create({
  baseURL: LNMS_BASE
});

export const getAlarms = (params = {}) => API.get("alarms/", { params });
export const getCorrelated = () => API.get("correlated-alarms/");
export const getTickets = (params = {}) => API.get("tickets/", { params });
export const getTicket = (id) => API.get(`tickets/${id}`);
export const updateTicketStatus = (id, status) => API.put(`tickets/${id}`, { status });
export const addComment = (ticketId, message, sender = "USER") => {
  const payload = typeof message === "object" && message !== null
    ? message
    : { message, sender };

  return API.post(`tickets/${ticketId}/messages`, payload);
};

export const getIncidents = (params = {}) => API.get("incidents/", { params });
export const getIncident = (id) => API.get(`incidents/${id}`);
export const acknowledgeIncident = (id, user = "Admin") => API.put(`incidents/${id}/acknowledge?user=${user}`);
export const updateIncidentStatus = (id, status) => API.put(`incidents/${id}/status?status=${status}`);

export const getBreaches = () => API.get("breaches/");
export const getSLARisk = () => API.get("sla/risk/");
export const getDevices = (params = {}) => API.get("devices/", { params });
export const getDevice = (id) => API.get(`devices/${id}`);
export const getAuditLogs = () => API.get("audit/");
export const acknowledgeTicket = (id) =>
  API.put(`tickets/${id}`, { status: "ACK" });

export const resolveTicket = (id, payload = {}) =>
  API.put(`tickets/${id}`, { status: "RESOLVED", resolution_notes: payload.resolution_notes || payload.note || "" });

export const updateAlarmStatus = (id, status) => 
  API.put(`alarms/${id}/status`, { status });

export const closeTicket = (id, payload = {}) =>
  API.put(`tickets/${id}`, { status: "CLOSED", resolution_notes: payload.resolution_notes || payload.note || "" });

// Expert Roadmap Endpoints
export const getDiagnosticsPing = (id) => API.post(`diagnostics/ping/${id}`);
export const getDiagnosticsTrace = (id) => API.post(`diagnostics/traceroute/${id}`);
export const getNeighbors = (id) => API.get(`neighbors/${id}`);
export const getPerformanceMetrics = (id) => API.get(`metrics/${id}`);

// Admin Endpoints
export const getAdminUsers = () => API.get("admin/users");
export const createAdminUser = (data) => API.post("admin/users", data);
export const updateAdminUser = (id, data) => API.put(`admin/users/${id}`, data);
export const deleteAdminUser = (id) => API.delete(`admin/users/${id}`);

export const getAdminDevices = () => API.get("admin/devices");
export const createAdminDevice = (data) => API.post("admin/devices", data);
export const updateAdminDevice = (id, data) => API.put(`admin/devices/${id}`, data);
export const deleteAdminDevice = (id) => API.delete(`admin/devices/${id}`);


export default API;

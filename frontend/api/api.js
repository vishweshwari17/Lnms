import axios from "axios";
const LNMS_BASE = "http://localhost:8000/api"; 
const API = axios.create({
  baseURL: "http://localhost:8000"
});

export const getAlarms = () => API.get("/alarms");
export const getCorrelated = () => API.get("/correlated-alarms");
export const getTickets = () => API.get("/tickets/");
export const getTicket = (id) => API.get(`/tickets/${id}`);
export const updateTicketStatus = (id, status) => API.put(`/tickets/${id}`, { status });
export const addComment = (ticketId, message, sender = "USER") => {
  const payload = typeof message === "object" && message !== null
    ? message
    : { message, sender };

  return API.post(`/tickets/${ticketId}/messages`, payload);
};
export const getIncidents = () => API.get("/incidents");
export const getBreaches = () => API.get("/breaches");
export const getSLARisk = () => API.get("/sla/risk");
export const getDevices = () => API.get("/devices/");
export const getAuditLogs = () => API.get("/audit");
export const acknowledgeTicket = (id) =>
  API.put(`/tickets/${id}/ack`);

export const resolveTicket = (id, payload) =>
  API.put(`/tickets/${id}/resolve`, payload);

export const updateAlarmStatus = (id, status) => 
  API.put(`/alarms/${id}/status`, { status });

export default API;

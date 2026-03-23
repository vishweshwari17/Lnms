import { Link, useLocation } from "react-router-dom";
import { useState } from "react";

import {
  LayoutDashboard,
  Bell,
  Activity,
  Ticket,
  AlertTriangle,
  Server,
  Settings,
  ClipboardList,
  ChevronDown,
  ChevronRight,
  Menu
} from "lucide-react";

function Sidebar() {

  const [collapsed, setCollapsed] = useState(false);
  const [alarmOpen, setAlarmOpen] = useState(true);
  const [incidentOpen, setIncidentOpen] = useState(false);

  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  const navLink = (to, label, Icon) => (

    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-2.5 rounded-md text-sm font-medium transition-all duration-300
      ${
        isActive(to)
          ? "bg-blue-700 text-white"
          : "text-blue-100 hover:bg-blue-800"
      }`}
    >

      <Icon size={18} />

      {!collapsed && label}

    </Link>

  );

  return (

    <div
      className={`bg-blue-900 text-white min-h-screen transition-all duration-300
      ${collapsed ? "w-20" : "w-72"}`}
    >

      {/* HEADER */}

      <div className="flex items-center justify-between px-4 py-5 border-b border-blue-800">

        {!collapsed && (
          <div>
            <h1 className="text-lg font-bold">LNMS</h1>
            <p className="text-xs text-blue-300">Network Operations</p>
          </div>
        )}

        <button
          onClick={() => setCollapsed(!collapsed)}
          className="text-blue-200 hover:text-white"
        >
          <Menu size={20} />
        </button>

      </div>

      <nav className="px-2 py-6 space-y-6">

        {/* OVERVIEW */}

        <div>

          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-blue-400 uppercase tracking-widest">
              Overview
            </p>
          )}

          {navLink("/", "Dashboard", LayoutDashboard)}

        </div>

        {/* ALARM MANAGEMENT */}

        <div>

          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-blue-400 uppercase tracking-widest">
              Alarm Management
            </p>
          )}

          <button
            onClick={() => setAlarmOpen(!alarmOpen)}
            className="flex items-center justify-between w-full px-4 py-2 text-blue-100 hover:bg-blue-800 rounded-md"
          >

            <div className="flex items-center gap-3">
              <Bell size={18} />
              {!collapsed && "Alarms"}
            </div>

            {!collapsed && (
              alarmOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>
            )}

          </button>

          {alarmOpen && !collapsed && (

            <div className="ml-8 mt-2 space-y-1">

              {navLink("/alarms", "Incoming Alarms", Activity)}

              {navLink("/correlated-alarms", "Correlated Alarms", Activity)}

            </div>

          )}

        </div>

        {/* TICKET MANAGEMENT */}

        <div>

          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-blue-400 uppercase tracking-widest">
              Ticket Management
            </p>
          )}

          {navLink("/tickets", "Tickets", Ticket)}

        </div>

        {/* INCIDENT MANAGEMENT */}

        <div>

          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-blue-400 uppercase tracking-widest">
              Incident Management
            </p>
          )}

          <button
            onClick={() => setIncidentOpen(!incidentOpen)}
            className="flex items-center justify-between w-full px-4 py-2 text-blue-100 hover:bg-blue-800 rounded-md"
          >

            <div className="flex items-center gap-3">
              <AlertTriangle size={18} />
              {!collapsed && "Incidents"}
            </div>

            {!collapsed && (
              incidentOpen ? <ChevronDown size={16}/> : <ChevronRight size={16}/>
            )}

          </button>

          {incidentOpen && !collapsed && (

            <div className="ml-8 mt-2 space-y-1">

              {navLink("/incident-dashboard","Incident Dashboard",Activity)}

              {navLink("/incidents","Incidents List",ClipboardList)}

              {navLink("/sla-risk","SLA Risk",AlertTriangle)}

            </div>

          )}

        </div>

        {/* INFRASTRUCTURE */}

        <div>

          {!collapsed && (
            <p className="px-3 mb-2 text-xs font-semibold text-blue-400 uppercase tracking-widest">
              Infrastructure
            </p>
          )}

          {navLink("/devices","Devices",Server)}

          {navLink("/admin","Administration",Settings)}

          {navLink("/audit","Audit Logs",ClipboardList)}

        </div>

      </nav>

    </div>

  );
}

export default Sidebar;
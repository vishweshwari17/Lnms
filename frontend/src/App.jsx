import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import Dashboard from "../pages/Dashboard";
import IncomingAlarms from "../pages/IncomingAlarms";
import CorrelatedAlarms from "../pages/CorrelatedAlarms";
import Tickets from "../pages/Tickets";
import IncidentDashboard from "../pages/IncidentDashboard";
import IncidentsList from "../pages/IncidentsList";
import SLARisk from "../pages/SLARisk";
import Devices from "../pages/Devices";
import AuditLogs from "../pages/AuditLogs";
import Admin from "../pages/Administration";
import BreachTracker from "../pages/BreachTracker";
import TicketsDetail from "../pages/TicketDetails";

function App() {
  return (
    <BrowserRouter>

      <Routes>

        <Route element={<MainLayout />}>

          <Route path="/" element={<Dashboard />} />
          <Route path="/alarms" element={<IncomingAlarms />} />
          <Route path="/correlated-alarms" element={<CorrelatedAlarms />} />
            <Route path="/tickets" element={<Tickets />} />

            <Route
              path="/tickets/:id"
              element={<TicketsDetail />}
            />
          <Route path="/incident-dashboard" element={<IncidentDashboard />} />
          <Route path="/incidents" element={<IncidentsList />} />
          <Route path="/sla-risk" element={<SLARisk />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/audit" element={<AuditLogs />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="/breach-tracker" element={<BreachTracker />} />
 
        </Route>

      </Routes>

    </BrowserRouter>
  );
}

export default App;
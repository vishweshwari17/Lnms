import { BrowserRouter, Routes, Route } from "react-router-dom";
import MainLayout from "./layouts/MainLayout";

import Dashboard from "./pages/Dashboard";
import IncomingAlarms from "./pages/IncomingAlarms";
import CorrelatedAlarms from "./pages/CorrelatedAlarms";
import Tickets from "./pages/Tickets";

import IncidentsList from "./pages/IncidentsList";
import IncidentDetails from "./pages/IncidentDetails";
import Devices from "./pages/Devices";
import DeviceDetails from "./pages/DeviceDetails";
import TicketsDetail from "./pages/TicketDetails";
import AlarmDetails from "./pages/AlarmDetails";
import LiveStream from "./pages/LiveStream";
import AuditLogs from "./pages/AuditLogs";
import Administration from "./pages/Administration";



import { Toaster } from "react-hot-toast";

function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" reverseOrder={false} />

      <Routes>

        <Route element={<MainLayout />}>

          <Route path="/" element={<Dashboard />} />
          <Route path="/alarms" element={<IncomingAlarms />} />
          <Route path="/alarms/:id" element={<AlarmDetails />} />
          <Route path="/correlated-alarms" element={<CorrelatedAlarms />} />
          <Route path="/tickets" element={<Tickets />} />

          <Route
            path="/tickets/:id"
            element={<TicketsDetail />}
          />
          <Route path="/incidents" element={<IncidentsList />} />
          <Route path="/incidents/:id" element={<IncidentDetails />} />
          <Route path="/devices" element={<Devices />} />
          <Route path="/inventory" element={<Devices />} />
          <Route path="/devices/:id" element={<DeviceDetails />} />
          <Route path="/live-stream" element={<LiveStream />} />
          <Route path="/audit" element={<AuditLogs />} />
          <Route path="/admin" element={<Administration />} />

          <Route path="/diagnostics" element={<Dashboard />} />


          {/* Catch-all redirect */}
          <Route path="*" element={<Dashboard />} />
        </Route>

      </Routes>

    </BrowserRouter>
  );
}

export default App;
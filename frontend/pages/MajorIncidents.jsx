import React, { useEffect, useState } from "react";
import API from "../api/api";

function MajorIncident() {

  const [incidents, setIncidents] = useState([]);

  useEffect(() => {
    fetchIncidents();
  }, []);

  const fetchIncidents = async () => {
    try {
      const res = await API.get("/incidents/");
      setIncidents(res.data);
    } catch (err) {
      console.error("Error loading incidents", err);
    }
  };

  return (
    <div className="p-6">

      {/* Page Title */}
      <h1 className="text-3xl font-bold text-red-500 mb-6">
        🚨 Major Incident War Room
      </h1>

      {/* Analytics */}
      <div className="grid grid-cols-3 gap-6 mb-8">

        <div className="bg-white shadow rounded-xl p-6">
          <p className="text-gray-500 text-sm">Active Major Incidents</p>
          <h2 className="text-3xl font-bold text-gray-800">
            {incidents.length}
          </h2>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <p className="text-gray-500 text-sm">Critical Tickets</p>
          <h2 className="text-3xl font-bold text-red-500">
            {incidents.length}
          </h2>
        </div>

        <div className="bg-white shadow rounded-xl p-6">
          <p className="text-gray-500 text-sm">System Status</p>
          <h2 className="text-2xl font-bold text-green-500">
            Operational
          </h2>
        </div>

      </div>

      {/* Incident List */}
      <div className="bg-white shadow-lg rounded-xl p-6">

        <h2 className="text-lg font-semibold mb-4">
          Live Critical Incidents
        </h2>

        <div className="space-y-4">

          {incidents.map((incident) => (

            <div
              key={incident.ticket_id}
              className="border-l-4 border-red-500 bg-gray-50 hover:bg-gray-100 transition p-4 rounded-lg cursor-pointer"
            >

              {/* Top Row */}
              <div className="flex justify-between items-center">

                <div>
                  <p className="font-semibold text-gray-800">
                    {incident.ticket_id}
                  </p>

                  <p className="text-sm text-gray-500">
                    {incident.device} | {incident.host}
                  </p>
                </div>

                <div className="text-right">

                  <p className="text-sm text-orange-500 font-semibold">
                    SLA Remaining: 0 min
                  </p>

                  <span className="text-red-500 font-bold text-sm">
                    OPEN
                  </span>

                </div>

              </div>

            </div>

          ))}

        </div>

      </div>

    </div>
  );
}

export default MajorIncident;

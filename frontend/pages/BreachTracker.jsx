import React, { useEffect, useState } from "react";
import { getBreaches } from "../api/api";

const BreachTracker = () => {
  const [breaches, setBreaches] = useState([]);

  useEffect(() => {
    fetchBreaches();
  }, []);

  const fetchBreaches = async () => {
    try {
      const response = await getBreaches();
      setBreaches(response.data);
    } catch (error) {
      console.error("Error fetching breaches:", error);
    }
  };

  return (
    <div>
      <h2>Breach Tracker</h2>
      <table border="1">
        <thead>
          <tr>
            <th>ID</th>
            <th>Title</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Affected System</th>
            <th>Created</th>
          </tr>
        </thead>
        <tbody>
          {breaches.map((breach) => (
            <tr key={breach.id}>
              <td>{breach.id}</td>
              <td>{breach.title}</td>
              <td>{breach.severity}</td>
              <td>{breach.status}</td>
              <td>{breach.affected_system}</td>
              <td>{breach.created_at}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default BreachTracker;
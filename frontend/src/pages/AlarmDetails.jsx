import { useParams, useNavigate } from "react-router-dom";

export default function AlarmDetails() {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="p-6 bg-gray-100 min-h-screen flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow w-1/2 text-center">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">🚨 Alarm Details</h1>
        <p className="text-gray-600 mb-6 font-mono text-lg">Alarm ID: {id}</p>
        <p className="mb-6">
          Detailed alarm views are currently integrated with the ticketing page. Check your tickets list or verify if the alarm has a corresponding ticket.
        </p>
        <div className="flex gap-4 justify-center">
          <button
            onClick={() => navigate("/alarms")}
            className="px-6 py-2 bg-blue-500 text-white rounded shadow hover:bg-blue-600"
          >
            Back to Alarms
          </button>
          <button
            onClick={() => navigate("/tickets")}
            className="px-6 py-2 bg-gray-800 text-white rounded shadow hover:bg-gray-900"
          >
            Go to Tickets
          </button>
        </div>
      </div>
    </div>
  );
}

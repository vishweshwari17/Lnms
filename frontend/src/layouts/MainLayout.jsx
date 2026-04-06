import Header from "../assets/Header";
import Sidebar from "../assets/Sidebar";
import Chatbot from "../components/Chatbot";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen bg-gray-100">

      {/* Top Header */}
      <Header />

      <div className="flex flex-1 overflow-hidden">

        {/* Sidebar */}
        <Sidebar />

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto relative">

          <div className="max-w-7xl mx-auto px-8 py-8">
            <Outlet />
          </div>

          <Chatbot />
        </main>

      </div>
    </div>
  );
}
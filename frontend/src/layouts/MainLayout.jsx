import PremiumHeader from "../assets/PremiumHeader";
import Sidebar from "../assets/Sidebar";
import Chatbot from "../components/Chatbot";
import TacticalTerminal from "../components/TacticalTerminal";
import { Outlet } from "react-router-dom";

export default function MainLayout() {
  return (
    <div className="flex h-screen overflow-hidden command-container">
      <TacticalTerminal />
      <Sidebar />

      <div className="main-content">
        <PremiumHeader />
        
        <main className="flex-1 overflow-y-auto p-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
          <Chatbot />
        </main>
      </div>
    </div>
  );
}
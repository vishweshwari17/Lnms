import PremiumHeader from "../assets/PremiumHeader";
import Sidebar from "../assets/Sidebar";
import Chatbot from "../components/Chatbot";
import TacticalTerminal from "../components/TacticalTerminal";
import { Outlet } from "react-router-dom";
import { useState } from "react";

export default function MainLayout() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  return (
    <div className="flex h-screen overflow-hidden command-container">
      <TacticalTerminal />
      
      <div className={`fixed inset-0 z-[60] bg-slate-900/50 backdrop-blur-sm lg:hidden transition-opacity ${mobileMenuOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`} onClick={() => setMobileMenuOpen(false)} />
      
      <Sidebar mobileMenuOpen={mobileMenuOpen} setMobileMenuOpen={setMobileMenuOpen} />

      <div className="main-content flex-1 flex flex-col min-w-0">
        <PremiumHeader onMenuClick={() => setMobileMenuOpen(true)} />
        
        <main className="flex-1 overflow-y-auto p-4 lg:p-6 max-w-[1600px] mx-auto w-full">
          <Outlet />
          <Chatbot />
        </main>
      </div>
    </div>
  );
}
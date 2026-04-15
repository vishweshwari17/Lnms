import React, { useState, useEffect, useRef } from "react";
import { Terminal, X, Zap, Shield, Cpu } from "lucide-react";

const TacticalTerminal = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [history, setHistory] = useState([
    { type: 'system', text: 'LNMS TAC-SHELL v4.0.0-PRO' },
    { type: 'system', text: 'AUTHENTICATED AS L3_OPERATIVE' },
    { type: 'info', text: 'CORE NETWORKS: ONLINE' }
  ]);
  const [input, setInput] = useState("");
  const scrollRef = useRef(null);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.key === "˜") { // Ctrl + ~ (tilde)
        e.preventDefault();
        setIsOpen(prev => !prev);
      }
      if (e.key === "Escape") setIsOpen(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history]);

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const cmd = input.trim().toLowerCase();
    setHistory(prev => [...prev, { type: 'input', text: `> ${input}` }]);
    
    // Simulate some diagnostic commands
    setTimeout(() => {
      if (cmd === 'ping') {
        setHistory(prev => [...prev, { type: 'success', text: 'PACKET_RECEIVE: 64 bytes from 10.0.0.1 (0.12ms)' }]);
      } else if (cmd === 'status') {
         setHistory(prev => [...prev, { type: 'info', text: 'SYSTEM: ALL_NODES_ACTIVE | SECURITY: ARMED' }]);
      } else if (cmd === 'help') {
         setHistory(prev => [...prev, { type: 'system', text: 'CMDS: ping, status, clear, exit' }]);
      } else if (cmd === 'clear') {
         setHistory([{ type: 'system', text: 'TAC-SHELL LOG CLEARED' }]);
      } else {
         setHistory(prev => [...prev, { type: 'error', text: `UNKNOWN COMMAND: ${cmd}` }]);
      }
    }, 100);

    setInput("");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed top-0 left-0 w-full h-80 bg-[#020617]/95 backdrop-blur-2xl border-b border-blue-500/20 z-[100] animate-in slide-in-from-top duration-300 flex flex-col shadow-[0_20px_50px_rgba(0,0,0,0.8)]">
      <div className="flex items-center justify-between px-6 py-3 border-b border-white/5 bg-white/5">
        <div className="flex items-center gap-3">
          <Terminal size={14} className="text-blue-400" />
          <span className="text-[10px] font-black uppercase tracking-[0.3em] text-white">Tactical Command Shell</span>
          <div className="flex items-center gap-1.5 ml-4">
             <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
             <span className="text-[8px] font-bold text-emerald-500/60 uppercase">Armed</span>
          </div>
        </div>
        <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/5 rounded-lg text-white/30 hover:text-white transition-all">
          <X size={16} />
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 font-mono text-[11px] space-y-2 selection:bg-blue-500/30">
        {history.map((line, i) => (
          <div key={i} className={`flex gap-3 ${
            line.type === 'error' ? 'text-rose-400' : 
            line.type === 'success' ? 'text-emerald-400' : 
            line.type === 'input' ? 'text-blue-300' : 
            'text-blue-400/60'
          }`}>
            <span className="opacity-30">{i.toString().padStart(3, '0')}</span>
            <span className={line.type === 'input' ? 'font-black' : ''}>{line.text}</span>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="p-4 border-t border-white/5 bg-white/5 flex items-center gap-4">
        <span className="text-blue-500 font-black animate-pulse">{`>>`}</span>
        <input 
          autoFocus
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter Tactical Command..."
          className="bg-transparent flex-1 border-none outline-none text-white font-mono text-xs placeholder:text-white/10"
        />
        <div className="flex items-center gap-6 text-[10px] font-black text-white/20 uppercase tracking-widest px-4">
           <div className="flex items-center gap-2"> <Cpu size={12} /> 0.2% CPU </div>
           <div className="flex items-center gap-2"> <Shield size={12} /> SEC_L3 </div>
        </div>
      </form>
    </div>
  );
};

export default TacticalTerminal;

import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Bot, Zap, Shield, Lock, Activity, Thermometer } from "lucide-react";
import axios from "axios";
import "./Chatbot.css";

const hostname = typeof window !== 'undefined' ? window.location.hostname : 'localhost';
const API_BASE = `http://${hostname}:8000/api`;

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", content: "Hello! I'm your LNMS Secure AI Assistant. I monitor your network infrastructure in real-time. How can I assist you?" }
  ]);
  const [input, setInput] = useState("");
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  useEffect(() => {
    const handleAskAI = (event) => {
      const { question } = event.detail;
      setIsOpen(true);
      handleSendMessage(question);
    };
    window.addEventListener("ask-ai", handleAskAI);
    return () => window.removeEventListener("ask-ai", handleAskAI);
  }, []);

  const handleSendMessage = async (text) => {
    const messageText = text || input;
    if (!messageText.trim()) return;

    const newMessages = [...messages, { role: "user", content: messageText }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const response = await axios.post(`${API_BASE}/chatbot/ask?question=${encodeURIComponent(messageText)}`);
      setMessages([...newMessages, { role: "bot", content: response.data.answer }]);
    } catch (error) {
      setMessages([...newMessages, { role: "bot", content: "⚠️ Secure connection interrupted. Attempting to reconnect..." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const recommendations = [
    { text: "High CPU detected – consider load balancing", icon: <Activity size={12} /> },
    { text: "Packet loss detected – check interface errors", icon: <Thermometer size={12} /> },
    { text: "Check SLA risks for Core Router A1", icon: <Zap size={12} /> }
  ];

  return (
    <div className="chatbot-container">
      <button 
        className={`chatbot-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {isOpen ? <X size={24} /> : <MessageSquare size={24} />}
        {!isOpen && unreadNotificationDot()}
      </button>

      {isOpen && (
        <div className="chatbot-window">
          <div className="chatbot-header">
            <div>
              <h3>
                <div className="p-1.5 bg-blue-50 text-blue-500 rounded-lg">
                  <Bot size={18} />
                </div>
                Secure AI Assistant
              </h3>
              <div className="flex items-center gap-1.5 mt-1">
                 <Lock size={10} className="text-emerald-500" />
                 <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Encrypted Session</span>
              </div>
            </div>
            <button onClick={() => setIsOpen(false)} className="text-slate-400 hover:text-slate-600">
               <X size={18} />
            </button>
          </div>

          <div className="chatbot-messages custom-scrollbar">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {isTyping && (
              <div className="bot-typing">
                <div className="flex gap-1">
                   <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0s' }} />
                   <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.2s' }} />
                   <div className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0.4s' }} />
                </div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Processing request</span>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          <div className="chatbot-input-area">
            {messages.length < 3 && (
              <div className="mb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Zap size={10} className="text-amber-500" /> System Recommendations
                </p>
                <div className="flex flex-col gap-2">
                  {recommendations.map((rec, i) => (
                    <button 
                      key={i} 
                      className="suggestion-btn flex items-center gap-2 text-left"
                      onClick={() => handleSendMessage(rec.text)}
                    >
                      {rec.icon}
                      {rec.text}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="chatbot-input-wrapper">
              <input 
                type="text" 
                className="chatbot-input"
                placeholder="Type a message..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button className="chatbot-send" onClick={() => handleSendMessage()}>
                <Send size={16} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function unreadNotificationDot() {
  return (
    <span className="absolute -top-1 -right-1 flex h-4 w-4">
      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
      <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
    </span>
  );
}


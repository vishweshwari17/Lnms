import { useState, useEffect, useRef } from "react";
import { MessageSquare, Send, X, Bot, Zap, Plus, AlertCircle } from "lucide-react";
import axios from "axios";
import "./Chatbot.css";

const API_BASE = "http://localhost:8000/api";

export default function Chatbot() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: "bot", content: "Hello! I'm your LNMS AI Assistant. How can I help you today?" }
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

  // Listen for global events to open chatbot with context
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

    // Add user message
    const newMessages = [...messages, { role: "user", content: messageText }];
    setMessages(newMessages);
    setInput("");
    setIsTyping(true);

    try {
      const response = await axios.post(`${API_BASE}/chatbot/ask?question=${encodeURIComponent(messageText)}`);
      setMessages([...newMessages, { role: "bot", content: response.data.answer }]);
    } catch (error) {
      setMessages([...newMessages, { role: "bot", content: "⚠️ Sorry, I'm having trouble connecting to the brain. Please try again." }]);
    } finally {
      setIsTyping(false);
    }
  };

  const suggestions = [
    "Device Down",
    "High CPU Usage",
    "Network Issue",
    "Password Reset"
  ];

  return (
    <div className="chatbot-container">
      {/* Floating Toggle Button */}
      <button 
        className={`chatbot-toggle ${isOpen ? 'active' : ''}`}
        onClick={() => setIsOpen(!isOpen)}
      >
        {!isOpen && <div className="chatbot-pulse" />}
        {isOpen ? <X size={28} /> : <MessageSquare size={28} />}
        {!isOpen && <span className="absolute -top-1 -right-1 flex h-4 w-4">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
          <span className="relative inline-flex rounded-full h-4 w-4 bg-rose-500"></span>
        </span>}
      </button>

      {/* Chat Window */}
      {isOpen && (
        <div className="chatbot-window">
          {/* Header */}
          <div className="chatbot-header">
            <h3>
              <div className="p-1.5 bg-white/20 rounded-lg">
                <Bot size={20} />
              </div>
              LNMS AI Assistant
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse" />
              <span className="text-[10px] font-black uppercase tracking-widest opacity-80">Online</span>
            </div>
          </div>

          {/* Messages Area */}
          <div className="chatbot-messages">
            {messages.map((msg, i) => (
              <div key={i} className={`message ${msg.role}`}>
                {msg.content}
              </div>
            ))}
            {isTyping && (
              <div className="bot-typing flex items-center gap-2">
                <Bot size={14} className="animate-bounce" />
                Assistant is thinking...
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input Area */}
          <div className="p-4 border-t border-slate-100 bg-white">
            {messages.length < 3 && (
              <div className="suggestions pb-4">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-1.5">
                  <Zap size={10} className="text-amber-500" /> Quick Suggestions
                </p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((s, i) => (
                    <button 
                      key={i} 
                      className="suggestion-btn"
                      onClick={() => handleSendMessage(s)}
                    >
                      {s}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="flex gap-2">
              <input 
                type="text" 
                className="chatbot-input"
                placeholder="Ask about alarms, tickets..."
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && handleSendMessage()}
              />
              <button className="chatbot-send" onClick={() => handleSendMessage()}>
                <Send size={18} />
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

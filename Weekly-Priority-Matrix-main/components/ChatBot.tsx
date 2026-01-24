
import React, { useState, useRef, useEffect } from 'react';
import { askComplexQuery } from '../services/geminiService';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  planContext: string;
  userProfile?: { name: string, email: string };
}

export const ChatBot: React.FC<ChatBotProps> = ({ isOpen, onClose, planContext, userProfile }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, isTyping]);

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);
    try {
      const aiResponse = await askComplexQuery(userMsg, planContext, userProfile);
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (error) {
      setMessages(prev => [...prev, { role: 'ai', text: "Error connecting to Assistant." }]);
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed bottom-6 right-6 w-96 max-h-[600px] h-[80vh] bg-white shadow-2xl rounded-2xl z-50 flex flex-col border border-slate-200 overflow-hidden animate-in slide-in-from-bottom duration-300">
      <div className="p-4 bg-slate-900 text-white flex justify-between items-center">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></div>
          <span className="text-xs font-black uppercase tracking-widest">Strategy AI</span>
        </div>
        <button onClick={onClose} className="hover:bg-white/10 p-1 rounded-full"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M6 18L18 6M6 6l12 12" strokeWidth="2"/></svg></button>
      </div>
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50 custom-scrollbar">
        {messages.length === 0 && (
          <div className="text-center py-10">
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Deep Thinking Mode Active</p>
            <p className="text-xs text-slate-500 mt-2 px-6">Ask me to prioritize your tasks or suggest next steps for P1 features.</p>
          </div>
        )}
        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-xl text-xs ${m.role === 'user' ? 'bg-blue-600 text-white' : 'bg-white border border-slate-200 text-slate-700'}`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && <div className="text-[10px] text-slate-400 italic px-2">Assistant is thinking...</div>}
      </div>
      <div className="p-4 border-t border-slate-100">
        <div className="flex gap-2">
          <input 
            type="text" 
            value={input} 
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSend()}
            placeholder="Type your query..."
            className="flex-1 text-xs p-2 border border-slate-200 rounded-lg outline-none focus:ring-1 focus:ring-blue-500"
          />
          <button onClick={handleSend} className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800"><svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M5 10l7-7m0 0l7 7m-7-7v18" strokeWidth="2" strokeLinecap="round"/></svg></button>
        </div>
      </div>
    </div>
  );
};

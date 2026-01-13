import React, { useState, useRef, useEffect } from 'react';
import { askComplexQuery } from '../services/geminiService';

interface ChatBotProps {
  isOpen: boolean;
  onClose: () => void;
  planContext: string;
  userProfile?: { name: string, email: string };
}

declare global {
  /**
   * Defines the AIStudio interface for API key management as per platform standards.
   */
  interface AIStudio {
    hasSelectedApiKey: () => Promise<boolean>;
    openSelectKey: () => Promise<void>;
  }

  interface Window {
    /**
     * The aistudio property is injected by the environment.
     * Made optional here to ensure compatibility with potential pre-existing declarations in the environment.
     */
    aistudio?: AIStudio;
  }
}

export const ChatBot: React.FC<ChatBotProps> = ({ isOpen, onClose, planContext, userProfile }) => {
  const [messages, setMessages] = useState<{ role: 'user' | 'ai'; text: string }[]>([]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [hasKey, setHasKey] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      // Check for existence of aistudio and query for selected API key
      if (window.aistudio) {
        try {
          const selected = await window.aistudio.hasSelectedApiKey();
          setHasKey(selected);
        } catch (e) {
          console.error("Failed to check API key status", e);
          setHasKey(false);
        }
      } else {
        // Fallback to true if process.env.API_KEY is expected to be injected directly
        setHasKey(!!process.env.API_KEY); 
      }
    };
    if (isOpen) checkKey();
  }, [isOpen]);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, isTyping]);

  const handleSelectKey = async () => {
    if (window.aistudio) {
      try {
        await window.aistudio.openSelectKey();
        // As per instructions, assume success after triggering the dialog
        setHasKey(true);
      } catch (e) {
        console.error("Failed to open key selection", e);
      }
    }
  };

  const handleSend = async () => {
    if (!input.trim() || isTyping) return;

    const userMsg = input;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text: userMsg }]);
    setIsTyping(true);

    try {
      const aiResponse = await askComplexQuery(userMsg, planContext, userProfile);
      setMessages(prev => [...prev, { role: 'ai', text: aiResponse }]);
    } catch (error: any) {
      if (error.message === "API_KEY_EXPIRED") {
        setHasKey(false);
        setMessages(prev => [...prev, { role: 'ai', text: "Your session key has expired or is invalid. Please re-select your API key." }]);
      } else {
        setMessages(prev => [...prev, { role: 'ai', text: "The Strategist is having trouble thinking right now. Please check your connection and try again." }]);
      }
    } finally {
      setIsTyping(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-y-0 right-0 w-96 bg-white shadow-2xl z-50 flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300">
      <div className="p-4 border-b border-slate-100 flex justify-between items-center bg-slate-900 text-white">
        <div>
          <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
            <svg className="w-4 h-4 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M12 2L4.5 20.29l.71.71L12 18l6.79 3 .71-.71z"/></svg>
            AI Strategy Assistant
          </h3>
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Gemini 3 Pro Deep Thinking</p>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-800 rounded-full transition-colors">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12"/></svg>
        </button>
      </div>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50">
        {!hasKey && window.aistudio ? (
          <div className="text-center py-10 px-6">
            <div className="w-12 h-12 bg-amber-100 text-amber-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 7a2 2 0 012 2m0 9a2 2 0 01-2 2H5a2 2 0 01-2-2V9a2 2 0 012-2h2m2 4l2 2 2-2M9 15l2 2 2-2"/></svg>
            </div>
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">API Key Required</p>
            <p className="text-xs text-slate-400 leading-relaxed mb-6">
              To use Gemini 3 Pro features, you must select a valid API key from a paid GCP project.
              <a href="https://ai.google.dev/gemini-api/docs/billing" target="_blank" rel="noopener noreferrer" className="block text-blue-500 underline mt-1">Check Billing Docs</a>
            </p>
            <button 
              onClick={handleSelectKey}
              className="bg-blue-600 text-white px-6 py-2 rounded-full text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all shadow-lg shadow-blue-100"
            >
              Select API Key
            </button>
          </div>
        ) : messages.length === 0 ? (
          <div className="text-center py-10 px-6">
            <div className="w-12 h-12 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center mx-auto mb-4">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M13 10V3L4 14h7v7l9-11h-7z"/></svg>
            </div>
            {userProfile?.name && <p className="text-[10px] font-black text-blue-600 uppercase mb-2">Hi {userProfile.name},</p>}
            <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mb-2">Deep Thinking Active</p>
            <p className="text-xs text-slate-400 leading-relaxed">I have access to your current weekly matrix and DevOps context. Ask me to help prioritize, balance efforts, or suggest next steps.</p>
          </div>
        ) : null}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[85%] p-3 rounded-2xl text-[12px] leading-relaxed shadow-sm ${
              m.role === 'user' ? 'bg-blue-600 text-white rounded-tr-none' : 'bg-white text-slate-700 border border-slate-100 rounded-tl-none'
            }`}>
              {m.text}
            </div>
          </div>
        ))}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-white p-3 rounded-2xl rounded-tl-none border border-slate-100 flex gap-1">
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce"></span>
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-100"></span>
              <span className="w-1.5 h-1.5 bg-slate-300 rounded-full animate-bounce delay-200"></span>
            </div>
          </div>
        )}
      </div>

      <div className="p-4 border-t border-slate-100 bg-white">
        <div className="relative">
          <textarea
            disabled={(!hasKey && !!window.aistudio) || isTyping}
            rows={2}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            placeholder={hasKey || !window.aistudio ? "Ask a complex strategy question..." : "Select key to start..."}
            className="w-full p-3 pr-12 text-[12px] border border-slate-200 rounded-xl focus:ring-2 focus:ring-blue-100 focus:border-blue-400 outline-none resize-none transition-all placeholder:text-slate-300 disabled:bg-slate-50"
          />
          <button 
            onClick={handleSend}
            disabled={!input.trim() || isTyping || (!hasKey && !!window.aistudio)}
            className="absolute right-3 bottom-3 p-1.5 bg-slate-900 text-white rounded-lg hover:bg-slate-800 disabled:opacity-30 disabled:hover:bg-slate-900 transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 10l7-7m0 0l7 7m-7-7v18"/></svg>
          </button>
        </div>
        <p className="text-[9px] text-slate-400 mt-2 text-center font-medium">Shift+Enter for newline</p>
      </div>
    </div>
  );
};
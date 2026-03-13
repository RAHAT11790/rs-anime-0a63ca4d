import { useState, useEffect, useRef, useCallback } from "react";
import { MessageCircle, X, Send, Bot, User } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { db, ref, push, set, onValue } from "@/lib/firebase";
import { toast } from "sonner";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  timestamp: number;
}

interface LiveSupportChatProps {
  animeList?: { title: string; type: string; category?: string }[];
}

const LiveSupportChat = ({ animeList = [] }: LiveSupportChatProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Guest");
  const [unreadAdmin, setUnreadAdmin] = useState(0);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const lastSeenRef = useRef(0);

  // Load user info
  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("rsanime_user") || "{}");
      if (u.id) setUserId(u.id);
      if (u.name || u.username) setUserName(u.name || u.username);
    } catch {}
  }, []);

  // Listen for admin replies
  useEffect(() => {
    if (!userId) return;
    const chatRef = ref(db, `supportChats/${userId}/messages`);
    const unsub = onValue(chatRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      const adminMsgs = Object.entries(data)
        .map(([id, msg]: any) => ({ id, ...msg }))
        .filter((m: any) => m.role === "admin");
      
      // Count unread admin messages
      const newAdminMsgs = adminMsgs.filter((m: any) => m.timestamp > lastSeenRef.current);
      if (!isOpen && newAdminMsgs.length > 0) {
        setUnreadAdmin(newAdminMsgs.length);
      }

      // Merge admin messages into local state
      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = adminMsgs.filter((m: any) => !existingIds.has(m.id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs].sort((a, b) => a.timestamp - b.timestamp);
      });
    });
    return () => unsub();
  }, [userId, isOpen]);

  // Scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Mark as seen when opened
  useEffect(() => {
    if (isOpen) {
      lastSeenRef.current = Date.now();
      setUnreadAdmin(0);
    }
  }, [isOpen]);

  // Build anime context for AI
  const animeContext = useCallback(() => {
    if (animeList.length === 0) return "";
    const titles = animeList.slice(0, 50).map(a => `- ${a.title} (${a.type}${a.category ? `, ${a.category}` : ""})`);
    return titles.join("\n");
  }, [animeList]);

  const sendMessage = async () => {
    const text = input.trim();
    if (!text || loading) return;
    setInput("");

    const userMsg: ChatMessage = {
      id: `u_${Date.now()}`,
      role: "user",
      content: text,
      timestamp: Date.now(),
    };
    setMessages(prev => [...prev, userMsg]);

    // Check if @RS message → send to admin
    if (text.includes("@RS") || text.includes("@rs") || text.includes("@Rs")) {
      // Save to Firebase for admin
      const cleanMsg = text.replace(/@[Rr][Ss]/g, "").trim();
      try {
        const msgRef = push(ref(db, `supportChats/${userId}/messages`));
        await set(msgRef, {
          role: "user",
          content: cleanMsg || text,
          timestamp: Date.now(),
          userName,
          userId,
          isAdminRequest: true,
        });
        // Update chat meta
        await set(ref(db, `supportChats/${userId}/meta`), {
          userName,
          lastMessage: cleanMsg || text,
          lastTimestamp: Date.now(),
          unread: true,
        });

        const adminReply: ChatMessage = {
          id: `a_${Date.now()}`,
          role: "assistant",
          content: "✅ আপনার মেসেজ Admin-এর কাছে পাঠানো হয়েছে! Admin রিপ্লাই দিলে এখানেই দেখতে পাবেন। 😊",
          timestamp: Date.now(),
        };
        setMessages(prev => [...prev, adminReply]);
      } catch {
        toast.error("মেসেজ পাঠাতে ব্যর্থ");
      }
      return;
    }

    // Send to AI
    setLoading(true);
    try {
      const chatHistory = messages.slice(-10).map(m => ({
        role: m.role === "admin" ? "user" : m.role,
        content: m.role === "admin" ? `[Admin Reply]: ${m.content}` : m.content,
      }));
      chatHistory.push({ role: "user", content: text });

      const { data, error } = await supabase.functions.invoke("live-chat", {
        body: { messages: chatHistory, animeContext: animeContext() },
      });

      if (error) throw error;

      const aiMsg: ChatMessage = {
        id: `ai_${Date.now()}`,
        role: "assistant",
        content: data?.reply || "দুঃখিত, উত্তর দিতে পারছি না।",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, aiMsg]);
    } catch (e: any) {
      const errMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: "assistant",
        content: "⚠️ সার্ভারে সমস্যা হচ্ছে। একটু পরে আবার চেষ্টা করুন। সরাসরি Admin-এর কাছে পৌঁছাতে @RS লিখে মেসেজ করুন।",
        timestamp: Date.now(),
      };
      setMessages(prev => [...prev, errMsg]);
    }
    setLoading(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  return (
    <>
      {/* Floating Chat Button */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 right-4 z-[60] w-14 h-14 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 shadow-lg shadow-indigo-500/30 flex items-center justify-center text-white transition-transform hover:scale-110 active:scale-95"
      >
        {isOpen ? <X size={24} /> : <MessageCircle size={24} />}
        {unreadAdmin > 0 && !isOpen && (
          <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full text-[10px] font-bold flex items-center justify-center animate-pulse">
            {unreadAdmin}
          </span>
        )}
      </button>

      {/* Chat Panel */}
      {isOpen && (
        <div className="fixed bottom-36 right-4 left-4 sm:left-auto sm:w-[360px] z-[60] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-white/10 flex flex-col"
          style={{ maxHeight: "70vh", background: "linear-gradient(180deg, #13132B 0%, #0D0D1A 100%)" }}>
          
          {/* Header */}
          <div className="px-4 py-3 bg-gradient-to-r from-indigo-600/30 to-purple-600/30 border-b border-white/10 flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-indigo-500/30 flex items-center justify-center">
              <Bot size={18} className="text-indigo-300" />
            </div>
            <div className="flex-1">
              <h3 className="text-sm font-bold text-white">RS Support</h3>
              <p className="text-[10px] text-indigo-300/70">AI Assistant • Always Online</p>
            </div>
            <button onClick={() => setIsOpen(false)} className="p-1 hover:bg-white/10 rounded-lg transition-colors">
              <X size={16} className="text-white/60" />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-3 space-y-3" style={{ minHeight: 200, maxHeight: "50vh" }}>
            {messages.length === 0 && (
              <div className="text-center py-8">
                <Bot size={36} className="mx-auto text-indigo-400/40 mb-3" />
                <p className="text-sm text-white/50 font-medium">হ্যালো! 👋</p>
                <p className="text-xs text-white/30 mt-1">
                  আমি RS Bot, আপনাকে সাহায্য করতে এখানে আছি!
                </p>
                <p className="text-[10px] text-indigo-400/50 mt-2">
                  Admin-এর সাথে কথা বলতে @RS লিখুন
                </p>
              </div>
            )}
            {messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
                <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                  msg.role === "user"
                    ? "bg-indigo-600 text-white rounded-br-md"
                    : msg.role === "admin"
                    ? "bg-emerald-600/20 border border-emerald-500/30 text-emerald-100 rounded-bl-md"
                    : "bg-white/8 text-white/90 rounded-bl-md"
                }`}>
                  {msg.role === "admin" && (
                    <span className="text-[10px] font-bold text-emerald-400 block mb-1">🛡️ Admin (RS)</span>
                  )}
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                  <span className="text-[9px] opacity-40 mt-1 block text-right">
                    {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
                  </span>
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-white/8 rounded-2xl rounded-bl-md px-4 py-3">
                  <div className="flex gap-1">
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                    <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
                  </div>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-3 border-t border-white/10">
            <div className="flex items-center gap-2">
              <input
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="মেসেজ লিখুন..."
                className="flex-1 bg-white/8 border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder-white/30 outline-none focus:border-indigo-500/50 transition-colors"
                disabled={loading}
              />
              <button
                onClick={sendMessage}
                disabled={!input.trim() || loading}
                className="w-10 h-10 rounded-full bg-indigo-600 hover:bg-indigo-500 disabled:opacity-30 disabled:hover:bg-indigo-600 flex items-center justify-center transition-colors"
              >
                <Send size={16} className="text-white" />
              </button>
            </div>
            <p className="text-[9px] text-white/20 text-center mt-2">
              @RS লিখে Admin-কে সরাসরি মেসেজ করুন
            </p>
          </div>
        </div>
      )}
    </>
  );
};

export default LiveSupportChat;

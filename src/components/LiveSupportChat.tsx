import { useState, useEffect, useRef, useCallback } from "react";
import { X, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { db, ref, push, set, onValue } from "@/lib/firebase";
import { toast } from "sonner";
import logoImg from "@/assets/logo.png";

interface ChatMessage {
  id: string;
  role: "user" | "assistant" | "admin";
  content: string;
  timestamp: number;
}

interface AnimeInfo {
  title: string;
  type: string;
  category?: string;
  rating?: string;
  year?: string;
  storyline?: string;
  dubType?: string;
  episodeCount?: number;
  seasonCount?: number;
}

interface LiveSupportChatProps {
  animeList?: AnimeInfo[];
  isOpen: boolean;
  onClose: () => void;
  onAnimeSelect?: (title: string) => void;
}

const LiveSupportChat = ({ animeList = [], isOpen, onClose, onAnimeSelect }: LiveSupportChatProps) => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("Guest");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    try {
      const u = JSON.parse(localStorage.getItem("rsanime_user") || "{}");
      if (u.id) setUserId(u.id);
      if (u.name || u.username) setUserName(u.name || u.username);
    } catch {}
  }, []);

  useEffect(() => {
    if (!userId) return;
    const chatRef = ref(db, `supportChats/${userId}/messages`);
    const unsub = onValue(chatRef, (snap) => {
      const data = snap.val();
      if (!data) return;
      const adminMsgs = Object.entries(data)
        .map(([id, msg]: any) => ({ id, ...msg }))
        .filter((m: any) => m.role === "admin");

      setMessages(prev => {
        const existingIds = new Set(prev.map(m => m.id));
        const newMsgs = adminMsgs.filter((m: any) => !existingIds.has(m.id));
        if (newMsgs.length === 0) return prev;
        return [...prev, ...newMsgs].sort((a, b) => a.timestamp - b.timestamp);
      });
    });
    return () => unsub();
  }, [userId]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const animeContext = useCallback(() => {
    if (animeList.length === 0) return "";
    
    // Group by category
    const byCategory: Record<string, AnimeInfo[]> = {};
    animeList.forEach(a => {
      const cat = a.category || "Other";
      if (!byCategory[cat]) byCategory[cat] = [];
      byCategory[cat].push(a);
    });

    let context = `মোট Anime সংখ্যা: ${animeList.length}\n`;
    context += `মোট Series: ${animeList.filter(a => a.type === "webseries").length}\n`;
    context += `মোট Movies: ${animeList.filter(a => a.type === "movie").length}\n\n`;
    
    context += `ক্যাটাগরি অনুযায়ী:\n`;
    Object.entries(byCategory).forEach(([cat, items]) => {
      context += `\n📁 ${cat} (${items.length}টি):\n`;
      items.forEach(a => {
        let line = `  - ${a.title} (${a.type === "movie" ? "Movie" : "Series"}`;
        if (a.year) line += `, ${a.year}`;
        if (a.rating) line += `, Rating: ${a.rating}`;
        if (a.dubType) line += `, ${a.dubType === "fandub" ? "Fan Dub" : "Official Dub"}`;
        if (a.seasonCount) line += `, ${a.seasonCount} Seasons`;
        if (a.episodeCount) line += `, ${a.episodeCount} Episodes`;
        line += `)`;
        if (a.storyline) line += `\n    Storyline: ${a.storyline}`;
        context += line + "\n";
      });
    });

    return context;
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

    if (text.includes("@RS") || text.includes("@rs") || text.includes("@Rs")) {
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

  if (!isOpen) return null;

  return (
    <div className="fixed left-2 right-2 sm:left-auto sm:right-3 sm:w-[370px] z-[60] rounded-2xl overflow-hidden shadow-2xl shadow-black/50 border border-border/30 flex flex-col"
      style={{ 
        top: "70px",
        bottom: "65px",
        maxHeight: "calc(100vh - 135px)",
        background: "linear-gradient(180deg, hsl(var(--background)) 0%, hsl(var(--background) / 0.98) 100%)" 
      }}>
      
      {/* Header */}
      <div className="px-4 py-3 border-b border-border/30 flex items-center gap-3" style={{ background: "linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--accent) / 0.1))" }}>
        <div className="w-9 h-9 rounded-lg overflow-hidden border border-primary/40 bg-background/50 p-0.5">
          <img src={logoImg} alt="RS" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-bold text-foreground">RS Support</h3>
          <div className="flex items-center gap-1">
            <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
            <p className="text-[10px] text-green-400/80">AI Assistant • Online</p>
          </div>
        </div>
        <button onClick={onClose} className="p-1.5 hover:bg-muted rounded-lg transition-colors">
          <X size={16} className="text-muted-foreground" />
        </button>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="w-12 h-12 rounded-lg overflow-hidden mx-auto mb-3 border border-primary/30 bg-background/50 p-1">
              <img src={logoImg} alt="RS" className="w-full h-full object-contain" />
            </div>
            <p className="text-sm text-foreground/80 font-medium">হ্যালো! 👋</p>
            <p className="text-xs text-muted-foreground mt-1">
              আমি RS Bot, আপনাকে সাহায্য করতে এখানে আছি!
            </p>
            <p className="text-[10px] text-primary/60 mt-2">
              Admin-এর সাথে কথা বলতে @RS লিখুন
            </p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground rounded-br-md"
                : msg.role === "admin"
                ? "bg-green-600/20 border border-green-500/30 text-green-100 rounded-bl-md"
                : "bg-muted text-foreground rounded-bl-md"
            }`}>
              {msg.role === "admin" && (
                <span className="text-[10px] font-bold text-green-400 block mb-1">🛡️ Admin (RS)</span>
              )}
              {renderMessageContent(msg.content, msg.role)}
              <span className="text-[9px] opacity-40 mt-1 block text-right">
                {new Date(msg.timestamp).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}
              </span>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-bl-md px-4 py-3">
              <div className="flex gap-1">
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "0ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "150ms" }} />
                <span className="w-2 h-2 bg-primary rounded-full animate-bounce" style={{ animationDelay: "300ms" }} />
              </div>
            </div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-3 border-t border-border/30">
        <div className="flex items-center gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="মেসেজ লিখুন..."
            className="flex-1 min-w-0 bg-muted border border-border rounded-full px-4 py-2.5 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:border-primary/50 transition-colors"
            disabled={loading}
          />
          <button
            onClick={sendMessage}
            disabled={!input.trim() || loading}
            className="flex-shrink-0 w-10 h-10 rounded-full bg-primary hover:bg-primary/80 disabled:opacity-30 flex items-center justify-center transition-colors"
          >
            <Send size={16} className="text-primary-foreground" />
          </button>
        </div>
        <p className="text-[9px] text-muted-foreground/50 text-center mt-2">
          @RS লিখে Admin-কে সরাসরি মেসেজ করুন
        </p>
      </div>
    </div>
  );
};

export default LiveSupportChat;

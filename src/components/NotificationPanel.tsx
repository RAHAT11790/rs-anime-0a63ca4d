import { useState, useEffect } from "react";
import { Bell, X, Sparkles } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, ref, onValue } from "@/lib/firebase";

interface Notification {
  id: string;
  title: string;
  message: string;
  poster?: string;
  timestamp: number;
}

const NotificationPanel = () => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const [seen, setSeen] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem("rs_seen_notifs") || "[]");
    } catch { return []; }
  });

  useEffect(() => {
    const notifsRef = ref(db, "notifications");
    const unsub = onValue(notifsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) return;
      const items: Notification[] = [];
      Object.entries(data).forEach(([id, item]: [string, any]) => {
        items.push({
          id,
          title: item.title || "",
          message: item.message || "",
          poster: item.poster || undefined,
          timestamp: item.timestamp || Date.now(),
        });
      });
      items.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(items);
    });
    return () => unsub();
  }, []);

  const unseenCount = notifications.filter((n) => !seen.includes(n.id)).length;

  const handleOpen = () => {
    setOpen(true);
    const allIds = notifications.map((n) => n.id);
    setSeen(allIds);
    localStorage.setItem("rs_seen_notifs", JSON.stringify(allIds));
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    return `${days}d ago`;
  };

  return (
    <>
      <button onClick={handleOpen} className="relative w-9 h-9 rounded-full bg-secondary flex items-center justify-center transition-all hover:scale-110">
        <Bell className="w-4 h-4 text-foreground" />
        {unseenCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] rounded-full bg-primary text-[10px] font-bold text-primary-foreground flex items-center justify-center px-1 animate-pulse">
            {unseenCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-background/95 backdrop-blur-md"
          >
            <div className="flex items-center justify-between px-4 py-4 border-b border-border/30">
              <h2 className="text-lg font-bold flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-primary" />
                Notifications
              </h2>
              <button onClick={() => setOpen(false)} className="w-8 h-8 rounded-full bg-secondary flex items-center justify-center">
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="overflow-y-auto h-[calc(100vh-65px)] pb-20 px-4">
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-60 text-muted-foreground">
                  <Bell className="w-10 h-10 mb-3 opacity-40" />
                  <p className="text-sm">No notifications yet</p>
                </div>
              ) : (
                notifications.map((n, i) => (
                  <motion.div
                    key={n.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className="flex gap-3 py-3 border-b border-border/20"
                  >
                    {n.poster && (
                      <img src={n.poster} alt="" className="w-12 h-16 rounded-lg object-cover flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-foreground leading-tight">{n.title}</p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.message}</p>
                      <p className="text-[10px] text-primary mt-1">{timeAgo(n.timestamp)}</p>
                    </div>
                  </motion.div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

export default NotificationPanel;

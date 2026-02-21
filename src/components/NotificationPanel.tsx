import { useState, useEffect, useRef } from "react";
import { Bell, X, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, ref, onValue, set, update } from "@/lib/firebase";

interface Notification {
  id: string;
  title: string;
  message: string;
  type?: string;
  contentId?: string;
  read: boolean;
  timestamp: number;
}

interface NotificationPanelProps {
  userId?: string;
  onOpenContent?: (contentId: string) => void;
}

const NotificationPanel = ({ userId, onOpenContent }: NotificationPanelProps) => {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!userId) return;
    const notifsRef = ref(db, `notifications/${userId}`);
    const unsub = onValue(notifsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setNotifications([]); return; }
      const items: Notification[] = [];
      Object.entries(data).forEach(([id, item]: [string, any]) => {
        items.push({
          id,
          title: item.title || "",
          message: item.message || "",
          type: item.type || "",
          contentId: item.contentId || "",
          read: item.read || false,
          timestamp: item.timestamp || Date.now(),
        });
      });
      items.sort((a, b) => b.timestamp - a.timestamp);
      setNotifications(items);
    });
    return () => unsub();
  }, [userId]);

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    if (open) document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  const markAllAsRead = () => {
    if (!userId || notifications.length === 0) return;
    const updates: Record<string, boolean> = {};
    notifications.forEach((n) => {
      if (!n.read) updates[`notifications/${userId}/${n.id}/read`] = true;
    });
    if (Object.keys(updates).length > 0) {
      update(ref(db), updates);
    }
  };

  const openNotification = (notif: Notification) => {
    if (!notif.read && userId) {
      set(ref(db, `notifications/${userId}/${notif.id}/read`), true);
    }
    setOpen(false);
    if (notif.contentId && onOpenContent) {
      onOpenContent(notif.contentId);
    }
  };

  const timeAgo = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "Just now";
    if (mins < 60) return `${mins}m ago`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `${hours}h ago`;
    const days = Math.floor(hours / 24);
    if (days < 7) return `${days}d ago`;
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell Button */}
      <button
        onClick={() => setOpen(!open)}
        className="relative w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center transition-all hover:bg-primary hover:scale-110"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center px-1">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Dropdown */}
      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="absolute top-[45px] right-0 w-[300px] bg-card border border-primary/30 rounded-xl shadow-[0_10px_40px_rgba(0,0,0,0.7)] z-[1000] overflow-hidden backdrop-blur-xl"
          >
            {/* Header */}
            <div className="flex justify-between items-center px-4 py-3 border-b border-border/30">
              <h4 className="text-sm font-semibold">Notifications</h4>
              <button
                onClick={markAllAsRead}
                className="text-[11px] text-primary hover:underline bg-transparent border-none cursor-pointer flex items-center gap-1"
              >
                <Check className="w-3 h-3" /> Mark all as read
              </button>
            </div>

            {/* List */}
            <div className="max-h-[300px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="py-8 text-center text-muted-foreground text-xs">
                  <Bell className="w-8 h-8 mx-auto mb-2 opacity-40" />
                  No notifications yet
                </div>
              ) : (
                notifications.map((notif) => (
                  <div
                    key={notif.id}
                    onClick={() => openNotification(notif)}
                    className={`px-4 py-3 border-b border-border/10 cursor-pointer transition-all hover:bg-primary/10 ${
                      !notif.read ? "bg-primary/15" : ""
                    }`}
                  >
                    <p className="text-xs font-semibold text-foreground mb-0.5 leading-tight">{notif.title}</p>
                    <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">{notif.message}</p>
                    <p className="text-[10px] text-primary/70 mt-1">{timeAgo(notif.timestamp)}</p>
                  </div>
                ))
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default NotificationPanel;

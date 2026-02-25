import { useState, useEffect, useRef } from "react";
import { Bell, X, Check, ArrowLeft } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, ref, onValue, set, update } from "@/lib/firebase";

// Request notification permission and register SW
const requestNotificationPermission = async () => {
  if (!("Notification" in window)) return;
  if (Notification.permission === "default") {
    await Notification.requestPermission();
  }
  // Register service worker
  if ("serviceWorker" in navigator) {
    try { await navigator.serviceWorker.register("/sw.js"); } catch {}
  }
};

// Show browser notification
const showBrowserNotification = (title: string, body: string, contentId?: string, image?: string) => {
  // Respect user's push notification preference
  try {
    const pushPref = localStorage.getItem("rs_notif_push");
    if (pushPref === "false") return;
  } catch {}
  if (!("Notification" in window) || Notification.permission !== "granted") return;
  try {
    const options: any = {
      body,
      icon: image || "/favicon.ico",
      badge: "/favicon.ico",
      image: image || undefined,
      tag: `rsanime-${Date.now()}`,
      data: { url: contentId ? `/?anime=${contentId}` : "/" },
      vibrate: [200, 100, 200],
      requireInteraction: false,
    };
    if (navigator.serviceWorker?.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, options);
      });
    } else {
      new Notification(title, options);
    }
  } catch {}
};

interface NotifItem {
  id: string;
  title: string;
  message: string;
  type?: string;
  contentId?: string;
  image?: string;
  read: boolean;
  timestamp: number;
}

interface NotificationPanelProps {
  userId?: string;
  onOpenContent?: (contentId: string) => void;
}

// Helper to track which notifications already triggered a browser push
const SHOWN_PUSH_KEY = "rs_shown_push_ids";
const getShownPushIds = (): Set<string> => {
  try {
    const raw = localStorage.getItem(SHOWN_PUSH_KEY);
    return raw ? new Set(JSON.parse(raw)) : new Set();
  } catch { return new Set(); }
};
const addShownPushId = (id: string) => {
  try {
    const ids = getShownPushIds();
    ids.add(id);
    // Keep only last 200 IDs to prevent unbounded growth
    const arr = [...ids].slice(-200);
    localStorage.setItem(SHOWN_PUSH_KEY, JSON.stringify(arr));
  } catch {}
};

const NotificationPanel = ({ userId, onOpenContent }: NotificationPanelProps) => {
  const [notifications, setNotifications] = useState<NotifItem[]>([]);
  const [showFullPage, setShowFullPage] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const initialLoadDone = useRef(false);

  // Request notification permission on mount
  useEffect(() => {
    requestNotificationPermission();
  }, []);

  useEffect(() => {
    if (!userId) {
      setNotifications([]);
      initialLoadDone.current = false;
      return;
    }
    const notifsRef = ref(db, `notifications/${userId}`);
    const unsub = onValue(notifsRef, (snapshot) => {
      const data = snapshot.val();
      if (!data) { setNotifications([]); initialLoadDone.current = true; return; }
      const items: NotifItem[] = [];
      Object.entries(data).forEach(([id, item]: [string, any]) => {
        items.push({
          id,
          title: item.title || "",
          message: item.message || "",
          type: item.type || "",
          contentId: item.contentId || "",
          image: item.image || item.poster || "",
          read: item.read || false,
          timestamp: item.timestamp || Date.now(),
        });
      });
      items.sort((a, b) => b.timestamp - a.timestamp);
      
      // Only show browser push for NEW notifications after initial load
      const shownIds = getShownPushIds();
      if (initialLoadDone.current) {
        items.forEach(item => {
          if (!item.read && !shownIds.has(item.id) && Date.now() - item.timestamp < 120000) {
            showBrowserNotification(item.title, item.message, item.contentId, item.image);
          }
          if (!shownIds.has(item.id)) addShownPushId(item.id);
        });
      } else {
        // First load: mark all as shown without pushing
        items.forEach(item => {
          if (!shownIds.has(item.id)) addShownPushId(item.id);
        });
        initialLoadDone.current = true;
      }
      
      setNotifications(items);
    });
    return () => { unsub(); initialLoadDone.current = false; };
  }, [userId]);

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

  const openNotification = (notif: NotifItem) => {
    if (!notif.read && userId) {
      set(ref(db, `notifications/${userId}/${notif.id}/read`), true);
    }
    setShowFullPage(false);
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

  // Full page notification view
  if (showFullPage) {
    return (
      <>
        <button
          onClick={() => setShowFullPage(true)}
          className="relative w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center transition-all hover:bg-primary hover:scale-110"
        >
          <Bell className="w-4 h-4 text-foreground" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center px-1">
              {unreadCount > 9 ? "9+" : unreadCount}
            </span>
          )}
        </button>
        <motion.div
          className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
          initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
          transition={{ type: "tween", duration: 0.3 }}
        >
          <div className="flex items-center justify-between mb-5">
            <button onClick={() => setShowFullPage(false)} className="flex items-center gap-2 text-sm text-secondary-foreground hover:text-foreground transition-colors">
              <ArrowLeft className="w-5 h-5" />
              <span className="font-medium">Notifications</span>
            </button>
            <button
              onClick={markAllAsRead}
              className="text-[11px] text-primary hover:underline flex items-center gap-1"
            >
              <Check className="w-3 h-3" /> Mark all read
            </button>
          </div>

          <div className="space-y-2">
            {notifications.length === 0 ? (
              <div className="py-16 text-center text-muted-foreground">
                <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" />
                <p className="text-sm">No notifications yet</p>
              </div>
            ) : (
              notifications.map((notif) => (
                <div
                  key={notif.id}
                  onClick={() => openNotification(notif)}
                  className={`glass-card px-4 py-3 rounded-xl cursor-pointer transition-all hover:border-primary ${
                    !notif.read ? "border-primary/30 bg-primary/5" : ""
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {notif.image ? (
                      <img src={notif.image} alt="" className="w-10 h-10 rounded-lg object-cover flex-shrink-0 mt-0.5" />
                    ) : (
                      !notif.read && <span className="mt-1.5 w-2 h-2 rounded-full bg-primary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        {!notif.read && notif.image && <span className="w-2 h-2 rounded-full bg-primary flex-shrink-0" />}
                        <p className="text-sm font-semibold leading-tight">{notif.title}</p>
                      </div>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{notif.message}</p>
                      <p className="text-[10px] text-primary/70 mt-1">{timeAgo(notif.timestamp)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </motion.div>
      </>
    );
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setShowFullPage(true)}
        className="relative w-9 h-9 rounded-full bg-foreground/10 flex items-center justify-center transition-all hover:bg-primary hover:scale-110"
      >
        <Bell className="w-4 h-4 text-foreground" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-accent text-[10px] font-bold text-white flex items-center justify-center px-1 animate-pulse">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>
    </div>
  );
};

export default NotificationPanel;

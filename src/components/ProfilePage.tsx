import { useState, useRef, useEffect } from "react";
import { User, LogOut, History, Bookmark, Settings, ChevronRight, ArrowLeft, Camera, X, Save, Globe, Monitor, Bell, Info } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, ref, onValue, set, remove } from "@/lib/firebase";
import type { AnimeItem } from "@/data/animeData";

interface ProfilePageProps {
  onClose: () => void;
  allAnime?: AnimeItem[];
  onCardClick?: (anime: AnimeItem) => void;
}

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

const ProfilePage = ({ onClose, allAnime = [], onCardClick }: ProfilePageProps) => {
  const [activePanel, setActivePanel] = useState<"main" | "settings" | "edit" | "language" | "quality" | "notification-settings">("main");
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => {
    try { return localStorage.getItem("rs_profile_photo"); } catch { return null; }
  });
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem("rs_display_name") || "Guest User"; } catch { return "Guest User"; }
  });
  const [tempName, setTempName] = useState(displayName);
  const fileRef = useRef<HTMLInputElement>(null);

  // Settings state
  const [selectedLanguage, setSelectedLanguage] = useState(() => {
    try { return localStorage.getItem("rs_language") || "English"; } catch { return "English"; }
  });
  const [selectedQuality, setSelectedQuality] = useState(() => {
    try { return localStorage.getItem("rs_quality") || "Auto"; } catch { return "Auto"; }
  });

  // Watchlist & History from Firebase
  const [watchlist, setWatchlist] = useState<any[]>([]);
  const [watchHistory, setWatchHistory] = useState<any[]>([]);

  const getUserId = (): string | null => {
    try {
      const user = localStorage.getItem("rsanime_user");
      if (user) return JSON.parse(user).id;
    } catch {}
    return null;
  };

  const userId = getUserId();

  useEffect(() => {
    if (!userId) return;
    const wlRef = ref(db, `users/${userId}/watchlist`);
    const unsub1 = onValue(wlRef, (snapshot) => {
      const data = snapshot.val() || {};
      setWatchlist(Object.values(data));
    });
    const whRef = ref(db, `users/${userId}/watchHistory`);
    const unsub2 = onValue(whRef, (snapshot) => {
      const data = snapshot.val() || {};
      const items = Object.values(data) as any[];
      items.sort((a: any, b: any) => (b.watchedAt || 0) - (a.watchedAt || 0));
      setWatchHistory(items);
    });
    return () => { unsub1(); unsub2(); };
  }, [userId]);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) { alert("Image must be under 2MB!"); return; }
    if (!file.type.startsWith("image/")) { alert("Please select an image file."); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      setProfilePhoto(result);
      localStorage.setItem("rs_profile_photo", result);
    };
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setProfilePhoto(null);
    localStorage.removeItem("rs_profile_photo");
  };

  const saveName = () => {
    setDisplayName(tempName);
    localStorage.setItem("rs_display_name", tempName);
    setActivePanel("main");
  };

  const saveLanguage = (lang: string) => {
    setSelectedLanguage(lang);
    localStorage.setItem("rs_language", lang);
  };

  const saveQuality = (q: string) => {
    setSelectedQuality(q);
    localStorage.setItem("rs_quality", q);
  };

  const initial = displayName.charAt(0).toUpperCase();

  const languages = ["English", "বাংলা", "हिन्दी", "日本語", "한국어", "العربية"];
  const qualities = ["Auto", "1080p", "720p", "480p", "360p"];

  const handleAnimeClick = (item: any) => {
    if (!onCardClick) return;
    const anime = allAnime.find(a => a.id === item.id);
    if (anime) {
      onClose();
      setTimeout(() => onCardClick(anime), 100);
    }
  };

  const removeFromWatchlist = (itemId: string) => {
    if (!userId) return;
    remove(ref(db, `users/${userId}/watchlist/${itemId}`));
  };

  // Settings Panel
  if (activePanel === "settings") {
    return (
      <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}>
        <button onClick={() => setActivePanel("main")} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </button>
        <div className="space-y-3">
          <div onClick={() => setActivePanel("notification-settings")} className="glass-card px-4 py-4 rounded-xl cursor-pointer transition-all hover:border-primary flex items-center gap-3">
            <Bell className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Notifications</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Manage notification preferences</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div onClick={() => setActivePanel("quality")} className="glass-card px-4 py-4 rounded-xl cursor-pointer transition-all hover:border-primary flex items-center gap-3">
            <Monitor className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Video Quality</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Current: {selectedQuality}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div onClick={() => setActivePanel("language")} className="glass-card px-4 py-4 rounded-xl cursor-pointer transition-all hover:border-primary flex items-center gap-3">
            <Globe className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">Language</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Current: {selectedLanguage}</p>
            </div>
            <ChevronRight className="w-4 h-4 text-muted-foreground" />
          </div>
          <div className="glass-card px-4 py-4 rounded-xl flex items-center gap-3">
            <Info className="w-5 h-5 text-primary" />
            <div className="flex-1">
              <p className="text-sm font-medium">About RS ANIME</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Version 2.0</p>
            </div>
          </div>
        </div>
      </motion.div>
    );
  }

  // Language Panel
  if (activePanel === "language") {
    return (
      <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}>
        <button onClick={() => setActivePanel("settings")} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Language</span>
        </button>
        <div className="space-y-2">
          {languages.map((lang) => (
            <div key={lang} onClick={() => saveLanguage(lang)}
              className={`glass-card px-4 py-4 rounded-xl cursor-pointer transition-all flex items-center justify-between ${selectedLanguage === lang ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}>
              <span className="text-sm font-medium">{lang}</span>
              {selectedLanguage === lang && <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-primary-foreground" /></span>}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Quality Panel
  if (activePanel === "quality") {
    return (
      <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}>
        <button onClick={() => setActivePanel("settings")} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Video Quality</span>
        </button>
        <p className="text-xs text-muted-foreground mb-4">Select default streaming quality. Higher quality uses more data.</p>
        <div className="space-y-2">
          {qualities.map((q) => (
            <div key={q} onClick={() => saveQuality(q)}
              className={`glass-card px-4 py-4 rounded-xl cursor-pointer transition-all flex items-center justify-between ${selectedQuality === q ? "border-primary bg-primary/10" : "hover:border-primary/50"}`}>
              <div>
                <span className="text-sm font-medium">{q}</span>
                {q === "Auto" && <p className="text-[10px] text-muted-foreground">Adjusts based on your connection</p>}
              </div>
              {selectedQuality === q && <span className="w-5 h-5 rounded-full bg-primary flex items-center justify-center"><Check className="w-3 h-3 text-primary-foreground" /></span>}
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Notification Settings
  if (activePanel === "notification-settings") {
    return (
      <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}>
        <button onClick={() => setActivePanel("settings")} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Notifications</span>
        </button>
        <div className="space-y-3">
          <NotificationToggle label="New Episode Alerts" desc="Get notified for new episodes" defaultOn={true} storageKey="rs_notif_episodes" />
          <NotificationToggle label="Recommendations" desc="Personalized anime suggestions" defaultOn={true} storageKey="rs_notif_recs" />
          <NotificationToggle label="App Updates" desc="New features and improvements" defaultOn={false} storageKey="rs_notif_updates" />
        </div>
      </motion.div>
    );
  }

  // Edit Profile Panel
  if (activePanel === "edit") {
    return (
      <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}>
        <button onClick={() => setActivePanel("main")} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Edit Profile</span>
        </button>
        <div className="text-center mb-8">
          <div className="relative inline-block">
            {profilePhoto ? (
              <div className="relative">
                <img src={profilePhoto} alt="Profile" className="w-[100px] h-[100px] rounded-full object-cover border-4 border-primary/30 shadow-[0_10px_40px_hsla(355,85%,55%,0.3)]" />
                <button onClick={removePhoto} className="absolute -top-1 -right-1 w-6 h-6 rounded-full bg-destructive flex items-center justify-center">
                  <X className="w-3 h-3 text-white" />
                </button>
              </div>
            ) : (
              <div className="w-[100px] h-[100px] rounded-full gradient-primary flex items-center justify-center text-[42px] font-extrabold shadow-[0_10px_40px_hsla(355,85%,55%,0.4)] border-4 border-foreground/10">
                {initial}
              </div>
            )}
            <button onClick={() => fileRef.current?.click()} className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg">
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Max 2MB • JPG, PNG, WebP</p>
        </div>
        <div className="mb-6">
          <label className="text-xs text-muted-foreground mb-2 block">Display Name</label>
          <input type="text" value={tempName} onChange={(e) => setTempName(e.target.value)} maxLength={30}
            className="w-full py-3 px-4 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.3)] transition-all" />
        </div>
        <button onClick={saveName} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </motion.div>
    );
  }

  // Main Profile
  return (
    <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
      initial={{ y: "100%" }} animate={{ y: 0 }} exit={{ y: "100%" }}
      transition={{ type: "tween", duration: 0.4 }}>
      <button onClick={onClose} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Back</span>
      </button>

      {/* Avatar */}
      <div className="text-center mb-7">
        {profilePhoto ? (
          <img src={profilePhoto} alt="Profile" className="w-[100px] h-[100px] rounded-full object-cover mx-auto mb-4 border-4 border-foreground/10 shadow-[0_10px_40px_hsla(355,85%,55%,0.4)]" />
        ) : (
          <div className="w-[100px] h-[100px] rounded-full gradient-primary mx-auto mb-4 flex items-center justify-center text-[42px] font-extrabold shadow-[0_10px_40px_hsla(355,85%,55%,0.4)] border-4 border-foreground/10">
            {initial}
          </div>
        )}
        <h2 className="text-2xl font-bold mb-1">{displayName}</h2>
        <p className="text-sm text-secondary-foreground">
          {(() => { try { const u = JSON.parse(localStorage.getItem("rsanime_user") || "{}"); return u.email || "guest@rsanime.com"; } catch { return "guest@rsanime.com"; } })()}
        </p>
      </div>

      {/* Watch History */}
      <div className="mb-7">
        <h3 className="text-base font-bold mb-3 flex items-center category-bar">Watch History</h3>
        {watchHistory.length === 0 ? (
          <div className="text-center py-8">
            <History className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2.5" />
            <p className="text-sm text-secondary-foreground">No watch history yet</p>
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {watchHistory.slice(0, 20).map((item: any) => (
              <div key={item.id} onClick={() => handleAnimeClick(item)}
                className="flex-shrink-0 w-[100px] cursor-pointer">
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-card mb-1">
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 50%)" }} />
                  <div className="absolute bottom-1 left-1 right-1">
                    <p className="text-[9px] font-semibold leading-tight line-clamp-2">{item.title}</p>
                    {item.episodeInfo && (
                      <p className="text-[8px] text-primary mt-0.5">
                        S{item.episodeInfo.season} E{item.episodeInfo.episodeNumber || item.episodeInfo.episode}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Watchlist */}
      <div className="mb-7">
        <h3 className="text-base font-bold mb-3 flex items-center category-bar">My Watchlist</h3>
        {watchlist.length === 0 ? (
          <div className="text-center py-8">
            <Bookmark className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2.5" />
            <p className="text-sm text-secondary-foreground">No items in watchlist</p>
          </div>
        ) : (
          <div className="flex gap-2.5 overflow-x-auto pb-2 scrollbar-hide">
            {watchlist.map((item: any) => (
              <div key={item.id} onClick={() => handleAnimeClick(item)}
                className="flex-shrink-0 w-[100px] cursor-pointer relative">
                <div className="relative aspect-[2/3] rounded-lg overflow-hidden bg-card mb-1">
                  <img src={item.poster} alt={item.title} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.9) 0%, transparent 50%)" }} />
                  <button onClick={(e) => { e.stopPropagation(); removeFromWatchlist(item.id); }}
                    className="absolute top-1 right-1 w-5 h-5 rounded-full bg-destructive/80 flex items-center justify-center">
                    <X className="w-3 h-3 text-white" />
                  </button>
                  <div className="absolute bottom-1 left-1 right-1">
                    <p className="text-[9px] font-semibold leading-tight line-clamp-2">{item.title}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Menu Items */}
      <div className="flex flex-col gap-2">
        <div onClick={() => setActivePanel("settings")}
          className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:border-primary hover:translate-x-1 rounded-xl">
          <Settings className="w-5 h-5 text-primary" />
          <span className="flex-1 text-[13px] font-medium">Settings</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
        <div onClick={() => { setTempName(displayName); setActivePanel("edit"); }}
          className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:border-primary hover:translate-x-1 rounded-xl">
          <User className="w-5 h-5 text-primary" />
          <span className="flex-1 text-[13px] font-medium">Edit Profile</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
        <div className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:bg-accent/20 border-accent/30 bg-accent/15 rounded-xl">
          <LogOut className="w-5 h-5" />
          <span className="flex-1 text-[13px] font-medium">Logout</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
};

// Check icon import for language/quality selection
import { Check } from "lucide-react";

// Notification toggle sub-component
const NotificationToggle = ({ label, desc, defaultOn, storageKey }: { label: string; desc: string; defaultOn: boolean; storageKey: string }) => {
  const [enabled, setEnabled] = useState(() => {
    try { const v = localStorage.getItem(storageKey); return v !== null ? v === "true" : defaultOn; } catch { return defaultOn; }
  });
  const toggle = () => {
    const next = !enabled;
    setEnabled(next);
    localStorage.setItem(storageKey, String(next));
  };
  return (
    <div onClick={toggle} className="glass-card px-4 py-4 rounded-xl cursor-pointer transition-all hover:border-primary flex items-center justify-between">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-[11px] text-muted-foreground mt-0.5">{desc}</p>
      </div>
      <div className={`w-11 h-6 rounded-full transition-all relative ${enabled ? "bg-primary" : "bg-foreground/20"}`}>
        <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-all ${enabled ? "left-[22px]" : "left-0.5"}`} />
      </div>
    </div>
  );
};

export default ProfilePage;

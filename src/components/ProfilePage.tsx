import { useState, useRef, useEffect } from "react";
import { User, LogOut, History, Bookmark, Settings, ChevronRight, ArrowLeft, Camera, X, Save, Globe, Monitor, Bell, Info, Crown, Gift, Check, Lock, Eye, EyeOff, KeyRound, Clock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { db, ref, onValue, set, remove, get, update, query, orderByChild, equalTo } from "@/lib/firebase";
import type { AnimeItem } from "@/data/animeData";
import { toast } from "sonner";

interface ProfilePageProps {
  onClose: () => void;
  allAnime?: AnimeItem[];
  onCardClick?: (anime: AnimeItem) => void;
  onLogout?: () => void;
}

const MAX_PHOTO_SIZE = 2 * 1024 * 1024;

const AccessTimer = () => {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);
  const [hasAccess, setHasAccess] = useState(false);
  const [paused, setPaused] = useState(false);

  // Check maintenance status and pause/extend timer
  useEffect(() => {
    const unsub = onValue(ref(db, "maintenance"), (snap) => {
      const maint = snap.val();
      if (maint?.active) {
        setPaused(true);
      } else {
        setPaused(false);
        // If there was a pause, extend free access timer
        if (maint?.lastPauseDuration && maint?.lastResumedAt) {
          const appliedKey = `rsanime_pause_applied_${maint.lastResumedAt}`;
          if (!localStorage.getItem(appliedKey)) {
            const expiry = localStorage.getItem("rsanime_ad_access");
            if (expiry) {
              const newExpiry = parseInt(expiry) + maint.lastPauseDuration;
              localStorage.setItem("rsanime_ad_access", newExpiry.toString());
            }
            localStorage.setItem(appliedKey, "true");
          }
        }
      }
    });
    return () => unsub();
  }, []);

  useEffect(() => {
    const tick = () => {
      const expiry = localStorage.getItem("rsanime_ad_access");
      if (!expiry) { setHasAccess(false); setTimeLeft(null); return; }
      const diff = parseInt(expiry) - Date.now();
      if (diff <= 0) { setHasAccess(false); setTimeLeft(null); return; }
      setHasAccess(true);
      const h = Math.floor(diff / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      setTimeLeft(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };
    tick();
    const interval = setInterval(tick, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="mb-5">
      <div className={`glass-card p-4 rounded-xl flex items-center gap-3 ${hasAccess ? "border-primary/30 bg-primary/5" : "border-accent/30 bg-accent/5"}`}>
        <div className={`w-10 h-10 rounded-full flex items-center justify-center ${hasAccess ? "gradient-primary" : "bg-muted"}`}>
          <Clock className={`w-5 h-5 ${hasAccess ? "text-primary-foreground" : "text-muted-foreground"}`} />
        </div>
        <div className="flex-1">
          <p className="text-xs text-muted-foreground">
            {paused ? "⏸ Timer Paused (Maintenance)" : hasAccess ? "Free Access Remaining" : "No Active Access"}
          </p>
          {paused && hasAccess ? (
            <p className="text-lg font-bold font-mono text-yellow-400 tracking-wider">{timeLeft} ⏸</p>
          ) : hasAccess && timeLeft ? (
            <p className="text-lg font-bold font-mono text-primary tracking-wider">{timeLeft}</p>
          ) : (
            <p className="text-sm font-medium text-muted-foreground">Watch a video to unlock 24h access</p>
          )}
        </div>
      </div>
    </div>
  );
};

const ProfilePage = ({ onClose, allAnime = [], onCardClick, onLogout }: ProfilePageProps) => {
  const [activePanel, setActivePanel] = useState<"main" | "settings" | "edit" | "language" | "quality" | "notification-settings" | "premium" | "change-password">("main");
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
  const [isPremium, setIsPremium] = useState(false);
  const [premiumExpiry, setPremiumExpiry] = useState<number | null>(null);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeemLoading, setRedeemLoading] = useState(false);

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
    const premRef = ref(db, `users/${userId}/premium`);
    const unsub3 = onValue(premRef, (snap) => {
      const data = snap.val();
      if (data && data.expiresAt > Date.now()) {
        setIsPremium(true);
        setPremiumExpiry(data.expiresAt);
      } else {
        setIsPremium(false);
        setPremiumExpiry(null);
      }
    });
    return () => { unsub1(); unsub2(); unsub3(); };
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

  const languages = ["English", "Bangla", "Hindi", "Japanese", "Korean", "Arabic"];
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

  const redeemCode = async () => {
    if (!userId || !redeemInput.trim()) { toast.error("Please enter a redeem code"); return; }
    setRedeemLoading(true);
    try {
      const codesSnap = await get(ref(db, "redeemCodes"));
      const codes = codesSnap.val() || {};
      let found = false;
      for (const [codeId, codeData] of Object.entries(codes) as any[]) {
        if (codeData.code === redeemInput.trim().toUpperCase() && !codeData.used) {
          found = true;
          const days = codeData.days || 30;
          const expiresAt = Date.now() + days * 24 * 60 * 60 * 1000;
          await set(ref(db, `users/${userId}/premium`), {
            active: true, expiresAt, redeemedAt: Date.now(), code: codeData.code
          });
          await update(ref(db, `redeemCodes/${codeId}`), {
            used: true, usedBy: userId, usedAt: Date.now()
          });
          toast.success(`Premium activated for ${days} days!`);
          setRedeemInput("");
          setActivePanel("main");
          break;
        }
      }
      if (!found) toast.error("Invalid or already used code");
    } catch (err: any) { toast.error("Error: " + err.message); }
    finally { setRedeemLoading(false); }
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

  // Premium Panel
  if (activePanel === "premium") {
    return (
      <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}>
        <button onClick={() => setActivePanel("main")} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Get Premium</span>
        </button>

        {isPremium ? (
          <div className="glass-card p-6 rounded-2xl text-center mb-5 border-primary/30 bg-primary/5">
            <Crown className="w-12 h-12 text-primary mx-auto mb-3" />
            <h3 className="text-lg font-bold text-primary mb-1">Premium Active ✨</h3>
            <p className="text-sm text-secondary-foreground">
              Expires: {premiumExpiry ? new Date(premiumExpiry).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" }) : "N/A"}
            </p>
            <p className="text-xs text-muted-foreground mt-2">Ad-free experience enabled</p>
          </div>
        ) : (
          <>
            <div className="glass-card p-6 rounded-2xl text-center mb-5">
              <Crown className="w-14 h-14 text-primary mx-auto mb-3" />
              <h3 className="text-xl font-bold mb-2">RS ANIME Premium</h3>
              <p className="text-3xl font-extrabold text-primary mb-1">৳100</p>
              <p className="text-xs text-muted-foreground">30 Days Ad-Free Experience</p>
              <div className="mt-4 space-y-2 text-left">
                {["No ads while watching", "Uninterrupted streaming", "Support the creators"].map((f, i) => (
                  <div key={i} className="flex items-center gap-2 text-sm">
                    <span className="w-5 h-5 rounded-full bg-primary/20 flex items-center justify-center"><Check className="w-3 h-3 text-primary" /></span>
                    {f}
                  </div>
                ))}
              </div>
            </div>

            <div className="glass-card p-4 rounded-2xl mb-4">
              <h4 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Gift className="w-4 h-4 text-primary" /> Enter Redeem Code
              </h4>
              <input
                value={redeemInput}
                onChange={e => setRedeemInput(e.target.value.toUpperCase())}
                placeholder="RS-XXXXXX-XXXX"
                className="w-full py-3 px-4 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground text-sm font-mono tracking-widest focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.3)] transition-all mb-3 text-center"
              />
              <button onClick={redeemCode} disabled={redeemLoading}
                className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 btn-glow disabled:opacity-50">
                {redeemLoading ? "Verifying..." : "Activate Premium"}
              </button>
            </div>

            <a href="https://t.me/rs_woner" target="_blank" rel="noopener noreferrer"
              className="block w-full py-3 rounded-xl bg-[#0088cc] text-white font-semibold text-center text-sm transition-all hover:opacity-90">
              📩 Get Redeem Code - Contact Owner
            </a>
          </>
        )}
      </motion.div>
    );
  }

  // Change Password Panel
  if (activePanel === "change-password") {
    return <ChangePasswordPanel onBack={() => setActivePanel("edit")} />;
  }

  // Edit Profile Panel
  if (activePanel === "edit") {
    const isGoogleUser = (() => {
      try {
        const u = JSON.parse(localStorage.getItem("rsanime_user") || "{}");
        // Check if user logged in via Google (no password in appUsers)
        return !!u.email && !localStorage.getItem("rs_has_password");
      } catch { return false; }
    })();

    // Check if user has password (email login user)
    const hasPassword = (() => {
      try {
        const u = JSON.parse(localStorage.getItem("rsanime_user") || "{}");
        return !!u.email;
      } catch { return false; }
    })();

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
        <button onClick={saveName} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 mb-4">
          <Save className="w-4 h-4" /> Save Changes
        </button>

        {/* Change Password Button - only for email users */}
        {hasPassword && (
          <button onClick={() => setActivePanel("change-password")}
            className="w-full py-3 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground font-medium flex items-center justify-center gap-2 transition-all hover:border-primary text-sm">
            <Lock className="w-4 h-4 text-primary" /> Change Password
          </button>
        )}
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

      {/* Access Timer */}
      {!isPremium && <AccessTimer />}

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
        <div onClick={() => setActivePanel("premium")}
          className={`glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:translate-x-1 rounded-xl ${isPremium ? "border-primary/40 bg-primary/5" : "border-primary/20 bg-gradient-to-r from-primary/10 to-transparent hover:border-primary"}`}>
          <Crown className={`w-5 h-5 ${isPremium ? "text-primary" : "text-primary"}`} />
          <div className="flex-1">
            <span className="text-[13px] font-medium">{isPremium ? "Premium Active ✨" : "Get Premium"}</span>
            {isPremium && premiumExpiry && (
              <p className="text-[10px] text-muted-foreground">Expires: {new Date(premiumExpiry).toLocaleDateString()}</p>
            )}
            {!isPremium && <p className="text-[10px] text-muted-foreground">Ad-free for ৳100/month</p>}
          </div>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
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
        <div onClick={() => { if (onLogout) onLogout(); onClose(); }}
          className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:bg-accent/20 border-accent/30 bg-accent/15 rounded-xl">
          <LogOut className="w-5 h-5" />
          <span className="flex-1 text-[13px] font-medium">Logout</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
};

// Change Password sub-component
const ChangePasswordPanel = ({ onBack }: { onBack: () => void }) => {
  const [oldPassword, setOldPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showOld, setShowOld] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleChangePassword = async () => {
    if (!oldPassword.trim() || !newPassword.trim()) { toast.error("Please fill in all fields"); return; }
    if (newPassword.length < 4) { toast.error("New password must be at least 4 characters"); return; }
    if (oldPassword === newPassword) { toast.error("New password cannot be the same as old password"); return; }

    setLoading(true);
    try {
      const user = JSON.parse(localStorage.getItem("rsanime_user") || "{}");
      if (!user.email) { toast.error("User not found"); setLoading(false); return; }

      const emailKey = user.email.toLowerCase().replace(/\./g, ",").replace(/[^a-z0-9@,_-]/g, "_");
      const legacyKey = user.email.toLowerCase().replace(/[^a-z0-9]/g, "_");

      // Check appUsers for password
      let foundKey = "";
      let userData: any = null;
      for (const key of [emailKey, legacyKey]) {
        const snap = await get(ref(db, `appUsers/${key}`));
        if (snap.exists()) {
          const data = snap.val();
          if (data.password) { foundKey = key; userData = data; break; }
        }
      }

      if (!userData || !userData.password) {
        toast.error("Password not found. This feature is not available for Google login users.");
        setLoading(false); return;
      }

      if (userData.password !== oldPassword) {
        toast.error("Old password is incorrect!");
        setLoading(false); return;
      }

      // Update password
      await update(ref(db, `appUsers/${foundKey}`), { password: newPassword });
      toast.success("Password changed successfully! ✅");
      setOldPassword(""); setNewPassword("");
      onBack();
    } catch (err: any) { toast.error("Error: " + err.message); }
    setLoading(false);
  };

  return (
    <motion.div className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
      initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.3 }}>
      <button onClick={onBack} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
        <ArrowLeft className="w-5 h-5" />
        <span className="font-medium">Change Password</span>
      </button>

      <div className="glass-card p-5 rounded-2xl mb-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <KeyRound className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h3 className="text-sm font-bold">Change Password</h3>
            <p className="text-[10px] text-muted-foreground">Enter your old password to set a new one</p>
          </div>
        </div>

        <div className="space-y-4">
          <div>
            <label className="text-xs text-muted-foreground mb-2 block">Old Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type={showOld ? "text" : "password"} value={oldPassword} onChange={e => setOldPassword(e.target.value)}
                placeholder="Enter old password"
                className="w-full py-3 pl-10 pr-10 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.3)] transition-all placeholder:text-muted-foreground" />
              <button type="button" onClick={() => setShowOld(!showOld)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showOld ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-xs text-muted-foreground mb-2 block">New Password</label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <input type={showNew ? "text" : "password"} value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                className="w-full py-3 pl-10 pr-10 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.3)] transition-all placeholder:text-muted-foreground" />
              <button type="button" onClick={() => setShowNew(!showNew)} className="absolute right-3 top-1/2 -translate-y-1/2">
                {showNew ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
              </button>
            </div>
          </div>
        </div>
      </div>

      <button onClick={handleChangePassword} disabled={loading}
        className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90 disabled:opacity-50 mb-3">
        {loading ? <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" /> : <><Save className="w-4 h-4" /> Change Password</>}
      </button>

      <a href="https://t.me/rs_woner" target="_blank" rel="noopener noreferrer"
        className="w-full py-3 rounded-xl bg-[#0088cc] text-white font-medium flex items-center justify-center gap-2 text-sm transition-all hover:opacity-90">
        📩 Forgot Password? Contact Owner
      </a>
    </motion.div>
  );
};

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

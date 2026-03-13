import { useState, useEffect, useMemo } from "react";
import { Search, User } from "lucide-react";
import logoImg from "@/assets/logo.png";
import NotificationPanel from "./NotificationPanel";
import { db, ref, set, update } from "@/lib/firebase";

// Generate a persistent device ID for this user
const getOrCreateUserId = (): string => {
  try {
    const existing = localStorage.getItem("rsanime_user");
    if (existing) {
      const parsed = JSON.parse(existing);
      if (parsed.id) return parsed.id;
    }
  } catch {}
  
  const newId = "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
  const userData = { id: newId, createdAt: Date.now() };
  localStorage.setItem("rsanime_user", JSON.stringify(userData));
  
  set(ref(db, `users/${newId}`), {
    name: "Guest User",
    createdAt: Date.now(),
    online: true,
    lastSeen: Date.now(),
  }).catch(() => {});
  
  return newId;
};

interface HeaderProps {
  onSearchClick: () => void;
  onProfileClick: () => void;
  onOpenContent?: (contentId: string) => void;
  animeTitles?: string[];
}

const Header = ({ onSearchClick, onProfileClick, onOpenContent, animeTitles = [] }: HeaderProps) => {
  const [userId, setUserId] = useState<string | undefined>(undefined);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(null);
  const [placeholderIdx, setPlaceholderIdx] = useState(0);
  const [animating, setAnimating] = useState(false);

  // Pick random titles for placeholder rotation
  const displayTitles = useMemo(() => {
    if (animeTitles.length === 0) return ["Search..."];
    const shuffled = [...animeTitles].sort(() => Math.random() - 0.5);
    return shuffled.slice(0, Math.min(20, shuffled.length));
  }, [animeTitles]);

  // Rotate placeholder text
  useEffect(() => {
    if (displayTitles.length <= 1) return;
    const interval = setInterval(() => {
      setAnimating(true);
      setTimeout(() => {
        setPlaceholderIdx(prev => (prev + 1) % displayTitles.length);
        setAnimating(false);
      }, 300);
    }, 3000);
    return () => clearInterval(interval);
  }, [displayTitles.length]);

  useEffect(() => {
    const id = getOrCreateUserId();
    setUserId(id);

    // Load profile photo
    try {
      const photo = localStorage.getItem("rs_profile_photo");
      setProfilePhoto(photo);
    } catch {}

    // Listen for profile photo changes
    const checkPhoto = () => {
      try {
        const photo = localStorage.getItem("rs_profile_photo");
        setProfilePhoto(photo);
      } catch {}
    };
    const interval = setInterval(checkPhoto, 2000);

    // Update online status
    const updateOnline = () => {
      update(ref(db, `users/${id}`), { online: true, lastSeen: Date.now() }).catch(() => {});
    };
    updateOnline();
    const heartbeat = setInterval(updateOnline, 30000);
    
    const onUnload = () => {
      update(ref(db, `users/${id}`), { online: false, lastSeen: Date.now() }).catch(() => {});
    };
    window.addEventListener("beforeunload", onUnload);

    return () => {
      clearInterval(interval);
      clearInterval(heartbeat);
      window.removeEventListener("beforeunload", onUnload);
    };
  }, []);

  const currentPlaceholder = displayTitles[placeholderIdx] || "Search...";

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] z-50 flex items-center justify-between px-4 transition-all duration-300"
      style={{ background: "linear-gradient(to bottom, hsla(240,20%,6%,0.98) 0%, hsla(240,20%,6%,0.8) 50%, transparent 100%)" }}>
      <img src={logoImg} alt="RS ANIME" className="h-10 w-10 rounded-lg object-contain" />
      <div className="relative flex-1 mx-3 cursor-pointer" onClick={onSearchClick} style={{ maxWidth: 200, minWidth: 120 }}>
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground w-4 h-4 z-10" />
        <div className="w-full py-2.5 pl-9 pr-3 rounded-full bg-foreground/10 border border-foreground/10 text-sm h-[38px] flex items-center overflow-hidden">
          <span
            className={`text-muted-foreground text-sm block whitespace-nowrap overflow-hidden text-ellipsis transition-opacity duration-300 ${animating ? "opacity-0" : "opacity-100"}`}
            style={{ width: '100%' }}
          >
            {currentPlaceholder}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NotificationPanel userId={userId} onOpenContent={onOpenContent} />
        <button
          onClick={onProfileClick}
          className="w-9 h-9 rounded-full overflow-hidden flex items-center justify-center border-2 border-transparent transition-all hover:border-primary hover:scale-110"
        >
          {profilePhoto ? (
            <img src={profilePhoto} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full gradient-primary flex items-center justify-center">
              <User className="w-4 h-4 text-primary-foreground" />
            </div>
          )}
        </button>
      </div>
    </header>
  );
};

export default Header;

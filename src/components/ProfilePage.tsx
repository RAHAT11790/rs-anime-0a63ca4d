import { useState, useRef } from "react";
import { User, LogOut, History, Bookmark, Settings, ChevronRight, ArrowLeft, Camera, X, Save } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";

interface ProfilePageProps {
  onClose: () => void;
}

const MAX_PHOTO_SIZE = 2 * 1024 * 1024; // 2MB

const ProfilePage = ({ onClose }: ProfilePageProps) => {
  const [showSettings, setShowSettings] = useState(false);
  const [showEditProfile, setShowEditProfile] = useState(false);
  const [profilePhoto, setProfilePhoto] = useState<string | null>(() => {
    try { return localStorage.getItem("rs_profile_photo"); } catch { return null; }
  });
  const [displayName, setDisplayName] = useState(() => {
    try { return localStorage.getItem("rs_display_name") || "Guest User"; } catch { return "Guest User"; }
  });
  const [tempName, setTempName] = useState(displayName);
  const fileRef = useRef<HTMLInputElement>(null);

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > MAX_PHOTO_SIZE) {
      alert("Image must be under 2MB!");
      return;
    }
    if (!file.type.startsWith("image/")) {
      alert("Please select an image file.");
      return;
    }
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
    setShowEditProfile(false);
  };

  const initial = displayName.charAt(0).toUpperCase();

  // Settings Panel
  if (showSettings) {
    return (
      <motion.div
        className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}
      >
        <button onClick={() => setShowSettings(false)} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Settings</span>
        </button>

        <div className="space-y-3">
          {[
            { label: "Notifications", desc: "Manage notification preferences" },
            { label: "Video Quality", desc: "Default streaming quality" },
            { label: "Language", desc: "App language settings" },
            { label: "About RS ANIME", desc: "Version 2.0" },
          ].map((item) => (
            <div key={item.label} className="glass-card px-4 py-4 rounded-xl">
              <p className="text-sm font-medium">{item.label}</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">{item.desc}</p>
            </div>
          ))}
        </div>
      </motion.div>
    );
  }

  // Edit Profile Panel
  if (showEditProfile) {
    return (
      <motion.div
        className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
        initial={{ x: "100%" }} animate={{ x: 0 }} exit={{ x: "100%" }}
        transition={{ type: "tween", duration: 0.3 }}
      >
        <button onClick={() => setShowEditProfile(false)} className="flex items-center gap-2 mb-5 text-sm text-secondary-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="w-5 h-5" />
          <span className="font-medium">Edit Profile</span>
        </button>

        {/* Photo Upload */}
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
            <button
              onClick={() => fileRef.current?.click()}
              className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary flex items-center justify-center shadow-lg"
            >
              <Camera className="w-4 h-4 text-primary-foreground" />
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoUpload} />
          </div>
          <p className="text-[10px] text-muted-foreground mt-2">Max 2MB • JPG, PNG, WebP</p>
        </div>

        {/* Name */}
        <div className="mb-6">
          <label className="text-xs text-muted-foreground mb-2 block">Display Name</label>
          <input
            type="text"
            value={tempName}
            onChange={(e) => setTempName(e.target.value)}
            maxLength={30}
            className="w-full py-3 px-4 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.3)] transition-all"
          />
        </div>

        <button onClick={saveName} className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-semibold flex items-center justify-center gap-2 transition-all hover:opacity-90">
          <Save className="w-4 h-4" /> Save Changes
        </button>
      </motion.div>
    );
  }

  // Main Profile
  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "tween", duration: 0.4 }}
    >
      {/* Back Button */}
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
        <p className="text-sm text-secondary-foreground">guest@rsanime.com</p>
      </div>

      {/* Watch History */}
      <div className="mb-7">
        <h3 className="text-base font-bold mb-3 flex items-center category-bar">Watch History</h3>
        <div className="text-center py-8">
          <History className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2.5" />
          <p className="text-sm text-secondary-foreground">No watch history yet</p>
        </div>
      </div>

      {/* Watchlist */}
      <div className="mb-7">
        <h3 className="text-base font-bold mb-3 flex items-center category-bar">My Watchlist</h3>
        <div className="text-center py-8">
          <Bookmark className="w-10 h-10 text-muted-foreground/50 mx-auto mb-2.5" />
          <p className="text-sm text-secondary-foreground">No items in watchlist</p>
        </div>
      </div>

      {/* Menu Items */}
      <div className="flex flex-col gap-2">
        <div
          onClick={() => setShowSettings(true)}
          className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:border-primary hover:translate-x-1 rounded-xl"
        >
          <Settings className="w-5 h-5 text-primary" />
          <span className="flex-1 text-[13px] font-medium">Settings</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>

        <div
          onClick={() => { setTempName(displayName); setShowEditProfile(true); }}
          className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:border-primary hover:translate-x-1 rounded-xl"
        >
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

export default ProfilePage;

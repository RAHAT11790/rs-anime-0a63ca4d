import { User, LogOut, History, Bookmark, Settings, ChevronRight } from "lucide-react";
import { motion } from "framer-motion";

interface ProfilePageProps {
  onClose: () => void;
}

const ProfilePage = ({ onClose }: ProfilePageProps) => {
  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-background overflow-y-auto pt-[70px] px-4 pb-24"
      initial={{ y: "100%" }}
      animate={{ y: 0 }}
      exit={{ y: "100%" }}
      transition={{ type: "tween", duration: 0.4 }}
    >
      {/* Avatar */}
      <div className="text-center mb-7">
        <div className="w-[100px] h-[100px] rounded-full gradient-primary mx-auto mb-4 flex items-center justify-center text-[42px] font-extrabold shadow-[0_10px_40px_hsla(270,70%,55%,0.4)] border-4 border-foreground/10">
          G
        </div>
        <h2 className="text-2xl font-bold mb-1">Guest User</h2>
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
        {[
          { icon: Settings, label: "Settings" },
          { icon: User, label: "Edit Profile" },
        ].map(({ icon: Icon, label }) => (
          <div key={label} className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:border-primary hover:translate-x-1">
            <Icon className="w-5 h-5 text-primary" />
            <span className="flex-1 text-[13px] font-medium">{label}</span>
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          </div>
        ))}

        <div className="glass-card flex items-center gap-3.5 px-4 py-4 cursor-pointer transition-all hover:bg-accent border-accent/30 bg-accent/15">
          <LogOut className="w-5 h-5" />
          <span className="flex-1 text-[13px] font-medium">Logout</span>
          <ChevronRight className="w-3 h-3 text-muted-foreground" />
        </div>
      </div>
    </motion.div>
  );
};

export default ProfilePage;

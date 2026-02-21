import { Search, User } from "lucide-react";
import logoImg from "@/assets/logo.png";
import NotificationPanel from "./NotificationPanel";

interface HeaderProps {
  onSearchClick: () => void;
  onProfileClick: () => void;
  onOpenContent?: (contentId: string) => void;
}

const Header = ({ onSearchClick, onProfileClick, onOpenContent }: HeaderProps) => {
  // Get user ID from localStorage (matches original HTML pattern)
  const getUserId = (): string | undefined => {
    try {
      const user = localStorage.getItem("rsanime_user");
      if (user) return JSON.parse(user).id;
    } catch {}
    return undefined;
  };

  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] z-50 flex items-center justify-between px-4 transition-all duration-300"
      style={{ background: "linear-gradient(to bottom, hsla(240,20%,6%,0.98) 0%, hsla(240,20%,6%,0.8) 50%, transparent 100%)" }}>
      <img src={logoImg} alt="RS ANIME" className="h-10 w-10 rounded-lg object-contain" />
      <div className="relative flex-1 max-w-[200px] mx-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground w-4 h-4" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full py-2.5 pl-9 pr-3 rounded-full bg-foreground/10 border border-foreground/10 text-foreground text-sm transition-all focus:bg-foreground/15 focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.4)] placeholder:text-muted-foreground"
          readOnly
          onClick={onSearchClick}
        />
      </div>
      <div className="flex items-center gap-2">
        <NotificationPanel userId={getUserId()} onOpenContent={onOpenContent} />
        <button
          onClick={onProfileClick}
          className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center border-2 border-transparent transition-all hover:border-primary hover:scale-110"
        >
          <User className="w-4 h-4 text-primary-foreground" />
        </button>
      </div>
    </header>
  );
};

export default Header;

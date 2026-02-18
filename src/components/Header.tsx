import { Search, User } from "lucide-react";

interface HeaderProps {
  onSearchClick: () => void;
  onProfileClick: () => void;
}

const Header = ({ onSearchClick, onProfileClick }: HeaderProps) => {
  return (
    <header className="fixed top-0 left-0 right-0 h-[60px] z-50 flex items-center justify-between px-4 transition-all duration-300"
      style={{ background: "linear-gradient(to bottom, hsla(240,20%,6%,0.98) 0%, hsla(240,20%,6%,0.8) 50%, transparent 100%)" }}>
      <div className="text-4xl font-black text-primary text-glow tracking-[-3px]">RS</div>
      <div className="relative flex-1 max-w-[200px] mx-3">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-secondary-foreground w-4 h-4" />
        <input
          type="text"
          placeholder="Search..."
          className="w-full py-2.5 pl-9 pr-3 rounded-full bg-foreground/10 border border-foreground/10 text-foreground text-sm transition-all focus:bg-foreground/15 focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(270,70%,55%,0.4)] placeholder:text-muted-foreground"
          readOnly
          onClick={onSearchClick}
        />
      </div>
      <button
        onClick={onProfileClick}
        className="w-9 h-9 rounded-full gradient-primary flex items-center justify-center border-2 border-transparent transition-all hover:border-primary hover:scale-110"
      >
        <User className="w-4 h-4 text-primary-foreground" />
      </button>
    </header>
  );
};

export default Header;

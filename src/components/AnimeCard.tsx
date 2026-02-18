import { Star, Heart } from "lucide-react";
import type { AnimeItem } from "@/data/animeData";

interface AnimeCardProps {
  anime: AnimeItem;
  onClick: (anime: AnimeItem) => void;
}

const AnimeCard = ({ anime, onClick }: AnimeCardProps) => {
  return (
    <div
      className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer poster-hover bg-card min-w-[120px] max-w-[140px] flex-shrink-0"
      onClick={() => onClick(anime)}
    >
      <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover transition-transform duration-400 hover:scale-110" loading="lazy" />
      <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)" }} />
      <button
        className="absolute top-1.5 left-1.5 w-7 h-7 rounded-full bg-background/70 flex items-center justify-center transition-all hover:bg-primary hover:scale-110 z-10"
        onClick={(e) => { e.stopPropagation(); }}
      >
        <Heart className="w-3.5 h-3.5 text-foreground" />
      </button>
      <span className="absolute top-1.5 right-1.5 gradient-primary px-2 py-0.5 rounded text-[9px] font-bold shadow-[0_3px_12px_hsla(355,85%,55%,0.4)] text-primary-foreground">
        {anime.year}
      </span>
      <div className="absolute bottom-0 left-0 right-0 p-2">
        <p className="text-[11px] font-semibold leading-tight line-clamp-2" style={{ textShadow: "0 2px 8px rgba(0,0,0,0.9)" }}>
          {anime.title}
        </p>
        <p className="text-[8px] text-secondary-foreground flex items-center gap-1 mt-1">
          <Star className="w-2 h-2 text-yellow-400" /> {anime.rating}
        </p>
      </div>
    </div>
  );
};

export default AnimeCard;

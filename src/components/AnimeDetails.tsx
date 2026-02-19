import { X, Play, Heart, Star, BookOpen, List, ArrowLeft } from "lucide-react";
import type { AnimeItem } from "@/data/animeData";
import { motion } from "framer-motion";

interface AnimeDetailsProps {
  anime: AnimeItem;
  onClose: () => void;
  onPlay: (anime: AnimeItem, seasonIdx?: number, epIdx?: number) => void;
}

const AnimeDetails = ({ anime, onClose, onPlay }: AnimeDetailsProps) => {
  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-background overflow-y-auto"
      initial={{ x: "100%" }}
      animate={{ x: 0 }}
      exit={{ x: "100%" }}
      transition={{ type: "tween", duration: 0.4, ease: [0.4, 0, 0.2, 1] }}
    >
      {/* Header Image */}
      <div className="relative w-full h-[50vh] min-h-[350px] overflow-hidden">
        <img src={anime.backdrop} alt={anime.title} className="w-full h-full object-cover" />
        <div className="absolute inset-0" style={{
          background: "linear-gradient(to top, hsl(240 20% 6%) 0%, rgba(0,0,0,0.2) 40%, transparent 60%), linear-gradient(to bottom, rgba(0,0,0,0.5) 0%, transparent 25%)"
        }} />
        <div className="absolute bottom-6 left-0 right-0 px-5 text-center">
          <h1 className="text-2xl font-extrabold mb-2" style={{ textShadow: "0 4px 20px rgba(0,0,0,0.9)" }}>
            {anime.title}
          </h1>
          <div className="flex items-center justify-center gap-2 text-[11px] text-secondary-foreground flex-wrap">
            <span className="gradient-primary px-2.5 py-1 rounded text-primary-foreground font-semibold shadow-[0_2px_10px_hsla(355,85%,55%,0.4)] flex items-center gap-1">
              <Star className="w-3 h-3" /> {anime.rating}
            </span>
            <span>{anime.year}</span>
            <span>{anime.language}</span>
            <span className="bg-foreground/15 px-2.5 py-1 rounded text-[10px] backdrop-blur-[10px]">
              {anime.type === "webseries" ? "Series" : "Movie"}
            </span>
          </div>
        </div>
      </div>

      {/* Back button - top left */}
      <button
        onClick={onClose}
        className="fixed left-4 top-5 w-10 h-10 rounded-full bg-background/70 backdrop-blur-[20px] border-2 border-foreground/20 flex items-center justify-center z-[210] transition-all hover:bg-primary hover:border-primary hover:scale-110"
      >
        <ArrowLeft className="w-5 h-5" />
      </button>

      {/* Content */}
      <div className="relative px-4 pb-24 z-10">
        {/* Action Buttons */}
        <div className="flex gap-2.5 mb-5">
          <button
            onClick={() => {
              if (anime.type === "webseries" && anime.seasons) {
                onPlay(anime, 0, 0);
              } else {
                onPlay(anime);
              }
            }}
            className="flex-1 py-3 rounded-[10px] gradient-primary font-bold text-sm flex items-center justify-center gap-2 btn-glow"
          >
            {anime.type === "webseries" ? <><List className="w-4 h-4" /> Watch</> : <><Play className="w-4 h-4" /> Play</>}
          </button>
          <button className="flex-1 py-3 rounded-[10px] bg-foreground/10 backdrop-blur-[20px] font-semibold text-sm flex items-center justify-center gap-2 border border-foreground/20 transition-all hover:bg-foreground/20 hover:-translate-y-0.5">
            <Heart className="w-4 h-4" /> Watchlist
          </button>
        </div>

        {/* Storyline */}
        <div className="glass-card p-4 mb-5">
          <h3 className="text-[15px] font-bold mb-2.5 flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" /> Storyline
          </h3>
          <p className="text-[13px] leading-relaxed text-secondary-foreground">{anime.storyline}</p>
        </div>

        {/* Episode Grid for webseries */}
        {anime.type === "webseries" && anime.seasons && (
          <div className="mb-5">
            {anime.seasons.map((season, sIdx) => (
              <div key={sIdx} className="mb-4">
                <h3 className="text-[15px] font-bold mb-3 flex items-center category-bar">{season.name}</h3>
                <div className="grid grid-cols-4 gap-2">
                  {season.episodes.map((ep, eIdx) => (
                    <button
                      key={eIdx}
                      onClick={() => onPlay(anime, sIdx, eIdx)}
                      className="aspect-square rounded-[10px] bg-secondary border border-foreground/10 flex flex-col items-center justify-center transition-all hover:bg-primary hover:border-primary hover:scale-105"
                    >
                      <span className="text-base font-bold">{ep.episodeNumber}</span>
                      <span className="text-[9px] text-secondary-foreground">Episode</span>
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Info */}
        <div className="glass-card p-4">
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-muted-foreground">Category</span>
            <span className="font-medium">{anime.category}</span>
          </div>
          <div className="flex justify-between text-[12px] mb-2">
            <span className="text-muted-foreground">Language</span>
            <span className="font-medium">{anime.language}</span>
          </div>
          <div className="flex justify-between text-[12px]">
            <span className="text-muted-foreground">Year</span>
            <span className="font-medium">{anime.year}</span>
          </div>
        </div>
      </div>
    </motion.div>
  );
};

export default AnimeDetails;

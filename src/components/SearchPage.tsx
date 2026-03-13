import { useState, useEffect, useMemo, forwardRef } from "react";
import { ArrowLeft, Search, Clock, X } from "lucide-react";
import { type AnimeItem } from "@/data/animeData";
import { motion } from "framer-motion";

interface SearchPageProps {
  allAnime: AnimeItem[];
  onClose: () => void;
  onCardClick: (anime: AnimeItem) => void;
}

const HISTORY_KEY = "rs_search_history";
const MAX_HISTORY = 20;

const getSearchHistory = (): string[] => {
  try {
    return JSON.parse(localStorage.getItem(HISTORY_KEY) || "[]");
  } catch { return []; }
};

const addToSearchHistory = (animeId: string) => {
  const history = getSearchHistory().filter(id => id !== animeId);
  history.unshift(animeId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0, MAX_HISTORY)));
};

const removeFromHistory = (animeId: string) => {
  const history = getSearchHistory().filter(id => id !== animeId);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history));
};

const clearHistory = () => {
  localStorage.removeItem(HISTORY_KEY);
};

const SearchPage = forwardRef<HTMLDivElement, SearchPageProps>(({ allAnime, onClose, onCardClick }, _ref) => {
  const [query, setQuery] = useState("");
  const [historyIds, setHistoryIds] = useState<string[]>(getSearchHistory());

  const results = query.trim()
    ? allAnime.filter((a) => a.title.toLowerCase().includes(query.toLowerCase()))
    : [];

  const historyAnime = useMemo(() => {
    return historyIds
      .map(id => allAnime.find(a => a.id === id))
      .filter(Boolean) as AnimeItem[];
  }, [historyIds, allAnime]);

  const handleCardClick = (anime: AnimeItem) => {
    addToSearchHistory(anime.id);
    setHistoryIds(getSearchHistory());
    onCardClick(anime);
  };

  const handleRemoveHistory = (e: React.MouseEvent, animeId: string) => {
    e.stopPropagation();
    removeFromHistory(animeId);
    setHistoryIds(getSearchHistory());
  };

  const handleClearAll = () => {
    clearHistory();
    setHistoryIds([]);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[200] bg-background overflow-y-auto px-4 pb-24 pt-5"
      initial={{ y: "-100%" }}
      animate={{ y: 0 }}
      exit={{ y: "-100%" }}
      transition={{ type: "tween", duration: 0.4 }}
    >
      <div className="flex items-center gap-2.5 mb-5">
        <button onClick={onClose} className="w-10 h-10 rounded-full bg-foreground/10 flex items-center justify-center transition-all hover:bg-primary">
          <ArrowLeft className="w-4 h-4" />
        </button>
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <input
            type="text"
            placeholder="Search anime..."
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full py-3 pl-11 pr-4 rounded-xl bg-card border border-foreground/10 text-foreground text-[15px] focus:outline-none focus:border-primary focus:shadow-[0_0_20px_hsla(170,75%,45%,0.3)] placeholder:text-muted-foreground"
            autoFocus
          />
        </div>
      </div>

      {!query.trim() ? (
        <>
          {/* Search History */}
          {historyAnime.length > 0 && (
            <div className="mb-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  Search History
                </h3>
                <button onClick={handleClearAll} className="text-[11px] text-muted-foreground hover:text-destructive transition-colors">
                  Clear All
                </button>
              </div>
              <div className="grid grid-cols-3 gap-2.5">
                {historyAnime.map((anime) => (
                  <div key={anime.id} className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer poster-hover bg-card" onClick={() => handleCardClick(anime)}>
                    <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
                    <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)" }} />
                    <button onClick={(e) => handleRemoveHistory(e, anime.id)}
                      className="absolute top-1 right-1 w-5 h-5 rounded-full bg-background/70 backdrop-blur-sm flex items-center justify-center hover:bg-destructive transition-colors z-10">
                      <X className="w-3 h-3" />
                    </button>
                    <span className="absolute top-1.5 left-1.5 gradient-primary px-2 py-0.5 rounded text-[9px] font-bold">{anime.year}</span>
                    <div className="absolute bottom-0 left-0 right-0 p-2">
                      <p className="text-[11px] font-semibold leading-tight line-clamp-2">{anime.title}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {historyAnime.length === 0 && (
            <div className="text-center py-12">
              <Search className="w-14 h-14 text-muted-foreground/50 mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Search Anime</h3>
              <p className="text-sm text-secondary-foreground">Find your favorite series and movies</p>
            </div>
          )}
        </>
      ) : results.length === 0 ? (
        <div className="text-center py-12">
          <Search className="w-14 h-14 text-muted-foreground/50 mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Results Found</h3>
          <p className="text-sm text-secondary-foreground">Try a different search term</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-2.5">
          {results.map((anime) => (
            <div key={anime.id} className="w-full">
              <div className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer poster-hover bg-card" onClick={() => handleCardClick(anime)}>
                <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
                <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)" }} />
                <span className="absolute top-1.5 right-1.5 gradient-primary px-2 py-0.5 rounded text-[9px] font-bold">{anime.year}</span>
                <div className="absolute bottom-0 left-0 right-0 p-2">
                  <p className="text-[11px] font-semibold leading-tight line-clamp-2">{anime.title}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </motion.div>
  );
});

SearchPage.displayName = "SearchPage";

export default SearchPage;

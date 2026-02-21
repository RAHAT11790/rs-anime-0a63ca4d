import { useState, useMemo } from "react";
import { AnimatePresence } from "framer-motion";
import Header from "@/components/Header";
import BottomNav from "@/components/BottomNav";
import HeroSlider from "@/components/HeroSlider";
import CategoryPills from "@/components/CategoryPills";
import AnimeSection from "@/components/AnimeSection";
import AnimeDetails from "@/components/AnimeDetails";
import VideoPlayer from "@/components/VideoPlayer";
import SearchPage from "@/components/SearchPage";
import ProfilePage from "@/components/ProfilePage";
import NewEpisodeReleases from "@/components/NewEpisodeReleases";
import { useFirebaseData } from "@/hooks/useFirebaseData";
import type { AnimeItem } from "@/data/animeData";

const Index = () => {
  const { webseries, movies, allAnime, categories, loading } = useFirebaseData();
  
  const [activePage, setActivePage] = useState("home");
  const [activeCategory, setActiveCategory] = useState("All");
  const [selectedAnime, setSelectedAnime] = useState<AnimeItem | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [playerState, setPlayerState] = useState<{
    src: string;
    title: string;
    subtitle: string;
    anime: AnimeItem;
    seasonIdx?: number;
    epIdx?: number;
  } | null>(null);

  const filteredAnime = useMemo(() => {
    if (activeCategory === "All") return allAnime;
    return allAnime.filter((a) => a.category === activeCategory);
  }, [activeCategory, allAnime]);

  const filteredSeries = useMemo(() => filteredAnime.filter((a) => a.type === "webseries"), [filteredAnime]);
  const filteredMovies = useMemo(() => filteredAnime.filter((a) => a.type === "movie"), [filteredAnime]);

  const categoryGroups = useMemo(() => {
    const groups: Record<string, AnimeItem[]> = {};
    filteredAnime.forEach((a) => {
      if (!groups[a.category]) groups[a.category] = [];
      groups[a.category].push(a);
    });
    return groups;
  }, [filteredAnime]);

  // Hero slides from latest content
  const heroSlides = useMemo(() => {
    return allAnime.slice(0, 5).map((item) => ({
      id: item.id,
      title: item.title,
      backdrop: item.backdrop,
      subtitle: item.type === "webseries" ? "Series" : "Movie",
      rating: item.rating,
      year: item.year,
      type: item.type,
    }));
  }, [allAnime]);

  const handleCardClick = (anime: AnimeItem) => setSelectedAnime(anime);

  const handlePlay = (anime: AnimeItem, seasonIdx?: number, epIdx?: number) => {
    let src = "";
    let subtitle = "";
    if (anime.type === "webseries" && anime.seasons && seasonIdx !== undefined && epIdx !== undefined) {
      const season = anime.seasons[seasonIdx];
      const episode = season.episodes[epIdx];
      src = episode.link;
      subtitle = `${season.name} - Episode ${episode.episodeNumber}`;
    } else if (anime.movieLink) {
      src = anime.movieLink;
      subtitle = "Movie";
    }
    if (src) {
      setPlayerState({ src, title: anime.title, subtitle, anime, seasonIdx, epIdx });
      setSelectedAnime(null);
    }
  };

  const handleHeroPlay = (index: number) => {
    const anime = allAnime[index];
    if (anime) {
      if (anime.type === "webseries" && anime.seasons) {
        handlePlay(anime, 0, 0);
      } else {
        handlePlay(anime);
      }
    }
  };

  const handleHeroInfo = (index: number) => {
    const anime = allAnime[index];
    if (anime) setSelectedAnime(anime);
  };

  const handleNavigate = (page: string) => {
    setShowProfile(page === "profile");
    setActivePage(page);
  };

  const currentEpisodeList = playerState?.anime.seasons?.[playerState.seasonIdx ?? 0]?.episodes.map((ep, i) => ({
    number: ep.episodeNumber,
    active: i === (playerState?.epIdx ?? 0),
    onClick: () => {
      const season = playerState!.anime.seasons![playerState!.seasonIdx ?? 0];
      setPlayerState({
        ...playerState!,
        src: season.episodes[i].link,
        subtitle: `${season.name} - Episode ${season.episodes[i].episodeNumber}`,
        epIdx: i,
      });
    },
  }));

  // Loading screen
  if (loading) {
    return (
      <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[9999]">
        <div className="text-7xl font-black text-primary animate-pulse" style={{ textShadow: "0 0 40px hsla(355,85%,55%,0.5), 0 0 80px hsla(210,90%,55%,0.5)", letterSpacing: "-4px" }}>
          RS
        </div>
        <p className="mt-4 text-xs text-muted-foreground uppercase tracking-[3px]">Loading...</p>
        <div className="mt-7 w-[200px] h-[3px] bg-secondary rounded overflow-hidden relative">
          <div className="absolute h-full w-[40%] bg-gradient-to-r from-transparent via-primary to-transparent animate-[loadingMove_1s_ease-in-out_infinite]" />
        </div>
      </div>
    );
  }

  const getPageContent = () => {
    switch (activePage) {
      case "series":
        return (
          <div className="pt-[65px] pb-24 px-4">
            <h2 className="text-xl font-bold mb-4 flex items-center category-bar">Anime Series</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {webseries.map((anime) => (
                <div key={anime.id} className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer poster-hover bg-card" onClick={() => handleCardClick(anime)}>
                  <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)" }} />
                  <span className="absolute top-1.5 right-1.5 gradient-primary px-2 py-0.5 rounded text-[9px] font-bold">{anime.year}</span>
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-[11px] font-semibold leading-tight line-clamp-2">{anime.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      case "movies":
        return (
          <div className="pt-[65px] pb-24 px-4">
            <h2 className="text-xl font-bold mb-4 flex items-center category-bar">Anime Movies</h2>
            <div className="grid grid-cols-3 gap-2.5">
              {movies.map((anime) => (
                <div key={anime.id} className="relative aspect-[2/3] rounded-xl overflow-hidden cursor-pointer poster-hover bg-card" onClick={() => handleCardClick(anime)}>
                  <img src={anime.poster} alt={anime.title} className="w-full h-full object-cover" loading="lazy" />
                  <div className="absolute inset-0" style={{ background: "linear-gradient(to top, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0.3) 40%, transparent 70%)" }} />
                  <span className="absolute top-1.5 right-1.5 gradient-primary px-2 py-0.5 rounded text-[9px] font-bold">{anime.year}</span>
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <p className="text-[11px] font-semibold leading-tight line-clamp-2">{anime.title}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        );
      default:
        return (
          <>
            <HeroSlider slides={heroSlides} onPlay={handleHeroPlay} onInfo={handleHeroInfo} />
            <CategoryPills active={activeCategory} onSelect={setActiveCategory} categories={categories} />
            <NewEpisodeReleases allAnime={allAnime} onCardClick={handleCardClick} />
            {filteredSeries.length > 0 && (
              <AnimeSection title="Trending Anime Series" items={filteredSeries.slice(0, 10)} onCardClick={handleCardClick} onViewAll={() => setActivePage("series")} />
            )}
            {filteredMovies.length > 0 && (
              <AnimeSection title="Popular Anime Movies" items={filteredMovies.slice(0, 10)} onCardClick={handleCardClick} onViewAll={() => setActivePage("movies")} />
            )}
            {Object.entries(categoryGroups).map(([cat, items]) => (
              <AnimeSection key={cat} title={cat} items={items.slice(0, 10)} onCardClick={handleCardClick} />
            ))}
            <footer className="text-center py-8 pb-24 px-4 border-t border-border/30 mt-8">
              <div className="text-2xl font-black text-primary text-glow tracking-wide mb-2">RS ANIME</div>
              <p className="text-xs text-muted-foreground mb-3">Unlimited Anime Series & Movies</p>
              <p className="text-[10px] text-muted-foreground">© 2024 RS ANIME. All rights reserved.</p>
            </footer>
          </>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <Header onSearchClick={() => setShowSearch(true)} onProfileClick={() => handleNavigate("profile")} onOpenContent={(id) => { const a = allAnime.find(x => x.id === id); if (a) handleCardClick(a); }} />
      <main>{getPageContent()}</main>
      <BottomNav activePage={activePage} onNavigate={handleNavigate} />

      <AnimatePresence>
        {showSearch && (
          <SearchPage allAnime={allAnime} onClose={() => setShowSearch(false)} onCardClick={(anime) => { setShowSearch(false); handleCardClick(anime); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {showProfile && (
          <ProfilePage onClose={() => { setShowProfile(false); setActivePage("home"); }} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {selectedAnime && (
          <AnimeDetails anime={selectedAnime} onClose={() => setSelectedAnime(null)} onPlay={handlePlay} />
        )}
      </AnimatePresence>

      {playerState && (
        <VideoPlayer
          src={playerState.src}
          title={playerState.title}
          subtitle={playerState.subtitle}
          onClose={() => setPlayerState(null)}
          onNextEpisode={
            playerState.anime.type === "webseries" && playerState.seasonIdx !== undefined && playerState.epIdx !== undefined
              ? () => {
                  const season = playerState.anime.seasons![playerState.seasonIdx!];
                  const nextIdx = (playerState.epIdx! + 1) % season.episodes.length;
                  setPlayerState({
                    ...playerState,
                    src: season.episodes[nextIdx].link,
                    subtitle: `${season.name} - Episode ${season.episodes[nextIdx].episodeNumber}`,
                    epIdx: nextIdx,
                  });
                }
              : undefined
          }
          episodeList={currentEpisodeList}
        />
      )}
    </div>
  );
};

export default Index;

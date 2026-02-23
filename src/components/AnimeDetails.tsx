import { useState, useEffect } from "react";
import { X, Play, Heart, Star, BookOpen, List, ArrowLeft, MessageCircle, Send, Trash2, Share2, Check } from "lucide-react";
import type { AnimeItem } from "@/data/animeData";
import { motion } from "framer-motion";
import { db, ref, set, remove, onValue, push, get } from "@/lib/firebase";
import { getAnimeTitleStyle } from "@/lib/animeFonts";

interface AnimeDetailsProps {
  anime: AnimeItem;
  onClose: () => void;
  onPlay: (anime: AnimeItem, seasonIdx?: number, epIdx?: number) => void;
}

const AnimeDetails = ({ anime, onClose, onPlay }: AnimeDetailsProps) => {
  const [isInWatchlist, setIsInWatchlist] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentText, setCommentText] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const getUserId = (): string | null => {
    try { const u = localStorage.getItem("rsanime_user"); if (u) return JSON.parse(u).id; } catch {} return null;
  };
  const userId = getUserId();

  useEffect(() => {
    if (!userId) return;
    const wlRef = ref(db, `users/${userId}/watchlist/${anime.id}`);
    const unsub = onValue(wlRef, (snap) => setIsInWatchlist(snap.exists()));
    return () => unsub();
  }, [userId, anime.id]);

  // Load comments
  useEffect(() => {
    const commRef = ref(db, `comments/${anime.id}`);
    const unsub = onValue(commRef, (snap) => {
      const data = snap.val() || {};
      const list = Object.entries(data).map(([key, val]: any) => ({ key, ...val }));
      list.sort((a: any, b: any) => (b.timestamp || 0) - (a.timestamp || 0));
      setComments(list);
    });
    return () => unsub();
  }, [anime.id]);

  const postComment = () => {
    if (!userId || !commentText.trim()) return;
    const userName = (() => { try { return localStorage.getItem("rs_display_name") || JSON.parse(localStorage.getItem("rsanime_user") || "{}").name || "User"; } catch { return "User"; } })();
    const newRef = push(ref(db, `comments/${anime.id}`));
    set(newRef, { userId, userName, text: commentText.trim(), timestamp: Date.now() });
    setCommentText("");
  };

  const deleteComment = (commentKey: string) => {
    remove(ref(db, `comments/${anime.id}/${commentKey}`));
  };

  const toggleWatchlist = () => {
    if (!userId) return;
    if (isInWatchlist) {
      remove(ref(db, `users/${userId}/watchlist/${anime.id}`));
    } else {
      set(ref(db, `users/${userId}/watchlist/${anime.id}`), {
        id: anime.id, title: anime.title, poster: anime.poster,
        year: anime.year, rating: anime.rating, type: anime.type, addedAt: Date.now(),
      });
    }
  };

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
          <h1 className="text-2xl font-extrabold mb-2" style={{ ...getAnimeTitleStyle(anime.title), textShadow: "0 4px 20px rgba(0,0,0,0.9)" }}>
            {anime.title}
          </h1>
          <div className="flex items-center justify-center gap-2 text-[11px] text-secondary-foreground flex-wrap">
            <span className="bg-accent px-2.5 py-1 rounded text-accent-foreground font-semibold shadow-[0_2px_10px_hsla(38,90%,55%,0.4)] flex items-center gap-1">
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

      {/* Back button */}
      <button onClick={onClose}
        className="fixed left-4 top-5 w-10 h-10 rounded-full bg-background/70 backdrop-blur-[20px] border-2 border-foreground/20 flex items-center justify-center z-[210] transition-all hover:bg-primary hover:border-primary hover:scale-110">
        <ArrowLeft className="w-5 h-5" />
      </button>


      {/* Content */}
      <div className="relative px-4 pb-24 z-10">
        <div className="flex gap-2.5 mb-5">
          <button
            onClick={() => {
              if (anime.type === "webseries" && anime.seasons) { onPlay(anime, 0, 0); } else { onPlay(anime); }
            }}
            className="flex-1 py-3 rounded-[10px] gradient-primary font-bold text-sm flex items-center justify-center gap-2 btn-glow">
            {anime.type === "webseries" ? <><List className="w-4 h-4" /> Watch</> : <><Play className="w-4 h-4" /> Play</>}
          </button>
          <button onClick={toggleWatchlist}
            className={`flex-1 py-3 rounded-[10px] font-semibold text-sm flex items-center justify-center gap-2 border transition-all hover:-translate-y-0.5 ${
              isInWatchlist ? "bg-primary/20 border-primary text-primary" : "bg-foreground/10 backdrop-blur-[20px] border-foreground/20 hover:bg-foreground/20"
            }`}>
            <Heart className={`w-4 h-4 ${isInWatchlist ? "fill-primary" : ""}`} />
            {isInWatchlist ? "In Watchlist" : "Watchlist"}
          </button>
        </div>

        {/* Share button */}
        <button
          onClick={() => {
            const url = `${window.location.origin}?anime=${encodeURIComponent(anime.id)}`;
            navigator.clipboard.writeText(url).then(() => {
              setShareCopied(true);
              setTimeout(() => setShareCopied(false), 2000);
            }).catch(() => {
              const ta = document.createElement("textarea");
              ta.value = url; document.body.appendChild(ta); ta.select(); document.execCommand("copy"); document.body.removeChild(ta);
              setShareCopied(true);
              setTimeout(() => setShareCopied(false), 2000);
            });
          }}
          className="w-full py-3 rounded-[10px] bg-secondary border border-foreground/20 font-semibold text-sm flex items-center justify-center gap-2 mb-5 transition-all hover:-translate-y-0.5 hover:border-primary"
        >
          {shareCopied ? <><Check className="w-4 h-4 text-green-400" /> Link Copied!</> : <><Share2 className="w-4 h-4" /> Share</>}
        </button>

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

        {/* Comments */}
        <div className="glass-card p-4 mb-5">
          <h3 className="text-[15px] font-bold mb-3 flex items-center gap-2">
            <MessageCircle className="w-4 h-4 text-primary" /> Comments ({comments.length})
          </h3>
          {userId && (
            <div className="flex gap-2 mb-3 items-end">
              <textarea
                value={commentText}
                onChange={(e) => setCommentText(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); postComment(); } }}
                placeholder="Write a comment..."
                rows={1}
                className="flex-1 bg-secondary border border-foreground/10 rounded-lg px-3 py-2 text-[13px] outline-none focus:border-primary resize-none min-h-[40px] max-h-[120px]"
                style={{ overflow: "auto" }}
                onInput={(e) => { const t = e.currentTarget; t.style.height = "auto"; t.style.height = Math.min(t.scrollHeight, 120) + "px"; }}
              />
              <button onClick={postComment} className="w-10 h-10 min-w-[40px] rounded-full gradient-primary flex items-center justify-center btn-glow">
                <Send className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="space-y-2.5 max-h-[300px] overflow-y-auto">
            {comments.length === 0 && <p className="text-[12px] text-muted-foreground text-center py-3">No comments yet</p>}
            {comments.map((c) => (
              <div key={c.key} className="bg-secondary/50 rounded-lg p-2.5">
                <div className="flex justify-between items-start">
                  <span className="text-[12px] font-semibold text-primary">{c.userName}</span>
                  <div className="flex items-center gap-2">
                    <span className="text-[9px] text-muted-foreground">
                      {new Date(c.timestamp).toLocaleDateString()}
                    </span>
                    {c.userId === userId && (
                      <button onClick={() => deleteComment(c.key)} className="text-destructive hover:scale-110 transition-transform">
                        <Trash2 className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>
                <p className="text-[12px] text-secondary-foreground mt-1 break-words overflow-wrap-anywhere">{c.text}</p>
              </div>
            ))}
          </div>
        </div>

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

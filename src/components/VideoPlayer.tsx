import { useState, useRef, useEffect, useCallback, useMemo, memo } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, SkipBack, Settings, X, Lock, Unlock,
  ChevronRight, FastForward, Rewind, Crop, Check, ExternalLink, Loader2
} from "lucide-react";
import { db, ref, onValue } from "@/lib/firebase";
import { supabase } from "@/integrations/supabase/client";

interface QualityOption {
  label: string;
  src: string;
}

interface VideoPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onNextEpisode?: () => void;
  episodeList?: { number: number; active: boolean; onClick: () => void }[];
  qualityOptions?: QualityOption[];
  animeId?: string;
  onSaveProgress?: (currentTime: number, duration: number) => void;
}

const formatTime = (t: number) => {
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
};

const VideoPlayer = ({ src, title, subtitle, onClose, onNextEpisode, episodeList, qualityOptions, animeId, onSaveProgress }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingSeek = useRef<number | null>(null);
  const rafId = useRef<number>(0);
  const progressRef = useRef<HTMLDivElement>(null);
  const timeDisplayRef = useRef<HTMLSpanElement>(null);

  const [playing, setPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(1);
  const [muted, setMuted] = useState(false);
  const [showControls, setShowControls] = useState(true);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);
  const [showSettings, setShowSettings] = useState(false);
  const [skipIndicator, setSkipIndicator] = useState<{ side: "left" | "right" | "center"; text: string } | null>(null);
  const [brightness, setBrightness] = useState(1);
  const [swipeState, setSwipeState] = useState<{ startX: number; startY: number; type: string | null } | null>(null);
  const cropModes = ["contain", "cover", "fill"] as const;
  const cropLabels = ["Fit", "Crop", "Stretch"];
  const [cropIndex, setCropIndex] = useState(0);
  const [settingsTab, setSettingsTab] = useState<"speed" | "quality">("speed");
  const [currentQuality, setCurrentQuality] = useState<string>("Auto");
  const [currentSrc, setCurrentSrc] = useState(src);
  const [isPremium, setIsPremium] = useState(false);
  const [adGateActive, setAdGateActive] = useState(false);
  const [shortenedLink, setShortenedLink] = useState<string | null>(null);
  const [shortenLoading, setShortenLoading] = useState(false);
  const [showQualityPanel, setShowQualityPanel] = useState(false);

  // Check 24h access
  const has24hAccess = useCallback((): boolean => {
    try {
      const expiry = localStorage.getItem("rsanime_ad_access");
      if (expiry && parseInt(expiry) > Date.now()) return true;
    } catch {}
    return false;
  }, []);

  // Maintenance pause listener
  useEffect(() => {
    const unsub = onValue(ref(db, "maintenance"), (snap) => {
      const maint = snap.val();
      if (!maint?.active && maint?.lastPauseDuration && maint?.lastResumedAt) {
        const appliedKey = `rsanime_pause_applied_${maint.lastResumedAt}`;
        if (!localStorage.getItem(appliedKey)) {
          const expiry = localStorage.getItem("rsanime_ad_access");
          if (expiry) {
            const newExpiry = parseInt(expiry) + maint.lastPauseDuration;
            localStorage.setItem("rsanime_ad_access", newExpiry.toString());
          }
          localStorage.setItem(appliedKey, "true");
        }
      }
    });
    return () => unsub();
  }, []);

  const grant24hAccess = useCallback(() => {
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem("rsanime_ad_access", expiry.toString());
  }, []);

  // Premium check
  useEffect(() => {
    const getUserId = (): string | null => {
      try { const u = localStorage.getItem("rsanime_user"); if (u) return JSON.parse(u).id; } catch {} return null;
    };
    const uid = getUserId();
    if (!uid) { setIsPremium(false); return; }
    const premRef = ref(db, `users/${uid}/premium`);
    const unsub = onValue(premRef, (snap) => {
      const data = snap.val();
      setIsPremium(!!(data && data.active === true && data.expiresAt > Date.now()));
    });
    return () => unsub();
  }, []);

  // Ad gate
  useEffect(() => {
    if (isPremium || has24hAccess()) {
      setAdGateActive(false);
      return;
    }
    setAdGateActive(true);
    setShortenLoading(true);
    const origin = window.location.origin;
    const callbackUrl = `${origin}/unlock`;
    supabase.functions.invoke('shorten-link', {
      body: { url: callbackUrl },
    }).then(({ data, error }) => {
      setShortenLoading(false);
      if (!error && data?.shortenedUrl) setShortenedLink(data.shortenedUrl);
      else if (!error && data?.short) setShortenedLink(data.short);
      else setAdGateActive(false);
    }).catch(() => { setShortenLoading(false); setAdGateActive(false); });
  }, [isPremium, has24hAccess]);

  const handleOpenAdLink = useCallback(() => {
    if (shortenedLink) window.location.href = shortenedLink;
  }, [shortenedLink]);

  // Save progress every 10s
  useEffect(() => {
    if (!onSaveProgress) return;
    const v = videoRef.current;
    if (!v) return;
    const saveInterval = setInterval(() => {
      if (v.currentTime > 0 && v.duration > 0) onSaveProgress(v.currentTime, v.duration);
    }, 10000);
    const onPause = () => { if (v.currentTime > 0 && v.duration > 0) onSaveProgress(v.currentTime, v.duration); };
    v.addEventListener("pause", onPause);
    return () => {
      clearInterval(saveInterval);
      v.removeEventListener("pause", onPause);
      if (v.currentTime > 0 && v.duration > 0) onSaveProgress(v.currentTime, v.duration);
    };
  }, [onSaveProgress]);

  // Restore watch position
  useEffect(() => {
    if (!animeId) return;
    try {
      const user = localStorage.getItem("rsanime_user");
      if (!user) return;
      const userId = JSON.parse(user).id;
      if (!userId) return;
      import("@/lib/firebase").then(({ get: fbGet, ref: fbRef, db: fbDb }) => {
        const histRef = fbRef(fbDb, `users/${userId}/watchHistory/${animeId}`);
        fbGet(histRef).then((snap: any) => {
          if (snap.exists()) {
            const data = snap.val();
            if (data.currentTime && data.duration && (data.currentTime / data.duration) < 0.95) {
              const v = videoRef.current;
              if (v) {
                const tryRestore = () => { if (v.duration > 0) { v.currentTime = data.currentTime; v.removeEventListener("loadedmetadata", tryRestore); } };
                if (v.duration > 0) v.currentTime = data.currentTime;
                else v.addEventListener("loadedmetadata", tryRestore);
              }
            }
          }
        });
      });
    } catch {}
  }, [animeId]);

  // Build quality list
  const availableQualities: QualityOption[] = useMemo(() => {
    const list: QualityOption[] = [{ label: "Auto", src }];
    if (qualityOptions?.length) qualityOptions.forEach(q => { if (q.src) list.push(q); });
    return list;
  }, [src, qualityOptions]);

  // Update src on prop change
  useEffect(() => { setCurrentSrc(src); setCurrentQuality("Auto"); }, [src]);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => setShowControls(false), 5000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [resetHideTimer]);

  // ===== OPTIMIZED: Use RAF for progress updates instead of timeupdate =====
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;

    const onLoaded = () => {
      setDuration(v.duration);
      if (pendingSeek.current !== null) {
        v.currentTime = pendingSeek.current;
        pendingSeek.current = null;
      }
      v.play().catch(() => {});
    };
    const onPlay = () => {
      setPlaying(true);
      // Start RAF loop for smooth progress
      const tick = () => {
        if (!v.paused && !v.ended) {
          const ct = v.currentTime;
          const dur = v.duration;
          // Direct DOM updates for progress bar - avoids React re-renders
          if (progressRef.current && dur > 0) {
            progressRef.current.style.width = `${(ct / dur) * 100}%`;
          }
          if (timeDisplayRef.current && dur > 0) {
            timeDisplayRef.current.textContent = `${formatTime(ct)} / ${formatTime(dur)}`;
          }
          // Update React state less frequently (every ~500ms) for other consumers
          setCurrentTime(ct);
          rafId.current = requestAnimationFrame(tick);
        }
      };
      rafId.current = requestAnimationFrame(tick);
    };
    const onPause = () => {
      setPlaying(false);
      cancelAnimationFrame(rafId.current);
    };
    const onEnded = () => {
      setPlaying(false);
      cancelAnimationFrame(rafId.current);
    };

    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    v.addEventListener("ended", onEnded);
    v.load();

    return () => {
      cancelAnimationFrame(rafId.current);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
      v.removeEventListener("ended", onEnded);
    };
  }, [currentSrc]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = useCallback(() => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    resetHideTimer();
  }, [resetHideTimer]);

  const seek = useCallback((seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(v.currentTime + seconds, 0), v.duration);
    setSkipIndicator({ side: seconds > 0 ? "right" : "left", text: `${Math.abs(seconds)}s` });
    setTimeout(() => setSkipIndicator(null), 600);
    resetHideTimer();
  }, [resetHideTimer]);

  const toggleFullscreen = useCallback(async () => {
    const el = videoContainerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else if (el.requestFullscreen) await el.requestFullscreen();
      else if ((el as any).webkitRequestFullscreen) (el as any).webkitRequestFullscreen();
    } catch (e) { console.log('Fullscreen not supported'); }
  }, []);

  const setSpeed = useCallback((rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  }, []);

  const switchQuality = useCallback((option: QualityOption) => {
    if (option.label === currentQuality) { setShowSettings(false); return; }
    const v = videoRef.current;
    pendingSeek.current = v?.currentTime || 0;
    setCurrentSrc(option.src);
    setCurrentQuality(option.label);
    setShowSettings(false);
  }, [currentQuality]);

  const handleProgressClick = useCallback((e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
    resetHideTimer();
  }, [resetHideTimer]);

  const lastTap = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const handleVideoClick = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (locked) return;
    const now = Date.now();
    const clientX = "touches" in e ? e.changedTouches[0].clientX : e.clientX;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;

    if (now - lastTap.current.time < 300) {
      if (relX < 0.33) seek(-10);
      else if (relX > 0.66) seek(10);
      else {
        togglePlay();
        setSkipIndicator({ side: "center", text: playing ? "⏸" : "▶" });
        setTimeout(() => setSkipIndicator(null), 600);
      }
      lastTap.current = { time: 0, x: 0 };
    } else {
      lastTap.current = { time: now, x: clientX };
      setTimeout(() => { if (lastTap.current.time === now) resetHideTimer(); }, 300);
    }
  }, [locked, seek, togglePlay, playing, resetHideTimer]);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    setSwipeState({ startX: t.clientX, startY: t.clientY, type: null });
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!swipeState || locked) return;
    const t = e.touches[0];
    const dy = t.clientY - swipeState.startY;
    if (!swipeState.type && Math.abs(dy) > 20) {
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const relX = (swipeState.startX - rect.left) / rect.width;
      setSwipeState({ ...swipeState, type: relX > 0.5 ? "volume" : "brightness" });
    }
    if (swipeState.type === "volume") {
      const newVol = Math.min(1, Math.max(0, volume - dy * 0.003));
      setVolume(newVol);
      if (videoRef.current) videoRef.current.volume = newVol;
      setSwipeState({ ...swipeState, startY: t.clientY });
    } else if (swipeState.type === "brightness") {
      const newBr = Math.min(1.5, Math.max(0.3, brightness - dy * 0.003));
      setBrightness(newBr);
      setSwipeState({ ...swipeState, startY: t.clientY });
    }
  }, [swipeState, locked, volume, brightness]);

  const handleTouchEnd = useCallback(() => setSwipeState(null), []);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[300] bg-background/[0.98] flex flex-col items-center overflow-y-auto" ref={containerRef}>
      {/* Close button */}
      <button onClick={onClose} className="absolute top-5 right-5 z-[310] w-10 h-10 rounded-full gradient-primary flex items-center justify-center btn-glow transition-all hover:rotate-90">
        <X className="w-5 h-5" />
      </button>

      <div className="w-full max-w-full p-5">
        <div className="text-center mb-2.5">
          <h1 className="text-2xl font-extrabold text-primary text-glow tracking-wider">RS ANIME PLAYER</h1>
        </div>

        <div className="text-center mb-5">
          <p className="text-lg font-semibold">{title}</p>
          {subtitle && <p className="text-sm text-secondary-foreground">{subtitle}</p>}
        </div>

        {/* Video Container - will-change for GPU compositing */}
        <div
          ref={videoContainerRef}
          className="relative w-full bg-black rounded-xl overflow-hidden aspect-video fullscreen:!rounded-none fullscreen:!aspect-auto fullscreen:!w-screen fullscreen:!h-screen"
          style={{ filter: `brightness(${brightness})`, willChange: "transform" }}
          onClick={handleVideoClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <video
            ref={videoRef}
            src={currentSrc}
            className="w-full h-full"
            style={{ objectFit: cropModes[cropIndex], willChange: "transform" }}
            playsInline
            preload="auto"
            crossOrigin="anonymous"
          />

          {/* Skip Indicators */}
          {skipIndicator && (
            <div className={`absolute top-1/2 -translate-y-1/2 skip-indicator w-16 h-16 flex items-center justify-center text-foreground text-xl font-bold ${
              skipIndicator.side === "left" ? "left-[15%]" :
              skipIndicator.side === "right" ? "right-[15%]" : "left-1/2 -translate-x-1/2"
            }`}>
              {skipIndicator.side === "left" ? <Rewind className="w-6 h-6" /> :
               skipIndicator.side === "right" ? <FastForward className="w-6 h-6" /> :
               <span className="text-2xl">{skipIndicator.text}</span>}
              {skipIndicator.side !== "center" && <span className="text-xs mt-1 absolute -bottom-5">{skipIndicator.text}</span>}
            </div>
          )}

          {/* Swipe indicator */}
          {swipeState?.type && (
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 player-glass px-6 py-3 rounded-xl text-center">
              {swipeState.type === "volume" ? (
                <div className="flex items-center gap-2">
                  <Volume2 className="w-5 h-5 text-primary" />
                  <span className="text-sm font-semibold">{Math.round(volume * 100)}%</span>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <span className="text-primary text-lg">☀</span>
                  <span className="text-sm font-semibold">{Math.round(brightness * 100)}%</span>
                </div>
              )}
            </div>
          )}

          {/* Controls Overlay */}
          {showControls && !locked && (
            <div className="absolute inset-0 player-controls-overlay flex flex-col justify-between" style={{ willChange: "opacity" }}>
              {/* Top controls */}
              <div className="flex justify-end gap-2 p-3">
                <button onClick={(e) => { e.stopPropagation(); setCropIndex((cropIndex + 1) % 3); }} className="player-glass h-7 px-2.5 rounded-full flex items-center justify-center gap-1">
                  <Crop className="w-3.5 h-3.5" />
                  <span className="text-[10px] font-medium">{cropLabels[cropIndex]}</span>
                </button>
                <button onClick={(e) => { e.stopPropagation(); setLocked(true); resetHideTimer(); }} className="player-glass w-8 h-8 rounded-full flex items-center justify-center">
                  <Lock className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Center play */}
              <div className="flex items-center justify-center gap-8">
                <button onClick={(e) => { e.stopPropagation(); seek(-10); }} className="w-10 h-10 rounded-full bg-foreground/20 flex items-center justify-center backdrop-blur">
                  <SkipBack className="w-5 h-5" />
                </button>
                <button onClick={(e) => { e.stopPropagation(); togglePlay(); }} className="w-14 h-14 rounded-full gradient-primary flex items-center justify-center btn-glow">
                  {playing ? <Pause className="w-7 h-7" /> : <Play className="w-7 h-7 ml-1" />}
                </button>
                <button onClick={(e) => { e.stopPropagation(); seek(10); }} className="w-10 h-10 rounded-full bg-foreground/20 flex items-center justify-center backdrop-blur">
                  <SkipForward className="w-5 h-5" />
                </button>
              </div>

              {/* Bottom controls */}
              <div className="px-3 pb-3">
                {/* Progress bar - GPU accelerated with will-change */}
                <div className="w-full h-1.5 bg-foreground/20 rounded-full cursor-pointer mb-2 relative" onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}>
                  <div
                    ref={progressRef}
                    className="h-full gradient-primary rounded-full relative"
                    style={{ width: `${progress}%`, willChange: "width" }}
                  >
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_hsla(355,85%,55%,0.6)]" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span ref={timeDisplayRef} className="text-[11px] font-medium">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }} className="w-6 h-6 flex items-center justify-center">
                      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-foreground/20 px-2 py-0.5 rounded">{playbackRate}x</span>
                    {availableQualities.length > 1 && (
                      <div className="relative">
                        <button
                          onClick={(e) => { e.stopPropagation(); setShowQualityPanel(!showQualityPanel); }}
                          className={`text-[10px] px-2 py-0.5 rounded font-semibold transition-all ${
                            currentQuality !== "Auto" ? "gradient-primary text-white" : "bg-foreground/20"
                          }`}
                        >
                          {currentQuality}
                        </button>
                        {showQualityPanel && (
                          <div className="absolute bottom-8 right-0 player-glass rounded-xl p-2 z-30 min-w-[120px] shadow-lg" onClick={(e) => e.stopPropagation()}>
                            <p className="text-[9px] text-muted-foreground mb-1.5 px-2 uppercase tracking-wider font-medium">Quality</p>
                            {availableQualities.map((opt) => (
                              <button key={opt.label} onClick={() => { switchQuality(opt); setShowQualityPanel(false); }}
                                className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                                  currentQuality === opt.label ? "gradient-primary font-bold text-white" : "hover:bg-foreground/10"
                                }`}>
                                <span>{opt.label}</span>
                                {currentQuality === opt.label && <Check className="w-3 h-3" />}
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                    {onNextEpisode && (
                      <button onClick={(e) => { e.stopPropagation(); onNextEpisode(); }} className="text-[10px] bg-primary/30 px-2 py-0.5 rounded flex items-center gap-1">
                        Next <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); setSettingsTab("speed"); }} className="player-glass w-7 h-7 rounded-full flex items-center justify-center">
                      <Settings className="w-3 h-3" />
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); toggleFullscreen(); }} className="player-glass w-7 h-7 rounded-full flex items-center justify-center">
                      {isFullscreen ? <Minimize className="w-3 h-3" /> : <Maximize className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Locked indicator */}
          {locked && showControls && (
            <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setLocked(false); resetHideTimer(); }} className="player-glass w-10 h-10 rounded-full flex items-center justify-center">
                <Unlock className="w-4 h-4 text-primary" />
              </button>
            </div>
          )}
          {locked && !showControls && (
            <div className="absolute inset-0" onClick={(e) => { e.stopPropagation(); resetHideTimer(); }} />
          )}

          {/* Settings panel */}
          {showSettings && (
            <div className="absolute bottom-16 right-3 player-glass rounded-xl p-3 z-20 min-w-[180px] max-h-[250px] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => setShowSettings(false)} className="absolute top-2 right-2 w-6 h-6 rounded-full bg-foreground/20 flex items-center justify-center hover:bg-foreground/30 transition-all">
                <X className="w-3.5 h-3.5" />
              </button>
              <div className="flex gap-1.5 mb-3 pr-7">
                <button onClick={() => setSettingsTab("speed")} className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all ${settingsTab === "speed" ? "gradient-primary text-white" : "bg-foreground/10 hover:bg-foreground/20"}`}>
                  Speed
                </button>
                <button onClick={() => setSettingsTab("quality")} className={`text-[11px] px-3 py-1.5 rounded-full font-medium transition-all ${settingsTab === "quality" ? "gradient-primary text-white" : "bg-foreground/10 hover:bg-foreground/20"}`}>
                  Quality
                </button>
              </div>

              {settingsTab === "speed" && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">Playback Speed</p>
                  {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                    <button key={r} onClick={() => setSpeed(r)}
                      className={`block w-full text-left px-3 py-2 rounded-lg text-xs transition-all ${playbackRate === r ? "gradient-primary font-bold text-white" : "hover:bg-foreground/10"}`}>
                      {r}x {r === 1 && "(Normal)"}
                    </button>
                  ))}
                </div>
              )}

              {settingsTab === "quality" && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-muted-foreground mb-1.5 uppercase tracking-wider font-medium">Video Quality</p>
                  {availableQualities.map((opt) => (
                    <button key={opt.label} onClick={() => switchQuality(opt)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-xs transition-all flex items-center justify-between ${
                        currentQuality === opt.label ? "gradient-primary font-bold text-white" : "hover:bg-foreground/10"
                      }`}>
                      <span>{opt.label}</span>
                      {currentQuality === opt.label && <Check className="w-3.5 h-3.5" />}
                    </button>
                  ))}
                  {availableQualities.length <= 1 && (
                    <p className="text-[10px] text-muted-foreground/60 text-center py-2">No additional qualities available</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Ad Gate Overlay */}
        {adGateActive && (
          <div className="fixed inset-0 z-[400] bg-black/90 flex items-center justify-center backdrop-blur-sm">
            <div className="bg-card rounded-2xl p-6 max-w-sm w-[90%] text-center space-y-4 shadow-2xl border border-border">
              <h3 className="text-lg font-bold text-foreground">Unlock 24 Hours Access</h3>
              <p className="text-sm text-muted-foreground">Click the link below to get 24 hours of free access to all videos</p>
              {shortenLoading ? (
                <div className="flex items-center justify-center gap-2 py-3">
                  <Loader2 className="w-5 h-5 animate-spin text-primary" />
                  <span className="text-sm text-muted-foreground">Preparing link...</span>
                </div>
              ) : (
                <button onClick={handleOpenAdLink} className="w-full py-3 rounded-xl gradient-primary text-white font-semibold flex items-center justify-center gap-2 btn-glow transition-all hover:scale-105">
                  <ExternalLink className="w-4 h-4" />
                  Unlock Now
                </button>
              )}
            </div>
          </div>
        )}

        {/* Episode List */}
        {episodeList && episodeList.length > 0 && (
          <div className="mt-5 bg-background rounded-xl p-4 max-h-[300px] overflow-y-auto">
            <h3 className="text-base font-semibold mb-3 text-center">Episodes</h3>
            <div className="grid grid-cols-3 gap-2">
              {episodeList.map((ep) => (
                <button
                  key={ep.number}
                  onClick={ep.onClick}
                  className={`rounded-lg py-3 px-2 flex flex-col items-center transition-all border-2 ${
                    ep.active
                      ? "gradient-primary border-foreground shadow-[0_0_20px_hsla(355,85%,55%,0.4)]"
                      : "bg-secondary border-transparent hover:bg-primary hover:-translate-y-0.5 hover:shadow-[0_5px_15px_hsla(355,85%,55%,0.4)]"
                  }`}
                >
                  <span className="text-lg font-bold">{ep.number}</span>
                  <span className="text-[10px] text-secondary-foreground">Episode</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default memo(VideoPlayer);

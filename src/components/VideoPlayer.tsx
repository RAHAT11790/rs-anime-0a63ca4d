import { useState, useRef, useEffect, useCallback } from "react";
import {
  Play, Pause, Volume2, VolumeX, Maximize, Minimize,
  SkipForward, SkipBack, Settings, X, Lock, Unlock,
  ChevronRight, FastForward, Rewind, Crop
} from "lucide-react";

interface VideoPlayerProps {
  src: string;
  title: string;
  subtitle?: string;
  onClose: () => void;
  onNextEpisode?: () => void;
  episodeList?: { number: number; active: boolean; onClick: () => void }[];
}

const VideoPlayer = ({ src, title, subtitle, onClose, onNextEpisode, episodeList }: VideoPlayerProps) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const videoContainerRef = useRef<HTMLDivElement>(null);
  const hideTimer = useRef<NodeJS.Timeout | null>(null);
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
  const [showEpisodes, setShowEpisodes] = useState(false);
  const [skipIndicator, setSkipIndicator] = useState<{ side: "left" | "right" | "center"; text: string } | null>(null);
  const [brightness, setBrightness] = useState(1);
  const [swipeState, setSwipeState] = useState<{ startX: number; startY: number; type: string | null } | null>(null);
  const cropModes = ["contain", "cover", "fill"] as const;
  const cropLabels = ["Fit", "Crop", "Stretch"];
  const [cropIndex, setCropIndex] = useState(0);

  const resetHideTimer = useCallback(() => {
    if (hideTimer.current) clearTimeout(hideTimer.current);
    setShowControls(true);
    hideTimer.current = setTimeout(() => setShowControls(false), 5000);
  }, []);

  useEffect(() => {
    resetHideTimer();
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [resetHideTimer]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setCurrentTime(v.currentTime);
    const onLoaded = () => {
      setDuration(v.duration);
      // Autoplay on load
      v.play().catch(() => {});
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onLoaded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    // Also try autoplay immediately
    v.play().catch(() => {});
    return () => {
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onLoaded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [src]);

  useEffect(() => {
    const onFs = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", onFs);
    return () => document.removeEventListener("fullscreenchange", onFs);
  }, []);

  const togglePlay = () => {
    const v = videoRef.current;
    if (!v) return;
    if (v.paused) v.play(); else v.pause();
    resetHideTimer();
  };

  const seek = (seconds: number) => {
    const v = videoRef.current;
    if (!v) return;
    v.currentTime = Math.min(Math.max(v.currentTime + seconds, 0), v.duration);
    setSkipIndicator({ side: seconds > 0 ? "right" : "left", text: `${Math.abs(seconds)}s` });
    setTimeout(() => setSkipIndicator(null), 600);
    resetHideTimer();
  };

  const toggleFullscreen = async () => {
    const el = videoContainerRef.current;
    if (!el) return;
    try {
      if (document.fullscreenElement) {
        await document.exitFullscreen();
      } else {
        // Try standard, then webkit for iOS
        if (el.requestFullscreen) {
          await el.requestFullscreen();
        } else if ((el as any).webkitRequestFullscreen) {
          (el as any).webkitRequestFullscreen();
        }
      }
    } catch (e) {
      console.log('Fullscreen not supported');
    }
  };

  const setSpeed = (rate: number) => {
    if (videoRef.current) videoRef.current.playbackRate = rate;
    setPlaybackRate(rate);
    setShowSettings(false);
  };

  const formatTime = (t: number) => {
    const m = Math.floor(t / 60);
    const s = Math.floor(t % 60);
    return `${m}:${s.toString().padStart(2, "0")}`;
  };

  const handleProgressClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const v = videoRef.current;
    if (!v) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = (e.clientX - rect.left) / rect.width;
    v.currentTime = pct * v.duration;
    resetHideTimer();
  };

  // Double tap handling
  const lastTap = useRef<{ time: number; x: number }>({ time: 0, x: 0 });

  const handleVideoClick = (e: React.MouseEvent | React.TouchEvent) => {
    if (locked) return;
    const now = Date.now();
    const clientX = "touches" in e ? e.changedTouches[0].clientX : e.clientX;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const relX = (clientX - rect.left) / rect.width;

    if (now - lastTap.current.time < 300) {
      // Double tap
      if (relX < 0.33) {
        seek(-10);
      } else if (relX > 0.66) {
        seek(10);
      } else {
        togglePlay();
        setSkipIndicator({ side: "center", text: playing ? "⏸" : "▶" });
        setTimeout(() => setSkipIndicator(null), 600);
      }
      lastTap.current = { time: 0, x: 0 };
    } else {
      lastTap.current = { time: now, x: clientX };
      setTimeout(() => {
        if (lastTap.current.time === now) {
          resetHideTimer();
        }
      }, 300);
    }
  };

  // Touch swipe for volume/brightness
  const handleTouchStart = (e: React.TouchEvent) => {
    const t = e.touches[0];
    setSwipeState({ startX: t.clientX, startY: t.clientY, type: null });
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!swipeState || locked) return;
    const t = e.touches[0];
    const dx = t.clientX - swipeState.startX;
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
  };

  const handleTouchEnd = () => setSwipeState(null);

  const progress = duration > 0 ? (currentTime / duration) * 100 : 0;

  return (
    <div className="fixed inset-0 z-[300] bg-background/[0.98] flex flex-col items-center overflow-y-auto" ref={containerRef}>
      {/* Close button */}
      <button onClick={onClose} className="absolute top-5 right-5 z-[310] w-10 h-10 rounded-full gradient-primary flex items-center justify-center btn-glow transition-all hover:rotate-90">
        <X className="w-5 h-5" />
      </button>

      <div className="w-full max-w-full p-5">
        {/* RS ANIME PLYER Header */}
        <div className="text-center mb-2.5">
          <h1 className="text-2xl font-extrabold text-primary text-glow tracking-wider">RS ANIME PLYER</h1>
        </div>

        {/* Anime Info */}
        <div className="text-center mb-5">
          <p className="text-lg font-semibold">{title}</p>
          {subtitle && <p className="text-sm text-secondary-foreground">{subtitle}</p>}
        </div>

        {/* Video Container */}
        <div
          ref={videoContainerRef}
          className="relative w-full bg-black rounded-xl overflow-hidden aspect-video fullscreen:!rounded-none fullscreen:!aspect-auto fullscreen:!w-screen fullscreen:!h-screen"
          style={{ filter: `brightness(${brightness})` }}
          onClick={handleVideoClick}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <video
            ref={videoRef}
            src={src}
            className="w-full h-full"
            style={{ objectFit: cropModes[cropIndex] }}
            playsInline
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
            <div className="absolute inset-0 player-controls-overlay transition-opacity duration-300 flex flex-col justify-between">
              {/* Top controls - lock + crop */}
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
                {/* Progress bar */}
                <div className="w-full h-1.5 bg-foreground/20 rounded-full cursor-pointer mb-2 relative" onClick={(e) => { e.stopPropagation(); handleProgressClick(e); }}>
                  <div className="h-full gradient-primary rounded-full transition-[width] relative" style={{ width: `${progress}%` }}>
                    <div className="absolute right-0 top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-primary shadow-[0_0_10px_hsla(355,85%,55%,0.6)]" />
                  </div>
                </div>
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-3">
                    <span className="text-[11px] font-medium">{formatTime(currentTime)} / {formatTime(duration)}</span>
                    <button onClick={(e) => { e.stopPropagation(); setMuted(!muted); if (videoRef.current) videoRef.current.muted = !muted; }} className="w-6 h-6 flex items-center justify-center">
                      {muted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-foreground/20 px-2 py-0.5 rounded">{playbackRate}x</span>
                    {onNextEpisode && (
                      <button onClick={(e) => { e.stopPropagation(); onNextEpisode(); }} className="text-[10px] bg-primary/30 px-2 py-0.5 rounded flex items-center gap-1">
                        Next <ChevronRight className="w-3 h-3" />
                      </button>
                    )}
                    <button onClick={(e) => { e.stopPropagation(); setShowSettings(!showSettings); }} className="player-glass w-7 h-7 rounded-full flex items-center justify-center">
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

          {/* Locked indicator - top right, auto-hides */}
          {locked && showControls && (
            <div className="absolute top-3 right-3 z-20" onClick={(e) => e.stopPropagation()}>
              <button onClick={() => { setLocked(false); resetHideTimer(); }} className="player-glass w-10 h-10 rounded-full flex items-center justify-center">
                <Unlock className="w-4 h-4 text-primary" />
              </button>
            </div>
          )}
          {/* Tap area when locked to show unlock button */}
          {locked && !showControls && (
            <div className="absolute inset-0" onClick={(e) => { e.stopPropagation(); resetHideTimer(); }} />
          )}

          {/* Settings panel */}
          {showSettings && (
            <div className="absolute top-12 right-3 player-glass rounded-xl p-3 z-20 min-w-[140px]" onClick={(e) => e.stopPropagation()}>
              <p className="text-[10px] text-muted-foreground mb-2 uppercase tracking-wider">Speed</p>
              {[0.5, 0.75, 1, 1.25, 1.5, 2].map((r) => (
                <button key={r} onClick={() => setSpeed(r)} className={`block w-full text-left px-3 py-1.5 rounded text-xs transition-all ${playbackRate === r ? "gradient-primary font-bold" : "hover:bg-foreground/10"}`}>
                  {r}x {r === 1 && "(Normal)"}
                </button>
              ))}
            </div>
          )}
        </div>

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

export default VideoPlayer;

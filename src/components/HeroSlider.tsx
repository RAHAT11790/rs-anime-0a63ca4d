import { useState, useEffect, useRef, useCallback } from "react";
import { Play, Info, Star } from "lucide-react";
import { getAnimeTitleStyle } from "@/lib/animeFonts";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";

interface HeroSlide {
  id: string;
  title: string;
  backdrop: string;
  subtitle: string;
  rating: string;
  year: string;
  type: string;
}

interface HeroSliderProps {
  slides: HeroSlide[];
  onPlay: (index: number) => void;
  onInfo: (index: number) => void;
}

const slideVariants = {
  enter: (dir: number) => ({
    x: dir > 0 ? "100%" : "-100%",
    opacity: 0,
    scale: 1.08,
  }),
  center: {
    x: 0,
    opacity: 1,
    scale: 1,
    transition: { duration: 0.6, ease: [0.25, 0.46, 0.45, 0.94] },
  },
  exit: (dir: number) => ({
    x: dir > 0 ? "-40%" : "40%",
    opacity: 0,
    scale: 0.95,
    transition: { duration: 0.5, ease: [0.25, 0.46, 0.45, 0.94] },
  }),
};

const textVariants = {
  enter: { opacity: 0, y: 30, filter: "blur(8px)" },
  center: {
    opacity: 1, y: 0, filter: "blur(0px)",
    transition: { duration: 0.5, delay: 0.25, ease: "easeOut" },
  },
  exit: {
    opacity: 0, y: -20, filter: "blur(4px)",
    transition: { duration: 0.3, ease: "easeIn" },
  },
};

const badgeVariants = {
  enter: { opacity: 0, scale: 0.7 },
  center: (i: number) => ({
    opacity: 1, scale: 1,
    transition: { duration: 0.35, delay: 0.35 + i * 0.08, ease: "easeOut" },
  }),
  exit: { opacity: 0, scale: 0.8, transition: { duration: 0.2 } },
};

const buttonVariants = {
  enter: { opacity: 0, y: 20 },
  center: (i: number) => ({
    opacity: 1, y: 0,
    transition: { duration: 0.4, delay: 0.45 + i * 0.1, ease: "easeOut" },
  }),
  exit: { opacity: 0, y: 10, transition: { duration: 0.2 } },
};

const HeroSlider = ({ slides, onPlay, onInfo }: HeroSliderProps) => {
  const [[current, direction], setSlide] = useState([0, 1]);
  const autoTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const resetAutoPlay = useCallback(() => {
    if (autoTimer.current) clearInterval(autoTimer.current);
    if (slides.length <= 1) return;
    autoTimer.current = setInterval(() => {
      setSlide(([c]) => [(c + 1) % slides.length, 1]);
    }, 6000);
  }, [slides.length]);

  useEffect(() => {
    if (slides.length === 0) return;
    resetAutoPlay();
    return () => { if (autoTimer.current) clearInterval(autoTimer.current); };
  }, [slides.length, resetAutoPlay]);

  useEffect(() => {
    if (slides.length > 0 && current >= slides.length) {
      setSlide([0, 1]);
    }
  }, [slides.length, current]);

  const goTo = useCallback((idx: number, dir: number) => {
    setSlide([idx, dir]);
    resetAutoPlay();
  }, [resetAutoPlay]);

  const handleDragEnd = (_: any, info: PanInfo) => {
    const threshold = 50;
    const velocity = info.velocity.x;
    const offset = info.offset.x;

    if (offset < -threshold || velocity < -300) {
      goTo((current + 1) % slides.length, 1);
    } else if (offset > threshold || velocity > 300) {
      goTo((current - 1 + slides.length) % slides.length, -1);
    }
  };

  if (slides.length === 0) {
    return (
      <div className="relative w-full h-[50vh] min-h-[380px] bg-card flex items-center justify-center">
        <p className="text-muted-foreground">No content available</p>
      </div>
    );
  }

  const slide = slides[current];
  if (!slide) return null;

  return (
    <div className="relative w-full h-[50vh] min-h-[380px] overflow-hidden">
      {/* Background images with AnimatePresence */}
      <AnimatePresence initial={false} custom={direction} mode="popLayout">
        <motion.div
          key={slide.id + current}
          custom={direction}
          variants={slideVariants}
          initial="enter"
          animate="center"
          exit="exit"
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          dragElastic={0.12}
          onDragEnd={handleDragEnd}
          className="absolute inset-0 cursor-grab active:cursor-grabbing"
          style={{ touchAction: "pan-y" }}
        >
          <img src={slide.backdrop} alt={slide.title} className="w-full h-full object-cover" draggable={false} />
        </motion.div>
      </AnimatePresence>

      {/* Gradient overlays */}
      <div className="absolute inset-0 pointer-events-none" style={{
        background: "linear-gradient(to top, hsl(240 20% 6%) 0%, rgba(0,0,0,0.3) 40%, transparent 60%), linear-gradient(to bottom, rgba(0,0,0,0.6) 0%, transparent 25%)"
      }} />

      {/* Content */}
      <div className="absolute bottom-[90px] left-0 right-0 px-5 text-center z-10">
        <AnimatePresence mode="wait">
          <motion.div key={slide.id + "content"} className="space-y-1.5">
            {/* Title */}
            <motion.h1
              variants={textVariants}
              initial="enter"
              animate="center"
              exit="exit"
              className="text-2xl font-extrabold mb-2.5 tracking-tight line-clamp-2"
              style={{ ...getAnimeTitleStyle(slide.title), textShadow: "0 4px 30px rgba(0,0,0,0.9)" }}
            >
              {slide.title}
            </motion.h1>

            {/* Badges */}
            <motion.div className="flex items-center justify-center gap-2.5 text-xs text-secondary-foreground flex-wrap mb-1.5">
              <motion.span custom={0} variants={badgeVariants} initial="enter" animate="center" exit="exit"
                className="bg-accent px-2.5 py-1 rounded text-[11px] font-semibold text-accent-foreground shadow-[0_2px_10px_hsla(38,90%,55%,0.4)] flex items-center gap-1">
                <Star className="w-3 h-3" /> {slide.rating}
              </motion.span>
              <motion.span custom={1} variants={badgeVariants} initial="enter" animate="center" exit="exit">
                {slide.year}
              </motion.span>
              <motion.span custom={2} variants={badgeVariants} initial="enter" animate="center" exit="exit"
                className="bg-primary/20 text-primary px-2.5 py-1 rounded text-[10px] font-semibold backdrop-blur-[10px]">
                {slide.type === "webseries" ? "Series" : "Movie"}
              </motion.span>
            </motion.div>

            {/* Buttons */}
            <div className="flex justify-center gap-3 mt-4">
              <motion.button custom={0} variants={buttonVariants} initial="enter" animate="center" exit="exit"
                onClick={() => onPlay(current)}
                className="gradient-primary text-primary-foreground px-7 py-3 rounded-xl font-bold text-sm flex items-center gap-2 transition-all hover:scale-105 btn-glow"
                whileTap={{ scale: 0.95 }}
              >
                <Play className="w-4 h-4" /> Play Now
              </motion.button>
              <motion.button custom={1} variants={buttonVariants} initial="enter" animate="center" exit="exit"
                onClick={() => onInfo(current)}
                className="bg-foreground/15 text-foreground px-7 py-3 rounded-xl font-semibold text-sm flex items-center gap-2 border border-foreground/20 backdrop-blur-[20px] transition-all hover:bg-foreground/25 hover:scale-105"
                whileTap={{ scale: 0.95 }}
              >
                <Info className="w-4 h-4" /> Details
              </motion.button>
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Indicators */}
      <div className="absolute bottom-6 left-1/2 -translate-x-1/2 flex gap-2 z-10">
        {slides.map((_, i) => (
          <button
            key={i}
            onClick={() => goTo(i, i > current ? 1 : -1)}
            className="relative h-2 rounded-full overflow-hidden transition-all duration-500"
            style={{ width: i === current ? 28 : 8 }}
          >
            <div className={`absolute inset-0 rounded-full ${i === current ? "gradient-primary shadow-[0_0_15px_hsla(176,65%,48%,0.4)]" : "bg-foreground/40"}`} />
            {i === current && (
              <motion.div
                className="absolute inset-0 rounded-full bg-foreground/30"
                initial={{ scaleX: 0, originX: 0 }}
                animate={{ scaleX: 1 }}
                transition={{ duration: 6, ease: "linear" }}
                key={`progress-${current}`}
              />
            )}
          </button>
        ))}
      </div>
    </div>
  );
};

export default HeroSlider;

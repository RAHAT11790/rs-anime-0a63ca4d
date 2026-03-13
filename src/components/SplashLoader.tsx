import logoImg from "@/assets/logo.png";

const SplashLoader = () => {
  return (
    <div className="fixed inset-0 bg-background flex flex-col items-center justify-center z-[9999]">
      {/* Glow background */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-[300px] rounded-full opacity-20"
          style={{
            background: "radial-gradient(circle, hsl(var(--primary)) 0%, transparent 70%)",
            animation: "logoPulse 3s ease-in-out infinite",
          }}
        />
      </div>

      {/* Logo image */}
      <img
        src={logoImg}
        alt="RS Anime"
        className="w-28 h-28 object-contain mb-5 relative z-10"
        style={{
          filter: "drop-shadow(0 0 40px hsla(176,65%,48%,0.6))",
          animation: "logoPulse 2s ease-in-out infinite",
        }}
      />

      {/* Brand name */}
      <div
        className="text-2xl font-black tracking-[6px] uppercase relative z-10"
        style={{
          fontFamily: "'Russo One', sans-serif",
          background: "linear-gradient(135deg, hsl(var(--primary)), hsl(var(--accent)))",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 0 20px hsla(176,65%,48%,0.4))",
        }}
      >
        RS ANIME
      </div>

      <p className="mt-3 text-[10px] text-muted-foreground uppercase tracking-[5px] relative z-10">
        Loading...
      </p>

      {/* Progress bar */}
      <div className="mt-5 w-[160px] h-[3px] bg-secondary rounded-full overflow-hidden relative z-10">
        <div className="absolute h-full w-[40%] bg-gradient-to-r from-transparent via-primary to-transparent animate-[loadingMove_1s_ease-in-out_infinite]" />
      </div>
    </div>
  );
};

export default SplashLoader;

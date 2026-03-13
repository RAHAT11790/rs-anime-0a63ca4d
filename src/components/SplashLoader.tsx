import { useEffect, useRef } from "react";
import logoImg from "@/assets/logo.png";
import { supabase } from "@/integrations/supabase/client";

const SplashLoader = () => {
  const audioPlayed = useRef(false);

  useEffect(() => {
    if (audioPlayed.current) return;
    audioPlayed.current = true;

    // Play AI welcome voice
    const playWelcome = async () => {
      try {
        const response = await fetch(
          `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/welcome-tts`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              apikey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
              Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
            },
            body: JSON.stringify({ text: "Welcome to RS Anime!" }),
          }
        );

        if (!response.ok) throw new Error("TTS failed");

        const audioBlob = await response.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        audio.volume = 0.8;
        await audio.play().catch(() => {});
      } catch {
        // Fallback: use browser speechSynthesis
        try {
          if ("speechSynthesis" in window) {
            const utter = new SpeechSynthesisUtterance("Welcome to RS Anime!");
            utter.rate = 0.95;
            utter.pitch = 1.3; // anime-style higher pitch
            utter.volume = 0.8;
            // Try to pick a female English voice for anime feel
            const voices = speechSynthesis.getVoices();
            const preferred = voices.find(
              (v) => v.lang.startsWith("en") && v.name.toLowerCase().includes("female")
            ) || voices.find((v) => v.lang.startsWith("en"));
            if (preferred) utter.voice = preferred;
            speechSynthesis.speak(utter);
          }
        } catch {}
      }
    };

    // Small delay to let the UI render first
    const timer = setTimeout(playWelcome, 300);
    return () => clearTimeout(timer);
  }, []);

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

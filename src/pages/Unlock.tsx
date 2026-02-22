import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { db, ref, set, remove } from "@/lib/firebase";

const Unlock = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // Grant 24 hours access
    const expiry = Date.now() + 24 * 60 * 60 * 1000;
    localStorage.setItem("rsanime_ad_access", expiry.toString());

    // Save free access user info to Firebase
    try {
      const userStr = localStorage.getItem("rsanime_user");
      if (userStr) {
        const user = JSON.parse(userStr);
        const userId = user.id;
        if (userId) {
          const accessData = {
            userId,
            name: user.name || "Unknown",
            email: user.email || "",
            unlockedAt: Date.now(),
            expiresAt: expiry,
          };
          set(ref(db, `freeAccessUsers/${userId}`), accessData).catch(() => {});

          // Auto-remove after 24 hours
          setTimeout(() => {
            remove(ref(db, `freeAccessUsers/${userId}`)).catch(() => {});
          }, 24 * 60 * 60 * 1000);
        }
      }
    } catch {}

    // Redirect to home after short delay
    setTimeout(() => {
      navigate("/", { replace: true });
    }, 1500);
  }, [navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="bg-card rounded-2xl p-8 max-w-sm w-[90%] text-center space-y-4 shadow-2xl border border-border">
        <div className="w-16 h-16 mx-auto rounded-full gradient-primary flex items-center justify-center">
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-foreground">Access Unlocked!</h2>
        <p className="text-sm text-muted-foreground">
          You now have 24 hours of free access to all videos.
        </p>
        <p className="text-xs text-muted-foreground animate-pulse">Redirecting...</p>
      </div>
    </div>
  );
};

export default Unlock;

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { db, ref, set, remove } from "@/lib/firebase";

const Unlock = () => {
  const navigate = useNavigate();

  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const doUnlock = async () => {
      // Grant 24 hours access
      const expiry = Date.now() + 24 * 60 * 60 * 1000;
      localStorage.setItem("rsanime_ad_access", expiry.toString());

      // Save free access user info to Firebase
      try {
        const userStr = localStorage.getItem("rsanime_user");
        if (userStr) {
          const user = JSON.parse(userStr);
          // Try multiple possible ID fields
          const userId = user.id || user.uid || user.username || user.email?.replace(/[.@]/g, "_");
          if (userId) {
            setSaving(true);
            const accessData = {
              userId,
              name: user.name || user.username || "Unknown",
              email: user.email || "",
              unlockedAt: Date.now(),
              expiresAt: expiry,
            };
            console.log("Saving free access for user:", userId, accessData);
            await set(ref(db, `freeAccessUsers/${userId}`), accessData);
            console.log("Free access saved successfully for:", userId);
            setSaving(false);
          } else {
            // Fallback: save with a random ID
            const fallbackId = "user_" + Date.now();
            const accessData = {
              userId: fallbackId,
              name: user.name || user.username || "Unknown",
              email: user.email || "",
              unlockedAt: Date.now(),
              expiresAt: expiry,
            };
            console.log("Saving free access with fallback ID:", fallbackId);
            await set(ref(db, `freeAccessUsers/${fallbackId}`), accessData);
            console.log("Free access saved with fallback ID");
          }
        } else {
          // No user data at all - still save with timestamp ID
          const anonId = "anon_" + Date.now();
          const accessData = {
            userId: anonId,
            name: "Anonymous",
            email: "",
            unlockedAt: Date.now(),
            expiresAt: expiry,
          };
          console.log("Saving anonymous free access:", anonId);
          await set(ref(db, `freeAccessUsers/${anonId}`), accessData);
        }
      } catch (err) {
        console.error("Failed to save free access:", err);
      }

      // Redirect to home after short delay
      setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
    };

    doUnlock();
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

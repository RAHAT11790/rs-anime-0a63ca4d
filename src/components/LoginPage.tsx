import { useState } from "react";
import { motion } from "framer-motion";
import { User, Lock, Eye, EyeOff, LogIn } from "lucide-react";
import logoImg from "@/assets/logo.png";
import { db, ref, set, get } from "@/lib/firebase";
import { toast } from "sonner";

interface LoginPageProps {
  onLogin: (userId: string) => void;
}

const LoginPage = ({ onLogin }: LoginPageProps) => {
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !password.trim()) {
      toast.error("Please fill in all fields");
      return;
    }
    if (password.length < 4) {
      toast.error("Password must be at least 4 characters");
      return;
    }

    setLoading(true);
    try {
      const input = name.trim();
      const inputLower = input.toLowerCase();
      
      // Try multiple key formats for Firebase keys
      const commaKey = inputLower.replace(/\./g, ",").replace(/[^a-z0-9@,_-]/g, "_");
      const legacyKey = inputLower.replace(/[^a-z0-9]/g, "_");
      const dotKey = inputLower.replace(/[^a-z0-9@._-]/g, "_");
      
      
      
      let finalUserData: any = null;
      let finalUserId: string = "";
      
      // Search in both 'appUsers' and 'users' nodes
      const nodesToSearch = ['appUsers', 'users'];
      const keysToTry = [...new Set([commaKey, legacyKey, dotKey])];
      
      // Collect all matching records across nodes
      const allMatches: any[] = [];
      
      for (const node of nodesToSearch) {
        for (const keyAttempt of keysToTry) {
          try {
            const kRef = ref(db, `${node}/${keyAttempt}`);
            const kSnap = await get(kRef);
            if (kSnap.exists()) {
              allMatches.push({ node, key: keyAttempt, data: kSnap.val() });
            }
          } catch (e: any) {}
        }
      }
      
      // If no direct key match, search all records by name/email fields
      if (allMatches.length === 0 && !isRegister) {
        for (const node of nodesToSearch) {
          try {
            const allRef = ref(db, node);
            const allSnap = await get(allRef);
            if (allSnap.exists()) {
              const allData = allSnap.val();
              for (const key of Object.keys(allData)) {
                const u = allData[key];
                if (u && typeof u === 'object') {
                  const nameMatch = u.name && u.name.toLowerCase() === inputLower;
                  const emailMatch = u.email && u.email.toLowerCase() === inputLower;
                  if (nameMatch || emailMatch) {
                    allMatches.push({ node, key, data: u });
                  }
                }
              }
            }
          } catch (e: any) {}
        }
      }
      
      
      
      // Find the record with password for verification
      const withPassword = allMatches.find(m => m.data?.password);
      // Find the record with user id
      const withId = allMatches.find(m => m.data?.id);
      // Use any match for user info
      const anyMatch = allMatches[0];
      
      // Merge data: get password from wherever it exists, get id from wherever it exists
      if (anyMatch) {
        finalUserData = { ...anyMatch.data };
        if (withPassword) finalUserData.password = withPassword.data.password;
        if (withId) finalUserData.id = withId.data.id;
        if (!finalUserData.name && anyMatch.data.name) finalUserData.name = anyMatch.data.name;
        finalUserId = finalUserData.id || "";
      }

      if (isRegister) {
        if (anyMatch) {
          toast.error("Username already taken!");
          setLoading(false);
          return;
        }
        const userId = "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await set(ref(db, `appUsers/${commaKey}`), {
          id: userId,
          name: name.trim(),
          password: password,
          createdAt: Date.now(),
        });
        await set(ref(db, `users/${commaKey}`), {
          name: name.trim(),
          createdAt: Date.now(),
          online: true,
          lastSeen: Date.now(),
          id: userId,
        });
        localStorage.setItem("rsanime_user", JSON.stringify({ id: userId, name: name.trim() }));
        localStorage.setItem("rs_display_name", name.trim());
        toast.success("Account created successfully!");
        onLogin(userId);
      } else {
        if (!anyMatch) {
          toast.error("User not found!");
          setLoading(false);
          return;
        }
        if (finalUserData.password && finalUserData.password !== password) {
          toast.error("Wrong password!");
          setLoading(false);
          return;
        }
        if (!finalUserData.password) {
          // Legacy user without password - save password for future logins
          try {
            await set(ref(db, `appUsers/${commaKey}`), {
              id: finalUserId || commaKey,
              name: finalUserData.name || input,
              password: password,
              createdAt: finalUserData.createdAt || Date.now(),
            });
          } catch (e) {}
        }
        const displayName = finalUserData.name || input;
        const uid = finalUserId || commaKey;
        localStorage.setItem("rsanime_user", JSON.stringify({ id: uid, name: displayName }));
        localStorage.setItem("rs_display_name", displayName);
        try {
          await set(ref(db, `users/${uid}/online`), true);
          await set(ref(db, `users/${uid}/lastSeen`), Date.now());
        } catch (e) {}
        toast.success(`Welcome back, ${displayName}!`);
        onLogin(uid);
      }
    } catch (err: any) {
      toast.error("Error: " + err.message);
    }
    setLoading(false);
  };

  return (
    <motion.div
      className="fixed inset-0 z-[9999] bg-background flex flex-col items-center justify-center px-6"
      initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
    >
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-20%] left-[-10%] w-[60%] h-[60%] rounded-full bg-primary/5 blur-[100px]" />
        <div className="absolute bottom-[-20%] right-[-10%] w-[60%] h-[60%] rounded-full bg-accent/5 blur-[100px]" />
      </div>

      <motion.div
        className="relative z-10 w-full max-w-[340px]"
        initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ delay: 0.2 }}
      >
        <div className="text-center mb-8">
          <img src={logoImg} alt="RS ANIME" className="w-16 h-16 mx-auto mb-4 rounded-2xl shadow-[0_10px_40px_hsla(355,85%,55%,0.4)]" />
          <h1 className="text-3xl font-extrabold text-primary text-glow">RS ANIME</h1>
          <p className="text-xs text-muted-foreground mt-1">Unlimited Anime Series & Movies</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Username"
              value={name}
              onChange={e => setName(e.target.value)}
              maxLength={50}
              className="w-full py-3 pl-10 pr-4 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.3)] transition-all placeholder:text-muted-foreground"
            />
          </div>
          <div className="relative">
            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input
              type={showPassword ? "text" : "password"}
              placeholder="Password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              className="w-full py-3 pl-10 pr-10 rounded-xl bg-foreground/10 border border-foreground/10 text-foreground text-sm focus:border-primary focus:outline-none focus:shadow-[0_0_20px_hsla(355,85%,55%,0.3)] transition-all placeholder:text-muted-foreground"
            />
            <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2">
              {showPassword ? <EyeOff className="w-4 h-4 text-muted-foreground" /> : <Eye className="w-4 h-4 text-muted-foreground" />}
            </button>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 rounded-xl gradient-primary text-primary-foreground font-bold text-sm flex items-center justify-center gap-2 btn-glow disabled:opacity-50 transition-all"
          >
            {loading ? (
              <span className="animate-spin w-4 h-4 border-2 border-white/30 border-t-white rounded-full" />
            ) : (
              <><LogIn className="w-4 h-4" /> {isRegister ? "Create Account" : "Login"}</>
            )}
          </button>
        </form>

        <p className="text-center text-xs text-muted-foreground mt-5">
          {isRegister ? "Already have an account?" : "Don't have an account?"}{" "}
          <button onClick={() => setIsRegister(!isRegister)} className="text-primary font-semibold hover:underline">
            {isRegister ? "Login" : "Register"}
          </button>
        </p>
      </motion.div>
    </motion.div>
  );
};

export default LoginPage;

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
      const usernameKey = name.trim().toLowerCase().replace(/[^a-z0-9]/g, "_");
      const userRef = ref(db, `appUsers/${usernameKey}`);
      const snap = await get(userRef);

      if (isRegister) {
        if (snap.exists()) {
          toast.error("Username already taken!");
          setLoading(false);
          return;
        }
        const userId = "user_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
        await set(userRef, {
          id: userId,
          name: name.trim(),
          password: password,
          createdAt: Date.now(),
        });
        await set(ref(db, `users/${userId}`), {
          name: name.trim(),
          createdAt: Date.now(),
          online: true,
          lastSeen: Date.now(),
        });
        localStorage.setItem("rsanime_user", JSON.stringify({ id: userId, name: name.trim() }));
        localStorage.setItem("rs_display_name", name.trim());
        toast.success("Account created successfully!");
        onLogin(userId);
      } else {
        if (!snap.exists()) {
          toast.error("User not found!");
          setLoading(false);
          return;
        }
        const userData = snap.val();
        if (userData.password !== password) {
          toast.error("Wrong password!");
          setLoading(false);
          return;
        }
        localStorage.setItem("rsanime_user", JSON.stringify({ id: userData.id, name: userData.name }));
        localStorage.setItem("rs_display_name", userData.name);
        await set(ref(db, `users/${userData.id}/online`), true);
        await set(ref(db, `users/${userData.id}/lastSeen`), Date.now());
        toast.success(`Welcome back, ${userData.name}!`);
        onLogin(userData.id);
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
              maxLength={20}
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

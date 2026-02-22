import { useState, useEffect, useRef, useCallback } from "react";
import { db, ref, onValue, push, set, remove, update, get, auth, signInWithEmailAndPassword, signOut } from "@/lib/firebase";
import { toast } from "sonner";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard, FolderOpen, Film, Video, Users, Bell, Zap, PlusCircle, CloudDownload,
  Menu, X, MoreVertical, RefreshCw, Plus, Download, Trash2, Edit, Eye, EyeOff,
  Shield, LogOut, Search, Save, ChevronDown, Send, Link, ChevronLeft, ChevronRight,
  Lock, KeyRound, AlertTriangle, Power
} from "lucide-react";

const TMDB_API_KEY = "37f4b185e3dc487e4fd3e56e2fab2307";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const TMDB_IMG_BASE = "https://image.tmdb.org/t/p/";

type Section = "dashboard" | "categories" | "webseries" | "movies" | "users" | "notifications" | "new-releases" | "tmdb-fetch" | "add-content" | "redeem-codes" | "maintenance" | "free-access";

interface CastMember {
  name: string;
  character?: string;
  photo: string;
}

interface Episode {
  episodeNumber: number;
  title: string;
  link: string;
  link480?: string;
  link720?: string;
  link1080?: string;
  link4k?: string;
}

interface Season {
  name: string;
  seasonNumber: number;
  episodes: Episode[];
}

const Admin = () => {
  // Auth states
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isPinVerified, setIsPinVerified] = useState(false);
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");
  const [loginLoading, setLoginLoading] = useState(false);
  const [pinInput, setPinInput] = useState("");
  const [pinEnabled, setPinEnabled] = useState(false);
  const [savedPin, setSavedPin] = useState("");
  const [showPinSetup, setShowPinSetup] = useState(false);
  const [newPinInput, setNewPinInput] = useState("");

  const [activeSection, setActiveSection] = useState<Section>("dashboard");
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [firebaseConnected, setFirebaseConnected] = useState(false);
  const [fetchingOverlay, setFetchingOverlay] = useState(false);

  // Data state
  const [categoriesData, setCategoriesData] = useState<Record<string, any>>({});
  const [webseriesData, setWebseriesData] = useState<any[]>([]);
  const [moviesData, setMoviesData] = useState<any[]>([]);
  const [usersData, setUsersData] = useState<any[]>([]);
  const [notificationsData, setNotificationsData] = useState<any[]>([]);
  const [releasesData, setReleasesData] = useState<any[]>([]);

  // Form states
  const [categoryInput, setCategoryInput] = useState("");
  const [seriesTab, setSeriesTab] = useState<"ws-list" | "ws-add">("ws-list");
  const [moviesTab, setMoviesTab] = useState<"mv-list" | "mv-add">("mv-list");
  const [fetchType, setFetchType] = useState<"movie" | "tv">("movie");
  const [quickTmdbId, setQuickTmdbId] = useState("");

  // Series form
  const [seriesForm, setSeriesForm] = useState<any>(null);
  const [seriesCast, setSeriesCast] = useState<CastMember[]>([]);
  const [seasonsData, setSeasonsData] = useState<Season[]>([]);
  const [seriesSearch, setSeriesSearch] = useState("");
  const [seriesResults, setSeriesResults] = useState<any[]>([]);
  const [seriesEditId, setSeriesEditId] = useState("");

  // Movie form
  const [movieForm, setMovieForm] = useState<any>(null);
  const [movieCast, setMovieCast] = useState<CastMember[]>([]);
  const [movieSearch, setMovieSearch] = useState("");
  const [movieResults, setMovieResults] = useState<any[]>([]);
  const [movieEditId, setMovieEditId] = useState("");

  // Notification form
  const [notifTitle, setNotifTitle] = useState("");
  const [notifMessage, setNotifMessage] = useState("");
  const [notifContent, setNotifContent] = useState("");
  const [notifType, setNotifType] = useState("info");
  const [notifTarget, setNotifTarget] = useState("all");
  const [contentOptions, setContentOptions] = useState<{ value: string; label: string }[]>([]);

  // New release form
  const [releaseContent, setReleaseContent] = useState("");
  const [releaseSeason, setReleaseSeason] = useState("");
  const [releaseEpisode, setReleaseEpisode] = useState("");
  const [releaseSeasons, setReleaseSeasons] = useState<any[]>([]);
  const [releaseEpisodes, setReleaseEpisodes] = useState<any[]>([]);
  const [showSeasonEpisode, setShowSeasonEpisode] = useState(false);

  // Redeem code state
  const [redeemCodesData, setRedeemCodesData] = useState<any[]>([]);
  const [newCodeDays, setNewCodeDays] = useState("30");
  const [newCodeNote, setNewCodeNote] = useState("");

  // Free access users state
  const [freeAccessUsers, setFreeAccessUsers] = useState<any[]>([]);

  // Maintenance state
  const [maintenanceActive, setMaintenanceActive] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("Server is under maintenance. Please wait.");
  const [maintenanceResumeDate, setMaintenanceResumeDate] = useState("");
  const [currentMaintenance, setCurrentMaintenance] = useState<any>(null);

  // Expanded episodes
  const [expandedSeasons, setExpandedSeasons] = useState<Record<number, boolean>>({});

  // Firebase connection check
  useEffect(() => {
    const connRef = ref(db, ".info/connected");
    const unsub = onValue(connRef, (snap) => {
      setFirebaseConnected(snap.val() === true);
    });
    return () => unsub();
  }, []);

  // Check Firebase Auth state
  useEffect(() => {
    const unsub = auth.onAuthStateChanged((user) => {
      if (user && user.email === "rahatsarker224@gmail.com") {
        setIsAuthenticated(true);
      } else {
        setIsAuthenticated(false);
      }
    });
    return () => unsub();
  }, []);

  // Load PIN settings
  useEffect(() => {
    const unsub = onValue(ref(db, "admin/pin"), (snap) => {
      const data = snap.val();
      if (data && data.enabled && data.code) {
        setPinEnabled(true);
        setSavedPin(data.code);
      } else {
        setPinEnabled(false);
        setSavedPin("");
        setIsPinVerified(true); // No pin = auto verified
      }
    });
    return () => unsub();
  }, []);

  // Load all data
  useEffect(() => {
    const unsubs: (() => void)[] = [];

    unsubs.push(onValue(ref(db, "categories"), (snap) => {
      setCategoriesData(snap.val() || {});
    }));

    unsubs.push(onValue(ref(db, "webseries"), (snap) => {
      const data = snap.val() || {};
      setWebseriesData(Object.entries(data).map(([id, item]: any) => ({ id, ...item })));
    }));

    unsubs.push(onValue(ref(db, "movies"), (snap) => {
      const data = snap.val() || {};
      setMoviesData(Object.entries(data).map(([id, item]: any) => ({ id, ...item })));
    }));

    unsubs.push(onValue(ref(db, "users"), (snap) => {
      const data = snap.val() || {};
      setUsersData(Object.entries(data).map(([id, user]: any) => ({ id, ...user })));
    }));

    unsubs.push(onValue(ref(db, "notifications"), (snap) => {
      const data = snap.val() || {};
      const allNotifs: any[] = [];
      Object.entries(data).forEach(([uid, userNotifs]: any) => {
        Object.entries(userNotifs || {}).forEach(([notifId, notif]: any) => {
          allNotifs.push({ ...notif, id: notifId, oderId: uid, userId: uid });
        });
      });
      allNotifs.sort((a, b) => b.timestamp - a.timestamp);
      setNotificationsData(allNotifs);
    }));

    unsubs.push(onValue(ref(db, "newEpisodeReleases"), (snap) => {
      const data = snap.val() || {};
      const arr = Object.entries(data).map(([id, r]: any) => ({ id, ...r }));
      arr.sort((a, b) => b.timestamp - a.timestamp);
      setReleasesData(arr);
    }));

    unsubs.push(onValue(ref(db, "redeemCodes"), (snap) => {
      const data = snap.val() || {};
      setRedeemCodesData(Object.entries(data).map(([id, item]: any) => ({ id, ...item })));
    }));

    unsubs.push(onValue(ref(db, "maintenance"), (snap) => {
      setCurrentMaintenance(snap.val());
      if (snap.val()?.active) setMaintenanceActive(true);
      else setMaintenanceActive(false);
    }));

    unsubs.push(onValue(ref(db, "freeAccessUsers"), (snap) => {
      const data = snap.val() || {};
      const now = Date.now();
      const activeUsers: any[] = [];
      Object.entries(data).forEach(([id, user]: [string, any]) => {
        if (user.expiresAt > now) {
          activeUsers.push({ id, ...user });
        } else {
          // Auto-cleanup expired entries
          remove(ref(db, `freeAccessUsers/${id}`)).catch(() => {});
        }
      });
      activeUsers.sort((a, b) => b.unlockedAt - a.unlockedAt);
      setFreeAccessUsers(activeUsers);
    }));

    return () => unsubs.forEach(u => u());
  }, []);

  // Build content options for notifications/releases
  useEffect(() => {
    const options: { value: string; label: string }[] = [];
    webseriesData.forEach(s => options.push({ value: `${s.id}|webseries`, label: `Series: ${s.title}` }));
    moviesData.forEach(m => options.push({ value: `${m.id}|movie`, label: `Movie: ${m.title}` }));
    setContentOptions(options);
  }, [webseriesData, moviesData]);

  const showSection = (section: Section) => {
    setActiveSection(section);
    setSidebarOpen(false);
    setDropdownOpen(false);
  };

  const formatTime = (ts: number) => {
    if (!ts) return "";
    const diff = Date.now() - ts;
    if (diff < 60000) return "Just now";
    if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
    if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
    if (diff < 604800000) return `${Math.floor(diff / 86400000)}d ago`;
    return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric" });
  };

  const sectionTitles: Record<Section, string> = {
    dashboard: "Dashboard",
    categories: "Categories",
    webseries: "Web Series",
    movies: "Movies",
    users: "Users",
    notifications: "Notifications",
    "new-releases": "New Releases",
    "tmdb-fetch": "TMDB Fetch",
    "add-content": "Add Content",
    "redeem-codes": "Redeem Codes",
    maintenance: "Server Maintenance",
    "free-access": "Free Access Users",
  };

  // ==================== CATEGORIES ====================
  const saveCategory = () => {
    if (!categoryInput.trim()) { toast.error("Please enter category name"); return; }
    push(ref(db, "categories"), { name: categoryInput.trim(), createdAt: Date.now() })
      .then(() => { toast.success("Category saved!"); setCategoryInput(""); })
      .catch(err => toast.error("Error: " + err.message));
  };

  const editCategory = (id: string, oldName: string) => {
    const newName = prompt("Edit category name:", oldName);
    if (newName && newName.trim() && newName !== oldName) {
      update(ref(db, `categories/${id}`), { name: newName.trim(), updatedAt: Date.now() })
        .then(() => toast.success("Category updated!"))
        .catch(err => toast.error("Error: " + err.message));
    }
  };

  const deleteCategory = (id: string) => {
    if (confirm("Delete this category?")) {
      remove(ref(db, `categories/${id}`))
        .then(() => toast.success("Category deleted!"))
        .catch(err => toast.error("Error: " + err.message));
    }
  };

  // ==================== TMDB SEARCH ====================
  const searchTMDBSeries = async () => {
    if (!seriesSearch.trim()) { toast.error("Please enter search query"); return; }
    setFetchingOverlay(true);
    try {
      const res = await fetch(`${TMDB_BASE_URL}/search/tv?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(seriesSearch)}`);
      const data = await res.json();
      if (data.results?.length > 0) {
        setSeriesResults(data.results.slice(0, 9));
      } else {
        toast.error("No results found");
      }
    } catch { toast.error("Error searching TMDB"); }
    finally { setFetchingOverlay(false); }
  };

  const fetchSeriesDetails = async (id: number) => {
    setFetchingOverlay(true);
    try {
      const res = await fetch(`${TMDB_BASE_URL}/tv/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,images`);
      const data = await res.json();
      if (data.success === false) throw new Error("Not found");

      let trailerUrl = "";
      if (data.videos?.results) {
        const trailer = data.videos.results.find((v: any) => v.type === "Trailer" && v.site === "YouTube");
        if (trailer) trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
      }
      let logoUrl = "";
      if (data.images?.logos?.length > 0) {
        const logo = data.images.logos.find((l: any) => l.iso_639_1 === "en") || data.images.logos[0];
        logoUrl = TMDB_IMG_BASE + "w500" + logo.file_path;
      }
      const cast = data.credits?.cast?.slice(0, 10).map((c: any) => ({
        name: c.name, character: c.character, photo: c.profile_path ? TMDB_IMG_BASE + "w185" + c.profile_path : ""
      })) || [];

      setSeriesForm({
        tmdbId: data.id, title: data.name || "", logo: logoUrl, poster: data.poster_path ? TMDB_IMG_BASE + "original" + data.poster_path : "",
        backdrop: data.backdrop_path ? TMDB_IMG_BASE + "original" + data.backdrop_path : "", trailer: trailerUrl,
        year: data.first_air_date?.split("-")[0] || "", rating: data.vote_average?.toFixed(1) || "",
        language: "English", category: "", storyline: data.overview || ""
      });
      setSeriesCast(cast);
      setSeriesResults([]);
      setSeriesEditId("");

      // Set seasons
      const newSeasons: Season[] = [];
      if (data.seasons) {
        data.seasons.filter((s: any) => s.season_number > 0).forEach((season: any) => {
          newSeasons.push({
            name: season.name, seasonNumber: season.season_number,
            episodes: Array(season.episode_count).fill(null).map((_, i) => ({
              episodeNumber: i + 1, title: `Episode ${i + 1}`, link: ""
            }))
          });
        });
      }
      setSeasonsData(newSeasons);
      toast.success("Series details fetched!");
    } catch (err: any) { toast.error("Error: " + err.message); }
    finally { setFetchingOverlay(false); }
  };

  const saveSeries = () => {
    if (!seriesForm) return;
    if (!seriesForm.title) { toast.error("Please enter title"); return; }
    if (!seriesForm.category) { toast.error("Please select category"); return; }

    const data = { ...seriesForm, cast: seriesCast, seasons: seasonsData, type: "webseries", updatedAt: Date.now() };
    let saveRef;
    if (seriesEditId) {
      saveRef = ref(db, `webseries/${seriesEditId}`);
    } else {
      saveRef = push(ref(db, "webseries"));
      data.createdAt = Date.now();
    }
    set(saveRef, data)
      .then(() => {
        toast.success(seriesEditId ? "Series updated!" : "Series saved!");
        setSeriesForm(null); setSeasonsData([]); setSeriesCast([]); setSeriesEditId(""); setSeriesTab("ws-list");
      })
      .catch(err => toast.error("Error: " + err.message));
  };

  const editSeries = async (id: string) => {
    const snap = await get(ref(db, `webseries/${id}`));
    const data = snap.val();
    if (!data) return;
    setSeriesForm({
      tmdbId: data.tmdbId || "", title: data.title || "", logo: data.logo || "", poster: data.poster || "",
      backdrop: data.backdrop || "", trailer: data.trailer || "", year: data.year || "", rating: data.rating || "",
      language: data.language || "English", category: data.category || "", storyline: data.storyline || ""
    });
    setSeriesCast(data.cast || []);
    setSeasonsData(data.seasons || []);
    setSeriesEditId(id);
    setActiveSection("webseries");
    setSeriesTab("ws-add");
    toast.info("Editing: " + data.title);
  };

  const deleteSeries = (id: string) => {
    if (confirm("Delete this series?")) {
      remove(ref(db, `webseries/${id}`)).then(() => toast.success("Deleted!")).catch(err => toast.error("Error: " + err.message));
    }
  };

  // ==================== MOVIES ====================
  const searchTMDBMovies = async () => {
    if (!movieSearch.trim()) { toast.error("Please enter search query"); return; }
    setFetchingOverlay(true);
    try {
      const res = await fetch(`${TMDB_BASE_URL}/search/movie?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(movieSearch)}`);
      const data = await res.json();
      if (data.results?.length > 0) { setMovieResults(data.results.slice(0, 9)); }
      else { toast.error("No results found"); }
    } catch { toast.error("Error searching TMDB"); }
    finally { setFetchingOverlay(false); }
  };

  const fetchMovieDetails = async (id: number) => {
    setFetchingOverlay(true);
    try {
      const res = await fetch(`${TMDB_BASE_URL}/movie/${id}?api_key=${TMDB_API_KEY}&append_to_response=credits,videos,images`);
      const data = await res.json();
      if (data.success === false) throw new Error("Not found");

      let trailerUrl = "";
      if (data.videos?.results) {
        const trailer = data.videos.results.find((v: any) => v.type === "Trailer" && v.site === "YouTube");
        if (trailer) trailerUrl = `https://www.youtube.com/watch?v=${trailer.key}`;
      }
      let logoUrl = "";
      if (data.images?.logos?.length > 0) {
        const logo = data.images.logos.find((l: any) => l.iso_639_1 === "en") || data.images.logos[0];
        logoUrl = TMDB_IMG_BASE + "w500" + logo.file_path;
      }
      const cast = data.credits?.cast?.slice(0, 10).map((c: any) => ({
        name: c.name, character: c.character, photo: c.profile_path ? TMDB_IMG_BASE + "w185" + c.profile_path : ""
      })) || [];

      setMovieForm({
        tmdbId: data.id, title: data.title || "", logo: logoUrl, poster: data.poster_path ? TMDB_IMG_BASE + "original" + data.poster_path : "",
        backdrop: data.backdrop_path ? TMDB_IMG_BASE + "original" + data.backdrop_path : "", trailer: trailerUrl,
        year: data.release_date?.split("-")[0] || "", rating: data.vote_average?.toFixed(1) || "",
        language: "English", category: "", storyline: data.overview || "", movieLink: "", downloadLink: ""
      });
      setMovieCast(cast);
      setMovieResults([]);
      setMovieEditId("");
      toast.success("Movie details fetched!");
    } catch (err: any) { toast.error("Error: " + err.message); }
    finally { setFetchingOverlay(false); }
  };

  const saveMovie = () => {
    if (!movieForm) return;
    if (!movieForm.title) { toast.error("Please enter title"); return; }
    if (!movieForm.category) { toast.error("Please select category"); return; }
    if (!movieForm.movieLink) { toast.error("Please enter movie link"); return; }

    const data = { ...movieForm, cast: movieCast, type: "movie", updatedAt: Date.now() };
    let saveRef;
    if (movieEditId) {
      saveRef = ref(db, `movies/${movieEditId}`);
    } else {
      saveRef = push(ref(db, "movies"));
      data.createdAt = Date.now();
    }
    set(saveRef, data)
      .then(() => {
        toast.success(movieEditId ? "Movie updated!" : "Movie saved!");
        setMovieForm(null); setMovieCast([]); setMovieEditId(""); setMoviesTab("mv-list");
      })
      .catch(err => toast.error("Error: " + err.message));
  };

  const editMovie = async (id: string) => {
    const snap = await get(ref(db, `movies/${id}`));
    const data = snap.val();
    if (!data) return;
    setMovieForm({
      tmdbId: data.tmdbId || "", title: data.title || "", logo: data.logo || "", poster: data.poster || "",
      backdrop: data.backdrop || "", trailer: data.trailer || "", year: data.year || "", rating: data.rating || "",
      language: data.language || "English", category: data.category || "", storyline: data.storyline || "",
      movieLink: data.movieLink || "", downloadLink: data.downloadLink || ""
    });
    setMovieCast(data.cast || []);
    setMovieEditId(id);
    setActiveSection("movies");
    setMoviesTab("mv-add");
    toast.info("Editing: " + data.title);
  };

  const deleteMovie = (id: string) => {
    if (confirm("Delete this movie?")) {
      remove(ref(db, `movies/${id}`)).then(() => toast.success("Deleted!")).catch(err => toast.error("Error: " + err.message));
    }
  };

  // ==================== NOTIFICATIONS ====================
  const sendNotification = async () => {
    if (!notifTitle || !notifMessage) { toast.error("Please enter title and message"); return; }
    setFetchingOverlay(true);
    try {
      let contentId = "", contentType = "";
      if (notifContent) {
        const parts = notifContent.split("|");
        contentId = parts[0]; contentType = parts[1];
      }
      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.val() || {};
      const promises: any[] = [];
      let userCount = 0;
      Object.entries(users).forEach(([userId, userData]: any) => {
        if (notifTarget === "online" && !userData.online) return;
        userCount++;
        promises.push(push(ref(db, `notifications/${userId}`), {
          title: notifTitle, message: notifMessage, type: notifType, contentId, contentType,
          timestamp: Date.now(), read: false
        }));
      });
      await Promise.all(promises);
      toast.success(`Notification sent to ${userCount} users`);
      setNotifTitle(""); setNotifMessage("");
    } catch (err: any) { toast.error("Error: " + err.message); }
    finally { setFetchingOverlay(false); }
  };

  const deleteNotification = (userId: string, notifId: string) => {
    if (confirm("Delete this notification?")) {
      remove(ref(db, `notifications/${userId}/${notifId}`))
        .then(() => toast.success("Notification deleted"))
        .catch(() => toast.error("Error deleting notification"));
    }
  };

  // ==================== NEW RELEASES ====================
  const handleReleaseContentChange = (value: string) => {
    setReleaseContent(value);
    setReleaseSeason(""); setReleaseEpisode(""); setReleaseSeasons([]); setReleaseEpisodes([]);
    if (!value) { setShowSeasonEpisode(false); return; }
    const [contentId, contentType] = value.split("|");
    if (contentType === "webseries") {
      const series = webseriesData.find(s => s.id === contentId);
      if (series?.seasons?.length > 0) {
        setReleaseSeasons(series.seasons.map((s: any, i: number) => ({ index: i, name: s.name || `Season ${i + 1}` })));
        setShowSeasonEpisode(true);
      } else { toast.error("This series has no seasons"); setShowSeasonEpisode(false); }
    } else if (contentType === "movie") {
      setReleaseSeasons([{ index: 0, name: "Movie" }]);
      setReleaseEpisodes([{ index: 0, name: "Complete Movie" }]);
      setReleaseSeason("0"); setReleaseEpisode("0");
      setShowSeasonEpisode(true);
    }
  };

  const handleReleaseSeasonChange = (value: string) => {
    setReleaseSeason(value); setReleaseEpisode(""); setReleaseEpisodes([]);
    if (!releaseContent || value === "") return;
    const [contentId, contentType] = releaseContent.split("|");
    if (contentType === "webseries") {
      const series = webseriesData.find(s => s.id === contentId);
      if (series?.seasons?.[parseInt(value)]) {
        const season = series.seasons[parseInt(value)];
        if (season.episodes?.length > 0) {
          setReleaseEpisodes(season.episodes.map((ep: any, i: number) => ({ index: i, name: `Episode ${ep.episodeNumber || i + 1}` })));
        } else { toast.error("No episodes in this season"); }
      }
    } else if (contentType === "movie") {
      setReleaseEpisodes([{ index: 0, name: "Complete Movie" }]);
      setReleaseEpisode("0");
    }
  };

  const addNewRelease = async () => {
    if (!releaseContent || releaseSeason === "" || releaseEpisode === "") {
      toast.error("Please select content, season and episode"); return;
    }
    const [contentId, contentType] = releaseContent.split("|");
    let content: any; let episodeInfo: any = {};
    if (contentType === "webseries") {
      content = webseriesData.find(s => s.id === contentId);
      if (content?.seasons?.[parseInt(releaseSeason)]) {
        const season = content.seasons[parseInt(releaseSeason)];
        const episode = season.episodes?.[parseInt(releaseEpisode)];
        episodeInfo = {
          seasonNumber: parseInt(releaseSeason) + 1,
          episodeNumber: episode?.episodeNumber || parseInt(releaseEpisode) + 1,
          seasonName: season.name || `Season ${parseInt(releaseSeason) + 1}`
        };
      }
    } else {
      content = moviesData.find(m => m.id === contentId);
      episodeInfo = { type: "movie", seasonName: "Movie" };
    }
    if (!content) { toast.error("Content not found"); return; }

    const newRelease = {
      contentId, contentType, title: content.title, poster: content.poster || "",
      year: content.year || "N/A", rating: content.rating || "N/A",
      episodeInfo, timestamp: Date.now(), active: true
    };
    try {
      await set(push(ref(db, "newEpisodeReleases")), newRelease);
      toast.success("Added as New Release");
      // Send notification
      const usersSnap = await get(ref(db, "users"));
      const users = usersSnap.val() || {};
      const promises: any[] = [];
      const notifTitle = contentType === "webseries" ? `New Episode: ${content.title}` : `New Movie: ${content.title}`;
      const notifMsg = contentType === "webseries"
        ? `${episodeInfo.seasonName} - Episode ${episodeInfo.episodeNumber} is now available!`
        : `${content.title} (${content.year}) is now available!`;
      Object.keys(users).forEach(userId => {
        promises.push(push(ref(db, `notifications/${userId}`), {
          title: notifTitle, message: notifMsg, type: "new_episode", contentId,
          contentType, timestamp: Date.now(), read: false
        }));
      });
      await Promise.all(promises);
      toast.success("Notification sent to users");
      setReleaseContent(""); setShowSeasonEpisode(false);
    } catch (err: any) { toast.error("Error: " + err.message); }
  };

  const toggleReleaseStatus = (id: string, current: boolean) => {
    set(ref(db, `newEpisodeReleases/${id}/active`), !current)
      .then(() => toast.success(!current ? "Activated" : "Deactivated"))
      .catch(() => toast.error("Error updating"));
  };

  const deleteRelease = (id: string) => {
    if (confirm("Delete this release?")) {
      remove(ref(db, `newEpisodeReleases/${id}`))
        .then(() => toast.success("Deleted"))
        .catch(() => toast.error("Error deleting"));
    }
  };

  // ==================== QUICK FETCH ====================
  const quickFetch = async () => {
    if (!quickTmdbId.trim()) { toast.error("Please enter TMDB ID"); return; }
    if (fetchType === "tv") {
      await fetchSeriesDetails(parseInt(quickTmdbId));
      setActiveSection("webseries"); setSeriesTab("ws-add");
    } else {
      await fetchMovieDetails(parseInt(quickTmdbId));
      setActiveSection("movies"); setMoviesTab("mv-add");
    }
  };

  // ==================== EXPORT / REFRESH ====================
  const refreshData = () => {
    toast.info("Data is auto-synced with Firebase!");
    setDropdownOpen(false);
  };

  const exportData = async () => {
    try {
      const [ws, mv, cat, us, rel, not] = await Promise.all([
        get(ref(db, "webseries")), get(ref(db, "movies")), get(ref(db, "categories")),
        get(ref(db, "users")), get(ref(db, "newEpisodeReleases")), get(ref(db, "notifications"))
      ]);
      const data = {
        webseries: ws.val(), movies: mv.val(), categories: cat.val(),
        users: us.val(), newEpisodeReleases: rel.val(), notifications: not.val(),
        exportedAt: new Date().toISOString()
      };
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `rs-anime-backup-${Date.now()}.json`; a.click();
      toast.success("Data exported!");
    } catch (err: any) { toast.error("Error: " + err.message); }
    setDropdownOpen(false);
  };

  // Computed stats
  const totalCategories = Object.keys(categoriesData).length;
  const onlineUsers = usersData.filter(u => u.online).length;
  const offlineUsers = usersData.length - onlineUsers;
  const recentContent = [...webseriesData, ...moviesData].sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 3);
  const categoryList = Object.entries(categoriesData).map(([id, cat]: any) => ({ id, name: cat.name }));
  const languageOptions = ["English", "Hindi", "Tamil", "Telugu", "Korean", "Japanese", "Spanish", "Multi"];

  // Season/Episode helpers
  const addSeason = (name = "", episodeCount = 1) => {
    setSeasonsData(prev => [...prev, {
      name: name || `Season ${prev.length + 1}`, seasonNumber: prev.length + 1,
      episodes: Array(episodeCount).fill(null).map((_, i) => ({ episodeNumber: i + 1, title: `Episode ${i + 1}`, link: "" }))
    }]);
  };

  const removeSeason = (idx: number) => {
    if (confirm("Remove this season?")) setSeasonsData(prev => prev.filter((_, i) => i !== idx));
  };

  const addEpisode = (sIdx: number) => {
    setSeasonsData(prev => {
      const copy = [...prev];
      const s = { ...copy[sIdx], episodes: [...copy[sIdx].episodes] };
      const num = s.episodes.length + 1;
      s.episodes.push({ episodeNumber: num, title: `Episode ${num}`, link: "", link480: "", link720: "", link1080: "", link4k: "" });
      copy[sIdx] = s;
      return copy;
    });
  };

  const removeEpisode = (sIdx: number, eIdx: number) => {
    if (!confirm("Remove this episode?")) return;
    setSeasonsData(prev => {
      const copy = [...prev];
      const s = { ...copy[sIdx], episodes: copy[sIdx].episodes.filter((_, i) => i !== eIdx) };
      // Re-number episodes
      s.episodes = s.episodes.map((ep, i) => ({ ...ep, episodeNumber: i + 1 }));
      copy[sIdx] = s;
      return copy;
    });
  };

  const updateSeasonName = (sIdx: number, name: string) => {
    setSeasonsData(prev => {
      const copy = [...prev]; copy[sIdx] = { ...copy[sIdx], name }; return copy;
    });
  };

  const updateEpisodeLink = (sIdx: number, eIdx: number, link: string) => {
    setSeasonsData(prev => {
      const copy = [...prev];
      const s = { ...copy[sIdx], episodes: [...copy[sIdx].episodes] };
      s.episodes[eIdx] = { ...s.episodes[eIdx], link };
      copy[sIdx] = s;
      return copy;
    });
  };

  const updateEpisodeQualityLink = (sIdx: number, eIdx: number, quality: string, link: string) => {
    setSeasonsData(prev => {
      const copy = [...prev];
      const s = { ...copy[sIdx], episodes: [...copy[sIdx].episodes] };
      s.episodes[eIdx] = { ...s.episodes[eIdx], [quality]: link };
      copy[sIdx] = s;
      return copy;
    });
  };

  // ==================== AUTH HANDLERS ====================
  const handleLogin = async () => {
    if (!loginEmail || !loginPassword) { toast.error("Enter email and password"); return; }
    setLoginLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, loginEmail, loginPassword);
      if (cred.user.email !== "rahatsarker224@gmail.com") {
        await signOut(auth);
        toast.error("Unauthorized admin account");
      } else {
        toast.success("Logged in!");
      }
    } catch (err: any) {
      toast.error("Login failed: " + (err.code === "auth/invalid-credential" ? "Wrong email or password" : err.message));
    }
    setLoginLoading(false);
  };

  const handlePinVerify = () => {
    if (pinInput === savedPin) {
      setIsPinVerified(true);
      toast.success("PIN verified!");
    } else {
      toast.error("Wrong PIN");
    }
    setPinInput("");
  };

  const handleSetPin = () => {
    if (newPinInput.length < 4) { toast.error("PIN must be at least 4 digits"); return; }
    set(ref(db, "admin/pin"), { enabled: true, code: newPinInput })
      .then(() => { toast.success("PIN set!"); setNewPinInput(""); setShowPinSetup(false); });
  };

  const handleDisablePin = () => {
    if (confirm("Disable PIN security?")) {
      set(ref(db, "admin/pin"), { enabled: false, code: "" })
        .then(() => { toast.success("PIN disabled"); setIsPinVerified(true); });
    }
  };

  const handleLogout = () => {
    signOut(auth);
    setIsAuthenticated(false);
    setIsPinVerified(false);
    toast.success("Logged out");
  };

  // ==================== RENDER HELPERS ====================
  const inputClass = "w-full px-4 py-3 bg-[#1A1A2E] border border-white/10 rounded-xl text-white text-sm focus:border-purple-500 focus:outline-none focus:shadow-[0_0_15px_rgba(157,78,221,0.2)] transition-all placeholder:text-[#957DAD]";
  const selectClass = inputClass + " cursor-pointer";
  const btnPrimary = "bg-gradient-to-r from-purple-600 to-purple-800 text-white font-semibold rounded-xl shadow-[0_4px_15px_rgba(157,78,221,0.3)] hover:shadow-[0_6px_25px_rgba(157,78,221,0.5)] hover:-translate-y-0.5 transition-all cursor-pointer border-none";
  const btnSecondary = "bg-gradient-to-r from-[#1A1A2E] to-[#151521] border border-purple-500/30 text-white rounded-xl hover:border-purple-500 transition-all cursor-pointer";
  const glassCard = "bg-gradient-to-br from-[rgba(26,26,46,0.9)] to-[rgba(21,21,33,0.95)] backdrop-blur-xl border border-purple-500/20 rounded-2xl";

  const menuItems: { section: Section; icon: React.ReactNode; label: string; group?: string }[] = [
    { section: "dashboard", icon: <LayoutDashboard size={16} />, label: "Dashboard", group: "Main Menu" },
    { section: "categories", icon: <FolderOpen size={16} />, label: "Categories" },
    { section: "webseries", icon: <Film size={16} />, label: "Web Series" },
    { section: "movies", icon: <Video size={16} />, label: "Movies" },
    { section: "users", icon: <Users size={16} />, label: "Users" },
    { section: "notifications", icon: <Bell size={16} />, label: "Notifications", group: "New Features" },
    { section: "new-releases", icon: <Zap size={16} />, label: "New Releases" },
    { section: "add-content", icon: <PlusCircle size={16} />, label: "Add Content", group: "Quick Actions" },
    { section: "tmdb-fetch", icon: <CloudDownload size={16} />, label: "TMDB Fetch" },
    { section: "redeem-codes", icon: <Shield size={16} />, label: "Redeem Codes" },
    { section: "free-access", icon: <Eye size={16} />, label: "Free Access", group: "Tracking" },
    { section: "maintenance", icon: <Power size={16} />, label: "Maintenance", group: "Server" },
  ];

  // ==================== LOGIN SCREEN ====================
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-4">
        <div className={`${glassCard} p-8 w-full max-w-[400px]`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-800 rounded-2xl flex items-center justify-center text-3xl font-black mx-auto mb-4 shadow-[0_5px_30px_rgba(157,78,221,0.5)]">RS</div>
            <h1 className="text-xl font-bold text-white">Admin Login</h1>
            <p className="text-sm text-[#957DAD] mt-1">RS ANIME Control Panel</p>
          </div>
          <div className="space-y-4">
            <input value={loginEmail} onChange={e => setLoginEmail(e.target.value)} className={inputClass} placeholder="Email" type="email" />
            <input value={loginPassword} onChange={e => setLoginPassword(e.target.value)} className={inputClass} placeholder="Password" type="password"
              onKeyDown={e => e.key === "Enter" && handleLogin()} />
            <button onClick={handleLogin} disabled={loginLoading}
              className={`${btnPrimary} w-full py-3.5 flex items-center justify-center gap-2`}>
              <Lock size={16} />
              {loginLoading ? "Logging in..." : "Login"}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ==================== PIN SCREEN ====================
  if (pinEnabled && !isPinVerified) {
    return (
      <div className="min-h-screen bg-[#0F0F1A] flex items-center justify-center p-4">
        <div className={`${glassCard} p-8 w-full max-w-[400px]`}>
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-gradient-to-br from-purple-500 to-purple-800 rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-[0_5px_30px_rgba(157,78,221,0.5)]">
              <KeyRound size={28} className="text-white" />
            </div>
            <h1 className="text-xl font-bold text-white">Enter PIN</h1>
            <p className="text-sm text-[#957DAD] mt-1">Security verification required</p>
          </div>
          <div className="space-y-4">
            <input value={pinInput} onChange={e => setPinInput(e.target.value)} className={`${inputClass} text-center text-2xl tracking-[10px] font-bold`}
              placeholder="••••" type="password" maxLength={8} onKeyDown={e => e.key === "Enter" && handlePinVerify()} />
            <button onClick={handlePinVerify} className={`${btnPrimary} w-full py-3.5`}>
              Verify PIN
            </button>
            <button onClick={handleLogout} className="w-full text-center text-sm text-[#957DAD] hover:text-red-400 transition-colors">
              Logout
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0F0F1A] text-white font-['Poppins',sans-serif]">
      {/* Fetching Overlay */}
      {fetchingOverlay && (
        <div className="fixed inset-0 bg-black/95 z-[5000] flex flex-col items-center justify-center">
          <div className="w-12 h-12 border-4 border-[#151521] border-t-purple-500 rounded-full animate-spin" />
          <p className="mt-5 text-sm text-[#D1C4E9]">Fetching data from TMDB...</p>
        </div>
      )}

      {/* PIN Setup Modal */}
      {showPinSetup && (
        <div className="fixed inset-0 bg-black/80 z-[5000] flex items-center justify-center p-4" onClick={() => setShowPinSetup(false)}>
          <div className={`${glassCard} p-6 w-full max-w-[350px]`} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
              <KeyRound size={18} className="text-purple-500" /> {pinEnabled ? "Change PIN" : "Set PIN"}
            </h3>
            <input value={newPinInput} onChange={e => setNewPinInput(e.target.value.replace(/\D/g, ""))}
              className={`${inputClass} text-center text-xl tracking-[8px] font-bold mb-4`}
              placeholder="Enter PIN" type="password" maxLength={8} onKeyDown={e => e.key === "Enter" && handleSetPin()} />
            <div className="flex gap-2">
              <button onClick={() => setShowPinSetup(false)} className={`${btnSecondary} flex-1 py-3 text-sm`}>Cancel</button>
              <button onClick={handleSetPin} className={`${btnPrimary} flex-1 py-3 text-sm`}>Save PIN</button>
            </div>
          </div>
        </div>
      )}

      {/* Overlay */}
      {sidebarOpen && <div className="fixed inset-0 bg-black/70 z-[999] backdrop-blur-sm" onClick={() => setSidebarOpen(false)} />}

      {/* Sidebar */}
      <div className={`fixed top-0 ${sidebarOpen ? "left-0" : "-left-[280px]"} w-[280px] h-screen bg-gradient-to-b from-[#151521] to-[#0F0F1A] z-[1000] transition-all duration-300 border-r border-purple-500/20 flex flex-col`}>
        <div className="p-5 border-b border-purple-500/20">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-purple-500 to-purple-800 rounded-[14px] flex items-center justify-center text-2xl font-black shadow-[0_5px_20px_rgba(157,78,221,0.4)]">RS</div>
            <div>
              <h2 className="text-lg font-bold"><span className="bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">Rahat</span> Admin</h2>
              <p className="text-[11px] text-[#D1C4E9]">RS ANIME Control Panel</p>
            </div>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto py-4">
          {menuItems.map((item, i) => (
            <div key={item.section}>
              {item.group && <p className="px-5 py-2 text-[10px] text-[#957DAD] uppercase tracking-[2px] font-semibold">{item.group}</p>}
              <div
                onClick={() => showSection(item.section)}
                className={`px-5 py-3.5 flex items-center gap-3.5 cursor-pointer border-l-[3px] transition-all mx-0 my-0.5 ${
                  activeSection === item.section ? "bg-purple-500/15 border-l-purple-500" : "border-l-transparent hover:bg-purple-500/10"
                }`}
              >
                <span className="text-purple-500">{item.icon}</span>
                <span className="text-sm">{item.label}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="p-4 border-t border-purple-500/20">
          <div className="flex items-center gap-2.5 p-3 bg-black/30 rounded-[10px] mb-2.5">
            <div className={`w-2.5 h-2.5 rounded-full animate-pulse ${firebaseConnected ? "bg-green-500" : "bg-red-500"}`} />
            <span className="text-xs" style={{ color: firebaseConnected ? "#4ade80" : "#D1C4E9" }}>
              Firebase: {firebaseConnected ? "Connected" : "Disconnected"}
            </span>
          </div>
        </div>
      </div>

      {/* Header */}
      <header className="fixed top-0 left-0 right-0 h-[60px] bg-gradient-to-b from-[rgba(15,15,26,0.98)] to-[rgba(15,15,26,0.9)] z-[100] flex items-center justify-between px-4 border-b border-purple-500/20">
        <div className="flex items-center gap-3">
          <button onClick={() => setSidebarOpen(true)} className="w-10 h-10 rounded-[10px] bg-white/10 flex items-center justify-center hover:bg-purple-500 transition-all">
            <Menu size={18} />
          </button>
          <span className="text-2xl font-black text-purple-500" style={{ textShadow: "0 0 20px rgba(157,78,221,0.4)" }}>RS</span>
          <h1 className="text-base font-semibold">{sectionTitles[activeSection]}</h1>
        </div>
        <div className="flex items-center gap-2.5 relative">
          <div className="bg-gradient-to-r from-purple-500 to-purple-800 px-3 py-1.5 rounded-full text-[11px] font-semibold flex items-center gap-1.5">
            <Shield size={12} />
            <span className="bg-gradient-to-r from-purple-300 to-pink-300 bg-clip-text text-transparent font-extrabold">Rahat</span>
          </div>
          <button onClick={() => setDropdownOpen(!dropdownOpen)} className="w-10 h-10 rounded-[10px] bg-white/10 flex items-center justify-center hover:bg-purple-500 transition-all">
            <MoreVertical size={16} />
          </button>
          {dropdownOpen && (
            <div className="absolute right-0 top-[50px] w-[220px] bg-[#1A1A2E] border border-purple-500/30 rounded-xl overflow-hidden z-[200] shadow-[0_10px_40px_rgba(0,0,0,0.5)]">
              <div onClick={refreshData} className="px-4 py-3.5 flex items-center gap-2.5 text-[13px] hover:bg-purple-500/20 cursor-pointer transition-all">
                <RefreshCw size={14} className="text-purple-500" /> Refresh Data
              </div>
              <div onClick={() => { showSection("add-content"); setDropdownOpen(false); }} className="px-4 py-3.5 flex items-center gap-2.5 text-[13px] hover:bg-purple-500/20 cursor-pointer transition-all">
                <Plus size={14} className="text-purple-500" /> Add Content
              </div>
              <div onClick={exportData} className="px-4 py-3.5 flex items-center gap-2.5 text-[13px] hover:bg-purple-500/20 cursor-pointer transition-all">
                <Download size={14} className="text-purple-500" /> Export Data
              </div>
              <div onClick={() => { setShowPinSetup(true); setDropdownOpen(false); }} className="px-4 py-3.5 flex items-center gap-2.5 text-[13px] hover:bg-purple-500/20 cursor-pointer transition-all">
                <KeyRound size={14} className="text-purple-500" /> {pinEnabled ? "Change PIN" : "Set PIN"}
              </div>
              {pinEnabled && (
                <div onClick={() => { handleDisablePin(); setDropdownOpen(false); }} className="px-4 py-3.5 flex items-center gap-2.5 text-[13px] hover:bg-purple-500/20 cursor-pointer transition-all text-yellow-400">
                  <Lock size={14} className="text-yellow-400" /> Disable PIN
                </div>
              )}
              <div onClick={() => { if (confirm("Clear cache?")) { localStorage.clear(); toast.success("Cache cleared!"); setTimeout(() => window.location.reload(), 1500); } setDropdownOpen(false); }}
                className="px-4 py-3.5 flex items-center gap-2.5 text-[13px] hover:bg-purple-500/20 cursor-pointer transition-all text-red-400">
                <Trash2 size={14} className="text-red-400" /> Clear Cache
              </div>
              <div onClick={() => { handleLogout(); setDropdownOpen(false); }}
                className="px-4 py-3.5 flex items-center gap-2.5 text-[13px] hover:bg-purple-500/20 cursor-pointer transition-all text-red-400 border-t border-purple-500/20">
                <LogOut size={14} className="text-red-400" /> Logout
              </div>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <main className="pt-[70px] px-4 pb-[100px] min-h-screen">
        {/* ==================== DASHBOARD ==================== */}
        {activeSection === "dashboard" && (
          <div>
            <div className="grid grid-cols-2 gap-3 mb-5">
              {[
                { icon: <Film size={18} />, value: webseriesData.length, label: "Web Series" },
                { icon: <Video size={18} />, value: moviesData.length, label: "Movies" },
                { icon: <FolderOpen size={18} />, value: totalCategories, label: "Categories" },
                { icon: <Users size={18} />, value: usersData.length, label: "Total Users" },
              ].map((stat, i) => (
                <div key={i} className="bg-gradient-to-br from-[#1A1A2E] to-[#151521] border border-white/5 rounded-2xl p-[18px] hover:border-purple-500/30 hover:-translate-y-0.5 transition-all">
                  <div className="w-[42px] h-[42px] bg-purple-500/15 rounded-xl flex items-center justify-center mb-3 text-purple-500">{stat.icon}</div>
                  <div className="text-[28px] font-extrabold bg-gradient-to-r from-purple-500 to-pink-500 bg-clip-text text-transparent">{stat.value}</div>
                  <div className="text-xs text-[#D1C4E9] mt-1">{stat.label}</div>
                </div>
              ))}
            </div>

            <div className={`${glassCard} p-4 mb-4`}>
              <div className="flex justify-between items-center mb-3">
                <h3 className="text-sm font-semibold">User Activity</h3>
              </div>
              <div className="flex gap-4 items-center">
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-[13px]">Online: <strong>{onlineUsers}</strong></span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                  <span className="text-[13px]">Offline: <strong>{offlineUsers}</strong></span>
                </div>
              </div>
            </div>

            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5">Recent Content</h3>
              {recentContent.length === 0 ? (
                <p className="text-[#957DAD] text-[13px] text-center py-5">No recent content</p>
              ) : (
                recentContent.map((item, i) => (
                  <div key={i} className="flex items-center gap-3 p-2.5 bg-black/20 rounded-[10px] mb-2">
                    <img src={item.poster || ""} className="w-10 h-[55px] rounded-md object-cover" onError={(e) => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/40x55/1A1A2E/9D4EDD?text=N"; }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-[13px] font-medium truncate">{item.title || "Untitled"}</p>
                      <p className="text-[11px] text-[#D1C4E9]">{item.type || (item.seasons ? "Series" : "Movie")} • {item.year || "N/A"}</p>
                    </div>
                  </div>
                ))
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 mt-5">
              <button onClick={() => { showSection("webseries"); setSeriesTab("ws-add"); }} className={`${btnPrimary} py-5 px-4 flex flex-col items-center gap-2.5 text-[13px]`}>
                <Plus size={24} /> Add Series
              </button>
              <button onClick={() => { showSection("movies"); setMoviesTab("mv-add"); }} className={`${btnSecondary} py-5 px-4 flex flex-col items-center gap-2.5 text-[13px]`}>
                <Plus size={24} /> Add Movie
              </button>
            </div>
          </div>
        )}

        {/* ==================== CATEGORIES ==================== */}
        {activeSection === "categories" && (
          <div>
            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5">Add New Category</h3>
              <div className="flex gap-2.5">
                <input value={categoryInput} onChange={e => setCategoryInput(e.target.value)} onKeyDown={e => e.key === "Enter" && saveCategory()}
                  className={`${inputClass} flex-1`} placeholder="Category name" />
                <button onClick={saveCategory} className={`${btnPrimary} px-5 py-3.5`}><Plus size={18} /></button>
              </div>
            </div>
            <div className={`${glassCard} p-4`}>
              <h3 className="text-sm font-semibold mb-3.5">All Categories</h3>
              {categoryList.length === 0 ? (
                <p className="text-[#957DAD] text-[13px] text-center py-5">No categories yet</p>
              ) : categoryList.map(cat => (
                <div key={cat.id} className="bg-[#1A1A2E] border border-white/5 rounded-[14px] p-3.5 flex justify-between items-center mb-2">
                  <span className="text-sm font-medium">{cat.name}</span>
                  <div className="flex gap-2">
                    <button onClick={() => editCategory(cat.id, cat.name)} className="bg-blue-500/20 text-blue-400 p-2 rounded-lg"><Edit size={14} /></button>
                    <button onClick={() => deleteCategory(cat.id)} className="bg-pink-500/20 text-pink-500 p-2 rounded-lg"><Trash2 size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== WEB SERIES ==================== */}
        {activeSection === "webseries" && (
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2.5 mb-4 scrollbar-hide">
              <button onClick={() => setSeriesTab("ws-list")} className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${seriesTab === "ws-list" ? "bg-gradient-to-r from-purple-500 to-purple-800 text-white shadow-[0_4px_15px_rgba(157,78,221,0.4)]" : "bg-[#151521] border border-white/10 text-[#D1C4E9]"}`}>
                All Series
              </button>
              <button onClick={() => setSeriesTab("ws-add")} className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${seriesTab === "ws-add" ? "bg-gradient-to-r from-purple-500 to-purple-800 text-white shadow-[0_4px_15px_rgba(157,78,221,0.4)]" : "bg-[#151521] border border-white/10 text-[#D1C4E9]"}`}>
                Add New
              </button>
            </div>

            {seriesTab === "ws-list" && (
              <div>
                {webseriesData.length === 0 ? (
                  <p className="text-[#957DAD] text-[13px] text-center py-8">No web series yet</p>
                ) : webseriesData.map(item => (
                  <div key={item.id} className="bg-[#1A1A2E] border border-white/5 rounded-[14px] p-3.5 mb-3 hover:border-purple-500/30 transition-all">
                    <div className="flex gap-3.5">
                      <img src={item.poster || ""} className="w-20 h-[115px] rounded-[10px] object-cover flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/80x115/1A1A2E/9D4EDD?text=N"; }} />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold mb-1 truncate">{item.title || "Untitled"}</h4>
                        <p className="text-[11px] text-[#D1C4E9] mb-2">{item.year || "N/A"} • {item.rating || "N/A"}⭐ • {item.language || "N/A"}</p>
                        <p className="text-[11px] text-[#D1C4E9]">{item.seasons?.length || 0} Seasons • {item.category || "Uncategorized"}</p>
                        <div className="flex gap-2 mt-2.5">
                          <button onClick={() => editSeries(item.id)} className={`${btnSecondary} px-3.5 py-2 text-[11px] font-semibold flex items-center gap-1.5`}>
                            <Edit size={12} /> Edit
                          </button>
                          <button onClick={() => deleteSeries(item.id)} className="bg-red-500/20 border border-red-500/30 text-pink-500 px-3.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {seriesTab === "ws-add" && (
              <div>
                <div className={`${glassCard} p-4 mb-4`}>
                  <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2"><Search size={14} className="text-purple-500" /> Search Web Series</h3>
                  <div className="flex gap-2.5 mb-3.5">
                    <input value={seriesSearch} onChange={e => setSeriesSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchTMDBSeries()}
                      className={`${inputClass} flex-1`} placeholder="Search series name..." />
                    <button onClick={searchTMDBSeries} className={`${btnPrimary} px-4 py-3.5`}><Search size={16} /></button>
                  </div>
                  {seriesResults.length > 0 && (
                    <div>
                      <p className="text-xs text-[#D1C4E9] mb-2.5">Click to fetch details:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {seriesResults.map(item => (
                          <div key={item.id} onClick={() => fetchSeriesDetails(item.id)}
                            className="bg-[#1A1A2E] rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-purple-500 hover:scale-[1.03] transition-all">
                            <img src={item.poster_path ? TMDB_IMG_BASE + "w342" + item.poster_path : ""} className="w-full aspect-[2/3] object-cover"
                              onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/200x300/1A1A2E/9D4EDD?text=No+Image"; }} />
                            <div className="p-2.5">
                              <p className="text-[11px] font-semibold leading-tight line-clamp-2">{item.name}</p>
                              <p className="text-[10px] text-purple-500 mt-1 font-semibold">{item.first_air_date?.split("-")[0] || "N/A"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {seriesForm && (
                  <>
                    {seriesForm.backdrop && (
                      <div className="relative rounded-[14px] overflow-hidden mb-5">
                        <img src={seriesForm.backdrop || seriesForm.poster} className="w-full aspect-video object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="text-lg font-bold">{seriesForm.title}</div>
                          <div className="text-xs text-[#D1C4E9] mt-1">{seriesForm.year} • {seriesForm.rating} ⭐</div>
                        </div>
                      </div>
                    )}

                    <div className={`${glassCard} p-4 mb-4`}>
                      <div className="text-base font-semibold mb-4 flex items-center gap-2.5"><span className="text-purple-500">ℹ️</span> Series Details</div>
                      {["title", "logo", "poster", "backdrop", "trailer"].map(field => (
                        <div key={field} className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium capitalize">{field === "logo" ? "Title Logo URL" : field === "trailer" ? "Trailer (YouTube Link)" : field.charAt(0).toUpperCase() + field.slice(1) + " URL"}</label>
                          <input value={seriesForm[field] || ""} onChange={e => setSeriesForm({ ...seriesForm, [field]: e.target.value })}
                            className={inputClass} placeholder={`${field}...`} />
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Year</label>
                          <input value={seriesForm.year || ""} onChange={e => setSeriesForm({ ...seriesForm, year: e.target.value })} className={inputClass} placeholder="Year" />
                        </div>
                        <div className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Rating</label>
                          <input value={seriesForm.rating || ""} onChange={e => setSeriesForm({ ...seriesForm, rating: e.target.value })} className={inputClass} placeholder="Rating" />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Language</label>
                        <select value={seriesForm.language || "English"} onChange={e => setSeriesForm({ ...seriesForm, language: e.target.value })} className={selectClass}>
                          {languageOptions.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Category</label>
                        <select value={seriesForm.category || ""} onChange={e => setSeriesForm({ ...seriesForm, category: e.target.value })} className={selectClass}>
                          <option value="">Select Category</option>
                          {categoryList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Storyline</label>
                        <textarea value={seriesForm.storyline || ""} onChange={e => setSeriesForm({ ...seriesForm, storyline: e.target.value })}
                          className={`${inputClass} min-h-[100px] resize-y`} placeholder="Storyline" />
                      </div>
                      {seriesCast.length > 0 && (
                        <div className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Cast (Auto-fetched)</label>
                          <div className="flex gap-3 overflow-x-auto pb-2.5 scrollbar-hide">
                            {seriesCast.map((c, i) => (
                              <div key={i} className="flex-shrink-0 w-[70px] text-center">
                                <img src={c.photo || ""} className="w-[60px] h-[60px] rounded-[10px] object-cover mb-1.5 mx-auto"
                                  onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/60x60/1A1A2E/9D4EDD?text=N"; }} />
                                <p className="text-[10px] font-medium truncate">{c.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`${glassCard} p-4 mb-4`}>
                      <div className="flex justify-between items-center mb-3.5">
                        <div className="text-base font-semibold flex items-center gap-2.5">📋 Seasons & Episodes</div>
                        <button onClick={() => addSeason()} className={`${btnSecondary} px-3.5 py-2 text-xs`}><Plus size={12} className="mr-1" /> Season</button>
                      </div>
                      {seasonsData.map((season, sIdx) => (
                        <div key={sIdx} className="bg-black/30 rounded-xl p-3.5 mb-3 border border-white/5">
                          <div className="flex items-center gap-2.5 mb-3">
                            <input value={season.name} onChange={e => updateSeasonName(sIdx, e.target.value)} className={`${inputClass} flex-1`} />
                            <button onClick={() => removeSeason(sIdx)} className="bg-red-500/20 text-pink-500 p-2.5 rounded-lg"><Trash2 size={14} /></button>
                          </div>
                          <div className="mb-2.5 flex justify-between items-center">
                            <span className="text-xs text-[#D1C4E9]">Episodes: {season.episodes.length}</span>
                            <button onClick={() => setExpandedSeasons(prev => ({ ...prev, [sIdx]: !prev[sIdx] }))}
                              className={`${btnSecondary} px-3 py-1.5 text-[11px]`}><ChevronDown size={12} className="mr-1" /> Episodes</button>
                          </div>
                          {expandedSeasons[sIdx] && (
                            <div>
                              {season.episodes.map((ep, eIdx) => (
                                <div key={eIdx} className="mb-3 bg-white/[0.03] px-3 py-3 rounded-lg border border-white/5">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-semibold text-purple-400">Episode {ep.episodeNumber}</span>
                                    <button onClick={() => removeEpisode(sIdx, eIdx)} className="bg-red-500/20 text-pink-500 p-1.5 rounded-lg hover:bg-red-500/40 transition-all">
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                  <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-[#D1C4E9] w-12 flex-shrink-0">Default</span>
                                      <input value={ep.link} onChange={e => updateEpisodeLink(sIdx, eIdx, e.target.value)}
                                        className={`${inputClass} flex-1 !py-2 !text-xs`} placeholder="Default/480p link" />
                                    </div>
                                    {["link480", "link720", "link1080", "link4k"].map(q => (
                                      <div key={q} className="flex items-center gap-2">
                                        <span className="text-[10px] text-[#D1C4E9] w-12 flex-shrink-0">
                                          {q === "link480" ? "480p" : q === "link720" ? "720p" : q === "link1080" ? "1080p" : "4K"}
                                        </span>
                                        <input value={(ep as any)[q] || ""} onChange={e => updateEpisodeQualityLink(sIdx, eIdx, q, e.target.value)}
                                          className={`${inputClass} flex-1 !py-2 !text-xs`} placeholder={`${q === "link480" ? "480p" : q === "link720" ? "720p" : q === "link1080" ? "1080p" : "4K"} link (optional)`} />
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              ))}
                              <button onClick={() => addEpisode(sIdx)} className={`${btnSecondary} w-full py-2.5 text-xs mt-2`}><Plus size={12} className="mr-1" /> Add Episode</button>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    <button onClick={saveSeries} className={`${btnPrimary} w-full py-4 text-[15px] font-semibold flex items-center justify-center gap-2`}>
                      <Save size={18} /> Save Web Series
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== MOVIES ==================== */}
        {activeSection === "movies" && (
          <div>
            <div className="flex gap-2 overflow-x-auto pb-2.5 mb-4 scrollbar-hide">
              <button onClick={() => setMoviesTab("mv-list")} className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${moviesTab === "mv-list" ? "bg-gradient-to-r from-purple-500 to-purple-800 text-white shadow-[0_4px_15px_rgba(157,78,221,0.4)]" : "bg-[#151521] border border-white/10 text-[#D1C4E9]"}`}>
                All Movies
              </button>
              <button onClick={() => setMoviesTab("mv-add")} className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${moviesTab === "mv-add" ? "bg-gradient-to-r from-purple-500 to-purple-800 text-white shadow-[0_4px_15px_rgba(157,78,221,0.4)]" : "bg-[#151521] border border-white/10 text-[#D1C4E9]"}`}>
                Add New
              </button>
            </div>

            {moviesTab === "mv-list" && (
              <div>
                {moviesData.length === 0 ? (
                  <p className="text-[#957DAD] text-[13px] text-center py-8">No movies yet</p>
                ) : moviesData.map(item => (
                  <div key={item.id} className="bg-[#1A1A2E] border border-white/5 rounded-[14px] p-3.5 mb-3 hover:border-purple-500/30 transition-all">
                    <div className="flex gap-3.5">
                      <img src={item.poster || ""} className="w-20 h-[115px] rounded-[10px] object-cover flex-shrink-0"
                        onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/80x115/1A1A2E/9D4EDD?text=N"; }} />
                      <div className="flex-1 min-w-0">
                        <h4 className="text-sm font-semibold mb-1 truncate">{item.title || "Untitled"}</h4>
                        <p className="text-[11px] text-[#D1C4E9] mb-2">{item.year || "N/A"} • {item.rating || "N/A"}⭐ • {item.language || "N/A"}</p>
                        <p className="text-[11px] text-[#D1C4E9]">{item.category || "Uncategorized"}</p>
                        <div className="flex gap-2 mt-2.5">
                          <button onClick={() => editMovie(item.id)} className={`${btnSecondary} px-3.5 py-2 text-[11px] font-semibold flex items-center gap-1.5`}>
                            <Edit size={12} /> Edit
                          </button>
                          <button onClick={() => deleteMovie(item.id)} className="bg-red-500/20 border border-red-500/30 text-pink-500 px-3.5 py-2 rounded-xl text-[11px] font-semibold flex items-center gap-1.5">
                            <Trash2 size={12} /> Delete
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {moviesTab === "mv-add" && (
              <div>
                <div className={`${glassCard} p-4 mb-4`}>
                  <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2"><Search size={14} className="text-purple-500" /> Search Movie</h3>
                  <div className="flex gap-2.5 mb-3.5">
                    <input value={movieSearch} onChange={e => setMovieSearch(e.target.value)} onKeyDown={e => e.key === "Enter" && searchTMDBMovies()}
                      className={`${inputClass} flex-1`} placeholder="Search movie name..." />
                    <button onClick={searchTMDBMovies} className={`${btnPrimary} px-4 py-3.5`}><Search size={16} /></button>
                  </div>
                  {movieResults.length > 0 && (
                    <div>
                      <p className="text-xs text-[#D1C4E9] mb-2.5">Click to fetch details:</p>
                      <div className="grid grid-cols-3 gap-3">
                        {movieResults.map(item => (
                          <div key={item.id} onClick={() => fetchMovieDetails(item.id)}
                            className="bg-[#1A1A2E] rounded-xl overflow-hidden cursor-pointer border-2 border-transparent hover:border-purple-500 hover:scale-[1.03] transition-all">
                            <img src={item.poster_path ? TMDB_IMG_BASE + "w342" + item.poster_path : ""} className="w-full aspect-[2/3] object-cover"
                              onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/200x300/1A1A2E/9D4EDD?text=No+Image"; }} />
                            <div className="p-2.5">
                              <p className="text-[11px] font-semibold leading-tight line-clamp-2">{item.title}</p>
                              <p className="text-[10px] text-purple-500 mt-1 font-semibold">{item.release_date?.split("-")[0] || "N/A"}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {movieForm && (
                  <>
                    {movieForm.backdrop && (
                      <div className="relative rounded-[14px] overflow-hidden mb-5">
                        <img src={movieForm.backdrop || movieForm.poster} className="w-full aspect-video object-cover" />
                        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-transparent" />
                        <div className="absolute bottom-4 left-4 right-4">
                          <div className="text-lg font-bold">{movieForm.title}</div>
                          <div className="text-xs text-[#D1C4E9] mt-1">{movieForm.year} • {movieForm.rating} ⭐</div>
                        </div>
                      </div>
                    )}

                    <div className={`${glassCard} p-4 mb-4`}>
                      <div className="text-base font-semibold mb-4 flex items-center gap-2.5"><span className="text-purple-500">ℹ️</span> Movie Details</div>
                      {["title", "logo", "poster", "backdrop", "trailer"].map(field => (
                        <div key={field} className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium capitalize">{field === "logo" ? "Title Logo URL" : field === "trailer" ? "Trailer (YouTube Link)" : field.charAt(0).toUpperCase() + field.slice(1) + " URL"}</label>
                          <input value={movieForm[field] || ""} onChange={e => setMovieForm({ ...movieForm, [field]: e.target.value })}
                            className={inputClass} placeholder={`${field}...`} />
                        </div>
                      ))}
                      <div className="grid grid-cols-2 gap-3">
                        <div className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Year</label>
                          <input value={movieForm.year || ""} onChange={e => setMovieForm({ ...movieForm, year: e.target.value })} className={inputClass} placeholder="Year" />
                        </div>
                        <div className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Rating</label>
                          <input value={movieForm.rating || ""} onChange={e => setMovieForm({ ...movieForm, rating: e.target.value })} className={inputClass} placeholder="Rating" />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Language</label>
                        <select value={movieForm.language || "English"} onChange={e => setMovieForm({ ...movieForm, language: e.target.value })} className={selectClass}>
                          {languageOptions.map(l => <option key={l} value={l}>{l}</option>)}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Category</label>
                        <select value={movieForm.category || ""} onChange={e => setMovieForm({ ...movieForm, category: e.target.value })} className={selectClass}>
                          <option value="">Select Category</option>
                          {categoryList.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                        </select>
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Storyline</label>
                        <textarea value={movieForm.storyline || ""} onChange={e => setMovieForm({ ...movieForm, storyline: e.target.value })}
                          className={`${inputClass} min-h-[100px] resize-y`} placeholder="Storyline" />
                      </div>
                      {movieCast.length > 0 && (
                        <div className="mb-4">
                          <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Cast (Auto-fetched)</label>
                          <div className="flex gap-3 overflow-x-auto pb-2.5 scrollbar-hide">
                            {movieCast.map((c, i) => (
                              <div key={i} className="flex-shrink-0 w-[70px] text-center">
                                <img src={c.photo || ""} className="w-[60px] h-[60px] rounded-[10px] object-cover mb-1.5 mx-auto"
                                  onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/60x60/1A1A2E/9D4EDD?text=N"; }} />
                                <p className="text-[10px] font-medium truncate">{c.name}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Movie Link (Manual) <span className="text-purple-500">*</span></label>
                        <input value={movieForm.movieLink || ""} onChange={e => setMovieForm({ ...movieForm, movieLink: e.target.value })}
                          className={inputClass} placeholder="Movie streaming/embed link" />
                      </div>
                      <div className="mb-4">
                        <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Download Link (Manual)</label>
                        <input value={movieForm.downloadLink || ""} onChange={e => setMovieForm({ ...movieForm, downloadLink: e.target.value })}
                          className={inputClass} placeholder="Download link" />
                      </div>
                    </div>

                    <button onClick={saveMovie} className={`${btnPrimary} w-full py-4 text-[15px] font-semibold flex items-center justify-center gap-2`}>
                      <Save size={18} /> Save Movie
                    </button>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* ==================== USERS ==================== */}
        {activeSection === "users" && (
          <div>
            {/* Password Lookup */}
            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                <Search size={14} className="text-purple-500" /> 🔍 User Password Lookup
              </h3>
              <UserPasswordLookup inputClass={inputClass} btnPrimary={btnPrimary} />
            </div>

            <div className={`${glassCard} p-4 mb-4`}>
              <div className="flex justify-between items-center mb-3.5">
                <h3 className="text-sm font-semibold">User Statistics</h3>
                <button onClick={() => toast.info("Users auto-synced!")} className="text-purple-500"><RefreshCw size={16} /></button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 p-4 rounded-xl border border-green-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
                    <span className="text-xs text-green-400">Online</span>
                  </div>
                  <div className="text-2xl font-bold">{onlineUsers}</div>
                </div>
                <div className="bg-red-500/10 p-4 rounded-xl border border-red-500/20">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500" />
                    <span className="text-xs text-red-400">Offline</span>
                  </div>
                  <div className="text-2xl font-bold">{offlineUsers}</div>
                </div>
              </div>
            </div>
            <div className={`${glassCard} p-4`}>
              <h3 className="text-sm font-semibold mb-3.5">All Users</h3>
              {usersData.length === 0 ? (
                <p className="text-[#957DAD] text-[13px] text-center py-5">No users found</p>
              ) : usersData.map(user => (
                <div key={user.id} className="bg-[#1A1A2E] rounded-xl p-3.5 flex items-center gap-3 mb-2.5 border border-white/5">
                  <div className="w-[45px] h-[45px] rounded-full bg-gradient-to-br from-purple-500 to-purple-800 flex items-center justify-center font-bold text-lg">
                    {(user.name || user.email || "U")[0].toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold">{user.name || "Anonymous"}</p>
                    <p className="text-[11px] text-[#D1C4E9] truncate">{user.email || user.id.substring(0, 20)}...</p>
                  </div>
                  <div className={`w-2.5 h-2.5 rounded-full ${user.online ? "bg-green-500 animate-pulse" : "bg-red-500"}`} />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== NOTIFICATIONS ==================== */}
        {activeSection === "notifications" && (
          <div>
            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                <Bell size={14} className="text-purple-500" /> Send Notification to Users
              </h3>
              <div className="mb-4">
                <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Notification Title</label>
                <input value={notifTitle} onChange={e => setNotifTitle(e.target.value)} className={inputClass} placeholder="Enter notification title" />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Notification Message</label>
                <textarea value={notifMessage} onChange={e => setNotifMessage(e.target.value)}
                  className={`${inputClass} min-h-[80px] resize-y`} placeholder="Enter notification message" rows={3} />
              </div>
              <div className="mb-4">
                <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Select Content (Optional)</label>
                <select value={notifContent} onChange={e => setNotifContent(e.target.value)} className={selectClass}>
                  <option value="">No specific content</option>
                  {contentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Notification Type</label>
                <select value={notifType} onChange={e => setNotifType(e.target.value)} className={selectClass}>
                  <option value="info">Info</option>
                  <option value="new_episode">New Episode</option>
                  <option value="update">Update</option>
                  <option value="announcement">Announcement</option>
                </select>
              </div>
              <div className="mb-4">
                <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Send to</label>
                <select value={notifTarget} onChange={e => setNotifTarget(e.target.value)} className={selectClass}>
                  <option value="all">All Users</option>
                  <option value="online">Online Users Only</option>
                </select>
              </div>
              <button onClick={sendNotification} className={`${btnPrimary} w-full py-4 text-[15px] font-semibold flex items-center justify-center gap-2 mt-2.5`}>
                <Send size={18} /> Send Notification
              </button>
            </div>

            <div className={`${glassCard} p-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                <RefreshCw size={14} className="text-purple-500" /> Recent Notifications
              </h3>
              {notificationsData.length === 0 ? (
                <p className="text-[#957DAD] text-[13px] text-center py-5">No notifications sent yet</p>
              ) : notificationsData.slice(0, 10).map(notif => (
                <div key={`${notif.userId}-${notif.id}`} className="bg-[#1A1A2E] border border-purple-500/30 rounded-xl p-4 mb-3">
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <span className="bg-gradient-to-r from-pink-500 to-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-[10px] inline-flex items-center gap-1">
                        <Bell size={10} /> {notif.type}
                      </span>
                      <span className="text-[11px] text-[#957DAD] ml-2.5">{formatTime(notif.timestamp)}</span>
                    </div>
                    <button onClick={() => deleteNotification(notif.userId, notif.id)} className="text-[#957DAD] hover:text-red-400 transition-colors">
                      <X size={14} />
                    </button>
                  </div>
                  <h4 className="text-[13px] font-semibold mb-1.5">{notif.title}</h4>
                  <p className="text-xs text-[#D1C4E9]">{notif.message}</p>
                  {notif.contentId && (
                    <div className="mt-2 text-[11px] text-purple-500 flex items-center gap-1">
                      <Link size={10} /> Linked to content
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ==================== NEW RELEASES ==================== */}
        {activeSection === "new-releases" && (
          <div>
            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                <Zap size={14} className="text-pink-500" /> Manage New Episode Releases
              </h3>
              <div className="mb-4">
                <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Select Content to Add as New Release</label>
                <select value={releaseContent} onChange={e => handleReleaseContentChange(e.target.value)} className={selectClass}>
                  <option value="">Select Content</option>
                  {contentOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              {showSeasonEpisode && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="mb-4">
                      <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Season</label>
                      <select value={releaseSeason} onChange={e => handleReleaseSeasonChange(e.target.value)} className={selectClass}>
                        <option value="">Select Season</option>
                        {releaseSeasons.map(s => <option key={s.index} value={s.index}>{s.name}</option>)}
                      </select>
                    </div>
                    <div className="mb-4">
                      <label className="block text-xs text-[#D1C4E9] mb-2 font-medium">Episode</label>
                      <select value={releaseEpisode} onChange={e => setReleaseEpisode(e.target.value)} className={selectClass}>
                        <option value="">Select Episode</option>
                        {releaseEpisodes.map(ep => <option key={ep.index} value={ep.index}>{ep.name}</option>)}
                      </select>
                    </div>
                  </div>
                  <button onClick={addNewRelease} className={`${btnPrimary} w-full py-4 text-[15px] font-semibold flex items-center justify-center gap-2 mt-2.5`}>
                    <Plus size={18} /> Add as New Episode Release
                  </button>
                </>
              )}
            </div>

            <div className={`${glassCard} p-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                📋 Active New Releases
              </h3>
              {releasesData.length === 0 ? (
                <p className="text-[#957DAD] text-[13px] text-center py-5">No new releases yet</p>
              ) : releasesData.map(release => {
                let episodeText = "";
                if (release.episodeInfo) {
                  episodeText = release.episodeInfo.type === "movie" ? "Movie" : `${release.episodeInfo.seasonName} - Episode ${release.episodeInfo.episodeNumber}`;
                }
                return (
                  <div key={release.id} className="bg-[#1A1A2E] border border-purple-500/30 rounded-xl p-4 mb-3">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <span className="bg-gradient-to-r from-pink-500 to-pink-600 text-white text-[10px] font-bold px-2 py-0.5 rounded-[10px] inline-flex items-center gap-1">
                          <Zap size={10} /> NEW
                        </span>
                        <span className="text-[11px] text-[#957DAD] ml-2.5">{formatTime(release.timestamp)}</span>
                      </div>
                      <div className="flex gap-1.5">
                        <button onClick={() => toggleReleaseStatus(release.id, release.active)} className={`${release.active ? "text-purple-500" : "text-[#957DAD]"}`}>
                          {release.active ? <Eye size={14} /> : <EyeOff size={14} />}
                        </button>
                        <button onClick={() => deleteRelease(release.id)} className="text-[#957DAD] hover:text-red-400 transition-colors">
                          <X size={14} />
                        </button>
                      </div>
                    </div>
                    <div className="flex gap-3 items-center">
                      <img src={release.poster || ""} className="w-[50px] h-[75px] rounded-lg object-cover"
                        onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/50x75/1A1A2E/9D4EDD?text=N"; }} />
                      <div className="flex-1">
                        <h4 className="text-[13px] font-semibold mb-1">{release.title || "Untitled"}</h4>
                        <p className="text-[11px] text-[#D1C4E9]">{release.year || "N/A"} • {release.rating || "N/A"}★</p>
                        {episodeText && <p className="text-[11px] text-pink-500 mt-0.5">{episodeText}</p>}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ==================== TMDB FETCH ==================== */}
        {activeSection === "tmdb-fetch" && (
          <div>
            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                <CloudDownload size={14} className="text-purple-500" /> Quick TMDB Fetch by ID
              </h3>
              <div className="flex gap-2 mb-3.5">
                <button onClick={() => setFetchType("movie")} className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${fetchType === "movie" ? "bg-gradient-to-r from-purple-500 to-purple-800 text-white" : "bg-[#151521] border border-white/10 text-[#D1C4E9]"}`}>
                  Movie
                </button>
                <button onClick={() => setFetchType("tv")} className={`flex-shrink-0 px-5 py-2.5 rounded-full text-[13px] font-medium transition-all ${fetchType === "tv" ? "bg-gradient-to-r from-purple-500 to-purple-800 text-white" : "bg-[#151521] border border-white/10 text-[#D1C4E9]"}`}>
                  TV Series
                </button>
              </div>
              <div className="flex gap-2.5">
                <input value={quickTmdbId} onChange={e => setQuickTmdbId(e.target.value)} onKeyDown={e => e.key === "Enter" && quickFetch()}
                  className={`${inputClass} flex-1`} placeholder="Enter TMDB ID" />
                <button onClick={quickFetch} className={`${btnPrimary} px-4 py-3.5`}><Download size={16} /></button>
              </div>
            </div>
          </div>
        )}

        {/* ==================== ADD CONTENT ==================== */}
        {activeSection === "add-content" && (
          <div>
            <div className={`${glassCard} p-6 mb-4`}>
              <h3 className="text-base font-semibold text-center mb-6">What would you like to add?</h3>
              <div className="flex flex-col gap-3">
                {[
                  { icon: <Film size={20} />, label: "Web Series", desc: "Add TV shows with seasons & episodes", action: () => { showSection("webseries"); setSeriesTab("ws-add"); } },
                  { icon: <Video size={20} />, label: "Movie", desc: "Add movies with streaming links", action: () => { showSection("movies"); setMoviesTab("mv-add"); } },
                  { icon: <FolderOpen size={20} />, label: "Category", desc: "Manage content categories", action: () => showSection("categories") },
                ].map((item, i) => (
                  <button key={i} onClick={item.action} className={`${btnSecondary} p-5 rounded-[14px] flex items-center gap-4 text-left`}>
                    <div className="w-[50px] h-[50px] bg-purple-500/20 rounded-xl flex items-center justify-center text-purple-500">{item.icon}</div>
                    <div>
                      <div className="text-[15px] font-semibold">{item.label}</div>
                      <div className="text-[11px] text-[#D1C4E9]">{item.desc}</div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== REDEEM CODES ==================== */}
        {activeSection === "redeem-codes" && (
          <div>
            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                <Shield size={14} className="text-purple-500" /> Generate Redeem Code
              </h3>
              <div className="space-y-3">
                <div>
                  <label className="text-[11px] text-[#D1C4E9] mb-1 block">Duration (Days)</label>
                  <input value={newCodeDays} onChange={e => setNewCodeDays(e.target.value)} className={inputClass} placeholder="30" type="number" />
                </div>
                <div>
                  <label className="text-[11px] text-[#D1C4E9] mb-1 block">Note (Optional)</label>
                  <input value={newCodeNote} onChange={e => setNewCodeNote(e.target.value)} className={inputClass} placeholder="e.g. For user XYZ" />
                </div>
                <button onClick={() => {
                  const days = parseInt(newCodeDays) || 30;
                  const code = "RS-" + Math.random().toString(36).substring(2, 8).toUpperCase() + "-" + Math.random().toString(36).substring(2, 6).toUpperCase();
                  const codeData = {
                    code,
                    days,
                    note: newCodeNote,
                    used: false,
                    usedBy: null,
                    createdAt: Date.now(),
                  };
                  set(push(ref(db, "redeemCodes")), codeData)
                    .then(() => { toast.success(`Code generated: ${code}`); setNewCodeNote(""); })
                    .catch(err => toast.error("Error: " + err.message));
                }} className={`${btnPrimary} w-full py-3.5 flex items-center justify-center gap-2`}>
                  <PlusCircle size={16} /> Generate Code
                </button>
              </div>
            </div>

            <div className={`${glassCard} p-4`}>
              <h3 className="text-sm font-semibold mb-3.5">All Codes ({redeemCodesData.length})</h3>
              <div className="space-y-2.5">
                {redeemCodesData.length === 0 && <p className="text-center text-[#957DAD] text-sm py-6">No redeem codes yet</p>}
                {redeemCodesData.sort((a, b) => b.createdAt - a.createdAt).map(code => (
                  <div key={code.id} className={`p-3 rounded-xl border transition-all ${code.used ? "bg-red-500/10 border-red-500/30" : "bg-green-500/10 border-green-500/30"}`}>
                    <div className="flex justify-between items-start mb-1.5">
                      <span className="text-sm font-mono font-bold tracking-wider">{code.code}</span>
                      <div className="flex gap-1.5">
                        <button onClick={() => { navigator.clipboard.writeText(code.code); toast.success("Copied!"); }}
                          className="text-[10px] bg-purple-500/20 px-2 py-1 rounded-full hover:bg-purple-500/40 transition-all">Copy</button>
                        <button onClick={() => { if (confirm("Delete this code?")) remove(ref(db, `redeemCodes/${code.id}`)).then(() => toast.success("Deleted")); }}
                          className="text-[10px] bg-red-500/20 px-2 py-1 rounded-full hover:bg-red-500/40 transition-all text-red-400">
                          <Trash2 size={10} />
                        </button>
                      </div>
                    </div>
                    <div className="text-[10px] text-[#D1C4E9] space-y-0.5">
                      <p>{code.days} days • {code.used ? `Used by ${code.usedBy}` : "Available"}</p>
                      {code.note && <p>Note: {code.note}</p>}
                      <p>{formatTime(code.createdAt)}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ==================== FREE ACCESS USERS ==================== */}
        {activeSection === "free-access" && (
          <div>
            <div className={`${glassCard} p-4 mb-4`}>
              <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
                <Eye size={14} className="text-green-500" /> Active Free Access Users ({freeAccessUsers.length})
              </h3>
              <p className="text-[11px] text-[#D1C4E9] mb-4">
                যারা AroLinks অ্যাড গেট দিয়ে ফ্রী ২৪ ঘন্টার এক্সেস নিয়েছে তাদের লিস্ট। এক্সেস শেষ হলে স্বয়ংক্রিয়ভাবে মুছে যাবে।
              </p>
              {freeAccessUsers.length === 0 ? (
                <p className="text-[#957DAD] text-[13px] text-center py-8">কোনো অ্যাক্টিভ ফ্রী এক্সেস ইউজার নেই</p>
              ) : (
                <div className="space-y-2.5">
                  {freeAccessUsers.map((user) => {
                    const remaining = user.expiresAt - Date.now();
                    const hours = Math.floor(remaining / 3600000);
                    const minutes = Math.floor((remaining % 3600000) / 60000);
                    return (
                      <div key={user.id} className="bg-[#1A1A2E] border border-green-500/20 rounded-xl p-4">
                        <div className="flex items-center gap-3">
                          <div className="w-[42px] h-[42px] rounded-full bg-gradient-to-br from-green-500 to-green-700 flex items-center justify-center font-bold text-lg flex-shrink-0">
                            {(user.name || "U")[0].toUpperCase()}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold truncate">{user.name || "Unknown"}</p>
                            <p className="text-[11px] text-[#D1C4E9] truncate">{user.email || "No email"}</p>
                          </div>
                          <div className="text-right flex-shrink-0">
                            <div className="bg-green-500/15 border border-green-500/30 px-2.5 py-1 rounded-full">
                              <span className="text-[11px] font-bold text-green-400">{hours}h {minutes}m</span>
                            </div>
                          </div>
                        </div>
                        <div className="mt-2.5 flex justify-between items-center text-[10px] text-[#957DAD]">
                          <span>আনলক: {new Date(user.unlockedAt).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                          <span>শেষ: {new Date(user.expiresAt).toLocaleString("bn-BD", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}

        {/* ==================== MAINTENANCE ==================== */}
        {activeSection === "maintenance" && (
          <MaintenanceSection
            glassCard={glassCard}
            inputClass={inputClass}
            btnPrimary={btnPrimary}
            maintenanceActive={maintenanceActive}
            currentMaintenance={currentMaintenance}
            maintenanceMessage={maintenanceMessage}
            setMaintenanceMessage={setMaintenanceMessage}
            maintenanceResumeDate={maintenanceResumeDate}
            setMaintenanceResumeDate={setMaintenanceResumeDate}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <nav className="fixed bottom-0 left-0 right-0 h-[65px] bg-gradient-to-t from-[rgba(15,15,26,0.98)] to-[rgba(15,15,26,0.95)] border-t border-purple-500/20 flex items-center justify-around z-[100] px-2.5">
        {[
          { section: "dashboard" as Section, icon: <LayoutDashboard size={20} />, label: "Dashboard" },
          { section: "webseries" as Section, icon: <Film size={20} />, label: "Series" },
          { section: "movies" as Section, icon: <Video size={20} />, label: "Movies" },
          { section: "notifications" as Section, icon: <Bell size={20} />, label: "Notify" },
        ].map(item => (
          <div key={item.section} onClick={() => showSection(item.section)}
            className={`flex flex-col items-center gap-1 py-2 px-4 cursor-pointer relative transition-all ${
              activeSection === item.section ? "text-purple-500" : "text-[#957DAD]"
            }`}>
            {activeSection === item.section && <div className="absolute -top-px left-1/2 -translate-x-1/2 w-[30px] h-[3px] bg-gradient-to-r from-purple-500 to-purple-800 rounded-b" />}
            {item.icon}
            <span className="text-[10px] font-medium">{item.label}</span>
          </div>
        ))}
      </nav>
    </div>
  );
};

// Maintenance Section sub-component
const MaintenanceSection = ({
  glassCard, inputClass, btnPrimary, maintenanceActive, currentMaintenance,
  maintenanceMessage, setMaintenanceMessage, maintenanceResumeDate, setMaintenanceResumeDate,
}: {
  glassCard: string; inputClass: string; btnPrimary: string; maintenanceActive: boolean;
  currentMaintenance: any; maintenanceMessage: string; setMaintenanceMessage: (v: string) => void;
  maintenanceResumeDate: string; setMaintenanceResumeDate: (v: string) => void;
}) => {
  const [countdown, setCountdown] = useState("");
  const [hasCountdown, setHasCountdown] = useState(false);

  useEffect(() => {
    if (!currentMaintenance?.active || !currentMaintenance?.resumeDate) {
      setHasCountdown(false);
      setCountdown("");
      return;
    }

    const updateCountdown = () => {
      const resumeTime = new Date(currentMaintenance.resumeDate).getTime() + 86400000; // end of that day
      const diff = resumeTime - Date.now();
      if (diff <= 0) {
        // Auto turn on server - extend timers first
        const duration = currentMaintenance?.startedAt ? Date.now() - currentMaintenance.startedAt : 0;
        if (duration > 0) extendAllUserTimers(duration);
        update(ref(db, "maintenance"), { active: false, resumeDate: null })
          .then(() => toast.success("Server auto-started! ✅"))
          .catch(() => {});
        setHasCountdown(false);
        setCountdown("");
        return;
      }
      setHasCountdown(true);
      const d = Math.floor(diff / 86400000);
      const h = Math.floor((diff % 86400000) / 3600000);
      const m = Math.floor((diff % 3600000) / 60000);
      const s = Math.floor((diff % 60000) / 1000);
      if (d > 0) setCountdown(`${d}d ${h.toString().padStart(2, "0")}h ${m.toString().padStart(2, "0")}m ${s.toString().padStart(2, "0")}s`);
      else setCountdown(`${h.toString().padStart(2, "0")}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`);
    };

    updateCountdown();
    const interval = setInterval(updateCountdown, 1000);
    return () => clearInterval(interval);
  }, [currentMaintenance]);

  const handleShutdown = () => {
    if (!maintenanceMessage.trim()) { toast.error("Please enter a message"); return; }
    if (confirm("Shut down the server? All users will be blocked!")) {
      update(ref(db, "maintenance"), {
        active: true,
        message: maintenanceMessage,
        resumeDate: maintenanceResumeDate || null,
        startedAt: Date.now(),
      }).then(() => toast.success("Server shut down!"))
        .catch(err => toast.error("Error: " + err.message));
    }
  };

  const extendAllUserTimers = async (duration: number) => {
    try {
      // Extend premium users' expiresAt
      const usersSnap = await get(ref(db, "users"));
      if (usersSnap.exists()) {
        const allUsers = usersSnap.val();
        const updates: Record<string, any> = {};
        Object.entries(allUsers).forEach(([uid, userData]: [string, any]) => {
          if (userData?.premium?.active && userData?.premium?.expiresAt) {
            updates[`users/${uid}/premium/expiresAt`] = userData.premium.expiresAt + duration;
          }
        });
        if (Object.keys(updates).length > 0) {
          await update(ref(db), updates);
          toast.success(`Extended ${Object.keys(updates).length} premium user(s) timers!`);
        }
      }
      // Store last maintenance info for client-side free access adjustment
      await update(ref(db, "maintenance"), {
        lastPauseDuration: duration,
        lastResumedAt: Date.now(),
      });
    } catch (err: any) {
      toast.error("Error extending timers: " + err.message);
    }
  };

  const handleStartNow = async () => {
    if (confirm("Start the server immediately?")) {
      const duration = currentMaintenance?.startedAt ? Date.now() - currentMaintenance.startedAt : 0;
      if (duration > 0) await extendAllUserTimers(duration);
      update(ref(db, "maintenance"), { active: false, resumeDate: null })
        .then(() => { toast.success("Server is online! ✅"); setMaintenanceResumeDate(""); })
        .catch(err => toast.error("Error: " + err.message));
    }
  };

  return (
    <div>
      <div className={`${glassCard} p-4 mb-4`}>
        <h3 className="text-sm font-semibold mb-3.5 flex items-center gap-2">
          <Power size={14} className={maintenanceActive ? "text-red-500" : "text-green-500"} />
          Server Status: {maintenanceActive ? "🔴 Offline (Maintenance)" : "🟢 Online"}
        </h3>

        {currentMaintenance?.active && (
          <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-4 mb-4">
            <p className="text-sm text-red-400 font-medium mb-1">Server is currently offline</p>
            <p className="text-xs text-[#D1C4E9]">{currentMaintenance.message}</p>
            {currentMaintenance.resumeDate && (
              <p className="text-xs text-yellow-400 mt-1">
                Resume Date: {new Date(currentMaintenance.resumeDate).toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}
              </p>
            )}

            {/* Countdown Timer */}
            {hasCountdown && countdown && (
              <div className="mt-3 p-3 bg-yellow-500/10 border border-yellow-500/30 rounded-xl text-center">
                <p className="text-[10px] text-yellow-400 uppercase tracking-wider mb-1">Auto-start in</p>
                <p className="text-2xl font-bold font-mono text-yellow-300 tracking-wider">{countdown}</p>
              </div>
            )}

            {/* Start Server Now Button */}
            <button onClick={handleStartNow}
              className="w-full mt-3 py-3 bg-gradient-to-r from-green-600 to-green-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(34,197,94,0.3)] hover:shadow-[0_6px_25px_rgba(34,197,94,0.5)] transition-all">
              <Power size={16} /> Start Server Now
            </button>
          </div>
        )}

        <div className="space-y-3">
          <div>
            <label className="text-[11px] text-[#D1C4E9] mb-1 block">Maintenance Message</label>
            <textarea value={maintenanceMessage} onChange={e => setMaintenanceMessage(e.target.value)}
              className={`${inputClass} min-h-[80px] resize-none`}
              placeholder="Write a message for users..." />
          </div>
          <div>
            <label className="text-[11px] text-[#D1C4E9] mb-1 block">Resume Date</label>
            <input type="date" value={maintenanceResumeDate} onChange={e => setMaintenanceResumeDate(e.target.value)}
              className={inputClass} />
          </div>

          {!maintenanceActive ? (
            <button onClick={handleShutdown}
              className="w-full py-3.5 bg-gradient-to-r from-red-600 to-red-800 text-white font-semibold rounded-xl flex items-center justify-center gap-2 shadow-[0_4px_15px_rgba(239,68,68,0.3)] hover:shadow-[0_6px_25px_rgba(239,68,68,0.5)] transition-all">
              <AlertTriangle size={16} /> Shut Down Server
            </button>
          ) : (
            <button onClick={handleStartNow}
              className={`${btnPrimary} w-full py-3.5 flex items-center justify-center gap-2`}>
              <Power size={16} /> Start Server
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

// User Password Lookup sub-component
const UserPasswordLookup = ({ inputClass, btnPrimary }: { inputClass: string; btnPrimary: string }) => {
  const [searchInput, setSearchInput] = useState("");
  const [searchResult, setSearchResult] = useState<any>(null);
  const [searching, setSearching] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const lookupUser = async () => {
    if (!searchInput.trim()) { toast.error("Enter user email or username"); return; }
    setSearching(true);
    setSearchResult(null);
    setShowPassword(false);
    try {
      const input = searchInput.trim().toLowerCase();
      const commaKey = input.replace(/\./g, ",").replace(/[^a-z0-9@,_-]/g, "_");
      const legacyKey = input.replace(/[^a-z0-9]/g, "_");

      // Search by key
      for (const key of [commaKey, legacyKey]) {
        const snap = await get(ref(db, `appUsers/${key}`));
        if (snap.exists()) {
          setSearchResult({ ...snap.val(), _key: key });
          setSearching(false);
          return;
        }
      }

      // Search by name/email fields
      const allSnap = await get(ref(db, "appUsers"));
      if (allSnap.exists()) {
        const allData = allSnap.val();
        for (const key of Object.keys(allData)) {
          const u = allData[key];
          if (u && typeof u === 'object') {
            const nameMatch = u.name && u.name.toLowerCase() === input;
            const emailMatch = u.email && u.email.toLowerCase() === input;
            if (nameMatch || emailMatch) {
              setSearchResult({ ...u, _key: key });
              setSearching(false);
              return;
            }
          }
        }
      }

      toast.error("User not found!");
    } catch (err: any) { toast.error("Error: " + err.message); }
    setSearching(false);
  };

  return (
    <div>
      <div className="flex gap-2.5 mb-3">
        <input value={searchInput} onChange={e => setSearchInput(e.target.value)}
          onKeyDown={e => e.key === "Enter" && lookupUser()}
          className={`${inputClass} flex-1`} placeholder="Enter email or username" />
        <button onClick={lookupUser} disabled={searching}
          className={`${btnPrimary} px-4 py-3 flex items-center gap-1.5`}>
          {searching ? <RefreshCw size={14} className="animate-spin" /> : <Search size={14} />}
        </button>
      </div>
      {searchResult && (
        <div className="bg-[#1A1A2E] border border-purple-500/30 rounded-xl p-4 mt-3">
          <div className="space-y-2">
            <div className="flex justify-between">
              <span className="text-[11px] text-[#957DAD]">Name:</span>
              <span className="text-[13px] font-medium">{searchResult.name || "N/A"}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-[#957DAD]">Email:</span>
              <span className="text-[13px] font-medium">{searchResult.email || "N/A"}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-[11px] text-[#957DAD]">Password:</span>
              {searchResult.password ? (
                <div className="flex items-center gap-2">
                  <span className="text-[13px] font-mono font-bold text-green-400">
                    {showPassword ? searchResult.password : "••••••••"}
                  </span>
                  <button onClick={() => setShowPassword(!showPassword)}
                    className="text-purple-500 hover:text-purple-400 transition-colors">
                    {showPassword ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => { navigator.clipboard.writeText(searchResult.password); toast.success("Copied!"); }}
                    className="text-[10px] bg-purple-500/20 px-2 py-1 rounded-full hover:bg-purple-500/40 transition-all">Copy</button>
                </div>
              ) : (
                <span className="text-[13px] text-yellow-400">
                  {searchResult.googleAuth ? "Google Login (No password)" : "Password not set"}
                </span>
              )}
            </div>
            <div className="flex justify-between">
              <span className="text-[11px] text-[#957DAD]">ID:</span>
              <span className="text-[11px] font-mono text-[#D1C4E9]">{searchResult.id || searchResult._key}</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Admin;

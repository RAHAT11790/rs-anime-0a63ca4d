import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { initializeApp, getApps } from "firebase/app";
import { db, ref, set, get, update } from "@/lib/firebase";

const firebaseConfig = {
  apiKey: "AIzaSyCP5bfue5FOc0eTO4E52-0A0w3PppO3Mvw",
  authDomain: "rs-anime.firebaseapp.com",
  projectId: "rs-anime",
  storageBucket: "rs-anime.firebasestorage.app",
  messagingSenderId: "843989457516",
  appId: "1:843989457516:web:57e0577d092183eedd9649"
};

const VAPID_KEY = "BILbBN-defkZHL5sGzuTijY5ZOjoOr_dMLbc_BV319ICRD89tODhO5KF5hd_sjwsoMi_BdE49str4lEzTURDXLc";
const SEND_FCM_ENDPOINT = `https://${import.meta.env.VITE_SUPABASE_PROJECT_ID}.supabase.co/functions/v1/send-fcm`;
const APP_ICON_PATH = "/rs-icon.png";
const CHUNK_SIZE = 180;
const CHUNK_CONCURRENCY = 3;
const REQUEST_TIMEOUT_MS = 30000;

let messaging: any = null;

const getMessagingInstance = () => {
  if (messaging) return messaging;
  try {
    const app = getApps().length > 0 ? getApps()[0] : initializeApp(firebaseConfig);
    messaging = getMessaging(app);
    return messaging;
  } catch (err) {
    console.warn("FCM not supported in this browser:", err);
    return null;
  }
};

const getTokenKey = (token: string) => btoa(token).replace(/=+$/g, "");

const chunkArray = <T,>(arr: T[], size: number): T[][] => {
  const chunks: T[][] = [];
  for (let i = 0; i < arr.length; i += size) chunks.push(arr.slice(i, i + size));
  return chunks;
};

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const fetchWithTimeout = async (input: RequestInfo | URL, init: RequestInit, timeoutMs = REQUEST_TIMEOUT_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
};

const requestWithRetry = async (body: unknown, retries = 2): Promise<Response> => {
  let lastError: unknown = null;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetchWithTimeout(SEND_FCM_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        keepalive: true,
      });
      if (res.ok) return res;

      const text = await res.text();
      const retryable = res.status >= 500 || res.status === 429;
      if (!retryable || attempt === retries) {
        throw new Error(text || `Push request failed with ${res.status}`);
      }
      lastError = new Error(text || `Retryable push error ${res.status}`);
    } catch (err) {
      lastError = err;
      if (attempt === retries) break;
    }

    await sleep(350 * Math.pow(2, attempt));
  }

  throw lastError instanceof Error ? lastError : new Error("Push request failed");
};

const cleanupInvalidTokens = async (invalidTokens: string[]) => {
  if (!invalidTokens.length) return 0;
  const invalidSet = new Set(invalidTokens);

  try {
    const snap = await get(ref(db, "fcmTokens"));
    const all = snap.val() || {};
    const updates: Record<string, null> = {};

    Object.entries(all).forEach(([uid, userTokens]: any) => {
      Object.entries(userTokens || {}).forEach(([tokenKey, entry]: any) => {
        if (entry?.token && invalidSet.has(entry.token)) {
          updates[`fcmTokens/${uid}/${tokenKey}`] = null;
        }
      });
    });

    const paths = Object.keys(updates);
    if (paths.length > 0) {
      await update(ref(db), updates);
    }

    return paths.length;
  } catch (err) {
    console.warn("Failed to cleanup invalid FCM tokens:", err);
    return 0;
  }
};

// Register FCM token for a user
export const registerFCMToken = async (userId: string) => {
  try {
    console.log("[FCM] Step 1: Checking messaging support...");
    const msg = getMessagingInstance();
    if (!msg) {
      console.error("[FCM] FAILED: Firebase Messaging not supported in this browser");
      return;
    }
    if (!userId) {
      console.error("[FCM] FAILED: No userId provided");
      return;
    }
    if (!("serviceWorker" in navigator)) {
      console.error("[FCM] FAILED: Service Worker not supported in this browser");
      return;
    }

    console.log("[FCM] Step 2: Registering service worker...");
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;
    console.log("[FCM] Service worker registered, scope:", registration.scope);

    console.log("[FCM] Step 3: Checking notification permission... Current:", Notification.permission);
    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if (permission !== "granted") {
      console.warn("[FCM] STOPPED: Notification permission denied/dismissed:", permission);
      return;
    }
    console.log("[FCM] Permission granted ✓");

    console.log("[FCM] Step 4: Requesting FCM token with VAPID key...");
    console.log("[FCM] VAPID key (first 20 chars):", VAPID_KEY?.substring(0, 20) || "MISSING!");
    
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      console.log("[FCM] Step 5: Token received ✓ (first 20 chars):", token.substring(0, 20));
      console.log("[FCM] Saving to Firebase RTDB path: fcmTokens/" + userId + "/...");
      
      await set(ref(db, `fcmTokens/${userId}/${getTokenKey(token)}`), {
        token,
        updatedAt: Date.now(),
        userAgent: navigator.userAgent.substring(0, 160),
      });
      console.log("[FCM] ✅ Token saved successfully to Firebase RTDB!");
    } else {
      console.error("[FCM] FAILED: getToken() returned null/empty. Possible causes:");
      console.error("[FCM]   1. VAPID key mismatch (check Firebase Console > Cloud Messaging > Web Push certificates)");
      console.error("[FCM]   2. Service worker registration issue");
      console.error("[FCM]   3. Browser doesn't support push messaging");
    }
  } catch (err: any) {
    console.error("[FCM] ❌ Registration failed with error:", err?.message || err);
    console.error("[FCM] Full error:", err);
    
    // Common error explanations
    if (err?.message?.includes("messaging/permission-blocked")) {
      console.error("[FCM] → Browser has blocked notifications for this site");
    } else if (err?.message?.includes("messaging/failed-service-worker-registration")) {
      console.error("[FCM] → Service worker failed to register - check firebase-messaging-sw.js");
    } else if (err?.message?.includes("messaging/token-subscribe-failed")) {
      console.error("[FCM] → Token subscription failed - VAPID key may be incorrect");
    }
  }
};

// Get all FCM tokens for specific user IDs
export const getFCMTokens = async (userIds: string[]): Promise<string[]> => {
  try {
    const snaps = await Promise.all(userIds.map((uid) => get(ref(db, `fcmTokens/${uid}`))));
    const tokens: string[] = [];

    snaps.forEach((snap) => {
      const data = snap.val();
      if (!data) return;
      Object.values(data).forEach((entry: any) => {
        if (entry?.token) tokens.push(entry.token);
      });
    });

    return [...new Set(tokens)];
  } catch (err) {
    console.warn("Failed to get FCM tokens:", err);
    return [];
  }
};

// Get ALL FCM tokens
export const getAllFCMTokens = async (): Promise<string[]> => {
  const tokens: string[] = [];
  try {
    const snap = await get(ref(db, "fcmTokens"));
    const data = snap.val();
    if (data) {
      Object.values(data).forEach((userTokens: any) => {
        Object.values(userTokens).forEach((entry: any) => {
          if (entry?.token) tokens.push(entry.token);
        });
      });
    }
  } catch (err) {
    console.warn("Failed to get all FCM tokens:", err);
  }
  return [...new Set(tokens)];
};

type PushPayload = {
  title: string;
  body: string;
  image?: string;
  url?: string;
  icon?: string;
  badge?: string;
  data?: Record<string, string | number | boolean | null | undefined>;
};

export type PushProgress = {
  phase: "tokens" | "sending" | "cleanup" | "done";
  totalTokens: number;
  sent: number;
  success: number;
  failed: number;
  invalidRemoved: number;
  totalUsers?: number;
};

const normalizePushData = (payload: PushPayload) => {
  const normalizedData: Record<string, string> = {};
  Object.entries(payload.data || {}).forEach(([key, value]) => {
    normalizedData[key] = value == null ? "" : String(value);
  });
  if (payload.url) normalizedData.url = payload.url;
  normalizedData.baseUrl = window.location.origin;
  return normalizedData;
};

export const sendPushToTokens = async (
  tokens: string[],
  payload: PushPayload,
  onProgress?: (progress: PushProgress) => void
) => {
  const cleanTokens = [...new Set(tokens.filter(Boolean))];
  if (cleanTokens.length === 0) return { skipped: true, success: 0, failed: 0 };

  const normalizedData = normalizePushData(payload);

  const progress: PushProgress = {
    phase: "sending",
    totalTokens: cleanTokens.length,
    sent: 0,
    success: 0,
    failed: 0,
    invalidRemoved: 0,
  };
  onProgress?.(progress);

  const chunks = chunkArray(cleanTokens, CHUNK_SIZE);
  let nextIndex = 0;

  const aggregate = {
    success: 0,
    failed: 0,
    invalidTokens: new Set<string>(),
  };

  const worker = async () => {
    while (nextIndex < chunks.length) {
      const current = nextIndex++;
      const chunkTokens = chunks[current];

      try {
        const res = await requestWithRetry({
          tokens: chunkTokens,
          title: payload.title,
          body: payload.body,
          image: payload.image,
          icon: payload.icon || APP_ICON_PATH,
          badge: payload.badge || APP_ICON_PATH,
          data: normalizedData,
        });

        const data = await res.json().catch(() => ({}));
        aggregate.success += Number(data?.success || 0);
        aggregate.failed += Number(data?.failed || 0);

        if (Array.isArray(data?.invalidTokens)) {
          data.invalidTokens.forEach((token: string) => {
            if (token) aggregate.invalidTokens.add(token);
          });
        }
      } catch (err) {
        console.warn(`FCM chunk ${current + 1}/${chunks.length} failed:`, err);
        aggregate.failed += chunkTokens.length;
      }

      progress.sent = Math.min(cleanTokens.length, (current + 1) * CHUNK_SIZE);
      progress.success = aggregate.success;
      progress.failed = aggregate.failed;
      onProgress?.({ ...progress });
    }
  };

  await Promise.all(Array.from({ length: Math.min(CHUNK_CONCURRENCY, chunks.length) }, () => worker()));

  const invalidTokenList = [...aggregate.invalidTokens];
  progress.phase = "cleanup";
  onProgress?.({ ...progress });

  const removedInvalid = await cleanupInvalidTokens(invalidTokenList);

  progress.phase = "done";
  progress.invalidRemoved = removedInvalid;
  progress.sent = cleanTokens.length;
  progress.success = aggregate.success;
  progress.failed = aggregate.failed;
  onProgress?.({ ...progress });

  return {
    success: aggregate.success,
    failed: aggregate.failed,
    total: cleanTokens.length,
    invalidTokensRemoved: removedInvalid,
  };
};

export const sendPushToUsers = async (
  userIds: string[],
  payload: PushPayload,
  onProgress?: (progress: PushProgress) => void
) => {
  const uniqueUserIds = [...new Set(userIds.filter(Boolean))];
  const normalizedData = normalizePushData(payload);

  onProgress?.({
    phase: "tokens",
    totalTokens: 0,
    sent: 0,
    success: 0,
    failed: 0,
    invalidRemoved: 0,
    totalUsers: uniqueUserIds.length,
  });

  if (uniqueUserIds.length === 0) {
    onProgress?.({ phase: "done", totalTokens: 0, sent: 0, success: 0, failed: 0, invalidRemoved: 0, totalUsers: 0 });
    return { skipped: true, success: 0, failed: 0, total: 0, invalidTokensRemoved: 0, reason: "NO_TARGET_USERS" };
  }

  // Show "sending" phase while waiting for server response
  onProgress?.({
    phase: "sending",
    totalTokens: uniqueUserIds.length, // estimate until actual token count arrives
    sent: 0,
    success: 0,
    failed: 0,
    invalidRemoved: 0,
    totalUsers: uniqueUserIds.length,
  });

  let data: any = {};
  try {
    const res = await requestWithRetry({
      userIds: uniqueUserIds,
      title: payload.title,
      body: payload.body,
      image: payload.image,
      icon: payload.icon || APP_ICON_PATH,
      badge: payload.badge || APP_ICON_PATH,
      data: normalizedData,
    });
    data = await res.json().catch(() => ({}));
  } catch (err) {
    console.warn("Push request failed:", err);
    onProgress?.({ phase: "done", totalTokens: 0, sent: 0, success: 0, failed: uniqueUserIds.length, invalidRemoved: 0, totalUsers: uniqueUserIds.length });
    return {
      skipped: false,
      success: 0,
      failed: uniqueUserIds.length,
      total: 0,
      invalidTokensRemoved: 0,
      reason: "REQUEST_FAILED",
      error: err instanceof Error ? err.message : "Unknown request error",
    };
  }

  const totalTokens = Number(data?.totalTokens || (Number(data?.success || 0) + Number(data?.failed || 0)));
  const success = Number(data?.success || 0);
  const failed = Number(data?.failed || 0);
  const invalidRemoved = Number(data?.invalidRemoved || 0);
  const reason = typeof data?.reason === "string" ? data.reason : undefined;
  const details = data?.details;

  onProgress?.({
    phase: "done",
    totalTokens,
    sent: totalTokens,
    success,
    failed,
    invalidRemoved,
    totalUsers: uniqueUserIds.length,
  });

  return {
    success,
    failed,
    total: totalTokens,
    invalidTokensRemoved: invalidRemoved,
    skipped: totalTokens === 0 && success === 0,
    reason,
    details,
  };
};

// Listen for foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  const msg = getMessagingInstance();
  if (!msg) return () => {};
  return onMessage(msg, callback);
};

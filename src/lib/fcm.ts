import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { initializeApp, getApps } from "firebase/app";
import { db, ref, set, get } from "@/lib/firebase";

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

// Register FCM token for a user
export const registerFCMToken = async (userId: string) => {
  try {
    const msg = getMessagingInstance();
    if (!msg || !userId || !("serviceWorker" in navigator)) return;

    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js", { scope: "/" });
    await navigator.serviceWorker.ready;

    const permission = Notification.permission === "granted"
      ? "granted"
      : await Notification.requestPermission();

    if (permission !== "granted") return;

    const token = await getToken(msg, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      await set(ref(db, `fcmTokens/${userId}/${getTokenKey(token)}`), {
        token,
        updatedAt: Date.now(),
        userAgent: navigator.userAgent.substring(0, 160),
      });
      console.log("FCM token registered");
    }
  } catch (err) {
    console.warn("FCM registration failed:", err);
  }
};

// Get all FCM tokens for specific user IDs
export const getFCMTokens = async (userIds: string[]): Promise<string[]> => {
  const tokens: string[] = [];
  try {
    for (const uid of userIds) {
      const snap = await get(ref(db, `fcmTokens/${uid}`));
      const data = snap.val();
      if (data) {
        Object.values(data).forEach((entry: any) => {
          if (entry?.token) tokens.push(entry.token);
        });
      }
    }
  } catch (err) {
    console.warn("Failed to get FCM tokens:", err);
  }
  return [...new Set(tokens)];
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
  data?: Record<string, string | number | boolean | null | undefined>;
};

export const sendPushToTokens = async (tokens: string[], payload: PushPayload) => {
  const cleanTokens = [...new Set(tokens.filter(Boolean))];
  if (cleanTokens.length === 0) return { skipped: true };

  const normalizedData: Record<string, string> = {};
  Object.entries(payload.data || {}).forEach(([key, value]) => {
    normalizedData[key] = value == null ? "" : String(value);
  });
  if (payload.url) normalizedData.url = payload.url;

  const res = await fetch(SEND_FCM_ENDPOINT, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      tokens: cleanTokens,
      title: payload.title,
      body: payload.body,
      image: payload.image,
      data: normalizedData,
    }),
    keepalive: true,
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || "Failed to send push notification");
  }

  return res.json();
};

export const sendPushToUsers = async (userIds: string[], payload: PushPayload) => {
  const tokens = await getFCMTokens(userIds);
  if (tokens.length === 0) return { skipped: true };
  return sendPushToTokens(tokens, payload);
};

// Listen for foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  const msg = getMessagingInstance();
  if (!msg) return () => {};
  return onMessage(msg, callback);
};

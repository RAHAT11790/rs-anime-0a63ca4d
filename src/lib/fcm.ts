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

// VAPID key - you need to generate this from Firebase Console > Cloud Messaging > Web Push certificates
// For now we'll use the FCM auto-generated key
const VAPID_KEY = ""; // Will be set below

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

// Register FCM token for a user
export const registerFCMToken = async (userId: string) => {
  try {
    const msg = getMessagingInstance();
    if (!msg) return;

    // Register the firebase messaging service worker
    const registration = await navigator.serviceWorker.register("/firebase-messaging-sw.js");

    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;

    // Get FCM token
    const token = await getToken(msg, {
      vapidKey: VAPID_KEY || undefined,
      serviceWorkerRegistration: registration,
    });

    if (token) {
      // Store token in Firebase under user's fcmTokens
      await set(ref(db, `fcmTokens/${userId}/${token.substring(0, 20)}`), {
        token,
        updatedAt: Date.now(),
        userAgent: navigator.userAgent.substring(0, 100),
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
          if (entry.token) tokens.push(entry.token);
        });
      }
    }
  } catch (err) {
    console.warn("Failed to get FCM tokens:", err);
  }
  return tokens;
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
          if (entry.token) tokens.push(entry.token);
        });
      });
    }
  } catch (err) {
    console.warn("Failed to get all FCM tokens:", err);
  }
  return tokens;
};

// Listen for foreground messages
export const onForegroundMessage = (callback: (payload: any) => void) => {
  const msg = getMessagingInstance();
  if (!msg) return () => {};
  return onMessage(msg, callback);
};

import { db, ref, get, set, update, remove } from "@/lib/firebase";

type PremiumDeviceEntry = {
  name?: string;
  type?: string;
  registeredAt?: number;
  lastSeen?: number;
  fingerprint?: string;
};

const DEVICE_ID_KEY = "rs_device_id";
const SESSION_KEYS_TO_CLEAR = ["rsanime_user", "rs_display_name", "rs_profile_photo", "rs_photo_url"];

const getFirstDeviceLocalKey = (userId: string) => `rs_first_device_${userId}`;

const hashText = (input: string): string => {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash.toString(36);
};

export const getDeviceFingerprint = (): string => {
  try {
    const screenSize = typeof window !== "undefined" && window.screen
      ? `${window.screen.width}x${window.screen.height}`
      : "unknown";
    const raw = `${navigator.userAgent}|${navigator.platform}|${navigator.language}|${screenSize}`;
    return `fp_${hashText(raw)}`;
  } catch {
    return "fp_unknown";
  }
};

// Generate a persistent device fingerprint
export const getDeviceId = (): string => {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing) return existing;
  } catch {}

  const id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
  try {
    localStorage.setItem(DEVICE_ID_KEY, id);
  } catch {}
  return id;
};

export const clearLocalAccountSession = (): void => {
  try {
    SESSION_KEYS_TO_CLEAR.forEach((key) => localStorage.removeItem(key));
  } catch {}
};

// Get device type info
export const getDeviceInfo = (): { type: string; name: string } => {
  const ua = navigator.userAgent;
  let type = "desktop";
  let name = "Unknown Device";

  if (/iPhone/i.test(ua)) {
    type = "mobile";
    name = "iPhone";
  } else if (/iPad/i.test(ua)) {
    type = "tablet";
    name = "iPad";
  } else if (/Android/i.test(ua)) {
    type = /Mobile/i.test(ua) ? "mobile" : "tablet";
    const match = ua.match(/;\s*([^;)]+)\s+Build/);
    name = match ? match[1].trim() : "Android Device";
  } else if (/Windows/i.test(ua)) {
    name = "Windows PC";
  } else if (/Mac/i.test(ua)) {
    name = "Mac";
  } else if (/Linux/i.test(ua)) {
    name = "Linux PC";
  }

  return { type, name };
};

const getDevicesSorted = (devices: Record<string, PremiumDeviceEntry>) =>
  Object.entries(devices).sort(([, a], [, b]) => (a?.registeredAt || 0) - (b?.registeredAt || 0));

const getMatchedDeviceId = (
  devices: Record<string, PremiumDeviceEntry>,
  currentDeviceId: string,
  currentFingerprint: string,
): string | null => {
  if (devices[currentDeviceId]) return currentDeviceId;
  const byFingerprint = Object.entries(devices).find(([, d]) => d?.fingerprint && d.fingerprint === currentFingerprint);
  return byFingerprint?.[0] || null;
};

const ensureFirstDeviceId = async (
  userId: string,
  existingFirstDeviceId: string | null,
  devices: Record<string, PremiumDeviceEntry>,
): Promise<string | null> => {
  const firstFromDevices = getDevicesSorted(devices)[0]?.[0] || null;
  const finalFirst = existingFirstDeviceId || firstFromDevices;
  if (finalFirst && finalFirst !== existingFirstDeviceId) {
    await update(ref(db, `users/${userId}/premium`), { firstDeviceId: finalFirst });
  }
  return finalFirst;
};

// Register current device for a user's premium
export const registerDevice = async (
  userId: string,
): Promise<{ success: boolean; exceeded: boolean; maxDevices: number; currentCount: number }> => {
  const deviceId = getDeviceId();
  const deviceInfo = getDeviceInfo();
  const fingerprint = getDeviceFingerprint();

  const premSnap = await get(ref(db, `users/${userId}/premium`));
  const premData = premSnap.val();
  if (!premData || !premData.active || premData.expiresAt <= Date.now()) {
    return { success: false, exceeded: false, maxDevices: 0, currentCount: 0 };
  }

  const maxDevices = Math.max(1, Number(premData.maxDevices) || 1);
  const devices: Record<string, PremiumDeviceEntry> = { ...(premData.devices || {}) };

  const matchedDeviceId = getMatchedDeviceId(devices, deviceId, fingerprint);

  // If same physical device got a new local ID, migrate the key once
  if (matchedDeviceId && matchedDeviceId !== deviceId) {
    const oldData = devices[matchedDeviceId] || {};
    await set(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
      ...oldData,
      name: deviceInfo.name,
      type: deviceInfo.type,
      fingerprint,
      lastSeen: Date.now(),
      registeredAt: oldData.registeredAt || Date.now(),
    });
    await remove(ref(db, `users/${userId}/premium/devices/${matchedDeviceId}`));

    delete devices[matchedDeviceId];
    devices[deviceId] = {
      ...oldData,
      name: deviceInfo.name,
      type: deviceInfo.type,
      fingerprint,
      lastSeen: Date.now(),
      registeredAt: oldData.registeredAt || Date.now(),
    };

    if (premData.firstDeviceId === matchedDeviceId) {
      await update(ref(db, `users/${userId}/premium`), { firstDeviceId: deviceId });
      try {
        localStorage.setItem(getFirstDeviceLocalKey(userId), deviceId);
      } catch {}
    }

    return { success: true, exceeded: false, maxDevices, currentCount: Object.keys(devices).length };
  }

  // Already registered -> just refresh
  if (devices[deviceId]) {
    await update(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
      lastSeen: Date.now(),
      name: deviceInfo.name,
      type: deviceInfo.type,
      fingerprint,
    });

    const firstDeviceId = await ensureFirstDeviceId(userId, premData.firstDeviceId || null, devices);
    if (firstDeviceId === deviceId) {
      try {
        localStorage.setItem(getFirstDeviceLocalKey(userId), deviceId);
      } catch {}
    }

    return { success: true, exceeded: false, maxDevices, currentCount: Object.keys(devices).length };
  }

  const deviceCount = Object.keys(devices).length;
  if (deviceCount >= maxDevices) {
    return { success: false, exceeded: true, maxDevices, currentCount: deviceCount };
  }

  // Register new device
  await set(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
    name: deviceInfo.name,
    type: deviceInfo.type,
    registeredAt: Date.now(),
    lastSeen: Date.now(),
    fingerprint,
  });

  const nextDevices = {
    ...devices,
    [deviceId]: {
      name: deviceInfo.name,
      type: deviceInfo.type,
      registeredAt: Date.now(),
      lastSeen: Date.now(),
      fingerprint,
    },
  };

  const firstDeviceId = await ensureFirstDeviceId(userId, premData.firstDeviceId || null, nextDevices);
  if (!firstDeviceId || firstDeviceId === deviceId) {
    await update(ref(db, `users/${userId}/premium`), { firstDeviceId: deviceId });
    try {
      localStorage.setItem(getFirstDeviceLocalKey(userId), deviceId);
    } catch {}
  }

  return { success: true, exceeded: false, maxDevices, currentCount: deviceCount + 1 };
};

// Check if current device is allowed (without registering)
export const checkDeviceAccess = async (userId: string): Promise<{
  allowed: boolean;
  isPremium: boolean;
  exceeded: boolean;
  maxDevices: number;
  currentCount: number;
  isFirstDevice: boolean;
}> => {
  const deviceId = getDeviceId();
  const fingerprint = getDeviceFingerprint();

  const premSnap = await get(ref(db, `users/${userId}/premium`));
  const premData = premSnap.val();

  if (!premData || !premData.active || premData.expiresAt <= Date.now()) {
    return { allowed: false, isPremium: false, exceeded: false, maxDevices: 0, currentCount: 0, isFirstDevice: false };
  }

  const maxDevices = Math.max(1, Number(premData.maxDevices) || 1);
  const devices: Record<string, PremiumDeviceEntry> = premData.devices || {};
  const currentCount = Object.keys(devices).length;

  const firstDeviceId = premData.firstDeviceId || getDevicesSorted(devices)[0]?.[0] || null;
  const localFirstDeviceId = (() => {
    try {
      return localStorage.getItem(getFirstDeviceLocalKey(userId));
    } catch {
      return null;
    }
  })();

  const matchedDeviceId = getMatchedDeviceId(devices, deviceId, fingerprint);
  const isFirst = !!matchedDeviceId && (matchedDeviceId === firstDeviceId || matchedDeviceId === localFirstDeviceId);

  if (matchedDeviceId) {
    return { allowed: true, isPremium: true, exceeded: false, maxDevices, currentCount, isFirstDevice: isFirst };
  }

  if (currentCount >= maxDevices) {
    return { allowed: false, isPremium: true, exceeded: true, maxDevices, currentCount, isFirstDevice: false };
  }

  return { allowed: true, isPremium: true, exceeded: false, maxDevices, currentCount, isFirstDevice: false };
};

// Remove a device from premium
export const removeDevice = async (userId: string, deviceId: string): Promise<void> => {
  const premiumRef = ref(db, `users/${userId}/premium`);
  const snap = await get(premiumRef);
  const premium = snap.val() || {};
  const devices: Record<string, PremiumDeviceEntry> = { ...(premium.devices || {}) };

  await remove(ref(db, `users/${userId}/premium/devices/${deviceId}`));

  delete devices[deviceId];

  if (premium.firstDeviceId === deviceId) {
    const nextFirst = getDevicesSorted(devices)[0]?.[0] || null;
    await update(premiumRef, { firstDeviceId: nextFirst });
  }
};

// Get all devices for a user
export const getUserDevices = async (userId: string): Promise<{ id: string; name: string; type: string; registeredAt: number; lastSeen: number }[]> => {
  const devicesSnap = await get(ref(db, `users/${userId}/premium/devices`));
  const devices = devicesSnap.val() || {};
  return Object.entries(devices)
    .map(([id, data]: any) => ({
      id,
      name: data.name || "Unknown",
      type: data.type || "unknown",
      registeredAt: data.registeredAt || 0,
      lastSeen: data.lastSeen || 0,
    }))
    .sort((a, b) => a.registeredAt - b.registeredAt);
};

// Activate premium on current device (when exceeded, user chooses to activate here)
export const activateOnThisDevice = async (userId: string): Promise<boolean> => {
  const deviceId = getDeviceId();
  const deviceInfo = getDeviceInfo();
  const fingerprint = getDeviceFingerprint();

  const premRef = ref(db, `users/${userId}/premium`);
  const premSnap = await get(premRef);
  const premData = premSnap.val();
  if (!premData || !premData.active) return false;

  const maxDevices = Math.max(1, Number(premData.maxDevices) || 1);
  const devices: Record<string, PremiumDeviceEntry> = premData.devices || {};

  if (devices[deviceId]) {
    await update(ref(db, `users/${userId}/premium/devices/${deviceId}`), { lastSeen: Date.now(), fingerprint });
    return true;
  }

  const deviceEntries = getDevicesSorted(devices);

  // Remove oldest device to make room
  if (deviceEntries.length >= maxDevices) {
    const oldest = deviceEntries[0];
    if (oldest) {
      await remove(ref(db, `users/${userId}/premium/devices/${oldest[0]}`));
    }
  }

  // Register this device
  await set(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
    name: deviceInfo.name,
    type: deviceInfo.type,
    registeredAt: Date.now(),
    lastSeen: Date.now(),
    fingerprint,
  });

  // If single-device plan, this device becomes first device.
  if (maxDevices === 1) {
    await update(premRef, { firstDeviceId: deviceId });
    try {
      localStorage.setItem(getFirstDeviceLocalKey(userId), deviceId);
    } catch {}
  }

  return true;
};

import { db, ref, get, set, remove, onValue } from "@/lib/firebase";

// Get a stable device ID for this browser
export const getDeviceId = (): string => {
  const KEY = "rs_premium_device_id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = "dev_" + Date.now() + "_" + Math.random().toString(36).substring(2, 9);
    localStorage.setItem(KEY, id);
  }
  return id;
};

// Get device name/info
const getDeviceInfo = (): string => {
  const ua = navigator.userAgent;
  if (/Android/i.test(ua)) return "Android";
  if (/iPhone|iPad|iPod/i.test(ua)) return "iOS";
  if (/Windows/i.test(ua)) return "Windows";
  if (/Mac/i.test(ua)) return "Mac";
  if (/Linux/i.test(ua)) return "Linux";
  return "Unknown";
};

// Default device limits per plan days
export const getDefaultMaxDevices = (days: number): number => {
  if (days <= 31) return 1;
  if (days <= 92) return 3;
  return 4;
};

/**
 * Check premium status with device validation.
 * Returns { isPremium, expiresAt, blocked, reason }
 */
export const checkPremiumWithDevice = async (userId: string): Promise<{
  isPremium: boolean;
  expiresAt: number | null;
  blocked: boolean;
  reason?: string;
  maxDevices?: number;
  currentDevices?: number;
}> => {
  const snap = await get(ref(db, `users/${userId}/premium`));
  const data = snap.val();

  if (!data || !data.active || !data.expiresAt || data.expiresAt <= Date.now()) {
    return { isPremium: false, expiresAt: null, blocked: false };
  }

  const maxDevices = data.maxDevices || 1;
  const deviceId = getDeviceId();
  const devicesSnap = await get(ref(db, `users/${userId}/premium/devices`));
  const devices = devicesSnap.val() || {};

  // Check if this device is already registered
  if (devices[deviceId]) {
    // Update last seen
    set(ref(db, `users/${userId}/premium/devices/${deviceId}/lastSeen`), Date.now()).catch(() => {});
    return { isPremium: true, expiresAt: data.expiresAt, blocked: false, maxDevices, currentDevices: Object.keys(devices).length };
  }

  // Device not registered - check if there's room
  const activeDeviceIds = Object.keys(devices);
  if (activeDeviceIds.length >= maxDevices) {
    // No room - this device is blocked
    return {
      isPremium: false,
      expiresAt: data.expiresAt,
      blocked: true,
      reason: `সর্বোচ্চ ${maxDevices}টি ডিভাইসে ব্যবহার করা যাবে। আপনার লিমিট শেষ।`,
      maxDevices,
      currentDevices: activeDeviceIds.length,
    };
  }

  // Register this device
  await set(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
    info: getDeviceInfo(),
    registeredAt: Date.now(),
    lastSeen: Date.now(),
  });

  return {
    isPremium: true,
    expiresAt: data.expiresAt,
    blocked: false,
    maxDevices,
    currentDevices: activeDeviceIds.length + 1,
  };
};

/**
 * Subscribe to premium status with device validation (realtime).
 * Calls callback whenever premium data changes.
 */
export const subscribePremiumWithDevice = (
  userId: string,
  callback: (result: { isPremium: boolean; expiresAt: number | null; blocked: boolean; reason?: string; maxDevices?: number; currentDevices?: number }) => void
) => {
  const premRef = ref(db, `users/${userId}/premium`);
  const unsub = onValue(premRef, async (snap) => {
    const data = snap.val();
    if (!data || !data.active || !data.expiresAt || data.expiresAt <= Date.now()) {
      callback({ isPremium: false, expiresAt: null, blocked: false });
      return;
    }

    const maxDevices = data.maxDevices || 1;
    const deviceId = getDeviceId();
    const devices = data.devices || {};

    if (devices[deviceId]) {
      set(ref(db, `users/${userId}/premium/devices/${deviceId}/lastSeen`), Date.now()).catch(() => {});
      callback({ isPremium: true, expiresAt: data.expiresAt, blocked: false, maxDevices, currentDevices: Object.keys(devices).length });
      return;
    }

    const activeDeviceIds = Object.keys(devices);
    if (activeDeviceIds.length >= maxDevices) {
      callback({
        isPremium: false,
        expiresAt: data.expiresAt,
        blocked: true,
        reason: `সর্বোচ্চ ${maxDevices}টি ডিভাইসে ব্যবহার করা যাবে। আপনার লিমিট শেষ।`,
        maxDevices,
        currentDevices: activeDeviceIds.length,
      });
      return;
    }

    // Register device
    await set(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
      info: getDeviceInfo(),
      registeredAt: Date.now(),
      lastSeen: Date.now(),
    });

    callback({
      isPremium: true,
      expiresAt: data.expiresAt,
      blocked: false,
      maxDevices,
      currentDevices: activeDeviceIds.length + 1,
    });
  });

  return unsub;
};

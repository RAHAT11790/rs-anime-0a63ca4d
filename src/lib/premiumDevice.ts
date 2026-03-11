import { db, ref, get, set, update, onValue, remove } from "@/lib/firebase";

// Generate a persistent device fingerprint
export const getDeviceId = (): string => {
  try {
    const existing = localStorage.getItem("rs_device_id");
    if (existing) return existing;
  } catch {}
  
  const id = "dev_" + Date.now().toString(36) + "_" + Math.random().toString(36).substring(2, 8);
  try { localStorage.setItem("rs_device_id", id); } catch {}
  return id;
};

// Get device type info
export const getDeviceInfo = (): { type: string; name: string } => {
  const ua = navigator.userAgent;
  let type = "desktop";
  let name = "Unknown Device";
  
  if (/iPhone/i.test(ua)) { type = "mobile"; name = "iPhone"; }
  else if (/iPad/i.test(ua)) { type = "tablet"; name = "iPad"; }
  else if (/Android/i.test(ua)) {
    type = /Mobile/i.test(ua) ? "mobile" : "tablet";
    const match = ua.match(/;\s*([^;)]+)\s+Build/);
    name = match ? match[1].trim() : "Android Device";
  }
  else if (/Windows/i.test(ua)) name = "Windows PC";
  else if (/Mac/i.test(ua)) name = "Mac";
  else if (/Linux/i.test(ua)) name = "Linux PC";
  
  return { type, name };
};

// Register current device for a user's premium
export const registerDevice = async (userId: string): Promise<{ success: boolean; exceeded: boolean; maxDevices: number; currentCount: number }> => {
  const deviceId = getDeviceId();
  const deviceInfo = getDeviceInfo();
  
  // Get premium data
  const premSnap = await get(ref(db, `users/${userId}/premium`));
  const premData = premSnap.val();
  if (!premData || !premData.active || premData.expiresAt <= Date.now()) {
    return { success: false, exceeded: false, maxDevices: 0, currentCount: 0 };
  }
  
  const maxDevices = premData.maxDevices || 1;
  
  // Get current devices
  const devicesSnap = await get(ref(db, `users/${userId}/premium/devices`));
  const devices = devicesSnap.val() || {};
  
  // Check if this device is already registered
  if (devices[deviceId]) {
    // Update last seen
    await update(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
      lastSeen: Date.now(),
    });
    return { success: true, exceeded: false, maxDevices, currentCount: Object.keys(devices).length };
  }
  
  // Check limit
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
  });
  
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
  
  const premSnap = await get(ref(db, `users/${userId}/premium`));
  const premData = premSnap.val();
  
  if (!premData || !premData.active || premData.expiresAt <= Date.now()) {
    return { allowed: false, isPremium: false, exceeded: false, maxDevices: 0, currentCount: 0, isFirstDevice: false };
  }
  
  const maxDevices = premData.maxDevices || 1;
  const devices = premData.devices || {};
  const deviceIds = Object.keys(devices);
  const currentCount = deviceIds.length;
  
  // Already registered
  if (devices[deviceId]) {
    return { allowed: true, isPremium: true, exceeded: false, maxDevices, currentCount, isFirstDevice: false };
  }
  
  // Not registered - check if limit exceeded
  if (currentCount >= maxDevices) {
    // Check if this was the first device (by registration time)
    const sortedDevices = Object.entries(devices).sort(([, a]: any, [, b]: any) => (a.registeredAt || 0) - (b.registeredAt || 0));
    const isFirst = sortedDevices.length > 0 && sortedDevices[0][0] === deviceId;
    
    return { allowed: false, isPremium: true, exceeded: true, maxDevices, currentCount, isFirstDevice: isFirst };
  }
  
  return { allowed: true, isPremium: true, exceeded: false, maxDevices, currentCount, isFirstDevice: false };
};

// Remove a device from premium
export const removeDevice = async (userId: string, deviceId: string): Promise<void> => {
  await remove(ref(db, `users/${userId}/premium/devices/${deviceId}`));
};

// Get all devices for a user
export const getUserDevices = async (userId: string): Promise<{ id: string; name: string; type: string; registeredAt: number; lastSeen: number }[]> => {
  const devicesSnap = await get(ref(db, `users/${userId}/premium/devices`));
  const devices = devicesSnap.val() || {};
  return Object.entries(devices).map(([id, data]: any) => ({
    id,
    name: data.name || "Unknown",
    type: data.type || "unknown",
    registeredAt: data.registeredAt || 0,
    lastSeen: data.lastSeen || 0,
  })).sort((a, b) => a.registeredAt - b.registeredAt);
};

// Activate premium on current device (when exceeded, user chooses to activate here)
export const activateOnThisDevice = async (userId: string): Promise<boolean> => {
  const deviceId = getDeviceId();
  const deviceInfo = getDeviceInfo();
  
  const premSnap = await get(ref(db, `users/${userId}/premium`));
  const premData = premSnap.val();
  if (!premData || !premData.active) return false;
  
  const maxDevices = premData.maxDevices || 1;
  const devices = premData.devices || {};
  const deviceEntries = Object.entries(devices).sort(([, a]: any, [, b]: any) => (a.registeredAt || 0) - (b.registeredAt || 0));
  
  // Remove oldest device to make room
  if (deviceEntries.length >= maxDevices) {
    // Remove the last registered (newest except current)
    const toRemove = deviceEntries[deviceEntries.length - 1];
    if (toRemove) {
      await remove(ref(db, `users/${userId}/premium/devices/${toRemove[0]}`));
    }
  }
  
  // Register this device
  await set(ref(db, `users/${userId}/premium/devices/${deviceId}`), {
    name: deviceInfo.name,
    type: deviceInfo.type,
    registeredAt: Date.now(),
    lastSeen: Date.now(),
  });
  
  return true;
};

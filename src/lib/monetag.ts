// Monetag Ad SDK Integration for Telegram Mini App (/mini)
// Zone: 10734266

let sdkLoaded = false;
let sdkLoading = false;

// Load the Monetag SDK script
export const loadMonetag = (): Promise<void> => {
  if (sdkLoaded) return Promise.resolve();
  if (sdkLoading) {
    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (sdkLoaded) { clearInterval(check); resolve(); }
      }, 200);
    });
  }
  sdkLoading = true;
  return new Promise((resolve) => {
    const script = document.createElement("script");
    script.src = "//libtl.com/sdk.js";
    script.dataset.zone = "10734266";
    script.dataset.sdk = "show_10734266";
    script.onload = () => { sdkLoaded = true; sdkLoading = false; resolve(); };
    script.onerror = () => { sdkLoading = false; resolve(); };
    document.head.appendChild(script);
  });
};

// Get the SDK function
const getShowFn = (): ((arg?: any) => Promise<void>) | null => {
  return (window as any).show_10734266 || null;
};

/**
 * Rewarded Interstitial - shown when user selects an episode
 * User watches ad, then gets access to play
 */
export const showRewardedInterstitial = async (): Promise<boolean> => {
  await loadMonetag();
  const show = getShowFn();
  if (!show) return true; // If SDK not loaded, grant access
  try {
    await show();
    return true; // Ad watched successfully
  } catch {
    return true; // Error = grant access anyway
  }
};

/**
 * Rewarded Popup - shown on anime details page open
 * Less intrusive, user can close it
 */
export const showRewardedPopup = async (): Promise<boolean> => {
  await loadMonetag();
  const show = getShowFn();
  if (!show) return true;
  try {
    await show("pop");
    return true;
  } catch {
    return true; // Even if error/closed, let user continue
  }
};

/**
 * In-App Interstitial - auto-shows on non-home pages
 * frequency: 2 ads within 6 minutes, 30s interval, 5s delay
 * everyPage: false (session preserved across navigations)
 */
export const showInAppInterstitial = async (): Promise<void> => {
  await loadMonetag();
  const show = getShowFn();
  if (!show) return;
  try {
    show({
      type: "inApp",
      inAppSettings: {
        frequency: 2,
        capping: 0.1,
        interval: 30,
        timeout: 5,
        everyPage: false,
      },
    });
  } catch {
    // Silently ignore errors
  }
};

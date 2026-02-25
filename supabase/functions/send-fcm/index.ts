import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function base64UrlEncode(input: string | Uint8Array): string {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/g, "");
}

async function getAccessToken(serviceAccount: any): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = base64UrlEncode(JSON.stringify({
    iss: serviceAccount.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: "https://oauth2.googleapis.com/token",
    iat: now,
    exp: now + 3600,
  }));

  const pemKey = serviceAccount.private_key;
  const pemContents = pemKey
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");

  const binaryKey = Uint8Array.from(atob(pemContents), (c) => c.charCodeAt(0));
  const cryptoKey = await crypto.subtle.importKey(
    "pkcs8",
    binaryKey,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signatureInput = new TextEncoder().encode(`${header}.${payload}`);
  const signature = await crypto.subtle.sign("RSASSA-PKCS1-v1_5", cryptoKey, signatureInput);
  const sig = base64UrlEncode(new Uint8Array(signature));
  const jwt = `${header}.${payload}.${sig}`;

  const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });

  const tokenData = await tokenRes.json();
  if (!tokenRes.ok || !tokenData.access_token) {
    throw new Error(`Failed to get access token: ${JSON.stringify(tokenData)}`);
  }

  return tokenData.access_token;
}

const ensureAbsoluteUrl = (value: string | undefined, baseUrl: string): string | undefined => {
  if (!value) return undefined;
  if (value.startsWith("http://") || value.startsWith("https://")) return value;
  if (value.startsWith("//")) return `https:${value}`;
  if (value.startsWith("/")) return `${baseUrl}${value}`;
  return `${baseUrl}/${value}`;
};

const isInvalidTokenError = (errorText: string): boolean => {
  const msg = errorText.toUpperCase();
  return msg.includes("UNREGISTERED") || msg.includes("REGISTRATION_TOKEN_NOT_REGISTERED") || msg.includes("INVALID_ARGUMENT") || msg.includes("INVALID REGISTRATION TOKEN");
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { tokens, title, body, image, icon, badge, data } = await req.json();

    if (!tokens || !Array.isArray(tokens) || tokens.length === 0) {
      return new Response(JSON.stringify({ error: "No tokens provided" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccountJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    if (!serviceAccountJson) {
      return new Response(JSON.stringify({ error: "Service account not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const serviceAccount = JSON.parse(serviceAccountJson);
    const accessToken = await getAccessToken(serviceAccount);
    const projectId = serviceAccount.project_id;

    const normalizedData: Record<string, string> = {};
    if (data && typeof data === "object") {
      Object.entries(data).forEach(([key, value]) => {
        normalizedData[key] = value == null ? "" : String(value);
      });
    }

    const rawBaseUrl = normalizedData.baseUrl || req.headers.get("origin") || "https://rs-anime.lovable.app";
    const baseUrl = rawBaseUrl.replace(/\/$/, "");

    const iconUrl = ensureAbsoluteUrl(icon || "/rs-icon.png", baseUrl);
    const badgeUrl = ensureAbsoluteUrl(badge || "/rs-icon.png", baseUrl);
    const imageUrl = ensureAbsoluteUrl(image, baseUrl);
    const clickLink = ensureAbsoluteUrl(normalizedData.url || "/", baseUrl);

    let successCount = 0;
    let failCount = 0;
    const invalidTokens: string[] = [];

    const concurrency = Math.min(120, tokens.length);
    let currentIndex = 0;

    const worker = async () => {
      while (currentIndex < tokens.length) {
        const idx = currentIndex++;
        const token = tokens[idx];

        const message: any = {
          message: {
            token,
            notification: {
              title,
              body,
            },
            webpush: {
              headers: {
                Urgency: "high",
                TTL: "2419200",
              },
              notification: {
                title,
                body,
                icon: iconUrl,
                image: imageUrl,
                badge: badgeUrl,
                vibrate: [200, 100, 200],
                requireInteraction: false,
              },
              fcm_options: clickLink ? { link: clickLink } : undefined,
            },
            data: normalizedData,
          },
        };

        try {
          const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${accessToken}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify(message),
          });

          if (!res.ok) {
            const errText = await res.text();
            if (isInvalidTokenError(errText)) {
              invalidTokens.push(token);
            }
            failCount++;
            continue;
          }

          successCount++;
        } catch {
          failCount++;
        }
      }
    };

    await Promise.all(Array.from({ length: concurrency }, () => worker()));

    return new Response(JSON.stringify({ success: successCount, failed: failCount, invalidTokens }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

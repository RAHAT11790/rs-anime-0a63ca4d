import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const jsonHeaders = {
  ...corsHeaders,
  "Content-Type": "application/json",
};

const TELEGRAM_BOT_TOKEN = Deno.env.get("TELEGRAM_BOT_TOKEN");
const SITE_URL = Deno.env.get("SITE_URL") ?? "https://rs-anime.lovable.app";
const CHANNEL_URL = Deno.env.get("TELEGRAM_CHANNEL_URL") ?? "https://t.me/";

const respond = (status: number, payload: unknown) =>
  new Response(JSON.stringify(payload), { status, headers: jsonHeaders });

const buildStartText = (name?: string) => {
  const safeName = name?.trim() || "Friend";
  return `👋 <b>Hello ${safeName}!</b>\n\n✅ Bot is online and working.\n📲 Use the Mini App button below to open the app.`;
};

const buildStartButtons = () => ({
  inline_keyboard: [
    [{ text: "📱 Open Mini App", url: SITE_URL }],
    [{ text: "📢 Join Channel", url: CHANNEL_URL }],
  ],
});

async function callTelegramApi(method: "sendMessage" | "sendPhoto", payload: Record<string, unknown>) {
  if (!TELEGRAM_BOT_TOKEN) throw new Error("TELEGRAM_BOT_TOKEN not configured");

  const endpoint = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`;
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const result = await response.json();
  if (!response.ok || !result?.ok) {
    throw new Error(result?.description || `Telegram API error (${response.status})`);
  }
  return result;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method === "GET") {
    return respond(200, {
      ok: true,
      status: "running",
      tokenConfigured: Boolean(TELEGRAM_BOT_TOKEN),
    });
  }

  if (!TELEGRAM_BOT_TOKEN) {
    return respond(500, { error: "TELEGRAM_BOT_TOKEN not configured" });
  }

  try {
    let body: Record<string, any> = {};
    const contentType = req.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      try {
        body = await req.json();
      } catch {
        body = {};
      }
    }

    const isWebhookUpdate = typeof body?.update_id === "number" || typeof body?.message === "object";

    if (isWebhookUpdate) {
      const message = body?.message;
      const chatId = message?.chat?.id;
      const rawText = message?.text;
      const text = typeof rawText === "string" ? rawText.trim().toLowerCase() : "";

      if (chatId && (text === "/start" || text === "/status")) {
        await callTelegramApi("sendMessage", {
          chat_id: chatId,
          text: buildStartText(message?.from?.first_name),
          parse_mode: "HTML",
          reply_markup: buildStartButtons(),
          disable_web_page_preview: true,
        });
      }

      return respond(200, {
        ok: true,
        mode: "webhook",
        handled: text === "/start" || text === "/status",
      });
    }

    const { chatId, caption, photoUrl, buttonText, buttonUrl } = body;

    if (!chatId || !caption) {
      return respond(400, { error: "chatId and caption are required" });
    }

    // Build inline keyboard if button provided
    let reply_markup: { inline_keyboard: Array<Array<{ text: string; url: string }>> } | undefined = undefined;
    if (buttonText && buttonUrl) {
      reply_markup = {
        inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
      };
    }

    let result;

    if (photoUrl) {
      // Send photo with caption
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: "HTML",
      };
      if (reply_markup) payload.reply_markup = reply_markup;

      result = await callTelegramApi("sendPhoto", payload);
    } else {
      // Send text message
      const payload: Record<string, unknown> = {
        chat_id: chatId,
        text: caption,
        parse_mode: "HTML",
      };
      if (reply_markup) payload.reply_markup = reply_markup;

      result = await callTelegramApi("sendMessage", payload);
    }

    return respond(200, { success: true, result });
  } catch (error) {
    const msg = error instanceof Error ? error.message : "Unknown error";
    return respond(500, { error: msg });
  }
});

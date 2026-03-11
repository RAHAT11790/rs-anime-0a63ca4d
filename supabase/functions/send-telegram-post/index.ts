import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  const TELEGRAM_BOT_TOKEN = Deno.env.get('TELEGRAM_BOT_TOKEN');
  if (!TELEGRAM_BOT_TOKEN) {
    return new Response(JSON.stringify({ error: 'TELEGRAM_BOT_TOKEN not configured' }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  try {
    const { chatId, caption, photoUrl, buttonText, buttonUrl } = await req.json();

    if (!chatId || !caption) {
      return new Response(JSON.stringify({ error: 'chatId and caption are required' }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

    // Build inline keyboard if button provided
    let reply_markup: any = undefined;
    if (buttonText && buttonUrl) {
      reply_markup = {
        inline_keyboard: [[{ text: buttonText, url: buttonUrl }]]
      };
    }

    let result;

    if (photoUrl) {
      // Send photo with caption
      const body: any = {
        chat_id: chatId,
        photo: photoUrl,
        caption,
        parse_mode: 'HTML',
      };
      if (reply_markup) body.reply_markup = JSON.stringify(reply_markup);

      const res = await fetch(`${TELEGRAM_API}/sendPhoto`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      result = await res.json();
    } else {
      // Send text message
      const body: any = {
        chat_id: chatId,
        text: caption,
        parse_mode: 'HTML',
      };
      if (reply_markup) body.reply_markup = JSON.stringify(reply_markup);

      const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      result = await res.json();
    }

    if (!result.ok) {
      return new Response(JSON.stringify({ error: result.description || 'Telegram API error', details: result }), {
        status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    return new Response(JSON.stringify({ success: true, result }), {
      status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

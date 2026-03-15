import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const MINI_APP_URL = "https://rs-anime.lovable.app/mini";

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

  const TELEGRAM_API = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}`;

  try {
    const body = await req.json();

    // Handle /start command or any message
    if (body?.message) {
      const chatId = body.message.chat.id;
      const text = body.message.text || '';

      if (text === '/start' || text.startsWith('/start')) {
        // Send welcome message with buttons
        const welcomeText = `🎬 <b>RS Anime へようこそ!</b>

━━━━━━━━━━━━━━━━━━
🌟 <b>Best Hindi Dubbed Anime Platform</b>

আমাদের প্ল্যাটফর্মে পাবেন:
✦ 𝐎𝐟𝐟𝐢𝐜𝐢𝐚𝐥 ও 𝐅𝐚𝐧𝐝𝐮𝐛 হিন্দি ডাবড অ্যানিমে
✦ 480p, 720p, 1080p কোয়ালিটি
✦ নিয়মিত নতুন এপিসোড আপডেট
✦ ওয়াচ ও ডাউনলোড সুবিধা
✦ প্রিমিয়ামে সম্পূর্ণ অ্যাড-ফ্রি!
━━━━━━━━━━━━━━━━━━

📢 আপডেট পেতে চ্যানেলে জয়েন করুন
💬 হেল্পের জন্য গ্রুপে যোগ দিন
📱 নিচের বাটনে ক্লিক করে মিনি অ্যাপ খুলুন!

𓆩 <b>Powered by RS Anime</b> 𓆪`;

        const reply_markup = {
          inline_keyboard: [
            [{ text: "📢 Join Channel", url: "https://t.me/CARTOONFUNNY03" }],
            [{ text: "💬 Join Group", url: "https://t.me/HINDIANIME03" }],
            [{ text: "👑 Contact Admin", url: "https://t.me/RS_WONER" }],
            [{ text: "📱 Open Mini App", web_app: { url: MINI_APP_URL } }],
          ]
        };

        const res = await fetch(`${TELEGRAM_API}/sendMessage`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            chat_id: chatId,
            text: welcomeText,
            parse_mode: 'HTML',
            reply_markup: JSON.stringify(reply_markup),
          }),
        });
        const result = await res.json();

        return new Response(JSON.stringify({ ok: true, result }), {
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        });
      }
    }

    // For non-start messages, just acknowledge
    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    return new Response(JSON.stringify({ error: msg }), {
      status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});

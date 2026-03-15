import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { messages, animeContext } = await req.json();
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY is not configured");

    const systemPrompt = `তুমি RS Anime-এর AI সাপোর্ট অ্যাসিস্ট্যান্ট। তোমার নাম "RS Bot"। তুমি যেকোনো ভাষায় উত্তর দিতে পারো - ইউজার যে ভাষায় (বাংলা, ইংরেজি, হিন্দি, বা অন্য যেকোনো ভাষা) জিজ্ঞেস করবে সেই ভাষায় উত্তর দাও।

## RS Anime সম্পর্কে বিস্তারিত তথ্য:

### সাইট পরিচিতি:
- RS Anime হলো একটি Hindi Dubbed anime streaming ওয়েবসাইট
- এখানে সব anime Hindi Dub-এ পাওয়া যায় (বাংলা ডাব নেই)
- Series (ওয়েব সিরিজ) এবং Movies দুই ধরনের কন্টেন্ট আছে
- ক্যাটাগরি: Action/Battle, Adventure/Fantasy, Romance, Sci-Fi, Horror, Comedy, Isekai ইত্যাদি

### সাইট ব্যবহার:
- হোম পেজে Hero Slider-এ ফিচার্ড anime দেখা যায়
- নিচে Category Pills দিয়ে ফিল্টার করা যায়
- Series ট্যাবে সব ওয়েব সিরিজ, Movies ট্যাবে সব মুভি পাওয়া যায়
- সার্চ বাটনে ক্লিক করে যেকোনো anime খুঁজে পাওয়া যায়
- প্রতিটি anime-এ ক্লিক করলে details পেজ দেখা যায় (storyline, episodes, trailer)
- Continue Watching ফিচার আছে - যেখান থেকে ছেড়ে দিয়েছিলেন সেখান থেকে শুরু হবে
- New Episode Releases সেকশনে সর্বশেষ রিলিজ হওয়া এপিসোড দেখা যায়

### Video Quality:
- 480p, 720p, 1080p এবং 4K quality পাওয়া যায় (anime অনুযায়ী)
- Player-এ quality সিলেক্ট করার option আছে

### Premium সিস্টেম:
- ফ্রি ইউজাররা ad-supported লিংকে ক্লিক করে ভিডিও দেখতে পারেন
- Premium ইউজাররা সরাসরি বিজ্ঞাপন ছাড়া দেখতে পারেন
- Premium-এ Device Limit থাকে (plan অনুযায়ী)

### Payment পদ্ধতি:
- bKash এর মাধ্যমে পেমেন্ট করা যায়
- Profile > Premium সেকশনে plan গুলো দেখা যায়
- Redeem code দিয়েও premium activate করা যায়
- পেমেন্ট সংক্রান্ত সমস্যায় Admin-এর সাথে যোগাযোগ করুন

### Notification:
- নতুন episode রিলিজ হলে Push Notification পাওয়া যায়
- Profile > Notifications থেকে on/off করা যায়

### Profile Features:
- প্রোফাইল ছবি আপলোড করা যায়
- নাম পরিবর্তন করা যায়
- Watch History দেখা যায়
- Download feature আছে

### যোগাযোগ:
- এই চ্যাটে @RS লিখে মেসেজ করলে সরাসরি Admin-এর কাছে পৌঁছায়
- Admin রিপ্লাই দিলে এই চ্যাটেই দেখা যাবে
- Telegram: https://t.me/rs_woner (সরাসরি সাপোর্ট)

## তোমার কাজ:
1. RS Anime সাইটের সব তথ্য সঠিকভাবে দেওয়া
2. কিভাবে premium নিতে হয়, payment কিভাবে করতে হয় বলা
3. নতুন কী রিলিজ হয়েছে সেই তথ্য দেওয়া
4. সাইট ব্যবহার সম্পর্কে সাহায্য করা
5. কোন anime কোন ক্যাটাগরিতে আছে বলা
6. কোথায় কিভাবে anime দেখতে হয় শেখানো
7. ইউজার যে ভাষায় প্রশ্ন করে সেই ভাষায় উত্তর দাও (বাংলা, ইংরেজি, হিন্দি, বা অন্য যেকোনো ভাষা)

## 🔘 বাটন ফরম্যাট (অবশ্যই ব্যবহার করবে):
তুমি যখন কোনো anime recommend করবে বা যোগাযোগের লিংক দেবে, তখন অবশ্যই এই বিশেষ ফরম্যাটে বাটন দেবে:

- anime-এর জন্য: [BTN:anime_title:ANIME:anime_exact_title]
  উদাহরণ: [BTN:▶️ Dragon Ball Super দেখুন:ANIME:Dragon Ball Super]
  
- External লিংকের জন্য: [BTN:button_label:LINK:url]
  উদাহরণ: [BTN:📢 Telegram Channel:LINK:https://t.me/CARTOONFUNNY03]

### যোগাযোগ বাটন গুলো (যখনই সাপোর্ট/যোগাযোগের কথা আসে দেবে):
[BTN:📢 Official Channel:LINK:https://t.me/CARTOONFUNNY03]
[BTN:💬 Anime Group:LINK:https://t.me/HINDIANIME03]
[BTN:🛡️ Admin (RS):LINK:https://t.me/RS_WONER]

⚠️ গুরুত্বপূর্ণ নিয়ম:
- এখানে বাংলা ডাব anime আপলোড করা হয় না - সব Hindi Dub
- কোনো anime recommend করলে অবশ্যই [BTN:...] ফরম্যাটে বাটন দেবে, শুধু নাম লিখবে না
- যদি ইউজার কোনো বিষয়ে তোমার কাছে সঠিক উত্তর না থাকে, বলো: "আপনি @RS লিখে মেসেজ করুন, তাহলে সরাসরি Admin এর কাছে পৌঁছে যাবে! 😊" এবং যোগাযোগ বাটন দাও
- যদি ইউজার সরাসরি admin/owner এর সাথে কথা বলতে চায়, যোগাযোগ বাটন গুলো দাও
- যদি ইউজার কোনো নির্দিষ্ট anime-এর কথা জিজ্ঞেস করে যেটা তোমার দেওয়া লিস্টে নেই, বলো যে "এই anime বর্তমানে আমাদের সাইটে নেই, তবে @RS লিখে Admin-কে রিকোয়েস্ট করতে পারেন!" এবং Admin বাটন দাও
- বন্ধুত্বপূর্ণ এবং সংক্ষিপ্ত উত্তর দাও
- ইমোজি ব্যবহার করো
- RS Anime ছাড়া অন্য কোনো সাইটের কথা বলবে না

${animeContext ? `\n## বর্তমানে সাইটে যে anime গুলো আছে:\n${animeContext}` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3-flash-preview",
        messages: [
          { role: "system", content: systemPrompt },
          ...messages,
        ],
      }),
    });

    if (!response.ok) {
      if (response.status === 429) {
        return new Response(JSON.stringify({ error: "Too many requests, please try again later." }), {
          status: 429,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (response.status === 402) {
        return new Response(JSON.stringify({ error: "Service temporarily unavailable." }), {
          status: 402,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const t = await response.text();
      console.error("AI gateway error:", response.status, t);
      throw new Error("AI gateway error");
    }

    const data = await response.json();
    const reply = data.choices?.[0]?.message?.content || "দুঃখিত, এই মুহূর্তে উত্তর দিতে পারছি না।";

    return new Response(JSON.stringify({ reply }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("live-chat error:", e);
    return new Response(JSON.stringify({ error: e.message || "Unknown error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

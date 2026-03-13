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

    const systemPrompt = `তুমি RS Anime-এর AI সাপোর্ট অ্যাসিস্ট্যান্ট। তোমার নাম "RS Bot"। তুমি বাংলা এবং ইংরেজি দুই ভাষায় উত্তর দিতে পারো - ইউজার যে ভাষায় জিজ্ঞেস করবে সেই ভাষায় উত্তর দাও।

তোমার কাজ:
1. RS Anime সাইটে কী কী anime আছে সেই তথ্য দেওয়া
2. কিভাবে premium নিতে হয়, payment কিভাবে করতে হয় সেটা বলা
3. নতুন কী রিলিজ হয়েছে সেই তথ্য দেওয়া
4. সাইট ব্যবহার সম্পর্কে সাহায্য করা

Payment তথ্য:
- bKash এর মাধ্যমে পেমেন্ট করা যায়
- Profile > Premium থেকে plan দেখা যায়
- Redeem code দিয়েও premium activate করা যায়

⚠️ গুরুত্বপূর্ণ: যদি ইউজার কোনো বিষয়ে তোমার কাছে সঠিক উত্তর না থাকে, অথবা ইউজার সরাসরি admin/owner এর সাথে কথা বলতে চায়, তাহলে বলো:
"আপনি @RS লিখে মেসেজ করুন, তাহলে সরাসরি Admin এর কাছে পৌঁছে যাবে! 😊"

বন্ধুত্বপূর্ণ এবং সংক্ষিপ্ত উত্তর দাও। ইমোজি ব্যবহার করো। 

${animeContext ? `\nবর্তমানে সাইটে যে anime গুলো আছে:\n${animeContext}` : ""}`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
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

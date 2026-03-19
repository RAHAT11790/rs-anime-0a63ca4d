const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, animeTitle, episodeNumber } = await req.json();

    if (!animeTitle) {
      return new Response(JSON.stringify({ error: "animeTitle required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API key not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const prompt = `You are an expert on anime episode structure and timing. I need you to estimate the EXACT intro (opening song) and outro (ending song) timing for this specific episode.

Anime: "${animeTitle}"
Episode: ${episodeNumber}

Important rules for estimation:
- Most anime openings (OP) are exactly 89-90 seconds long
- Some episodes have a "cold open" (pre-intro scene) before the OP. Episode 1 often has a longer cold open (60-180s). Later episodes usually start OP at 0-5 seconds.
- The intro START is when the opening song begins playing (after any cold open)
- The intro END is when the opening song finishes
- Most anime endings (ED) are exactly 89-90 seconds long  
- Standard anime episode is ~23:40 (1420 seconds) total
- The outro START is when the ending song begins
- The outro END is when the ending credits finish (usually near the very end of the episode)
- Some episodes have post-credits scenes

For episode ${episodeNumber} of "${animeTitle}", estimate:
1. introStart - when does the OP begin (in seconds)
2. introEnd - when does the OP end (in seconds)
3. outroStart - when does the ED begin (in seconds)  
4. outroEnd - when does the ED end (in seconds)

If you know this specific anime well, use your knowledge. If not, use standard patterns.
Episode 1 typically: introStart=0-120, introEnd=90-210
Later episodes typically: introStart=0-5, introEnd=89-95

RESPOND WITH ONLY THIS JSON (no other text):
{"introStart": 0, "introEnd": 90, "outroStart": 1310, "outroEnd": 1400, "confidence": "medium", "note": "brief reason"}

confidence: "high" if you specifically know this anime, "medium" for educated guess, "low" for generic fallback`;

    const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 300,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", errText);
      return new Response(
        JSON.stringify({
          introStart: 0, introEnd: 90, outroStart: 1310, outroEnd: 1400,
          confidence: "fallback", note: "AI unavailable, standard timing used",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || "";

    const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        // Validate ranges
        parsed.introStart = Math.max(0, parsed.introStart || 0);
        parsed.introEnd = Math.max(parsed.introStart + 30, parsed.introEnd || 90);
        parsed.outroStart = Math.max(parsed.introEnd + 100, parsed.outroStart || 1310);
        parsed.outroEnd = Math.max(parsed.outroStart + 60, parsed.outroEnd || 1400);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch { /* fallthrough */ }
    }

    return new Response(
      JSON.stringify({
        introStart: 0, introEnd: 90, outroStart: 1310, outroEnd: 1400,
        confidence: "fallback", note: "Could not parse AI response",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

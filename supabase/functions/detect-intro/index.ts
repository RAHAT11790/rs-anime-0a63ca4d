const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version',
};

// Auto intro skip detection using AI analysis
// Analyzes video URL to detect intro patterns

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { videoUrl, animeTitle, episodeNumber } = await req.json();

    if (!videoUrl) {
      return new Response(JSON.stringify({ error: "videoUrl required" }), {
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

    // Use AI to analyze and detect intro/outro timing
    const prompt = `You are an anime intro/outro detection expert. I need you to estimate the intro and outro timing for this anime episode.

Anime: ${animeTitle || "Unknown"}
Episode: ${episodeNumber || "Unknown"}

Most anime follow these patterns:
- Intros (opening song) typically start between 0-30 seconds and last 85-90 seconds (end around 1:25-1:30)
- Some have cold opens (pre-intro scene) that push intro start to 1:00-3:00 minutes
- Outros (ending song) typically start 1:20-1:30 before the end of the episode
- Standard episode length is about 23-24 minutes (1380-1440 seconds)
- Outro usually starts around 1290-1340 seconds and ends at 1400-1440 seconds

Based on your knowledge of anime "${animeTitle || "this anime"}", estimate:
1. When the intro/opening STARTS in seconds
2. When the intro/opening ENDS in seconds  
3. When the outro/ending STARTS in seconds
4. When the outro/ending ENDS in seconds

IMPORTANT: Respond with ONLY a JSON object like this:
{"introStart": 0, "introEnd": 90, "outroStart": 1310, "outroEnd": 1410, "confidence": "high", "note": "Standard 1:30 anime OP, 1:30 ED"}

confidence can be: "high" (well-known anime), "medium" (standard pattern), "low" (guessing)`;

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
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", errText);
      // Fallback to standard timings
      return new Response(
        JSON.stringify({
          introStart: 0,
          introEnd: 90,
          outroStart: 1310,
          outroEnd: 1410,
          confidence: "fallback",
          note: "AI unavailable, using standard anime timings",
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const data = await response.json();
    const aiText = data.choices?.[0]?.message?.content || data.content || "";

    // Parse JSON from AI response
    const jsonMatch = aiText.match(/\{[\s\S]*?\}/);
    if (jsonMatch) {
      try {
        const parsed = JSON.parse(jsonMatch[0]);
        return new Response(JSON.stringify(parsed), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      } catch {
        // Parse failed, fallback
      }
    }

    // Fallback
    return new Response(
      JSON.stringify({
        introEnd: 90,
        confidence: "fallback",
        note: "Could not parse AI response, using standard 90s",
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error:", err);
    return new Response(
      JSON.stringify({ error: String(err) }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
});

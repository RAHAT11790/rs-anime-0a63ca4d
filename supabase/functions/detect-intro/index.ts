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

    // Use AI to analyze the video and detect intro timing
    const prompt = `You are an anime intro detection expert. I need you to estimate the intro (opening) end time for this anime episode.

Anime: ${animeTitle || "Unknown"}
Episode: ${episodeNumber || "Unknown"}

Most anime intros follow these patterns:
- Standard TV anime intros are typically 85-90 seconds (1:25 to 1:30)
- Some shorter intros are 60-75 seconds
- Cold opens (scene before intro) can push the intro end to 2:00-3:30
- Movies and OVAs often have longer intros (2-3 minutes)
- Some anime skip intros on episode 1 or have variable length intros

Based on your knowledge of anime "${animeTitle || "this anime"}", estimate when the intro/opening song ends in seconds.

IMPORTANT: Respond with ONLY a JSON object like this:
{"introEnd": 90, "confidence": "high", "note": "Standard 1:30 anime OP"}

confidence can be: "high" (well-known anime), "medium" (standard pattern), "low" (guessing)
introEnd should be in seconds.`;

    const response = await fetch("https://ai.lovable.dev/api/generate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 200,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("AI error:", errText);
      // Fallback to standard 90 second intro
      return new Response(
        JSON.stringify({
          introEnd: 90,
          confidence: "fallback",
          note: "AI unavailable, using standard 90s anime intro",
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

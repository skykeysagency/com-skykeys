import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
    // Auth: extract user from JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing Authorization header" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get user from token
    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabase.auth.getUser(token);
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Fetch user's Aircall API key from profile
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("aircall_api_key")
      .eq("user_id", user.id)
      .single();

    if (profileError || !profile?.aircall_api_key) {
      return new Response(JSON.stringify({ error: "no_aircall_key", message: "Aucune clé Aircall configurée dans les paramètres." }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { phone_number } = await req.json();
    if (!phone_number) {
      return new Response(JSON.stringify({ error: "Missing phone_number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Call Aircall API — Basic Auth with api_id:api_token
    const aircallKey = profile.aircall_api_key;
    const encoded = btoa(aircallKey.includes(":") ? aircallKey : `${aircallKey}:`);

    const aircallRes = await fetch("https://api.aircall.io/v1/calls/dial", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Basic ${encoded}`,
      },
      body: JSON.stringify({ phone_number }),
    });

    const aircallData = await aircallRes.json();

    if (!aircallRes.ok) {
      return new Response(
        JSON.stringify({ error: "aircall_error", details: aircallData }),
        { status: aircallRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, call: aircallData }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("aircall-dial error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

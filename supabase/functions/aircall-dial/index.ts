import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAnon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabaseAnon.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = claimsData.claims.sub;

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: profile, error: profileError } = await supabaseAdmin
      .from("profiles")
      .select("aircall_api_key")
      .eq("user_id", userId)
      .single();

    if (profileError || !profile?.aircall_api_key) {
      return new Response(
        JSON.stringify({ error: "no_aircall_key", message: "Aucune clé Aircall configurée." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { phone_number } = await req.json();
    if (!phone_number) {
      return new Response(JSON.stringify({ error: "Missing phone_number" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Format: "api_id:api_token"
    const aircallKey = profile.aircall_api_key as string;
    const parts = aircallKey.split(":");
    if (parts.length !== 2) {
      return new Response(
        JSON.stringify({ error: "invalid_key_format", message: "Format attendu : api_id:api_token" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const [apiId, apiToken] = parts;
    const encoded = btoa(`${apiId}:${apiToken}`);
    const authBasic = `Basic ${encoded}`;

    // Step 1: Ping to validate credentials
    const pingRes = await fetch("https://api.aircall.io/v1/ping", {
      headers: { Authorization: authBasic },
    });
    const pingData = await pingRes.json().catch(() => ({}));
    console.log("Ping response:", pingRes.status, JSON.stringify(pingData));

    if (!pingRes.ok) {
      return new Response(
        JSON.stringify({ error: "aircall_auth_error", status: pingRes.status, details: pingData }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 2: Get the Aircall user (me) to get real user_id
    const meRes = await fetch("https://api.aircall.io/v1/users/me", {
      headers: { Authorization: authBasic },
    });
    const meData = await meRes.json().catch(() => ({}));
    console.log("Users/me response:", meRes.status, JSON.stringify(meData));

    if (!meRes.ok) {
      return new Response(
        JSON.stringify({ error: "aircall_user_error", status: meRes.status, details: meData }),
        { status: meRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const aircallUserId = meData?.user?.id;
    if (!aircallUserId) {
      return new Response(
        JSON.stringify({ error: "no_aircall_user_id", message: "Impossible de récupérer l'ID utilisateur Aircall.", details: meData }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Step 3: Get available phone numbers
    const phoneNumbersRes = await fetch("https://api.aircall.io/v1/phone_numbers", {
      headers: { Authorization: authBasic },
    });
    const phoneNumbersData = await phoneNumbersRes.json().catch(() => ({}));
    console.log("Phone numbers response:", phoneNumbersRes.status, JSON.stringify(phoneNumbersData).slice(0, 300));

    if (!phoneNumbersRes.ok) {
      return new Response(
        JSON.stringify({ error: "aircall_numbers_error", status: phoneNumbersRes.status, details: phoneNumbersData }),
        { status: phoneNumbersRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const phoneNumbers = phoneNumbersData.phone_numbers ?? [];
    if (phoneNumbers.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_phone_number", message: "Aucun numéro Aircall disponible." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const phoneNumberId = phoneNumbers[0].id;

    // Step 4: Initiate the outbound call
    const callRes = await fetch(`https://api.aircall.io/v1/users/${aircallUserId}/calls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authBasic,
      },
      body: JSON.stringify({
        to: phone_number,
        phone_number_id: phoneNumberId,
      }),
    });

    const callData = await callRes.json().catch(() => ({}));
    console.log("Call response:", callRes.status, JSON.stringify(callData));

    if (!callRes.ok) {
      return new Response(
        JSON.stringify({ error: "aircall_call_error", status: callRes.status, details: callData }),
        { status: callRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(JSON.stringify({ success: true, call: callData }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("aircall-dial error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

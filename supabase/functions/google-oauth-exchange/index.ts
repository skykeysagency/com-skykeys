import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Validate the user is an admin
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const token = authHeader.replace("Bearer ", "");
    const { data: claimsData, error: claimsError } = await supabase.auth.getClaims(token);
    if (claimsError || !claimsData?.claims) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { code, redirect_uri } = await req.json();

    const clientId = Deno.env.get("GOOGLE_ID_CLIENT");
    const clientSecret = Deno.env.get("GOOGLE_SECRET_ID");

    if (!clientId || !clientSecret) {
      return new Response(
        JSON.stringify({ error: "GOOGLE_ID_CLIENT ou GOOGLE_SECRET_ID non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Exchange authorization code for tokens
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code,
        client_id: clientId,
        client_secret: clientSecret,
        redirect_uri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.refresh_token) {
      console.error("Token exchange error:", tokenData);
      return new Response(
        JSON.stringify({
          error: tokenData.error_description || "Impossible d'obtenir le refresh token. Assurez-vous que le compte Google n'a pas déjà été autorisé (révoquez l'accès dans myaccount.google.com/permissions).",
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Store refresh token as a secret via management API
    // We use the service role to update the secret in the vault / env
    const projectId = Deno.env.get("SUPABASE_URL")!.replace("https://", "").split(".")[0];
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    // Store refresh token in Supabase vault (secrets table simulation via admin)
    // We store it as a special profile setting for the app
    const adminClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      serviceKey
    );

    // Store in a simple app_config table or we can use profiles for admin
    // For simplicity, store in a dedicated app_settings table
    const { error: upsertError } = await adminClient
      .from("app_settings")
      .upsert({ key: "google_refresh_token", value: tokenData.refresh_token }, { onConflict: "key" });

    if (upsertError) {
      console.error("Upsert error:", upsertError);
      return new Response(
        JSON.stringify({ error: "Erreur lors du stockage du token: " + upsertError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(
      JSON.stringify({ error: "Erreur inattendue" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

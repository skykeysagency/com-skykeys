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

    const body = await req.json();
    const { phone_number, action } = body;

    const aircallKey = profile.aircall_api_key as string;
    const parts = aircallKey.split(":");
    if (parts.length !== 2) {
      return new Response(JSON.stringify({ error: "invalid_key_format" }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const [apiId, apiToken] = parts;
    const encoded = btoa(`${apiId}:${apiToken}`);
    const authBasic = `Basic ${encoded}`;

    // --- Action: check if latest call is still active ---
    if (action === "check_call_status") {
      const callsRes = await fetch("https://api.aircall.io/v1/calls?per_page=1&order=desc", {
        headers: { Authorization: authBasic },
      });
      const callsData = await callsRes.json().catch(() => ({}));
      const latestCall = callsData?.calls?.[0];

      // A call is "active" when ended_at is null/0 and status is not "done"
      const isActive = latestCall && !latestCall.ended_at && latestCall.status !== "done";
      return new Response(
        JSON.stringify({ call_active: !!isActive, latest_call: latestCall }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // --- Action: hang up an active call ---
    if (action === "hangup_call") {
      const { call_id } = body;
      if (!call_id) {
        return new Response(JSON.stringify({ error: "missing_call_id" }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const hangupRes = await fetch(`https://api.aircall.io/v1/calls/${call_id}`, {
        method: "DELETE",
        headers: { Authorization: authBasic },
      });
      console.log("Hangup response:", hangupRes.status);
      return new Response(
        JSON.stringify({ success: hangupRes.ok, hangup_status: hangupRes.status }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Only dial actions need a phone number
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

    // Step 1: List users → GET /v1/users
    // Returns users with their numbers[] array included
    const usersRes = await fetch("https://api.aircall.io/v1/users", {
      headers: { Authorization: authBasic },
    });
    const usersData = await usersRes.json().catch(() => ({}));
    console.log("Users response:", usersRes.status, JSON.stringify(usersData).slice(0, 500));

    if (!usersRes.ok) {
      return new Response(
        JSON.stringify({ error: "aircall_users_error", status: usersRes.status, details: usersData }),
        { status: usersRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const users: any[] = usersData?.users ?? [];
    if (users.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_aircall_user", message: "Aucun utilisateur Aircall trouvé." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use first user where available = true — do NOT fallback to unavailable users
    const availableUser = users.find((u: any) => u.available === true);
    if (!availableUser) {
      return new Response(
        JSON.stringify({ error: "user_unavailable", message: "Aucun utilisateur Aircall n'est disponible. Ouvrez l'application Aircall Phone et passez en statut « Disponible »." }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    const aircallUserId: number = availableUser.id;

    // Step 2: Get user details to retrieve their number_id
    // GET /v1/users/:id — returns the user with their numbers[]
    const userDetailRes = await fetch(`https://api.aircall.io/v1/users/${aircallUserId}`, {
      headers: { Authorization: authBasic },
    });
    const userDetailData = await userDetailRes.json().catch(() => ({}));
    console.log("User detail:", userDetailRes.status, JSON.stringify(userDetailData).slice(0, 500));

    if (!userDetailRes.ok) {
      return new Response(
        JSON.stringify({ error: "aircall_user_detail_error", status: userDetailRes.status, details: userDetailData }),
        { status: userDetailRes.status, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const userNumbers: any[] = userDetailData?.user?.numbers ?? [];
    if (userNumbers.length === 0) {
      return new Response(
        JSON.stringify({ error: "no_number_assigned", message: "L'utilisateur Aircall n'a aucun numéro assigné." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Use default_number_id if available, otherwise first number
    const defaultNumberId: number = userDetailData?.user?.default_number_id ?? userNumbers[0].id;

    // Step 3: Initiate outbound call — POST /v1/users/:id/calls
    // Body: { "number_id": integer, "to": "+E164" }
    // Returns 204 No Content on success
    const callRes = await fetch(`https://api.aircall.io/v1/users/${aircallUserId}/calls`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authBasic,
      },
      body: JSON.stringify({
        number_id: defaultNumberId,
        to: phone_number,
      }),
    });

    // 204 = success (no body)
    if (callRes.status === 204) {
      return new Response(JSON.stringify({ success: true, aircall_status: 204 }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const callData = await callRes.json().catch(() => ({}));
    console.error("Call error:", callRes.status, callData);

    // Always return 200 so the client can handle Aircall errors gracefully
    // (non-2xx from edge function causes supabase.functions.invoke to throw)
    return new Response(
      JSON.stringify({ error: "aircall_call_error", aircall_status: callRes.status, details: callData }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err) {
    console.error("aircall-dial error:", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});

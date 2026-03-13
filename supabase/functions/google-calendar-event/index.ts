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

    const { title, start_at, end_at, attendee_email, attendee_name, notes, appointment_id } = await req.json();

    const clientId = Deno.env.get("GOOGLE_ID_CLIENT");
    const clientSecret = Deno.env.get("GOOGLE_SECRET_ID");
    const refreshToken = Deno.env.get("GOOGLE_REFRESH_TOKEN");

    if (!clientId || !clientSecret || !refreshToken) {
      return new Response(
        JSON.stringify({ error: "Google Calendar non configuré. Connectez votre compte Google dans les paramètres." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Get access token from refresh token
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenRes.json();
    if (!tokenRes.ok || !tokenData.access_token) {
      console.error("Token error:", tokenData);
      return new Response(
        JSON.stringify({ error: "Impossible d'obtenir l'accès Google Calendar. Reconnectez votre compte." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accessToken = tokenData.access_token;

    // Build attendees list
    const attendees: any[] = [];
    if (attendee_email) {
      attendees.push({
        email: attendee_email,
        displayName: attendee_name || attendee_email,
      });
    }

    // Create Google Calendar event with Meet
    const eventRes = await fetch(
      "https://www.googleapis.com/calendar/v3/calendars/primary/events?conferenceDataVersion=1&sendUpdates=all",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          summary: title,
          description: notes || "",
          start: { dateTime: new Date(start_at).toISOString(), timeZone: "Europe/Paris" },
          end: { dateTime: new Date(end_at).toISOString(), timeZone: "Europe/Paris" },
          attendees,
          conferenceData: {
            createRequest: {
              requestId: `skycall-${appointment_id || Date.now()}`,
              conferenceSolutionKey: { type: "hangoutsMeet" },
            },
          },
          reminders: {
            useDefault: false,
            overrides: [
              { method: "email", minutes: 60 },
              { method: "popup", minutes: 15 },
            ],
          },
        }),
      }
    );

    const eventData = await eventRes.json();
    if (!eventRes.ok) {
      console.error("Calendar event error:", eventData);
      return new Response(
        JSON.stringify({ error: `Erreur Google Calendar: ${eventData.error?.message || "Inconnue"}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const meetLink = eventData.conferenceData?.entryPoints?.find(
      (e: any) => e.entryPointType === "video"
    )?.uri || null;

    const googleEventId = eventData.id;

    // Update appointment with meet link and event id
    if (appointment_id) {
      const supabaseAdmin = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
      );
      await supabaseAdmin
        .from("appointments")
        .update({ meeting_link: meetLink, google_event_id: googleEventId })
        .eq("id", appointment_id);
    }

    return new Response(
      JSON.stringify({ success: true, meet_link: meetLink, event_id: googleEventId }),
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

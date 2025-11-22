import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface NotificationRequest {
  userId?: string;
  userIds?: string[];
  type: "message" | "proximity" | "app_update" | "system";
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: "default" | "normal" | "high";
}

interface ExpoPushMessage {
  to: string;
  title: string;
  body: string;
  data?: Record<string, any>;
  priority?: "default" | "normal" | "high";
  sound?: string;
  badge?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const expoAccessToken = Deno.env.get("EXPO_ACCESS_TOKEN");

    if (!expoAccessToken) {
      throw new Error("EXPO_ACCESS_TOKEN environment variable is not set");
    }

    const supabase = createClient(supabaseUrl, supabaseServiceRoleKey);

    const requestData: NotificationRequest = await req.json();
    const { userId, userIds, type, title, body, data, priority } = requestData;

    let targetUserIds: string[] = [];

    if (userId) {
      targetUserIds = [userId];
    } else if (userIds && userIds.length > 0) {
      targetUserIds = userIds;
    } else {
      throw new Error("Either userId or userIds must be provided");
    }

    const { data: users, error: usersError } = await supabase
      .from("profiles")
      .select("id, expo_push_token, notification_enabled, notification_preferences")
      .in("id", targetUserIds)
      .eq("notification_enabled", true)
      .not("expo_push_token", "is", null);

    if (usersError) {
      throw new Error(`Failed to fetch users: ${usersError.message}`);
    }

    if (!users || users.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users with valid push tokens found",
          sent: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const filteredUsers = users.filter((user) => {
      const prefs = user.notification_preferences || {};
      
      if (type === "message" && !prefs.messages) return false;
      if (type === "proximity" && !prefs.proximity) return false;
      if (type === "app_update" && !prefs.app_updates) return false;
      if (type === "system" && !prefs.system) return false;

      if (prefs.quiet_hours_enabled) {
        const now = new Date();
        const currentTime = now.toTimeString().slice(0, 5);
        const start = prefs.quiet_hours_start || "22:00";
        const end = prefs.quiet_hours_end || "08:00";

        if (start > end) {
          if (currentTime >= start || currentTime <= end) {
            return false;
          }
        } else {
          if (currentTime >= start && currentTime <= end) {
            return false;
          }
        }
      }

      return true;
    });

    if (filteredUsers.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          message: "No users eligible for notifications (preferences filtered)",
          sent: 0,
        }),
        {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
          status: 200,
        }
      );
    }

    const messages: ExpoPushMessage[] = filteredUsers.map((user) => ({
      to: user.expo_push_token,
      title,
      body,
      data: { ...data, type },
      priority: priority || "default",
      sound: "default",
    }));

    const chunks: ExpoPushMessage[][] = [];
    const chunkSize = 100;
    for (let i = 0; i < messages.length; i += chunkSize) {
      chunks.push(messages.slice(i, i + chunkSize));
    }

    let sentCount = 0;
    let errorCount = 0;
    const errors: string[] = [];

    for (const chunk of chunks) {
      try {
        const response = await fetch("https://exp.host/--/api/v2/push/send", {
          method: "POST",
          headers: {
            "Accept": "application/json",
            "Content-Type": "application/json",
            "Authorization": `Bearer ${expoAccessToken}`,
          },
          body: JSON.stringify(chunk),
        });

        if (!response.ok) {
          const errorText = await response.text();
          errors.push(`Expo API error: ${errorText}`);
          errorCount += chunk.length;
          continue;
        }

        const result = await response.json();
        const tickets = result.data || [];

        for (let i = 0; i < tickets.length; i++) {
          const ticket = tickets[i];
          const user = filteredUsers[sentCount + i];

          if (ticket.status === "ok") {
            await supabase.from("push_notifications").insert({
              user_id: user.id,
              notification_type: type,
              title,
              body,
              data: data || {},
              delivered: true,
              sent_at: new Date().toISOString(),
            });
          } else {
            await supabase.from("push_notifications").insert({
              user_id: user.id,
              notification_type: type,
              title,
              body,
              data: data || {},
              delivered: false,
              error: ticket.message || "Unknown error",
              sent_at: new Date().toISOString(),
            });
            errors.push(`Failed for user ${user.id}: ${ticket.message}`);
            errorCount++;
          }
        }

        sentCount += tickets.filter((t: any) => t.status === "ok").length;
      } catch (error) {
        errors.push(`Exception sending chunk: ${error.message}`);
        errorCount += chunk.length;
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        sent: sentCount,
        failed: errorCount,
        total: filteredUsers.length,
        errors: errors.length > 0 ? errors : undefined,
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 200,
      }
    );
  } catch (error) {
    console.error("Error in send-push-notification:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || "Unknown error",
      }),
      {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
        status: 500,
      }
    );
  }
});

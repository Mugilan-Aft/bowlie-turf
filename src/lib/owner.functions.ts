import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Grants the calling user the `owner` role. Replaces the previous
 * client-side self-assign RLS policy (privilege-escalation risk).
 *
 * Authorization: must be a signed-in user. The owner role is granted on
 * request as part of the turf-onboarding flow; turfs created by this user
 * still start in `pending` status and require admin approval before going
 * live, so this is not a privileged action on its own.
 */
export const requestOwnerRole = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const { data: existing, error: checkErr } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", context.userId)
      .eq("role", "owner")
      .maybeSingle();
    if (checkErr) throw new Error(checkErr.message);
    if (existing) return { ok: true, alreadyOwner: true };

    const { error: insErr } = await supabaseAdmin
      .from("user_roles")
      .insert({ user_id: context.userId, role: "owner" });
    if (insErr) throw new Error(insErr.message);
    return { ok: true, alreadyOwner: false };
  });

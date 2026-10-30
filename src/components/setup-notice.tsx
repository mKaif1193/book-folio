import { TriangleAlert } from "lucide-react";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/** Shown until Supabase keys are added to .env.local. */
export function SetupNotice() {
  if (isSupabaseConfigured) return null;
  return (
    <div className="flex gap-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-sm">
      <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600" aria-hidden />
      <p>
        Supabase isn&apos;t connected yet. Copy <code>.env.example</code> to <code>.env.local</code>, add your
        project URL and publishable key, then restart the dev server.
      </p>
    </div>
  );
}

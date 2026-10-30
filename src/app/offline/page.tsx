import type { Metadata } from "next";
import { WifiOff } from "lucide-react";
import { Brand } from "@/components/brand";

export const metadata: Metadata = { title: "Offline" };

export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-4 px-4 text-center">
      <Brand />
      <WifiOff className="size-8 text-muted-foreground" aria-hidden />
      <h1 className="text-2xl font-semibold">You&apos;re offline</h1>
      <p className="max-w-sm text-sm text-muted-foreground">
        This page hasn&apos;t been saved for offline use yet. Reconnect and try again.
      </p>
    </main>
  );
}

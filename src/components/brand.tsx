import Link from "next/link";
import { BookOpenText } from "lucide-react";
import { siteConfig } from "@/config/site";
import { cn } from "@/lib/utils";

export function Brand({ href = "/", className }: { href?: string; className?: string }) {
  return (
    <Link href={href} className={cn("flex items-center gap-2 font-heading text-xl font-semibold", className)}>
      <BookOpenText className="size-5 text-primary" aria-hidden />
      {siteConfig.name}
    </Link>
  );
}

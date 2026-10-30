import { Suspense } from "react";
import type { Metadata } from "next";
import { Workspace } from "./workspace";

export const metadata: Metadata = { title: "Write" };

export default function WritePage() {
  return (
    <Suspense>
      <Workspace />
    </Suspense>
  );
}

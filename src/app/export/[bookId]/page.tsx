import { Suspense } from "react";
import type { Metadata } from "next";
import { ExportStudio } from "./export-studio";

export const metadata: Metadata = { title: "Export" };

export default function ExportPage() {
  return (
    <Suspense>
      <ExportStudio />
    </Suspense>
  );
}

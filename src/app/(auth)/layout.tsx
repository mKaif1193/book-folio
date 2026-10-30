import { Brand } from "@/components/brand";
import { SetupNotice } from "@/components/setup-notice";

export default function AuthLayout({ children }: LayoutProps<"/">) {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 px-4 py-12">
      <Brand />
      <div className="flex w-full max-w-sm flex-col gap-4">
        <SetupNotice />
        {children}
      </div>
    </main>
  );
}

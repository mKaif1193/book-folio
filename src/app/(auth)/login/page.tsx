import { Suspense } from "react";
import type { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Sign in" };

const ERRORS: Record<string, string> = {
  callback: "That sign-in link is invalid or has expired. Please try again.",
  oauth: "Google sign-in could not be started. Please try again.",
  "not-configured": "Supabase is not configured yet.",
};

export default function LoginPage({ searchParams }: PageProps<"/login">) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="font-heading text-2xl">Welcome back</CardTitle>
        <CardDescription>Sign in to keep writing.</CardDescription>
      </CardHeader>
      <CardContent>
        {/* searchParams are request data, so the form streams in behind a static fallback. */}
        <Suspense fallback={<AuthForm mode="login" />}>
          <LoginForm searchParams={searchParams} />
        </Suspense>
      </CardContent>
    </Card>
  );
}

async function LoginForm({ searchParams }: Pick<PageProps<"/login">, "searchParams">) {
  const { next, error } = await searchParams;
  return (
    <AuthForm
      mode="login"
      next={typeof next === "string" ? next : undefined}
      initialError={typeof error === "string" ? ERRORS[error] : undefined}
    />
  );
}

import { Suspense } from "react";
import type { Metadata } from "next";
import SignInForm from "@/app/sign-in/SignInForm";

export const metadata: Metadata = {
  title: "Sign in or create an account | Social Content Agent",
};

function SignInFallback() {
  return (
    <main className="page">
      <section className="card auth-card">
        <p className="eyebrow">Social Content Agent</p>
        <h1>Loading sign in...</h1>
      </section>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<SignInFallback />}>
      <SignInForm />
    </Suspense>
  );
}

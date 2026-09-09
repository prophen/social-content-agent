import type { Metadata } from "next";
import PrivateSessionBoundary from "@/app/components/PrivateSessionBoundary";

export const metadata: Metadata = { title: "Brand voice | Social Content Agent" };

export default function BrandVoiceLayout({ children }: { children: React.ReactNode }) {
  return <PrivateSessionBoundary>{children}</PrivateSessionBoundary>;
}

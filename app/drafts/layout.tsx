import type { Metadata } from "next";
import PrivateSessionBoundary from "@/app/components/PrivateSessionBoundary";

export const metadata: Metadata = {
  title: "Your drafts | Social Content Agent",
};

export default function DraftsLayout({ children }: { children: React.ReactNode }) {
  return <PrivateSessionBoundary>{children}</PrivateSessionBoundary>;
}

import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Your drafts | Social Content Agent",
};

export default function DraftsLayout({ children }: { children: React.ReactNode }) {
  return children;
}

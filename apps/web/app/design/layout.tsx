import type { Metadata } from "next";

export const metadata: Metadata = { title: "Éditeur de design — LeBoum", robots: { index: false, follow: false } };

export default function DesignLayout({ children }: { children: React.ReactNode }) {
  return children;
}

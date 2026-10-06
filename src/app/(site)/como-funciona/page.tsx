import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Como funciona" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ContentPage slug="como-funciona" eyebrow="Guia" />;
}

import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Termos de Uso" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ContentPage slug="termos" eyebrow="Legal" />;
}

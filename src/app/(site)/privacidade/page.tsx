import type { Metadata } from "next";
import { ContentPage } from "@/components/layout/content-page";

export const metadata: Metadata = { title: "Política de Privacidade" };
export const dynamic = "force-dynamic";

export default function Page() {
  return <ContentPage slug="privacidade" eyebrow="Legal" />;
}

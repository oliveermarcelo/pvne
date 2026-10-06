import { db } from "../db";
import { audit } from "../audit";
import { parse, text, z } from "../validation";

export const EDITABLE_PAGES = {
  "quem-somos": "Quem Somos",
  termos: "Termos de Uso",
  privacidade: "Política de Privacidade",
  "como-funciona": "Como funciona",
} as const;
export type PageSlug = keyof typeof EDITABLE_PAGES;

export const isPageSlug = (s: string): s is PageSlug => s in EDITABLE_PAGES;

export function getPage(slug: PageSlug) {
  return db.page.findUnique({ where: { slug } });
}

export async function savePage(adminId: string, slug: PageSlug, input: unknown, ip: string | null) {
  const data = parse(z.object({ title: text(2, 120, "Título"), content: text(10, 50_000, "Conteúdo") }), input);
  await db.page.upsert({
    where: { slug },
    create: { slug, ...data, updatedById: adminId },
    update: { ...data, updatedById: adminId },
  });
  await audit(db, { actorId: adminId, action: "admin.page_updated", entityType: "page", entityId: slug, ip });
}

import { db } from "../db";
import { audit } from "../audit";
import { DomainError, NotFoundError } from "../errors";
import { checkbox, intRange, optId, optText, optUploadUrl, parse, text, z } from "../validation";
import { slugify } from "@/lib/utils";

export const categorySchema = z.object({
  name: text(2, 60, "Nome"),
  slug: optText(60, "Slug"),
  description: optText(500, "Descrição"),
  iconUrl: optUploadUrl,
  imageUrl: optUploadUrl,
  color: z.preprocess((v) => (v === "" ? undefined : v), z.string().regex(/^#[0-9a-fA-F]{6}$/, "Cor inválida.").optional()),
  parentId: optId,
  sortOrder: intRange(0, 9999, "Ordem").default(0),
  // Vazio = usa a comissão padrão da plataforma
  commissionPercent: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : typeof v === "string" ? Number(v.replace(",", ".")) : v),
    z.number({ invalid_type_error: "Comissão inválida." }).min(0, "Comissão inválida.").max(50, "Máximo de 50%.").optional(),
  ),
  active: checkbox,
});

/** Categorias ativas de 1º nível, com subcategorias ativas */
export function listActiveCategories() {
  return db.category.findMany({
    where: { active: true, parentId: null },
    orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
    include: { children: { where: { active: true }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] } },
  });
}

/** Lista plana para selects (inclui subcategorias com prefixo) */
export async function categoryOptions() {
  const cats = await listActiveCategories();
  return cats.flatMap((c) => [
    { id: c.id, label: c.name },
    ...c.children.map((s) => ({ id: s.id, label: `${c.name} › ${s.name}` })),
  ]);
}

export async function getCategoryBySlug(slug: string) {
  return db.category.findFirst({
    where: { slug, active: true },
    include: { children: { where: { active: true } }, parent: true },
  });
}

export async function assertActiveCategory(id: string) {
  const c = await db.category.findUnique({ where: { id } });
  if (!c || !c.active) throw new DomainError("Categoria inválida.", "VALIDATION", { categoryId: "Selecione uma categoria válida." });
  return c;
}

export async function saveCategory(adminId: string, id: string | null, input: unknown, ip: string | null) {
  const data = parse(categorySchema, input);
  const slug = slugify(data.slug || data.name);
  if (!slug) throw new DomainError("Slug inválido.", "VALIDATION", { slug: "Slug inválido." });
  const clash = await db.category.findFirst({ where: { slug, ...(id ? { id: { not: id } } : {}) } });
  if (clash) throw new DomainError("Já existe uma categoria com este slug.", "VALIDATION", { slug: "Já existe uma categoria com este slug." });
  if (data.parentId) {
    if (data.parentId === id) throw new DomainError("Uma categoria não pode ser mãe dela mesma.");
    const parent = await db.category.findUnique({ where: { id: data.parentId } });
    if (!parent || parent.parentId) throw new DomainError("Categoria mãe inválida (apenas 1 nível de subcategoria).");
  }
  const payload = {
    name: data.name,
    slug,
    description: data.description ?? null,
    iconUrl: data.iconUrl ?? null,
    imageUrl: data.imageUrl ?? null,
    color: data.color ?? null,
    parentId: data.parentId ?? null,
    sortOrder: data.sortOrder,
    active: data.active,
    commissionBps: data.commissionPercent === undefined ? null : Math.round(data.commissionPercent * 100),
  };
  const saved = id
    ? await db.category.update({ where: { id }, data: payload })
    : await db.category.create({ data: payload });
  await audit(db, { actorId: adminId, action: id ? "admin.category_updated" : "admin.category_created", entityType: "category", entityId: saved.id, ip });
  return saved;
}

export async function toggleCategory(adminId: string, id: string, ip: string | null) {
  const c = await db.category.findUnique({ where: { id } });
  if (!c) throw new NotFoundError("Categoria");
  await db.category.update({ where: { id }, data: { active: !c.active } });
  await audit(db, { actorId: adminId, action: "admin.category_toggled", entityType: "category", entityId: id, data: { active: !c.active }, ip });
}

export async function deleteCategory(adminId: string, id: string, ip: string | null) {
  const c = await db.category.findUnique({
    where: { id },
    include: { _count: { select: { cards: true, albums: true, children: true } } },
  });
  if (!c) throw new NotFoundError("Categoria");
  if (c._count.cards || c._count.albums || c._count.children) {
    throw new DomainError("Esta categoria possui cards, álbuns ou subcategorias vinculados. Desative-a em vez de excluir.");
  }
  await db.category.delete({ where: { id } });
  await audit(db, { actorId: adminId, action: "admin.category_deleted", entityType: "category", entityId: id, data: { name: c.name }, ip });
}

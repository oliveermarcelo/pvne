import { notFound } from "next/navigation";
import Markdown from "react-markdown";
import { getPage, type PageSlug } from "@/server/modules/pages";
import { formatDate } from "@/lib/dates";

/** Página institucional editável pelo admin (conteúdo em Markdown; HTML bruto não é renderizado) */
export async function ContentPage({ slug, eyebrow, aside }: { slug: PageSlug; eyebrow?: string; aside?: React.ReactNode }) {
  const page = await getPage(slug);
  if (!page) notFound();
  return (
    <div className="container py-12">
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[1fr_320px]">
        <article className="min-w-0">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="mt-2 text-3xl font-bold sm:text-4xl">{page.title}</h1>
          <p className="mt-2 text-xs text-mist-500">Atualizado em {formatDate(page.updatedAt)}</p>
          <div className="prose-pvne mt-8 max-w-3xl">
            <Markdown>{page.content}</Markdown>
          </div>
        </article>
        {aside && <aside className="space-y-4 lg:sticky lg:top-24 lg:self-start">{aside}</aside>}
      </div>
    </div>
  );
}

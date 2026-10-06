import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { EDITABLE_PAGES, getPage, isPageSlug } from "@/server/modules/pages";
import { adminSavePageAction } from "@/app/actions/admin";
import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Textarea } from "@/components/forms/inputs";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Editar página · Admin" };

export default async function AdminEditPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  if (!isPageSlug(slug)) notFound();
  const page = await getPage(slug);
  return (
    <>
      <PageHeader eyebrow="Conteúdo" title={EDITABLE_PAGES[slug]} actions={<Link href={`/${slug}`} target="_blank" className="link text-sm">Ver página →</Link>} />
      <ActionForm action={adminSavePageAction.bind(null, slug)} className="surface space-y-4 p-5">
        <Field name="title" label="Título"><Input name="title" defaultValue={page?.title ?? EDITABLE_PAGES[slug]} /></Field>
        <Field name="content" label="Conteúdo (Markdown)" hint="HTML não é interpretado, por segurança.">
          <Textarea name="content" defaultValue={page?.content ?? ""} rows={26} className="font-mono text-[13px] leading-relaxed" />
        </Field>
        <SubmitButton>Salvar página</SubmitButton>
      </ActionForm>
    </>
  );
}

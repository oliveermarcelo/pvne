import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/forms/inputs";
import { ImageUploader } from "@/components/forms/image-uploader";
import type { ActionState } from "@/server/errors";
import { ALBUM_STATUS_LABELS } from "@/lib/labels";

export function AlbumForm({
  action,
  categories,
  values = {},
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  categories: { id: string; label: string }[];
  values?: { name?: string; description?: string | null; categoryId?: string; status?: string; coverUrl?: string | null };
}) {
  return (
    <ActionForm action={action} className="surface space-y-5 p-5 sm:p-6">
      <div className="grid gap-6 sm:grid-cols-[160px_1fr]">
        <Field name="coverUrl" label="Capa">
          <ImageUploader name="coverUrl" initial={values.coverUrl ? [values.coverUrl] : []} max={1} folder="albums" />
        </Field>
        <div className="space-y-4">
          <Field name="name" label="Nome do álbum" required><Input name="name" defaultValue={values.name} placeholder="Ex.: Pokémon — Clássicos" required /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field name="categoryId" label="Categoria" required>
              <Select name="categoryId" defaultValue={values.categoryId ?? ""} required>
                <option value="" disabled>Selecione…</option>
                {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
              </Select>
            </Field>
            <Field name="status" label="Visibilidade">
              <Select name="status" defaultValue={values.status ?? "PUBLIC"}>
                {Object.entries(ALBUM_STATUS_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </Select>
            </Field>
          </div>
          <Field name="description" label="Descrição"><Textarea name="description" defaultValue={values.description ?? ""} rows={3} maxLength={1000} /></Field>
        </div>
      </div>
      <SubmitButton size="lg">Salvar álbum</SubmitButton>
    </ActionForm>
  );
}

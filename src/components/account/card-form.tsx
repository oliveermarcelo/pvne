import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/forms/inputs";
import { ImageUploader } from "@/components/forms/image-uploader";
import type { ActionState } from "@/server/errors";
import { CONDITION_LABELS, LANGUAGES } from "@/lib/labels";

type CardValues = {
  name?: string;
  code?: string | null;
  categoryId?: string;
  albumId?: string | null;
  description?: string | null;
  condition?: string;
  edition?: string | null;
  setName?: string | null;
  language?: string | null;
  rarity?: string | null;
  quantity?: number;
  images?: string[];
};

export function CardForm({
  action,
  values = {},
  categories,
  albums,
  isNew,
  locked,
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  values?: CardValues;
  categories: { id: string; label: string }[];
  albums: { id: string; name: string }[];
  isNew?: boolean;
  locked?: boolean;
}) {
  return (
    <ActionForm action={action} className="space-y-6">
      <section className="surface space-y-5 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Imagens</h2>
        <ImageUploader name="images" initial={values.images ?? []} max={6} />
      </section>

      <section className="surface space-y-5 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Identificação</h2>
        <div className="grid gap-4 sm:grid-cols-[2fr_1fr]">
          <Field name="name" label="Nome do card" required><Input name="name" defaultValue={values.name} placeholder="Ex.: Charizard Holo" required disabled={locked} /></Field>
          <Field name="code" label="Código / número"><Input name="code" defaultValue={values.code ?? ""} placeholder="Ex.: 4/102" disabled={locked} /></Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field name="categoryId" label="Categoria" required>
            <Select name="categoryId" defaultValue={values.categoryId ?? ""} required disabled={locked}>
              <option value="" disabled>Selecione…</option>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.label}</option>)}
            </Select>
          </Field>
          <Field name="albumId" label="Álbum" hint={albums.length === 0 ? "Você ainda não tem álbuns — o card fica “sem álbum”." : undefined}>
            <Select name="albumId" defaultValue={values.albumId ?? ""}>
              <option value="">Sem álbum</option>
              {albums.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
            </Select>
          </Field>
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="setName" label="Coleção / expansão"><Input name="setName" defaultValue={values.setName ?? ""} placeholder="Ex.: Base Set" disabled={locked} /></Field>
          <Field name="edition" label="Edição"><Input name="edition" defaultValue={values.edition ?? ""} placeholder="Ex.: 1ª edição" disabled={locked} /></Field>
          <Field name="rarity" label="Raridade"><Input name="rarity" defaultValue={values.rarity ?? ""} placeholder="Ex.: Holo Rara" disabled={locked} /></Field>
        </div>
      </section>

      <section className="surface space-y-5 p-5 sm:p-6">
        <h2 className="text-sm font-semibold">Estado e detalhes</h2>
        <div className="grid gap-4 sm:grid-cols-3">
          <Field name="condition" label="Estado de conservação" required>
            <Select name="condition" defaultValue={values.condition ?? ""} required disabled={locked}>
              <option value="" disabled>Selecione…</option>
              {Object.entries(CONDITION_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </Select>
          </Field>
          <Field name="language" label="Idioma">
            <Select name="language" defaultValue={values.language ?? ""} disabled={locked}>
              <option value="">—</option>
              {LANGUAGES.map((l) => <option key={l}>{l}</option>)}
            </Select>
          </Field>
          <Field name="quantity" label="Quantidade"><Input name="quantity" type="number" min={1} max={999} defaultValue={values.quantity ?? 1} disabled={locked} /></Field>
        </div>
        <Field name="description" label="Descrição" hint="Detalhe o estado: marcas, riscos, centralização, se já foi graduado etc.">
          <Textarea name="description" defaultValue={values.description ?? ""} rows={5} maxLength={3000} disabled={locked} />
        </Field>
      </section>

      {!locked && <div className="flex flex-wrap gap-2">
        <SubmitButton size="lg">{isNew ? "Salvar na coleção" : "Salvar alterações"}</SubmitButton>
        {isNew && <SubmitButton size="lg" variant="outline" name="_then" value="anunciar">Salvar e anunciar</SubmitButton>}
      </div>}
    </ActionForm>
  );
}

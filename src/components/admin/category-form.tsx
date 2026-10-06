import { ActionForm, Field, SubmitButton } from "@/components/forms/action-form";
import { Checkbox, Input, Select, Textarea } from "@/components/forms/inputs";
import { ImageUploader } from "@/components/forms/image-uploader";
import type { ActionState } from "@/server/errors";

export function CategoryForm({
  action,
  parents,
  values = {},
}: {
  action: (s: ActionState, fd: FormData) => Promise<ActionState>;
  parents: { id: string; name: string }[];
  values?: { name?: string; slug?: string; description?: string | null; color?: string | null; parentId?: string | null; sortOrder?: number; active?: boolean; iconUrl?: string | null; imageUrl?: string | null; commissionBps?: number | null };
}) {
  return (
    <ActionForm action={action} className="surface max-w-3xl space-y-5 p-5 sm:p-6">
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="name" label="Nome" required><Input name="name" defaultValue={values.name} required /></Field>
        <Field name="slug" label="Slug (URL)" hint="Gerado a partir do nome se vazio."><Input name="slug" defaultValue={values.slug} /></Field>
      </div>
      <Field name="description" label="Descrição"><Textarea name="description" defaultValue={values.description ?? ""} rows={3} /></Field>
      <Field name="commissionPercent" label="Comissão da categoria (%)" hint="Deixe vazio para usar a comissão padrão da plataforma.">
        <Input name="commissionPercent" inputMode="decimal" defaultValue={values.commissionBps != null ? String(values.commissionBps / 100) : ""} className="max-w-[160px]" />
      </Field>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field name="parentId" label="Categoria mãe" hint="Opcional — cria uma subcategoria.">
          <Select name="parentId" defaultValue={values.parentId ?? ""}>
            <option value="">Nenhuma (1º nível)</option>
            {parents.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </Select>
        </Field>
        <Field name="color" label="Cor de destaque"><Input name="color" type="color" defaultValue={values.color ?? "#FBDB02"} className="h-10 p-1" /></Field>
        <Field name="sortOrder" label="Ordem"><Input name="sortOrder" type="number" min={0} defaultValue={values.sortOrder ?? 0} /></Field>
      </div>
      <div className="grid gap-6 sm:grid-cols-[140px_1fr]">
        <Field name="iconUrl" label="Ícone"><ImageUploader name="iconUrl" initial={values.iconUrl ? [values.iconUrl] : []} max={1} folder="categories" aspect="square" /></Field>
        <Field name="imageUrl" label="Imagem de capa"><ImageUploader name="imageUrl" initial={values.imageUrl ? [values.imageUrl] : []} max={1} folder="categories" aspect="wide" /></Field>
      </div>
      <Checkbox name="active" label="Categoria ativa (visível no site)" defaultChecked={values.active ?? true} />
      <SubmitButton>Salvar categoria</SubmitButton>
    </ActionForm>
  );
}

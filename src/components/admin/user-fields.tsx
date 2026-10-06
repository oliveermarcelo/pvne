import { Field } from "@/components/forms/action-form";
import { Input, Select, Textarea } from "@/components/forms/inputs";
import { ImageUploader } from "@/components/forms/image-uploader";
import { BR_STATES } from "@/lib/utils";

type U = { name: string; username: string; email: string; phone: string | null; city: string | null; state: string | null; bio: string | null; avatarUrl: string | null; role: "USER" | "ADMIN" };

/** Campos de cadastro de usuário usados pelo administrador (criar e editar) */
export function AdminUserFields({ u, lockRole }: { u?: U; lockRole?: boolean }) {
  return (
    <div className="space-y-4">
      <Field name="avatarUrl" label="Foto">
        <ImageUploader name="avatarUrl" initial={u?.avatarUrl ? [u.avatarUrl] : []} max={1} folder="avatars" aspect="square" />
      </Field>
      <Field name="name" label="Nome" required><Input name="name" defaultValue={u?.name} autoComplete="off" /></Field>
      <div className="grid gap-4 sm:grid-cols-2">
        <Field name="username" label="Usuário" required hint="Letras minúsculas, números, ponto e _"><Input name="username" defaultValue={u?.username} autoComplete="off" autoCapitalize="none" /></Field>
        <Field name="email" label="E-mail" required><Input name="email" type="email" inputMode="email" defaultValue={u?.email} autoComplete="off" autoCapitalize="none" /></Field>
      </div>
      <Field name="phone" label="Telefone" hint="Visível só para a administração"><Input name="phone" type="tel" inputMode="tel" defaultValue={u?.phone ?? ""} /></Field>
      <div className="grid grid-cols-[1fr_96px] gap-3">
        <Field name="city" label="Cidade"><Input name="city" defaultValue={u?.city ?? ""} /></Field>
        <Field name="state" label="UF">
          <Select name="state" defaultValue={u?.state ?? ""}>
            <option value="">—</option>
            {BR_STATES.map((s) => <option key={s}>{s}</option>)}
          </Select>
        </Field>
      </div>
      <Field name="bio" label="Bio (perfil público)"><Textarea name="bio" defaultValue={u?.bio ?? ""} maxLength={500} className="min-h-[80px]" /></Field>
      <Field name="role" label="Papel" hint={lockRole ? "Você não pode remover o seu próprio acesso de administrador." : "Administradores acessam este painel e já podem vender."}>
        {lockRole ? (
          <>
            <input type="hidden" name="role" value="ADMIN" />
            <Select name="_role" defaultValue="ADMIN" disabled><option value="ADMIN">Administrador</option></Select>
          </>
        ) : (
          <Select name="role" defaultValue={u?.role ?? "USER"}>
            <option value="USER">Colecionador</option>
            <option value="ADMIN">Administrador</option>
          </Select>
        )}
      </Field>
    </div>
  );
}

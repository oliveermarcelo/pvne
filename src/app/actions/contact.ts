"use server";

import { getCurrentUser } from "@/server/auth/guards";
import { getRequestMeta } from "@/server/request";
import { formToObject } from "@/server/validation";
import type { ActionState } from "@/server/errors";
import { createContact } from "@/server/modules/contacts";
import { run } from "./_run";

export async function contactAction(_: ActionState, fd: FormData): Promise<ActionState> {
  return run(async () => {
    const user = await getCurrentUser();
    const { ip } = await getRequestMeta();
    const row = await createContact(formToObject(fd), user?.id ?? null, ip);
    const label = row.type === "COMPLAINT" ? "reclamação" : row.type === "SUGGESTION" ? "sugestão" : "mensagem";
    return { ok: true, message: `Recebemos sua ${label} (protocolo #${row.id.slice(-6).toUpperCase()}). Responderemos pelo e-mail informado.` };
  });
}

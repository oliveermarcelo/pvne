import { unstable_rethrow } from "next/navigation";
import { DomainError, type ActionState } from "@/server/errors";

/** Executa uma action convertendo erros de negócio em estado exibível no formulário. */
export async function run(fn: () => Promise<ActionState | void>): Promise<ActionState> {
  try {
    return (await fn()) ?? { ok: true };
  } catch (e) {
    unstable_rethrow(e); // redirect()/notFound() precisam propagar
    if (e instanceof DomainError) return { error: e.message, fieldErrors: e.fieldErrors };
    console.error("[action]", e);
    return { error: "Ocorreu um erro inesperado. Tente novamente em instantes." };
  }
}

/** Aceita apenas caminhos internos como destino de redirecionamento */
export function safeNext(value: FormDataEntryValue | null | undefined, fallback = "/conta"): string {
  const v = typeof value === "string" ? value : "";
  return v.startsWith("/") && !v.startsWith("//") && !v.startsWith("/\\") ? v : fallback;
}

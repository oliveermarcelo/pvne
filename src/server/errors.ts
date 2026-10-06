/** Erro de regra de negócio — a mensagem é segura para exibir ao usuário. */
export class DomainError extends Error {
  constructor(
    message: string,
    public readonly code: string = "DOMAIN_ERROR",
    public readonly fieldErrors?: Record<string, string>,
  ) {
    super(message);
    this.name = "DomainError";
  }
}

export class NotFoundError extends DomainError {
  constructor(what = "Registro") {
    super(`${what} não encontrado.`, "NOT_FOUND");
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = "Você não tem permissão para esta ação.") {
    super(message, "FORBIDDEN");
  }
}

export type ActionState = {
  ok?: boolean;
  error?: string;
  message?: string;
  fieldErrors?: Record<string, string>;
  /** valor livre para o cliente (ex.: id criado) */
  data?: unknown;
};

export const initialActionState: ActionState = {};

/** Converte um ZodError em mapa campo → mensagem */
export function zodFieldErrors(issues: { path: (string | number)[]; message: string }[]): Record<string, string> {
  const out: Record<string, string> = {};
  for (const i of issues) {
    const key = String(i.path[0] ?? "_");
    if (!out[key]) out[key] = i.message;
  }
  return out;
}

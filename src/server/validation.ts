import { z, ZodError, type ZodTypeAny } from "zod";
import { parseBRLToCents } from "@/lib/money";
import { parseLocalDateTime } from "@/lib/dates";
import { DomainError, zodFieldErrors } from "./errors";
import { isUploadUrl } from "./storage";

const emptyToUndef = (v: unknown) => {
  if (typeof v !== "string") return v;
  const t = v.trim();
  return t === "" ? undefined : t;
};

/** Texto obrigatório (aparado) */
export const text = (min: number, max: number, label: string) =>
  z.preprocess(
    (v) => (typeof v === "string" ? v.trim() : v),
    z
      .string({ required_error: `${label} é obrigatório.`, invalid_type_error: `${label} é obrigatório.` })
      .min(min, min <= 1 ? `${label} é obrigatório.` : `${label} deve ter ao menos ${min} caracteres.`)
      .max(max, `${label} deve ter no máximo ${max} caracteres.`),
  );

/** Texto opcional: string vazia vira undefined */
export const optText = (max: number, label = "Campo") =>
  z.preprocess(emptyToUndef, z.string().max(max, `${label} deve ter no máximo ${max} caracteres.`).optional());

/** Valor em reais digitado → centavos (inteiro positivo) */
export const money = (label: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? undefined : (parseBRLToCents(v) ?? Number.NaN)),
    z
      .number({ required_error: `Informe ${label}.`, invalid_type_error: `${label} inválido.` })
      .int()
      .positive(`${label} deve ser maior que zero.`)
      .max(2_000_000_000, `${label} acima do limite permitido.`),
  );

export const optMoney = (label: string) =>
  z.preprocess(
    (v) => (v === undefined || v === null || v === "" ? undefined : (parseBRLToCents(v) ?? Number.NaN)),
    z
      .number({ invalid_type_error: `${label} inválido.` })
      .int()
      .positive(`${label} deve ser maior que zero.`)
      .max(2_000_000_000)
      .optional(),
  );

export const intRange = (min: number, max: number, label: string) =>
  z.coerce
    .number({ invalid_type_error: `${label} inválido.` })
    .int(`${label} deve ser um número inteiro.`)
    .min(min, `${label} deve ser no mínimo ${min}.`)
    .max(max, `${label} deve ser no máximo ${max}.`);

/** datetime-local no horário de Brasília → Date */
export const localDateTime = (label: string) =>
  z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : (parseLocalDateTime(v) ?? "invalid")),
    z.date({ required_error: `Informe ${label}.`, invalid_type_error: `${label} inválida.` }),
  );

export const uploadUrl = z.string().refine(isUploadUrl, "Imagem inválida.");
export const optUploadUrl = z.preprocess(emptyToUndef, uploadUrl.optional());

export const id = z.string().min(1).max(40);
export const optId = z.preprocess(emptyToUndef, id.optional());

export const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

/** FormData → objeto simples; campos repetidos (ex.: images) viram array */
export function formToObject(fd: FormData, arrays: string[] = []): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [k, v] of fd.entries()) {
    if (k.startsWith("$ACTION")) continue;
    if (typeof v !== "string") continue;
    if (arrays.includes(k)) {
      ((out[k] as string[] | undefined) ??= []).push(v);
    } else {
      out[k] = v;
    }
  }
  for (const a of arrays) out[a] ??= [];
  return out;
}

/** Valida e lança DomainError com erros por campo */
export function parse<S extends ZodTypeAny>(schema: S, input: unknown): z.infer<S> {
  try {
    return schema.parse(input);
  } catch (e) {
    if (e instanceof ZodError) {
      const fieldErrors = zodFieldErrors(e.issues);
      throw new DomainError(Object.values(fieldErrors)[0] ?? "Dados inválidos.", "VALIDATION", fieldErrors);
    }
    throw e;
  }
}

export { z };

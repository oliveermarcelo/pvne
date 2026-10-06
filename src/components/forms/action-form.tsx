"use client";

import { createContext, startTransition, useActionState, useContext, useEffect, useRef, type FormEvent, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/errors";
import { Alert } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>({});
export const useFormState = () => useContext(FormStateContext);
const PendingContext = createContext(false);

/**
 * Formulário ligado a uma Server Action com feedback de erro/sucesso.
 * Erros por campo ficam disponíveis para <Field> via contexto.
 */
export function ActionForm({
  action,
  children,
  className,
  resetOnSuccess,
  showMessage = true,
  onSuccess,
}: {
  action: Action;
  children: ReactNode;
  className?: string;
  resetOnSuccess?: boolean;
  showMessage?: boolean;
  onSuccess?: (state: ActionState) => void;
}) {
  const [state, formAction, pending] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);

  // Envio pelo onSubmit (e não por <form action>): o React 19 limpa o formulário depois de
  // toda ação enviada por "action", inclusive quando há erro de validação — o usuário perderia
  // o que digitou. Aqui só limpamos em caso de sucesso, quando resetOnSuccess pedir.
  const submit = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (pending) return;
    const form = e.currentTarget;
    const submitter = (e.nativeEvent as SubmitEvent).submitter as HTMLButtonElement | null;
    let fd: FormData;
    try {
      fd = new FormData(form, submitter);
    } catch {
      fd = new FormData(form);
      if (submitter?.name) fd.append(submitter.name, submitter.value);
    }
    startTransition(() => formAction(fd));
  };
  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <FormStateContext.Provider value={state}>
      <PendingContext.Provider value={pending}>
        <form ref={ref} onSubmit={submit} className={className} noValidate>
          {state.error && <Alert tone="bad" className="mb-5">{state.error}</Alert>}
          {showMessage && state.ok && state.message && <Alert tone="ok" className="mb-5">{state.message}</Alert>}
          {children}
        </form>
      </PendingContext.Provider>
    </FormStateContext.Provider>
  );
}

export function SubmitButton({
  children,
  pendingText = "Salvando…",
  variant = "primary",
  size = "md",
  className,
  name,
  value,
  disabled,
}: {
  children: ReactNode;
  disabled?: boolean;
  pendingText?: string;
  variant?: Parameters<typeof buttonClass>[0];
  size?: Parameters<typeof buttonClass>[1];
  className?: string;
  name?: string;
  value?: string;
}) {
  const status = useFormStatus();
  const pending = useContext(PendingContext) || status.pending;
  return (
    <button type="submit" name={name} value={value} disabled={pending || disabled} className={buttonClass(variant, size, className)}>
      {pending ? (
        <>
          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-r-transparent" aria-hidden />
          {pendingText}
        </>
      ) : (
        children
      )}
    </button>
  );
}

/** Rótulo + controle + mensagem de erro do campo */
export function Field({
  name,
  label,
  hint,
  children,
  className,
  required,
}: {
  name: string;
  label?: ReactNode;
  hint?: ReactNode;
  children: ReactNode;
  className?: string;
  required?: boolean;
}) {
  const state = useFormState();
  const error = state.fieldErrors?.[name];
  return (
    <div className={cn("space-y-1.5", className)} data-invalid={error ? "" : undefined}>
      {label && (
        <label htmlFor={name} className="block text-xs font-medium text-mist-300">
          {label}
          {required && <span className="ml-0.5 text-gold-400">*</span>}
        </label>
      )}
      <div className={cn(error && "[&_.field]:field-error")}>{children}</div>
      {error ? <p className="text-xs text-bad">{error}</p> : hint ? <p className="text-xs text-mist-500">{hint}</p> : null}
    </div>
  );
}

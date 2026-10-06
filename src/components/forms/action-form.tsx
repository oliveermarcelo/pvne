"use client";

import { createContext, useActionState, useContext, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/server/errors";
import { Alert } from "@/components/ui/misc";
import { buttonClass } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type Action = (state: ActionState, fd: FormData) => Promise<ActionState>;

const FormStateContext = createContext<ActionState>({});
export const useFormState = () => useContext(FormStateContext);

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
  const [state, formAction] = useActionState(action, {});
  const ref = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) {
      if (resetOnSuccess) ref.current?.reset();
      onSuccess?.(state);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state]);

  return (
    <FormStateContext.Provider value={state}>
      <form ref={ref} action={formAction} className={className} noValidate>
        {state.error && <Alert tone="bad" className="mb-5">{state.error}</Alert>}
        {showMessage && state.ok && state.message && <Alert tone="ok" className="mb-5">{state.message}</Alert>}
        {children}
      </form>
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
  const { pending } = useFormStatus();
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

"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Copy, Eye, EyeOff, Wand2 } from "lucide-react";
import { Field } from "@/components/forms/action-form";

const CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

/** Senha forte e fácil de ditar (sem 0/O, 1/l/I), sempre com letras e números */
function generate(len = 12) {
  const buf = new Uint32Array(len);
  for (;;) {
    crypto.getRandomValues(buf);
    const pwd = Array.from(buf, (n) => CHARS[n % CHARS.length]).join("");
    if (/[A-Za-z]/.test(pwd) && /\d/.test(pwd)) return pwd;
  }
}

/** Campos "senha" + "confirmar" com mostrar/ocultar, gerador e copiar (uso do administrador) */
export function PasswordFields({ label = "Nova senha" }: { label?: string }) {
  const [value, setValue] = useState("");
  const [confirm, setConfirm] = useState("");
  const [show, setShow] = useState(false);
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Limpa os campos quando o formulário é reiniciado (após salvar)
  useEffect(() => {
    const form = ref.current?.closest("form");
    if (!form) return;
    const clear = () => {
      setValue("");
      setConfirm("");
      setShow(false);
    };
    form.addEventListener("reset", clear);
    return () => form.removeEventListener("reset", clear);
  }, []);

  const gen = () => {
    const p = generate();
    setValue(p);
    setConfirm(p);
    setShow(true);
    setCopied(false);
  };
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* sem acesso à área de transferência: a senha está visível no campo */
    }
  };

  return (
    <div ref={ref} className="space-y-4">
      <Field name="password" label={label} hint="Mínimo de 8 caracteres, com letras e números.">
        <div className="relative">
          <input
            id="password"
            name="password"
            type={show ? "text" : "password"}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            autoComplete="new-password"
            className="field pr-24 font-mono"
          />
          <div className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
            {value && (
              <button type="button" onClick={copy} className="grid h-9 w-9 place-items-center rounded-lg text-mist-400 hover:bg-white/5 hover:text-mist-100" aria-label="Copiar senha" title="Copiar">
                {copied ? <Check className="h-4 w-4 text-ok" /> : <Copy className="h-4 w-4" />}
              </button>
            )}
            <button type="button" onClick={() => setShow((s) => !s)} className="grid h-9 w-9 place-items-center rounded-lg text-mist-400 hover:bg-white/5 hover:text-mist-100" aria-label={show ? "Ocultar senha" : "Mostrar senha"} title={show ? "Ocultar" : "Mostrar"}>
              {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>
      </Field>
      <Field name="passwordConfirm" label="Confirmar senha">
        <input id="passwordConfirm" name="passwordConfirm" type={show ? "text" : "password"} value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" className="field font-mono" />
      </Field>
      <button type="button" onClick={gen} className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-brand-400/25 px-3 text-xs font-semibold text-mist-200 hover:border-gold-400/50 hover:text-gold-200">
        <Wand2 className="h-3.5 w-3.5" /> Gerar senha forte
      </button>
    </div>
  );
}

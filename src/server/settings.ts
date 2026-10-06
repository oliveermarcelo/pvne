import { cache } from "react";
import { db, type DbOrTx } from "./db";

/** Configurações editáveis pelo administrador, com valores padrão. */
export const SETTING_DEFAULTS = {
  site_name: "PVNE Cards",
  site_tagline: "O mercado dos colecionadores de cards",
  whatsapp_group_url: "https://chat.whatsapp.com/",
  whatsapp_group_text: "Entre no grupo oficial e acompanhe leilões, novidades e trocas em primeira mão.",
  instagram_url: "https://instagram.com/",
  instagram_handle: "@pvnecards",
  contact_email: "contato@pvnecards.com.br",
  // Imagem opcional exibida como marca d'água no topo da home (envie no admin)
  hero_watermark_url: "",
  auction_ending_soon_minutes: "60",
  auction_antisniping_minutes: "0",
  auction_min_duration_hours: "1",
  auction_max_duration_days: "30",
  // Pagamento intermediado
  commission_percent: "10",
  pix_key: "",
  pix_key_type: "CNPJ",
  pix_holder_name: "PVNE CARDS",
  pix_city: "SAO PAULO",
  pix_bank_name: "",
  payment_deadline_hours: "48",
  auto_confirm_days: "7",
} as const;

export type SettingKey = keyof typeof SETTING_DEFAULTS;
export type Settings = Record<SettingKey, string>;

export const SETTING_KEYS = Object.keys(SETTING_DEFAULTS) as SettingKey[];

/** Dentro de uma transação, passe o `tx` — usar o cliente global ali pode esgotar o pool de conexões. */
export async function loadSettings(client: DbOrTx = db): Promise<Settings> {
  const out = { ...SETTING_DEFAULTS } as Settings;
  const rows = await client.setting.findMany().catch((e) => {
    // Sem banco (ex.: build do Docker) usa os valores padrão
    console.warn("[settings] usando padrões:", (e as Error).message.split("\n")[0]);
    return [];
  });
  for (const r of rows) if (r.key in out) out[r.key as SettingKey] = r.value;
  return out;
}

/** Versão memoizada por requisição (páginas/layout) */
export const getSettings = cache(() => loadSettings());

export function settingInt(settings: Settings, key: SettingKey): number {
  const n = parseInt(settings[key], 10);
  return Number.isFinite(n) ? n : parseInt(SETTING_DEFAULTS[key], 10) || 0;
}

/** Comissão padrão em pontos-base (10% → 1000) */
export function defaultCommissionBps(settings: Settings): number {
  const n = parseFloat(String(settings.commission_percent).replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 50 ? Math.round(n * 100) : 1000;
}

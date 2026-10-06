/**
 * Gera o código PIX "copia e cola" (BR Code / EMV QRCPS, padrão do Banco Central)
 * para uma cobrança estática com valor e identificador do pedido.
 */
type PixInput = { key: string; keyType: string; name: string; city: string; amountCents: number; txid: string; description?: string };

const field = (id: string, value: string) => `${id}${String(value.length).padStart(2, "0")}${value}`;

const ascii = (s: string, max: number) =>
  s
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 .\-]/g, "")
    .trim()
    .slice(0, max)
    .toUpperCase();

function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff;
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function normalizePixKey(key: string, type: string): string {
  const k = key.trim();
  if (type === "CPF" || type === "CNPJ") return k.replace(/\D/g, "");
  if (type === "PHONE") {
    const d = k.replace(/\D/g, "");
    return d.startsWith("55") && d.length >= 12 ? `+${d}` : `+55${d}`;
  }
  if (type === "EMAIL") return k.toLowerCase();
  return k;
}

export function buildPixPayload(p: PixInput): string {
  const key = normalizePixKey(p.key, p.keyType);
  const merchant = field("00", "br.gov.bcb.pix") + field("01", key) + (p.description ? field("02", ascii(p.description, 40)) : "");
  const txid = p.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const payload =
    field("00", "01") +
    field("26", merchant) +
    field("52", "0000") +
    field("53", "986") +
    field("54", (p.amountCents / 100).toFixed(2)) +
    field("58", "BR") +
    field("59", ascii(p.name, 25) || "PVNE CARDS") +
    field("60", ascii(p.city, 15) || "SAO PAULO") +
    field("62", field("05", txid)) +
    "6304";
  return payload + crc16(payload);
}

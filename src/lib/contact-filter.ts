/**
 * Remove meios de contato externos de textos livres (mensagens, descrições, observações),
 * para que as negociações não saiam da plataforma.
 */
const EMAIL = /[A-Z0-9._%+-]+@[A-Z0-9-]+(?:\.[A-Z0-9-]+)*\.[A-Z]{2,}/gi;
const LINKS = /\b(?:https?:\/\/)?(?:www\.)?(?:wa\.me|api\.whatsapp\.com|chat\.whatsapp\.com|whatsapp\.com|t\.me|telegram\.me|m\.me|instagram\.com|facebook\.com)\/?\S*/gi;
// Sequências com 10 a 13 dígitos (telefones com DDD, com ou sem separadores)
const DIGIT_RUN = /\+?\(?\d[\d\s().-]{8,20}\d/g;

export const CONTACT_MASK = "[contato removido]";

export function maskContacts(text: string): { text: string; masked: boolean } {
  let masked = false;
  let out = text.replace(EMAIL, () => ((masked = true), CONTACT_MASK));
  out = out.replace(LINKS, () => ((masked = true), CONTACT_MASK));
  out = out.replace(DIGIT_RUN, (m) => {
    const digits = m.replace(/\D/g, "").length;
    if (digits >= 10 && digits <= 13) {
      masked = true;
      return CONTACT_MASK;
    }
    return m;
  });
  return { text: out, masked };
}

export const maskText = (text: string | null | undefined) => (text ? maskContacts(text).text : text);

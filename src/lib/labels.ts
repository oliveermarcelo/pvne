// Rótulos em português para os enums do banco. Seguro para uso no cliente.

export const CONDITION_LABELS = {
  NEW: "Novo",
  EXCELLENT: "Excelente",
  VERY_GOOD: "Muito bom",
  GOOD: "Bom",
  FAIR: "Regular",
} as const;
export type ConditionKey = keyof typeof CONDITION_LABELS;

export const LISTING_TYPE_LABELS = {
  DIRECT_SALE: "Venda direta",
  NEGOTIATION: "Aceita propostas",
  AUCTION: "Leilão",
} as const;
export type ListingTypeKey = keyof typeof LISTING_TYPE_LABELS;

export const LISTING_STATUS_LABELS = {
  ACTIVE: "Ativo",
  SOLD: "Vendido",
  CANCELLED: "Cancelado",
  EXPIRED: "Encerrado sem venda",
  BLOCKED: "Bloqueado",
} as const;

export const AUCTION_STATUS_LABELS = {
  SCHEDULED: "Agendado",
  ACTIVE: "Em andamento",
  ENDED: "Encerrado",
  CANCELLED: "Cancelado",
} as const;

export const NEGOTIATION_STATUS_LABELS = {
  OPEN: "Em andamento",
  ACCEPTED: "Aceita",
  REJECTED: "Recusada",
  CANCELLED: "Cancelada",
} as const;

export const ORDER_STATUS_LABELS = {
  PENDING: "Concluído (fluxo antigo)",
  AWAITING_PAYMENT: "Aguardando pagamento",
  PAYMENT_REVIEW: "Pagamento em análise",
  PAID: "Pago — aguardando envio",
  SHIPPED: "Enviado",
  DELIVERED: "Entregue",
  COMPLETED: "Concluído",
  CANCELLED: "Cancelado",
  DISPUTED: "Em disputa",
} as const;

export const ORDER_STATUS_TONE = {
  PENDING: "neutral",
  AWAITING_PAYMENT: "warn",
  PAYMENT_REVIEW: "cyan",
  PAID: "gold",
  SHIPPED: "violet",
  DELIVERED: "ok",
  COMPLETED: "ok",
  CANCELLED: "neutral",
  DISPUTED: "bad",
} as const;

export const PAYOUT_STATUS_LABELS = { NOT_DUE: "Repasse liberado após a entrega", PENDING: "Repasse pendente", PAID: "Repasse feito" } as const;

export const SELLER_STATUS_LABELS = {
  NONE: "Não habilitado",
  PENDING: "Em análise",
  APPROVED: "Vendedor aprovado",
  REJECTED: "Recusado",
  SUSPENDED: "Suspenso",
} as const;

export const PIX_KEY_TYPE_LABELS = { CPF: "CPF", CNPJ: "CNPJ", EMAIL: "E-mail", PHONE: "Telefone", RANDOM: "Chave aleatória" } as const;

export const ORDER_SOURCE_LABELS = {
  DIRECT_SALE: "Compra direta",
  NEGOTIATION: "Proposta aceita",
  AUCTION: "Leilão",
} as const;

export const CARD_STATUS_LABELS = { ACTIVE: "Ativo", BLOCKED: "Bloqueado", REMOVED: "Removido" } as const;
export const ALBUM_STATUS_LABELS = { PUBLIC: "Público", PRIVATE: "Privado", ARCHIVED: "Arquivado" } as const;
export const USER_STATUS_LABELS = { ACTIVE: "Ativo", BLOCKED: "Bloqueado", DELETED: "Excluído" } as const;
export const USER_ROLE_LABELS = { USER: "Colecionador", ADMIN: "Administrador" } as const;

export const CONTACT_TYPE_LABELS = { CONTACT: "Contato", SUGGESTION: "Sugestão", COMPLAINT: "Reclamação" } as const;
export const CONTACT_STATUS_LABELS = {
  OPEN: "Aberto",
  IN_REVIEW: "Em análise",
  ANSWERED: "Respondido",
  CLOSED: "Encerrado",
} as const;

export const LANGUAGES = ["Português", "Inglês", "Japonês", "Espanhol", "Francês", "Alemão", "Italiano", "Coreano", "Chinês", "Outro"];

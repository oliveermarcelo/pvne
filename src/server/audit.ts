import type { DbOrTx } from "./db";
import type { Prisma } from "./db";

export type AuditInput = {
  actorId?: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  data?: Prisma.InputJsonValue;
  ip?: string | null;
};

/** Registra uma ação importante. A tabela é somente-inserção (trigger no banco). */
export async function audit(client: DbOrTx, input: AuditInput) {
  await client.auditLog.create({
    data: {
      actorId: input.actorId ?? null,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      data: input.data,
      ip: input.ip ?? null,
    },
  });
}

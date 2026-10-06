import { createHash, randomBytes } from "node:crypto";

/** Token aleatório (enviado ao cliente) */
export const randomToken = (bytes = 32) => randomBytes(bytes).toString("base64url");

/** Hash que é o que fica salvo no banco — vazamento do banco não expõe tokens válidos */
export const sha256 = (value: string) => createHash("sha256").update(value).digest("hex");

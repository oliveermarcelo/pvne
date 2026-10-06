-- CreateEnum
CREATE TYPE "SellerStatus" AS ENUM ('NONE', 'PENDING', 'APPROVED', 'REJECTED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "SellerApplicationStatus" AS ENUM ('PENDING', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "PersonType" AS ENUM ('PF', 'PJ');

-- CreateEnum
CREATE TYPE "PixKeyType" AS ENUM ('CPF', 'CNPJ', 'EMAIL', 'PHONE', 'RANDOM');

-- CreateEnum
CREATE TYPE "PayoutStatus" AS ENUM ('NOT_DUE', 'PENDING', 'PAID');

-- CreateEnum
CREATE TYPE "OrderEventType" AS ENUM ('STATUS', 'MESSAGE', 'ADMIN_NOTE', 'SYSTEM');

-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "NotificationType" ADD VALUE 'ORDER_UPDATE';
ALTER TYPE "NotificationType" ADD VALUE 'ORDER_MESSAGE';
ALTER TYPE "NotificationType" ADD VALUE 'SELLER_STATUS';

-- AlterEnum
ALTER TYPE "OrderStatus" ADD VALUE 'PAYMENT_REVIEW';

-- AlterTable
ALTER TABLE "categories" ADD COLUMN     "commission_bps" INTEGER;

-- AlterTable
ALTER TABLE "listings" ADD COLUMN     "shipping_cents" INTEGER NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "orders" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMP(3),
ADD COLUMN     "carrier" TEXT,
ADD COLUMN     "code" TEXT,
ADD COLUMN     "commission_bps" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "delivered_at" TIMESTAMP(3),
ADD COLUMN     "dispute_reason" TEXT,
ADD COLUMN     "paid_at" TIMESTAMP(3),
ADD COLUMN     "payment_confirmed_by_id" TEXT,
ADD COLUMN     "payment_due_at" TIMESTAMP(3),
ADD COLUMN     "payment_receipt_url" TEXT,
ADD COLUMN     "payment_reported_at" TIMESTAMP(3),
ADD COLUMN     "payout_at" TIMESTAMP(3),
ADD COLUMN     "payout_pix_key" TEXT,
ADD COLUMN     "payout_reference" TEXT,
ADD COLUMN     "payout_status" "PayoutStatus" NOT NULL DEFAULT 'NOT_DUE',
ADD COLUMN     "refunded_at" TIMESTAMP(3),
ADD COLUMN     "seller_net_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "ship_city" TEXT,
ADD COLUMN     "ship_complement" TEXT,
ADD COLUMN     "ship_district" TEXT,
ADD COLUMN     "ship_name" TEXT,
ADD COLUMN     "ship_number" TEXT,
ADD COLUMN     "ship_state" VARCHAR(2),
ADD COLUMN     "ship_street" TEXT,
ADD COLUMN     "ship_zip" TEXT,
ADD COLUMN     "shipped_at" TIMESTAMP(3),
ADD COLUMN     "shipping_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "total_cents" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "tracking_code" TEXT,
ALTER COLUMN "status" SET DEFAULT 'AWAITING_PAYMENT';

-- Pedidos anteriores (fluxo sem pagamento intermediado): recebem código e são dados como concluídos
UPDATE "orders" SET "code" = upper(right("id", 8)) WHERE "code" IS NULL;
ALTER TABLE "orders" ALTER COLUMN "code" SET NOT NULL;
UPDATE "orders" SET "status" = 'COMPLETED', "total_cents" = "amount_cents", "seller_net_cents" = "amount_cents" WHERE "status" = 'PENDING';

-- AlterTable
ALTER TABLE "users" ADD COLUMN     "seller_status" "SellerStatus" NOT NULL DEFAULT 'NONE';

-- CreateTable
CREATE TABLE "order_events" (
    "id" TEXT NOT NULL,
    "order_id" TEXT NOT NULL,
    "author_id" TEXT,
    "type" "OrderEventType" NOT NULL,
    "status" "OrderStatus",
    "body" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "order_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_applications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "status" "SellerApplicationStatus" NOT NULL DEFAULT 'PENDING',
    "person_type" "PersonType" NOT NULL,
    "legal_name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "birth_date" DATE,
    "phone" TEXT NOT NULL,
    "zip" TEXT NOT NULL,
    "street" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "complement" TEXT,
    "district" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "pix_key_type" "PixKeyType" NOT NULL,
    "pix_key" TEXT NOT NULL,
    "doc_front_url" TEXT NOT NULL,
    "doc_back_url" TEXT,
    "selfie_url" TEXT NOT NULL,
    "notes" TEXT,
    "rejection_reason" TEXT,
    "reviewed_by_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "seller_applications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "seller_profiles" (
    "user_id" TEXT NOT NULL,
    "application_id" TEXT NOT NULL,
    "person_type" "PersonType" NOT NULL,
    "legal_name" TEXT NOT NULL,
    "document" TEXT NOT NULL,
    "city" TEXT NOT NULL,
    "state" VARCHAR(2) NOT NULL,
    "pix_key_type" "PixKeyType" NOT NULL,
    "pix_key" TEXT NOT NULL,
    "approved_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "seller_profiles_pkey" PRIMARY KEY ("user_id")
);

-- CreateIndex
CREATE INDEX "order_events_order_id_created_at_idx" ON "order_events"("order_id", "created_at");

-- CreateIndex
CREATE INDEX "seller_applications_status_created_at_idx" ON "seller_applications"("status", "created_at");

-- CreateIndex
CREATE INDEX "seller_applications_user_id_idx" ON "seller_applications"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "seller_profiles_application_id_key" ON "seller_profiles"("application_id");

-- CreateIndex
CREATE UNIQUE INDEX "orders_code_key" ON "orders"("code");

-- CreateIndex
CREATE INDEX "orders_status_idx" ON "orders"("status");

-- CreateIndex
CREATE INDEX "orders_payout_status_idx" ON "orders"("payout_status");

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_order_id_fkey" FOREIGN KEY ("order_id") REFERENCES "orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "order_events" ADD CONSTRAINT "order_events_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_applications" ADD CONSTRAINT "seller_applications_reviewed_by_id_fkey" FOREIGN KEY ("reviewed_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "seller_profiles" ADD CONSTRAINT "seller_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- ─── Regras adicionais ───────────────────────────────────────

-- Quem já anunciava (e administradores) continua habilitado a vender
UPDATE "users" SET "seller_status" = 'APPROVED'
  WHERE "role" = 'ADMIN' OR "id" IN (SELECT DISTINCT "seller_id" FROM "listings");

-- Um único pedido de habilitação pendente por usuário
CREATE UNIQUE INDEX "seller_applications_one_pending_per_user"
  ON "seller_applications" ("user_id") WHERE "status" = 'PENDING';

ALTER TABLE "listings" ADD CONSTRAINT "listings_shipping_nonneg" CHECK ("shipping_cents" >= 0);
ALTER TABLE "orders" ADD CONSTRAINT "orders_values_valid"
  CHECK ("shipping_cents" >= 0 AND "fee_cents" >= 0 AND "seller_net_cents" >= 0 AND "total_cents" >= 0);
ALTER TABLE "categories" ADD CONSTRAINT "categories_commission_range"
  CHECK ("commission_bps" IS NULL OR ("commission_bps" >= 0 AND "commission_bps" <= 5000));

-- Linha do tempo do pedido é imutável
CREATE TRIGGER "order_events_immutable"
  BEFORE UPDATE OR DELETE ON "order_events"
  FOR EACH ROW EXECUTE FUNCTION pvne_prevent_mutation();

-- Regras de integridade que o schema do Prisma não expressa sozinho.

-- 1) No máximo UM anúncio ativo por card.
CREATE UNIQUE INDEX "listings_one_active_per_card"
  ON "listings" ("card_id") WHERE "status" = 'ACTIVE';

-- 2) No máximo UMA negociação aberta por comprador em cada anúncio.
CREATE UNIQUE INDEX "negotiations_one_open_per_buyer"
  ON "negotiations" ("listing_id", "buyer_id") WHERE "status" = 'OPEN';

-- 3) Restrições de valores.
ALTER TABLE "cards"    ADD CONSTRAINT "cards_quantity_positive"    CHECK ("quantity" > 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_quantity_positive" CHECK ("quantity" > 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_price_positive"    CHECK ("price_cents" IS NULL OR "price_cents" > 0);
ALTER TABLE "listings" ADD CONSTRAINT "listings_current_price_nonneg" CHECK ("current_price_cents" >= 0);
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_starting_bid_positive" CHECK ("starting_bid_cents" > 0);
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_increment_positive"    CHECK ("min_increment_cents" > 0);
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_reserve_positive"      CHECK ("reserve_price_cents" IS NULL OR "reserve_price_cents" > 0);
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_period_valid"          CHECK ("ends_at" > "starts_at");
ALTER TABLE "auctions" ADD CONSTRAINT "auctions_bid_count_nonneg"      CHECK ("bid_count" >= 0);
ALTER TABLE "bids"     ADD CONSTRAINT "bids_amount_positive"           CHECK ("amount_cents" > 0);
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_offer_positive" CHECK ("current_offer_cents" > 0);
ALTER TABLE "negotiations" ADD CONSTRAINT "negotiations_distinct_parties" CHECK ("buyer_id" <> "seller_id");
ALTER TABLE "orders"   ADD CONSTRAINT "orders_amount_positive"   CHECK ("amount_cents" > 0);
ALTER TABLE "orders"   ADD CONSTRAINT "orders_distinct_parties"  CHECK ("buyer_id" <> "seller_id");

-- 4) Históricos imutáveis: lances, eventos de negociação e auditoria
--    não podem ser alterados nem apagados, nem mesmo por SQL direto da aplicação.
CREATE OR REPLACE FUNCTION pvne_prevent_mutation() RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'A tabela % é somente-inserção (histórico imutável)', TG_TABLE_NAME
    USING ERRCODE = 'integrity_constraint_violation';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bids_immutable"
  BEFORE UPDATE OR DELETE ON "bids"
  FOR EACH ROW EXECUTE FUNCTION pvne_prevent_mutation();

CREATE TRIGGER "negotiation_messages_immutable"
  BEFORE UPDATE OR DELETE ON "negotiation_messages"
  FOR EACH ROW EXECUTE FUNCTION pvne_prevent_mutation();

CREATE TRIGGER "audit_logs_immutable"
  BEFORE UPDATE OR DELETE ON "audit_logs"
  FOR EACH ROW EXECUTE FUNCTION pvne_prevent_mutation();

-- 5) Lance deve ser coerente com o leilão no momento da inserção (defesa em profundidade:
--    a aplicação já valida dentro de uma transação com a linha do leilão bloqueada).
CREATE OR REPLACE FUNCTION pvne_validate_bid() RETURNS trigger AS $$
DECLARE
  a RECORD;
BEGIN
  SELECT * INTO a FROM "auctions" WHERE "id" = NEW."auction_id";
  IF a."seller_id" = NEW."bidder_id" THEN
    RAISE EXCEPTION 'O vendedor não pode dar lance no próprio leilão' USING ERRCODE = 'check_violation';
  END IF;
  IF a."status" NOT IN ('SCHEDULED', 'ACTIVE') OR clock_timestamp() < a."starts_at" OR clock_timestamp() >= a."ends_at" THEN
    RAISE EXCEPTION 'Leilão fora do período de lances' USING ERRCODE = 'check_violation';
  END IF;
  IF a."current_bid_cents" IS NULL THEN
    IF NEW."amount_cents" < a."starting_bid_cents" THEN
      RAISE EXCEPTION 'Lance abaixo do lance inicial' USING ERRCODE = 'check_violation';
    END IF;
  ELSIF NEW."amount_cents" < a."current_bid_cents" + a."min_increment_cents" THEN
    RAISE EXCEPTION 'Lance abaixo do mínimo permitido' USING ERRCODE = 'check_violation';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "bids_validate"
  BEFORE INSERT ON "bids"
  FOR EACH ROW EXECUTE FUNCTION pvne_validate_bid();

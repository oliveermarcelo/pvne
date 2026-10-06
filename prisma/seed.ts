/**
 * Dados iniciais: categorias, páginas institucionais, configurações e o administrador.
 * Com SEED_DEMO=1 (padrão em desenvolvimento) cria também colecionadores, cards,
 * anúncios, leilões com lances e negociações para demonstração.
 *
 *   npm run db:seed
 */
import "dotenv/config";
import { db } from "../src/server/db";
import { hashPassword } from "../src/server/auth/password";
import { SETTING_DEFAULTS } from "../src/server/settings";
import { createListing } from "../src/server/modules/listings";
import { placeBid } from "../src/server/modules/auctions";
import { startNegotiation, respondNegotiation } from "../src/server/modules/negotiations";
import { toLocalInput } from "../src/lib/dates";
import { PAGE_SEEDS } from "./seed-pages";

const CATEGORIES = [
  { name: "Pokémon", slug: "pokemon", color: "#F2CB74", description: "Pokémon Estampas Ilustradas — das coleções clássicas às expansões atuais." },
  { name: "One Piece", slug: "one-piece", color: "#FF6B6B", description: "One Piece Card Game: líderes, personagens e cartas alternativas." },
  { name: "Disney Lorcana", slug: "disney-lorcana", color: "#9B7BFF", description: "Disney Lorcana TCG: Enchanted, foils e promos." },
  { name: "Magic: The Gathering", slug: "magic", color: "#E8A15A", description: "Magic: The Gathering — Reserved List, staples e foils." },
  { name: "Yu-Gi-Oh!", slug: "yu-gi-oh", color: "#49D8F0", description: "Yu-Gi-Oh! TCG/OCG — primeiras edições, secretas e ultimates." },
  { name: "Marvel", slug: "marvel", color: "#FF5A5F", description: "Cards e colecionáveis do universo Marvel." },
  { name: "DC", slug: "dc", color: "#5B8CFF", description: "Cards e colecionáveis do universo DC." },
  { name: "Futebol", slug: "futebol", color: "#3DD68C", description: "Figurinhas e cards de futebol: Panini, Topps e edições especiais." },
  { name: "Outros", slug: "outros", color: "#AEB3C4", description: "Outros jogos de cards e colecionáveis." },
];

async function upsertUser(u: { name: string; username: string; email: string; password: string; role?: "USER" | "ADMIN"; city?: string; state?: string; phone?: string; bio?: string }) {
  const passwordHash = await hashPassword(u.password);
  return db.user.upsert({
    where: { email: u.email },
    update: {},
    create: {
      name: u.name,
      username: u.username,
      email: u.email,
      passwordHash,
      role: u.role ?? "USER",
      city: u.city,
      state: u.state,
      phone: u.phone,
      bio: u.bio,
    },
  });
}

async function main() {
  console.log("→ Categorias");
  for (const [i, c] of CATEGORIES.entries()) {
    await db.category.upsert({ where: { slug: c.slug }, update: {}, create: { ...c, sortOrder: i } });
  }

  console.log("→ Configurações e páginas");
  for (const [key, value] of Object.entries(SETTING_DEFAULTS)) {
    await db.setting.upsert({ where: { key }, update: {}, create: { key, value } });
  }
  for (const p of PAGE_SEEDS) {
    await db.page.upsert({ where: { slug: p.slug }, update: {}, create: p });
  }

  console.log("→ Administrador");
  const admin = await upsertUser({
    name: "Administrador PVNE",
    username: "admin_pvne",
    email: process.env.SEED_ADMIN_EMAIL ?? "admin@pvnecards.com.br",
    password: process.env.SEED_ADMIN_PASSWORD ?? "Admin@12345",
    role: "ADMIN",
    city: "São Paulo",
    state: "SP",
  });
  await db.user.update({ where: { id: admin.id }, data: { sellerStatus: "APPROVED" } });

  const demo = (process.env.SEED_DEMO ?? (process.env.NODE_ENV === "production" ? "0" : "1")) === "1";
  if (!demo) {
    console.log("✓ Seed básico concluído (SEED_DEMO=1 para dados de demonstração).");
    return;
  }
  console.log("→ Colecionadores de demonstração (senha: Demo@12345; eva@demo.pvne é só compradora)");
  const pw = "Demo@12345";
  const ana = await upsertUser({ name: "Ana Ribeiro", username: "ana.cards", email: "ana@demo.pvne", password: pw, city: "Curitiba", state: "PR", phone: "41999990001", bio: "Coleciono Pokémon desde a Base Set. Foco em holos e primeiras edições." });
  const bruno = await upsertUser({ name: "Bruno Tavares", username: "brunotcg", email: "bruno@demo.pvne", password: pw, city: "Belo Horizonte", state: "MG", phone: "31999990002", bio: "Magic e One Piece. Sempre aberto a trocas." });
  const carla = await upsertUser({ name: "Carla Nunes", username: "carla_lorcana", email: "carla@demo.pvne", password: pw, city: "Recife", state: "PE", phone: "81999990003", bio: "Lorcana Enchanted hunter ✦" });
  const diego = await upsertUser({ name: "Diego Moraes", username: "diegom", email: "diego@demo.pvne", password: pw, city: "São Paulo", state: "SP", phone: "11999990004" });

  // Colecionadores de demonstração já aprovados como vendedores (Eva é só compradora)
  const eva = await upsertUser({ name: "Eva Martins", username: "eva.coleciona", email: "eva@demo.pvne", password: pw, city: "Porto Alegre", state: "RS" });
  const docs = ["52998224725", "11144477735", "86288366757", "39053344705"];
  for (const [i, u] of [ana, bruno, carla, diego].entries()) {
    await db.user.update({ where: { id: u.id }, data: { sellerStatus: "APPROVED" } });
    await db.sellerProfile.upsert({
      where: { userId: u.id },
      update: {},
      create: { userId: u.id, applicationId: `seed-${u.id}`, personType: "PF", legalName: u.name, document: docs[i]!, city: u.city ?? "São Paulo", state: u.state ?? "SP", pixKeyType: "CPF", pixKey: docs[i]! },
    });
  }
  void eva;
  // PIX de demonstração (troque em Admin → Configurações)
  await db.setting.updateMany({ where: { key: "pix_key", value: "" }, data: { value: "pagamentos@pvnecards.com.br" } });
  await db.setting.updateMany({ where: { key: "pix_key_type", value: "CNPJ" }, data: { value: "EMAIL" } });

  // Contas de demonstração garantidas acima; cards/anúncios só num banco vazio
  if ((await db.card.count()) > 0) {
    console.log("✓ Já existem cards — dados de demonstração não recriados.");
    return;
  }


  const cat = Object.fromEntries((await db.category.findMany()).map((c) => [c.slug, c.id]));

  const album = (ownerId: string, categoryId: string, name: string, description: string) =>
    db.album.create({ data: { ownerId, categoryId, name, description } });

  const aPoke = await album(ana.id, cat["pokemon"]!, "Pokémon — Clássicos", "Base Set, Jungle, Fossil e as primeiras edições que marcaram época.");
  const aPoke2 = await album(ana.id, cat["pokemon"]!, "Pokémon — Escarlate e Violeta", "Ilustrações especiais e raras duplas da era atual.");
  const bMagic = await album(bruno.id, cat["magic"]!, "Magic — Reserved List", "Staples e peças da Reserved List.");
  const bOp = await album(bruno.id, cat["one-piece"]!, "One Piece — Líderes", "Líderes e alternativas de arte.");
  const cLor = await album(carla.id, cat["disney-lorcana"]!, "Lorcana Enchanted", "Minha busca pelas Enchanted de cada coleção.");
  const dYgo = await album(diego.id, cat["yu-gi-oh"]!, "Yu-Gi-Oh! Retrô", "LOB, MRD e cards da era clássica.");
  const dFut = await album(diego.id, cat["futebol"]!, "Copa do Mundo", "Figurinhas e cards especiais de Copa.");

  type C = { owner: string; album: string; category: string; name: string; code?: string; condition: "NEW" | "EXCELLENT" | "VERY_GOOD" | "GOOD" | "FAIR"; setName?: string; rarity?: string; language?: string; edition?: string; description?: string; quantity?: number };
  const mk = (c: C) =>
    db.card.create({
      data: {
        ownerId: c.owner,
        albumId: c.album,
        categoryId: c.category,
        name: c.name,
        code: c.code,
        condition: c.condition,
        setName: c.setName,
        rarity: c.rarity,
        language: c.language ?? "Inglês",
        edition: c.edition,
        description: c.description,
        quantity: c.quantity ?? 1,
      },
    });

  const charizard = await mk({ owner: ana.id, album: aPoke.id, category: cat["pokemon"]!, name: "Charizard Holo", code: "4/102", condition: "VERY_GOOD", setName: "Base Set", rarity: "Holo Rara", edition: "Unlimited", description: "Holo com brilho forte, cantos levemente gastos. Guardado em sleeve + toploader desde sempre." });
  const blastoise = await mk({ owner: ana.id, album: aPoke.id, category: cat["pokemon"]!, name: "Blastoise Holo", code: "2/102", condition: "EXCELLENT", setName: "Base Set", rarity: "Holo Rara", edition: "Unlimited" });
  const mewtwo = await mk({ owner: ana.id, album: aPoke.id, category: cat["pokemon"]!, name: "Mewtwo Holo", code: "10/102", condition: "GOOD", setName: "Base Set", rarity: "Holo Rara" });
  const pikachuIr = await mk({ owner: ana.id, album: aPoke2.id, category: cat["pokemon"]!, name: "Pikachu ex SIR", code: "238/191", condition: "NEW", setName: "Fagulhas Impetuosas", rarity: "Special Illustration Rare", language: "Português" });
  const miraidon = await mk({ owner: ana.id, album: aPoke2.id, category: cat["pokemon"]!, name: "Miraidon ex", code: "081/198", condition: "NEW", setName: "Escarlate e Violeta", rarity: "Rara Dupla", language: "Português", quantity: 3 });
  const bLotus = await mk({ owner: bruno.id, album: bMagic.id, category: cat["magic"]!, name: "Underground Sea", condition: "GOOD", setName: "Revised", rarity: "Rara", description: "Dual land da Reserved List. Pequeno whitening nas bordas." });
  const bForce = await mk({ owner: bruno.id, album: bMagic.id, category: cat["magic"]!, name: "Force of Will", condition: "VERY_GOOD", setName: "Alliances", rarity: "Incomum" });
  const bLuffy = await mk({ owner: bruno.id, album: bOp.id, category: cat["one-piece"]!, name: "Monkey.D.Luffy (Alt Art)", code: "OP05-119", condition: "NEW", setName: "Awakening of the New Era", rarity: "Secret Rare", language: "Japonês" });
  const bShanks = await mk({ owner: bruno.id, album: bOp.id, category: cat["one-piece"]!, name: "Shanks Leader", code: "OP01-120", condition: "EXCELLENT", setName: "Romance Dawn", rarity: "Leader" });
  const cElsa = await mk({ owner: carla.id, album: cLor.id, category: cat["disney-lorcana"]!, name: "Elsa - Spirit of Winter (Enchanted)", code: "207/204", condition: "NEW", setName: "The First Chapter", rarity: "Enchanted" });
  const cMickey = await mk({ owner: carla.id, album: cLor.id, category: cat["disney-lorcana"]!, name: "Mickey Mouse - Wayward Sorcerer (Enchanted)", code: "205/204", condition: "EXCELLENT", setName: "The First Chapter", rarity: "Enchanted" });
  const dDragon = await mk({ owner: diego.id, album: dYgo.id, category: cat["yu-gi-oh"]!, name: "Blue-Eyes White Dragon", code: "LOB-001", condition: "VERY_GOOD", setName: "Legend of Blue Eyes", rarity: "Ultra Rare", edition: "1ª edição" });
  const dMagician = await mk({ owner: diego.id, album: dYgo.id, category: cat["yu-gi-oh"]!, name: "Dark Magician", code: "LOB-005", condition: "GOOD", setName: "Legend of Blue Eyes", rarity: "Ultra Rare" });
  const dPele = await mk({ owner: diego.id, album: dFut.id, category: cat["futebol"]!, name: "Pelé — Figurinha Copa 1970", condition: "FAIR", setName: "Copa do Mundo México 1970", rarity: "Lendária", language: "Português" });

  const hours = (h: number) => toLocalInput(new Date(Date.now() + h * 3_600_000));

  console.log("→ Anúncios, leilões e lances");
  const ip = "127.0.0.1";
  const as = (u: { id: string }) => ({ id: u.id, role: "USER" });

  // Leilões ativos
  const lCharizard = await createListing(as(ana), charizard.id, { type: "AUCTION", startingBid: "500", minIncrement: "20", reservePrice: "", startsAt: "", endsAt: hours(72), quantity: "1" }, ip);
  await placeBid(bruno.id, lCharizard.auctionId!, "500", ip);
  await placeBid(carla.id, lCharizard.auctionId!, "540", ip);
  await placeBid(bruno.id, lCharizard.auctionId!, "600", ip);
  await placeBid(diego.id, lCharizard.auctionId!, "650", ip);

  const lDragon = await createListing(as(diego), dDragon.id, { type: "AUCTION", startingBid: "300", minIncrement: "10", reservePrice: "450", startsAt: "", endsAt: hours(1.5), quantity: "1" }, ip);
  await placeBid(ana.id, lDragon.auctionId!, "300", ip);
  await placeBid(bruno.id, lDragon.auctionId!, "320", ip);

  const lElsa = await createListing(as(carla), cElsa.id, { type: "AUCTION", startingBid: "900", minIncrement: "50", reservePrice: "", startsAt: "", endsAt: hours(120), quantity: "1" }, ip);
  await placeBid(ana.id, lElsa.auctionId!, "900", ip);

  await createListing(as(bruno), bLuffy.id, { type: "AUCTION", startingBid: "250", minIncrement: "10", reservePrice: "", startsAt: hours(24), endsAt: hours(24 * 6), quantity: "1" }, ip);

  // Vendas diretas
  await createListing(as(ana), blastoise.id, { type: "DIRECT_SALE", price: "780,00", shipping: "25,00", quantity: "1" }, ip);
  await createListing(as(ana), miraidon.id, { type: "DIRECT_SALE", price: "45,00", quantity: "2", notes: "Tenho 3 unidades; vendo 2 no lote." }, ip);
  await createListing(as(bruno), bForce.id, { type: "DIRECT_SALE", price: "1.150,00", shipping: "30,00", quantity: "1" }, ip);
  await createListing(as(diego), dPele.id, { type: "DIRECT_SALE", price: "2.500,00", quantity: "1" }, ip);

  // Aceita propostas
  const lPika = await createListing(as(ana), pikachuIr.id, { type: "NEGOTIATION", price: "1.500,00", quantity: "1", notes: "Aceito propostas e trocas por SIRs." }, ip);
  const lSea = await createListing(as(bruno), bLotus.id, { type: "NEGOTIATION", price: "3.200,00", quantity: "1" }, ip);
  const lMickey = await createListing(as(carla), cMickey.id, { type: "NEGOTIATION", price: "1.800,00", quantity: "1" }, ip);
  await createListing(as(diego), dMagician.id, { type: "NEGOTIATION", price: "480,00", quantity: "1" }, ip);

  const n1 = await startNegotiation(bruno.id, lPika.id, { amount: "1.200,00", message: "Olá! Faço 1.200 à vista, retiro em mãos se for possível." }, ip);
  await respondNegotiation(ana.id, n1.id, { action: "counter", amount: "1.380,00", message: "Consigo fazer 1.380 com frete incluso." }, ip);
  await startNegotiation(diego.id, lSea.id, { amount: "2.700,00" }, ip);
  await startNegotiation(ana.id, lMickey.id, { amount: "1.500,00", message: "Topa 1.500?" }, ip);

  void mewtwo; void bShanks; void admin;
  console.log("✓ Seed de demonstração concluído.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());

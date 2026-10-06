import type { Metadata } from "next";
import { BadgeCheck, Clock, ShieldAlert, XCircle } from "lucide-react";
import { requireUserPage } from "@/server/auth/guards";
import { db } from "@/server/db";
import { latestApplication } from "@/server/modules/sellers";
import { getSettings } from "@/server/settings";
import { sellerApplicationAction } from "@/app/actions/sellers";
import { SellerApplicationForm } from "@/components/account/seller-application-form";
import { Alert, PageHeader } from "@/components/ui/misc";
import { LinkButton } from "@/components/ui/button";
import { maskDocument } from "@/lib/documents";
import { formatDateTime } from "@/lib/dates";
import { PIX_KEY_TYPE_LABELS } from "@/lib/labels";

export const metadata: Metadata = { title: "Vender na PVNE" };
export const dynamic = "force-dynamic";

export default async function SellPage() {
  const session = await requireUserPage();
  const [user, app, settings] = await Promise.all([
    db.user.findUniqueOrThrow({ where: { id: session.id }, include: { sellerProfile: true } }),
    latestApplication(session.id),
    getSettings(),
  ]);

  return (
    <>
      <PageHeader
        eyebrow="Vendedores"
        title="Vender na PVNE"
        description={`Qualquer colecionador pode comprar e dar lances. Para anunciar, pedimos uma verificação rápida. A comissão da plataforma é de ${settings.commission_percent}% sobre o valor do item, descontada no repasse.`}
      />

      {user.sellerStatus === "APPROVED" && (
        <div className="space-y-5">
          <Alert tone="ok"><BadgeCheck className="mr-1 inline h-4 w-4" /> Você é um vendedor aprovado. Já pode anunciar seus cards.</Alert>
          {user.sellerProfile && (
            <div className="surface grid gap-4 p-5 text-sm sm:grid-cols-3">
              <div><p className="text-xs text-mist-500">Titular</p><p className="font-medium">{user.sellerProfile.legalName}</p></div>
              <div><p className="text-xs text-mist-500">Documento</p><p className="font-mono">{maskDocument(user.sellerProfile.document)}</p></div>
              <div><p className="text-xs text-mist-500">PIX para repasses</p><p>{PIX_KEY_TYPE_LABELS[user.sellerProfile.pixKeyType]} · {user.sellerProfile.pixKey.slice(0, 4)}•••</p></div>
            </div>
          )}
          <p className="text-xs text-mist-500">Precisa alterar dados ou a chave PIX? Fale com a gente pela página de contato.</p>
          <LinkButton href="/conta/cards">Ir para meus cards</LinkButton>
        </div>
      )}

      {user.sellerStatus === "PENDING" && (
        <Alert tone="info"><Clock className="mr-1 inline h-4 w-4" /> Seu pedido foi enviado{app ? ` em ${formatDateTime(app.createdAt)}` : ""} e está em análise. Você será notificado assim que houver uma resposta.</Alert>
      )}

      {user.sellerStatus === "SUSPENDED" && (
        <Alert tone="bad"><ShieldAlert className="mr-1 inline h-4 w-4" /> Sua habilitação de vendedor está suspensa. Fale com a administração pela página de contato.</Alert>
      )}

      {(user.sellerStatus === "NONE" || user.sellerStatus === "REJECTED") && (
        <>
          {user.sellerStatus === "REJECTED" && app?.rejectionReason && (
            <Alert tone="bad" className="mb-6"><XCircle className="mr-1 inline h-4 w-4" /> Pedido anterior recusado: {app.rejectionReason} Corrija e envie novamente.</Alert>
          )}
          <SellerApplicationForm action={sellerApplicationAction} defaults={{ name: user.name, phone: user.phone ?? "", city: user.city ?? "", state: user.state ?? "" }} />
        </>
      )}
    </>
  );
}

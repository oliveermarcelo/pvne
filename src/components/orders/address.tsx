import { formatZip } from "@/lib/documents";

type A = { shipName: string | null; shipZip: string | null; shipStreet: string | null; shipNumber: string | null; shipComplement: string | null; shipDistrict: string | null; shipCity: string | null; shipState: string | null };

export function AddressBlock({ o }: { o: A }) {
  if (!o.shipZip) return <p className="text-sm text-mist-500">Endereço ainda não informado.</p>;
  return (
    <address className="text-sm not-italic leading-relaxed text-mist-200">
      <b>{o.shipName}</b>
      <br />
      {o.shipStreet}, {o.shipNumber}
      {o.shipComplement ? ` — ${o.shipComplement}` : ""}
      <br />
      {o.shipDistrict} · {o.shipCity}/{o.shipState}
      <br />
      CEP {formatZip(o.shipZip)}
    </address>
  );
}

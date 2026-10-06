import Link from "next/link";
import { DefinitionList } from "@/components/ui/misc";
import { CONDITION_LABELS } from "@/lib/labels";

type CardLike = {
  name: string;
  code: string | null;
  condition: keyof typeof CONDITION_LABELS;
  edition: string | null;
  setName: string | null;
  language: string | null;
  rarity: string | null;
  quantity: number;
  description: string | null;
  category: { name: string; slug: string };
  album: { id: string; name: string } | null;
};

export function CardDetails({ card, showAlbum = true }: { card: CardLike; showAlbum?: boolean }) {
  return (
    <div className="surface p-5 sm:p-6">
      <h2 className="mb-5 text-sm font-semibold">Informações do card</h2>
      <DefinitionList
        items={[
          { label: "Categoria", value: <Link href={`/categorias/${card.category.slug}`} className="link">{card.category.name}</Link> },
          { label: "Estado de conservação", value: CONDITION_LABELS[card.condition] },
          { label: "Código / número", value: card.code },
          { label: "Coleção / expansão", value: card.setName },
          { label: "Edição", value: card.edition },
          { label: "Raridade", value: card.rarity },
          { label: "Idioma", value: card.language },
          { label: "Quantidade", value: String(card.quantity) },
          ...(showAlbum && card.album ? [{ label: "Álbum", value: <Link href={`/albuns/${card.album.id}`} className="link">{card.album.name}</Link> }] : []),
        ]}
      />
      {card.description && (
        <div className="mt-6 border-t border-white/5 pt-5">
          <h3 className="mb-2 text-xs font-medium text-mist-500">Descrição</h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-mist-300">{card.description}</p>
        </div>
      )}
    </div>
  );
}

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireUserPage } from "@/server/auth/guards";
import { categoryOptions } from "@/server/modules/categories";
import { getOwnedAlbum } from "@/server/modules/albums";
import { deleteAlbumAction, saveAlbumAction } from "@/app/actions/catalog";
import { AlbumForm } from "@/components/account/album-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Editar álbum" };

export default async function EditAlbumPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUserPage();
  const { id } = await params;
  const album = await getOwnedAlbum(user.id, id).catch(() => null);
  if (!album) notFound();
  return (
    <>
      <PageHeader
        eyebrow="Coleção"
        title="Editar álbum"
        actions={<ConfirmButton action={deleteAlbumAction.bind(null, album.id)} variant="danger" question="Excluir o álbum? Os cards continuam na sua coleção." confirmText="Excluir">Excluir álbum</ConfirmButton>}
      />
      <AlbumForm action={saveAlbumAction.bind(null, album.id)} categories={await categoryOptions()} values={album} />
    </>
  );
}

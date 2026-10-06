import type { Metadata } from "next";
import { requireUserPage } from "@/server/auth/guards";
import { categoryOptions } from "@/server/modules/categories";
import { saveAlbumAction } from "@/app/actions/catalog";
import { AlbumForm } from "@/components/account/album-form";
import { PageHeader } from "@/components/ui/misc";

export const metadata: Metadata = { title: "Novo álbum" };

export default async function NewAlbumPage() {
  await requireUserPage();
  return (
    <>
      <PageHeader eyebrow="Coleção" title="Novo álbum" />
      <AlbumForm action={saveAlbumAction.bind(null, null)} categories={await categoryOptions()} />
    </>
  );
}

import Link from "next/link";
import { LogoImage } from "@/components/layout/logo";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container flex justify-center py-14 sm:py-20">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <Link href="/" aria-label="PVNE Cards — início"><LogoImage height={96} priority /></Link>
        </div>
        <div className="surface p-6 sm:p-8">{children}</div>
      </div>
    </div>
  );
}

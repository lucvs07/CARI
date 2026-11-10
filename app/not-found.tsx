import Link from "next/link";
import { Button } from "@/components/ui/button";
import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center p-4">
      <CariSays
        message={cari.notFound}
        action={
          <Button asChild className="h-11">
            <Link href="/">{cari.goHome}</Link>
          </Button>
        }
      />
    </main>
  );
}

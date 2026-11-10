"use client";

import { useRouter } from "next/navigation";
import { ChevronsUpDown, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cari } from "@/features/cari/messages";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { toast } from "sonner";

export function HouseholdSwitcher({
  userId,
  currentId,
  households,
}: {
  userId: string;
  currentId: string;
  households: { id: string; name: string }[];
}) {
  const router = useRouter();
  const current = households.find((h) => h.id === currentId);

  async function switchTo(id: string) {
    if (id === currentId) return;
    const { error } = await getBrowserSupabase()
      .from("profiles")
      .update({ last_household_id: id })
      .eq("id", userId);
    if (error) {
      toast.error(cari.genericError);
      return;
    }
    router.push(`/${id}/lista`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="max-w-[70vw] gap-2 text-base font-semibold">
          <span className="truncate">{current?.name ?? "Casa"}</span>
          <ChevronsUpDown aria-hidden />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuRadioGroup value={currentId} onValueChange={switchTo}>
          {households.map((h) => (
            <DropdownMenuRadioItem key={h.id} value={h.id} className="min-h-11">
              <span className="truncate">{h.name}</span>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" onSelect={() => router.push("/bem-vindo")}>
          <Plus aria-hidden /> Criar outra casa
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useQueryClient, type QueryClient } from "@tanstack/react-query";
import { UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { LISTA_CACHE } from "@/features/pwa/cacheNames";
import { forgetLastHousehold } from "@/features/pwa/lastHousehold";
import { clearPersistedCache, persister } from "@/lib/query/persist";
import { getBrowserSupabase } from "@/lib/supabase/browser";
import { ThemeToggle } from "./ThemeToggle";

type SignOutDeps = {
  queryClient: Pick<QueryClient, "cancelQueries" | "clear">;
  navigate: () => void;
};

/** Ordem importa: encerra a sessão antes de limpar, para nenhum refetch repopular o cache do usuário anterior. */
export async function signOut({ queryClient, navigate }: SignOutDeps) {
  try {
    await getBrowserSupabase().auth.signOut({ scope: "local" });
  } catch {
    // segue limpando e saindo mesmo assim
  } finally {
    try {
      await queryClient.cancelQueries();
      queryClient.clear();
      await persister.removeClient();
      await clearPersistedCache();
      forgetLastHousehold();
      if (typeof window !== "undefined" && "caches" in window) await caches.delete(LISTA_CACHE);
    } catch {
      // limpeza falhou: nunca bloqueia o logout
    } finally {
      queryClient.clear();
      navigate();
    }
  }
}

export function UserMenu({ householdId, email }: { householdId?: string; email?: string } = {}) {
  const router = useRouter();
  const queryClient = useQueryClient();

  async function handleSignOut() {
    await signOut({ queryClient, navigate: () => router.replace("/login") });
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon" aria-label="Menu da conta">
          <UserRound />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-60">
        {email && <DropdownMenuLabel className="truncate font-normal text-muted-foreground">{email}</DropdownMenuLabel>}
        {householdId && (
          <DropdownMenuItem asChild className="min-h-11">
            <Link href={`/${householdId}/casa`}>Gerenciar casa</Link>
          </DropdownMenuItem>
        )}
        <DropdownMenuSeparator />
        <ThemeToggle />
        <DropdownMenuSeparator />
        <DropdownMenuItem className="min-h-11" onSelect={handleSignOut}>
          Sair
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

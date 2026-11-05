"use client";

import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { MoreVertical } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cari } from "@/features/cari/messages";
import { cariErrorMessage } from "@/lib/errors";
import { removeMember, setMemberRole, type ActionError } from "./actions";
import { membersKey, type Member } from "./queries";
import { useMembers } from "./useMembers";

export function MembersList({
  householdId,
  currentUserId,
  initialMembers,
}: {
  householdId: string;
  currentUserId: string;
  initialMembers: Member[];
}) {
  const queryClient = useQueryClient();
  const { data } = useMembers(householdId, initialMembers);
  const members = data ?? initialMembers;
  // O snapshot do servidor é o mais fresco: vence um ['members', id] já em cache (da Lista ou do IndexedDB).
  useEffect(() => {
    queryClient.setQueryData(membersKey(householdId), initialMembers);
  }, [queryClient, householdId, initialMembers]);
  const [busy, setBusy] = useState(false);
  const isOwner = members.some((m) => m.user_id === currentUserId && m.role === "owner");

  async function run(action: () => Promise<{ ok: true } | ActionError>) {
    setBusy(true);
    try {
      const res = await action();
      if ("error" in res) toast.error(cariErrorMessage(res.error));
      await queryClient.invalidateQueries({ queryKey: membersKey(householdId) });
    } catch {
      toast.error(cari.genericError);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section aria-labelledby="membros-titulo" className="flex flex-col gap-2">
      <h2 id="membros-titulo" className="text-lg font-semibold">
        Membros
      </h2>
      <ul className="flex flex-col divide-y">
        {members.map((m) => {
          const name = m.display_name || "Sem nome";
          return (
            <li key={m.user_id} className="flex min-h-14 items-center gap-3 py-1">
              <Avatar>
                {m.avatar_url && <AvatarImage src={m.avatar_url} alt="" />}
                <AvatarFallback>{name.slice(0, 1).toUpperCase()}</AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate">
                {name}
                {m.user_id === currentUserId && <span className="text-muted-foreground"> (você)</span>}
              </span>
              <span className="text-sm text-muted-foreground">{m.role === "owner" ? "Dono" : "Membro"}</span>
              {isOwner && m.user_id !== currentUserId && (
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" aria-label={`Ações de ${name}`} disabled={busy}>
                      <MoreVertical aria-hidden />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    {m.role !== "owner" && (
                      <DropdownMenuItem
                        className="min-h-11"
                        onSelect={() => run(() => setMemberRole(householdId, m.user_id, "owner"))}
                      >
                        Tornar dono
                      </DropdownMenuItem>
                    )}
                    <DropdownMenuItem
                      className="min-h-11"
                      variant="destructive"
                      onSelect={() => run(() => removeMember(householdId, m.user_id))}
                    >
                      Remover
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, Package, ShoppingCart } from "lucide-react";
import { cn } from "cn";

const TABS = [
  { slug: "estoque", label: "Estoque", Icon: Package },
  { slug: "lista", label: "Lista", Icon: ShoppingCart },
  { slug: "receitas", label: "Receitas", Icon: BookOpen },
] as const;

export function BottomTabs({ householdId }: { householdId: string }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t bg-background pb-[env(safe-area-inset-bottom)]"
    >
      <ul className="mx-auto flex max-w-2xl">
        {TABS.map(({ slug, label, Icon }) => {
          const href = `/${householdId}/${slug}`;
          const active = pathname === href || pathname.startsWith(`${href}/`);
          return (
            <li key={slug} className="flex-1">
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex min-h-14 flex-col items-center justify-center gap-0.5 text-xs font-medium outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
                  active ? "text-primary" : "text-secondary",
                )}
              >
                <Icon className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

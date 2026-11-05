import { z } from "zod";
import { cari } from "@/features/cari/messages";
import { CATEGORIES } from "@/lib/categories";
import { UNITS, parseQuantity } from "@/lib/units";
import type { Database } from "@/lib/supabase/database.types";

export type Item = Database["public"]["Tables"]["items"]["Row"];

export const MAX_QUANTITY = 9999999.999;

export const itemInputSchema = z.object({
  name: z.string().trim().min(1, cari.itemNameRequired).max(80, cari.itemNameTooLong),
  quantity: z.string().transform((raw, ctx) => {
    const parsed = parseQuantity(raw);
    if (parsed === null) {
      ctx.issues.push({ code: "custom", message: cari.quantityInvalid, input: raw });
      return z.NEVER;
    }
    const rounded = Math.round(parsed * 1000) / 1000;
    if (rounded > MAX_QUANTITY) {
      ctx.issues.push({ code: "custom", message: cari.quantityTooLarge, input: raw });
      return z.NEVER;
    }
    return rounded;
  }),
  unit: z.enum(UNITS as [string, ...string[]]) as z.ZodType<(typeof UNITS)[number]>,
  category: z.enum(CATEGORIES),
});

export type ItemInput = z.infer<typeof itemInputSchema>;

/** Mesma normalização do banco (`normalize_name`): sem acentos, minúsculas, sem espaços nas pontas. */
export function normalizeName(name: string): string {
  return name.normalize("NFD").replace(/\p{Diacritic}/gu, "").trim().toLowerCase();
}

"use client";

import { useId } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CATEGORIES, CATEGORY_LABELS, type Category } from "@/lib/categories";
import { UNITS, type Unit } from "@/lib/units";

export function QuantityField({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  const id = useId();
  return (
    <div className="flex flex-col gap-1.5">
      <Label htmlFor={id}>Quantidade</Label>
      <Input id={id} className="h-11" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  );
}

export function UnitCategoryFields({
  unit,
  category,
  onUnit,
  onCategory,
}: {
  unit: Unit;
  category: Category;
  onUnit: (u: Unit) => void;
  onCategory: (c: Category) => void;
}) {
  const unitId = useId();
  const categoryId = useId();
  return (
    <div className="grid grid-cols-2 gap-3">
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={unitId}>Unidade</Label>
        <Select value={unit} onValueChange={(v) => onUnit(v as Unit)}>
          <SelectTrigger id={unitId} className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {UNITS.map((u) => (
              <SelectItem key={u} value={u}>
                {u}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="flex flex-col gap-1.5">
        <Label htmlFor={categoryId}>Categoria</Label>
        <Select value={category} onValueChange={(v) => onCategory(v as Category)}>
          <SelectTrigger id={categoryId} className="h-11 w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c} value={c}>
                {CATEGORY_LABELS[c]}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    </div>
  );
}

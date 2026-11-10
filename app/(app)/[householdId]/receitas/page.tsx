import { CariSays } from "@/features/cari/CariSays";
import { cari } from "@/features/cari/messages";

export default function ReceitasPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-semibold">Receitas</h1>
      <CariSays message={cari.recipesSoon} />
    </>
  );
}

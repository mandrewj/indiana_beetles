import { DistributionView } from "./DistributionView";
import { getAllFamilies, getAllSpecies, getTaxonomy } from "@/lib/content";

export const metadata = {
  title: "Distribution",
};

export default async function DistributionPage() {
  const [families, allSpecies, taxonomy] = await Promise.all([
    getAllFamilies(),
    getAllSpecies(),
    getTaxonomy(),
  ]);
  return (
    <DistributionView
      families={families}
      species={allSpecies}
      taxonomy={taxonomy}
    />
  );
}

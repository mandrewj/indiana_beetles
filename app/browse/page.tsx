import { BrowseView } from "./BrowseView";
import { getAllFamilies, getTaxonomy } from "@/lib/content";

export const metadata = {
  title: "Browse families",
};

export default async function BrowsePage() {
  const [families, taxonomy] = await Promise.all([
    getAllFamilies(),
    getTaxonomy(),
  ]);
  const treated: Record<string, { genera: number; species: number }> = {};
  for (const tf of taxonomy.families) {
    treated[tf.id] = {
      genera: tf.genera.length,
      species: tf.genera.reduce((n, g) => n + g.species.length, 0),
    };
  }
  return <BrowseView families={families} treated={treated} />;
}

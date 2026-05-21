import {
  getAllKeyFiles,
  getAllSpecies,
  getFamilyKey,
  getKey,
  getTaxonomy,
} from "@/lib/content";
import { IdentifyView } from "./IdentifyView";

export const metadata = {
  title: "Identify a specimen",
};

export default async function IdentifyPage() {
  const [familyKey, allKeyFiles, taxonomy, allSpecies] = await Promise.all([
    getFamilyKey(),
    getAllKeyFiles(),
    getTaxonomy(),
    getAllSpecies(),
  ]);

  // Load all family/genus keys for cross-key navigation.
  const otherKeys = await Promise.all(
    allKeyFiles
      .filter((f) => f !== "family-key")
      .map(async (filename) => ({ filename, key: await getKey(filename) }))
  );

  // taxon id → display name
  const taxonNames: Record<string, string> = {};
  for (const fam of taxonomy.families) {
    taxonNames[fam.id] = fam.name;
    for (const gen of fam.genera) {
      taxonNames[gen.id] = gen.name;
      for (const sp of gen.species) {
        taxonNames[sp.id] = sp.name;
      }
    }
  }

  // species id → route
  const speciesRoutes: Record<string, string> = {};
  for (const sp of allSpecies) {
    const family = taxonomy.families.find((f) =>
      f.genera.some((g) => g.id === sp.genus)
    );
    if (family) {
      speciesRoutes[sp.id] = `/browse/${family.id}/${sp.genus}/${sp.id}`;
    }
  }

  // Build a serializable map of childKey lookups by id.
  // For each family that has a key file ${familyId}-key, expose its top + any
  // embedded genus_keys[].
  const childKeyMap: Record<string, ReturnType<typeof getKey> extends Promise<infer T> ? T : never> = {};
  for (const { filename, key } of otherKeys) {
    if (filename.endsWith("-key")) {
      const familyId = filename.slice(0, -"-key".length);
      childKeyMap[familyId] = key;
    }
    for (const g of key.genus_keys ?? []) {
      childKeyMap[g.genus] = {
        type: "dichotomous",
        scope: "species",
        title: g.title,
        couplets: g.couplets,
      };
    }
  }

  return (
    <IdentifyView
      familyKey={familyKey}
      childKeyMap={childKeyMap}
      taxonNames={taxonNames}
      speciesRoutes={speciesRoutes}
    />
  );
}

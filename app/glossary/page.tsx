import { GlossaryView } from "./GlossaryView";
import { getGlossary } from "@/lib/content";

export const metadata = {
  title: "Glossary",
};

export default async function GlossaryPage() {
  const glossary = await getGlossary();
  return <GlossaryView entries={glossary.entries} />;
}

import { BrowseView } from "./BrowseView";
import { getAllFamilies } from "@/lib/content";

export const metadata = {
  title: "Browse families",
};

export default async function BrowsePage() {
  const families = await getAllFamilies();
  return <BrowseView families={families} />;
}

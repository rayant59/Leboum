import { notFound } from "next/navigation";
import { DesignHome } from "./DesignHome";

// L'éditeur de design n'existe qu'en local (npm run dev:web) : en ligne, /design
// est une page introuvable.
export default function DesignPage() {
  if (process.env.NODE_ENV !== "development") notFound();
  return <DesignHome />;
}

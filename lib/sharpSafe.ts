// Caricamento lazy di sharp: su Vercel/Turbopack il binario nativo
// (libvips) a volte non viene incluso nel bundle serverless e l'import
// statico fa crashare l'intera route al load del modulo. Con l'import
// dinamico l'eventuale fallimento resta contenuto qui: i chiamanti
// ricevono null e usano il fallback (immagine non ridimensionata/compressa).
import type sharp from "sharp";

type Sharp = typeof sharp;

let sharpPromise: Promise<Sharp | null> | null = null;

export function caricaSharp(): Promise<Sharp | null> {
  if (!sharpPromise) {
    sharpPromise = import("sharp")
      .then((mod) => mod.default)
      .catch((error) => {
        console.error("sharp non disponibile, uso fallback senza compressione", error);
        return null;
      });
  }
  return sharpPromise;
}

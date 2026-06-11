// Compressione client-side delle foto prima dell'upload: fondamentale
// da cantiere con rete 4G scarsa. Resize max ~1920px + JPEG qualità 0.8.

const LATO_MASSIMO_PX = 1920;
const QUALITA_JPEG = 0.8;

export async function comprimiFoto(file: File): Promise<Blob> {
  const bitmap = await createImageBitmap(file);

  const scala = Math.min(
    1,
    LATO_MASSIMO_PX / Math.max(bitmap.width, bitmap.height)
  );
  const larghezza = Math.round(bitmap.width * scala);
  const altezza = Math.round(bitmap.height * scala);

  const canvas = document.createElement("canvas");
  canvas.width = larghezza;
  canvas.height = altezza;

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Canvas non disponibile");
  }
  ctx.drawImage(bitmap, 0, 0, larghezza, altezza);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", QUALITA_JPEG)
  );

  if (!blob) {
    throw new Error("Compressione foto non riuscita");
  }

  return blob;
}

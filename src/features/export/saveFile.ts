function download(file: File): void {
  const url = URL.createObjectURL(file);
  const link = document.createElement('a');
  link.href = url;
  link.download = file.name;
  link.click();
  URL.revokeObjectURL(url);
}

/**
 * Hands the CSV to the user. Phones get the share sheet, the natural way to send it to a computer
 * or save it to Files. Returns false when the user backs out, so the days stay unexported.
 */
export async function saveFile(bytes: Uint8Array, fileName: string): Promise<boolean> {
  const file = new File([bytes as BlobPart], fileName, { type: 'text/csv' });
  const isTouchDevice = matchMedia('(pointer: coarse)').matches;

  if (isTouchDevice && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file] });
      return true;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return false;
    }
  }
  download(file);
  return true;
}

/**
 * Check if a barcode's bounding box is fully inside the viewfinder region.
 * 
 * @param barcode - The detected barcode object with boundingBox
 * @param video - The video element being scanned
 * @param insetPercent - The viewfinder inset as a fraction (e.g., 0.2 for 20% inset)
 * @returns true if the barcode is fully inside the viewfinder
 */
export function isBarcodeInsideViewfinder(
  barcode: any,
  video: HTMLVideoElement,
  insetPercent: number = 0.2
): boolean {
  const bb = barcode.boundingBox;
  if (!bb) return false;

  const vw = video.videoWidth;
  const vh = video.videoHeight;
  if (!vw || !vh) return false;

  // Viewfinder region in video intrinsic coordinates
  const left = vw * insetPercent;
  const top = vh * insetPercent;
  const right = vw * (1 - insetPercent);
  const bottom = vh * (1 - insetPercent);

  // Check if barcode is fully inside viewfinder
  return (
    bb.x >= left &&
    bb.y >= top &&
    bb.x + bb.width <= right &&
    bb.y + bb.height <= bottom
  );
}

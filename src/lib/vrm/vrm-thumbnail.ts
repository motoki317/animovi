/**
 * VRM Thumbnail - Captures a JPEG screenshot from the Three.js canvas.
 */

export function captureThumbnail(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to capture thumbnail'))
        }
      },
      'image/jpeg',
      0.7
    )
  })
}

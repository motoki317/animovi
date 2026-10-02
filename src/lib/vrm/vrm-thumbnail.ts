/** Rejects when toBlob() yields null, for example for a zero-size canvas. */
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

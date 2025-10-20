export async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function approxDataUrlBytes(dataUrl: string): number {
  const base64 = dataUrl.split(',')[1] || ''
  return Math.ceil(base64.length * 0.75)
}

async function decodeToCanvas(file: File): Promise<HTMLCanvasElement> {
  // Try createImageBitmap first to avoid CORS issues
  try {
    const bitmap = await createImageBitmap(file)
    const canvas = document.createElement('canvas')
    canvas.width = bitmap.width
    canvas.height = bitmap.height
    const ctx = canvas.getContext('2d')!
    ctx.drawImage(bitmap, 0, 0)
    bitmap.close && bitmap.close()
    return canvas
  } catch (_) {
    // Fallback to ObjectURL + Image
    const url = URL.createObjectURL(file)
    try {
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const image = new Image()
        image.onload = () => resolve(image)
        image.onerror = reject
        image.src = url
      })
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth || img.width
      canvas.height = img.naturalHeight || img.height
      const ctx = canvas.getContext('2d')!
      ctx.drawImage(img, 0, 0)
      return canvas
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

/**
 * Compress image to WebP if file.size exceeds threshold.
 * Preserves original dimensions; steps down quality gently until near target.
 */
export async function compressImageIfNeededToDataUrl(
  file: File,
  options: { thresholdBytes?: number; targetMime?: string; initialQuality?: number; minQuality?: number; step?: number } = {}
): Promise<string> {
  const {
    thresholdBytes = 2 * 1024 * 1024, // 2MB
    targetMime = 'image/webp',
    initialQuality = 0.92,
    minQuality = 0.8,
    step = 0.04
  } = options

  if (!file || !file.type.startsWith('image/')) {
    return fileToDataUrl(file)
  }
  if (file.size <= thresholdBytes) {
    return fileToDataUrl(file)
  }

  const canvas = await decodeToCanvas(file)
  // Try quality ladder to keep clarity while reducing size
  let quality = initialQuality
  let dataUrl: string = ''
  while (quality >= minQuality) {
    try {
      dataUrl = canvas.toDataURL(targetMime, quality)
    } catch (err) {
      // Some browsers may not support WEBP quality with toDataURL; fallback without quality
      dataUrl = canvas.toDataURL(targetMime)
    }
    const bytes = approxDataUrlBytes(dataUrl)
    if (bytes <= thresholdBytes) break
    quality -= step
  }
  // If still larger than threshold, return the last attempt; caller may accept larger size
  return dataUrl || fileToDataUrl(file)
}
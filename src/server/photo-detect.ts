// Face detection wrapper around @vladmandic/face-api. Lazy-loads the
// SSD-MobileNet-v1 model on first call and caches it for the process
// lifetime. Honours PHOTO_CHECK_MOCK=true by routing on the filename
// suffix so tests, local dev, and CI never touch the model.
//
// Filename mock conventions (when PHOTO_CHECK_MOCK=true):
//   *-noface.*    → faceCount = 0
//   *-multiface.* → faceCount = 2
//   anything else → faceCount = 1

import path from 'node:path'

import { env } from '../env.server'

type DetectFacesResult = { faceCount: number }

let modelLoaded = false

async function loadModelOnce(): Promise<typeof import('@vladmandic/face-api')> {
  const faceapi = await import('@vladmandic/face-api')
  await import('@tensorflow/tfjs-node')
  if (!modelLoaded) {
    const modelDir = path.join(process.cwd(), 'public', 'face-api-models')
    await faceapi.nets.ssdMobilenetv1.loadFromDisk(modelDir)
    modelLoaded = true
  }
  return faceapi
}

function mockOutcome(filename: string): DetectFacesResult {
  const stem = filename.toLowerCase()
  if (stem.includes('-noface')) return { faceCount: 0 }
  if (stem.includes('-multiface')) return { faceCount: 2 }
  return { faceCount: 1 }
}

export async function detectFaces(
  buffer: Buffer,
  filename: string,
): Promise<DetectFacesResult> {
  if (env.PHOTO_CHECK_MOCK) {
    return mockOutcome(filename)
  }

  const faceapi = await loadModelOnce()
  const tf = await import('@tensorflow/tfjs-node')

  // tfjs-node can decode JPEG/PNG/BMP/GIF directly into a 3-channel tensor.
  const tensor = tf.node.decodeImage(buffer, 3) as unknown as Parameters<
    typeof faceapi.detectAllFaces
  >[0]
  try {
    const detections = await faceapi.detectAllFaces(tensor)
    return { faceCount: detections.length }
  } finally {
    ;(tensor as { dispose?: () => void }).dispose?.()
  }
}

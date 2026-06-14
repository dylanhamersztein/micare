// Supabase Storage wrapper. Returns the public URL after uploading the
// photo into the configured bucket under <shortId>/photo.<ext>. Honours
// SUPABASE_STORAGE_MOCK=true by returning a deterministic URL without any
// network call, mirroring the GOC_MOCK / VITE_STRIPE_MOCK pattern.

import { createClient } from '@supabase/supabase-js'

import { env } from '../env.server'

type UploadInput = {
  shortId: string
  buffer: Buffer
  mimeType: 'image/jpeg' | 'image/png' | 'image/webp'
}

const EXTENSION: Record<UploadInput['mimeType'], string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
}

function objectPath(shortId: string, ext: string): string {
  return `${shortId}/photo.${ext}`
}

let client: ReturnType<typeof createClient> | undefined

function getClient(): ReturnType<typeof createClient> {
  if (!client) {
    if (!env.SUPABASE_URL) {
      throw new Error(
        'SUPABASE_URL is required when SUPABASE_STORAGE_MOCK is false',
      )
    }
    client = createClient(env.SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false },
    })
  }
  return client
}

export async function uploadProfilePhoto(input: UploadInput): Promise<string> {
  const ext = EXTENSION[input.mimeType]
  const objectKey = objectPath(input.shortId, ext)

  if (env.SUPABASE_STORAGE_MOCK) {
    // Return a data URL so the browser can actually render the uploaded
    // photo in the preview and on the public profile page during local
    // dev. A real Storage upload would return a CDN URL the browser could
    // fetch; the data URL is the simplest local equivalent.
    return `data:${input.mimeType};base64,${input.buffer.toString('base64')}`
  }

  const bucket = getClient().storage.from(env.SUPABASE_STORAGE_BUCKET)
  const { error } = await bucket.upload(objectKey, input.buffer, {
    contentType: input.mimeType,
    upsert: true,
  })
  if (error) {
    throw new Error(`Supabase Storage upload failed: ${error.message}`)
  }
  const { data } = bucket.getPublicUrl(objectKey)
  return data.publicUrl
}

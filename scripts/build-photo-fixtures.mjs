#!/usr/bin/env node
// Rebuilds tests/fixtures/photos/ from its three upstream photographs.
//
// The fixtures are committed, the way public/face-api-models/ is, so this
// script is deliberately NOT part of `pnpm setup:local`: a fresh checkout
// already has everything `pnpm test:e2e` needs, and nothing about running the
// suite reaches the network. Run this only to regenerate the images after
// changing a crop or a source, or to prove the committed bytes still follow
// from where they say they came from.
//
// Why photographs at all: the profile photo check runs SSD-MobileNet-v1 over
// the uploaded bytes. A generated rectangle — or, as it turns out, a
// carefully drawn vector face — detects as no-face, so a suite built on
// synthetic images can only ever exercise the rejection path.
//
// Why these photographs: they are works of NASA, in the public domain, and
// every one is either an official portrait or an official crew photograph.
// A test fixture is committed forever and cloned by everyone; taking a
// snapshot of private individuals for that is a licence question and a
// courtesy question, and public-domain official imagery avoids both.
//
// Each source is pinned by URL and by SHA-256. Wikimedia serves a stable path
// per filename but the bytes behind it can be replaced by a re-upload, so the
// hash is what actually pins this — a re-run either reproduces the committed
// fixtures or fails loudly.
//
// The face counts these images are supposed to yield are not asserted here.
// tests/integration/photo-detect-fixtures.test.ts runs the real detector over
// the committed files, and that is what fails if a source is re-pinned to
// something that no longer holds one face, or several, or none.

import crypto from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import sharp from 'sharp'

const USER_AGENT =
  'micare-fixture-build/1.0 (https://github.com/dylanhamersztein/micare)'

const FIXTURES = [
  {
    name: 'headshot.jpg',
    // "Chris Cassidy - Official NASA Astronaut Portrait in EMU (cropped)"
    // https://commons.wikimedia.org/wiki/File:Chris_Cassidy_-_Official_NASA_Astronaut_Portrait_in_EMU_(cropped).jpg
    url:
      'https://upload.wikimedia.org/wikipedia/commons/e/ec/' +
      'Chris_Cassidy_-_Official_NASA_Astronaut_Portrait_in_EMU_%28cropped%29.jpg',
    sha256: 'd4d34222268911f22d72692683d87cc1ab018e754843c2b3d0474188badb914c',
    width: 420,
  },
  {
    name: 'group-multiface.jpg',
    // "Expedition 38 crew members pose for an in-flight crew portrait
    //  - NASA ISS038-E-054970 (cropped)"
    // https://commons.wikimedia.org/wiki/File:Expedition_38_crew_members_pose_for_an_in-flight_crew_portrait_-_NASA_ISS038-E-054970_(cropped).jpg
    url:
      'https://upload.wikimedia.org/wikipedia/commons/0/05/' +
      'Expedition_38_crew_members_pose_for_an_in-flight_crew_portrait_-_' +
      'NASA_ISS038-E-054970_%28cropped%29.jpg',
    sha256: 'e1280bdead1759bcd376b2f52f1048e1d55380419ac742ddddac462261687789',
    width: 800,
  },
  {
    name: 'landscape-noface.jpg',
    // "Manicouagan Crater in Quebec stands out in Canada's icy landscape
    //  (iss074e0432034)"
    // https://commons.wikimedia.org/wiki/File:Manicouagan_Crater_in_Quebec_stands_out_in_Canada%E2%80%99s_icy_landscape_(iss074e0432034).jpg
    url:
      'https://upload.wikimedia.org/wikipedia/commons/9/91/' +
      'Manicouagan_Crater_in_Quebec_stands_out_in_Canada%E2%80%99s_icy_' +
      'landscape_%28iss074e0432034%29.jpg',
    sha256: 'a744c0a84ee37acdaf7c4f896e2f1d29de7001023a7d663ef4401e60edebfcdc',
    width: 800,
  },
]

const repoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '..')
const destDir = path.join(repoRoot, 'tests', 'fixtures', 'photos')

async function fetchPinned({ url, sha256 }) {
  const response = await fetch(url, { headers: { 'user-agent': USER_AGENT } })
  if (!response.ok) {
    throw new Error(`GET ${url} failed: ${response.status}`)
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  const digest = crypto.createHash('sha256').update(buffer).digest('hex')
  if (digest !== sha256) {
    throw new Error(
      `Source photograph changed upstream:\n  ${url}\n` +
        `  expected sha256 ${sha256}\n` +
        `  received sha256 ${digest}\n` +
        `Re-pin it here, then re-run the fixture integration test — the new ` +
        `bytes may no longer hold the number of faces this fixture promises.`,
    )
  }
  return buffer
}

await fs.mkdir(destDir, { recursive: true })

for (const fixture of FIXTURES) {
  const source = await fetchPinned(fixture)
  // Downscaled hard, for two reasons. The obvious one is that three
  // photographs should cost the repo tens of kilobytes rather than twenty
  // megabytes. The less obvious one is that with SUPABASE_STORAGE_MOCK=true —
  // which is every local and E2E run — src/server/photo-storage.ts returns the
  // whole image as a base64 data URL, and that string is what lands in
  // practitioners.photo_url. It is then inlined into the HTML of every page
  // that renders the Practitioner, twice: once as the img src and once in the
  // serialised loader data. Whatever headshot.jpg weighs, every such page pays
  // roughly three times over, so it is worth keeping small.
  //
  // Both sides stay inside the MIN_DIMENSION/MAX_DIMENSION window in
  // src/photo-policy.ts, with margin: a fixture under 400px on its short side
  // is rejected as too-small before the face check ever runs.
  const out = await sharp(source)
    .resize({ width: fixture.width })
    .jpeg({ quality: 70, mozjpeg: true })
    .toBuffer()
  await fs.writeFile(path.join(destDir, fixture.name), out)
  const meta = await sharp(out).metadata()
  console.log(
    `${fixture.name}\t${meta.width}x${meta.height}\t` +
      `${(out.byteLength / 1024).toFixed(0)}KB`,
  )
}

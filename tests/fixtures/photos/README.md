# Profile photo fixtures

Three photographs the profile-photo suites upload. They are committed, the
way `public/face-api-models/` is, so a fresh checkout can run
`pnpm test:e2e` without reaching the network.

| File                   | Holds    | Drives the outcome |
| ---------------------- | -------- | ------------------ |
| `headshot.jpg`         | one face | `ok`               |
| `group-multiface.jpg`  | several  | `multi-face`       |
| `landscape-noface.jpg` | nobody   | `no-face`          |

## Why photographs, and not generated images

The profile photo check runs SSD-MobileNet-v1 over the uploaded bytes
(`src/server/photo-detect.ts`). A generated rectangle detects as `no-face`,
and so does a carefully drawn vector face — the detector is trained on
photographs and is not fooled by an approximation of one. A suite built on
synthetic images can therefore only ever exercise the rejection path, which
is exactly the hole this directory was opened to fill: the two tests that
needed a face in the frame were asserting against a flat grey fill and
quietly resolving to `no-face`.

## Where they came from

All three are works of NASA and in the public domain, taken from Wikimedia
Commons:

- `headshot.jpg` — [Chris Cassidy, Official NASA Astronaut Portrait in EMU (cropped)](<https://commons.wikimedia.org/wiki/File:Chris_Cassidy_-_Official_NASA_Astronaut_Portrait_in_EMU_(cropped).jpg>)
- `group-multiface.jpg` — [Expedition 38 crew members pose for an in-flight crew portrait (cropped)](<https://commons.wikimedia.org/wiki/File:Expedition_38_crew_members_pose_for_an_in-flight_crew_portrait_-_NASA_ISS038-E-054970_(cropped).jpg>)
- `landscape-noface.jpg` — [Manicouagan Crater in Quebec stands out in Canada's icy landscape](<https://commons.wikimedia.org/wiki/File:Manicouagan_Crater_in_Quebec_stands_out_in_Canada%E2%80%99s_icy_landscape_(iss074e0432034).jpg>)

Official public-domain imagery rather than the first suitable photographs to
hand: a fixture is committed forever and cloned by everyone who touches the
repo, which makes a snapshot of private individuals both a licence question
and a courtesy question.

## Regenerating them

```
node scripts/build-photo-fixtures.mjs
```

The script downloads each source, checks it against a pinned SHA-256,
downscales it and writes the fixture. It is deliberately not part of
`pnpm setup:local` — the images are already in your checkout, and running the
suite should not need the network. Run it only to change a source or a size,
or to prove the committed bytes still follow from where they say they came
from.

## Changing them

Two constraints, both easy to trip:

- **Keep every side above 400px.** `src/photo-policy.ts` rejects anything
  smaller as `too-small`, _before_ the face check runs — so an undersized
  fixture fails with the wrong outcome rather than an obvious one.
- **Keep `headshot.jpg` small.** With `SUPABASE_STORAGE_MOCK=true`,
  `src/server/photo-storage.ts` returns the image as a base64 data URL, and
  that string is what goes into `practitioners.photo_url` and then into the
  HTML of every page rendering that Practitioner.

`tests/integration/photo-detect-fixtures.test.ts` runs the real detector over
these files and asserts the face count each name promises. It is what fails if
a replacement no longer holds one face, or several, or none — the E2E suite
will not tell you, because it runs with `PHOTO_CHECK_MOCK=true` and routes on
the filename.

## The filename suffixes are load-bearing

`-noface` and `-multiface` are the conventions `src/server/photo-detect.ts`
routes on when `PHOTO_CHECK_MOCK=true`, which is the default everywhere. The
names and the pixels agree on purpose, so the same fixture drives the same
outcome whether the mock is reading the name or the detector is reading the
image. To exercise the detector end-to-end:

```
PHOTO_CHECK_MOCK=false pnpm test:e2e tests/e2e/profile-photo-upload.spec.ts
```

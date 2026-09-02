# Perceptual hashing alternatives for Bun 1.4

Date: 2026-09-02

Decision: **SPIKE BUN.IMAGE + PURE-JS PNG DECODE + PDQ-WASM**

## Constraints

The production candidate must run under Bun 1.4.0 on Windows and
`oven/bun:1.4.0-alpine`, accept bounded in-memory bytes, work inside Bun workers,
and install without Python or a native build toolchain. ScamGuard needs a
whole-image perceptual signal and a separate crop-tolerant signal. Runtime
image bytes must not be written to disk.

## Recommended pipeline

```text
validated image bytes
  -> Bun.Image (portable backend, resize, PNG encode)
  -> pngjs or fast-png (PNG -> bounded RGBA/RGB pixels)
  -> pdq-wasm (whole-image 256-bit PDQ hash)
  -> internal crop segmentation + segment hashes (crop-resistant multihash)
```

This is the strongest next spike because it keeps all external dependencies
pure JavaScript or WebAssembly while delegating risky image-format decoding to
Bun itself. It does not revive `imagehash-web` or `node-canvas`.

### Why Bun.Image is viable, with one missing seam

Bun 1.4's built-in `Bun.Image` accepts `Buffer`, `ArrayBuffer`, and typed-array
inputs, performs work off the JavaScript thread, offers a pre-allocation
`maxPixels` guard, and decodes JPEG, PNG, WebP, BMP, and the first frame of GIF
on Linux and Windows. It has zero npm dependencies and no native-addon build
step. Its documented terminal methods return an encoded image, however, not
raw pixels. The spike should therefore normalize to a bounded PNG and decode
that PNG once with a pure-JavaScript decoder. `pngjs@7` already passed a local
Windows probe; `fast-png` is the actively maintained TypeScript alternative.
Both are MIT-licensed and accept PNG bytes. [Bun.Image documentation](https://bun.sh/docs/runtime/image),
[pngjs repository](https://github.com/pngjs/pngjs),
[fast-png repository](https://github.com/image-js/fast-png)

Set `Bun.Image.backend = "bun"` inside every worker. Bun documents that the
default Windows/macOS system backend can differ, while its portable JPEG, PNG,
WebP, and geometry paths are byte-identical across supported platforms. That
setting is necessary for reproducible Evidence hashes between Windows
development and Alpine production. [Bun.Image platform backends](https://bun.sh/docs/runtime/image#platform-backends)

The PNG round trip is extra work, but the image can be resized before encoding,
so JavaScript never needs to retain the original full-resolution pixel buffer.
The spike should test a maximum normalized edge of 512 pixels, composite alpha
against a fixed background in TypeScript, and feed the same normalized RGB
buffer to both hash layers. The size is a benchmark candidate, not policy.

### Whole-image hash: pdq-wasm

`pdq-wasm@0.3.9` is a zero-dependency, BSD-3-Clause package that accepts raw
one-channel or three-channel pixels and returns Meta-compatible 256-bit PDQ
hashes plus a quality score. The package includes ESM, TypeScript declarations,
and a small WASM binary. It does not decode images, which is why the Bun.Image
normalization seam is required. Its browser convenience functions depend on
`createImageBitmap` and `OffscreenCanvas`; ScamGuard should use only the core
`PDQ.init`/`PDQ.hash` API. [pdq-wasm repository](https://github.com/Raudbjorn/pdq-wasm),
[published package](https://www.npmjs.com/package/pdq-wasm),
[package manifest](https://github.com/Raudbjorn/pdq-wasm/blob/master/package.json)

The package is young and maintained by a small project, so it is a candidate,
not an automatic production choice. Direct Bun 1.4.0 probes produced the same
hash and quality from both a synthetic 64-by-64 luma buffer and a real curated
JPEG on Windows x64 and `oven/bun:1.4.0-alpine`, with no native build. The real
image produced `97bdb829…734c5f93` with quality 100 in both environments. Both
succeeded only when
`pdq-wasm` was loaded through CommonJS. Its ESM export reaches a loader branch
where `require` is unavailable and throws `PDQ WASM module not available`.
The source's CommonJS path reads the packaged WASM with `fs.readFileSync`; no
runtime CDN is needed. Use a tiny `createRequire` adapter, pin the exact version,
and treat the broken ESM export as package risk. [pdq-wasm loader source](https://github.com/Raudbjorn/pdq-wasm/blob/master/src/pdq.ts)

The remaining spike must preserve the real-image result on Alpine and inside
workers. Validate output against Meta's fixture guidance: for
quality at least 80, a conforming implementation should be within Hamming
distance 10 of the C++ reference, and Meta suggests beginning similarity
experiments at distance 31 with low-quality hashes filtered. These are
compatibility checks, not ScamGuard's final thresholds. [Meta PDQ reference](https://github.com/facebook/ThreatExchange/tree/main/pdq)

PDQ is a global full-image DCT hash. Meta's implementation downsamples the
whole image to a 64-by-64 image-domain buffer before the DCT. Therefore, it can
be tested for modest crop tolerance, but it is not a substitute for a
crop-resistant multihash whose regions survive a changed image boundary. This
is an inference from the reference algorithm, not a promise made by the
package. [Meta PDQ hasher source](https://github.com/facebook/ThreatExchange/blob/main/pdq/java/src/main/java/pdqhashing/hasher/PDQHasher.java)

The real-image probe also confirms that whole-image PDQ is insufficient for
ScamGuard's crop requirement. Center crops removing 5%, 10%, and 20% of the
image produced Hamming distances 52, 90, and 128 respectively from the original.
Even the smallest crop exceeds Meta's suggested initial distance of 31, so crop
tolerance must remain a separate region-based representation.

### Crop tolerance: keep the algorithm, drop the failed dependency

The crop-resistant algorithm used by Python ImageHash and `imagehash-web`
resizes to a segmentation image, produces bright and dark regions with a
watershed-like process, and hashes each sufficiently large region. The result
is a variable-length multihash; matching succeeds when compatible segment
hashes are close. This is materially different from one whole-image pHash.
[Python ImageHash implementation](https://github.com/JohannesBuchner/imagehash/blob/master/imagehash/__init__.py),
[imagehash-web implementation](https://github.com/simon987/imagehash-web/blob/main/lib/cropResistantHash.js)

Do not reinstall `imagehash-web`. Instead, if the PDQ decoding spike passes,
adapt only its small MIT-licensed crop segmentation logic to operate on the
already-normalized RGB buffer, preserve attribution, and keep the code internal
and versioned. Benchmark the established default segment dHash first. Using PDQ
for every segment is possible, but would increase WASM calls and storage before
demonstrating a benefit. `imagehash-web` itself is MIT-licensed; Python
ImageHash is BSD-2-Clause. [imagehash-web license](https://github.com/simon987/imagehash-web/blob/main/LICENSE),
[Python ImageHash license](https://github.com/JohannesBuchner/imagehash/blob/master/LICENSE)

## Candidate comparison

| Candidate | Install/decode path | Whole-image hash | Crop semantics | Maintenance/license | Assessment |
| --- | --- | --- | --- | --- | --- |
| **Bun.Image + pure-JS PNG decode + pdq-wasm** | Bun's bundled codecs, then `pngjs` (locally proven) or `fast-png`; no addon install | PDQ, WASM; CommonJS path currently required | Add the established segmentation multihash internally | Bun MIT; PNG decoders MIT; pdq-wasm BSD-3, young | **Recommended spike** |
| **sharp + pdq-wasm** | Prebuilt Node-API/libvips packages exist for Windows x64 and Linux x64 musl; no compiler when the binary resolves | PDQ, WASM | Same internal segmentation multihash | sharp Apache-2.0, mature and active; pdq-wasm BSD-3 | **Fallback spike** if PNG round-trip cost or Bun.Image worker behavior fails |
| **@napi-rs/canvas + imagehash-web logic** | Prebuilt Node-API Skia packages include Windows and Linux musl, but add a roughly 30 MB platform binary | pHash from imagehash-web | Existing crop-resistant hash | Canvas MIT and active; imagehash-web MIT, small project | Feasible experiment, but heavier and retains Canvas coupling |
| **image-hash@7** | Pure-JS JPEG/PNG plus WASM WebP | Blockhash only | None | MIT; recent TypeScript package | Portable fallback signal, but does not satisfy PDQ/pHash plus crop resistance |
| **jSquash codecs** | Per-format WASM packages and asset setup | None | None | Apache-2.0 and active | More moving parts; project calls Node support limited and experimental |
| **Meta's repository WASM build** | Browser-oriented Emscripten artifacts and test harness | Official PDQ | None | BSD, authoritative | Useful oracle, not a clean Bun/npm integration |

Sharp is the pragmatic fallback, not the first choice. Its official installer
supports `bun add sharp`, publishes prebuilt Windows x64 and Linux x64 musl
binaries, and can return transferable raw RGB pixels. It still introduces a
native addon and libvips payload, so its exact Bun 1.4/Alpine binary resolution
must be proven rather than assumed. [sharp installation](https://sharp.pixelplumbing.com/install/),
[sharp raw output](https://sharp.pixelplumbing.com/api-output/#raw),
[sharp package manifest](https://github.com/lovell/sharp/blob/main/package.json)

`@napi-rs/canvas` is a more credible Canvas replacement than `node-canvas`: it
uses Node-API, advertises zero system dependencies, and publishes a Linux x64
musl binary. It is not the preferred decoder because the binary is large and a
recent Bun/Windows concurrent-encoding crash demonstrates that worker
concurrency still requires explicit testing. Its node-canvas compatibility
layer also does not make `imagehash-web` a dependency-free drop-in; an alias or
shim would still be required. [@napi-rs/canvas package](https://www.npmjs.com/package/@napi-rs/canvas),
[musl binary package](https://www.npmjs.com/package/@napi-rs/canvas-linux-x64-musl),
[Bun concurrency issue](https://github.com/Brooooooklyn/canvas/issues/1312)

`image-hash@7` is dependency-light and supports byte buffers for JPEG, PNG, and
WebP, but its own documentation says its core is Blockhash. It supplies neither
PDQ/pHash nor crop-resistant segmentation, so it should not define ScamGuard's
durable fingerprint format. A direct Bun 1.4 Windows probe also failed to
resolve its `file-type@21` dependency, so it is not a ready fallback.
[image-hash repository](https://github.com/danm/image-hash),
[image-hash manifest](https://github.com/danm/image-hash/blob/master/package.json)

jSquash is designed for browsers and Web Workers, but its maintainers describe
Node support as limited, experimental, and not optimized, with extra WASM asset
configuration per codec. It solves decoding only and adds unnecessary package
surface beside Bun 1.4's built-in codecs. [jSquash repository](https://github.com/jamsinclair/jSquash)

Meta now includes a WASM implementation, but its documented flow builds with
Emscripten and exercises the result through a browser, Selenium, and .NET test
harness. It is valuable as a reference oracle, not as the first production
adapter. [Meta PDQ WASM documentation](https://github.com/facebook/ThreatExchange/tree/main/pdq/wasm)

## Required compatibility spike

Create an isolated benchmark commit; do not modify production matching yet.

1. Pin `pngjs@7.0.0` and `pdq-wasm@0.3.9` in the benchmark fixture only. Keep
   `fast-png` as a drop-in comparison if PNG decode time is material.
2. In a Bun worker, set `Bun.Image.backend = "bun"`, accept transferred bytes,
   enforce `maxPixels`, resize to a bounded normalization size, encode PNG,
   decode it with the pure-JavaScript PNG decoder, composite alpha
   deterministically, and call the core PDQ API through the proven CommonJS
   export with locally loaded WASM. Record the ESM initialization failure as a
   packaging limitation rather than hiding it behind a dynamic fallback.
3. Run the identical **real-image worker** fixture under Windows Bun 1.4.0 and
   `oven/bun:1.4.0-alpine`. The core synthetic-luma cross-platform check already
   passes; now verify repeated image hashes, cross-platform equality,
   first-frame GIF behavior, malformed-input failure, cancellation, worker
   restart, and no install scripts/native compilation.
4. Compare Meta's PDQ fixtures with the C++ reference hashes using Meta's
   quality/distance compatibility guidance.
5. Run ScamGuard's existing resize, recompression, brightness/contrast,
   overlay, and 5/10/20-percent crop transformations plus its negative set.
   Record decode, PNG round-trip, hash time, peak RSS, and normalized-buffer
   size separately.
6. If compatibility or latency fails, repeat the same harness with
   `sharp@0.35.3` replacing only Bun.Image + PNG decode. Do not change the hashing
   or fixture layers, so results remain comparable.
7. Only after the decoding/PDQ path passes, add and benchmark the internal
   crop-resistant multihash. Keep whole-image PDQ and crop multihash as distinct
   versioned representations.

Bun workers can transfer `ArrayBuffer` values and run TypeScript modules, but
the Worker API is still documented as experimental, particularly around
termination. The spike must exercise timeout termination and replacement, not
only the happy path. [Bun workers documentation](https://bun.sh/docs/runtime/workers)

## Go/no-go gate

Proceed with production integration only if the spike demonstrates all of the
following:

- clean install and execution on Windows and Alpine without Python, compilers,
  native package build scripts, or runtime CDN access;
- byte-for-byte deterministic ScamGuard hashes across both environments;
- bounded memory after normalization and transferable worker messages;
- conformance with Meta's PDQ fixture guidance;
- zero strong/very-strong matches in the committed negative corpus;
- useful recall for recompression, resizing, overlays, and the agreed crop
  transformations; and
- acceptable p95 latency with four concurrent images and worker restart after
  a forced timeout.

This spike resolves the failed decoder dependency without weakening the earlier
policy: exact SHA remains strongest, perceptual enforcement remains
observation-only initially, and numeric confidence thresholds remain a later
benchmark decision.

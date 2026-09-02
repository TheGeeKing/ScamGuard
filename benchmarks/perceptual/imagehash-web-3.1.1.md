# imagehash-web 3.1.1 compatibility benchmark

Date: 2026-09-02

Decision: **NO-GO**

## Candidate

- Package: `imagehash-web@3.1.1`
- Transitive image decoder: `canvas@2.11.2`
- ScamGuard runtime: Bun 1.4.0

## Windows result

Commands:

```powershell
$benchmarkDirectory = New-Item -ItemType Directory -Path (Join-Path $env:TEMP ([guid]::NewGuid()))
Push-Location $benchmarkDirectory
bun init -y
bun add imagehash-web@3.1.1
bun -e "import { loadImage } from 'canvas'; await loadImage('C:/path/to/evidence/image-7.jpg')"
Pop-Location
Remove-Item -LiteralPath $benchmarkDirectory -Recurse -Force
```

Result: package resolution completed, but the first decoder import failed because `canvas/build/Release/canvas.node` did not exist. The dependency had no usable native binary for the runtime, so `imagehash-web` could not process an image.

## Linux production-image result

Command:

```text
docker run --rm oven/bun:1.4.0-alpine bun add imagehash-web@3.1.1
```

Result: failed during the `canvas` install script. No prebuilt musl binary existed for Node v147. The fallback invoked `node-gyp`, which required Python and a native compilation toolchain absent from ScamGuard's production image.

## Accuracy and performance

Not measurable. The candidate could not decode an image in either required environment, so executing pHash or crop-resistant hashing would not produce a representative production result.

## Gate assessment

| Gate | Result |
| --- | --- |
| Bun on Windows | Fail |
| Bun in production Alpine image | Fail |
| Deterministic repeated hashes | Not run |
| Transformation recall | Not run |
| Negative-set false positives | Not run |
| Latency and memory | Not run |

## Recommendation

Do not add `imagehash-web` to ScamGuard. Its mandatory `canvas` dependency would add native build tooling, including Python in the tested production fallback, and still would not establish cross-platform compatibility.

The next decision phase should benchmark a Bun-compatible WASM or Bun-native decoding pipeline before revisiting production perceptual matching. Exact SHA-256 and behavioral detection remain unchanged.

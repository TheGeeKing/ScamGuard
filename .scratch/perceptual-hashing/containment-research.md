# Severe-crop containment research

Status: recommendation for a compatibility and accuracy spike; no production dependency selected.

## Decision

Keep the current PDQ/segmented-dHash path as the cheap first stage. Prototype **ORB local features + binary-descriptor matching + RANSAC homography in a pinned, minimal OpenCV.js/WASM build** as an asynchronous fallback for candidates that the hash stage does not confidently match.

This is the smallest credible test of the actual question: “does this submitted crop occupy a geometrically consistent region of a curated image?” It does not require a Python service or a native Alpine ABI. Python/Emscripten may exist in a disposable build stage because OpenCV's official JavaScript build script uses them; the shipped runtime remains Bun + WASM.

Do not enforce from this signal during the spike. A successful spike should first produce a `contained-image` observation with diagnostics stored for owner-only inspection. Promotion to scoring is a separate decision based on the benchmark.

## Why the current hashes eventually fail

PDQ is a global 256-bit DCT-derived perceptual hash. Meta recommends starting at Hamming distance `<=31` and rejecting quality `<=49`, but also explicitly recommends evaluating thresholds on one's own data. Its representation summarizes the image as a whole, so an arbitrarily small or differently shaped crop changes much of the representation. Adding more preselected crop windows improves recall only for crops sufficiently close to one of those windows; covering every position, size, and aspect ratio grows combinatorially. [Meta PDQ reference and matching guidance](https://github.com/facebook/ThreatExchange/blob/main/pdq/README.md)

The segmented dHash fallback extends that boundary cheaply, but it still compares a finite set of global summaries. Raising its distance threshold enough to catch progressively smaller regions would trade away the precision ScamGuard needs.

## Why local features fit containment

OpenCV's documented known-object flow is:

1. detect local keypoints and descriptors in both images;
2. find descriptor neighbours;
3. reject ambiguous neighbours with a ratio test;
4. estimate a geometric transform with RANSAC; and
5. retain only matches consistent with that transform.

A homography needs at least four corresponding points, while OpenCV's tutorial uses ten matches before attempting localization. RANSAC exists specifically to tolerate incorrect raw descriptor matches. [OpenCV feature matching and homography tutorial](https://docs.opencv.org/4.10.0/d1/de0/tutorial_py_feature_homography.html)

This geometric verification matters for ScamGuard. Curated evidence and unrelated messages may share Twitter/X chrome, crypto logos, fonts, or repeated UI controls. A raw count of similar keypoints can therefore be misleading; a credible containment match also needs spatially distributed inliers and a plausible mapped region.

### ORB first, AKAZE second

ORB combines FAST keypoints, oriented BRIEF descriptors, and an image pyramid for scale and rotation handling. Its binary descriptors use Hamming distance and are intended as a computationally inexpensive alternative to SIFT/SURF. [OpenCV ORB overview](https://docs.opencv.org/4.13.0/d1/d89/tutorial_py_orb.html)

AKAZE is also credible and produces a binary descriptor by default. OpenCV's reference matching example uses `detectAndCompute`, two-nearest-neighbour Hamming matching, a `0.8` ratio criterion, and inlier evaluation. [OpenCV AKAZE matching tutorial](https://docs.opencv.org/4.13.0/db/d70/tutorial_akaze_matching.html)

Start with ORB because the intended fallback must handle four images per Discord message within a bounded single-worker queue. Try AKAZE only if ORB passes runtime compatibility but misses too many low-texture or strongly rescaled positives. Do not combine them initially.

SIFT is not the first spike. More importantly than its compute cost, SIFT is absent from OpenCV's current JavaScript export allow-list, while ORB, AKAZE, `detectAndCompute`, brute-force/descriptor matching, and `findHomography` are present. Using SIFT would therefore require expanding and maintaining a custom binding surface before it has demonstrated value. [OpenCV.js binding allow-list](https://github.com/opencv/opencv/blob/4.x/platforms/js/opencv_js.config.py)

## Runtime choices

### Recommended: custom minimal OpenCV.js/WASM artifact

OpenCV officially supports generating WebAssembly builds and documents Docker as a supported way to make that build reproducible. Its Node test path shows that the generated module is not intrinsically browser-only, although Bun compatibility still needs to be proven. Threaded OpenCV.js builds are documented as browser-only, so the spike should use a single-threaded non-SIMD build first and rely on ScamGuard's existing Bun worker for isolation. [OpenCV.js build documentation](https://docs.opencv.org/5.0/js_tutorials/js_setup/js_setup/js_setup.html)

Build only the modules needed for grayscale image input already decoded by ScamGuard, ORB/features2d matching, and calib3d homography. Pin the OpenCV source revision and generated artifact checksum. Do not add a broad, mutable `opencv.js` package from an unrelated publisher merely to shorten the spike.

Expected advantages:

- no musl/glibc or C++ ABI coupling at runtime;
- the expensive work stays in the existing replaceable Bun worker;
- curated descriptors can be computed at boot, versioned, and cached in SQLite;
- submitted images require descriptor extraction only once, followed by comparisons with cached evidence descriptors.

Risks that must be measured rather than assumed:

- Emscripten module initialization under Bun 1.4;
- WASM heap/RSS growth and explicit deletion of OpenCV objects;
- artifact size and startup time;
- JavaScript binding ergonomics for keypoint vectors, KNN matches, and the RANSAC mask;
- latency when a message contains four images and evidence grows.

Bun's workers provide a separate JavaScript instance and structured-clone/transfer messaging, which is the correct containment boundary for this CPU-heavy fallback, though Bun documents worker termination as experimental. [Bun Worker documentation](https://bun.sh/docs/runtime/workers)

### Native OpenCV: possible, not the smallest path

A native solution would mean either maintaining a Node-API C/C++ wrapper or invoking a separate helper executable. Bun recommends Node-API, rather than its experimental FFI, as the stable way to integrate native code. [Bun FFI guidance](https://bun.sh/docs/runtime/ffi)

This could ultimately be faster, but it introduces an Alpine/musl build matrix, native OpenCV runtime packages or static libraries, wrapper ownership, and a larger container/security surface. OpenCV does not provide a finished official Node binding; its own tracking issue describes that binding as design/generator work rather than a supported package. [OpenCV Node-binding tracking issue](https://github.com/opencv/opencv/issues/23352)

Revisit native code only if the WASM algorithm is accurate but definitively misses the latency or memory gate.

### Pure TypeScript/JavaScript feature implementations: no-go for the first spike

Implementing FAST/ORB descriptors, nearest-neighbour matching, and robust homography estimation locally would minimize the binary dependency but maximize unvalidated vision code. ScamGuard's false-positive cost makes that the wrong trade. There is no platform-native Bun API that supplies this pipeline, and independently published feature libraries would still need the same compatibility, correctness, and maintenance audit as OpenCV.js without OpenCV's reference implementation.

### Template matching: useful only as a narrow experiment

OpenCV's `matchTemplate` compares a fixed rectangular template over overlapping regions of a source image. [OpenCV template-matching documentation](https://docs.opencv.org/4.x/de/da9/tutorial_template_matching.html)

It can work when the submitted crop is pixel-close and its scale is already known. Discord recompression, arbitrary resizing, overlays, and unknown crop scale require a scale pyramid and repeated scans. That makes it a poor general fallback and gives less geometric evidence than multiple independently matched keypoints. It is worth one benchmark row, not a production architecture.

### Learned embeddings/local learned features: defer

Global image embeddings answer semantic similarity, not exact containment. Two unrelated crypto promotions can be semantically close, which is precisely the high-cost false-positive case. Learned local matchers could address containment, but add a model runtime, model assets, preprocessing/versioning, and substantially more benchmark and supply-chain work. They should be considered only if classical local features fail recall on a representative corpus, not before.

## Proposed spike

The spike must live under `benchmarks/perceptual/` and must not touch incident scoring or Discord actions.

1. Produce a pinned single-threaded OpenCV.js/WASM artifact in a disposable Docker build stage. Restrict exports to grayscale conversion/resize as needed, ORB, descriptor matching, `findHomography`, and `perspectiveTransform`.
2. Load the artifact inside Bun 1.4.0 on Alpine in the same kind of persistent worker ScamGuard already uses. Feed pixel bytes directly; do not introduce Canvas or a second image decoder.
3. At evidence load, compute and serialize capped ORB keypoints plus descriptors. Prove a round trip through SQLite-compatible byte arrays. Include algorithm name, OpenCV revision, parameters, and schema version in the cache key.
4. For a query, compute descriptors once. Use KNN Hamming matching with a ratio filter, then RANSAC homography. Report raw keypoint count, ratio-filtered matches, inlier count/ratio, inlier coverage in both images, mapped quadrilateral, and elapsed time. These are benchmark diagnostics, not moderator alert fields.
5. Compare one fixed ORB configuration against the current hash result. If necessary, test exactly one AKAZE configuration. Avoid a threshold-search framework until the basic signal proves useful.

### Corpus

Positives must include the exact crop that exposed the current miss plus deterministic transformations of every curated source:

- retained-area bands around 70%, 50%, 30%, and 15%, with corner and off-centre crops;
- resize down/up, Discord-like JPEG recompression, modest rotation/perspective, and small overlays;
- low-texture and text-heavy evidence called out separately.

Negatives must be larger than the positive set and deliberately difficult:

- unrelated Twitter/X and Discord screenshots sharing the same chrome;
- unrelated crypto promotions, QR codes, logos, repeated icons, and common backgrounds;
- every safe/false-positive image;
- different images from the same curated campaign when the intended policy treats them as distinct.

Split threshold selection from evaluation. Tune on one fixed development partition and report final numbers once on a held-out partition; otherwise a tiny curated set will overstate safety.

## Go/no-go gates

All gates apply to Bun 1.4.0 in the production Alpine image shape.

### Compatibility gate

Go only if the worker can repeatedly initialize, analyze, time out, terminate, and be replaced without process crashes or unbounded WASM memory growth. The complete ORB → KNN → homography path must work without DOM, Canvas, Python, or runtime build tools.

### Precision gate

For any future deletion signal, require **zero false-positive containment decisions in the held-out hard-negative corpus**. A single false positive means no-go for enforcement; the feature may remain observation-only while the corpus grows. Do not compensate by combining multiple weak matches from the same evidence image.

The final predicate must require, at minimum:

- enough ratio-filtered correspondences to estimate robustly;
- a minimum RANSAC inlier count and ratio;
- inliers distributed over meaningful query area rather than one logo/UI corner;
- a convex, non-self-intersecting mapped quadrilateral with plausible area and coordinates;
- no safe-reference containment match of equal or greater confidence.

Threshold numbers must come from the development corpus, not the tutorial defaults.

### Recall gate

Go if the held-out set recovers the real reported severe crop and materially improves recall in the 15–50% retained-area bands over the existing pipeline. Failure on featureless evidence is acceptable if it fails closed and the existing hash remains available; false confidence is not.

### Operational gate

Go if all four images from one message finish within the existing five-second job timeout under an otherwise idle worker, and if per-image p95 latency plus peak RSS fit a queue-capacity calculation without weakening the existing per-user fairness limits. Record cold initialization separately from warm analysis. A fallback that forces a larger queue merely to hide throughput is a no-go.

### Artifact gate

Go only if the generated JS/WASM is reproducible from a pinned OpenCV revision, its license notices are shipped, and the runtime image contains neither compilers nor Python. If a minimal artifact cannot be reproduced and audited, reject it regardless of accuracy.

## Integration shape after a successful spike

1. Exact SHA and high-confidence current hashes remain first.
2. The local-feature fallback runs only for unresolved or score-60 candidates, inside the existing bounded fair queue.
3. Evidence descriptors are precomputed from the raw repository images and cached in SQLite; raw evidence stays reviewable by peers.
4. Version 1 emits observation-only `contained-image` signals. Alerts show the simple signal and score, not keypoint internals.
5. Owner diagnostics expose the technical measurements and benchmark version.
6. Only a later, separately reviewed policy may promote a geometrically strong containment match to deletion. Timeouts remain out of scope for an image-only signal.

## Bottom line

OpenCV is useful here for its local-feature and geometric-verification pipeline, not because ScamGuard needs a general computer-vision framework. A minimal OpenCV.js/WASM ORB spike is the least irreversible way to learn whether that pipeline catches severe crops safely under Bun/Alpine. If it cannot pass the precision and four-image latency gates, stop: retain the current hashes and expand evidence/crop benchmarks rather than escalating immediately to native OpenCV or learned models.

FROM oven/bun:1.4.0-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY benchmarks/perceptual/pdq-benchmark.ts ./benchmarks/perceptual/pdq-benchmark.ts
COPY benchmarks/perceptual/pdq-benchmark.test.ts ./benchmarks/perceptual/pdq-benchmark.test.ts
COPY benchmarks/perceptual/crop-multihash.ts ./benchmarks/perceptual/crop-multihash.ts
COPY benchmarks/perceptual/crop-multihash.test.ts ./benchmarks/perceptual/crop-multihash.test.ts
COPY benchmarks/perceptual/hash-worker.ts ./benchmarks/perceptual/hash-worker.ts
COPY benchmarks/perceptual/hash-worker.test.ts ./benchmarks/perceptual/hash-worker.test.ts
COPY benchmarks/perceptual/transformations.test.ts ./benchmarks/perceptual/transformations.test.ts
COPY evidence/image-6.jpg evidence/image-7.jpg evidence/image-8.jpg ./evidence/
CMD ["bun", "test", "benchmarks/perceptual"]

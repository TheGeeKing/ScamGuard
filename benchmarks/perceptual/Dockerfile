FROM oven/bun:1.4.0-alpine
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY benchmarks/perceptual/pdq-benchmark.ts ./benchmarks/perceptual/pdq-benchmark.ts
COPY benchmarks/perceptual/pdq-benchmark.test.ts ./benchmarks/perceptual/pdq-benchmark.test.ts
COPY evidence/image-7.jpg ./evidence/image-7.jpg
CMD ["bun", "test", "benchmarks/perceptual/pdq-benchmark.test.ts"]

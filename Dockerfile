FROM oven/bun:1.4.0-alpine AS install
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile --production

FROM oven/bun:1.4.0-alpine
WORKDIR /app
COPY --from=install /app/node_modules ./node_modules
COPY package.json bun.lock ./
COPY src ./src
COPY drizzle ./drizzle
COPY evidence ./evidence
RUN mkdir /data && chown bun:bun /data
USER bun
CMD ["bun", "run", "start"]

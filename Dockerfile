# ─── Multi-stage Dockerfile for ZipMedia ─────────────────────────────────────
# Stage 1: install prod deps
# Stage 2: lean runtime image (no devDependencies, no source maps)

# ── Stage 1: dependency builder ───────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy manifests first for layer caching
COPY package.json package-lock.json* ./

# Install production deps only
RUN npm ci --omit=dev

# ── Stage 2: production image ─────────────────────────────────────────────────
FROM node:20-alpine AS runtime

# Security: run as a non-root user
RUN addgroup -S zipmedia && adduser -S zipmedia -G zipmedia

WORKDIR /app

# Copy prod deps from builder
COPY --from=builder /app/node_modules ./node_modules

# Copy application source
COPY server.js       ./server.js
COPY package.json    ./package.json
COPY public/         ./public/

# Own files by the non-root user
RUN chown -R zipmedia:zipmedia /app
USER zipmedia

# Expose the server port
EXPOSE 3000

# Healthcheck — Docker will restart the container if this fails
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD wget -qO- http://localhost:3000/health || exit 1

ENV NODE_ENV=production
ENV PORT=3000

CMD ["node", "server.js"]

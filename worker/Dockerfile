# pixelcoda Search Worker Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Copy package files
COPY package.json yarn.lock* package-lock.json* pnpm-lock.yaml* ./
COPY apps/worker/package.json ./apps/worker/
COPY packages/llm-adapter/package.json ./packages/llm-adapter/

# Install dependencies
RUN \
  if [ -f yarn.lock ]; then yarn --frozen-lockfile; \
  elif [ -f package-lock.json ]; then npm ci; \
  elif [ -f pnpm-lock.yaml ]; then corepack enable pnpm && pnpm i --frozen-lockfile; \
  else echo "Lockfile not found." && exit 1; \
  fi

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# Build the worker
RUN npm run build -w apps/worker

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 pixelcoda

# Copy built application
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/packages/llm-adapter/dist ./node_modules/@pixelcoda/llm-adapter/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/worker/package.json ./package.json

USER pixelcoda

# Default command runs the worker in daemon mode
# Can be overridden for one-time ingestion jobs
CMD ["node", "dist/index.js", "--help"]

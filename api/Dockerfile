# pixelcoda Search API Dockerfile
FROM node:20-alpine AS base

# Install dependencies only when needed
FROM base AS deps
RUN apk add --no-cache libc6-compat
WORKDIR /app

# Enable Yarn 4 (Berry)
RUN corepack enable && corepack prepare yarn@stable --activate

# Copy all necessary files for workspace resolution
COPY package.json yarn.lock* ./
COPY apps/api/package.json ./apps/api/
COPY packages/llm-adapter/package.json ./packages/llm-adapter/

# Install dependencies using Yarn 4
RUN yarn install --immutable

# Rebuild the source code only when needed
FROM base AS builder
WORKDIR /app

# Enable Yarn 4
RUN corepack enable && corepack prepare yarn@stable --activate

COPY --from=deps /app ./
COPY . .

# Build the API
RUN yarn workspace @pixelcoda/api build

# Production image, copy all the files and run the app
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 pixelcoda

# Copy built application
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/packages/llm-adapter/dist ./node_modules/@pixelcoda/llm-adapter/dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/apps/api/package.json ./package.json

# Copy scripts
COPY scripts/ ./scripts/

USER pixelcoda

EXPOSE 8787

ENV PORT=8787
ENV HOSTNAME="0.0.0.0"

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8787/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

CMD ["node", "dist/index.js"]

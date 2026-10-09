# syntax=docker/dockerfile:1
# Build with the repository root as context: docker build -f back/Dockerfile .
FROM node:22.22.3-bookworm-slim AS base
WORKDIR /app
RUN apt-get update \
    && apt-get install -y --no-install-recommends ca-certificates openssl \
    && rm -rf /var/lib/apt/lists/*

FROM base AS dependencies
COPY package.json package-lock.json ./
COPY back/package.json ./back/package.json
COPY front/package.json ./front/package.json
RUN npm ci --workspace=back --no-audit --no-fund

FROM dependencies AS build
COPY back ./back
RUN npm run build --workspace=back

# Migrations are an explicit one-shot job; never run on every server startup.
# This image retains Prisma CLI, whereas the application image does not.
FROM build AS migration
ENV NODE_ENV=production
USER node
CMD ["npm", "run", "db:deploy", "--workspace=back"]

FROM base AS production-dependencies
ENV NODE_ENV=production
COPY package.json package-lock.json ./
COPY back/package.json ./back/package.json
COPY front/package.json ./front/package.json
RUN npm ci --omit=dev --workspace=back --no-audit --no-fund \
    && npm cache clean --force

FROM base AS runtime
ENV NODE_ENV=production
COPY --from=production-dependencies /app/node_modules ./node_modules
COPY --from=production-dependencies /app/package.json ./package.json
COPY --from=production-dependencies /app/back/package.json ./back/package.json
COPY --from=production-dependencies /app/back/node_modules ./back/node_modules
COPY --from=build /app/back/dist ./back/dist
WORKDIR /app/back
USER node
EXPOSE 3001
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
    CMD node --input-type=module -e "const response = await fetch('http://127.0.0.1:' + (process.env.PORT || process.env.BACKEND_PORT || '3001') + '/health/ready', {signal: AbortSignal.timeout(4000)}); process.exit(response.ok ? 0 : 1);"
CMD ["node", "dist/main.js"]

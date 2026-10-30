FROM node:22.22.3-bookworm-slim AS dependencies
WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1
COPY package.json package-lock.json ./
COPY front/package.json ./front/package.json
COPY back/package.json ./back/package.json
RUN npm ci --workspace=front --include=dev --no-audit --no-fund

FROM dependencies AS builder
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_ALLOW_LOCAL_HTTP=false
ENV NEXT_PUBLIC_API_URL=${NEXT_PUBLIC_API_URL} \
    NEXT_PUBLIC_ALLOW_LOCAL_HTTP=${NEXT_PUBLIC_ALLOW_LOCAL_HTTP}
RUN node -e 'if (!process.env.NEXT_PUBLIC_API_URL) throw new Error("NEXT_PUBLIC_API_URL is required at build time")'
COPY front ./front
# Keep the public directory available for the runtime copy even when there are no assets.
RUN mkdir -p front/public && npm run build --workspace=front

FROM node:22.22.3-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production \
    NEXT_TELEMETRY_DISABLED=1 \
    HOSTNAME=0.0.0.0 \
    PORT=3000
COPY --from=builder --chown=node:node /app/front/.next/standalone ./
COPY --from=builder --chown=node:node /app/front/.next/static ./front/.next/static
COPY --from=builder --chown=node:node /app/front/public ./front/public
USER node
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD node -e 'fetch("http://127.0.0.1:3000/health").then(response => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1))'
CMD ["node", "front/server.js"]

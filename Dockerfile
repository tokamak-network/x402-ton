FROM node:20-slim AS builder

WORKDIR /app
COPY package.json package-lock.json ./
COPY packages/common/package.json packages/common/
COPY packages/facilitator/package.json packages/facilitator/
RUN npm ci --workspace=@x402-ton/common --workspace=@x402-ton/facilitator --include-workspace-root

COPY tsconfig.base.json tsconfig.json ./
COPY packages/common/ packages/common/
COPY packages/facilitator/ packages/facilitator/
RUN npm run build --workspace=@x402-ton/common && npm run build --workspace=@x402-ton/facilitator

FROM node:20-slim

WORKDIR /app
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/common/dist ./packages/common/dist
COPY --from=builder /app/packages/common/package.json ./packages/common/
COPY --from=builder /app/packages/facilitator/dist ./packages/facilitator/dist
COPY --from=builder /app/packages/facilitator/package.json ./packages/facilitator/
COPY --from=builder /app/package.json ./

ENV FACILITATOR_PORT=4402
EXPOSE 4402

HEALTHCHECK --interval=30s --timeout=5s --retries=3 \
  CMD node -e "fetch('http://localhost:${FACILITATOR_PORT}/health').then(r=>r.ok?process.exit(0):process.exit(1)).catch(()=>process.exit(1))"

CMD ["node", "packages/facilitator/dist/index.js"]

FROM node:24.18.0-alpine AS build

WORKDIR /workspace

COPY packages/contracts/package*.json packages/contracts/
COPY apps/web/package*.json apps/web/
RUN cd packages/contracts && npm ci
RUN cd apps/web && npm ci

COPY packages/contracts packages/contracts
COPY apps/web apps/web

ARG VITE_SUPABASE_URL
ARG VITE_SUPABASE_PUBLISHABLE_KEY
ARG VITE_API_BASE_URL
ENV VITE_SUPABASE_URL=$VITE_SUPABASE_URL
ENV VITE_SUPABASE_PUBLISHABLE_KEY=$VITE_SUPABASE_PUBLISHABLE_KEY
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL

RUN cd packages/contracts && npm run build
RUN cd apps/web && npm run build

FROM nginx:1.29.5-alpine

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=build /workspace/apps/web/dist /usr/share/nginx/html

EXPOSE 80
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1/healthz || exit 1

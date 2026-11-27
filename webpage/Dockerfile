# Production dependencies only, resolved straight from the lockfile so the
# runtime image never carries the toolchain.
FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# Copy only the build inputs, so the host's node_modules never reaches the image.
COPY tsconfig.json ./
# The composer's client bundle: vite.config.mts drives the build and bakes
# platform/ into a static JSON, and client/composer/tsconfig.json is what tells
# Vite to use the automatic JSX runtime. All three are build inputs.
COPY vite.config.mts ./
COPY client ./client
COPY platform ./platform
COPY src ./src
COPY tools ./tools
COPY views ./views
COPY assets ./assets

RUN npm run build


FROM node:24.22.1-alpine@sha256:06d7adf3e0ef61a13f1d28682726366f97a15aa1888c934d3ecec86c33918b53 AS final

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node

EXPOSE 8080

CMD ["node", "/app/dist/app.js"]

# syntax=docker/dockerfile:1

# Production dependencies only, resolved straight from the lockfile so the
# runtime image never carries the toolchain.
FROM node:24.22.1-alpine AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


FROM node:24.22.1-alpine AS builder

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci

# Copy only the build inputs. The previous `COPY ./ /app` ran after npm install
# and overwrote the image's node_modules with whatever the host happened to have.
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


FROM node:24.22.1-alpine AS final

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist
COPY package.json ./

USER node

EXPOSE 8080

CMD ["node", "/app/dist/app.js"]

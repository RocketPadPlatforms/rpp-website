# Production dependencies only, resolved straight from the lockfile so the
# runtime image never carries the toolchain.
FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS deps

WORKDIR /app

COPY package.json package-lock.json ./

RUN npm ci --omit=dev


FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS builder

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


FROM node:24.22.3-alpine@sha256:116b800c3754b440ee0aa3ed2f20f5bf3d99a554bfd9adeea09ea8017f6e85f5 AS final

WORKDIR /app

ENV NODE_ENV=production

COPY --from=deps /app/node_modules ./node_modules
COPY --from=builder /app/dist ./dist

USER node

EXPOSE 8080

CMD ["node", "/app/dist/app.js"]

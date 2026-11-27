import { defineConfig } from "vitest/config";

// Two suites with incompatible needs live in this package: the Express route and
// regression tests run against a real server in Node, and the composer's
// component tests need a DOM. Keeping them as separate projects means neither
// pays for the other's environment.
//
// This file also shadows vite.config.mts for test runs, which is deliberate -
// that config sets `root` to client/composer for the browser bundle, and the
// test roots have to stay at the package root.
export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "server",
          environment: "node",
          include: ["test/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "composer",
          environment: "happy-dom",
          include: ["client/composer/**/*.test.{ts,tsx}"],
          setupFiles: ["./client/composer/test-setup.ts"],
        },
      },
    ],
  },
});

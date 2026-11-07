import { bindings, defineConfig, defineWorker } from "cf/config";

export default defineConfig({
  worker: defineWorker({
    name: "netromance",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-07",
    compatibilityFlags: ["nodejs_compat"],
    domains: ["love.ifeng-wang.com"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"],
    },
    env: {
      ASSETS: bindings.assets(),
      DATABASE_URL: bindings.secret(),
      COOKIE_SECURE: bindings.text("true"),
      INVITE_BASE_URL: bindings.text("https://love.ifeng-wang.com"),
    },
  }),
});

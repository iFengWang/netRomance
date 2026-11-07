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
      DB: bindings.d1({
        id: "626e650e-8d92-494c-9f4b-3b8ecfe950dd",
        name: "netromance-db",
      }),
      COOKIE_SECURE: bindings.text("true"),
      INVITE_BASE_URL: bindings.text("https://love.ifeng-wang.com"),
    },
  }),
});

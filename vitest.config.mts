import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.{ts,tsx}"],
    clearMocks: true,
    restoreMocks: true,
    unstubEnvs: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "lcov"],
      include: ["lib/**/*.ts", "app/api/**/*.ts", "app/components/**/*.tsx", "app/sign-in/SignInForm.tsx"],
      exclude: ["lib/supabase.ts", "lib/supabase/**"],
    },
  },
});

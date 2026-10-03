// Starts a production server for Playwright with a fresh database and mock adapters.
// Usage: node scripts/e2e-server.mjs [port]
import { spawn, spawnSync } from "node:child_process";
import { existsSync, rmSync } from "node:fs";
import path from "node:path";

const port = process.argv[2] ?? "3100";
const root = path.resolve(import.meta.dirname, "..");
const dataDir = path.join(root, ".data", "e2e");
const uploads = path.join(root, ".data", "e2e-uploads");
rmSync(dataDir, { recursive: true, force: true });
rmSync(uploads, { recursive: true, force: true });

const env = {
  ...process.env,
  NODE_ENV: "production",
  MUBAZZAR_E2E: "1",
  PGLITE_DATA_DIR: dataDir,
  UPLOADS_DIR: uploads,
  MOCK_OTP_CODE: "123456",
  NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
  AUTH_SECRET: "e2e-secret-e2e-secret-e2e-secret-e2e",
  CRON_SECRET: "e2e-cron",
};
delete env.DATABASE_URL;
delete env.NEXT_PUBLIC_SUPABASE_URL;
delete env.SUPABASE_SERVICE_ROLE_KEY;
delete env.NEXT_PUBLIC_META_PIXEL_ID;

const nextBin = path.join(root, "node_modules", "next", "dist", "bin", "next");
if (process.env.E2E_REBUILD === "1" || !existsSync(path.join(root, ".next", "BUILD_ID"))) {
  const b = spawnSync(process.execPath, [nextBin, "build"], { cwd: root, env, stdio: "inherit" });
  if (b.status !== 0) process.exit(b.status ?? 1);
}
const child = spawn(process.execPath, [nextBin, "start", "-p", port], { cwd: root, env, stdio: "inherit" });
const stop = () => child.kill("SIGTERM");
process.on("SIGINT", stop);
process.on("SIGTERM", stop);
child.on("exit", (code) => process.exit(code ?? 0));

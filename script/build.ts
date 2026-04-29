import { build as esbuild } from "esbuild";
import { build as viteBuild } from "vite";
import { rm, readFile } from "node:fs/promises";

// Packages bundled into the server CJS to reduce require() lookups at startup
const allowlist = [
  // core framework
  "express",
  "cors",
  "helmet",
  "express-rate-limit",
  "express-session",
  "connect-pg-simple",
  // orm / db
  "drizzle-orm",
  "drizzle-zod",
  // validation
  "zod",
  "zod-validation-error",
  // utils
  "nanoid",
  "uuid",
  "date-fns",
  // optional extras kept for compatibility
  "@google/generative-ai",
  "axios",
  "jsonwebtoken",
  "memorystore",
  "multer",
  "nodemailer",
  "openai",
  "passport",
  "passport-local",
  "stripe",
  "ws",
  "xlsx",
];

async function buildAll() {
  await rm("dist", { recursive: true, force: true });

  console.log("building client…");
  await viteBuild();

  console.log("building server…");
  const pkg = JSON.parse(await readFile("package.json", "utf-8"));
  const allDeps = [
    ...Object.keys(pkg.dependencies || {}),
    ...Object.keys(pkg.devDependencies || {}),
  ];
  const externals = allDeps.filter((dep) => !allowlist.includes(dep));

  await esbuild({
    entryPoints: ["server/index.ts"],
    platform: "node",
    bundle: true,
    format: "cjs",
    outfile: "dist/index.cjs",

    // ── Fix import.meta.dirname / import.meta.url in CJS output ──────────────
    // esbuild rewrites import.meta.url to a file:// URL derived from __filename,
    // so __dirname and __filename must be defined. For CJS output Node injects
    // them automatically, but we make the intent explicit via banner.
    banner: {
      js: [
        "const __require = require;",
        // Ensure __filename / __dirname are available even if tree-shaken away
        "const { fileURLToPath: __fup } = require('url');",
        "const { dirname: __dn } = require('path');",
      ].join("\n"),
    },

    define: {
      "process.env.NODE_ENV": '"production"',
      // Polyfill import.meta.dirname so any remaining references resolve
      "import.meta.dirname": "__dirname",
    },

    // Keep node: protocol imports as externals — Node handles them natively
    external: [
      ...externals,
      // Always external — native Node modules
      "pg-native",
    ],

    minify: true,
    logLevel: "info",
  });

  console.log("done.");
}

buildAll().catch((err) => {
  console.error(err);
  process.exit(1);
});

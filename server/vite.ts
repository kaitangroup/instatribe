import type { Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import type { Server } from "node:http";
import viteConfig from "../vite.config";
import fs from "node:fs";
import path from "node:path";
import { nanoid } from "nanoid";
import express from "express";

const viteLogger = createLogger();

// ─── CJS-safe directory resolution ────────────────────────────────────────────
// In dev (tsx/ts-node) __dirname is defined natively.
// In the production CJS bundle esbuild also provides __dirname.
// We declare it so TypeScript is happy — Node/esbuild always populates it.
declare const __dirname: string;
const __dir: string = __dirname;

export function log(message: string) {
  const time = new Date().toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
  console.log(`${time} [express] ${message}`);
}

export async function setupVite(app: Express, server: Server) {
  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: {
      middlewareMode: true,
      hmr: { server, path: "/vite-hmr" },
      allowedHosts: true as const,
    },
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(__dir, "..", "client", "index.html");
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`
      );
      const page = await vite.transformIndexHtml(url, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  // In production CJS bundle, __dir resolves to the directory containing
  // dist/index.cjs — so dist/public is one level up from that? No:
  // dist/index.cjs lives in dist/, so __dir === …/dist
  // dist/public lives at …/dist/public — same parent.
  // We therefore look one level up from __dir to find the project root,
  // then join dist/public. This works whether NODE_ENV is set or not.
  const distPublic = path.resolve(__dir, "public");
  const fallback   = path.resolve(__dir, "..", "dist", "public");
  const distPath   = fs.existsSync(distPublic) ? distPublic : fallback;

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Production build not found. Looked at:\n  ${distPublic}\n  ${fallback}\nRun 'npm run build' first.`
    );
  }

  // Long-lived cache for hashed assets
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    })
  );

  // Everything else — no cache on HTML so SPA updates land immediately
  app.use(express.static(distPath, { maxAge: "0" }));

  // SPA fallback
  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

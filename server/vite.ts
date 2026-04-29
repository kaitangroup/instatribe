import type { Express } from "express";
import { createServer as createViteServer, createLogger } from "vite";
import type { Server } from "node:http";
import viteConfig from "../vite.config";
import fs from "node:fs";

import { nanoid } from "nanoid";
import express from "express";
import { fileURLToPath } from "node:url";
import path from "node:path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const viteLogger = createLogger();

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
  const serverOptions = {
    middlewareMode: true,
    hmr: { server, path: "/vite-hmr" },
    allowedHosts: true as const,
  };

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
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);

  app.use("/{*path}", async (req, res, next) => {
    const url = req.originalUrl;
    try {
      const clientTemplate = path.resolve(
        __dirname,
        "..",
        "client",
        "index.html"
      );
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
  const distPath = path.resolve(process.cwd(), "dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Production build not found at ${distPath}. Run 'npm run build' first.`
    );
  }

  // Serve static assets with long cache headers
  app.use(
    "/assets",
    express.static(path.join(distPath, "assets"), {
      maxAge: "1y",
      immutable: true,
    })
  );

  // Serve everything else (index.html fallback for SPA)
  app.use(express.static(distPath, { maxAge: "0" }));

  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}

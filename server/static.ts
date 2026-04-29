import express from 'express';
import type { Express } from 'express';
import fs from "node:fs";
import path from "node:path";

export function serveStatic(app: Express) {
  const distPath = path.resolve(process.cwd(), "dist/public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Build directory not found: ${distPath}. Run frontend build first.`,
    );
  }

  app.use(express.static(distPath));

  app.use("/{*path}", (_req, res) => {
    res.sendFile(path.join(distPath, "index.html"));
  });
}
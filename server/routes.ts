import type { Express } from "express";
import type { Server } from "http";
import { z } from "zod";
import { storage } from "./storage";
import { assignUserToTribe } from "./matching";
import { QUIZ_QUESTIONS } from "@shared/schema";

export function registerRoutes(httpServer: Server, app: Express) {
  // ─── Auth ─────────────────────────────────────────────────────────────────
  app.post("/api/register", async (req, res) => {
    try {
      const schema = z.object({
        name: z.string().min(2).max(80),
        email: z.string().email().max(255),
      });
      const { name, email } = schema.parse(req.body);

      const existing = await storage.getUserByEmail(email.toLowerCase());
      if (existing) {
        return res.json({ user: existing, alreadyExists: true });
      }

      const user = await storage.createUser({ name: name.trim(), email: email.toLowerCase() });
      // Store userId in session
      (req.session as any).userId = user.id;
      return res.json({ user, alreadyExists: false });
    } catch (e: any) {
      console.error("[/api/register]", e.message);
      return res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/login", async (req, res) => {
    try {
      const schema = z.object({ email: z.string().email() });
      const { email } = schema.parse(req.body);
      const user = await storage.getUserByEmail(email.toLowerCase());
      if (!user) return res.status(404).json({ error: "No account found with that email." });
      (req.session as any).userId = user.id;
      return res.json({ user });
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  app.post("/api/logout", (req, res) => {
    req.session.destroy((err) => {
      if (err) return res.status(500).json({ error: "Logout failed" });
      res.clearCookie("kindred.sid");
      return res.json({ ok: true });
    });
  });

  app.get("/api/me", async (req, res) => {
    const userId = (req.session as any).userId;
    if (!userId) return res.status(401).json({ error: "Not authenticated" });
    const user = await storage.getUserById(userId);
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(user);
  });

  app.get("/api/user/:id", async (req, res) => {
    const user = await storage.getUserById(Number(req.params.id));
    if (!user) return res.status(404).json({ error: "Not found" });
    return res.json(user);
  });

  // ─── Quiz ─────────────────────────────────────────────────────────────────
  app.get("/api/quiz/questions", (_req, res) => {
    return res.json(QUIZ_QUESTIONS);
  });

  app.post("/api/quiz/submit", async (req, res) => {
    try {
      const schema = z.object({
        userId: z.number().int().positive(),
        answers: z.record(z.unknown()),
        interests: z.array(z.string()),
        lifestyle: z.record(z.string()),
        personalityScores: z.record(z.number()).optional().default({}),
      });
      const { userId, answers, interests, lifestyle, personalityScores } = schema.parse(req.body);

      // Verify user exists
      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      // Persist quiz data
      await storage.updateUserQuizCompleted(userId, personalityScores, answers, interests, lifestyle);

      // Run matching
      const tribe = await assignUserToTribe(userId);
      const updatedUser = await storage.getUserById(userId);

      return res.json({ tribe, user: updatedUser });
    } catch (e: any) {
      console.error("[/api/quiz/submit]", e.message);
      return res.status(400).json({ error: e.message });
    }
  });

  // ─── Tribes ───────────────────────────────────────────────────────────────
  app.get("/api/tribes", async (_req, res) => {
    const allTribes = await storage.getAllTribes();
    return res.json(allTribes);
  });

  app.get("/api/tribe/:id", async (req, res) => {
    const tribe = await storage.getTribeById(Number(req.params.id));
    if (!tribe) return res.status(404).json({ error: "Not found" });
    return res.json(tribe);
  });

  app.get("/api/tribe/:id/members", async (req, res) => {
    const tribeId = Number(req.params.id);
    const allUsers = await storage.getAllUsers();
    const members = allUsers.filter((u) => u.tribeId === tribeId);
    // Return safe subset — no raw answers or personality scores
    const safe = members.map((u) => ({
      id: u.id,
      name: u.name,
      avatarInitials: u.avatarInitials,
      avatarColor: u.avatarColor,
      bio: u.bio,
      location: u.location,
      interests: (u.interests as string[]) ?? [],
      joinedAt: u.joinedAt,
    }));
    return res.json(safe);
  });

  // ─── Messages ─────────────────────────────────────────────────────────────
  app.get("/api/tribe/:id/messages", async (req, res) => {
    const tribeId = Number(req.params.id);
    const msgs = await storage.getMessagesByTribe(tribeId, 200);
    return res.json(msgs);
  });

  app.post("/api/tribe/:id/messages", async (req, res) => {
    try {
      const schema = z.object({
        userId: z.number().int().positive(),
        content: z.string().min(1).max(2000),
      });
      const { userId, content } = schema.parse(req.body);
      const tribeId = Number(req.params.id);

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (user.tribeId !== tribeId) return res.status(403).json({ error: "Not a member of this tribe" });

      const msg = await storage.createMessage({
        tribeId,
        userId,
        userName: user.name,
        userInitials: user.avatarInitials ?? "?",
        userColor: user.avatarColor ?? "#6366f1",
        content: content.trim(),
      });
      return res.json(msg);
    } catch (e: any) {
      return res.status(400).json({ error: e.message });
    }
  });

  // ─── Admin ────────────────────────────────────────────────────────────────
  app.get("/api/admin/stats", async (_req, res) => {
    const [allUsers, allTribes] = await Promise.all([
      storage.getAllUsers(),
      storage.getAllTribes(),
    ]);
    return res.json({
      totalUsers: allUsers.length,
      totalTribes: allTribes.length,
      completedQuizzes: allUsers.filter((u) => u.quizCompleted).length,
      tribesAtCapacity: allTribes.filter((t) => t.memberCount >= t.maxMembers).length,
    });
  });

  app.get("/api/admin/tribes", async (_req, res) => {
    const [allTribes, allUsers] = await Promise.all([
      storage.getAllTribes(),
      storage.getAllUsers(),
    ]);
    const result = allTribes.map((t) => ({
      ...t,
      members: allUsers
        .filter((u) => u.tribeId === t.id)
        .map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          avatarInitials: u.avatarInitials,
          avatarColor: u.avatarColor,
          joinedAt: u.joinedAt,
          quizCompleted: u.quizCompleted,
        })),
    }));
    return res.json(result);
  });

  // ─── Health check ─────────────────────────────────────────────────────────
  app.get("/api/health", (_req, res) => {
    return res.json({ status: "ok", timestamp: new Date().toISOString() });
  });
}

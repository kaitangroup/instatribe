import { eq, desc, and } from "drizzle-orm";
import { db } from "./db";
import {
  users, tribes, messages,
  type User, type Tribe, type Message,
  type InsertUser, type InsertTribe, type InsertMessage,
} from "@shared/schema";

// ─── Avatar helpers ────────────────────────────────────────────────────────────
const AVATAR_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#f59e0b", "#10b981",
  "#3b82f6", "#ef4444", "#14b8a6", "#f97316", "#84cc16",
];

function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

function getAvatarColor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
}

// ─── Storage Interface ─────────────────────────────────────────────────────────
export interface IStorage {
  // Users
  createUser(data: Pick<InsertUser, "name" | "email">): Promise<User>;
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  updateUserTribe(userId: number, tribeId: number): Promise<void>;
  updateUserQuizCompleted(
    userId: number,
    scores: Record<string, number>,
    answers: Record<string, unknown>,
    interests: string[],
    lifestyle: Record<string, string>
  ): Promise<void>;
  getAllUsers(): Promise<User[]>;

  // Tribes
  createTribe(data: Omit<InsertTribe, "isActive"> & { name: string; description: string }): Promise<Tribe>;
  getTribeById(id: number): Promise<Tribe | undefined>;
  getAllTribes(): Promise<Tribe[]>;
  updateTribeCentroid(
    tribeId: number,
    centroid: Record<string, number>,
    primaryInterests: string[],
    memberCount: number
  ): Promise<void>;

  // Messages
  createMessage(data: InsertMessage): Promise<Message>;
  getMessagesByTribe(tribeId: number, limit?: number): Promise<Message[]>;
}

// ─── Implementation ────────────────────────────────────────────────────────────
class PostgresStorage implements IStorage {
  async createUser(data: Pick<InsertUser, "name" | "email">): Promise<User> {
    const [user] = await db
      .insert(users)
      .values({
        name: data.name,
        email: data.email,
        avatarInitials: getInitials(data.name),
        avatarColor: getAvatarColor(data.name),
      })
      .returning();
    return user;
  }

  async getUserById(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.email, email));
    return user;
  }

  async updateUserTribe(userId: number, tribeId: number): Promise<void> {
    await db.update(users).set({ tribeId }).where(eq(users.id, userId));
  }

  async updateUserQuizCompleted(
    userId: number,
    scores: Record<string, number>,
    answers: Record<string, unknown>,
    interests: string[],
    lifestyle: Record<string, string>
  ): Promise<void> {
    await db.update(users).set({
      quizCompleted: true,
      personalityScores: scores,
      answers,
      interests,
      lifestyle,
    }).where(eq(users.id, userId));
  }

  async getAllUsers(): Promise<User[]> {
    return db.select().from(users);
  }

  async createTribe(data: { name: string; description: string; maxMembers?: number }): Promise<Tribe> {
    const [tribe] = await db
      .insert(tribes)
      .values({
        name: data.name,
        description: data.description,
        maxMembers: data.maxMembers ?? 30,
        centroid: {},
        primaryInterests: [],
        isActive: true,
      })
      .returning();
    return tribe;
  }

  async getTribeById(id: number): Promise<Tribe | undefined> {
    const [tribe] = await db.select().from(tribes).where(eq(tribes.id, id));
    return tribe;
  }

  async getAllTribes(): Promise<Tribe[]> {
    return db.select().from(tribes);
  }

  async updateTribeCentroid(
    tribeId: number,
    centroid: Record<string, number>,
    primaryInterests: string[],
    memberCount: number
  ): Promise<void> {
    await db.update(tribes).set({ centroid, primaryInterests, memberCount }).where(eq(tribes.id, tribeId));
  }

  async createMessage(data: InsertMessage): Promise<Message> {
    const [msg] = await db.insert(messages).values(data).returning();
    return msg;
  }

  async getMessagesByTribe(tribeId: number, limit = 200): Promise<Message[]> {
    // Fetch latest `limit` messages then reverse for ascending order
    const rows = await db
      .select()
      .from(messages)
      .where(eq(messages.tribeId, tribeId))
      .orderBy(desc(messages.id))
      .limit(limit);
    return rows.reverse();
  }
}

export const storage = new PostgresStorage();

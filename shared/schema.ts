import { pgTable, text, integer, boolean, serial, timestamp, jsonb, real } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// ─── Users ────────────────────────────────────────────────────────────────────
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  age: integer("age"),
  location: text("location"),
  bio: text("bio"),
  avatarInitials: text("avatar_initials"),
  avatarColor: text("avatar_color"),
  tribeId: integer("tribe_id"),
  quizCompleted: boolean("quiz_completed").default(false),
  joinedAt: timestamp("joined_at").defaultNow().notNull(),
  interests: jsonb("interests").$type<string[]>().default([]),
  personalityScores: jsonb("personality_scores").$type<Record<string, number>>().default({}),
  answers: jsonb("answers").$type<Record<string, unknown>>().default({}),
  lifestyle: jsonb("lifestyle").$type<Record<string, string>>().default({}),
});

export const insertUserSchema = createInsertSchema(users).omit({
  id: true,
  tribeId: true,
  quizCompleted: true,
  joinedAt: true,
  avatarInitials: true,
  avatarColor: true,
});
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// ─── Tribes ───────────────────────────────────────────────────────────────────
export const tribes = pgTable("tribes", {
  id: serial("id").primaryKey(),
  name: text("name").notNull().unique(),
  description: text("description"),
  memberCount: integer("member_count").default(0).notNull(),
  maxMembers: integer("max_members").default(30).notNull(),
  centroid: jsonb("centroid").$type<Record<string, number>>().default({}),
  primaryInterests: jsonb("primary_interests").$type<string[]>().default([]),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  isActive: boolean("is_active").default(true).notNull(),
});

export const insertTribeSchema = createInsertSchema(tribes).omit({
  id: true,
  memberCount: true,
  createdAt: true,
});
export type InsertTribe = z.infer<typeof insertTribeSchema>;
export type Tribe = typeof tribes.$inferSelect;

// ─── Messages ─────────────────────────────────────────────────────────────────
export const messages = pgTable("messages", {
  id: serial("id").primaryKey(),
  tribeId: integer("tribe_id").notNull(),
  userId: integer("user_id").notNull(),
  userName: text("user_name").notNull(),
  userInitials: text("user_initials").notNull(),
  userColor: text("user_color").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertMessageSchema = createInsertSchema(messages).omit({
  id: true,
  createdAt: true,
});
export type InsertMessage = z.infer<typeof insertMessageSchema>;
export type Message = typeof messages.$inferSelect;

// ─── Quiz Questions (static — not stored in DB) ────────────────────────────────
export const QUIZ_QUESTIONS = [
  // --- Personal Background ---
  {
    id: "age_group",
    section: "About You",
    question: "What stage of life are you in?",
    type: "single",
    options: ["18–25", "26–35", "36–45", "46–55", "56–65", "65+"],
    dimension: "demographic",
    weight: 0.5,
  },
  {
    id: "location_type",
    section: "About You",
    question: "Where do you live?",
    type: "single",
    options: ["Big city", "Suburban area", "Small town", "Rural / countryside"],
    dimension: "demographic",
    weight: 0.5,
  },
  {
    id: "career_stage",
    section: "About You",
    question: "How would you describe your career situation?",
    type: "single",
    options: [
      "Student / just starting out",
      "Building my career",
      "Established professional",
      "Entrepreneur / self-employed",
      "Semi-retired",
      "Retired",
    ],
    dimension: "lifestyle",
    weight: 0.7,
  },
  // --- Personality ---
  {
    id: "social_energy",
    section: "Personality",
    question: "After a long day, you most want to:",
    type: "single",
    options: [
      "Go out and be with people",
      "Have a small gathering with close friends",
      "Have quiet time alone to recharge",
    ],
    dimension: "extraversion",
    weight: 1.0,
  },
  {
    id: "decision_style",
    section: "Personality",
    question: "When making an important decision, you primarily rely on:",
    type: "single",
    options: [
      "Logic and data analysis",
      "Gut feeling and instinct",
      "Input from people I trust",
      "A mix of all three",
    ],
    dimension: "conscientiousness",
    weight: 0.8,
  },
  {
    id: "conflict_style",
    section: "Personality",
    question: "When conflict arises, your first instinct is to:",
    type: "single",
    options: [
      "Address it directly and immediately",
      "Let things calm down, then talk",
      "Seek to understand the other person's view first",
      "Avoid confrontation when possible",
    ],
    dimension: "agreeableness",
    weight: 0.9,
  },
  {
    id: "new_experiences",
    section: "Personality",
    question: "How do you feel about trying new things?",
    type: "single",
    options: [
      "Love it — I seek novelty constantly",
      "I enjoy it when the opportunity arises",
      "I prefer familiar routines with occasional new things",
      "I like to stick with what works",
    ],
    dimension: "openness",
    weight: 1.0,
  },
  {
    id: "stress_response",
    section: "Personality",
    question: "Under pressure, you tend to:",
    type: "single",
    options: [
      "Thrive — pressure brings out the best in me",
      "Stay calm and methodical",
      "Feel stressed but push through",
      "Need to talk it out with someone",
    ],
    dimension: "neuroticism",
    weight: 0.8,
  },
  {
    id: "communication_style",
    section: "Personality",
    question: "Your communication style is best described as:",
    type: "single",
    options: [
      "Direct and to the point",
      "Warm and nurturing",
      "Analytical and detail-oriented",
      "Enthusiastic and expressive",
    ],
    dimension: "extraversion",
    weight: 0.7,
  },
  // --- Values ---
  {
    id: "core_value",
    section: "Values",
    question: "Which value resonates most with you?",
    type: "single",
    options: [
      "Freedom and independence",
      "Security and stability",
      "Growth and achievement",
      "Community and belonging",
      "Creativity and self-expression",
    ],
    dimension: "values",
    weight: 1.2,
  },
  {
    id: "life_philosophy",
    section: "Values",
    question: "Which statement best describes your life approach?",
    type: "single",
    options: [
      "Work hard now, enjoy later",
      "Work-life balance above all",
      "Live in the moment",
      "Build something that lasts",
      "Keep learning and evolving",
    ],
    dimension: "values",
    weight: 1.0,
  },
  {
    id: "success_definition",
    section: "Values",
    question: "How do you define personal success?",
    type: "single",
    options: [
      "Financial freedom and security",
      "Meaningful relationships",
      "Making a positive impact",
      "Mastery and expertise in my field",
      "Happiness and peace of mind",
    ],
    dimension: "values",
    weight: 1.0,
  },
  // --- Interests ---
  {
    id: "primary_interests",
    section: "Interests",
    question: "Which topics genuinely excite you? (Pick all that apply)",
    type: "multi",
    options: [
      "Business & entrepreneurship",
      "Finance & investing",
      "Technology & AI",
      "Health & wellness",
      "Sports & fitness",
      "Arts & creativity",
      "Travel & adventure",
      "Food & cooking",
      "Books & literature",
      "Politics & current events",
      "Science & research",
      "Spirituality & philosophy",
      "Family & parenting",
      "Law & justice",
      "Real estate",
    ],
    dimension: "interests",
    weight: 1.5,
  },
  {
    id: "hobby_style",
    section: "Interests",
    question: "How do you most enjoy spending free time?",
    type: "single",
    options: [
      "Physical activities (sports, gym, hiking)",
      "Creative pursuits (art, music, writing)",
      "Learning (reading, courses, documentaries)",
      "Social activities (dining, events, travel)",
      "Relaxing at home (streaming, gaming, cooking)",
    ],
    dimension: "lifestyle",
    weight: 0.8,
  },
  // --- Group Dynamics ---
  {
    id: "advice_style",
    section: "Group Dynamics",
    question: "When you ask for advice from a group, you prefer:",
    type: "single",
    options: [
      "Straight talk — tell me the honest truth",
      "Supportive first, then suggestions",
      "A range of perspectives to consider",
      "Practical step-by-step guidance",
    ],
    dimension: "groupPref",
    weight: 0.9,
  },
  {
    id: "contribution_style",
    section: "Group Dynamics",
    question: "In a group, you naturally tend to:",
    type: "single",
    options: [
      "Lead and take initiative",
      "Support and encourage others",
      "Analyze and provide insights",
      "Listen and observe, speaking up when it matters",
    ],
    dimension: "groupPref",
    weight: 1.0,
  },
  {
    id: "friendship_depth",
    section: "Group Dynamics",
    question: "When it comes to friendships, you prefer:",
    type: "single",
    options: [
      "A few very deep, close relationships",
      "A broad social network",
      "A mix of both",
      "Situational connections based on shared activities",
    ],
    dimension: "groupPref",
    weight: 0.8,
  },
  {
    id: "seeking_from_tribe",
    section: "Group Dynamics",
    question: "What are you most hoping to get from your tribe?",
    type: "multi",
    options: [
      "Honest advice and accountability",
      "Emotional support and understanding",
      "Professional networking",
      "New perspectives and ideas",
      "Friendship and fun",
      "Shared experiences and activities",
    ],
    dimension: "groupPref",
    weight: 1.3,
  },
];

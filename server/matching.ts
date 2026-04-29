/**
 * Tribe Matching Algorithm
 *
 * Converts each user's quiz answers into a numeric feature vector,
 * then uses cosine similarity to find the best-fit tribe.
 * If no tribe exceeds the similarity threshold (or all are full),
 * a new tribe is automatically created.
 * After every assignment the tribe's centroid is recomputed.
 */

import { storage } from "./storage";
import type { Tribe } from "@shared/schema";

// ─── Interest dimension keys ───────────────────────────────────────────────────
const INTEREST_LIST = [
  "Business & entrepreneurship", "Finance & investing", "Technology & AI",
  "Health & wellness", "Sports & fitness", "Arts & creativity",
  "Travel & adventure", "Food & cooking", "Books & literature",
  "Politics & current events", "Science & research", "Spirituality & philosophy",
  "Family & parenting", "Law & justice", "Real estate",
];

// ─── Feature vector from quiz answers ─────────────────────────────────────────
export function answersToVector(answers: Record<string, unknown>): Record<string, number> {
  const q = answers as Record<string, string | string[]>;

  const vec: Record<string, number> = {
    openness: 0,
    conscientiousness: 0,
    extraversion: 0,
    agreeableness: 0,
    neuroticism: 0,
    values_freedom: 0,
    values_security: 0,
    values_growth: 0,
    values_community: 0,
    values_creativity: 0,
    group_lead: 0,
    group_support: 0,
    group_analyze: 0,
    group_listen: 0,
    lifestyle_active: 0,
    lifestyle_creative: 0,
    lifestyle_learning: 0,
    lifestyle_social: 0,
    lifestyle_homebod: 0,
  };

  // Extraversion
  if (q.social_energy === "Go out and be with people") vec.extraversion = 1;
  else if (q.social_energy === "Have a small gathering with close friends") vec.extraversion = 0.5;
  if (q.communication_style === "Enthusiastic and expressive") vec.extraversion = Math.min(vec.extraversion + 0.5, 1);
  else if (q.communication_style === "Warm and nurturing") vec.extraversion = Math.min(vec.extraversion + 0.25, 1);

  // Openness
  if (q.new_experiences === "Love it — I seek novelty constantly") vec.openness = 1;
  else if (q.new_experiences === "I enjoy it when the opportunity arises") vec.openness = 0.67;
  else if (q.new_experiences === "I prefer familiar routines with occasional new things") vec.openness = 0.33;

  // Conscientiousness
  if (q.decision_style === "Logic and data analysis") vec.conscientiousness = 1;
  else if (q.decision_style === "A mix of all three") vec.conscientiousness = 0.5;
  else vec.conscientiousness = 0.25;

  // Agreeableness
  if (q.conflict_style === "Seek to understand the other person's view first") vec.agreeableness = 1;
  else if (q.conflict_style === "Let things calm down, then talk") vec.agreeableness = 0.67;
  else if (q.conflict_style === "Address it directly and immediately") vec.agreeableness = 0.33;

  // Neuroticism (lower is better under pressure)
  if (q.stress_response === "Feel stressed but push through") vec.neuroticism = 0.75;
  else if (q.stress_response === "Need to talk it out with someone") vec.neuroticism = 0.5;
  else if (q.stress_response === "Stay calm and methodical") vec.neuroticism = 0.25;
  // "Thrive" → 0 (already default)

  // Values
  const valueMap: Record<string, string> = {
    "Freedom and independence": "values_freedom",
    "Security and stability": "values_security",
    "Growth and achievement": "values_growth",
    "Community and belonging": "values_community",
    "Creativity and self-expression": "values_creativity",
  };
  if (typeof q.core_value === "string" && valueMap[q.core_value]) {
    vec[valueMap[q.core_value]] = 1;
  }

  // Group role
  if (q.contribution_style === "Lead and take initiative") vec.group_lead = 1;
  else if (q.contribution_style === "Support and encourage others") vec.group_support = 1;
  else if (q.contribution_style === "Analyze and provide insights") vec.group_analyze = 1;
  else if (q.contribution_style === "Listen and observe, speaking up when it matters") vec.group_listen = 1;

  // Lifestyle
  if (q.hobby_style === "Physical activities (sports, gym, hiking)") vec.lifestyle_active = 1;
  else if (q.hobby_style === "Creative pursuits (art, music, writing)") vec.lifestyle_creative = 1;
  else if (q.hobby_style === "Learning (reading, courses, documentaries)") vec.lifestyle_learning = 1;
  else if (q.hobby_style === "Social activities (dining, events, travel)") vec.lifestyle_social = 1;
  else if (q.hobby_style === "Relaxing at home (streaming, gaming, cooking)") vec.lifestyle_homebod = 1;

  // Interest dimensions (binary per topic)
  const selectedInterests = Array.isArray(q.primary_interests) ? q.primary_interests as string[] : [];
  for (const interest of INTEREST_LIST) {
    const key = "interest_" + interest.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    vec[key] = selectedInterests.includes(interest) ? 1 : 0;
  }

  return vec;
}

// ─── Cosine similarity ─────────────────────────────────────────────────────────
function cosineSimilarity(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let dot = 0, normA = 0, normB = 0;
  for (const k of keys) {
    const av = a[k] ?? 0;
    const bv = b[k] ?? 0;
    dot += av * bv;
    normA += av * av;
    normB += bv * bv;
  }
  if (normA === 0 || normB === 0) return 0;
  return dot / (Math.sqrt(normA) * Math.sqrt(normB));
}

// ─── Tribe name generator ──────────────────────────────────────────────────────
const TRIBE_ADJECTIVES = [
  "Curious", "Steadfast", "Bold", "Thoughtful", "Spirited", "Grounded",
  "Vibrant", "Resilient", "Creative", "Driven", "Serene", "Dynamic",
  "Wise", "Brave", "Warm", "Sharp", "Candid", "Focused", "Earnest", "Tenacious",
  "Radiant", "Humble", "Fearless", "Methodical",
];

const TRIBE_NOUNS = [
  "Pioneers", "Seekers", "Builders", "Thinkers", "Explorers", "Guardians",
  "Makers", "Connectors", "Visionaries", "Dreamers", "Navigators", "Champions",
  "Wanderers", "Achievers", "Storytellers", "Catalysts", "Architects", "Luminaries",
];

function generateTribeName(existingNames: string[]): string {
  const adjs = [...TRIBE_ADJECTIVES].sort(() => Math.random() - 0.5);
  const nouns = [...TRIBE_NOUNS].sort(() => Math.random() - 0.5);
  for (const adj of adjs) {
    for (const noun of nouns) {
      const name = `The ${adj} ${noun}`;
      if (!existingNames.includes(name)) return name;
    }
  }
  return `Tribe ${Date.now()}`; // absolute fallback
}

// ─── Centroid recalculation ────────────────────────────────────────────────────
async function recalcCentroid(tribeId: number): Promise<void> {
  const allUsers = await storage.getAllUsers();
  const members = allUsers.filter((u) => u.tribeId === tribeId && u.quizCompleted);
  if (members.length === 0) return;

  const vectors = members.map((u) => answersToVector((u.answers as Record<string, unknown>) ?? {}));
  const centroid: Record<string, number> = {};

  for (const vec of vectors) {
    for (const [k, v] of Object.entries(vec)) {
      centroid[k] = (centroid[k] ?? 0) + v;
    }
  }
  for (const k of Object.keys(centroid)) centroid[k] /= members.length;

  // Derive top shared interests
  const interestCounts: Record<string, number> = {};
  for (const u of members) {
    const interests = (u.interests as string[]) ?? [];
    for (const i of interests) interestCounts[i] = (interestCounts[i] ?? 0) + 1;
  }
  const primaryInterests = Object.entries(interestCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k]) => k);

  await storage.updateTribeCentroid(tribeId, centroid, primaryInterests, members.length);
}

// ─── Main entry point ──────────────────────────────────────────────────────────
const SIMILARITY_THRESHOLD = 0.70; // 70% cosine similarity required to join existing tribe

export async function assignUserToTribe(userId: number): Promise<Tribe> {
  const user = await storage.getUserById(userId);
  if (!user) throw new Error("User not found");

  const userVector = answersToVector((user.answers as Record<string, unknown>) ?? {});
  const allTribes = await storage.getAllTribes();
  const activeTribes = allTribes.filter((t) => t.isActive);
  const existingNames = activeTribes.map((t) => t.name);

  // Find best matching tribe that has available capacity
  let bestTribe: Tribe | null = null;
  let bestScore = -1;

  for (const tribe of activeTribes) {
    if (tribe.memberCount >= tribe.maxMembers) continue;

    const centroid = (tribe.centroid as Record<string, number>) ?? {};
    if (Object.keys(centroid).length === 0) continue; // Empty tribe has no centroid yet

    const score = cosineSimilarity(userVector, centroid);
    if (score > bestScore && score >= SIMILARITY_THRESHOLD) {
      bestScore = score;
      bestTribe = tribe;
    }
  }

  // No suitable tribe found → create one
  if (!bestTribe) {
    const name = generateTribeName(existingNames);
    const userInterests = (user.interests as string[]) ?? [];
    bestTribe = await storage.createTribe({
      name,
      description: "A tribe of people with shared passions and complementary perspectives.",
      maxMembers: 30,
    });
  }

  // Assign user to tribe
  await storage.updateUserTribe(userId, bestTribe.id);

  // Recompute centroid asynchronously (don't block the response)
  recalcCentroid(bestTribe.id).catch((err) =>
    console.error("[matching] Centroid recalc error:", err)
  );

  const updated = await storage.getTribeById(bestTribe.id);
  return updated!;
}

import { sqliteTable, text, integer } from "drizzle-orm/sqlite-core";
import { sql } from "drizzle-orm";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export type ProfilePrompt = { question: string; answer: string };

export const GENDER_OPTIONS = ["man", "woman", "nonbinary", "other"] as const;
export const SHOW_ME_OPTIONS = ["men", "women", "everyone"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];
export type ShowMe = (typeof SHOW_ME_OPTIONS)[number];

export const usersTable = sqliteTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").unique(),
  email: text("email"),
  name: text("name").notNull(),
  bio: text("bio"),
  dateOfBirth: text("date_of_birth"),
  gender: text("gender").$type<Gender>(),
  showMeGender: text("show_me_gender").$type<ShowMe>().default("everyone"),
  photos: text("photos", { mode: 'json' }).$type<string[]>().default([]),
  personalityVector: text("personality_vector", { mode: 'json' }).$type<number[]>(),
  profilePrompts: text("profile_prompts", { mode: 'json' }).$type<ProfilePrompt[]>().default([]),
  passwordHash: text("password_hash"),
  role: text("role"),
  status: text("status").notNull().default("looking"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  chooserSessionsToday: integer("chooser_sessions_today").notNull().default(0),
  chooserLastSessionDate: text("chooser_last_session_date"),
  expoPushToken: text("expo_push_token"),
  isAdmin: integer("is_admin", { mode: 'boolean' }).notNull().default(false),
  isBanned: integer("is_banned", { mode: 'boolean' }).notNull().default(false),
  ageVerified: integer("age_verified", { mode: 'boolean' }).notNull().default(false),
  termsAccepted: integer("terms_accepted", { mode: 'boolean' }).notNull().default(false),
  privacyAccepted: integer("privacy_accepted", { mode: 'boolean' }).notNull().default(false),
  termsVersion: text("terms_version").default("1.0"),
  consentTimestamp: integer("consent_timestamp", { mode: 'timestamp' }),
  isPremium: integer("is_premium", { mode: 'boolean' }).notNull().default(false),
  isOrganizer: integer("is_organizer", { mode: 'boolean' }).notNull().default(false),
  isSuperAdmin: integer("is_super_admin", { mode: 'boolean' }).notNull().default(false),
  qualifications: text("qualifications", { mode: 'json' }).$type<string[]>().default([]), // e.g., ['medical', 'security']
  lastLat: text("last_lat"),
  lastLng: text("last_lng"),
  isVisible: integer("is_visible", { mode: 'boolean' }).notNull().default(false),
  identitySessionId: text("identity_session_id"),
  createdAt: integer("created_at", { mode: 'timestamp' }).notNull().default(sql`(unixepoch())`),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

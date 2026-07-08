import { pgTable, text, timestamp, pgEnum, jsonb, date, integer, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userStatusEnum = pgEnum("user_status", ["looking", "matched", "in_room"]);
export const userRoleEnum = pgEnum("user_role", ["chooser", "suitor"]);

export type ProfilePrompt = { question: string; answer: string };

export const GENDER_OPTIONS = ["man", "woman", "nonbinary", "other"] as const;
export const SHOW_ME_OPTIONS = ["men", "women", "everyone"] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];
export type ShowMe = (typeof SHOW_ME_OPTIONS)[number];

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").unique(),
  email: text("email"),
  name: text("name").notNull(),
  bio: text("bio"),
  dateOfBirth: date("date_of_birth"),
  gender: text("gender").$type<Gender>(),
  showMeGender: text("show_me_gender").$type<ShowMe>().default("everyone"),
  photos: jsonb("photos").$type<string[]>().default([]),
  personalityVector: jsonb("personality_vector").$type<number[]>(),
  profilePrompts: jsonb("profile_prompts").$type<ProfilePrompt[]>().default([]),
  role: userRoleEnum("role"),
  status: userStatusEnum("status").notNull().default("looking"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  chooserSessionsToday: integer("chooser_sessions_today").notNull().default(0),
  chooserLastSessionDate: text("chooser_last_session_date"),
  expoPushToken: text("expo_push_token"),
  isAdmin: boolean("is_admin").notNull().default(false),
  isBanned: boolean("is_banned").notNull().default(false),
  ageVerified: boolean("age_verified").notNull().default(false),
  identitySessionId: text("identity_session_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

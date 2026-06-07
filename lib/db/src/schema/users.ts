import { pgTable, text, timestamp, pgEnum, jsonb, date, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userStatusEnum = pgEnum("user_status", ["looking", "matched", "in_room"]);
export const userRoleEnum = pgEnum("user_role", ["chooser", "suitor"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  clerkId: text("clerk_id").unique(),
  email: text("email"),
  name: text("name").notNull(),
  bio: text("bio"),
  dateOfBirth: date("date_of_birth"),
  photos: jsonb("photos").$type<string[]>().default([]),
  personalityVector: jsonb("personality_vector").$type<number[]>(),
  role: userRoleEnum("role"),
  status: userStatusEnum("status").notNull().default("looking"),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

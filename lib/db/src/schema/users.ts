import { pgTable, text, timestamp, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const userStatusEnum = pgEnum("user_status", ["looking", "matched", "in_room"]);
export const userRoleEnum = pgEnum("user_role", ["chooser", "suitor"]);

export const usersTable = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  personalityVector: jsonb("personality_vector").notNull().$type<number[]>(),
  role: userRoleEnum("role").notNull(),
  status: userStatusEnum("status").notNull().default("looking"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ createdAt: true });

export type User = typeof usersTable.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

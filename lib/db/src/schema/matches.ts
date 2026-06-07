import { pgTable, text, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const matchStatusEnum = pgEnum("match_status", ["active", "archived"]);

// Created when a chooser picks a winner from a speed-date room
export const matchesTable = pgTable("matches", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),         // the room that produced this match
  chooserUserId: text("chooser_user_id").notNull(),
  suitorUserId: text("suitor_user_id").notNull(),
  chooserName: text("chooser_name").notNull(),
  suitorName: text("suitor_name").notNull(),
  status: matchStatusEnum("status").notNull().default("active"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// 1-on-1 private messages between matched users
export const directMessagesTable = pgTable("direct_messages", {
  id: text("id").primaryKey(),
  matchId: text("match_id").notNull().references(() => matchesTable.id),
  senderId: text("sender_id").notNull(),   // userId of sender
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertMatchSchema = createInsertSchema(matchesTable).omit({ createdAt: true });
export const insertDirectMessageSchema = createInsertSchema(directMessagesTable).omit({ createdAt: true });

export type Match = typeof matchesTable.$inferSelect;
export type InsertMatch = z.infer<typeof insertMatchSchema>;
export type DirectMessage = typeof directMessagesTable.$inferSelect;
export type InsertDirectMessage = z.infer<typeof insertDirectMessageSchema>;

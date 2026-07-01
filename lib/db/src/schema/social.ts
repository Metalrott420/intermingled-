import { pgTable, text, timestamp, primaryKey } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// ── Blocks ──────────────────────────────────────────────────────────────────
export const blocksTable = pgTable("blocks", {
  blockerId: text("blocker_id").notNull(),
  blockedId: text("blocked_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.blockerId, t.blockedId] })]);

// ── Reports ──────────────────────────────────────────────────────────────────
export const reportsTable = pgTable("reports", {
  id: text("id").primaryKey(),
  reporterId: text("reporter_id").notNull(),
  reportedId: text("reported_id").notNull(),
  reason: text("reason").notNull(),
  detail: text("detail"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

// ── Likes ──────────────────────────────────────────────────────────────────
export const likesTable = pgTable("likes", {
  likerId: text("liker_id").notNull(),
  likedId: text("liked_id").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
}, (t) => [primaryKey({ columns: [t.likerId, t.likedId] })]);

// ── Post-game group messages ──────────────────────────────────────────────
export const groupMessagesTable = pgTable("group_messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull(),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertBlockSchema = createInsertSchema(blocksTable).omit({ createdAt: true });
export const insertReportSchema = createInsertSchema(reportsTable).omit({ createdAt: true });
export const insertLikeSchema = createInsertSchema(likesTable).omit({ createdAt: true });
export const insertGroupMessageSchema = createInsertSchema(groupMessagesTable).omit({ createdAt: true });

export type Block = typeof blocksTable.$inferSelect;
export type Report = typeof reportsTable.$inferSelect;
export type Like = typeof likesTable.$inferSelect;
export type GroupMessage = typeof groupMessagesTable.$inferSelect;
export type InsertGroupMessage = z.infer<typeof insertGroupMessageSchema>;

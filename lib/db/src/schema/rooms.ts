import { pgTable, text, integer, timestamp, pgEnum } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomStatusEnum = pgEnum("room_status", ["waiting", "active", "ended"]);
export const participantRoleEnum = pgEnum("participant_role", ["chooser", "suitor"]);

export const roomsTable = pgTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  status: roomStatusEnum("status").notNull().default("waiting"),
  chooserName: text("chooser_name"),
  winnerId: text("winner_id"),
  winnerName: text("winner_name"),
  maxSuitors: integer("max_suitors").notNull().default(5),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const participantsTable = pgTable("participants", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => roomsTable.id),
  name: text("name").notNull(),
  role: participantRoleEnum("role").notNull(),
  suitorSlot: integer("suitor_slot"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => roomsTable.id),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderRole: participantRoleEnum("sender_role").notNull(),
  suitorSlot: integer("suitor_slot"),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({ createdAt: true });
export const insertParticipantSchema = createInsertSchema(participantsTable).omit({ createdAt: true });
export const insertMessageSchema = createInsertSchema(messagesTable).omit({ createdAt: true });

export type Room = typeof roomsTable.$inferSelect;
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Participant = typeof participantsTable.$inferSelect;
export type InsertParticipant = z.infer<typeof insertParticipantSchema>;
export type Message = typeof messagesTable.$inferSelect;
export type InsertMessage = z.infer<typeof insertMessageSchema>;

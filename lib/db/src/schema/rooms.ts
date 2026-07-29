import { pgTable, text, integer, timestamp, pgEnum, jsonb, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const roomStatusEnum = pgEnum("room_status", ["waiting", "active", "ended"]);
export const participantRoleEnum = pgEnum("participant_role", ["chooser", "suitor"]);

export const roomsTable = pgTable("rooms", {
  id: text("id").primaryKey(),
  code: text("code").notNull().unique(),
  status: roomStatusEnum("status").notNull().default("waiting"),
  roomSnapshotVersion: integer("room_snapshot_version").notNull().default(0),
  chooserName: text("chooser_name"),
  chooserUserId: text("chooser_user_id"),
  winnerId: text("winner_id"),
  winnerName: text("winner_name"),
  maxSuitors: integer("max_suitors").notNull().default(3),
  currentRound: integer("current_round").notNull().default(1),
  /** Number of rounds in this session (3 or 5). Defaults to 3 */
  numberOfRounds: integer("number_of_rounds").notNull().default(3),
  /** Per-round duration in seconds for the chooser/question phase */
  roundDurationSeconds: integer("round_duration_seconds").notNull().default(30),
  /** Answer time in seconds for a suitor response */
  answerTimeSeconds: integer("answer_time_seconds").notNull().default(15),
  /** Optional timestamp when current round ends (for timer sync) */
  roundEndsAt: timestamp("round_ends_at"),
  /** Room-level question strategy and tuning configuration */
  questionConfig: jsonb("question_config").$type<Record<string, unknown>>().notNull().default({}),
  /** Question ids selected for the current round */
  currentRoundQuestionIds: jsonb("current_round_question_ids").$type<string[]>().notNull().default([]),
  /** All question ids already used in this game session */
  usedQuestionIds: jsonb("used_question_ids").$type<string[]>().notNull().default([]),
  eliminatedParticipants: jsonb("eliminated_participants").$type<string[]>().notNull().default([]),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const participantsTable = pgTable("participants", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => roomsTable.id),
  userId: text("user_id"),
  name: text("name").notNull(),
  role: participantRoleEnum("role").notNull(),
  suitorSlot: integer("suitor_slot"),
  isBot: boolean("is_bot").notNull().default(false),
  isPremium: boolean("is_premium").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const messagesTable = pgTable("messages", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => roomsTable.id),
  senderId: text("sender_id").notNull(),
  senderName: text("sender_name").notNull(),
  senderRole: participantRoleEnum("sender_role").notNull(),
  suitorSlot: integer("suitor_slot"),
  round: integer("round"),
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

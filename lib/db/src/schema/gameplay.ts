import { pgTable, text, timestamp, integer, jsonb, pgEnum, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable, participantsTable } from "./rooms";
import { usersTable } from "./users";

export const archiveMatchStatusEnum = pgEnum("archive_match_status", ["matched", "unmatched", "unknown"]);
export const questionCategoryEnum = pgEnum("question_category", ["general", "fun", "deep"]);
export const questionDifficultyEnum = pgEnum("question_difficulty", ["easy", "medium", "hard"]);

export const gameArchivesTable = pgTable("game_archives", {
  id: text("id").primaryKey(),
  roomId: text("room_id").notNull().references(() => roomsTable.id),
  finalParticipants: jsonb("final_participants").$type<Array<{
    id: string;
    name: string;
    role: string;
    suitorSlot: number | null;
    isBot: boolean;
    isPremium: boolean;
  }>>().notNull().default([]),
  eliminationOrder: jsonb("elimination_order").$type<string[]>().notNull().default([]),
  questionsAsked: jsonb("questions_asked").$type<Array<{
    participantId: string;
    suitorSlot: number | null;
    round: number | null;
    content: string;
    createdAt: string;
  }>>().notNull().default([]),
  roundDurations: jsonb("round_durations").$type<number[]>().notNull().default([]),
  winnerId: text("winner_id"),
  winnerName: text("winner_name"),
  matchStatus: archiveMatchStatusEnum("match_status").notNull().default("unknown"),
  completionTimestamp: timestamp("completion_timestamp").notNull().defaultNow(),
  analyticsMetadata: jsonb("analytics_metadata").$type<Record<string, unknown>>().notNull().default({}),
});

export const playerGameStatsTable = pgTable("player_game_stats", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  gamesPlayed: integer("games_played").notNull().default(0),
  wins: integer("wins").notNull().default(0),
  matches: integer("matches").notNull().default(0),
  totalRoundsSurvived: integer("total_rounds_survived").notNull().default(0),
  lastPlayedAt: timestamp("last_played_at"),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const playerGameHistoryTable = pgTable("player_game_history", {
  id: text("id").primaryKey(),
  userId: text("user_id").notNull().references(() => usersTable.id),
  roomId: text("room_id").notNull().references(() => roomsTable.id),
  participantId: text("participant_id").notNull().references(() => participantsTable.id),
  role: text("role").notNull(),
  isWinner: boolean("is_winner").notNull().default(false),
  matchStatus: archiveMatchStatusEnum("match_status").notNull().default("unknown"),
  roundsSurvived: integer("rounds_survived").notNull().default(0),
  eliminatedAtRound: integer("eliminated_at_round"),
  completionTimestamp: timestamp("completion_timestamp").notNull().defaultNow(),
});

export const gameplayEventsTable = pgTable("gameplay_events", {
  id: text("id").primaryKey(),
  roomId: text("room_id").references(() => roomsTable.id),
  userId: text("user_id").references(() => usersTable.id),
  participantId: text("participant_id").references(() => participantsTable.id),
  eventType: text("event_type").notNull(),
  payload: jsonb("payload").$type<Record<string, unknown>>().notNull().default({}),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const questionBankTable = pgTable("question_bank", {
  id: text("id").primaryKey(),
  packSlug: text("pack_slug").notNull().default("core"),
  category: questionCategoryEnum("category").notNull().default("general"),
  difficulty: questionDifficultyEnum("difficulty").notNull().default("easy"),
  content: text("content").notNull(),
  normalizedHash: text("normalized_hash").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
  usageCount: integer("usage_count").notNull().default(0),
  createdByUserId: text("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertGameArchiveSchema = createInsertSchema(gameArchivesTable).omit({ completionTimestamp: true });
export const insertPlayerGameStatsSchema = createInsertSchema(playerGameStatsTable).omit({ updatedAt: true });
export const insertPlayerGameHistorySchema = createInsertSchema(playerGameHistoryTable).omit({ completionTimestamp: true });
export const insertGameplayEventSchema = createInsertSchema(gameplayEventsTable).omit({ createdAt: true });
export const insertQuestionBankSchema = createInsertSchema(questionBankTable).omit({
  createdAt: true,
  updatedAt: true,
  usageCount: true,
});

export type GameArchive = typeof gameArchivesTable.$inferSelect;
export type InsertGameArchive = z.infer<typeof insertGameArchiveSchema>;
export type PlayerGameStats = typeof playerGameStatsTable.$inferSelect;
export type InsertPlayerGameStats = z.infer<typeof insertPlayerGameStatsSchema>;
export type PlayerGameHistory = typeof playerGameHistoryTable.$inferSelect;
export type InsertPlayerGameHistory = z.infer<typeof insertPlayerGameHistorySchema>;
export type GameplayEvent = typeof gameplayEventsTable.$inferSelect;
export type InsertGameplayEvent = z.infer<typeof insertGameplayEventSchema>;
export type QuestionBankRow = typeof questionBankTable.$inferSelect;
export type InsertQuestionBank = z.infer<typeof insertQuestionBankSchema>;

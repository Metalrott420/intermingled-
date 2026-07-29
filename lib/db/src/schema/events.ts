import { pgTable, text, timestamp, boolean, pgEnum, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const ballroomEventStatusEnum = pgEnum("ballroom_event_status", [
  "scheduled",
  "live",
  "completed",
  "cancelled",
]);

export const ballroomEventsTable = pgTable("ballroom_events", {
  id: text("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description"),
  status: ballroomEventStatusEnum("status").notNull().default("scheduled"),
  startsAt: timestamp("starts_at").notNull(),
  endsAt: timestamp("ends_at"),
  isFeatured: boolean("is_featured").notNull().default(false),
  metadata: jsonb("metadata").$type<Record<string, unknown>>().notNull().default({}),
  createdByUserId: text("created_by_user_id").references(() => usersTable.id),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertBallroomEventSchema = createInsertSchema(ballroomEventsTable).omit({
  createdAt: true,
  updatedAt: true,
});

export type BallroomEvent = typeof ballroomEventsTable.$inferSelect;
export type InsertBallroomEvent = z.infer<typeof insertBallroomEventSchema>;

/**
 * Seed a fully-completed test room so every post-game screen is populated.
 * Run with:
 *   pnpm --filter @workspace/scripts exec tsx src/seed-room.ts
 *
 * To wipe the seeded data afterwards:
 *   pnpm --filter @workspace/scripts exec tsx src/seed-room.ts --clean
 */

import { eq, inArray } from "drizzle-orm";
import { db, pool, usersTable, roomsTable, participantsTable, messagesTable, groupMessagesTable, likesTable } from "@workspace/db";

const genId = () =>
  Math.random().toString(36).slice(2, 10) + Math.random().toString(36).slice(2, 10);

// ── Fake personas ──────────────────────────────────────────────────────────
const CHOOSER = {
  id: "test-chooser-01",
  name: "Alex Rivera",
  bio: "Adventure seeker, coffee addict, dog parent.",
  role: "chooser" as const,
};

const SUITORS = [
  { id: "test-suitor-01", name: "Jordan Kim",    bio: "Chef by day, guitarist by night." },
  { id: "test-suitor-02", name: "Morgan Blake",  bio: "World traveller. 34 countries and counting." },
  { id: "test-suitor-03", name: "Taylor Chen",   bio: "Software engineer who actually touches grass." },
  { id: "test-suitor-04", name: "Casey Nguyen",  bio: "Yoga teacher, amateur astronomer." },
  { id: "test-suitor-05", name: "Riley Santos",  bio: "Screenwriter with a thing for old films." },
];

const WINNER = SUITORS[1]; // Morgan Blake wins

// ── Round conversation starters ──────────────────────────────────────────
const ROUND_MSGS: Array<{ senderId: string; senderName: string; senderRole: "chooser" | "suitor"; suitorSlot: number | null; round: number; content: string }> = [];

function addMsg(round: number, senderId: string, senderName: string, senderRole: "chooser" | "suitor", suitorSlot: number | null, content: string) {
  ROUND_MSGS.push({ round, senderId, senderName, senderRole, suitorSlot, content });
}

// Round 1 — icebreakers across all 5 suitors
SUITORS.forEach((s, i) => {
  addMsg(1, CHOOSER.id, CHOOSER.name, "chooser", i + 1, `Hi ${s.name}! What's your idea of a perfect Saturday?`);
  const replies = [
    "Farmers market in the morning, cooking something new for dinner, maybe a long walk after.",
    "I'd start with a long flight somewhere unexpected — ideally landing by noon.",
    "Honestly? A quiet park, some code, then live music in the evening.",
    "Sunrise yoga, then stargazing after dark. Everything in between is a bonus.",
    "Old movie marathon, homemade popcorn. Classics only.",
  ];
  addMsg(1, s.id, s.name, "suitor", i + 1, replies[i]);
});

// Round 2 — deeper with top 3
[SUITORS[0], SUITORS[1], SUITORS[2]].forEach((s, i) => {
  addMsg(2, CHOOSER.id, CHOOSER.name, "chooser", i + 1, `What's something most people don't know about you, ${s.name.split(" ")[0]}?`);
  const replies = [
    "I competed in a national cooking championship at 19. Lost by a single point — best loss of my life.",
    "I spent three months living on a sailboat in the Mediterranean. No wifi, no plan.",
    "I was a semi-pro swimmer before I pivoted to tech. Very different strokes.",
  ];
  addMsg(2, s.id, s.name, "suitor", i + 1, replies[i]);
});

// Round 3 — final 2
[SUITORS[1], SUITORS[2]].forEach((s, i) => {
  addMsg(3, CHOOSER.id, CHOOSER.name, "chooser", i + 1, `Last one — what are you genuinely looking for?`);
  const replies = [
    "Someone who's curious about the world and still finds wonder in ordinary things. Plus, good taste in food helps.",
    "Honestly? A partner who challenges me intellectually but also knows when to just be quiet and watch the sunset.",
  ];
  addMsg(3, s.id, s.name, "suitor", i + 1, replies[i]);
});

// ── Eliminated group chat ────────────────────────────────────────────────
const GROUP_MSGS = [
  { senderId: SUITORS[0].id, senderName: SUITORS[0].name, content: "Well that was fun. No hard feelings!" },
  { senderId: SUITORS[2].id, senderName: SUITORS[2].name, content: "Agreed. Alex asked great questions." },
  { senderId: SUITORS[3].id, senderName: SUITORS[3].name, content: "Round 1 elimination hits different lol" },
  { senderId: SUITORS[4].id, senderName: SUITORS[4].name, content: "Respect the process. Good luck to whoever made it." },
  { senderId: SUITORS[0].id, senderName: SUITORS[0].name, content: "Anyone else think round 2 question was tough?" },
  { senderId: SUITORS[2].id, senderName: SUITORS[2].name, content: "Genuinely didn't see that one coming." },
];

// ── Likes ────────────────────────────────────────────────────────────────
const LIKES = [
  { likerId: SUITORS[1].id, likedId: CHOOSER.id },   // winner liked chooser
  { likerId: SUITORS[0].id, likedId: CHOOSER.id },
  { likerId: CHOOSER.id,    likedId: SUITORS[1].id }, // chooser liked winner back
  { likerId: SUITORS[2].id, likedId: SUITORS[0].id },
];

// ── Main ─────────────────────────────────────────────────────────────────
async function clean() {
  const allUserIds = [CHOOSER.id, ...SUITORS.map((s) => s.id)];
  const roomId = "test-room-completed-01";

  console.log("Cleaning seed data…");
  await db.delete(groupMessagesTable).where(eq(groupMessagesTable.roomId, roomId));
  await db.delete(messagesTable).where(eq(messagesTable.roomId, roomId));
  await db.delete(participantsTable).where(eq(participantsTable.roomId, roomId));
  await db.delete(roomsTable).where(eq(roomsTable.id, roomId));
  await db.delete(likesTable).where(inArray(likesTable.likerId, allUserIds));
  await db.delete(usersTable).where(inArray(usersTable.id, allUserIds));
  console.log("✓ Seed data removed.");
}

async function seed() {
  const roomId = "test-room-completed-01";
  const roomCode = "TEST01";

  console.log("Seeding test room…");

  // Users
  await db.insert(usersTable).values([
    {
      id: CHOOSER.id, name: CHOOSER.name, bio: CHOOSER.bio,
      role: "chooser", status: "looking",
      profilePrompts: [
        { question: "My love language is", answer: "quality time and spontaneous adventures." },
        { question: "A green flag for me is", answer: "someone who's kind to strangers." },
      ],
    },
    ...SUITORS.map((s, i) => ({
      id: s.id, name: s.name, bio: s.bio,
      role: "suitor" as const, status: "looking" as const,
      profilePrompts: [
        { question: "The most spontaneous thing I've done", answer: ["Quit my job to travel for a year.", "Booked a one-way flight on a dare.", "Entered a cooking contest on a whim.", "Signed up for a 10-day silent retreat.", "Wrote a screenplay in 48 hours."][i] },
      ],
    })),
  ]).onConflictDoNothing();

  // Room
  await db.insert(roomsTable).values({
    id: roomId,
    code: roomCode,
    status: "ended",
    chooserName: CHOOSER.name,
    winnerId: WINNER.id,
    winnerName: WINNER.name,
    maxSuitors: 5,
    currentRound: 3,
    eliminatedParticipants: [SUITORS[0].id, SUITORS[2].id, SUITORS[3].id, SUITORS[4].id],
  }).onConflictDoNothing();

  // Participants
  await db.insert(participantsTable).values([
    { id: genId(), roomId, name: CHOOSER.name, role: "chooser", suitorSlot: null },
    ...SUITORS.map((s, i) => ({
      id: genId(), roomId, name: s.name, role: "suitor" as const, suitorSlot: i + 1,
    })),
  ]).onConflictDoNothing();

  // Round messages
  for (const m of ROUND_MSGS) {
    await db.insert(messagesTable).values({
      id: genId(), roomId,
      senderId: m.senderId, senderName: m.senderName,
      senderRole: m.senderRole, suitorSlot: m.suitorSlot,
      round: m.round, content: m.content,
    }).onConflictDoNothing();
  }

  // Group messages (eliminated suitors chat)
  for (const g of GROUP_MSGS) {
    await db.insert(groupMessagesTable).values({
      id: genId(), roomId,
      senderId: g.senderId, senderName: g.senderName,
      content: g.content,
    }).onConflictDoNothing();
  }

  // Likes
  for (const l of LIKES) {
    await db.insert(likesTable).values(l).onConflictDoNothing();
  }

  console.log(`
✓ Seed complete!

Test room code : ${roomCode}
Room ID        : ${roomId}
Winner         : ${WINNER.name}
Chooser        : ${CHOOSER.name}
Suitors        : ${SUITORS.map((s) => s.name).join(", ")}

Open the result page at:
  /result/${roomId}

Use ?participantId=<id> to view as different people:
  Chooser  → /result/${roomId}?participantId=${CHOOSER.id}
  Winner   → /result/${roomId}?participantId=${WINNER.id}
  Loser    → /result/${roomId}?participantId=${SUITORS[0].id}

To clean up: pnpm --filter @workspace/scripts exec tsx src/seed-room.ts --clean
`);
}

const isClean = process.argv.includes("--clean");
(isClean ? clean() : seed()).finally(() => pool.end());

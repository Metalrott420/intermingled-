import { db, usersTable, participantsTable, messagesTable } from "@workspace/db";
import { randomBytes } from "crypto";
import { eq, and } from "drizzle-orm";
import { getIo } from "../socket";
import { SocketEvents } from "../socket/events";

const BOT_QUOTES = [
    "I believe in magic, do you?",
    "Looking for someone to explore the city with.",
    "Coffee or Cocktails? I can't decide.",
    "I have a secret, but I'll only tell it in person.",
    "Life is a puzzle, and I'm looking for the missing piece.",
    "Always up for a spontaneous adventure.",
    "Witty banter is my love language."
];

function makeId() {
  return randomBytes(8).toString("hex");
}

export async function createBotSuitor(roomId: string, slot: number) {
  const id = `bot_${makeId()}`;
  const names = ["Avery", "Jordan", "Taylor", "Morgan", "Casey", "Riley"];
  const name = names[Math.floor(Math.random() * names.length)] + " (Bot)";

  await db.insert(usersTable).values({
    id,
    name,
    role: "suitor",
    status: "matched",
    bio: "Vague and mysterious suitor. Looking for a real connection.",
    photos: [`/bot/avatar_${Math.floor(Math.random()*5)+1}.jpg`],
    personalityVector: [Math.random(), Math.random(), Math.random(), Math.random()]
  });

  const participantId = makeId();
  await db.insert(participantsTable).values({
    id: participantId,
    roomId,
    userId: id,
    name,
    role: "suitor",
    suitorSlot: slot,
    isBot: true
  });

  return { id: participantId, name };
}

export async function simulateBotResponse(roomId: string, suitorId: string, slot: number, question: string) {
    // Artificial delay to simulate typing
    await new Promise(r => setTimeout(r, 2000 + Math.random() * 3000));

    const content = BOT_QUOTES[Math.floor(Math.random() * BOT_QUOTES.length)];
    const id = makeId();
    const now = new Date();

    await db.insert(messagesTable).values({
        id,
        roomId,
        senderId: suitorId,
        senderName: "Suitor " + slot,
        senderRole: "suitor",
        suitorSlot: slot,
        content,
        createdAt: now
    });

    getIo().to(roomId).emit(SocketEvents.MESSAGE_RECEIVED, {
        id,
        roomId,
        senderId: suitorId,
        senderName: "Suitor " + slot,
        senderRole: "suitor",
        suitorSlot: slot,
        content,
        createdAt: now.toISOString()
    });
}

---
name: Bot suitor architecture
description: How AI bot contestants fill empty suitor slots; key design decisions and gotchas.
---

# Bot Suitor Architecture

## The rule
`fillBotsIfNeeded(roomId)` is called after any room creation (POST /rooms and POST /rooms/match). It inserts bot participants for every empty suitor slot up to `maxSuitors`, then sets the room to `active` if it was `waiting`.

## Bot displacement
When a real suitor calls POST /rooms/:id/join on an already-active room, the handler checks for `botSuitors`. If found, it deletes the bot participant and inserts the real user in that same suitorSlot. This keeps the total suitor count constant.

## Bot auto-response
After a chooser's `send_message` event, `generateBotResponse()` is fired async (no await) for any bot at the addressed suitorSlot. Uses Anthropic claude-haiku-4-5 via `AI_INTEGRATIONS_ANTHROPIC_BASE_URL` + `AI_INTEGRATIONS_ANTHROPIC_API_KEY`. Falls back to 5 canned lines if AI unavailable.

## No-winner guard
POST /rooms/:id/eliminate checks after each elimination whether all remaining active suitors have `isBot=true`. If so, it ends the room immediately without a winner (no match record).

## Chooser message suitorSlot fix
The `send_message` socket handler previously always used `participant.suitorSlot` (null for choosers), breaking per-tab message display. Now chooser messages use the client-supplied `suitorSlot` (resolvedSlot). This is safe because choosers are authenticated and the slot value only affects message routing.

**Why:** Chooser messages need suitorSlot set to the addressed tab slot so `messages.filter(m => m.suitorSlot === slot)` works in the chooser UI.

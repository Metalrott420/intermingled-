import { randomBytes } from "crypto";

export function makeId(): string {
  return randomBytes(8).toString("hex");
}

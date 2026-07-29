const activeSuitorPool = new Set<string>();

export function isUserInPool(userId: string): boolean {
  return activeSuitorPool.has(userId);
}

export function getPoolCount(): number {
  return activeSuitorPool.size;
}

export function getAllPoolUserIds(): string[] {
  return [...activeSuitorPool];
}

export function addUserToPool(userId: string): void {
  activeSuitorPool.add(userId);
}

export function removeUserFromPool(userId: string): void {
  activeSuitorPool.delete(userId);
}

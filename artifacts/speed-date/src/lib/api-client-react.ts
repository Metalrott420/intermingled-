import { useQuery, useMutation } from "@tanstack/react-query";

export interface Message {
  id: string;
  roomId: string;
  userId: string;
  userName: string;
  content: string;
  createdAt: string;
}

export interface MatchResult {
  id: string;
  roomId: string;
  chooserUserId: string;
  suitorUserId: string;
  chooserName: string;
  suitorName: string;
}

export interface PlayerStats {
  winPercentage: number;
  matchPercentage: number;
  gamesPlayed: number;
  gamesWon: number;
  streaks: {
    currentWinStreak: number;
    maxWinStreak: number;
  };
}

export interface PlayerAchievement {
  id: string;
  title: string;
  description: string;
  unlocked: boolean;
  unlockedAt?: string;
  icon?: string;
}

export const GetHistoryMatchStatus = {
  WIN: "win",
  MATCH: "match",
  LOSS: "loss",
  ALL: "all",
} as const;
export type GetHistoryMatchStatus = typeof GetHistoryMatchStatus[keyof typeof GetHistoryMatchStatus];

export interface QuestionGroupPerformanceSnapshot {
  groupId: string;
  category: string;
  count: number;
}

export interface QuestionPerformanceSnapshot {
  questionId: string;
  questionText: string;
  score: number;
}

export interface QuestionTrendPoint {
  date: string;
  score: number;
}

export interface QuestionIntelligenceDashboard {
  overview: {
    totalQuestions: number;
    activeQuestions: number;
  };
  groupSnapshots: QuestionGroupPerformanceSnapshot[];
  topQuestions: QuestionPerformanceSnapshot[];
  bottomQuestions: QuestionPerformanceSnapshot[];
  trends: QuestionTrendPoint[];
}

export interface GuardianDashboard {
  overview: {
    activeRoomsCount: number;
    flaggedContentCount: number;
    bannedUsersCount: number;
  };
}

export function getGetRoomQueryKey(roomId: string) {
  return ["/api/rooms", roomId];
}

export function getGetRoomMessagesQueryKey(roomId: string) {
  return ["/api/rooms", roomId, "messages"];
}

export function getGetPlayerStatsQueryKey(userId: string) {
  return ["/api/players", userId, "stats"];
}

export function getGetPlayerAchievementsQueryKey(userId: string) {
  return ["/api/players", userId, "achievements"];
}

export function getGetHistoryQueryKey(params?: any) {
  return ["/api/history", params];
}

export function getGetHistoryGameQueryKey(gameId: string) {
  return ["/api/history/games", gameId];
}

export function getGetHistoryReplayQueryKey(gameId: string) {
  return ["/api/history/games", gameId, "replay"];
}

export function getGetAdminQuestionAnalyticsQueryKey() {
  return ["/api/admin/question-analytics"];
}

export function getGetAdminGuardianQueryKey() {
  return ["/api/admin/guardian"];
}

export function useGetRoom(roomId: string, options?: any) {
  return useQuery({
    queryKey: getGetRoomQueryKey(roomId),
    queryFn: async () => {
      if (!roomId) throw new Error("No room ID");
      const res = await fetch(`/api/rooms/${roomId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch room");
      return res.json();
    },
    enabled: Boolean(roomId),
    ...(options?.query || {}),
  });
}

export function useGetRoomMessages(roomId: string, options?: any) {
  return useQuery<Message[]>({
    queryKey: getGetRoomMessagesQueryKey(roomId),
    queryFn: async () => {
      if (!roomId) throw new Error("No room ID");
      const res = await fetch(`/api/rooms/${roomId}/messages`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch messages");
      return res.json();
    },
    enabled: Boolean(roomId),
    ...(options?.query || {}),
  });
}

export function useChooseWinner(options?: any) {
  return useMutation({
    mutationFn: async ({ roomId, suitorUserId }: { roomId: string; suitorUserId: string }) => {
      const res = await fetch(`/api/rooms/${roomId}/choose`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ suitorUserId }),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to choose winner");
      return res.json();
    },
    ...options,
  });
}

export function useMatchRoom(options?: any) {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/rooms/match", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to match room");
      return res.json();
    },
    ...options,
  });
}

export function useGetPlayerStats(userId: string, options?: any) {
  return useQuery<PlayerStats>({
    queryKey: getGetPlayerStatsQueryKey(userId),
    queryFn: async () => {
      if (!userId) throw new Error("No user ID");
      const res = await fetch(`/api/players/${userId}/stats`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch stats");
      return res.json();
    },
    enabled: Boolean(userId),
    ...(options?.query || {}),
  });
}

export function useGetPlayerAchievements(userId: string, options?: any) {
  return useQuery<{ achievements: PlayerAchievement[] }>({
    queryKey: getGetPlayerAchievementsQueryKey(userId),
    queryFn: async () => {
      if (!userId) throw new Error("No user ID");
      const res = await fetch(`/api/players/${userId}/achievements`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch achievements");
      return res.json();
    },
    enabled: Boolean(userId),
    ...(options?.query || {}),
  });
}

export function useGetHistory(params?: any, options?: any) {
  return useQuery({
    queryKey: getGetHistoryQueryKey(params),
    queryFn: async () => {
      const searchParams = new URLSearchParams(params).toString();
      const res = await fetch(`/api/history?${searchParams}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json();
    },
    ...(options || {}),
  });
}

export function useGetHistoryGame(gameId: string, options?: any) {
  return useQuery({
    queryKey: getGetHistoryGameQueryKey(gameId),
    queryFn: async () => {
      if (!gameId) throw new Error("No game ID");
      const res = await fetch(`/api/history/games/${gameId}`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history game");
      return res.json();
    },
    enabled: Boolean(gameId),
    ...(options || {}),
  });
}

export function useGetHistoryReplay(gameId: string, options?: any) {
  return useQuery({
    queryKey: getGetHistoryReplayQueryKey(gameId),
    queryFn: async () => {
      if (!gameId) throw new Error("No game ID");
      const res = await fetch(`/api/history/games/${gameId}/replay`, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch history replay");
      return res.json();
    },
    enabled: Boolean(gameId),
    ...(options || {}),
  });
}

export function useGetAdminQuestionAnalytics(options?: any) {
  return useQuery<QuestionIntelligenceDashboard>({
    queryKey: getGetAdminQuestionAnalyticsQueryKey(),
    queryFn: async () => {
      const res = await fetch("/api/admin/question-analytics", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch admin question analytics");
      return res.json();
    },
    ...(options || {}),
  });
}

export function useGetAdminGuardian(options?: any) {
  return useQuery<GuardianDashboard>({
    queryKey: getGetAdminGuardianQueryKey(),
    queryFn: async () => {
      const res = await fetch("/api/admin/guardian", { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch admin guardian");
      return res.json();
    },
    ...(options || {}),
  });
}

export function useCreateUser(options?: any) {
  return useMutation({
    mutationFn: async (data: any) => {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to create user");
      return res.json();
    },
    ...options,
  });
}

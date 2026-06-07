import AsyncStorage from "@react-native-async-storage/async-storage";
import React, { createContext, useContext, useEffect, useState } from "react";

interface AppUser {
  userId: string;
  name: string;
  role: "chooser" | "suitor";
  personalityVector: number[];
}

interface AppContextValue {
  user: AppUser | null;
  setUser: (u: AppUser) => void;
  clearUser: () => void;
  getParticipantId: (roomId: string) => Promise<string | null>;
  setParticipantId: (roomId: string, participantId: string) => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

const STORAGE_KEY = "flirtfest_user";

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [user, setUserState] = useState<AppUser | null>(null);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((val) => {
      if (val) {
        try {
          setUserState(JSON.parse(val));
        } catch {}
      }
    });
  }, []);

  const setUser = (u: AppUser) => {
    setUserState(u);
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(u));
  };

  const clearUser = () => {
    setUserState(null);
    AsyncStorage.removeItem(STORAGE_KEY);
  };

  const getParticipantId = (roomId: string) =>
    AsyncStorage.getItem(`participantId_${roomId}`);

  const setParticipantId = (roomId: string, participantId: string) =>
    AsyncStorage.setItem(`participantId_${roomId}`, participantId);

  return (
    <AppContext.Provider value={{ user, setUser, clearUser, getParticipantId, setParticipantId }}>
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used inside AppProvider");
  return ctx;
}

import React, { createContext, useContext } from "react";
import { Platform } from "react-native";
import Purchases from "react-native-purchases";
import { useMutation, useQuery } from "@tanstack/react-query";
import Constants from "expo-constants";
import { useAuth } from "@clerk/expo";

const REVENUECAT_TEST_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_TEST_API_KEY;
const REVENUECAT_IOS_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_IOS_API_KEY;
const REVENUECAT_ANDROID_API_KEY = process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY;

export const REVENUECAT_ENTITLEMENT_IDENTIFIER = "premium";

export const isRevenueCatConfigured =
  Boolean(REVENUECAT_TEST_API_KEY) &&
  Boolean(REVENUECAT_IOS_API_KEY) &&
  Boolean(REVENUECAT_ANDROID_API_KEY);

function getRevenueCatApiKey(): string | null {
  if (!isRevenueCatConfigured) {
    return null;
  }

  if (
    __DEV__ ||
    Platform.OS === "web" ||
    Constants.executionEnvironment === "storeClient"
  ) {
    return REVENUECAT_TEST_API_KEY!;
  }

  if (Platform.OS === "ios") {
    return REVENUECAT_IOS_API_KEY!;
  }

  if (Platform.OS === "android") {
    return REVENUECAT_ANDROID_API_KEY!;
  }

  return REVENUECAT_TEST_API_KEY!;
}

export function initializeRevenueCat(clerkUserId?: string) {
  const apiKey = getRevenueCatApiKey();
  if (!apiKey) {
    console.warn("[RevenueCat] API keys not configured — subscriptions disabled.");
    return;
  }

  Purchases.setLogLevel(Purchases.LOG_LEVEL.DEBUG);
  Purchases.configure({ apiKey });

  if (clerkUserId) {
    Purchases.logIn(clerkUserId).catch(() => {});
  }
}

const API_BASE = process.env.EXPO_PUBLIC_DOMAIN
  ? `https://${process.env.EXPO_PUBLIC_DOMAIN}/api`
  : "/api";

async function syncPremiumWithServer(getToken: () => Promise<string | null>) {
  try {
    const token = await getToken();
    if (!token) return;
    const resp = await fetch(`${API_BASE}/entitlement/premium/sync`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!resp.ok) {
      console.warn("[RevenueCat] Premium sync failed with status", resp.status);
    }
  } catch (err) {
    console.warn("[RevenueCat] Premium sync request error", err);
  }
}

function useSubscriptionContext() {
  const { getToken } = useAuth();

  const customerInfoQuery = useQuery({
    queryKey: ["revenuecat", "customer-info"],
    queryFn: async () => {
      const info = await Purchases.getCustomerInfo();
      return info;
    },
    staleTime: 60 * 1000,
    enabled: isRevenueCatConfigured,
  });

  const offeringsQuery = useQuery({
    queryKey: ["revenuecat", "offerings"],
    queryFn: async () => {
      const offerings = await Purchases.getOfferings();
      return offerings;
    },
    staleTime: 300 * 1000,
    enabled: isRevenueCatConfigured,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (packageToPurchase: Parameters<typeof Purchases.purchasePackage>[0]) => {
      const { customerInfo } = await Purchases.purchasePackage(packageToPurchase);
      return customerInfo;
    },
    onSuccess: () => {
      customerInfoQuery.refetch();
      syncPremiumWithServer(getToken);
    },
  });

  const restoreMutation = useMutation({
    mutationFn: async () => {
      return Purchases.restorePurchases();
    },
    onSuccess: () => {
      customerInfoQuery.refetch();
      syncPremiumWithServer(getToken);
    },
  });

  const isSubscribed =
    customerInfoQuery.data?.entitlements.active?.[REVENUECAT_ENTITLEMENT_IDENTIFIER] !== undefined;

  return {
    customerInfo: customerInfoQuery.data,
    offerings: offeringsQuery.data,
    isSubscribed,
    isLoading: isRevenueCatConfigured
      ? customerInfoQuery.isLoading || offeringsQuery.isLoading
      : false,
    purchase: purchaseMutation.mutateAsync,
    restore: restoreMutation.mutateAsync,
    isPurchasing: purchaseMutation.isPending,
    isRestoring: restoreMutation.isPending,
    error: purchaseMutation.error,
  };
}

type SubscriptionContextValue = ReturnType<typeof useSubscriptionContext>;
const Context = createContext<SubscriptionContextValue | null>(null);

export function SubscriptionProvider({ children }: { children: React.ReactNode }) {
  const value = useSubscriptionContext();
  return <Context.Provider value={value}>{children}</Context.Provider>;
}

export function useSubscription() {
  const ctx = useContext(Context);
  if (!ctx) {
    throw new Error("useSubscription must be used within a SubscriptionProvider");
  }
  return ctx;
}

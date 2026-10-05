import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { shadcn } from "@clerk/themes";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";
import Home from "@/pages/home";
import Pool from "@/pages/pool";
import Match from "@/pages/match";
import RoomChooser from "@/pages/room-chooser";
import RoomSuitor from "@/pages/room-suitor";
import Result from "@/pages/result";
import Subscribe from "@/pages/subscribe";
import SubscribeSuccess from "@/pages/subscribe-success";
import ProfilePage from "@/pages/profile";
import InboxPage from "@/pages/inbox";
import ConversationPage from "@/pages/conversation";
import WhoLikedMe from "@/pages/who-liked-me";
import HistoryPage from "@/pages/history";
import HistoryGamePage from "@/pages/history-game";
import InsightsPage from "@/pages/insights";
import PrivacyPolicy from "@/pages/privacy";
import TermsOfService from "@/pages/terms";
import AdminPage from "@/pages/admin";
import VerifyAgeResult from "@/pages/verify-age-result";
import SafetyPage from "@/pages/safety";
import { MapPin, MessageSquare, Heart, Shield, User as UserIcon, Sparkles, Home as HomeIcon } from "lucide-react";

const queryClient = new QueryClient();

const hostForClerk = typeof window !== "undefined" ? window.location.hostname.replace(/^www\./, "") : "";

const clerkPubKey =
  (import.meta.env.VITE_CLERK_PUBLISHABLE_KEY ||
  "pk_test_aGVscGZ1bC1ib2FyLTk4LmNsZXJrLmFjY291bnRzLmRldiQ").trim();

const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) {
  throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");
}

const clerkAppearance = {
  theme: shadcn,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "#9333ea",
    colorForeground: "#f3f4f8",
    colorMutedForeground: "#6b7280",
    colorDanger: "#ec4899",
    colorBackground: "#080a10",
    colorInput: "#12141e",
    colorInputForeground: "#f3f4f8",
    colorNeutral: "#1a1c2a",
    fontFamily: "Barlow, Inter, system-ui, sans-serif",
    borderRadius: "0.625rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111318] border border-[#1e2230] rounded-xl w-[440px] max-w-full overflow-hidden shadow-xl",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-[#f0f1f5] font-bold",
    headerSubtitle: "text-[#7d8899]",
    socialButtonsBlockButtonText: "text-[#f0f1f5]",
    formFieldLabel: "text-[#7d8899] text-sm",
    footerActionLink: "text-[#8b5cf6] hover:text-[#a78bfa]",
    footerActionText: "text-[#7d8899]",
    dividerText: "text-[#7d8899]",
    identityPreviewEditButton: "text-[#8b5cf6]",
    formFieldSuccessText: "text-[#2bbfa8]",
    alertText: "text-[#f0f1f5]",
    logoBox: "flex justify-center mb-2",
    logoImage: "h-8",
    socialButtonsBlockButton: "border-[#1e2230] bg-[#181b24] hover:bg-[#1e2230]",
    formButtonPrimary: "bg-[#8b5cf6] hover:bg-[#7c3aed] text-white",
    formFieldInput: "bg-[#181b24] border-[#1e2230] text-[#f0f1f5]",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#1e2230]",
    alert: "bg-[#181b24] border-[#1e2230]",
    otpCodeFieldInput: "bg-[#181b24] border-[#1e2230] text-[#f0f1f5]",
    formFieldRow: "",
    main: "",
  },
};

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
    </div>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { user, isLoaded } = useUser();
  const qc = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    if (!isLoaded) return;
    const userId = user?.id ?? null;
    if (prevUserIdRef.current !== undefined && prevUserIdRef.current !== userId) {
      // Defer query cache invalidation to next macro-tick so React completes current render pass
      setTimeout(() => {
        qc.clear();
      }, 0);
    }
    prevUserIdRef.current = userId;
  }, [user?.id, isLoaded, qc]);

  return null;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/pool" component={Pool} />
      <Route path="/map" component={Pool} />
      <Route path="/match" component={Match} />
      <Route path="/room/:id/chooser" component={RoomChooser} />
      <Route path="/room/:id/suitor" component={RoomSuitor} />
      <Route path="/result/:id" component={Result} />
      <Route path="/subscribe" component={Subscribe} />
      <Route path="/subscribe/success" component={SubscribeSuccess} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/inbox" component={InboxPage} />
      <Route path="/conversation/:matchId" component={ConversationPage} />
      <Route path="/who-liked-me" component={WhoLikedMe} />
      <Route path="/history" component={HistoryPage} />
      <Route path="/history/:gameId" component={HistoryGamePage} />
      <Route path="/insights" component={InsightsPage} />
      <Route path="/safety" component={SafetyPage} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/verify-age/result" component={VerifyAgeResult} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
  );
}

function GlobalGoldNavbar() {
  const [location, setLocation] = useLocation();

  if (location.startsWith("/sign-in") || location.startsWith("/sign-up") || location.startsWith("/room")) {
    return null;
  }

  const navItems = [
    { label: "Home", path: "/", icon: HomeIcon },
    { label: "Map", path: "/map", icon: MapPin },
    { label: "Pool", path: "/pool", icon: Sparkles },
    { label: "Inbox", path: "/inbox", icon: MessageSquare },
    { label: "Likes", path: "/who-liked-me", icon: Heart },
    { label: "Safety", path: "/safety", icon: Shield },
    { label: "Profile", path: "/profile", icon: UserIcon },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-40 bg-[#0c0d14]/95 backdrop-blur-lg border-t border-[#d4af37]/30 px-2 py-2 flex items-center justify-around shadow-2xl">
      {navItems.map((item) => {
        const Icon = item.icon;
        const isActive = location === item.path;
        return (
          <button
            key={item.path}
            onClick={() => setLocation(item.path)}
            className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-xl transition-all ${
              isActive
                ? "bg-[#d4af37] text-[#08080c] font-black scale-105 shadow-md shadow-[#d4af37]/20"
                : "text-muted-foreground hover:text-white"
            }`}
          >
            <Icon size={18} />
            <span className="text-[10px] font-mono tracking-wider uppercase">{item.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      localization={{
        signIn: {
          start: {
            title: "Welcome back",
            subtitle: "Sign in to your Intermingled account",
          },
        },
        signUp: {
          start: {
            title: "Create your account",
            subtitle: "Join Intermingled and find your match",
          },
        },
      }}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRoutes />
          <GlobalGoldNavbar />
          <Toaster />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <ClerkProviderWithRoutes />
    </WouterRouter>
  );
}

export default App;

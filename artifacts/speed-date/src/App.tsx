import { useEffect, useRef } from "react";
import { ClerkProvider, ClerkLoaded, ClerkLoading, SignIn, SignUp, Show, useClerk, useUser } from "@clerk/react";
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
import Lobby from "@/pages/lobby";
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
    colorPrimary: "#d4af37",
    colorForeground: "#ffffff",
    colorMutedForeground: "#94a3b8",
    colorDanger: "#ef4444",
    colorBackground: "#111218",
    colorInput: "#181a24",
    colorInputForeground: "#ffffff",
    colorNeutral: "#1f2232",
    fontFamily: "'Plus Jakarta Sans', Inter, system-ui, sans-serif",
    borderRadius: "1rem",
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-[#111218]/95 backdrop-blur-2xl border-2 border-[#d4af37]/50 rounded-2xl w-[460px] max-w-full overflow-hidden shadow-[0_0_60px_rgba(212,175,55,0.3)]",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none p-6",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-gold-hd-3d font-display font-black text-2xl uppercase tracking-widest",
    headerSubtitle: "text-slate-300 text-xs font-sans uppercase tracking-wider font-medium",
    socialButtonsBlockButtonText: "text-white font-bold text-xs uppercase tracking-wider",
    formFieldLabel: "text-[#d4af37] text-xs font-mono uppercase tracking-wider font-bold",
    footerActionLink: "text-[#d4af37] hover:text-[#f59e0b] font-black uppercase text-xs tracking-wider",
    footerActionText: "text-slate-400 text-xs font-mono",
    dividerText: "text-[#d4af37] text-[10px] font-mono uppercase tracking-widest",
    identityPreviewEditButton: "text-[#d4af37]",
    formFieldSuccessText: "text-emerald-400",
    alertText: "text-white",
    logoBox: "flex justify-center mb-3",
    logoImage: "h-12 w-auto filter drop-shadow-[0_0_15px_rgba(212,175,55,0.5)]",
    socialButtonsBlockButton: "border-[#2d3142] bg-[#181a24] hover:bg-[#222536] text-white rounded-xl shadow-md",
    formButtonPrimary: "bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase tracking-wider text-xs py-3.5 rounded-xl shadow-lg shadow-[#d4af37]/25 transition-all hover:scale-[1.01]",
    formFieldInput: "bg-[#181a24] border-[#2d3142] text-white focus:border-[#d4af37] focus:ring-2 focus:ring-[#d4af37]/30 rounded-xl h-11 text-sm",
    footerAction: "bg-transparent",
    dividerLine: "bg-[#2d3142]",
    alert: "bg-[#181a24] border-[#2d3142]",
    otpCodeFieldInput: "bg-[#181a24] border-[#2d3142] text-white rounded-xl focus:border-[#d4af37]",
    formFieldRow: "",
    main: "",
  },
};

function AuthHeroHeader() {
  return (
    <div className="text-center space-y-3 flex flex-col items-center mb-6">
      <img
        src="/logo.svg"
        alt="Intermingled Logo"
        className="h-24 w-auto filter drop-shadow-[0_0_25px_rgba(212,175,55,0.6)] animate-pulse"
      />
      <h1 className="text-4xl md:text-5xl font-black uppercase tracking-widest text-gold-hd-3d">
        INTERMINGLED
      </h1>
      <p className="text-xs md:text-sm font-sans text-[#e5c158] uppercase tracking-widest font-extrabold max-w-md leading-relaxed">
        5 ROUNDS · 2 WINNERS · 1 PERFECT MATCH
        <span className="block text-[11px] text-slate-300 tracking-wider font-semibold mt-1">FIND THE ONE WHO COMPLETES YOU</span>
      </p>
    </div>
  );
}

function SignInPage() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-[#08080c] text-foreground relative overflow-y-auto py-12">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(212,175,55,0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="z-10 w-full max-w-md flex flex-col items-center">
        <AuthHeroHeader />
        <SignIn routing="path" path={`${basePath}/sign-in`} signUpUrl={`${basePath}/sign-up`} />
      </div>
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center p-4 bg-[#08080c] text-foreground relative overflow-y-auto py-12">
      <div className="absolute inset-0 z-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_0%,rgba(212,175,55,0.15)_0%,transparent_70%)] pointer-events-none" />
      <div className="z-10 w-full max-w-md flex flex-col items-center">
        <AuthHeroHeader />
        <SignUp routing="path" path={`${basePath}/sign-up`} signInUrl={`${basePath}/sign-in`} />
      </div>
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

function ClientHeartbeatPingTracker() {
  const { user, isLoaded } = useUser();

  useEffect(() => {
    if (!isLoaded || !user) return;

    const sendPing = () => {
      const uId = user.id;
      const uName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "Dater";
      const uEmail = user.primaryEmailAddress?.emailAddress || "";

      fetch(`/api/ping?userId=${encodeURIComponent(uId)}&name=${encodeURIComponent(uName)}&email=${encodeURIComponent(uEmail)}`, {
        credentials: "include",
      }).catch(() => {});
    };

    sendPing();
    const interval = setInterval(sendPing, 30000);
    return () => clearInterval(interval);
  }, [user, isLoaded]);

  return null;
}

function AppRoutes() {
  return (
    <>
      <ClientHeartbeatPingTracker />
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
      <Route path="/lobby" component={Lobby} />
      <Route path="/admin" component={AdminPage} />
      <Route path="/privacy" component={PrivacyPolicy} />
      <Route path="/terms" component={TermsOfService} />
      <Route path="/verify-age/result" component={VerifyAgeResult} />
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
      <Route component={NotFound} />
    </Switch>
    </>
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
    { label: "MATCH", path: "/match", icon: Sparkles },
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
            aria-label={`Navigate to ${item.label}`}
            aria-current={isActive ? "page" : undefined}
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
      domain="helpful-boar-98.clerk.accounts.dev"
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
          <ClerkLoading>
            <div className="min-h-[100dvh] w-full flex flex-col items-center justify-center bg-[#08080c] text-[#d4af37]">
              <div className="w-10 h-10 border-2 border-[#d4af37] border-t-transparent rounded-full animate-spin mb-4" />
              <p className="text-xs font-mono uppercase tracking-widest font-bold">Connecting Intermingled Security...</p>
            </div>
          </ClerkLoading>
          <ClerkLoaded>
            <AppRoutes />
            <GlobalGoldNavbar />
            <Toaster />
          </ClerkLoaded>
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

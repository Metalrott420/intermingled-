import { useEffect, useRef, useState } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./AuthContext";
import { Heart, MessageCircle, User, Zap, Map as MapIcon, Calendar, Home as HomeIcon, Crown } from "lucide-react";
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
import PrivacyPolicy from "@/pages/privacy";
import TermsOfService from "@/pages/terms";
import AdminPage from "@/pages/admin";
import VerifyAgeResult from "@/pages/verify-age-result";
import MapPage from "@/pages/map";
import EventsPage from "@/pages/events";
import OrganizerDashboard from "@/pages/organizer";
import SafetyPage from "@/pages/safety";
import OverlordDashboard from "@/pages/overlord";
import FriendsPage from "@/pages/friends";

import logo from "./assets/logo.png";

import { setAuthTokenGetter } from "@workspace/api-client-react";

const queryClient = new QueryClient();

setAuthTokenGetter(() => {
    return localStorage.getItem("intermingled_auth_token");
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function TabBar() {
  const [location, setLocation] = useLocation();
  const { user } = useAuth();
  if (!user) return null;

  const tabs = [
    { path: "/", icon: HomeIcon, label: "Home" },
    { path: "/map", icon: MapIcon, label: "Map" },
    { path: "/friends", icon: Heart, label: "Circle" },
    { path: "/match", icon: Zap, label: "Match" },
    { path: "/inbox", icon: MessageCircle, label: "Chat" },
    { path: "/profile", icon: User, label: "Me" },
  ];

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 bg-black/80 backdrop-blur-xl border-t border-white/5 px-4 pb-8 pt-3 flex justify-between items-center max-w-lg mx-auto rounded-t-[2.5rem] shadow-[0_-20px_50px_rgba(0,0,0,0.5)]">
      {tabs.map(tab => {
        const isActive = location === tab.path;
        return (
          <button
            key={tab.path}
            onClick={() => setLocation(tab.path)}
            className={`flex flex-col items-center gap-1 transition-all flex-1 ${isActive ? "text-primary scale-110" : "text-muted-foreground hover:text-white"}`}
          >
            <div className={`p-2 rounded-2xl transition-all ${isActive ? "bg-primary/10 shadow-[0_0_15px_rgba(212,175,55,0.2)]" : "bg-transparent"}`}>
                <tab.icon size={isActive ? 22 : 18} strokeWidth={isActive ? 3 : 2} />
            </div>
            <span className="text-[7px] font-black uppercase tracking-widest leading-none">{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

function SignInPage() {
  const { signIn, signUp, bypassLogin } = useAuth();
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const logoClicks = useRef(0);

  const handleLogoClick = () => {
    logoClicks.current += 1;
    if (logoClicks.current >= 3) {
      console.log("[Developer Shortcut] Bypassing login...");
      bypassLogin();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, name);
        await signIn(email, password);
      } else {
        await signIn(email, password);
      }
      window.location.href = "/";
    } catch (err: any) {
      setError(err.message || "Authentication failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-4 relative overflow-hidden">
      <div className="absolute top-[-20%] left-[-20%] w-[80%] h-[80%] bg-primary/10 rounded-full blur-[120px] animate-pulse" />
      <div className="absolute bottom-[-20%] right-[-20%] w-[80%] h-[80%] bg-secondary/10 rounded-full blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />

      <div className="z-10 text-center space-y-8 w-full max-w-sm">
          <div className="space-y-4 flex flex-col items-center">
            <img
              src={logo}
              onClick={handleLogoClick}
              className="w-24 h-24 object-contain drop-shadow-[0_0_30px_rgba(212,175,55,0.4)] cursor-pointer transition-transform hover:scale-105"
              alt="Intermingled Logo (Triple-click for dev bypass)"
            />
            <div className="space-y-1">
                <h1 className="text-4xl font-black text-white tracking-[-0.05em] uppercase italic leading-none">INTERMINGLED</h1>
                <p className="text-primary font-mono text-[10px] uppercase tracking-[0.5em]">Premium Speed Dating</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4 bg-zinc-900/80 border border-white/10 p-6 rounded-3xl backdrop-blur-xl shadow-2xl">
            <h2 className="text-xl font-black uppercase text-white tracking-wider">{isSignUp ? "Create Account" : "Welcome Back"}</h2>

            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl font-medium">
                {error}
              </div>
            )}

            {isSignUp && (
              <input
                type="text"
                placeholder="Full Name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm"
              />
            )}

            <input
              type="email"
              placeholder="Email address"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm"
            />

            <input
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm"
            />

            <button
              type="submit"
              disabled={loading}
              className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_hsl(var(--primary)/0.3)] cursor-pointer disabled:opacity-50"
            >
              {loading ? "Processing..." : isSignUp ? "Sign Up" : "Sign In"}
            </button>

            <div className="pt-2">
              <button
                type="button"
                onClick={() => setIsSignUp(!isSignUp)}
                className="text-xs text-muted-foreground hover:text-white transition-colors"
              >
                {isSignUp ? "Already have an account? Sign In" : "Need an account? Sign Up"}
              </button>
            </div>
          </form>
      </div>
    </div>
  );
}

function AppRoutes() {
  const { user, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-black">
        <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin shadow-[0_0_30px_rgba(212,175,55,0.2)]" />
      </div>
    );
  }

  return (
    <Switch>
      {user ? (
        <>
          <Route path="/" component={Home} />
          <Route path="/map" component={MapPage} />
          <Route path="/friends" component={FriendsPage} />
          <Route path="/overlord" component={OverlordDashboard} />
          <Route path="/organizer" component={OrganizerDashboard} />
          <Route path="/events" component={EventsPage} />
          <Route path="/pool" component={Pool} />
          <Route path="/match" component={Match} />
          <Route path="/room/:id/chooser" component={RoomChooser} />
          <Route path="/room/:id/suitor" component={RoomSuitor} />
          <Route path="/result/:id" component={Result} />
          <Route path="/subscribe" component={Subscribe} />
          <Route path="/subscribe/success" component={SubscribeSuccess} />
          <Route path="/profile" component={ProfilePage} />
          <Route path="/safety" component={SafetyPage} />
          <Route path="/inbox" component={InboxPage} />
          <Route path="/conversation/:matchId" component={ConversationPage} />
          <Route path="/who-liked-me" component={WhoLikedMe} />
          <Route path="/admin" component={AdminPage} />
          <Route path="/privacy" component={PrivacyPolicy} />
          <Route path="/terms" component={TermsOfService} />
          <Route path="/verify-age/result" component={VerifyAgeResult} />
          <Route path="/sign-in"><Redirect to="/" /></Route>
          <Route path="/sign-up"><Redirect to="/" /></Route>
        </>
      ) : (
        <>
          <Route path="/sign-in" component={SignInPage} />
          <Route path="/sign-up" component={SignInPage} />
          <Route><Redirect to="/sign-in" /></Route>
        </>
      )}
      <Route component={NotFound} />
    </Switch>
  );
}

function App() {
  return (
    <WouterRouter base={basePath}>
      <AuthProvider>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider>
            <div className="min-h-[100dvh] bg-black selection:bg-primary/30">
                <AppRoutes />
                <TabBar />
            </div>
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </AuthProvider>
    </WouterRouter>
  );
}

export default App;

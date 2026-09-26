import { useEffect, useRef, useState } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider, useAuth } from "./AuthContext";
import { Heart, MessageCircle, User, Zap, Map as MapIcon, Calendar, Home as HomeIcon, Crown, Mail, Shield } from "lucide-react";
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
  const [ageVerified, setAgeVerified] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const logoClicks = useRef(0);

  const handleLogoClick = () => {
    if (import.meta.env.MODE !== "development") return;
    logoClicks.current += 1;
    if (logoClicks.current >= 3) {
      console.log("[Developer Shortcut] Bypassing login...");
      bypassLogin();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setSuccessMessage("");
    if (isSignUp && (!ageVerified || !termsAccepted)) {
      setError("You must confirm you are 18+ and accept the Terms & Privacy Policy.");
      return;
    }
    setLoading(true);
    try {
      if (isSignUp) {
        await signUp(email, password, name, ageVerified, termsAccepted);
        setSuccessMessage("Account created! Please check your email to activate your account, then sign in.");
        setIsSignUp(false);
      } else {
        await signIn(email, password);
        window.location.href = "/";
      }
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

            {successMessage && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl font-medium">
                {successMessage}
              </div>
            )}

            {isSignUp && (
              <div className="space-y-3 text-left pt-2">
                <input
                  type="text"
                  placeholder="Full Name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  className="w-full bg-black/50 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-muted-foreground focus:outline-none focus:border-primary text-sm"
                />
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={ageVerified}
                    onChange={(e) => setAgeVerified(e.target.checked)}
                    required
                    className="rounded border-white/20 bg-black text-primary focus:ring-0"
                  />
                  <span>I am 18 years of age or older</span>
                </label>
                <label className="flex items-center gap-2 text-xs text-zinc-400 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    required
                    className="rounded border-white/20 bg-black text-primary focus:ring-0"
                  />
                  <span>I accept the Terms of Service & Privacy Policy</span>
                </label>
              </div>
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

function EmailVerificationGate({ user }: { user: any }) {
  const { resendVerificationEmail, refreshUser, signOut } = useAuth();
  const [resending, setResending] = useState(false);
  const [msg, setMsg] = useState("");
  const [err, setErr] = useState("");

  const handleResend = async () => {
    setResending(true);
    setMsg("");
    setErr("");
    try {
      await resendVerificationEmail(user.email);
      setMsg("Verification email sent! Please check your inbox and spam folder.");
    } catch (e: any) {
      setErr(e.message || "Failed to resend verification email.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-4 relative overflow-hidden text-white text-center">
      <div className="z-10 max-w-md w-full bg-zinc-900/90 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center mx-auto text-primary">
          <Mail size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase italic tracking-wider text-white">Email Verification Required</h2>
          <p className="text-xs text-zinc-400">
            We sent a confirmation link to <strong className="text-primary">{user?.email}</strong>. Please confirm your email address to unlock Intermingled.
          </p>
        </div>

        {msg && <div className="bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 text-xs p-3 rounded-xl">{msg}</div>}
        {err && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">{err}</div>}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleResend}
            disabled={resending}
            className="w-full py-4 bg-primary text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_hsl(var(--primary)/0.3)] cursor-pointer disabled:opacity-50"
          >
            {resending ? "Sending..." : "Resend Verification Email"}
          </button>

          <button
            onClick={() => refreshUser()}
            className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            I Confirmed — Refresh Status
          </button>

          <button
            onClick={signOut}
            className="text-xs text-zinc-500 hover:text-white transition-colors pt-2"
          >
            Sign Out / Switch Account
          </button>
        </div>
      </div>
    </div>
  );
}

function IdentityVerificationGate({ user }: { user: any }) {
  const { signOut, refreshUser } = useAuth();
  const [starting, setStarting] = useState(false);
  const [statusMsg, setStatusMsg] = useState("");
  const [err, setErr] = useState("");

  const handleStartIdentity = async () => {
    setStarting(true);
    setErr("");
    try {
      const res = await fetch("/api/identity/start", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Dev-User-Id": user.id }
      });
      const data = await res.json();
      if (data.alreadyVerified) {
        await refreshUser();
        return;
      }
      if (data.url) {
        window.location.href = data.url;
      } else {
        throw new Error(data.error || "Failed to start identity verification.");
      }
    } catch (e: any) {
      setErr(e.message || "Identity verification setup failed.");
    } finally {
      setStarting(false);
    }
  };

  const handleCheckStatus = async () => {
    setStarting(true);
    try {
      const res = await fetch("/api/identity/status", {
        headers: { "X-Dev-User-Id": user.id }
      });
      const data = await res.json();
      if (data.verified) {
        await refreshUser();
      } else {
        setStatusMsg(data.message || "Verification in progress or required.");
      }
    } catch (e: any) {
      setErr("Failed to check status.");
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-black px-4 relative overflow-hidden text-white text-center">
      <div className="z-10 max-w-md w-full bg-zinc-900/90 border border-white/10 p-8 rounded-3xl backdrop-blur-xl shadow-2xl space-y-6">
        <div className="w-16 h-16 rounded-2xl bg-secondary/10 border border-secondary/20 flex items-center justify-center mx-auto text-secondary">
          <Shield size={32} />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-black uppercase italic tracking-wider text-white">Government ID Required</h2>
          <p className="text-xs text-zinc-400">
            Intermingled requires 18+ Government ID and live photo verification to maintain our high-security speed dating environment.
          </p>
        </div>

        {statusMsg && <div className="bg-primary/10 border border-primary/30 text-primary text-xs p-3 rounded-xl">{statusMsg}</div>}
        {err && <div className="bg-red-500/10 border border-red-500/30 text-red-400 text-xs p-3 rounded-xl">{err}</div>}

        <div className="space-y-3 pt-2">
          <button
            onClick={handleStartIdentity}
            disabled={starting}
            className="w-full py-4 bg-secondary text-black font-black uppercase tracking-widest text-xs rounded-xl transition-all hover:scale-[1.02] active:scale-[0.98] shadow-[0_0_30px_hsl(var(--secondary)/0.3)] cursor-pointer disabled:opacity-50"
          >
            {starting ? "Starting Setup..." : "Verify Government ID (Stripe Identity)"}
          </button>

          <button
            onClick={handleCheckStatus}
            className="w-full py-3 bg-white/5 border border-white/10 text-white font-bold uppercase tracking-widest text-xs rounded-xl hover:bg-white/10 transition-all cursor-pointer"
          >
            Check Verification Status
          </button>

          <button
            onClick={signOut}
            className="text-xs text-zinc-500 hover:text-white transition-colors pt-2"
          >
            Sign Out
          </button>
        </div>
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

  if (!user) {
    return (
      <Switch>
        <Route path="/sign-in" component={SignInPage} />
        <Route path="/sign-up" component={SignInPage} />
        <Route><Redirect to="/sign-in" /></Route>
      </Switch>
    );
  }

  // GATE 1: Email Verification
  if (user.isVerified === false) {
    return <EmailVerificationGate user={user} />;
  }

  // GATE 2: Government ID / Age Verification
  if (user.ageVerified === false) {
    return <IdentityVerificationGate user={user} />;
  }

  return (
    <Switch>
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

import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Crown, Sparkles, Heart, Shield, Check, Lock, Zap } from "lucide-react";

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [loadingTier, setLoadingTier] = useState<string | null>(null);

  const accountAgeDays = 95; // Simulated 95 days in good standing
  const isGoodStanding90Days = accountAgeDays >= 90;

  const handleSelectTier = (tierName: string) => {
    setLoadingTier(tierName);
    setTimeout(() => {
      setLoadingTier(null);
      navigate("/subscribe/success");
    }, 1200);
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center bg-[#08080c] text-foreground px-4 py-16 pb-24">
      <div className="z-10 w-full max-w-5xl space-y-8">
        <div className="text-center space-y-3">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-white text-xs font-mono mb-2 flex items-center gap-1 mx-auto"
          >
            ← Back to Home Control Center
          </button>
          <h1 className="text-4xl md:text-5xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158]">
            Membership Tiers & Subscriptions
          </h1>
          <p className="text-muted-foreground text-xs max-w-lg mx-auto">
            Choose the membership tier that fits your dating lifestyle. Cancel or upgrade anytime.
          </p>
        </div>

        {/* 4 Tiers Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Free Freemium Tier */}
          <Card className="bg-[#111218] border border-border text-white flex flex-col justify-between">
            <CardHeader className="pb-3">
              <Badge variant="outline" className="w-fit text-[10px] border-muted-foreground text-muted-foreground mb-2">
                FREEMIUM
              </Badge>
              <CardTitle className="text-lg text-white">Free Pass</CardTitle>
              <p className="text-2xl font-black text-[#d4af37]">$0 <span className="text-xs font-mono text-muted-foreground">/mo</span></p>
              <CardDescription className="text-xs text-muted-foreground">
                Free daily speed dating pass with basic matching
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> 1 Free Suitor Match per day</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Map Radar & Nearby Profiles</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> 7-Question Algorithm Profile</li>
              </ul>
              <Button
                onClick={() => navigate("/")}
                variant="outline"
                className="w-full border-muted-foreground/40 text-white font-bold text-xs"
              >
                Current Active Tier
              </Button>
            </CardContent>
          </Card>

          {/* Tier 1: Suitor Pass ($10/mo) */}
          <Card className="bg-[#111218] border border-[#d4af37]/40 text-white flex flex-col justify-between relative shadow-xl">
            <CardHeader className="pb-3">
              <Badge className="w-fit text-[10px] bg-[#d4af37] text-black font-bold mb-2">
                TIER 1
              </Badge>
              <CardTitle className="text-lg text-white">Suitor Pass</CardTitle>
              <p className="text-2xl font-black text-[#d4af37]">$10 <span className="text-xs font-mono text-muted-foreground">/mo</span></p>
              <CardDescription className="text-xs text-muted-foreground">
                Unlimited speed dating matches and live GPS pings
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Unlimited Suitor Matches</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Live GPS Location Pings</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Unlimited Likes & Admirers</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Elimination Lounge Group Chat</li>
              </ul>
              <Button
                onClick={() => handleSelectTier("Suitor Pass")}
                className="w-full bg-[#181a24] hover:bg-[#222538] border border-[#d4af37]/50 text-[#d4af37] font-bold text-xs"
              >
                {loadingTier === "Suitor Pass" ? "Processing..." : "Subscribe Suitor ($10/mo)"}
              </Button>
            </CardContent>
          </Card>

          {/* Tier 2: Chooser Pass ($15/mo) */}
          <Card className="bg-[#141622] border-2 border-[#d4af37] text-white flex flex-col justify-between relative shadow-2xl scale-105">
            <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-[#d4af37] text-black text-[10px] font-black px-3 py-0.5 rounded-full uppercase tracking-widest">
              POPULAR
            </div>
            <CardHeader className="pb-3 pt-6">
              <Badge className="w-fit text-[10px] bg-[#d4af37] text-black font-bold mb-2">
                TIER 2
              </Badge>
              <CardTitle className="text-lg text-white">Chooser Pass</CardTitle>
              <p className="text-2xl font-black text-[#d4af37]">$15 <span className="text-xs font-mono text-muted-foreground">/mo</span></p>
              <CardDescription className="text-xs text-muted-foreground">
                Host speed dating games as Chooser & unlock 3-min profile review
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Everything in Suitor Pass</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Host Matches as Chooser</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> 3-Min Pre-Game Profile Review</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Advanced Compatibility Vector</li>
              </ul>
              <Button
                onClick={() => handleSelectTier("Chooser Pass")}
                className="w-full bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-black uppercase text-xs"
              >
                {loadingTier === "Chooser Pass" ? "Processing..." : "Subscribe Chooser ($15/mo)"}
              </Button>
            </CardContent>
          </Card>

          {/* Tier 3: Event Coordinator Pass ($25/mo - 90 Days Requirement) */}
          <Card className="bg-[#111218] border border-[#d4af37]/40 text-white flex flex-col justify-between relative shadow-xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <Badge className="w-fit text-[10px] bg-[#d4af37] text-black font-bold mb-2">
                  TIER 3
                </Badge>
                {isGoodStanding90Days ? (
                  <Badge variant="outline" className="border-emerald-500/50 text-emerald-400 text-[9px]">
                    ELIGIBLE (90+ DAYS)
                  </Badge>
                ) : (
                  <Badge variant="outline" className="border-amber-500/50 text-amber-400 text-[9px] flex items-center gap-1">
                    <Lock size={10} /> 90 DAYS REQ
                  </Badge>
                )}
              </div>
              <CardTitle className="text-lg text-white flex items-center gap-1.5">
                <Crown size={18} className="text-[#d4af37]" /> Event Coordinator
              </CardTitle>
              <p className="text-2xl font-black text-[#d4af37]">$25 <span className="text-xs font-mono text-muted-foreground">/mo</span></p>
              <CardDescription className="text-xs text-muted-foreground">
                Host Map Events at trusted venues with custom 10/20/30 capacity
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <ul className="space-y-2 text-xs text-muted-foreground">
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Event Coordinator Mode</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Create Map Events (10/20/30 Limit)</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Custom Attendee Selection/Vetting</li>
                <li className="flex items-center gap-2"><Check size={14} className="text-[#d4af37]" /> Coordinator Event Analytics</li>
              </ul>
              <Button
                onClick={() => handleSelectTier("Coordinator Pass")}
                disabled={!isGoodStanding90Days}
                className="w-full bg-[#181a24] hover:bg-[#222538] border border-[#d4af37]/50 text-[#d4af37] font-bold text-xs"
              >
                {isGoodStanding90Days
                  ? loadingTier === "Coordinator Pass"
                    ? "Processing..."
                    : "Subscribe Coordinator ($25/mo)"
                  : "Requires 90 Days Good Standing"}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}

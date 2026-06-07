import { useState } from "react";
import { useLocation } from "wouter";
import { useUser, useClerk, Show } from "@clerk/react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { useQuery } from "@tanstack/react-query";

const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

interface Plan {
  product_id: string;
  product_name: string;
  product_description: string;
  product_metadata: Record<string, string>;
  price_id: string;
  unit_amount: number;
  currency: string;
}

async function fetchPlans(): Promise<Plan[]> {
  const res = await fetch(`${BASE}/api/stripe/plans`);
  if (!res.ok) throw new Error("Failed to load plans");
  const data = await res.json();
  return data.plans as Plan[];
}

async function startCheckout(priceId: string): Promise<string> {
  const res = await fetch(`${BASE}/api/stripe/checkout`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ priceId }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error ?? "Checkout failed");
  }
  const data = await res.json();
  return data.url as string;
}

function PlanCard({
  plan,
  onSelect,
  loading,
}: {
  plan: Plan;
  onSelect: (priceId: string) => void;
  loading: boolean;
}) {
  const isChooser = plan.product_name === "Chooser Plan";
  const priceDisplay = `$${(plan.unit_amount / 100).toFixed(2)}/mo`;
  const role = plan.product_metadata?.role ?? (isChooser ? "chooser" : "suitor");

  return (
    <Card className={`relative border-2 transition-all duration-200 ${isChooser ? "border-primary shadow-lg shadow-primary/20" : "border-border"}`}>
      {isChooser && (
        <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-primary text-primary-foreground text-xs font-bold px-3 py-1 rounded-full uppercase tracking-widest">
          Most Popular
        </div>
      )}
      <CardHeader className="pb-4">
        <div className="flex items-center gap-3 mb-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-lg ${isChooser ? "bg-primary/20" : "bg-secondary/20"}`}>
            {isChooser ? "👑" : "💫"}
          </div>
          <div>
            <CardTitle className="text-lg">{plan.product_name}</CardTitle>
            <p className="text-2xl font-black text-foreground mt-1">{priceDisplay}</p>
          </div>
        </div>
        <CardDescription className="text-sm text-muted-foreground">
          {plan.product_description}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-0">
        <ul className="space-y-2 mb-6 text-sm text-muted-foreground">
          {role === "chooser" ? (
            <>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Be the chooser in every room</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Chat with up to 5 suitors at once</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> See full personality match scores</li>
              <li className="flex items-center gap-2"><span className="text-primary">✓</span> Unlimited rooms per month</li>
            </>
          ) : (
            <>
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> Enter the suitor pool</li>
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> Get matched by personality</li>
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> Chat 1-on-1 in speed date rooms</li>
              <li className="flex items-center gap-2"><span className="text-secondary">✓</span> Unlimited pool entries</li>
            </>
          )}
        </ul>
        <Show when="signed-in">
          <Button
            className={`w-full font-bold ${isChooser ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"}`}
            onClick={() => onSelect(plan.price_id)}
            disabled={loading}
          >
            {loading ? "Redirecting…" : `Subscribe as ${isChooser ? "Chooser" : "Suitor"}`}
          </Button>
        </Show>
        <Show when="signed-out">
          <Button
            className={`w-full font-bold ${isChooser ? "bg-primary hover:bg-primary/90" : "bg-secondary hover:bg-secondary/90 text-secondary-foreground"}`}
            onClick={() => {
              const base = import.meta.env.BASE_URL.replace(/\/$/, "");
              window.location.href = `${base}/sign-up`;
            }}
          >
            Get started
          </Button>
        </Show>
      </CardContent>
    </Card>
  );
}

export default function Subscribe() {
  const [, navigate] = useLocation();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [loadingPriceId, setLoadingPriceId] = useState<string | null>(null);

  const { data: plans, isLoading, error } = useQuery({
    queryKey: ["plans"],
    queryFn: fetchPlans,
  });

  const handleSelect = async (priceId: string) => {
    if (!user) {
      navigate("/sign-in");
      return;
    }
    setLoadingPriceId(priceId);
    try {
      const url = await startCheckout(priceId);
      window.location.href = url;
    } catch (e: any) {
      console.error(e);
    } finally {
      setLoadingPriceId(null);
    }
  };

  return (
    <div className="relative min-h-[100dvh] flex flex-col items-center justify-center bg-background px-4 py-16">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />

      <div className="z-10 w-full max-w-3xl">
        <div className="text-center mb-12">
          <button
            onClick={() => navigate("/")}
            className="text-muted-foreground hover:text-foreground text-sm font-mono mb-6 flex items-center gap-1 mx-auto"
          >
            ← Back
          </button>
          <h1 className="text-4xl md:text-5xl font-black mb-3 uppercase tracking-tighter text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary">
            Choose Your Role
          </h1>
          <p className="text-muted-foreground font-mono text-sm max-w-md mx-auto">
            Pick the role that fits you. Cancel anytime.
          </p>
          {user && (
            <p className="text-muted-foreground text-xs mt-2">
              Signed in as <span className="text-primary">{user.primaryEmailAddress?.emailAddress}</span>
              {" · "}
              <button onClick={() => signOut()} className="text-muted-foreground hover:text-foreground underline">sign out</button>
            </p>
          )}
        </div>

        {isLoading && (
          <div className="text-center text-muted-foreground font-mono text-sm animate-pulse">
            Loading plans…
          </div>
        )}

        {error && (
          <div className="text-center text-destructive font-mono text-sm">
            Couldn't load plans. Please refresh.
          </div>
        )}

        {plans && plans.length === 0 && (
          <div className="text-center text-muted-foreground font-mono text-sm">
            No plans available yet. Check back soon.
          </div>
        )}

        {plans && plans.length > 0 && (
          <div className="grid md:grid-cols-2 gap-6">
            {plans.map((plan) => (
              <PlanCard
                key={plan.price_id}
                plan={plan}
                onSelect={handleSelect}
                loading={loadingPriceId === plan.price_id}
              />
            ))}
          </div>
        )}

        <p className="text-center text-muted-foreground text-xs font-mono mt-8">
          Secure payments by Stripe · Cancel anytime · No hidden fees
        </p>
      </div>
    </div>
  );
}

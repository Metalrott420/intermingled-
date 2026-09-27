import { useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { Button } from "@/components/ui/button";

export default function SubscribeSuccess() {
  const [, navigate] = useLocation();
  const { user } = useUser();

  useEffect(() => {
    // Clear any cached subscription data
    window.setTimeout(() => {}, 0);
  }, []);

  return (
    <div className="relative min-h-[100dvh] flex items-center justify-center bg-background px-4">
      <div className="absolute inset-0 z-0 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:24px_24px]" />
      <div className="z-10 text-center max-w-md w-full">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="text-3xl font-black uppercase tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-primary to-secondary mb-4">
          You're In!
        </h1>
        <p className="text-muted-foreground font-mono text-sm mb-2">
          {user?.firstName ? `Welcome, ${user.firstName}!` : "Welcome!"}
        </p>
        <p className="text-muted-foreground text-sm mb-8">
          Your subscription is active. Head back and start matching.
        </p>
        <Button
          className="bg-primary hover:bg-primary/90 text-white font-bold px-8"
          onClick={() => navigate("/")}
        >
          Start Matching
        </Button>
      </div>
    </div>
  );
}

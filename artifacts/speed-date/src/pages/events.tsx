import { useEffect } from "react";
import { useLocation } from "wouter";

export default function EventsPage() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    // Redirect to home for now
    setLocation("/");
  }, [setLocation]);

  return null;
}

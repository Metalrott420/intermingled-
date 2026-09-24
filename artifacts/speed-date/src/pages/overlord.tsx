import { useEffect } from "react";
import { useLocation } from "wouter";

export default function OverlordDashboard() {
  const [, setLocation] = useLocation();

  useEffect(() => {
    setLocation("/");
  }, [setLocation]);

  return null;
}

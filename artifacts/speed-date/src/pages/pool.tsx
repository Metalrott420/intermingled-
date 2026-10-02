import { useEffect, useState, useCallback } from "react";
import { useLocation, useSearch } from "wouter";
import { useAuth } from "@clerk/react";
import { usePoolSocket } from "@/hooks/useSocket";
import {
  Zap,
  Star,
  Heart,
  ChevronRight,
  X,
  MapPin,
  Plus,
  Navigation,
  Shield,
  Users,
  Calendar,
  Sparkles,
  Radio,
  SlidersHorizontal,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface BrowseProfile {
  id: string;
  name: string;
  bio: string | null;
  photos: string[];
  distanceMiles?: number;
  latitude?: number;
  longitude?: number;
}

interface SpeedDateEvent {
  id: string;
  title: string;
  area: string;
  coordinatorName: string;
  capacity: 10 | 20 | 30;
  joinedCount: number;
  scheduledTime: string;
  latitude: number;
  longitude: number;
  isJoined?: boolean;
}

export default function Pool() {
  const [, setLocation] = useLocation();
  const search = useSearch();
  const params = new URLSearchParams(search);
  const userId = params.get("userId") || "";
  const name = params.get("name") || "";
  const { toast } = useToast();

  const { getToken } = useAuth();
  const [token, setToken] = useState<string | null>(null);
  useEffect(() => {
    getToken().then((t) => setToken(t)).catch(() => {});
  }, [getToken]);

  const [viewMode, setViewMode] = useState<"radar" | "map">("map");
  const [browseProfiles, setBrowseProfiles] = useState<BrowseProfile[]>([]);
  const [browseIndex, setBrowseIndex] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  // GPS Location Self-Pinging state
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number } | null>(null);
  const [isPinging, setIsPinging] = useState(false);
  const [radiusFilter, setRadiusFilter] = useState<number>(10); // 1, 5, 10, 25 miles

  // Event Coordinator Creation State
  const [showEventModal, setShowEventModal] = useState(false);
  const [events, setEvents] = useState<SpeedDateEvent[]>([
    {
      id: "evt-1",
      title: "Austin Downtown Blind Speed Dating",
      area: "Downtown Austin (6th St)",
      coordinatorName: "Elena V.",
      capacity: 20,
      joinedCount: 14,
      scheduledTime: "8:00 PM Tonight",
      latitude: 30.2672,
      longitude: -97.7431,
    },
    {
      id: "evt-2",
      title: "VIP Gold Mixer (30 Person)",
      area: "Rainey Street District",
      coordinatorName: "Marcus K.",
      capacity: 30,
      joinedCount: 22,
      scheduledTime: "9:30 PM Tonight",
      latitude: 30.2598,
      longitude: -97.7385,
    },
  ]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    area: "",
    capacity: 20 as 10 | 20 | 30,
    scheduledTime: "8:00 PM Tonight",
  });

  const { isConnected, poolCount, leavePool, subscribe } = usePoolSocket(
    userId || undefined,
    token ?? undefined
  );

  useEffect(() => {
    if (!userId) setLocation("/");
  }, [userId, setLocation]);

  useEffect(() => {
    const unsub = subscribe(
      "match_found",
      ({ roomId, participantId }: { roomId: string; participantId: string }) => {
        sessionStorage.setItem(`participantId_${roomId}`, participantId);
        setLocation(`/room/${roomId}/suitor`);
      }
    );
    return unsub;
  }, [subscribe, setLocation]);

  // Handle GPS location ping
  const handlePingLocation = () => {
    setIsPinging(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          setIsPinging(false);
          toast({
            title: "Location Pinged! 📍",
            description: `Broadcasting live GPS coordinates. Localized matching enabled (${radiusFilter} mi radius).`,
          });
        },
        () => {
          setIsPinging(false);
          toast({
            title: "GPS Permission Denied",
            description: "Defaulting to Austin, TX hotspot location.",
            variant: "destructive",
          });
          setUserCoords({ lat: 30.2672, lng: -97.7431 });
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsPinging(false);
      setUserCoords({ lat: 30.2672, lng: -97.7431 });
    }
  };

  useEffect(() => {
    fetch("/api/users/looking")
      .then((r) => r.json())
      .then((data) => {
        const profiles = (data.users ?? []).filter((u: BrowseProfile) => u.id !== userId);
        setBrowseProfiles(profiles);
      })
      .catch(() => {});
  }, [userId]);

  const handleLike = useCallback(
    async (profileId: string) => {
      setLiked((prev) => new Set([...prev, profileId]));
      fetch(`/api/users/${profileId}/like`, { method: "POST", credentials: "include" }).catch(() => {});
      setBrowseIndex((i) => Math.min(i + 1, browseProfiles.length - 1));
    },
    [browseProfiles.length]
  );

  const handlePass = useCallback(() => {
    setBrowseIndex((i) => Math.min(i + 1, browseProfiles.length - 1));
  }, [browseProfiles.length]);

  const handleCreateEvent = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newEvent.title || !newEvent.area) {
      toast({ title: "Error", description: "Event title and area are required.", variant: "destructive" });
      return;
    }
    const created: SpeedDateEvent = {
      id: `evt-${Date.now()}`,
      title: newEvent.title,
      area: newEvent.area,
      coordinatorName: name || "Event Coordinator",
      capacity: newEvent.capacity,
      joinedCount: 1,
      scheduledTime: newEvent.scheduledTime,
      latitude: userCoords ? userCoords.lat + (Math.random() - 0.5) * 0.02 : 30.2672,
      longitude: userCoords ? userCoords.lng + (Math.random() - 0.5) * 0.02 : -97.7431,
      isJoined: true,
    };
    setEvents((prev) => [created, ...prev]);
    setShowEventModal(false);
    setNewEvent({ title: "", area: "", capacity: 20, scheduledTime: "8:00 PM Tonight" });
    toast({
      title: "Speed Dating Event Created! 🎉",
      description: `${created.title} (${created.capacity} Person Event) is now pinned on the interactive map!`,
    });
  };

  const handleJoinEvent = (eventId: string) => {
    setEvents((prev) =>
      prev.map((evt) => {
        if (evt.id === eventId) {
          const isJoined = !evt.isJoined;
          const joinedCount = isJoined
            ? Math.min(evt.joinedCount + 1, evt.capacity)
            : Math.max(evt.joinedCount - 1, 0);
          return { ...evt, isJoined, joinedCount };
        }
        return evt;
      })
    );
    toast({ title: "Event Joined! ⭐", description: "You are queued in the speed dating pool." });
  };

  const currentProfile = browseProfiles[browseIndex];

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#08080c] text-foreground spotlight-bg overflow-hidden pb-20">
      {/* Ticker bar */}
      <div className="relative z-20 bg-[#d4af37] text-[#08080c] py-1.5 overflow-hidden font-bold">
        <div className="flex items-center gap-2 ticker-scroll whitespace-nowrap text-xs font-display uppercase tracking-widest">
          {Array.from({ length: 8 }).map((_, i) => (
            <span key={i} className="flex items-center gap-4">
              <span>⭐ INTERMINGLED GOLD LIVE</span>
              <span className="opacity-50">·</span>
              <span>5 ROUNDS. 2 WINNERS. 1 PERFECT MATCH.</span>
              <span className="opacity-50">·</span>
            </span>
          ))}
        </div>
      </div>

      {/* Top Map & Control Bar */}
      <div className="bg-[#111218] border-b border-[#d4af37]/20 p-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Button
            onClick={handlePingLocation}
            disabled={isPinging}
            className="bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] text-[#08080c] font-black uppercase tracking-wider text-xs py-2 px-4 shadow-lg shadow-[#d4af37]/20"
          >
            <Radio size={16} className="mr-1.5 animate-pulse" />
            {userCoords ? "Update Location Ping 📍" : "Ping My Location 📍"}
          </Button>

          <div className="flex items-center gap-2 bg-[#181a24] border border-[#d4af37]/30 rounded-xl px-3 py-1.5 text-xs text-[#d4af37] font-mono">
            <SlidersHorizontal size={14} />
            <span>Radius:</span>
            <select
              value={radiusFilter}
              onChange={(e) => setRadiusFilter(Number(e.target.value))}
              className="bg-transparent text-white font-bold outline-none cursor-pointer"
            >
              <option value={1} className="bg-[#111218]">1 Mile</option>
              <option value={5} className="bg-[#111218]">5 Miles</option>
              <option value={10} className="bg-[#111218]">10 Miles</option>
              <option value={25} className="bg-[#111218]">25 Miles</option>
            </select>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-[#181a24] p-1 rounded-xl border border-[#d4af37]/30">
            <button
              onClick={() => setViewMode("map")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === "map"
                  ? "bg-[#d4af37] text-black shadow-md"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Map View 🗺️
            </button>
            <button
              onClick={() => setViewMode("radar")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase tracking-wider transition-all ${
                viewMode === "radar"
                  ? "bg-[#d4af37] text-black shadow-md"
                  : "text-muted-foreground hover:text-white"
              }`}
            >
              Radar View 📡
            </button>
          </div>

          <Button
            onClick={() => setShowEventModal(true)}
            className="bg-[#181a24] hover:bg-[#222536] text-[#d4af37] border border-[#d4af37]/50 font-bold uppercase text-xs"
          >
            <Plus size={16} className="mr-1" />
            Create Event
          </Button>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* LEFT: Interactive Map / Radar Panel */}
        <div className="flex-1 relative bg-[#0a0b12] border-r border-[#d4af37]/20 flex flex-col justify-center items-center p-6 overflow-hidden">
          {viewMode === "map" ? (
            /* Interactive Canvas Map */
            <div className="relative w-full h-full min-h-[420px] rounded-2xl bg-[#0e101a] border border-[#d4af37]/30 overflow-hidden shadow-2xl flex items-center justify-center">
              {/* Map grid lines */}
              <div className="absolute inset-0 bg-[linear-gradient(to_right,#1f2438_1px,transparent_1px),linear-gradient(to_bottom,#1f2438_1px,transparent_1px)] bg-[size:4rem_4rem] [mask-image:radial-gradient(ellipse_60%_50%_at_50%_50%,#000_70%,transparent_100%)] opacity-40" />

              {/* Center User Pin */}
              <div className="relative z-10 flex flex-col items-center">
                <div className="relative">
                  <div className="w-12 h-12 rounded-full bg-[#d4af37]/20 border-2 border-[#d4af37] flex items-center justify-center animate-pulse">
                    <Navigation className="w-6 h-6 text-[#d4af37]" />
                  </div>
                  <div className="absolute -top-1 -right-1 w-4 h-4 rounded-full bg-emerald-500 border-2 border-black" />
                </div>
                <Badge className="mt-2 bg-[#d4af37] text-black font-black uppercase text-[10px] tracking-widest">
                  YOU (PINGED 📍)
                </Badge>
              </div>

              {/* Event Pins on Map */}
              {events.map((evt, idx) => (
                <div
                  key={evt.id}
                  style={{
                    position: "absolute",
                    top: `${30 + (idx % 2 === 0 ? idx * 25 : -idx * 20)}%`,
                    left: `${25 + idx * 30}%`,
                  }}
                  className="flex flex-col items-center z-20 group cursor-pointer"
                >
                  <div className="bg-[#181a24] border-2 border-[#d4af37] p-2 rounded-xl shadow-xl flex items-center gap-2 group-hover:scale-110 transition-transform">
                    <Calendar size={18} className="text-[#d4af37]" />
                    <div className="text-left">
                      <p className="text-xs font-bold text-white line-clamp-1">{evt.title}</p>
                      <p className="text-[10px] text-[#d4af37] font-mono">
                        {evt.joinedCount} / {evt.capacity} Joined ({evt.capacity} Person Event)
                      </p>
                    </div>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => handleJoinEvent(evt.id)}
                    className={`mt-1.5 text-[10px] font-bold uppercase tracking-wider py-1 h-7 ${
                      evt.isJoined
                        ? "bg-emerald-500 text-black"
                        : "bg-[#d4af37] hover:bg-[#b5952f] text-black"
                    }`}
                  >
                    {evt.isJoined ? "Joined ✓" : "Join Event"}
                  </Button>
                </div>
              ))}
            </div>
          ) : (
            /* Radar View */
            <div className="relative mb-6 mx-auto w-64 h-64 flex items-center justify-center">
              <div className="absolute inset-0 rounded-full border-2 border-[#d4af37]/20 animate-ping" />
              <div className="absolute inset-4 rounded-full border-2 border-[#d4af37]/35 animate-ping [animation-delay:0.3s]" />
              <div className="absolute inset-8 rounded-full border-2 border-[#d4af37]/50 animate-ping [animation-delay:0.6s]" />
              <div className="absolute inset-0 rounded-full border-2 border-[#d4af37] border-t-transparent animate-spin" />
              <div className="absolute inset-0 flex items-center justify-center flex-col text-center">
                <Zap size={28} className="text-[#d4af37] mb-1" />
                <p className="text-xs font-mono text-[#d4af37] font-bold">RADAR ACTIVE</p>
                <p className="text-[10px] text-muted-foreground">{radiusFilter} MILE RADIUS</p>
              </div>
            </div>
          )}
        </div>

        {/* RIGHT: Active Profiles Browse */}
        <div className="lg:w-96 p-6 bg-[#0e1018] flex flex-col justify-between">
          <div className="space-y-4">
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
              <h2 className="font-display font-black text-lg tracking-wider text-[#d4af37] uppercase">
                NEARBY SPEED DATERS
              </h2>
              <Badge variant="outline" className="border-[#d4af37]/40 text-[#d4af37] font-mono">
                {browseProfiles.length} ONLINE
              </Badge>
            </div>

            {currentProfile ? (
              <div className="bg-[#141622] border border-[#d4af37]/30 rounded-2xl overflow-hidden shadow-2xl space-y-3 p-4">
                <div className="aspect-square w-full rounded-xl bg-[#1d2030] overflow-hidden relative">
                  {currentProfile.photos?.[0] ? (
                    <img
                      src={currentProfile.photos[0]}
                      alt={currentProfile.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-4xl font-bold text-[#d4af37]">
                      {currentProfile.name[0]}
                    </div>
                  )}
                  <div className="absolute bottom-2 left-2 bg-black/80 backdrop-blur-md px-2.5 py-1 rounded-lg border border-[#d4af37]/30 text-[11px] font-mono text-[#d4af37]">
                    0.4 mi away 📍
                  </div>
                </div>

                <div className="space-y-1">
                  <h3 className="text-xl font-bold text-white">{currentProfile.name}</h3>
                  <p className="text-xs text-muted-foreground leading-relaxed line-clamp-2">
                    {currentProfile.bio || "Looking for deep conversations and real speed dating chemistry."}
                  </p>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button
                    onClick={handlePass}
                    variant="outline"
                    className="flex-1 border-muted-foreground/30 text-muted-foreground hover:bg-muted"
                  >
                    <X size={18} className="mr-1" />
                    Pass
                  </Button>
                  <Button
                    onClick={() => handleLike(currentProfile.id)}
                    className="flex-1 bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-bold"
                  >
                    <Heart size={18} className="mr-1 fill-black" />
                    Like
                  </Button>
                </div>
              </div>
            ) : (
              <div className="text-center py-12 space-y-2">
                <Sparkles className="w-10 h-10 text-[#d4af37] mx-auto animate-bounce" />
                <p className="text-sm font-bold text-white">Scanning for local speed daters...</p>
                <p className="text-xs text-muted-foreground">Ping your location to expand discovery!</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Event Coordinator Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEvent}
            className="bg-[#111218] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="text-[#d4af37]" />
                <h3 className="text-lg font-black uppercase text-foreground">Create Speed Dating Event</h3>
              </div>
              <button type="button" onClick={() => setShowEventModal(false)} className="text-muted-foreground hover:text-white">
                <X size={20} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-mono text-[#d4af37] uppercase">Event Name / Title</label>
                <Input
                  placeholder="e.g. Austin Blind Date Mixer"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="bg-[#181a24] border-[#252838] text-white mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-[#d4af37] uppercase">Venue / Area Location</label>
                <Input
                  placeholder="e.g. Rainey Street District"
                  value={newEvent.area}
                  onChange={(e) => setNewEvent({ ...newEvent, area: e.target.value })}
                  className="bg-[#181a24] border-[#252838] text-white mt-1"
                />
              </div>

              <div>
                <label className="text-xs font-mono text-[#d4af37] uppercase">Event Capacity (Person Limit)</label>
                <div className="grid grid-cols-3 gap-2 mt-1">
                  {[10, 20, 30].map((cap) => (
                    <Button
                      key={cap}
                      type="button"
                      variant={newEvent.capacity === cap ? "default" : "outline"}
                      onClick={() => setNewEvent({ ...newEvent, capacity: cap as 10 | 20 | 30 })}
                      className={
                        newEvent.capacity === cap
                          ? "bg-[#d4af37] text-black font-black border-[#d4af37]"
                          : "border-[#252838] text-muted-foreground"
                      }
                    >
                      {cap} Person
                    </Button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-3">
              <Button type="button" variant="ghost" onClick={() => setShowEventModal(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button type="submit" className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-bold uppercase">
                Publish Event Pin
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

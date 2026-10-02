import { useEffect, useState, useCallback, useRef } from "react";
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
  Crown,
  Search,
  Compass,
  ExternalLink,
  Car,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

declare const L: any; // Leaflet global from CDN

interface BrowseProfile {
  id: string;
  name: string;
  bio: string | null;
  photos: string[];
  distanceMiles?: number;
  latitude: number;
  longitude: number;
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

  const [viewMode, setViewMode] = useState<"map" | "radar">("map");
  const [coordinatorMode, setCoordinatorMode] = useState(false);
  const [browseProfiles, setBrowseProfiles] = useState<BrowseProfile[]>([
    {
      id: "p-1",
      name: "Jessica Taylor",
      bio: "Software engineer & coffee enthusiast. Looking for genuine speed dating chemistry!",
      photos: ["/logo-192.png"],
      distanceMiles: 0.8,
      latitude: 30.2762,
      longitude: -97.7421,
    },
    {
      id: "p-2",
      name: "Marcus Miller",
      bio: "Architect & outdoor cyclist. Excited for the 30-person VIP mixer!",
      photos: ["/logo-192.png"],
      distanceMiles: 1.4,
      latitude: 30.2482,
      longitude: -97.7511,
    },
  ]);

  const [browseIndex, setBrowseIndex] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  // Location & Geocoding Search State
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({ lat: 30.2672, lng: -97.7431 });
  const [isPinging, setIsPinging] = useState(false);
  const [radiusFilter, setRadiusFilter] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);

  // Selected Map Pin Directions State
  const [selectedTarget, setSelectedTarget] = useState<{
    title: string;
    type: "event" | "profile";
    latitude: number;
    longitude: number;
    distanceMi: number;
    etaMinutes: number;
  } | null>(null);

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
      latitude: 30.2548,
      longitude: -97.7325,
    },
  ]);

  const [newEvent, setNewEvent] = useState({
    title: "",
    area: "",
    capacity: 20 as 10 | 20 | 30,
    scheduledTime: "8:00 PM Tonight",
  });

  const mapContainerRef = useRef<HTMLDivElement>(null);
  const leafletMapRef = useRef<any>(null);
  const markersRef = useRef<any[]>([]);

  const { isConnected, poolCount, leavePool, subscribe } = usePoolSocket(
    userId || undefined,
    token ?? undefined
  );

  // Initialize Real Leaflet Interactive Map Engine
  useEffect(() => {
    if (viewMode !== "map" || !mapContainerRef.current) return;

    if (typeof L === "undefined") {
      console.warn("Leaflet script not yet loaded from CDN.");
      return;
    }

    if (!leafletMapRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [userCoords.lat, userCoords.lng],
        zoom: 13,
        zoomControl: false,
      });

      // Esri World Dark Gray Canvas - 100% Free Keyless Dark Tile Layer without watermarks
      L.tileLayer("https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}", {
        attribution: "Tiles &copy; Esri &mdash; Esri, DeLorme, NAVTEQ",
        maxZoom: 16,
      }).addTo(map);

      L.control.zoom({ position: "bottomright" }).addTo(map);
      leafletMapRef.current = map;
    } else {
      leafletMapRef.current.setView([userCoords.lat, userCoords.lng]);
    }

    // Clear existing markers
    markersRef.current.forEach((m) => m.remove());
    markersRef.current = [];

    const map = leafletMapRef.current;

    // 1. User Self-Location Pin (Gold Glowing Radar Marker)
    const userIcon = L.divIcon({
      className: "custom-leaflet-user-pin",
      html: `
        <div style="position:relative; width:36px; height:36px; display:flex; align-items:center; justify-content:center;">
          <div style="position:absolute; inset:0; border-radius:50%; background:rgba(212,175,55,0.3); border:2px solid #d4af37; animation:ping 1.5s infinite;"></div>
          <div style="width:24px; height:24px; border-radius:50%; background:#d4af37; border:2px solid #000; display:flex; align-items:center; justify-content:center; color:#000; font-weight:bold; font-size:12px;">📍</div>
        </div>
      `,
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    });

    const userMarker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
      .addTo(map)
      .bindPopup("<b>Your GPS Location</b><br/>Broadcasting Live Matching Radius");
    markersRef.current.push(userMarker);

    // 2. Render Event Coordinator Pins
    events.forEach((evt) => {
      const evtIcon = L.divIcon({
        className: "custom-leaflet-event-pin",
        html: `
          <div style="background:#111218; border:2px solid #d4af37; color:#d4af37; border-radius:12px; padding:4px 8px; font-size:10px; font-weight:900; font-family:sans-serif; white-space:nowrap; box-shadow:0 4px 12px rgba(0,0,0,0.8); cursor:pointer;">
            👑 ${evt.title.slice(0, 16)}... (${evt.joinedCount}/${evt.capacity})
          </div>
        `,
        iconSize: [120, 30],
        iconAnchor: [60, 15],
      });

      const m = L.marker([evt.latitude, evt.longitude], { icon: evtIcon })
        .addTo(map)
        .on("click", () => {
          setSelectedTarget({
            title: evt.title,
            type: "event",
            latitude: evt.latitude,
            longitude: evt.longitude,
            distanceMi: 1.2,
            etaMinutes: 4,
          });
        });
      markersRef.current.push(m);
    });

    // 3. Render Nearby Speed Daters Pins
    browseProfiles.forEach((p) => {
      const profileIcon = L.divIcon({
        className: "custom-leaflet-profile-pin",
        html: `
          <div style="background:#181a24; border:2px solid #f59e0b; color:#fff; border-radius:20px; padding:3px 8px; font-size:10px; font-weight:bold; display:flex; align-items:center; gap:4px; box-shadow:0 4px 10px rgba(0,0,0,0.7); cursor:pointer;">
            <span>💖</span> <span>${p.name.split(" ")[0]}</span>
          </div>
        `,
        iconSize: [90, 26],
        iconAnchor: [45, 13],
      });

      const m = L.marker([p.latitude, p.longitude], { icon: profileIcon })
        .addTo(map)
        .on("click", () => {
          setSelectedTarget({
            title: p.name,
            type: "profile",
            latitude: p.latitude,
            longitude: p.longitude,
            distanceMi: p.distanceMiles || 0.8,
            etaMinutes: Math.round((p.distanceMiles || 0.8) * 3),
          });
        });
      markersRef.current.push(m);
    });
  }, [viewMode, userCoords, events, browseProfiles]);

  // Handle Location Search via OpenStreetMap Nominatim Geocoding API
  const handleLocationSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    setSearchLoading(true);

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(searchQuery)}&format=json&limit=1`
      );
      const data = await res.json();

      if (data && data[0]) {
        const lat = parseFloat(data[0].lat);
        const lng = parseFloat(data[0].lon);
        setUserCoords({ lat, lng });

        if (leafletMapRef.current) {
          leafletMapRef.current.flyTo([lat, lng], 14, { duration: 1.5 });
        }

        toast({
          title: "Location Found! 🗺️",
          description: `Map camera moved to ${data[0].display_name.slice(0, 40)}...`,
        });
      } else {
        toast({ title: "Address Not Found", description: "Try searching for a city or venue name.", variant: "destructive" });
      }
    } catch {
      toast({ title: "Geocoding Error", description: "Could not fetch search coordinates.", variant: "destructive" });
    } finally {
      setSearchLoading(false);
    }
  };

  // Handle GPS location ping
  const handlePingLocation = () => {
    setIsPinging(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
          setUserCoords(coords);
          setIsPinging(false);

          if (leafletMapRef.current) {
            leafletMapRef.current.flyTo([coords.lat, coords.lng], 14, { duration: 1.5 });
          }

          toast({
            title: "Location Pinged! 📍",
            description: `Broadcasting live GPS coordinates. Localized matching enabled (${radiusFilter} mi radius).`,
          });
        },
        () => {
          setIsPinging(false);
          toast({ title: "GPS Permission Denied", description: "Defaulting to Austin, TX hotspot.", variant: "destructive" });
          setUserCoords({ lat: 30.2672, lng: -97.7431 });
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsPinging(false);
      setUserCoords({ lat: 30.2672, lng: -97.7431 });
    }
  };

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
      latitude: userCoords.lat + (Math.random() - 0.5) * 0.02,
      longitude: userCoords.lng + (Math.random() - 0.5) * 0.02,
      isJoined: true,
    };
    setEvents((prev) => [created, ...prev]);
    setShowEventModal(false);
    setNewEvent({ title: "", area: "", capacity: 20, scheduledTime: "8:00 PM Tonight" });
    toast({
      title: "Speed Dating Event Created! 🎉",
      description: `${created.title} (${created.capacity} Person Event) is pinned on the interactive map!`,
    });
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

      {/* Top Controls & Location Geocoding Search Bar */}
      <div className="bg-[#111218] border-b border-[#d4af37]/20 p-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Location Search Bar */}
          <form onSubmit={handleLocationSearch} className="flex gap-2 flex-1 max-w-md">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search city, address, or venue (e.g. 6th St, Austin, TX)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 bg-[#181a24] border-[#252838] text-xs text-white h-10"
              />
            </div>
            <Button type="submit" disabled={searchLoading} className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-bold h-10 px-4 text-xs">
              {searchLoading ? "Searching..." : "Search"}
            </Button>
          </form>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePingLocation}
              disabled={isPinging}
              className="bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-black uppercase text-xs h-10 px-3"
            >
              <Radio size={14} className="mr-1 animate-pulse" />
              Ping GPS 📍
            </Button>

            <div className="flex bg-[#181a24] p-1 rounded-xl border border-[#d4af37]/30">
              <button
                onClick={() => setViewMode("map")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  viewMode === "map" ? "bg-[#d4af37] text-black" : "text-muted-foreground hover:text-white"
                }`}
              >
                Map View 🗺️
              </button>
              <button
                onClick={() => setViewMode("radar")}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold uppercase transition-all ${
                  viewMode === "radar" ? "bg-[#d4af37] text-black" : "text-muted-foreground hover:text-white"
                }`}
              >
                Radar View 📡
              </button>
            </div>

            <Button
              onClick={() => setShowEventModal(true)}
              className="bg-[#181a24] hover:bg-[#222536] text-[#d4af37] border border-[#d4af37]/50 font-bold uppercase text-xs h-10"
            >
              <Plus size={16} className="mr-1" />
              Create Event
            </Button>
          </div>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 flex flex-col lg:flex-row gap-0 overflow-hidden">
        {/* LEFT: Leaflet Map Container */}
        <div className="flex-1 relative bg-[#0a0b12] border-r border-[#d4af37]/20 flex flex-col justify-center items-center p-4 overflow-hidden">
          {viewMode === "map" ? (
            <div className="relative w-full h-full min-h-[460px] rounded-2xl overflow-hidden shadow-2xl border border-[#d4af37]/30">
              {/* Leaflet Map Div */}
              <div ref={mapContainerRef} className="w-full h-full min-h-[460px] z-10" />

              {/* Recenter Button */}
              <button
                onClick={handlePingLocation}
                className="absolute bottom-4 right-4 z-20 bg-[#111218] border border-[#d4af37] text-[#d4af37] p-2.5 rounded-xl shadow-2xl hover:bg-[#d4af37] hover:text-black transition-colors"
                title="Center on My Location"
              >
                <Compass size={20} />
              </button>
            </div>
          ) : (
            /* Radar Animation */
            <div className="relative mx-auto w-64 h-64 flex items-center justify-center">
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

        {/* RIGHT: Driving Directions & Target Selection Drawer */}
        <div className="lg:w-96 p-6 bg-[#0e1018] flex flex-col justify-between space-y-4">
          {selectedTarget ? (
            <div className="bg-[#141622] border border-[#d4af37]/40 rounded-2xl p-5 space-y-4 shadow-2xl">
              <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
                <div className="flex items-center gap-2">
                  <Car className="text-[#d4af37]" />
                  <h3 className="font-bold text-sm text-white uppercase">{selectedTarget.title}</h3>
                </div>
                <button onClick={() => setSelectedTarget(null)} className="text-muted-foreground hover:text-white">
                  <X size={18} />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 text-center text-xs">
                <div className="bg-[#181a24] p-3 rounded-xl border border-[#222538]">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Driving Distance</p>
                  <p className="text-base font-black text-[#d4af37]">{selectedTarget.distanceMi} Miles</p>
                </div>
                <div className="bg-[#181a24] p-3 rounded-xl border border-[#222538]">
                  <p className="text-[10px] text-muted-foreground font-mono uppercase">Estimated Driving Time</p>
                  <p className="text-base font-black text-emerald-400">~{selectedTarget.etaMinutes} Mins ETA</p>
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTarget.latitude},${selectedTarget.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#d4af37] hover:bg-[#b5952f] text-black font-bold uppercase text-xs py-3 rounded-xl shadow-lg"
                >
                  Open in Google Maps <ExternalLink size={14} />
                </a>

                <a
                  href={`https://maps.apple.com/?daddr=${selectedTarget.latitude},${selectedTarget.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#181a24] hover:bg-[#222536] text-[#d4af37] border border-[#d4af37]/40 font-bold uppercase text-xs py-3 rounded-xl"
                >
                  Open in Apple Maps <ExternalLink size={14} />
                </a>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
                <h2 className="font-display font-black text-sm tracking-wider text-[#d4af37] uppercase">
                  ACTIVE SPEED DATERS
                </h2>
                <Badge variant="outline" className="border-[#d4af37]/40 text-[#d4af37] font-mono">
                  {browseProfiles.length} ONLINE
                </Badge>
              </div>

              {currentProfile && (
                <div className="bg-[#141622] border border-[#d4af37]/30 rounded-2xl p-4 space-y-3">
                  <div className="aspect-square w-full rounded-xl bg-[#1d2030] overflow-hidden relative">
                    <img src={currentProfile.photos[0]} alt={currentProfile.name} className="w-full h-full object-cover" />
                  </div>
                  <h3 className="font-bold text-white text-base">{currentProfile.name}</h3>
                  <p className="text-xs text-muted-foreground">{currentProfile.bio}</p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Event Coordinator Creation Modal */}
      {showEventModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <form
            onSubmit={handleCreateEvent}
            className="bg-[#111218] border border-[#d4af37]/40 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3">
              <div className="flex items-center gap-2">
                <Crown className="text-[#d4af37]" />
                <h3 className="text-base font-black uppercase text-white">Create Speed Dating Event</h3>
              </div>
              <button type="button" onClick={() => setShowEventModal(false)} className="text-muted-foreground hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-[10px] font-mono text-[#d4af37] uppercase">Event Title</label>
                <Input
                  placeholder="e.g. Austin Blind Date Mixer"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="bg-[#181a24] border-[#252838] text-xs text-white mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#d4af37] uppercase">Area / Venue Name</label>
                <Input
                  placeholder="e.g. Rainey Street District"
                  value={newEvent.area}
                  onChange={(e) => setNewEvent({ ...newEvent, area: e.target.value })}
                  className="bg-[#181a24] border-[#252838] text-xs text-white mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#d4af37] uppercase">Person Limit (Capacity)</label>
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

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="ghost" onClick={() => setShowEventModal(false)} className="text-muted-foreground">
                Cancel
              </Button>
              <Button type="submit" className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-bold uppercase text-xs">
                Publish Event Pin
              </Button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

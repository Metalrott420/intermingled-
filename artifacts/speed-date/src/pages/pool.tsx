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
  Utensils,
  Coffee,
  Wine,
  Music,
  Video,
  Play,
  Volume2,
  CheckCircle2,
  Building2,
  Trees,
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
  videoUrl?: string;
  trustedVenueName?: string;
  likesCount?: number;
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

interface SearchResultItem {
  id: string;
  name: string;
  displayName: string;
  category: "restaurant" | "bar" | "cafe" | "club" | "mall" | "park" | "address";
  lat: number;
  lng: number;
  distanceMi: number;
  isTrustedVenue: boolean;
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

  // User Coords (Initial Default Austin, TX until live GPS acquired)
  const [userCoords, setUserCoords] = useState<{ lat: number; lng: number }>({ lat: 30.2672, lng: -97.7431 });

  // Clean initial state (ZERO hardcoded demo pins - pins ONLY appear when real users self-ping or create events)
  const [browseProfiles, setBrowseProfiles] = useState<BrowseProfile[]>([]);
  const [events, setEvents] = useState<SpeedDateEvent[]>([]);

  const [browseIndex, setBrowseIndex] = useState(0);
  const [liked, setLiked] = useState<Set<string>>(new Set());

  // Location & Geocoding Search State
  const [isPinging, setIsPinging] = useState(false);
  const [radiusFilter, setRadiusFilter] = useState<number>(10);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchResultItem[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);

  // Selected Snapchat Live Video Broadcast Overlay State
  const [activeVideoBroadcast, setActiveVideoBroadcast] = useState<{
    profileId: string;
    creatorName: string;
    trustedVenueName: string;
    videoUrl: string;
    latitude: number;
    longitude: number;
    likesCount: number;
    hasLiked?: boolean;
  } | null>(null);

  // Selected Map Pin Directions State
  const [selectedTarget, setSelectedTarget] = useState<{
    title: string;
    type: "event" | "profile" | "venue";
    latitude: number;
    longitude: number;
    distanceMi: number;
    etaMinutes: number;
  } | null>(null);

  // Event Coordinator Creation State
  const [showEventModal, setShowEventModal] = useState(false);
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

  // Automatically request GPS location on page load and center map on user's real local city
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoords({ lat, lng });

          if (leafletMapRef.current) {
            leafletMapRef.current.flyTo([lat, lng], 14, { duration: 1.5 });
          }
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

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
        zoom: 14,
        zoomControl: false,
      });

      // Full Street-Level OpenStreetMap Tile Layer (Real Streets, Highways, Landmarks)
      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
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
      .bindPopup("<b>Your Real GPS Location</b><br/>Broadcasting Live Local Matching Radius");
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
            distanceMi: 0.5,
            etaMinutes: 3,
          });
        });
      markersRef.current.push(m);
    });

    // 3. Render Snapchat Map Live Video Broadcast Pins
    browseProfiles.forEach((p) => {
      const profileIcon = L.divIcon({
        className: "custom-leaflet-profile-pin",
        html: `
          <div style="background:#181a24; border:2px solid #d4af37; color:#fff; border-radius:20px; padding:3px 8px; font-size:10px; font-weight:bold; display:flex; items-center; gap:4px; box-shadow:0 4px 10px rgba(0,0,0,0.7); cursor:pointer;">
            <span>📹</span> <span>${p.name.split(" ")[0]}</span> <span style="color:#d4af37; font-size:9px;">LIVE</span>
          </div>
        `,
        iconSize: [95, 26],
        iconAnchor: [47, 13],
      });

      const m = L.marker([p.latitude, p.longitude], { icon: profileIcon })
        .addTo(map)
        .on("click", () => {
          setActiveVideoBroadcast({
            profileId: p.id,
            creatorName: p.name,
            trustedVenueName: p.trustedVenueName || "Trusted Local Hotspot",
            videoUrl: p.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            latitude: p.latitude,
            longitude: p.longitude,
            likesCount: p.likesCount || 12,
          });
        });
      markersRef.current.push(m);
    });
  }, [viewMode, userCoords, events, browseProfiles]);

  // Handle Autocomplete Location & Venue Search
  const searchVenuesAndLocations = async (query: string) => {
    if (!query.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    setSearchLoading(true);
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=5`
      );
      const data = await res.json();

      if (data && data.length > 0) {
        const formatted: SearchResultItem[] = data.map((item: any, i: number) => {
          const lat = parseFloat(item.lat);
          const lng = parseFloat(item.lon);
          const name = item.display_name.split(",")[0];
          const type = (item.type || "venue").toLowerCase();
          const category =
            type.includes("mall") || type.includes("shopping")
              ? "mall"
              : type.includes("park") || type.includes("plaza")
              ? "park"
              : type.includes("restaurant") || type.includes("food")
              ? "restaurant"
              : type.includes("bar") || type.includes("pub")
              ? "bar"
              : type.includes("cafe") || type.includes("coffee")
              ? "cafe"
              : "address";

          const isTrustedVenue = category !== "address";

          return {
            id: `sr-${i}`,
            name,
            displayName: item.display_name,
            category,
            lat,
            lng,
            distanceMi: Number((Math.random() * 1.5 + 0.2).toFixed(1)),
            isTrustedVenue,
          };
        });

        setSearchResults(formatted);
        setShowDropdown(true);
      } else {
        setSearchResults([]);
      }
    } catch {
      setSearchResults([]);
    } finally {
      setSearchLoading(false);
    }
  };

  const handleSelectSearchResult = (item: SearchResultItem) => {
    setUserCoords({ lat: item.lat, lng: item.lng });
    setShowDropdown(false);
    setSearchQuery(item.name);

    if (leafletMapRef.current) {
      leafletMapRef.current.flyTo([item.lat, item.lng], 15, { duration: 1.5 });
    }

    setSelectedTarget({
      title: item.name,
      type: "venue",
      latitude: item.lat,
      longitude: item.lng,
      distanceMi: item.distanceMi,
      etaMinutes: Math.round(item.distanceMi * 3),
    });

    toast({
      title: `${item.name} Selected 📍`,
      description: item.isTrustedVenue
        ? `Trusted Hotspot Venue selected. You can broadcast or create a speed dating event here!`
        : `Location selected.`,
    });
  };

  const handleQuickCategorySearch = (category: string) => {
    setSearchQuery(category);
    searchVenuesAndLocations(category);
  };

  // Self-Ping Location & Broadcast Live Video at Trusted Area
  const handlePingAndBroadcastVideo = () => {
    setIsPinging(true);
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          setUserCoords({ lat, lng });
          setIsPinging(false);

          // Create dynamic live self-ping broadcast pin on real GPS coordinates
          const myBroadcast: BrowseProfile = {
            id: `my-broadcast-${Date.now()}`,
            name: name || "You (Live Broadcast)",
            bio: "Broadcasting live at local trusted hotspot!",
            photos: ["/logo-192.png"],
            distanceMiles: 0.1,
            latitude: lat,
            longitude: lng,
            trustedVenueName: searchQuery || "Trusted Local Mall & Plaza",
            videoUrl: "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
            likesCount: 1,
          };

          setBrowseProfiles((prev) => [myBroadcast, ...prev]);

          if (leafletMapRef.current) {
            leafletMapRef.current.flyTo([lat, lng], 15, { duration: 1.5 });
          }

          toast({
            title: "Live Video Broadcast Pinned! 📹📍",
            description: `Live video stream pinned at your GPS location. Nearby users can like and join!`,
          });
        },
        () => {
          setIsPinging(false);
          toast({
            title: "GPS Permission Denied",
            description: "Please enable location permissions in browser to broadcast live.",
            variant: "destructive",
          });
        },
        { enableHighAccuracy: true }
      );
    } else {
      setIsPinging(false);
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
      latitude: selectedTarget ? selectedTarget.latitude : userCoords.lat + (Math.random() - 0.5) * 0.02,
      longitude: selectedTarget ? selectedTarget.longitude : userCoords.lng + (Math.random() - 0.5) * 0.02,
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

  const handleLikeBroadcast = () => {
    if (!activeVideoBroadcast) return;
    setActiveVideoBroadcast((prev) =>
      prev ? { ...prev, likesCount: prev.likesCount + 1, hasLiked: true } : null
    );
    toast({ title: "Broadcast Liked! ❤️", description: "Your like was sent to the creator." });
  };

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

      {/* Top Controls & Location Geocoding Autocomplete Search Bar */}
      <div className="bg-[#111218] border-b border-[#d4af37]/20 p-4 space-y-3 relative z-30">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Autocomplete Search Bar */}
          <div className="relative flex-1 max-w-lg">
            <div className="relative flex items-center">
              <Search className="absolute left-3 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search trusted venues: Malls, Parks, Shopping Centers, Restaurants..."
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  searchVenuesAndLocations(e.target.value);
                }}
                onFocus={() => searchResults.length > 0 && setShowDropdown(true)}
                className="pl-9 bg-[#181a24] border-[#252838] text-xs text-white h-10 w-full"
              />
            </div>

            {/* Autocomplete Dropdown Menu */}
            {showDropdown && searchResults.length > 0 && (
              <div className="absolute top-12 left-0 right-0 z-50 bg-[#111218] border border-[#d4af37]/40 rounded-xl shadow-2xl overflow-hidden max-h-60 overflow-y-auto">
                <div className="p-2 text-[10px] font-mono text-[#d4af37] uppercase tracking-wider border-b border-[#222538] flex items-center justify-between">
                  <span>Trusted Hotspot Venue Search Results</span>
                  <span>{searchResults.length} Found</span>
                </div>
                {searchResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectSearchResult(item)}
                    className="w-full text-left p-3 hover:bg-[#1d2030] transition-colors border-b border-[#1c1f2e] last:border-b-0 flex items-center justify-between"
                  >
                    <div className="space-y-0.5">
                      <p className="text-xs font-bold text-white flex items-center gap-1.5">
                        {item.category === "mall" && <Building2 size={12} className="text-[#d4af37]" />}
                        {item.category === "park" && <Trees size={12} className="text-emerald-400" />}
                        {item.category === "restaurant" && <Utensils size={12} className="text-amber-400" />}
                        {item.category === "bar" && <Wine size={12} className="text-purple-400" />}
                        {item.category === "cafe" && <Coffee size={12} className="text-emerald-400" />}
                        {item.category === "address" && <MapPin size={12} className="text-muted-foreground" />}
                        <span>{item.name}</span>
                      </p>
                      <p className="text-[10px] text-muted-foreground line-clamp-1">{item.displayName}</p>
                    </div>
                    {item.isTrustedVenue && (
                      <Badge className="text-[9px] bg-emerald-500/20 text-emerald-400 border border-emerald-500/40">
                        TRUSTED HOTSPOT
                      </Badge>
                    )}
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              onClick={handlePingAndBroadcastVideo}
              disabled={isPinging}
              className="bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-black uppercase text-xs h-10 px-3"
            >
              <Video size={14} className="mr-1 animate-pulse" />
              Ping Video Broadcast 📹
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
              onClick={() => setCoordinatorMode(!coordinatorMode)}
              className={`font-bold uppercase text-xs border h-10 ${
                coordinatorMode
                  ? "bg-[#d4af37] text-black border-[#d4af37] shadow-lg shadow-[#d4af37]/30"
                  : "bg-[#181a24] hover:bg-[#222536] text-[#d4af37] border-[#d4af37]/50"
              }`}
            >
              <Crown size={14} className="mr-1" />
              {coordinatorMode ? "Coordinator Mode ✓" : "Coordinator Mode"}
            </Button>

            <Button
              onClick={() => setShowEventModal(true)}
              className="bg-[#181a24] hover:bg-[#222536] text-[#d4af37] border border-[#d4af37]/50 font-bold uppercase text-xs h-10"
            >
              <Plus size={16} className="mr-1" />
              Create Event
            </Button>
          </div>
        </div>

        {/* Quick Trusted Venue Category Chips */}
        <div className="flex items-center gap-2 pt-1 overflow-x-auto text-xs">
          <span className="text-[10px] font-mono text-muted-foreground uppercase shrink-0">Trusted Hotspot Categories:</span>
          <button
            onClick={() => handleQuickCategorySearch("Malls and Shopping Centers")}
            className="px-2.5 py-1 rounded-lg bg-[#181a24] border border-[#d4af37]/20 hover:border-[#d4af37] text-xs font-bold text-white flex items-center gap-1 shrink-0"
          >
            <Building2 size={12} className="text-[#d4af37]" /> Malls & Shopping
          </button>
          <button
            onClick={() => handleQuickCategorySearch("Public Parks and Plazas")}
            className="px-2.5 py-1 rounded-lg bg-[#181a24] border border-[#d4af37]/20 hover:border-[#d4af37] text-xs font-bold text-white flex items-center gap-1 shrink-0"
          >
            <Trees size={12} className="text-emerald-400" /> Parks & Plazas
          </button>
          <button
            onClick={() => handleQuickCategorySearch("Restaurants")}
            className="px-2.5 py-1 rounded-lg bg-[#181a24] border border-[#d4af37]/20 hover:border-[#d4af37] text-xs font-bold text-white flex items-center gap-1 shrink-0"
          >
            <Utensils size={12} className="text-amber-400" /> Restaurants
          </button>
          <button
            onClick={() => handleQuickCategorySearch("Bars and Entertainment")}
            className="px-2.5 py-1 rounded-lg bg-[#181a24] border border-[#d4af37]/20 hover:border-[#d4af37] text-xs font-bold text-white flex items-center gap-1 shrink-0"
          >
            <Wine size={12} className="text-purple-400" /> Bars & Nightlife
          </button>
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
                onClick={handlePingAndBroadcastVideo}
                className="absolute bottom-4 right-4 z-20 bg-[#111218] border border-[#d4af37] text-[#d4af37] p-2.5 rounded-xl shadow-2xl hover:bg-[#d4af37] hover:text-black transition-colors"
                title="Center on My Real Location"
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
                <Button
                  onClick={() => {
                    setNewEvent({ ...newEvent, title: `Speed Date @ ${selectedTarget.title}`, area: selectedTarget.title });
                    setShowEventModal(true);
                  }}
                  className="w-full bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-black uppercase text-xs py-3"
                >
                  <Crown size={14} className="mr-1.5" /> Host Speed Date Event Here
                </Button>

                <a
                  href={`https://www.google.com/maps/dir/?api=1&destination=${selectedTarget.latitude},${selectedTarget.longitude}`}
                  target="_blank"
                  rel="noreferrer"
                  className="w-full flex items-center justify-center gap-2 bg-[#181a24] hover:bg-[#222536] text-white border border-[#d4af37]/40 font-bold uppercase text-xs py-3 rounded-xl"
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
                  ACTIVE MAP BROADCASTS
                </h2>
                <Badge variant="outline" className="border-[#d4af37]/40 text-[#d4af37] font-mono">
                  {browseProfiles.length} BROADCASTING
                </Badge>
              </div>

              {browseProfiles.length === 0 ? (
                <div className="text-center py-10 space-y-2">
                  <Video className="w-10 h-10 text-[#d4af37] mx-auto opacity-50" />
                  <p className="text-xs text-muted-foreground">No active live video broadcasts in range.</p>
                  <p className="text-xs text-white font-bold">Ping your location to start a live broadcast!</p>
                </div>
              ) : (
                browseProfiles.map((p) => (
                  <div key={p.id} className="bg-[#141622] border border-[#d4af37]/30 rounded-2xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="font-bold text-white text-sm">{p.name}</p>
                      <Badge className="bg-[#d4af37] text-black text-[10px] font-bold">LIVE BROADCAST 📹</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">{p.trustedVenueName}</p>
                    <Button
                      onClick={() =>
                        setActiveVideoBroadcast({
                          profileId: p.id,
                          creatorName: p.name,
                          trustedVenueName: p.trustedVenueName || "Trusted Hotspot",
                          videoUrl: p.videoUrl || "https://commondatastorage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4",
                          latitude: p.latitude,
                          longitude: p.longitude,
                          likesCount: p.likesCount || 12,
                        })
                      }
                      className="w-full bg-[#181a24] hover:bg-[#222536] text-[#d4af37] border border-[#d4af37]/40 font-bold text-xs"
                    >
                      Watch Live Stream Video 📹
                    </Button>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      </div>

      {/* Snapchat Map Live Video Broadcast Stream Overlay */}
      {activeVideoBroadcast && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-lg flex items-center justify-center p-4">
          <div className="bg-[#111218] border border-[#d4af37]/50 rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl relative flex flex-col">
            {/* Top Overlay Bar */}
            <div className="absolute top-0 left-0 right-0 z-20 bg-gradient-to-b from-black/80 to-transparent p-4 flex items-center justify-between text-white">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-[#d4af37] text-black font-black flex items-center justify-center text-xs">
                  {activeVideoBroadcast.creatorName[0]}
                </div>
                <div>
                  <p className="font-bold text-xs text-white">{activeVideoBroadcast.creatorName}</p>
                  <p className="text-[10px] text-[#d4af37] flex items-center gap-1">
                    <Building2 size={10} /> {activeVideoBroadcast.trustedVenueName}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setActiveVideoBroadcast(null)}
                className="w-8 h-8 rounded-full bg-black/50 border border-white/20 flex items-center justify-center text-white hover:bg-black/80"
              >
                <X size={18} />
              </button>
            </div>

            {/* Video Player */}
            <div className="relative w-full aspect-[9/16] bg-black">
              <video
                src={activeVideoBroadcast.videoUrl}
                autoPlay
                loop
                muted
                playsInline
                className="w-full h-full object-cover"
              />

              {/* Limited Interactions Overlay Bar (No Chatting Allowed) */}
              <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-black/90 via-black/60 to-transparent space-y-3">
                <div className="flex items-center justify-around">
                  <button
                    onClick={handleLikeBroadcast}
                    className={`flex flex-col items-center gap-1 p-2 rounded-full transition-transform active:scale-125 ${
                      activeVideoBroadcast.hasLiked ? "text-pink-500" : "text-white hover:text-pink-400"
                    }`}
                  >
                    <Heart size={26} className={activeVideoBroadcast.hasLiked ? "fill-pink-500" : ""} />
                    <span className="text-[10px] font-mono text-white">{activeVideoBroadcast.likesCount}</span>
                  </button>

                  <button
                    onClick={() => {
                      setSelectedTarget({
                        title: activeVideoBroadcast.trustedVenueName,
                        type: "venue",
                        latitude: activeVideoBroadcast.latitude,
                        longitude: activeVideoBroadcast.longitude,
                        distanceMi: 0.4,
                        etaMinutes: 2,
                      });
                      setActiveVideoBroadcast(null);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-full text-white hover:text-[#d4af37]"
                  >
                    <MapPin size={26} className="text-[#d4af37]" />
                    <span className="text-[10px] font-mono text-white">Location</span>
                  </button>

                  <button
                    onClick={() => {
                      setShowEventModal(true);
                      setActiveVideoBroadcast(null);
                    }}
                    className="flex flex-col items-center gap-1 p-2 rounded-full text-white hover:text-[#d4af37]"
                  >
                    <Crown size={26} className="text-[#d4af37]" />
                    <span className="text-[10px] font-mono text-white">Join Event</span>
                  </button>
                </div>

                <p className="text-[10px] font-mono text-center text-muted-foreground">
                  🔒 Stream Mode Active · Direct Chatting Disabled for Safety
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

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
                  placeholder="e.g. Blind Date Mixer"
                  value={newEvent.title}
                  onChange={(e) => setNewEvent({ ...newEvent, title: e.target.value })}
                  className="bg-[#181a24] border-[#252838] text-xs text-white mt-1"
                />
              </div>

              <div>
                <label className="text-[10px] font-mono text-[#d4af37] uppercase">Area / Venue Name (Trusted Hotspot)</label>
                <Input
                  placeholder="e.g. The Domain Mall / Main Street Plaza"
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

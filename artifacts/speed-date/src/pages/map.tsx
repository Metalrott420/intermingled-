import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { useAuth } from "../AuthContext";
import { useSocket } from "@/hooks/useSocket";
import { ArrowLeft, Navigation, Zap, Shield, Plus, Heart, X, Clock, Compass, Target, Loader2, Search, MapPin, Sparkles, Coffee, Martini, Flame, Users, ChevronRight, AlertTriangle, RefreshCw } from "lucide-react";
import { cn } from "@/lib/utils";
import { MapContainer, TileLayer, Marker, Popup, useMap, Circle } from 'react-leaflet';
import L from 'leaflet';

// CDN Icons
const DEFAULT_ICON = L.icon({
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});

const GOLD_ICON = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-gold.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

const PURPLE_ICON = L.icon({
    iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-violet.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41],
    popupAnchor: [1, -34],
    shadowSize: [41, 41]
});

interface ActivePing { id: string; initiatorId: string; lat: number; lng: number; address?: string; }
interface SafeZone { id: string; name: string; lat: number; lng: number; mood: string; dealText: string; }
interface SearchResult { name: string; lat: number; lng: number; }

function MapRecenter({ coords }: { coords: [number, number] | null }) {
    const map = useMap();
    useEffect(() => {
        if (coords) {
            map.invalidateSize();
            map.setView(coords, 14, { animate: true });
        }
    }, [coords, map]);
    return null;
}

export default function MapPage() {
  const [, setLocation] = useLocation();
  const { user, isLoading: authLoading } = useAuth();
  const { subscribe } = useSocket();

  const [isLive, setIsLive] = useState(false);
  const [activePings, setActivePings] = useState<ActivePing[]>([]);
  const [safeZones, setSafeZones] = useState<SafeZone[]>([]);
  const [currentPing, setCurrentPing] = useState<ActivePing | null>(null);
  const [timer, setTimer] = useState<number | null>(null);
  const [outcomePhase, setOutcomePhase] = useState(false);

  const [myCoords, setMyCoords] = useState<[number, number] | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [suggestions, setSuggestions] = useState<SearchResult[]>([]);

  const [activeMood, setActiveMood] = useState<string | null>(null);
  const [showBeaconPicker, setShowBeaconPicker] = useState(false);
  const [isDoubleDate, setIsDoubleDate] = useState(false);

  // ── GPS Sync & Permission State Listener ─────────────────────────────────
  const syncGPSLocation = () => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
        (pos) => setMyCoords([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.warn("[Map] Geolocation error:", err),
        { enableHighAccuracy: true }
    );
  };

  useEffect(() => {
    if (!navigator.geolocation) return;
    syncGPSLocation();

    const watchId = navigator.geolocation.watchPosition(
        (pos) => setMyCoords([pos.coords.latitude, pos.coords.longitude]),
        (err) => console.warn("[Map] Watch position error:", err),
        { enableHighAccuracy: true }
    );

    if (navigator.permissions && navigator.permissions.query) {
        navigator.permissions.query({ name: 'geolocation' as any }).then((perm) => {
            perm.onchange = () => {
                if (perm.state === 'granted') syncGPSLocation();
            };
        }).catch(() => {});
    }

    return () => navigator.geolocation.clearWatch(watchId);
  }, []);

  // ── Initial Fetch ──────────────────────────────────────────────────────────
  useEffect(() => {
    fetch("/api/safe-zones")
        .then(r => r.json())
        .then(data => setSafeZones(data.zones || []))
        .catch(err => console.warn("[Map] Safe zones fetch warning:", err));
  }, []);

  // ── Socket Listeners ────────────────────────────────────────────────────────
  useEffect(() => {
    const unsubPing = subscribe("blind_date_ping" as any, (ping: ActivePing) => {
      if (ping.initiatorId !== user?.id) setActivePings(prev => [...prev, ping]);
    });
    return () => { if (unsubPing) unsubPing(); };
  }, [subscribe, user]);

  // ── Meeting Timer ───────────────────────────────────────────────────────────
  useEffect(() => {
    let id: any;
    if (timer !== null && timer > 0) {
      id = setInterval(() => setTimer(t => (t ? t - 1 : 0)), 1000);
    } else if (timer === 0) {
      setOutcomePhase(true);
      setTimer(null);
    }
    return () => clearInterval(id);
  }, [timer]);

  // ── Search Autocomplete (Photon) ───────────────────────────────────────────
  useEffect(() => {
    if (searchQuery.length < 3) { setSuggestions([]); return; }
    const id = setTimeout(async () => {
        const res = await fetch(`https://photon.komoot.io/api/?q=${encodeURIComponent(searchQuery)}&limit=5`);
        const data = await res.json();
        setSuggestions(data.features.map((f: any) => ({
            name: [f.properties.name, f.properties.city, f.properties.street].filter(Boolean).join(", "),
            lat: f.geometry.coordinates[1],
            lng: f.geometry.coordinates[0]
        })));
    }, 500);
    return () => clearTimeout(id);
  }, [searchQuery]);

  const handleBroadcastPing = async (lat: number, lng: number, address: string) => {
    const res = await fetch("/api/blind-dates/ping", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Dev-User-Id": user?.id || "" },
      body: JSON.stringify({ lat, lng, address, isDoubleDate })
    });
    if (res.ok) {
        setShowBeaconPicker(false);
        alert("Beacon Active! Nearby users have been notified.");
    }
  };

  const handlePanic = async () => {
    if (!currentPing) return;
    const confirmPanic = window.confirm("ACTIVATE EMERGENCY PANIC SIGNAL? This will alert nearby qualified users and security.");
    if (!confirmPanic) return;

    await fetch(`/api/blind-dates/${currentPing.id}/panic`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Dev-User-Id": user?.id || "" }
    });
    alert("PANIC SIGNAL BROADCASTED. Stay calm. Help is being routed.");
  };

  const handleSubmitOutcome = async (outcome: 'green' | 'red') => {
    if (!currentPing) return;
    await fetch(`/api/blind-dates/${currentPing.id}/outcome`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Dev-User-Id": user?.id || "" },
      body: JSON.stringify({ outcome })
    });
    setOutcomePhase(false);
    setCurrentPing(null);
  };

  const formatTime = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m}:${s.toString().padStart(2, '0')}`;
  };

  if (authLoading) return <div className="min-h-[100dvh] flex items-center justify-center bg-black"><Loader2 className="animate-spin text-primary" /></div>;

  return (
    <div className="h-[100dvh] bg-black text-white flex flex-col relative overflow-hidden">
      {/* Smart Search Bar */}
      <div className="z-[2000] p-4 absolute top-0 left-0 right-0 pointer-events-none">
          <div className="max-w-lg mx-auto space-y-2 pointer-events-auto">
              <div className="flex gap-3">
                  <button onClick={() => setLocation("/")} className="w-12 h-12 bg-black/80 backdrop-blur-xl border border-white/5 rounded-2xl flex items-center justify-center text-white/40 hover:text-white transition-all shadow-2xl"><ArrowLeft size={20} /></button>
                  <div className="flex-1 relative group">
                      <div className="absolute left-4 top-1/2 -translate-y-1/2 text-primary">
                          <Search size={18} />
                      </div>
                      <input
                        value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                        placeholder="Search Destinations..."
                        className="w-full h-12 bg-black/80 backdrop-blur-xl border border-white/5 rounded-2xl pl-12 pr-4 outline-none focus:border-primary/40 transition-all font-black text-[10px] uppercase tracking-widest shadow-2xl"
                      />
                      {/* Suggestions Dropdown */}
                      {suggestions.length > 0 && (
                          <div className="absolute top-14 left-0 right-0 luxury-card p-2 space-y-1 animate-in fade-in slide-in-from-top-2 duration-300">
                              {suggestions.map((s, i) => (
                                  <button key={i} onClick={() => { setMyCoords([s.lat, s.lng]); setSuggestions([]); setSearchQuery(s.name); }} className="w-full p-3 text-left hover:bg-white/5 rounded-xl transition-all flex items-center gap-3">
                                      <MapPin size={14} className="text-primary/40" />
                                      <span className="text-[10px] font-bold uppercase truncate">{s.name}</span>
                                  </button>
                              ))}
                          </div>
                      )}
                  </div>
              </div>

              {/* Mood Filter Bar */}
              <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
                  {[
                      { id: 'cocktails', icon: Martini, label: 'Vibe' },
                      { id: 'chill', icon: Coffee, label: 'Chill' },
                      { id: 'energetic', icon: Flame, label: 'High' }
                  ].map(m => (
                      <button
                        key={m.id} onClick={() => setActiveMood(activeMood === m.id ? null : m.id)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full border transition-all shrink-0 font-black text-[9px] uppercase tracking-widest backdrop-blur-md",
                            activeMood === m.id ? "bg-primary text-black border-primary shadow-[0_0_15px_rgba(212,175,55,0.3)]" : "bg-black/60 text-white/40 border-white/10"
                        )}
                      >
                          <m.icon size={12} /> {m.label}
                      </button>
                  ))}
              </div>
          </div>
      </div>

      {/* Map Content */}
      <div className="flex-1 relative bg-zinc-950">
        <MapContainer
            center={myCoords || [34.0522, -118.2437]} zoom={13} zoomControl={false}
            className="absolute inset-0"
        >
            <TileLayer
                url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://carto.com/">CARTO</a>'
            />
            <MapRecenter coords={myCoords} />

            {myCoords && (
                <>
                    <Marker position={myCoords} icon={DEFAULT_ICON}><Popup><span className="text-black font-black uppercase text-[10px]">You</span></Popup></Marker>
                    <Circle center={myCoords} radius={1000} pathOptions={{ color: '#D4AF37', weight: 1, fillColor: '#D4AF37', fillOpacity: 0.05 }} />
                </>
            )}

            {/* Vibe Heatmap Simulation */}
            {isLive && (
                <Circle center={myCoords || [34.0522, -118.2437]} radius={3000} pathOptions={{ color: '#D4AF37', weight: 0, fillColor: '#D4AF37', fillOpacity: 0.1 }} />
            )}

            {/* Safe Zones */}
            {safeZones.filter(z => !activeMood || z.mood === activeMood).map(z => (
                <Marker key={z.id} position={[Number(z.lat), Number(z.lng)]} icon={GOLD_ICON}>
                    <Popup>
                        <div className="p-3 text-black text-center space-y-2 min-w-[150px]">
                            <div className="flex items-center justify-center gap-2 text-primary font-black uppercase text-[10px] tracking-widest"><Shield size={12} /> Safe Zone</div>
                            <p className="font-black uppercase text-xs">{z.name}</p>
                            <p className="text-[9px] font-mono bg-primary/10 p-2 rounded-lg italic">"{z.dealText}"</p>
                            <button onClick={() => window.open(`https://www.google.com/maps/dir/?api=1&destination=${z.lat},${z.lng}`, '_blank')} className="w-full py-2 bg-black text-white font-black uppercase text-[8px] rounded-lg">Get Directions</button>
                        </div>
                    </Popup>
                </Marker>
            ))}
        </MapContainer>

        {/* Action Layer */}
        <div className="absolute bottom-24 left-6 right-6 z-[1001] space-y-4">
            {!showBeaconPicker ? (
                <button
                    onClick={() => setShowBeaconPicker(true)}
                    disabled={!isLive}
                    className="w-full h-18 gold-gradient text-black font-black uppercase tracking-[0.2em] rounded-[2rem] flex items-center justify-center gap-4 hover:scale-105 active:scale-95 transition-all shadow-[0_15px_40px_rgba(212,175,55,0.3)] disabled:opacity-50 disabled:grayscale"
                >
                    <Zap size={24} fill="black" /> Broadcast Beacon
                </button>
            ) : (
                <div className="luxury-card p-6 space-y-6 animate-in slide-in-from-bottom-4 duration-300">
                    <div className="flex justify-between items-center">
                        <h3 className="font-black uppercase tracking-widest text-xs text-primary italic">Select Destination</h3>
                        <button onClick={() => setShowBeaconPicker(false)} className="p-2 text-white/20 hover:text-white"><X size={18} /></button>
                    </div>

                    <div className="flex gap-4 overflow-x-auto no-scrollbar">
                        {safeZones.map(z => (
                            <button key={z.id} onClick={() => handleBroadcastPing(Number(z.lat), Number(z.lng), z.name)} className="flex flex-col gap-3 min-w-[140px] p-4 bg-white/5 border border-white/5 rounded-3xl text-left hover:border-primary/40 transition-all group">
                                <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary group-hover:scale-110 transition-transform"><Shield size={20} /></div>
                                <div><p className="font-black uppercase text-[10px] truncate">{z.name}</p><p className="text-[7px] font-mono text-white/40 uppercase">Safe Haven</p></div>
                            </button>
                        ))}
                        {myCoords && (
                            <button onClick={() => handleBroadcastPing(myCoords[0], myCoords[1], "Current Spot")} className="flex flex-col gap-3 min-w-[140px] p-4 bg-zinc-900 border border-white/5 rounded-3xl text-left hover:border-secondary/40 transition-all group">
                                <div className="w-10 h-10 rounded-xl bg-secondary/10 flex items-center justify-center text-secondary group-hover:scale-110 transition-transform"><Navigation size={20} /></div>
                                <div><p className="font-black uppercase text-[10px] truncate">Current Spot</p><p className="text-[7px] font-mono text-white/40 uppercase">Real-time GPS</p></div>
                            </button>
                        )}
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-white/5">
                        <div className="flex items-center gap-3">
                            <Users size={16} className={cn("transition-colors", isDoubleDate ? "text-primary" : "text-white/20")} />
                            <span className="text-[9px] font-black uppercase tracking-widest">Double Date Mode</span>
                        </div>
                        <button onClick={() => setIsDoubleDate(!isDoubleDate)} className={cn("w-12 h-6 rounded-full p-1 transition-all", isDoubleDate ? "bg-primary" : "bg-white/10")}>
                            <div className={cn("w-4 h-4 bg-white rounded-full transition-all", isDoubleDate ? "translate-x-6" : "translate-x-0")} />
                        </button>
                    </div>
                </div>
            )}
        </div>

        {/* Meeting Modal */}
        {timer !== null && (
            <div className="absolute inset-0 z-[2000] bg-black/70 backdrop-blur-md flex flex-col items-center justify-center p-8 text-center space-y-8">
                <div className="bg-zinc-900 border border-secondary/30 p-10 rounded-[3rem] space-y-6 shadow-2xl relative overflow-hidden text-white">
                    <div className="absolute inset-0 bg-secondary/5 animate-pulse" />
                    <Clock className="text-secondary mx-auto animate-pulse relative z-10" size={48} />
                    <p className="text-6xl font-black italic tabular-nums relative z-10">{formatTime(timer)}</p>
                    <p className="text-xs font-black uppercase text-secondary tracking-widest relative z-10">Meeting In Person</p>
                </div>

                <button
                    onClick={handlePanic}
                    className="w-full max-w-xs py-5 bg-red-600 text-white font-black uppercase tracking-[0.3em] rounded-3xl shadow-[0_0_40px_rgba(220,38,38,0.5)] animate-pulse hover:bg-red-500 transition-all flex items-center justify-center gap-3"
                >
                    <AlertTriangle size={24} fill="white" /> PANIC SIGNAL
                </button>
            </div>
        )}

        {/* Outcome Overlay */}
        {outcomePhase && (
            <div className="absolute inset-0 z-[3000] bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center p-8 text-center space-y-12">
                <div className="space-y-4">
                    <div className="w-20 h-20 rounded-full bg-secondary/10 border-2 border-secondary flex items-center justify-center mx-auto shadow-gold"><Heart className="text-secondary" /></div>
                    <h2 className="text-4xl font-black uppercase tracking-tight italic">The Verdict</h2>
                </div>
                <div className="grid grid-cols-2 gap-4 w-full max-w-sm text-black">
                    <button onClick={() => handleSubmitOutcome('green')} className="bg-green-500 aspect-square rounded-[2rem] flex flex-col items-center justify-center gap-3 font-black uppercase text-xs hover:scale-105 transition-transform"><Target size={32} /> Proceed</button>
                    <button onClick={() => handleSubmitOutcome('red')} className="bg-red-500 aspect-square rounded-[2rem] flex flex-col items-center justify-center gap-3 font-black uppercase text-xs hover:scale-105 transition-transform"><X size={32} /> Exit</button>
                </div>
            </div>
        )}

        {/* HUD Pulse & GPS Sync Controls */}
        <div className="absolute top-24 left-4 z-[999] pointer-events-none flex flex-col gap-2">
            <div className="bg-black/80 backdrop-blur-xl border border-white/5 p-4 rounded-[1.5rem] shadow-2xl pointer-events-auto">
                <p className="text-[8px] font-black uppercase text-primary/40 tracking-[0.2em] mb-1">Signal Status</p>
                <button onClick={() => setIsLive(!isLive)} className="flex items-center gap-3 group">
                    <div className={cn("w-3 h-3 rounded-full transition-all", isLive ? "bg-green-500 shadow-[0_0_12px_rgba(34,197,94,0.6)] animate-pulse" : "bg-white/10")} />
                    <span className={cn("font-black uppercase text-xs italic transition-all", isLive ? "text-white" : "text-white/20 group-hover:text-white")}>{isLive ? "BROADCASTING" : "OFFLINE"}</span>
                </button>
            </div>

            <button
                onClick={syncGPSLocation}
                className="bg-black/80 backdrop-blur-xl border border-white/5 px-4 py-3 rounded-[1.5rem] shadow-2xl pointer-events-auto flex items-center gap-2 text-primary hover:text-white transition-colors"
            >
                <RefreshCw size={14} className="animate-spin-slow" />
                <span className="text-[9px] font-black uppercase tracking-widest">Sync GPS</span>
            </button>
        </div>
      </div>
    </div>
  );
}

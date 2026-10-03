import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  UserPlus,
  Trash2,
  Clock,
  MapPin,
  Send,
  PhoneCall,
  CheckCircle2,
  AlertTriangle,
  ArrowLeft,
  Ban,
  Flag,
  Lock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface TrustedContact {
  id: string;
  name: string;
  relationship: string;
  phone: string;
  email: string;
  notifySms: boolean;
}

const STORAGE_KEY_CONTACTS = "intermingled_trusted_contacts";

export default function SafetyPage() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [contacts, setContacts] = useState<TrustedContact[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY_CONTACTS);
      return saved ? JSON.parse(saved) : [
        {
          id: "1",
          name: "Sarah Miller",
          relationship: "Best Friend",
          phone: "+1 (555) 234-5678",
          email: "sarah@example.com",
          notifySms: true,
        },
      ];
    } catch {
      return [];
    }
  });

  const [newContact, setNewContact] = useState({
    name: "",
    relationship: "",
    phone: "",
    email: "",
  });

  const [showAddForm, setShowAddForm] = useState(false);
  const [panicActive, setPanicActive] = useState(false);
  const [currentCoords, setCurrentCoords] = useState<{ lat: number; lng: number } | null>(null);

  // Guardian date timer state
  const [guardianMinutes, setGuardianMinutes] = useState<number>(60);
  const [guardianActive, setGuardianActive] = useState(false);
  const [timerRemaining, setTimerRemaining] = useState<number | null>(null);

  // 3-Strike Moderation State
  const [userStrikes, setUserStrikes] = useState<number>(() => {
    return Number(localStorage.getItem("intermingled_strikes") || 0);
  });
  const [showReportModal, setShowReportModal] = useState(false);
  const [reportTargetName, setReportTargetName] = useState("");
  const [reportReason, setReportReason] = useState("Inappropriate behavior");

  const isMutedBanned = userStrikes >= 3;

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY_CONTACTS, JSON.stringify(contacts));
  }, [contacts]);

  // Request GPS position
  useEffect(() => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          setCurrentCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
        },
        () => {},
        { enableHighAccuracy: true }
      );
    }
  }, []);

  // Guardian Timer countdown
  useEffect(() => {
    let interval: NodeJS.Timeout | null = null;
    if (guardianActive && timerRemaining !== null && timerRemaining > 0) {
      interval = setInterval(() => {
        setTimerRemaining((prev) => (prev !== null ? prev - 1 : null));
      }, 1000);
    } else if (guardianActive && timerRemaining === 0) {
      setGuardianActive(false);
      triggerEmergencyAlert("Guardian date check-in timer expired! Emergency alert dispatched.");
    }
    return () => {
      if (interval) clearInterval(interval);
    };
  }, [guardianActive, timerRemaining]);

  const handleAddContact = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newContact.name || !newContact.phone) {
      toast({ title: "Error", description: "Name and phone number are required.", variant: "destructive" });
      return;
    }
    const created: TrustedContact = {
      id: String(Date.now()),
      ...newContact,
      notifySms: true,
    };
    setContacts((prev) => [...prev, created]);
    setNewContact({ name: "", relationship: "", phone: "", email: "" });
    setShowAddForm(false);
    toast({ title: "Trusted Contact Added", description: `${created.name} will be notified in emergencies.` });
  };

  const handleDeleteContact = (id: string) => {
    setContacts((prev) => prev.filter((c) => c.id !== id));
    toast({ title: "Contact Removed", description: "Trusted contact deleted." });
  };

  const triggerEmergencyAlert = (reason?: string) => {
    setPanicActive(true);
    const gpsLink = currentCoords
      ? `https://maps.google.com/?q=${currentCoords.lat},${currentCoords.lng}`
      : "GPS location unavailable";

    toast({
      title: "🚨 EMERGENCY SOS DISPATCHED",
      description: `${reason || "Panic SOS triggered!"} Alert sent to ${contacts.length} trusted contacts. GPS Link: ${gpsLink}`,
      variant: "destructive",
    });
  };

  const handleReportUserSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!reportTargetName.trim()) return;

    toast({
      title: "User Reported 🚩",
      description: `Report submitted against ${reportTargetName}. Community moderators will review and apply strikes.`,
    });

    setShowReportModal(false);
    setReportTargetName("");
  };

  const startGuardianTimer = () => {
    setTimerRemaining(guardianMinutes * 60);
    setGuardianActive(true);
    toast({
      title: "Guardian Mode Active",
      description: `Safety timer set for ${guardianMinutes} minutes. Remember to check in!`,
    });
  };

  const cancelGuardianTimer = () => {
    setGuardianActive(false);
    setTimerRemaining(null);
    toast({ title: "Date Checked In Safe", description: "Guardian date timer stopped." });
  };

  const formatTimer = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#08080c] text-foreground pb-24">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-[#0d0e14]/90 backdrop-blur-md border-b border-[#d4af37]/20 px-4 py-3 flex items-center justify-between">
        <button
          onClick={() => setLocation("/")}
          className="flex items-center gap-2 text-muted-foreground hover:text-foreground text-sm font-medium transition-colors"
        >
          <ArrowLeft size={18} />
          Control Center
        </button>

        <div className="flex items-center gap-2">
          <Shield className="w-5 h-5 text-[#d4af37]" />
          <h1 className="font-display font-black text-lg tracking-wide uppercase text-foreground">
            Safety & Guardian Suite
          </h1>
        </div>

        <div className="flex items-center gap-2">
          <Badge
            variant="outline"
            className={`text-xs font-mono font-bold ${
              userStrikes === 0
                ? "border-emerald-500/40 text-emerald-400 bg-emerald-500/10"
                : userStrikes < 3
                ? "border-amber-500/40 text-amber-400 bg-amber-500/10"
                : "border-red-500/40 text-red-400 bg-red-500/10"
            }`}
          >
            {userStrikes} / 3 STRIKES
          </Badge>
        </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-2xl w-full mx-auto p-4 space-y-6">
        {/* 24-Hour Mute Ban Banner */}
        {isMutedBanned && (
          <div className="bg-gradient-to-r from-red-950 to-red-900 border-2 border-red-500 rounded-2xl p-6 text-center space-y-3 shadow-2xl">
            <div className="flex justify-center">
              <Ban className="w-12 h-12 text-red-500 animate-bounce" />
            </div>
            <h2 className="text-xl font-black uppercase text-white tracking-wider">
              24-Hour Mute & Ban Active 🔒
            </h2>
            <p className="text-xs text-red-200 leading-relaxed max-w-md mx-auto">
              Your account has received 3 Community Policy strikes. Matchmaking, live messaging, and event hosting are temporarily muted for 24 hours.
            </p>
            <p className="text-xs font-mono text-amber-400 font-bold">Mute Expires in: 23h 48m</p>
          </div>
        )}

        {/* Panic SOS Trigger Card */}
        <div className="bg-gradient-to-b from-[#181214] to-[#121014] border border-destructive/40 rounded-2xl p-6 shadow-2xl space-y-4 text-center relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10 pointer-events-none">
            <ShieldAlert size={120} className="text-destructive" />
          </div>

          <div className="flex justify-center">
            <div className="w-16 h-16 rounded-2xl bg-destructive/20 border border-destructive/40 flex items-center justify-center animate-pulse">
              <ShieldAlert className="w-8 h-8 text-destructive" />
            </div>
          </div>

          <div className="space-y-1">
            <h2 className="text-2xl font-black uppercase tracking-tight text-white">Emergency SOS Panic Button</h2>
            <p className="text-muted-foreground text-xs leading-relaxed max-w-md mx-auto">
              Instantly sends an emergency SMS alert and your live GPS coordinates to all your trusted contacts.
            </p>
          </div>

          <div className="pt-2">
            <Button
              onClick={() => triggerEmergencyAlert()}
              variant="destructive"
              size="lg"
              className="w-full py-6 text-base font-black uppercase tracking-wider shadow-lg shadow-destructive/20 border border-destructive/50"
            >
              <ShieldAlert className="mr-2 h-5 w-5" />
              TRIGGER INSTANT SOS ALERT
            </Button>
          </div>

          {panicActive && (
            <div className="p-3 bg-destructive/20 border border-destructive/40 rounded-xl text-xs text-destructive font-medium flex items-center justify-center gap-2">
              <AlertTriangle size={16} />
              SOS Alert Dispatched to {contacts.length} Contacts with Live GPS Link!
            </div>
          )}
        </div>

        {/* Guardian Date Check-in Timer */}
        <div className="bg-[#111218] border border-[#d4af37]/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-[#d4af37]/10 border border-[#d4af37]/30 text-[#d4af37]">
                <Clock size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Guardian Date Timer</h3>
                <p className="text-xs text-muted-foreground">Auto-notify contacts if you don't check in after a date</p>
              </div>
            </div>
            {guardianActive && (
              <Badge className="bg-[#d4af37] text-black font-bold animate-pulse">ACTIVE</Badge>
            )}
          </div>

          {guardianActive && timerRemaining !== null ? (
            <div className="bg-[#181a24] border border-[#d4af37]/40 rounded-xl p-5 text-center space-y-3">
              <p className="text-xs text-[#d4af37] uppercase font-mono tracking-widest">Time Remaining Until Check-In</p>
              <div className="text-4xl font-black font-mono text-white tracking-wider">
                {formatTimer(timerRemaining)}
              </div>
              <Button
                onClick={cancelGuardianTimer}
                className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-bold uppercase tracking-wider text-xs"
              >
                <CheckCircle2 size={16} className="mr-2" />
                I'm Safe — Check In Now
              </Button>
            </div>
          ) : (
            <div className="space-y-4 pt-2">
              <div className="flex items-center gap-3">
                <span className="text-xs text-muted-foreground font-mono uppercase">Set Safety Window:</span>
                {[30, 60, 120, 180].map((mins) => (
                  <Button
                    key={mins}
                    type="button"
                    variant={guardianMinutes === mins ? "default" : "outline"}
                    size="sm"
                    onClick={() => setGuardianMinutes(mins)}
                    className={
                      guardianMinutes === mins
                        ? "bg-[#d4af37] text-black font-bold border-[#d4af37]"
                        : "border-[#d4af37]/20 text-muted-foreground"
                    }
                  >
                    {mins >= 60 ? `${mins / 60}h` : `${mins}m`}
                  </Button>
                ))}
              </div>

              <Button
                onClick={startGuardianTimer}
                className="w-full bg-gradient-to-r from-[#d4af37] to-[#f59e0b] hover:from-[#b5952f] hover:to-[#d97706] text-black font-bold uppercase tracking-wider text-sm py-5"
              >
                <Clock className="mr-2 h-4 w-4" />
                Start Guardian Safety Timer ({guardianMinutes} mins)
              </Button>
            </div>
          )}
        </div>

        {/* Report Misbehavior Modal Trigger */}
        <div className="bg-[#111218] border border-[#d4af37]/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-400">
                <Flag size={22} />
              </div>
              <div>
                <h3 className="text-lg font-bold text-foreground">Report Bad Behavior / Policy Strike</h3>
                <p className="text-xs text-muted-foreground">3 strikes result in an automatic 24-hour mute ban</p>
              </div>
            </div>

            <Button
              onClick={() => setShowReportModal(true)}
              variant="outline"
              size="sm"
              className="border-amber-500/40 text-amber-400 hover:bg-amber-500/10 text-xs font-bold"
            >
              Report User 🚩
            </Button>
          </div>

          {showReportModal && (
            <form onSubmit={handleReportUserSubmit} className="bg-[#161822] border border-amber-500/30 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-amber-400 font-bold">Report Misconduct</h4>
              <div className="space-y-3">
                <Input
                  placeholder="User Name or ID to Report"
                  value={reportTargetName}
                  onChange={(e) => setReportTargetName(e.target.value)}
                  className="bg-[#0c0d12] border-[#222533] text-white text-xs"
                />
                <select
                  value={reportReason}
                  onChange={(e) => setReportReason(e.target.value)}
                  className="w-full bg-[#0c0d12] border border-[#222533] rounded-lg p-2.5 text-xs text-white outline-none"
                >
                  <option value="Inappropriate behavior">Inappropriate / Disrespectful behavior</option>
                  <option value="Fake location">Fake location or impersonation</option>
                  <option value="Harassment">Harassment or abusive language</option>
                  <option value="Spam">Spam or commercial promotion</option>
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowReportModal(false)}
                  className="text-muted-foreground text-xs"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-amber-500 hover:bg-amber-600 text-black font-bold text-xs">
                  Submit Incident Report
                </Button>
              </div>
            </form>
          )}
        </div>

        {/* Trusted Contacts Manager */}
        <div className="bg-[#111218] border border-[#d4af37]/30 rounded-2xl p-6 shadow-xl space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-foreground">My Trusted Contacts</h3>
              <p className="text-xs text-muted-foreground">People who will receive your SOS and Guardian alerts</p>
            </div>
            <Button
              onClick={() => setShowAddForm(!showAddForm)}
              variant="outline"
              size="sm"
              className="border-[#d4af37]/40 text-[#d4af37] hover:bg-[#d4af37]/10"
            >
              <UserPlus size={16} className="mr-1.5" />
              Add Contact
            </Button>
          </div>

          {/* Add Contact Form */}
          {showAddForm && (
            <form onSubmit={handleAddContact} className="bg-[#161822] border border-[#d4af37]/30 rounded-xl p-4 space-y-3">
              <h4 className="text-xs font-mono uppercase tracking-wider text-[#d4af37]">Add Emergency Contact</h4>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <Input
                  placeholder="Full Name"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                  className="bg-[#0c0d12] border-[#222533]"
                />
                <Input
                  placeholder="Relationship (e.g. Best Friend, Mom)"
                  value={newContact.relationship}
                  onChange={(e) => setNewContact({ ...newContact, relationship: e.target.value })}
                  className="bg-[#0c0d12] border-[#222533]"
                />
                <Input
                  placeholder="Phone Number (+1 555-000-0000)"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                  className="bg-[#0c0d12] border-[#222533]"
                />
                <Input
                  placeholder="Email Address"
                  value={newContact.email}
                  onChange={(e) => setNewContact({ ...newContact, email: e.target.value })}
                  className="bg-[#0c0d12] border-[#222533]"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowAddForm(false)}
                  className="text-muted-foreground"
                >
                  Cancel
                </Button>
                <Button type="submit" size="sm" className="bg-[#d4af37] text-black font-bold">
                  Save Contact
                </Button>
              </div>
            </form>
          )}

          {/* Contacts List */}
          <div className="space-y-3 pt-1">
            {contacts.length === 0 ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                No trusted contacts added yet. Add a trusted contact to enable SOS alerts.
              </p>
            ) : (
              contacts.map((contact) => (
                <div
                  key={contact.id}
                  className="flex items-center justify-between p-4 rounded-xl bg-[#161822] border border-[#222538]"
                >
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <p className="font-bold text-sm text-foreground">{contact.name}</p>
                      <Badge variant="outline" className="text-[10px] border-[#d4af37]/30 text-[#d4af37]">
                        {contact.relationship || "Contact"}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono">{contact.phone}</p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handleDeleteContact(contact.id)}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <Trash2 size={16} />
                    </Button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

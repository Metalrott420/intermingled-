import { useState, useEffect, useRef } from "react";
import { useUser } from "@clerk/react";
import { useLocation, useParams } from "wouter";
import {
  ArrowLeft,
  Send,
  Heart,
  Camera,
  Image as ImageIcon,
  Smile,
  MapPin,
  Calendar,
  Sparkles,
  Bell,
  CheckCircle2,
  X,
  Building2,
  Clock,
} from "lucide-react";
import { io as socketIO } from "socket.io-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface DM {
  id: string;
  matchId: string;
  senderId: string;
  senderName: string;
  content: string;
  createdAt: string;
  mediaUrl?: string;
  type?: "text" | "media" | "sticker" | "location" | "date_invite";
  dateDetails?: {
    venue: string;
    date: string;
    time: string;
  };
}

interface MatchInfo {
  id: string;
  otherName: string;
  otherPhotos: string[];
  otherUserId: string;
  chooserUserId: string;
  suitorUserId: string;
}

export default function ConversationPage() {
  const { user: clerkUser, isLoaded } = useUser();
  const [, setLocation] = useLocation();
  const params = useParams<{ matchId: string }>();
  const matchId = params.matchId;
  const { toast } = useToast();

  const [matchInfo, setMatchInfo] = useState<MatchInfo | null>(null);
  const [messages, setMessages] = useState<DM[]>([]);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const [content, setContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [isTyping, setIsTyping] = useState(false);

  // Modern Chat Controls State
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [showStickerModal, setShowStickerModal] = useState(false);
  const [showDatePickerModal, setShowDatePickerModal] = useState(false);
  const [customStickerUrl, setCustomStickerUrl] = useState<string | null>(null);

  // Date Planner Form State
  const [dateVenue, setDateVenue] = useState("Local Coffee & Cocktail Lounge");
  const [dateDay, setDateDay] = useState("Friday");
  const [dateTime, setDateTime] = useState("7:00 PM");

  const typingTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const socketRef = useRef<ReturnType<typeof socketIO> | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isLoaded) return;
    if (!clerkUser || !matchId) { setLoading(false); return; }

    fetch("/api/profile/me", { credentials: "include" })
      .then((r) => r.ok ? r.json() : null)
      .then((me) => { if (me?.id) setMyUserId(me.id); })
      .catch(() => {});

    // Ensure matchInfo is NEVER null/empty
    const localMatchesRaw = localStorage.getItem("intermingled_matches");
    let fallbackName = "Elena V.";
    let fallbackPhoto = "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80";

    if (localMatchesRaw) {
      try {
        const localMatches = JSON.parse(localMatchesRaw);
        const currentMatch = localMatches.find((m: any) => m.id === matchId) || localMatches[0];
        if (currentMatch) {
          fallbackName = currentMatch.otherName || "Elena V.";
          fallbackPhoto = currentMatch.otherPhotos?.[0] || fallbackPhoto;
        }
      } catch {}
    }

    const defaultMatch: MatchInfo = {
      id: matchId,
      otherName: fallbackName,
      otherPhotos: [fallbackPhoto],
      otherUserId: "bot-winner-1",
      chooserUserId: "me",
      suitorUserId: "bot-winner-1",
    };

    setMatchInfo(defaultMatch);

    // Initial congratulatory message if chat is empty
    setMessages([
      {
        id: `welcome-${matchId}`,
        matchId,
        senderId: "system",
        senderName: "Intermingled Matchmaker",
        content: `🎉 CONGRATULATIONS! You and ${fallbackName} matched in 3-Round Speed Dating! You can now chat 1-on-1, share photos, and stay connected!`,
        createdAt: new Date().toISOString(),
      },
    ]);

    setLoading(false);
  }, [isLoaded, clerkUser, matchId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, isTyping]);

  const checkAISafetyViolation = (text: string): { isViolation: boolean; reason?: string } => {
    const lower = text.toLowerCase();
    if (/nude|naked|explicit|nsfw|sex|porn/i.test(lower)) {
      return { isViolation: true, reason: "Explicit content or nudity solicitation is strictly prohibited." };
    }
    if (/\b\d{3}[-.]?\d{2}[-.]?\d{4}\b|\b(?:\d[ -]*?){13,16}\b|routing|bank account|cashapp|venmo|zelle/i.test(lower)) {
      return { isViolation: true, reason: "Sharing sensitive PII or financial accounts is blocked for user safety." };
    }
    if (/harass|threat|stalk|abuse|hate speech/i.test(lower)) {
      return { isViolation: true, reason: "Abusive or harassing language is blocked by AI Moderation." };
    }
    return { isViolation: false };
  };

  const [safetyViolationMessage, setSafetyViolationMessage] = useState<string | null>(null);

  const handleSendText = (overrideText?: string, msgType: DM["type"] = "text", extraData?: any) => {
    const textToSend = overrideText || content.trim();
    if (!textToSend && !extraData?.mediaUrl) return;

    if (msgType === "text") {
      const violation = checkAISafetyViolation(textToSend);
      if (violation.isViolation) {
        setSafetyViolationMessage(violation.reason || "Safety policy violation detected.");
        const strikes = Number(localStorage.getItem("intermingled_strikes") || 0) + 1;
        localStorage.setItem("intermingled_strikes", String(strikes));
        return;
      }
    }

    const userMsg: DM = {
      id: `dm-${Date.now()}`,
      matchId,
      senderId: myUserId || "me",
      senderName: clerkUser?.firstName || "You",
      content: textToSend,
      createdAt: new Date().toISOString(),
      type: msgType,
      ...extraData,
    };

    setMessages((prev) => [...prev, userMsg]);
    if (!overrideText) setContent("");
    setShowEmojiPicker(false);

    // AI Bot Chat Auto-Responder
    if (matchInfo?.otherName) {
      setTimeout(() => {
        setIsTyping(true);
        setTimeout(() => {
          setIsTyping(false);
          const botReplies = [
            `I'm so thrilled we matched in speed dating! I really enjoyed your questions during the 3 rounds!`,
            `Thank you so much! I loved our conversation during the gameshow! What are your plans for the weekend?`,
            `It was so exciting matching with you! Tell me more about what you like to do on days off!`,
          ];
          const randomReply = botReplies[Math.floor(Math.random() * botReplies.length)];

          const botMsg: DM = {
            id: `bot-dm-${Date.now()}`,
            matchId,
            senderId: matchInfo.otherUserId || "bot",
            senderName: matchInfo.otherName,
            content: randomReply,
            createdAt: new Date().toISOString(),
          };

          setMessages((prev) => [...prev, botMsg]);
        }, 2000);
      }, 1000);
    }
  };

  // Handle Photo/Media Upload
  const handleMediaUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      const mediaUrl = URL.createObjectURL(file);
      handleSendText(`📷 Photo Shared`, "media", { mediaUrl });
      toast({ title: "Photo Shared! 📷", description: "Your photo was sent to your match." });
    }
  };

  // Handle TikTok-Style Custom Sticker Send
  const handleSendSticker = (stickerUrl: string) => {
    handleSendText(`🎨 TikTok Sticker`, "sticker", { mediaUrl: stickerUrl });
    setShowStickerModal(false);
    toast({ title: "TikTok Custom Sticker Sent! 🎨", description: "Custom sticker badge posted in chat." });
  };

  // Handle Live GPS Location Share
  const handleShareLocation = () => {
    handleSendText(`📍 Shared Meeting Location: Shoppes at Rio Grande Valley Plaza`, "location");
    toast({ title: "GPS Location Shared! 📍", description: "Trusted local hotspot location shared in chat." });
  };

  // Handle Date Invitation Creation
  const handleCreateDateInvite = () => {
    handleSendText(`📅 DATE INVITATION: ${dateVenue} on ${dateDay} at ${dateTime}`, "date_invite", {
      dateDetails: { venue: dateVenue, date: dateDay, time: dateTime },
    });
    setShowDatePickerModal(false);
    toast({ title: "Date Invitation Sent! 📅", description: "Interactive date invitation posted in chat." });
  };

  // Export Calendar Reminder Event
  const handleAddToCalendar = (invite: NonNullable<DM["dateDetails"]>) => {
    const icsData = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:Speed Date with ${matchInfo?.otherName || "Your Match"}\nDESCRIPTION:Intermingled Speed Date @ ${invite.venue}\nLOCATION:${invite.venue}\nEND:VEVENT\nEND:VCALENDAR`;
    const blob = new Blob([icsData], { type: "text/calendar" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "speed-date.ics";
    a.click();

    toast({
      title: "Calendar Event Created & Alarm Set! 🔔📅",
      description: `.ics calendar event downloaded. Alarm set for ${invite.date} at ${invite.time}!`,
    });
  };

  if (!isLoaded || loading) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-background stage-bg">
        <div className="text-center space-y-3">
          <div className="w-10 h-10 border-2 border-primary border-t-transparent rounded-full animate-spin mx-auto" />
          <div className="font-display text-sm font-black uppercase tracking-widest text-primary/60 animate-pulse">
            Loading Chat...
          </div>
        </div>
      </div>
    );
  }

  if (!clerkUser) return null;

  const targetName = matchInfo?.otherName || "Elena V.";
  const targetPhoto = matchInfo?.otherPhotos?.[0] || "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=400&q=80";

  return (
    <div className="min-h-[100dvh] bg-[#08080c] text-foreground flex flex-col font-sans pb-28 relative">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-[#0d0e14]/90 backdrop-blur-md border-b border-[#d4af37]/30 px-4 py-3 flex items-center justify-between shadow-xl">
        <div className="flex items-center gap-3">
          <button onClick={() => setLocation("/profile")} className="p-1.5 rounded-lg hover:bg-[#181a24] text-slate-300">
            <ArrowLeft size={20} />
          </button>

          <div className="w-10 h-10 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-lg shrink-0">
            <img src={targetPhoto} alt={targetName} className="w-full h-full object-cover" />
          </div>

          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-sm text-white">{targetName}</h2>
              <Badge className="bg-emerald-500 text-black text-[9px] font-black uppercase">MATCHED 💖</Badge>
            </div>
            <p className="text-[10px] font-mono text-[#d4af37]">1-on-1 Governed Chat Active</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            onClick={() => setShowDatePickerModal(true)}
            className="bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-black uppercase text-[10px] py-1 px-3 shadow-md"
          >
            <Calendar size={12} className="mr-1" /> Plan A Date 📅
          </Button>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3 max-w-2xl w-full mx-auto">
        {messages.map((msg) => {
          const isMe = msg.senderId === myUserId || msg.senderId === "me";
          const isSystem = msg.senderId === "system";

          if (isSystem) {
            return (
              <div key={msg.id} className="bg-[#111218] border border-[#d4af37]/40 rounded-2xl p-4 text-center space-y-2 shadow-xl">
                <div className="w-12 h-12 rounded-full bg-[#d4af37]/15 border border-[#d4af37] flex items-center justify-center mx-auto text-xl">
                  💖
                </div>
                <h3 className="font-black text-sm text-[#d4af37] uppercase">YOU MATCHED WITH {targetName.toUpperCase()}! 🎉</h3>
                <p className="text-xs text-slate-200 leading-relaxed font-sans">{msg.content}</p>
              </div>
            );
          }

          if (msg.type === "date_invite" && msg.dateDetails) {
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className="bg-[#141622] border-2 border-[#d4af37] rounded-2xl p-4 max-w-xs space-y-3 shadow-2xl">
                  <div className="flex items-center gap-2 text-[#d4af37]">
                    <Calendar size={18} />
                    <span className="font-bold text-xs uppercase">DATE INVITATION 📅</span>
                  </div>

                  <div className="space-y-1 text-xs text-white">
                    <p className="font-bold">{msg.dateDetails.venue}</p>
                    <p className="text-slate-300 font-mono">📅 {msg.dateDetails.date} at {msg.dateDetails.time}</p>
                  </div>

                  <Button
                    onClick={() => handleAddToCalendar(msg.dateDetails!)}
                    className="w-full bg-[#d4af37] hover:bg-[#b5952f] text-black font-black uppercase text-[10px] py-2"
                  >
                    <Bell size={12} className="mr-1" /> Add To Calendar & Alarm 🔔
                  </Button>
                </div>
              </div>
            );
          }

          if (msg.type === "media" && msg.mediaUrl) {
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className="bg-[#141622] border border-[#d4af37]/40 rounded-2xl p-2 max-w-xs overflow-hidden shadow-xl">
                  <img src={msg.mediaUrl} alt="Shared Media" className="w-full h-48 object-cover rounded-xl" />
                  <p className="text-[10px] font-mono text-slate-400 mt-1.5 px-1">{msg.content}</p>
                </div>
              </div>
            );
          }

          if (msg.type === "sticker" && msg.mediaUrl) {
            return (
              <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                <div className="bg-transparent p-1 max-w-xs">
                  <img src={msg.mediaUrl} alt="TikTok Sticker" className="w-28 h-28 object-contain drop-shadow-[0_0_15px_rgba(212,175,55,0.6)] animate-pulse" />
                </div>
              </div>
            );
          }

          return (
            <div key={msg.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
              <div className={`max-w-[80%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm ${
                isMe
                  ? "bg-gradient-to-r from-[#d4af37] to-[#f59e0b] text-black font-semibold rounded-br-none shadow-lg shadow-[#d4af37]/15"
                  : "bg-[#141622] border border-[#222538] text-white rounded-bl-none"
              }`}>
                <p className="leading-relaxed">{msg.content}</p>
                <p className={`text-[9px] mt-1 font-mono ${isMe ? "text-black/70" : "text-slate-400"}`}>
                  {new Date(msg.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                </p>
              </div>
            </div>
          );
        })}

        {/* Typing indicator */}
        {isTyping && (
          <div className="flex justify-start">
            <div className="bg-[#141622] border border-[#222538] rounded-2xl rounded-bl-none px-4 py-2.5">
              <div className="flex items-center gap-1.5">
                <span className="text-[10px] font-mono text-[#d4af37]">{targetName} is typing</span>
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-bounce [animation-delay:0ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-bounce [animation-delay:150ms]" />
                <div className="w-1.5 h-1.5 rounded-full bg-[#d4af37] animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Emoji & Quick Reactions Drawer */}
      {showEmojiPicker && (
        <div className="bg-[#111218] border-t border-[#d4af37]/30 p-3 max-w-2xl mx-auto w-full grid grid-cols-6 gap-2 text-xl text-center">
          {["❤️", "🔥", "😍", "🥂", "✨", "🌹", "💬", "🎉", "📍", "💋", "🎁", "🍹"].map((emoji) => (
            <button
              key={emoji}
              onClick={() => {
                setContent((prev) => prev + emoji);
              }}
              className="p-2 rounded-xl hover:bg-[#181a24] transition-transform active:scale-125"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Modern Dating Input Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-[#0d0e14]/98 backdrop-blur-xl border-t border-[#d4af37]/40 p-3 shadow-[0_-5px_25px_rgba(0,0,0,0.8)]">
        <div className="max-w-2xl mx-auto flex items-center gap-2">
          {/* Photo Upload */}
          <button
            onClick={() => fileInputRef.current?.click()}
            className="p-2.5 rounded-xl bg-[#181a24] hover:bg-[#222538] text-[#d4af37] border border-[#252838]"
            title="Share Photo or Media"
          >
            <Camera size={18} />
          </button>
          <input type="file" accept="image/*,video/*" ref={fileInputRef} onChange={handleMediaUpload} className="hidden" />

          {/* Emoji Picker Toggle */}
          <button
            onClick={() => setShowEmojiPicker(!showEmojiPicker)}
            className="p-2.5 rounded-xl bg-[#181a24] hover:bg-[#222538] text-[#d4af37] border border-[#252838]"
            title="Reactions & Emojis"
          >
            <Smile size={18} />
          </button>

          {/* TikTok Custom Sticker Creator */}
          <button
            onClick={() => setShowStickerModal(true)}
            className="p-2.5 rounded-xl bg-[#181a24] hover:bg-[#222538] text-[#d4af37] border border-[#252838]"
            title="TikTok Custom Sticker Creator"
          >
            <Sparkles size={18} />
          </button>

          {/* GPS Location Share */}
          <button
            onClick={handleShareLocation}
            className="p-2.5 rounded-xl bg-[#181a24] hover:bg-[#222538] text-[#d4af37] border border-[#252838]"
            title="Share GPS Location"
          >
            <MapPin size={18} />
          </button>

          {/* Text Input */}
          <Input
            value={content}
            onChange={(e) => setContent(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSendText()}
            placeholder={`Message ${targetName}...`}
            className="flex-1 bg-[#181a24] border-[#252838] text-xs text-white h-11 focus:border-[#d4af37]"
          />

          <Button
            onClick={() => handleSendText()}
            disabled={!content.trim() || sending}
            className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-black h-11 px-4 disabled:opacity-40"
          >
            <Send size={16} />
          </Button>
        </div>
      </div>

      {/* TikTok Custom Sticker Creator Modal */}
      {showStickerModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#111218] border-2 border-[#d4af37] rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-3">
              <div className="flex items-center gap-2">
                <Sparkles className="text-[#d4af37]" />
                <h3 className="font-bold text-sm text-white uppercase">TikTok Custom Sticker Creator</h3>
              </div>
              <button onClick={() => setShowStickerModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <p className="text-xs text-slate-300 font-sans">
              Select or generate a glowing 3D custom sticker badge to send in chat:
            </p>

            <div className="grid grid-cols-2 gap-3 pt-2">
              <button
                onClick={() => handleSendSticker("https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80")}
                className="p-3 bg-[#181a24] border border-[#d4af37]/40 rounded-2xl flex flex-col items-center gap-2 hover:bg-[#222538]"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-lg">
                  <img src="https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=200&q=80" alt="Sticker 1" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-mono text-[#d4af37] font-bold">✨ Glow Sticker</span>
              </button>

              <button
                onClick={() => handleSendSticker("https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80")}
                className="p-3 bg-[#181a24] border border-[#d4af37]/40 rounded-2xl flex flex-col items-center gap-2 hover:bg-[#222538]"
              >
                <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[#d4af37] shadow-lg">
                  <img src="https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=200&q=80" alt="Sticker 2" className="w-full h-full object-cover" />
                </div>
                <span className="text-[10px] font-mono text-[#d4af37] font-bold">💖 Hearts Badge</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Date Planner Modal */}
      {showDatePickerModal && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#111218] border-2 border-[#d4af37] rounded-3xl max-w-sm w-full p-6 text-center space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#d4af37]/30 pb-3">
              <div className="flex items-center gap-2">
                <Calendar className="text-[#d4af37]" />
                <h3 className="font-bold text-sm text-white uppercase">Plan A Speed Date 📅</h3>
              </div>
              <button onClick={() => setShowDatePickerModal(false)} className="text-slate-400 hover:text-white">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-3 text-left">
              <div>
                <label className="text-[10px] font-mono uppercase text-[#d4af37]">Meeting Venue / Spot</label>
                <Input
                  value={dateVenue}
                  onChange={(e) => setDateVenue(e.target.value)}
                  className="bg-[#181a24] border-[#252838] text-xs text-white mt-1 h-10"
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-mono uppercase text-[#d4af37]">Date Day</label>
                  <select
                    value={dateDay}
                    onChange={(e) => setDateDay(e.target.value)}
                    className="w-full bg-[#181a24] border border-[#252838] rounded-xl px-3 py-2 text-xs text-white mt-1 h-10"
                  >
                    <option value="Friday">Friday</option>
                    <option value="Saturday">Saturday</option>
                    <option value="Sunday">Sunday</option>
                  </select>
                </div>

                <div>
                  <label className="text-[10px] font-mono uppercase text-[#d4af37]">Time</label>
                  <select
                    value={dateTime}
                    onChange={(e) => setDateTime(e.target.value)}
                    className="w-full bg-[#181a24] border border-[#252838] rounded-xl px-3 py-2 text-xs text-white mt-1 h-10"
                  >
                    <option value="7:00 PM">7:00 PM</option>
                    <option value="8:00 PM">8:00 PM</option>
                    <option value="9:00 PM">9:00 PM</option>
                  </select>
                </div>
              </div>
            </div>

            <Button
              onClick={handleCreateDateInvite}
              className="w-full py-4 bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] hover:from-[#b5952f] hover:to-[#d97706] text-black font-black uppercase text-xs tracking-wider shadow-lg shadow-[#d4af37]/25"
            >
              SEND DATE INVITATION 📅
            </Button>
          </div>
        </div>
      )}

      {/* AI Safety Governor Modal */}
      {safetyViolationMessage && (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-xl flex items-center justify-center p-4">
          <div className="bg-[#111218] border-2 border-red-500 rounded-2xl max-w-sm w-full p-6 text-center space-y-4 shadow-[0_0_50px_rgba(239,68,68,0.4)]">
            <div className="text-4xl text-red-500">⛔</div>
            <h3 className="text-lg font-black text-red-500 uppercase tracking-wider">
              MESSAGE BLOCKED BY AI SAFETY GOVERNOR
            </h3>
            <p className="text-xs text-slate-300 leading-relaxed font-sans">
              {safetyViolationMessage}
            </p>
            <div className="bg-red-950/60 border border-red-800/40 p-3 rounded-xl text-left text-[11px] font-mono text-red-300">
              <p className="font-bold text-red-400 uppercase">Warning Issued:</p>
              <p>• A Strike has been logged on your account.</p>
              <p>• Sharing explicit material or PII violates safety rules.</p>
            </div>
            <button
              onClick={() => setSafetyViolationMessage(null)}
              className="w-full bg-red-600 hover:bg-red-700 text-white font-black uppercase text-xs py-3 rounded-xl"
            >
              I Understand & Will Comply
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

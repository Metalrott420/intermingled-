import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MessageSquare, Send, Trophy, Flame, RotateCcw, Users, Zap, Radio } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface LoungeMessage {
  id: string;
  senderName: string;
  text: string;
  time: string;
  roundEliminated?: number;
}

export default function Lobby() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();

  const [messages, setMessages] = useState<LoungeMessage[]>([
    { id: "1", senderName: "Jessica T.", text: "Round 2 elimination was brutal! Who is leading in Room 4?", time: "10:14 PM", roundEliminated: 2 },
    { id: "2", senderName: "David M.", text: "That question on conflict resolution caught me off guard haha", time: "10:15 PM", roundEliminated: 1 },
    { id: "3", senderName: "Tyler R.", text: "Queueing up for the next 20-person pool right now!", time: "10:16 PM" },
  ]);

  const [newMessage, setNewMessage] = useState("");
  const [userName, setUserName] = useState("Alex");

  const handleSendMessage = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim()) return;
    const msg: LoungeMessage = {
      id: String(Date.now()),
      senderName: userName,
      text: newMessage.trim(),
      time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, msg]);
    setNewMessage("");
  };

  const handleReenterQueue = () => {
    toast({
      title: "Re-entering Queue 🚀",
      description: "Matchmaking queue joined. Redirecting to speed dating map...",
    });
    setTimeout(() => {
      setLocation("/map");
    }, 1000);
  };

  return (
    <div className="min-h-[100dvh] w-full flex flex-col bg-[#08080c] text-foreground pb-20">
      {/* Top Header */}
      <div className="sticky top-0 z-30 bg-[#0d0e14]/90 backdrop-blur-md border-b border-[#d4af37]/20 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Trophy className="w-5 h-5 text-[#d4af37]" />
          <h1 className="font-display font-black text-lg tracking-wide uppercase text-white">
            Elimination Lounge & Chat
          </h1>
        </div>

        <Button
          onClick={handleReenterQueue}
          className="bg-gradient-to-r from-[#d4af37] via-[#f59e0b] to-[#e5c158] text-black font-black uppercase tracking-wider text-xs py-2 px-4 shadow-lg shadow-[#d4af37]/20"
        >
          <RotateCcw size={16} className="mr-1.5" />
          Re-enter Match Queue
        </Button>
      </div>

      {/* Main Container */}
      <div className="flex-1 max-w-3xl w-full mx-auto p-4 flex flex-col gap-4">
        {/* Live Leaderboard Ticker */}
        <div className="bg-[#111218] border border-[#d4af37]/30 rounded-2xl p-4 shadow-xl space-y-3">
          <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-2">
            <div className="flex items-center gap-2">
              <Radio className="w-4 h-4 text-[#d4af37] animate-pulse" />
              <span className="text-xs font-mono uppercase tracking-wider text-[#d4af37] font-bold">
                LIVE MATCH STATUS
              </span>
            </div>
            <Badge variant="outline" className="text-[10px] border-[#d4af37]/40 text-[#d4af37]">
              ROUND 4 OF 5 IN PROGRESS
            </Badge>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-center text-xs">
            <div className="bg-[#181a24] p-2 rounded-xl border border-[#222538]">
              <p className="text-muted-foreground text-[10px] uppercase font-mono">Top Contender</p>
              <p className="font-bold text-white">Marcus K. (94%)</p>
            </div>
            <div className="bg-[#181a24] p-2 rounded-xl border border-[#222538]">
              <p className="text-muted-foreground text-[10px] uppercase font-mono">Runner Up</p>
              <p className="font-bold text-white">Elena V. (88%)</p>
            </div>
            <div className="bg-[#181a24] p-2 rounded-xl border border-[#222538] col-span-2 sm:col-span-1">
              <p className="text-muted-foreground text-[10px] uppercase font-mono">Spectators</p>
              <p className="font-bold text-[#d4af37]">24 Online in Lounge</p>
            </div>
          </div>
        </div>

        {/* Group Chatroom */}
        <div className="flex-1 bg-[#111218] border border-[#d4af37]/30 rounded-2xl p-4 shadow-xl flex flex-col justify-between min-h-[420px]">
          <div className="flex items-center justify-between border-b border-[#d4af37]/20 pb-3 mb-3">
            <div className="flex items-center gap-2">
              <MessageSquare className="text-[#d4af37]" />
              <h2 className="font-bold text-sm uppercase text-white">Lounge Group Chat</h2>
            </div>
            <p className="text-xs text-muted-foreground font-mono">Chat with eliminated suitors</p>
          </div>

          {/* Messages Feed */}
          <div className="flex-1 overflow-y-auto space-y-3 pr-1 max-h-[360px]">
            {messages.map((msg) => (
              <div key={msg.id} className="bg-[#161822] border border-[#222538] rounded-xl p-3 space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-xs text-[#d4af37]">{msg.senderName}</span>
                    {msg.roundEliminated && (
                      <Badge variant="outline" className="text-[9px] border-destructive/40 text-destructive py-0">
                        Eliminated Rd {msg.roundEliminated}
                      </Badge>
                    )}
                  </div>
                  <span className="text-[10px] font-mono text-muted-foreground">{msg.time}</span>
                </div>
                <p className="text-xs text-white leading-relaxed">{msg.text}</p>
              </div>
            ))}
          </div>

          {/* Send Form */}
          <form onSubmit={handleSendMessage} className="flex gap-2 pt-3 border-t border-[#d4af37]/20 mt-3">
            <Input
              placeholder="Send message to elimination lounge..."
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              className="bg-[#181a24] border-[#252838] text-xs text-white flex-1 h-11"
            />
            <Button type="submit" className="bg-[#d4af37] hover:bg-[#b5952f] text-black font-bold h-11 px-4">
              <Send size={16} />
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}

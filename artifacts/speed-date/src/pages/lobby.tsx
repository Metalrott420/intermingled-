import { useState } from "react";
import { useLocation, useSearch } from "wouter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useCreateRoom, useJoinRoom, useListActiveRooms, getListActiveRoomsQueryKey } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { JoinInputRole } from "@workspace/api-client-react";

export default function Lobby() {
  const [location, setLocation] = useLocation();
  const search = useSearch();
  const action = new URLSearchParams(search).get("action") || "join";
  
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  
  const createRoom = useCreateRoom();
  const joinRoom = useJoinRoom();
  const { data: activeRooms, isLoading: isLoadingRooms } = useListActiveRooms({ query: { enabled: action === "join", queryKey: getListActiveRoomsQueryKey() } });

  const handleHost = () => {
    if (!name.trim()) return;
    createRoom.mutate({ data: { chooserName: name } }, {
      onSuccess: (room) => {
        // Automatically join as chooser
        joinRoom.mutate({ id: room.id, data: { name, role: JoinInputRole.chooser } }, {
          onSuccess: (res) => {
            sessionStorage.setItem(`participantId_${room.id}`, res.participantId);
            setLocation(`/room/${room.id}/chooser`);
          }
        });
      }
    });
  };

  const handleJoin = (roomId?: string) => {
    if (!name.trim()) return;
    // We would need to look up room by code if roomId is not provided
    // For simplicity with given APIs, user must select a room from list active rooms
    if (!roomId) return;
    
    joinRoom.mutate({ id: roomId, data: { name, role: JoinInputRole.suitor } }, {
      onSuccess: (res) => {
        sessionStorage.setItem(`participantId_${roomId}`, res.participantId);
        setLocation(`/room/${roomId}/suitor`);
      }
    });
  };

  return (
    <div className="min-h-[100dvh] w-full flex items-center justify-center p-6 bg-background text-foreground">
      <Card className="w-full max-w-md bg-card/80 backdrop-blur border-primary/20 shadow-[0_0_30px_hsl(var(--primary)/0.15)]">
        <CardHeader>
          <CardTitle className="text-3xl font-black uppercase text-center tracking-wider text-primary">
            {action === "host" ? "Host Room" : "Join Room"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div className="space-y-2">
            <label className="text-xs uppercase font-mono text-muted-foreground">Your Name</label>
            <Input 
              placeholder="Enter your name..." 
              value={name}
              onChange={e => setName(e.target.value)}
              className="bg-input border-border h-12 text-lg focus-visible:ring-primary"
            />
          </div>

          {action === "host" ? (
            <Button 
              className="w-full h-12 text-lg font-bold bg-primary text-primary-foreground hover:bg-primary/90"
              onClick={handleHost}
              disabled={createRoom.isPending || joinRoom.isPending || !name.trim()}
            >
              {createRoom.isPending ? "CREATING..." : "START HOSTING"}
            </Button>
          ) : (
            <div className="space-y-4">
              <div className="text-xs uppercase font-mono text-muted-foreground border-b border-border pb-2">Active Rooms</div>
              {isLoadingRooms ? (
                <div className="text-center font-mono text-sm text-muted-foreground">SCANNING...</div>
              ) : activeRooms?.length === 0 ? (
                <div className="text-center font-mono text-sm text-muted-foreground">No active rooms found.</div>
              ) : (
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2">
                  {activeRooms?.map(room => (
                    <div key={room.id} className="flex items-center justify-between p-3 border border-border rounded bg-background/50">
                      <div>
                        <div className="font-bold text-secondary">{room.chooserName}'s Room</div>
                        <div className="text-xs font-mono text-muted-foreground">{room.suitorCount} / {room.maxSuitors} SUITORS</div>
                      </div>
                      <Button 
                        size="sm" 
                        variant="outline"
                        className="border-secondary text-secondary hover:bg-secondary hover:text-secondary-foreground"
                        onClick={() => handleJoin(room.id)}
                        disabled={joinRoom.isPending || room.suitorCount >= room.maxSuitors || !name.trim()}
                      >
                        JOIN
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

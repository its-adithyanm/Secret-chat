import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { customAlphabet } from "nanoid";
import { MessageSquare, Plus, ArrowRight, Globe, Lock, Users, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";

import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

const generateRoomId = customAlphabet("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz", 8);

interface PublicRoom {
  id: string;
  name: string;
  hostPeerId: string;
  createdAt: number;
}

export default function Home() {
  const [roomCode, setRoomCode] = useState("");
  const [publicRooms, setPublicRooms] = useState<PublicRoom[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showPublicModal, setShowPublicModal] = useState(false);
  const [newRoomName, setNewRoomName] = useState("");
  const navigate = useNavigate();

  const fetchPublicRooms = async () => {
    setIsLoading(true);
    try {
      const res = await fetch("/api/rooms/public");
      const data = await res.json();
      setPublicRooms(data);
    } catch (err) {
      console.error("Failed to fetch rooms", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch
    fetchPublicRooms();

    let ws: WebSocket | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWS = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}`);

      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          if (data.type === "ROOM_LIST_UPDATE") {
            setPublicRooms(data.payload);
          }
        } catch (err) {
          console.error("WS Message Error:", err);
        }
      };

      ws.onclose = () => {
        reconnectTimeout = setTimeout(connectWS, 3000);
      };

      ws.onerror = (err) => {
        console.error("WS Error:", err);
        ws?.close();
      };
    };

    connectWS();

    return () => {
      if (ws) ws.close();
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
    };
  }, []);

  const handleCreatePrivate = () => {
    const newRoomId = generateRoomId();
    navigate(`/r/${newRoomId}`);
  };

  const handleCreatePublic = () => {
    if (!newRoomName.trim()) return;
    const newRoomId = generateRoomId();
    navigate(`/r/${newRoomId}?public=true&name=${encodeURIComponent(newRoomName.trim())}`);
  };

  const handleJoinRoom = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (roomCode.trim()) {
      navigate(`/r/${roomCode.trim()}`);
    }
  };

  return (
    <div className="flex flex-col items-center min-h-screen p-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-2xl space-y-12"
      >
        <div className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 mb-4">
            <MessageSquare className="w-8 h-8 text-emerald-500" />
          </div>
          <h1 className="text-5xl font-bold tracking-tight">VanishChat</h1>
          <p className="text-neutral-400 text-lg">Secure, ephemeral, peer-to-peer conversations.</p>
        </div>

        <div className="grid md:grid-cols-2 gap-8">
          {/* Left Column: Create/Join */}
          <div className="space-y-6">
            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 px-1">Start a Room</h2>
              <div className="grid gap-3">
                <button
                  onClick={handleCreatePrivate}
                  className="flex items-center gap-4 w-full p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-emerald-500/50 transition-all group text-left"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/10 text-emerald-500">
                    <Lock className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Private Room</div>
                    <div className="text-xs text-neutral-500">Invite-only via link or code</div>
                  </div>
                </button>

                <button
                  onClick={() => setShowPublicModal(true)}
                  className="flex items-center gap-4 w-full p-4 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-blue-500/50 transition-all group text-left"
                >
                  <div className="p-2 rounded-lg bg-blue-500/10 text-blue-500">
                    <Globe className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="font-semibold">Public Room</div>
                    <div className="text-xs text-neutral-500">Visible to everyone on the site</div>
                  </div>
                </button>
              </div>
            </div>

            <div className="space-y-4">
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500 px-1">Join by Code</h2>
              <form onSubmit={handleJoinRoom} className="flex gap-2">
                <input
                  type="text"
                  placeholder="Enter 8-char code"
                  value={roomCode}
                  onChange={(e) => setRoomCode(e.target.value)}
                  className="flex-1 p-4 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 outline-none transition-all placeholder:text-neutral-600"
                  maxLength={8}
                />
                <button
                  type="submit"
                  disabled={!roomCode.trim()}
                  className="px-6 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-semibold transition-all"
                >
                  Join
                </button>
              </form>
            </div>
          </div>

          {/* Right Column: Public Rooms */}
          <div className="space-y-4">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-sm font-bold uppercase tracking-widest text-neutral-500">Public Rooms</h2>
              <button 
                onClick={fetchPublicRooms}
                className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-500 transition-all"
                disabled={isLoading}
              >
                <RefreshCw className={cn("w-4 h-4", isLoading && "animate-spin")} />
              </button>
            </div>
            
            <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl overflow-hidden min-h-[300px]">
              {publicRooms.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full p-8 text-center space-y-3 opacity-40">
                  <Globe className="w-10 h-10" />
                  <p className="text-sm">No public rooms active.<br/>Be the first to create one!</p>
                </div>
              ) : (
                <div className="divide-y divide-neutral-800">
                  {publicRooms.map((room) => (
                    <button
                      key={room.id}
                      onClick={() => navigate(`/r/${room.id}`)}
                      className="flex items-center justify-between w-full p-4 hover:bg-neutral-800/50 transition-all group text-left"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-500">
                          <Users className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-semibold group-hover:text-blue-400 transition-colors">{room.name}</div>
                          <div className="text-[10px] text-neutral-500 font-mono uppercase tracking-tighter">ID: {room.id}</div>
                        </div>
                      </div>
                      <ArrowRight className="w-5 h-5 text-neutral-700 group-hover:text-blue-500 transition-all" />
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="pt-12 text-center">
          <p className="text-xs text-neutral-600 leading-relaxed max-w-md mx-auto">
            VanishChat uses WebRTC for direct device-to-device communication. 
            Public rooms are listed temporarily in server RAM and vanish instantly when the host leaves.
          </p>
        </div>
      </motion.div>

      {/* Public Room Modal */}
      <AnimatePresence>
        {showPublicModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-black/80 backdrop-blur-sm">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              className="w-full max-w-md p-8 rounded-3xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-6"
            >
              <div className="space-y-2">
                <h3 className="text-2xl font-bold">Create Public Room</h3>
                <p className="text-neutral-400 text-sm">Give your room a name so others can find it.</p>
              </div>
              <input
                type="text"
                placeholder="Room Name (e.g. Tech Talk)"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                className="w-full p-4 rounded-xl bg-neutral-950 border border-neutral-800 focus:border-blue-500/50 outline-none transition-all"
                autoFocus
              />
              <div className="flex gap-3">
                <button
                  onClick={() => setShowPublicModal(false)}
                  className="flex-1 p-4 rounded-xl bg-neutral-800 hover:bg-neutral-700 font-semibold transition-all"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreatePublic}
                  disabled={!newRoomName.trim()}
                  className="flex-1 p-4 rounded-xl bg-blue-600 hover:bg-blue-500 disabled:bg-neutral-800 disabled:text-neutral-500 font-semibold transition-all"
                >
                  Create
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

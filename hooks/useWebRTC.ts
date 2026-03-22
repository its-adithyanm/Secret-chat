/**
 * useWebRTC Hook
 * 
 * This hook manages peer-to-peer connections using PeerJS.
 * It uses the PeerJS Cloud (free signaling server) for initial handshakes.
 * No chat data is sent to or stored on any server; all messages are 
 * transmitted directly between peers via WebRTC DataChannels.
 */
import { useEffect, useRef, useState, useCallback } from "react";
import Peer, { DataConnection } from "peerjs";
import { nanoid } from "nanoid";

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  text: string;
  timestamp: number;
  expiresAt?: number;
}

export interface JoinRequest {
  peerId: string;
  name: string;
}

export interface PeerState {
  peer: Peer | null;
  connections: DataConnection[];
  messages: Message[];
  isHost: boolean;
  status: "connecting" | "connected" | "disconnected" | "error" | "waiting-approval";
  error: string | null;
  participants: string[];
  isPublic: boolean;
  roomName: string | null;
  joinRequests: JoinRequest[];
  vanishMode: boolean;
}

export function useWebRTC(roomId: string, userName: string, initialIsPublic: boolean = false, initialRoomName: string | null = null) {
  const [state, setState] = useState<PeerState>({
    peer: null,
    connections: [],
    messages: [],
    isHost: false,
    status: "connecting",
    error: null,
    participants: [],
    isPublic: initialIsPublic,
    roomName: initialRoomName,
    joinRequests: [],
    vanishMode: true,
  });

  const peerRef = useRef<Peer | null>(null);
  const connectionsRef = useRef<DataConnection[]>([]);
  const wsRef = useRef<WebSocket | null>(null);
  const hostId = `vanishchat-room-${roomId}`;
  const myId = useRef(nanoid(10));

  const addMessage = useCallback((msg: Message) => {
    setState((prev) => ({
      ...prev,
      messages: [...prev.messages, msg],
    }));

    if (msg.expiresAt) {
      const delay = msg.expiresAt - Date.now();
      if (delay > 0) {
        setTimeout(() => {
          setState((prev) => ({
            ...prev,
            messages: prev.messages.filter((m) => m.id !== msg.id),
          }));
        }, delay);
      } else {
        setState((prev) => ({
          ...prev,
          messages: prev.messages.filter((m) => m.id !== msg.id),
        }));
      }
    }
  }, []);

  const broadcast = useCallback((data: any) => {
    connectionsRef.current.forEach((conn) => {
      if (conn.open) {
        conn.send(data);
      }
    });
  }, []);

  const sendMessage = useCallback((text: string) => {
    const now = Date.now();
    const msg: Message = {
      id: nanoid(),
      senderId: myId.current,
      senderName: userName,
      text,
      timestamp: now,
      expiresAt: state.vanishMode ? now + 120000 : undefined,
    };

    addMessage(msg);

    if (state.isHost) {
      broadcast({ type: "message", payload: msg });
    } else {
      const hostConn = connectionsRef.current.find(c => c.peer === hostId);
      if (hostConn && hostConn.open) {
        hostConn.send({ type: "message", payload: msg });
      }
    }
  }, [state.isHost, state.vanishMode, userName, broadcast, addMessage, hostId]);

  const toggleVanishMode = useCallback(() => {
    if (!state.isHost) return;
    const newMode = !state.vanishMode;
    setState(prev => ({ ...prev, vanishMode: newMode }));
    broadcast({ type: "vanish-mode", payload: newMode });
  }, [state.isHost, state.vanishMode, broadcast]);

  const acceptJoinRequest = useCallback((peerId: string) => {
    const conn = connectionsRef.current.find(c => c.peer === peerId);
    if (conn) {
      conn.send({ type: "join-accepted", payload: { participants: state.participants, vanishMode: state.vanishMode } });
      setState(prev => {
        const req = prev.joinRequests.find(r => r.peerId === peerId);
        const newParticipants = [...prev.participants, req?.name || "Guest"];
        broadcast({ type: "participants", payload: newParticipants });
        return {
          ...prev,
          joinRequests: prev.joinRequests.filter(r => r.peerId !== peerId),
          participants: newParticipants
        };
      });
    }
  }, [state.participants, state.vanishMode, broadcast]);

  const rejectJoinRequest = useCallback((peerId: string) => {
    const conn = connectionsRef.current.find(c => c.peer === peerId);
    if (conn) {
      conn.send({ type: "join-rejected" });
      conn.close();
    }
    setState(prev => ({
      ...prev,
      joinRequests: prev.joinRequests.filter(r => r.peerId !== peerId)
    }));
  }, []);

  useEffect(() => {
    let ws: WebSocket | null = null;
    let peer: Peer | null = null;
    let reconnectTimeout: NodeJS.Timeout | null = null;

    const connectWS = () => {
      const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
      ws = new WebSocket(`${protocol}//${window.location.host}`);
      wsRef.current = ws;

      ws.onopen = () => {
        if (state.isHost && initialIsPublic && initialRoomName) {
          ws?.send(JSON.stringify({
            type: "ROOM_REGISTER",
            payload: { id: roomId, name: initialRoomName, hostPeerId: hostId }
          }));
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

    peer = new Peer(myId.current);
    peerRef.current = peer;

    const setupGuest = () => {
      const conn = peer!.connect(hostId, { metadata: { name: userName } });
      
      conn.on("open", () => {
        connectionsRef.current = [conn];
        setState(prev => ({ ...prev, peer, connections: [conn], status: "waiting-approval" }));
        conn.send({ type: "join-request", payload: { name: userName, peerId: myId.current } });
      });

      conn.on("data", (data: any) => {
        if (data.type === "message") {
          addMessage(data.payload);
        } else if (data.type === "participants") {
          setState(prev => ({ ...prev, participants: data.payload }));
        } else if (data.type === "vanish-mode") {
          setState(prev => ({ ...prev, vanishMode: data.payload }));
        } else if (data.type === "join-accepted") {
          setState(prev => ({ ...prev, status: "connected", participants: data.payload.participants, vanishMode: data.payload.vanishMode }));
        } else if (data.type === "join-rejected") {
          setState(prev => ({ ...prev, status: "error", error: "Your request to join was rejected." }));
          peer?.destroy();
        } else if (data.type === "host-left") {
          setState(prev => ({ ...prev, status: "disconnected", error: "Host has closed the room." }));
          peer?.destroy();
        }
      });

      conn.on("close", () => {
        setState(prev => ({ ...prev, status: "disconnected", error: "Connection to host lost." }));
      });
    };

    const setupHost = () => {
      const hostPeer = new Peer(hostId);
      peerRef.current = hostPeer;
      
      hostPeer.on("open", () => {
        setState(prev => ({ 
          ...prev, 
          peer: hostPeer, 
          isHost: true, 
          status: "connected",
          participants: [userName]
        }));

        if (initialIsPublic && initialRoomName) {
          if (ws?.readyState === WebSocket.OPEN) {
            ws.send(JSON.stringify({
              type: "ROOM_REGISTER",
              payload: { id: roomId, name: initialRoomName, hostPeerId: hostId }
            }));
          }
        }
      });

      hostPeer.on("connection", (newConn) => {
        newConn.on("open", () => {
          connectionsRef.current = [...connectionsRef.current, newConn];
          setState(prev => ({ ...prev, connections: connectionsRef.current }));
        });

        newConn.on("data", (data: any) => {
          if (data.type === "join-request") {
            if (!initialIsPublic) {
              // Auto-accept for private rooms
              newConn.send({ type: "join-accepted", payload: { participants: state.participants, vanishMode: state.vanishMode } });
              setState(prev => {
                const newParticipants = [...prev.participants, data.payload.name];
                broadcast({ type: "participants", payload: newParticipants });
                return { ...prev, participants: newParticipants };
              });
            } else {
              setState(prev => ({
                ...prev,
                joinRequests: [...prev.joinRequests, { peerId: data.payload.peerId, name: data.payload.name }]
              }));
            }
          } else if (data.type === "message") {
            addMessage(data.payload);
            broadcast({ type: "message", payload: data.payload });
          }
        });

        newConn.on("close", () => {
          connectionsRef.current = connectionsRef.current.filter(c => c !== newConn);
          setState(prev => {
            const name = newConn.metadata?.name || "Guest";
            const newParticipants = prev.participants.filter(p => p !== name);
            broadcast({ type: "participants", payload: newParticipants });
            return { ...prev, connections: connectionsRef.current, participants: newParticipants };
          });
        });
      });

      hostPeer.on("error", (err) => {
        if (err.type === "unavailable-id") {
          setState(prev => ({ ...prev, status: "error", error: "Room ID already in use. Try a different code." }));
        }
      });
    };

    peer.on("open", () => {
      if (initialIsPublic) {
        // Public room creator is always the host
        peer?.destroy();
        setupHost();
      } else {
        // Try to join as guest first
        setupGuest();
        
        // If no host found after 3s, become host (for private rooms)
        const timeout = setTimeout(() => {
          if (connectionsRef.current.length === 0 && !state.isHost) {
            peer?.destroy();
            setupHost();
          }
        }, 3000);
        return () => clearTimeout(timeout);
      }
    });

    return () => {
      if (ws?.readyState === WebSocket.OPEN) {
        if (state.isHost && initialIsPublic) {
          ws.send(JSON.stringify({ type: "ROOM_UNREGISTER", payload: { id: roomId } }));
        }
        ws.close();
      }
      if (reconnectTimeout) clearTimeout(reconnectTimeout);
      peerRef.current?.destroy();
    };
  }, [roomId, userName, initialIsPublic, initialRoomName, addMessage, broadcast, hostId]);

  return { ...state, sendMessage, toggleVanishMode, acceptJoinRequest, rejectJoinRequest, myId: myId.current };
}

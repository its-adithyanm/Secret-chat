import express from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { fileURLToPath } from "url";
import { WebSocketServer, WebSocket } from "ws";
import { createServer } from "http";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In-memory storage for public rooms (RAM only, no persistence)
interface PublicRoom {
  id: string;
  name: string;
  hostPeerId: string;
  createdAt: number;
}

let publicRooms: Record<string, PublicRoom> = {};
const clients = new Set<WebSocket>();

async function startServer() {
  const app = express();
  app.use(express.json());
  const PORT = 3000;
  const server = createServer(app);
  const wss = new WebSocketServer({ server });

  const broadcastRooms = () => {
    const data = JSON.stringify({ type: "ROOM_LIST_UPDATE", payload: Object.values(publicRooms) });
    clients.forEach((client) => {
      if (client.readyState === WebSocket.OPEN) {
        client.send(data);
      }
    });
  };

  wss.on("connection", (ws: any) => {
    clients.add(ws);
    let hostedRoomId: string | null = null;
    ws.isAlive = true;

    ws.on("pong", () => {
      ws.isAlive = true;
    });

    // Send current list to new client
    ws.send(JSON.stringify({ type: "ROOM_LIST_UPDATE", payload: Object.values(publicRooms) }));

    ws.on("message", (message) => {
      try {
        const data = JSON.parse(message.toString());
        if (data.type === "ROOM_REGISTER") {
          const { id, name, hostPeerId } = data.payload;
          publicRooms[id] = { id, name, hostPeerId, createdAt: Date.now() };
          hostedRoomId = id;
          broadcastRooms();
        } else if (data.type === "ROOM_UNREGISTER") {
          const { id } = data.payload;
          delete publicRooms[id];
          hostedRoomId = null;
          broadcastRooms();
        }
      } catch (err) {
        console.error("WS Message Error:", err);
      }
    });

    ws.on("close", () => {
      clients.delete(ws);
      if (hostedRoomId && publicRooms[hostedRoomId]) {
        delete publicRooms[hostedRoomId];
        broadcastRooms();
      }
    });
  });

  // Ping interval to keep connections alive
  const interval = setInterval(() => {
    wss.clients.forEach((ws: any) => {
      if (ws.isAlive === false) return ws.terminate();
      ws.isAlive = false;
      ws.ping();
    });
  }, 30000);

  wss.on("close", () => {
    clearInterval(interval);
  });

  // API Routes for Public Room Discovery (Keep for backward compatibility/initial fetch)
  app.get("/api/rooms/public", (req, res) => {
    res.json(Object.values(publicRooms));
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();

import { useState, useEffect, useRef } from "react";
import { useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useWebRTC, Message } from "../hooks/useWebRTC";
import { Send, Copy, LogOut, Users, Shield, Clock, AlertCircle, Check, X, ToggleLeft, ToggleRight } from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export default function Chat() {
  const { roomId } = useParams<{ roomId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  
  const isPublic = searchParams.get("public") === "true";
  const roomName = searchParams.get("name");

  const [userName] = useState(() => `User-${Math.floor(Math.random() * 1000)}`);
  const [inputText, setInputText] = useState("");
  const [copied, setCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  const { 
    messages, 
    sendMessage, 
    status, 
    error, 
    isHost, 
    participants, 
    joinRequests, 
    acceptJoinRequest, 
    rejectJoinRequest,
    vanishMode,
    toggleVanishMode,
    myId
  } = useWebRTC(roomId || "", userName, isPublic, roomName);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const handleSend = (e: { preventDefault: () => void }) => {
    e.preventDefault();
    if (inputText.trim()) {
      sendMessage(inputText.trim());
      setInputText("");
    }
  };

  const copyLink = () => {
    const url = `${window.location.origin}/r/${roomId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (status === "error" || (status === "disconnected" && error)) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="p-4 rounded-full bg-red-500/10 text-red-500 mb-6">
          <AlertCircle className="w-12 h-12" />
        </div>
        <h2 className="text-2xl font-bold mb-2">Room Error</h2>
        <p className="text-neutral-400 mb-8">{error || "Connection lost."}</p>
        <button
          onClick={() => navigate("/")}
          className="px-6 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all font-medium"
        >
          Return Home
        </button>
      </div>
    );
  }

  if (status === "connecting") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6">
        <div className="w-12 h-12 border-4 border-emerald-500/20 border-t-emerald-500 rounded-full animate-spin mb-6"></div>
        <h2 className="text-xl font-medium text-neutral-400">Initializing secure room...</h2>
      </div>
    );
  }

  if (status === "waiting-approval") {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen p-6 text-center">
        <div className="w-12 h-12 border-4 border-blue-500/20 border-t-blue-500 rounded-full animate-spin mb-6"></div>
        <h2 className="text-2xl font-bold mb-2">Waiting for Approval</h2>
        <p className="text-neutral-400 max-w-xs">The host of this public room needs to accept your request to join.</p>
        <button
          onClick={() => navigate("/")}
          className="mt-8 px-6 py-3 rounded-xl bg-neutral-900 border border-neutral-800 hover:border-neutral-700 transition-all font-medium"
        >
          Cancel
        </button>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen max-w-4xl mx-auto border-x border-neutral-900 bg-neutral-950">
      {/* Header */}
      <header className="flex items-center justify-between p-4 border-b border-neutral-900 bg-neutral-950/80 backdrop-blur-md sticky top-0 z-10">
        <div className="flex items-center gap-4">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              <h2 className="font-bold text-lg tracking-tight">
                {roomName || `Room: ${roomId}`}
              </h2>
              <button
                onClick={copyLink}
                className="p-1.5 rounded-lg hover:bg-neutral-900 text-neutral-500 hover:text-emerald-500 transition-all"
                title="Copy Invite Link"
              >
                {copied ? <span className="text-xs font-medium text-emerald-500">Copied!</span> : <Copy className="w-4 h-4" />}
              </button>
            </div>
            <div className="flex items-center gap-3 text-xs text-neutral-500">
              <span className="flex items-center gap-1">
                <Users className="w-3 h-3" /> {participants.length} online
              </span>
              <span className="flex items-center gap-1">
                <Shield className="w-3 h-3 text-emerald-500" /> P2P Secure
              </span>
              {isHost && (
                <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-500 font-semibold uppercase tracking-wider">
                  Host
                </span>
              )}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isHost && (
            <button
              onClick={toggleVanishMode}
              className={cn(
                "flex items-center gap-2 px-3 py-1.5 rounded-xl text-xs font-bold transition-all border",
                vanishMode 
                  ? "bg-emerald-500/10 border-emerald-500/20 text-emerald-500" 
                  : "bg-neutral-900 border-neutral-800 text-neutral-500"
              )}
            >
              {vanishMode ? <ToggleRight className="w-4 h-4" /> : <ToggleLeft className="w-4 h-4" />}
              VANISH
            </button>
          )}
          <button
            onClick={() => navigate("/")}
            className="p-2 rounded-xl hover:bg-red-500/10 text-neutral-500 hover:text-red-500 transition-all"
            title="Leave Room"
          >
            <LogOut className="w-5 h-5" />
          </button>
        </div>
      </header>

      {/* Messages */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-center space-y-4 opacity-50">
            <div className="p-4 rounded-full bg-neutral-900">
              <Clock className="w-8 h-8" />
            </div>
            <div>
              <p className="font-medium">No messages yet</p>
              <p className="text-sm">
                {vanishMode 
                  ? "Messages vanish automatically after 2 minutes." 
                  : "Vanish mode is currently disabled."}
              </p>
            </div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {messages.map((msg) => (
              <MessageItem key={msg.id} msg={msg} isMe={msg.senderId === myId} />
            ))}
          </AnimatePresence>
        )}
      </div>

      {/* Input */}
      <div className="p-4 border-t border-neutral-900 bg-neutral-950">
        <form onSubmit={handleSend} className="flex gap-2">
          <input
            type="text"
            placeholder={vanishMode ? "Type a vanishing message..." : "Type a message..."}
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            className="flex-1 p-3 rounded-xl bg-neutral-900 border border-neutral-800 focus:border-emerald-500/50 outline-none transition-all placeholder:text-neutral-600"
          />
          <button
            type="submit"
            disabled={!inputText.trim()}
            className="p-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-neutral-900 disabled:text-neutral-700 transition-all"
          >
            <Send className="w-5 h-5" />
          </button>
        </form>
        <div className="mt-2 flex items-center gap-2 text-[10px] text-neutral-600 uppercase tracking-widest font-semibold">
          <Clock className="w-3 h-3" /> {vanishMode ? "Vanish Mode Active (120s)" : "Vanish Mode Disabled"}
        </div>
      </div>

      {/* Join Requests Modal (Host Only) */}
      <AnimatePresence>
        {isHost && joinRequests.length > 0 && (
          <div className="fixed bottom-24 right-6 z-50 w-full max-w-xs space-y-2">
            {joinRequests.map((req) => (
              <motion.div
                key={req.peerId}
                initial={{ opacity: 0, x: 50 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 50 }}
                className="p-4 rounded-2xl bg-neutral-900 border border-neutral-800 shadow-2xl space-y-3"
              >
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-blue-500/10 flex items-center justify-center text-blue-500">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="text-sm font-bold">{req.name}</div>
                    <div className="text-[10px] text-neutral-500 uppercase tracking-wider">Wants to join</div>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => rejectJoinRequest(req.peerId)}
                    className="flex-1 py-2 rounded-lg bg-neutral-800 hover:bg-red-500/20 hover:text-red-500 text-xs font-bold transition-all"
                  >
                    <X className="w-4 h-4 mx-auto" />
                  </button>
                  <button
                    onClick={() => acceptJoinRequest(req.peerId)}
                    className="flex-1 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold transition-all"
                  >
                    <Check className="w-4 h-4 mx-auto" />
                  </button>
                </div>
              </motion.div>
            ))}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MessageItem({ msg, isMe, key }: { msg: Message; isMe: boolean; key?: string }) {
  const [timeLeft, setTimeLeft] = useState<number | null>(null);

  useEffect(() => {
    if (!msg.expiresAt) {
      setTimeLeft(null);
      return;
    }

    const update = () => {
      const remaining = Math.max(0, Math.floor((msg.expiresAt! - Date.now()) / 1000));
      setTimeLeft(remaining);
    };

    update();
    const interval = setInterval(update, 1000);
    return () => clearInterval(interval);
  }, [msg.expiresAt]);

  return (
    <motion.div
      initial={{ opacity: 0, x: isMe ? 20 : -20, scale: 0.95 }}
      animate={{ opacity: 1, x: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.9, filter: "blur(10px)" }}
      className={cn(
        "flex flex-col max-w-[80%]",
        isMe ? "ml-auto items-end" : "mr-auto items-start"
      )}
    >
      <div className="flex items-center gap-2 mb-1 px-1">
        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-wider">
          {isMe ? "You" : msg.senderName}
        </span>
        {timeLeft !== null && (
          <span className="text-[10px] text-neutral-600 flex items-center gap-0.5">
            <Clock className="w-2 h-2" /> {timeLeft}s
          </span>
        )}
      </div>
      <div
        className={cn(
          "p-3 rounded-2xl text-sm leading-relaxed break-words shadow-sm",
          isMe 
            ? "bg-emerald-600 text-white rounded-tr-none" 
            : "bg-neutral-900 text-neutral-100 rounded-tl-none border border-neutral-800"
        )}
      >
        {msg.text}
      </div>
    </motion.div>
  );
}

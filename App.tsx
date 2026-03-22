import { BrowserRouter, Routes, Route } from "react-router-dom";
import Home from "./pages/Home";
import Chat from "./pages/Chat";

export default function App() {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 font-sans selection:bg-emerald-500/30">
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/r/:roomId" element={<Chat />} />
        </Routes>
      </BrowserRouter>
    </div>
  );
}

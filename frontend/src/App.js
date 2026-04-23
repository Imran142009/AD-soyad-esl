import { BrowserRouter, Route, Routes } from "react-router-dom";
import "@/App.css";
import { AuthProvider } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import Landing from "@/pages/Landing";
import AuthCallback from "@/pages/AuthCallback";
import Lobby from "@/pages/Lobby";
import GameRoom from "@/pages/GameRoom";
import Leaderboard from "@/pages/Leaderboard";
import Profile from "@/pages/Profile";
import AdminDashboard from "@/pages/AdminDashboard";

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/auth/callback" element={<AuthCallback />} />
          <Route path="/lobby" element={<ProtectedRoute><Lobby /></ProtectedRoute>} />
          <Route path="/room/:code" element={<ProtectedRoute><GameRoom /></ProtectedRoute>} />
          <Route path="/leaderboard" element={<ProtectedRoute><Leaderboard /></ProtectedRoute>} />
          <Route path="/profile" element={<ProtectedRoute><Profile /></ProtectedRoute>} />
          <Route path="/admin" element={<ProtectedRoute adminOnly><AdminDashboard /></ProtectedRoute>} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;

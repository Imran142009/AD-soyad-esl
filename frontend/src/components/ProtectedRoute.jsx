import { useAuth } from "@/context/AuthContext";
import { Navigate, useLocation } from "react-router-dom";

export default function ProtectedRoute({ children, adminOnly = false }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="glass px-6 py-4 text-white/70">Yüklənir...</div>
      </div>
    );
  }
  if (!user) return <Navigate to="/" state={{ from: location }} replace />;
  if (adminOnly && !user.is_admin) return <Navigate to="/lobby" replace />;
  return children;
}

import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "@/context/AuthContext";
import { Gamepad2, Trophy, User as UserIcon, Shield, LogOut, Sparkles } from "lucide-react";

export default function NavBar() {
  const { user, logout } = useAuth();
  const loc = useLocation();
  const navigate = useNavigate();

  const isActive = (p) => loc.pathname === p || loc.pathname.startsWith(p + "/");

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  if (!user) return null;

  return (
    <header className="sticky top-0 z-40 backdrop-blur-xl bg-[#0B0E14]/70 border-b border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
        <Link to="/lobby" className="flex items-center gap-2 group" data-testid="nav-home">
          <div className="h-9 w-9 rounded-xl bg-gradient-to-br from-indigo-500 to-violet-500 flex items-center justify-center shadow-[0_0_20px_rgba(129,140,248,0.5)]">
            <Sparkles className="h-5 w-5 text-white" strokeWidth={1.8} />
          </div>
          <div className="font-display font-black text-xl tracking-tighter hidden sm:block">Ad·Soyad·Şəhər</div>
        </Link>
        <nav className="flex items-center gap-1 sm:gap-2">
          <NavItem to="/lobby" icon={Gamepad2} label="Lobi" active={isActive("/lobby") || loc.pathname.startsWith("/room/")} testid="nav-lobby" />
          <NavItem to="/leaderboard" icon={Trophy} label="Lider" active={isActive("/leaderboard")} testid="nav-leaderboard" />
          <NavItem to="/profile" icon={UserIcon} label="Profil" active={isActive("/profile")} testid="nav-profile" />
          {user?.is_admin && (
            <NavItem to="/admin" icon={Shield} label="Admin" active={isActive("/admin")} testid="nav-admin" />
          )}
        </nav>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex items-center gap-2">
            {user.picture ? (
              <img src={user.picture} alt={user.name} className="h-8 w-8 rounded-full border border-white/10" />
            ) : (
              <div className="h-8 w-8 rounded-full bg-indigo-500/30 flex items-center justify-center text-xs font-bold">{user.name?.[0] || "?"}</div>
            )}
            <div className="text-sm font-medium text-white/90" data-testid="nav-username">{user.name}</div>
          </div>
          <button onClick={handleLogout} className="btn-glass !px-3 !py-2" data-testid="nav-logout" title="Çıxış">
            <LogOut className="h-4 w-4" strokeWidth={1.8} />
          </button>
        </div>
      </div>
    </header>
  );
}

function NavItem({ to, icon: Icon, label, active, testid }) {
  return (
    <Link
      to={to}
      data-testid={testid}
      className={`flex items-center gap-2 rounded-full px-3 py-2 text-sm transition-all border ${
        active
          ? "bg-white/10 border-white/15 text-white"
          : "border-transparent text-white/70 hover:text-white hover:bg-white/5"
      }`}
    >
      <Icon className="h-4 w-4" strokeWidth={1.8} />
      <span className="hidden sm:inline">{label}</span>
    </Link>
  );
}

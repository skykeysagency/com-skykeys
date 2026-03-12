import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import Sidebar from "./Sidebar";
import { Loader2 } from "lucide-react";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-background gap-3">
        <div className="w-10 h-10 rounded-xl gradient-primary flex items-center justify-center shadow-primary">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
        </div>
        <p className="text-sm text-muted-foreground">Chargement…</p>
      </div>
    );
  }

  if (!user) return <Navigate to="/auth" replace />;

  return (
    <div className="flex min-h-screen bg-background">
      <Sidebar />
      <main className="flex-1 overflow-auto scrollbar-thin">
        {children}
      </main>
    </div>
  );
}

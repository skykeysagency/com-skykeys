import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "manager" | "commercial";

export function useRole() {
  const { user } = useAuth();
  const [role, setRole] = useState<AppRole | null>(null);
  const [loadingRole, setLoadingRole] = useState(true);

  useEffect(() => {
    if (!user) { setRole(null); setLoadingRole(false); return; }
    supabase
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .single()
      .then(({ data }) => {
        setRole((data?.role as AppRole) ?? "commercial");
        setLoadingRole(false);
      });
  }, [user]);

  const isAdmin = role === "admin";
  const isManager = role === "manager" || role === "admin";

  return { role, loadingRole, isAdmin, isManager };
}

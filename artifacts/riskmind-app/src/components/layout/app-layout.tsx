import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import {
  LayoutDashboard, ShieldAlert, Users, ShieldCheck,
  Bell, Settings, LogOut, Loader2, Menu, ChevronRight, Activity, Binoculars, PanelLeftClose, PanelLeft, ClipboardList
} from "lucide-react";
import logo from "@assets/risk_mind_1773670829732.png";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { AlertBell } from "@/components/dashboard/alert-bell";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  // All hooks MUST be before any early returns
  const [location, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>(null);

  const { data: user, isLoading, error } = useGetMe({
    query: {
      queryKey: ["/api/v1/auth/me"],
      retry: false,
    },
  });

  const navItems = useMemo(() => [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    {
      name: "Risks",
      icon: ShieldAlert,
      children: [
        { name: "Register", href: "/risks" },
        { name: "Dashboard", href: "/risks/heatmap" },
      ]
    },
    { name: "Signals", href: "/signals", icon: Activity },
    { name: "Vendors", href: "/vendors", icon: Users },
    {
      name: "Assessments",
      icon: ClipboardList,
      children: [
        { name: "Library", href: "/assessments/templates" },
        { name: "Sessions", href: "/assessments" },
      ]
    },
    {
      name: "Compliance",
      icon: ShieldCheck,
      children: [
        { name: "Frameworks", href: "/compliance" },
        { name: "Controls", href: "/controls" },
      ]
    },
    { name: "Alerts", href: "/alerts", icon: Bell },
    { name: "Foresight", href: "/foresight", icon: Binoculars },
    ...(user?.role === "admin" ? [{ name: "Settings", href: "/settings", icon: Settings }] : []),
  ], [user?.role]);

  const currentPath = location;

  // Auto-expand the nav section matching the current route
  useEffect(() => {
    const match = navItems.find(
      (item) =>
        item.children?.some(
          (child) => currentPath === child.href || currentPath.startsWith(child.href + "/")
        )
    );
    setExpandedNav(match ? match.name : null);
  }, [currentPath, navItems]);

  useEffect(() => {
    if (error) {
      setLocation("/login");
    }
  }, [error, setLocation]);

  const handleLogout = () => {
    localStorage.removeItem("accessToken");
    setLocation("/login");
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) return null;

  const tenantName = (user as any).tenantName || (user as any).tenantSlug || user.tenantId.split('-')[0];
  const userRoleLabel = user.role.replace('_', ' ');

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {isMobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 bg-sidebar text-sidebar-foreground flex flex-col transition-all duration-300 ease-in-out lg:translate-x-0",
        isCollapsed ? "w-16" : "w-[240px]",
        isMobileOpen ? "translate-x-0 w-[240px]" : "-translate-x-full lg:translate-x-0"
      )}>
        <div className="flex items-center h-14 px-4 border-b border-sidebar-border shrink-0 justify-between">
          {(!isCollapsed || isMobileOpen) && (
            <>
              <img src={logo} alt="RiskMind" className="h-5 w-5 mr-2 invert shrink-0" />
              <span className="font-bold text-lg tracking-tight flex-1">RiskMind</span>
            </>
          )}
          <button
            onClick={() => { setIsCollapsed(!isCollapsed); setIsMobileOpen(false); }}
            className="h-11 w-11 flex items-center justify-center text-sidebar-foreground/50 hover:text-white transition-colors hidden lg:flex"
            title={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {isCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
          </button>
          {isCollapsed && !isMobileOpen && (
            <img src={logo} alt="RiskMind" className="h-5 w-5 invert mx-auto" />
          )}
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-2 space-y-1">
          {navItems.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <>
                  <button
                    onClick={() => setExpandedNav(expandedNav === item.name ? null : item.name)}
                    className={cn(
                      "w-full flex items-center justify-between py-2 text-sm font-medium rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors",
                      isCollapsed && !isMobileOpen ? "px-2 justify-center" : "px-3",
                      expandedNav === item.name && "text-sidebar-accent-foreground"
                    )}
                    title={isCollapsed ? item.name : undefined}
                  >
                    <div className="flex items-center">
                      <item.icon className={cn("h-4 w-4", (!isCollapsed || isMobileOpen) && "mr-3")} />
                      {(!isCollapsed || isMobileOpen) && item.name}
                    </div>
                    {(!isCollapsed || isMobileOpen) && (
                      <ChevronRight className={cn(
                        "h-4 w-4 transition-transform duration-200",
                        expandedNav === item.name ? "rotate-90" : ""
                      )} />
                    )}
                  </button>
                  {(!isCollapsed || isMobileOpen) && expandedNav === item.name && (
                    <div className="mt-1 ml-4 pl-4 border-l border-sidebar-border space-y-1">
                      {item.children.map(child => (
                        <Link key={child.name} href={child.href} className={cn(
                          "block px-3 py-1.5 text-sm rounded-md transition-colors",
                          currentPath === child.href || currentPath.startsWith(child.href + '/')
                            ? "bg-sidebar-accent text-sidebar-accent-foreground font-medium"
                            : "text-sidebar-foreground/60 hover:bg-sidebar-accent/50 hover:text-sidebar-foreground"
                        )}>
                          {child.name}
                        </Link>
                      ))}
                    </div>
                  )}
                </>
              ) : (
                <Link href={item.href!} className={cn(
                  "flex items-center py-2 text-sm font-medium rounded-md transition-colors",
                  isCollapsed && !isMobileOpen ? "px-2 justify-center" : "px-3",
                  currentPath === item.href || currentPath.startsWith(item.href + '/')
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )} title={isCollapsed ? item.name : undefined}>
                  <item.icon className={cn("h-4 w-4", (!isCollapsed || isMobileOpen) && "mr-3")} />
                  {(!isCollapsed || isMobileOpen) && item.name}
                </Link>
              )}
            </div>
          ))}
        </nav>

        {(!isCollapsed || isMobileOpen) && (
          <div className="p-4 border-t border-sidebar-border shrink-0">
            <Popover>
              <PopoverTrigger asChild>
                <button className="w-full flex items-center px-3 py-2 rounded-md hover:bg-sidebar-accent/50 transition-colors text-left">
                  <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold mr-3 shrink-0">
                    {user.email.charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{user.email}</p>
                    <p className="text-xs text-sidebar-foreground/50 capitalize">{userRoleLabel}</p>
                  </div>
                </button>
              </PopoverTrigger>
              <PopoverContent side="top" align="start" className="w-56 p-2">
                <div className="px-3 py-2 border-b mb-2">
                  <p className="text-sm font-medium truncate">{user.email}</p>
                  <p className="text-xs text-muted-foreground capitalize">{userRoleLabel} · {tenantName}</p>
                </div>
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center px-3 py-2 text-sm rounded-md text-destructive hover:bg-destructive/10 transition-colors"
                >
                  <LogOut className="h-4 w-4 mr-2" />
                  Log out
                </button>
              </PopoverContent>
            </Popover>
          </div>
        )}
      </aside>

      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <header className="h-12 bg-background border-b border-border flex items-center justify-between px-4 lg:px-6 shrink-0">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" className="h-9 w-9 lg:hidden" onClick={() => setIsMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <span className="font-mono text-xs px-2 py-1 bg-secondary rounded-md capitalize">{tenantName}</span>
          </div>
          <AlertBell />
        </header>

        <div className="flex-1 overflow-auto bg-muted/20 relative">
          <div className="absolute inset-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

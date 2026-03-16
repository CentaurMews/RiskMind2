import { useState, useEffect } from "react";
import { Link, useLocation } from "wouter";
import { useGetMe } from "@workspace/api-client-react";
import { 
  LayoutDashboard, ShieldAlert, Zap, Users, ShieldCheck, 
  Bell, Settings, LogOut, Loader2, Menu, X, ChevronRight, Activity, Binoculars, TriangleAlert
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

interface AppLayoutProps {
  children: React.ReactNode;
}

export function AppLayout({ children }: AppLayoutProps) {
  const [, setLocation] = useLocation();
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  const [expandedNav, setExpandedNav] = useState<string | null>("Risks");
  
  const { data: user, isLoading, error } = useGetMe({
    query: {
      retry: false,
    }
  });

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

  const navItems = [
    { name: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
    { 
      name: "Risks", 
      icon: ShieldAlert,
      children: [
        { name: "Register", href: "/risks" },
        { name: "Heatmap", href: "/risks/heatmap" },
      ]
    },
    { 
      name: "Signals", 
      icon: Activity,
      children: [
        { name: "Feed", href: "/signals" },
        { name: "Findings", href: "/signals/findings" },
      ]
    },
    { name: "Vendors", href: "/vendors", icon: Users },
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
    ...(user.role === "admin" ? [{ name: "Settings", href: "/settings", icon: Settings }] : []),
  ];

  const currentPath = window.location.pathname;

  return (
    <div className="flex h-screen bg-background overflow-hidden font-sans">
      {/* Mobile sidebar backdrop */}
      {isMobileOpen && (
        <div 
          className="fixed inset-0 z-40 bg-black/50 lg:hidden"
          onClick={() => setIsMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside className={cn(
        "fixed lg:static inset-y-0 left-0 z-50 w-64 bg-sidebar text-sidebar-foreground flex flex-col transition-transform duration-300 ease-in-out lg:translate-x-0",
        isMobileOpen ? "translate-x-0" : "-translate-x-full"
      )}>
        <div className="flex items-center h-16 px-6 border-b border-sidebar-border shrink-0">
          <TriangleAlert className="h-6 w-6 mr-2 text-white" />
          <span className="font-bold text-lg tracking-tight">RiskMind</span>
        </div>

        <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-1">
          {navItems.map((item) => (
            <div key={item.name}>
              {item.children ? (
                <>
                  <button 
                    onClick={() => setExpandedNav(expandedNav === item.name ? null : item.name)}
                    className="w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-md text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground transition-colors"
                  >
                    <div className="flex items-center">
                      <item.icon className="mr-3 h-4 w-4" />
                      {item.name}
                    </div>
                    <ChevronRight className={cn(
                      "h-4 w-4 transition-transform duration-200",
                      expandedNav === item.name ? "rotate-90" : ""
                    )} />
                  </button>
                  {expandedNav === item.name && (
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
                <Link href={item.href} className={cn(
                  "flex items-center px-3 py-2 text-sm font-medium rounded-md transition-colors",
                  currentPath === item.href || currentPath.startsWith(item.href + '/')
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
                )}>
                  <item.icon className="mr-3 h-4 w-4" />
                  {item.name}
                </Link>
              )}
            </div>
          ))}
        </nav>

        <div className="p-4 border-t border-sidebar-border shrink-0">
          <div className="flex items-center px-3 py-2">
            <div className="h-8 w-8 rounded-full bg-sidebar-accent flex items-center justify-center text-xs font-bold mr-3">
              {user.email.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium truncate">{user.email}</p>
              <p className="text-xs text-sidebar-foreground/50 capitalize">{user.role.replace('_', ' ')}</p>
            </div>
            <button onClick={handleLogout} className="text-sidebar-foreground/50 hover:text-white transition-colors">
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Topbar */}
        <header className="h-16 bg-background border-b border-border flex items-center justify-between px-4 lg:px-8 shrink-0">
          <div className="flex items-center">
            <Button variant="ghost" size="icon" className="lg:hidden mr-2" onClick={() => setIsMobileOpen(true)}>
              <Menu className="h-5 w-5" />
            </Button>
            <div className="flex items-center space-x-2 text-sm text-muted-foreground">
              <span className="font-mono text-xs px-2 py-1 bg-secondary rounded-md">{user.tenantId.split('-')[0]}</span>
            </div>
          </div>
          <div className="flex items-center space-x-4">
            {/* Can add global search or notifications here later */}
          </div>
        </header>

        {/* Page content */}
        <div className="flex-1 overflow-auto bg-muted/20 relative">
          <div className="absolute inset-0">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}

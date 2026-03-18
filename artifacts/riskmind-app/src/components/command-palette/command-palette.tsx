import { useState, useEffect, useCallback, useRef } from "react";
import { useLocation } from "wouter";
import {
  CommandDialog, CommandEmpty, CommandGroup,
  CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import { customFetch } from "@workspace/api-client-react";
import { ShieldAlert, Building2, Activity, LayoutDashboard, Bell, ShieldCheck, Loader2 } from "lucide-react";

interface SearchResults {
  risks?: Array<{ id: string; title: string; category: string; status: string }>;
  vendors?: Array<{ id: string; name: string; category: string; status: string }>;
  signals?: Array<{ id: string; content: string; classification: string; severity: string }>;
}

const QUICK_ACTIONS = [
  { label: "Go to Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Go to Risks", href: "/risks", icon: ShieldAlert },
  { label: "Go to Vendors", href: "/vendors", icon: Building2 },
  { label: "Go to Signals", href: "/signals", icon: Activity },
  { label: "Go to Alerts", href: "/alerts", icon: Bell },
  { label: "Go to Compliance", href: "/compliance", icon: ShieldCheck },
];

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResults | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [, navigate] = useLocation();
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Global keyboard shortcut
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener("keydown", down);
    return () => document.removeEventListener("keydown", down);
  }, []);

  // Reset on close
  useEffect(() => {
    if (!open) {
      setQuery("");
      setResults(null);
    }
  }, [open]);

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (!query.trim() || query.trim().length < 2) {
      setResults(null);
      return;
    }
    debounceRef.current = setTimeout(async () => {
      setIsSearching(true);
      try {
        const data = await customFetch<{ results: SearchResults }>("/api/v1/search", {
          method: "POST",
          body: JSON.stringify({ query: query.trim(), types: ["risk", "vendor", "signal"] }),
          headers: { "Content-Type": "application/json" },
        });
        setResults(data.results);
      } catch {
        setResults(null);
      } finally {
        setIsSearching(false);
      }
    }, 300);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [query]);

  const go = useCallback((href: string) => {
    navigate(href);
    setOpen(false);
  }, [navigate]);

  const hasResults = results && (
    (results.risks?.length ?? 0) + (results.vendors?.length ?? 0) + (results.signals?.length ?? 0) > 0
  );

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput
        placeholder="Search risks, vendors, signals… or type a command"
        value={query}
        onValueChange={setQuery}
      />
      <CommandList>
        {isSearching && (
          <div className="flex items-center justify-center py-6">
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          </div>
        )}
        {!isSearching && query.trim().length >= 2 && !hasResults && (
          <CommandEmpty>No results found for "{query}".</CommandEmpty>
        )}
        {!query.trim() && (
          <CommandGroup heading="Quick Actions">
            {QUICK_ACTIONS.map(action => (
              <CommandItem key={action.href} onSelect={() => go(action.href)}>
                <action.icon className="mr-2 h-4 w-4 text-muted-foreground" />
                {action.label}
              </CommandItem>
            ))}
          </CommandGroup>
        )}
        {hasResults && (
          <>
            {(results?.risks?.length ?? 0) > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Risks">
                  {results!.risks!.map(risk => (
                    <CommandItem key={risk.id} onSelect={() => go(`/risks/${risk.id}`)}>
                      <ShieldAlert className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{risk.title}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono capitalize">{risk.category}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {(results?.vendors?.length ?? 0) > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Vendors">
                  {results!.vendors!.map(vendor => (
                    <CommandItem key={vendor.id} onSelect={() => go(`/vendors/${vendor.id}`)}>
                      <Building2 className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{vendor.name}</span>
                      <span className="ml-2 text-xs text-muted-foreground font-mono capitalize">{vendor.status}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
            {(results?.signals?.length ?? 0) > 0 && (
              <>
                <CommandSeparator />
                <CommandGroup heading="Signals">
                  {results!.signals!.map(signal => (
                    <CommandItem key={signal.id} onSelect={() => go(`/signals/${signal.id}`)}>
                      <Activity className="mr-2 h-4 w-4 text-muted-foreground" />
                      <span className="flex-1 truncate">{signal.content?.slice(0, 60)}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}

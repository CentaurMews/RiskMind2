import { useGetAlertSummary, useListAlerts } from "@workspace/api-client-react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { SeverityBadge } from "@/components/ui/severity-badge";
import { format } from "date-fns";
import { Link } from "wouter";

export function AlertBell() {
  const { data: summary } = useGetAlertSummary();
  const { data: alerts } = useListAlerts({ status: "active", limit: 5 });
  const activeCount = summary?.active ?? 0;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-4 w-4" />
          {activeCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 w-4 rounded-full bg-destructive text-destructive-foreground text-[10px] flex items-center justify-center font-bold leading-none">
              {activeCount > 9 ? "9+" : activeCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="flex items-center justify-between px-4 py-3 border-b">
          <span className="font-semibold text-sm">Alerts</span>
          <Link href="/alerts" className="text-xs text-primary hover:underline">
            View all
          </Link>
        </div>
        <div className="divide-y divide-border max-h-64 overflow-auto">
          {!alerts?.data?.length ? (
            <p className="text-sm text-muted-foreground text-center py-4">
              No active alerts.
            </p>
          ) : (
            alerts.data.map((alert) => (
              <div
                key={alert.id}
                className="px-4 py-3 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2 mb-1">
                  <SeverityBadge severity={alert.severity} />
                  <span className="text-sm font-medium truncate">{alert.title}</span>
                </div>
                <span className="text-xs text-muted-foreground font-mono">
                  {format(new Date(alert.createdAt || ""), "MMM d, HH:mm")}
                </span>
              </div>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

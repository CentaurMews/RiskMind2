import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface SeverityBadgeProps {
  severity?: 'critical' | 'high' | 'medium' | 'low' | string;
  className?: string;
}

export function SeverityBadge({ severity, className }: SeverityBadgeProps) {
  const s = severity?.toLowerCase() || 'medium';
  
  return (
    <Badge 
      variant="outline" 
      className={cn(
        "font-mono font-medium uppercase tracking-wider text-[10px] px-2 py-0.5",
        s === 'critical' && "bg-severity-critical/10 text-severity-critical border-severity-critical/20",
        s === 'high' && "bg-severity-high/10 text-severity-high border-severity-high/20",
        s === 'medium' && "bg-severity-medium/10 text-severity-medium border-severity-medium/20",
        s === 'low' && "bg-severity-low/10 text-severity-low border-severity-low/20",
        className
      )}
    >
      {s}
    </Badge>
  );
}

export function StatusBadge({ status, className }: { status?: string, className?: string }) {
  const s = status?.toLowerCase() || 'unknown';
  
  return (
    <Badge 
      variant="secondary" 
      className={cn(
        "font-mono font-medium capitalize tracking-wider text-[10px] px-2 py-0.5 bg-muted text-muted-foreground",
        (s === 'open' || s === 'active' || s === 'pending' || s === 'in_progress' || s === 'monitoring' || s === 'onboarding') && "bg-primary/10 text-primary",
        (s === 'resolved' || s === 'closed' || s === 'mitigated' || s === 'completed' || s === 'approved') && "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
        (s === 'identification' || s === 'due diligence' || s === 'due_diligence' || s === 'risk assessment' || s === 'risk_assessment' || s === 'contracting') && "bg-amber-500/10 text-amber-600 dark:text-amber-400",
        (s === 'offboarding') && "bg-red-500/10 text-red-600 dark:text-red-400",
        s === 'draft' && "bg-secondary text-secondary-foreground",
        className
      )}
    >
      {s.replace('_', ' ')}
    </Badge>
  );
}

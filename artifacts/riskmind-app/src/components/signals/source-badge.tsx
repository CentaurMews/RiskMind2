import { ShieldCheck, Globe, Cloud, Bug, Mail } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SOURCE_CONFIG: Record<string, { icon: React.ElementType; label: string; color: string }> = {
  nvd:      { icon: ShieldCheck, label: "NVD/CVE",   color: "bg-orange-100 text-orange-700 border-orange-200" },
  shodan:   { icon: Globe,       label: "Shodan",    color: "bg-blue-100 text-blue-700 border-blue-200" },
  sentinel: { icon: Cloud,       label: "Sentinel",  color: "bg-purple-100 text-purple-700 border-purple-200" },
  misp:     { icon: Bug,         label: "MISP",      color: "bg-red-100 text-red-700 border-red-200" },
  email:    { icon: Mail,        label: "Email",     color: "bg-green-100 text-green-700 border-green-200" },
};

export function SourceBadge({ source }: { source: string }) {
  const cfg = SOURCE_CONFIG[source?.toLowerCase()];
  if (!cfg) {
    return (
      <Badge variant="outline" className="bg-gray-100 text-gray-600 border-gray-200">
        {source}
      </Badge>
    );
  }
  const Icon = cfg.icon;
  return (
    <Badge variant="outline" className={cfg.color}>
      <Icon className="h-3 w-3 mr-1" />
      {cfg.label}
    </Badge>
  );
}

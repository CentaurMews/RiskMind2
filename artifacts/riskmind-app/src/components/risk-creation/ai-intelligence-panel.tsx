import { useState, useMemo } from "react";
import { useListSignals, useListFindings, useListAgentFindings } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Brain, Radio, Search as SearchIcon, AlertTriangle, Loader2, Check } from "lucide-react";
import { cn } from "@/lib/utils";

interface SourceItem {
  id: string;
  sourceType: "signal" | "finding" | "agent_detection";
  title: string;
  description: string;
  confidence?: number;
  category?: string;
  severity?: string;
}

interface AiIntelligencePanelProps {
  searchText: string;
  selectedSources: SourceItem[];
  onSelectSource: (source: SourceItem) => void;
  onDeselectSource: (sourceId: string) => void;
}

function ConfidenceBadge({ value }: { value?: number }) {
  if (value == null) return null;
  const pct = Math.round(value * 100);
  const color = pct >= 80 ? "text-emerald-600 bg-emerald-50 border-emerald-200" :
    pct >= 50 ? "text-amber-600 bg-amber-50 border-amber-200" :
    "text-red-600 bg-red-50 border-red-200";
  return (
    <span className={cn("text-[10px] font-mono px-1.5 py-0.5 rounded border", color)}>
      {pct}%
    </span>
  );
}

function SourceCard({ item, selected, onToggle }: { item: SourceItem; selected: boolean; onToggle: () => void }) {
  const typeLabel = item.sourceType === "signal" ? "Signal" :
    item.sourceType === "finding" ? "Finding" : "Agent Detection";
  const typeColor = item.sourceType === "signal" ? "bg-blue-50 text-blue-700 border-blue-200" :
    item.sourceType === "finding" ? "bg-purple-50 text-purple-700 border-purple-200" :
    "bg-orange-50 text-orange-700 border-orange-200";

  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        "w-full text-left p-3 rounded-lg border transition-all",
        selected
          ? "border-primary bg-primary/5 ring-1 ring-primary/20"
          : "border-border hover:border-primary/40 hover:bg-muted/50"
      )}
    >
      <div className="flex items-start justify-between gap-2 mb-1">
        <span className={cn("text-[10px] font-medium px-1.5 py-0.5 rounded border", typeColor)}>
          {typeLabel}
        </span>
        <div className="flex items-center gap-1.5">
          <ConfidenceBadge value={item.confidence} />
          {selected && <Check className="h-3.5 w-3.5 text-primary" />}
        </div>
      </div>
      <p className="text-sm font-medium mt-1.5 line-clamp-2">{item.title}</p>
      {item.description && (
        <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{item.description}</p>
      )}
    </button>
  );
}

const RISK_CATEGORIES = ["operational", "financial", "compliance", "strategic", "technology", "reputational"] as const;

const categoryKeywords: Record<string, string[]> = {
  operational: ["operations", "process", "supply chain", "outage", "disruption", "failure", "incident"],
  financial: ["financial", "fraud", "revenue", "cost", "budget", "monetary", "payment", "fiscal"],
  compliance: ["compliance", "regulation", "regulatory", "legal", "audit", "policy", "gdpr", "sox", "hipaa"],
  strategic: ["strategy", "strategic", "market", "competitive", "growth", "expansion", "merger"],
  technology: ["technology", "cyber", "data breach", "security", "software", "system", "it ", "network", "vulnerability"],
  reputational: ["reputation", "brand", "public", "media", "trust", "customer satisfaction"],
};

function inferCategoryFromText(title: string, description: string): string | undefined {
  const text = (title + " " + description).toLowerCase();
  let bestCategory: string | undefined;
  let bestScore = 0;
  for (const [cat, keywords] of Object.entries(categoryKeywords)) {
    const score = keywords.filter(kw => text.includes(kw)).length;
    if (score > bestScore) {
      bestScore = score;
      bestCategory = cat;
    }
  }
  return bestCategory && RISK_CATEGORIES.includes(bestCategory as typeof RISK_CATEGORIES[number]) ? bestCategory : undefined;
}

function simpleRelevanceScore(text: string, searchText: string): number {
  if (!searchText.trim()) return 0.5;
  const search = searchText.toLowerCase();
  const content = text.toLowerCase();
  const words = search.split(/\s+/).filter(Boolean);
  if (words.length === 0) return 0.5;
  const matchCount = words.filter(w => content.includes(w)).length;
  return matchCount / words.length;
}

export function AiIntelligencePanel({
  searchText,
  selectedSources,
  onSelectSource,
  onDeselectSource,
}: AiIntelligencePanelProps) {
  const [activeTab, setActiveTab] = useState("all");

  const { data: signalsData, isLoading: signalsLoading } = useListSignals({ limit: 50 });
  const { data: findingsData, isLoading: findingsLoading } = useListFindings({ limit: 50 });
  const { data: agentData, isLoading: agentLoading } = useListAgentFindings({ limit: 50 });

  const isLoading = signalsLoading || findingsLoading || agentLoading;

  const allSources = useMemo(() => {
    const items: SourceItem[] = [];

    if (signalsData?.data) {
      for (const s of signalsData.data) {
        items.push({
          id: s.id!,
          sourceType: "signal",
          title: s.content?.slice(0, 100) || "Signal",
          description: s.content || "",
          confidence: s.confidence ? Number(s.confidence) : undefined,
          category: s.classification || undefined,
        });
      }
    }

    if (findingsData?.data) {
      for (const f of findingsData.data) {
        const findingCategory = inferCategoryFromText(f.title || "", f.description || "");
        items.push({
          id: f.id!,
          sourceType: "finding",
          title: f.title || "Finding",
          description: f.description || "",
          category: findingCategory,
        });
      }
    }

    if (agentData?.data) {
      const agentTypeToCategory: Record<string, string> = {
        cascade_chain: "operational",
        cluster: "operational",
        predictive_signal: "strategic",
        anomaly: "technology",
        cross_domain: "compliance",
        recommendation: "strategic",
      };
      for (const a of agentData.data) {
        items.push({
          id: a.id!,
          sourceType: "agent_detection",
          title: a.title || "Agent Detection",
          description: a.narrative || "",
          severity: a.severity || undefined,
          confidence: a.severity === "critical" ? 0.95 :
            a.severity === "high" ? 0.8 :
            a.severity === "medium" ? 0.6 : 0.4,
          category: (a.type && agentTypeToCategory[a.type]) || inferCategoryFromText(a.title || "", a.narrative || ""),
        });
      }
    }

    return items;
  }, [signalsData, findingsData, agentData]);

  const rankedSources = useMemo(() => {
    return allSources
      .map(item => ({
        ...item,
        relevance: simpleRelevanceScore(item.title + " " + item.description, searchText),
      }))
      .sort((a, b) => b.relevance - a.relevance);
  }, [allSources, searchText]);

  const filteredSources = useMemo(() => {
    if (activeTab === "all") return rankedSources;
    if (activeTab === "signals") return rankedSources.filter(s => s.sourceType === "signal");
    if (activeTab === "findings") return rankedSources.filter(s => s.sourceType === "finding");
    if (activeTab === "detections") return rankedSources.filter(s => s.sourceType === "agent_detection");
    return rankedSources;
  }, [rankedSources, activeTab]);

  const selectedIds = new Set(selectedSources.map(s => s.id));

  const handleToggle = (item: SourceItem) => {
    if (selectedIds.has(item.id)) {
      onDeselectSource(item.id);
    } else {
      onSelectSource(item);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-4 py-3 border-b bg-muted/30">
        <Brain className="h-4 w-4 text-primary" />
        <span className="text-sm font-semibold">AI Intelligence</span>
        {selectedSources.length > 0 && (
          <Badge variant="secondary" className="ml-auto text-[10px]">
            {selectedSources.length} selected
          </Badge>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab} className="flex-1 flex flex-col min-h-0">
        <TabsList className="mx-3 mt-2 h-8">
          <TabsTrigger value="all" className="text-xs px-2">All</TabsTrigger>
          <TabsTrigger value="signals" className="text-xs px-2">
            <Radio className="h-3 w-3 mr-1" />Signals
          </TabsTrigger>
          <TabsTrigger value="findings" className="text-xs px-2">
            <SearchIcon className="h-3 w-3 mr-1" />Findings
          </TabsTrigger>
          <TabsTrigger value="detections" className="text-xs px-2">
            <AlertTriangle className="h-3 w-3 mr-1" />Agent
          </TabsTrigger>
        </TabsList>

        <ScrollArea className="flex-1 min-h-0">
          <div className="p-3 space-y-2">
            {isLoading ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Loader2 className="h-5 w-5 animate-spin mb-2" />
                <p className="text-xs">Loading intelligence data...</p>
              </div>
            ) : filteredSources.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-muted-foreground">
                <Brain className="h-8 w-8 mb-2 opacity-40" />
                <p className="text-xs">No matching intelligence found</p>
                <p className="text-[10px] mt-1">Try adjusting your search or check other tabs</p>
              </div>
            ) : (
              filteredSources.map(item => (
                <SourceCard
                  key={item.id}
                  item={item}
                  selected={selectedIds.has(item.id)}
                  onToggle={() => handleToggle(item)}
                />
              ))
            )}
          </div>
        </ScrollArea>
      </Tabs>
    </div>
  );
}

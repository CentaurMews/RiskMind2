import { AppLayout } from "@/components/layout/app-layout";
import { Card, CardContent } from "@/components/ui/card";
import { Dice5, Globe, Brain, GitBranch } from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface FeatureCardProps {
  icon: LucideIcon;
  title: string;
  description: string;
}

const features: FeatureCardProps[] = [
  {
    icon: Dice5,
    title: "Monte Carlo Simulation",
    description:
      "Model risk scenarios with statistical confidence. Run thousands of simulations to understand probability distributions of risk outcomes.",
  },
  {
    icon: Globe,
    title: "OSINT Risk Horizon",
    description:
      "Enrich your risk landscape with external intelligence. Automated monitoring of threat feeds, regulatory changes, and industry signals.",
  },
  {
    icon: Brain,
    title: "Agent Intelligence Feed",
    description:
      "Your autonomous risk agent's findings in one actionable inbox. Approve, dismiss, or escalate AI-detected risks with full transparency.",
  },
  {
    icon: GitBranch,
    title: "What-If Scenario Builder",
    description:
      "Explore hypothetical scenarios interactively. 'What if this vendor fails?' See cascading impacts across your risk landscape instantly.",
  },
];

function FeatureCard({ icon: Icon, title, description }: FeatureCardProps) {
  return (
    <Card className="relative overflow-hidden bg-gradient-to-br from-muted/40 to-card hover:shadow-md transition-all duration-200 hover:-translate-y-0.5">
      <CardContent className="p-6">
        <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center mb-4">
          <Icon className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="font-semibold text-base text-foreground/80">{title}</p>
        <p className="text-sm text-muted-foreground leading-relaxed mt-1">
          {description}
        </p>
        <div className="flex justify-end mt-4">
          <span className="text-xs font-mono text-muted-foreground/60 border border-muted rounded-full px-2 py-0.5">
            Coming in v2
          </span>
        </div>
      </CardContent>
    </Card>
  );
}

export default function Foresight() {
  return (
    <AppLayout>
      <div className="p-8 max-w-5xl mx-auto">
        <div className="mb-12">
          <h1 className="text-3xl font-bold tracking-tight">Foresight</h1>
          <p className="text-muted-foreground mt-2 max-w-xl">
            Advanced predictive capabilities are coming in the next release.
            Here's what's on the horizon.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
          {features.map((f) => (
            <FeatureCard key={f.title} {...f} />
          ))}
        </div>

        <p className="text-center text-xs text-muted-foreground/50 mt-12 font-mono tracking-widest uppercase">
          v2 — Planned
        </p>
      </div>
    </AppLayout>
  );
}

import { useState } from "react";
import {
  useCreateForesightScenario,
  useUpdateForesightScenario,
  useListRisks,
  type ForesightScenario,
  type TriangularParam,
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { HelpCircle, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";
import { getListForesightScenariosQueryKey } from "@workspace/api-client-react";

interface TriangularInputProps {
  label: string;
  tooltip: string;
  value: TriangularParam;
  onChange: (v: TriangularParam) => void;
  min: number;
  max: number;
  step: number;
  format?: (n: number) => string;
}

function TriangularInput({
  label,
  tooltip,
  value,
  onChange,
  min,
  max,
  step,
  format,
}: TriangularInputProps) {
  const fmt = format ?? ((n: number) => String(n));

  const handleMin = (vals: number[]) => {
    const newMin = vals[0];
    onChange({
      min: newMin,
      mode: Math.max(newMin, value.mode),
      max: Math.max(newMin, value.max),
    });
  };

  const handleMode = (vals: number[]) => {
    const newMode = vals[0];
    onChange({
      min: Math.min(value.min, newMode),
      mode: newMode,
      max: Math.max(newMode, value.max),
    });
  };

  const handleMax = (vals: number[]) => {
    const newMax = vals[0];
    onChange({
      min: Math.min(value.min, newMax),
      mode: Math.min(value.mode, newMax),
      max: newMax,
    });
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">{label}</span>
        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <HelpCircle className="h-3.5 w-3.5 text-muted-foreground cursor-help" />
            </TooltipTrigger>
            <TooltipContent side="right" className="max-w-60">
              <p className="text-xs">{tooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>
      <div className="grid grid-cols-3 gap-4">
        {/* Min */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Minimum</span>
            <span className="font-mono">{fmt(value.min)}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[value.min]}
            onValueChange={handleMin}
          />
        </div>
        {/* Mode */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Most Likely</span>
            <span className="font-mono">{fmt(value.mode)}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[value.mode]}
            onValueChange={handleMode}
          />
        </div>
        {/* Max */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>Maximum</span>
            <span className="font-mono">{fmt(value.max)}</span>
          </div>
          <Slider
            min={min}
            max={max}
            step={step}
            value={[value.max]}
            onValueChange={handleMax}
          />
        </div>
      </div>
    </div>
  );
}

interface FAIRState {
  tef: TriangularParam;
  vulnerability: TriangularParam;
  lossMagnitude: TriangularParam;
}

function defaultFAIR(): FAIRState {
  return {
    tef: { min: 1, mode: 10, max: 52 },
    vulnerability: { min: 0.1, mode: 0.3, max: 0.7 },
    lossMagnitude: { min: 10000, mode: 100000, max: 500000 },
  };
}

function parseParamsFromScenario(scenario?: ForesightScenario): FAIRState {
  if (!scenario?.parameters) return defaultFAIR();
  const p = scenario.parameters as {
    tef?: TriangularParam;
    vulnerability?: TriangularParam;
    lossMagnitude?: TriangularParam;
  };
  return {
    tef: p.tef ?? defaultFAIR().tef,
    vulnerability: p.vulnerability ?? defaultFAIR().vulnerability,
    lossMagnitude: p.lossMagnitude ?? defaultFAIR().lossMagnitude,
  };
}

function formatUSD(n: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(n);
}

const ITERATION_OPTIONS = [
  { value: "10000", label: "10k (fast)" },
  { value: "25000", label: "25k" },
  { value: "50000", label: "50k (recommended)" },
  { value: "100000", label: "100k (precise)" },
];

export interface ScenarioFormProps {
  scenario?: ForesightScenario;
  onSuccess?: (scenario: ForesightScenario) => void;
  onCancel?: () => void;
}

export function ScenarioForm({ scenario, onSuccess, onCancel }: ScenarioFormProps) {
  const qc = useQueryClient();
  const isEdit = !!scenario;

  const [name, setName] = useState(scenario?.name ?? "");
  const [description, setDescription] = useState(scenario?.description ?? "");
  const [riskId, setRiskId] = useState(scenario?.riskId ?? "");
  const [iterationCount, setIterationCount] = useState("50000");
  const [fair, setFair] = useState<FAIRState>(parseParamsFromScenario(scenario));

  const { data: risksData } = useListRisks();
  const risks = risksData ?? [];

  const createMutation = useCreateForesightScenario({
    mutation: {
      onSuccess: (created) => {
        qc.invalidateQueries({ queryKey: getListForesightScenariosQueryKey() });
        toast({ title: "Scenario created", description: created.name });
        onSuccess?.(created);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to create scenario", variant: "destructive" });
      },
    },
  });

  const updateMutation = useUpdateForesightScenario({
    mutation: {
      onSuccess: (updated) => {
        qc.invalidateQueries({ queryKey: getListForesightScenariosQueryKey() });
        toast({ title: "Scenario updated", description: updated.name });
        onSuccess?.(updated);
      },
      onError: () => {
        toast({ title: "Error", description: "Failed to update scenario", variant: "destructive" });
      },
    },
  });

  const isPending = createMutation.isPending || updateMutation.isPending;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast({ title: "Name required", variant: "destructive" });
      return;
    }

    const parameters = {
      tef: fair.tef,
      vulnerability: fair.vulnerability,
      lossMagnitude: fair.lossMagnitude,
      iterationCount: parseInt(iterationCount, 10),
    };

    if (isEdit && scenario) {
      updateMutation.mutate({
        id: scenario.id,
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          riskId: riskId || null,
          parameters,
        },
      });
    } else {
      createMutation.mutate({
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          riskId: riskId || undefined,
          parameters,
        },
      });
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Basic fields */}
      <div className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="scenario-name">Scenario Name *</Label>
          <Input
            id="scenario-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Ransomware attack on ERP system"
            required
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="scenario-description">Description</Label>
          <Textarea
            id="scenario-description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe the threat scenario..."
            rows={3}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="scenario-risk">Linked Risk (optional)</Label>
            <Select value={riskId} onValueChange={setRiskId}>
              <SelectTrigger id="scenario-risk">
                <SelectValue placeholder="Select a risk..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">None</SelectItem>
                {risks.map((r) => (
                  <SelectItem key={r.id ?? ""} value={r.id ?? ""}>
                    {r.title}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="scenario-iterations">Iterations</Label>
            <Select value={iterationCount} onValueChange={setIterationCount}>
              <SelectTrigger id="scenario-iterations">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ITERATION_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      {/* FAIR Parameters */}
      <div className="space-y-5 border-t pt-5">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">FAIR Parameters</h3>
          <Button type="button" variant="ghost" size="sm" className="text-xs text-muted-foreground" disabled>
            Calibrate from Real Data
          </Button>
        </div>

        {/* TEF */}
        <TriangularInput
          label="Threat Event Frequency (TEF)"
          tooltip="How many times per year a threat agent could act against this asset. A ransomware group targeting mid-size companies may attempt 4–52 times/year."
          value={fair.tef}
          onChange={(v) => setFair((prev) => ({ ...prev, tef: v }))}
          min={0}
          max={365}
          step={1}
          format={(n) => `${n}/yr`}
        />

        {/* Vulnerability */}
        <TriangularInput
          label="Vulnerability (P(loss))"
          tooltip="Probability that a threat event results in loss. Combines your control effectiveness and the threat agent's capability. 0 = perfect controls, 1 = no controls."
          value={fair.vulnerability}
          onChange={(v) => setFair((prev) => ({ ...prev, vulnerability: v }))}
          min={0}
          max={1}
          step={0.01}
          format={(n) => `${(n * 100).toFixed(0)}%`}
        />

        {/* Loss Magnitude */}
        <TriangularInput
          label="Loss Magnitude"
          tooltip="Expected dollar value of loss per threat event. Includes primary losses (response costs, data recovery) and secondary losses (fines, reputation)."
          value={fair.lossMagnitude}
          onChange={(v) => setFair((prev) => ({ ...prev, lossMagnitude: v }))}
          min={0}
          max={10000000}
          step={1000}
          format={formatUSD}
        />
      </div>

      {/* Actions */}
      <div className="flex gap-2 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="outline" onClick={onCancel} disabled={isPending}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isEdit ? "Update Scenario" : "Create Scenario"}
        </Button>
      </div>
    </form>
  );
}

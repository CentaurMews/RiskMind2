import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Slider } from "@/components/ui/slider";
import { Spinner } from "@/components/ui/spinner";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { CheckCircle2, Zap, X } from "lucide-react";
import { toast } from "sonner";
import {
  useCreateForesightScenario,
  useUpdateForesightScenario,
  usePostForesightCalibrate,
} from "@workspace/api-client-react";
import type {
  ForesightScenario,
  CalibrationResult,
  TriangularParam,
} from "@workspace/api-client-react";

interface FAIRSliderGroupProps {
  label: string;
  description: string;
  value: { min: number; mode: number; max: number };
  onChange: (val: { min: number; mode: number; max: number }) => void;
  min: number;
  max: number;
  step: number;
  format: (v: number) => string;
  calibrated?: boolean;
}

function FAIRSliderGroup({
  label,
  description,
  value,
  onChange,
  min,
  max,
  step,
  format,
  calibrated,
}: FAIRSliderGroupProps) {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <div>
          <p className="text-sm font-medium">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
        {calibrated && (
          <Badge
            variant="outline"
            className="ml-auto shrink-0 text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 gap-1 text-xs"
          >
            <CheckCircle2 className="h-3 w-3" />
            Calibrated
          </Badge>
        )}
      </div>
      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Min</Label>
          <Slider
            min={min}
            max={value.mode}
            step={step}
            value={[value.min]}
            onValueChange={([v]) =>
              onChange({ ...value, min: Math.min(v, value.mode) })
            }
          />
          <p className="text-xs tabular-nums text-center">{format(value.min)}</p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Mode</Label>
          <Slider
            min={value.min}
            max={value.max}
            step={step}
            value={[value.mode]}
            onValueChange={([v]) =>
              onChange({
                ...value,
                mode: Math.max(value.min, Math.min(v, value.max)),
              })
            }
          />
          <p className="text-xs tabular-nums text-center font-medium text-primary">
            {format(value.mode)}
          </p>
        </div>
        <div className="space-y-1.5">
          <Label className="text-xs text-muted-foreground">Max</Label>
          <Slider
            min={value.mode}
            max={max}
            step={step}
            value={[value.max]}
            onValueChange={([v]) =>
              onChange({ ...value, max: Math.max(v, value.mode) })
            }
          />
          <p className="text-xs tabular-nums text-center">{format(value.max)}</p>
        </div>
      </div>
    </div>
  );
}

interface ScenarioFormProps {
  scenario?: ForesightScenario;
  /** Pre-filled calibration values (from CalibrationPanel) */
  calibrationResult?: CalibrationResult | null;
  onSuccess?: () => void;
  onCancel?: () => void;
}

const DEFAULT_FAIR = {
  tef: { min: 0.1, mode: 1, max: 5 },
  vulnerability: { min: 0.1, mode: 0.3, max: 0.7 },
  lossMagnitude: { min: 10_000, mode: 100_000, max: 1_000_000 },
};

function parseTriangular(
  raw: unknown
): { min: number; mode: number; max: number } | null {
  if (
    raw &&
    typeof raw === "object" &&
    "min" in raw &&
    "mode" in raw &&
    "max" in raw
  ) {
    const t = raw as { min: unknown; mode: unknown; max: unknown };
    if (
      typeof t.min === "number" &&
      typeof t.mode === "number" &&
      typeof t.max === "number"
    ) {
      return { min: t.min, mode: t.mode, max: t.max };
    }
  }
  return null;
}

function clampTriangular(
  p: TriangularParam,
  domainMin: number,
  domainMax: number
): { min: number; mode: number; max: number } {
  const min = Math.max(domainMin, Math.min(p.min, domainMax));
  const max = Math.min(domainMax, Math.max(p.max, domainMin));
  const mode = Math.max(min, Math.min(p.mode, max));
  return { min, mode, max };
}

export function ScenarioForm({
  scenario,
  calibrationResult: initialCalibration,
  onSuccess,
  onCancel,
}: ScenarioFormProps) {
  const existingParams = scenario?.parameters as Record<string, unknown> | undefined;

  // Initialise from existing scenario params or defaults
  const [name, setName] = useState(scenario?.name ?? "");
  const [description, setDescription] = useState(scenario?.description ?? "");

  const [tef, setTef] = useState<{ min: number; mode: number; max: number }>(
    () =>
      parseTriangular(existingParams?.["tef"]) ?? DEFAULT_FAIR.tef
  );
  const [vulnerability, setVulnerability] = useState<{
    min: number;
    mode: number;
    max: number;
  }>(
    () =>
      parseTriangular(existingParams?.["vulnerability"]) ??
      DEFAULT_FAIR.vulnerability
  );
  const [lossMagnitude, setLossMagnitude] = useState<{
    min: number;
    mode: number;
    max: number;
  }>(
    () =>
      parseTriangular(existingParams?.["lossMagnitude"]) ??
      DEFAULT_FAIR.lossMagnitude
  );

  // Track whether values were calibrated
  const [calibrationResult, setCalibrationResult] =
    useState<CalibrationResult | null>(initialCalibration ?? null);
  const [calibratedFields, setCalibratedFields] = useState<Set<string>>(
    () =>
      new Set(
        initialCalibration
          ? [
              initialCalibration.tef ? "tef" : null,
              initialCalibration.vulnerability ? "vulnerability" : null,
              initialCalibration.lossMagnitude ? "lossMagnitude" : null,
            ].filter(Boolean) as string[]
          : []
      )
  );

  const calibrateMutation = usePostForesightCalibrate({
    mutation: {
      onSuccess: (data) => {
        setCalibrationResult(data);
        const fields = new Set<string>();
        if (data.tef) {
          const clamped = clampTriangular(data.tef, 0, 100);
          setTef(clamped);
          fields.add("tef");
        }
        if (data.vulnerability) {
          const clamped = clampTriangular(data.vulnerability, 0, 1);
          setVulnerability(clamped);
          fields.add("vulnerability");
        }
        if (data.lossMagnitude) {
          const clamped = clampTriangular(
            data.lossMagnitude,
            0,
            100_000_000
          );
          setLossMagnitude(clamped);
          fields.add("lossMagnitude");
        }
        setCalibratedFields(fields);
        if (fields.size > 0) {
          toast.success("FAIR parameters pre-filled from signal data");
        } else {
          toast.warning(
            data.message ?? "Insufficient signal data for calibration"
          );
        }
      },
      onError: () => {
        toast.error("Calibration failed");
      },
    },
  });

  const createMutation = useCreateForesightScenario({
    mutation: {
      onSuccess: () => {
        toast.success("Scenario created");
        onSuccess?.();
      },
      onError: () => {
        toast.error("Failed to create scenario");
      },
    },
  });

  const updateMutation = useUpdateForesightScenario({
    mutation: {
      onSuccess: () => {
        toast.success("Scenario updated");
        onSuccess?.();
      },
      onError: () => {
        toast.error("Failed to update scenario");
      },
    },
  });

  const handleClearCalibration = useCallback(() => {
    setCalibrationResult(null);
    setCalibratedFields(new Set());
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Scenario name is required");
      return;
    }

    const params = {
      tef,
      vulnerability,
      lossMagnitude,
      iterations: 50_000,
      ...(calibrationResult?.sampleSize
        ? {
            calibratedFrom: `OSINT: ${calibrationResult.sampleSize} signals (${calibrationResult.dataFreshness})`,
          }
        : {}),
    };

    if (scenario) {
      updateMutation.mutate({
        id: scenario.id,
        data: { name: name.trim(), description: description.trim() || undefined, parameters: params },
      });
    } else {
      createMutation.mutate({
        data: {
          name: name.trim(),
          description: description.trim() || undefined,
          parameters: params,
        },
      });
    }
  };

  const isPending = createMutation.isPending || updateMutation.isPending;
  const isCalibrating = calibrateMutation.isPending;

  const hasCalibratedData =
    calibrationResult !== null && calibratedFields.size > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {/* Header with calibrated badge */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold">
            {scenario ? "Edit Scenario" : "New Scenario"}
          </h3>
          <p className="text-sm text-muted-foreground">
            Configure FAIR parameters for Monte Carlo simulation
          </p>
        </div>
        {hasCalibratedData && (
          <div className="flex items-center gap-2">
            <Badge
              variant="outline"
              className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 gap-1"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Calibrated from real data
            </Badge>
            {calibrationResult?.dataFreshness && (
              <span className="text-xs text-muted-foreground">
                {calibrationResult.dataFreshness}
              </span>
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 text-muted-foreground"
              onClick={handleClearCalibration}
              title="Clear calibration"
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        )}
      </div>

      {/* Name + description */}
      <div className="grid gap-4">
        <div className="space-y-1.5">
          <Label htmlFor="scenario-name">Name</Label>
          <Input
            id="scenario-name"
            placeholder="e.g., Ransomware Attack on Core Systems"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="scenario-desc">Description</Label>
          <Textarea
            id="scenario-desc"
            placeholder="Optional description of this scenario…"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={2}
          />
        </div>
      </div>

      <Separator />

      {/* FAIR parameters */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold">FAIR Parameters</p>
            <p className="text-xs text-muted-foreground">
              Triangular distribution inputs — min / mode (most likely) / max
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => calibrateMutation.mutate(undefined)}
            disabled={isCalibrating}
          >
            {isCalibrating ? (
              <>
                <Spinner className="mr-2 h-3.5 w-3.5" />
                Calibrating…
              </>
            ) : (
              <>
                <Zap className="mr-2 h-3.5 w-3.5" />
                Calibrate from Real Data
              </>
            )}
          </Button>
        </div>

        <Card className="mt-3">
          <CardContent className="pt-5 space-y-6">
            <FAIRSliderGroup
              label="Threat Event Frequency (TEF)"
              description="How many times per year a threat actor could act against this risk"
              value={tef}
              onChange={setTef}
              min={0}
              max={100}
              step={0.1}
              format={(v) =>
                v < 1 ? `${v.toFixed(2)} evt/yr` : `${v.toFixed(1)} evt/yr`
              }
              calibrated={calibratedFields.has("tef")}
            />

            <Separator />

            <FAIRSliderGroup
              label="Vulnerability (TC × CS)"
              description="Probability that a threat event results in a loss event (0 – 1)"
              value={vulnerability}
              onChange={setVulnerability}
              min={0}
              max={1}
              step={0.01}
              format={(v) => `${(v * 100).toFixed(0)}%`}
              calibrated={calibratedFields.has("vulnerability")}
            />

            <Separator />

            <FAIRSliderGroup
              label="Loss Magnitude"
              description="Expected financial impact per loss event"
              value={lossMagnitude}
              onChange={setLossMagnitude}
              min={0}
              max={100_000_000}
              step={1_000}
              format={(v) => {
                if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
                if (v >= 1_000) return `$${(v / 1_000).toFixed(1)}K`;
                return `$${v.toFixed(0)}`;
              }}
              calibrated={calibratedFields.has("lossMagnitude")}
            />
          </CardContent>
        </Card>

        {hasCalibratedData && calibrationResult?.sampleSize !== undefined && (
          <p className="text-xs text-muted-foreground pl-1">
            Parameters derived from{" "}
            <span className="font-medium">{calibrationResult.sampleSize}</span>{" "}
            signals ({calibrationResult.dataFreshness}). Adjust as needed.
          </p>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 justify-end pt-2">
        {onCancel && (
          <Button type="button" variant="ghost" onClick={onCancel}>
            Cancel
          </Button>
        )}
        <Button type="submit" disabled={isPending}>
          {isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              {scenario ? "Saving…" : "Creating…"}
            </>
          ) : scenario ? (
            "Save Changes"
          ) : (
            "Create Scenario"
          )}
        </Button>
      </div>
    </form>
  );
}

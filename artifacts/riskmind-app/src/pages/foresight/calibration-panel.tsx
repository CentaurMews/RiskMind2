import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { Spinner } from "@/components/ui/spinner";
import {
  CheckCircle2,
  Database,
  AlertCircle,
  Settings,
  Zap,
} from "lucide-react";
import { usePostForesightCalibrate } from "@workspace/api-client-react";
import type {
  CalibrationResult,
  TriangularParam,
} from "@workspace/api-client-react";
import { Link } from "wouter";

interface CalibrationPanelProps {
  /** Called when calibration completes — parent can pre-fill scenario form */
  onCalibrate?: (result: CalibrationResult) => void;
  /** Called when user clicks "Apply to New Scenario" */
  onApplyToNewScenario?: (result: CalibrationResult) => void;
}

function formatUsd(value: number): string {
  if (value >= 1_000_000) {
    return `$${(value / 1_000_000).toFixed(1)}M`;
  }
  if (value >= 1_000) {
    return `$${(value / 1_000).toFixed(1)}K`;
  }
  return `$${value.toFixed(0)}`;
}

function formatVulnerability(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatTef(value: number): string {
  if (value < 1) {
    return `${(value).toFixed(2)} events/yr`;
  }
  return `${value.toFixed(1)} events/yr`;
}

interface ParameterRowProps {
  label: string;
  param: TriangularParam;
  format: (v: number) => string;
  description: string;
}

function ParameterRow({ label, param, format, description }: ParameterRowProps) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-foreground">{label}</p>
          <p className="text-xs text-muted-foreground">{description}</p>
        </div>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Min</p>
          <p className="text-sm font-semibold tabular-nums">{format(param.min)}</p>
        </div>
        <div className="rounded-lg bg-primary/10 border border-primary/20 px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Mode</p>
          <p className="text-sm font-semibold tabular-nums text-primary">{format(param.mode)}</p>
        </div>
        <div className="rounded-lg bg-muted/40 px-3 py-2 text-center">
          <p className="text-xs text-muted-foreground mb-0.5">Max</p>
          <p className="text-sm font-semibold tabular-nums">{format(param.max)}</p>
        </div>
      </div>
    </div>
  );
}

export function CalibrationPanel({
  onCalibrate,
  onApplyToNewScenario,
}: CalibrationPanelProps) {
  const [result, setResult] = useState<CalibrationResult | null>(null);

  const calibrateMutation = usePostForesightCalibrate({
    mutation: {
      onSuccess: (data) => {
        setResult(data);
        onCalibrate?.(data);
      },
    },
  });

  const hasData =
    result !== null &&
    (result.tef !== null ||
      result.vulnerability !== null ||
      result.lossMagnitude !== null);

  const handleCalibrate = () => {
    calibrateMutation.mutate(undefined);
  };

  const handleApply = () => {
    if (result) {
      onApplyToNewScenario?.(result);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-lg font-semibold">OSINT Calibration</h2>
          <p className="text-sm text-muted-foreground mt-1">
            Derive FAIR parameter suggestions from your tenant's real signal
            data — CVE severity, threat frequencies, and MISP intelligence.
          </p>
        </div>
        <Button
          onClick={handleCalibrate}
          disabled={calibrateMutation.isPending}
          className="shrink-0"
        >
          {calibrateMutation.isPending ? (
            <>
              <Spinner className="mr-2 h-4 w-4" />
              Calibrating…
            </>
          ) : (
            <>
              <Zap className="mr-2 h-4 w-4" />
              Calibrate from Real Data
            </>
          )}
        </Button>
      </div>

      {/* Initial state (no result yet) */}
      {result === null && !calibrateMutation.isPending && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Database className="h-10 w-10 text-muted-foreground/40 mb-4" />
            <p className="text-sm font-medium text-muted-foreground">
              Click "Calibrate from Real Data" to analyze your signal corpus
            </p>
            <p className="text-xs text-muted-foreground/60 mt-1">
              Analyzes CVE, MISP, and other signals from the last 90 days
            </p>
          </CardContent>
        </Card>
      )}

      {/* Loading state */}
      {calibrateMutation.isPending && (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <Spinner className="h-8 w-8 text-primary mb-4" />
            <p className="text-sm font-medium">Analyzing signal corpus…</p>
            <p className="text-xs text-muted-foreground mt-1">
              Processing CVE scores, MISP threat levels, and signal frequencies
            </p>
          </CardContent>
        </Card>
      )}

      {/* Error state */}
      {calibrateMutation.isError && (
        <Card className="border-destructive/40">
          <CardContent className="flex items-center gap-3 py-4">
            <AlertCircle className="h-5 w-5 text-destructive shrink-0" />
            <p className="text-sm text-destructive">
              Calibration failed. Please try again.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Result: insufficient data */}
      {result !== null && !hasData && (
        <Card className="border-amber-200 dark:border-amber-900/40 bg-amber-50/40 dark:bg-amber-950/10">
          <CardHeader className="pb-3">
            <div className="flex items-center gap-2">
              <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              <CardTitle className="text-base text-amber-800 dark:text-amber-300">
                Insufficient Data
              </CardTitle>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-sm text-amber-700 dark:text-amber-300">
              {result.message
                ? result.message
                : `No relevant signals found in the last 90 days. Add signal integrations to enable calibration.`}
            </p>
            <div className="flex items-center gap-4 text-xs text-muted-foreground">
              <span>
                <span className="font-medium">{result.sampleSize}</span> signals
                analyzed
              </span>
              <span>Data window: {result.dataFreshness}</span>
            </div>
            <Button variant="outline" size="sm" asChild>
              <Link to="/settings?tab=integrations">
                <Settings className="mr-2 h-3.5 w-3.5" />
                Configure Integrations
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Result: has calibrated data */}
      {result !== null && hasData && (
        <div className="space-y-4">
          {/* Freshness badge row */}
          <div className="flex items-center gap-3 flex-wrap">
            <Badge
              variant="outline"
              className="text-green-700 dark:text-green-400 border-green-300 dark:border-green-700 bg-green-50 dark:bg-green-950/20 gap-1.5"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              Calibrated from real data
            </Badge>
            <span className="text-xs text-muted-foreground">
              Based on{" "}
              <span className="font-medium">{result.sampleSize}</span> signals
            </span>
            <span className="text-xs text-muted-foreground">
              Data window:{" "}
              <span className="font-medium">{result.dataFreshness}</span>
            </span>
          </div>

          {/* Parameter cards */}
          <div className="grid gap-4">
            {result.tef && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Threat Event Frequency (TEF)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Estimated annual frequency of threat events based on
                    observed signal volume
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ParameterRow
                    label="TEF"
                    param={result.tef}
                    format={formatTef}
                    description="Derived from signal frequency over the last 90 days"
                  />
                </CardContent>
              </Card>
            )}

            {result.vulnerability && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Vulnerability (TC × CS)
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Estimated probability of successful exploitation based on
                    MISP threat levels
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ParameterRow
                    label="Vulnerability"
                    param={result.vulnerability}
                    format={formatVulnerability}
                    description="Derived from MISP threat-level distribution across recent signals"
                  />
                </CardContent>
              </Card>
            )}

            {result.lossMagnitude && (
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-sm font-semibold">
                    Loss Magnitude
                  </CardTitle>
                  <CardDescription className="text-xs">
                    Estimated financial loss range based on CVE CVSS scores
                    (exponential mapping)
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ParameterRow
                    label="Loss Magnitude"
                    param={result.lossMagnitude}
                    format={formatUsd}
                    description="Derived from CVSS score distribution — base $10K × 10^(cvss/5)"
                  />
                </CardContent>
              </Card>
            )}
          </div>

          <Separator />

          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground">
              These suggestions are statistical estimates — review and adjust
              before running simulations.
            </p>
            <Button onClick={handleApply} size="sm">
              Apply to New Scenario
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

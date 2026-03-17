export type VendorStatus = "identification" | "due_diligence" | "risk_assessment" | "contracting" | "onboarding" | "monitoring" | "offboarding";
export type VendorTier = "critical" | "high" | "medium" | "low";

const FULL_FLOW: VendorStatus[] = [
  "identification",
  "due_diligence",
  "risk_assessment",
  "contracting",
  "onboarding",
  "monitoring",
  "offboarding",
];

const SIMPLIFIED_FLOW: VendorStatus[] = [
  "identification",
  "risk_assessment",
  "monitoring",
  "offboarding",
];

export function getLifecycleFlow(tier: VendorTier): VendorStatus[] {
  if (tier === "critical" || tier === "high") {
    return FULL_FLOW;
  }
  return SIMPLIFIED_FLOW;
}

const FULL_TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  identification: ["due_diligence"],
  due_diligence: ["risk_assessment"],
  risk_assessment: ["contracting"],
  contracting: ["onboarding"],
  onboarding: ["monitoring"],
  monitoring: ["offboarding"],
  offboarding: [],
};

const SIMPLIFIED_TRANSITIONS: Record<VendorStatus, VendorStatus[]> = {
  identification: ["risk_assessment"],
  due_diligence: ["risk_assessment"],
  risk_assessment: ["monitoring"],
  contracting: ["monitoring"],
  onboarding: ["monitoring"],
  monitoring: ["offboarding"],
  offboarding: [],
};

export function getAllowedTransitions(tier: VendorTier, currentStatus: VendorStatus): VendorStatus[] {
  if (tier === "critical" || tier === "high") {
    return FULL_TRANSITIONS[currentStatus] || [];
  }
  return SIMPLIFIED_TRANSITIONS[currentStatus] || [];
}

interface PrerequisiteCheckResult {
  allowed: boolean;
  reason?: string;
}

export async function checkPrerequisites(
  _vendorId: string,
  _currentStatus: VendorStatus,
  targetStatus: VendorStatus,
  context: { hasCompletedQuestionnaire: boolean },
): Promise<PrerequisiteCheckResult> {
  if (targetStatus === "risk_assessment" && !context.hasCompletedQuestionnaire) {
    return {
      allowed: false,
      reason: "A completed questionnaire is required before advancing to Risk Assessment.",
    };
  }

  return { allowed: true };
}

export function computeTierFromRiskScore(riskScore: number): VendorTier {
  if (riskScore >= 75) return "critical";
  if (riskScore >= 50) return "high";
  if (riskScore >= 25) return "medium";
  return "low";
}

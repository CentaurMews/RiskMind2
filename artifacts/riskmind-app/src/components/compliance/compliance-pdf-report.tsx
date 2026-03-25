import { Document, Page, Text, View, StyleSheet } from "@react-pdf/renderer";

export interface CompliancePdfReportProps {
  frameworkName: string;
  frameworkVersion?: string;
  score: {
    score: number;
    coverageScore: number;
    effectivenessScore: number;
    totalRequirements: number;
    coveredRequirements: number;
    totalControls: number;
    passedControls: number;
    status?: string | null;
  };
  gaps: {
    summary: { total: number; covered: number; partial: number; gap: number };
    requirements: Array<{
      code: string;
      title: string;
      status: string;
      controls: Array<{ title?: string; testResult: string }>;
    }>;
  };
  generatedAt: string;
}

const styles = StyleSheet.create({
  page: {
    fontFamily: "Helvetica",
    fontSize: 10,
    color: "#1a1a1a",
    backgroundColor: "#ffffff",
    padding: 48,
  },
  // Header
  header: {
    marginBottom: 32,
    borderBottom: "1 solid #e5e7eb",
    paddingBottom: 24,
  },
  headerTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 8,
  },
  reportTitle: {
    fontSize: 22,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    letterSpacing: -0.5,
    maxWidth: 380,
  },
  reportLabel: {
    fontSize: 8,
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 1,
    marginBottom: 4,
  },
  reportMeta: {
    fontSize: 9,
    color: "#6b7280",
    textAlign: "right",
  },
  // Score section
  scoreSection: {
    flexDirection: "row",
    gap: 20,
    marginBottom: 32,
  },
  scoreCard: {
    flex: 1,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 20,
    border: "1 solid #e5e7eb",
  },
  scorePrimary: {
    alignItems: "center",
    paddingVertical: 8,
  },
  scoreNumber: {
    fontSize: 52,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    letterSpacing: -2,
    lineHeight: 1,
  },
  scoreLabel: {
    fontSize: 9,
    color: "#6b7280",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  scoreStatus: {
    fontSize: 10,
    fontFamily: "Helvetica-Bold",
    color: "#059669",
    marginTop: 8,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  subScoresCard: {
    flex: 1.5,
    backgroundColor: "#f9fafb",
    borderRadius: 8,
    padding: 20,
    border: "1 solid #e5e7eb",
    justifyContent: "center",
  },
  subScoreRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
  },
  subScoreLabel: {
    fontSize: 10,
    color: "#374151",
    fontFamily: "Helvetica-Bold",
  },
  subScoreValue: {
    fontSize: 10,
    color: "#111827",
    fontFamily: "Helvetica-Bold",
  },
  progressBarBg: {
    height: 4,
    backgroundColor: "#e5e7eb",
    borderRadius: 2,
    marginTop: 4,
    marginBottom: 4,
  },
  progressBarFill: {
    height: 4,
    backgroundColor: "#059669",
    borderRadius: 2,
  },
  // Gap summary grid
  gapGrid: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 32,
  },
  gapCard: {
    flex: 1,
    border: "1 solid #e5e7eb",
    borderRadius: 8,
    padding: 14,
    alignItems: "center",
  },
  gapCardCovered: {
    borderLeftWidth: 3,
    borderLeftColor: "#059669",
  },
  gapCardPartial: {
    borderLeftWidth: 3,
    borderLeftColor: "#d97706",
  },
  gapCardGap: {
    borderLeftWidth: 3,
    borderLeftColor: "#dc2626",
  },
  gapNumber: {
    fontSize: 24,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    lineHeight: 1,
  },
  gapNumberCovered: {
    color: "#059669",
  },
  gapNumberPartial: {
    color: "#d97706",
  },
  gapNumberGap: {
    color: "#dc2626",
  },
  gapCardLabel: {
    fontSize: 8,
    color: "#6b7280",
    marginTop: 4,
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  // Section title
  sectionTitle: {
    fontSize: 14,
    fontFamily: "Helvetica-Bold",
    color: "#111827",
    marginBottom: 12,
    paddingBottom: 8,
    borderBottom: "1 solid #e5e7eb",
  },
  // Table
  table: {
    marginBottom: 16,
  },
  tableHeader: {
    flexDirection: "row",
    backgroundColor: "#f3f4f6",
    borderBottom: "1 solid #d1d5db",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottom: "1 solid #f3f4f6",
    paddingVertical: 8,
    paddingHorizontal: 10,
  },
  tableRowAlt: {
    backgroundColor: "#fafafa",
  },
  cellCode: {
    width: 80,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#374151",
  },
  cellTitle: {
    flex: 1,
    fontSize: 9,
    color: "#374151",
    paddingRight: 8,
  },
  cellStatus: {
    width: 70,
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
  },
  cellStatusCovered: {
    color: "#059669",
  },
  cellStatusPartial: {
    color: "#d97706",
  },
  cellStatusGap: {
    color: "#dc2626",
  },
  cellControls: {
    width: 140,
    fontSize: 8,
    color: "#6b7280",
  },
  noGapsText: {
    fontSize: 11,
    color: "#6b7280",
    textAlign: "center",
    padding: 24,
    fontStyle: "italic",
  },
  // Footer
  footer: {
    position: "absolute",
    bottom: 30,
    left: 48,
    right: 48,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTop: "1 solid #e5e7eb",
    paddingTop: 10,
  },
  footerText: {
    fontSize: 7,
    color: "#9ca3af",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  footerPage: {
    fontSize: 7,
    color: "#9ca3af",
  },
  confidentialBadge: {
    fontSize: 7,
    color: "#9ca3af",
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
});

function formatDate(isoString: string): string {
  try {
    const d = new Date(isoString);
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
  } catch {
    return isoString;
  }
}

function getStatusLabel(status?: string | null): string {
  if (!status) return "";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

function PageFooter({ label }: { label: string }) {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>RiskMind Compliance Report</Text>
      <Text style={styles.confidentialBadge}>Confidential</Text>
      <Text style={styles.footerPage}>{label}</Text>
    </View>
  );
}

export default function CompliancePdfReport({
  frameworkName,
  frameworkVersion,
  score,
  gaps,
  generatedAt,
}: CompliancePdfReportProps) {
  const coverageWidth = Math.min(100, Math.max(0, score.coverageScore));
  const effectivenessWidth = Math.min(100, Math.max(0, score.effectivenessScore));

  const gapAndPartialRequirements = gaps.requirements.filter(
    (r) => r.status === "gap" || r.status === "partial"
  );

  return (
    <Document
      title={`${frameworkName} Compliance Report`}
      author="RiskMind"
      subject="Compliance Assessment"
      creator="RiskMind Platform"
    >
      {/* Page 1 — Executive Summary */}
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.reportLabel}>Compliance Report</Text>
              <Text style={styles.reportTitle}>{frameworkName}</Text>
            </View>
            <View>
              <Text style={styles.reportMeta}>
                {frameworkVersion ? `Version ${frameworkVersion}` : ""}
              </Text>
              <Text style={styles.reportMeta}>Generated {formatDate(generatedAt)}</Text>
            </View>
          </View>
        </View>

        {/* Score Section */}
        <Text style={styles.sectionTitle}>Executive Summary</Text>
        <View style={styles.scoreSection}>
          <View style={styles.scoreCard}>
            <View style={styles.scorePrimary}>
              <Text style={styles.scoreNumber}>{score.score}</Text>
              <Text style={styles.scoreLabel}>Overall Score</Text>
              {score.status && (
                <Text style={styles.scoreStatus}>{getStatusLabel(score.status)}</Text>
              )}
            </View>
          </View>

          <View style={styles.subScoresCard}>
            <View style={styles.subScoreRow}>
              <Text style={styles.subScoreLabel}>Requirement Coverage</Text>
              <Text style={styles.subScoreValue}>{score.coverageScore}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${coverageWidth}%` }]} />
            </View>

            <View style={[styles.subScoreRow, { marginTop: 12 }]}>
              <Text style={styles.subScoreLabel}>Control Effectiveness</Text>
              <Text style={styles.subScoreValue}>{score.effectivenessScore}%</Text>
            </View>
            <View style={styles.progressBarBg}>
              <View style={[styles.progressBarFill, { width: `${effectivenessWidth}%` }]} />
            </View>

            <View style={[styles.subScoreRow, { marginTop: 14 }]}>
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Total Requirements</Text>
              <Text style={{ fontSize: 9, color: "#374151", fontFamily: "Helvetica-Bold" }}>
                {score.totalRequirements}
              </Text>
            </View>
            <View style={styles.subScoreRow}>
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Requirements Covered</Text>
              <Text style={{ fontSize: 9, color: "#059669", fontFamily: "Helvetica-Bold" }}>
                {score.coveredRequirements}
              </Text>
            </View>
            <View style={styles.subScoreRow}>
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Total Controls</Text>
              <Text style={{ fontSize: 9, color: "#374151", fontFamily: "Helvetica-Bold" }}>
                {score.totalControls}
              </Text>
            </View>
            <View style={styles.subScoreRow}>
              <Text style={{ fontSize: 9, color: "#6b7280" }}>Controls Passed</Text>
              <Text style={{ fontSize: 9, color: "#059669", fontFamily: "Helvetica-Bold" }}>
                {score.passedControls}
              </Text>
            </View>
          </View>
        </View>

        {/* Gap Summary Grid */}
        <Text style={styles.sectionTitle}>Gap Summary</Text>
        <View style={styles.gapGrid}>
          <View style={styles.gapCard}>
            <Text style={styles.gapNumber}>{gaps.summary.total}</Text>
            <Text style={styles.gapCardLabel}>Total</Text>
          </View>
          <View style={[styles.gapCard, styles.gapCardCovered]}>
            <Text style={[styles.gapNumber, styles.gapNumberCovered]}>{gaps.summary.covered}</Text>
            <Text style={styles.gapCardLabel}>Covered</Text>
          </View>
          <View style={[styles.gapCard, styles.gapCardPartial]}>
            <Text style={[styles.gapNumber, styles.gapNumberPartial]}>{gaps.summary.partial}</Text>
            <Text style={styles.gapCardLabel}>Partial</Text>
          </View>
          <View style={[styles.gapCard, styles.gapCardGap]}>
            <Text style={[styles.gapNumber, styles.gapNumberGap]}>{gaps.summary.gap}</Text>
            <Text style={styles.gapCardLabel}>Gaps</Text>
          </View>
        </View>

        <PageFooter label="Page 1" />
      </Page>

      {/* Page 2+ — Gap Details */}
      <Page size="A4" style={styles.page}>
        <Text style={styles.sectionTitle}>
          Gap &amp; Partial Requirements ({gapAndPartialRequirements.length})
        </Text>

        {gapAndPartialRequirements.length === 0 ? (
          <Text style={styles.noGapsText}>
            No gaps identified — all requirements are fully covered.
          </Text>
        ) : (
          <View style={styles.table}>
            {/* Table Header */}
            <View style={styles.tableHeader}>
              <Text style={[styles.tableHeaderCell, { width: 80 }]}>Code</Text>
              <Text style={[styles.tableHeaderCell, { flex: 1 }]}>Requirement</Text>
              <Text style={[styles.tableHeaderCell, { width: 70 }]}>Status</Text>
              <Text style={[styles.tableHeaderCell, { width: 140 }]}>Controls</Text>
            </View>

            {/* Table Rows */}
            {gapAndPartialRequirements.map((req, index) => {
              const controlsSummary =
                req.controls.length === 0
                  ? "No controls mapped"
                  : req.controls
                      .slice(0, 2)
                      .map((c) => c.title || "Unnamed")
                      .join(", ") + (req.controls.length > 2 ? ` +${req.controls.length - 2} more` : "");

              return (
                <View
                  key={`${req.code}-${index}`}
                  style={[styles.tableRow, index % 2 === 1 ? styles.tableRowAlt : {}]}
                  wrap={false}
                >
                  <Text style={styles.cellCode}>{req.code}</Text>
                  <Text style={styles.cellTitle}>{req.title}</Text>
                  <Text
                    style={[
                      styles.cellStatus,
                      req.status === "covered"
                        ? styles.cellStatusCovered
                        : req.status === "partial"
                        ? styles.cellStatusPartial
                        : styles.cellStatusGap,
                    ]}
                  >
                    {req.status.charAt(0).toUpperCase() + req.status.slice(1)}
                  </Text>
                  <Text style={styles.cellControls}>{controlsSummary}</Text>
                </View>
              );
            })}
          </View>
        )}

        <PageFooter label="Page 2" />
      </Page>
    </Document>
  );
}

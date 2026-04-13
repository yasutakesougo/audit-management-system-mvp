import { AuditHistoryEntry, AuditResult, EvidenceLink, IcebergAnalysis, ISP, Recommendation, RecommendationStats } from "./types";

/**
 * Compliance Audit (Legal Obligations)
 * Rules:
 * - Missing required fields → COMPLIANCE_VIOLATION
 * - Empty or invalid assessment → COMPLIANCE_VIOLATION
 */
export function auditISP(isp: ISP): AuditResult[] {
  const results: AuditResult[] = [];

  // 1. Required fields presence check
  const requiredFields: (keyof ISP)[] = [
    "serviceUserName",
    "assessmentSummary",
    "longTermGoal",
    "shortTermGoals",
    "dailySupports",
    "monitoringPlan",
  ];

  for (const field of requiredFields) {
    const value = isp[field];
    if (!value || (Array.isArray(value) && value.length === 0)) {
      results.push({
        severity: "COMPLIANCE_VIOLATION",
        message: `${field} is required for legal compliance`,
        target: "ISP",
        code: `ISP_${field.toUpperCase()}_MISSING`,
      });
    }
  }

  // 2. Assessment content check (Ensure it's not just whitespace)
  if (isp.assessmentSummary && isp.assessmentSummary.trim().length === 0) {
    results.push({
      severity: "COMPLIANCE_VIOLATION",
      message: "Assessment summary cannot be empty",
      target: "ISP",
      code: "ISP_ASSESSMENT_EMPTY",
    });
  }

  return results;
}

/**
 * Process Quality Audit (Recommended Practices)
 * Rules:
 * - Missing Iceberg → PROCESS_WARNING
 * - Low node count → PROCESS_WARNING
 * - No causal links → PROCESS_WARNING
 * 
 * Note: These are NOT compliance violations (must not escalate).
 */
export function auditProcess(context: {
  iceberg?: IcebergAnalysis;
}): AuditResult[] {
  const results: AuditResult[] = [];

  const { iceberg } = context;

  // 1. Existence check
  if (!iceberg) {
    results.push({
      severity: "PROCESS_WARNING",
      message: "Iceberg analysis is recommended for deeper support insights",
      target: "PROCESS",
      code: "ICEBERG_MISSING",
    });
    return results; // No further checks needed if missing
  }

  // 2. Depth check (e.g. at least 3 nodes)
  if (iceberg.nodes.length < 3) {
    results.push({
      severity: "PROCESS_WARNING",
      message: "Iceberg analysis should include behavior, internal, and environment factors",
      target: "PROCESS",
      code: "ICEBERG_TOO_SIMPLE",
    });
  }

  // 3. Causality check
  if (iceberg.links.length === 0) {
    results.push({
      severity: "PROCESS_WARNING",
      message: "Iceberg analysis should identify causal links between factors",
      target: "PROCESS",
      code: "ICEBERG_NO_LINKS",
    });
  }

  return results;
}

/**
 * Provenance Engine: Build Evidence Links
 * Connects Iceberg Analysis nodes to ISP fields to provide rationale.
 */
export function buildEvidenceLinks(
  iceberg: IcebergAnalysis,
  _isp: ISP
): EvidenceLink[] {
  const evidence: EvidenceLink[] = [];
  const totalLinks = iceberg.links.length;

  for (const node of iceberg.nodes) {
    // 1. Determine target ISP field and descriptive explanation
    let ispField = "";
    let explanation = "";

    switch (node.type) {
      case "internal":
        ispField = "longTermGoal";
        explanation = `本人の内面的なニーズ「${node.label}」が目標設定の直接的な根拠となっています。`;
        break;
      case "behavior":
        ispField = "assessmentSummary";
        explanation = `具体的な行動特性「${node.label}」の分析が、アセスメントの客観性を補完しています。`;
        break;
      case "environment":
        ispField = "dailySupports";
        explanation = `環境因子「${node.label}」の調整が、日々の具体的支援を導く鍵となっています。`;
        break;
    }

    if (!ispField) continue;

    // 2. Calculate relative importance (Numeric Score & Confidence)
    const nodeLinks = iceberg.links.filter(
      (l) => l.from === node.id || l.to === node.id
    ).length;

    // Score based on centrality in the causal chain (relative to total links)
    const numericScore = totalLinks > 0 ? nodeLinks / totalLinks : 0;

    let confidence: EvidenceLink["confidence"] = "low";
    if (numericScore > 0.6) confidence = "high";
    else if (numericScore > 0.2) confidence = "medium";
    else if (nodeLinks >= 1) confidence = "medium"; // At least one connection is meaningful
    else confidence = "low";

    evidence.push({
      source: "iceberg",
      nodeId: node.id,
      ispField,
      confidence,
      numericScore,
      explanation,
    });
  }

  return evidence;
}

/**
 * Recommendation Engine: Weighted Learning Edition
 * Analyzes evidence to suggest actionable next steps, 
 * factoring in historical success rates (Learning).
 */
export function generateRecommendations(
  evidence: EvidenceLink[],
  stats?: RecommendationStats[]
): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // Helper to filter evidence by target ISP fields
  const getEvidenceFor = (field: string) => evidence.filter((e) => e.ispField === field);

  const envEvidence = getEvidenceFor("dailySupports");
  const internalEvidence = getEvidenceFor("longTermGoal");
  const behaviorEvidence = getEvidenceFor("assessmentSummary");

  // Helper to adjust priority and message based on stats
  const checkStats = (type: Recommendation["type"], defaultPriority: Recommendation["priority"]) => {
    const s = stats?.find((st) => st.type === type);
    if (s && s.totalUses > 5 && s.successRate < 0.3) {
      // If it's frequently ignored, lower priority or flag for reconsideration
      return { priority: "low" as const, prefix: "【再考察推奨】過去の適用実績が少ないため、慎重に検討してください: " };
    }
    return { priority: defaultPriority, prefix: "" };
  };

  // 1. Environmental Adjustment Recommendation
  if (envEvidence.some((e) => e.numericScore >= 0.5)) {
    const { priority, prefix } = checkStats("ENVIRONMENT_ADJUSTMENT", "high");
    recommendations.push({
      id: `REC_ENV_${Date.now()}`,
      type: "ENVIRONMENT_ADJUSTMENT",
      message: `${prefix}環境因子が行動に強く影響しています。現在の物理的・人的環境の調整を優先して検討してください。`,
      priority,
      basedOn: envEvidence.filter((e) => e.numericScore >= 0.5),
    });
  }

  // 2. Goal Redesign Recommendation
  if (internalEvidence.some((e) => e.numericScore >= 0.5)) {
    const { priority, prefix } = checkStats("GOAL_REDESIGN", "high");
    recommendations.push({
      id: `REC_GOAL_${Date.now()}`,
      type: "GOAL_REDESIGN",
      message: `${prefix}本人の内面的なニーズと現在の目標設定に乖離がある可能性があります。目標の再設計を推奨します。`,
      priority,
      basedOn: internalEvidence.filter((e) => e.numericScore >= 0.5),
    });
  }

  // 3. Monitoring Reinforcement Recommendation
  if (behaviorEvidence.some((e) => e.numericScore >= 0.5)) {
    const { priority, prefix } = checkStats("MONITORING_REINFORCEMENT", "medium");
    recommendations.push({
      id: `REC_MON_${Date.now()}`,
      type: "MONITORING_REINFORCEMENT",
      message: `${prefix}特定の行動特性が顕著です。原因分析の精度をさらに上げるため、行動観察の頻度を高めることを推奨します時。`,
      priority,
      basedOn: behaviorEvidence.filter((e) => e.numericScore >= 0.5),
    });
  }

  // 4. Default Quality Improvement
  if (evidence.length > 0 && recommendations.length === 0) {
    recommendations.push({
      id: `REC_PROC_${Date.now()}`,
      type: "PROCESS_IMPROVEMENT",
      message: "分析は実施されていますが、さらに具体的な要因（ハブノード）の特定を進めてください。",
      priority: "low",
      basedOn: evidence,
    });
  }

  return recommendations;
}

/**
 * Aggregation Engine: Learning & Predictive Edition
 * Behavior:
 * - Combine results with history check (Streaks)
 * - Flag Predictive Risks (Violation Candidate detection)
 * - Weighted Recommendation generation (Adaptive Learning)
 */
export function runAudit(input: {
  isp: ISP;
  iceberg?: IcebergAnalysis;
  history?: AuditHistoryEntry[];
  recStats?: RecommendationStats[];
}): AuditResult[] {
  const ispResults = auditISP(input.isp);
  const processResults = auditProcess({ iceberg: input.iceberg });

  let evidence: EvidenceLink[] | undefined = undefined;
  let recommendations: Recommendation[] | undefined = undefined;

  if (input.iceberg) {
    evidence = buildEvidenceLinks(input.iceberg, input.isp);
    recommendations = generateRecommendations(evidence, input.recStats);
  }

  const combined = [...ispResults, ...processResults];

  const resultsWithHistory = combined.map((res) => {
    const historicalEntry = input.history?.find((h) => h.code === res.code);
    const isRecurring = !!historicalEntry && historicalEntry.streak > 0;
    const isPredictiveRisk = !!historicalEntry && historicalEntry.streak >= 3;
    
    // Adaptive & Predictive Messaging
    let message = res.message;
    if (isRecurring && historicalEntry) {
      const urgencyPrefix = `【再三の指摘】(計${historicalEntry.streak + 1}回目): `;
      message = urgencyPrefix + res.message;

      if (isPredictiveRisk && res.severity === "PROCESS_WARNING") {
        message += "\n【🚨 予測リスク】この状態の放置は、将来的な法令違反（実地指導での指摘等）に直結する可能性が極めて高いです。";
      }
    }

    return {
      ...res,
      message,
      isRecurring,
      isPredictiveRisk,
      evidence: res.target === "PROCESS" ? undefined : evidence,
      recommendations: res.target === "PROCESS" ? undefined : recommendations,
    };
  });

  // If no issues were found (PASS), check if clear history
  if (resultsWithHistory.length === 0) {
    return [
      {
        severity: "PASS",
        message: "Audit completed successfully",
        target: "ISP",
        code: "AUDIT_PASS",
        evidence,
        recommendations,
      },
    ];
  }

  return resultsWithHistory;
}

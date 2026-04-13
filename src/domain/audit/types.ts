export type Severity = "COMPLIANCE_VIOLATION" | "PROCESS_WARNING" | "PASS";

export interface ISP {
  serviceUserName: string;
  assessmentSummary: string;
  longTermGoal: string;
  shortTermGoals: string[];
  dailySupports: string;
  monitoringPlan: string;
}

export interface IcebergNode {
  id: string;
  label: string;
  type: "behavior" | "internal" | "environment";
}

export interface IcebergLink {
  from: string;
  to: string;
}

export interface IcebergAnalysis {
  nodes: IcebergNode[];
  links: IcebergLink[];
  confidence: number;
}

export interface EvidenceLink {
  source: "iceberg";
  nodeId: string;
  ispField: string;
  confidence: "low" | "medium" | "high";
  numericScore: number; // 0.0 to 1.0 (relative importance)
  explanation?: string; // Human-readable rationale for the link
}

export type RecommendationType =
  | "ENVIRONMENT_ADJUSTMENT"
  | "GOAL_REDESIGN"
  | "MONITORING_REINFORCEMENT"
  | "PROCESS_IMPROVEMENT";

export interface Recommendation {
  id: string; // Unique ID for feedback tracking
  type: RecommendationType;
  message: string;
  priority: "high" | "medium" | "low";
  basedOn: EvidenceLink[];
}

export interface AuditHistoryEntry {
  code: string;
  streak: number; // Number of consecutive times this issue was seen
  lastSeen: string; // ISO 8601
  riskTrend: "stable" | "rising" | "declining"; // New: Direction of the risk
}

export interface RecommendationStats {
  type: RecommendationType;
  successRate: number; // 0.0 to 1.0 based on accepted feedback
  totalUses: number;
}

export interface AuditResult {
  severity: Severity;
  message: string;
  target: "ISP" | "PROCESS";
  code: string;
  isRecurring?: boolean; // True if streak > 1
  isPredictiveRisk?: boolean; // True if streak suggests future violation
  evidence?: EvidenceLink[];
  recommendations?: Recommendation[];
}

export interface AuditFeedback {
  recommendationId: string;
  action: "accepted" | "rejected" | "ignored";
  appliedAt: string;
  comment?: string;
}

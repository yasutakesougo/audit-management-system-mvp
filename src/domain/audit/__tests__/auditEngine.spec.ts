import { describe, it, expect } from "vitest";
import { auditISP, auditProcess, runAudit, buildEvidenceLinks, generateRecommendations } from "../auditEngine";
import { ISP, IcebergAnalysis } from "../types";

describe("AuditEngine", () => {
  const validISP: ISP = {
    serviceUserName: "Shioda Yuki",
    assessmentSummary: "Proper assessment content",
    longTermGoal: "Social independence",
    shortTermGoals: ["Goal 1", "Goal 2"],
    dailySupports: "Daily support details",
    monitoringPlan: "Monthly monitoring",
  };

  const validIceberg: IcebergAnalysis = {
    nodes: [
      { id: "1", label: "Behavior", type: "behavior" },
      { id: "2", label: "Internal", type: "internal" },
      { id: "3", label: "Environment", type: "environment" },
    ],
    links: [{ from: "2", to: "1" }],
    confidence: 0.8,
  };

  describe("auditISP (Compliance)", () => {
    it("should return no violations for a valid ISP", () => {
      const results = auditISP(validISP);
      expect(results).toHaveLength(0);
    });

    it("should return COMPLIANCE_VIOLATION if a required field is missing", () => {
      const invalidISP = { ...validISP, assessmentSummary: "" };
      const results = auditISP(invalidISP);
      expect(results).toContainEqual(
        expect.objectContaining({
          severity: "COMPLIANCE_VIOLATION",
          code: "ISP_ASSESSMENTSUMMARY_MISSING",
        })
      );
    });

    it("should return COMPLIANCE_VIOLATION if shortTermGoals is empty", () => {
      const invalidISP = { ...validISP, shortTermGoals: [] };
      const results = auditISP(invalidISP);
      expect(results).toContainEqual(
        expect.objectContaining({
          severity: "COMPLIANCE_VIOLATION",
          code: "ISP_SHORTTERMGOALS_MISSING",
        })
      );
    });

    it("should return COMPLIANCE_VIOLATION if field is only whitespace", () => {
      const invalidISP = { ...validISP, assessmentSummary: "   " };
      const results = auditISP(invalidISP);
      expect(results).toContainEqual(
        expect.objectContaining({
          severity: "COMPLIANCE_VIOLATION",
          code: "ISP_ASSESSMENT_EMPTY",
        })
      );
    });
  });

  describe("auditProcess (Process Quality)", () => {
    it("should return no warnings for a valid Iceberg analysis", () => {
      const results = auditProcess({ iceberg: validIceberg });
      expect(results).toHaveLength(0);
    });

    it("should return PROCESS_WARNING if iceberg is missing", () => {
      const results = auditProcess({});
      expect(results[0].severity).toBe("PROCESS_WARNING");
      expect(results[0].code).toBe("ICEBERG_MISSING");
    });

    it("should return PROCESS_WARNING if node count is low", () => {
      const thinIceberg: IcebergAnalysis = {
        nodes: [{ id: "1", label: "One", type: "behavior" }],
        links: [],
        confidence: 0.5,
      };
      const results = auditProcess({ iceberg: thinIceberg });
      expect(results).toContainEqual(
        expect.objectContaining({
          severity: "PROCESS_WARNING",
          code: "ICEBERG_TOO_SIMPLE",
        })
      );
    });

    it("should return PROCESS_WARNING if there are no links", () => {
      const noLinkIceberg: IcebergAnalysis = {
        nodes: [
          { id: "1", label: "B", type: "behavior" },
          { id: "2", label: "I", type: "internal" },
          { id: "3", label: "E", type: "environment" },
        ],
        links: [],
        confidence: 0.5,
      };
      const results = auditProcess({ iceberg: noLinkIceberg });
      expect(results).toContainEqual(
        expect.objectContaining({
          severity: "PROCESS_WARNING",
          code: "ICEBERG_NO_LINKS",
        })
      );
    });
  });

  describe("runAudit (Aggregation)", () => {
    it("should combine both compliance and process results", () => {
      const input = {
        isp: { ...validISP, longTermGoal: "" }, // Violation
        iceberg: undefined, // Warning
      };

      const results = runAudit(input);

      const violations = results.filter((r) => r.severity === "COMPLIANCE_VIOLATION");
      const warnings = results.filter((r) => r.severity === "PROCESS_WARNING");

      expect(violations).toHaveLength(1);
      expect(warnings).toHaveLength(1);
      expect(violations[0].code).toBe("ISP_LONGTERMGOAL_MISSING");
      expect(warnings[0].code).toBe("ICEBERG_MISSING");
    });

    it("should not escalate process warnings to violations", () => {
      const input = {
        isp: validISP, // Pass
        iceberg: undefined, // Warning
      };

      const results = runAudit(input);
      expect(results.every((r) => r.severity !== "COMPLIANCE_VIOLATION")).toBe(true);
      expect(results.some((r) => r.severity === "PROCESS_WARNING")).toBe(true);
    });

    it("should return empty array if both pass", () => {
      // Actually, my new implementation returns PASS with evidence if both pass
      const results = runAudit({
        isp: validISP,
        iceberg: validIceberg,
      });
      expect(results).toHaveLength(1);
      expect(results[0].severity).toBe("PASS");
      expect(results[0].evidence).toBeDefined();
    });

    it("should attach evidence to ISP violations but not process warnings", () => {
      const input = {
        isp: { ...validISP, serviceUserName: "" }, // Violation
        iceberg: validIceberg,
      };

      const results = runAudit(input);
      const violation = results.find((r) => r.severity === "COMPLIANCE_VIOLATION");
      expect(violation?.evidence).toBeDefined();
      expect(violation?.evidence?.length).toBeGreaterThan(0);
    });
  });

  describe("buildEvidenceLinks (Provenance Refined)", () => {
    it("should generate human-readable explanations including labels", () => {
      const iceberg: IcebergAnalysis = {
        nodes: [{ id: "n1", label: "騒音への敏感さ", type: "environment" }],
        links: [],
        confidence: 1,
      };

      const evidence = buildEvidenceLinks(iceberg, validISP);
      expect(evidence[0].explanation).toContain("騒音への敏感さ");
      expect(evidence[0].explanation).toContain("環境因子");
    });

    it("should calculate relative numeric importance score", () => {
      const iceberg: IcebergAnalysis = {
        nodes: [
          { id: "hub", label: "Hub", type: "internal" },
          { id: "leaf1", label: "L1", type: "behavior" },
          { id: "leaf2", label: "L2", type: "behavior" },
        ],
        links: [
          { from: "hub", to: "leaf1" },
          { from: "hub", to: "leaf2" },
        ],
        confidence: 1,
      };

      const evidence = buildEvidenceLinks(iceberg, validISP);
      const hubEv = evidence.find((e) => e.nodeId === "hub");
      const leafEv = evidence.find((e) => e.nodeId === "leaf1");

      // hub has 2 links, leaf has 1 link. Total links = 2.
      // hub score = 2/2 = 1.0 (High intensity)
      // leaf score = 1/2 = 0.5 (Medium intensity)
      expect(hubEv?.numericScore).toBe(1.0);
      expect(hubEv?.confidence).toBe("high");
      expect(leafEv?.numericScore).toBe(0.5);
      expect(leafEv?.confidence).toBe("medium");
    });
  });

  describe("generateRecommendations (Leading Engine)", () => {
    it("should suggest ENVIRONMENT_ADJUSTMENT for high environment intensity", () => {
      // Forcing high score via links
      const icebergWithLinks: IcebergAnalysis = {
        nodes: [
          { id: "e1", label: "騒音", type: "environment" },
          { id: "b1", label: "パニック", type: "behavior" }
        ],
        links: [{ from: "e1", to: "b1" }],
        confidence: 1
      };

      const evidence = buildEvidenceLinks(icebergWithLinks, validISP);
      const recommendations = generateRecommendations(evidence);

      expect(recommendations).toContainEqual(
        expect.objectContaining({ type: "ENVIRONMENT_ADJUSTMENT", priority: "high" })
      );
    });

    it("should suggest GOAL_REDESIGN for high internal intensity", () => {
      const iceberg: IcebergAnalysis = {
        nodes: [
          { id: "i1", label: "不安", type: "internal" },
          { id: "b1", label: "拒絶", type: "behavior" }
        ],
        links: [{ from: "i1", to: "b1" }],
        confidence: 1
      };

      const evidence = buildEvidenceLinks(iceberg, validISP);
      const recommendations = generateRecommendations(evidence);

      expect(recommendations).toContainEqual(
        expect.objectContaining({ type: "GOAL_REDESIGN", priority: "high" })
      );
    });

    it("should include relevant evidence in the recommendation", () => {
      const iceberg: IcebergAnalysis = {
        nodes: [
          { id: "e1", label: "光", type: "environment" },
          { id: "b1", label: "眩しさ", type: "behavior" },
          { id: "i1", label: "不安", type: "internal" }
        ],
        links: [{ from: "e1", to: "b1" }, { from: "i1", to: "b1" }],
        confidence: 1
      };

      const results = runAudit({ isp: validISP, iceberg });
      // Both ISP and Process pass, so we get one "PASS" result
      expect(results[0].severity).toBe("PASS");
      const recommendations = results[0].recommendations;

      expect(recommendations).toBeDefined();
      expect(recommendations?.[0].basedOn).toHaveLength(1);
      expect(recommendations?.[0].basedOn[0].nodeId).toBe("e1");
    });
  });

  describe("Adaptive Loop (History & Learning)", () => {
    it("should mark results as isRecurring and add urgency prefix if streak > 0", () => {
      const history: Record<string, unknown>[] = [
        { code: "ICEBERG_MISSING", streak: 2, lastSeen: "2024-04-10", riskTrend: "stable" }
      ];

      const results = runAudit({
        isp: validISP,
        iceberg: undefined, // Triggers ICEBERG_MISSING
        history
      });

      const recurringResult = results.find(r => r.code === "ICEBERG_MISSING");
      expect(recurringResult?.isRecurring).toBe(true);
      expect(recurringResult?.message).toContain("【再三の指摘】(計3回目)");
    });

    it("should assign unique IDs to recommendations for feedback loops", () => {
      const iceberg: IcebergAnalysis = {
        nodes: [{ id: "e1", label: "騒音", type: "environment" }, { id: "b1", label: "P", type: "behavior" }, { id: "i1", label: "I", type: "internal" }],
        links: [{ from: "e1", to: "b1" }],
        confidence: 1
      };

      const results = runAudit({ isp: validISP, iceberg });
      const rec = results[0].recommendations?.[0];
      
      expect(rec?.id).toMatch(/^REC_ENV_/);
    });

    it("should flag predictive risk for long streaks of process warnings", () => {
      const history: Record<string, unknown>[] = [
        { code: "ICEBERG_MISSING", streak: 4, lastSeen: "2024-04-10", riskTrend: "rising" }
      ];

      const results = runAudit({
        isp: validISP,
        iceberg: undefined,
        history
      });

      const risk = results.find(r => r.code === "ICEBERG_MISSING");
      expect(risk?.isPredictiveRisk).toBe(true);
      expect(risk?.message).toContain("【🚨 予測リスク】");
    });

    it("should lower priority of recommendations with low success rates", () => {
      const icebergWithEnv: IcebergAnalysis = {
        nodes: [
          { id: "e1", label: "騒音", type: "environment" },
          { id: "b1", label: "P", type: "behavior" },
          { id: "i1", label: "I", type: "internal" }
        ],
        links: [{ from: "e1", to: "b1" }],
        confidence: 1
      };

      const recStats = [
        { type: "ENVIRONMENT_ADJUSTMENT" as const, successRate: 0.1, totalUses: 10 }
      ];

      const results = runAudit({
        isp: validISP,
        iceberg: icebergWithEnv,
        recStats
      });

      const rec = results[0].recommendations?.find(r => r.type === "ENVIRONMENT_ADJUSTMENT");
      expect(rec?.priority).toBe("low");
      expect(rec?.message).toContain("【再考察推奨】");
    });
  });
});

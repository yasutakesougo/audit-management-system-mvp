import { useCallback, useState } from 'react';

import type { RecordQualityHumanReviewQueueRepository } from '@/features/record-quality/application/recordQualityHumanReviewContracts';
import {
  acceptRecordQualityReviewDecision,
  discardRecordQualityReviewDecision,
  reviseRecordQualityReviewDecision,
  type ReviseRecordQualityReviewDecisionInput,
} from '@/features/record-quality/application/recordQualityReviewDecisionActions';
import type {
  RecordQualityReviewRecordId,
  RecordQualityReviewRepository,
} from '@/features/record-quality/application/recordQualityHumanReviewContracts';
import { useRecordQualityHumanReviewQueue } from './useRecordQualityHumanReviewQueue';

export type RecordQualityHumanReviewWorkflowRepositories = {
  readonly reviewRepository: RecordQualityReviewRepository;
  readonly queueRepository: RecordQualityHumanReviewQueueRepository;
};

export type ReviseRecordQualityHumanReviewInput = {
  readonly recordId: RecordQualityReviewRecordId;
} & Omit<ReviseRecordQualityReviewDecisionInput, 'repository' | 'recordId'>;

export type DecideRecordQualityHumanReviewInput = {
  readonly recordId: RecordQualityReviewRecordId;
  readonly updatedAt: string;
};

export type UseRecordQualityHumanReviewWorkflowResult = ReturnType<
  typeof useRecordQualityHumanReviewQueue
> & {
  readonly isDeciding: boolean;
  readonly decisionError: Error | null;
  readonly accept: (input: DecideRecordQualityHumanReviewInput) => Promise<void>;
  readonly revise: (input: ReviseRecordQualityHumanReviewInput) => Promise<void>;
  readonly discard: (input: DecideRecordQualityHumanReviewInput) => Promise<void>;
};

export function useRecordQualityHumanReviewWorkflow({
  reviewRepository,
  queueRepository,
}: RecordQualityHumanReviewWorkflowRepositories): UseRecordQualityHumanReviewWorkflowResult {
  const queueState = useRecordQualityHumanReviewQueue(queueRepository);
  const { reload } = queueState;
  const [isDeciding, setIsDeciding] = useState(false);
  const [decisionError, setDecisionError] = useState<Error | null>(null);

  const runDecision = useCallback(
    async (decision: () => Promise<void>) => {
      setIsDeciding(true);
      setDecisionError(null);

      try {
        await decision();
        await reload();
      } catch (caught) {
        setDecisionError(caught instanceof Error ? caught : new Error(String(caught)));
      } finally {
        setIsDeciding(false);
      }
    },
    [reload],
  );

  const accept = useCallback(
    async (input: DecideRecordQualityHumanReviewInput) => {
      await runDecision(async () => {
        await acceptRecordQualityReviewDecision({
          repository: reviewRepository,
          recordId: input.recordId,
          updatedAt: input.updatedAt,
        });
      });
    },
    [reviewRepository, runDecision],
  );

  const revise = useCallback(
    async (input: ReviseRecordQualityHumanReviewInput) => {
      await runDecision(async () => {
        await reviseRecordQualityReviewDecision({
          repository: reviewRepository,
          recordId: input.recordId,
          suggestedCategories: input.suggestedCategories,
          missingInformationHints: input.missingInformationHints,
          notes: input.notes,
          updatedAt: input.updatedAt,
        });
      });
    },
    [reviewRepository, runDecision],
  );

  const discard = useCallback(
    async (input: DecideRecordQualityHumanReviewInput) => {
      await runDecision(async () => {
        await discardRecordQualityReviewDecision({
          repository: reviewRepository,
          recordId: input.recordId,
          updatedAt: input.updatedAt,
        });
      });
    },
    [reviewRepository, runDecision],
  );

  return {
    ...queueState,
    isDeciding,
    decisionError,
    accept,
    revise,
    discard,
  };
}

import { describe, expect, it } from 'vitest';

import { resolveOperationFailureFeedback } from '@/features/today/feedback/operationFeedback';
import { classifySchedulesError } from '../errors';

describe('classifySchedulesError conflict feedback', () => {
  it('uses the shared operation feedback contract for 412 conflicts', () => {
    const shared = resolveOperationFailureFeedback('schedules:conflict-412');
    const result = classifySchedulesError({ status: 412, message: 'Precondition Failed' });

    expect(result.kind).toBe('CONFLICT');
    expect(result.title).toBe(shared.title);
    expect(result.message).toBe(shared.userMessage);
  });

  it('classifies conflict keyword errors with the same contract', () => {
    const shared = resolveOperationFailureFeedback('schedules:conflict-412');
    const result = classifySchedulesError(new Error('The version of the item has changed (conflict)'));

    expect(result.kind).toBe('CONFLICT');
    expect(result.message).toBe(shared.userMessage);
  });
});

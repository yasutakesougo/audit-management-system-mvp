import type { SupportPlanForm } from '../types';
import { REQUIRED_FIELDS } from '../types';

export const computeRequiredCompletion = (form: SupportPlanForm): number =>
  Math.round(
    (REQUIRED_FIELDS.reduce((count, key) => (form[key].trim() ? count + 1 : count), 0) / REQUIRED_FIELDS.length) * 100,
  );

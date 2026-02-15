import { SpScheduleCategoryRaw } from './spRowSchema';
import { SCHEDULES_FIELDS } from './spSchema';

export type ListFieldMeta = {
  internalName: string;
  type: string;
  required: boolean;
  choices?: string[];
};

export type ContractValidationResult = {
  ok: boolean;
  missingFields: string[];
  missingChoices: Array<{ field: string; missing: string[] }>;
};

const REQUIRED_FIELDS: readonly string[] = [
  SCHEDULES_FIELDS.title,
  SCHEDULES_FIELDS.start,
  SCHEDULES_FIELDS.end,
  SCHEDULES_FIELDS.serviceType,
  SCHEDULES_FIELDS.locationName,
];

const REQUIRED_CATEGORY_CHOICES = SpScheduleCategoryRaw.options;

const normalizeChoices = (choices?: string[]): string[] =>
  (choices ?? []).map((value) => value.trim()).filter(Boolean);

export const validateSchedulesListContract = (fields: ListFieldMeta[]): ContractValidationResult => {
  const fieldMap = new Map(fields.map((field) => [field.internalName, field]));
  const missingFields = REQUIRED_FIELDS.filter((name) => !fieldMap.has(name));

  const missingChoices: Array<{ field: string; missing: string[] }> = [];
  const categoryField = fieldMap.get(SCHEDULES_FIELDS.serviceType);
  if (categoryField) {
    const choices = normalizeChoices(categoryField.choices);
    const missing = REQUIRED_CATEGORY_CHOICES.filter((value) => !choices.includes(value));
    if (missing.length > 0) {
      missingChoices.push({ field: categoryField.internalName, missing });
    }
  }

  return {
    ok: missingFields.length === 0 && missingChoices.length === 0,
    missingFields,
    missingChoices,
  };
};

export const buildContractErrorMessage = (result: ContractValidationResult): string => {
  const parts: string[] = [];
  if (result.missingFields.length > 0) {
    parts.push(`Missing fields: ${result.missingFields.join(', ')}`);
  }
  if (result.missingChoices.length > 0) {
    const choiceMessages = result.missingChoices.map(
      (entry) => `${entry.field}: ${entry.missing.join(', ')}`,
    );
    parts.push(`Missing choices: ${choiceMessages.join(' | ')}`);
  }
  return parts.join(' / ');
};

export const getRequiredSchedulesFields = (): readonly string[] => REQUIRED_FIELDS;

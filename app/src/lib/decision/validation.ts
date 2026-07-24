import {
  DEVICE_COMPROMISE_STATES,
  EXPOSURE_STATES,
  SAFE_DEVICE_AVAILABILITIES,
  TRANSFER_STATES,
  USER_ROLES,
  type IncidentState,
} from "@/lib/contracts";

export const INCIDENT_STATE_FIELDS = [
  "transfer_state",
  "device_compromise_state",
  "credential_exposure_state",
  "personal_data_exposure_state",
  "user_role",
  "safe_device_available",
] as const satisfies readonly (keyof IncidentState)[];

type IncidentStateField = (typeof INCIDENT_STATE_FIELDS)[number];

const ALLOWED_VALUES: Readonly<
  Record<IncidentStateField, readonly string[]>
> = {
  transfer_state: TRANSFER_STATES,
  device_compromise_state: DEVICE_COMPROMISE_STATES,
  credential_exposure_state: EXPOSURE_STATES,
  personal_data_exposure_state: EXPOSURE_STATES,
  user_role: USER_ROLES,
  safe_device_available: SAFE_DEVICE_AVAILABILITIES,
};

export interface IncidentStateValidationIssue {
  readonly field: IncidentStateField | "$object";
  readonly allowed_values: readonly string[];
}

export class InvalidIncidentStateError extends Error {
  readonly code = "INVALID_INCIDENT_STATE" as const;
  readonly issues: readonly IncidentStateValidationIssue[];

  constructor(issues: readonly IncidentStateValidationIssue[]) {
    const details = issues
      .map(
        (issue) =>
          `${issue.field}=[${issue.allowed_values.join(", ")}]`,
      )
      .join("; ");
    super(`INVALID_INCIDENT_STATE: ${details}`);
    this.name = "InvalidIncidentStateError";
    this.issues = issues.map((issue) => ({
      field: issue.field,
      allowed_values: [...issue.allowed_values],
    }));
  }
}

function hasExactlyContractFields(
  value: Record<PropertyKey, unknown>,
): boolean {
  const ownKeys = Reflect.ownKeys(value);
  return (
    ownKeys.length === INCIDENT_STATE_FIELDS.length &&
    ownKeys.every(
      (key) =>
        typeof key === "string" &&
        INCIDENT_STATE_FIELDS.includes(key as IncidentStateField),
    )
  );
}

export function validateIncidentState(
  value: unknown,
): asserts value is IncidentState {
  if (
    typeof value !== "object" ||
    value === null ||
    Array.isArray(value)
  ) {
    throw new InvalidIncidentStateError([
      {
        field: "$object",
        allowed_values: INCIDENT_STATE_FIELDS,
      },
    ]);
  }

  const record = value as Record<PropertyKey, unknown>;
  const issues: IncidentStateValidationIssue[] = [];

  if (!hasExactlyContractFields(record)) {
    issues.push({
      field: "$object",
      allowed_values: INCIDENT_STATE_FIELDS,
    });
  }

  for (const field of INCIDENT_STATE_FIELDS) {
    const fieldValue = record[field];
    if (
      typeof fieldValue !== "string" ||
      !ALLOWED_VALUES[field].includes(fieldValue)
    ) {
      issues.push({
        field,
        allowed_values: ALLOWED_VALUES[field],
      });
    }
  }

  if (issues.length > 0) {
    throw new InvalidIncidentStateError(issues);
  }
}

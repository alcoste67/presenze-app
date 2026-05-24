function isRecord(
  value: unknown
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

export function getErroreSupabase(
  error: unknown
) {
  if (error instanceof Error) {
    return error.message;
  }

  if (isRecord(error)) {
    const message =
      typeof error.message === "string"
        ? error.message
        : "";
    const details =
      typeof error.details === "string"
        ? error.details
        : "";
    const hint =
      typeof error.hint === "string"
        ? error.hint
        : "";
    const code =
      typeof error.code === "string"
        ? error.code
        : "";
    const parti = [
      message,
      details,
      hint,
      code ? `code ${code}` : "",
    ].filter(Boolean);

    if (parti.length > 0) {
      return parti.join(" - ");
    }
  }

  return String(error);
}

export function throwErroreSupabase(
  contesto: string,
  error: unknown
): never {
  throw new Error(
    `${contesto}: ${getErroreSupabase(error)}`
  );
}

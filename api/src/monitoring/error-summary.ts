/**
 * ADR-P046: a log- and telemetry-safe description of an error.
 *
 * A Prisma error message can quote the query, the values that failed a
 * constraint (an email, a name, a note) and the schema. So a Prisma error is
 * reduced to its class name and its error code — "PrismaClientKnownRequestError
 * P2002" — and nothing else. Any other error keeps only its class name.
 */
export function isPrismaErrorName(name: string): boolean {
  return /^Prisma/.test(name);
}

export function summarizeError(error: unknown): string {
  if (error instanceof Error) {
    const code = (error as { code?: unknown }).code;
    return typeof code === 'string' && /^P\d{4}$/.test(code)
      ? `${error.name} ${code}`
      : error.name;
  }
  return typeof error;
}

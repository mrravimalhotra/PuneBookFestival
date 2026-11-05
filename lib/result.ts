/** Typed result objects returned by every Server Action. */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Record<string, string> };

export function ok<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function fail(error: string, fieldErrors?: Record<string, string>): ActionResult<never> {
  return { ok: false, error, fieldErrors };
}

/** Flatten Zod issues to { field: messageKey } (first issue per field). */
export function fieldErrorsFrom(issues: ReadonlyArray<{ path: PropertyKey[]; message: string }>) {
  const out: Record<string, string> = {};
  for (const issue of issues) {
    const key = issue.path.map(String).join('.') || '_form';
    if (!(key in out)) out[key] = issue.message;
  }
  return out;
}

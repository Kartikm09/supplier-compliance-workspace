export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly publicMessage: string,
    readonly causeDetails?: unknown,
  ) {
    super(publicMessage);
    this.name = "AppError";
  }
}

interface DatabaseErrorLike {
  code?: string;
  message?: string;
}

export function fromDatabaseError(
  error: DatabaseErrorLike,
  fallbackCode = "operation_failed",
  fallbackMessage = "The requested operation could not be completed.",
): AppError {
  switch (error.code) {
    case "42501":
      return new AppError(403, "forbidden", "You are not permitted to perform this action.", error);
    case "PGRST116":
    case "P0002":
      return new AppError(404, "not_found", "The requested record was not found.", error);
    case "23505":
      return new AppError(409, "conflict", "An equivalent record already exists.", error);
    case "23503":
      return new AppError(409, "invalid_reference", "A referenced record is unavailable.", error);
    case "22023":
    case "23514":
      return new AppError(422, "validation_failed", "The request violates a business rule.", error);
    case "P0001":
      return new AppError(
        409,
        "invalid_transition",
        "The requested state transition is not allowed.",
        error,
      );
    default:
      return new AppError(500, fallbackCode, fallbackMessage, error);
  }
}

export function publicError(error: unknown): AppError {
  if (error instanceof AppError) return error;
  return new AppError(
    500,
    "internal_error",
    "An unexpected error occurred. Use the correlation ID when requesting support.",
    error,
  );
}

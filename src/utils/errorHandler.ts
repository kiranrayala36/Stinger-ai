type ErrorDetail = {
  code?: string;
  message: string;
  details?: string;
  hint?: string;
  stack?: string;
};

class AppError extends Error {
  public code?: string;
  public details?: string;
  public hint?: string;

  constructor(message: string, options?: {
    code?: string;
    details?: string;
    hint?: string;
    stack?: string;
    originalError?: Error | unknown;
    cause?: unknown;
  }) {
    super(message);
    this.name = 'AppError';
    this.code = options?.code;
    this.details = options?.details;
    this.hint = options?.hint;

    // Capture stack trace, excluding the constructor call from the stack
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, AppError);
    }

    // Log original error if provided
    if (options?.originalError) {
      console.error('Original Error:', options.originalError);
    }
  }
}

const handleError = (error: unknown, context: string = 'Global'): AppError => {
  let appError: AppError;

  if (error instanceof AppError) {
    appError = error;
  } else if (error instanceof Error) {
    appError = new AppError(error.message, { originalError: error, stack: error.stack });
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    appError = new AppError(String(error.message), { originalError: error });
  } else {
    appError = new AppError(`An unknown error occurred: ${String(error)}`, { originalError: error });
  }

  // Log the error to console
  console.error(`🚨 [${context} Error]: ${appError.message}`);
  if (appError.code) console.error(`   Code: ${appError.code}`);
  if (appError.details) console.error(`   Details: ${appError.details}`);
  if (appError.hint) console.error(`   Hint: ${appError.hint}`);
  if (appError.stack) console.error(`   Stack: ${appError.stack}`);

  // In a real application, you might send this to a logging service
  // e.g., Sentry.captureException(appError);

  return appError;
};

const getErrorMessage = (error: unknown): string => {
  if (error instanceof AppError) {
    return error.message;
  } else if (error instanceof Error) {
    return error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    return String(error.message);
  } else {
    return 'An unexpected error occurred.';
  }
};

export { handleError, getErrorMessage, AppError }; 
export interface FieldError {
  path: string;
  message: string;
}

/**
 * An error a service throws on purpose. The global filter sends `status`, `code` and `detail`
 * to the client, so `detail` must be safe to show: no internals, SQL or other users' data.
 */
export class AppError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    readonly detail: string,
  ) {
    super(detail);
    this.name = new.target.name;
  }
}

/** 404: the resource doesn't exist, or it isn't the caller's. */
export class NotFoundError extends AppError {
  constructor(detail = 'The requested resource was not found.', code = 'not_found') {
    super(404, code, detail);
  }
}

/** 409: the request conflicts with the current state, e.g. an invalid order status transition. */
export class ConflictError extends AppError {
  constructor(code: string, detail: string) {
    super(409, code, detail);
  }
}

/** 422: the request is well-formed but breaks a business rule. */
export class BusinessRuleError extends AppError {
  constructor(code: string, detail: string) {
    super(422, code, detail);
  }
}

/** 400: the request failed schema validation. */
export class ValidationFailedError extends AppError {
  constructor(readonly errors: FieldError[]) {
    super(400, 'validation_failed', 'The request is invalid.');
  }
}

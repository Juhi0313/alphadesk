export class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR') {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
  }
}

export const notFound = (msg) => new AppError(msg || 'Not found', 404, 'NOT_FOUND');
export const badRequest = (msg) => new AppError(msg || 'Bad request', 400, 'BAD_REQUEST');
export const serverError = (msg) => new AppError(msg || 'Server error', 500, 'SERVER_ERROR');

export function errorHandler(err, req, res, next) {
  const status = err.statusCode || 500;
  res.status(status).json({ error: err.message, code: err.code || 'ERROR' });
}

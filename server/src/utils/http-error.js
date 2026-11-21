// Maps request failures to the public API error response.
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

export function validate(schema, value) {
  const result = schema.safeParse(value);
  if (!result.success) {
    throw new HttpError(400, result.error.issues[0].message);
  }
  return result.data;
}

export function errorHandler(error, _req, res, next) {
  if (res.headersSent) {
    return next(error);
  }

  if (error instanceof HttpError) {
    return res.status(error.status).json({ message: error.message });
  }
  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({ message: 'Request body is not valid JSON.' });
  }
  if (error.type === 'entity.too.large') {
    return res.status(413).json({ message: 'Request body is too large.' });
  }
  if (error.status === 415) {
    return res.status(415).json({ message: 'Unsupported request encoding.' });
  }
  if (error instanceof URIError) {
    return res.status(400).json({ message: 'Invalid request URL.' });
  }

  console.error('Unhandled API error:', error);
  return res.status(500).json({ message: 'Something went wrong. Try again later.' });
}

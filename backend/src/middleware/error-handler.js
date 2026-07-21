const requestErrorHandler = (error, request, response, next) => {
  if (response.headersSent) {
    next(error);
    return;
  }

  if (error.type === 'entity.too.large') {
    return response.status(413).json({
      error: 'Payload Too Large',
      message: 'The request body is larger than the server limit.'
    });
  }

  if (error.type === 'entity.parse.failed') {
    return response.status(400).json({
      error: 'Validation Failed',
      message: 'The request body is not valid JSON.'
    });
  }

  console.error('[request-error]', {
    method: request.method,
    path: request.originalUrl,
    message: error.message,
    code: error.code,
    stack: error.stack
  });

  return response.status(500).json({
    error: 'Internal Server Error',
    message: 'The server could not complete this request.'
  });
};

module.exports = {
  requestErrorHandler
};

const mutationProtectionHeaderName = 'x-smart-schedule-csrf';

const requireMutationProtection = (request, response, next) => {
  const headerValue = request.get(mutationProtectionHeaderName);

  if (!headerValue) {
    response.status(403).json({
      error: 'Forbidden',
      message: 'This request is missing the required mutation protection header.'
    });
    return;
  }

  next();
};

module.exports = {
  mutationProtectionHeaderName,
  requireMutationProtection
};

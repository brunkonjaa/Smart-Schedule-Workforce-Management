const mutationProtectionHeaderName = 'x-smart-schedule-csrf';

const isSameOrigin = (request, value) => {
  if (!value) {
    return true;
  }

  try {
    const expectedOrigin = `${request.protocol}://${request.get('host')}`;
    return new URL(value).origin === expectedOrigin;
  } catch (error) {
    return false;
  }
};

const requireMutationProtection = (request, response, next) => {
  const headerValue = request.get(mutationProtectionHeaderName);

  const origin = request.get('origin');
  const referer = request.get('referer');

  if (
    !headerValue ||
    !isSameOrigin(request, origin) ||
    (!origin && referer && !isSameOrigin(request, referer))
  ) {
    const message = !headerValue
      ? 'This request is missing the required mutation protection header.'
      : 'This request failed the mutation protection check.';

    response.status(403).json({
      error: 'Forbidden',
      message
    });
    return;
  }

  next();
};

module.exports = {
  mutationProtectionHeaderName,
  requireMutationProtection
};

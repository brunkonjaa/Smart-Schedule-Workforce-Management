const buildWebSocketOrigin = (appBaseUrl) => {
  try {
    const url = new URL(appBaseUrl);

    if (url.protocol === 'https:') {
      url.protocol = 'wss:';
    } else if (url.protocol === 'http:') {
      url.protocol = 'ws:';
    } else {
      return null;
    }

    return url.origin;
  } catch (error) {
    return null;
  }
};

const buildHelmetOptions = (appBaseUrl) => {
  const webSocketOrigin = buildWebSocketOrigin(appBaseUrl);
  const connectSources = ["'self'"];

  if (webSocketOrigin) {
    connectSources.push(webSocketOrigin);
  }

  return {
    contentSecurityPolicy: {
      directives: {
        baseUri: ["'self'"],
        connectSrc: connectSources,
        defaultSrc: ["'self'"],
        formAction: ["'self'"],
        frameAncestors: ["'self'"],
        imgSrc: ["'self'", 'data:'],
        objectSrc: ["'none'"],
        scriptSrc: ["'self'"],
        styleSrc: ["'self'"]
      }
    },
    frameguard: {
      action: 'sameorigin'
    },
    referrerPolicy: {
      policy: 'no-referrer'
    },
    strictTransportSecurity: {
      includeSubDomains: true,
      maxAge: 63072000,
      preload: true
    },
    xContentTypeOptions: true
  };
};

const configureTrustProxy = (app, nodeEnv) => {
  if (nodeEnv === 'production') {
    app.set('trust proxy', 1);
  }
};

module.exports = {
  buildHelmetOptions,
  buildWebSocketOrigin,
  configureTrustProxy
};

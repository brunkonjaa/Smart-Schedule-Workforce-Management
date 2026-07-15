const nodemailer = require('nodemailer');
const dns = require('dns');
const config = require('../config/env');

const hasBrevoConfiguration = () => {
  return Boolean(config.brevoApiKey && config.brevoFromEmail);
};

const hasSmtpConfiguration = () => {
  return Boolean(
    config.smtpHost &&
      config.smtpPort &&
      config.smtpUser &&
      config.smtpPassword &&
      config.smtpFrom
  );
};

const resolveSmtpHost = () => {
  try {
    return dns.resolve4Sync(config.smtpHost)[0] || config.smtpHost;
  } catch (error) {
    return config.smtpHost;
  }
};

const buildTransport = () => {
  if (!hasSmtpConfiguration()) {
    return null;
  }

  return nodemailer.createTransport({
    auth: {
      pass: config.smtpPassword,
      user: config.smtpUser
    },
    connectionTimeout: 10000,
    family: 4,
    host: resolveSmtpHost(),
    port: config.smtpPort,
    secure: config.smtpPort === 465,
    tls: {
      servername: config.smtpHost
    }
  });
};

const sendWithBrevo = async (message) => {
  const response = await fetch('https://api.brevo.com/v3/smtp/email', {
    headers: {
      accept: 'application/json',
      'api-key': config.brevoApiKey,
      'content-type': 'application/json'
    },
    method: 'POST',
    body: JSON.stringify({
      htmlContent: message.html,
      sender: {
        email: config.brevoFromEmail,
        name: config.brevoFromName
      },
      subject: message.subject,
      textContent: message.text,
      to: [{ email: message.to }]
    }),
    signal: AbortSignal.timeout(10000)
  });

  if (!response.ok) {
    const error = new Error(`Brevo email request failed with status ${response.status}.`);
    error.code = 'BREVO_SEND_FAILED';
    throw error;
  }
};

const sendPasswordResetEmail = async ({ email, fullName, resetUrl }) => {
  const message = {
    from: config.smtpFrom,
    html: `<p>Hello ${fullName || 'there'},</p><p>Use the link below to create a new Smart Schedule password. The link expires in ${config.passwordResetExpiryMinutes} minutes and can only be used once.</p><p><a href="${resetUrl}">Create a new password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    subject: 'Smart Schedule password reset',
    text: `Hello ${fullName || 'there'},\n\nUse this link to create a new Smart Schedule password: ${resetUrl}\n\nThe link expires in ${config.passwordResetExpiryMinutes} minutes and can only be used once. If you did not request this, you can ignore this email.`,
    to: email
  };
  if (hasBrevoConfiguration()) {
    await sendWithBrevo(message);
    return { delivered: true, provider: 'brevo' };
  }

  const transport = buildTransport();

  if (!transport) {
    if (config.nodeEnv === 'production') {
      const error = new Error('Password reset email is not configured.');
      error.code = 'EMAIL_NOT_CONFIGURED';
      throw error;
    }

    console.log(`[password-reset] ${email}: ${resetUrl}`);
    return { delivered: false, developmentFallback: true };
  }

  await transport.sendMail(message);
  return { delivered: true, developmentFallback: false };
};

module.exports = {
  hasBrevoConfiguration,
  hasSmtpConfiguration,
  sendPasswordResetEmail
};

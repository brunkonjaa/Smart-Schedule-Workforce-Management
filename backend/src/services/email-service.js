const nodemailer = require('nodemailer');
const config = require('../config/env');

const hasSmtpConfiguration = () => {
  return Boolean(
    config.smtpHost &&
      config.smtpPort &&
      config.smtpUser &&
      config.smtpPassword &&
      config.smtpFrom
  );
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
    host: config.smtpHost,
    port: config.smtpPort,
    secure: config.smtpPort === 465
  });
};

const sendPasswordResetEmail = async ({ email, fullName, resetUrl }) => {
  const message = {
    from: config.smtpFrom,
    html: `<p>Hello ${fullName || 'there'},</p><p>Use the link below to create a new Smart Schedule password. The link expires in ${config.passwordResetExpiryMinutes} minutes and can only be used once.</p><p><a href="${resetUrl}">Create a new password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    subject: 'Smart Schedule password reset',
    text: `Hello ${fullName || 'there'},\n\nUse this link to create a new Smart Schedule password: ${resetUrl}\n\nThe link expires in ${config.passwordResetExpiryMinutes} minutes and can only be used once. If you did not request this, you can ignore this email.`,
    to: email
  };
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
  hasSmtpConfiguration,
  sendPasswordResetEmail
};

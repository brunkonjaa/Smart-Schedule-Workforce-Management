const config = require('../config/env');

const hasBrevoConfiguration = () => {
  return Boolean(config.brevoApiKey && config.brevoFromEmail);
};

const escapeHtml = (value) => {
  return String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
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
  const safeName = escapeHtml(fullName || 'there');
  const safeResetUrl = escapeHtml(resetUrl);
  const message = {
    from: config.brevoFromEmail,
    html: `<p>Hello ${safeName},</p><p>Use the link below to create a new Smart Schedule password. The link expires in ${config.passwordResetExpiryMinutes} minutes and can only be used once.</p><p><a href="${safeResetUrl}">Create a new password</a></p><p>If you did not request this, you can ignore this email.</p>`,
    subject: 'Smart Schedule password reset',
    text: `Hello ${fullName || 'there'},\n\nUse this link to create a new Smart Schedule password: ${resetUrl}\n\nThe link expires in ${config.passwordResetExpiryMinutes} minutes and can only be used once. If you did not request this, you can ignore this email.`,
    to: email
  };

  if (hasBrevoConfiguration()) {
    await sendWithBrevo(message);
    return { delivered: true, provider: 'brevo' };
  }

  if (config.nodeEnv === 'production') {
    const error = new Error('Password reset email is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  return { delivered: false, developmentFallback: true };
};

const sendAdminInvitationEmail = async ({ activationUrl, displayName, email }) => {
  const safeName = escapeHtml(displayName || 'there');
  const safeActivationUrl = escapeHtml(activationUrl);
  const message = {
    from: config.brevoFromEmail,
    html: `<p>Hello ${safeName},</p><p>You were invited to set up a Smart Schedule administrator account.</p><p><a href="${safeActivationUrl}">Set up administrator account</a></p><p>The link expires in ${config.adminInvitationExpiryMinutes} minutes and can only be used once.</p>`,
    subject: 'Set up your Smart Schedule administrator account',
    text: `Hello ${displayName || 'there'},\n\nUse this one-time link to set up your Smart Schedule administrator account: ${activationUrl}\n\nThe link expires in ${config.adminInvitationExpiryMinutes} minutes.`,
    to: email
  };

  if (hasBrevoConfiguration()) {
    await sendWithBrevo(message);
    return { delivered: true, provider: 'brevo' };
  }

  if (config.nodeEnv === 'production') {
    const error = new Error('Administrator invitation email is not configured.');
    error.code = 'EMAIL_NOT_CONFIGURED';
    throw error;
  }

  return { delivered: false, developmentFallback: true };
};

module.exports = {
  hasBrevoConfiguration,
  sendAdminInvitationEmail,
  sendPasswordResetEmail
};

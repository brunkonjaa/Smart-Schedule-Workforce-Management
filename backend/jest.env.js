const crypto = require('crypto');

process.env.PASSWORD_PEPPER_CURRENT_VERSION = '1';
process.env.PASSWORD_PEPPER_V1 = crypto.randomBytes(32).toString('base64url');
process.env.FIRST_ADMIN_BOOTSTRAP_TOKEN = crypto.randomBytes(32).toString('base64url');
process.env.SUBMISSION_REVIEW_ACCOUNTS_ENABLED = 'true';

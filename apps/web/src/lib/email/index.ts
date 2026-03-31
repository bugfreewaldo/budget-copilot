import { Resend } from 'resend';

// Lazy initialization to avoid build-time errors when API key is not set
let resendInstance: Resend | null = null;

function getResend(): Resend {
  if (!resendInstance) {
    resendInstance = new Resend(process.env.RESEND_API_KEY);
  }
  return resendInstance;
}

const FROM_EMAIL = 'Budget Copilot <noreply@budgetcopilot.app>';
const APP_NAME = 'Budget Copilot';

export interface SendEmailOptions {
  to: string;
  subject: string;
  html: string;
  text?: string;
}

export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const { error } = await getResend().emails.send({
      from: FROM_EMAIL,
      to: options.to,
      subject: options.subject,
      html: options.html,
      text: options.text,
    });

    if (error) {
      console.error('Email send error:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Email send exception:', error);
    return false;
  }
}

// ============================================================================
// EMAIL TEMPLATES
// ============================================================================

export function getWelcomeEmailHtml(name: string | null): string {
  const greeting = name ? `Hi ${name}!` : 'Hi!';

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🧠 ${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">${greeting}</h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Welcome to <strong>${APP_NAME}</strong>! We're excited to have you with us.
              </p>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                With ${APP_NAME} you can:
              </p>
              <ul style="margin: 0 0 20px; padding-left: 20px; color: #3f3f46; font-size: 16px; line-height: 1.8;">
                <li>📊 Track your spending with smart budgets</li>
                <li>💰 Save more with personalized goals</li>
                <li>🤖 Get advice from your AI-powered financial copilot</li>
                <li>👨‍👩‍👧‍👦 Share finances with your family</li>
              </ul>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Ready to take control of your finances?
              </p>
              <a href="https://budgetcopilot.app/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Go to Dashboard →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function getPasswordResetEmailHtml(resetUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🧠 ${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">Reset Password</h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                We received a request to reset the password for your ${APP_NAME} account.
              </p>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Click the button below to create a new password. This link will expire in <strong>1 hour</strong>.
              </p>
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Reset Password
              </a>
              <p style="margin: 30px 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                If you didn't request a password reset, you can ignore this email. Your account is safe.
              </p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link in your browser:<br>
                <span style="color: #6366f1; word-break: break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function getEmailVerificationHtml(verifyUrl: string): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🧠 ${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">Verify Your Email</h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Thanks for signing up for ${APP_NAME}! To complete your registration, we need to verify your email address.
              </p>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Click the button below to verify your account. This link will expire in <strong>24 hours</strong>.
              </p>
              <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Verify Email
              </a>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link in your browser:<br>
                <span style="color: #6366f1; word-break: break-all;">${verifyUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

export function getHouseholdInviteEmailHtml(
  inviterName: string,
  householdName: string,
  role: string,
  inviteUrl: string
): string {
  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; background-color: #f4f4f5;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background-color: #f4f4f5; padding: 40px 20px;">
    <tr>
      <td align="center">
        <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 600px; background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); padding: 40px 40px 30px;">
              <h1 style="margin: 0; color: #ffffff; font-size: 28px; font-weight: 700;">🧠 ${APP_NAME}</h1>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td style="padding: 40px;">
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">You've Been Invited!</h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> has invited you to join the <strong>"${householdName}"</strong> household on ${APP_NAME}.
              </p>
              <div style="margin: 0 0 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                <p style="margin: 0; color: #3f3f46; font-size: 14px;">
                  <strong>Your role:</strong> ${role}<br>
                  <strong>Household:</strong> ${householdName}
                </p>
              </div>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                By joining, you'll be able to collaborate on managing household finances, view shared budgets, and work together toward your financial goals.
              </p>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                This invitation will expire in <strong>7 days</strong>.
              </p>
              <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Accept Invitation
              </a>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.6;">
                If the button doesn't work, copy and paste this link in your browser:<br>
                <span style="color: #6366f1; word-break: break-all;">${inviteUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. All rights reserved.
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;
}

// ============================================================================
// CONVENIENCE FUNCTIONS
// ============================================================================

export async function sendWelcomeEmail(
  to: string,
  name: string | null
): Promise<boolean> {
  const greeting = name ? `Hi ${name}!` : 'Hi!';
  return sendEmail({
    to,
    subject: `Welcome to ${APP_NAME}`,
    html: getWelcomeEmailHtml(name),
    text: `${greeting}\n\nWelcome to ${APP_NAME}. We're excited to have you with us.\n\nWith ${APP_NAME} you can track your spending, save more, and get advice from your AI-powered financial copilot.\n\nVisit your dashboard: https://budgetcopilot.app/dashboard\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
  });
}

export async function sendPasswordResetEmail(
  to: string,
  resetToken: string,
  baseUrl: string
): Promise<boolean> {
  const resetUrl = `${baseUrl}/reset-password?token=${resetToken}`;
  return sendEmail({
    to,
    subject: `Reset your password - ${APP_NAME}`,
    html: getPasswordResetEmailHtml(resetUrl),
    text: `Reset Password\n\nWe received a request to reset the password for your ${APP_NAME} account.\n\nClick the following link to create a new password. This link will expire in 1 hour.\n\n${resetUrl}\n\nIf you didn't request a password reset, you can ignore this email.\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
  });
}

export async function sendEmailVerification(
  to: string,
  verifyToken: string,
  baseUrl: string
): Promise<boolean> {
  const verifyUrl = `${baseUrl}/verify-email?token=${verifyToken}`;
  return sendEmail({
    to,
    subject: `Verify your email - ${APP_NAME}`,
    html: getEmailVerificationHtml(verifyUrl),
    text: `Verify Your Email\n\nThanks for signing up for ${APP_NAME}. To complete your registration, we need to verify your email address.\n\nClick the following link to verify your account. This link will expire in 24 hours.\n\n${verifyUrl}\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
  });
}

export async function sendHouseholdInviteEmail(
  to: string,
  inviterName: string,
  householdName: string,
  role: string,
  inviteToken: string,
  baseUrl: string
): Promise<boolean> {
  const inviteUrl = `${baseUrl}/invite/${inviteToken}`;
  return sendEmail({
    to,
    subject: `${inviterName} invited you to "${householdName}" - ${APP_NAME}`,
    html: getHouseholdInviteEmailHtml(
      inviterName,
      householdName,
      role,
      inviteUrl
    ),
    text: `You've Been Invited\n\n${inviterName} has invited you to join the "${householdName}" household on ${APP_NAME}.\n\nYour role: ${role}\nHousehold: ${householdName}\n\nBy joining, you'll be able to collaborate on managing household finances. This invitation will expire in 7 days.\n\nAccept invitation: ${inviteUrl}\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
  });
}

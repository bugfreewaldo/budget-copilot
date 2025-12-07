import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);

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
    const { error } = await resend.emails.send({
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
// EMAIL TEMPLATES (Spanish)
// ============================================================================

export function getWelcomeEmailHtml(name: string | null): string {
  const greeting = name ? `¡Hola ${name}!` : '¡Hola!';

  return `
<!DOCTYPE html>
<html lang="es">
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
                ¡Bienvenido a <strong>${APP_NAME}</strong>! Estamos emocionados de tenerte con nosotros.
              </p>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Con ${APP_NAME} podrás:
              </p>
              <ul style="margin: 0 0 20px; padding-left: 20px; color: #3f3f46; font-size: 16px; line-height: 1.8;">
                <li>📊 Controlar tus gastos con presupuestos inteligentes</li>
                <li>💰 Ahorrar más con metas personalizadas</li>
                <li>🤖 Recibir consejos de tu copiloto financiero con IA</li>
                <li>👨‍👩‍👧‍👦 Compartir finanzas con tu familia</li>
              </ul>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                ¿Listo para tomar control de tus finanzas?
              </p>
              <a href="https://budgetcopilot.app/dashboard" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Ir al Dashboard →
              </a>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.
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
<html lang="es">
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
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">Restablecer contraseña</h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Recibimos una solicitud para restablecer la contraseña de tu cuenta de ${APP_NAME}.
              </p>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Haz clic en el botón de abajo para crear una nueva contraseña. Este enlace expirará en <strong>1 hora</strong>.
              </p>
              <a href="${resetUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Restablecer contraseña
              </a>
              <p style="margin: 30px 0 0; color: #71717a; font-size: 14px; line-height: 1.6;">
                Si no solicitaste restablecer tu contraseña, puedes ignorar este correo. Tu cuenta está segura.
              </p>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <span style="color: #6366f1; word-break: break-all;">${resetUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.
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
<html lang="es">
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
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">Verifica tu correo electrónico</h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                ¡Gracias por registrarte en ${APP_NAME}! Para completar tu registro, necesitamos verificar tu dirección de correo electrónico.
              </p>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Haz clic en el botón de abajo para verificar tu cuenta. Este enlace expirará en <strong>24 horas</strong>.
              </p>
              <a href="${verifyUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Verificar correo electrónico
              </a>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <span style="color: #6366f1; word-break: break-all;">${verifyUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.
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
  const roleTranslations: Record<string, string> = {
    admin: 'administrador',
    member: 'miembro',
    viewer: 'observador',
  };

  const translatedRole = roleTranslations[role] || role;

  return `
<!DOCTYPE html>
<html lang="es">
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
              <h2 style="margin: 0 0 20px; color: #18181b; font-size: 24px; font-weight: 600;">¡Te han invitado!</h2>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                <strong>${inviterName}</strong> te ha invitado a unirte a la familia <strong>"${householdName}"</strong> en ${APP_NAME}.
              </p>
              <div style="margin: 0 0 30px; padding: 20px; background-color: #f9fafb; border-radius: 8px; border-left: 4px solid #6366f1;">
                <p style="margin: 0; color: #3f3f46; font-size: 14px;">
                  <strong>Tu rol:</strong> ${translatedRole}<br>
                  <strong>Familia:</strong> ${householdName}
                </p>
              </div>
              <p style="margin: 0 0 20px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Al unirte podrás colaborar en el manejo de las finanzas familiares, ver presupuestos compartidos y trabajar juntos hacia sus metas financieras.
              </p>
              <p style="margin: 0 0 30px; color: #3f3f46; font-size: 16px; line-height: 1.6;">
                Esta invitación expirará en <strong>7 días</strong>.
              </p>
              <a href="${inviteUrl}" style="display: inline-block; background: linear-gradient(135deg, #6366f1 0%, #8b5cf6 100%); color: #ffffff; text-decoration: none; padding: 14px 28px; border-radius: 8px; font-weight: 600; font-size: 16px;">
                Aceptar invitación
              </a>
              <hr style="margin: 30px 0; border: none; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #a1a1aa; font-size: 12px; line-height: 1.6;">
                Si el botón no funciona, copia y pega este enlace en tu navegador:<br>
                <span style="color: #6366f1; word-break: break-all;">${inviteUrl}</span>
              </p>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="padding: 30px 40px; background-color: #f9fafb; border-top: 1px solid #e5e7eb;">
              <p style="margin: 0; color: #6b7280; font-size: 14px; text-align: center;">
                © ${new Date().getFullYear()} ${APP_NAME}. Todos los derechos reservados.
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
  const greeting = name ? `¡Hola ${name}!` : '¡Hola!';
  return sendEmail({
    to,
    subject: `Bienvenido a ${APP_NAME}`,
    html: getWelcomeEmailHtml(name),
    text: `${greeting}\n\nBienvenido a ${APP_NAME}. Estamos emocionados de tenerte con nosotros.\n\nCon ${APP_NAME} podrás controlar tus gastos, ahorrar más y recibir consejos de tu copiloto financiero con IA.\n\nVisita tu dashboard: https://budgetcopilot.app/dashboard\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
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
    subject: `Restablecer tu contraseña - ${APP_NAME}`,
    html: getPasswordResetEmailHtml(resetUrl),
    text: `Restablecer contraseña\n\nRecibimos una solicitud para restablecer la contraseña de tu cuenta de ${APP_NAME}.\n\nHaz clic en el siguiente enlace para crear una nueva contraseña. Este enlace expirará en 1 hora.\n\n${resetUrl}\n\nSi no solicitaste restablecer tu contraseña, puedes ignorar este correo.\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
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
    subject: `Verifica tu correo - ${APP_NAME}`,
    html: getEmailVerificationHtml(verifyUrl),
    text: `Verifica tu correo electrónico\n\nGracias por registrarte en ${APP_NAME}. Para completar tu registro, necesitamos verificar tu dirección de correo.\n\nHaz clic en el siguiente enlace para verificar tu cuenta. Este enlace expirará en 24 horas.\n\n${verifyUrl}\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
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
  const roleTranslations: Record<string, string> = {
    admin: 'administrador',
    member: 'miembro',
    viewer: 'observador',
  };
  const translatedRole = roleTranslations[role] || role;

  return sendEmail({
    to,
    subject: `${inviterName} te invito a "${householdName}" - ${APP_NAME}`,
    html: getHouseholdInviteEmailHtml(
      inviterName,
      householdName,
      role,
      inviteUrl
    ),
    text: `Te han invitado\n\n${inviterName} te ha invitado a unirte a la familia "${householdName}" en ${APP_NAME}.\n\nTu rol: ${translatedRole}\nFamilia: ${householdName}\n\nAl unirte podrás colaborar en el manejo de las finanzas familiares. Esta invitación expirará en 7 días.\n\nAceptar invitación: ${inviteUrl}\n\n© ${new Date().getFullYear()} ${APP_NAME}`,
  });
}

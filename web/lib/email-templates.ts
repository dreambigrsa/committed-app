/**
 * Committed email templates – premium, responsive, brand-consistent.
 * Uses table layout for broad email client support.
 */

const BRAND = {
  name: 'Committed',
  tagline: 'Trust · Love · Commitment',
  primary: '#1A73E8',
  primaryDark: '#1557B0',
  gray50: '#F8FAFC',
  gray100: '#F1F5F9',
  gray200: '#E2E8F0',
  gray400: '#94A3B8',
  gray500: '#6B7280',
  gray700: '#374151',
  gray900: '#1F2937',
};

const baseStyles = `
  .preheader { display: none !important; visibility: hidden; opacity: 0; height: 0; width: 0; max-height: 0; overflow: hidden; mso-hide: all; }
  @media only screen and (max-width: 600px) {
    .container { width: 100% !important; padding: 16px !important; }
    .content-padding { padding: 32px 24px !important; }
    .btn { padding: 14px 24px !important; font-size: 15px !important; }
    .title { font-size: 22px !important; }
  }
`;

function emailWrapper(content: string, preheader: string, subtitle?: string): string {
  const headerSubtitle = subtitle ? `<p style="margin: 8px 0 0; font-size: 14px; color: rgba(255,255,255,0.92); font-weight: 500;">${subtitle}</p>` : '';
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="color-scheme" content="light">
  <style>${baseStyles}</style>
</head>
<body style="margin: 0; padding: 0; -webkit-text-size-adjust: 100%; -ms-text-size-adjust: 100%; background-color: ${BRAND.gray100}; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif;">
  <div class="preheader">${preheader}</div>
  <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" style="background-color: ${BRAND.gray100};">
    <tr>
      <td align="center" style="padding: 40px 20px;">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="600" class="container" style="max-width: 600px; width: 100%; margin: 0 auto; background-color: #FFFFFF; border-radius: 16px; overflow: hidden; box-shadow: 0 4px 24px rgba(0, 0, 0, 0.08), 0 1px 3px rgba(0, 0, 0, 0.04);">
          <!-- Header -->
          <tr>
            <td style="background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); padding: 36px 40px; text-align: center;">
              <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
                <tr>
                  <td align="center">
                    <h1 style="margin: 0; font-size: 28px; font-weight: 700; color: #FFFFFF; letter-spacing: -0.5px;">${BRAND.name}</h1>
                    <p style="margin: 6px 0 0; font-size: 13px; color: rgba(255,255,255,0.9); font-weight: 500; letter-spacing: 0.3px;">${BRAND.tagline}</p>
                    ${headerSubtitle}
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Content -->
          <tr>
            <td class="content-padding" style="padding: 40px 40px 36px;">
              ${content}
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color: ${BRAND.gray50}; padding: 24px 40px; text-align: center; border-top: 1px solid ${BRAND.gray200};">
              <p style="margin: 0; font-size: 12px; color: ${BRAND.gray400};">&copy; ${new Date().getFullYear()} Committed. All rights reserved.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function passwordResetEmail(resetUrl: string, deepLink: string, expiryMinutes: number): string {
  const preheader = `Reset your Committed password. This link expires in ${expiryMinutes} minutes.`;
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <div style="display: inline-block; background: rgba(26, 115, 232, 0.1); color: ${BRAND.primary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; padding: 8px 16px; border-radius: 8px; margin-bottom: 20px;">Password Reset</div>
          <h2 class="title" style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BRAND.gray900};">Reset your password</h2>
          <p style="margin: 0; font-size: 16px; color: ${BRAND.gray500}; line-height: 1.65; max-width: 440px;">Click the button below to set a new password. This link expires in <strong style="color: ${BRAND.gray700};">${expiryMinutes} minutes</strong>.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 28px;">
          <a href="${resetUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.4);">Reset Password</a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 20px;">
          <p style="margin: 0; font-size: 14px; color: ${BRAND.gray500};">On your phone? <a href="${deepLink}" style="color: ${BRAND.primary}; font-weight: 600; text-decoration: none;">Open in App</a></p>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 32px; border-top: 1px solid ${BRAND.gray200}; margin-top: 24px;">
          <p style="margin: 0; font-size: 13px; color: ${BRAND.gray500}; line-height: 1.6;">If you didn't request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
        </td>
      </tr>
    </table>`;
  return emailWrapper(content, preheader, 'Reset your password');
}


export function verifyEmailEmail(verifyUrl: string, deepLink: string, expiryHours: number): string {
  const preheader = `Verify your email for Committed. Click the link to complete verification.`;
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <div style="display: inline-block; background: rgba(26, 115, 232, 0.1); color: ${BRAND.primary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; padding: 8px 16px; border-radius: 8px; margin-bottom: 20px;">Email Verification</div>
          <h2 class="title" style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BRAND.gray900};">Verify your email</h2>
          <p style="margin: 0; font-size: 16px; color: ${BRAND.gray500}; line-height: 1.65; max-width: 440px;">Click the button below to verify your email address and get started. This link expires in <strong style="color: ${BRAND.gray700};">${expiryHours} hours</strong>.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 28px;">
          <a href="${verifyUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.4);">Verify Email</a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 20px;">
          <p style="margin: 0; font-size: 14px; color: ${BRAND.gray500};">On your phone? <a href="${deepLink}" style="color: ${BRAND.primary}; font-weight: 600; text-decoration: none;">Open in App</a></p>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 32px; border-top: 1px solid ${BRAND.gray200}; margin-top: 24px;">
          <p style="margin: 0; font-size: 13px; color: ${BRAND.gray500}; line-height: 1.6;">If you didn't create an account with Committed, you can safely ignore this email.</p>
        </td>
      </tr>
    </table>`;
  return emailWrapper(content, preheader, 'Verify your email');
}

export function verificationCodeEmail(code: string, expiryMinutes: number = 10): string {
  const preheader = `Your verification code is ${code}. Valid for ${expiryMinutes} minutes. — Committed`;
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <div style="display: inline-block; background: rgba(26, 115, 232, 0.1); color: ${BRAND.primary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; padding: 8px 16px; border-radius: 8px; margin-bottom: 20px;">Verification Code</div>
          <h2 class="title" style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BRAND.gray900};">Welcome back</h2>
          <p style="margin: 0; font-size: 16px; color: ${BRAND.gray500}; line-height: 1.65; max-width: 440px;">Use the code below to verify your email and continue.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 28px;">
          <div style="display: inline-block; background: linear-gradient(145deg, ${BRAND.gray50} 0%, ${BRAND.gray100} 100%); border: 1px solid ${BRAND.gray200}; border-radius: 12px; padding: 24px 40px;">
            <span style="font-size: 32px; font-weight: 700; color: ${BRAND.primary}; letter-spacing: 8px; font-variant-numeric: tabular-nums;">${code}</span>
          </div>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 20px;">
          <p style="margin: 0; font-size: 14px; color: ${BRAND.gray500};">This code expires in <strong style="color: ${BRAND.gray700};">${expiryMinutes} minutes</strong></p>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 32px; border-top: 1px solid ${BRAND.gray200}; margin-top: 24px;">
          <p style="margin: 0; font-size: 13px; color: ${BRAND.gray500}; line-height: 1.6;">If you didn't request this code, you can safely ignore this email. Someone may have entered your email by mistake.</p>
        </td>
      </tr>
    </table>`;
  return emailWrapper(content, preheader, 'Verification Code');
}

/** Subscription follow-up: user signed up but never subscribed */
export function subscriptionFollowUpEmail(appUrl: string, downloadUrl: string, daysSinceSignup?: number): string {
  const preheader = 'Unlock more with Committed Premium — you haven\'t subscribed yet.';
  const hint = daysSinceSignup
    ? `You joined Committed ${daysSinceSignup} days ago.`
    : 'You\'ve been using Committed.';
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <div style="display: inline-block; background: rgba(26, 115, 232, 0.1); color: ${BRAND.primary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; padding: 8px 16px; border-radius: 8px; margin-bottom: 20px;">Premium</div>
          <h2 class="title" style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BRAND.gray900};">Ready to unlock more?</h2>
          <p style="margin: 0; font-size: 16px; color: ${BRAND.gray500}; line-height: 1.65; max-width: 440px;">${hint} Subscribe to Premium to get unlimited likes, see who likes you, and more.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 28px;">
          <a href="${appUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.4);">Upgrade to Premium</a>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 20px;">
          <p style="margin: 0; font-size: 14px; color: ${BRAND.gray500};">Don't have the app? <a href="${downloadUrl}" style="color: ${BRAND.primary}; font-weight: 600; text-decoration: none;">Download Committed</a></p>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 32px; border-top: 1px solid ${BRAND.gray200}; margin-top: 24px;">
          <p style="margin: 0; font-size: 13px; color: ${BRAND.gray500}; line-height: 1.6;">You're receiving this because you have a Committed account. Manage preferences in the app.</p>
        </td>
      </tr>
    </table>`;
  return emailWrapper(content, preheader, 'Premium');
}

/** Subscription due soon: expires in X days */
export function subscriptionDueEmail(appUrl: string, daysLeft: number, planName: string): string {
  const preheader = `Your ${planName} subscription expires in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`;
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <div style="display: inline-block; background: rgba(26, 115, 232, 0.1); color: ${BRAND.primary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; padding: 8px 16px; border-radius: 8px; margin-bottom: 20px;">Renewal</div>
          <h2 class="title" style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BRAND.gray900};">Your subscription ends soon</h2>
          <p style="margin: 0; font-size: 16px; color: ${BRAND.gray500}; line-height: 1.65; max-width: 440px;">Your <strong style="color: ${BRAND.gray700};">${planName}</strong> subscription expires in <strong style="color: ${BRAND.gray700};">${daysLeft} day${daysLeft === 1 ? '' : 's'}</strong>. Renew to keep your premium features.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 28px;">
          <a href="${appUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.4);">Renew Subscription</a>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 32px; border-top: 1px solid ${BRAND.gray200}; margin-top: 24px;">
          <p style="margin: 0; font-size: 13px; color: ${BRAND.gray500}; line-height: 1.6;">If you've already renewed, you can ignore this email.</p>
        </td>
      </tr>
    </table>`;
  return emailWrapper(content, preheader, 'Renewal');
}

/** Subscription expired */
export function subscriptionExpiredEmail(appUrl: string, planName: string): string {
  const preheader = `Your ${planName} subscription has expired.`;
  const content = `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%">
      <tr>
        <td align="center">
          <div style="display: inline-block; background: rgba(26, 115, 232, 0.1); color: ${BRAND.primary}; font-size: 11px; font-weight: 600; text-transform: uppercase; letter-spacing: 1.2px; padding: 8px 16px; border-radius: 8px; margin-bottom: 20px;">Subscription Expired</div>
          <h2 class="title" style="margin: 0 0 12px; font-size: 24px; font-weight: 700; color: ${BRAND.gray900};">We miss you</h2>
          <p style="margin: 0; font-size: 16px; color: ${BRAND.gray500}; line-height: 1.65; max-width: 440px;">Your <strong style="color: ${BRAND.gray700};">${planName}</strong> subscription has expired. Resubscribe to get your premium features back.</p>
        </td>
      </tr>
      <tr>
        <td align="center" style="padding-top: 28px;">
          <a href="${appUrl}" class="btn" style="display: inline-block; background: linear-gradient(135deg, ${BRAND.primary} 0%, ${BRAND.primaryDark} 100%); color: #FFFFFF !important; text-decoration: none; padding: 16px 36px; border-radius: 12px; font-weight: 600; font-size: 16px; box-shadow: 0 4px 14px rgba(26, 115, 232, 0.4);">Resubscribe</a>
        </td>
      </tr>
      <tr>
        <td style="padding-top: 32px; border-top: 1px solid ${BRAND.gray200}; margin-top: 24px;">
          <p style="margin: 0; font-size: 13px; color: ${BRAND.gray500}; line-height: 1.6;">You're receiving this because you had a Committed subscription.</p>
        </td>
      </tr>
    </table>`;
  return emailWrapper(content, preheader, 'Expired');
}

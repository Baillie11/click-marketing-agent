import nodemailer from 'nodemailer';
import type { Config } from '../config.js';

const escapeHtml = (value: string) => value
  .replaceAll('&', '&amp;')
  .replaceAll('<', '&lt;')
  .replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;')
  .replaceAll("'", '&#039;');

export class EmailService {
  private transporter: ReturnType<typeof nodemailer.createTransport> | null;

  constructor(private config: Config) {
    this.transporter = config.SMTP_HOST
      ? nodemailer.createTransport({
          host: config.SMTP_HOST,
          port: config.SMTP_PORT,
          secure: config.SMTP_SECURE,
          auth: config.SMTP_USER
            ? { user: config.SMTP_USER, pass: config.SMTP_PASSWORD ?? '' }
            : undefined,
        })
      : null;
  }

  get configured() {
    return Boolean(this.transporter && this.config.SMTP_FROM);
  }

  async sendPasswordReset(input: { to: string; name: string; resetUrl: string; expiresMinutes: number }) {
    if (!this.transporter || !this.config.SMTP_FROM) return { delivered: false as const };
    const name = escapeHtml(input.name);
    const resetUrl = escapeHtml(input.resetUrl);
    await this.transporter.sendMail({
      from: this.config.SMTP_FROM,
      to: input.to,
      subject: 'Reset your Click Marketing Agent password',
      text: `Hello ${input.name},\n\nUse this link to reset your Click Marketing Agent password:\n${input.resetUrl}\n\nThis link expires in ${input.expiresMinutes} minutes. If you did not request this, you can ignore this email.`,
      html: `<p>Hello ${name},</p><p>Use the button below to reset your Click Marketing Agent password.</p><p><a href="${resetUrl}" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#176fe3;color:#fff;text-decoration:none;font-weight:700">Reset password</a></p><p>This link expires in ${input.expiresMinutes} minutes. If you did not request this, you can ignore this email.</p>`,
    });
    return { delivered: true as const };
  }

  async sendWorkspaceInvitation(input: { to: string; name: string; businessName: string; loginUrl: string }) {
    if (!this.transporter || !this.config.SMTP_FROM) return { delivered: false as const };
    const name = escapeHtml(input.name);
    const businessName = escapeHtml(input.businessName);
    const loginUrl = escapeHtml(input.loginUrl);
    await this.transporter.sendMail({
      from: this.config.SMTP_FROM,
      to: input.to,
      subject: `You have been added to ${input.businessName}`,
      text: `Hello ${input.name},\n\nYou have been added to ${input.businessName} in Click Marketing Agent. Sign in at ${input.loginUrl}`,
      html: `<p>Hello ${name},</p><p>You have been added to <strong>${businessName}</strong> in Click Marketing Agent.</p><p><a href="${loginUrl}" style="display:inline-block;padding:12px 18px;border-radius:7px;background:#176fe3;color:#fff;text-decoration:none;font-weight:700">Open Click Marketing Agent</a></p>`,
    });
    return { delivered: true as const };
  }
}

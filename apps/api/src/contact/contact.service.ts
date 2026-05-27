import { BadRequestException, Injectable } from '@nestjs/common';
import { EmailService } from '../email/email.service';
import type { ContactReportDto } from './dto';

const DEFAULT_REPORT_TO = 'support.bookvella@gmail.com';

const TOPICS: Record<string, string> = {
  general: 'General question',
  bug: 'Bug report',
  privacy: 'Privacy / data request',
  illegal: 'Report illegal content',
  other: 'Other',
};

@Injectable()
export class ContactService {
  constructor(private readonly emailService: EmailService) {}

  async sendReport(dto: ContactReportDto) {
    if (dto.website?.trim()) {
      return { success: true };
    }

    const topic = normalizeTopic(dto.topic);
    const name = requireText(dto.name, 'name', 2, 120);
    const email = normalizeEmail(dto.email);
    const message = requireText(dto.message, 'message', 10, 4000);
    const contentUrl = normalizeOptionalUrl(dto.contentUrl);
    const currentPage = normalizeOptionalText(dto.currentPage, 500);
    const userAgent = normalizeOptionalText(dto.userAgent, 500);

    if (dto.consent !== true) {
      throw new BadRequestException('Consent is required');
    }

    const topicLabel = TOPICS[topic];
    const reportTo =
      process.env.CONTACT_REPORT_TO?.trim() ||
      process.env.SUPPORT_EMAIL?.trim() ||
      DEFAULT_REPORT_TO;

    const lines = [
      `Topic: ${topicLabel}`,
      `Name: ${name}`,
      `Email: ${email}`,
      contentUrl ? `Content/page link: ${contentUrl}` : null,
      currentPage ? `Submitted from: ${currentPage}` : null,
      userAgent ? `User agent: ${userAgent}` : null,
      '',
      'Message:',
      message,
    ].filter((line): line is string => line !== null);

    await this.emailService.sendMail({
      to: reportTo,
      replyTo: email,
      subject: `[Bookvella] ${topicLabel}`,
      text: lines.join('\n'),
      html: reportEmailHtml({
        topic: topicLabel,
        name,
        email,
        contentUrl,
        currentPage,
        userAgent,
        message,
      }),
    });

    return { success: true };
  }
}

function normalizeTopic(value: unknown) {
  const topic = typeof value === 'string' ? value.trim() : '';

  if (!Object.prototype.hasOwnProperty.call(TOPICS, topic)) {
    throw new BadRequestException('Choose what this is about');
  }

  return topic;
}

function requireText(
  value: unknown,
  label: string,
  minLength: number,
  maxLength: number,
) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (text.length < minLength) {
    throw new BadRequestException(`Enter a valid ${label}`);
  }

  if (text.length > maxLength) {
    throw new BadRequestException(`${label} is too long`);
  }

  return text;
}

function normalizeEmail(value: unknown) {
  const email = requireText(value, 'email', 3, 254).toLowerCase();

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new BadRequestException('Enter a valid email');
  }

  return email;
}

function normalizeOptionalUrl(value: unknown) {
  const text = normalizeOptionalText(value, 500);

  if (!text) {
    return null;
  }

  try {
    const url = new URL(text);
    if (!['http:', 'https:'].includes(url.protocol)) {
      throw new Error('Unsupported protocol');
    }
    return url.toString();
  } catch {
    throw new BadRequestException('Enter a valid content/page link');
  }
}

function normalizeOptionalText(value: unknown, maxLength: number) {
  const text = typeof value === 'string' ? value.trim() : '';

  if (!text) {
    return null;
  }

  if (text.length > maxLength) {
    throw new BadRequestException('Text field is too long');
  }

  return text;
}

function reportEmailHtml(input: {
  topic: string;
  name: string;
  email: string;
  contentUrl: string | null;
  currentPage: string | null;
  userAgent: string | null;
  message: string;
}) {
  const rows = [
    ['Topic', input.topic],
    ['Name', input.name],
    ['Email', input.email],
    ['Content/page link', input.contentUrl],
    ['Submitted from', input.currentPage],
    ['User agent', input.userAgent],
  ].filter((row): row is [string, string] => Boolean(row[1]));

  return [
    '<div style="font-family:Arial,sans-serif;color:#0b1220;line-height:1.5">',
    '<h1 style="font-size:22px;margin:0 0 16px">Bookvella contact / report</h1>',
    '<table style="border-collapse:collapse;margin-bottom:18px">',
    ...rows.map(
      ([label, value]) =>
        `<tr><td style="padding:6px 14px 6px 0;color:#6b7280;font-weight:700">${escapeHtml(label)}</td><td style="padding:6px 0">${escapeHtml(value)}</td></tr>`,
    ),
    '</table>',
    '<div style="border-top:1px solid #eee7df;padding-top:16px">',
    '<p style="color:#6b7280;font-weight:700;margin:0 0 8px">Message</p>',
    `<p style="white-space:pre-wrap;margin:0">${escapeHtml(input.message)}</p>`,
    '</div>',
    '</div>',
  ].join('');
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

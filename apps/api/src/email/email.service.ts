import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { Socket, connect } from 'net';
import { TLSSocket, connect as connectTls } from 'tls';
import type { SendMailInput, SendMailResult } from './email.types';

type MailSocket = Socket | TLSSocket;

@Injectable()
export class EmailService {
  async sendMail(input: SendMailInput): Promise<SendMailResult> {
    const host = process.env.SMTP_HOST?.trim();

    if (!host) {
      console.log(
        JSON.stringify({
          emailMode: 'console',
          to: input.to,
          subject: input.subject,
          text: input.text,
          attachments: input.attachments?.map((attachment) => ({
            filename: attachment.filename,
            contentType: attachment.contentType,
          })),
        }),
      );
      return { delivered: true, mode: 'console' };
    }

    await sendSmtpMail({
      host,
      port: Number(process.env.SMTP_PORT ?? 587),
      secure: process.env.SMTP_SECURE === 'true',
      username: process.env.SMTP_USER,
      password: process.env.SMTP_PASSWORD,
      from:
        process.env.SMTP_FROM ??
        process.env.SMTP_USER ??
        'Bookvella <no-reply@bookvella.local>',
      to: input.to,
      subject: input.subject,
      text: input.text,
      html: input.html,
      attachments: input.attachments,
    });

    return { delivered: true, mode: 'smtp' };
  }
}

async function sendSmtpMail(options: {
  host: string;
  port: number;
  secure: boolean;
  username?: string;
  password?: string;
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: {
    filename: string;
    contentType: string;
    content: string | Buffer;
  }[];
}) {
  const client = await SmtpClient.connect(
    options.host,
    options.port,
    options.secure,
  );

  try {
    await client.expect(220);
    await client.command(
      `EHLO ${process.env.SMTP_HELO_NAME ?? 'localhost'}`,
      250,
    );

    if (!options.secure && process.env.SMTP_STARTTLS !== 'false') {
      await client.command('STARTTLS', 220);
      client.upgradeTls(options.host);
      await client.command(
        `EHLO ${process.env.SMTP_HELO_NAME ?? 'localhost'}`,
        250,
      );
    }

    if (options.username && options.password) {
      await client.command('AUTH LOGIN', 334);
      await client.command(
        Buffer.from(options.username).toString('base64'),
        334,
      );
      await client.command(
        Buffer.from(options.password).toString('base64'),
        235,
      );
    }

    await client.command(`MAIL FROM:<${extractAddress(options.from)}>`, 250);
    await client.command(`RCPT TO:<${extractAddress(options.to)}>`, [250, 251]);
    await client.command('DATA', 354);
    client.writeData(buildMessage(options));
    await client.expect(250);
    await client.command('QUIT', 221);
  } finally {
    client.close();
  }
}

class SmtpClient {
  private buffer = '';
  private pending:
    | {
        resolve: (line: string) => void;
        reject: (error: Error) => void;
      }
    | undefined;

  private constructor(private socket: MailSocket) {
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => this.handleData(chunk));
    this.socket.on('error', (error) => this.pending?.reject(error));
  }

  static connect(host: string, port: number, secure: boolean) {
    return new Promise<SmtpClient>((resolve, reject) => {
      const socket = secure
        ? connectTls({ host, port, servername: host })
        : connect({ host, port });

      socket.once('connect', () => resolve(new SmtpClient(socket)));
      socket.once('error', reject);
    });
  }

  async command(command: string, expected: number | number[]) {
    this.socket.write(`${command}\r\n`);
    return this.expect(expected);
  }

  writeData(message: string) {
    this.socket.write(`${message}\r\n.\r\n`);
  }

  async expect(expected: number | number[]) {
    const line = await this.nextResponse();
    const codes = Array.isArray(expected) ? expected : [expected];
    const code = Number(line.slice(0, 3));

    if (!codes.includes(code)) {
      throw new InternalServerErrorException(`SMTP error: ${line}`);
    }

    return line;
  }

  upgradeTls(host: string) {
    this.socket.removeAllListeners('data');
    this.socket = connectTls({
      socket: this.socket,
      servername: host,
    });
    this.socket.setEncoding('utf8');
    this.socket.on('data', (chunk) => this.handleData(chunk));
    this.socket.on('error', (error) => this.pending?.reject(error));
  }

  close() {
    this.socket.end();
  }

  private nextResponse() {
    return new Promise<string>((resolve, reject) => {
      this.pending = { resolve, reject };
      this.flushBuffer();
    });
  }

  private handleData(chunk: string | Buffer) {
    this.buffer += chunk.toString();
    this.flushBuffer();
  }

  private flushBuffer() {
    if (!this.pending) {
      return;
    }

    const lines = this.buffer.split(/\r?\n/);
    const completeLines = lines.slice(0, -1);
    const lastResponseLineIndex = completeLines.findIndex((line) =>
      /^\d{3} /.test(line),
    );

    if (lastResponseLineIndex === -1) {
      return;
    }

    this.buffer = lines.slice(lastResponseLineIndex + 1).join('\n');
    const line = completeLines[lastResponseLineIndex];
    const pending = this.pending;
    this.pending = undefined;
    pending.resolve(line);
  }
}

function buildMessage(options: {
  from: string;
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: {
    filename: string;
    contentType: string;
    content: string | Buffer;
  }[];
}) {
  const boundary = `bookvella-${Date.now().toString(36)}`;
  const mixedBoundary = `bookvella-mixed-${Date.now().toString(36)}`;
  const attachments = options.attachments ?? [];
  const headers = [
    `From: ${options.from}`,
    `To: ${options.to}`,
    `Subject: ${encodeHeader(options.subject)}`,
    'MIME-Version: 1.0',
  ];

  if (!options.html && attachments.length === 0) {
    return [
      ...headers,
      'Content-Type: text/plain; charset=UTF-8',
      'Content-Transfer-Encoding: 7bit',
      '',
      escapeMessageBody(options.text),
    ].join('\r\n');
  }

  const bodyPart = options.html
    ? buildAlternativePart(boundary, options.text, options.html)
    : [
        'Content-Type: text/plain; charset=UTF-8',
        'Content-Transfer-Encoding: 7bit',
        '',
        escapeMessageBody(options.text),
      ].join('\r\n');

  if (attachments.length === 0) {
    return [...headers, bodyPart].join('\r\n');
  }

  return [
    ...headers,
    `Content-Type: multipart/mixed; boundary="${mixedBoundary}"`,
    '',
    `--${mixedBoundary}`,
    bodyPart,
    ...attachments.map((attachment) =>
      [
        `--${mixedBoundary}`,
        `Content-Type: ${attachment.contentType}; name="${escapeHeaderParam(attachment.filename)}"`,
        'Content-Transfer-Encoding: base64',
        `Content-Disposition: attachment; filename="${escapeHeaderParam(attachment.filename)}"`,
        '',
        wrapBase64(Buffer.from(attachment.content).toString('base64')),
      ].join('\r\n'),
    ),
    `--${mixedBoundary}--`,
  ].join('\r\n');
}

function buildAlternativePart(boundary: string, text: string, html: string) {
  return [
    `Content-Type: multipart/alternative; boundary="${boundary}"`,
    '',
    `--${boundary}`,
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    escapeMessageBody(text),
    `--${boundary}`,
    'Content-Type: text/html; charset=UTF-8',
    'Content-Transfer-Encoding: 7bit',
    '',
    escapeMessageBody(html),
    `--${boundary}--`,
  ].join('\r\n');
}

function encodeHeader(value: string) {
  if (isAscii(value)) {
    return value;
  }

  return `=?UTF-8?B?${Buffer.from(value).toString('base64')}?=`;
}

function isAscii(value: string) {
  return Array.from(value).every(
    (character) => character.charCodeAt(0) <= 0x7f,
  );
}

function escapeMessageBody(value: string) {
  // RFC 2822 requires CRLF line endings throughout the message body.
  // Normalize any bare LF or lone CR to CRLF before dot-stuffing so that
  // lines starting with '.' are correctly escaped even after normalisation.
  const crlf = value.replace(/\r\n/g, '\n').replace(/\r/g, '\n').replace(/\n/g, '\r\n');
  return crlf.replace(/^\./gm, '..');
}

function escapeHeaderParam(value: string) {
  return value.replace(/["\\]/g, '_');
}

function wrapBase64(value: string) {
  return value.match(/.{1,76}/g)?.join('\r\n') ?? '';
}

function extractAddress(value: string) {
  const match = /<([^>]+)>/.exec(value);
  return (match?.[1] ?? value).trim();
}

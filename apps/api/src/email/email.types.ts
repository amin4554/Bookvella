export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
  attachments?: SendMailAttachment[];
};

export type SendMailAttachment = {
  filename: string;
  contentType: string;
  content: string | Buffer;
};

export type SendMailResult = {
  delivered: boolean;
  mode: 'smtp' | 'console';
};

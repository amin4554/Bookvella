export type SendMailInput = {
  to: string;
  subject: string;
  text: string;
  html?: string;
};

export type SendMailResult = {
  delivered: boolean;
  mode: 'smtp' | 'console';
};

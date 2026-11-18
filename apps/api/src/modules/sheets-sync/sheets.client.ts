import { Injectable, Logger } from '@nestjs/common';
import { google, sheets_v4 } from 'googleapis';

export interface SheetsClient {
  getValues(spreadsheetId: string, range: string): Promise<unknown[][]>;
}

export const SHEETS_CLIENT = Symbol('SHEETS_CLIENT');

@Injectable()
export class GoogleSheetsClient implements SheetsClient {
  private readonly logger = new Logger(GoogleSheetsClient.name);
  private sheetsService: sheets_v4.Sheets | null = null;

  constructor() {
    this.initClient();
  }

  private initClient() {
    const email = process.env.GOOGLE_SA_EMAIL;
    const rawKey = process.env.GOOGLE_SA_PRIVATE_KEY;

    if (!email || !rawKey) {
      this.logger.warn(
        'GOOGLE_SA_EMAIL atau GOOGLE_SA_PRIVATE_KEY belum dikonfigurasi. Klien Google Sheets belum siap.',
      );
      return;
    }

    const key = rawKey.replace(/\\n/g, '\n');

    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    });

    this.sheetsService = google.sheets({ version: 'v4', auth });
  }

  async getValues(spreadsheetId: string, range: string): Promise<unknown[][]> {
    if (!this.sheetsService) {
      this.initClient();
      if (!this.sheetsService) {
        throw new Error(
          'Klien Google Sheets tidak terinisialisasi. Periksa kredensial Service Account.',
        );
      }
    }

    return this.executeWithRetry(async () => {
      const res = await this.sheetsService!.spreadsheets.values.get({
        spreadsheetId,
        range,
        valueRenderOption: 'UNFORMATTED_VALUE',
        dateTimeRenderOption: 'SERIAL_NUMBER',
      });

      return (res.data.values as unknown[][]) || [];
    });
  }

  private async executeWithRetry<T>(
    fn: () => Promise<T>,
    maxRetries = 3,
    initialDelayMs = 500,
  ): Promise<T> {
    let attempt = 0;
    let delay = initialDelayMs;

    while (attempt <= maxRetries) {
      try {
        return await fn();
      } catch (err: unknown) {
        attempt++;
        const status =
          err && typeof err === 'object' && 'status' in err
            ? (err as { status: number }).status
            : undefined;

        const isTransient =
          status === 429 || status === 500 || status === 503 || status === 502;

        if (attempt > maxRetries || !isTransient) {
          throw err;
        }

        const jitter = Math.random() * 200;
        this.logger.warn(
          `Percobaan ke-${attempt} gagal dengan status ${status}. Mencoba kembali dalam ${Math.round(
            delay + jitter,
          )}ms...`,
        );

        await new Promise((resolve) => setTimeout(resolve, delay + jitter));
        delay *= 2;
      }
    }

    throw new Error('Ekspektasi retry loop terlampaui.');
  }
}

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * GasAdapter.ts - Direct live bridge to Google Apps Script Web App & Spreadsheet
 * Connects the frontend services to the deployed Google Apps Script Web App
 * with automatic schema verification and error messaging.
 */

export const SPREADSHEET_CONFIG = {
  spreadsheetId: '1fdbI2ocFwJM3-RlYqegAWMRUEE0o2y-0Lh18HTOJ7Z8',
  appsScriptUrl:
    'https://script.google.com/macros/s/AKfycbwArKzpi76YrLlbFmV7J22kityLspwaU_OwpdleJH2UGSOk8hEMxVXsEaHC2XMcM3UOpQ/exec',
};

export interface GasResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export class GasAdapter {
  private static endpoint = SPREADSHEET_CONFIG.appsScriptUrl;

  /**
   * Executes a command against the Google Apps Script Web App
   */
  public static async execute<T = any>(
    action: string,
    payload: Record<string, any> = {},
    sessionId?: string
  ): Promise<GasResponse<T>> {
    try {
      const url = new URL(this.endpoint);
      url.searchParams.append('action', action);
      if (sessionId) {
        url.searchParams.append('sessionId', sessionId);
      }

      const response = await fetch(url.toString(), {
        method: 'POST',
        headers: {
          'Content-Type': 'text/plain;charset=utf-8', // Apps Script standard CORS text payload
        },
        body: JSON.stringify({
          action,
          payload,
          sessionId,
        }),
      });

      if (!response.ok) {
        return {
          success: false,
          error: {
            code: `HTTP_${response.status}`,
            message: `Google Apps Script returned HTTP status ${response.status}.`,
          },
        };
      }

      const json = await response.json();
      return json;
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'GAS_CONNECTION_ERROR',
          message: err.message || 'Unable to connect to Google Apps Script Web App.',
        },
      };
    }
  }

  /**
   * Performs read-only schema verification against the live Google Spreadsheet
   */
  public static async verifyLiveDatabaseSchema(): Promise<GasResponse> {
    try {
      const response = await fetch(`${this.endpoint}?action=verifyDatabaseSchema`, {
        method: 'GET',
      });
      return await response.json();
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'SCHEMA_VERIFY_ERROR',
          message: err.message || 'Failed to verify schema with live spreadsheet.',
        },
      };
    }
  }

  /**
   * Tests real transactional email delivery via live Apps Script MailApp
   */
  public static async testEmailDelivery(recipientEmail: string): Promise<GasResponse> {
    try {
      const response = await fetch(
        `${this.endpoint}?action=testEmailDelivery&recipientEmail=${encodeURIComponent(recipientEmail)}`,
        { method: 'GET' }
      );
      return await response.json();
    } catch (err: any) {
      return {
        success: false,
        error: {
          code: 'EMAIL_TEST_ERROR',
          message: err.message || 'Failed to trigger email delivery test.',
        },
      };
    }
  }
}

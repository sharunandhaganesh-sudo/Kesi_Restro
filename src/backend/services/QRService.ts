/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QRService: Secure table-specific QR token generation, validation, and printable poster export.
 */

import QRCode from 'qrcode';
import { db, SheetRow } from '../mockDb';
import { hashOTP } from '../crypto';

export interface TableQRRecord {
  tableId: string;
  tableNumber: string;
  capacity: number;
  status: string;
  token: string;
  qrUrl: string;
  isActive: boolean;
  generatedAt: string;
}

export class QRService {
  private static readonly QR_SETTING_PREFIX = 'TABLE_QR_';

  /**
   * Generates a deterministic or freshly rotated cryptographically-backed token for a specific table.
   */
  public static generateTableToken(tableId: string, forceRegenerate = false): string {
    const key = `${this.QR_SETTING_PREFIX}${tableId}`;
    const existing = db.findOne('Restaurant_Settings', (s) => s.Setting_Key === key);

    if (existing && existing.Setting_Value && !forceRegenerate) {
      try {
        const parsed = JSON.parse(existing.Setting_Value);
        if (parsed.token) return parsed.token;
      } catch {
        // Fallback to regenerate
      }
    }

    const entropy = `${tableId}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const token = `TBLQR_${tableId.replace(/[^A-Z0-9]/gi, '')}_${hashOTP(entropy).slice(0, 16).toUpperCase()}`;

    const record = {
      token,
      tableId,
      isActive: true,
      generatedAt: new Date().toISOString(),
    };

    if (existing) {
      db.updateRow('Restaurant_Settings', 'Setting_Key', key, {
        Setting_Value: JSON.stringify(record),
      });
    } else {
      db.insertRow('Restaurant_Settings', {
        Setting_Key: key,
        Setting_Value: JSON.stringify(record),
      });
    }

    return token;
  }

  /**
   * Retrieves QR metadata for all restaurant tables
   */
  public static getAllTableQRs(baseUrl = typeof window !== 'undefined' ? window.location.origin : 'https://savor-dinein.app'): TableQRRecord[] {
    const tables = db.getRows('Tables');
    const settings = db.getRows('Restaurant_Settings');

    return tables.map((tbl) => {
      const key = `${this.QR_SETTING_PREFIX}${tbl.Table_ID}`;
      const settingRow = settings.find((s) => s.Setting_Key === key);
      let token = '';
      let isActive = true;
      let generatedAt = '';

      if (settingRow?.Setting_Value) {
        try {
          const parsed = JSON.parse(settingRow.Setting_Value);
          token = parsed.token || '';
          isActive = parsed.isActive !== false;
          generatedAt = parsed.generatedAt || '';
        } catch {
          token = '';
        }
      }

      if (!token) {
        token = this.generateTableToken(tbl.Table_ID, false);
        generatedAt = new Date().toISOString();
      }

      return {
        tableId: tbl.Table_ID,
        tableNumber: tbl.Table_Number,
        capacity: Number(tbl.Seating_Capacity),
        status: tbl.Table_Status,
        token,
        qrUrl: `${baseUrl}/?scan-table=1&token=${encodeURIComponent(token)}`,
        isActive,
        generatedAt,
      };
    });
  }

  /**
   * Toggles active/disabled state for a table's QR code
   */
  public static toggleTableQR(tableId: string, isActive: boolean): { success: boolean; message: string } {
    const key = `${this.QR_SETTING_PREFIX}${tableId}`;
    const existing = db.findOne('Restaurant_Settings', (s) => s.Setting_Key === key);
    if (!existing) {
      this.generateTableToken(tableId, false);
    }
    const row = db.findOne('Restaurant_Settings', (s) => s.Setting_Key === key);
    const parsed = row ? JSON.parse(row.Setting_Value) : { token: this.generateTableToken(tableId), tableId };
    parsed.isActive = isActive;

    db.updateRow('Restaurant_Settings', 'Setting_Key', key, {
      Setting_Value: JSON.stringify(parsed),
    });

    return {
      success: true,
      message: `QR code for ${tableId} is now ${isActive ? 'Active' : 'Disabled'}.`,
    };
  }

  /**
   * Validates an incoming scanned QR token on the server and resolves its table.
   * Rejects invalid, manipulated, disabled, or physically unavailable tables.
   */
  public static resolveTableByToken(token: string): {
    success: boolean;
    message: string;
    table?: SheetRow;
    isAvailableForImmediateOrder?: boolean;
  } {
    if (!token || !token.startsWith('TBLQR_')) {
      return { success: false, message: 'Invalid or unrecognized table QR code.' };
    }

    const settings = db.findRows('Restaurant_Settings', (s) => s.Setting_Key.startsWith(this.QR_SETTING_PREFIX));
    let matchedRecord: any = null;

    for (const s of settings) {
      try {
        const parsed = JSON.parse(s.Setting_Value);
        if (parsed.token === token) {
          matchedRecord = parsed;
          break;
        }
      } catch {
        continue;
      }
    }

    // Fallback check if token not yet persisted in settings (e.g., direct initial seed)
    if (!matchedRecord) {
      return { success: false, message: 'QR token expired, regenerated, or not recognized.' };
    }

    if (matchedRecord.isActive === false) {
      return { success: false, message: 'This table QR code has been disabled by the administrator.' };
    }

    const table = db.findOne('Tables', (t) => t.Table_ID === matchedRecord.tableId);
    if (!table) {
      return { success: false, message: 'Associated table record no longer exists.' };
    }

    if (table.Table_Status === 'Unavailable') {
      return {
        success: false,
        message: `Table ${table.Table_Number} is currently marked Unavailable for maintenance.`,
        table,
        isAvailableForImmediateOrder: false,
      };
    }

    return {
      success: true,
      message: `Verified Table ${table.Table_Number} (Capacity: ${table.Seating_Capacity} guests).`,
      table,
      isAvailableForImmediateOrder: table.Table_Status === 'Available',
    };
  }

  /**
   * Generates a real scannable QR code Data URL (PNG) or SVG string for the given URL
   */
  public static async generateQRDataUrl(url: string, width = 400): Promise<string> {
    return QRCode.toDataURL(url, {
      width,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#292323',
        light: '#FFFFFF',
      },
    });
  }

  public static async generateQRSVG(url: string): Promise<string> {
    return QRCode.toString(url, {
      type: 'svg',
      margin: 2,
      errorCorrectionLevel: 'H',
      color: {
        dark: '#292323',
        light: '#FFFFFF',
      },
    });
  }
}

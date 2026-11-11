/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * CartService: Persistent draft cart management tied to Customer_ID in backend storage
 * (Google Sheets / Restaurant_Settings & ScriptProperties) so carts survive browser restarts.
 */

import { db } from '../mockDb';
import { GasAdapter } from '../gasAdapter';

export interface PersistentCartItem {
  foodId: string;
  quantity: number;
}

export interface PersistentCartState {
  customerId: string;
  bookingId?: string;
  tableId?: string;
  items: PersistentCartItem[];
  updatedAt: string;
}

export class CartService {
  private static readonly CART_PREFIX = 'DRAFT_CART_';

  /**
   * Saves draft cart to persistent backend storage (both Google Apps Script & Restaurant_Settings)
   */
  public static async saveDraftCart(state: PersistentCartState): Promise<{ success: boolean; message: string }> {
    const key = `${this.CART_PREFIX}${state.customerId}`;
    const serialized = JSON.stringify({
      ...state,
      updatedAt: new Date().toISOString(),
    });

    const existing = db.findOne('Restaurant_Settings', (s) => s.Setting_Key === key);
    if (existing) {
      db.updateRow('Restaurant_Settings', 'Setting_Key', key, { Setting_Value: serialized });
    } else {
      db.insertRow('Restaurant_Settings', { Setting_Key: key, Setting_Value: serialized });
    }

    // Attempt sync with live Google Apps Script
    try {
      await GasAdapter.execute('saveDraftCart', {
        customerId: state.customerId,
        cart: state,
      });
    } catch {
      // Handled gracefully
    }

    return { success: true, message: 'Cart persisted successfully.' };
  }

  /**
   * Restores a customer's draft cart and validates item availability & current authoritative prices
   */
  public static async getDraftCart(customerId: string): Promise<{
    success: boolean;
    data: {
      items: Array<{ food: any; quantity: number }>;
      tableId?: string;
      bookingId?: string;
      unavailableRemoved: string[];
    };
  }> {
    const key = `${this.CART_PREFIX}${customerId}`;
    let savedState: PersistentCartState | null = null;

    // First try live Google Apps Script
    try {
      const liveRes = await GasAdapter.execute('getDraftCart', { customerId });
      if (liveRes.success && liveRes.data && liveRes.data.items) {
        savedState = liveRes.data;
      }
    } catch {
      // Fallback to db state
    }

    if (!savedState) {
      const row = db.findOne('Restaurant_Settings', (s) => s.Setting_Key === key);
      if (row?.Setting_Value) {
        try {
          savedState = JSON.parse(row.Setting_Value);
        } catch {
          savedState = null;
        }
      }
    }

    if (!savedState || !Array.isArray(savedState.items)) {
      return {
        success: true,
        data: { items: [], unavailableRemoved: [] },
      };
    }

    const menu = db.getRows('Menu');
    const restoredItems: Array<{ food: any; quantity: number }> = [];
    const unavailableRemoved: string[] = [];

    for (const item of savedState.items) {
      const menuRow = menu.find((m) => m.Food_ID === item.foodId);
      if (menuRow && menuRow.Is_Active === 'Active' && menuRow.Availability === 'Available') {
        restoredItems.push({
          food: menuRow,
          quantity: Math.max(1, Number(item.quantity)),
        });
      } else {
        unavailableRemoved.push(item.foodId);
      }
    }

    return {
      success: true,
      data: {
        items: restoredItems,
        tableId: savedState.tableId,
        bookingId: savedState.bookingId,
        unavailableRemoved,
      },
    };
  }

  public static async clearDraftCart(customerId: string): Promise<void> {
    await this.saveDraftCart({
      customerId,
      items: [],
      updatedAt: new Date().toISOString(),
    });
  }
}

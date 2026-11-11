/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * QueueService: Implements FIFO Capacity-Fit selection, dynamic queue positions,
 * and called-table atomic protection.
 */

import { db, SheetRow } from '../mockDb';
import { TableService } from './TableService';

export interface QueueEntry {
  bookingId: string;
  customerId: string;
  customerName: string;
  partySize: number;
  queueJoinedAt: string;
  dynamicPosition: number;
  queueStatus: 'Waiting' | 'Called' | 'Seated';
  calledTableId?: string;
  calledAt?: string;
  recommendedTable?: SheetRow;
}

export class QueueService {
  /**
   * Adds a walk-in booking to the queue
   */
  public static joinQueue(bookingId: string, partySize: number): { success: boolean; message: string; position: number } {
    const booking = db.findOne('Bookings', (b) => b.Booking_ID === bookingId);
    if (!booking) {
      return { success: false, message: 'Booking not found.', position: 0 };
    }

    const now = new Date().toISOString();
    db.updateRow('Bookings', 'Booking_ID', bookingId, {
      Queue_Status: 'Waiting',
      Queue_Joined_At: now,
      Party_Size: partySize,
      Booking_Status: 'Confirmed',
    });

    const position = this.calculateDynamicPosition(bookingId);
    return {
      success: true,
      message: `You have joined the queue at position #${position}`,
      position,
    };
  }

  /**
   * Calculates dynamic FIFO queue position among currently waiting parties
   */
  public static calculateDynamicPosition(bookingId: string): number {
    const waitingBookings = db
      .findRows('Bookings', (b) => b.Queue_Status === 'Waiting')
      .sort((a, b) => new Date(a.Queue_Joined_At).getTime() - new Date(b.Queue_Joined_At).getTime());

    const idx = waitingBookings.findIndex((b) => b.Booking_ID === bookingId);
    return idx >= 0 ? idx + 1 : 0;
  }

  /**
   * Returns list of all active queue entries with capacity-fit table recommendations
   */
  public static getActiveQueue(): QueueEntry[] {
    const waitingOrCalled = db
      .findRows('Bookings', (b) => b.Queue_Status === 'Waiting' || b.Queue_Status === 'Called')
      .sort((a, b) => new Date(a.Queue_Joined_At).getTime() - new Date(b.Queue_Joined_At).getTime());

    const customers = db.getRows('Customers');
    const availableTables = db.findRows('Tables', (t) => t.Table_Status === 'Available');

    return waitingOrCalled.map((b, index) => {
      const customer = customers.find((c) => c.Customer_ID === b.Customer_ID);
      const partySize = Number(b.Party_Size) || 2;

      // Capacity-Fit Logic (Section 10.5):
      // Find the smallest available table that can fit this party size
      const suitableTables = availableTables
        .filter((t) => Number(t.Seating_Capacity) >= partySize)
        .sort((a, b) => Number(a.Seating_Capacity) - Number(b.Seating_Capacity));

      const recommendedTable = suitableTables[0];

      return {
        bookingId: b.Booking_ID,
        customerId: b.Customer_ID,
        customerName: customer?.Customer_Name || 'Guest',
        partySize,
        queueJoinedAt: b.Queue_Joined_At,
        dynamicPosition: index + 1,
        queueStatus: b.Queue_Status as 'Waiting' | 'Called' | 'Seated',
        calledTableId: b.Status_History_JSON ? this.extractCalledTable(b.Status_History_JSON) : undefined,
        recommendedTable,
      };
    });
  }

  /**
   * Staff calls a customer when a suitable table is ready.
   * Atomically protects the called table against double allocation.
   */
  public static callCustomer(
    bookingId: string,
    tableId: string
  ): { success: boolean; message: string } {
    const lockKey = `queue_call_${tableId}`;
    if (!db.acquireLock(lockKey)) {
      return { success: false, message: 'Table is currently locked by another operation.' };
    }

    try {
      const table = db.findOne('Tables', (t) => t.Table_ID === tableId);
      if (!table || table.Table_Status !== 'Available') {
        return { success: false, message: 'Selected table is not available for assignment.' };
      }

      const booking = db.findOne('Bookings', (b) => b.Booking_ID === bookingId);
      if (!booking) {
        return { success: false, message: 'Queue booking record not found.' };
      }

      // Mark Booking as Called and record table hold in Status_History_JSON
      let history: any[] = [];
      try {
        history = JSON.parse(booking.Status_History_JSON || '[]');
      } catch {
        history = [];
      }

      const callEvent = {
        action: 'CALLED',
        tableId,
        tableNumber: table.Table_Number,
        calledAt: new Date().toISOString(),
      };
      history.push(callEvent);

      db.updateRow('Bookings', 'Booking_ID', bookingId, {
        Queue_Status: 'Called',
        Status_History_JSON: JSON.stringify(history),
      });

      // Allocate table reservation hold immediately to protect it from double allocation
      TableService.allocateTable({
        bookingId,
        tableId,
        isImmediate: true,
      });

      return {
        success: true,
        message: `Customer called for Table ${table.Table_Number}. Table is held and protected.`,
      };
    } finally {
      db.releaseLock(lockKey);
    }
  }

  private static extractCalledTable(historyJson: string): string | undefined {
    try {
      const history = JSON.parse(historyJson);
      const call = history.reverse().find((h: any) => h.action === 'CALLED');
      return call ? call.tableNumber : undefined;
    } catch {
      return undefined;
    }
  }
}

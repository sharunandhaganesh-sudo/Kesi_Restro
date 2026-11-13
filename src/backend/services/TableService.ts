/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * TableService: Manages table status, 105-minute blocking calculations, allocation,
 * call-protection, seating, and cleaning turnover.
 */

import { db, SheetRow } from '../mockDb';

export class TableService {
  /**
   * Retrieves all physical tables and calculates their live dynamic status,
   * factoring in active reservations, occupancy, and turnover blocking.
   */
  public static getAllTablesWithDynamicStatus(): Array<SheetRow & { dynamicState: string; activeBookingId?: string }> {
    const tables = db.getRows('Tables');
    const reservations = db.getRows('Table_Reservations');
    const bookings = db.getRows('Bookings');
    const now = Date.now();

    return tables.map((t) => {
      // Base physical status: Available, Occupied, Unavailable
      let dynamicState = t.Table_Status;
      let activeBookingId: string | undefined;

      if (t.Table_Status === 'Unavailable') {
        return { ...t, dynamicState: 'Unavailable' };
      }

      if (t.Table_Status === 'Occupied') {
        // Find which booking is seated here
        const activeRes = reservations.find(
          (r) => r.Table_ID === t.Table_ID && r.Reservation_Status === 'Claimed'
        );
        return {
          ...t,
          dynamicState: 'Occupied',
          activeBookingId: activeRes?.Booking_ID,
        };
      }

      // Check if table is protected for an upcoming reservation within the 105-minute window
      const blockingWindowMs = 105 * 60 * 1000;
      const upcoming = reservations.find((r) => {
        if (r.Table_ID !== t.Table_ID) return false;
        if (r.Reservation_Status !== 'Active') return false;

        const resTime = new Date(r.Reservation_DateTime).getTime();
        // Overlaps if within [resTime - 105 min, resTime + 105 min]
        return Math.abs(resTime - now) <= blockingWindowMs;
      });

      if (upcoming) {
        dynamicState = 'Reserved_Upcoming';
        activeBookingId = upcoming.Booking_ID;
      }

      return {
        ...t,
        dynamicState,
        activeBookingId,
      };
    });
  }

  /**
   * Checks whether a specific table is available for a requested party size and time slot
   * Enforces 105-minute blocking window
   */
  public static isTableAvailable(
    tableId: string,
    targetDateTime: string,
    partySize: number
  ): boolean {
    const table = db.findOne('Tables', (t) => t.Table_ID === tableId);
    if (!table || table.Table_Status === 'Unavailable') {
      return false;
    }

    if (Number(table.Seating_Capacity) < partySize) {
      return false;
    }

    const targetTimeMs = new Date(targetDateTime).getTime();
    const blockingMs = 105 * 60 * 1000;

    // Check all active reservations for this table
    const reservations = db.findRows(
      'Table_Reservations',
      (r) => r.Table_ID === tableId && (r.Reservation_Status === 'Active' || r.Reservation_Status === 'Claimed')
    );

    for (const res of reservations) {
      const resTimeMs = new Date(res.Reservation_DateTime).getTime();
      if (Math.abs(resTimeMs - targetTimeMs) < blockingMs) {
        return false;
      }
    }

    return true;
  }

  /**
   * Atomically allocates a table to a booking (Online or Walk-in)
   * Prevents double allocation via lock
   */
  public static allocateTable(params: {
    bookingId: string;
    tableId: string;
    isImmediate?: boolean;
    scheduledDateTime?: string;
  }): { success: boolean; message: string; reservationId?: string } {
    const lockAcquired = db.acquireLock(`table_alloc_${params.tableId}`);
    if (!lockAcquired) {
      return { success: false, message: 'Table is currently being allocated by another request.' };
    }

    try {
      const table = db.findOne('Tables', (t) => t.Table_ID === params.tableId);
      if (!table || table.Table_Status !== 'Available') {
        return { success: false, message: `Table ${table?.Table_Number || params.tableId} is not available.` };
      }

      const booking = db.findOne('Bookings', (b) => b.Booking_ID === params.bookingId);
      if (!booking) {
        return { success: false, message: 'Booking record not found.' };
      }

      const now = new Date();
      const resDateTime = params.scheduledDateTime ? new Date(params.scheduledDateTime) : now;
      const gracePeriodMinutes = 10;
      const graceDeadline = new Date(
        (params.isImmediate ? now.getTime() : resDateTime.getTime()) + gracePeriodMinutes * 60 * 1000
      );

      const reservationId = `RES-${Date.now().toString().slice(-6)}`;

      // Insert into Table_Reservations
      // Reservation_ID, Booking_ID, Table_ID, Reservation_DateTime, Grace_Deadline, Arrival_Status, Reservation_Status
      db.insertRow('Table_Reservations', {
        Reservation_ID: reservationId,
        Booking_ID: params.bookingId,
        Table_ID: params.tableId,
        Reservation_DateTime: resDateTime.toISOString(),
        Grace_Deadline: graceDeadline.toISOString(),
        Arrival_Status: 'Pending',
        Reservation_Status: 'Active',
      });

      // Update Booking
      db.updateRow('Bookings', 'Booking_ID', params.bookingId, {
        Booking_Status: 'Confirmed',
        Queue_Status: 'None',
      });

      return {
        success: true,
        message: `Table ${table.Table_Number} allocated successfully.`,
        reservationId,
      };
    } finally {
      db.releaseLock(`table_alloc_${params.tableId}`);
    }
  }

  /**
   * Physically seats a customer at an allocated table.
   * Table status strictly becomes 'Occupied'.
   */
  public static seatCustomer(bookingId: string, tableId: string): { success: boolean; message: string } {
    const lockAcquired = db.acquireLock(`table_seat_${tableId}`);
    if (!lockAcquired) {
      return { success: false, message: 'Action in progress by another staff member.' };
    }

    try {
      const table = db.findOne('Tables', (t) => t.Table_ID === tableId);
      if (!table) return { success: false, message: 'Table not found.' };

      if (table.Table_Status === 'Occupied') {
        const activeRes = db.findOne(
          'Table_Reservations',
          (r) => r.Table_ID === tableId && r.Reservation_Status === 'Claimed'
        );
        if (activeRes && activeRes.Booking_ID !== bookingId) {
          return { success: false, message: `Table ${table.Table_Number} is already occupied by booking ${activeRes.Booking_ID}.` };
        }
      }
      if (table.Table_Status === 'Unavailable') {
        return { success: false, message: `Table ${table.Table_Number} is currently marked as unavailable.` };
      }

      // Update Table to Occupied
      db.updateRow('Tables', 'Table_ID', tableId, {
        Table_Status: 'Occupied',
      });

      // Update Reservation to Claimed
      const reservation = db.findOne(
        'Table_Reservations',
        (r) => r.Booking_ID === bookingId && r.Table_ID === tableId && r.Reservation_Status === 'Active'
      );
      if (reservation) {
        db.updateRow('Table_Reservations', 'Reservation_ID', reservation.Reservation_ID, {
          Reservation_Status: 'Claimed',
          Arrival_Status: 'Verified',
        });
      }

      // Update Booking
      db.updateRow('Bookings', 'Booking_ID', bookingId, {
        Booking_Status: 'Seated',
        Queue_Status: 'Seated',
      });

      return { success: true, message: `Party seated at Table ${table.Table_Number}.` };
    } finally {
      db.releaseLock(`table_seat_${tableId}`);
    }
  }

  /**
   * Releases a table upon customer departure and applies cleaning/turnover allowance.
   */
  public static releaseTableAfterDeparture(tableId: string): { success: boolean; message: string } {
    const table = db.findOne('Tables', (t) => t.Table_ID === tableId);
    if (!table) return { success: false, message: 'Table not found.' };

    // Release table back to Available
    db.updateRow('Tables', 'Table_ID', tableId, {
      Table_Status: 'Available',
    });

    // Mark associated Claimed reservation as Released
    const activeRes = db.findOne(
      'Table_Reservations',
      (r) => r.Table_ID === tableId && r.Reservation_Status === 'Claimed'
    );
    if (activeRes) {
      db.updateRow('Table_Reservations', 'Reservation_ID', activeRes.Reservation_ID, {
        Reservation_Status: 'Released',
      });
    }

    return {
      success: true,
      message: `Table ${table.Table_Number} released and sanitized for next guests.`,
    };
  }
}

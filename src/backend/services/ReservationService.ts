/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ReservationService: Table reservation records, 10-minute arrival grace deadline,
 * 15-minute staff verification window, and no-show expiration.
 */

import { db, SheetRow } from '../mockDb';
import { TableService } from './TableService';

export class ReservationService {
  /**
   * Creates an online table reservation
   */
  public static createReservation(params: {
    bookingId: string;
    tableId: string;
    reservationDateTime: string;
    partySize: number;
  }): { success: boolean; message: string; reservationId?: string } {
    const isAvail = TableService.isTableAvailable(
      params.tableId,
      params.reservationDateTime,
      params.partySize
    );

    if (!isAvail) {
      return {
        success: false,
        message: 'The selected table is not available for this time slot (105-minute window rule).',
      };
    }

    const resDate = new Date(params.reservationDateTime);
    const graceDeadline = new Date(resDate.getTime() + 10 * 60 * 1000); // 10 minutes grace
    const reservationId = `RES-${Date.now().toString().slice(-6)}`;

    db.insertRow('Table_Reservations', {
      Reservation_ID: reservationId,
      Booking_ID: params.bookingId,
      Table_ID: params.tableId,
      Reservation_DateTime: resDate.toISOString(),
      Grace_Deadline: graceDeadline.toISOString(),
      Arrival_Status: 'Pending',
      Reservation_Status: 'Active',
    });

    db.updateRow('Bookings', 'Booking_ID', params.bookingId, {
      Reservation_Date: resDate.toISOString().split('T')[0],
      Reservation_Time: resDate.toTimeString().split(' ')[0].slice(0, 5),
      Booking_Status: 'Confirmed',
    });

    return {
      success: true,
      message: 'Table reservation confirmed successfully.',
      reservationId,
    };
  }

  /**
   * Customer presses "I'm Arrived" button at the restaurant.
   * Validates ownership, lock, and 10-minute grace window.
   */
  public static customerConfirmArrival(
    bookingId: string,
    customerId?: string
  ): { success: boolean; message: string } {
    const lockKey = `arrival_${bookingId}`;
    if (!db.acquireLock(lockKey)) {
      return { success: false, message: 'Arrival update already in progress. Please try again.' };
    }

    try {
      const booking = db.findOne('Bookings', (b) => b.Booking_ID === bookingId);
      if (!booking) {
        return { success: false, message: 'Booking not found.' };
      }

      if (customerId && booking.Customer_ID !== customerId) {
        return { success: false, message: 'Unauthorized: You can only confirm arrival for your own booking.' };
      }

      if (['Completed', 'Cancelled', 'No_Show'].includes(booking.Booking_Status)) {
        return {
          success: false,
          message: `Cannot confirm arrival for a booking with status '${booking.Booking_Status}'.`,
        };
      }

      const reservation = db.findOne(
        'Table_Reservations',
        (r) => r.Booking_ID === bookingId && r.Reservation_Status === 'Active'
      );

      const now = Date.now();
      let history: any[] = [];
      try {
        history = JSON.parse(booking.Status_History_JSON || '[]');
      } catch {
        history = [];
      }

      if (reservation) {
        const graceDeadlineMs = new Date(reservation.Grace_Deadline).getTime();
        if (Number.isFinite(graceDeadlineMs) && now > graceDeadlineMs) {
          // Expired no-show; physical table status is never altered if occupied
          db.updateRow('Table_Reservations', 'Reservation_ID', reservation.Reservation_ID, {
            Reservation_Status: 'Expired',
            Arrival_Status: 'No_Show',
          });
          history.push({
            status: 'No_Show',
            changedAt: new Date(now).toISOString(),
            reason: '10-minute arrival grace period expired',
          });
          db.updateRow('Bookings', 'Booking_ID', bookingId, {
            Booking_Status: 'No_Show',
            Status_History_JSON: JSON.stringify(history),
          });
          return {
            success: false,
            message: 'The 10-minute grace period has expired. Your reservation was released as No-Show.',
          };
        }

        // Record digital arrival
        db.updateRow('Table_Reservations', 'Reservation_ID', reservation.Reservation_ID, {
          Arrival_Status: 'Arrived',
        });
      }

      history.push({
        status: 'Arrived',
        changedAt: new Date(now).toISOString(),
        reason: 'Customer confirmed digital arrival',
      });

      db.updateRow('Bookings', 'Booking_ID', bookingId, {
        Booking_Status: 'Arrived',
        Status_History_JSON: JSON.stringify(history),
      });

      return {
        success: true,
        message: 'Arrival confirmed! Please wait while host staff verifies your arrival (15-min window).',
      };
    } finally {
      db.releaseLock(lockKey);
    }
  }

  /**
   * Staff verifies customer physical arrival at the door/host station
   */
  public static staffVerifyArrival(
    bookingId: string,
    verifiedBy: string
  ): { success: boolean; message: string } {
    const booking = db.findOne('Bookings', (b) => b.Booking_ID === bookingId);
    if (!booking) {
      return { success: false, message: 'Booking record not found.' };
    }

    // Append to status history
    let history: any[] = [];
    try {
      history = JSON.parse(booking.Status_History_JSON || '[]');
    } catch {
      history = [];
    }
    history.push({
      action: 'ARRIVAL_VERIFIED',
      verifiedBy,
      verifiedAt: new Date().toISOString(),
    });

    db.updateRow('Bookings', 'Booking_ID', bookingId, {
      Booking_Status: 'Arrived',
      Status_History_JSON: JSON.stringify(history),
    });

    const reservation = db.findOne(
      'Table_Reservations',
      (r) => r.Booking_ID === bookingId && r.Reservation_Status === 'Active'
    );
    if (reservation) {
      db.updateRow('Table_Reservations', 'Reservation_ID', reservation.Reservation_ID, {
        Arrival_Status: 'Verified',
      });
    }

    return {
      success: true,
      message: 'Customer arrival verified by staff. Ready for seating and order authorization.',
    };
  }

  /**
   * Sweeps active reservations to automatically mark No-Show if grace deadline passed
   */
  public static processNoShows(): number {
    const now = Date.now();
    const activeReservations = db.findRows(
      'Table_Reservations',
      (r) => r.Reservation_Status === 'Active' && r.Arrival_Status === 'Pending'
    );

    let expiredCount = 0;
    for (const res of activeReservations) {
      if (new Date(res.Grace_Deadline).getTime() < now) {
        db.updateRow('Table_Reservations', 'Reservation_ID', res.Reservation_ID, {
          Reservation_Status: 'Expired',
          Arrival_Status: 'No_Show',
        });
        db.updateRow('Bookings', 'Booking_ID', res.Booking_ID, {
          Booking_Status: 'No_Show',
        });
        expiredCount++;
      }
    }
    return expiredCount;
  }
}

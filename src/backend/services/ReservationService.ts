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
   * Validates within 10-minute grace window.
   */
  public static customerConfirmArrival(bookingId: string): { success: boolean; message: string } {
    const booking = db.findOne('Bookings', (b) => b.Booking_ID === bookingId);
    if (!booking) {
      return { success: false, message: 'Booking not found.' };
    }

    const reservation = db.findOne(
      'Table_Reservations',
      (r) => r.Booking_ID === bookingId && r.Reservation_Status === 'Active'
    );

    const now = Date.now();

    if (reservation) {
      const graceDeadlineMs = new Date(reservation.Grace_Deadline).getTime();
      if (now > graceDeadlineMs) {
        // Expired no-show
        db.updateRow('Table_Reservations', 'Reservation_ID', reservation.Reservation_ID, {
          Reservation_Status: 'Expired',
          Arrival_Status: 'No_Show',
        });
        db.updateRow('Bookings', 'Booking_ID', bookingId, {
          Booking_Status: 'No_Show',
        });
        return {
          success: false,
          message: 'The 10-minute grace period has expired. Your reservation was released.',
        };
      }

      // Record digital arrival
      db.updateRow('Table_Reservations', 'Reservation_ID', reservation.Reservation_ID, {
        Arrival_Status: 'Arrived',
      });
    }

    db.updateRow('Bookings', 'Booking_ID', bookingId, {
      Booking_Status: 'Arrived',
    });

    return {
      success: true,
      message: 'Arrival confirmed! Please wait while host staff prepares your table (15-min verification window).',
    };
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

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * BookingService: Manages Booking_ID generation, Online & Walk-in visits,
 * booking history, and feedback.
 */

import { db, SheetRow } from '../mockDb';

export class BookingService {
  /**
   * Generates a unique server-side Booking_ID: BK-YYYYMMDD-XXXX
   */
  public static generateBookingId(): string {
    const d = new Date();
    const dateStr = d.toISOString().slice(0, 10).replace(/-/g, '');
    const rand = Math.floor(1000 + Math.random() * 9000);
    return `BK-${dateStr}-${rand}`;
  }

  /**
   * Creates a new booking record (Online or Walk-in)
   */
  public static createBooking(params: {
    customerId: string;
    visitType: 'Online' | 'Walk-in';
    partySize: number;
    reservationDate?: string;
    reservationTime?: string;
  }): { success: boolean; message: string; booking?: SheetRow } {
    const customer = db.findOne('Customers', (c) => c.Customer_ID === params.customerId);
    if (!customer) {
      return { success: false, message: 'Invalid customer identifier.' };
    }

    if (params.partySize < 1 || params.partySize > 20) {
      return { success: false, message: 'Party size must be between 1 and 20.' };
    }

    const bookingId = this.generateBookingId();
    const now = new Date();

    const bookingRow = db.insertRow('Bookings', {
      Booking_ID: bookingId,
      Customer_ID: params.customerId,
      Visit_Type: params.visitType,
      Booking_Date: now.toISOString().split('T')[0],
      Reservation_Date: params.reservationDate || now.toISOString().split('T')[0],
      Reservation_Time: params.reservationTime || now.toTimeString().slice(0, 5),
      Booking_Status: 'Confirmed',
      Party_Size: params.partySize,
      Queue_Status: params.visitType === 'Walk-in' ? 'Waiting' : 'None',
      Queue_Joined_At: params.visitType === 'Walk-in' ? now.toISOString() : '',
      Status_History_JSON: JSON.stringify([
        {
          status: 'Confirmed',
          changedAt: now.toISOString(),
          reason: `Initial ${params.visitType} booking created`,
        },
      ]),
      Feedback_Rating: '',
      Feedback_Comment: '',
      Feedback_Submitted_At: '',
    });

    return {
      success: true,
      message: `${params.visitType} booking created successfully.`,
      booking: bookingRow,
    };
  }

  /**
   * Submits feedback for a completed booking
   * Rule: exactly one feedback per completed Booking_ID
   */
  public static submitFeedback(params: {
    bookingId: string;
    customerId: string;
    rating: number; // 1 to 5
    comment?: string;
  }): { success: boolean; message: string } {
    const booking = db.findOne('Bookings', (b) => b.Booking_ID === params.bookingId);
    if (!booking) {
      return { success: false, message: 'Booking record not found.' };
    }

    // Ownership check
    if (booking.Customer_ID !== params.customerId) {
      return { success: false, message: 'Unauthorized: You can only review your own visit.' };
    }

    // Must be completed
    if (booking.Booking_Status !== 'Completed') {
      return { success: false, message: 'Feedback can only be submitted after dining is completed.' };
    }

    // Duplicate check
    if (booking.Feedback_Submitted_At) {
      return { success: false, message: 'Feedback has already been submitted for this visit.' };
    }

    if (params.rating < 1 || params.rating > 5) {
      return { success: false, message: 'Rating must be between 1 and 5 stars.' };
    }

    db.updateRow('Bookings', 'Booking_ID', params.bookingId, {
      Feedback_Rating: params.rating,
      Feedback_Comment: (params.comment || '').trim(),
      Feedback_Submitted_At: new Date().toISOString(),
    });

    return { success: true, message: 'Thank you for your rating and feedback!' };
  }

  /**
   * Retrieves full details for a customer booking including orders, bill and table
   */
  public static getBookingDetails(bookingId: string) {
    const booking = db.findOne('Bookings', (b) => b.Booking_ID === bookingId);
    if (!booking) return null;

    const customer = db.findOne('Customers', (c) => c.Customer_ID === booking.Customer_ID);
    const reservations = db.findRows('Table_Reservations', (r) => r.Booking_ID === bookingId);
    const orders = db.findRows('Orders', (o) => o.Booking_ID === bookingId);
    const orderItems = orders.flatMap((o) =>
      db.findRows('Order_Items', (oi) => oi.Order_ID === o.Order_ID)
    );
    const bill = db.findOne('Bills', (b) => b.Booking_ID === bookingId);
    const payment = bill ? db.findOne('Payments', (p) => p.Bill_ID === bill.Bill_ID) : null;

    return {
      booking,
      customer,
      reservations,
      orders,
      orderItems,
      bill,
      payment,
    };
  }

  /**
   * Retrieves all bookings for a specific customer (visit history)
   */
  public static getCustomerBookings(customerId: string) {
    return db
      .findRows('Bookings', (b) => b.Customer_ID === customerId)
      .sort((a, b) => new Date(b.Booking_Date).getTime() - new Date(a.Booking_Date).getTime());
  }

  /**
   * Retrieves all upcoming and active bookings for staff dashboard
   */
  public static getStaffDashboardBookings(): Array<SheetRow & {
    customerName: string;
    customerMobile: string;
    tableNumber?: string;
    tableId?: string;
    graceDeadline?: string;
    arrivalStatus?: string;
  }> {
    const bookings = db.getRows('Bookings');
    const customers = db.getRows('Customers');
    const reservations = db.getRows('Table_Reservations');
    const tables = db.getRows('Tables');

    return bookings
      .filter((b) => b.Booking_Status !== 'Cancelled')
      .map((b) => {
        const cust = customers.find((c) => c.Customer_ID === b.Customer_ID);
        const res = reservations.find((r) => r.Booking_ID === b.Booking_ID);
        const table = res ? tables.find((t) => t.Table_ID === res.Table_ID) : undefined;

        return {
          ...b,
          customerName: cust?.Customer_Name || 'Guest',
          customerMobile: cust?.Mobile_Number || '',
          tableNumber: table?.Table_Number,
          tableId: table?.Table_ID,
          graceDeadline: res?.Grace_Deadline,
          arrivalStatus: res?.Arrival_Status,
        };
      })
      .sort((a: any, b: any) => new Date(b.Booking_Date || 0).getTime() - new Date(a.Booking_Date || 0).getTime());
  }
}

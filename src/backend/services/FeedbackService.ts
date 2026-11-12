/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FeedbackService: Server-validated multi-rating Customer Feedback system
 * - Links feedback to Customer_ID, Booking_ID, and Order_ID
 * - Validates customer ownership & order served / visit completion
 * - Prevents duplicate feedback submissions per Order_ID (or Booking_ID)
 * - Powers Admin Feedback Management analytics (Overall, Food Quality, Service, Cleanliness)
 */

import { db, SheetRow } from '../mockDb';

export interface FeedbackSubmissionInput {
  orderId?: string;
  bookingId?: string;
  customerId: string;
  customerName?: string;
  overallRating: number;
  foodQualityRating: number;
  serviceRating: number;
  cleanlinessRating: number;
  comments?: string;
}

export interface FeedbackAnalyticsSummary {
  totalFeedbackCount: number;
  averageOverallRating: number;
  averageFoodQualityRating: number;
  averageServiceRating: number;
  averageCleanlinessRating: number;
  items: SheetRow[];
}

export class FeedbackService {
  private static isValidRating(val: any): boolean {
    const n = Number(val);
    return Number.isFinite(n) && n >= 1 && n <= 5;
  }

  /**
   * Validates ownership, order/visit completion, and duplicate rules, then persists feedback.
   */
  public static submitOrderFeedback(
    input: FeedbackSubmissionInput
  ): { success: boolean; message: string; feedback?: SheetRow } {
    const {
      orderId,
      bookingId,
      customerId,
      customerName,
      overallRating,
      foodQualityRating,
      serviceRating,
      cleanlinessRating,
      comments = '',
    } = input;

    if (!customerId) {
      return { success: false, message: 'Customer authentication is required to submit feedback.' };
    }

    if (
      !this.isValidRating(overallRating) ||
      !this.isValidRating(foodQualityRating) ||
      !this.isValidRating(serviceRating) ||
      !this.isValidRating(cleanlinessRating)
    ) {
      return {
        success: false,
        message: 'All ratings (Overall, Food Quality, Service, Cleanliness) must be between 1 and 5.',
      };
    }

    const order = orderId ? db.findOne('Orders', (o) => o.Order_ID === orderId) : null;
    const targetBookingId = bookingId || order?.Booking_ID;

    if (!targetBookingId) {
      return { success: false, message: 'A valid Order ID or Booking ID is required.' };
    }

    const booking = db.findOne('Bookings', (b) => b.Booking_ID === targetBookingId);
    if (!booking) {
      return { success: false, message: 'Associated booking record not found.' };
    }

    if (booking.Customer_ID !== customerId) {
      return {
        success: false,
        message: 'Unauthorized: You may only submit feedback for your own completed orders.',
      };
    }

    if (orderId && !order) {
      return { success: false, message: 'Order record not found.' };
    }

    const isOrderServed = order ? order.Order_Status === 'Served' : false;
    const isBookingCompleted = booking.Booking_Status === 'Completed';
    if (!isOrderServed && !isBookingCompleted) {
      return {
        success: false,
        message: 'Feedback can only be submitted once your order is served or dining visit is completed.',
      };
    }

    // Duplicate prevention check (strictly per Order_ID when provided, otherwise per Booking_ID)
    const duplicate = db.findOne('Feedback', (f) =>
      orderId ? f.Order_ID === orderId : f.Booking_ID === targetBookingId
    );
    if (duplicate || (!orderId && booking.Feedback_Submitted_At)) {
      return {
        success: false,
        message: orderId
          ? `Feedback has already been submitted for order ${orderId}.`
          : 'Feedback has already been submitted for this visit.',
      };
    }

    const customer = db.findOne('Customers', (c) => c.Customer_ID === customerId);
    const resolvedName = (customerName || customer?.Customer_Name || 'Valued Guest').trim();
    const submittedAt = new Date().toISOString();

    const record = db.insertRow('Feedback', {
      Feedback_ID: `FB-${Date.now().toString().slice(-6)}-${Math.floor(100 + Math.random() * 900)}`,
      Order_ID: orderId || '',
      Booking_ID: targetBookingId,
      Customer_ID: customerId,
      Customer_Name: resolvedName,
      Overall_Rating: Math.round(Number(overallRating)),
      Food_Quality_Rating: Math.round(Number(foodQualityRating)),
      Service_Rating: Math.round(Number(serviceRating)),
      Cleanliness_Rating: Math.round(Number(cleanlinessRating)),
      Comments: comments.trim(),
      Submitted_At: submittedAt,
    });

    // Keep Bookings feedback summary columns in sync for backward compatibility
    db.updateRow('Bookings', 'Booking_ID', targetBookingId, {
      Feedback_Rating: Math.round(Number(overallRating)),
      Feedback_Comment: comments.trim(),
      Feedback_Submitted_At: submittedAt,
    });

    return {
      success: true,
      message: 'Thank you! Your feedback has been saved permanently.',
      feedback: record,
    };
  }

  /**
   * Lists feedback for a specific customer (so UI knows which Order_IDs are already reviewed).
   */
  public static getCustomerFeedbacks(customerId: string): SheetRow[] {
    return db
      .findRows('Feedback', (f) => f.Customer_ID === customerId)
      .sort((a, b) => new Date(b.Submitted_At).getTime() - new Date(a.Submitted_At).getTime());
  }

  /**
   * Admin query with optional date (YYYY-MM-DD) & overall rating filter, plus dimensional averages.
   */
  public static getAdminFeedbackAnalytics(filters?: {
    date?: string;
    rating?: number;
  }): FeedbackAnalyticsSummary {
    const allRows = db.getRows('Feedback');
    const sorted = [...allRows].sort(
      (a, b) => new Date(b.Submitted_At || 0).getTime() - new Date(a.Submitted_At || 0).getTime()
    );

    const filtered = sorted.filter((row) => {
      if (filters?.date) {
        const rowDate = String(row.Submitted_At || '').slice(0, 10);
        if (rowDate !== filters.date) return false;
      }
      if (filters?.rating && Number(filters.rating) > 0) {
        if (Number(row.Overall_Rating) !== Number(filters.rating)) return false;
      }
      return true;
    });

    const avg = (field: string, source: SheetRow[]) => {
      if (source.length === 0) return 0;
      const total = source.reduce((acc, r) => acc + Number(r[field] || 0), 0);
      return Math.round((total / source.length) * 10) / 10;
    };

    return {
      totalFeedbackCount: filtered.length,
      averageOverallRating: avg('Overall_Rating', filtered),
      averageFoodQualityRating: avg('Food_Quality_Rating', filtered),
      averageServiceRating: avg('Service_Rating', filtered),
      averageCleanlinessRating: avg('Cleanliness_Rating', filtered),
      items: filtered,
    };
  }
}

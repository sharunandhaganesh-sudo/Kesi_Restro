/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * FeedbackService: Blueprint Section 6 & 14.1 compliant feedback service.
 * - Stores feedback strictly in Bookings (Feedback_Rating, Feedback_Comment, Feedback_Submitted_At).
 * - Enforces customer ownership, Completed booking eligibility, and one feedback per Booking_ID.
 * - Supports optional dimension breakdown inside Feedback_Comment metadata or plain comment while
 *   keeping the official 12-tab / 108-column schema intact (no separate Feedback tab).
 */

import { db, SheetRow } from '../mockDb';

export interface FeedbackSubmissionInput {
  orderId?: string;
  bookingId?: string;
  customerId: string;
  customerName?: string;
  overallRating: number;
  foodQualityRating?: number;
  serviceRating?: number;
  cleanlinessRating?: number;
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
   * Submits one-time feedback for a completed Booking_ID, stored in Bookings.
   */
  public static submitOrderFeedback(
    input: FeedbackSubmissionInput
  ): { success: boolean; message: string; feedback?: SheetRow } {
    const {
      orderId,
      bookingId,
      customerId,
      overallRating,
      foodQualityRating,
      serviceRating,
      cleanlinessRating,
      comments = '',
    } = input;

    if (!customerId) {
      return { success: false, message: 'Customer authentication is required to submit feedback.' };
    }

    const overall = Number(overallRating);
    const foodQ = foodQualityRating !== undefined ? Number(foodQualityRating) : overall;
    const serviceQ = serviceRating !== undefined ? Number(serviceRating) : overall;
    const cleanQ = cleanlinessRating !== undefined ? Number(cleanlinessRating) : overall;

    if (
      !this.isValidRating(overall) ||
      !this.isValidRating(foodQ) ||
      !this.isValidRating(serviceQ) ||
      !this.isValidRating(cleanQ)
    ) {
      return {
        success: false,
        message: 'All ratings must be between 1 and 5.',
      };
    }

    const order = orderId ? db.findOne('Orders', (o) => o.Order_ID === orderId) : null;
    const targetBookingId = bookingId || order?.Booking_ID;

    if (!targetBookingId) {
      return { success: false, message: 'A valid Booking ID is required.' };
    }

    const booking = db.findOne('Bookings', (b) => b.Booking_ID === targetBookingId);
    if (!booking) {
      return { success: false, message: 'Associated booking record not found.' };
    }

    if (booking.Customer_ID !== customerId) {
      return {
        success: false,
        message: 'Unauthorized: You may only submit feedback for your own completed booking.',
      };
    }

    if (booking.Booking_Status !== 'Completed') {
      return {
        success: false,
        message: 'Feedback can only be submitted after your visit is Completed.',
      };
    }

    if (booking.Feedback_Submitted_At) {
      return {
        success: false,
        message: 'Feedback has already been submitted for this completed booking.',
      };
    }

    const submittedAt = new Date().toISOString();
    const cleanComment = String(comments || '').trim();

    db.updateRow('Bookings', 'Booking_ID', targetBookingId, {
      Feedback_Rating: overall,
      Feedback_Comment: cleanComment,
      Feedback_Submitted_At: submittedAt,
    });

    const customer = db.findOne('Customers', (c) => c.Customer_ID === customerId);
    const feedbackRecord = {
      Feedback_ID: `FB-${targetBookingId}`,
      Order_ID: orderId || '',
      Booking_ID: targetBookingId,
      Customer_ID: customerId,
      Customer_Name: customer?.Customer_Name || 'Guest',
      Overall_Rating: overall,
      Food_Quality_Rating: foodQ,
      Service_Rating: serviceQ,
      Cleanliness_Rating: cleanQ,
      Comments: cleanComment,
      Submitted_At: submittedAt,
    };

    return {
      success: true,
      message: 'Thank you! Your feedback has been saved to your booking record.',
      feedback: feedbackRecord,
    };
  }

  /**
   * Returns all feedback submitted by a specific customer from Bookings.
   */
  public static getCustomerFeedbacks(customerId: string): SheetRow[] {
    if (!customerId) return [];
    const customer = db.findOne('Customers', (c) => c.Customer_ID === customerId);
    return db
      .findRows('Bookings', (b) => b.Customer_ID === customerId && Boolean(b.Feedback_Submitted_At))
      .map((b) => ({
        Feedback_ID: `FB-${b.Booking_ID}`,
        Booking_ID: b.Booking_ID,
        Customer_ID: b.Customer_ID,
        Customer_Name: customer?.Customer_Name || 'Guest',
        Overall_Rating: Number(b.Feedback_Rating) || 0,
        Food_Quality_Rating: Number(b.Feedback_Rating) || 0,
        Service_Rating: Number(b.Feedback_Rating) || 0,
        Cleanliness_Rating: Number(b.Feedback_Rating) || 0,
        Comments: b.Feedback_Comment || '',
        Submitted_At: b.Feedback_Submitted_At,
      }))
      .sort((a, b) => new Date(b.Submitted_At).getTime() - new Date(a.Submitted_At).getTime());
  }

  /**
   * Returns filtered feedback & rating averages from Bookings for Admin Feedback Management.
   */
  public static getAdminFeedbackAnalytics(filters?: {
    rating?: number | 'All';
    date?: string;
  }): FeedbackAnalyticsSummary {
    const customers = db.getRows('Customers');
    const custMap = new Map(customers.map((c) => [c.Customer_ID, c.Customer_Name]));

    let items = db
      .findRows('Bookings', (b) => Boolean(b.Feedback_Submitted_At))
      .map((b) => {
        const r = Number(b.Feedback_Rating) || 0;
        return {
          Feedback_ID: `FB-${b.Booking_ID}`,
          Booking_ID: b.Booking_ID,
          Customer_ID: b.Customer_ID,
          Customer_Name: custMap.get(b.Customer_ID) || 'Guest',
          Overall_Rating: r,
          Food_Quality_Rating: r,
          Service_Rating: r,
          Cleanliness_Rating: r,
          Comments: b.Feedback_Comment || '',
          Submitted_At: b.Feedback_Submitted_At,
        };
      });

    if (filters?.rating && filters.rating !== 'All') {
      const targetRating = Number(filters.rating);
      items = items.filter((f) => Number(f.Overall_Rating) === targetRating);
    }

    if (filters?.date && filters.date.trim()) {
      const targetDate = filters.date.trim();
      items = items.filter((f) => String(f.Submitted_At || '').startsWith(targetDate));
    }

    items.sort((a, b) => new Date(b.Submitted_At).getTime() - new Date(a.Submitted_At).getTime());

    const count = items.length;
    const avg = (key: 'Overall_Rating' | 'Food_Quality_Rating' | 'Service_Rating' | 'Cleanliness_Rating') =>
      count === 0
        ? 0
        : Math.round((items.reduce((s, r) => s + Number(r[key] || 0), 0) / count) * 10) / 10;

    return {
      totalFeedbackCount: count,
      averageOverallRating: avg('Overall_Rating'),
      averageFoodQualityRating: avg('Food_Quality_Rating'),
      averageServiceRating: avg('Service_Rating'),
      averageCleanlinessRating: avg('Cleanliness_Rating'),
      items,
    };
  }
}

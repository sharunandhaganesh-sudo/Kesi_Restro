/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * ReportService: Generates comprehensive executive analytics for the Admin Website
 * Calculates metrics strictly from saved database records, distinguishing verified revenue
 * from pending UPI references and completed refunds.
 */

import { db } from '../mockDb';

export interface AdminDashboardMetrics {
  totalVisits: number;
  onlineVisitsCount: number;
  walkinVisitsCount: number;
  grossBillTotals: number;
  verifiedPaidRevenue: number;
  pendingVerificationRevenue: number;
  completedRefundsTotal: number;
  activeQueueCount: number;
  tableUtilizationPercent: number;
  totalTables: number;
  occupiedTablesCount: number;
  averageRating: number;
  totalFeedbackCount: number;
  categorySales: Record<string, number>;
  topSellingItems: Array<{ foodName: string; quantity: number; revenue: number }>;
}

export class ReportService {
  public static getAdminMetrics(): AdminDashboardMetrics {
    const bookings = db.getRows('Bookings');
    const bills = db.getRows('Bills');
    const payments = db.getRows('Payments');
    const tables = db.getRows('Tables');
    const orderItems = db.getRows('Order_Items');
    const menu = db.getRows('Menu');

    // 1. Visit Counts
    const totalVisits = bookings.length;
    const onlineVisitsCount = bookings.filter((b) => b.Visit_Type === 'Online').length;
    const walkinVisitsCount = bookings.filter((b) => b.Visit_Type === 'Walk-in').length;

    // 2. Financial Metrics
    const grossBillTotals = bills.reduce((sum, b) => sum + Number(b.Grand_Total || 0), 0);

    const verifiedPaidRevenue = payments
      .filter((p) => p.Payment_Status === 'Paid')
      .reduce((sum, p) => sum + Number(p.Amount_Paid || 0), 0);

    const pendingVerificationRevenue = payments
      .filter((p) => p.Payment_Status === 'Pending_Verification')
      .reduce((sum, p) => sum + Number(p.Amount_Paid || 0), 0);

    const completedRefundsTotal = payments
      .filter((p) => p.Refund_Status === 'Completed')
      .reduce((sum, p) => sum + Number(p.Completed_Refund_Amount || 0), 0);

    // 3. Queue & Table Utilization
    const activeQueueCount = bookings.filter((b) => b.Queue_Status === 'Waiting').length;
    const totalTables = tables.length;
    const occupiedTablesCount = tables.filter((t) => t.Table_Status === 'Occupied').length;
    const tableUtilizationPercent = totalTables > 0 ? Math.round((occupiedTablesCount / totalTables) * 100) : 0;

    // 4. Feedback & Ratings
    const feedbackList = bookings.filter((b) => b.Feedback_Rating && Number(b.Feedback_Rating) > 0);
    const totalFeedbackCount = feedbackList.length;
    const averageRating =
      totalFeedbackCount > 0
        ? Math.round(
            (feedbackList.reduce((sum, b) => sum + Number(b.Feedback_Rating), 0) / totalFeedbackCount) * 10
          ) / 10
        : 5.0;

    // 5. Item & Category Sales
    const categorySales: Record<string, number> = {};
    const itemMap = new Map<string, { foodName: string; quantity: number; revenue: number }>();

    for (const item of orderItems) {
      if (item.Item_Status === 'Cancelled') continue;
      const food = menu.find((m) => m.Food_ID === item.Food_ID);
      const category = food?.Category || 'Other';
      const subtotal = Number(item.Subtotal || 0);
      const qty = Number(item.Quantity || 0);

      categorySales[category] = (categorySales[category] || 0) + subtotal;

      const existing = itemMap.get(item.Food_ID) || {
        foodName: food?.Food_Name || item.Food_ID,
        quantity: 0,
        revenue: 0,
      };
      existing.quantity += qty;
      existing.revenue += subtotal;
      itemMap.set(item.Food_ID, existing);
    }

    const topSellingItems = Array.from(itemMap.values())
      .sort((a, b) => b.revenue - a.revenue)
      .slice(0, 5);

    return {
      totalVisits,
      onlineVisitsCount,
      walkinVisitsCount,
      grossBillTotals,
      verifiedPaidRevenue,
      pendingVerificationRevenue,
      completedRefundsTotal,
      activeQueueCount,
      tableUtilizationPercent,
      totalTables,
      occupiedTablesCount,
      averageRating,
      totalFeedbackCount,
      categorySales,
      topSellingItems,
    };
  }
}

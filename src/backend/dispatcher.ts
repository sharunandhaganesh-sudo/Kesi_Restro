/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Central Backend Request Dispatcher (representing Code.gs)
 * Coordinates authentication, session validation, role authorization, action dispatching,
 * and safe standardized error handling.
 */

import { AuthService } from './services/AuthService';
import { TableService } from './services/TableService';
import { QueueService } from './services/QueueService';
import { ReservationService } from './services/ReservationService';
import { BookingService } from './services/BookingService';
import { OrderService, KitchenService } from './services/OrderService';
import { BillingService } from './services/BillingService';
import { PaymentService, RefundService } from './services/PaymentService';
import { ReportService } from './services/ReportService';
import { AdminManagementService } from './services/AdminManagementService';
import { EmailService } from './services/EmailService';
import { QRService } from './services/QRService';
import { CartService } from './services/CartService';
import { GasAdapter } from './gasAdapter';
import { db } from './mockDb';
import { verifySchemaIntegrity, TOTAL_COLUMNS_COUNT } from './schema';

export interface BackendRequest<T = any> {
  action: string;
  payload?: T;
  sessionId?: string;
}

export interface BackendResponse<T = any> {
  success: boolean;
  data?: T;
  message?: string;
  error?: {
    code: string;
    message: string;
  };
}

export class RequestDispatcher {
  /**
   * Main dispatch entry point for all five websites
   */
  public static async dispatch(request: BackendRequest): Promise<BackendResponse> {
    const { action, payload = {}, sessionId } = request;

    try {
      // 1. Whitelist of Public Actions (No session required)
      switch (action) {
        case 'getPublicRestaurantInfo':
          return await this.getPublicRestaurantInfo();

        case 'getPublicMenu':
          return await this.getPublicMenu();

        case 'testEmailDelivery':
          return {
            success: true,
            data: EmailService.testEmailDelivery(payload.recipientEmail || payload.email),
            message: 'Email delivery test executed.',
          };

        case 'requestCustomerOTP':
          return {
            success: true,
            data: await AuthService.requestCustomerOTP(payload),
          };

        case 'demoQuickLoginCustomer': {
          const res = AuthService.demoQuickLoginCustomer(payload.mobileNumber);
          return res.success
            ? { success: true, data: res.session, message: res.message }
            : { success: false, error: { code: 'AUTH_FAILED', message: res.message } };
        }

        case 'verifyCustomerOTP': {
          const res = AuthService.verifyCustomerOTP(payload);
          if (!res.success) {
            return {
              success: false,
              error: { code: 'AUTH_FAILED', message: res.message },
            };
          }
          // Persist/sync customer profile to live Google Sheets
          GasAdapter.execute('verifyCustomerOTP', {
            mobileNumber: payload.mobileNumber,
            customerName: res.session?.customerName || payload.customerName,
            email: res.session?.email || payload.email,
          }).catch(() => {});

          return {
            success: true,
            data: res.session,
            message: res.message,
          };
        }

        case 'loginEmployee': {
          const res = AuthService.loginEmployee(payload);
          if (!res.success) {
            return {
              success: false,
              error: { code: 'AUTH_FAILED', message: res.message },
            };
          }
          return {
            success: true,
            data: res.session,
            message: res.message,
          };
        }

        case 'verifyDatabaseSchema': {
          const liveCheck = await GasAdapter.verifyLiveDatabaseSchema();
          const headers = db.getSheetHeaders();
          const check = verifySchemaIntegrity(headers);
          return {
            success: liveCheck.success ? liveCheck.data?.isFullyValid : check.isValid,
            data: {
              ...check,
              liveSpreadsheetCheck: liveCheck.data || null,
              liveError: liveCheck.error || null,
              totalColumns: TOTAL_COLUMNS_COUNT,
              totalTabs: Object.keys(headers).length,
            },
            message: liveCheck.success
              ? liveCheck.data?.isFullyValid
                ? 'Live Google Spreadsheet verified: 12 tabs and 108 columns match.'
                : 'Live Google Spreadsheet requires initialization or schema sync.'
              : 'Local schema verified (Live GAS unreachable).',
          };
        }

        case 'resolveTableQR': {
          const res = QRService.resolveTableByToken(payload.token);
          return res.success
            ? { success: true, data: res, message: res.message }
            : { success: false, error: { code: 'QR_INVALID', message: res.message }, data: res };
        }
      }

      // 2. Session Validation for Protected Actions
      if (!sessionId) {
        return {
          success: false,
          error: { code: 'UNAUTHORIZED', message: 'Authentication session required.' },
        };
      }

      const sessionCheck = AuthService.validateSession(sessionId);
      if (!sessionCheck.isValid) {
        return {
          success: false,
          error: { code: 'SESSION_EXPIRED', message: 'Session has expired. Please log in again.' },
        };
      }

      const userRole = sessionCheck.customer ? 'Customer' : sessionCheck.user?.role;
      const actorName = sessionCheck.customer
        ? sessionCheck.customer.customerName
        : sessionCheck.user?.userName || 'System';

      // 3. Customer Role Protected Actions
      if (userRole === 'Customer') {
        const customerId = sessionCheck.customer!.customerId;

        switch (action) {
          case 'createBooking': {
            const res = BookingService.createBooking({
              customerId,
              visitType: payload.visitType,
              partySize: Number(payload.partySize),
              reservationDate: payload.reservationDate,
              reservationTime: payload.reservationTime,
            });
            if (res.success) {
              GasAdapter.execute('createBooking', {
                customerId,
                visitType: payload.visitType,
                partySize: Number(payload.partySize),
                reservationDate: payload.reservationDate,
                reservationTime: payload.reservationTime,
                tableId: payload.tableId,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, data: res.booking, message: res.message }
              : { success: false, error: { code: 'BOOKING_FAILED', message: res.message } };
          }

          case 'reserveTable': {
            const res = ReservationService.createReservation({
              bookingId: payload.bookingId,
              tableId: payload.tableId,
              reservationDateTime: payload.reservationDateTime,
              partySize: Number(payload.partySize),
            });
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'RESERVATION_FAILED', message: res.message } };
          }

          case 'joinQueue': {
            const res = QueueService.joinQueue(payload.bookingId, Number(payload.partySize));
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'QUEUE_FAILED', message: res.message } };
          }

          case 'confirmArrival': {
            const res = ReservationService.customerConfirmArrival(payload.bookingId);
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'ARRIVAL_FAILED', message: res.message } };
          }

          case 'placeOrder': {
            const res = OrderService.createOrder({
              bookingId: payload.bookingId,
              items: payload.items,
              createdByRole: 'Customer',
            });
            if (res.success) {
              await CartService.clearDraftCart(customerId);
              GasAdapter.execute('placeOrder', {
                bookingId: payload.bookingId,
                items: payload.items,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'ORDER_FAILED', message: res.message } };
          }

          case 'saveDraftCart': {
            const res = await CartService.saveDraftCart({
              customerId,
              bookingId: payload.bookingId,
              tableId: payload.tableId,
              items: payload.items || [],
              updatedAt: new Date().toISOString(),
            });
            return { success: true, message: res.message };
          }

          case 'getDraftCart': {
            return await CartService.getDraftCart(customerId);
          }

          case 'getBookingDetails': {
            const details = BookingService.getBookingDetails(payload.bookingId);
            if (!details || details.booking.Customer_ID !== customerId) {
              return { success: false, error: { code: 'FORBIDDEN', message: 'Access denied.' } };
            }
            return { success: true, data: details };
          }

          case 'getCustomerHistory': {
            const history = BookingService.getCustomerBookings(customerId);
            return { success: true, data: history };
          }

          case 'submitUPIPayment': {
            const res = PaymentService.submitUPIReference({
              billId: payload.billId,
              transactionReference: payload.transactionReference,
              amountPaid: Number(payload.amountPaid),
              submittedBy: actorName,
            });
            if (res.success) {
              GasAdapter.execute('submitUPIPayment', {
                billId: payload.billId,
                amount: Number(payload.amountPaid),
                utr: payload.transactionReference,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'PAYMENT_FAILED', message: res.message } };
          }

          case 'submitFeedback': {
            const res = BookingService.submitFeedback({
              bookingId: payload.bookingId,
              customerId,
              rating: Number(payload.rating),
              comment: payload.comment,
            });
            if (res.success) {
              GasAdapter.execute('submitFeedback', {
                bookingId: payload.bookingId,
                rating: Number(payload.rating),
                comment: payload.comment,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'FEEDBACK_FAILED', message: res.message } };
          }
        }
      }

      // 4. Staff / Admin Protected Actions
      if (userRole === 'Staff' || userRole === 'Admin') {
        switch (action) {
          case 'getStaffDashboard': {
            const bookings = BookingService.getStaffDashboardBookings();
            const queue = QueueService.getActiveQueue();
            const tables = TableService.getAllTablesWithDynamicStatus();
            const pendingPayments = PaymentService.getPendingPayments();
            const allOrders = db.getRows('Orders');
            const unverifiedArrivals = bookings.filter(
              (b) => b.Booking_Status === 'Arrived' && b.arrivalStatus !== 'Verified'
            );

            return {
              success: true,
              data: {
                bookings,
                queue,
                tables,
                pendingPayments,
                allOrders,
                unverifiedArrivals,
              },
            };
          }

          case 'verifyCustomerArrival': {
            const res = ReservationService.staffVerifyArrival(payload.bookingId, actorName);
            if (res.success) GasAdapter.execute('verifyCustomerArrival', { bookingId: payload.bookingId }).catch(() => {});
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'VERIFICATION_FAILED', message: res.message } };
          }

          case 'callQueueCustomer': {
            const res = QueueService.callCustomer(payload.bookingId, payload.tableId);
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'CALL_FAILED', message: res.message } };
          }

          case 'allocateTable': {
            const res = TableService.allocateTable({
              bookingId: payload.bookingId,
              tableId: payload.tableId,
              isImmediate: true,
            });
            if (res.success) GasAdapter.execute('allocateTable', { tableId: payload.tableId }).catch(() => {});
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'ALLOCATION_FAILED', message: res.message } };
          }

          case 'seatCustomer': {
            const res = TableService.seatCustomer(payload.bookingId, payload.tableId);
            if (res.success) GasAdapter.execute('seatCustomer', { bookingId: payload.bookingId, tableId: payload.tableId }).catch(() => {});
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'SEAT_FAILED', message: res.message } };
          }

          case 'authorizeOrder': {
            const res = OrderService.authorizeOrder(payload.orderId, actorName);
            if (res.success) GasAdapter.execute('authorizeOrder', { orderId: payload.orderId, authorizedBy: actorName }).catch(() => {});
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'AUTH_ORDER_FAILED', message: res.message } };
          }

          case 'generateBill': {
            const res = BillingService.generateFinalBill({
              bookingId: payload.bookingId,
              discountPercent: Number(payload.discountPercent) || 0,
              discountReason: payload.discountReason,
              staffUserName: actorName,
            });
            if (res.success && res.bill) {
              GasAdapter.execute('generateBill', {
                bookingId: payload.bookingId,
                subtotal: res.bill.Subtotal,
                taxAmount: res.bill.Tax_Amount,
                discount: res.bill.Discount,
                grandTotal: res.bill.Grand_Total,
                discountReason: res.bill.Discount_Reason,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, data: res.bill, message: res.message }
              : { success: false, error: { code: 'BILL_FAILED', message: res.message } };
          }

          case 'verifyPaymentReceipt': {
            const res = PaymentService.staffVerifyPaymentReceipt({
              paymentId: payload.paymentId,
              staffUserName: actorName,
              isConfirmed: Boolean(payload.isConfirmed),
              rejectionReason: payload.rejectionReason,
            });
            if (res.success) {
              GasAdapter.execute('verifyPaymentReceipt', {
                paymentId: payload.paymentId,
                isConfirmed: Boolean(payload.isConfirmed),
                verifiedBy: actorName,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'PAYMENT_VERIFY_FAILED', message: res.message } };
          }

          case 'confirmDeparture': {
            const res = PaymentService.confirmDepartureAndReleaseTable({
              bookingId: payload.bookingId,
              tableId: payload.tableId,
              staffUserName: actorName,
            });
            if (res.success) {
              GasAdapter.execute('confirmDeparture', {
                bookingId: payload.bookingId,
                tableId: payload.tableId,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'DEPARTURE_FAILED', message: res.message } };
          }

          case 'requestRefund': {
            const res = RefundService.requestRefund({
              paymentId: payload.paymentId,
              requestedAmount: Number(payload.requestedAmount),
              reason: payload.reason,
              staffUserName: actorName,
            });
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'REFUND_REQUEST_FAILED', message: res.message } };
          }

          case 'modifyOrderItem': {
            const res = OrderService.cancelOrReplaceItem({
              orderItemId: payload.orderItemId,
              action: payload.action,
              reason: payload.reason,
              replacementFoodId: payload.replacementFoodId,
              changedBy: actorName,
            });
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'ITEM_MOD_FAILED', message: res.message } };
          }
        }
      }

      // 5. Kitchen Protected Actions
      if (userRole === 'Kitchen' || userRole === 'Admin') {
        switch (action) {
          case 'getKitchenQueue': {
            const queue = KitchenService.getKitchenQueue();
            return { success: true, data: queue };
          }

          case 'updateKitchenPreparationStatus': {
            const res = KitchenService.updatePreparationStatus({
              orderId: payload.orderId,
              newStatus: payload.newStatus,
              kitchenUserName: actorName,
              reason: payload.reason,
            });
            if (res.success) {
              GasAdapter.execute('updateKitchenPreparationStatus', {
                orderId: payload.orderId,
                newStatus: payload.newStatus,
                actorName,
                reason: payload.reason,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'KITCHEN_UPDATE_FAILED', message: res.message } };
          }
        }
      }

      // 6. Admin Only Actions
      if (userRole === 'Admin') {
        switch (action) {
          case 'getAdminDashboard': {
            const metrics = ReportService.getAdminMetrics();
            const users = AdminManagementService.getAllUsers();
            const refunds = RefundService.getAllRefundRequests();
            const menu = db.getRows('Menu');
            const tables = TableService.getAllTablesWithDynamicStatus();
            const settings = AdminManagementService.getSettings();

            return {
              success: true,
              data: {
                metrics,
                users,
                refunds,
                menu,
                tables,
                settings,
              },
            };
          }

          case 'createUserAccount': {
            const res = AdminManagementService.createUser({
              userName: payload.userName,
              email: payload.email,
              role: payload.role,
              password: payload.password,
              adminUserName: actorName,
            });
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'USER_CREATE_FAILED', message: res.message } };
          }

          case 'toggleUserAccountStatus': {
            const res = AdminManagementService.toggleUserStatus(payload.userId);
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'USER_TOGGLE_FAILED', message: res.message } };
          }

          case 'upsertMenuItem': {
            const res = AdminManagementService.upsertMenuItem(payload.item);
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'MENU_UPDATE_FAILED', message: res.message } };
          }

          case 'addTable': {
            const res = AdminManagementService.addTable(payload);
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'TABLE_ADD_FAILED', message: res.message } };
          }

          case 'toggleTableMaintenance': {
            const res = AdminManagementService.toggleTableMaintenance(payload.tableId);
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'TABLE_TOGGLE_FAILED', message: res.message } };
          }

          case 'reviewRefund': {
            const res = RefundService.adminReviewRefund({
              paymentId: payload.paymentId,
              adminUserName: actorName,
              decision: payload.decision,
              rejectionReason: payload.rejectionReason,
            });
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'REFUND_REVIEW_FAILED', message: res.message } };
          }

          case 'completeManualRefund': {
            const res = RefundService.completeManualRefund({
              paymentId: payload.paymentId,
              completedAmount: Number(payload.completedAmount),
              refundReference: payload.refundReference,
              completedByUserName: actorName,
            });
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'REFUND_COMPLETE_FAILED', message: res.message } };
          }

          case 'updateSetting': {
            const res = AdminManagementService.updateSetting(payload.key, payload.value);
            return { success: true, message: res.message };
          }

          case 'getAllTableQRs': {
            const qrs = QRService.getAllTableQRs(payload.baseUrl);
            return { success: true, data: qrs };
          }

          case 'regenerateTableQR': {
            const token = QRService.generateTableToken(payload.tableId, true);
            return { success: true, data: { token }, message: `New QR token generated for ${payload.tableId}.` };
          }

          case 'toggleTableQR': {
            const res = QRService.toggleTableQR(payload.tableId, Boolean(payload.isActive));
            return { success: true, message: res.message };
          }

          case 'verifyPaymentReceipt': {
            const res = PaymentService.staffVerifyPaymentReceipt({
              paymentId: payload.paymentId,
              staffUserName: actorName,
              isConfirmed: Boolean(payload.isConfirmed),
              rejectionReason: payload.rejectionReason,
            });
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'PAYMENT_VERIFY_FAILED', message: res.message } };
          }
        }
      }

      // Logout works for any authenticated session
      if (action === 'logout') {
        AuthService.logout(sessionId);
        return { success: true, message: 'Logged out successfully.' };
      }

      // Unknown action or role forbidden
      return {
        success: false,
        error: {
          code: 'ACTION_FORBIDDEN',
          message: `Action '${action}' is unknown or not permitted for role '${userRole}'.`,
        },
      };
    } catch (err: any) {
      console.error(`[Dispatcher Error] ${action}:`, err);
      return {
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'An unexpected server error occurred. Please try again.',
        },
      };
    }
  }

  private static async getPublicRestaurantInfo(): Promise<BackendResponse> {
    const liveRes = await GasAdapter.execute('getPublicRestaurantInfo');
    if (liveRes.success && liveRes.data) {
      return liveRes;
    }

    const settings = AdminManagementService.getSettings();
    const tables = db.getRows('Tables');
    const availableCount = tables.filter((t) => t.Table_Status === 'Available').length;

    return {
      success: true,
      data: {
        name: settings.RESTAURANT_NAME || 'Savor Dine-In Restaurant',
        address: '142 Grand Heritage Boulevard, Chennai',
        phone: '+91 98765 43210',
        openingHours: `${settings.OPENING_TIME || '11:00 AM'} - ${settings.CLOSING_TIME || '11:00 PM'}`,
        upiId: settings.UPI_ID || 'kesikam2006@oksbi',
        upiPayeeName: settings.UPI_PAYEE_NAME || 'Kesika M',
        availableTablesCount: availableCount,
        totalTablesCount: tables.length,
      },
    };
  }

  private static async getPublicMenu(): Promise<BackendResponse> {
    const liveRes = await GasAdapter.execute('getPublicMenu');
    if (liveRes.success && liveRes.data) {
      return liveRes;
    }

    const items = db.findRows('Menu', (m) => m.Is_Active === 'Active');
    const tables = db.findRows('Tables', (t) => t.Table_Status === 'Available');

    return {
      success: true,
      data: {
        menu: items,
        availableTables: tables,
      },
    };
  }
}

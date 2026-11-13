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
import { FeedbackService } from './services/FeedbackService';
import { GasAdapter } from './gasAdapter';
import { db } from './mockDb';
import { verifySchemaIntegrity, TOTAL_COLUMNS_COUNT } from './schema';
import { notificationHub } from '../frontend/services/notificationHub';

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
            // Fallback to live GAS OTP verification in browser (handles page reloads & custom GAS ScriptProperties secrets)
            if (typeof window !== 'undefined' && payload.otp) {
              const gasVerify = await GasAdapter.execute('verifyCustomerOTP', {
                mobileNumber: payload.mobileNumber,
                otp: payload.otp,
                customerName: payload.customerName,
                email: payload.email,
              });
              if (gasVerify.success && gasVerify.data?.sessionId) {
                const syncedSession = AuthService.syncCustomerSessionFromGas({
                  sessionId: gasVerify.data.sessionId,
                  customerId: gasVerify.data.customerId || gasVerify.data.user?.userId || `CUST-${Date.now().toString().slice(-6)}`,
                  customerName: gasVerify.data.customerName || gasVerify.data.user?.userName || payload.customerName || 'Valued Guest',
                  mobileNumber: payload.mobileNumber,
                  email: gasVerify.data.email || gasVerify.data.user?.email || payload.email || '',
                });
                return {
                  success: true,
                  data: syncedSession,
                  message: gasVerify.message || 'Authentication successful.',
                };
              }
              if (!gasVerify.success && gasVerify.error?.code === 'AUTH_FAILED') {
                return {
                  success: false,
                  error: { code: 'AUTH_FAILED', message: gasVerify.error.message },
                };
              }
            }
            return {
              success: false,
              error: { code: 'AUTH_FAILED', message: res.message },
            };
          }
          // Persist/sync customer profile & session to live Google Sheets
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

        case 'validateSession': {
          const targetSessionId = String(payload.sessionId || sessionId || '').trim();
          if (!targetSessionId) {
            return { success: false, error: { code: 'SESSION_EXPIRED', message: 'No session token provided.' } };
          }
          const localCheck = AuthService.validateSession(targetSessionId);
          if (localCheck.isValid) {
            const rawSession = (localCheck.customer || localCheck.user) as any;
            const cId = rawSession?.customerId || rawSession?.userId || '';
            const cName = rawSession?.customerName || rawSession?.userName || 'Valued Guest';
            const cRole = rawSession?.role || 'Customer';
            const cMobile = rawSession?.mobileNumber || '';
            const cEmail = rawSession?.email || '';

            return {
              success: true,
              data: {
                sessionId: targetSessionId,
                customerId: cId,
                customerName: cName,
                role: cRole,
                mobileNumber: cMobile,
                email: cEmail,
                user: {
                  userId: cId,
                  userName: cName,
                  role: cRole,
                  mobileNumber: cMobile,
                  email: cEmail,
                },
              },
              message: 'Trusted session restored.',
            };
          }
          if (typeof window !== 'undefined') {
            const liveCheck = await GasAdapter.execute('validateSession', { sessionId: targetSessionId });
            if (liveCheck.success && liveCheck.data?.sessionId) {
              if (liveCheck.data.role === 'Customer') {
                const synced = AuthService.syncCustomerSessionFromGas({
                  sessionId: liveCheck.data.sessionId,
                  customerId: liveCheck.data.customerId,
                  customerName: liveCheck.data.customerName,
                  mobileNumber: liveCheck.data.mobileNumber,
                  email: liveCheck.data.email,
                });
                return { success: true, data: synced, message: 'Trusted customer session restored.' };
              }
              return { success: true, data: liveCheck.data, message: 'Session restored.' };
            }
          }
          return {
            success: false,
            error: { code: 'SESSION_EXPIRED', message: 'Session expired or revoked. Please sign in again.' },
          };
        }

        case 'logout': {
          const targetSessionId = String(payload.sessionId || sessionId || '').trim();
          const revoked = AuthService.logout(targetSessionId);
          if (typeof window !== 'undefined' && targetSessionId) {
            await GasAdapter.execute('logout', { sessionId: targetSessionId }).catch(() => {});
          }
          return {
            success: true,
            data: { revoked },
            message: 'Logged out and session revoked.',
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
          if (typeof window !== 'undefined') {
            const liveRes = await GasAdapter.execute('resolveTableQR', { token: payload.token });
            if (liveRes.success && liveRes.data?.table) {
              QRService.syncQRRecord(liveRes.data.table.Table_ID, payload.token, true);
              return {
                success: true,
                data: liveRes.data,
                message: liveRes.message || liveRes.data.message,
              };
            }
            const errCode = liveRes.error?.code;
            if (errCode && errCode !== 'UNKNOWN_ACTION' && errCode !== 'GAS_CONNECTION_ERROR') {
              return {
                success: false,
                error: liveRes.error,
                data: liveRes.data,
              };
            }
          }

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
            const customerName = payload.customerName || sessionCheck.customer?.customerName || actorName;
            const customerMobile = payload.customerMobile || sessionCheck.customer?.mobileNumber || '';
            const email = payload.email || sessionCheck.customer?.email || '';

            const res = BookingService.createBooking({
              customerId,
              visitType: payload.visitType,
              partySize: Number(payload.partySize),
              reservationDate: payload.reservationDate,
              reservationTime: payload.reservationTime,
            });
            if (res.success && typeof window !== 'undefined') {
              await GasAdapter.execute('createBooking', {
                bookingId: res.booking?.Booking_ID,
                customerId,
                customerName,
                customerMobile,
                email,
                visitType: payload.visitType,
                partySize: Number(payload.partySize),
                reservationDate: payload.reservationDate,
                reservationTime: payload.reservationTime,
                tableId: payload.tableId,
              }).catch(() => {});
            }

            if (res.success && res.booking?.Booking_ID) {
              notificationHub.publish({
                id: `res_${res.booking.Booking_ID}`,
                type: 'NEW_RESERVATION',
                title: 'NEW RESERVATION RECEIVED',
                message: `Reservation received for ${customerName} (Party of ${payload.partySize}) on ${payload.reservationDate || 'today'} at ${payload.reservationTime || '19:30'}.`,
                priority: 'normal',
                timestamp: new Date().toISOString(),
                metadata: {
                  bookingId: res.booking.Booking_ID,
                  customerName,
                  partySize: Number(payload.partySize),
                  date: payload.reservationDate,
                  time: payload.reservationTime,
                },
                actionLabel: 'View Booking',
              });
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
            if (res.success && typeof window !== 'undefined' && payload.tableId) {
              await GasAdapter.execute('allocateTable', {
                bookingId: payload.bookingId,
                tableId: payload.tableId,
              }).catch(() => {});
            }
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

          case 'updateCustomerProfile': {
            const res = AuthService.updateCustomerProfile({
              customerId,
              customerName: payload.customerName,
              email: payload.email,
            });
            if (!res.success) {
              return { success: false, error: { code: 'PROFILE_UPDATE_FAILED', message: res.message } };
            }
            if (typeof window !== 'undefined') {
              const liveRes = await GasAdapter.execute('updateCustomerProfile', {
                customerId,
                customerName: payload.customerName,
                email: payload.email,
              });
              if (!liveRes.success && liveRes.error?.code && liveRes.error.code !== 'GAS_CONNECTION_ERROR' && liveRes.error.code !== 'UNKNOWN_ACTION') {
                return { success: false, error: liveRes.error };
              }
            }
            return { success: true, data: res.session, message: res.message };
          }

          case 'confirmArrival': {
            const reqBId = String(payload.bookingId || '').trim().toUpperCase();
            if (typeof window !== 'undefined') {
              const liveArrival = await GasAdapter.execute('confirmArrival', {
                bookingId: reqBId,
                customerId,
              }, sessionId);
              if (liveArrival.success) {
                ReservationService.customerConfirmArrival(reqBId, customerId);
                notificationHub.publish({
                  id: `arrival_${reqBId}`,
                  type: 'ARRIVAL_REGISTERED',
                  title: 'CUSTOMER ARRIVAL — ACTION REQUIRED',
                  message: `Guest ${actorName} has arrived at the host desk for Booking ${reqBId}.`,
                  priority: 'critical',
                  timestamp: new Date().toISOString(),
                  metadata: {
                    bookingId: reqBId,
                    customerName: actorName,
                  },
                  actionLabel: 'Verify Arrival',
                });
                return {
                  success: true,
                  message: liveArrival.message || 'Arrival confirmed! Staff has been notified for verification.',
                };
              }
              if (liveArrival.error?.code && liveArrival.error.code !== 'GAS_CONNECTION_ERROR' && liveArrival.error.code !== 'UNKNOWN_ACTION') {
                return {
                  success: false,
                  error: {
                    code: liveArrival.error.code || 'ARRIVAL_FAILED',
                    message: liveArrival.error.message || liveArrival.message || 'Unable to confirm arrival.',
                  },
                };
              }
            }
            const res = ReservationService.customerConfirmArrival(reqBId, customerId);
            if (res.success) {
              notificationHub.publish({
                id: `arrival_${reqBId}`,
                type: 'ARRIVAL_REGISTERED',
                title: 'CUSTOMER ARRIVAL — ACTION REQUIRED',
                message: `Guest ${actorName} has arrived at the host desk for Booking ${reqBId}.`,
                priority: 'critical',
                timestamp: new Date().toISOString(),
                metadata: {
                  bookingId: reqBId,
                  customerName: actorName,
                },
                actionLabel: 'Verify Arrival',
              });
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'ARRIVAL_FAILED', message: res.message } };
          }

          case 'placeOrder': {
            let gasOrderId: string | undefined;
            if (typeof window !== 'undefined') {
              const gasOrderRes = await GasAdapter.execute('placeOrder', {
                bookingId: payload.bookingId,
                items: payload.items,
                specialInstructions: payload.specialInstructions,
              }, sessionId);
              const liveGasOrderId = gasOrderRes.data?.orderId || (gasOrderRes as any).orderId;
              if (gasOrderRes.success && liveGasOrderId) {
                gasOrderId = liveGasOrderId;
              } else if (
                !gasOrderRes.success &&
                gasOrderRes.error?.code &&
                gasOrderRes.error.code !== 'GAS_CONNECTION_ERROR' &&
                gasOrderRes.error.code !== 'UNKNOWN_ACTION'
              ) {
                return {
                  success: false,
                  error: {
                    code: gasOrderRes.error.code || 'ORDER_PERSIST_FAILED',
                    message: gasOrderRes.error.message || gasOrderRes.message || 'Unable to save order to backend.',
                  },
                };
              }
            }

            const res = OrderService.createOrder({
              orderId: gasOrderId,
              bookingId: payload.bookingId,
              items: payload.items,
              specialInstructions: payload.specialInstructions,
              createdByRole: 'Customer',
            });
            if (!res.success && !gasOrderId) {
              return { success: false, error: { code: 'ORDER_FAILED', message: res.message } };
            }

            const finalOrderId = gasOrderId || res.orderId;
            await CartService.clearDraftCart(customerId);
            if (finalOrderId) {
              notificationHub.publish({
                id: `order_${finalOrderId}`,
                type: 'NEW_ORDER',
                title: 'NEW ORDER RECEIVED',
                message: `New order ${finalOrderId} submitted for booking ${payload.bookingId}.`,
                priority: 'high',
                timestamp: new Date().toISOString(),
                metadata: {
                  orderId: finalOrderId,
                  bookingId: payload.bookingId,
                },
                actionLabel: 'View Order',
              });
            }
            return {
              success: true,
              data: {
                orderId: finalOrderId,
                bookingId: payload.bookingId,
                items: payload.items,
                totalAmount: res.totalAmount || 0,
              },
              message: 'Order submitted to kitchen successfully!',
            };
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
            const reqBId = String(payload.bookingId || '').trim().toUpperCase();
            const sessionCustId = String(customerId || '').trim().toUpperCase();

            if (typeof window !== 'undefined') {
              const liveDetails = await GasAdapter.execute('getBookingDetails', { bookingId: reqBId });
              if (liveDetails.success && liveDetails.data?.booking) {
                const bCustId = String(liveDetails.data.booking.Customer_ID || '').trim().toUpperCase();
                if (bCustId && sessionCustId && bCustId !== sessionCustId) {
                  const bCust = db.findOne('Customers', (c) => c.Customer_ID.toUpperCase() === bCustId);
                  const isMobileMatch = Boolean(bCust && sessionCheck.customer?.mobileNumber && bCust.Mobile_Number === sessionCheck.customer.mobileNumber);
                  if (!isMobileMatch) {
                    return { success: false, error: { code: 'FORBIDDEN', message: 'Access denied: You can only view your own booking details.' } };
                  }
                }
                return { success: true, data: liveDetails.data };
              }
            }

            const localDetails = BookingService.getBookingDetails(reqBId);
            if (localDetails) {
              const bCustId = String(localDetails.booking.Customer_ID || '').trim().toUpperCase();
              if (bCustId && sessionCustId && bCustId !== sessionCustId) {
                const bCust = db.findOne('Customers', (c) => c.Customer_ID.toUpperCase() === bCustId);
                const isMobileMatch = Boolean(bCust && sessionCheck.customer?.mobileNumber && bCust.Mobile_Number === sessionCheck.customer.mobileNumber);
                if (!isMobileMatch) {
                  return { success: false, error: { code: 'FORBIDDEN', message: 'Access denied: You can only view your own booking details.' } };
                }
              }
              return { success: true, data: localDetails };
            }

            return { success: false, error: { code: 'NOT_FOUND', message: `Booking ID '${payload.bookingId}' not found.` } };
          }

          case 'getCustomerHistory': {
            const custMobile = sessionCheck.customer?.mobileNumber;
            if (typeof window !== 'undefined') {
              const liveHist = await GasAdapter.execute('getCustomerHistory', {
                customerId,
                userId: customerId,
                mobileNumber: custMobile,
              });
              if (liveHist.success && Array.isArray(liveHist.data) && liveHist.data.length > 0) {
                return { success: true, data: liveHist.data };
              }
            }
            const bookings = BookingService.getCustomerBookings(customerId);
            const enriched = bookings.map((b) => {
              const details = BookingService.getBookingDetails(b.Booking_ID);
              return {
                ...b,
                orders: details?.orders || [],
                orderItems: details?.orderItems || [],
                bill: details?.bill || null,
                payment: details?.payment || null,
                reservations: details?.reservations || [],
              };
            });
            return { success: true, data: enriched };
          }

          case 'getCustomerFeedbacks': {
            const localFeedbacks = FeedbackService.getCustomerFeedbacks(customerId);
            if (typeof window !== 'undefined') {
              const liveFeedbacks = await GasAdapter.execute('getCustomerFeedbacks', { customerId });
              if (liveFeedbacks.success && Array.isArray(liveFeedbacks.data)) {
                return { success: true, data: liveFeedbacks.data };
              }
            }
            return { success: true, data: localFeedbacks };
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
            const overallRating = Number(payload.overallRating || payload.rating);
            const foodQualityRating = Number(payload.foodQualityRating || overallRating);
            const serviceRating = Number(payload.serviceRating || overallRating);
            const cleanlinessRating = Number(payload.cleanlinessRating || overallRating);
            const comments = payload.comments ?? payload.comment ?? '';

            // Always persist through live Google Apps Script in browser first when reachable
            if (typeof window !== 'undefined') {
              const liveFbRes = await GasAdapter.execute('submitFeedback', {
                orderId: payload.orderId,
                bookingId: payload.bookingId,
                customerId,
                customerName: payload.customerName || actorName,
                overallRating,
                foodQualityRating,
                serviceRating,
                cleanlinessRating,
                comments,
              });
              if (liveFbRes.success) {
                FeedbackService.submitOrderFeedback({
                  orderId: payload.orderId,
                  bookingId: payload.bookingId,
                  customerId,
                  customerName: payload.customerName || actorName,
                  overallRating,
                  foodQualityRating,
                  serviceRating,
                  cleanlinessRating,
                  comments,
                });
                return { success: true, data: liveFbRes.data, message: liveFbRes.message };
              }
              if (
                liveFbRes.error?.code &&
                liveFbRes.error.code !== 'GAS_CONNECTION_ERROR' &&
                liveFbRes.error.code !== 'UNKNOWN_ACTION'
              ) {
                return {
                  success: false,
                  error: {
                    code: 'FEEDBACK_FAILED',
                    message: liveFbRes.error.message || 'Feedback submission failed.',
                  },
                };
              }
            }

            const res = FeedbackService.submitOrderFeedback({
              orderId: payload.orderId,
              bookingId: payload.bookingId,
              customerId,
              customerName: payload.customerName || actorName,
              overallRating,
              foodQualityRating,
              serviceRating,
              cleanlinessRating,
              comments,
            });
            return res.success
              ? { success: true, data: res.feedback, message: res.message }
              : { success: false, error: { code: 'FEEDBACK_FAILED', message: res.message } };
          }
        }
      }

      // 4. Staff / Admin Protected Actions
      if (userRole === 'Staff' || userRole === 'Admin') {
        switch (action) {
          case 'getStaffDashboard': {
            if (typeof window !== 'undefined') {
              const liveStaffRes = await GasAdapter.execute('getStaffDashboard');
              if (liveStaffRes.success && liveStaffRes.data) {
                const {
                  bookings: liveBookings = [],
                  tables: liveTables = [],
                  reservations: liveRes = [],
                  orders: liveOrders = [],
                  orderItems: liveItems = [],
                  customers: liveCustomers = [],
                  menu: liveMenu = [],
                  orderHistory: liveHistory = [],
                  payments: livePayments = [],
                } = liveStaffRes.data;

                const enrichedBookings = liveBookings
                  .filter((b: any) => b.Booking_Status !== 'Cancelled')
                  .map((b: any) => {
                    const bCustId = String(b.Customer_ID || '').trim().toUpperCase();
                    let cust = liveCustomers.find((c: any) => String(c.Customer_ID || '').trim().toUpperCase() === bCustId);
                    if (!cust && b.customerMobile) {
                      cust = liveCustomers.find((c: any) => String(c.Mobile_Number || '').trim() === String(b.customerMobile).trim());
                    }
                    const bId = String(b.Booking_ID || '').trim().toUpperCase();
                    const res = liveRes.find((r: any) => String(r.Booking_ID || '').trim().toUpperCase() === bId);
                    const tbl = res ? liveTables.find((t: any) => String(t.Table_ID || '').trim().toUpperCase() === String(res.Table_ID || '').trim().toUpperCase()) : undefined;
                    return {
                      ...b,
                      customerName: cust?.Customer_Name || b.customerName || (cust?.Mobile_Number ? `Guest (${cust.Mobile_Number})` : 'Guest'),
                      customerMobile: cust?.Mobile_Number || b.customerMobile || '',
                      tableNumber: tbl?.Table_Number,
                      tableId: tbl?.Table_ID,
                      graceDeadline: res?.Grace_Deadline,
                      arrivalStatus: res?.Arrival_Status,
                    };
                  });

                // Compute dynamic table status from live data
                const enrichedTables = liveTables.map((t: any) => {
                  const tId = String(t.Table_ID || '').trim().toUpperCase();
                  if (t.Table_Status === 'Unavailable') {
                    return { ...t, dynamicState: 'Unavailable' };
                  }

                  // Find if table is occupied or seated
                  const seatedBooking = enrichedBookings.find((b: any) => {
                    if (b.Booking_Status !== 'Seated') return false;
                    return String(b.tableId || '').trim().toUpperCase() === tId;
                  });

                  if (t.Table_Status === 'Occupied' || seatedBooking) {
                    return {
                      ...t,
                      dynamicState: 'Occupied',
                      activeBookingId: seatedBooking?.Booking_ID,
                      seatedCustomerName: seatedBooking?.customerName,
                    };
                  }

                  // Check if protected by upcoming reservation (105-minute window)
                  const blockingWindowMs = 105 * 60 * 1000;
                  const now = Date.now();
                  const upcoming = liveRes.find((r: any) => {
                    if (String(r.Table_ID || '').trim().toUpperCase() !== tId) return false;
                    if (r.Reservation_Status !== 'Active') return false;
                    const resTime = new Date(r.Reservation_DateTime).getTime();
                    return !isNaN(resTime) && Math.abs(resTime - now) <= blockingWindowMs;
                  });

                  if (upcoming) {
                    const upBooking = enrichedBookings.find((b: any) => String(b.Booking_ID || '').trim().toUpperCase() === String(upcoming.Booking_ID || '').trim().toUpperCase());
                    return {
                      ...t,
                      dynamicState: 'Reserved_Upcoming',
                      activeBookingId: upcoming.Booking_ID,
                      reservedCustomerName: upBooking?.customerName,
                      reservationTime: upBooking?.Reservation_Time,
                    };
                  }

                  return {
                    ...t,
                    dynamicState: 'Available',
                  };
                });

                const enrichedOrders = liveOrders.map((order: any) => {
                  const bId = String(order.Booking_ID || '').trim().toUpperCase();
                  const bk = liveBookings.find((b: any) => String(b.Booking_ID || '').trim().toUpperCase() === bId);
                  const bCustId = bk ? String(bk.Customer_ID || '').trim().toUpperCase() : '';
                  const cust = bCustId ? liveCustomers.find((c: any) => String(c.Customer_ID || '').trim().toUpperCase() === bCustId) : undefined;
                  const res = liveRes.find((r: any) => String(r.Booking_ID || '').trim().toUpperCase() === bId);
                  const tbl = res ? liveTables.find((t: any) => String(t.Table_ID || '').trim().toUpperCase() === String(res.Table_ID || '').trim().toUpperCase()) : undefined;
                  const items = liveItems
                    .filter((i: any) => String(i.Order_ID || '').trim().toUpperCase() === String(order.Order_ID || '').trim().toUpperCase())
                    .map((i: any) => {
                      const food = liveMenu.find((m: any) => m.Food_ID === i.Food_ID);
                      return { ...i, foodName: food?.Food_Name || i.Food_ID };
                    });
                  let specialInstructions = '';
                  const histRow = liveHistory.find(
                    (h: any) => h.Order_ID === order.Order_ID && String(h.Change_Reason || '').trim().startsWith('{')
                  );
                  if (histRow) {
                    try {
                      specialInstructions = JSON.parse(histRow.Change_Reason).specialInstructions || '';
                    } catch {}
                  }
                  return {
                    ...order,
                    customerName: cust?.Customer_Name || bk?.customerName || 'Guest',
                    tableNumber: tbl?.Table_Number || (res?.Table_ID || 'Walk-in'),
                    specialInstructions,
                    items,
                  };
                });

                const queue = enrichedBookings.filter((b: any) => b.Queue_Status === 'Waiting' || b.Queue_Status === 'Called');
                const pendingPayments = livePayments.filter((p: any) => p.Payment_Status === 'Pending_Verification');
                const unverifiedArrivals = enrichedBookings.filter(
                  (b: any) => b.Booking_Status === 'Arrived' && b.arrivalStatus !== 'Verified' && !String(b.Status_History_JSON || '').includes('ARRIVAL_VERIFIED')
                );

                return {
                  success: true,
                  data: {
                    bookings: enrichedBookings,
                    queue,
                    tables: enrichedTables,
                    pendingPayments,
                    allOrders: enrichedOrders,
                    unverifiedArrivals,
                  },
                };
              }
            }

            const bookings = BookingService.getStaffDashboardBookings();
            const queue = QueueService.getActiveQueue();
            const tables = TableService.getAllTablesWithDynamicStatus();
            const pendingPayments = PaymentService.getPendingPayments();
            const allOrders = OrderService.getAllOrdersForStaff();
            const unverifiedArrivals = bookings.filter(
              (b) => b.Booking_Status === 'Arrived' && b.arrivalStatus !== 'Verified' && !String(b.Status_History_JSON || '').includes('ARRIVAL_VERIFIED')
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
            const reqBId = String(payload.bookingId || '').trim().toUpperCase();
            if (typeof window !== 'undefined') {
              const liveVerify = await GasAdapter.execute('verifyCustomerArrival', {
                bookingId: reqBId,
                verifiedBy: actorName,
              }, sessionId);
              if (liveVerify.success) {
                ReservationService.staffVerifyArrival(reqBId, actorName);
                notificationHub.publish({
                  id: `verified_${reqBId}`,
                  type: 'ARRIVAL_VERIFIED',
                  title: 'ARRIVAL VERIFIED',
                  message: `Staff has verified arrival for Booking ${reqBId}. Table allocation in progress.`,
                  priority: 'high',
                  timestamp: new Date().toISOString(),
                  metadata: { bookingId: reqBId },
                });
                return { success: true, message: liveVerify.message || 'Customer arrival verified by staff.' };
              }
              if (liveVerify.error?.code && liveVerify.error.code !== 'GAS_CONNECTION_ERROR' && liveVerify.error.code !== 'UNKNOWN_ACTION') {
                return {
                  success: false,
                  error: {
                    code: liveVerify.error.code || 'VERIFICATION_FAILED',
                    message: liveVerify.error.message || liveVerify.message || 'Could not verify customer arrival.',
                  },
                };
              }
            }
            const res = ReservationService.staffVerifyArrival(reqBId, actorName);
            if (res.success) {
              notificationHub.publish({
                id: `verified_${reqBId}`,
                type: 'ARRIVAL_VERIFIED',
                title: 'ARRIVAL VERIFIED',
                message: `Staff has verified arrival for Booking ${reqBId}. Table allocation in progress.`,
                priority: 'high',
                timestamp: new Date().toISOString(),
                metadata: { bookingId: reqBId },
              });
            }
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
            const reqBId = String(payload.bookingId || '').trim().toUpperCase();
            const reqTId = String(payload.tableId || '').trim().toUpperCase();
            if (typeof window !== 'undefined') {
              const liveAlloc = await GasAdapter.execute('allocateTable', {
                bookingId: reqBId,
                tableId: reqTId,
              }, sessionId);
              if (liveAlloc.success) {
                TableService.allocateTable({
                  bookingId: reqBId,
                  tableId: reqTId,
                  isImmediate: true,
                });
                notificationHub.publish({
                  id: `alloc_${reqBId}_${reqTId}`,
                  type: 'TABLE_ALLOCATED',
                  title: 'TABLE ALLOCATED',
                  message: `Table ${reqTId} has been allocated to Booking ${reqBId}.`,
                  priority: 'high',
                  timestamp: new Date().toISOString(),
                  metadata: { bookingId: reqBId, tableNumber: reqTId },
                });
                return { success: true, data: liveAlloc.data, message: liveAlloc.message || 'Table allocated successfully.' };
              }
              if (liveAlloc.error?.code && liveAlloc.error.code !== 'GAS_CONNECTION_ERROR' && liveAlloc.error.code !== 'UNKNOWN_ACTION') {
                return {
                  success: false,
                  error: {
                    code: liveAlloc.error.code || 'ALLOCATION_FAILED',
                    message: liveAlloc.error.message || liveAlloc.message || 'Could not allocate table.',
                  },
                };
              }
            }
            const res = TableService.allocateTable({
              bookingId: reqBId,
              tableId: reqTId,
              isImmediate: true,
            });
            if (res.success) {
              notificationHub.publish({
                id: `alloc_${reqBId}_${reqTId}`,
                type: 'TABLE_ALLOCATED',
                title: 'TABLE ALLOCATED',
                message: `Table ${reqTId} has been allocated to Booking ${reqBId}.`,
                priority: 'high',
                timestamp: new Date().toISOString(),
                metadata: { bookingId: reqBId, tableNumber: reqTId },
              });
            }
            return res.success
              ? { success: true, data: res, message: res.message }
              : { success: false, error: { code: 'ALLOCATION_FAILED', message: res.message } };
          }

          case 'seatCustomer': {
            const reqBId = String(payload.bookingId || '').trim().toUpperCase();
            const reqTId = String(payload.tableId || '').trim().toUpperCase();
            if (typeof window !== 'undefined') {
              const liveSeat = await GasAdapter.execute('seatCustomer', {
                bookingId: reqBId,
                tableId: reqTId,
              }, sessionId);
              if (liveSeat.success) {
                TableService.seatCustomer(reqBId, reqTId);
                notificationHub.publish({
                  id: `seat_${reqBId}_${reqTId}`,
                  type: 'CUSTOMER_SEATED',
                  title: 'WELCOME TO YOUR TABLE',
                  message: `Party for Booking ${reqBId} is now seated at Table ${reqTId}. Ready for ordering!`,
                  priority: 'high',
                  timestamp: new Date().toISOString(),
                  metadata: { bookingId: reqBId, tableNumber: reqTId },
                });
                return { success: true, message: liveSeat.message || 'Customer seated successfully.' };
              }
              if (liveSeat.error?.code && liveSeat.error.code !== 'GAS_CONNECTION_ERROR' && liveSeat.error.code !== 'UNKNOWN_ACTION') {
                return {
                  success: false,
                  error: {
                    code: liveSeat.error.code || 'SEAT_FAILED',
                    message: liveSeat.error.message || liveSeat.message || 'Could not seat customer.',
                  },
                };
              }
            }
            const res = TableService.seatCustomer(reqBId, reqTId);
            if (res.success) {
              notificationHub.publish({
                id: `seat_${reqBId}_${reqTId}`,
                type: 'CUSTOMER_SEATED',
                title: 'WELCOME TO YOUR TABLE',
                message: `Party for Booking ${reqBId} is now seated at Table ${reqTId}. Ready for ordering!`,
                priority: 'high',
                timestamp: new Date().toISOString(),
                metadata: { bookingId: reqBId, tableNumber: reqTId },
              });
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'SEAT_FAILED', message: res.message } };
          }

          case 'authorizeOrder': {
            const res = OrderService.authorizeOrder(payload.orderId, actorName);
            if (res.success && typeof window !== 'undefined') {
              await GasAdapter.execute('authorizeOrder', { orderId: payload.orderId, authorizedBy: actorName }).catch(() => {});
            }
            if (res.success) {
              notificationHub.publish({
                id: `order_auth_${payload.orderId}`,
                type: 'NEW_ORDER',
                title: 'NEW ORDER RECEIVED IN KITCHEN',
                message: `Order ${payload.orderId} has been authorized for kitchen preparation.`,
                priority: 'high',
                timestamp: new Date().toISOString(),
                metadata: { orderId: payload.orderId },
                actionLabel: 'View Order',
              });
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'AUTH_ORDER_FAILED', message: res.message } };
          }

          case 'staffCreateOrder':
          case 'placeOrder': {
            const res = OrderService.createOrder({
              bookingId: payload.bookingId,
              items: payload.items,
              specialInstructions: payload.specialInstructions,
              createdByRole: 'Staff',
            });
            if (!res.success) {
              return { success: false, error: { code: 'ORDER_FAILED', message: res.message } };
            }
            if (typeof window !== 'undefined') {
              await GasAdapter.execute('placeOrder', {
                orderId: res.orderId,
                bookingId: payload.bookingId,
                items: payload.items,
                specialInstructions: payload.specialInstructions,
                createdByRole: 'Staff',
              }).catch(() => {});
            }
            if (res.orderId) {
              notificationHub.publish({
                id: `order_staff_${res.orderId}`,
                type: 'NEW_ORDER',
                title: 'NEW ORDER SUBMITTED',
                message: `Staff placed Order ${res.orderId} for Booking ${payload.bookingId}.`,
                priority: 'high',
                timestamp: new Date().toISOString(),
                metadata: {
                  orderId: res.orderId,
                  bookingId: payload.bookingId,
                },
                actionLabel: 'View Order',
              });
            }
            return { success: true, data: res, message: res.message };
          }

          case 'updateOrderItemQuantity': {
            const res = OrderService.updateItemQuantity({
              orderItemId: payload.orderItemId,
              quantity: Number(payload.quantity),
              changedBy: actorName,
            });
            if (res.success && typeof window !== 'undefined') {
              await GasAdapter.execute('updateOrderItemQuantity', {
                orderItemId: payload.orderItemId,
                quantity: Number(payload.quantity),
                changedBy: actorName,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'ITEM_UPDATE_FAILED', message: res.message } };
          }

          case 'cancelOrReplaceItem': {
            const res = OrderService.cancelOrReplaceItem({
              orderItemId: payload.orderItemId,
              action: payload.action,
              reason: payload.reason,
              replacementFoodId: payload.replacementFoodId,
              changedBy: actorName,
            });
            if (res.success && typeof window !== 'undefined') {
              await GasAdapter.execute('cancelOrReplaceItem', {
                orderItemId: payload.orderItemId,
                action: payload.action,
                reason: payload.reason,
                replacementFoodId: payload.replacementFoodId,
                changedBy: actorName,
              }).catch(() => {});
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'ITEM_CHANGE_FAILED', message: res.message } };
          }

          case 'generateBill': {
            const reqBId = String(payload.bookingId || '').trim().toUpperCase();
            if (typeof window !== 'undefined') {
              const liveBill = await GasAdapter.execute('generateBill', {
                bookingId: reqBId,
                discountPercent: Number(payload.discountPercent) || 0,
                discountReason: payload.discountReason,
              }, sessionId);

              if (liveBill.success && liveBill.data) {
                const existing = db.findOne('Bills', (b) => b.Booking_ID.toUpperCase() === reqBId);
                if (!existing) {
                  db.insertRow('Bills', liveBill.data);
                }
                notificationHub.publish({
                  id: `bill_${reqBId}_${liveBill.data.Bill_ID}`,
                  type: 'BILL_GENERATED',
                  title: 'YOUR BILL IS READY',
                  message: `Final bill ${liveBill.data.Bill_ID} has been generated. Total payable: ₹${liveBill.data.Grand_Total}.`,
                  priority: 'high',
                  timestamp: new Date().toISOString(),
                  metadata: {
                    bookingId: reqBId,
                    billId: liveBill.data.Bill_ID,
                    amount: Number(liveBill.data.Grand_Total),
                  },
                  actionLabel: 'View Bill',
                });
                return { success: true, data: liveBill.data, message: liveBill.message || 'Final bill generated.' };
              }

              if (liveBill.error?.code && liveBill.error.code !== 'GAS_CONNECTION_ERROR' && liveBill.error.code !== 'UNKNOWN_ACTION') {
                return {
                  success: false,
                  error: {
                    code: liveBill.error.code || 'BILL_FAILED',
                    message: liveBill.error.message || liveBill.message || 'Could not generate bill.',
                  },
                };
              }
            }

            const res = BillingService.generateFinalBill({
              bookingId: reqBId,
              discountPercent: Number(payload.discountPercent) || 0,
              discountReason: payload.discountReason,
              staffUserName: actorName,
            });
            if (res.success && res.bill) {
              notificationHub.publish({
                id: `bill_${reqBId}_${res.bill.Bill_ID}`,
                type: 'BILL_GENERATED',
                title: 'YOUR BILL IS READY',
                message: `Final bill ${res.bill.Bill_ID} has been generated. Total payable: ₹${res.bill.Grand_Total}.`,
                priority: 'high',
                timestamp: new Date().toISOString(),
                metadata: {
                  bookingId: reqBId,
                  billId: res.bill.Bill_ID,
                  amount: Number(res.bill.Grand_Total),
                },
                actionLabel: 'View Bill',
              });
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

              notificationHub.publish({
                id: `pay_${payload.paymentId}`,
                type: 'PAYMENT_VERIFIED',
                title: 'PAYMENT VERIFIED',
                message: `Payment ${payload.paymentId} verified by staff. Status: ${payload.isConfirmed ? 'Paid' : 'Rejected'}.`,
                priority: 'normal',
                timestamp: new Date().toISOString(),
                metadata: {
                  billId: payload.paymentId,
                  status: payload.isConfirmed ? 'Paid' : 'Rejected',
                },
              });
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'PAYMENT_VERIFY_FAILED', message: res.message } };
          }

          case 'confirmDeparture': {
            const reqBId = String(payload.bookingId || '').trim().toUpperCase();
            const reqTId = String(payload.tableId || '').trim().toUpperCase();
            if (typeof window !== 'undefined') {
              const liveDep = await GasAdapter.execute('confirmDeparture', {
                bookingId: reqBId,
                tableId: reqTId,
                staffUserName: actorName,
              }, sessionId);
              if (liveDep.success) {
                PaymentService.confirmDepartureAndReleaseTable({
                  bookingId: reqBId,
                  tableId: reqTId,
                  staffUserName: actorName,
                });
                return { success: true, message: liveDep.message || 'Table cleaned and released for new guests.' };
              }
              if (liveDep.error?.code && liveDep.error.code !== 'GAS_CONNECTION_ERROR' && liveDep.error.code !== 'UNKNOWN_ACTION') {
                return {
                  success: false,
                  error: {
                    code: liveDep.error.code || 'DEPARTURE_FAILED',
                    message: liveDep.error.message || liveDep.message || 'Could not confirm departure.',
                  },
                };
              }
            }
            const res = PaymentService.confirmDepartureAndReleaseTable({
              bookingId: reqBId,
              tableId: reqTId,
              staffUserName: actorName,
            });
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
            if (typeof window !== 'undefined') {
              const liveKitchenRes = await GasAdapter.execute('getKitchenQueue');
              if (liveKitchenRes.success && Array.isArray(liveKitchenRes.data)) {
                return { success: true, data: liveKitchenRes.data };
              }
              if (
                !liveKitchenRes.success &&
                liveKitchenRes.error?.code !== 'GAS_CONNECTION_ERROR' &&
                liveKitchenRes.error?.code !== 'UNKNOWN_ACTION'
              ) {
                return {
                  success: false,
                  error: liveKitchenRes.error || { code: 'KITCHEN_FETCH_FAILED', message: 'Failed to load kitchen queue.' },
                };
              }
            }
            const queue = KitchenService.getKitchenQueue(true);
            return { success: true, data: queue };
          }

          case 'updateKitchenPreparationStatus': {
            const statusTitles: Record<string, string> = {
              Accepted: 'ORDER ACCEPTED',
              Preparing: 'YOUR FOOD IS BEING PREPARED',
              Ready: 'ORDER READY',
              Served: 'ORDER COMPLETED',
            };
            const statusMsgs: Record<string, string> = {
              Accepted: `The kitchen has accepted Order ${payload.orderId}.`,
              Preparing: `Chefs have started cooking Order ${payload.orderId}.`,
              Ready: `Order ${payload.orderId} is cooked and ready to be served!`,
              Served: `Order ${payload.orderId} has been served to the table. Bon appétit!`,
            };

            if (typeof window !== 'undefined') {
              const liveUpd = await GasAdapter.execute('updateKitchenPreparationStatus', {
                orderId: payload.orderId,
                newStatus: payload.newStatus,
                actorName,
                reason: payload.reason,
              });
              // Keep local mockDb synchronized if order is cached locally
              KitchenService.updatePreparationStatus({
                orderId: payload.orderId,
                newStatus: payload.newStatus,
                kitchenUserName: actorName,
                reason: payload.reason,
              });
              notificationHub.publish({
                id: `kitchen_${payload.orderId}_${payload.newStatus}`,
                type: 'ORDER_STATUS_CHANGED',
                title: statusTitles[payload.newStatus] || `ORDER STATUS: ${payload.newStatus}`,
                message: statusMsgs[payload.newStatus] || `Order ${payload.orderId} status changed to ${payload.newStatus}.`,
                priority: payload.newStatus === 'Ready' ? 'high' : 'normal',
                timestamp: new Date().toISOString(),
                metadata: {
                  orderId: payload.orderId,
                  status: payload.newStatus,
                },
              });
              if (liveUpd.success) {
                return { success: true, message: liveUpd.message || 'Status updated.' };
              }
              if (
                liveUpd.error?.code !== 'GAS_CONNECTION_ERROR' &&
                liveUpd.error?.code !== 'UNKNOWN_ACTION'
              ) {
                return {
                  success: false,
                  error: liveUpd.error || { code: 'KITCHEN_UPDATE_FAILED', message: 'Failed to update kitchen status.' },
                };
              }
            }

            const res = KitchenService.updatePreparationStatus({
              orderId: payload.orderId,
              newStatus: payload.newStatus,
              kitchenUserName: actorName,
              reason: payload.reason,
            });
            if (res.success) {
              notificationHub.publish({
                id: `kitchen_${payload.orderId}_${payload.newStatus}`,
                type: 'ORDER_STATUS_CHANGED',
                title: statusTitles[payload.newStatus] || `ORDER STATUS: ${payload.newStatus}`,
                message: statusMsgs[payload.newStatus] || `Order ${payload.orderId} status changed to ${payload.newStatus}.`,
                priority: payload.newStatus === 'Ready' ? 'high' : 'normal',
                timestamp: new Date().toISOString(),
                metadata: {
                  orderId: payload.orderId,
                  status: payload.newStatus,
                },
              });
            }
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'KITCHEN_UPDATE_FAILED', message: res.message } };
          }

          case 'updateOrderItemStatus': {
            if (typeof window !== 'undefined') {
              const liveItemRes = await GasAdapter.execute('updateOrderItemStatus', {
                orderItemId: payload.orderItemId,
                newStatus: payload.newStatus,
                actorName,
              });
              KitchenService.updateOrderItemStatus({
                orderItemId: payload.orderItemId,
                newStatus: payload.newStatus,
                kitchenUserName: actorName,
              });
              if (liveItemRes.success) {
                return { success: true, message: liveItemRes.message };
              }
              if (
                liveItemRes.error?.code !== 'GAS_CONNECTION_ERROR' &&
                liveItemRes.error?.code !== 'UNKNOWN_ACTION'
              ) {
                return {
                  success: false,
                  error: liveItemRes.error || { code: 'ITEM_UPDATE_FAILED', message: 'Failed to update item status.' },
                };
              }
            }
            const res = KitchenService.updateOrderItemStatus({
              orderItemId: payload.orderItemId,
              newStatus: payload.newStatus,
              kitchenUserName: actorName,
            });
            return res.success
              ? { success: true, message: res.message }
              : { success: false, error: { code: 'ITEM_UPDATE_FAILED', message: res.message } };
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
            let feedbackAnalytics = FeedbackService.getAdminFeedbackAnalytics();

            if (typeof window !== 'undefined') {
              try {
                const liveFbPromise = GasAdapter.execute('getAdminFeedbackAnalytics', {});
                const timeoutPromise = new Promise<any>((r) => setTimeout(() => r({ success: false }), 2000));
                const liveFb: any = await Promise.race([liveFbPromise, timeoutPromise]);
                if (liveFb && liveFb.success && liveFb.data) {
                  feedbackAnalytics = liveFb.data;
                }
              } catch {}
            }

            return {
              success: true,
              data: {
                metrics: {
                  ...metrics,
                  averageRating: feedbackAnalytics.averageOverallRating || metrics.averageRating,
                  totalFeedbackCount: feedbackAnalytics.totalFeedbackCount || metrics.totalFeedbackCount,
                },
                users,
                refunds,
                menu,
                tables,
                settings,
                feedbackAnalytics,
              },
            };
          }

          case 'getAdminFeedbackAnalytics': {
            if (typeof window !== 'undefined') {
              const liveFb = await GasAdapter.execute('getAdminFeedbackAnalytics', {
                date: payload.date,
                rating: payload.rating,
              });
              if (liveFb.success && liveFb.data) {
                return { success: true, data: liveFb.data };
              }
            }
            const analytics = FeedbackService.getAdminFeedbackAnalytics({
              date: payload.date,
              rating: payload.rating ? Number(payload.rating) : undefined,
            });
            return { success: true, data: analytics };
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
            if (typeof window !== 'undefined') {
              const liveRes = await GasAdapter.execute('getAllTableQRs', { baseUrl: payload.baseUrl });
              if (liveRes.success && Array.isArray(liveRes.data)) {
                liveRes.data.forEach((rec: any) => {
                  QRService.syncQRRecord(rec.tableId, rec.token, rec.isActive, rec.generatedAt);
                });
                return { success: true, data: liveRes.data };
              }
            }
            const qrs = QRService.getAllTableQRs(payload.baseUrl);
            return { success: true, data: qrs };
          }

          case 'regenerateTableQR': {
            const token = QRService.generateTableToken(payload.tableId, true);
            if (typeof window !== 'undefined') {
              await GasAdapter.execute('regenerateTableQR', { tableId: payload.tableId, token }).catch(() => {});
            }
            return { success: true, data: { token }, message: `New QR token generated for ${payload.tableId}.` };
          }

          case 'toggleTableQR': {
            const res = QRService.toggleTableQR(payload.tableId, Boolean(payload.isActive));
            if (typeof window !== 'undefined') {
              await GasAdapter.execute('toggleTableQR', {
                tableId: payload.tableId,
                isActive: Boolean(payload.isActive),
              }).catch(() => {});
            }
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
        name: settings.RESTAURANT_NAME && !settings.RESTAURANT_NAME.includes('Savor') ? settings.RESTAURANT_NAME : 'Treat & Taste',
        subtitle: 'Family Restaurant',
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

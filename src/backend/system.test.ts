/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * End-to-End Automated Test Suite
 * Validates Blueprint v3 Core Business Logic, Cryptography, Schema & Role Workflows
 * Uses Node's built-in test runner (node:test)
 */

import test from 'node:test';
import assert from 'node:assert/strict';
import { db } from './mockDb';
import {
  generateRandomOTP,
  hashOTP,
  verifyOTPHash,
  generateSalt,
  hashPassword,
  verifyPassword,
} from './crypto';
import { verifySchemaIntegrity, TOTAL_COLUMNS_COUNT } from './schema';
import { AuthService } from './services/AuthService';
import { BookingService } from './services/BookingService';
import { TableService } from './services/TableService';
import { QueueService } from './services/QueueService';
import { ReservationService } from './services/ReservationService';
import { OrderService, KitchenService } from './services/OrderService';
import { BillingService } from './services/BillingService';
import { PaymentService, RefundService } from './services/PaymentService';
import { ReportService } from './services/ReportService';
import { EmailService } from './services/EmailService';
import { AdminManagementService } from './services/AdminManagementService';
import { QRService } from './services/QRService';
import { CartService } from './services/CartService';
import { FeedbackService } from './services/FeedbackService';
import { BRAND_CONFIG } from '../config/branding';

test('1. Database Schema Integrity: exactly 12 tabs and 108 columns', () => {
  const headers = db.getSheetHeaders();
  const check = verifySchemaIntegrity(headers);

  assert.equal(check.isValid, true, `Schema errors: ${check.errors.join('; ')}`);
  assert.equal(Object.keys(headers).length, 12, 'Expected exactly 12 database tabs');
  assert.equal(TOTAL_COLUMNS_COUNT, 108, 'Expected exactly 108 columns');
});

test('2. Cryptography: PBKDF2 password hashing with unique salt', () => {
  const salt1 = generateSalt();
  const salt2 = generateSalt();
  assert.notEqual(salt1, salt2, 'Salts must be unique');

  const password = 'SecretPassword@2026';
  const hash1 = hashPassword(password, salt1);
  const hash2 = hashPassword(password, salt2);

  assert.notEqual(hash1, hash2, 'Different salts must produce different PBKDF2 hashes');
  assert.equal(verifyPassword(password, hash1, salt1), true, 'Password verification should succeed');
  assert.equal(verifyPassword('WrongPassword', hash1, salt1), false, 'Wrong password should fail');
});

test('3. Cryptography: OTP generation, HMAC-SHA256 and verification', () => {
  const otp = generateRandomOTP();
  assert.match(otp, /^\d{6}$/, 'OTP must be exactly 6 digits');

  const hash = hashOTP(otp);
  assert.equal(verifyOTPHash(otp, hash), true, 'Valid OTP must verify');
  assert.equal(verifyOTPHash('000000', hash), false, 'Invalid OTP must fail');
});

test('3b. EmailService: 5-minute expiry, HMAC-SHA256, and live delivery testing', () => {
  const otp = EmailService.generateOTP();
  assert.match(otp, /^\d{6}$/, 'EmailService OTP must be 6 digits');

  const hash = EmailService.hash(otp);
  assert.equal(EmailService.verifyHash(otp, hash), true, 'Valid OTP must match HMAC-SHA256 hash');
  assert.equal(EmailService.verifyHash('999999', hash), false, 'Mismatched OTP must fail');

  // Expiry check
  const now = Date.now();
  const validExpiry = EmailService.getExpiryTimestamp(now);
  assert.equal(EmailService.isExpired(validExpiry), false, 'Fresh 5-minute timestamp must not be expired');

  const pastExpiry = new Date(now - 1000).toISOString();
  assert.equal(EmailService.isExpired(pastExpiry), true, 'Past timestamp must be expired');

  // Live delivery test function
  const deliveryResult = EmailService.testEmailDelivery('sharunandhaganesh@gmail.com');
  assert.equal(deliveryResult.success, true, 'Email test delivery should succeed');
  assert.equal(deliveryResult.recipient, 'sharunandhaganesh@gmail.com');
  assert.match(deliveryResult.sampleOtp || '', /^\d{6}$/);
});

test('4. Customer OTP Lifecycle: request, cooldown, and 3-attempt limit', async () => {
  const mobile = '9876543299';
  const email = 'test.customer@example.com';

  // Step 1: Request OTP for new customer
  const req1 = await AuthService.requestCustomerOTP({
    mobileNumber: mobile,
    customerName: 'Test Customer',
    email,
  });
  assert.equal(req1.success, true);

  // Step 2: 60-second cooldown check
  const req2 = await AuthService.requestCustomerOTP({ mobileNumber: mobile });
  assert.equal(req2.success, false, 'Cooldown should block rapid subsequent OTP requests');

  // Step 3: Failed OTP verification attempts
  const fail1 = AuthService.verifyCustomerOTP({ mobileNumber: mobile, otp: '111111' });
  assert.equal(fail1.success, false);

  const fail2 = AuthService.verifyCustomerOTP({ mobileNumber: mobile, otp: '222222' });
  assert.equal(fail2.success, false);

  const fail3 = AuthService.verifyCustomerOTP({ mobileNumber: mobile, otp: '333333' });
  assert.equal(fail3.success, false);

  // 4th attempt should be blocked due to 3-attempt limit
  const fail4 = AuthService.verifyCustomerOTP({ mobileNumber: mobile, otp: '444444' });
  assert.equal(fail4.success, false);
  assert.match(fail4.message, /Maximum verification attempts exceeded/);
});

test('5. Employee Authentication: status check and PBKDF2 verification', () => {
  // Test valid login
  const staffLogin = AuthService.loginEmployee({
    identifier: 'staff',
    password: 'DemoPass@2026',
  });
  assert.equal(staffLogin.success, true);
  assert.equal(staffLogin.session?.role, 'Staff');

  // Test invalid password
  const badLogin = AuthService.loginEmployee({
    identifier: 'staff',
    password: 'WrongPassword',
  });
  assert.equal(badLogin.success, false);

  // Test disabled user account
  const newStaff = AdminManagementService.createUser({
    userName: 'disabledstaff',
    email: 'disabled@savor.restaurant',
    role: 'Staff',
    password: 'DemoPass@2026',
    adminUserName: 'admin',
  });
  assert.equal(newStaff.success, true);

  AdminManagementService.toggleUserStatus(newStaff.userId!);
  const disabledLogin = AuthService.loginEmployee({
    identifier: 'disabledstaff',
    password: 'DemoPass@2026',
  });
  assert.equal(disabledLogin.success, false, 'Disabled account must not be able to log in');
  assert.match(disabledLogin.message, /Account is disabled/);
});

test('6. Table Allocation & 105-Minute Blocking Window', () => {
  // Fresh booking
  const b1 = BookingService.createBooking({
    customerId: 'CUST-001',
    visitType: 'Online',
    partySize: 4,
    reservationDate: '2026-11-20',
    reservationTime: '19:00',
  });
  assert.equal(b1.success, true);

  const res1 = ReservationService.createReservation({
    bookingId: b1.booking!.Booking_ID,
    tableId: 'TBL-03',
    reservationDateTime: '2026-11-20T19:00:00',
    partySize: 4,
  });
  assert.equal(res1.success, true);

  // Attempting to book same table within 105 minutes should fail
  const b2 = BookingService.createBooking({
    customerId: 'CUST-002',
    visitType: 'Online',
    partySize: 4,
  });
  const res2 = ReservationService.createReservation({
    bookingId: b2.booking!.Booking_ID,
    tableId: 'TBL-03',
    reservationDateTime: '2026-11-20T19:45:00', // 45 minutes later -> inside 105-min block
    partySize: 4,
  });
  assert.equal(res2.success, false, 'Should reject overlapping reservation within 105 minutes');
});

test('7. Walk-In FIFO Capacity-Fit Queue', () => {
  const bWalkin = BookingService.createBooking({
    customerId: 'CUST-002',
    visitType: 'Walk-in',
    partySize: 2,
  });
  assert.equal(bWalkin.success, true);

  const qJoin = QueueService.joinQueue(bWalkin.booking!.Booking_ID, 2);
  assert.equal(qJoin.success, true);
  assert.equal(qJoin.position >= 1, true);

  const activeQueue = QueueService.getActiveQueue();
  const entry = activeQueue.find((e) => e.bookingId === bWalkin.booking!.Booking_ID);
  assert.ok(entry);
  // Capacity fit should recommend a suitable 2-person table
  if (entry?.recommendedTable) {
    assert.equal(Number(entry.recommendedTable.Seating_Capacity) >= 2, true);
  }
});

test('8. Order Authorization & Kitchen Workflow Gate', () => {
  // Create an online booking
  const bOrder = BookingService.createBooking({
    customerId: 'CUST-001',
    visitType: 'Online',
    partySize: 2,
  });

  // Submit order with food items
  const orderRes = OrderService.createOrder({
    bookingId: bOrder.booking!.Booking_ID,
    items: [
      { foodId: 'FOOD-01', quantity: 2 }, // Crispy Truffle Fries @ 280
      { foodId: 'FOOD-07', quantity: 1 }, // Molten Lava Cake @ 310
    ],
    createdByRole: 'Customer',
  });
  assert.equal(orderRes.success, true);
  assert.equal(orderRes.totalAmount, 2 * 280 + 310); // 870

  // Online orders CANNOT be authorized before customer arrival is verified by staff!
  const prematureAuth = OrderService.authorizeOrder(orderRes.orderId!, 'staff');
  assert.equal(prematureAuth.success, false, 'Online orders cannot be authorized before arrival');

  // Customer arrives and staff verifies
  ReservationService.customerConfirmArrival(bOrder.booking!.Booking_ID);
  ReservationService.staffVerifyArrival(bOrder.booking!.Booking_ID, 'staff');

  // Now staff authorization must succeed
  const validAuth = OrderService.authorizeOrder(orderRes.orderId!, 'staff');
  assert.equal(validAuth.success, true, 'Staff authorization should now succeed');

  // Kitchen queue must contain authorized order
  const kQueue = KitchenService.getKitchenQueue();
  const kTicket = kQueue.find((t) => t.Order_ID === orderRes.orderId);
  assert.ok(kTicket, 'Kitchen queue must receive authorized order');

  // Test KDS state transitions: Authorized -> In_Preparation -> Ready_For_Serving -> Served
  const prepRes = KitchenService.updatePreparationStatus({
    orderId: orderRes.orderId!,
    newStatus: 'In_Preparation',
    kitchenUserName: 'kitchen',
  });
  assert.equal(prepRes.success, true);

  const readyRes = KitchenService.updatePreparationStatus({
    orderId: orderRes.orderId!,
    newStatus: 'Ready_For_Serving',
    kitchenUserName: 'kitchen',
  });
  assert.equal(readyRes.success, true);

  const servedRes = KitchenService.updatePreparationStatus({
    orderId: orderRes.orderId!,
    newStatus: 'Served',
    kitchenUserName: 'kitchen',
  });
  assert.equal(servedRes.success, true);
});

test('9. Billing, Duplicate Prevention & Server Tax Calculation', () => {
  const bBill = BookingService.createBooking({
    customerId: 'CUST-003',
    visitType: 'Walk-in',
    partySize: 2,
  });

  TableService.seatCustomer(bBill.booking!.Booking_ID, 'TBL-02');

  const orderRes = OrderService.createOrder({
    bookingId: bBill.booking!.Booking_ID,
    items: [{ foodId: 'FOOD-05', quantity: 2 }], // Butter Chicken @ 560 = 1120
    createdByRole: 'Customer',
  });

  OrderService.authorizeOrder(orderRes.orderId!, 'staff');

  // Generate final bill when GST is unconfigured -> must block
  const blockedBillRes = BillingService.generateFinalBill({
    bookingId: bBill.booking!.Booking_ID,
    discountPercent: 10,
    discountReason: 'Welcome offer',
    staffUserName: 'staff',
  });
  assert.equal(blockedBillRes.success, false);
  assert.match(blockedBillRes.message, /Tax rate is not configured/);

  // Configure tax rate in Restaurant_Settings (simulating explicit owner approval)
  db.updateRow('Restaurant_Settings', 'Setting_Key', 'TAX_RATE_PERCENT', { Setting_Value: '5' });

  // Generate final bill with approved tax
  const billRes1 = BillingService.generateFinalBill({
    bookingId: bBill.booking!.Booking_ID,
    discountPercent: 10,
    discountReason: 'Welcome offer',
    staffUserName: 'staff',
  });
  assert.equal(billRes1.success, true);
  const bill = billRes1.bill!;

  assert.equal(Number(bill.Subtotal), 1120);
  assert.equal(Number(bill.Tax_Amount), 56); // 5% GST on 1120 = 56
  assert.equal(Number(bill.Discount), 112); // 10% discount on 1120 = 112
  assert.equal(Number(bill.Grand_Total), 1120 + 56 - 112); // 1064

  // Idempotency: generating bill again should return existing bill without duplicates
  const billRes2 = BillingService.generateFinalBill({
    bookingId: bBill.booking!.Booking_ID,
    staffUserName: 'staff',
  });
  assert.equal(billRes2.success, true);
  assert.equal(billRes2.bill?.Bill_ID, bill.Bill_ID);
});

test('10. Manual UPI Verification & Admin Refund Workflow', () => {
  const bPay = BookingService.createBooking({
    customerId: 'CUST-001',
    visitType: 'Walk-in',
    partySize: 2,
  });

  TableService.seatCustomer(bPay.booking!.Booking_ID, 'TBL-01');

  const ord = OrderService.createOrder({
    bookingId: bPay.booking!.Booking_ID,
    items: [{ foodId: 'FOOD-08', quantity: 2 }], // Tiramisu @ 290 = 580
    createdByRole: 'Customer',
  });
  OrderService.authorizeOrder(ord.orderId!, 'staff');

  const billRes = BillingService.generateFinalBill({
    bookingId: bPay.booking!.Booking_ID,
    staffUserName: 'staff',
  });
  const billId = billRes.bill!.Bill_ID;

  // Step 1: Customer submits UTR
  const utrSubmit = PaymentService.submitUPIReference({
    billId,
    transactionReference: 'UTR-987654321098',
    amountPaid: billRes.bill!.Grand_Total,
    submittedBy: 'Ananya Sharma',
  });
  assert.equal(utrSubmit.success, true);

  // Status must be Pending_Verification
  const pRecord = db.findOne('Payments', (p) => p.Payment_ID === utrSubmit.paymentId);
  assert.equal(pRecord?.Payment_Status, 'Pending_Verification');

  // Step 2: Staff confirms bank receipt
  const staffVerify = PaymentService.staffVerifyPaymentReceipt({
    paymentId: utrSubmit.paymentId!,
    staffUserName: 'staff',
    isConfirmed: true,
  });
  assert.equal(staffVerify.success, true);

  const verifiedP = db.findOne('Payments', (p) => p.Payment_ID === utrSubmit.paymentId);
  assert.equal(verifiedP?.Payment_Status, 'Paid');

  // Step 3: Staff requests partial refund
  const refundReq = RefundService.requestRefund({
    paymentId: utrSubmit.paymentId!,
    requestedAmount: 200,
    reason: 'Guest spilled dessert',
    staffUserName: 'staff',
  });
  assert.equal(refundReq.success, true);

  // Step 4: Admin reviews and approves refund
  const adminApprove = RefundService.adminReviewRefund({
    paymentId: utrSubmit.paymentId!,
    adminUserName: 'admin',
    decision: 'APPROVE',
  });
  assert.equal(adminApprove.success, true);

  // Step 5: Complete manual refund payout
  const completeRefund = RefundService.completeManualRefund({
    paymentId: utrSubmit.paymentId!,
    completedAmount: 200,
    refundReference: 'OUTBOUND-UTR-112233',
    completedByUserName: 'admin',
  });
  assert.equal(completeRefund.success, true);

  // Original payment record preserves history
  const refundedPayment = db.findOne('Payments', (p) => p.Payment_ID === utrSubmit.paymentId);
  assert.equal(refundedPayment?.Refund_Status, 'Completed');
  assert.equal(Number(refundedPayment?.Completed_Refund_Amount), 200);
});

test('11. Customer Departure & Table Sanitization Release', () => {
  const bDep = BookingService.createBooking({
    customerId: 'CUST-002',
    visitType: 'Walk-in',
    partySize: 2,
  });

  TableService.seatCustomer(bDep.booking!.Booking_ID, 'TBL-09');
  const tableBefore = db.findOne('Tables', (t) => t.Table_ID === 'TBL-09');
  assert.equal(tableBefore?.Table_Status, 'Occupied');

  // Create order and paid bill
  const ord = OrderService.createOrder({
    bookingId: bDep.booking!.Booking_ID,
    items: [{ foodId: 'FOOD-09', quantity: 2 }],
    createdByRole: 'Customer',
  });
  OrderService.authorizeOrder(ord.orderId!, 'staff');

  const bill = BillingService.generateFinalBill({
    bookingId: bDep.booking!.Booking_ID,
    staffUserName: 'staff',
  });

  const pay = PaymentService.submitUPIReference({
    billId: bill.bill!.Bill_ID,
    transactionReference: 'UTR-PAID-001',
    amountPaid: bill.bill!.Grand_Total,
    submittedBy: 'Vikram Patel',
  });
  PaymentService.staffVerifyPaymentReceipt({
    paymentId: pay.paymentId!,
    staffUserName: 'staff',
    isConfirmed: true,
  });

  // Departure confirmed
  const depRes = PaymentService.confirmDepartureAndReleaseTable({
    bookingId: bDep.booking!.Booking_ID,
    tableId: 'TBL-09',
    staffUserName: 'staff',
  });
  assert.equal(depRes.success, true);

  const tableAfter = db.findOne('Tables', (t) => t.Table_ID === 'TBL-09');
  assert.equal(tableAfter?.Table_Status, 'Available', 'Table should be released to Available');
});

test('12. Single Feedback Submission per Completed Visit', () => {
  const bFeed = BookingService.createBooking({
    customerId: 'CUST-003',
    visitType: 'Walk-in',
    partySize: 2,
  });

  // Cannot submit feedback before visit is completed
  const earlyFeed = BookingService.submitFeedback({
    bookingId: bFeed.booking!.Booking_ID,
    customerId: 'CUST-003',
    rating: 5,
  });
  assert.equal(earlyFeed.success, false, 'Feedback must only be allowed for completed visits');

  // Mark completed
  db.updateRow('Bookings', 'Booking_ID', bFeed.booking!.Booking_ID, {
    Booking_Status: 'Completed',
  });

  // First feedback submission should succeed
  const feed1 = BookingService.submitFeedback({
    bookingId: bFeed.booking!.Booking_ID,
    customerId: 'CUST-003',
    rating: 5,
    comment: 'Exquisite food and polite staff!',
  });
  assert.equal(feed1.success, true);

  // Second feedback submission must be rejected
  const feed2 = BookingService.submitFeedback({
    bookingId: bFeed.booking!.Booking_ID,
    customerId: 'CUST-003',
    rating: 4,
  });
  assert.equal(feed2.success, false, 'Duplicate feedback submission must be rejected');
});

test('13. Table-Specific QR Code Generation, Validation & Regeneration', async () => {
  const allQrs = QRService.getAllTableQRs('https://savor-dinein.app');
  assert.ok(allQrs.length >= 10, 'Should generate QR metadata for all tables');

  const qr1 = allQrs.find((q) => q.tableId === 'TBL-01');
  const qr3 = allQrs.find((q) => q.tableId === 'TBL-03');
  assert.ok(qr1 && qr3, 'TBL-01 and TBL-03 QR records must exist');
  assert.notEqual(qr1.token, qr3.token, 'Different tables must have unique unguessable QR tokens');

  // Verify token resolution
  const resolved = QRService.resolveTableByToken(qr3.token);
  assert.equal(resolved.success, true);
  assert.equal(resolved.table?.Table_ID, 'TBL-03');

  // Verify QR image generation produces valid PNG Data URL
  const dataUrl = await QRService.generateQRDataUrl(qr3.qrUrl);
  assert.ok(dataUrl.startsWith('data:image/png;base64,'));

  // Disabling QR rejects scan
  QRService.toggleTableQR('TBL-03', false);
  const disabledCheck = QRService.resolveTableByToken(qr3.token);
  assert.equal(disabledCheck.success, false, 'Disabled QR code must be rejected');

  // Re-enabling and regenerating invalidates old token
  QRService.toggleTableQR('TBL-03', true);
  const newToken = QRService.generateTableToken('TBL-03', true);
  assert.notEqual(newToken, qr3.token, 'Regenerated token must differ from old token');
  assert.equal(QRService.resolveTableByToken(qr3.token).success, false, 'Old token must be invalidated');
  assert.equal(QRService.resolveTableByToken(newToken).success, true, 'New token must resolve');
});

test('14. Persistent Draft Cart Restoration Across Sessions', async () => {
  const custId = 'CUST-001';
  await CartService.saveDraftCart({
    customerId: custId,
    tableId: 'TBL-03',
    items: [
      { foodId: 'FOOD-01', quantity: 2 },
      { foodId: 'FOOD-04', quantity: 1 },
    ],
    updatedAt: new Date().toISOString(),
  });

  const restored = await CartService.getDraftCart(custId);
  assert.equal(restored.success, true);
  assert.equal(restored.data.items.length, 2, 'All saved cart items must restore');
  assert.equal(restored.data.tableId, 'TBL-03', 'Table association must be preserved');
  assert.equal(restored.data.items[0].quantity, 2);

  await CartService.clearDraftCart(custId);
  const afterClear = await CartService.getDraftCart(custId);
  assert.equal(afterClear.data.items.length, 0);
});

test('15. Cross-Device Deterministic Table QR Resolution', () => {
  // Simulate a fresh browser scanning a deterministic default QR token before Admin opens QR settings
  const defaultToken = QRService.computeDefaultToken('TBL-07');
  assert.ok(defaultToken.startsWith('TBLQR_TBL07_'));

  // Remove any cached TABLE_QR_TBL-07 setting to simulate cold device state
  db.deleteRow('Restaurant_Settings', 'Setting_Key', 'TABLE_QR_TBL-07');

  const resolved = QRService.resolveTableByToken(defaultToken);
  assert.equal(resolved.success, true, 'Default QR token should resolve on a fresh device');
  assert.equal(resolved.table?.Table_ID, 'TBL-07');
});

test('16. Order Creation, Staff Authorization Gate, Kitchen Visibility & Line Item Lifecycle', () => {
  // Customer books Online reservation and places multi-item order with special instructions
  const booking = BookingService.createBooking({
    customerId: 'CUST-001',
    visitType: 'Online',
    partySize: 2,
    reservationDate: '2026-09-12',
    reservationTime: '19:30',
  });
  assert.equal(booking.success, true);

  const created = OrderService.createOrder({
    bookingId: booking.booking!.Booking_ID,
    createdByRole: 'Customer',
    specialInstructions: 'Less spicy, extra butter',
    items: [
      { foodId: 'FOOD-01', quantity: 2 },
      { foodId: 'FOOD-04', quantity: 1 },
    ],
  });
  assert.equal(created.success, true);
  assert.equal(created.orderStatus, 'Submitted', 'Customer order must enter Submitted awaiting staff authorization');

  // Verify bill does not exist and unauthorized order is NOT visible in Kitchen
  const existingBill = db.findOne('Bills', (b) => b.Booking_ID === booking.booking!.Booking_ID);
  assert.equal(existingBill, null, 'Bill must not exist yet');

  const unauthorizedQueue = KitchenService.getKitchenQueue(false);
  assert.equal(
    unauthorizedQueue.some((t: any) => t.Order_ID === created.orderId),
    false,
    'Kitchen queue must NOT display unauthorized orders'
  );

  // Pre-authorization item quantity modification
  const initialItems = db.findRows('Order_Items', (i) => i.Order_ID === created.orderId);
  const qtyUpdate = OrderService.updateItemQuantity({
    orderItemId: initialItems[0].Order_Item_ID,
    quantity: 3,
    changedBy: 'staff',
  });
  assert.equal(qtyUpdate.success, true);
  const updatedItem = db.findOne('Order_Items', (i) => i.Order_Item_ID === initialItems[0].Order_Item_ID);
  assert.equal(updatedItem?.Quantity, 3);
  assert.equal(updatedItem?.Subtotal, 3 * Number(updatedItem?.Unit_Price));

  // Online order cannot be authorized before arrival is verified
  const earlyAuth = OrderService.authorizeOrder(created.orderId!, 'staff');
  assert.equal(earlyAuth.success, false, 'Cannot authorize online order before verified arrival');

  // Customer confirms arrival within grace
  const arr = ReservationService.customerConfirmArrival(booking.booking!.Booking_ID, 'CUST-001');
  assert.equal(arr.success, true);

  // Staff verifies arrival
  const staffVer = ReservationService.staffVerifyArrival(booking.booking!.Booking_ID, 'staff');
  assert.equal(staffVer.success, true);

  // Staff authorizes order
  const authRes = OrderService.authorizeOrder(created.orderId!, 'staff');
  assert.equal(authRes.success, true, 'Staff authorization must succeed after verified arrival');

  // Now order appears in Kitchen Display
  const kitchenTickets = KitchenService.getKitchenQueue(false);
  const matching = kitchenTickets.filter((t: any) => t.Order_ID === created.orderId);
  assert.equal(matching.length, 1, 'Authorized order must appear in Kitchen queue');
  assert.equal(matching[0].customerName, 'Ananya Sharma');
  assert.equal(matching[0].specialInstructions, 'Less spicy, extra butter');

  // Per-item updates sync & order progresses Accepted -> Preparing -> Ready -> Served
  assert.equal(
    KitchenService.updatePreparationStatus({
      orderId: created.orderId!,
      newStatus: 'Accepted',
      kitchenUserName: 'chef1',
    }).success,
    true
  );

  const firstItemId = matching[0].items[0].Order_Item_ID;
  const itemUpdate = KitchenService.updateOrderItemStatus({
    orderItemId: firstItemId,
    newStatus: 'Preparing',
    kitchenUserName: 'chef1',
  });
  assert.equal(itemUpdate.success, true);

  const inPrepTicket = KitchenService.getKitchenQueue(false).find(
    (t: any) => t.Order_ID === created.orderId
  );
  assert.ok(inPrepTicket);
  assert.equal(inPrepTicket.Order_Status, 'Preparing');

  assert.equal(
    KitchenService.updatePreparationStatus({
      orderId: created.orderId!,
      newStatus: 'Ready',
      kitchenUserName: 'chef1',
    }).success,
    true
  );
  assert.equal(
    KitchenService.updatePreparationStatus({
      orderId: created.orderId!,
      newStatus: 'Served',
      kitchenUserName: 'chef1',
    }).success,
    true
  );

  const servedTicket = KitchenService.getKitchenQueue(true).find(
    (t: any) => t.Order_ID === created.orderId
  );
  assert.ok(servedTicket, 'Served order must appear when includeServed=true');
  assert.equal(servedTicket.Order_Status, 'Served');
});

test('17. Customer Extra Orders, Staff Order Creation & Final Bill Aggregation', () => {
  const bVisit = BookingService.createBooking({
    customerId: 'CUST-002',
    visitType: 'Walk-in',
    partySize: 2,
  });
  assert.equal(bVisit.success, true);
  const bkId = bVisit.booking!.Booking_ID;

  // Seat customer
  TableService.seatCustomer(bkId, 'TBL-02');

  // Order 1 (First Order by Customer)
  const ord1 = OrderService.createOrder({
    bookingId: bkId,
    createdByRole: 'Customer',
    items: [{ foodId: 'FOOD-01', quantity: 1 }], // 280
  });
  assert.equal(ord1.success, true);
  OrderService.authorizeOrder(ord1.orderId!, 'staff');

  // Order 2 (Customer "Add More Items" to same Booking_ID)
  const ord2 = OrderService.createOrder({
    bookingId: bkId,
    createdByRole: 'Customer',
    items: [{ foodId: 'FOOD-03', quantity: 2 }], // 360 * 2 = 720
  });
  assert.equal(ord2.success, true);
  OrderService.authorizeOrder(ord2.orderId!, 'staff');

  // Order 3 (Staff creates order on behalf of customer for same Booking_ID)
  const ord3 = OrderService.createOrder({
    bookingId: bkId,
    createdByRole: 'Staff',
    items: [{ foodId: 'FOOD-05', quantity: 1 }], // 560
  });
  assert.equal(ord3.success, true);
  OrderService.authorizeOrder(ord3.orderId!, 'staff');

  // Generate single final bill covering all 3 orders: 280 + 720 + 560 = 1560
  const billRes = BillingService.generateFinalBill({
    bookingId: bkId,
    staffUserName: 'staff',
  });
  assert.equal(billRes.success, true);
  assert.equal(billRes.bill?.Subtotal, 1560, 'Final bill must aggregate all accepted orders for the booking');

  // Duplicate final bill prevention
  const dupBill = BillingService.generateFinalBill({
    bookingId: bkId,
    staffUserName: 'staff',
  });
  assert.equal(dupBill.bill?.Bill_ID, billRes.bill?.Bill_ID, 'Bill generation must be idempotent');
});

test('18. Customer Completed Visit Feedback, Ownership Validation & Bookings Sheet Storage', () => {
  const bRes = BookingService.createBooking({
    customerId: 'CUST-002',
    visitType: 'Walk-in',
    partySize: 2,
  });
  assert.equal(bRes.success, true);
  const bkId = bRes.booking!.Booking_ID;

  // Cannot submit feedback while visit is uncompleted
  const earlyFb = FeedbackService.submitOrderFeedback({
    bookingId: bkId,
    customerId: 'CUST-002',
    overallRating: 5,
    comments: 'Too early',
  });
  assert.equal(earlyFb.success, false, 'Cannot submit feedback before visit is Completed');

  // Mark completed
  db.updateRow('Bookings', 'Booking_ID', bkId, { Booking_Status: 'Completed' });

  // Imposter customer blocked
  const imposter = FeedbackService.submitOrderFeedback({
    bookingId: bkId,
    customerId: 'CUST-001',
    overallRating: 2,
    comments: 'Imposter review',
  });
  assert.equal(imposter.success, false, 'Unauthorized customer must be blocked');

  // Valid submission saved in Bookings
  const validFb = FeedbackService.submitOrderFeedback({
    bookingId: bkId,
    customerId: 'CUST-002',
    customerName: 'Vikram Patel',
    overallRating: 5,
    comments: 'Wonderful dining experience!',
  });
  assert.equal(validFb.success, true);

  const bkRow = db.findOne('Bookings', (b) => b.Booking_ID === bkId);
  assert.equal(bkRow?.Feedback_Rating, 5);
  assert.equal(bkRow?.Feedback_Comment, 'Wonderful dining experience!');
  assert.ok(bkRow?.Feedback_Submitted_At);

  // Duplicate submission blocked
  const dupFb = FeedbackService.submitOrderFeedback({
    bookingId: bkId,
    customerId: 'CUST-002',
    overallRating: 4,
    comments: 'Duplicate attempt',
  });
  assert.equal(dupFb.success, false, 'Duplicate feedback for same completed booking must fail');
});

test('19. Persistent Trusted Customer Session & Profile Update', () => {
  // Test unique mobile & email on registration
  const dupReg = AuthService.requestCustomerOTP({
    mobileNumber: '9876543299',
    customerName: 'New Guest',
    email: 'ananya.sharma@example.com', // already registered to CUST-001
  });
  // Since requestCustomerOTP is async:
  return dupReg.then((res) => {
    assert.equal(res.success, false, 'Duplicate email on new registration must be rejected');

    // Customer profile update
    const updateRes = AuthService.updateCustomerProfile({
      customerId: 'CUST-001',
      customerName: 'Ananya S. Updated',
      email: 'ananya.updated@example.com',
    });
    assert.equal(updateRes.success, true);
    const updatedCust = db.findOne('Customers', (c) => c.Customer_ID === 'CUST-001');
    assert.equal(updatedCust?.Customer_Name, 'Ananya S. Updated');

    // Trusted session verification & sliding renewal
    const quick = AuthService.demoQuickLoginCustomer('9876543210');
    assert.equal(quick.success, true);
    const check1 = AuthService.validateSession(quick.session!.sessionId);
    assert.equal(check1.isValid, true);
    assert.equal(check1.customer?.customerId, 'CUST-001');

    // Logout revokes session
    AuthService.logout(quick.session!.sessionId);
    const check2 = AuthService.validateSession(quick.session!.sessionId);
    assert.equal(check2.isValid, false, 'Logged out session must be invalidated');
  });
});

test('20. Treat & Taste Central Branding Configuration', () => {
  assert.equal(BRAND_CONFIG.name, 'Treat & Taste');
  assert.equal(BRAND_CONFIG.subtitle, 'Family Restaurant');
  assert.equal(BRAND_CONFIG.colors.primaryBrown, '#3B1A08');
  assert.equal(BRAND_CONFIG.colors.warmOrange, '#F56A00');
  assert.equal(BRAND_CONFIG.colors.goldenYellow, '#F4B41A');
});

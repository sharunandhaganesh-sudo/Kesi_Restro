/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 3. Staff Website (Apple-Inspired UI/UX Design System)
 * Operational Command Center:
 * - Arrival Verification (15-min window)
 * - Walk-in Queue Manager with capacity-fit recommendation & call protection
 * - Floor Table Map & Seating controls (Table_Status: Available, Occupied, Unavailable)
 * - Order Authorization for Kitchen
 * - Final Bill generation with duplicate lock & max 10% discount validation
 * - Manual UPI receipt verification (matching bank credit vs UTR)
 * - Customer departure & table turnover (15-min cleaning allowance)
 * - Refund request initiation for admin approval
 */

import React, { useState, useEffect } from 'react';
import { RequestDispatcher } from '../../backend/dispatcher';
import { UserSessionState } from '../types';
import { BrandLogo } from '../components/BrandLogo';
import { BRAND_CONFIG } from '../../config/branding';
import { notificationHub } from '../services/notificationHub';
import {
  ConciergeBell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Armchair,
  FileText,
  CreditCard,
  Users,
  Send,
  LogOut,
  RefreshCw,
  Sparkles,
  ChevronRight,
  Filter,
  Check,
  X,
  UtensilsCrossed,
  ChefHat,
  MessageSquareText,
  LayoutGrid,
} from 'lucide-react';

interface StaffWebsiteProps {
  session: UserSessionState | null;
  onSetSession: (session: UserSessionState) => void;
  onLogout: () => void;
}

export const StaffWebsite: React.FC<StaffWebsiteProps> = ({
  session,
  onSetSession,
  onLogout,
}) => {
  // Login form state
  const [identifier, setIdentifier] = useState<string>('staff');
  const [password, setPassword] = useState<string>('DemoPass@2026');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Operational data
  const [dashboardData, setDashboardData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'arrivals' | 'queue' | 'tables' | 'orders' | 'billing' | 'payments'
  >('arrivals');
  const [loading, setLoading] = useState<boolean>(false);

  // Bill Generation modal state
  const [selectedBookingForBill, setSelectedBookingForBill] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [discountReason, setDiscountReason] = useState<string>('');

  // Refund request modal state
  const [refundPaymentId, setRefundPaymentId] = useState<string>('');
  const [refundAmount, setRefundAmount] = useState<number>(0);
  const [refundReason, setRefundReason] = useState<string>('');
  const [showRefundModal, setShowRefundModal] = useState<boolean>(false);

  // Table Floor Map management state
  const [selectedTableForAction, setSelectedTableForAction] = useState<any | null>(null);
  const [tableFilter, setTableFilter] = useState<'all' | 'available' | 'occupied' | 'reserved' | 'unavailable'>('all');
  const [selectedBookingForAllocation, setSelectedBookingForAllocation] = useState<string>('');

  // Booking search query
  const [bookingSearchQuery, setBookingSearchQuery] = useState<string>('');

  // Toast
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Staff Create / Add Items Order Builder state
  const [staffMenu, setStaffMenu] = useState<any[]>([]);
  const [showStaffOrderBuilder, setShowStaffOrderBuilder] = useState<boolean>(false);
  const [staffOrderBookingId, setStaffOrderBookingId] = useState<string>('');
  const [staffOrderCart, setStaffOrderCart] = useState<Array<{ food: any; quantity: number }>>([]);
  const [staffOrderNote, setStaffOrderNote] = useState<string>('');

  useEffect(() => {
    if (session?.sessionId && (session.role === 'Staff' || session.role === 'Admin')) {
      loadStaffDashboard();
      RequestDispatcher.dispatch({ action: 'getPublicMenu' }).then((r) => {
        if (r.success && Array.isArray(r.data)) setStaffMenu(r.data);
      });
      const interval = setInterval(loadStaffDashboard, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  // Handle background scroll locking and escape key dismissal for staff modals
  useEffect(() => {
    if (!showRefundModal && !selectedTableForAction) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowRefundModal(false);
        setSelectedTableForAction(null);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showRefundModal, selectedTableForAction]);

  async function loadStaffDashboard() {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'getStaffDashboard',
      sessionId: session.sessionId,
    });
    if (res.success && res.data) {
      setDashboardData(res.data);

      // 1. Detect unverified arrivals waiting at the host desk
      if (Array.isArray(res.data.unverifiedArrivals)) {
        for (const arr of res.data.unverifiedArrivals) {
          const seenKey = `arrival_${arr.Booking_ID}`;
          if (!notificationHub.hasSeen(seenKey)) {
            notificationHub.publish({
              id: seenKey,
              type: 'ARRIVAL_REGISTERED',
              title: 'Customer Arrival Registered',
              message: `Customer ${arr.Customer_Name || 'Guest'} (${arr.Booking_ID}) has arrived at the host desk. 15-minute verification window active.`,
              timestamp: Date.now(),
              priority: 'critical',
              metadata: {
                bookingId: arr.Booking_ID,
                customerName: arr.Customer_Name,
                partySize: arr.Party_Size,
              },
              actionLabel: 'Verify Arrival',
              autoDismissMs: 0,
            });
          }
        }
      }

      // 2. Detect recent reservations
      if (Array.isArray(res.data.bookings)) {
        for (const b of res.data.bookings) {
          const seenKey = `res_${b.Booking_ID}`;
          if (!notificationHub.hasSeen(seenKey)) {
            const isRecent = b.Created_At ? (Date.now() - new Date(b.Created_At).getTime() < 15 * 60 * 1000) : true;
            if (isRecent) {
              notificationHub.publish({
                id: seenKey,
                type: 'NEW_RESERVATION',
                title: 'New Reservation Received',
                message: `Customer: ${b.Customer_Name || 'Guest'} | ID: ${b.Booking_ID} | Party: ${b.Party_Size} Guests | Date: ${b.Booking_Date || 'Today'} ${b.Booking_Time || ''}`,
                timestamp: Date.now(),
                priority: 'high',
                metadata: {
                  bookingId: b.Booking_ID,
                  customerName: b.Customer_Name,
                  partySize: b.Party_Size,
                },
                actionLabel: 'View Booking',
                autoDismissMs: 8000,
              });
            } else {
              notificationHub.markSeen(seenKey);
            }
          }
        }
      }
    }
  }

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const res = await RequestDispatcher.dispatch({
      action: 'loginEmployee',
      payload: { identifier, password },
    });

    setAuthLoading(false);
    if (res.success && res.data) {
      if (res.data.role !== 'Staff' && res.data.role !== 'Admin') {
        setAuthError('Unauthorized: This console is reserved for Staff and Administrators.');
        return;
      }
      onSetSession(res.data);
      showToast('success', `Welcome back, ${res.data.name}!`);
    } else {
      setAuthError(res.error?.message || 'Invalid staff credentials.');
    }
  }

  // Arrival verification
  async function handleVerifyArrival(bookingId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'verifyCustomerArrival',
      sessionId: session.sessionId,
      payload: { bookingId },
    });
    if (res.success) {
      showToast('success', res.message || 'Arrival confirmed.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Verification failed.');
    }
  }

  // Call queue customer to table (with atomic protection)
  async function handleCallCustomer(bookingId: string, tableId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'callQueueCustomer',
      sessionId: session.sessionId,
      payload: { bookingId, tableId },
    });
    if (res.success) {
      showToast('success', res.message || 'Party called to table.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Could not call customer.');
    }
  }

  // Allocate table to booking
  async function handleAllocateTable(bookingId: string, tableId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'allocateTable',
      sessionId: session.sessionId,
      payload: { bookingId, tableId },
    });
    if (res.success) {
      showToast('success', res.message || 'Table allocated successfully.');
      loadStaffDashboard();
      setSelectedTableForAction(null);
    } else {
      showToast('error', res.error?.message || 'Could not allocate table.');
    }
  }

  // Seat customer
  async function handleSeatCustomer(bookingId: string, tableId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'seatCustomer',
      sessionId: session.sessionId,
      payload: { bookingId, tableId },
    });
    if (res.success) {
      showToast('success', res.message || 'Guests seated successfully.');
      loadStaffDashboard();
      setSelectedTableForAction(null);
    } else {
      showToast('error', res.error?.message || 'Could not seat customer.');
    }
  }

  // Authorize order for kitchen
  async function handleAuthorizeOrder(orderId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'authorizeOrder',
      sessionId: session.sessionId,
      payload: { orderId },
    });
    if (res.success) {
      showToast('success', res.message || 'Order authorized for Kitchen ticket queue.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Order authorization failed.');
    }
  }

  async function handleStaffCreateOrder() {
    if (!session?.sessionId || !staffOrderBookingId || staffOrderCart.length === 0) return;
    const res = await RequestDispatcher.dispatch({
      action: 'staffCreateOrder',
      sessionId: session.sessionId,
      payload: {
        bookingId: staffOrderBookingId,
        items: staffOrderCart.map((c) => ({ foodId: c.food.Food_ID, quantity: c.quantity })),
        specialInstructions: staffOrderNote.trim(),
      },
    });
    if (res.success) {
      setStaffOrderCart([]);
      setStaffOrderNote('');
      setShowStaffOrderBuilder(false);
      showToast('success', 'Order created for booking! Click Authorize for Kitchen when ready.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Failed to create order.');
    }
  }

  async function handleUpdateItemQty(orderItemId: string, quantity: number) {
    if (!session?.sessionId || quantity < 1) return;
    const res = await RequestDispatcher.dispatch({
      action: 'updateOrderItemQuantity',
      sessionId: session.sessionId,
      payload: { orderItemId, quantity },
    });
    if (res.success) {
      showToast('success', res.message || 'Quantity updated.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Failed to update quantity.');
    }
  }

  async function handleCancelOrReplaceItem(
    orderItemId: string,
    action: 'CANCEL' | 'REPLACE',
    reason: string,
    replacementFoodId?: string
  ) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'cancelOrReplaceItem',
      sessionId: session.sessionId,
      payload: { orderItemId, action, reason, replacementFoodId },
    });
    if (res.success) {
      showToast('success', res.message || 'Item updated.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Item update failed.');
    }
  }

  // Generate final bill
  async function handleGenerateBill(bookingId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'generateBill',
      sessionId: session.sessionId,
      payload: {
        bookingId,
        discountPercent,
        discountReason,
      },
    });
    if (res.success) {
      showToast('success', res.message || 'Final bill generated.');
      setSelectedBookingForBill('');
      setDiscountPercent(0);
      setDiscountReason('');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Could not generate bill.');
    }
  }

  // Verify manual UPI payment receipt
  async function handleVerifyPaymentReceipt(paymentId: string, isConfirmed: boolean) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'verifyPaymentReceipt',
      sessionId: session.sessionId,
      payload: { paymentId, isConfirmed },
    });
    if (res.success) {
      showToast('success', res.message || 'Payment status updated in registry.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Failed to update payment.');
    }
  }

  // Confirm customer departure and clean table
  async function handleConfirmDeparture(bookingId: string, tableId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'confirmDeparture',
      sessionId: session.sessionId,
      payload: { bookingId, tableId },
    });
    if (res.success) {
      showToast('success', res.message || 'Departure confirmed. Table queued for 15-minute turnover cleaning.');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Departure action failed.');
    }
  }

  // Submit refund request
  async function handleSubmitRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.sessionId || !refundPaymentId) return;

    const res = await RequestDispatcher.dispatch({
      action: 'requestRefund',
      sessionId: session.sessionId,
      payload: {
        paymentId: refundPaymentId,
        requestedAmount: refundAmount,
        reason: refundReason,
      },
    });

    if (res.success) {
      showToast('success', 'Refund request submitted for administrator review.');
      setShowRefundModal(false);
      setRefundPaymentId('');
      setRefundAmount(0);
      setRefundReason('');
      loadStaffDashboard();
    } else {
      showToast('error', res.error?.message || 'Could not submit refund request.');
    }
  }

  function showToast(type: 'success' | 'error', text: string) {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }

  const isStaffAuthenticated =
    session && (session.role === 'Staff' || session.role === 'Admin');

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#3B1A08] pb-24">
      {/* Toast Notification */}
      {notice && (
        <div
          className={`fixed top-20 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium transition-all ${
            notice.type === 'success'
              ? 'bg-white border-[#248A3D]/30 text-[#248A3D]'
              : 'bg-white border-[#D70015]/30 text-[#D70015]'
          }`}
        >
          {notice.type === 'success' ? (
            <CheckCircle2 className="w-4 h-4 text-[#248A3D]" />
          ) : (
            <AlertCircle className="w-4 h-4 text-[#D70015]" />
          )}
          <span>{notice.text}</span>
        </div>
      )}

      {/* Staff Authentication Guard */}
      {!isStaffAuthenticated ? (
        <div className="max-w-md mx-auto pt-14 px-4">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E6D5C3] space-y-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <BrandLogo size="md" />
              </div>
              <div className="pt-1">
                <h2 className="text-2xl font-bold tracking-tight text-[#3B1A08]">
                  Staff Operations Console
                </h2>
                <p className="text-xs text-[#6B4C35] max-w-xs mx-auto mt-1">
                  Table allocation, arrival verification, live kitchen order tracking, and billing.
                </p>
              </div>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                  Staff Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. staff"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-sm text-[#3B1A08] placeholder-[#6B4C35]/50 focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-sm text-[#3B1A08] placeholder-[#6B4C35]/50 focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 transition"
                />
                <span className="block text-[11px] text-[#6B4C35] mt-1.5">
                  Default demo staff password: <code className="bg-[#FDF4E7] px-1.5 py-0.5 rounded text-[#3B1A08] font-mono">DemoPass@2026</code>
                </span>
              </div>

              {authError && (
                <div className="text-xs text-[#D70015] bg-[#D70015]/10 p-3 rounded-xl flex items-center space-x-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white font-semibold text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {authLoading ? 'Authenticating...' : 'Sign In to Staff Console'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Operational Command Center */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-xs border border-[#E6D5C3]">
            <div className="flex items-center space-x-3.5">
              <BrandLogo size="sm" variant="icon" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#3B1A08]">
                  {BRAND_CONFIG.name} — Staff Operations
                </h1>
                <p className="text-xs text-[#6B4C35]">
                  Signed in as <strong className="text-[#3B1A08]">{session.name}</strong> ({session.role}) • Live 5s sync active
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadStaffDashboard}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#FDF4E7] border border-[#E6D5C3] hover:bg-[#F5E6D3] text-[#3B1A08] text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#F56A00]" />
                <span>Refresh</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#D70015]/10 text-[#D70015] hover:bg-[#D70015]/20 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>

          {/* Navigation Pills */}
          <div className="flex overflow-x-auto p-1.5 bg-[#FDF4E7] border border-[#E6D5C3] rounded-full max-w-full no-scrollbar">
            {[
              { id: 'arrivals', label: 'Arrivals & Bookings', count: dashboardData?.unverifiedArrivals?.length },
              { id: 'queue', label: 'Walk-In Queue', count: dashboardData?.queue?.length },
              { id: 'tables', label: 'Floor Table Map', count: dashboardData?.tables?.length },
              {
                id: 'orders',
                label: 'Live Orders & Kitchen Status',
                count: dashboardData?.allOrders?.filter((o: any) => o.Order_Status !== 'Served' && o.Order_Status !== 'Cancelled').length,
              },
              { id: 'billing', label: 'Bill Generation' },
              { id: 'payments', label: 'UPI Verification', count: dashboardData?.pendingPayments?.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-semibold transition-all cursor-pointer ${
                  activeTab === tab.id
                    ? 'bg-[#3B1A08] text-white shadow-xs'
                    : 'text-[#6B4C35] hover:text-[#3B1A08]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-bold ${
                    activeTab === tab.id
                      ? 'bg-[#F56A00] text-white'
                      : 'bg-[#F4B41A]/30 text-[#3B1A08]'
                  }`}>
                    {tab.count}
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* TAB 1: Arrivals & Upcoming Bookings */}
          {activeTab === 'arrivals' && (
            <div className="space-y-6">
              {/* Unverified Arrivals Banner (15-Min window) */}
              {dashboardData?.unverifiedArrivals && dashboardData.unverifiedArrivals.length > 0 && (
                <div className="p-5 rounded-3xl bg-[#F4B41A]/15 border border-[#F4B41A]/40 space-y-3">
                  <div className="flex items-center space-x-2 text-[#B45309] font-semibold text-sm">
                    <Clock className="w-4 h-4 text-[#F56A00] animate-spin" />
                    <span>Customer Arrivals Awaiting Staff Verification (15-Minute Window)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dashboardData.unverifiedArrivals.map((b: any) => (
                      <div
                        key={b.Booking_ID}
                        className="bg-white p-4 rounded-2xl border border-[#F4B41A]/40 shadow-xs flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-sm font-semibold text-[#3B1A08] block">{b.customerName}</strong>
                          <span className="text-xs text-[#6B4C35]">
                            {b.Booking_ID} • {b.Party_Size} Guests • {b.Visit_Type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleVerifyArrival(b.Booking_ID)}
                          className="px-3.5 py-2 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          Verify Arrival
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Upcoming Bookings */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-4">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div>
                    <h3 className="font-bold text-base text-[#3B1A08]">
                      Upcoming Bookings & Reservations
                    </h3>
                    <span className="text-xs text-[#6B4C35]">
                      {dashboardData?.bookings?.length || 0} total bookings recorded
                    </span>
                  </div>
                  <div className="w-full sm:w-80">
                    <input
                      type="text"
                      placeholder="Search Booking ID, Customer, Mobile..."
                      value={bookingSearchQuery}
                      onChange={(e) => setBookingSearchQuery(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0] text-xs text-[#3B1A08] placeholder-[#6B4C35]/50 focus:outline-none focus:border-[#F56A00] transition"
                    />
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#E6D5C3] text-[#6B4C35]">
                        <th className="p-3 font-semibold">Booking ID</th>
                        <th className="p-3 font-semibold">Customer</th>
                        <th className="p-3 font-semibold">Type</th>
                        <th className="p-3 font-semibold">Party</th>
                        <th className="p-3 font-semibold">Date & Time</th>
                        <th className="p-3 font-semibold">Table</th>
                        <th className="p-3 font-semibold">Status</th>
                        <th className="p-3 font-semibold text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E6D5C3]/50 text-[#3B1A08]">
                      {(dashboardData?.bookings || [])
                        .filter((b: any) => {
                          const q = bookingSearchQuery.trim().toLowerCase();
                          if (!q) return true;
                          return (
                            String(b.Booking_ID || '').toLowerCase().includes(q) ||
                            String(b.customerName || '').toLowerCase().includes(q) ||
                            String(b.customerMobile || '').toLowerCase().includes(q) ||
                            String(b.tableNumber || '').toLowerCase().includes(q) ||
                            String(b.Booking_Status || '').toLowerCase().includes(q)
                          );
                        })
                        .map((b: any) => (
                        <tr key={b.Booking_ID} className="hover:bg-[#FDF4E7]/60 transition">
                          <td className="p-3 font-mono font-semibold text-[#F56A00]">
                            {b.Booking_ID}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold block">{b.customerName}</span>
                            <span className="text-[11px] text-[#6B4C35]">{b.customerMobile}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                                b.Visit_Type === 'Online'
                                  ? 'bg-[#3B1A08]/10 text-[#3B1A08]'
                                  : 'bg-[#F4B41A]/25 text-[#92400E]'
                              }`}
                            >
                              {b.Visit_Type}
                            </span>
                          </td>
                          <td className="p-3">{b.Party_Size} Guests</td>
                          <td className="p-3">
                            {b.Reservation_Date} @ {b.Reservation_Time}
                          </td>
                          <td className="p-3 font-medium">
                            {b.tableNumber ? `Table ${b.tableNumber}` : <span className="text-[#6B4C35]">Unassigned</span>}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-semibold ${
                              b.Booking_Status === 'Seated'
                                ? 'bg-[#248A3D]/10 text-[#248A3D]'
                                : b.Booking_Status === 'Arrived'
                                ? 'bg-[#F4B41A]/25 text-[#92400E]'
                                : 'bg-[#FDF4E7] text-[#3B1A08]'
                            }`}>
                              {b.Booking_Status}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1.5">
                            {b.Booking_Status === 'Confirmed' && (
                              <button
                                onClick={() => handleVerifyArrival(b.Booking_ID)}
                                className="px-3 py-1.5 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold transition cursor-pointer"
                              >
                                Verify Arrival
                              </button>
                            )}
                            {b.Booking_Status === 'Arrived' && (
                              <button
                                onClick={() => {
                                  if (b.tableId) {
                                    handleSeatCustomer(b.Booking_ID, b.tableId);
                                  } else {
                                    setActiveTab('tables');
                                    showToast('success', `Select a table to seat ${b.customerName || b.Booking_ID}.`);
                                  }
                                }}
                                className="px-3 py-1.5 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-semibold transition cursor-pointer"
                              >
                                {b.tableId ? 'Seat Guests' : 'Assign Table & Seat'}
                              </button>
                            )}
                            {b.Booking_Status === 'Seated' && (
                              <span className="text-xs text-[#248A3D] font-semibold">Seated</span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: Walk-In Queue Manager (FIFO + Capacity Fit) */}
          {activeTab === 'queue' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold text-base text-[#3B1A08]">
                    Walk-In Queue (FIFO Capacity-Fit Algorithm)
                  </h3>
                  <p className="text-xs text-[#6B4C35]">
                    Matches party size with the smallest suitable table so larger tables remain preserved for big parties.
                  </p>
                </div>
                <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FDF4E7] border border-[#E6D5C3] text-[#3B1A08] self-start sm:self-auto">
                  {dashboardData?.queue?.length || 0} Parties Waiting
                </span>
              </div>

              {(!dashboardData?.queue || dashboardData.queue.length === 0) ? (
                <div className="text-center py-16 text-[#6B4C35] text-xs">
                  No walk-in parties currently waiting in the queue.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardData.queue.map((entry: any) => (
                    <div
                      key={entry.bookingId}
                      className="p-5 rounded-2xl bg-[#FFF9F0] border border-[#E6D5C3] space-y-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-mono font-bold text-[#F56A00]">
                          #{entry.dynamicPosition}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                            entry.queueStatus === 'Called'
                              ? 'bg-[#3B1A08]/10 text-[#3B1A08]'
                              : 'bg-[#F4B41A]/25 text-[#92400E]'
                          }`}
                        >
                          {entry.queueStatus}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-bold text-sm text-[#3B1A08]">{entry.customerName}</h4>
                        <span className="text-xs text-[#6B4C35]">
                          Party of {entry.partySize} Guests • Joined {new Date(entry.queueJoinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Capacity Fit Table Recommendation */}
                      <div className="p-3 rounded-xl bg-white border border-[#E6D5C3] text-xs">
                        <span className="text-[10px] text-[#6B4C35] block mb-0.5">Recommended Table:</span>
                        {entry.recommendedTable ? (
                          <strong className="text-[#248A3D] font-semibold">
                            Table {entry.recommendedTable.Table_Number} (Capacity: {entry.recommendedTable.Seating_Capacity})
                          </strong>
                        ) : (
                          <span className="text-[#B45309] font-semibold">
                            No suitable table currently free
                          </span>
                        )}
                      </div>

                      {/* Call Customer to Table Action */}
                      {entry.recommendedTable && entry.queueStatus !== 'Called' && (
                        <button
                          onClick={() =>
                            handleCallCustomer(entry.bookingId, entry.recommendedTable.Table_ID)
                          }
                          className="w-full py-2.5 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          Call to Table {entry.recommendedTable.Table_Number} (Hold Table)
                        </button>
                      )}

                      {entry.queueStatus === 'Called' && (
                        <button
                          onClick={() =>
                            handleSeatCustomer(
                              entry.bookingId,
                              entry.recommendedTable?.Table_ID || 'TBL-01'
                            )
                          }
                          className="w-full py-2.5 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          Seat Guest at Table
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 3: Floor & Tables Map */}
          {activeTab === 'tables' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-[#3B1A08]">
                    Floor Layout & Physical Table Status
                  </h3>
                  <p className="text-xs text-[#6B4C35]">
                    Dynamic real-time table occupancy, allocation, guest seating, and 15-min cleaning turnover.
                  </p>
                </div>
                {/* Status Legend / Filter Buttons */}
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <button
                    onClick={() => setTableFilter('all')}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer ${
                      tableFilter === 'all'
                        ? 'bg-[#3B1A08] text-white border-[#3B1A08]'
                        : 'bg-white text-[#3B1A08] border-[#E6D5C3] hover:bg-[#FDF4E7]'
                    }`}
                  >
                    All ({dashboardData?.tables?.length || 0})
                  </button>
                  <button
                    onClick={() => setTableFilter('available')}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                      tableFilter === 'available'
                        ? 'bg-[#248A3D] text-white border-[#248A3D]'
                        : 'bg-[#248A3D]/10 text-[#248A3D] border-[#248A3D]/30 hover:bg-[#248A3D]/20'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    <span>Available ({dashboardData?.tables?.filter((t: any) => (t.dynamicState || t.Table_Status || 'Available').toLowerCase() === 'available').length || 0})</span>
                  </button>
                  <button
                    onClick={() => setTableFilter('occupied')}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                      tableFilter === 'occupied'
                        ? 'bg-[#F56A00] text-white border-[#F56A00]'
                        : 'bg-[#F56A00]/10 text-[#F56A00] border-[#F56A00]/30 hover:bg-[#F56A00]/20'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    <span>Occupied ({dashboardData?.tables?.filter((t: any) => (t.dynamicState || t.Table_Status || '').toLowerCase() === 'occupied').length || 0})</span>
                  </button>
                  <button
                    onClick={() => setTableFilter('reserved')}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                      tableFilter === 'reserved'
                        ? 'bg-[#F4B41A] text-white border-[#F4B41A]'
                        : 'bg-[#F4B41A]/15 text-[#B45309] border-[#F4B41A]/40 hover:bg-[#F4B41A]/25'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    <span>Reserved ({dashboardData?.tables?.filter((t: any) => (t.dynamicState || t.Table_Status || '').toLowerCase().includes('reserved')).length || 0})</span>
                  </button>
                  <button
                    onClick={() => setTableFilter('unavailable')}
                    className={`px-3 py-1.5 rounded-full border text-xs font-semibold transition cursor-pointer flex items-center space-x-1.5 ${
                      tableFilter === 'unavailable'
                        ? 'bg-[#6B4C35] text-white border-[#6B4C35]'
                        : 'bg-[#6B4C35]/10 text-[#6B4C35] border-[#6B4C35]/30 hover:bg-[#6B4C35]/20'
                    }`}
                  >
                    <span className="w-2 h-2 rounded-full bg-current"></span>
                    <span>Unavailable ({dashboardData?.tables?.filter((t: any) => {
                      const s = (t.dynamicState || t.Table_Status || '').toLowerCase();
                      return s.includes('unavail') || s.includes('clean') || s.includes('maint');
                    }).length || 0})</span>
                  </button>
                </div>
              </div>

              {/* Dynamic Table Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {(dashboardData?.tables || [])
                  .filter((table: any) => {
                    const state = (table.dynamicState || table.Table_Status || 'Available').toLowerCase();
                    if (tableFilter === 'available') return state === 'available';
                    if (tableFilter === 'occupied') return state === 'occupied';
                    if (tableFilter === 'reserved') return state.includes('reserved');
                    if (tableFilter === 'unavailable') return state.includes('unavail') || state.includes('clean') || state.includes('maint');
                    return true;
                  })
                  .map((table: any) => {
                    const stateStr = table.dynamicState || table.Table_Status || 'Available';
                    const isAvailable = stateStr.toLowerCase() === 'available';
                    const isOccupied = stateStr.toLowerCase() === 'occupied';
                    const isReserved = stateStr.toLowerCase().includes('reserved');

                    return (
                      <div
                        key={table.Table_ID}
                        onClick={() => {
                          setSelectedTableForAction(table);
                          setSelectedBookingForAllocation('');
                        }}
                        className={`p-4 rounded-2xl border flex flex-col justify-between transition cursor-pointer hover:shadow-md transform hover:-translate-y-0.5 ${
                          isAvailable
                            ? 'bg-[#248A3D]/5 border-[#248A3D]/30 hover:border-[#248A3D]'
                            : isOccupied
                            ? 'bg-[#F56A00]/8 border-[#F56A00]/35 hover:border-[#F56A00]'
                            : isReserved
                            ? 'bg-[#F4B41A]/15 border-[#F4B41A]/40 hover:border-[#F4B41A]'
                            : 'bg-[#FDF4E7] border-[#E6D5C3] hover:border-[#6B4C35]'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-base text-[#3B1A08]">
                            {table.Table_Number || table.Table_ID}
                          </span>
                          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#E6D5C3] text-[#3B1A08]">
                            {table.Seating_Capacity} Seats
                          </span>
                        </div>

                        <div className="py-3">
                          <span
                            className={`text-xs font-semibold block ${
                              isAvailable
                                ? 'text-[#248A3D]'
                                : isOccupied
                                ? 'text-[#F56A00]'
                                : isReserved
                                ? 'text-[#B45309]'
                                : 'text-[#6B4C35]'
                            }`}
                          >
                            {stateStr.replace(/_/g, ' ')}
                          </span>
                          {table.seatedCustomerName && (
                            <span className="text-xs font-medium text-[#3B1A08] block truncate mt-0.5">
                              {table.seatedCustomerName}
                            </span>
                          )}
                          {table.activeBookingId && (
                            <span className="text-[10px] text-[#6B4C35] block font-mono">
                              {table.activeBookingId}
                            </span>
                          )}
                        </div>

                        <div className="pt-2 border-t border-black/5 mt-auto">
                          {isOccupied ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleConfirmDeparture(table.activeBookingId || '', table.Table_ID);
                              }}
                              className="w-full py-2 rounded-xl bg-[#3B1A08] hover:bg-[#2A1104] text-white text-[11px] font-semibold transition cursor-pointer"
                            >
                              Depart & Clean
                            </button>
                          ) : isAvailable ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTableForAction(table);
                                setSelectedBookingForAllocation('');
                              }}
                              className="w-full py-2 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-[11px] font-semibold transition cursor-pointer"
                            >
                              Allocate / Seat
                            </button>
                          ) : isReserved ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setSelectedTableForAction(table);
                                setSelectedBookingForAllocation('');
                              }}
                              className="w-full py-2 rounded-xl bg-[#F4B41A] hover:bg-[#D99B15] text-[#3B1A08] text-[11px] font-semibold transition cursor-pointer"
                            >
                              Seat Reserved
                            </button>
                          ) : (
                            <span className="text-[10px] text-[#6B4C35] text-center block">
                              Click to manage
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>
          )}

          {/* TAB 4: Live Orders & Kitchen Preparation Sync */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-[#3B1A08] flex items-center space-x-2">
                    <ChefHat className="w-5 h-5 text-[#F56A00]" />
                    <span>Live Orders & Kitchen Preparation Status</span>
                  </h3>
                  <p className="text-xs text-[#6B4C35] mt-0.5">
                    Customer &amp; Staff orders require Staff authorization before appearing in Kitchen Display.
                  </p>
                </div>
                <div className="flex items-center space-x-2 self-start sm:self-auto">
                  <button
                    onClick={() => setShowStaffOrderBuilder((v) => !v)}
                    className="px-3.5 py-1.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                  >
                    {showStaffOrderBuilder ? 'Close Order Builder' : '+ Create / Add Items Order'}
                  </button>
                  <span className="text-xs font-semibold px-3 py-1.5 rounded-full bg-[#FDF4E7] border border-[#E6D5C3] text-[#3B1A08]">
                    {dashboardData?.allOrders?.length || 0} Total Order(s)
                  </span>
                </div>
              </div>

              {showStaffOrderBuilder && (
                <div className="p-4 rounded-2xl bg-[#FFF9F0] border border-[#E6D5C3] space-y-3">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                        Select Active Booking (Same Booking_ID)
                      </label>
                      <select
                        value={staffOrderBookingId}
                        onChange={(e) => setStaffOrderBookingId(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-white text-xs text-[#3B1A08]"
                      >
                        <option value="">-- Choose Booking --</option>
                        {(dashboardData?.bookings || [])
                          .filter((b: any) => !['Completed', 'Cancelled', 'No_Show'].includes(b.Booking_Status))
                          .map((b: any) => (
                            <option key={b.Booking_ID} value={b.Booking_ID}>
                              {b.Booking_ID} — {b.customerName} ({b.Booking_Status})
                            </option>
                          ))}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                        Special Instructions (Optional)
                      </label>
                      <input
                        type="text"
                        placeholder="e.g. Less spicy, allergy note..."
                        value={staffOrderNote}
                        onChange={(e) => setStaffOrderNote(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-white text-xs text-[#3B1A08]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {staffMenu
                      .filter((m) => m.Is_Active === 'Active' && m.Availability === 'Available')
                      .slice(0, 10)
                      .map((food) => (
                        <button
                          key={food.Food_ID}
                          type="button"
                          onClick={() =>
                            setStaffOrderCart((prev) => {
                              const idx = prev.findIndex((i) => i.food.Food_ID === food.Food_ID);
                              if (idx >= 0) {
                                const next = [...prev];
                                next[idx] = { ...next[idx], quantity: next[idx].quantity + 1 };
                                return next;
                              }
                              return [...prev, { food, quantity: 1 }];
                            })
                          }
                          className="px-3 py-1.5 rounded-full bg-white border border-[#E6D5C3] hover:border-[#F56A00] text-xs font-semibold text-[#3B1A08] cursor-pointer"
                        >
                          + {food.Food_Name} (₹{food.Price})
                        </button>
                      ))}
                  </div>

                  {staffOrderCart.length > 0 && (
                    <div className="bg-white p-3 rounded-xl border border-[#E6D5C3] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                      <div className="text-xs text-[#3B1A08] space-y-1">
                        {staffOrderCart.map((c) => (
                          <div key={c.food.Food_ID}>
                            {c.quantity}× {c.food.Food_Name} (₹{Number(c.food.Price) * c.quantity})
                          </div>
                        ))}
                        <div className="font-bold">
                          Subtotal: ₹{staffOrderCart.reduce((s, c) => s + Number(c.food.Price) * c.quantity, 0)}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={handleStaffCreateOrder}
                        disabled={!staffOrderBookingId}
                        className="px-4 py-2 rounded-full bg-[#3B1A08] hover:bg-[#2A1104] disabled:opacity-50 text-white text-xs font-semibold cursor-pointer"
                      >
                        Confirm Staff Order
                      </button>
                    </div>
                  )}
                </div>
              )}

              {(!dashboardData?.allOrders || dashboardData.allOrders.length === 0) ? (
                <div className="text-center py-16 text-[#6B4C35] text-xs">
                  No customer food orders placed yet for this session.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {[...dashboardData.allOrders]
                    .sort(
                      (a: any, b: any) =>
                        new Date(b.Order_DateTime || 0).getTime() - new Date(a.Order_DateTime || 0).getTime()
                    )
                    .map((order: any) => {
                      const status = order.Order_Status || 'New_Order';
                      const badgeStyle =
                        status === 'New_Order'
                          ? 'bg-[#F4B41A]/30 text-[#78350F] border border-[#F4B41A]'
                          : status === 'Accepted' || status === 'Authorized'
                          ? 'bg-[#3B1A08]/10 text-[#3B1A08] border border-[#3B1A08]/20'
                          : status === 'Preparing' || status === 'In_Preparation'
                          ? 'bg-[#F56A00]/15 text-[#C2410C] border border-[#F56A00]/30'
                          : status === 'Ready' || status === 'Ready_For_Serving'
                          ? 'bg-[#248A3D]/15 text-[#248A3D] border border-[#248A3D]/30'
                          : status === 'Served'
                          ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                          : 'bg-[#FDF4E7] text-[#6B4C35] border border-[#E6D5C3]';

                      return (
                        <div
                          key={order.Order_ID}
                          className={`p-5 rounded-2xl border space-y-3.5 transition ${
                            status === 'New_Order'
                              ? 'bg-[#FFFDF5] border-[#F4B41A] shadow-xs'
                              : 'bg-[#FFF9F0] border-[#E6D5C3]'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div>
                              <div className="flex items-center space-x-2">
                                <span className="font-mono font-bold text-sm text-[#3B1A08]">
                                  {order.Order_ID}
                                </span>
                                {order.tableNumber && (
                                  <span className="px-2 py-0.5 rounded-full bg-[#3B1A08] text-white text-[10px] font-bold">
                                    Table {order.tableNumber}
                                  </span>
                                )}
                              </div>
                              <div className="text-xs text-[#6B4C35] mt-1">
                                Guest: <strong className="text-[#3B1A08]">{order.customerName || 'Dining Guest'}</strong> • Visit {order.Booking_ID} •{' '}
                                {order.Order_DateTime
                                  ? new Date(order.Order_DateTime).toLocaleTimeString([], {
                                      hour: '2-digit',
                                      minute: '2-digit',
                                    })
                                  : ''}
                              </div>
                            </div>

                            <span className={`px-2.5 py-1 rounded-full text-[10px] font-bold uppercase whitespace-nowrap ${badgeStyle}`}>
                              {status.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* Ordered Items Breakdown */}
                          {Array.isArray(order.items) && order.items.length > 0 && (
                            <div className="bg-white rounded-xl border border-[#E6D5C3] divide-y divide-[#E6D5C3]/50">
                              {order.items.map((item: any, idx: number) => (
                                <div
                                  key={item.Order_Item_ID || idx}
                                  className="px-3 py-2 flex items-center justify-between text-xs gap-2"
                                >
                                  <div className="flex items-center space-x-2">
                                    <span className="w-5 h-5 rounded-md bg-[#F56A00]/15 text-[#F56A00] font-bold flex items-center justify-center text-[11px]">
                                      {item.Quantity}×
                                    </span>
                                    <span className="font-semibold text-[#3B1A08]">
                                      {item.foodName || item.Food_ID}
                                    </span>
                                  </div>
                                  <div className="flex items-center space-x-1.5">
                                    {item.Item_Status === 'Pending_Authorization' && (
                                      <>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateItemQty(item.Order_Item_ID, Number(item.Quantity) - 1)}
                                          className="w-5 h-5 rounded bg-[#FDF4E7] text-[#3B1A08] font-bold cursor-pointer"
                                          title="Decrease quantity"
                                        >
                                          -
                                        </button>
                                        <button
                                          type="button"
                                          onClick={() => handleUpdateItemQty(item.Order_Item_ID, Number(item.Quantity) + 1)}
                                          className="w-5 h-5 rounded bg-[#FDF4E7] text-[#3B1A08] font-bold cursor-pointer"
                                          title="Increase quantity"
                                        >
                                          +
                                        </button>
                                      </>
                                    )}
                                    {item.Item_Status !== 'Cancelled' && item.Item_Status !== 'Served' && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          const reason = window.prompt('Enter cancellation reason:');
                                          if (reason && reason.trim()) {
                                            handleCancelOrReplaceItem(item.Order_Item_ID, 'CANCEL', reason.trim());
                                          }
                                        }}
                                        className="px-2 py-0.5 rounded bg-red-50 text-red-700 text-[10px] font-semibold cursor-pointer"
                                      >
                                        Cancel
                                      </button>
                                    )}
                                    <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#FDF4E7] text-[#6B4C35]">
                                      {(item.Item_Status || status).replace(/_/g, ' ')}
                                    </span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Special Instructions */}
                          {order.specialInstructions && (
                            <div className="px-3 py-2 rounded-xl bg-[#F4B41A]/15 border border-[#F4B41A]/40 text-xs text-[#78350F] flex items-start space-x-2">
                              <MessageSquareText className="w-3.5 h-3.5 mt-0.5 shrink-0 text-[#B45309]" />
                              <span>
                                <strong>Note:</strong> {order.specialInstructions}
                              </span>
                            </div>
                          )}

                          {/* Staff Authorization Gate (Separated from Order Creation) */}
                          {status === 'Submitted' && (
                            <button
                              onClick={() => handleAuthorizeOrder(order.Order_ID)}
                              className="w-full py-2.5 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer"
                            >
                              <Send className="w-3.5 h-3.5" />
                              <span>Authorize Order for Kitchen</span>
                            </button>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Bill Generation */}
          {activeTab === 'billing' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-4">
              <div>
                <h3 className="font-bold text-base text-[#3B1A08]">
                  Final Bill Generation
                </h3>
                <p className="text-xs text-[#6B4C35]">
                  Calculates Subtotal from server-side menu prices, approved owner tax rate, and applies discount with
                  mandatory justification. Exactly one final bill per Booking_ID (independent of Kitchen visibility).
                </p>
              </div>

              <div className="max-w-md space-y-4 bg-[#FFF9F0] p-5 rounded-2xl border border-[#E6D5C3]">
                <div>
                  <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                    Select Active Booking
                  </label>
                  <select
                    value={selectedBookingForBill}
                    onChange={(e) => setSelectedBookingForBill(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] bg-white text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                  >
                    <option value="">-- Choose active booking --</option>
                    {dashboardData?.bookings
                      ?.filter((b: any) => b.Booking_Status === 'Seated' || b.Booking_Status === 'Arrived')
                      .map((b: any) => (
                        <option key={b.Booking_ID} value={b.Booking_ID}>
                          {b.Booking_ID} ({b.customerName} • Table {b.tableNumber})
                        </option>
                      ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                      Discount % (Max 10%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E6D5C3] bg-white text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                      Discount Reason
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Loyalty perk"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#E6D5C3] bg-white text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleGenerateBill(selectedBookingForBill)}
                  disabled={!selectedBookingForBill}
                  className="w-full py-2.5 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs disabled:opacity-50 transition cursor-pointer"
                >
                  Generate One Final Bill
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: Manual UPI Payment Verification */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-bold text-base text-[#3B1A08]">
                    Manual UPI Payment Verification
                  </h3>
                  <p className="text-xs text-[#6B4C35]">
                    Customer UTR is verified against actual bank credit before marking Paid.
                  </p>
                </div>
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#FDF4E7] border border-[#E6D5C3] text-[#3B1A08] hover:bg-[#F5E6D3] text-xs font-semibold transition self-start sm:self-auto cursor-pointer"
                >
                  Request Refund
                </button>
              </div>

              {(!dashboardData?.pendingPayments || dashboardData.pendingPayments.length === 0) ? (
                <div className="text-center py-16 text-[#6B4C35] text-xs">
                  No pending UPI payments awaiting verification.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboardData.pendingPayments.map((p: any) => (
                    <div
                      key={p.Payment_ID}
                      className="p-5 rounded-2xl bg-[#FFF9F0] border border-[#F4B41A]/60 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-bold text-sm text-[#F56A00]">
                          {p.Payment_ID}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-semibold bg-[#F4B41A]/25 text-[#92400E] uppercase">
                          Pending Bank Check
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-[#3B1A08]">
                        <div className="flex justify-between">
                          <span className="text-[#6B4C35]">Customer:</span>
                          <span className="font-semibold">{p.customerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6B4C35]">Amount:</span>
                          <span className="font-semibold text-sm">₹{p.Amount_Paid}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6B4C35]">Submitted UTR:</span>
                          <span className="font-mono font-semibold text-[#F56A00]">
                            {p.Transaction_Reference}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => handleVerifyPaymentReceipt(p.Payment_ID, true)}
                          className="py-2 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                        >
                          Verify & Mark Paid
                        </button>
                        <button
                          onClick={() => handleVerifyPaymentReceipt(p.Payment_ID, false)}
                          className="py-2 rounded-xl bg-[#D70015]/10 hover:bg-[#D70015]/20 text-[#D70015] text-xs font-semibold transition cursor-pointer"
                        >
                          Reject / Invalid UTR
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Refund Modal */}
          {showRefundModal && (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowRefundModal(false);
              }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto touch-scroll"
            >
              <div
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-3xl max-w-md w-full shadow-2xl border border-[#E6D5C3] flex flex-col max-h-[92vh] sm:max-h-[90vh] my-auto overflow-hidden animate-in fade-in zoom-in-95 duration-200"
              >
                <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm px-4 sm:px-6 py-3.5 border-b border-[#E6D5C3] flex items-center justify-between shrink-0">
                  <h3 className="font-bold text-base sm:text-lg text-[#3B1A08]">
                    Create Staff Refund Request
                  </h3>
                  <button
                    type="button"
                    onClick={() => setShowRefundModal(false)}
                    aria-label="Close modal"
                    className="p-2 -mr-1 rounded-full text-[#6B4C35] hover:text-[#3B1A08] hover:bg-[#FDF4E7] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="overflow-y-auto px-4 sm:px-6 py-4 flex-1 overscroll-contain">
                  <form onSubmit={handleSubmitRefund} className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                        Payment ID
                      </label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. PAY-123456"
                        value={refundPaymentId}
                        onChange={(e) => setRefundPaymentId(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                        Refund Amount (₹)
                      </label>
                      <input
                        type="number"
                        required
                        min={1}
                        value={refundAmount}
                        onChange={(e) => setRefundAmount(Number(e.target.value))}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#3B1A08] mb-1">Reason</label>
                      <textarea
                        rows={2}
                        required
                        placeholder="Explain reason for refund..."
                        value={refundReason}
                        onChange={(e) => setRefundReason(e.target.value)}
                        className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                      />
                    </div>
                    <div className="flex space-x-2 pt-2">
                      <button
                        type="button"
                        onClick={() => setShowRefundModal(false)}
                        className="flex-1 py-2.5 rounded-xl bg-[#FDF4E7] text-xs font-semibold text-[#3B1A08] hover:bg-[#F5E6D3] transition cursor-pointer min-h-[44px]"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        className="flex-1 py-2.5 rounded-xl bg-[#F56A00] text-white text-xs font-semibold shadow-xs hover:bg-[#D95800] transition cursor-pointer min-h-[44px]"
                      >
                        Submit for Admin Approval
                      </button>
                    </div>
                  </form>
                </div>
              </div>
            </div>
          )}

          {/* Table Management & Allocation Modal */}
          {selectedTableForAction && (
            <div
              className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs overscroll-contain animate-fadeIn"
              onClick={() => setSelectedTableForAction(null)}
            >
              <div
                className="bg-white rounded-3xl max-w-lg w-full max-h-[90vh] shadow-2xl border border-[#E6D5C3] overflow-hidden flex flex-col"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="px-6 py-4 border-b border-[#E6D5C3] flex items-center justify-between bg-[#FFF9F0]">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-2xl bg-[#FDF4E7] border border-[#E6D5C3] flex items-center justify-center">
                      <LayoutGrid className="w-5 h-5 text-[#F56A00]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#3B1A08]">
                        Table {selectedTableForAction.Table_Number || selectedTableForAction.Table_ID}
                      </h3>
                      <div className="flex items-center space-x-2 mt-0.5">
                        <span className="text-xs text-[#6B4C35]">
                          Capacity: {selectedTableForAction.Seating_Capacity} Seats
                        </span>
                        <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-white border border-[#E6D5C3] text-[#3B1A08]">
                          {(selectedTableForAction.dynamicState || selectedTableForAction.Table_Status || 'Available').replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedTableForAction(null)}
                    aria-label="Close modal"
                    className="p-2 rounded-full hover:bg-black/5 text-[#6B4C35] hover:text-[#3B1A08] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <div className="p-6 space-y-5 overflow-y-auto">
                  {/* Occupied State */}
                  {(selectedTableForAction.dynamicState || selectedTableForAction.Table_Status || '').toLowerCase() === 'occupied' ? (
                    <div className="space-y-4">
                      <div className="p-4 rounded-2xl bg-[#F56A00]/10 border border-[#F56A00]/25 space-y-2">
                        <span className="text-xs font-semibold text-[#F56A00] uppercase tracking-wider block">
                          Table is Currently Occupied
                        </span>
                        <div className="flex justify-between items-center text-sm">
                          <span className="text-[#6B4C35]">Seated Guest:</span>
                          <strong className="text-[#3B1A08] font-bold">
                            {selectedTableForAction.seatedCustomerName || 'Guest'}
                          </strong>
                        </div>
                        {selectedTableForAction.activeBookingId && (
                          <div className="flex justify-between items-center text-sm">
                            <span className="text-[#6B4C35]">Booking ID:</span>
                            <span className="font-mono text-xs font-semibold text-[#3B1A08]">
                              {selectedTableForAction.activeBookingId}
                            </span>
                          </div>
                        )}
                      </div>

                      <p className="text-xs text-[#6B4C35]">
                        When guests have finished dining and billing is settled, confirm departure to initiate the 15-minute table sanitization window.
                      </p>

                      <button
                        onClick={() =>
                          handleConfirmDeparture(
                            selectedTableForAction.activeBookingId || '',
                            selectedTableForAction.Table_ID
                          )
                        }
                        className="w-full py-3 rounded-2xl bg-[#3B1A08] hover:bg-[#2A1104] text-white font-semibold text-sm shadow-xs transition cursor-pointer"
                      >
                        Confirm Departure &amp; Clean Table
                      </button>
                    </div>
                  ) : (
                    /* Available or Reserved State: Allocation & Seating Controls */
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <label className="block text-xs font-semibold text-[#3B1A08]">
                          Select Arrived / Queue Booking to Assign:
                        </label>
                        {(() => {
                          const waitingBookings = (dashboardData?.bookings || []).filter(
                            (b: any) =>
                              ['Arrived', 'Waiting', 'Confirmed'].includes(b.Booking_Status) &&
                              (!b.Table_ID || b.Table_ID === 'TBD' || b.Table_ID === '' || b.Booking_Status === 'Arrived')
                          );

                          if (waitingBookings.length === 0) {
                            return (
                              <div className="p-4 rounded-2xl bg-[#FDF4E7] border border-[#E6D5C3] text-center space-y-1">
                                <p className="text-xs font-semibold text-[#3B1A08]">
                                  No unallocated arrived or waiting guests
                                </p>
                                <p className="text-[11px] text-[#6B4C35]">
                                  Guests who click "I'm Arrived" or join the walk-in queue will appear here automatically.
                                </p>
                              </div>
                            );
                          }

                          return (
                            <div className="space-y-3">
                              <select
                                value={selectedBookingForAllocation}
                                onChange={(e) => setSelectedBookingForAllocation(e.target.value)}
                                className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] bg-white text-xs font-medium text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                              >
                                <option value="">-- Choose Guest / Booking ({waitingBookings.length} waiting) --</option>
                                {waitingBookings.map((b: any) => (
                                  <option key={b.Booking_ID} value={b.Booking_ID}>
                                    {b.Booking_ID} — {b.customerName || 'Guest'} (Party of {b.Guest_Count || b.Party_Size || '?'}) [{b.Booking_Status}]
                                  </option>
                                ))}
                              </select>

                              <div className="grid grid-cols-2 gap-2 pt-1">
                                <button
                                  type="button"
                                  disabled={!selectedBookingForAllocation}
                                  onClick={() =>
                                    handleAllocateTable(
                                      selectedBookingForAllocation,
                                      selectedTableForAction.Table_ID
                                    )
                                  }
                                  className="py-2.5 px-3 rounded-xl bg-[#FDF4E7] border border-[#E6D5C3] hover:bg-[#F5E6D3] text-[#3B1A08] text-xs font-semibold transition disabled:opacity-40 cursor-pointer"
                                >
                                  Allocate Table
                                </button>
                                <button
                                  type="button"
                                  disabled={!selectedBookingForAllocation}
                                  onClick={() =>
                                    handleSeatCustomer(
                                      selectedBookingForAllocation,
                                      selectedTableForAction.Table_ID
                                    )
                                  }
                                  className="py-2.5 px-3 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-semibold shadow-xs transition disabled:opacity-40 cursor-pointer"
                                >
                                  Seat Guests Now
                                </button>
                              </div>
                            </div>
                          );
                        })()}
                      </div>

                      {/* If table has an upcoming reservation */}
                      {selectedTableForAction.activeBookingId && (
                        <div className="p-3.5 rounded-xl bg-[#F4B41A]/10 border border-[#F4B41A]/30 text-xs space-y-1">
                          <span className="font-semibold text-[#B45309] block">
                            Assigned Booking: {selectedTableForAction.activeBookingId}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              handleSeatCustomer(
                                selectedTableForAction.activeBookingId,
                                selectedTableForAction.Table_ID
                              )
                            }
                            className="mt-2 w-full py-2 rounded-lg bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-semibold transition cursor-pointer"
                          >
                            Seat This Guest
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

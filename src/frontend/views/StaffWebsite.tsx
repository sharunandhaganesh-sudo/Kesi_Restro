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

  // Toast
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (session?.sessionId && (session.role === 'Staff' || session.role === 'Admin')) {
      loadStaffDashboard();
      const interval = setInterval(loadStaffDashboard, 5000);
      return () => clearInterval(interval);
    }
  }, [session]);

  async function loadStaffDashboard() {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'getStaffDashboard',
      sessionId: session.sessionId,
    });
    if (res.success && res.data) {
      setDashboardData(res.data);
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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-24">
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
        <div className="max-w-md mx-auto pt-16 px-4">
          <div className="bg-white rounded-3xl p-8 shadow-xs border border-[#D2D2D7]/70 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mx-auto">
                <ConciergeBell className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Staff Operations Console
              </h2>
              <p className="text-xs text-[#6E6E73] max-w-xs mx-auto">
                Table allocation, arrival verification, order approvals, and manual UPI verification.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                  Staff Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. staff"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2D2D7] text-sm text-[#1D1D1F] placeholder-[#6E6E73]/50 focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                  Password
                </label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2D2D7] text-sm text-[#1D1D1F] placeholder-[#6E6E73]/50 focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 transition"
                />
                <span className="block text-[11px] text-[#6E6E73] mt-1.5">
                  Default demo staff password: <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[#1D1D1F] font-mono">DemoPass@2026</code>
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
                className="w-full py-3 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white font-medium text-sm shadow-xs transition disabled:opacity-50"
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
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-xs border border-[#D2D2D7]/70">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-[#0071E3]/10 text-[#0071E3]">
                <ConciergeBell className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                  Staff Operations Console
                </h1>
                <p className="text-xs text-[#6E6E73]">
                  Signed in as <strong className="text-[#1D1D1F]">{session.name}</strong> ({session.role})
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadStaffDashboard}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]/80 hover:bg-[#E5E5EA] text-[#1D1D1F] text-xs font-medium transition"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#6E6E73]" />
                <span>Refresh</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#D70015]/10 text-[#D70015] hover:bg-[#D70015]/20 text-xs font-medium transition"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Log Out</span>
              </button>
            </div>
          </div>

          {/* Apple Segmented Pill Navigation */}
          <div className="flex overflow-x-auto p-1 bg-[#E5E5EA] rounded-full max-w-full no-scrollbar">
            {[
              { id: 'arrivals', label: 'Arrivals & Bookings', count: dashboardData?.unverifiedArrivals?.length },
              { id: 'queue', label: 'Walk-In Queue', count: dashboardData?.queue?.length },
              { id: 'tables', label: 'Floor Table Map', count: dashboardData?.tables?.length },
              { id: 'orders', label: 'Order Authorization', count: dashboardData?.allOrders?.filter((o: any) => o.Order_Status === 'Submitted').length },
              { id: 'billing', label: 'Bill Generation' },
              { id: 'payments', label: 'UPI Verification', count: dashboardData?.pendingPayments?.length },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex-shrink-0 flex items-center space-x-1.5 px-4 py-2 rounded-full text-xs font-medium transition-all ${
                  activeTab === tab.id
                    ? 'bg-white text-[#1D1D1F] shadow-xs'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F]'
                }`}
              >
                <span>{tab.label}</span>
                {tab.count !== undefined && tab.count > 0 && (
                  <span className={`px-1.5 py-0.2 rounded-full text-[10px] font-semibold ${
                    activeTab === tab.id
                      ? 'bg-[#0071E3] text-white'
                      : 'bg-[#D2D2D7] text-[#1D1D1F]'
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
                <div className="p-5 rounded-3xl bg-amber-50/70 border border-amber-200/80 space-y-3">
                  <div className="flex items-center space-x-2 text-[#B76E00] font-semibold text-sm">
                    <Clock className="w-4 h-4 text-[#B76E00] animate-spin" />
                    <span>Customer Arrivals Awaiting Staff Verification (15-Minute Window)</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {dashboardData.unverifiedArrivals.map((b: any) => (
                      <div
                        key={b.Booking_ID}
                        className="bg-white p-4 rounded-2xl border border-amber-200/80 shadow-xs flex items-center justify-between"
                      >
                        <div>
                          <strong className="text-sm font-semibold text-[#1D1D1F] block">{b.customerName}</strong>
                          <span className="text-xs text-[#6E6E73]">
                            {b.Booking_ID} • {b.Party_Size} Guests • {b.Visit_Type}
                          </span>
                        </div>
                        <button
                          onClick={() => handleVerifyArrival(b.Booking_ID)}
                          className="px-3.5 py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium shadow-xs transition"
                        >
                          Verify Arrival
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* All Upcoming Bookings */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="font-semibold text-base text-[#1D1D1F]">
                    Upcoming Bookings & Reservations
                  </h3>
                  <span className="text-xs text-[#6E6E73]">
                    {dashboardData?.bookings?.length || 0} total bookings recorded
                  </span>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="border-b border-[#D2D2D7]/60 text-[#6E6E73]">
                        <th className="p-3 font-medium">Booking ID</th>
                        <th className="p-3 font-medium">Customer</th>
                        <th className="p-3 font-medium">Type</th>
                        <th className="p-3 font-medium">Party</th>
                        <th className="p-3 font-medium">Date & Time</th>
                        <th className="p-3 font-medium">Table</th>
                        <th className="p-3 font-medium">Status</th>
                        <th className="p-3 font-medium text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#D2D2D7]/40 text-[#1D1D1F]">
                      {dashboardData?.bookings?.map((b: any) => (
                        <tr key={b.Booking_ID} className="hover:bg-[#F5F5F7]/60 transition">
                          <td className="p-3 font-mono font-medium text-[#0071E3]">
                            {b.Booking_ID}
                          </td>
                          <td className="p-3">
                            <span className="font-semibold block">{b.customerName}</span>
                            <span className="text-[11px] text-[#6E6E73]">{b.customerMobile}</span>
                          </td>
                          <td className="p-3">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                                b.Visit_Type === 'Online'
                                  ? 'bg-purple-100 text-purple-800'
                                  : 'bg-amber-100 text-amber-800'
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
                            {b.tableNumber ? `Table ${b.tableNumber}` : <span className="text-[#6E6E73]">Unassigned</span>}
                          </td>
                          <td className="p-3">
                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              b.Booking_Status === 'Seated'
                                ? 'bg-[#248A3D]/10 text-[#248A3D]'
                                : b.Booking_Status === 'Arrived'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-[#E5E5EA] text-[#1D1D1F]'
                            }`}>
                              {b.Booking_Status}
                            </span>
                          </td>
                          <td className="p-3 text-right space-x-1.5">
                            {b.Booking_Status === 'Confirmed' && (
                              <button
                                onClick={() => handleVerifyArrival(b.Booking_ID)}
                                className="px-3 py-1.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium transition"
                              >
                                Arrival
                              </button>
                            )}
                            {b.Booking_Status === 'Arrived' && b.tableId && (
                              <button
                                onClick={() => handleSeatCustomer(b.Booking_ID, b.tableId)}
                                className="px-3 py-1.5 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-medium transition"
                              >
                                Seat Guests
                              </button>
                            )}
                            {b.Booking_Status === 'Seated' && (
                              <span className="text-xs text-[#248A3D] font-medium">Seated</span>
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
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div>
                  <h3 className="font-semibold text-base text-[#1D1D1F]">
                    Walk-In Queue (FIFO Capacity-Fit Algorithm)
                  </h3>
                  <p className="text-xs text-[#6E6E73]">
                    Matches party size with the smallest suitable table so larger tables remain preserved for big parties.
                  </p>
                </div>
                <span className="text-xs font-medium px-3 py-1.5 rounded-full bg-[#E5E5EA] text-[#1D1D1F] self-start sm:self-auto">
                  {dashboardData?.queue?.length || 0} Parties Waiting
                </span>
              </div>

              {(!dashboardData?.queue || dashboardData.queue.length === 0) ? (
                <div className="text-center py-16 text-[#6E6E73] text-xs">
                  No walk-in parties currently waiting in the queue.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {dashboardData.queue.map((entry: any) => (
                    <div
                      key={entry.bookingId}
                      className="p-5 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-3.5"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-lg font-mono font-semibold text-[#0071E3]">
                          #{entry.dynamicPosition}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                            entry.queueStatus === 'Called'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-amber-100 text-amber-800'
                          }`}
                        >
                          {entry.queueStatus}
                        </span>
                      </div>

                      <div>
                        <h4 className="font-semibold text-sm text-[#1D1D1F]">{entry.customerName}</h4>
                        <span className="text-xs text-[#6E6E73]">
                          Party of {entry.partySize} Guests • Joined {new Date(entry.queueJoinedAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      </div>

                      {/* Capacity Fit Table Recommendation */}
                      <div className="p-3 rounded-xl bg-white border border-[#D2D2D7]/60 text-xs">
                        <span className="text-[10px] text-[#6E6E73] block mb-0.5">Recommended Table:</span>
                        {entry.recommendedTable ? (
                          <strong className="text-[#248A3D] font-medium">
                            Table {entry.recommendedTable.Table_Number} (Capacity: {entry.recommendedTable.Seating_Capacity})
                          </strong>
                        ) : (
                          <span className="text-[#B76E00] font-medium">
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
                          className="w-full py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium shadow-xs transition"
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
                          className="w-full py-2.5 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-medium shadow-xs transition"
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
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-5">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base text-[#1D1D1F]">
                    Floor Layout & Physical Table Status
                  </h3>
                  <p className="text-xs text-[#6E6E73]">
                    Physical states: <strong>Available</strong>, <strong>Occupied</strong>, <strong>Unavailable</strong>. 105-min reservation blocking protection.
                  </p>
                </div>
                {/* Status Legend */}
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6E6E73]">
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#248A3D]"></span>
                    <span>Available</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#0071E3]"></span>
                    <span>Occupied</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span>
                    <span>Reserved</span>
                  </span>
                  <span className="flex items-center space-x-1.5">
                    <span className="w-2.5 h-2.5 rounded-full bg-[#6E6E73]"></span>
                    <span>Maintenance</span>
                  </span>
                </div>
              </div>

              {/* Table Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
                {dashboardData?.tables?.map((table: any) => {
                  const isAvailable = table.dynamicState === 'Available';
                  const isOccupied = table.dynamicState === 'Occupied';
                  const isReserved = table.dynamicState === 'Reserved_Upcoming';

                  return (
                    <div
                      key={table.Table_ID}
                      className={`p-4 rounded-2xl border flex flex-col justify-between transition ${
                        isAvailable
                          ? 'bg-[#248A3D]/5 border-[#248A3D]/30'
                          : isOccupied
                          ? 'bg-[#0071E3]/5 border-[#0071E3]/30'
                          : isReserved
                          ? 'bg-purple-50 border-purple-200'
                          : 'bg-[#F5F5F7] border-[#D2D2D7]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-base text-[#1D1D1F]">
                          {table.Table_Number}
                        </span>
                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-white border border-[#D2D2D7]/60 text-[#1D1D1F]">
                          {table.Seating_Capacity} Seats
                        </span>
                      </div>

                      <div className="py-3">
                        <span
                          className={`text-xs font-semibold block ${
                            isAvailable
                              ? 'text-[#248A3D]'
                              : isOccupied
                              ? 'text-[#0071E3]'
                              : isReserved
                              ? 'text-purple-700'
                              : 'text-[#6E6E73]'
                          }`}
                        >
                          {table.dynamicState.replace(/_/g, ' ')}
                        </span>
                        {table.activeBookingId && (
                          <span className="text-[10px] text-[#6E6E73] block font-mono">
                            {table.activeBookingId}
                          </span>
                        )}
                      </div>

                      {isOccupied && (
                        <button
                          onClick={() =>
                            handleConfirmDeparture(table.activeBookingId || '', table.Table_ID)
                          }
                          className="w-full py-2 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-[11px] font-medium transition"
                        >
                          Depart & Clean
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* TAB 4: Order Authorization Queue */}
          {activeTab === 'orders' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-4">
              <div>
                <h3 className="font-semibold text-base text-[#1D1D1F]">
                  Incoming Orders Awaiting Staff Authorization
                </h3>
                <p className="text-xs text-[#6E6E73]">
                  Per Blueprint: Kitchen receives ONLY staff-authorized orders. Online guests must be
                  arrival-verified; walk-in guests must be seated before ordering.
                </p>
              </div>

              {(!dashboardData?.allOrders || dashboardData.allOrders.filter((o: any) => o.Order_Status === 'Submitted').length === 0) ? (
                <div className="text-center py-16 text-[#6E6E73] text-xs">
                  No orders currently awaiting authorization.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboardData?.allOrders
                    ?.filter((o: any) => o.Order_Status === 'Submitted')
                    .map((order: any) => (
                      <div
                        key={order.Order_ID}
                        className="p-5 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-3.5"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-semibold text-sm text-[#0071E3]">
                            {order.Order_ID}
                          </span>
                          <span className="text-[10px] font-medium px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 uppercase">
                            Awaiting Authorization
                          </span>
                        </div>

                        <div className="text-xs text-[#6E6E73]">
                          Visit: <strong className="text-[#1D1D1F]">{order.Booking_ID}</strong> • Placed {new Date(order.Order_DateTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </div>

                        <button
                          onClick={() => handleAuthorizeOrder(order.Order_ID)}
                          className="w-full py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium shadow-xs transition flex items-center justify-center space-x-1.5"
                        >
                          <Send className="w-3.5 h-3.5" />
                          <span>Authorize for Kitchen Preparation</span>
                        </button>
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: Bill Generation */}
          {activeTab === 'billing' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-4">
              <div>
                <h3 className="font-semibold text-base text-[#1D1D1F]">
                  Final Bill Generation
                </h3>
                <p className="text-xs text-[#6E6E73]">
                  Calculates Subtotal from server-side menu prices, 5% GST, and applies discount with
                  mandatory justification. Exactly one final bill per Booking_ID.
                </p>
              </div>

              <div className="max-w-md space-y-4 bg-[#F5F5F7] p-5 rounded-2xl border border-[#D2D2D7]/70">
                <div>
                  <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                    Select Active Booking
                  </label>
                  <select
                    value={selectedBookingForBill}
                    onChange={(e) => setSelectedBookingForBill(e.target.value)}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2D2D7] bg-white text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
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
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                      Discount % (Max 10%)
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={10}
                      value={discountPercent}
                      onChange={(e) => setDiscountPercent(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] bg-white text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                      Discount Reason
                    </label>
                    <input
                      type="text"
                      placeholder="e.g. Loyalty perk"
                      value={discountReason}
                      onChange={(e) => setDiscountReason(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] bg-white text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                </div>

                <button
                  onClick={() => handleGenerateBill(selectedBookingForBill)}
                  disabled={!selectedBookingForBill}
                  className="w-full py-2.5 rounded-xl bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-medium shadow-xs disabled:opacity-50 transition"
                >
                  Generate One Final Bill
                </button>
              </div>
            </div>
          )}

          {/* TAB 6: Manual UPI Payment Verification (Section 13.2) */}
          {activeTab === 'payments' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base text-[#1D1D1F]">
                    Manual UPI Payment Verification
                  </h3>
                  <p className="text-xs text-[#6E6E73]">
                    Per Blueprint: Customer UTR is NOT proof of receipt. Staff must confirm actual bank credit before marking Paid.
                  </p>
                </div>
                <button
                  onClick={() => setShowRefundModal(true)}
                  className="px-3.5 py-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#E5E5EA] text-xs font-medium transition self-start sm:self-auto"
                >
                  Request Refund
                </button>
              </div>

              {(!dashboardData?.pendingPayments || dashboardData.pendingPayments.length === 0) ? (
                <div className="text-center py-16 text-[#6E6E73] text-xs">
                  No pending UPI payments awaiting verification.
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {dashboardData.pendingPayments.map((p: any) => (
                    <div
                      key={p.Payment_ID}
                      className="p-5 rounded-2xl bg-[#F5F5F7] border border-amber-300/80 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-mono font-semibold text-sm text-[#0071E3]">
                          {p.Payment_ID}
                        </span>
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-amber-100 text-amber-800 uppercase">
                          Pending Bank Check
                        </span>
                      </div>

                      <div className="space-y-1.5 text-xs text-[#1D1D1F]">
                        <div className="flex justify-between">
                          <span className="text-[#6E6E73]">Customer:</span>
                          <span className="font-semibold">{p.customerName}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6E6E73]">Amount:</span>
                          <span className="font-semibold text-sm">₹{p.Amount_Paid}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-[#6E6E73]">Submitted UTR:</span>
                          <span className="font-mono font-medium text-[#0071E3]">
                            {p.Transaction_Reference}
                          </span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2 pt-2">
                        <button
                          onClick={() => handleVerifyPaymentReceipt(p.Payment_ID, true)}
                          className="py-2 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-medium shadow-xs transition"
                        >
                          Verify & Mark Paid
                        </button>
                        <button
                          onClick={() => handleVerifyPaymentReceipt(p.Payment_ID, false)}
                          className="py-2 rounded-xl bg-[#D70015]/10 hover:bg-[#D70015]/20 text-[#D70015] text-xs font-medium transition"
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
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#D2D2D7]/80">
                <h3 className="font-semibold text-lg text-[#1D1D1F]">
                  Create Staff Refund Request
                </h3>
                <form onSubmit={handleSubmitRefund} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Payment ID
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. PAY-123456"
                      value={refundPaymentId}
                      onChange={(e) => setRefundPaymentId(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Refund Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={refundAmount}
                      onChange={(e) => setRefundAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Reason</label>
                    <textarea
                      rows={2}
                      required
                      placeholder="Explain reason for refund..."
                      value={refundReason}
                      onChange={(e) => setRefundReason(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowRefundModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] hover:bg-[#E5E5EA] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-medium shadow-xs hover:bg-[#0077ED] transition"
                    >
                      Submit for Admin Approval
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

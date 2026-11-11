/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 2. Customer Website
 * Registration, Email OTP verification, Reservation booking, Walk-in Queue tracking,
 * "I'm Arrived" arrival confirmation, Menu cart & ordering, Live prep tracking,
 * Final bill review & manual UPI payment (UTR submission), and 5-star feedback.
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { motion, AnimatePresence } from 'motion/react';
import { DishImage } from '../components/DishImage';
import { RequestDispatcher } from '../../backend/dispatcher';
import { UserSessionState, MenuItem, CartItem } from '../types';
import {
  CalendarDays,
  Clock,
  QrCode,
  ShoppingBag,
  Sparkles,
  UtensilsCrossed,
  CheckCircle2,
  AlertCircle,
  X,
  CreditCard,
  Star,
  Users,
  Search,
  Plus,
  Minus,
  RefreshCw,
  Mail,
  Zap,
} from 'lucide-react';

interface CustomerWebsiteProps {
  initialVisitType?: 'Online' | 'Walk-in';
  scannedTable?: any | null;
  qrScanError?: string;
  session: UserSessionState | null;
  onSetSession: (session: UserSessionState) => void;
  onLogout: () => void;
}

export const CustomerWebsite: React.FC<CustomerWebsiteProps> = ({
  initialVisitType = 'Online',
  scannedTable = null,
  qrScanError = '',
  session,
  onSetSession,
  onLogout,
}) => {
  // Authentication states
  const [mobileNumber, setMobileNumber] = useState<string>('');
  const [customerName, setCustomerName] = useState<string>('');
  const [email, setEmail] = useState<string>('');
  const [otpInput, setOtpInput] = useState<string>('');
  const [isNewCustomer, setIsNewCustomer] = useState<boolean>(false);
  const [showOtpModal, setShowOtpModal] = useState<boolean>(false);
  const [otpSentMessage, setOtpSentMessage] = useState<string>('');
  const [cooldownSeconds, setCooldownSeconds] = useState<number>(0);
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Active visit and booking states
  const [activeBooking, setActiveBooking] = useState<any>(null);
  const [bookingDetails, setBookingDetails] = useState<any>(null);
  const [queuePosition, setQueuePosition] = useState<number>(0);
  const [visitType, setVisitType] = useState<'Online' | 'Walk-in'>(initialVisitType);
  const [partySize, setPartySize] = useState<number>(2);
  const [reservationDate, setReservationDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [reservationTime, setReservationTime] = useState<string>('19:30');
  const [selectedTableId, setSelectedTableId] = useState<string>('TBL-03');

  // Menu, Cart and Ordering states
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [availableTables, setAvailableTables] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [utrInput, setUtrInput] = useState<string>('');

  // Feedback states
  const [rating, setRating] = useState<number>(5);
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [copiedUpi, setCopiedUpi] = useState<boolean>(false);
  const [dynamicUpiQrUrl, setDynamicUpiQrUrl] = useState<string>('');
  const [restaurantPaymentInfo, setRestaurantPaymentInfo] = useState<{ upiId: string; upiPayeeName: string }>({
    upiId: 'kesikam2006@oksbi',
    upiPayeeName: 'Kesika M',
  });

  // UI Toast message
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // 1. Load public menu & available tables
  useEffect(() => {
    loadMenuAndTables();
  }, []);

  // 2. Poll active booking details when session is active
  useEffect(() => {
    if (session?.sessionId && activeBooking?.Booking_ID) {
      refreshBookingDetails();
      const interval = setInterval(refreshBookingDetails, 4000);
      return () => clearInterval(interval);
    }
  }, [session?.sessionId, activeBooking?.Booking_ID]);

  // 3. Restore active booking AND draft cart on login or returning session
  useEffect(() => {
    if (session?.sessionId && session.role === 'Customer') {
      loadCustomerActiveBooking(session.sessionId);
      restoreDraftCart(session.sessionId);
    }
  }, [session?.sessionId]);

  // Lock selected table if arrived via Table QR scan
  useEffect(() => {
    if (scannedTable?.Table_ID) {
      setSelectedTableId(scannedTable.Table_ID);
      setVisitType('Walk-in');
      if (scannedTable.Seating_Capacity) {
        setPartySize(Math.min(2, Number(scannedTable.Seating_Capacity)));
      }
    }
  }, [scannedTable]);

  async function restoreDraftCart(sessionId: string) {
    try {
      const res = await RequestDispatcher.dispatch({
        action: 'getDraftCart',
        sessionId,
      });
      if (res.success && res.data?.items && res.data.items.length > 0) {
        setCart(res.data.items);
        if (res.data.tableId && !scannedTable) {
          setSelectedTableId(res.data.tableId);
        }
        showToast('success', `Restored ${res.data.items.length} item(s) in your unfinished cart.`);
      }
    } catch (err) {
      console.error('Error restoring cart:', err);
    }
  }

  async function persistCart(nextCart: CartItem[]) {
    if (!session?.sessionId || session.role !== 'Customer') return;
    await RequestDispatcher.dispatch({
      action: 'saveDraftCart',
      sessionId: session.sessionId,
      payload: {
        bookingId: activeBooking?.Booking_ID,
        tableId: scannedTable?.Table_ID || selectedTableId,
        items: nextCart.map((i) => ({ foodId: i.food.Food_ID, quantity: i.quantity })),
      },
    });
  }

  // 4. Cooldown timer countdown
  useEffect(() => {
    if (cooldownSeconds > 0) {
      const timer = setTimeout(() => setCooldownSeconds((s) => s - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldownSeconds]);

  async function loadCustomerActiveBooking(sessionId: string) {
    try {
      const historyRes = await RequestDispatcher.dispatch({
        action: 'getCustomerHistory',
        sessionId: sessionId,
      });

      if (historyRes.success && Array.isArray(historyRes.data) && historyRes.data.length > 0) {
        setCustomerHistory(historyRes.data);

        // Find active booking: Confirmed, Arrived, or Seated
        const active = historyRes.data.find(
          (b: any) =>
            b.Booking_Status === 'Confirmed' ||
            b.Booking_Status === 'Arrived' ||
            b.Booking_Status === 'Seated'
        ) || (historyRes.data[0].Booking_Status !== 'Cancelled' ? historyRes.data[0] : null);

        if (active) {
          setActiveBooking(active);
          const detailsRes = await RequestDispatcher.dispatch({
            action: 'getBookingDetails',
            sessionId: sessionId,
            payload: { bookingId: active.Booking_ID },
          });

          if (detailsRes.success && detailsRes.data) {
            setBookingDetails(detailsRes.data);
            setActiveBooking(detailsRes.data.booking);
          }
        }
      }
    } catch (err) {
      console.error('Error restoring customer active booking:', err);
    }
  }

  async function loadMenuAndTables() {
    const [res, infoRes] = await Promise.all([
      RequestDispatcher.dispatch({ action: 'getPublicMenu' }),
      RequestDispatcher.dispatch({ action: 'getPublicRestaurantInfo' }),
    ]);
    if (res.success) {
      setMenuItems(res.data.menu || []);
      setAvailableTables(res.data.availableTables || []);
    }
    if (infoRes.success && infoRes.data) {
      setRestaurantPaymentInfo({
        upiId: infoRes.data.upiId || 'kesikam2006@oksbi',
        upiPayeeName: infoRes.data.upiPayeeName || 'Kesika M',
      });
    }
  }

  // Generate dynamic UPI intent QR code whenever bill changes
  useEffect(() => {
    if (bookingDetails?.bill?.Bill_ID && bookingDetails.bill.Grand_Total) {
      const upiUri = `upi://pay?pa=${encodeURIComponent(restaurantPaymentInfo.upiId)}&pn=${encodeURIComponent(
        restaurantPaymentInfo.upiPayeeName
      )}&am=${encodeURIComponent(bookingDetails.bill.Grand_Total)}&tr=${encodeURIComponent(
        bookingDetails.bill.Bill_ID
      )}&cu=INR`;
      QRCode.toDataURL(upiUri, {
        width: 240,
        margin: 1,
        color: { dark: '#292323', light: '#FFFFFF' },
      }).then(setDynamicUpiQrUrl).catch(() => {});
    }
  }, [bookingDetails?.bill?.Bill_ID, bookingDetails?.bill?.Grand_Total, restaurantPaymentInfo]);

  async function refreshBookingDetails() {
    if (!activeBooking?.Booking_ID || !session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'getBookingDetails',
      sessionId: session.sessionId,
      payload: { bookingId: activeBooking.Booking_ID },
    });
    if (res.success && res.data) {
      setBookingDetails(res.data);
      setActiveBooking(res.data.booking);
    }
  }

  async function quickLoginCustomer(name: string, mobile: string, mail: string) {
    setAuthLoading(true);
    setAuthError('');

    const res = await RequestDispatcher.dispatch({
      action: 'demoQuickLoginCustomer',
      payload: { mobileNumber: mobile },
    });

    setAuthLoading(false);
    if (res.success && res.data) {
      onSetSession(res.data);
      loadCustomerActiveBooking(res.data.sessionId);
      showToast('success', `Signed in as demo customer ${name}`);
    } else {
      setMobileNumber(mobile);
      setShowOtpModal(true);
      setOtpSentMessage(`Verification code sent to ${mail}`);
    }
  }

  // Handle standard OTP request
  async function handleRequestOTP(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const res = await RequestDispatcher.dispatch({
      action: 'requestCustomerOTP',
      payload: { mobileNumber, customerName, email },
    });

    setAuthLoading(false);
    if (res.success && res.data.success) {
      setShowOtpModal(true);
      setIsNewCustomer(Boolean(res.data.isNewCustomer));
      setOtpSentMessage(res.data.message);
      setCooldownSeconds(60);
    } else {
      if (res.data?.isNewCustomer) {
        setIsNewCustomer(true);
        setAuthError('New guest! Please enter your name and email to proceed.');
      } else {
        setAuthError(res.data?.message || 'Failed to send OTP.');
      }
    }
  }

  // Handle OTP verification
  async function handleVerifyOTP(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthError('');

    const res = await RequestDispatcher.dispatch({
      action: 'verifyCustomerOTP',
      payload: { mobileNumber, otp: otpInput },
    });

    setAuthLoading(false);
    if (res.success && res.data) {
      setShowOtpModal(false);
      setOtpInput('');
      onSetSession(res.data);
      loadCustomerActiveBooking(res.data.sessionId);
      showToast('success', 'Logged in successfully!');
    } else {
      setAuthError(res.error?.message || 'Verification failed.');
    }
  }

  // Create Booking / Reservation
  async function handleCreateBooking() {
    if (!session?.sessionId) {
      showToast('error', 'Please enter your mobile number and verify OTP first.');
      return;
    }

    const res = await RequestDispatcher.dispatch({
      action: 'createBooking',
      sessionId: session.sessionId,
      payload: {
        visitType,
        partySize,
        reservationDate: visitType === 'Online' ? reservationDate : undefined,
        reservationTime: visitType === 'Online' ? reservationTime : undefined,
      },
    });

    if (res.success && res.data) {
      const createdBooking = res.data;
      setActiveBooking(createdBooking);

      if (visitType === 'Online') {
        // Reserve table
        const resDateTime = `${reservationDate}T${reservationTime}:00`;
        const reserveRes = await RequestDispatcher.dispatch({
          action: 'reserveTable',
          sessionId: session.sessionId,
          payload: {
            bookingId: createdBooking.Booking_ID,
            tableId: selectedTableId,
            reservationDateTime: resDateTime,
            partySize,
          },
        });
        if (reserveRes.success) {
          showToast('success', 'Online table reservation confirmed!');
        } else {
          showToast('error', reserveRes.error?.message || 'Reservation slot unavailable.');
        }
      } else {
        // Join walk-in queue
        const qRes = await RequestDispatcher.dispatch({
          action: 'joinQueue',
          sessionId: session.sessionId,
          payload: {
            bookingId: createdBooking.Booking_ID,
            partySize,
          },
        });
        if (qRes.success) {
          setQueuePosition(qRes.data.position);
          showToast('success', qRes.message || 'Joined the walk-in queue!');
        }
      }

      refreshBookingDetails();
    } else {
      showToast('error', res.error?.message || 'Could not create booking.');
    }
  }

  // Confirm Digital Arrival ("I'm Arrived")
  async function handleConfirmArrival() {
    if (!activeBooking?.Booking_ID || !session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'confirmArrival',
      sessionId: session.sessionId,
      payload: { bookingId: activeBooking.Booking_ID },
    });

    if (res.success) {
      showToast('success', res.message || 'Arrival confirmed! Staff notified.');
      refreshBookingDetails();
    } else {
      showToast('error', res.error?.message || 'Arrival confirmation failed.');
    }
  }

  // Cart operations (persisted to backend immediately)
  function addToCart(food: MenuItem) {
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.food.Food_ID === food.Food_ID);
      let nextCart: CartItem[];
      if (idx >= 0) {
        nextCart = [...prev];
        nextCart[idx] = { ...nextCart[idx], quantity: nextCart[idx].quantity + 1 };
      } else {
        nextCart = [...prev, { food, quantity: 1 }];
      }
      persistCart(nextCart);
      return nextCart;
    });
    showToast('success', `Added ${food.Food_Name} to order.`);
  }

  function updateQuantity(foodId: string, delta: number) {
    setCart((prev) => {
      const nextCart = prev
        .map((item) => {
          if (item.food.Food_ID === foodId) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
      persistCart(nextCart);
      return nextCart;
    });
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.food.Price * item.quantity, 0);

  // Submit Order
  async function handleSubmitOrder() {
    if (cart.length === 0) return;
    if (!activeBooking?.Booking_ID || !session?.sessionId) {
      showToast('error', 'Please create or join a booking visit before placing orders.');
      return;
    }

    const itemsPayload = cart.map((i) => ({
      foodId: i.food.Food_ID,
      quantity: i.quantity,
    }));

    const res = await RequestDispatcher.dispatch({
      action: 'placeOrder',
      sessionId: session.sessionId,
      payload: {
        bookingId: activeBooking.Booking_ID,
        items: itemsPayload,
      },
    });

    if (res.success) {
      setCart([]);
      setIsCartOpen(false);
      showToast('success', 'Order submitted! Kitchen preparation starts after staff authorization.');
      refreshBookingDetails();
    } else {
      showToast('error', res.error?.message || 'Failed to submit order.');
    }
  }

  // Submit UPI Payment
  async function handleSubmitUPIPayment(e: React.FormEvent) {
    e.preventDefault();
    if (!bookingDetails?.bill?.Bill_ID || !session?.sessionId) return;
    if (!utrInput.trim() || utrInput.trim().length < 6) {
      showToast('error', 'Please enter a valid UPI transaction reference / UTR number.');
      return;
    }

    const res = await RequestDispatcher.dispatch({
      action: 'submitUPIPayment',
      sessionId: session.sessionId,
      payload: {
        billId: bookingDetails.bill.Bill_ID,
        transactionReference: utrInput.trim(),
        amountPaid: bookingDetails.bill.Grand_Total,
      },
    });

    if (res.success) {
      setUtrInput('');
      setIsPaymentOpen(false);
      showToast('success', 'UPI Reference submitted! Staff is verifying against restaurant bank receipt.');
      refreshBookingDetails();
    } else {
      showToast('error', res.error?.message || 'Could not submit payment.');
    }
  }

  // Submit Feedback
  async function handleSubmitFeedback(e: React.FormEvent) {
    e.preventDefault();
    if (!activeBooking?.Booking_ID || !session?.sessionId) return;

    const res = await RequestDispatcher.dispatch({
      action: 'submitFeedback',
      sessionId: session.sessionId,
      payload: {
        bookingId: activeBooking.Booking_ID,
        rating,
        comment: feedbackComment,
      },
    });

    if (res.success) {
      setFeedbackSubmitted(true);
      showToast('success', 'Thank you for your rating and feedback!');
      refreshBookingDetails();
    } else {
      showToast('error', res.error?.message || 'Feedback submission failed.');
    }
  }

  function showToast(type: 'success' | 'error', text: string) {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }

  const filteredMenuItems = menuItems.filter((i) => {
    const matchesCategory = selectedCategory === 'All' || i.Category === selectedCategory;
    const matchesSearch =
      !searchQuery ||
      i.Food_Name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      i.Description.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesSearch;
  });

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] pb-24">
      {/* Apple-Style Toast Notification */}
      {notice && (
        <div
          className={`fixed top-20 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-xl border text-xs font-semibold backdrop-blur-md ${
            notice.type === 'success'
              ? 'bg-white/95 border-[#248A3D]/40 text-[#248A3D]'
              : 'bg-white/95 border-[#D70015]/40 text-[#D70015]'
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

      {/* Top Banner / Customer Identification Strip */}
      <div className="bg-white/80 backdrop-blur-md border-b border-[#D2D2D7]/80 py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2">
            <span className="font-bold text-[#0071E3]">
              Customer Portal
            </span>
            <span className="text-[#6E6E73]">•</span>
            {session ? (
              <span className="text-[#1D1D1F] font-medium">
                Signed in as <strong className="text-[#1D1D1F] font-semibold">{session.name}</strong> ({session.mobile})
              </span>
            ) : (
              <span className="text-[#6E6E73]">
                Sign in with mobile number & Email OTP to book tables and order food
              </span>
            )}
          </div>

          {/* Quick Demo Customer Sign-in buttons */}
          {!session && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-[#6E6E73] font-medium">Quick Demo:</span>
              <button
                onClick={() =>
                  quickLoginCustomer('Ananya Sharma', '9876543210', 'ananya.sharma@example.com')
                }
                className="px-3 py-1 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-[11px] font-semibold shadow-xs transition cursor-pointer"
              >
                Ananya (9876543210)
              </button>
              <button
                onClick={() =>
                  quickLoginCustomer('Vikram Patel', '9876543211', 'vikram.patel@example.com')
                }
                className="px-3 py-1 rounded-full bg-white hover:bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] text-[11px] font-semibold shadow-xs transition cursor-pointer"
              >
                Vikram (Walk-in)
              </button>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-8">
        {/* Scanned Table QR Banner */}
        {qrScanError && (
          <div className="bg-red-50 border border-red-200 text-red-800 px-5 py-4 rounded-2xl flex items-center space-x-3 text-xs font-medium">
            <AlertCircle className="w-5 h-5 text-red-600 shrink-0" />
            <span>{qrScanError}</span>
          </div>
        )}

        {scannedTable && (
          <div className="bg-[#FFF8F3] border-2 border-[#650B20] text-[#292323] px-5 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#650B20] text-white flex items-center justify-center">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#650B20]">
                  Ordering from Table {scannedTable.Table_Number} (Capacity: {scannedTable.Seating_Capacity} Guests)
                </h3>
                <p className="text-xs text-[#6E6E73]">
                  Table automatically identified via verified QR scan. Your booking and food order will lock to Table {scannedTable.Table_Number}.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#D9AA49]/20 text-[#650B20] text-[11px] font-bold self-start sm:self-center">
              Status: {scannedTable.Table_Status}
            </span>
          </div>
        )}

        {/* If Not Signed In: Apple-Style Login Card */}
        {!session && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-xs border border-[#D2D2D7] max-w-lg mx-auto">
            <div className="text-center space-y-2 mb-8">
              <div className="w-12 h-12 rounded-2xl bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3] mx-auto mb-3">
                <Users className="w-6 h-6 stroke-[2.2]" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#1D1D1F]">Customer Sign In</h2>
              <p className="text-xs text-[#6E6E73]">
                We'll verify your mobile number with a secure 6-digit email OTP.
              </p>
            </div>

            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                  10-Digit Mobile Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  required
                  placeholder="e.g. 9876543210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-sm font-medium transition"
                />
              </div>

              {isNewCustomer && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-sm font-medium transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                      Email Address (for OTP Delivery)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. jane@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 text-sm font-medium transition"
                    />
                  </div>
                </>
              )}

              {authError && (
                <div className="text-xs text-[#D70015] bg-[#D70015]/10 p-3 rounded-xl flex items-center space-x-2 font-medium">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" />
                  <span>{authError}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={authLoading}
                className="w-full py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-sm shadow-xs transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {authLoading ? 'Sending OTP...' : 'Send Verification OTP'}
              </button>
            </form>
          </div>
        )}

        {/* OTP Modal with Apple Dialog Styling */}
        <AnimatePresence>
          {showOtpModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl max-w-md w-full p-6 sm:p-8 space-y-4 shadow-2xl border border-[#D2D2D7]"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-lg text-[#1D1D1F]">
                      Enter 6-Digit Email OTP
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowOtpModal(false)}
                    className="p-1 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#6E6E73]">{otpSentMessage}</p>

                {/* Real Email Delivery Notice */}
                <div className="bg-[#F5F5F7] p-4 rounded-2xl border border-[#D2D2D7]/80 flex items-start space-x-3 text-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-[#1D1D1F] block">
                      Real Email Verification
                    </span>
                    <p className="text-[#6E6E73] leading-relaxed">
                      Please check your Gmail inbox (and spam folder) for the 6-digit code sent via Google Apps Script MailApp. Enter the code below to continue.
                    </p>
                  </div>
                </div>

                <form onSubmit={handleVerifyOTP} className="space-y-4">
                  <div>
                    <input
                      type="text"
                      maxLength={6}
                      required
                      placeholder="123456"
                      value={otpInput}
                      onChange={(e) => setOtpInput(e.target.value.replace(/\D/g, ''))}
                      className="w-full text-center tracking-widest font-mono text-2xl py-3.5 rounded-2xl border border-[#D2D2D7] bg-[#F5F5F7] focus:bg-white focus:outline-none focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20"
                    />
                    <span className="block text-[11px] text-[#6E6E73] text-center mt-1.5">
                      Valid for 5 minutes • Max 3 attempts
                    </span>
                  </div>

                  {authError && (
                    <div className="text-xs text-[#D70015] bg-[#D70015]/10 p-2.5 rounded-xl text-center font-medium">
                      {authError}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={authLoading || otpInput.length !== 6}
                    className="w-full py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-sm shadow-xs disabled:opacity-50 transition cursor-pointer active:scale-98"
                  >
                    {authLoading ? 'Verifying...' : 'Verify & Continue'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      disabled={cooldownSeconds > 0}
                      onClick={handleRequestOTP}
                      className="text-xs text-[#0071E3] font-semibold hover:underline disabled:text-[#6E6E73]/50 cursor-pointer"
                    >
                      {cooldownSeconds > 0
                        ? `Resend Code in ${cooldownSeconds}s`
                        : 'Resend Verification Code'}
                    </button>
                  </div>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Signed-In: Active Visit Lifecycle Card */}
        {session && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Active Booking / Queue Status */}
            <div className="lg:col-span-5 space-y-4">
              {activeBooking ? (
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#D2D2D7]/60">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73]">
                          Active Visit
                        </span>
                        <button
                          onClick={() => setActiveBooking(null)}
                          className="text-[11px] text-[#0071E3] hover:underline font-semibold cursor-pointer"
                        >
                          (New / Switch)
                        </button>
                      </div>
                      <span className="text-base font-bold text-[#1D1D1F]">
                        {activeBooking.Booking_ID}
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        activeBooking.Booking_Status === 'Seated'
                          ? 'bg-[#248A3D]/10 text-[#248A3D] border border-[#248A3D]/20'
                          : activeBooking.Booking_Status === 'Arrived'
                          ? 'bg-[#0071E3]/10 text-[#0071E3] border border-[#0071E3]/20'
                          : 'bg-[#B76E00]/10 text-[#B76E00] border border-[#B76E00]/20'
                      }`}
                    >
                      {activeBooking.Booking_Status}
                    </span>
                  </div>

                  {/* Visit Specifics */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-[#F5F5F7]">
                      <span className="text-[#6E6E73] block text-[10px] font-medium">Visit Type</span>
                      <strong className="text-[#1D1D1F] font-semibold">{activeBooking.Visit_Type}</strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#F5F5F7]">
                      <span className="text-[#6E6E73] block text-[10px] font-medium">Party Size</span>
                      <strong className="text-[#1D1D1F] font-semibold">{activeBooking.Party_Size} Guests</strong>
                    </div>

                    {bookingDetails?.reservations?.[0] && (
                      <div className="p-3 rounded-2xl bg-[#F5F5F7] col-span-2">
                        <span className="text-[#6E6E73] block text-[10px] font-medium">
                          Reserved Table
                        </span>
                        <strong className="text-[#0071E3] font-semibold">
                          Table {bookingDetails.reservations[0].Table_ID} (105-Min Blocked Window)
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Walk-in Queue Display */}
                  {activeBooking.Visit_Type === 'Walk-in' &&
                    activeBooking.Booking_Status !== 'Seated' &&
                    activeBooking.Booking_Status !== 'Completed' && (
                      <div className="bg-[#0071E3]/5 p-4 rounded-2xl border border-[#0071E3]/20 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#1D1D1F]">
                            Live Queue Position:
                          </span>
                          <span className="text-xl font-mono font-bold text-[#0071E3]">
                            #{queuePosition || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6E6E73] leading-snug">
                          Capacity-fit algorithm prioritizes available tables matching your party of{' '}
                          {activeBooking.Party_Size}. Staff will call you shortly.
                        </p>
                      </div>
                    )}

                  {/* Digital Arrival Button ("I'm Arrived") */}
                  {activeBooking.Booking_Status === 'Confirmed' && (
                    <div className="space-y-2 pt-2">
                      <button
                        onClick={handleConfirmArrival}
                        className="w-full py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer active:scale-98 animate-pulse"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>I'm Arrived at Restaurant</span>
                      </button>
                      <p className="text-[10px] text-center text-[#6E6E73]">
                        Confirm within 10-minute grace window to alert host staff and secure your table.
                      </p>
                    </div>
                  )}

                  {/* Arrival Confirmed Notice */}
                  {activeBooking.Booking_Status === 'Arrived' && (
                    <div className="p-3.5 bg-[#0071E3]/10 border border-[#0071E3]/20 rounded-2xl text-xs text-[#0071E3] space-y-1">
                      <div className="font-semibold flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Arrival Registered (15-Min Staff Window)</span>
                      </div>
                      <p className="text-[11px] text-[#1D1D1F]/80">
                        Please proceed to the host desk. Staff is verifying your arrival and seating
                        your table.
                      </p>
                    </div>
                  )}

                  {/* Seated Notice */}
                  {activeBooking.Booking_Status === 'Seated' && (
                    <div className="p-3.5 bg-[#248A3D]/10 border border-[#248A3D]/20 rounded-2xl text-xs text-[#248A3D] space-y-1">
                      <div className="font-semibold flex items-center space-x-1.5">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span>You are Seated</span>
                      </div>
                      <p className="text-[11px] text-[#1D1D1F]/80">
                        Browse the menu below to place or add dishes to your meal.
                      </p>
                    </div>
                  )}

                  {/* Final Bill Review & Payment CTA */}
                  {bookingDetails?.bill && (
                    <div className="pt-3 border-t border-[#D2D2D7]/60 space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#6E6E73] font-medium">Final Bill Total:</span>
                        <span className="font-bold text-base text-[#1D1D1F]">
                          ₹{bookingDetails.bill.Grand_Total}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsPaymentOpen(true)}
                        className="w-full py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98"
                      >
                        <CreditCard className="w-4 h-4" />
                        <span>
                          {bookingDetails.bill.Payment_Status === 'Paid'
                            ? 'View Paid Receipt'
                            : bookingDetails.bill.Payment_Status === 'Pending_Verification'
                            ? 'Payment Under Staff Verification'
                            : 'Pay Final Bill via UPI'}
                        </span>
                      </button>
                    </div>
                  )}

                  {/* Feedback dialog for completed visits */}
                  {activeBooking.Booking_Status === 'Completed' && (
                    <div className="pt-3 border-t border-[#D2D2D7]/60 space-y-3">
                      <h4 className="text-xs font-semibold text-[#1D1D1F] flex items-center space-x-1">
                        <Star className="w-3.5 h-3.5 text-[#B76E00]" />
                        <span>Rate Your Experience</span>
                      </h4>
                      {activeBooking.Feedback_Submitted_At || feedbackSubmitted ? (
                        <div className="p-3.5 rounded-2xl bg-[#248A3D]/10 text-xs text-[#248A3D] text-center font-medium">
                          Thank you! Your feedback has been recorded.
                        </div>
                      ) : (
                        <form onSubmit={handleSubmitFeedback} className="space-y-3">
                          <div className="flex items-center space-x-2 justify-center py-1">
                            {[1, 2, 3, 4, 5].map((star) => (
                              <button
                                key={star}
                                type="button"
                                onClick={() => setRating(star)}
                                className="p-1 focus:outline-none transition transform hover:scale-115 active:scale-95 cursor-pointer"
                              >
                                <Star
                                  className={`w-6 h-6 ${
                                    star <= rating
                                      ? 'fill-[#B76E00] text-[#B76E00]'
                                      : 'text-[#D2D2D7]'
                                  }`}
                                />
                              </button>
                            ))}
                          </div>
                          <textarea
                            rows={2}
                            placeholder="Optional comment about your meal or service..."
                            value={feedbackComment}
                            onChange={(e) => setFeedbackComment(e.target.value)}
                            className="w-full p-3 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                          />
                          <button
                            type="submit"
                            className="w-full py-2.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                          >
                            Submit Feedback
                          </button>
                        </form>
                      )}
                    </div>
                  )}
                </div>
              ) : (
                /* No Active Booking: Booking Creation Card */
                <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-[#D2D2D7] space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-[#1D1D1F]">Start a Visit</h3>
                    <div className="flex bg-[#E5E5EA]/70 p-1 rounded-full border border-[#D2D2D7]/60">
                      <button
                        onClick={() => setVisitType('Online')}
                        className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                          visitType === 'Online'
                            ? 'bg-white text-[#1D1D1F] font-semibold shadow-xs'
                            : 'text-[#6E6E73] font-medium'
                        }`}
                      >
                        Reserve
                      </button>
                      <button
                        onClick={() => setVisitType('Walk-in')}
                        className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                          visitType === 'Walk-in'
                            ? 'bg-white text-[#1D1D1F] font-semibold shadow-xs'
                            : 'text-[#6E6E73] font-medium'
                        }`}
                      >
                        Walk-in
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                        Party Size (Guests)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={partySize}
                        onChange={(e) => setPartySize(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                      />
                    </div>

                    {visitType === 'Online' && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                              Date
                            </label>
                            <input
                              type="date"
                              value={reservationDate}
                              onChange={(e) => setReservationDate(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                              Time Slot
                            </label>
                            <input
                              type="time"
                              value={reservationTime}
                              onChange={(e) => setReservationTime(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                            Select Table
                          </label>
                          <select
                            value={selectedTableId}
                            onChange={(e) => setSelectedTableId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7]/50 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#0071E3]"
                          >
                            {availableTables.map((t) => (
                              <option key={t.Table_ID} value={t.Table_ID}>
                                Table {t.Table_Number} (Fits up to {t.Seating_Capacity} guests)
                              </option>
                            ))}
                          </select>
                        </div>
                      </>
                    )}

                    <button
                      onClick={handleCreateBooking}
                      className="w-full py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-98"
                    >
                      {visitType === 'Online' ? 'Confirm Reservation' : 'Join Walk-in Queue'}
                    </button>
                  </div>
                </div>
              )}

              {/* Active Orders Tracker Card */}
              {bookingDetails?.orders && bookingDetails.orders.length > 0 && (
                <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#D2D2D7] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#1D1D1F]">
                      Your Active Orders ({bookingDetails.orders.length})
                    </span>
                    <button
                      onClick={refreshBookingDetails}
                      className="text-[#6E6E73] hover:text-[#1D1D1F] p-1 rounded-full hover:bg-[#F5F5F7] transition cursor-pointer"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {bookingDetails.orders.map((order: any) => (
                      <div
                        key={order.Order_ID}
                        className="p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/60 space-y-2"
                      >
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-mono font-bold text-[#1D1D1F]">
                            {order.Order_ID}
                          </span>
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-semibold uppercase ${
                              order.Order_Status === 'Served'
                                ? 'bg-[#248A3D]/10 text-[#248A3D]'
                                : order.Order_Status === 'Ready_For_Serving'
                                ? 'bg-[#0071E3]/10 text-[#0071E3]'
                                : order.Order_Status === 'In_Preparation'
                                ? 'bg-[#B76E00]/10 text-[#B76E00]'
                                : order.Order_Status === 'Authorized'
                                ? 'bg-[#0A84FF]/10 text-[#0A84FF]'
                                : 'bg-[#E5E5EA] text-[#6E6E73]'
                            }`}
                          >
                            {order.Order_Status.replace(/_/g, ' ')}
                          </span>
                        </div>

                        {/* Progress Stepper */}
                        <div className="flex items-center justify-between text-[10px] text-[#6E6E73] pt-1">
                          <span
                            className={
                              order.Order_Status !== 'Cancelled' ? 'font-semibold text-[#0071E3]' : ''
                            }
                          >
                            1. Submitted
                          </span>
                          <span>→</span>
                          <span
                            className={
                              ['Authorized', 'In_Preparation', 'Ready_For_Serving', 'Served'].includes(
                                order.Order_Status
                              )
                                ? 'font-semibold text-[#0071E3]'
                                : ''
                            }
                          >
                            2. Authorized
                          </span>
                          <span>→</span>
                          <span
                            className={
                              ['In_Preparation', 'Ready_For_Serving', 'Served'].includes(
                                order.Order_Status
                              )
                                ? 'font-semibold text-[#0071E3]'
                                : ''
                            }
                          >
                            3. Cooking
                          </span>
                          <span>→</span>
                          <span
                            className={
                              order.Order_Status === 'Served' ? 'font-semibold text-[#248A3D]' : ''
                            }
                          >
                            4. Served
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Interactive Menu & Cart Section */}
            <div className="lg:col-span-7 space-y-5">
              {/* Menu Controls: Search & Category Filter */}
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#D2D2D7] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#1D1D1F]">Dine-In Menu</h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                    >
                      <ShoppingBag className="w-3.5 h-3.5" />
                      <span>
                        Cart ({cart.reduce((s, i) => s + i.quantity, 0)}) • ₹{cartTotal}
                      </span>
                    </button>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6E6E73]" />
                    <input
                      type="text"
                      placeholder="Search dishes, ingredients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-full border border-[#D2D2D7] bg-[#F5F5F7] focus:bg-white text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center bg-[#E5E5EA]/70 p-1 rounded-full border border-[#D2D2D7]/60">
                    {['All', 'Starters', 'Mains', 'Desserts', 'Beverages'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-white text-[#1D1D1F] font-semibold shadow-xs'
                            : 'text-[#6E6E73] hover:text-[#1D1D1F] font-medium'
                        }`}
                      >
                        {cat}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* Dishes Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                {filteredMenuItems.map((item) => (
                  <motion.div
                    key={item.Food_ID}
                    whileHover={{ y: -3, transition: { duration: 0.2 } }}
                    className="bg-white rounded-3xl p-4 shadow-xs border border-[#D2D2D7] flex flex-col justify-between hover:border-[#0071E3]/50 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex space-x-3.5">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-[#F5F5F7] border border-[#D2D2D7]/60">
                        <DishImage
                          src={item.Image_URL}
                          alt={item.Food_Name}
                          category={item.Category}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#0071E3]">
                          {item.Category}
                        </span>
                        <h4 className="text-sm font-bold text-[#1D1D1F] truncate group-hover:text-[#0071E3] transition-colors">
                          {item.Food_Name}
                        </h4>
                        <p className="text-[11px] text-[#6E6E73] line-clamp-2 mt-0.5">
                          {item.Description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#D2D2D7]/60">
                      <span className="text-sm font-bold text-[#1D1D1F]">₹{item.Price}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="flex items-center space-x-1 px-3.5 py-1.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold transition shadow-xs cursor-pointer active:scale-95"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>Add</span>
                      </button>
                    </div>
                  </motion.div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Cart Drawer with Apple Sheet Animation */}
      <AnimatePresence>
        {isCartOpen && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
            >
              <div className="p-4 bg-white text-[#1D1D1F] border-b border-[#D2D2D7]/80 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3]">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base text-[#1D1D1F]">Your Order Cart</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-3">
                {cart.length === 0 ? (
                  <div className="text-center py-16 text-[#6E6E73] text-sm">
                    Your cart is empty. Add items from the menu.
                  </div>
                ) : (
                  cart.map((item) => (
                    <div
                      key={item.food.Food_ID}
                      className="flex items-center justify-between p-3.5 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/60"
                    >
                      <div>
                        <h4 className="text-xs font-bold text-[#1D1D1F]">{item.food.Food_Name}</h4>
                        <span className="text-[11px] text-[#6E6E73]">
                          ₹{item.food.Price} × {item.quantity} = ₹{item.food.Price * item.quantity}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => updateQuantity(item.food.Food_ID, -1)}
                          className="w-7 h-7 rounded-full bg-white border border-[#D2D2D7] flex items-center justify-center text-[#1D1D1F] hover:bg-[#E5E5EA] transition cursor-pointer"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="text-xs font-bold font-mono text-[#1D1D1F]">{item.quantity}</span>
                        <button
                          onClick={() => updateQuantity(item.food.Food_ID, 1)}
                          className="w-7 h-7 rounded-full bg-[#0071E3] text-white flex items-center justify-center hover:bg-[#0077ED] transition cursor-pointer"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 bg-white border-t border-[#D2D2D7]/80 space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6E6E73] font-medium">Subtotal:</span>
                    <span className="font-bold text-lg text-[#1D1D1F]">₹{cartTotal}</span>
                  </div>
                  <button
                    onClick={handleSubmitOrder}
                    className="w-full py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-sm shadow-xs transition cursor-pointer active:scale-98"
                  >
                    Submit Order for Kitchen Authorization
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Final Bill & Manual UPI Payment Drawer with Apple Styling */}
      <AnimatePresence>
        {isPaymentOpen && bookingDetails?.bill && (
          <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex justify-end">
            <motion.div
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
            >
              <div className="p-4 bg-white text-[#1D1D1F] border-b border-[#D2D2D7]/80 flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <div className="w-8 h-8 rounded-full bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3]">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base text-[#1D1D1F]">
                    Final Bill #{bookingDetails.bill.Bill_ID}
                  </h3>
                </div>
                <button
                  onClick={() => setIsPaymentOpen(false)}
                  className="p-1 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto space-y-4">
                {/* Bill Breakdown */}
                <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/60 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6E6E73]">Food Subtotal:</span>
                    <span className="font-semibold text-[#1D1D1F]">₹{bookingDetails.bill.Subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6E6E73]">GST (5%):</span>
                    <span className="font-semibold text-[#1D1D1F]">₹{bookingDetails.bill.Tax_Amount}</span>
                  </div>
                  {Number(bookingDetails.bill.Discount) > 0 && (
                    <div className="flex justify-between text-[#248A3D]">
                      <span>Discount ({bookingDetails.bill.Discount_Reason || 'Offer'}):</span>
                      <span className="font-semibold">-₹{bookingDetails.bill.Discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2.5 border-t border-[#D2D2D7]/60 text-sm font-bold text-[#1D1D1F]">
                    <span>Grand Total:</span>
                    <span>₹{bookingDetails.bill.Grand_Total}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span className="text-[#6E6E73]">Payment Status:</span>
                    <strong
                      className={
                        bookingDetails.bill.Payment_Status === 'Paid'
                          ? 'text-[#248A3D]'
                          : 'text-[#B76E00]'
                      }
                    >
                      {bookingDetails.bill.Payment_Status.replace(/_/g, ' ')}
                    </strong>
                  </div>
                </div>

                {/* UPI QR & Manual Verification Flow (Blueprint Section 13.2) */}
                {bookingDetails.bill.Payment_Status !== 'Paid' && (
                  <div className="space-y-4 pt-2">
                    <div className="text-center p-5 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7] space-y-3">
                      <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-[#1D1D1F]">
                        <QrCode className="w-4 h-4 text-[#0071E3]" />
                        <span>Scan & Pay via any UPI App</span>
                      </div>

                      {/* Dynamic UPI Payment QR Code */}
                      <div className="bg-white border border-[#D2D2D7] p-2.5 rounded-2xl mx-auto shadow-xs max-w-[220px]">
                        {dynamicUpiQrUrl ? (
                          <img
                            src={dynamicUpiQrUrl}
                            alt={`UPI Payment QR Code - ${restaurantPaymentInfo.upiPayeeName}`}
                            className="w-full h-auto rounded-xl object-contain mx-auto"
                          />
                        ) : (
                          <img
                            src="/assets/aistudio/upi_90343aca.jpeg"
                            alt={`Google Pay UPI QR Code - ${restaurantPaymentInfo.upiPayeeName}`}
                            className="w-full h-auto rounded-xl object-contain mx-auto"
                          />
                        )}
                      </div>

                      {/* Payee Info & Quick Copy */}
                      <div className="space-y-1">
                        <div className="text-xs font-medium text-[#1D1D1F]">
                          Payee: <span className="font-bold">{restaurantPaymentInfo.upiPayeeName}</span>
                        </div>
                        <div className="inline-flex items-center space-x-2 bg-white px-3 py-1.5 rounded-full border border-[#D2D2D7] shadow-xs">
                          <span className="text-xs font-mono font-bold text-[#0071E3]">
                            {restaurantPaymentInfo.upiId}
                          </span>
                          <button
                            type="button"
                            onClick={() => {
                              navigator.clipboard.writeText(restaurantPaymentInfo.upiId);
                              setCopiedUpi(true);
                              setTimeout(() => setCopiedUpi(false), 2000);
                              showToast('success', 'UPI ID copied to clipboard!');
                            }}
                            className="text-[10px] text-[#0071E3] hover:text-[#0077ED] font-semibold underline cursor-pointer"
                          >
                            {copiedUpi ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-[#1D1D1F]">
                        Amount to Pay: <strong className="text-base text-[#0071E3]">₹{bookingDetails.bill.Grand_Total}</strong>
                      </div>

                      {/* Direct UPI Intent Link for Mobile Devices */}
                      <a
                        href={`upi://pay?pa=${encodeURIComponent(restaurantPaymentInfo.upiId)}&pn=${encodeURIComponent(
                          restaurantPaymentInfo.upiPayeeName
                        )}&am=${encodeURIComponent(bookingDetails.bill.Grand_Total)}&tr=${encodeURIComponent(
                          bookingDetails.bill.Bill_ID
                        )}&cu=INR&tn=${encodeURIComponent(`SAVOR Bill ${bookingDetails.bill.Bill_ID}`)}`}
                        className="inline-flex items-center justify-center space-x-1.5 w-full py-2.5 rounded-xl bg-white border border-[#0071E3] text-[#0071E3] font-semibold text-xs hover:bg-[#0071E3]/5 transition shadow-xs"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Pay via Installed UPI App (GPay/PhonePe)</span>
                      </a>
                    </div>

                    {/* UTR Submission Form */}
                    <form onSubmit={handleSubmitUPIPayment} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                          Enter UPI Transaction Reference (UTR)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 421987654321"
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#D2D2D7] text-xs font-mono uppercase bg-[#F5F5F7]/50 focus:bg-white focus:border-[#0071E3] focus:ring-2 focus:ring-[#0071E3]/20 focus:outline-none"
                        />
                        <span className="block text-[10px] text-[#6E6E73] mt-1">
                          *UTR records payment as pending verification. Staff verifies
                          actual bank receipt before marking Paid.
                        </span>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-98"
                      >
                        Submit UTR for Staff Verification
                      </button>
                    </form>
                  </div>
                )}

                {bookingDetails.bill.Payment_Status === 'Paid' && (
                  <div className="p-5 bg-[#248A3D]/10 border border-[#248A3D]/20 rounded-2xl text-center space-y-2">
                    <CheckCircle2 className="w-8 h-8 text-[#248A3D] mx-auto" />
                    <h4 className="text-sm font-bold text-[#248A3D]">Payment Verified & Settled</h4>
                    <p className="text-xs text-[#1D1D1F]/80">
                      Staff has verified the bank receipt. Thank you for dining with Savor!
                    </p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};


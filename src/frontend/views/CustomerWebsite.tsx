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
import { BrandLogo } from '../components/BrandLogo';
import { BRAND_CONFIG } from '../../config/branding';
import { RequestDispatcher } from '../../backend/dispatcher';
import { notificationHub } from '../services/notificationHub';
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
  MessageSquareText,
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
  const [specialInstructions, setSpecialInstructions] = useState<string>('');
  const [placingOrder, setPlacingOrder] = useState<boolean>(false);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isPaymentOpen, setIsPaymentOpen] = useState<boolean>(false);
  const [utrInput, setUtrInput] = useState<string>('');

  // Multi-rating Feedback states
  const [selectedFeedbackOrderId, setSelectedFeedbackOrderId] = useState<string>('');
  const [overallRating, setOverallRating] = useState<number>(5);
  const [foodQualityRating, setFoodQualityRating] = useState<number>(5);
  const [serviceRating, setServiceRating] = useState<number>(5);
  const [cleanlinessRating, setCleanlinessRating] = useState<number>(5);
  const [feedbackName, setFeedbackName] = useState<string>('');
  const [feedbackComment, setFeedbackComment] = useState<string>('');
  const [feedbackSubmitted, setFeedbackSubmitted] = useState<boolean>(false);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [customerFeedbacks, setCustomerFeedbacks] = useState<any[]>([]);
  const [customerHistory, setCustomerHistory] = useState<any[]>([]);
  const [isEditingProfile, setIsEditingProfile] = useState<boolean>(false);
  const [editProfileName, setEditProfileName] = useState<string>('');
  const [editProfileEmail, setEditProfileEmail] = useState<string>('');
  const [profileSaving, setProfileSaving] = useState<boolean>(false);
  const [dashboardSection, setDashboardSection] = useState<'visit' | 'history' | 'feedback'>('visit');
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

  // Lock background scroll and close on Escape key when modals/drawers are open
  useEffect(() => {
    const isAnyModalOpen = Boolean(showOtpModal || isCartOpen || isPaymentOpen);
    if (!isAnyModalOpen) return;

    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowOtpModal(false);
        setIsCartOpen(false);
        setIsPaymentOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [showOtpModal, isCartOpen, isPaymentOpen]);

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
      const [historyRes, fbRes] = await Promise.all([
        RequestDispatcher.dispatch({
          action: 'getCustomerHistory',
          sessionId: sessionId,
        }),
        RequestDispatcher.dispatch({
          action: 'getCustomerFeedbacks',
          sessionId: sessionId,
        }),
      ]);

      if (fbRes.success && Array.isArray(fbRes.data)) {
        setCustomerFeedbacks(fbRes.data);
      }

      if (historyRes.success && Array.isArray(historyRes.data) && historyRes.data.length > 0) {
        setCustomerHistory(historyRes.data);

        // Find strictly active booking: Confirmed, Arrived, or Seated
        const active = historyRes.data.find(
          (b: any) =>
            b.Booking_Status === 'Confirmed' ||
            b.Booking_Status === 'Arrived' ||
            b.Booking_Status === 'Seated'
        ) || null;

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
    const [res, fbRes] = await Promise.all([
      RequestDispatcher.dispatch({
        action: 'getBookingDetails',
        sessionId: session.sessionId,
        payload: { bookingId: activeBooking.Booking_ID },
      }),
      RequestDispatcher.dispatch({
        action: 'getCustomerFeedbacks',
        sessionId: session.sessionId,
      }),
    ]);
    if (res.success && res.data) {
      setBookingDetails(res.data);
      setActiveBooking(res.data.booking);

      const b = res.data.booking;
      // 1. Detect Arrival Verified
      if (b && (b.Arrival_Status === 'Verified' || b.Booking_Status === 'Arrived')) {
        const arrKey = `verified_${b.Booking_ID}`;
        if (!notificationHub.hasSeen(arrKey)) {
          notificationHub.publish({
            id: arrKey,
            type: 'ARRIVAL_VERIFIED',
            title: 'Arrival Confirmed by Staff',
            message: 'Host desk has verified your arrival. Please wait a moment while your table is being prepared.',
            timestamp: Date.now(),
            priority: 'high',
            metadata: {
              bookingId: b.Booking_ID,
              customerName: b.Customer_Name,
            },
            autoDismissMs: 8000,
          });
        }
      }

      // 2. Detect Seated
      if (b && b.Booking_Status === 'Seated') {
        const seatKey = `seat_${b.Booking_ID}_${b.Assigned_Table_ID || 'table'}`;
        if (!notificationHub.hasSeen(seatKey)) {
          notificationHub.publish({
            id: seatKey,
            type: 'CUSTOMER_SEATED',
            title: 'Your Table is Ready!',
            message: `You have been seated at Table #${b.Table_Number || b.Assigned_Table_ID || '1'}. You can now browse the menu and place your food orders.`,
            timestamp: Date.now(),
            priority: 'high',
            metadata: {
              bookingId: b.Booking_ID,
              tableNumber: b.Table_Number || b.Assigned_Table_ID,
            },
            autoDismissMs: 8000,
          });
        }
      }

      // 3. Detect Bill Ready
      if (res.data.bill?.Bill_ID) {
        const billKey = `bill_${b?.Booking_ID || activeBooking.Booking_ID}_${res.data.bill.Bill_ID}`;
        if (!notificationHub.hasSeen(billKey) && res.data.bill.Payment_Status !== 'Paid') {
          notificationHub.publish({
            id: billKey,
            type: 'BILL_GENERATED',
            title: 'Your Bill is Ready',
            message: `Final Bill #${res.data.bill.Bill_ID} has been generated. Total payable: ₹${res.data.bill.Grand_Total}. Click View Bill to review and pay.`,
            timestamp: Date.now(),
            priority: 'high',
            metadata: {
              bookingId: b?.Booking_ID || activeBooking.Booking_ID,
              billId: res.data.bill.Bill_ID,
              grandTotal: res.data.bill.Grand_Total,
            },
            actionLabel: 'View Bill',
            autoDismissMs: 0,
            onAction: () => {
              setIsPaymentOpen(true);
            },
          });
        }
      }

      // 4. Detect Payment Settled
      if (res.data.bill?.Payment_Status === 'Paid') {
        const payKey = `pay_${res.data.bill.Payment_ID || res.data.bill.Bill_ID}`;
        if (!notificationHub.hasSeen(payKey)) {
          notificationHub.publish({
            id: payKey,
            type: 'PAYMENT_VERIFIED',
            title: 'Payment Confirmed & Verified',
            message: `Staff has verified your payment for Bill #${res.data.bill.Bill_ID}. Thank you for dining with ${BRAND_CONFIG.name}!`,
            timestamp: Date.now(),
            priority: 'normal',
            metadata: {
              bookingId: b?.Booking_ID || activeBooking.Booking_ID,
              billId: res.data.bill.Bill_ID,
            },
            autoDismissMs: 8000,
          });
        }
      }

      // 5. Detect Order Status progression
      if (Array.isArray(res.data.orders)) {
        for (const order of res.data.orders) {
          if (['Preparing', 'Ready', 'Served'].includes(order.Order_Status)) {
            const ordKey = `kitchen_${order.Order_ID}_${order.Order_Status}`;
            if (!notificationHub.hasSeen(ordKey)) {
              notificationHub.publish({
                id: ordKey,
                type: 'ORDER_STATUS_CHANGED',
                title:
                  order.Order_Status === 'Ready'
                    ? 'Food Order is Ready!'
                    : order.Order_Status === 'Preparing'
                    ? 'Kitchen is Preparing Your Food'
                    : 'Food Order Served',
                message: `Order #${order.Order_ID} status updated: ${order.Order_Status}.`,
                timestamp: Date.now(),
                priority: order.Order_Status === 'Ready' ? 'high' : 'normal',
                metadata: {
                  orderId: order.Order_ID,
                  status: order.Order_Status,
                },
                autoDismissMs: 8000,
              });
            }
          }
        }
      }
    }
    if (fbRes.success && Array.isArray(fbRes.data)) {
      setCustomerFeedbacks(fbRes.data);
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
      payload: { mobileNumber, otp: otpInput, customerName, email },
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
        tableId: visitType === 'Online' ? selectedTableId : undefined,
        customerId: (session as any).customerId || session.userId,
        customerName: (session as any).customerName || session.name,
        customerMobile: (session as any).mobileNumber || (session as any).mobile,
        email: session.email,
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
    let nextCart: CartItem[] = [];
    setCart((prev) => {
      const idx = prev.findIndex((i) => i.food.Food_ID === food.Food_ID);
      if (idx >= 0) {
        nextCart = [...prev];
        nextCart[idx] = { ...nextCart[idx], quantity: nextCart[idx].quantity + 1 };
      } else {
        nextCart = [...prev, { food, quantity: 1 }];
      }
      return nextCart;
    });
    // Persist outside React state updater function
    if (nextCart.length > 0) {
      persistCart(nextCart);
    }
    showToast('success', `Added ${food.Food_Name} to order.`);
  }

  function updateQuantity(foodId: string, delta: number) {
    let nextCart: CartItem[] = [];
    setCart((prev) => {
      nextCart = prev
        .map((item) => {
          if (item.food.Food_ID === foodId) {
            const newQ = item.quantity + delta;
            return newQ > 0 ? { ...item, quantity: newQ } : null;
          }
          return item;
        })
        .filter(Boolean) as CartItem[];
      return nextCart;
    });
    // Persist outside React state updater function
    persistCart(nextCart);
  }

  const cartTotal = cart.reduce((sum, item) => sum + item.food.Price * item.quantity, 0);

  // Submit Order
  async function handleSubmitOrder() {
    if (cart.length === 0 || placingOrder) return;
    if (!session?.sessionId) {
      showToast('error', 'Please sign in to place your order.');
      return;
    }

    let targetBookingId = activeBooking?.Booking_ID;

    // If customer arrived via verified table QR scan and has no booking visit yet, auto-create a dine-in visit
    if (!targetBookingId && scannedTable?.Table_ID) {
      setPlacingOrder(true);
      const walkinRes = await RequestDispatcher.dispatch({
        action: 'createBooking',
        sessionId: session.sessionId,
        payload: {
          customerName: session.customerName || session.user?.userName || 'Dine-in Guest',
          customerMobile: session.mobileNumber || session.user?.mobileNumber || '',
          customerEmail: session.email || session.user?.email || '',
          partySize: Math.max(1, Number(scannedTable.Seating_Capacity) || 2),
          visitType: 'Walk-in',
          tableId: scannedTable.Table_ID,
        },
      });

      if (walkinRes.success && walkinRes.data?.Booking_ID) {
        targetBookingId = walkinRes.data.Booking_ID;
        setActiveBooking(walkinRes.data);
      } else {
        setPlacingOrder(false);
        showToast('error', walkinRes.error?.message || 'Could not initialize table visit for ordering.');
        return;
      }
    }

    if (!targetBookingId) {
      showToast('error', 'Please select or create an active table visit before ordering food.');
      return;
    }

    setPlacingOrder(true);
    const itemsPayload = cart.map((i) => ({
      foodId: i.food.Food_ID,
      quantity: i.quantity,
    }));

    const res = await RequestDispatcher.dispatch({
      action: 'placeOrder',
      sessionId: session.sessionId,
      payload: {
        bookingId: targetBookingId,
        items: itemsPayload,
        specialInstructions: specialInstructions.trim(),
      },
    });
    setPlacingOrder(false);

    if (res.success) {
      setCart([]);
      setSpecialInstructions('');
      setIsCartOpen(false);
      showToast('success', 'Order submitted! Kitchen and staff have received your order.');
      refreshBookingDetails();
    } else {
      showToast('error', res.error?.message || 'Failed to place order.');
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

  // Submit Multi-Rating Order Feedback
  async function handleSubmitFeedback(e: React.FormEvent, targetOrderId?: string) {
    e.preventDefault();
    if (!activeBooking?.Booking_ID || !session?.sessionId || feedbackLoading) return;

    setFeedbackLoading(true);
    const res = await RequestDispatcher.dispatch({
      action: 'submitFeedback',
      sessionId: session.sessionId,
      payload: {
        orderId: targetOrderId || selectedFeedbackOrderId || undefined,
        bookingId: activeBooking.Booking_ID,
        customerName: (feedbackName || session.name || '').trim(),
        overallRating,
        foodQualityRating,
        serviceRating,
        cleanlinessRating,
        comments: feedbackComment.trim(),
        // backward compat aliases
        rating: overallRating,
        comment: feedbackComment.trim(),
      },
    });
    setFeedbackLoading(false);

    if (res.success) {
      setFeedbackSubmitted(true);
      setFeedbackComment('');
      showToast('success', 'Thank you! Your feedback has been saved.');
      await refreshBookingDetails();
    } else {
      showToast('error', res.error?.message || 'Feedback submission failed.');
    }
  }

  async function handleUpdateProfile(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.sessionId || profileSaving) return;
    setProfileSaving(true);
    const res = await RequestDispatcher.dispatch({
      action: 'updateCustomerProfile',
      sessionId: session.sessionId,
      payload: {
        customerName: editProfileName.trim(),
        email: editProfileEmail.trim(),
      },
    });
    setProfileSaving(false);
    if (res.success && res.data) {
      onSetSession({
        ...session,
        name: res.data.customerName || editProfileName.trim(),
        customerName: res.data.customerName || editProfileName.trim(),
        email: res.data.email || editProfileEmail.trim(),
      });
      setIsEditingProfile(false);
      showToast('success', 'Customer profile updated.');
    } else {
      showToast('error', res.error?.message || 'Unable to update profile.');
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
    <div className="min-h-screen bg-[#FFF9F0] text-[#3B1A08] pb-24">
      {/* Toast Notification */}
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
      <div className="bg-white/90 backdrop-blur-md border-b border-[#E6D5C3] py-3 px-4 sm:px-6">
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="flex items-center space-x-2.5">
            <BrandLogo size="sm" variant="icon" />
            <span className="font-bold text-[#F56A00]">
              {BRAND_CONFIG.name} Guest Portal
            </span>
            <span className="text-[#6B4C35]">•</span>
            {session ? (
              <span className="text-[#3B1A08] font-medium">
                Signed in as{' '}
                <strong className="text-[#3B1A08] font-semibold">
                  {(session as any).customerName || session.name}
                </strong>{' '}
                ({(session as any).mobileNumber || session.mobile})
              </span>
            ) : (
              <span className="text-[#6B4C35]">
                Sign in with mobile number & Email OTP to book tables and order food
              </span>
            )}
          </div>

          {/* Quick Demo Customer Sign-in buttons */}
          {!session && (
            <div className="flex items-center space-x-2">
              <span className="text-[11px] text-[#6B4C35] font-medium">Quick Demo:</span>
              <button
                onClick={() =>
                  quickLoginCustomer('Ananya Sharma', '9876543210', 'ananya.sharma@example.com')
                }
                className="px-3 py-1 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white text-[11px] font-semibold shadow-xs transition cursor-pointer"
              >
                Ananya (9876543210)
              </button>
              <button
                onClick={() =>
                  quickLoginCustomer('Vikram Patel', '9876543211', 'vikram.patel@example.com')
                }
                className="px-3 py-1 rounded-full bg-[#FDF4E7] hover:bg-[#F5E6D3] border border-[#E6D5C3] text-[#3B1A08] text-[11px] font-semibold shadow-xs transition cursor-pointer"
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
          <div className="bg-[#FDF4E7] border-2 border-[#3B1A08] text-[#3B1A08] px-5 py-4 rounded-2xl flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 rounded-xl bg-[#3B1A08] text-[#F4B41A] flex items-center justify-center shrink-0">
                <QrCode className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-sm font-bold text-[#3B1A08]">
                  {BRAND_CONFIG.name} • Ordering from Table {scannedTable.Table_Number} (Capacity: {scannedTable.Seating_Capacity} Guests)
                </h3>
                <p className="text-xs text-[#6B4C35]">
                  Table automatically identified via verified QR scan. Your booking and food orders go straight to Kitchen for Table {scannedTable.Table_Number}.
                </p>
              </div>
            </div>
            <span className="px-3 py-1 rounded-full bg-[#F4B41A]/30 text-[#3B1A08] text-[11px] font-bold self-start sm:self-center">
              Status: {scannedTable.Table_Status}
            </span>
          </div>
        )}

        {/* If Not Signed In: Customer Sign In Card */}
        {!session && (
          <div className="bg-white rounded-3xl p-6 sm:p-10 shadow-sm border border-[#E6D5C3] max-w-lg mx-auto">
            <div className="text-center space-y-2.5 mb-8">
              <div className="flex justify-center">
                <BrandLogo size="md" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#3B1A08] pt-1">Customer Sign In</h2>
              <p className="text-xs text-[#6B4C35]">
                We'll verify your mobile number with a secure 6-digit email OTP.
              </p>
            </div>

            <form onSubmit={handleRequestOTP} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                  10-Digit Mobile Number
                </label>
                <input
                  type="tel"
                  maxLength={10}
                  required
                  placeholder="e.g. 9876543210"
                  value={mobileNumber}
                  onChange={(e) => setMobileNumber(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-4 py-3 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 focus:bg-white focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 text-sm font-medium transition"
                />
              </div>

              {isNewCustomer && (
                <>
                  <div>
                    <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">Full Name</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Jane Doe"
                      value={customerName}
                      onChange={(e) => setCustomerName(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 focus:bg-white focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 text-sm font-medium transition"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                      Email Address (for OTP Delivery)
                    </label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. jane@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-4 py-3 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 focus:bg-white focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 text-sm font-medium transition"
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
                className="w-full py-3.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white font-semibold text-sm shadow-xs transition-all duration-200 disabled:opacity-50 cursor-pointer active:scale-98"
              >
                {authLoading ? 'Sending OTP...' : 'Send Verification OTP'}
              </button>
            </form>
          </div>
        )}

        {/* OTP Modal */}
        <AnimatePresence>
          {showOtpModal && (
            <div
              onClick={(e) => {
                if (e.target === e.currentTarget) setShowOtpModal(false);
              }}
              className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto touch-scroll"
            >
              <motion.div
                onClick={(e) => e.stopPropagation()}
                initial={{ opacity: 0, scale: 0.96, y: 12 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.96, y: 12 }}
                transition={{ duration: 0.2 }}
                className="bg-white rounded-3xl max-w-md w-full p-5 sm:p-8 space-y-4 shadow-2xl border border-[#E6D5C3] max-h-[92vh] sm:max-h-[90vh] overflow-y-auto overscroll-contain my-auto"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                    <div className="w-9 h-9 rounded-full bg-[#F56A00]/10 flex items-center justify-center text-[#F56A00]">
                      <Mail className="w-4 h-4" />
                    </div>
                    <h3 className="font-bold text-lg text-[#3B1A08]">
                      Enter 6-Digit Email OTP
                    </h3>
                  </div>
                  <button
                    onClick={() => setShowOtpModal(false)}
                    className="p-1 rounded-full text-[#6B4C35] hover:text-[#3B1A08] hover:bg-[#FDF4E7] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                <p className="text-xs text-[#6B4C35]">{otpSentMessage}</p>

                {/* Real Email Delivery Notice */}
                <div className="bg-[#FFF9F0] p-4 rounded-2xl border border-[#E6D5C3] flex items-start space-x-3 text-xs">
                  <div className="w-8 h-8 rounded-xl bg-[#F56A00]/10 text-[#F56A00] flex items-center justify-center flex-shrink-0 mt-0.5">
                    <Mail className="w-4 h-4" />
                  </div>
                  <div className="space-y-1">
                    <span className="font-semibold text-[#3B1A08] block">
                      {BRAND_CONFIG.name} Email Verification
                    </span>
                    <p className="text-[#6B4C35] leading-relaxed">
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
                      className="w-full text-center tracking-widest font-mono text-2xl py-3.5 rounded-2xl border border-[#E6D5C3] bg-[#FFF9F0] focus:bg-white focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20"
                    />
                    <span className="block text-[11px] text-[#6B4C35] text-center mt-1.5">
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
                    className="w-full py-3.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white font-semibold text-sm shadow-xs disabled:opacity-50 transition cursor-pointer active:scale-98"
                  >
                    {authLoading ? 'Verifying...' : 'Verify & Continue'}
                  </button>

                  <div className="text-center pt-2">
                    <button
                      type="button"
                      disabled={cooldownSeconds > 0}
                      onClick={handleRequestOTP}
                      className="text-xs text-[#F56A00] font-semibold hover:underline disabled:text-[#6B4C35]/50 cursor-pointer"
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

        {/* Signed-In: Personalized Customer Dashboard */}
        {session && (
          <div className="space-y-6">
            {/* Customer Profile & Dashboard Navigation */}
            <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#E6D5C3] flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center space-x-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full bg-[#FDF4E7] text-[#F56A00] border border-[#E6D5C3]">
                    {(session as any).customerId || session.userId || 'Customer'}
                  </span>
                  <h2 className="font-extrabold text-lg text-[#3B1A08]">
                    {(session as any).customerName || session.name}
                  </h2>
                </div>
                <p className="text-xs text-[#6B4C35]">
                  Mobile: <span className="font-mono font-semibold">{(session as any).mobileNumber || session.mobile}</span>
                  {' • '}
                  Email: <span className="font-medium">{session.email || 'Not set'}</span>
                </p>

                {isEditingProfile && (
                  <form onSubmit={handleUpdateProfile} className="pt-2 flex flex-wrap items-center gap-2">
                    <input
                      type="text"
                      required
                      placeholder="Full Name"
                      value={editProfileName}
                      onChange={(e) => setEditProfileName(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0] text-xs text-[#3B1A08]"
                    />
                    <input
                      type="email"
                      required
                      placeholder="Email Address"
                      value={editProfileEmail}
                      onChange={(e) => setEditProfileEmail(e.target.value)}
                      className="px-3 py-1.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0] text-xs text-[#3B1A08]"
                    />
                    <button
                      type="submit"
                      disabled={profileSaving}
                      className="px-3.5 py-1.5 rounded-full bg-[#F56A00] text-white text-xs font-semibold cursor-pointer"
                    >
                      {profileSaving ? 'Saving...' : 'Save Profile'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIsEditingProfile(false)}
                      className="px-3 py-1.5 rounded-full bg-[#FDF4E7] text-[#3B1A08] text-xs font-semibold cursor-pointer"
                    >
                      Cancel
                    </button>
                  </form>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-2">
                {!isEditingProfile && (
                  <button
                    onClick={() => {
                      setEditProfileName((session as any).customerName || session.name || '');
                      setEditProfileEmail(session.email || '');
                      setIsEditingProfile(true);
                    }}
                    className="px-3.5 py-1.5 rounded-full border border-[#E6D5C3] bg-[#FFF9F0] hover:bg-[#FDF4E7] text-[#3B1A08] text-xs font-semibold transition cursor-pointer"
                  >
                    Edit Profile
                  </button>
                )}
                {(['visit', 'history', 'feedback'] as const).map((tabKey) => (
                  <button
                    key={tabKey}
                    onClick={() => setDashboardSection(tabKey)}
                    className={`px-3.5 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ${
                      dashboardSection === tabKey
                        ? 'bg-[#3B1A08] text-white'
                        : 'bg-[#FDF4E7] text-[#6B4C35] hover:text-[#3B1A08]'
                    }`}
                  >
                    {tabKey === 'visit'
                      ? 'Current Visit & Menu'
                      : tabKey === 'history'
                      ? `Order History (${customerHistory.length})`
                      : `Feedback History (${customerFeedbacks.length})`}
                  </button>
                ))}
              </div>
            </div>

            {dashboardSection === 'history' && (
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-4">
                <h3 className="font-bold text-base text-[#3B1A08]">Your Previous Visits & Order History</h3>
                {customerHistory.length === 0 ? (
                  <p className="text-xs text-[#6B4C35]">No previous bookings or orders found for your account.</p>
                ) : (
                  <div className="space-y-3">
                    {customerHistory.map((bk: any) => (
                      <div key={bk.Booking_ID} className="p-4 rounded-2xl bg-[#FFF9F0] border border-[#E6D5C3] space-y-2 text-xs">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div>
                            <span className="font-mono font-bold text-[#3B1A08]">{bk.Booking_ID}</span>
                            <span className="ml-2 text-[#6B4C35]">
                              {bk.Visit_Type} • Party of {bk.Party_Size} • {bk.Booking_Date}
                            </span>
                          </div>
                          <span className="px-2.5 py-0.5 rounded-full bg-[#3B1A08]/10 text-[#3B1A08] font-semibold text-[11px]">
                            {bk.Booking_Status}
                          </span>
                        </div>
                        {Array.isArray(bk.orders) && bk.orders.length > 0 && (
                          <div className="space-y-1.5 pt-1 border-t border-[#E6D5C3]/70">
                            {bk.orders.map((ord: any) => (
                              <div key={ord.Order_ID} className="flex items-center justify-between text-[11px]">
                                <span className="font-mono font-semibold text-[#3B1A08]">{ord.Order_ID}</span>
                                <span className="text-[#6B4C35]">{String(ord.Order_Status || '').replace(/_/g, ' ')}</span>
                              </div>
                            ))}
                          </div>
                        )}
                        {bk.bill && (
                          <div className="pt-1 border-t border-[#E6D5C3]/70 flex items-center justify-between font-semibold text-[11px]">
                            <span>Bill {bk.bill.Bill_ID}</span>
                            <span>
                              ₹{bk.bill.Grand_Total} ({bk.bill.Payment_Status})
                            </span>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dashboardSection === 'feedback' && (
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-4">
                <h3 className="font-bold text-base text-[#3B1A08]">Your Submitted Feedback History</h3>
                {customerFeedbacks.length === 0 ? (
                  <p className="text-xs text-[#6B4C35]">You have not submitted any feedback yet.</p>
                ) : (
                  <div className="space-y-3">
                    {customerFeedbacks.map((fb: any, idx: number) => (
                      <div key={fb.Feedback_ID || idx} className="p-4 rounded-2xl bg-[#FFF9F0] border border-[#E6D5C3] space-y-1 text-xs">
                        <div className="flex items-center justify-between">
                          <span className="font-mono font-bold text-[#3B1A08]">{fb.Booking_ID}</span>
                          <span className="font-bold text-[#F56A00]">{fb.Overall_Rating} / 5 ★</span>
                        </div>
                        <p className="text-[#3B1A08]">{fb.Comments || 'No comment provided.'}</p>
                        <p className="text-[11px] text-[#6B4C35]">
                          Submitted: {fb.Submitted_At ? new Date(fb.Submitted_At).toLocaleString() : 'Recorded'}
                        </p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {dashboardSection === 'visit' && (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* Left: Active Booking / Queue Status */}
            <div className="lg:col-span-5 space-y-4">
              {activeBooking ? (
                <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#E6D5C3]">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#6B4C35]">
                          Active Visit
                        </span>
                        <button
                          onClick={() => setActiveBooking(null)}
                          className="text-[11px] text-[#F56A00] hover:underline font-semibold cursor-pointer"
                        >
                          (New / Switch)
                        </button>
                      </div>
                      <span className="text-base font-bold text-[#3B1A08]">
                        {activeBooking.Booking_ID}
                      </span>
                    </div>
                    <span
                      className={`px-3 py-1 rounded-full text-xs font-semibold ${
                        activeBooking.Booking_Status === 'Seated'
                          ? 'bg-[#248A3D]/10 text-[#248A3D] border border-[#248A3D]/20'
                          : activeBooking.Booking_Status === 'Arrived'
                          ? 'bg-[#F56A00]/10 text-[#F56A00] border border-[#F56A00]/20'
                          : 'bg-[#F4B41A]/20 text-[#92400E] border border-[#F4B41A]/40'
                      }`}
                    >
                      {activeBooking.Booking_Status}
                    </span>
                  </div>

                  {/* Visit Specifics */}
                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="p-3 rounded-2xl bg-[#FFF9F0]">
                      <span className="text-[#6B4C35] block text-[10px] font-medium">Visit Type</span>
                      <strong className="text-[#3B1A08] font-semibold">{activeBooking.Visit_Type}</strong>
                    </div>
                    <div className="p-3 rounded-2xl bg-[#FFF9F0]">
                      <span className="text-[#6B4C35] block text-[10px] font-medium">Party Size</span>
                      <strong className="text-[#3B1A08] font-semibold">{activeBooking.Party_Size} Guests</strong>
                    </div>

                    {bookingDetails?.reservations?.[0] && (
                      <div className="p-3 rounded-2xl bg-[#FFF9F0] col-span-2">
                        <span className="text-[#6B4C35] block text-[10px] font-medium">
                          Reserved Table
                        </span>
                        <strong className="text-[#F56A00] font-semibold">
                          Table {bookingDetails.reservations[0].Table_ID} (105-Min Blocked Window)
                        </strong>
                      </div>
                    )}
                  </div>

                  {/* Walk-in Queue Display */}
                  {activeBooking.Visit_Type === 'Walk-in' &&
                    activeBooking.Booking_Status !== 'Seated' &&
                    activeBooking.Booking_Status !== 'Completed' && (
                      <div className="bg-[#FDF4E7] p-4 rounded-2xl border border-[#F4B41A]/50 space-y-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-semibold text-[#3B1A08]">
                            Live Queue Position:
                          </span>
                          <span className="text-xl font-mono font-bold text-[#F56A00]">
                            #{queuePosition || 1}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#6B4C35] leading-snug">
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
                        className="w-full py-3.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white font-semibold text-xs shadow-md transition flex items-center justify-center space-x-2 cursor-pointer active:scale-98 animate-pulse"
                      >
                        <CheckCircle2 className="w-4 h-4" />
                        <span>I'm Arrived at Restaurant</span>
                      </button>
                      <p className="text-[10px] text-center text-[#6B4C35]">
                        Confirm within 10-minute grace window to alert host staff and secure your table.
                      </p>
                    </div>
                  )}

                  {/* Arrival Confirmed Notice */}
                  {activeBooking.Booking_Status === 'Arrived' && (
                    <div className="p-3.5 bg-[#F56A00]/10 border border-[#F56A00]/25 rounded-2xl text-xs text-[#C2410C] space-y-1">
                      <div className="font-semibold flex items-center space-x-1.5">
                        <Clock className="w-3.5 h-3.5" />
                        <span>Arrival Registered (15-Min Staff Window)</span>
                      </div>
                      <p className="text-[11px] text-[#3B1A08]/80">
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
                      <p className="text-[11px] text-[#3B1A08]/80">
                        Browse the menu on the right to place orders directly to our Kitchen.
                      </p>
                    </div>
                  )}

                  {/* Final Bill Review & Payment CTA */}
                  {bookingDetails?.bill && (
                    <div id="bill-section" className="pt-3 border-t border-[#E6D5C3] space-y-2.5">
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[#6B4C35] font-medium">Final Bill Total:</span>
                        <span className="font-bold text-base text-[#3B1A08]">
                          ₹{bookingDetails.bill.Grand_Total}
                        </span>
                      </div>
                      <button
                        onClick={() => setIsPaymentOpen(true)}
                        className="w-full py-3 rounded-full bg-[#3B1A08] hover:bg-[#2A1104] text-white font-semibold text-xs shadow-xs transition flex items-center justify-center space-x-1.5 cursor-pointer active:scale-98"
                      >
                        <CreditCard className="w-4 h-4 text-[#F4B41A]" />
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

                  {/* Complete Multi-Rating Feedback Form (for Served Orders or Completed Visits) */}
                  {(() => {
                    const servedOrders = (bookingDetails?.orders || []).filter(
                      (o: any) => o.Order_Status === 'Served'
                    );
                    const isEligibleForFeedback =
                      servedOrders.length > 0 || activeBooking.Booking_Status === 'Completed';
                    if (!isEligibleForFeedback) return null;

                    const activeTargetOrderId =
                      selectedFeedbackOrderId || (servedOrders[0]?.Order_ID ?? '');
                    const alreadySubmittedForOrder = activeTargetOrderId
                      ? customerFeedbacks.some((f: any) => f.Order_ID === activeTargetOrderId)
                      : Boolean(activeBooking.Feedback_Submitted_At) ||
                        customerFeedbacks.some((f: any) => f.Booking_ID === activeBooking.Booking_ID);

                    const renderRatingRow = (
                      label: string,
                      value: number,
                      setter: (v: number) => void
                    ) => (
                      <div className="flex items-center justify-between gap-2 py-1">
                        <span className="text-xs font-semibold text-[#3B1A08]">{label}</span>
                        <div className="flex items-center space-x-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => setter(star)}
                              className="p-0.5 focus:outline-none transition transform hover:scale-110 active:scale-95 cursor-pointer"
                            >
                              <Star
                                className={`w-5 h-5 ${
                                  star <= value
                                    ? 'fill-[#F4B41A] text-[#F4B41A]'
                                    : 'text-[#E6D5C3]'
                                }`}
                              />
                            </button>
                          ))}
                        </div>
                      </div>
                    );

                    return (
                      <div className="pt-4 border-t border-[#E6D5C3] space-y-3">
                        <h4 className="text-xs font-bold text-[#3B1A08] flex items-center space-x-1.5">
                          <Star className="w-4 h-4 fill-[#F4B41A] text-[#F4B41A]" />
                          <span>Share Your {BRAND_CONFIG.name} Feedback</span>
                        </h4>

                        {servedOrders.length > 0 && (
                          <div>
                            <label className="block text-[10px] font-semibold uppercase tracking-wider text-[#6B4C35] mb-1">
                              Related Order ID
                            </label>
                            <select
                              value={activeTargetOrderId}
                              onChange={(e) => {
                                setSelectedFeedbackOrderId(e.target.value);
                                setFeedbackSubmitted(false);
                              }}
                              className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0] text-xs font-mono text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                            >
                              {servedOrders.map((o: any) => (
                                <option key={o.Order_ID} value={o.Order_ID}>
                                  {o.Order_ID} (Served)
                                </option>
                              ))}
                            </select>
                          </div>
                        )}

                        {alreadySubmittedForOrder || (feedbackSubmitted && !servedOrders.some((o: any) => o.Order_ID !== activeTargetOrderId && !customerFeedbacks.some((f: any) => f.Order_ID === o.Order_ID))) ? (
                          <div className="p-3.5 rounded-2xl bg-[#248A3D]/10 border border-[#248A3D]/25 text-xs text-[#248A3D] text-center font-semibold">
                            Thank you! Your ratings and feedback for {activeTargetOrderId || activeBooking.Booking_ID} have been saved.
                          </div>
                        ) : (
                          <form
                            onSubmit={(e) => handleSubmitFeedback(e, activeTargetOrderId)}
                            className="space-y-2.5 bg-[#FFF9F0] p-4 rounded-2xl border border-[#E6D5C3]"
                          >
                            {renderRatingRow('Overall Rating', overallRating, setOverallRating)}
                            {renderRatingRow('Food Quality', foodQualityRating, setFoodQualityRating)}
                            {renderRatingRow('Service', serviceRating, setServiceRating)}
                            {renderRatingRow('Cleanliness', cleanlinessRating, setCleanlinessRating)}

                            <div>
                              <label className="block text-[11px] font-semibold text-[#3B1A08] mb-1">
                                Your Name (Optional)
                              </label>
                              <input
                                type="text"
                                placeholder={session.name || 'Your name'}
                                value={feedbackName}
                                onChange={(e) => setFeedbackName(e.target.value)}
                                className="w-full px-3 py-2 rounded-xl border border-[#E6D5C3] bg-white text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                              />
                            </div>

                            <textarea
                              rows={2}
                              placeholder="Tell us about your food, hospitality, and dining ambiance..."
                              value={feedbackComment}
                              onChange={(e) => setFeedbackComment(e.target.value)}
                              className="w-full p-3 rounded-xl border border-[#E6D5C3] bg-white text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                            />
                            <button
                              type="submit"
                              disabled={feedbackLoading}
                              className="w-full py-2.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition disabled:opacity-50 cursor-pointer"
                            >
                              {feedbackLoading ? 'Saving Feedback...' : 'Submit Feedback'}
                            </button>
                          </form>
                        )}
                      </div>
                    );
                  })()}
                </div>
              ) : (
                /* No Active Booking: Booking Creation Card */
                <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-[#E6D5C3] space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-base text-[#3B1A08]">Start a Visit</h3>
                    <div className="flex bg-[#FDF4E7] p-1 rounded-full border border-[#E6D5C3]">
                      <button
                        onClick={() => setVisitType('Online')}
                        className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                          visitType === 'Online'
                            ? 'bg-[#3B1A08] text-white font-semibold shadow-xs'
                            : 'text-[#6B4C35] font-medium'
                        }`}
                      >
                        Reserve
                      </button>
                      <button
                        onClick={() => setVisitType('Walk-in')}
                        className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                          visitType === 'Walk-in'
                            ? 'bg-[#3B1A08] text-white font-semibold shadow-xs'
                            : 'text-[#6B4C35] font-medium'
                        }`}
                      >
                        Walk-in
                      </button>
                    </div>
                  </div>

                  <div className="space-y-3.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                        Party Size (Guests)
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={16}
                        value={partySize}
                        onChange={(e) => setPartySize(Number(e.target.value))}
                        className="w-full px-3 py-2.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#F56A00]"
                      />
                    </div>

                    {visitType === 'Online' && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                              Date
                            </label>
                            <input
                              type="date"
                              value={reservationDate}
                              onChange={(e) => setReservationDate(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#F56A00]"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                              Time Slot
                            </label>
                            <input
                              type="time"
                              value={reservationTime}
                              onChange={(e) => setReservationTime(e.target.value)}
                              className="w-full px-3 py-2.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#F56A00]"
                            />
                          </div>
                        </div>

                        <div>
                          <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                            Select Table
                          </label>
                          <select
                            value={selectedTableId}
                            onChange={(e) => setSelectedTableId(e.target.value)}
                            className="w-full px-3 py-2.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 focus:bg-white text-xs font-medium focus:outline-none focus:border-[#F56A00]"
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
                      className="w-full py-3.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-98"
                    >
                      {visitType === 'Online' ? 'Confirm Reservation' : 'Join Walk-in Queue'}
                    </button>
                  </div>
                </div>
              )}

              {/* Active Orders Tracker Card */}
              {bookingDetails?.orders && bookingDetails.orders.length > 0 && (
                <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#E6D5C3] space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-sm text-[#3B1A08]">
                      Your Active Orders ({bookingDetails.orders.length})
                    </span>
                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => {
                          document.getElementById('customer-dine-in-menu')?.scrollIntoView({ behavior: 'smooth' });
                        }}
                        className="px-3 py-1 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white text-[11px] font-semibold transition cursor-pointer"
                      >
                        + Add More Items
                      </button>
                      <button
                        onClick={refreshBookingDetails}
                        className="text-[#6B4C35] hover:text-[#3B1A08] p-1 rounded-full hover:bg-[#FDF4E7] transition cursor-pointer"
                      >
                        <RefreshCw className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {bookingDetails.orders.map((order: any) => {
                      const s = order.Order_Status || 'New_Order';
                      const stageIdx =
                        s === 'Served'
                          ? 5
                          : s === 'Ready' || s === 'Ready_For_Serving'
                          ? 4
                          : s === 'Preparing' || s === 'In_Preparation'
                          ? 3
                          : s === 'Accepted' || s === 'Authorized'
                          ? 2
                          : 1;
                      return (
                        <div
                          key={order.Order_ID}
                          className="p-3.5 rounded-2xl bg-[#FFF9F0] border border-[#E6D5C3] space-y-2"
                        >
                          <div className="flex items-center justify-between text-xs">
                            <span className="font-mono font-bold text-[#3B1A08]">
                              {order.Order_ID}
                            </span>
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                                s === 'Served'
                                  ? 'bg-[#248A3D]/15 text-[#248A3D]'
                                  : s === 'Ready' || s === 'Ready_For_Serving'
                                  ? 'bg-[#248A3D]/10 text-[#248A3D]'
                                  : s === 'Preparing' || s === 'In_Preparation'
                                  ? 'bg-[#F56A00]/15 text-[#C2410C]'
                                  : s === 'Accepted' || s === 'Authorized'
                                  ? 'bg-[#3B1A08]/10 text-[#3B1A08]'
                                  : 'bg-[#F4B41A]/30 text-[#78350F]'
                              }`}
                            >
                              {s.replace(/_/g, ' ')}
                            </span>
                          </div>

                          {/* 5-Stage Kitchen Sync Stepper */}
                          <div className="flex items-center justify-between text-[10px] text-[#6B4C35] pt-1 gap-0.5">
                            <span className={stageIdx >= 1 ? 'font-bold text-[#F56A00]' : ''}>
                              1. New
                            </span>
                            <span>→</span>
                            <span className={stageIdx >= 2 ? 'font-bold text-[#F56A00]' : ''}>
                              2. Accepted
                            </span>
                            <span>→</span>
                            <span className={stageIdx >= 3 ? 'font-bold text-[#F56A00]' : ''}>
                              3. Preparing
                            </span>
                            <span>→</span>
                            <span className={stageIdx >= 4 ? 'font-bold text-[#248A3D]' : ''}>
                              4. Ready
                            </span>
                            <span>→</span>
                            <span className={stageIdx >= 5 ? 'font-bold text-[#248A3D]' : ''}>
                              5. Served
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Interactive Menu & Cart Section */}
            <div id="customer-dine-in-menu" className="lg:col-span-7 space-y-5">
              {/* Menu Controls: Search & Category Filter */}
              <div className="bg-white rounded-3xl p-5 shadow-xs border border-[#E6D5C3] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-base text-[#3B1A08]">Dine-In Menu</h3>
                  {cart.length > 0 && (
                    <button
                      onClick={() => setIsCartOpen(true)}
                      className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
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
                    <Search className="w-4 h-4 absolute left-3.5 top-3 text-[#6B4C35]" />
                    <input
                      type="text"
                      placeholder="Search dishes, ingredients..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 rounded-full border border-[#E6D5C3] bg-[#FFF9F0] focus:bg-white text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                    />
                  </div>

                  <div className="flex flex-wrap items-center bg-[#FDF4E7] p-1 rounded-full border border-[#E6D5C3]">
                    {['All', 'Starters', 'Mains', 'Desserts', 'Beverages'].map((cat) => (
                      <button
                        key={cat}
                        onClick={() => setSelectedCategory(cat)}
                        className={`px-3 py-1 rounded-full text-xs transition cursor-pointer ${
                          selectedCategory === cat
                            ? 'bg-[#3B1A08] text-white font-semibold shadow-xs'
                            : 'text-[#6B4C35] hover:text-[#3B1A08] font-medium'
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
                    className="bg-white rounded-3xl p-4 shadow-xs border border-[#E6D5C3] flex flex-col justify-between hover:border-[#F56A00]/60 hover:shadow-md transition-all duration-200 group"
                  >
                    <div className="flex space-x-3.5">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden flex-shrink-0 bg-[#FFF9F0] border border-[#E6D5C3]">
                        <DishImage
                          src={item.Image_URL}
                          alt={item.Food_Name}
                          category={item.Category}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[#F56A00]">
                          {item.Category}
                        </span>
                        <h4 className="text-sm font-bold text-[#3B1A08] truncate group-hover:text-[#F56A00] transition-colors">
                          {item.Food_Name}
                        </h4>
                        <p className="text-[11px] text-[#6B4C35] line-clamp-2 mt-0.5">
                          {item.Description}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 mt-2 border-t border-[#E6D5C3]/60">
                      <span className="text-sm font-bold text-[#3B1A08]">₹{item.Price}</span>
                      <button
                        onClick={() => addToCart(item)}
                        className="flex items-center space-x-1 px-3.5 py-1.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold transition shadow-xs cursor-pointer active:scale-95"
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
        )}
      </div>

      {/* Cart Drawer */}
      <AnimatePresence>
        {isCartOpen && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsCartOpen(false);
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
            >
              <div className="p-4 bg-[#3B1A08] text-white flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#F56A00] flex items-center justify-center text-white">
                    <ShoppingBag className="w-4 h-4" />
                  </div>
                  <h3 className="font-bold text-base">Your Order Cart</h3>
                </div>
                <button
                  onClick={() => setIsCartOpen(false)}
                  className="p-1 rounded-full text-[#FDF4E7] hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-4 flex-1 overflow-y-auto space-y-3 bg-[#FFF9F0]">
                {cart.length === 0 ? (
                  <div className="text-center py-16 text-[#6B4C35] text-sm">
                    Your cart is empty. Add items from the menu.
                  </div>
                ) : (
                  <>
                    {cart.map((item) => (
                      <div
                        key={item.food.Food_ID}
                        className="flex items-center justify-between p-3.5 rounded-2xl bg-white border border-[#E6D5C3]"
                      >
                        <div>
                          <h4 className="text-xs font-bold text-[#3B1A08]">{item.food.Food_Name}</h4>
                          <span className="text-[11px] text-[#6B4C35]">
                            ₹{item.food.Price} × {item.quantity} = ₹{item.food.Price * item.quantity}
                          </span>
                        </div>
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => updateQuantity(item.food.Food_ID, -1)}
                            className="w-7 h-7 rounded-full bg-[#FDF4E7] border border-[#E6D5C3] flex items-center justify-center text-[#3B1A08] hover:bg-[#F5E6D3] transition cursor-pointer"
                          >
                            <Minus className="w-3 h-3" />
                          </button>
                          <span className="text-xs font-bold font-mono text-[#3B1A08]">{item.quantity}</span>
                          <button
                            onClick={() => updateQuantity(item.food.Food_ID, 1)}
                            className="w-7 h-7 rounded-full bg-[#F56A00] text-white flex items-center justify-center hover:bg-[#D95800] transition cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                          </button>
                        </div>
                      </div>
                    ))}

                    {/* Special Kitchen Instructions */}
                    <div className="p-3.5 rounded-2xl bg-white border border-[#E6D5C3] space-y-2 mt-2">
                      <label className="text-xs font-bold text-[#3B1A08] flex items-center space-x-1.5">
                        <MessageSquareText className="w-3.5 h-3.5 text-[#F56A00]" />
                        <span>Special Cooking Instructions (Optional)</span>
                      </label>
                      <textarea
                        rows={2}
                        placeholder="e.g. Less spicy, no onion/garlic, extra crispy..."
                        value={specialInstructions}
                        onChange={(e) => setSpecialInstructions(e.target.value)}
                        className="w-full p-2.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/60 text-xs text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                      />
                    </div>
                  </>
                )}
              </div>

              {cart.length > 0 && (
                <div className="p-5 bg-white border-t border-[#E6D5C3] space-y-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[#6B4C35] font-medium">Subtotal:</span>
                    <span className="font-bold text-lg text-[#3B1A08]">₹{cartTotal}</span>
                  </div>
                  <button
                    onClick={handleSubmitOrder}
                    disabled={placingOrder}
                    className="w-full py-3.5 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white font-semibold text-sm shadow-xs transition disabled:opacity-50 cursor-pointer active:scale-98"
                  >
                    {placingOrder ? 'Sending Order to Kitchen...' : 'Confirm & Send Order to Kitchen'}
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Final Bill & Manual UPI Payment Drawer */}
      <AnimatePresence>
        {isPaymentOpen && bookingDetails?.bill && (
          <div
            onClick={(e) => {
              if (e.target === e.currentTarget) setIsPaymentOpen(false);
            }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end"
          >
            <motion.div
              onClick={(e) => e.stopPropagation()}
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 220 }}
              className="bg-white w-full max-w-md h-full flex flex-col shadow-2xl"
            >
              <div className="p-4 bg-[#3B1A08] text-white flex items-center justify-between">
                <div className="flex items-center space-x-2.5">
                  <div className="w-8 h-8 rounded-full bg-[#F56A00] flex items-center justify-center text-white">
                    <CreditCard className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="font-bold text-sm">
                      {BRAND_CONFIG.name} Bill #{bookingDetails.bill.Bill_ID}
                    </h3>
                    <span className="text-[10px] text-[#FDF4E7]/80">{BRAND_CONFIG.subtitle}</span>
                  </div>
                </div>
                <button
                  onClick={() => setIsPaymentOpen(false)}
                  className="p-1 rounded-full text-[#FDF4E7] hover:text-white hover:bg-white/10 transition cursor-pointer"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-5 flex-1 overflow-y-auto space-y-4 bg-[#FFF9F0]">
                {/* Bill Breakdown */}
                <div className="p-4 rounded-2xl bg-white border border-[#E6D5C3] space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-[#6B4C35]">Food Subtotal:</span>
                    <span className="font-semibold text-[#3B1A08]">₹{bookingDetails.bill.Subtotal}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-[#6B4C35]">Taxes &amp; GST:</span>
                    <span className="font-semibold text-[#3B1A08]">₹{bookingDetails.bill.Tax_Amount}</span>
                  </div>
                  {Number(bookingDetails.bill.Discount) > 0 && (
                    <div className="flex justify-between text-[#248A3D]">
                      <span>Discount ({bookingDetails.bill.Discount_Reason || 'Offer'}):</span>
                      <span className="font-semibold">-₹{bookingDetails.bill.Discount}</span>
                    </div>
                  )}
                  <div className="flex justify-between pt-2.5 border-t border-[#E6D5C3] text-sm font-bold text-[#3B1A08]">
                    <span>Grand Total:</span>
                    <span>₹{bookingDetails.bill.Grand_Total}</span>
                  </div>
                  <div className="flex justify-between text-[11px] pt-1">
                    <span className="text-[#6B4C35]">Payment Status:</span>
                    <strong
                      className={
                        bookingDetails.bill.Payment_Status === 'Paid'
                          ? 'text-[#248A3D]'
                          : 'text-[#B45309]'
                      }
                    >
                      {bookingDetails.bill.Payment_Status.replace(/_/g, ' ')}
                    </strong>
                  </div>
                </div>

                {/* UPI QR & Manual Verification Flow */}
                {bookingDetails.bill.Payment_Status !== 'Paid' && (
                  <div className="space-y-4 pt-2">
                    <div className="text-center p-5 rounded-2xl bg-white border border-[#E6D5C3] space-y-3">
                      <div className="flex items-center justify-center space-x-1.5 text-xs font-semibold text-[#3B1A08]">
                        <QrCode className="w-4 h-4 text-[#F56A00]" />
                        <span>Scan & Pay via any UPI App</span>
                      </div>

                      {/* Dynamic UPI Payment QR Code */}
                      <div className="bg-white border border-[#E6D5C3] p-2.5 rounded-2xl mx-auto shadow-xs max-w-[220px]">
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
                        <div className="text-xs font-medium text-[#3B1A08]">
                          Payee: <span className="font-bold">{restaurantPaymentInfo.upiPayeeName}</span>
                        </div>
                        <div className="inline-flex items-center space-x-2 bg-[#FFF9F0] px-3 py-1.5 rounded-full border border-[#E6D5C3] shadow-xs">
                          <span className="text-xs font-mono font-bold text-[#F56A00]">
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
                            className="text-[10px] text-[#F56A00] hover:text-[#D95800] font-semibold underline cursor-pointer"
                          >
                            {copiedUpi ? 'Copied!' : 'Copy'}
                          </button>
                        </div>
                      </div>

                      <div className="text-sm text-[#3B1A08]">
                        Amount to Pay: <strong className="text-base text-[#F56A00]">₹{bookingDetails.bill.Grand_Total}</strong>
                      </div>

                      {/* Direct UPI Intent Link for Mobile Devices */}
                      <a
                        href={`upi://pay?pa=${encodeURIComponent(restaurantPaymentInfo.upiId)}&pn=${encodeURIComponent(
                          restaurantPaymentInfo.upiPayeeName
                        )}&am=${encodeURIComponent(bookingDetails.bill.Grand_Total)}&tr=${encodeURIComponent(
                          bookingDetails.bill.Bill_ID
                        )}&cu=INR&tn=${encodeURIComponent(`${BRAND_CONFIG.name} Bill ${bookingDetails.bill.Bill_ID}`)}`}
                        className="inline-flex items-center justify-center space-x-1.5 w-full py-2.5 rounded-xl bg-[#FDF4E7] border border-[#F56A00] text-[#F56A00] font-semibold text-xs hover:bg-[#F56A00]/10 transition shadow-xs"
                      >
                        <Zap className="w-3.5 h-3.5" />
                        <span>Pay via Installed UPI App (GPay/PhonePe)</span>
                      </a>
                    </div>

                    {/* UTR Submission Form */}
                    <form onSubmit={handleSubmitUPIPayment} className="space-y-3">
                      <div>
                        <label className="block text-xs font-semibold text-[#3B1A08] mb-1">
                          Enter UPI Transaction Reference (UTR)
                        </label>
                        <input
                          type="text"
                          required
                          placeholder="e.g. 421987654321"
                          value={utrInput}
                          onChange={(e) => setUtrInput(e.target.value)}
                          className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-xs font-mono uppercase bg-white focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 focus:outline-none"
                        />
                        <span className="block text-[10px] text-[#6B4C35] mt-1">
                          *UTR records payment as pending verification. Staff verifies
                          actual bank receipt before marking Paid.
                        </span>
                      </div>

                      <button
                        type="submit"
                        className="w-full py-3 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white font-semibold text-xs shadow-xs transition cursor-pointer active:scale-98"
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
                    <p className="text-xs text-[#3B1A08]/80">
                      Staff has verified the bank receipt. Thank you for dining with {BRAND_CONFIG.name}!
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


/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Treat & Taste — Universal Real-Time Notification Center & Status Popup System
 * Displays floating, responsive, stacked popups for real-time restaurant operational events:
 * - New Reservation received
 * - Customer Arrival ("I'm Arrived") requiring staff verification
 * - Arrival Verified & Seating status updates
 * - Kitchen New Order alert with audio chime
 * - Kitchen order progress updates (Accepted -> Preparing -> Ready -> Served)
 * - Bill generated & available for customer viewing
 * - Payment receipt verified
 */

import React, { useState, useEffect } from 'react';
import {
  notificationHub,
  RestaurantNotificationEvent,
} from '../services/notificationHub';
import {
  ConciergeBell,
  CheckCircle2,
  AlertCircle,
  Clock,
  Armchair,
  FileText,
  CreditCard,
  ChefHat,
  X,
  ExternalLink,
  ChevronRight,
  Sparkles,
  Volume2,
  VolumeX,
} from 'lucide-react';

interface UniversalNotificationCenterProps {
  currentRole?: 'Customer' | 'Staff' | 'Kitchen' | 'Admin' | 'Guest';
  onNavigateToBooking?: (bookingId: string) => void;
  onNavigateToArrivals?: (bookingId: string) => void;
  onNavigateToOrder?: (orderId: string) => void;
  onNavigateToBill?: (bookingId: string) => void;
  onNavigateToTables?: (tableId?: string) => void;
}

export const UniversalNotificationCenter: React.FC<UniversalNotificationCenterProps> = ({
  currentRole = 'Guest',
  onNavigateToBooking,
  onNavigateToArrivals,
  onNavigateToOrder,
  onNavigateToBill,
  onNavigateToTables,
}) => {
  const [notifications, setNotifications] = useState<RestaurantNotificationEvent[]>([]);
  const [soundEnabled, setSoundEnabled] = useState<boolean>(true);

  useEffect(() => {
    const unsubscribe = notificationHub.subscribe((event) => {
      // Filter events by audience role
      if (!isEventRelevantForRole(event, currentRole)) {
        return;
      }

      setNotifications((prev) => {
        // Prevent duplicate insertion if already in list
        if (prev.some((n) => n.id === event.id)) return prev;
        return [event, ...prev].slice(0, 5); // Keep max 5 stacked
      });

      // Handle auto-dismiss for non-critical alerts
      const autoMs = event.autoDismissMs !== undefined ? event.autoDismissMs : (event.priority === 'critical' ? 0 : 7000);
      if (autoMs > 0) {
        setTimeout(() => {
          dismiss(event.id);
        }, autoMs);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [currentRole]);

  function isEventRelevantForRole(
    event: RestaurantNotificationEvent,
    role: string
  ): boolean {
    switch (event.type) {
      case 'NEW_RESERVATION':
        return role === 'Staff' || role === 'Admin';
      case 'ARRIVAL_REGISTERED':
        // Arrival verification belongs strictly to host desk / floor Staff
        return role === 'Staff';
      case 'ARRIVAL_VERIFIED':
      case 'TABLE_ALLOCATED':
      case 'CUSTOMER_SEATED':
        // Table seating updates belong to Customer and floor Staff
        return role === 'Customer' || role === 'Staff' || role === 'Guest';
      case 'NEW_ORDER':
        // Kitchen order tickets belong strictly to Kitchen and floor Staff
        return role === 'Kitchen' || role === 'Staff';
      case 'ORDER_STATUS_CHANGED':
        return role === 'Customer' || role === 'Kitchen' || role === 'Staff' || role === 'Guest';
      case 'BILL_GENERATED':
        return role === 'Customer' || role === 'Staff' || role === 'Guest';
      case 'PAYMENT_VERIFIED':
        // Payments require visibility for Customer, Staff and Admin
        return role === 'Customer' || role === 'Staff' || role === 'Admin';
      default:
        return true;
    }
  }

  function dismiss(id: string) {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }

  function handleActionClick(event: RestaurantNotificationEvent) {
    if (event.onAction) {
      event.onAction();
    } else {
      switch (event.type) {
        case 'NEW_RESERVATION':
          if (event.metadata?.bookingId && onNavigateToBooking) {
            onNavigateToBooking(event.metadata.bookingId);
          }
          break;
        case 'ARRIVAL_REGISTERED':
          if (event.metadata?.bookingId && onNavigateToArrivals) {
            onNavigateToArrivals(event.metadata.bookingId);
          }
          break;
        case 'NEW_ORDER':
          if (event.metadata?.orderId && onNavigateToOrder) {
            onNavigateToOrder(event.metadata.orderId);
          }
          break;
        case 'BILL_GENERATED':
          if (event.metadata?.bookingId && onNavigateToBill) {
            onNavigateToBill(event.metadata.bookingId);
          }
          break;
        case 'TABLE_ALLOCATED':
        case 'CUSTOMER_SEATED':
          if (onNavigateToTables) {
            onNavigateToTables(event.metadata?.tableNumber);
          }
          break;
        default:
          break;
      }
    }
    dismiss(event.id);
  }

  function getEventIcon(type: RestaurantNotificationEvent['type']) {
    switch (type) {
      case 'NEW_RESERVATION':
        return <Sparkles className="w-5 h-5 text-[#F56A00]" />;
      case 'ARRIVAL_REGISTERED':
        return <ConciergeBell className="w-5 h-5 text-[#F56A00] animate-bounce" />;
      case 'ARRIVAL_VERIFIED':
        return <CheckCircle2 className="w-5 h-5 text-[#248A3D]" />;
      case 'TABLE_ALLOCATED':
      case 'CUSTOMER_SEATED':
        return <Armchair className="w-5 h-5 text-[#248A3D]" />;
      case 'NEW_ORDER':
        return <ChefHat className="w-5 h-5 text-[#F56A00]" />;
      case 'ORDER_STATUS_CHANGED':
        return <Clock className="w-5 h-5 text-[#F56A00]" />;
      case 'BILL_GENERATED':
        return <FileText className="w-5 h-5 text-[#3B1A08]" />;
      case 'PAYMENT_VERIFIED':
        return <CreditCard className="w-5 h-5 text-[#248A3D]" />;
      default:
        return <AlertCircle className="w-5 h-5 text-[#F56A00]" />;
    }
  }

  if (notifications.length === 0) return null;

  return (
    <div
      aria-live="polite"
      className="fixed top-4 right-4 sm:right-6 z-[9999] max-w-sm w-[calc(100vw-2rem)] sm:w-96 flex flex-col space-y-3 pointer-events-none overscroll-contain"
    >
      {notifications.map((item) => {
        const isCritical = item.priority === 'critical';
        const isHigh = item.priority === 'high';

        return (
          <div
            key={item.id}
            className={`pointer-events-auto rounded-3xl p-4 sm:p-5 shadow-2xl border transition-all transform animate-in slide-in-from-top-4 duration-300 backdrop-blur-md ${
              isCritical
                ? 'bg-[#FFF9F0] border-[#F56A00] ring-2 ring-[#F56A00]/30'
                : isHigh
                ? 'bg-white border-[#248A3D]/40 ring-1 ring-[#248A3D]/20'
                : 'bg-white/95 border-[#E6D5C3]'
            }`}
          >
            {/* Header: Icon, Title, and Close Button */}
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center space-x-2.5">
                <div
                  className={`w-9 h-9 rounded-2xl flex items-center justify-center shrink-0 ${
                    isCritical
                      ? 'bg-[#F56A00]/15'
                      : isHigh
                      ? 'bg-[#248A3D]/15'
                      : 'bg-[#FDF4E7]'
                  }`}
                >
                  {getEventIcon(item.type)}
                </div>
                <div>
                  <span
                    className={`text-[10px] font-extrabold uppercase tracking-wider block ${
                      isCritical
                        ? 'text-[#F56A00]'
                        : isHigh
                        ? 'text-[#248A3D]'
                        : 'text-[#6B4C35]'
                    }`}
                  >
                    {item.priority === 'critical' ? 'Action Required' : 'Live Update'}
                  </span>
                  <h4 className="text-xs sm:text-sm font-bold text-[#3B1A08] leading-tight">
                    {item.title}
                  </h4>
                </div>
              </div>

              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="p-1 rounded-full text-[#6B4C35]/60 hover:text-[#3B1A08] hover:bg-black/5 transition cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Message Body */}
            <p className="text-xs text-[#6B4C35] mt-2.5 leading-relaxed">
              {item.message}
            </p>

            {/* Event Specific Metadata Badges */}
            {item.metadata && (
              <div className="flex flex-wrap gap-1.5 mt-2.5 pt-2 border-t border-black/5 text-[11px]">
                {item.metadata.customerName && (
                  <span className="px-2 py-0.5 rounded-md bg-[#FDF4E7] text-[#3B1A08] font-semibold">
                    Guest: {item.metadata.customerName}
                  </span>
                )}
                {item.metadata.bookingId && (
                  <span className="px-2 py-0.5 rounded-md bg-[#FDF4E7] text-[#6B4C35] font-mono">
                    {item.metadata.bookingId}
                  </span>
                )}
                {item.metadata.partySize && (
                  <span className="px-2 py-0.5 rounded-md bg-[#FDF4E7] text-[#3B1A08]">
                    {item.metadata.partySize} Guests
                  </span>
                )}
                {item.metadata.tableNumber && (
                  <span className="px-2 py-0.5 rounded-md bg-[#248A3D]/10 text-[#248A3D] font-bold">
                    Table {item.metadata.tableNumber}
                  </span>
                )}
                {item.metadata.orderId && (
                  <span className="px-2 py-0.5 rounded-md bg-[#F56A00]/10 text-[#F56A00] font-mono font-semibold">
                    {item.metadata.orderId}
                  </span>
                )}
                {item.metadata.amount !== undefined && (
                  <span className="px-2 py-0.5 rounded-md bg-[#3B1A08] text-white font-bold">
                    ₹{item.metadata.amount}
                  </span>
                )}
              </div>
            )}

            {/* Action CTA Button */}
            {(item.actionLabel || isCritical) && (
              <div className="mt-3 pt-2">
                <button
                  type="button"
                  onClick={() => handleActionClick(item)}
                  className={`w-full py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center space-x-1.5 shadow-xs cursor-pointer ${
                    isCritical
                      ? 'bg-[#F56A00] hover:bg-[#D95800] text-white'
                      : 'bg-[#3B1A08] hover:bg-[#2A1104] text-white'
                  }`}
                >
                  <span>{item.actionLabel || 'View Record'}</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

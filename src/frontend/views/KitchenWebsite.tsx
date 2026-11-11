/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 4. Kitchen Website (Kitchen Display System - KDS - Apple Design System)
 * Strictly isolated:
 * - Shows ONLY staff-authorized orders.
 * - Displays table numbers, dish quantities, prep timers.
 * - Allowed transitions: Authorized -> In_Preparation -> Ready_For_Serving -> Served.
 * - Cannot allocate tables, verify arrivals, generate bills, or approve refunds.
 */

import React, { useState, useEffect } from 'react';
import { RequestDispatcher } from '../../backend/dispatcher';
import { UserSessionState } from '../types';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Bell,
  Utensils,
  RefreshCw,
  LogOut,
  Flame,
  Check,
} from 'lucide-react';

interface KitchenWebsiteProps {
  session: UserSessionState | null;
  onSetSession: (session: UserSessionState) => void;
  onLogout: () => void;
}

export const KitchenWebsite: React.FC<KitchenWebsiteProps> = ({
  session,
  onSetSession,
  onLogout,
}) => {
  // Login form state
  const [identifier, setIdentifier] = useState<string>('kitchen');
  const [password, setPassword] = useState<string>('DemoPass@2026');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // KDS Orders state
  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (session?.sessionId && (session.role === 'Kitchen' || session.role === 'Admin')) {
      loadKitchenQueue();
      const interval = setInterval(loadKitchenQueue, 4000);
      return () => clearInterval(interval);
    }
  }, [session]);

  async function loadKitchenQueue() {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'getKitchenQueue',
      sessionId: session.sessionId,
    });
    if (res.success && res.data) {
      setKitchenOrders(res.data);
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
      if (res.data.role !== 'Kitchen' && res.data.role !== 'Admin') {
        setAuthError('Unauthorized: This portal is reserved for Kitchen culinary staff.');
        return;
      }
      onSetSession(res.data);
      showToast('success', `Welcome Chef ${res.data.name}!`);
    } else {
      setAuthError(res.error?.message || 'Invalid kitchen credentials.');
    }
  }

  async function handleUpdateStatus(
    orderId: string,
    newStatus: 'In_Preparation' | 'Ready_For_Serving' | 'Served'
  ) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'updateKitchenPreparationStatus',
      sessionId: session.sessionId,
      payload: { orderId, newStatus },
    });

    if (res.success) {
      showToast('success', res.message || 'Status updated.');
      loadKitchenQueue();
    } else {
      showToast('error', res.error?.message || 'Failed to update preparation status.');
    }
  }

  function showToast(type: 'success' | 'error', text: string) {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }

  const isKitchenAuthenticated =
    session && (session.role === 'Kitchen' || session.role === 'Admin');

  // Station counts
  const pendingPrepCount = kitchenOrders.filter((o) => o.Order_Status === 'Authorized').length;
  const cookingCount = kitchenOrders.filter((o) => o.Order_Status === 'In_Preparation').length;
  const readyCount = kitchenOrders.filter((o) => o.Order_Status === 'Ready_For_Serving').length;

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

      {!isKitchenAuthenticated ? (
        /* Login Card */
        <div className="max-w-md mx-auto pt-16 px-4">
          <div className="bg-white rounded-3xl p-8 shadow-xs border border-[#D2D2D7]/70 space-y-6">
            <div className="text-center space-y-2">
              <div className="w-14 h-14 rounded-2xl bg-[#0071E3]/10 text-[#0071E3] flex items-center justify-center mx-auto">
                <ChefHat className="w-7 h-7" />
              </div>
              <h2 className="text-2xl font-semibold tracking-tight text-[#1D1D1F]">
                Kitchen Display System
              </h2>
              <p className="text-xs text-[#6E6E73] max-w-xs mx-auto">
                Staff-authorized culinary tickets, live staging, and preparation tracking.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#1D1D1F] mb-1.5">
                  Chef Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. kitchen"
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
                  Default demo kitchen password: <code className="bg-[#F5F5F7] px-1.5 py-0.5 rounded text-[#1D1D1F] font-mono">DemoPass@2026</code>
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
                {authLoading ? 'Signing in...' : 'Sign In as Kitchen Chef'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* KDS Live Display */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Top Bar with Counters */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-xs border border-[#D2D2D7]/70">
            <div className="flex items-center space-x-3.5">
              <div className="p-3 rounded-2xl bg-[#0071E3]/10 text-[#0071E3]">
                <ChefHat className="w-6 h-6" />
              </div>
              <div>
                <h1 className="text-xl font-semibold tracking-tight text-[#1D1D1F]">
                  Kitchen Display Tickets
                </h1>
                <p className="text-xs text-[#6E6E73]">
                  Authorized preparation queue • Workstation: Chef <strong className="text-[#1D1D1F]">{session.name}</strong>
                </p>
              </div>
            </div>

            {/* Counters and Controls */}
            <div className="flex flex-wrap items-center gap-2.5 text-xs">
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                <Clock className="w-3.5 h-3.5" />
                <span className="font-medium">
                  Authorized: <strong>{pendingPrepCount}</strong>
                </span>
              </div>
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-amber-100 text-amber-800">
                <Flame className="w-3.5 h-3.5" />
                <span className="font-medium">
                  Cooking: <strong>{cookingCount}</strong>
                </span>
              </div>
              <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-[#248A3D]/10 text-[#248A3D]">
                <Bell className="w-3.5 h-3.5" />
                <span className="font-medium">
                  Ready: <strong>{readyCount}</strong>
                </span>
              </div>

              <button
                onClick={loadKitchenQueue}
                title="Refresh Tickets"
                className="p-2 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7]/80 hover:bg-[#E5E5EA] text-[#1D1D1F] transition"
              >
                <RefreshCw className="w-4 h-4 text-[#6E6E73]" />
              </button>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-2 rounded-xl bg-[#D70015]/10 text-[#D70015] hover:bg-[#D70015]/20 transition"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* Ticket Grid */}
          {kitchenOrders.length === 0 ? (
            <div className="text-center py-24 bg-white rounded-3xl border border-[#D2D2D7]/70 space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#F5F5F7] flex items-center justify-center mx-auto text-[#6E6E73]">
                <ChefHat className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-semibold text-[#1D1D1F]">
                Kitchen Queue is Clear
              </h3>
              <p className="text-xs text-[#6E6E73] max-w-sm mx-auto">
                No orders are currently awaiting preparation. New tickets will appear automatically when staff authorizes customer orders.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {kitchenOrders.map((ticket) => {
                const isAuthorized = ticket.Order_Status === 'Authorized';
                const isCooking = ticket.Order_Status === 'In_Preparation';
                const isReady = ticket.Order_Status === 'Ready_For_Serving';

                return (
                  <div
                    key={ticket.Order_ID}
                    className={`bg-white rounded-3xl p-6 shadow-xs border flex flex-col justify-between space-y-4 transition ${
                      isAuthorized
                        ? 'border-[#0071E3]/40'
                        : isCooking
                        ? 'border-amber-300'
                        : 'border-[#248A3D]/40'
                    }`}
                  >
                    {/* Header */}
                    <div className="flex items-center justify-between pb-3 border-b border-[#D2D2D7]/50">
                      <div>
                        <span className="text-[11px] font-semibold text-[#0071E3]">
                          Table {ticket.tableNumber}
                        </span>
                        <h4 className="text-base font-mono font-semibold text-[#1D1D1F]">
                          {ticket.Order_ID}
                        </h4>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full text-[10px] font-semibold uppercase ${
                          isAuthorized
                            ? 'bg-[#0071E3]/10 text-[#0071E3]'
                            : isCooking
                            ? 'bg-amber-100 text-amber-800 animate-pulse'
                            : 'bg-[#248A3D]/10 text-[#248A3D]'
                        }`}
                      >
                        {ticket.Order_Status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Items List */}
                    <div className="space-y-2.5 flex-1">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-[#6E6E73]">
                        Items to Prepare:
                      </span>
                      <div className="space-y-2 divide-y divide-[#D2D2D7]/40">
                        {ticket.items.map((item: any) => (
                          <div
                            key={item.Order_Item_ID}
                            className="pt-2 flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center space-x-2.5">
                              <span className="w-5 h-5 rounded-md bg-[#1D1D1F] text-white font-semibold text-[11px] flex items-center justify-center">
                                {item.Quantity}
                              </span>
                              <strong className="text-[#1D1D1F] font-medium">{item.foodName}</strong>
                            </div>
                            <span className="text-[11px] text-[#6E6E73] flex items-center space-x-1">
                              <Clock className="w-3 h-3 text-[#6E6E73]" />
                              <span>{item.prepTimeMinutes}m</span>
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Metadata */}
                    <div className="pt-2 border-t border-[#D2D2D7]/50 text-[11px] text-[#6E6E73] flex justify-between">
                      <span>Auth by: {ticket.Authorized_By || 'Staff'}</span>
                      <span>
                        {ticket.Authorized_At
                          ? new Date(ticket.Authorized_At).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
                          : ''}
                      </span>
                    </div>

                    {/* Stage Progression Buttons with min 44px tap height */}
                    <div className="pt-1">
                      {isAuthorized && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.Order_ID, 'In_Preparation')}
                          className="w-full min-h-[44px] py-2.5 rounded-2xl bg-amber-600 hover:bg-amber-700 text-white text-xs font-medium shadow-xs flex items-center justify-center space-x-2 transition"
                        >
                          <Play className="w-4 h-4" />
                          <span>Start Cooking</span>
                        </button>
                      )}

                      {isCooking && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.Order_ID, 'Ready_For_Serving')}
                          className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-medium shadow-xs flex items-center justify-center space-x-2 transition"
                        >
                          <Bell className="w-4 h-4" />
                          <span>Mark Cooked & Ready for Server</span>
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.Order_ID, 'Served')}
                          className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#1D1D1F] hover:bg-[#333336] text-white text-xs font-medium shadow-xs flex items-center justify-center space-x-2 transition"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#248A3D]" />
                          <span>Delivered to Customer Table</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

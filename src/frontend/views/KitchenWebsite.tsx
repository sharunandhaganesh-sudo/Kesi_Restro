/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 4. Kitchen Website (Kitchen Display System - KDS) — Treat & Taste Family Restaurant
 * - Immediately receives new customer orders without waiting for bill generation
 * - Highlights New Order tickets prominently
 * - Displays Order ID, Table number, Customer name, Ordered items, Quantities,
 *   Special instructions, Placement time, and Status
 * - Supports full status progression: New Order -> Accepted -> Preparing -> Ready -> Served
 * - Supports individual item status tracking for multi-item orders
 */

import React, { useState, useEffect, useCallback } from 'react';
import { RequestDispatcher } from '../../backend/dispatcher';
import { UserSessionState } from '../types';
import { BrandLogo } from '../components/BrandLogo';
import { BRAND_CONFIG } from '../../config/branding';
import {
  ChefHat,
  Clock,
  CheckCircle2,
  AlertCircle,
  Play,
  Bell,
  RefreshCw,
  LogOut,
  Flame,
  Sparkles,
  MessageSquare,
  User,
  Check,
} from 'lucide-react';

interface KitchenWebsiteProps {
  session: UserSessionState | null;
  onSetSession: (session: UserSessionState) => void;
  onLogout: () => void;
}

type FilterStatus = 'ACTIVE' | 'New_Order' | 'Accepted' | 'Preparing' | 'Ready' | 'Served' | 'ALL';

function normalizeKitchenStatus(raw: string): 'New_Order' | 'Accepted' | 'Preparing' | 'Ready' | 'Served' {
  switch (raw) {
    case 'New_Order':
    case 'Submitted':
    case 'Pending_Authorization':
      return 'New_Order';
    case 'Accepted':
    case 'Authorized':
      return 'Accepted';
    case 'Preparing':
    case 'In_Preparation':
      return 'Preparing';
    case 'Ready':
    case 'Ready_For_Serving':
      return 'Ready';
    case 'Served':
      return 'Served';
    default:
      return 'New_Order';
  }
}

export const KitchenWebsite: React.FC<KitchenWebsiteProps> = ({
  session,
  onSetSession,
  onLogout,
}) => {
  const [identifier, setIdentifier] = useState<string>('kitchen');
  const [password, setPassword] = useState<string>('DemoPass@2026');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  const [kitchenOrders, setKitchenOrders] = useState<any[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [loadError, setLoadError] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('ACTIVE');
  const [lastSyncedAt, setLastSyncedAt] = useState<string>('');
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const loadKitchenQueue = useCallback(async (showSpinner = false) => {
    if (!session?.sessionId) return;
    if (showSpinner) setLoading(true);
    setLoadError('');

    const res = await RequestDispatcher.dispatch({
      action: 'getKitchenQueue',
      sessionId: session.sessionId,
    });

    if (showSpinner) setLoading(false);

    if (res.success && Array.isArray(res.data)) {
      // Strictly deduplicate by Order_ID so repeated refreshes never duplicate tickets
      const uniqueMap = new Map<string, any>();
      for (const ticket of res.data) {
        if (ticket?.Order_ID && !uniqueMap.has(ticket.Order_ID)) {
          uniqueMap.set(ticket.Order_ID, {
            ...ticket,
            normalizedStatus: normalizeKitchenStatus(ticket.Order_Status),
          });
        }
      }
      setKitchenOrders(Array.from(uniqueMap.values()));
      setLastSyncedAt(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' }));
    } else if (!res.success) {
      setLoadError(res.error?.message || 'Unable to sync live kitchen orders from server.');
    }
  }, [session?.sessionId]);

  useEffect(() => {
    if (session?.sessionId && (session.role === 'Kitchen' || session.role === 'Admin')) {
      loadKitchenQueue(true);
      const interval = setInterval(() => loadKitchenQueue(false), 4000);
      return () => clearInterval(interval);
    }
  }, [session, loadKitchenQueue]);

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
    newStatus: 'Accepted' | 'Preparing' | 'Ready' | 'Served'
  ) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'updateKitchenPreparationStatus',
      sessionId: session.sessionId,
      payload: { orderId, newStatus },
    });

    if (res.success) {
      showToast('success', res.message || `Order ${orderId} updated to ${newStatus}.`);
      loadKitchenQueue(false);
    } else {
      showToast('error', res.error?.message || 'Failed to update preparation status.');
    }
  }

  async function handleUpdateItemStatus(
    orderItemId: string,
    newStatus: 'Accepted' | 'Preparing' | 'Ready' | 'Served'
  ) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'updateOrderItemStatus',
      sessionId: session.sessionId,
      payload: { orderItemId, newStatus },
    });

    if (res.success) {
      showToast('success', res.message || `Item marked ${newStatus}.`);
      loadKitchenQueue(false);
    } else {
      showToast('error', res.error?.message || 'Could not update item status.');
    }
  }

  function showToast(type: 'success' | 'error', text: string) {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }

  const isKitchenAuthenticated =
    session && (session.role === 'Kitchen' || session.role === 'Admin');

  // Counts across all 5 kitchen stages
  const newOrderCount = kitchenOrders.filter((o) => o.normalizedStatus === 'New_Order').length;
  const acceptedCount = kitchenOrders.filter((o) => o.normalizedStatus === 'Accepted').length;
  const preparingCount = kitchenOrders.filter((o) => o.normalizedStatus === 'Preparing').length;
  const readyCount = kitchenOrders.filter((o) => o.normalizedStatus === 'Ready').length;
  const servedCount = kitchenOrders.filter((o) => o.normalizedStatus === 'Served').length;

  const displayedOrders = kitchenOrders.filter((o) => {
    if (statusFilter === 'ALL') return true;
    if (statusFilter === 'ACTIVE') return o.normalizedStatus !== 'Served';
    return o.normalizedStatus === statusFilter;
  });

  const nextItemStage = (
    current: string
  ): 'Accepted' | 'Preparing' | 'Ready' | 'Served' | null => {
    const norm = normalizeKitchenStatus(current);
    if (norm === 'New_Order') return 'Accepted';
    if (norm === 'Accepted') return 'Preparing';
    if (norm === 'Preparing') return 'Ready';
    if (norm === 'Ready') return 'Served';
    return null;
  };

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#2D1609] pb-24">
      {/* Toast Notification */}
      {notice && (
        <div
          className={`fixed top-20 right-4 z-50 flex items-center space-x-2 px-4 py-3 rounded-2xl shadow-lg border text-sm font-medium transition-all ${
            notice.type === 'success'
              ? 'bg-white border-[#248A3D]/40 text-[#248A3D]'
              : 'bg-white border-[#D70015]/40 text-[#D70015]'
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
        /* Kitchen Login Card */
        <div className="max-w-md mx-auto pt-14 px-4">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E6D5C3] space-y-6">
            <div className="text-center space-y-3">
              <div className="flex justify-center">
                <BrandLogo size="lg" />
              </div>
              <div className="inline-flex items-center space-x-1.5 px-3 py-1 rounded-full bg-[#FDF4E7] text-[#F56A00] text-xs font-bold border border-[#E6D5C3]">
                <ChefHat className="w-3.5 h-3.5" />
                <span>Kitchen Display System (KDS)</span>
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#3B1A08]">
                Kitchen Culinary Sign In
              </h2>
              <p className="text-xs text-[#735847] max-w-xs mx-auto">
                Instant live order tickets, special instructions, multi-item tracking, and status controls.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                  Chef Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. kitchen"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/40 text-sm text-[#2D1609] focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 transition"
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0]/40 text-sm text-[#2D1609] focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 transition"
                />
                <span className="block text-[11px] text-[#735847] mt-1.5">
                  Default demo kitchen password: <code className="bg-[#FDF4E7] px-1.5 py-0.5 rounded text-[#3B1A08] font-mono">DemoPass@2026</code>
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
                className="w-full py-3 rounded-full bg-[#F56A00] hover:bg-[#DC5B00] text-white font-semibold text-sm shadow-xs transition disabled:opacity-50 cursor-pointer"
              >
                {authLoading ? 'Signing in...' : 'Sign In to Kitchen Display'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* KDS Live Display */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Top Bar */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-xs border border-[#E6D5C3]">
            <div className="flex items-center space-x-3.5">
              <BrandLogo size="md" variant="icon" />
              <div>
                <div className="flex items-center space-x-2">
                  <h1 className="text-xl font-bold tracking-tight text-[#3B1A08]">
                    {BRAND_CONFIG.name} — Kitchen Display Tickets
                  </h1>
                  <span className="inline-flex items-center space-x-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#248A3D]/10 text-[#248A3D] border border-[#248A3D]/20">
                    <span className="w-1.5 h-1.5 rounded-full bg-[#248A3D] animate-pulse" />
                    <span>Live Auto-Sync (4s)</span>
                  </span>
                </div>
                <p className="text-xs text-[#735847]">
                  Station Chef: <strong className="text-[#3B1A08]">{session.name}</strong>
                  {lastSyncedAt && ` • Last synced at ${lastSyncedAt}`}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 text-xs">
              <button
                onClick={() => loadKitchenQueue(true)}
                title="Refresh Tickets"
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-[#FDF4E7] border border-[#E6D5C3] hover:bg-[#F5E6D3] text-[#3B1A08] font-semibold transition cursor-pointer"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-[#F56A00]' : 'text-[#3B1A08]'}`} />
                <span>Refresh</span>
              </button>
              <button
                onClick={onLogout}
                title="Sign Out"
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-full bg-[#D70015]/10 text-[#D70015] hover:bg-[#D70015]/20 font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* 5-Stage Filter & Counter Pills */}
          <div className="flex flex-wrap items-center gap-2 bg-[#FDF4E7] p-2 rounded-2xl border border-[#E6D5C3]">
            {[
              { id: 'ACTIVE', label: 'Active Queue', count: newOrderCount + acceptedCount + preparingCount + readyCount },
              { id: 'New_Order', label: 'New Orders', count: newOrderCount, highlight: newOrderCount > 0 },
              { id: 'Accepted', label: 'Accepted', count: acceptedCount },
              { id: 'Preparing', label: 'Preparing', count: preparingCount },
              { id: 'Ready', label: 'Ready', count: readyCount },
              { id: 'Served', label: 'Served', count: servedCount },
              { id: 'ALL', label: 'All Orders', count: kitchenOrders.length },
            ].map((pill) => {
              const active = statusFilter === pill.id;
              return (
                <button
                  key={pill.id}
                  onClick={() => setStatusFilter(pill.id as FilterStatus)}
                  className={`flex items-center space-x-2 px-3.5 py-2 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    active
                      ? 'bg-[#3B1A08] text-white shadow-xs'
                      : pill.highlight
                      ? 'bg-[#F56A00]/15 text-[#F56A00] border border-[#F56A00]/40 hover:bg-[#F56A00]/25'
                      : 'bg-white text-[#735847] hover:text-[#3B1A08] border border-[#E6D5C3]'
                  }`}
                >
                  <span>{pill.label}</span>
                  <span
                    className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      active
                        ? 'bg-[#F56A00] text-white'
                        : pill.highlight
                        ? 'bg-[#F56A00] text-white animate-pulse'
                        : 'bg-[#FDF4E7] text-[#3B1A08]'
                    }`}
                  >
                    {pill.count}
                  </span>
                </button>
              );
            })}
          </div>

          {/* Error Banner */}
          {loadError && (
            <div className="p-4 rounded-2xl bg-[#D70015]/10 border border-[#D70015]/30 text-[#D70015] text-xs font-medium flex items-center space-x-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{loadError}</span>
            </div>
          )}

          {/* Ticket Grid */}
          {loading && kitchenOrders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-[#E6D5C3] text-xs text-[#735847]">
              Syncing live orders from server &amp; Google Sheets...
            </div>
          ) : displayedOrders.length === 0 ? (
            <div className="text-center py-20 bg-white rounded-3xl border border-[#E6D5C3] space-y-3">
              <div className="w-16 h-16 rounded-3xl bg-[#FDF4E7] flex items-center justify-center mx-auto text-[#F56A00]">
                <ChefHat className="w-8 h-8" />
              </div>
              <h3 className="text-lg font-bold text-[#3B1A08]">
                No Orders in This View
              </h3>
              <p className="text-xs text-[#735847] max-w-sm mx-auto">
                New customer food orders appear here immediately when placed — independent of bill generation.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {displayedOrders.map((ticket) => {
                const status = ticket.normalizedStatus;
                const isNew = status === 'New_Order';
                const isAccepted = status === 'Accepted';
                const isPreparing = status === 'Preparing';
                const isReady = status === 'Ready';
                const isServed = status === 'Served';

                return (
                  <div
                    key={ticket.Order_ID}
                    className={`bg-white rounded-3xl p-5 sm:p-6 shadow-sm border-2 flex flex-col justify-between space-y-4 transition ${
                      isNew
                        ? 'border-[#F56A00] ring-2 ring-[#F4B41A]/30'
                        : isAccepted
                        ? 'border-[#3B1A08]/40'
                        : isPreparing
                        ? 'border-[#F4B41A]'
                        : isReady
                        ? 'border-[#248A3D]/60'
                        : 'border-[#E6D5C3] opacity-85'
                    }`}
                  >
                    {/* Ticket Header */}
                    <div className="space-y-2 pb-3 border-b border-[#E6D5C3]">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="flex items-center space-x-2">
                            <span className="px-2.5 py-0.5 rounded-lg bg-[#3B1A08] text-[#F4B41A] text-xs font-bold">
                              Table {ticket.tableNumber || 'Counter'}
                            </span>
                            {isNew && (
                              <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full bg-[#F56A00] text-white text-[10px] font-bold uppercase animate-pulse">
                                <Sparkles className="w-3 h-3" />
                                <span>New Order</span>
                              </span>
                            )}
                          </div>
                          <h4 className="text-base font-mono font-bold text-[#3B1A08] mt-1.5">
                            {ticket.Order_ID}
                          </h4>
                        </div>

                        <span
                          className={`px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${
                            isNew
                              ? 'bg-[#F56A00]/15 text-[#F56A00]'
                              : isAccepted
                              ? 'bg-[#3B1A08]/10 text-[#3B1A08]'
                              : isPreparing
                              ? 'bg-[#F4B41A]/25 text-[#8A5A00]'
                              : isReady
                              ? 'bg-[#248A3D]/15 text-[#248A3D]'
                              : 'bg-[#FDF4E7] text-[#735847]'
                          }`}
                        >
                          {status.replace(/_/g, ' ')}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-xs text-[#735847]">
                        <span className="flex items-center space-x-1.5 font-medium text-[#2D1609]">
                          <User className="w-3.5 h-3.5 text-[#F56A00]" />
                          <span>{ticket.customerName || 'Guest'}</span>
                        </span>
                        <span className="flex items-center space-x-1 text-[11px]">
                          <Clock className="w-3 h-3 text-[#F4B41A]" />
                          <span>
                            {ticket.Order_DateTime
                              ? new Date(ticket.Order_DateTime).toLocaleTimeString([], {
                                  hour: '2-digit',
                                  minute: '2-digit',
                                })
                              : 'Just now'}
                          </span>
                        </span>
                      </div>
                    </div>

                    {/* Special Instructions Callout */}
                    {ticket.specialInstructions && (
                      <div className="p-3 rounded-2xl bg-[#FDF4E7] border border-[#F4B41A]/60 text-xs text-[#3B1A08] flex items-start space-x-2">
                        <MessageSquare className="w-4 h-4 text-[#F56A00] shrink-0 mt-0.5" />
                        <div>
                          <span className="font-bold uppercase text-[10px] tracking-wider text-[#F56A00] block">
                            Special Instructions
                          </span>
                          <p className="font-medium mt-0.5">{ticket.specialInstructions}</p>
                        </div>
                      </div>
                    )}

                    {/* Multi-Item List with Individual Item Tracking */}
                    <div className="space-y-2.5 flex-1">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[#735847]">
                        Ordered Items ({ticket.items?.length || 0}):
                      </span>
                      <div className="space-y-2 divide-y divide-[#E6D5C3]/60">
                        {(ticket.items || []).map((item: any) => {
                          const itemNorm = normalizeKitchenStatus(item.Item_Status);
                          const nextStage = nextItemStage(item.Item_Status);
                          return (
                            <div key={item.Order_Item_ID} className="pt-2 space-y-1">
                              <div className="flex items-center justify-between gap-2 text-xs">
                                <div className="flex items-center space-x-2 min-w-0">
                                  <span className="w-6 h-6 rounded-lg bg-[#3B1A08] text-[#FFF9F0] font-bold text-[11px] flex items-center justify-center shrink-0">
                                    {item.Quantity}×
                                  </span>
                                  <div className="min-w-0">
                                    <strong className="text-[#2D1609] font-semibold block truncate">
                                      {item.foodName}
                                    </strong>
                                    <span className="text-[10px] text-[#735847]">
                                      {item.prepTimeMinutes || 15}m prep
                                      {item.specialInstructions ? ` • Note: ${item.specialInstructions}` : ''}
                                    </span>
                                  </div>
                                </div>

                                {/* Per-Item Status + Quick Advance (Multi-item support) */}
                                <div className="flex items-center space-x-1.5 shrink-0">
                                  <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-[#FDF4E7] text-[#3B1A08] border border-[#E6D5C3]">
                                    {itemNorm.replace(/_/g, ' ')}
                                  </span>
                                  {nextStage && !isServed && (ticket.items?.length || 0) > 1 && (
                                    <button
                                      onClick={() => handleUpdateItemStatus(item.Order_Item_ID, nextStage)}
                                      title={`Mark item ${nextStage}`}
                                      className="px-2 py-0.5 rounded-full bg-[#F56A00]/15 hover:bg-[#F56A00] text-[#F56A00] hover:text-white text-[10px] font-bold transition cursor-pointer"
                                    >
                                      → {nextStage}
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Whole-Order Stage Progression Actions */}
                    <div className="pt-2 border-t border-[#E6D5C3] flex flex-col gap-2">
                      {isNew && (
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            onClick={() => handleUpdateStatus(ticket.Order_ID, 'Accepted')}
                            className="min-h-[44px] py-2 rounded-2xl bg-[#3B1A08] hover:bg-[#2A1104] text-white text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                          >
                            <Check className="w-4 h-4 text-[#F4B41A]" />
                            <span>Accept Order</span>
                          </button>
                          <button
                            onClick={() => handleUpdateStatus(ticket.Order_ID, 'Preparing')}
                            className="min-h-[44px] py-2 rounded-2xl bg-[#F56A00] hover:bg-[#DC5B00] text-white text-xs font-semibold shadow-xs flex items-center justify-center space-x-1.5 transition cursor-pointer"
                          >
                            <Flame className="w-4 h-4" />
                            <span>Start Preparing</span>
                          </button>
                        </div>
                      )}

                      {isAccepted && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.Order_ID, 'Preparing')}
                          className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#F56A00] hover:bg-[#DC5B00] text-white text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
                        >
                          <Play className="w-4 h-4" />
                          <span>Start Preparing</span>
                        </button>
                      )}

                      {isPreparing && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.Order_ID, 'Ready')}
                          className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
                        >
                          <Bell className="w-4 h-4" />
                          <span>Mark Cooked &amp; Ready</span>
                        </button>
                      )}

                      {isReady && (
                        <button
                          onClick={() => handleUpdateStatus(ticket.Order_ID, 'Served')}
                          className="w-full min-h-[44px] py-2.5 rounded-2xl bg-[#3B1A08] hover:bg-[#2A1104] text-white text-xs font-semibold shadow-xs flex items-center justify-center space-x-2 transition cursor-pointer"
                        >
                          <CheckCircle2 className="w-4 h-4 text-[#F4B41A]" />
                          <span>Mark Served to Table</span>
                        </button>
                      )}

                      {isServed && (
                        <div className="w-full py-2 rounded-2xl bg-[#248A3D]/10 text-[#248A3D] text-xs font-bold text-center flex items-center justify-center space-x-1.5">
                          <CheckCircle2 className="w-4 h-4" />
                          <span>Served to Guest</span>
                        </div>
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

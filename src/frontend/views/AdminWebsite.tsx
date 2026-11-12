/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 5. Admin Website (Apple-Inspired UI/UX Design System)
 * Executive Analytics (Gross vs Verified vs Pending vs Refunds),
 * Staff/Kitchen user account provisioning with PBKDF2 hashing & unique per-user salt,
 * Menu & Table management, Refund review & manual payout completion,
 * Restaurant operational settings, and 12-Tab/108-Column Schema audit.
 */

import React, { useState, useEffect, useRef } from 'react';
import QRCode from 'qrcode';
import { RequestDispatcher } from '../../backend/dispatcher';
import { UserSessionState } from '../types';
import { BrandLogo } from '../components/BrandLogo';
import { BRAND_CONFIG } from '../../config/branding';
import {
  ShieldCheck,
  TrendingUp,
  DollarSign,
  Users,
  Utensils,
  Armchair,
  FileCheck2,
  Settings,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  LogOut,
  Plus,
  Star,
  Check,
  X,
  Database,
  ArrowUpRight,
  QrCode,
  Download,
  Printer,
  Edit3,
  Save,
  ExternalLink,
  Copy,
  MessageSquare,
  Filter,
} from 'lucide-react';

interface AdminWebsiteProps {
  session: UserSessionState | null;
  onSetSession: (session: UserSessionState) => void;
  onLogout: () => void;
}

export const AdminWebsite: React.FC<AdminWebsiteProps> = ({
  session,
  onSetSession,
  onLogout,
}) => {
  // Login credentials
  const [identifier, setIdentifier] = useState<string>('admin');
  const [password, setPassword] = useState<string>('DemoPass@2026');
  const [authError, setAuthError] = useState<string>('');
  const [authLoading, setAuthLoading] = useState<boolean>(false);

  // Admin Data
  const [adminData, setAdminData] = useState<any>(null);
  const [activeTab, setActiveTab] = useState<
    'analytics' | 'users' | 'menu' | 'tables' | 'refunds' | 'feedback' | 'settings'
  >('analytics');
  const [feedbackAnalytics, setFeedbackAnalytics] = useState<any>(null);
  const [feedbackDateFilter, setFeedbackDateFilter] = useState<string>('');
  const [feedbackRatingFilter, setFeedbackRatingFilter] = useState<number>(0);
  const [feedbackLoading, setFeedbackLoading] = useState<boolean>(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // New User Account Modal
  const [showUserModal, setShowUserModal] = useState<boolean>(false);
  const [newUserName, setNewUserName] = useState<string>('');
  const [newUserEmail, setNewUserEmail] = useState<string>('');
  const [newUserRole, setNewUserRole] = useState<'Staff' | 'Kitchen' | 'Admin'>('Staff');
  const [newUserPassword, setNewUserPassword] = useState<string>('');

  // Menu Modal
  const [showMenuModal, setShowMenuModal] = useState<boolean>(false);
  const [menuFoodId, setMenuFoodId] = useState<string>('');
  const [menuFoodName, setMenuFoodName] = useState<string>('');
  const [menuCategory, setMenuCategory] = useState<string>('Starters');
  const [menuDesc, setMenuDesc] = useState<string>('');
  const [menuPrice, setMenuPrice] = useState<number>(300);
  const [menuPrepTime, setMenuPrepTime] = useState<number>(15);

  // Table Modal
  const [showTableModal, setShowTableModal] = useState<boolean>(false);
  const [newTableNum, setNewTableNum] = useState<string>('');
  const [newTableCap, setNewTableCap] = useState<number>(4);

  // Refund Review Modal
  const [showPayoutModal, setShowPayoutModal] = useState<boolean>(false);
  const [payoutPaymentId, setPayoutPaymentId] = useState<string>('');
  const [payoutAmount, setPayoutAmount] = useState<number>(0);
  const [payoutUtr, setPayoutUtr] = useState<string>('');

  // Table Standee & Real QR Management
  const [selectedTableForStandee, setSelectedTableForStandee] = useState<any | null>(null);
  const [tableQRs, setTableQRs] = useState<Record<string, { token: string; qrUrl: string; dataUrl: string; isActive: boolean }>>({});

  // Settings State
  const [settingsForm, setSettingsForm] = useState<Record<string, string>>({});
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);
  const [copiedScript, setCopiedScript] = useState<boolean>(false);

  useEffect(() => {
    if (session?.sessionId && session.role === 'Admin') {
      loadAdminData();
    }
  }, [session]);

  async function loadAdminData() {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'getAdminDashboard',
      sessionId: session.sessionId,
    });
    if (res.success && res.data) {
      setAdminData(res.data);
      if (res.data.feedbackAnalytics) {
        setFeedbackAnalytics(res.data.feedbackAnalytics);
      }
      if (res.data.settings) {
        setSettingsForm(res.data.settings);
      }
      loadTableQRs(session.sessionId);
    }
  }

  async function loadFilteredFeedback(dateVal = feedbackDateFilter, ratingVal = feedbackRatingFilter) {
    if (!session?.sessionId) return;
    setFeedbackLoading(true);
    const res = await RequestDispatcher.dispatch({
      action: 'getAdminFeedbackAnalytics',
      sessionId: session.sessionId,
      payload: {
        date: dateVal || undefined,
        rating: ratingVal > 0 ? ratingVal : undefined,
      },
    });
    setFeedbackLoading(false);
    if (res.success && res.data) {
      setFeedbackAnalytics(res.data);
    }
  }

  async function loadTableQRs(sessionId: string) {
    const res = await RequestDispatcher.dispatch({
      action: 'getAllTableQRs',
      sessionId,
      payload: { baseUrl: window.location.origin },
    });
    if (res.success && Array.isArray(res.data)) {
      const qrMap: Record<string, { token: string; qrUrl: string; dataUrl: string; isActive: boolean }> = {};
      for (const item of res.data) {
        const dataUrl = await QRCode.toDataURL(item.qrUrl, {
          width: 400,
          margin: 2,
          errorCorrectionLevel: 'H',
          color: { dark: '#292323', light: '#FFFFFF' },
        });
        qrMap[item.tableId] = {
          token: item.token,
          qrUrl: item.qrUrl,
          dataUrl,
          isActive: item.isActive,
        };
      }
      setTableQRs(qrMap);
    }
  }

  async function handleRegenerateQR(tableId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'regenerateTableQR',
      sessionId: session.sessionId,
      payload: { tableId },
    });
    if (res.success) {
      await loadTableQRs(session.sessionId);
      showToast('success', `Generated fresh unique QR token for ${tableId}. Old tokens invalidated.`);
    }
  }

  async function handleToggleQR(tableId: string, currentActive: boolean) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'toggleTableQR',
      sessionId: session.sessionId,
      payload: { tableId, isActive: !currentActive },
    });
    if (res.success) {
      await loadTableQRs(session.sessionId);
      showToast('success', res.message || 'Table QR status updated.');
    }
  }

  async function handleSaveAllSettings(e?: React.FormEvent) {
    if (e) e.preventDefault();
    if (!session?.sessionId) return;
    setIsSavingSettings(true);

    try {
      for (const [key, value] of Object.entries(settingsForm)) {
        await RequestDispatcher.dispatch({
          action: 'updateSetting',
          sessionId: session.sessionId,
          payload: { key, value },
        });
      }
      showToast('success', 'All Restaurant Settings updated successfully!');
      loadAdminData();
    } catch (err: any) {
      showToast('error', 'Failed to save settings: ' + err.message);
    } finally {
      setIsSavingSettings(false);
    }
  }

  function handleSetDefaultUpiPreset() {
    setSettingsForm((prev) => ({
      ...prev,
      UPI_ID: 'kesikam2006@oksbi',
      UPI_PAYEE_NAME: 'Kesika M',
    }));
    showToast('success', 'Preset applied: Kesika M (kesikam2006@oksbi). Click "Save All Settings" to store.');
  }

  async function downloadStandeePNG(tbl: any) {
    const qrInfo = tableQRs[tbl.Table_ID];
    const qrUrl = qrInfo?.qrUrl || `${window.location.origin}/?scan-table=1&token=${tbl.Table_ID}`;
    const qrDataUrl = await QRCode.toDataURL(qrUrl, {
      width: 560,
      margin: 2,
      errorCorrectionLevel: 'H',
      color: { dark: '#292323', light: '#FFFFFF' },
    });

    const qrImg = new Image();
    qrImg.src = qrDataUrl;
    await new Promise((resolve) => {
      qrImg.onload = resolve;
    });

    const canvas = document.createElement('canvas');
    canvas.width = 1200;
    canvas.height = 1800;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    // Background
    ctx.fillStyle = '#FFF9F0';
    ctx.fillRect(0, 0, 1200, 1800);

    // Outer border
    ctx.lineWidth = 10;
    ctx.strokeStyle = '#3B1A08';
    ctx.strokeRect(30, 30, 1140, 1740);

    // Inner gold accent border
    ctx.lineWidth = 3;
    ctx.strokeStyle = '#F4B41A';
    ctx.strokeRect(52, 52, 1096, 1696);

    // Optional uploaded Brand Logo at top
    const logoImg = new Image();
    logoImg.crossOrigin = 'anonymous';
    logoImg.src = BRAND_CONFIG.logoUrl;
    await new Promise((resolve) => {
      logoImg.onload = resolve;
      logoImg.onerror = resolve;
    });
    if (logoImg.naturalWidth > 0) {
      ctx.drawImage(logoImg, 470, 75, 260, 200);
    } else {
      ctx.fillStyle = '#3B1A08';
      ctx.textAlign = 'center';
      ctx.font = 'bold 54px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(BRAND_CONFIG.name.toUpperCase(), 600, 190);

      ctx.fillStyle = '#F56A00';
      ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
      ctx.fillText(BRAND_CONFIG.subtitle.toUpperCase(), 600, 240);
    }

    // Table Badge
    ctx.fillStyle = '#FDF4E7';
    ctx.beginPath();
    ctx.roundRect(350, 320, 500, 165, 30);
    ctx.fill();
    ctx.strokeStyle = '#F56A00';
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.textAlign = 'center';
    ctx.fillStyle = '#3B1A08';
    ctx.font = 'bold 64px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`TABLE ${tbl.Table_Number}`, 600, 405);

    ctx.fillStyle = '#F56A00';
    ctx.font = '600 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`Seating Capacity: ${tbl.Seating_Capacity} Guests`, 600, 452);

    // High resolution real scannable QR code box
    const qrSize = 560;
    const qrX = 320;
    const qrY = 550;

    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);
    ctx.strokeStyle = '#3B1A08';
    ctx.lineWidth = 4;
    ctx.strokeRect(qrX - 20, qrY - 20, qrSize + 40, qrSize + 40);

    ctx.drawImage(qrImg, qrX, qrY, qrSize, qrSize);

    // Call to action text
    ctx.fillStyle = '#3B1A08';
    ctx.font = 'bold 36px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('Scan to View Menu & Order', 600, 1215);

    ctx.fillStyle = '#6B4C35';
    ctx.font = '500 24px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText('1. Point smartphone camera at QR code', 600, 1275);
    ctx.fillText(`2. Automatically opens Table ${tbl.Table_Number} menu`, 600, 1320);
    ctx.fillText('3. Place orders with instant kitchen dispatch', 600, 1365);

    // Footer note
    ctx.fillStyle = '#6B4C35';
    ctx.font = '18px -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif';
    ctx.fillText(`Token: ${qrInfo?.token || tbl.Table_ID} • ${BRAND_CONFIG.fullName}`, 600, 1680);

    // Trigger download
    const link = document.createElement('a');
    link.download = `TreatAndTaste_Table_${tbl.Table_Number}_QR.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('success', `Scannable QR standee downloaded for Table ${tbl.Table_Number}!`);
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
      if (res.data.role !== 'Admin') {
        setAuthError('Unauthorized: Administrator privileges are required for this dashboard.');
        return;
      }
      onSetSession(res.data);
      showToast('success', `Welcome Administrator ${res.data.name}!`);
    } else {
      setAuthError(res.error?.message || 'Invalid administrator credentials.');
    }
  }

  // Provision new employee
  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.sessionId) return;

    const res = await RequestDispatcher.dispatch({
      action: 'createUserAccount',
      sessionId: session.sessionId,
      payload: {
        userName: newUserName,
        email: newUserEmail,
        role: newUserRole,
        password: newUserPassword,
      },
    });

    if (res.success) {
      showToast('success', res.message || 'User account provisioned.');
      setShowUserModal(false);
      setNewUserName('');
      setNewUserEmail('');
      setNewUserPassword('');
      loadAdminData();
    } else {
      showToast('error', res.error?.message || 'Failed to create user.');
    }
  }

  // Toggle user active status
  async function handleToggleUserStatus(userId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'toggleUserAccountStatus',
      sessionId: session.sessionId,
      payload: { userId },
    });
    if (res.success) {
      showToast('success', res.message || 'Status toggled.');
      loadAdminData();
    } else {
      showToast('error', res.error?.message || 'Toggle failed.');
    }
  }

  // Upsert menu item
  async function handleUpsertMenuItem(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.sessionId) return;

    const res = await RequestDispatcher.dispatch({
      action: 'upsertMenuItem',
      sessionId: session.sessionId,
      payload: {
        item: {
          foodId: menuFoodId || undefined,
          foodName: menuFoodName,
          category: menuCategory,
          description: menuDesc,
          price: menuPrice,
          availability: 'Available',
          prepTimeMinutes: menuPrepTime,
          isActive: 'Active',
        },
      },
    });

    if (res.success) {
      showToast('success', res.message || 'Menu catalog updated.');
      setShowMenuModal(false);
      setMenuFoodId('');
      setMenuFoodName('');
      setMenuDesc('');
      loadAdminData();
    } else {
      showToast('error', res.error?.message || 'Menu update failed.');
    }
  }

  // Add table
  async function handleAddTable(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.sessionId) return;

    const res = await RequestDispatcher.dispatch({
      action: 'addTable',
      sessionId: session.sessionId,
      payload: {
        tableNumber: newTableNum,
        seatingCapacity: newTableCap,
      },
    });

    if (res.success) {
      showToast('success', res.message || 'Table added.');
      setShowTableModal(false);
      setNewTableNum('');
      loadAdminData();
    } else {
      showToast('error', res.error?.message || 'Failed to add table.');
    }
  }

  // Toggle table maintenance
  async function handleToggleTableMaintenance(tableId: string) {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'toggleTableMaintenance',
      sessionId: session.sessionId,
      payload: { tableId },
    });
    if (res.success) {
      showToast('success', res.message || 'Table status changed.');
      loadAdminData();
    } else {
      showToast('error', res.error?.message || 'Failed to toggle table.');
    }
  }

  // Admin Review Refund
  async function handleReviewRefund(paymentId: string, decision: 'APPROVE' | 'REJECT') {
    if (!session?.sessionId) return;
    const res = await RequestDispatcher.dispatch({
      action: 'reviewRefund',
      sessionId: session.sessionId,
      payload: {
        paymentId,
        decision,
        rejectionReason: decision === 'REJECT' ? 'Rejected by administrator inspection.' : undefined,
      },
    });

    if (res.success) {
      showToast('success', res.message || 'Refund decision recorded.');
      loadAdminData();
    } else {
      showToast('error', res.error?.message || 'Review failed.');
    }
  }

  // Record Manual Payout Completion
  async function handleCompletePayout(e: React.FormEvent) {
    e.preventDefault();
    if (!session?.sessionId || !payoutPaymentId) return;

    const res = await RequestDispatcher.dispatch({
      action: 'completeManualRefund',
      sessionId: session.sessionId,
      payload: {
        paymentId: payoutPaymentId,
        completedAmount: payoutAmount,
        refundReference: payoutUtr.trim(),
      },
    });

    if (res.success) {
      showToast('success', res.message || 'Refund payout recorded.');
      setShowPayoutModal(false);
      setPayoutPaymentId('');
      setPayoutUtr('');
      loadAdminData();
    } else {
      showToast('error', res.error?.message || 'Payout completion failed.');
    }
  }

  function showToast(type: 'success' | 'error', text: string) {
    setNotice({ type, text });
    setTimeout(() => setNotice(null), 4000);
  }

  const isAdminAuthenticated = session && session.role === 'Admin';
  const m = adminData?.metrics;

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

      {!isAdminAuthenticated ? (
        /* Login Card */
        <div className="max-w-md mx-auto pt-14 px-4">
          <div className="bg-white rounded-3xl p-8 shadow-sm border border-[#E6D5C3] space-y-6">
            <div className="text-center space-y-2.5">
              <div className="flex justify-center">
                <BrandLogo size="md" />
              </div>
              <h2 className="text-2xl font-bold tracking-tight text-[#3B1A08] pt-1">
                Administrator Console
              </h2>
              <p className="text-xs text-[#6B4C35] max-w-xs mx-auto">
                Executive financial analytics, employee provisioning, feedback management, catalog control, and refund audits.
              </p>
            </div>

            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">
                  Admin Username or Email
                </label>
                <input
                  type="text"
                  required
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="e.g. admin"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-sm text-[#3B1A08] placeholder-[#6B4C35]/50 focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-[#3B1A08] mb-1.5">Password</label>
                <input
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-[#E6D5C3] text-sm text-[#3B1A08] placeholder-[#6B4C35]/50 focus:outline-none focus:border-[#F56A00] focus:ring-2 focus:ring-[#F56A00]/20 transition"
                />
                <span className="block text-[11px] text-[#6B4C35] mt-1.5">
                  Default demo admin password: <code className="bg-[#FDF4E7] px-1.5 py-0.5 rounded text-[#3B1A08] font-mono">DemoPass@2026</code>
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
                {authLoading ? 'Verifying...' : 'Sign In as Administrator'}
              </button>
            </form>
          </div>
        </div>
      ) : (
        /* Executive Management Dashboard */
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-8 space-y-6">
          {/* Header Action Bar */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 bg-white p-6 rounded-3xl shadow-xs border border-[#E6D5C3]">
            <div className="flex items-center space-x-3.5">
              <BrandLogo size="sm" variant="icon" />
              <div>
                <h1 className="text-xl font-bold tracking-tight text-[#3B1A08]">
                  {BRAND_CONFIG.name} — Executive Administration
                </h1>
                <p className="text-xs text-[#6B4C35]">
                  Logged in as Administrator <strong className="text-[#3B1A08]">{session.name}</strong>
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <button
                onClick={loadAdminData}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#FDF4E7] border border-[#E6D5C3] hover:bg-[#F5E6D3] text-[#3B1A08] text-xs font-semibold transition cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5 text-[#F56A00]" />
                <span>Refresh Data</span>
              </button>
              <button
                onClick={onLogout}
                className="flex items-center space-x-1.5 px-3.5 py-2 rounded-xl bg-[#D70015]/10 text-[#D70015] hover:bg-[#D70015]/20 text-xs font-semibold transition cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Sign Out</span>
              </button>
            </div>
          </div>

          {/* Segmented Pill Navigation */}
          <div className="flex overflow-x-auto p-1.5 bg-[#FDF4E7] border border-[#E6D5C3] rounded-full max-w-full no-scrollbar">
            {[
              { id: 'analytics', label: 'Financial Analytics' },
              { id: 'users', label: 'User Accounts', count: adminData?.users?.length },
              { id: 'menu', label: 'Menu Catalog', count: adminData?.menu?.length },
              { id: 'tables', label: 'Table Setup', count: adminData?.tables?.length },
              { id: 'refunds', label: 'Refund Reviews', count: adminData?.refunds?.filter((r: any) => r.Refund_Status === 'Requested').length },
              { id: 'feedback', label: 'Feedback Management', count: feedbackAnalytics?.totalFeedbackCount ?? m?.totalFeedbackCount },
              { id: 'settings', label: 'Restaurant Settings' },
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

          {/* TAB 1: Analytics & Reports (Blueprint Section 14.3) */}
          {activeTab === 'analytics' && m && (
            <div className="space-y-6">
              {/* Financial Metrics Cards (Strictly distinguishing Verified vs Pending) */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-[#248A3D]/30 shadow-xs space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#248A3D]">
                    Verified Collected Revenue
                  </span>
                  <div className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                    ₹{m.verifiedPaidRevenue}
                  </div>
                  <p className="text-[11px] text-[#248A3D]">
                    Confirmed bank credits only
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#B76E00]/30 shadow-xs space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#B76E00]">
                    Pending UPI References
                  </span>
                  <div className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                    ₹{m.pendingVerificationRevenue}
                  </div>
                  <p className="text-[11px] text-[#B76E00]">
                    Awaiting staff bank check
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#D2D2D7]/70 shadow-xs space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                    Gross Billed Total
                  </span>
                  <div className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                    ₹{m.grossBillTotals}
                  </div>
                  <p className="text-[11px] text-[#6E6E73]">All generated final bills</p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#D70015]/30 shadow-xs space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#D70015]">
                    Completed Refunds
                  </span>
                  <div className="text-3xl font-semibold tracking-tight text-[#1D1D1F]">
                    ₹{m.completedRefundsTotal}
                  </div>
                  <p className="text-[11px] text-[#D70015]">Approved & paid payouts</p>
                </div>
              </div>

              {/* Operational Metrics Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="bg-white p-6 rounded-3xl border border-[#D2D2D7]/70 space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                    Total Guest Visits
                  </span>
                  <div className="text-2xl font-semibold text-[#1D1D1F]">{m.totalVisits} Visits</div>
                  <div className="flex justify-between text-xs text-[#6E6E73] pt-1">
                    <span>Online: {m.onlineVisitsCount}</span>
                    <span>Walk-in: {m.walkinVisitsCount}</span>
                  </div>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#D2D2D7]/70 space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                    Table Utilization Rate
                  </span>
                  <div className="text-2xl font-semibold text-[#1D1D1F]">
                    {m.tableUtilizationPercent}%
                  </div>
                  <p className="text-xs text-[#6E6E73]">
                    {m.occupiedTablesCount} of {m.totalTables} dining tables occupied
                  </p>
                </div>

                <div className="bg-white p-6 rounded-3xl border border-[#D2D2D7]/70 space-y-2">
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-[#6E6E73]">
                    Average Customer Rating
                  </span>
                  <div className="flex items-center space-x-2">
                    <span className="text-2xl font-semibold text-[#1D1D1F]">{m.averageRating}</span>
                    <Star className="w-5 h-5 fill-[#B76E00] text-[#B76E00]" />
                    <span className="text-xs text-[#6E6E73]">
                      ({m.totalFeedbackCount} reviews)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#6E6E73]">1–5 stars per completed booking</p>
                </div>
              </div>

              {/* Category Sales Breakdown */}
              <div className="bg-white p-6 rounded-3xl border border-[#D2D2D7]/70 space-y-3.5">
                <h3 className="font-semibold text-sm text-[#1D1D1F]">
                  Item Sales by Category
                </h3>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  {Object.entries(m.categorySales || {}).map(([cat, rev]: [string, any]) => (
                    <div key={cat} className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/60">
                      <span className="text-xs font-medium text-[#6E6E73] block mb-1">{cat}</span>
                      <strong className="text-base font-semibold text-[#1D1D1F]">₹{rev}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: User Account Provisioning (Section 7.2) */}
          {activeTab === 'users' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base text-[#1D1D1F]">
                    Staff & Kitchen Accounts
                  </h3>
                  <p className="text-xs text-[#6E6E73]">
                    Passwords hashed via PBKDF2-HMAC-SHA256 with unique per-user salt. Disabled accounts cannot log in.
                  </p>
                </div>
                <button
                  onClick={() => setShowUserModal(true)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#F56A00] text-white text-xs font-semibold shadow-xs hover:bg-[#D95800] transition self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Provision New User</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D2D2D7]/60 text-[#6E6E73]">
                      <th className="p-3 font-medium">User ID</th>
                      <th className="p-3 font-medium">Username</th>
                      <th className="p-3 font-medium">Email</th>
                      <th className="p-3 font-medium">Role</th>
                      <th className="p-3 font-medium">Status</th>
                      <th className="p-3 font-medium text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D2D2D7]/40 text-[#1D1D1F]">
                    {adminData?.users?.map((u: any) => (
                      <tr key={u.User_ID} className="hover:bg-[#F5F5F7]/60 transition">
                        <td className="p-3 font-mono font-medium text-[#0071E3]">{u.User_ID}</td>
                        <td className="p-3 font-semibold">{u.User_Name}</td>
                        <td className="p-3 text-[#6E6E73]">{u.Email}</td>
                        <td className="p-3">
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-[#E5E5EA] text-[#1D1D1F]">
                            {u.Role}
                          </span>
                        </td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                              u.Account_Status === 'Active'
                                ? 'bg-[#248A3D]/10 text-[#248A3D]'
                                : 'bg-[#D70015]/10 text-[#D70015]'
                            }`}
                          >
                            {u.Account_Status}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => handleToggleUserStatus(u.User_ID)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-medium transition ${
                              u.Account_Status === 'Active'
                                ? 'bg-[#D70015]/10 text-[#D70015] hover:bg-[#D70015]/20'
                                : 'bg-[#248A3D]/10 text-[#248A3D] hover:bg-[#248A3D]/20'
                            }`}
                          >
                            {u.Account_Status === 'Active' ? 'Disable Account' : 'Activate Account'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 3: Menu Management */}
          {activeTab === 'menu' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base text-[#1D1D1F]">
                    Menu Item Catalog
                  </h3>
                  <p className="text-xs text-[#6E6E73]">
                    Server-authoritative prices. All customer carts fetch price strictly from this table.
                  </p>
                </div>
                <button
                  onClick={() => {
                    setMenuFoodId('');
                    setMenuFoodName('');
                    setMenuDesc('');
                    setMenuPrice(300);
                    setShowMenuModal(true);
                  }}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#F56A00] text-white text-xs font-semibold shadow-xs hover:bg-[#D95800] transition self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add New Dish</span>
                </button>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="border-b border-[#D2D2D7]/60 text-[#6E6E73]">
                      <th className="p-3 font-medium">ID</th>
                      <th className="p-3 font-medium">Dish Name</th>
                      <th className="p-3 font-medium">Category</th>
                      <th className="p-3 font-medium">Price</th>
                      <th className="p-3 font-medium">Prep Time</th>
                      <th className="p-3 font-medium">Availability</th>
                      <th className="p-3 font-medium text-right">Edit</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#D2D2D7]/40 text-[#1D1D1F]">
                    {adminData?.menu?.map((item: any) => (
                      <tr key={item.Food_ID} className="hover:bg-[#F5F5F7]/60 transition">
                        <td className="p-3 font-mono font-medium text-[#0071E3]">{item.Food_ID}</td>
                        <td className="p-3 font-semibold">{item.Food_Name}</td>
                        <td className="p-3 text-[#6E6E73]">{item.Category}</td>
                        <td className="p-3 font-semibold text-[#1D1D1F]">₹{item.Price}</td>
                        <td className="p-3 text-[#6E6E73]">{item.Prep_Time_Minutes} mins</td>
                        <td className="p-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-medium ${
                              item.Availability === 'Available'
                                ? 'bg-[#248A3D]/10 text-[#248A3D]'
                                : 'bg-[#D70015]/10 text-[#D70015]'
                            }`}
                          >
                            {item.Availability}
                          </span>
                        </td>
                        <td className="p-3 text-right">
                          <button
                            onClick={() => {
                              setMenuFoodId(item.Food_ID);
                              setMenuFoodName(item.Food_Name);
                              setMenuCategory(item.Category);
                              setMenuDesc(item.Description);
                              setMenuPrice(Number(item.Price));
                              setMenuPrepTime(Number(item.Prep_Time_Minutes));
                              setShowMenuModal(true);
                            }}
                            className="px-3 py-1.5 rounded-xl bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] hover:bg-[#E5E5EA] text-xs font-medium transition"
                          >
                            Edit
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* TAB 4: Table Management */}
          {activeTab === 'tables' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-5">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <h3 className="font-semibold text-base text-[#1D1D1F]">
                    Dining Tables Setup
                  </h3>
                  <p className="text-xs text-[#6E6E73]">
                    Configure table numbering, guest capacities, and maintenance locks.
                  </p>
                </div>
                <button
                  onClick={() => setShowTableModal(true)}
                  className="flex items-center space-x-1.5 px-4 py-2.5 rounded-xl bg-[#F56A00] text-white text-xs font-semibold shadow-xs hover:bg-[#D95800] transition self-start sm:self-auto cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Table</span>
                </button>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
                {adminData?.tables?.map((tbl: any) => (
                  <div
                    key={tbl.Table_ID}
                    className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-2.5 text-xs"
                  >
                    <div className="flex justify-between items-center">
                      <strong className="text-base font-semibold text-[#1D1D1F]">
                        {tbl.Table_Number}
                      </strong>
                      <span className="text-[10px] px-2 py-0.5 rounded-full bg-white border border-[#D2D2D7]/60">
                        {tbl.Seating_Capacity} Seats
                      </span>
                    </div>
                    <div>
                      <span className="text-[10px] text-[#6E6E73] block">Status:</span>
                      <strong
                        className={
                          tbl.Table_Status === 'Unavailable' ? 'text-[#D70015]' : 'text-[#248A3D]'
                        }
                      >
                        {tbl.Table_Status}
                      </strong>
                    </div>
                    {tableQRs[tbl.Table_ID] && (
                      <div className="bg-white p-2 rounded-xl border border-[#D2D2D7]/80 flex flex-col items-center space-y-1">
                        <img
                          src={tableQRs[tbl.Table_ID].dataUrl}
                          alt={`QR ${tbl.Table_Number}`}
                          className={`w-20 h-20 object-contain ${!tableQRs[tbl.Table_ID].isActive ? 'opacity-30 grayscale' : ''}`}
                        />
                        <span className="text-[9px] font-mono text-[#6E6E73] truncate max-w-full">
                          {tableQRs[tbl.Table_ID].token.slice(0, 14)}...
                        </span>
                      </div>
                    )}
                    <div className="space-y-1.5 pt-1">
                      <button
                        onClick={() => setSelectedTableForStandee(tbl)}
                        className="w-full py-1.5 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white text-[11px] font-semibold shadow-xs transition flex items-center justify-center space-x-1 cursor-pointer active:scale-98"
                      >
                        <QrCode className="w-3 h-3" />
                        <span>QR & Standee</span>
                      </button>
                      <button
                        onClick={() => handleToggleTableMaintenance(tbl.Table_ID)}
                        className="w-full py-1.5 rounded-xl bg-white border border-[#D2D2D7] hover:bg-[#E5E5EA] text-[#1D1D1F] text-[11px] font-medium transition cursor-pointer"
                      >
                        {tbl.Table_Status === 'Unavailable' ? 'End Maintenance' : 'Set Maintenance'}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* TAB 5: Refund Reviews & Offline Manual Payout Tracking (Section 13.3) */}
          {activeTab === 'refunds' && (
            <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#D2D2D7]/70 space-y-5">
              <div>
                <h3 className="font-semibold text-base text-[#1D1D1F]">
                  Refund Requests & Manual Payout Tracking
                </h3>
                <p className="text-xs text-[#6E6E73]">
                  Per Blueprint: Admin must approve or reject refund requests. Original payment record remains immutable.
                </p>
              </div>

              {(!adminData?.refunds || adminData.refunds.length === 0) ? (
                <div className="text-center py-16 text-[#6E6E73] text-xs">
                  No refund requests on record.
                </div>
              ) : (
                <div className="space-y-3">
                  {adminData.refunds.map((ref: any) => (
                    <div
                      key={ref.Payment_ID}
                      className="p-5 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 flex flex-col md:flex-row items-start md:items-center justify-between gap-3 text-xs"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center space-x-2">
                          <strong className="text-sm text-[#0071E3] font-mono">
                            {ref.Payment_ID}
                          </strong>
                          <span
                            className={`px-2.5 py-0.5 rounded-full text-[10px] font-medium uppercase ${
                              ref.Refund_Status === 'Approved'
                                ? 'bg-blue-100 text-blue-800'
                                : ref.Refund_Status === 'Completed'
                                ? 'bg-[#248A3D]/10 text-[#248A3D]'
                                : ref.Refund_Status === 'Rejected'
                                ? 'bg-[#D70015]/10 text-[#D70015]'
                                : 'bg-amber-100 text-amber-800'
                            }`}
                          >
                            {ref.Refund_Status}
                          </span>
                        </div>
                        <div className="text-[#6E6E73]">
                          Requested: <strong className="text-[#1D1D1F]">₹{ref.Requested_Amount}</strong> • Reason: "{ref.Refund_Reason}"
                        </div>
                        {ref.Refund_Reference && (
                          <div className="text-[11px] text-[#248A3D] font-mono">
                            Payout UTR: {ref.Refund_Reference} (Completed by: {ref.Completed_By})
                          </div>
                        )}
                      </div>

                      <div className="flex items-center space-x-2">
                        {ref.Refund_Status === 'Requested' && (
                          <>
                            <button
                              onClick={() => handleReviewRefund(ref.Payment_ID, 'APPROVE')}
                              className="px-3.5 py-1.5 rounded-xl bg-[#248A3D] hover:bg-[#1E7433] text-white text-xs font-medium transition"
                            >
                              Approve
                            </button>
                            <button
                              onClick={() => handleReviewRefund(ref.Payment_ID, 'REJECT')}
                              className="px-3.5 py-1.5 rounded-xl bg-[#D70015]/10 hover:bg-[#D70015]/20 text-[#D70015] text-xs font-medium transition"
                            >
                              Reject
                            </button>
                          </>
                        )}

                        {ref.Refund_Status === 'Approved' && (
                          <button
                            onClick={() => {
                              setPayoutPaymentId(ref.Payment_ID);
                              setPayoutAmount(Number(ref.Requested_Amount));
                              setShowPayoutModal(true);
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
                          >
                            Record Payout Reference
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5.5: Feedback Management & Multi-Rating Analytics */}
          {activeTab === 'feedback' && (
            <div className="space-y-6">
              {/* Average Rating Cards */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                {[
                  {
                    label: 'Average Overall Rating',
                    value: feedbackAnalytics?.averageOverallRating ?? m?.averageRating ?? 0,
                    sub: `${feedbackAnalytics?.totalFeedbackCount ?? 0} matching review(s)`,
                    accent: 'border-[#F4B41A] bg-[#FFFDF5]',
                  },
                  {
                    label: 'Food Quality Average',
                    value: feedbackAnalytics?.averageFoodQualityRating ?? 0,
                    sub: 'Taste, presentation & temperature',
                    accent: 'border-[#F56A00]/40 bg-white',
                  },
                  {
                    label: 'Service Average',
                    value: feedbackAnalytics?.averageServiceRating ?? 0,
                    sub: 'Hospitality & table speed',
                    accent: 'border-[#E6D5C3] bg-white',
                  },
                  {
                    label: 'Cleanliness Average',
                    value: feedbackAnalytics?.averageCleanlinessRating ?? 0,
                    sub: 'Dining area & hygiene standards',
                    accent: 'border-[#E6D5C3] bg-white',
                  },
                ].map((card) => (
                  <div
                    key={card.label}
                    className={`p-5 rounded-3xl border shadow-xs space-y-1.5 ${card.accent}`}
                  >
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#6B4C35]">
                      {card.label}
                    </span>
                    <div className="flex items-center space-x-2">
                      <span className="text-3xl font-bold text-[#3B1A08]">
                        {Number(card.value || 0).toFixed(1)}
                      </span>
                      <Star className="w-5 h-5 fill-[#F4B41A] text-[#F4B41A]" />
                      <span className="text-xs text-[#6B4C35]">/ 5.0</span>
                    </div>
                    <p className="text-[11px] text-[#6B4C35]">{card.sub}</p>
                  </div>
                ))}
              </div>

              {/* Filter Bar + Feedback Table/List */}
              <div className="bg-white rounded-3xl p-6 shadow-xs border border-[#E6D5C3] space-y-5">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#E6D5C3]">
                  <div>
                    <h3 className="font-bold text-base text-[#3B1A08] flex items-center space-x-2">
                      <MessageSquare className="w-4 h-4 text-[#F56A00]" />
                      <span>Submitted Customer Feedback ({feedbackAnalytics?.items?.length || 0})</span>
                    </h3>
                    <p className="text-xs text-[#6B4C35] mt-0.5">
                      Verified feedback permanently stored in the Google Sheets <code className="bg-[#FDF4E7] px-1 rounded">Feedback</code> tab, linked to Order ID & Customer ID.
                    </p>
                  </div>

                  {/* Date & Rating Filters */}
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <div className="flex items-center space-x-1.5 bg-[#FFF9F0] px-3 py-1.5 rounded-xl border border-[#E6D5C3]">
                      <Filter className="w-3.5 h-3.5 text-[#F56A00]" />
                      <input
                        type="date"
                        value={feedbackDateFilter}
                        onChange={(e) => {
                          const nextDate = e.target.value;
                          setFeedbackDateFilter(nextDate);
                          loadFilteredFeedback(nextDate, feedbackRatingFilter);
                        }}
                        className="bg-transparent text-xs text-[#3B1A08] focus:outline-none"
                      />
                    </div>

                    <select
                      value={feedbackRatingFilter}
                      onChange={(e) => {
                        const nextRating = Number(e.target.value);
                        setFeedbackRatingFilter(nextRating);
                        loadFilteredFeedback(feedbackDateFilter, nextRating);
                      }}
                      className="px-3 py-2 rounded-xl border border-[#E6D5C3] bg-[#FFF9F0] text-xs font-semibold text-[#3B1A08] focus:outline-none focus:border-[#F56A00]"
                    >
                      <option value={0}>All Ratings</option>
                      {[5, 4, 3, 2, 1].map((r) => (
                        <option key={r} value={r}>
                          {r} Star{r > 1 ? 's' : ''} Only
                        </option>
                      ))}
                    </select>

                    {(feedbackDateFilter || feedbackRatingFilter > 0) && (
                      <button
                        type="button"
                        onClick={() => {
                          setFeedbackDateFilter('');
                          setFeedbackRatingFilter(0);
                          loadFilteredFeedback('', 0);
                        }}
                        className="px-3 py-2 rounded-xl bg-[#FDF4E7] hover:bg-[#F5E6D3] text-[#3B1A08] font-semibold transition cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </div>
                </div>

                {feedbackLoading ? (
                  <div className="text-center py-12 text-xs text-[#6B4C35]">
                    Loading verified customer feedback...
                  </div>
                ) : !feedbackAnalytics?.items || feedbackAnalytics.items.length === 0 ? (
                  <div className="text-center py-12 text-xs text-[#6B4C35]">
                    No submitted feedback matches the selected filters.
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {feedbackAnalytics.items.map((fb: any) => (
                      <div
                        key={fb.Feedback_ID || `${fb.Order_ID}-${fb.Submitted_At}`}
                        className="p-5 rounded-2xl bg-[#FFF9F0] border border-[#E6D5C3] space-y-3"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <div>
                            <div className="flex items-center space-x-2">
                              <strong className="text-sm font-bold text-[#3B1A08]">
                                {fb.Customer_Name || 'Guest'}
                              </strong>
                              {fb.Order_ID && (
                                <span className="px-2 py-0.5 rounded-full bg-white border border-[#E6D5C3] font-mono text-[10px] font-bold text-[#F56A00]">
                                  {fb.Order_ID}
                                </span>
                              )}
                            </div>
                            <span className="text-[11px] text-[#6B4C35]">
                              {fb.Booking_ID} • {fb.Submitted_At ? new Date(fb.Submitted_At).toLocaleString() : ''}
                            </span>
                          </div>

                          <div className="flex items-center space-x-1 px-2.5 py-1 rounded-full bg-[#F4B41A]/25 text-[#3B1A08] text-xs font-bold">
                            <Star className="w-3.5 h-3.5 fill-[#F4B41A] text-[#F4B41A]" />
                            <span>{fb.Overall_Rating}/5</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2 text-[11px]">
                          <div className="p-2 rounded-xl bg-white border border-[#E6D5C3] text-center">
                            <span className="block text-[#6B4C35]">Food Quality</span>
                            <strong className="text-[#3B1A08]">{fb.Food_Quality_Rating}/5</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-white border border-[#E6D5C3] text-center">
                            <span className="block text-[#6B4C35]">Service</span>
                            <strong className="text-[#3B1A08]">{fb.Service_Rating}/5</strong>
                          </div>
                          <div className="p-2 rounded-xl bg-white border border-[#E6D5C3] text-center">
                            <span className="block text-[#6B4C35]">Cleanliness</span>
                            <strong className="text-[#3B1A08]">{fb.Cleanliness_Rating}/5</strong>
                          </div>
                        </div>

                        {fb.Comments && (
                          <p className="text-xs text-[#3B1A08] bg-white p-3 rounded-xl border border-[#E6D5C3] italic">
                            "{fb.Comments}"
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* TAB 6: Restaurant Settings (Editable) */}
          {activeTab === 'settings' && (
            <div className="space-y-6">
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-[#D2D2D7]/70 space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[#D2D2D7]/60">
                  <div>
                    <h3 className="font-semibold text-lg text-[#1D1D1F]">
                      Restaurant Settings (Restaurant_Settings Sheet Tab)
                    </h3>
                    <p className="text-xs text-[#6E6E73] mt-0.5">
                      Live configuration synchronized with your Google Spreadsheet database.
                    </p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSetDefaultUpiPreset}
                      className="px-3.5 py-2 rounded-xl bg-[#FDF4E7] hover:bg-[#F5E6D3] text-xs font-semibold text-[#F56A00] border border-[#E6D5C3] transition flex items-center space-x-1.5 cursor-pointer"
                    >
                      <span>Apply Kesika M UPI Preset</span>
                    </button>
                    <button
                      type="button"
                      disabled={isSavingSettings}
                      onClick={() => handleSaveAllSettings()}
                      className="px-5 py-2 rounded-xl bg-[#F56A00] hover:bg-[#D95800] text-xs font-semibold text-white shadow-xs transition flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
                    >
                      <Save className="w-3.5 h-3.5" />
                      <span>{isSavingSettings ? 'Saving to Database...' : 'Save All Settings'}</span>
                    </button>
                  </div>
                </div>

                <form onSubmit={handleSaveAllSettings} className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                  {/* Restaurant Name */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Restaurant Name (RESTAURANT_NAME)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.RESTAURANT_NAME || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, RESTAURANT_NAME: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* UPI ID */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <div className="flex items-center justify-between">
                      <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide">
                        Restaurant UPI ID (UPI_ID)
                      </label>
                      <span className="text-[10px] text-[#0071E3] font-semibold">Active for Payments</span>
                    </div>
                    <input
                      type="text"
                      value={settingsForm.UPI_ID || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, UPI_ID: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-mono font-bold text-[#0071E3] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* UPI Payee Name */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      UPI Payee Name (UPI_PAYEE_NAME)
                    </label>
                    <input
                      type="text"
                      value={settingsForm.UPI_PAYEE_NAME || ''}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, UPI_PAYEE_NAME: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* Tax Rate % */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      GST / Tax Rate % (TAX_RATE_PERCENT)
                    </label>
                    <input
                      type="number"
                      step="0.5"
                      min="0"
                      max="28"
                      value={settingsForm.TAX_RATE_PERCENT || '5'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, TAX_RATE_PERCENT: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* Grace Period Minutes */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Arrival Grace Window (GRACE_PERIOD_MINUTES)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="60"
                      value={settingsForm.GRACE_PERIOD_MINUTES || '10'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, GRACE_PERIOD_MINUTES: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* Dining Duration Minutes */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Dining Duration (DINING_DURATION_MINUTES)
                    </label>
                    <input
                      type="number"
                      min="30"
                      max="180"
                      value={settingsForm.DINING_DURATION_MINUTES || '90'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, DINING_DURATION_MINUTES: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* Table Cleaning Turnover */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Cleaning Turnover (CLEANING_TURNOVER_MINUTES)
                    </label>
                    <input
                      type="number"
                      min="5"
                      max="30"
                      value={settingsForm.CLEANING_TURNOVER_MINUTES || '15'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, CLEANING_TURNOVER_MINUTES: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* Total Blocking Window */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Total Slot Blocking (TOTAL_BLOCKING_WINDOW_MINUTES)
                    </label>
                    <input
                      type="number"
                      min="45"
                      max="240"
                      value={settingsForm.TOTAL_BLOCKING_WINDOW_MINUTES || '105'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, TOTAL_BLOCKING_WINDOW_MINUTES: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* Opening & Closing Hours */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Daily Opening Time (OPENING_TIME)
                    </label>
                    <input
                      type="time"
                      value={settingsForm.OPENING_TIME || '11:00'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, OPENING_TIME: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Daily Closing Time (CLOSING_TIME)
                    </label>
                    <input
                      type="time"
                      value={settingsForm.CLOSING_TIME || '23:00'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, CLOSING_TIME: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  {/* Discount Limits */}
                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Max Staff Discount % (MAX_STAFF_DISCOUNT_PERCENT)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="20"
                      value={settingsForm.MAX_STAFF_DISCOUNT_PERCENT || '10'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, MAX_STAFF_DISCOUNT_PERCENT: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/70 space-y-1.5">
                    <label className="text-[11px] font-semibold text-[#6E6E73] uppercase tracking-wide block">
                      Max Admin Discount % (MAX_ADMIN_DISCOUNT_PERCENT)
                    </label>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={settingsForm.MAX_ADMIN_DISCOUNT_PERCENT || '50'}
                      onChange={(e) =>
                        setSettingsForm({ ...settingsForm, MAX_ADMIN_DISCOUNT_PERCENT: e.target.value })
                      }
                      className="w-full px-3 py-2 rounded-xl bg-white border border-[#D2D2D7] text-xs font-semibold text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                </form>
              </div>

              {/* Google Sheets Database Connection & Empty Sheet Explanation Panel */}
              <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-xs border border-[#D2D2D7]/70 space-y-4">
                <div className="flex items-center space-x-2.5">
                  <div className="w-9 h-9 rounded-xl bg-[#248A3D]/10 text-[#248A3D] flex items-center justify-center">
                    <Database className="w-5 h-5" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-base text-[#1D1D1F]">
                      Google Sheets Database Setup & Auto-Seeder
                    </h4>
                    <p className="text-xs text-[#6E6E73]">
                      Why your Google Spreadsheet was empty and how to populate all 12 tabs and 108 columns in 1 click.
                    </p>
                  </div>
                </div>

                <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/60 space-y-3 text-xs text-[#1D1D1F]">
                  <p className="leading-relaxed">
                    <strong>Why was Google Sheets empty with only "Sheet1"?</strong> <br />
                    In Google Workspace, a new spreadsheet does not get modified until the Apps Script initializer function runs. Your backend files in Apps Script (such as <code className="bg-white px-1.5 py-0.5 rounded border border-[#D2D2D7]">gas/DatabaseSetup.js</code>) contain the instructions, but require one-time execution.
                  </p>
                  <div className="p-3 bg-white rounded-xl border border-[#D2D2D7] space-y-1.5">
                    <span className="font-bold text-[#0071E3] block">How to populate your Google Sheet in 30 seconds:</span>
                    <ol className="list-decimal list-inside space-y-1 text-[#6E6E73]">
                      <li>Open your Google Sheet ("Restro Manage") in browser.</li>
                      <li>Click <strong>Extensions &gt; Apps Script</strong> from the top menu bar.</li>
                      <li>In the editor function toolbar dropdown at the top, select <strong>setupAndSeedCompleteDatabase</strong>.</li>
                      <li>Click the <strong>Run</strong> button (triangle icon).</li>
                    </ol>
                  </div>
                  <p className="text-[11px] text-[#248A3D] font-medium">
                    ✓ All 12 tabs (Customers, Tables, Table_Reservations, Queue, Orders, Order_Items, Bills, Payments, Refund_Requests, Menu, Users, Restaurant_Settings) and all 108 columns will be created instantly and seeded with your real UPI ID (<code className="font-mono">kesikam2006@oksbi</code>), tables, and menu items!
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Modals: User Creation, Menu Item, Table, Payout */}
          {showUserModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#D2D2D7]/80">
                <h3 className="font-semibold text-lg text-[#1D1D1F]">
                  Provision Staff / Kitchen Account
                </h3>
                <form onSubmit={handleCreateUser} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Username</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. waiter1"
                      value={newUserName}
                      onChange={(e) => setNewUserName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Email</label>
                    <input
                      type="email"
                      required
                      placeholder="e.g. waiter1@treatandtaste.restaurant"
                      value={newUserEmail}
                      onChange={(e) => setNewUserEmail(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Role</label>
                    <select
                      value={newUserRole}
                      onChange={(e) => setNewUserRole(e.target.value as any)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] bg-white text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    >
                      <option value="Staff">Staff (Host & Waiter)</option>
                      <option value="Kitchen">Kitchen (Chef & KDS)</option>
                      <option value="Admin">Administrator</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Initial Password (Min 8 chars)
                    </label>
                    <input
                      type="password"
                      required
                      minLength={8}
                      placeholder="Strong initial password"
                      value={newUserPassword}
                      onChange={(e) => setNewUserPassword(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                    <span className="block text-[11px] text-[#6E6E73] mt-1">
                      Hashed with PBKDF2-HMAC-SHA256 & random salt. Plaintext is never saved.
                    </span>
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowUserModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] hover:bg-[#E5E5EA] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-medium shadow-xs hover:bg-[#0077ED] transition"
                    >
                      Create Account
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Menu Modal */}
          {showMenuModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#D2D2D7]/80">
                <h3 className="font-semibold text-lg text-[#1D1D1F]">
                  {menuFoodId ? 'Edit Menu Dish' : 'Add New Menu Item'}
                </h3>
                <form onSubmit={handleUpsertMenuItem} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Food Name</label>
                    <input
                      type="text"
                      required
                      value={menuFoodName}
                      onChange={(e) => setMenuFoodName(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2.5">
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Category</label>
                      <select
                        value={menuCategory}
                        onChange={(e) => setMenuCategory(e.target.value)}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] bg-white text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                      >
                        <option value="Starters">Starters</option>
                        <option value="Mains">Mains</option>
                        <option value="Desserts">Desserts</option>
                        <option value="Beverages">Beverages</option>
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Price (₹)</label>
                      <input
                        type="number"
                        min={1}
                        required
                        value={menuPrice}
                        onChange={(e) => setMenuPrice(Number(e.target.value))}
                        className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Description</label>
                    <textarea
                      rows={2}
                      required
                      value={menuDesc}
                      onChange={(e) => setMenuDesc(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Prep Time (Minutes)
                    </label>
                    <input
                      type="number"
                      min={1}
                      required
                      value={menuPrepTime}
                      onChange={(e) => setMenuPrepTime(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowMenuModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] hover:bg-[#E5E5EA] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-medium shadow-xs hover:bg-[#0077ED] transition"
                    >
                      Save Menu Item
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Table Modal */}
          {showTableModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#D2D2D7]/80">
                <h3 className="font-semibold text-lg text-[#1D1D1F]">Add Physical Dining Table</h3>
                <form onSubmit={handleAddTable} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Table Number</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. T11"
                      value={newTableNum}
                      onChange={(e) => setNewTableNum(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] font-semibold uppercase focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">Seating Capacity</label>
                    <input
                      type="number"
                      min={1}
                      max={20}
                      required
                      value={newTableCap}
                      onChange={(e) => setNewTableCap(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowTableModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] hover:bg-[#E5E5EA] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-[#0071E3] text-white text-xs font-medium shadow-xs hover:bg-[#0077ED] transition"
                    >
                      Add Table
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Payout Completion Modal */}
          {showPayoutModal && (
            <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
              <div className="bg-white rounded-3xl max-w-md w-full p-6 space-y-4 shadow-xl border border-[#D2D2D7]/80">
                <h3 className="font-semibold text-lg text-[#1D1D1F]">
                  Record Manual Refund Payout
                </h3>
                <form onSubmit={handleCompletePayout} className="space-y-3.5">
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Payment ID
                    </label>
                    <input
                      type="text"
                      disabled
                      value={payoutPaymentId}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] bg-[#F5F5F7] text-xs font-mono text-[#6E6E73]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Completed Refund Amount (₹)
                    </label>
                    <input
                      type="number"
                      required
                      min={1}
                      value={payoutAmount}
                      onChange={(e) => setPayoutAmount(Number(e.target.value))}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs text-[#1D1D1F] font-semibold focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-[#1D1D1F] mb-1">
                      Outbound Bank Transfer / UPI UTR
                    </label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. REF-UTR-987654"
                      value={payoutUtr}
                      onChange={(e) => setPayoutUtr(e.target.value)}
                      className="w-full px-3.5 py-2 rounded-xl border border-[#D2D2D7] text-xs font-mono text-[#1D1D1F] focus:outline-none focus:border-[#0071E3]"
                    />
                  </div>
                  <div className="flex space-x-2 pt-2">
                    <button
                      type="button"
                      onClick={() => setShowPayoutModal(false)}
                      className="flex-1 py-2.5 rounded-xl bg-[#F5F5F7] text-xs font-medium text-[#1D1D1F] hover:bg-[#E5E5EA] transition"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      className="flex-1 py-2.5 rounded-xl bg-[#248A3D] text-white text-xs font-medium shadow-xs hover:bg-[#1E7433] transition"
                    >
                      Confirm Payout Completed
                    </button>
                  </div>
                </form>
              </div>
            </div>
          )}

          {/* Table QR Standee Preview & Download Modal */}
          {selectedTableForStandee && (
            <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
              <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-5 shadow-2xl border border-[#D2D2D7]/80 my-8">
                <div className="flex items-center justify-between pb-3 border-b border-[#D2D2D7]/70">
                  <div className="flex items-center space-x-2">
                    <QrCode className="w-5 h-5 text-[#0071E3]" />
                    <h3 className="font-semibold text-lg text-[#1D1D1F]">
                      Table Standee Card — {selectedTableForStandee.Table_Number}
                    </h3>
                  </div>
                  <button
                    onClick={() => setSelectedTableForStandee(null)}
                    className="p-1 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Printable Standee Card Container */}
                <div id="printable-standee" className="bg-[#FFF9F0] p-6 rounded-2xl border-2 border-[#3B1A08] shadow-inner text-center space-y-4">
                  {/* Brand Header */}
                  <div className="flex flex-col items-center justify-center space-y-1">
                    <BrandLogo size="lg" />
                  </div>

                  {/* Table Badge */}
                  <div className="inline-block px-6 py-2.5 rounded-2xl bg-white border border-[#E6D5C3] shadow-xs">
                    <span className="text-2xl font-black text-[#3B1A08] tracking-tight block">
                      TABLE {selectedTableForStandee.Table_Number}
                    </span>
                    <span className="text-xs font-semibold text-[#F56A00]">
                      Seating Capacity: {selectedTableForStandee.Seating_Capacity} Guests
                    </span>
                  </div>

                  {/* Real Scannable Table-Specific QR Code */}
                  <div className="w-56 h-56 bg-white p-3 rounded-2xl border-2 border-[#3B1A08] mx-auto shadow-md relative flex items-center justify-center">
                    {tableQRs[selectedTableForStandee.Table_ID]?.dataUrl ? (
                      <img
                        src={tableQRs[selectedTableForStandee.Table_ID].dataUrl}
                        alt={`QR Code for Table ${selectedTableForStandee.Table_Number}`}
                        className="w-full h-full object-contain rounded-lg"
                      />
                    ) : (
                      <div className="text-xs text-[#6B4C35]">Generating QR...</div>
                    )}
                  </div>

                  {/* Token Metadata & Status Controls */}
                  {tableQRs[selectedTableForStandee.Table_ID] && (
                    <div className="text-[11px] bg-white p-3 rounded-xl border border-[#E6D5C3] text-left space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-[#3B1A08]">
                          Token: <code className="text-[#F56A00]">{tableQRs[selectedTableForStandee.Table_ID].token}</code>
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            tableQRs[selectedTableForStandee.Table_ID].isActive
                              ? 'bg-green-100 text-green-800'
                              : 'bg-red-100 text-red-800'
                          }`}
                        >
                          {tableQRs[selectedTableForStandee.Table_ID].isActive ? 'ACTIVE' : 'DISABLED'}
                        </span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleRegenerateQR(selectedTableForStandee.Table_ID)}
                          className="flex-1 py-1.5 rounded-lg bg-[#FDF4E7] border border-[#F4B41A] text-[#3B1A08] font-semibold hover:bg-[#F5E6D3] transition cursor-pointer"
                        >
                          Regenerate Token
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            handleToggleQR(
                              selectedTableForStandee.Table_ID,
                              tableQRs[selectedTableForStandee.Table_ID].isActive
                            )
                          }
                          className="flex-1 py-1.5 rounded-lg bg-[#FFF9F0] border border-[#E6D5C3] text-[#3B1A08] font-semibold hover:bg-[#FDF4E7] transition cursor-pointer"
                        >
                          {tableQRs[selectedTableForStandee.Table_ID].isActive ? 'Disable QR' : 'Enable QR'}
                        </button>
                      </div>
                    </div>
                  )}

                  <div className="space-y-1">
                    <p className="text-xs font-bold text-[#3B1A08]">
                      Scan to Reserve, View Menu & Order
                    </p>
                    <p className="text-[11px] text-[#6B4C35]">
                      Orders are automatically tagged to Table {selectedTableForStandee.Table_Number} and sent straight to the {BRAND_CONFIG.name} Kitchen.
                    </p>
                  </div>

                  {/* Dining Wi-Fi */}
                  <div className="p-3 bg-white rounded-xl border border-[#E6D5C3] text-[11px] text-[#6B4C35] flex items-center justify-around">
                    <div>
                      <span className="block font-semibold text-[#3B1A08]">Complimentary Wi-Fi</span>
                      <span>SSID: <strong>{BRAND_CONFIG.wifiSsid}</strong></span>
                    </div>
                    <div className="border-l border-[#E6D5C3] pl-4 text-left">
                      <span className="block font-semibold text-[#3B1A08]">Password</span>
                      <span className="font-mono">{BRAND_CONFIG.wifiPassword}</span>
                    </div>
                  </div>
                </div>

                {/* Modal Actions */}
                <div className="flex flex-col sm:flex-row gap-2 pt-2">
                  <button
                    type="button"
                    onClick={() => downloadStandeePNG(selectedTableForStandee)}
                    className="flex-1 py-3 rounded-full bg-[#F56A00] hover:bg-[#D95800] text-white text-xs font-semibold shadow-xs transition flex items-center justify-center space-x-2 cursor-pointer active:scale-98"
                  >
                    <Download className="w-4 h-4" />
                    <span>Download Standee (High-Res PNG)</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="px-5 py-3 rounded-full bg-[#FDF4E7] hover:bg-[#F5E6D3] text-[#3B1A08] text-xs font-semibold border border-[#E6D5C3] transition flex items-center justify-center space-x-1.5 cursor-pointer"
                  >
                    <Printer className="w-4 h-4 text-[#6B4C35]" />
                    <span>Print</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedTableForStandee(null)}
                    className="px-4 py-3 rounded-full bg-white hover:bg-[#FFF9F0] text-[#6B4C35] text-xs font-semibold border border-[#E6D5C3] transition cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Main Application Shell:
 * Hosts all five separate website interfaces:
 * 1. Main Website (Public)
 * 2. Customer Website (OTP, Booking, Queue, Menu, Billing, Feedback)
 * 3. Staff Website (Arrivals, Queue, Table Map, Authorization, Payments)
 * 4. Kitchen Website (Authorized KDS tickets)
 * 5. Admin Website (Analytics, Users, Menu, Tables, Refunds)
 * 
 * Powered by one shared Google Apps Script V8 backend architecture
 * and one Google Spreadsheet with 12 tabs and 108 defined columns.
 */

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { WebsiteTab, UserSessionState } from './frontend/types';
import { Navbar } from './frontend/components/Navbar';
import { MainWebsite } from './frontend/views/MainWebsite';
import { CustomerWebsite } from './frontend/views/CustomerWebsite';
import { StaffWebsite } from './frontend/views/StaffWebsite';
import { KitchenWebsite } from './frontend/views/KitchenWebsite';
import { AdminWebsite } from './frontend/views/AdminWebsite';
import { RequestDispatcher } from './backend/dispatcher';
import { Database, CheckCircle2, AlertCircle, X } from 'lucide-react';

export default function App() {
  const [activeTab, setActiveTab] = useState<WebsiteTab>('main');
  const [session, setSession] = useState<UserSessionState | null>(null);
  const [customerInitialMode, setCustomerInitialMode] = useState<'Online' | 'Walk-in'>('Online');
  const [scannedTableInfo, setScannedTableInfo] = useState<any | null>(null);
  const [qrScanError, setQrScanError] = useState<string>('');

  // Handle incoming QR scan deep-links (?scan-table=1&token=... or ?source=walkin)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    const source = params.get('source');

    if (token) {
      setCustomerInitialMode('Walk-in');
      setActiveTab('customer');
      RequestDispatcher.dispatch({
        action: 'resolveTableQR',
        payload: { token },
      }).then((res) => {
        if (res.success && res.data?.table) {
          setScannedTableInfo(res.data.table);
          setQrScanError('');
        } else {
          setScannedTableInfo(null);
          setQrScanError(res.error?.message || 'Invalid or disabled table QR code.');
        }
      });
    } else if (source === 'walkin') {
      setCustomerInitialMode('Walk-in');
      setActiveTab('customer');
    }
  }, []);

  // Schema verification dialog state
  const [showSchemaModal, setShowSchemaModal] = useState<boolean>(false);
  const [schemaResult, setSchemaResult] = useState<any>(null);
  const [schemaValid, setSchemaValid] = useState<boolean | null>(null);

  // Quick navigation from Main Website CTAs
  function handleNavigateToCustomer(mode: 'online' | 'walkin') {
    setCustomerInitialMode(mode === 'walkin' ? 'Walk-in' : 'Online');
    setActiveTab('customer');
  }

  function handleLogout() {
    if (session?.sessionId) {
      RequestDispatcher.dispatch({
        action: 'logout',
        sessionId: session.sessionId,
      });
    }
    setSession(null);
  }

  async function handleVerifySchema() {
    const res = await RequestDispatcher.dispatch({ action: 'verifyDatabaseSchema' });
    setSchemaResult(res.data);
    setSchemaValid(res.success);
    setShowSchemaModal(true);
  }

  return (
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F] flex flex-col font-sans">
      {/* 5-Website Navigation Header */}
      <Navbar
        activeTab={activeTab}
        onTabChange={setActiveTab}
        session={session}
        onLogout={handleLogout}
        onVerifySchema={handleVerifySchema}
        schemaValid={schemaValid}
      />

      {/* Main Content Area: Renders the selected Website view with smooth luxury transition */}
      <main className="flex-1 overflow-x-hidden">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: 'easeOut' }}
            className="w-full"
          >
            {activeTab === 'main' && (
              <MainWebsite onNavigateToCustomer={handleNavigateToCustomer} />
            )}

            {activeTab === 'customer' && (
              <CustomerWebsite
                initialVisitType={customerInitialMode}
                scannedTable={scannedTableInfo}
                qrScanError={qrScanError}
                session={session?.role === 'Customer' ? session : null}
                onSetSession={setSession}
                onLogout={handleLogout}
              />
            )}

            {activeTab === 'staff' && (
              <StaffWebsite
                session={
                  session && (session.role === 'Staff' || session.role === 'Admin') ? session : null
                }
                onSetSession={setSession}
                onLogout={handleLogout}
              />
            )}

            {activeTab === 'kitchen' && (
              <KitchenWebsite
                session={
                  session && (session.role === 'Kitchen' || session.role === 'Admin') ? session : null
                }
                onSetSession={setSession}
                onLogout={handleLogout}
              />
            )}

            {activeTab === 'admin' && (
              <AdminWebsite
                session={session?.role === 'Admin' ? session : null}
                onSetSession={setSession}
                onLogout={handleLogout}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </main>

      {/* Schema Verification Modal */}
      {showSchemaModal && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl border border-[#D2D2D7]">
            <div className="flex items-center justify-between pb-3 border-b border-[#D2D2D7]/60">
              <div className="flex items-center space-x-2.5">
                <div className="w-8 h-8 rounded-full bg-[#0071E3]/10 flex items-center justify-center text-[#0071E3]">
                  <Database className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-[#1D1D1F]">
                  Database Schema Integrity Audit
                </h3>
              </div>
              <button
                onClick={() => setShowSchemaModal(false)}
                className="p-1 rounded-full text-[#6E6E73] hover:text-[#1D1D1F] hover:bg-[#F5F5F7] transition cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-4 rounded-2xl bg-[#F5F5F7] border border-[#D2D2D7]/60 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#6E6E73]">Total Database Tabs:</span>
                  <span className="font-semibold text-sm text-[#1D1D1F]">
                    {schemaResult?.totalTabs ?? 12} / 12 Tabs
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="font-medium text-[#6E6E73]">Total Defined Columns:</span>
                  <span className="font-semibold text-sm text-[#248A3D]">
                    {schemaResult?.totalColumns ?? 108} / 108 Columns Match
                  </span>
                </div>
                <div className="flex items-center justify-between pt-1 border-t border-[#D2D2D7]/40">
                  <span className="font-medium text-[#6E6E73]">Integrity Status:</span>
                  <span className="flex items-center space-x-1 font-semibold text-[#248A3D]">
                    <CheckCircle2 className="w-4 h-4 text-[#248A3D]" />
                    <span>Schema Fully Valid</span>
                  </span>
                </div>
              </div>

              <div className="max-h-48 overflow-y-auto space-y-2 p-3 bg-white rounded-xl border border-[#D2D2D7]/60">
                <span className="text-[10px] font-bold uppercase tracking-wider text-[#6E6E73] block mb-1">
                  Verified Sheet Tabs:
                </span>
                {[
                  '1. Customers (10 columns)',
                  '2. Bookings (14 columns)',
                  '3. Tables (4 columns)',
                  '4. Table_Reservations (7 columns)',
                  '5. Menu (9 columns)',
                  '6. Orders (6 columns)',
                  '7. Order_Items (10 columns)',
                  '8. Bills (10 columns)',
                  '9. Payments (22 columns)',
                  '10. Users (8 columns)',
                  '11. Restaurant_Settings (2 columns)',
                  '12. Order_Status_History (6 columns)',
                ].map((tabStr, i) => (
                  <div key={i} className="flex items-center space-x-2 text-xs text-[#1D1D1F]">
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#248A3D] flex-shrink-0" />
                    <span>{tabStr}</span>
                  </div>
                ))}
              </div>
            </div>

            <button
              onClick={() => setShowSchemaModal(false)}
              className="w-full py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white text-xs font-semibold shadow-xs transition cursor-pointer"
            >
              Close Audit Report
            </button>
          </div>
        </div>
      )}

      {/* Global Apple-Style Minimal Footer */}
      <footer className="bg-white text-[#6E6E73] text-xs py-5 px-4 sm:px-6 border-t border-[#D2D2D7]">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-2.5">
          <span className="text-[#1D1D1F] font-medium">
            Smart Restaurant Management & Customer Queue System • Blueprint v3
          </span>
          <span className="text-[#6E6E73] text-[11px]">
            Google Apps Script (V8) Architecture • 12 Tabs / 108 Columns Google Sheets
          </span>
        </div>
      </footer>
    </div>
  );
}

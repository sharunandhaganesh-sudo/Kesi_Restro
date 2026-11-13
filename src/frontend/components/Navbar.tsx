/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { WebsiteTab, UserSessionState } from '../types';
import { SavorLogo } from './SavorLogo';
import {
  UtensilsCrossed,
  User,
  ConciergeBell,
  ChefHat,
  ShieldCheck,
  LogOut,
  Database,
  CheckCircle2,
  Menu,
  X,
} from 'lucide-react';

interface NavbarProps {
  activeTab: WebsiteTab;
  onTabChange: (tab: WebsiteTab) => void;
  session: UserSessionState | null;
  onLogout: () => void;
  onVerifySchema: () => void;
  schemaValid: boolean | null;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeTab,
  onTabChange,
  session,
  onLogout,
  onVerifySchema,
  schemaValid,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const navItems: { id: WebsiteTab; label: string; icon: React.FC<{ className?: string }> }[] = [
    { id: 'main', label: '1. Main Web', icon: UtensilsCrossed },
    { id: 'customer', label: '2. Customer Web', icon: User },
    { id: 'staff', label: '3. Staff Web', icon: ConciergeBell },
    { id: 'kitchen', label: '4. Kitchen Web', icon: ChefHat },
    { id: 'admin', label: '5. Admin Web', icon: ShieldCheck },
  ];

  function handleSelectTab(tab: WebsiteTab) {
    onTabChange(tab);
    setMobileMenuOpen(false);
  }

  React.useEffect(() => {
    if (!mobileMenuOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setMobileMenuOpen(false);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [mobileMenuOpen]);

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-[#3B1A08] text-[#FFF9F0] border-b border-[#5B2E14] shadow-sm transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Treat & Taste — Family Restaurant Official Logo */}
          <SavorLogo
            size="md"
            light={true}
            onClick={() => handleSelectTab('main')}
          />

          {/* Desktop Navigation Pills */}
          <nav className="hidden lg:flex items-center bg-[#2A1104]/80 p-1 rounded-full border border-[#5B2E14] shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-[#F56A00] text-white shadow-xs font-semibold'
                      : 'text-[#F5DFC8] hover:text-white font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-[#F4B41A]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Session & Schema Actions */}
          <div className="flex items-center space-x-1.5 sm:space-x-2.5 shrink-0">
            {/* Database Schema Button: visible on desktop or inside mobile dropdown */}
            <button
              onClick={onVerifySchema}
              title="Verify Google Sheets Schema"
              className="hidden md:flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-full bg-[#2A1104] hover:bg-[#4A210B] border border-[#5B2E14] text-[#FFF9F0] transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-[#F4B41A]" />
              <span className="font-medium">12 Tabs</span>
              {schemaValid === true && <CheckCircle2 className="w-3.5 h-3.5 text-[#4ADE80]" />}
            </button>

            {/* User Session Pill */}
            {session ? (
              <div className="flex items-center space-x-1.5 bg-[#2A1104] pl-2.5 pr-1 py-1 rounded-full border border-[#5B2E14] max-w-[130px] sm:max-w-[200px]">
                <span className="text-[11px] sm:text-xs font-semibold text-[#FFF9F0] truncate">
                  {session.name}
                </span>
                <span className="text-[9px] sm:text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-[#F56A00] text-white shrink-0">
                  {session.role}
                </span>
                <button
                  onClick={onLogout}
                  title="Log out"
                  className="p-1 rounded-full hover:bg-[#5B2E14] text-[#F5DFC8] hover:text-[#F4B41A] transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : null}

            {/* Mobile Menu Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
              className="lg:hidden p-2 rounded-xl text-[#FFF9F0] hover:bg-[#4A210B] border border-[#5B2E14] transition cursor-pointer touch-manipulation min-h-[40px] min-w-[40px] flex items-center justify-center"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-[#5B2E14] space-y-1 bg-[#2A1104] rounded-2xl p-2 mb-3 shadow-xl border">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#F4B41A] px-3 pt-1 block">
              Switch Portal View:
            </span>
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`w-full flex items-center space-x-2.5 px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer ${
                    isActive
                      ? 'bg-[#F56A00] text-white shadow-xs'
                      : 'text-[#FFF9F0] hover:bg-[#3B1A08]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#F4B41A]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}

            <div className="pt-2 mt-2 border-t border-[#5B2E14]/80 px-1">
              <button
                onClick={() => {
                  setMobileMenuOpen(false);
                  onVerifySchema();
                }}
                className="w-full flex items-center justify-between px-3 py-2 rounded-xl bg-[#3B1A08] text-xs font-semibold text-[#FFF9F0] border border-[#5B2E14] hover:bg-[#4A210B] transition cursor-pointer"
              >
                <div className="flex items-center space-x-2">
                  <Database className="w-4 h-4 text-[#F4B41A]" />
                  <span>Database Schema Audit (12 Tabs / 108 Cols)</span>
                </div>
                {schemaValid === true && <CheckCircle2 className="w-4 h-4 text-[#4ADE80]" />}
              </button>
            </div>
          </div>
        )}
      </div>
    </header>
  );
};

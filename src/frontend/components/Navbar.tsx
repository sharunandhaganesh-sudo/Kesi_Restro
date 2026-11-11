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

  return (
    <header className="sticky top-0 z-50 backdrop-blur-md bg-white/85 text-[#1D1D1F] border-b border-[#D2D2D7]/80 transition-colors">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Apple-style Minimalist Brand Logo */}
          <SavorLogo
            size="md"
            onClick={() => handleSelectTab('main')}
          />

          {/* Desktop Apple-Style Segmented Control */}
          <nav className="hidden lg:flex items-center bg-[#F5F5F7] p-1 rounded-full border border-[#D2D2D7]/60 shadow-inner">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = activeTab === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => handleSelectTab(item.id)}
                  className={`flex items-center space-x-1.5 px-3.5 py-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
                    isActive
                      ? 'bg-white text-[#1D1D1F] shadow-xs font-semibold'
                      : 'text-[#6E6E73] hover:text-[#1D1D1F] font-medium'
                  }`}
                >
                  <Icon className={`w-3.5 h-3.5 ${isActive ? 'text-[#0071E3]' : 'text-[#6E6E73]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          {/* Right Session & Schema Actions */}
          <div className="flex items-center space-x-2.5">
            {/* Database Schema Button */}
            <button
              onClick={onVerifySchema}
              title="Verify 12 Tabs & 108 Columns Schema"
              className="flex items-center space-x-1 text-xs px-2.5 py-1.5 rounded-full bg-[#F5F5F7] hover:bg-[#E5E5EA] border border-[#D2D2D7] text-[#1D1D1F] transition cursor-pointer"
            >
              <Database className="w-3.5 h-3.5 text-[#0071E3]" />
              <span className="hidden sm:inline font-medium">12 Tabs / 108 Cols</span>
              {schemaValid === true && <CheckCircle2 className="w-3.5 h-3.5 text-[#248A3D]" />}
            </button>

            {/* User Session Pill */}
            {session ? (
              <div className="flex items-center space-x-2 bg-[#F5F5F7] pl-3 pr-1.5 py-1 rounded-full border border-[#D2D2D7]">
                <span className="text-xs font-semibold text-[#1D1D1F] max-w-[100px] sm:max-w-[130px] truncate">
                  {session.name}
                </span>
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-[#0071E3]/10 text-[#0071E3]">
                  {session.role}
                </span>
                <button
                  onClick={onLogout}
                  title="Log out"
                  className="p-1 rounded-full hover:bg-[#D2D2D7]/60 text-[#6E6E73] hover:text-[#D70015] transition cursor-pointer"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <span className="text-xs font-medium text-[#6E6E73] hidden sm:inline px-2 py-1">
                Guest Mode
              </span>
            )}

            {/* Mobile Menu Hamburger Toggle */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              aria-label="Toggle navigation"
              className="lg:hidden p-2 rounded-xl text-[#1D1D1F] hover:bg-[#F5F5F7] border border-[#D2D2D7] transition cursor-pointer"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Navigation Dropdown Menu (Apple Sheet Style) */}
        {mobileMenuOpen && (
          <div className="lg:hidden py-3 border-t border-[#D2D2D7]/60 space-y-1 bg-white/95 backdrop-blur-md rounded-2xl p-2 mb-3 shadow-lg border">
            <span className="text-[10px] uppercase font-bold tracking-wider text-[#6E6E73] px-3 pt-1 block">
              Switch Website View:
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
                      ? 'bg-[#0071E3] text-white shadow-xs'
                      : 'text-[#1D1D1F] hover:bg-[#F5F5F7]'
                  }`}
                >
                  <Icon className={`w-4 h-4 ${isActive ? 'text-white' : 'text-[#6E6E73]'}`} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </header>
  );
};

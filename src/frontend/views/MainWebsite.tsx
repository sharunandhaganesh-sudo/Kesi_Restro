/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * 1. Main Website (Public) — Treat & Taste Family Restaurant
 * Warm family hospitality aesthetic with official logo, dark chocolate brown headings,
 * warm orange action buttons, golden yellow highlights, and cream/ivory surfaces.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { DishImage } from '../components/DishImage';
import { BrandLogo } from '../components/BrandLogo';
import { RequestDispatcher } from '../../backend/dispatcher';
import { BRAND_CONFIG } from '../../config/branding';
import { MenuItem } from '../types';
import {
  CalendarDays,
  Clock,
  MapPin,
  Phone,
  QrCode,
  ShieldCheck,
  Sparkles,
  Utensils,
  ChevronRight,
  Armchair,
} from 'lucide-react';

interface MainWebsiteProps {
  onNavigateToCustomer: (mode: 'online' | 'walkin') => void;
}

export const MainWebsite: React.FC<MainWebsiteProps> = ({ onNavigateToCustomer }) => {
  const [restaurantInfo, setRestaurantInfo] = useState<any>(null);
  const [menuItems, setMenuItems] = useState<MenuItem[]>([]);
  const [activeCategory, setActiveCategory] = useState<string>('All');
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    async function loadPublicData() {
      setLoading(true);
      const infoRes = await RequestDispatcher.dispatch({ action: 'getPublicRestaurantInfo' });
      const menuRes = await RequestDispatcher.dispatch({ action: 'getPublicMenu' });

      if (infoRes.success) setRestaurantInfo(infoRes.data);
      if (menuRes.success) setMenuItems(menuRes.data.menu || []);
      setLoading(false);
    }

    loadPublicData();
  }, []);

  const categories = ['All', 'Starters', 'Mains', 'Desserts', 'Beverages'];
  const filteredMenu: MenuItem[] =
    activeCategory === 'All'
      ? menuItems.slice(0, 6)
      : menuItems.filter((i: MenuItem) => i.Category === activeCategory).slice(0, 6);

  return (
    <div className="min-h-screen bg-[#FFF9F0] text-[#2D1609]">
      {/* Warm Family Restaurant Hero Section */}
      <section className="relative overflow-hidden py-14 sm:py-20 px-4 sm:px-6 lg:px-8 border-b border-[#E6D5C3] bg-gradient-to-b from-white via-[#FFF9F0] to-[#FDF4E7]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Text Block */}
          <div className="lg:col-span-7 space-y-6">
            <div className="flex items-center space-x-3">
              <BrandLogo size="lg" />
            </div>

            <div className="inline-flex items-center space-x-2 px-3.5 py-1 rounded-full bg-[#F4B41A]/20 border border-[#F4B41A]/50 text-[#3B1A08] text-xs font-bold tracking-wide">
              <Sparkles className="w-3.5 h-3.5 text-[#F56A00]" />
              <span>Family Dine-In Experience &amp; Live Kitchen Sync</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#3B1A08] leading-[1.08]">
              Warm Family Dining. <br />
              <span className="text-[#F56A00]">Fresh From Kitchen To Table.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#735847] leading-relaxed max-w-xl">
              Welcome to <strong className="text-[#3B1A08]">{BRAND_CONFIG.name}</strong> ({BRAND_CONFIG.subtitle}).
              Reserve your family table ahead with our 10-minute grace window, scan your table QR to
              order directly to the kitchen, or join our capacity-fit walk-in queue.
            </p>

            {/* Primary Warm Orange & Secondary Dark Brown CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => onNavigateToCustomer('online')}
                className="flex items-center justify-center space-x-2 px-7 py-3.5 rounded-full bg-[#F56A00] hover:bg-[#DC5B00] text-white font-semibold text-sm shadow-sm transition-all duration-200 transform active:scale-98 cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Book a Table (Online)</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigateToCustomer('walkin')}
                className="flex items-center justify-center space-x-2 px-6 py-3.5 rounded-full bg-white hover:bg-[#FDF4E7] border-2 border-[#3B1A08] text-[#3B1A08] font-semibold text-sm shadow-xs transition-all duration-200 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-[#F56A00]" />
                <span>Join Walk-In Queue / QR Dine-In</span>
              </button>
            </div>

            {/* Live Operational Metrics Widgets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6 border-t border-[#E6D5C3]">
              <div className="p-3.5 rounded-2xl bg-white border border-[#E6D5C3] shadow-xs">
                <div className="flex items-center space-x-2 mb-1">
                  <Armchair className="w-4 h-4 text-[#F56A00]" />
                  <span className="text-[11px] font-medium text-[#735847]">Available Tables</span>
                </div>
                <div className="text-2xl font-bold text-[#3B1A08]">
                  {restaurantInfo?.availableTablesCount ?? '10'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#E6D5C3] shadow-xs">
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="w-4 h-4 text-[#F4B41A]" />
                  <span className="text-[11px] font-medium text-[#735847]">Arrival Grace</span>
                </div>
                <div className="text-2xl font-bold text-[#3B1A08]">10 Mins</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#E6D5C3] shadow-xs col-span-2 sm:col-span-1">
                <div className="flex items-center space-x-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#248A3D]" />
                  <span className="text-[11px] font-medium text-[#735847]">Dining Format</span>
                </div>
                <div className="text-2xl font-bold text-[#3B1A08]">100% Dine-In</div>
              </div>
            </div>
          </div>

          {/* Right Floating Hero Presentation Card */}
          <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="lg:col-span-5"
          >
            <div className="relative rounded-3xl overflow-hidden shadow-xl border border-[#E6D5C3] bg-white group">
              <div className="w-full h-72 sm:h-80 overflow-hidden bg-[#FDF4E7]">
                <DishImage
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
                  alt="Treat & Taste Family Dining Room"
                  category="Fine Dining"
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                />
              </div>

              <div className="p-6 bg-white text-[#2D1609] space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="font-extrabold text-lg text-[#3B1A08]">
                      {BRAND_CONFIG.name}
                    </h3>
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#F56A00]">
                      {BRAND_CONFIG.subtitle}
                    </span>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#248A3D]/10 text-[#248A3D] border border-[#248A3D]/20">
                    Open Now
                  </span>
                </div>

                <p className="text-xs text-[#735847] flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#F56A00] flex-shrink-0" />
                  <span>{restaurantInfo?.address || BRAND_CONFIG.address}</span>
                </p>

                <div className="flex items-center justify-between text-xs text-[#735847] pt-3 border-t border-[#E6D5C3]">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-[#F4B41A]" />
                    <span>{restaurantInfo?.openingHours || '11:00 AM - 11:00 PM'}</span>
                  </span>
                  <span className="flex items-center space-x-1 font-semibold text-[#3B1A08]">
                    <Phone className="w-3.5 h-3.5 text-[#F56A00]" />
                    <span>{restaurantInfo?.phone || BRAND_CONFIG.phone}</span>
                  </span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* Menu Highlights Showcase */}
      <section className="max-w-6xl mx-auto py-16 sm:py-20 px-4 sm:px-6 lg:px-8">
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="text-center space-y-3 max-w-2xl mx-auto mb-10"
        >
          <div className="inline-flex items-center space-x-1.5 text-xs font-bold uppercase tracking-wider text-[#F56A00]">
            <Utensils className="w-3.5 h-3.5" />
            <span>Chef&apos;s Family Specials</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#3B1A08] tracking-tight">
            Signature Menu Highlights
          </h2>

          <p className="text-sm text-[#735847]">
            Every dish is freshly prepared in our kitchen the moment you place your order.
            Enjoy authentic recipes crafted for families and friends.
          </p>

          {/* Segmented Category Filter */}
          <div className="inline-flex flex-wrap items-center justify-center p-1 rounded-full bg-[#FDF4E7] border border-[#E6D5C3] mt-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-[#3B1A08] text-[#FFF9F0] shadow-xs font-semibold'
                    : 'text-[#735847] hover:text-[#3B1A08] font-medium'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Dishes Grid */}
        {loading ? (
          <div className="text-center py-16 text-[#735847] font-medium text-sm">
            Loading Treat &amp; Taste menu items...
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredMenu.map((item: MenuItem, index: number) => (
              <motion.div
                key={item.Food_ID}
                initial={{ opacity: 0, y: 15 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.35, delay: index * 0.05 }}
                whileHover={{ y: -4, transition: { duration: 0.2 } }}
                className="bg-white rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 border border-[#E6D5C3] flex flex-col group"
              >
                <div className="relative h-48 overflow-hidden bg-[#FDF4E7]">
                  <DishImage
                    src={item.Image_URL}
                    alt={item.Food_Name}
                    category={item.Category}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-[#3B1A08]/90 text-[#F4B41A] shadow-xs">
                    ₹{item.Price}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#F56A00] mb-1">
                      {item.Category}
                    </div>
                    <h3 className="text-base font-bold text-[#3B1A08] leading-snug group-hover:text-[#F56A00] transition-colors">
                      {item.Food_Name}
                    </h3>
                    <p className="text-xs text-[#735847] line-clamp-2 mt-1">
                      {item.Description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#E6D5C3] text-xs">
                    <span className="text-[#735847] flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-[#F4B41A]" />
                      <span>{item.Prep_Time_Minutes} mins prep</span>
                    </span>
                    <button
                      onClick={() => onNavigateToCustomer('online')}
                      className="text-[#F56A00] font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Order Now</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Bottom Booking Banner */}
        <div className="mt-16 bg-gradient-to-r from-[#3B1A08] to-[#56290F] rounded-3xl p-8 text-[#FFF9F0] shadow-md flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-white">
              Planning a family meal at {BRAND_CONFIG.name}?
            </h3>
            <p className="text-xs sm:text-sm text-[#F5DFC8]">
              Online table reservations hold your table safely for 105 minutes with instant arrival alerts.
            </p>
          </div>
          <button
            onClick={() => onNavigateToCustomer('online')}
            className="flex-shrink-0 px-7 py-3 rounded-full bg-[#F56A00] hover:bg-[#DC5B00] text-white font-semibold text-xs shadow-xs transition cursor-pointer"
          >
            Book Table Online
          </button>
        </div>
      </section>
    </div>
  );
};

/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * 1. Main Website (Public) - Apple-Inspired Premium Presentation
 * Features clean typography, subtle borders, high-contrast imagery,
 * live table capacity metrics, and direct booking / queue actions.
 */

import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { DishImage } from '../components/DishImage';
import { RequestDispatcher } from '../../backend/dispatcher';
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
    <div className="min-h-screen bg-[#F5F5F7] text-[#1D1D1F]">
      {/* Apple-Inspired Hero Section */}
      <section className="relative overflow-hidden py-16 sm:py-24 px-4 sm:px-6 lg:px-8 border-b border-[#D2D2D7]/60 bg-gradient-to-b from-white via-[#FBFBFD] to-[#F5F5F7]">
        <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-12 items-center">
          {/* Left Text Block */}
          <div className="lg:col-span-7 space-y-6">
            <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-[#0071E3]/10 border border-[#0071E3]/20 text-[#0071E3] text-xs font-semibold tracking-wide">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Smart Dine-In Experience</span>
            </div>

            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-[#1D1D1F] leading-[1.08]">
              Culinary Artistry. <br />
              <span className="text-[#0071E3]">Zero Waiting Confusion.</span>
            </h1>

            <p className="text-base sm:text-lg text-[#6E6E73] leading-relaxed max-w-xl">
              Experience gourmet dining crafted with passion. Reserve ahead with our
              guaranteed 10-minute grace window, or join our live capacity-fit queue
              instantly from your device.
            </p>

            {/* Apple-style CTAs */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3 pt-2">
              <button
                onClick={() => onNavigateToCustomer('online')}
                className="flex items-center justify-center space-x-2 px-7 py-3.5 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-sm shadow-sm transition-all duration-200 transform active:scale-98 cursor-pointer"
              >
                <CalendarDays className="w-4 h-4" />
                <span>Book a Table (Online)</span>
                <ChevronRight className="w-4 h-4" />
              </button>

              <button
                onClick={() => onNavigateToCustomer('walkin')}
                className="flex items-center justify-center space-x-2 px-6 py-3.5 rounded-full bg-white hover:bg-[#F5F5F7] border border-[#D2D2D7] text-[#1D1D1F] font-semibold text-sm shadow-xs transition-all duration-200 cursor-pointer"
              >
                <QrCode className="w-4 h-4 text-[#0071E3]" />
                <span>Join Walk-In Queue</span>
              </button>
            </div>

            {/* Live Operational Metrics Widgets */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 pt-6 border-t border-[#D2D2D7]/60">
              <div className="p-3.5 rounded-2xl bg-white border border-[#D2D2D7]/70 shadow-xs">
                <div className="flex items-center space-x-2 mb-1">
                  <Armchair className="w-4 h-4 text-[#0071E3]" />
                  <span className="text-[11px] font-medium text-[#6E6E73]">Available Tables</span>
                </div>
                <div className="text-2xl font-bold text-[#1D1D1F]">
                  {restaurantInfo?.availableTablesCount ?? '10'}
                </div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#D2D2D7]/70 shadow-xs">
                <div className="flex items-center space-x-2 mb-1">
                  <Clock className="w-4 h-4 text-[#B76E00]" />
                  <span className="text-[11px] font-medium text-[#6E6E73]">Arrival Grace</span>
                </div>
                <div className="text-2xl font-bold text-[#1D1D1F]">10 Mins</div>
              </div>

              <div className="p-3.5 rounded-2xl bg-white border border-[#D2D2D7]/70 shadow-xs col-span-2 sm:col-span-1">
                <div className="flex items-center space-x-2 mb-1">
                  <ShieldCheck className="w-4 h-4 text-[#248A3D]" />
                  <span className="text-[11px] font-medium text-[#6E6E73]">Dining Format</span>
                </div>
                <div className="text-2xl font-bold text-[#1D1D1F]">100% Dine-In</div>
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
            <div className="relative rounded-3xl overflow-hidden shadow-xl border border-[#D2D2D7] bg-white group">
              <div className="w-full h-80 overflow-hidden bg-[#F5F5F7]">
                <DishImage
                  src="https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?auto=format&fit=crop&w=800&q=80"
                  alt="Savor Luxury Dining Room"
                  category="Fine Dining"
                  className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                />
              </div>

              <div className="p-6 bg-white text-[#1D1D1F] space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-lg text-[#1D1D1F]">
                    {restaurantInfo?.name || 'Savor Dine-In Restaurant'}
                  </h3>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-[#248A3D]/10 text-[#248A3D] border border-[#248A3D]/20">
                    Open Now
                  </span>
                </div>

                <p className="text-xs text-[#6E6E73] flex items-center space-x-1.5">
                  <MapPin className="w-3.5 h-3.5 text-[#0071E3] flex-shrink-0" />
                  <span>{restaurantInfo?.address || '142 Grand Heritage Blvd, Chennai'}</span>
                </p>

                <div className="flex items-center justify-between text-xs text-[#6E6E73] pt-3 border-t border-[#D2D2D7]/60">
                  <span className="flex items-center space-x-1">
                    <Clock className="w-3.5 h-3.5 text-[#6E6E73]" />
                    <span>{restaurantInfo?.openingHours || '11:00 AM - 11:00 PM'}</span>
                  </span>
                  <span className="flex items-center space-x-1 font-medium text-[#1D1D1F]">
                    <Phone className="w-3.5 h-3.5 text-[#0071E3]" />
                    <span>{restaurantInfo?.phone || '+91 98765 43210'}</span>
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
          <div className="inline-flex items-center space-x-1.5 text-xs font-semibold uppercase tracking-wider text-[#0071E3]">
            <Utensils className="w-3.5 h-3.5" />
            <span>Chef's Curation</span>
          </div>

          <h2 className="text-3xl sm:text-4xl font-extrabold text-[#1D1D1F] tracking-tight">
            Signature Menu Highlights
          </h2>

          <p className="text-sm text-[#6E6E73]">
            Every dish is prepared to order upon staff verification. Discover our seasonal
            selections crafted with artisanal ingredients.
          </p>

          {/* Apple-style Segmented Filter Control */}
          <div className="inline-flex flex-wrap items-center justify-center p-1 rounded-full bg-[#E5E5EA]/70 border border-[#D2D2D7]/60 mt-4">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={`px-4 py-1.5 rounded-full text-xs transition-all duration-200 cursor-pointer ${
                  activeCategory === cat
                    ? 'bg-white text-[#1D1D1F] shadow-xs font-semibold'
                    : 'text-[#6E6E73] hover:text-[#1D1D1F] font-medium'
                }`}
              >
                {cat}
              </button>
            ))}
          </div>
        </motion.div>

        {/* Dishes Grid */}
        {loading ? (
          <div className="text-center py-16 text-[#6E6E73] font-medium text-sm">
            Loading seasonal menu items...
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
                className="bg-white rounded-3xl overflow-hidden shadow-xs hover:shadow-lg transition-all duration-200 border border-[#D2D2D7] flex flex-col group"
              >
                <div className="relative h-48 overflow-hidden bg-[#F5F5F7]">
                  <DishImage
                    src={item.Image_URL}
                    alt={item.Food_Name}
                    category={item.Category}
                    className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                  />
                  <span className="absolute top-3 right-3 px-2.5 py-1 rounded-full text-xs font-bold bg-white/90 backdrop-blur-md text-[#1D1D1F] shadow-xs border border-[#D2D2D7]/60">
                    ₹{item.Price}
                  </span>
                </div>

                <div className="p-5 flex-1 flex flex-col justify-between space-y-3">
                  <div>
                    <div className="text-[10px] font-bold uppercase tracking-wider text-[#0071E3] mb-1">
                      {item.Category}
                    </div>
                    <h3 className="text-base font-bold text-[#1D1D1F] leading-snug group-hover:text-[#0071E3] transition-colors">
                      {item.Food_Name}
                    </h3>
                    <p className="text-xs text-[#6E6E73] line-clamp-2 mt-1">
                      {item.Description}
                    </p>
                  </div>

                  <div className="flex items-center justify-between pt-3 border-t border-[#D2D2D7]/60 text-xs">
                    <span className="text-[#6E6E73] flex items-center space-x-1">
                      <Clock className="w-3.5 h-3.5 text-[#6E6E73]" />
                      <span>{item.Prep_Time_Minutes} mins prep</span>
                    </span>
                    <button
                      onClick={() => onNavigateToCustomer('online')}
                      className="text-[#0071E3] font-semibold hover:underline flex items-center space-x-1 cursor-pointer"
                    >
                      <span>Order in Visit</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Apple-Style Bottom Booking Banner */}
        <div className="mt-16 bg-white rounded-3xl p-8 border border-[#D2D2D7] shadow-sm flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="space-y-1 text-center md:text-left">
            <h3 className="text-xl font-bold text-[#1D1D1F]">
              Planning to dine with us today?
            </h3>
            <p className="text-xs sm:text-sm text-[#6E6E73]">
              Online table reservations guarantee your slot with 105-minute blocking protection.
            </p>
          </div>
          <button
            onClick={() => onNavigateToCustomer('online')}
            className="flex-shrink-0 px-7 py-3 rounded-full bg-[#0071E3] hover:bg-[#0077ED] text-white font-semibold text-xs shadow-xs transition cursor-pointer"
          >
            Book Table Online
          </button>
        </div>
      </section>
    </div>
  );
};

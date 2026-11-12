/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 *
 * Central Restaurant Branding & Theme Configuration
 * Single source of truth for Treat & Taste — Family Restaurant across all 5 websites,
 * receipts, QR standees, transactional emails, and print views.
 */

export const BRAND_CONFIG = {
  name: 'Treat & Taste',
  subtitle: 'Family Restaurant',
  fullName: 'Treat & Taste — Family Restaurant',
  tagline: 'Warm Hospitality. Authentic Flavours. Zero Waiting Confusion.',
  logoUrl: '/treat-and-taste-logo.png',
  address: '142 Grand Heritage Boulevard, Chennai',
  phone: '+91 98765 43210',
  wifiSsid: 'TreatAndTaste-Guest',
  wifiPassword: 'Welcome@TreatAndTaste',
  qrTokenPrefix: 'T&T',
  colors: {
    primaryBrown: '#3B1A08',
    deepBrown: '#2A1104',
    warmOrange: '#F56A00',
    warmOrangeHover: '#DC5B00',
    goldenYellow: '#F4B41A',
    creamBg: '#FFF9F0',
    ivorySurface: '#FDF4E7',
    white: '#FFFFFF',
    borderWarm: '#E6D5C3',
    textPrimary: '#2D1609',
    textMuted: '#735847',
    success: '#248A3D',
    error: '#D70015',
  },
} as const;

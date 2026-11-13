/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type WebsiteTab = 'main' | 'customer' | 'staff' | 'kitchen' | 'admin';

export interface UserSessionState {
  sessionId: string;
  userId?: string;
  customerId?: string;
  name: string;
  customerName?: string;
  email: string;
  mobile?: string;
  mobileNumber?: string;
  role: 'Customer' | 'Staff' | 'Kitchen' | 'Admin';
  user?: {
    userId?: string;
    userName?: string;
    email?: string;
    mobileNumber?: string;
    role?: string;
  };
}

export interface MenuItem {
  Food_ID: string;
  Food_Name: string;
  Category: string;
  Description: string;
  Price: number;
  Image_URL: string;
  Availability: string;
  Prep_Time_Minutes: number;
  Is_Active: string;
}

export interface CartItem {
  food: MenuItem;
  quantity: number;
}

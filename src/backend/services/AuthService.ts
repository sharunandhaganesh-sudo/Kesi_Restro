/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AuthService: Customer OTP authentication and Staff/Admin/Kitchen PBKDF2 authentication
 */

import { db } from '../mockDb';
import { EmailService } from './EmailService';
import {
  generateRandomOTP,
  hashOTP,
  verifyOTPHash,
  verifyPassword,
  generateSessionToken,
  generateSalt,
  hashPassword,
} from '../crypto';

export interface CustomerSession {
  sessionId: string;
  customerId: string;
  customerName: string;
  mobileNumber: string;
  email: string;
  role: 'Customer';
}

export interface UserSession {
  sessionId: string;
  userId: string;
  userName: string;
  email: string;
  role: 'Admin' | 'Staff' | 'Kitchen';
}

export interface OTPRequestResult {
  success: boolean;
  message: string;
  customerId?: string;
  isNewCustomer?: boolean;
  cooldownRemainingSeconds?: number;
  // For developer/demo test visibility in local mock:
  simulatedDeliveryEmail?: string;
  simulatedPlainOTP?: string;
}

export class AuthService {
  /**
   * Request OTP for a customer by mobile number
   */
  public static async requestCustomerOTP(params: {
    mobileNumber: string;
    customerName?: string;
    email?: string;
  }): Promise<OTPRequestResult> {
    const mobile = params.mobileNumber.trim();
    if (!mobile || !/^\d{10}$/.test(mobile)) {
      return { success: false, message: 'Please enter a valid 10-digit mobile number' };
    }

    let customer = db.findOne('Customers', (c) => c.Mobile_Number === mobile);
    let isNewCustomer = false;

    if (!customer) {
      // New customer must supply name and valid email
      if (!params.customerName || !params.email) {
        return {
          success: false,
          isNewCustomer: true,
          message: 'New customer profile details (name and email) are required.',
        };
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(params.email.trim())) {
        return { success: false, message: 'Please enter a valid email address.' };
      }

      isNewCustomer = true;
      const customerId = `CUST-${Date.now().toString().slice(-6)}`;
      customer = db.insertRow('Customers', {
        Customer_ID: customerId,
        Customer_Name: params.customerName.trim(),
        Mobile_Number: mobile,
        Email: params.email.trim().toLowerCase(),
        Created_At: new Date().toISOString(),
        OTP_Hash: '',
        OTP_Expiry: '',
        OTP_Attempts: 0,
        OTP_Last_Sent_At: '',
        OTP_Session_ID: '',
      });
    }

    // Check 60-second cooldown rule
    const now = Date.now();
    if (customer.OTP_Last_Sent_At) {
      const lastSentTime = new Date(customer.OTP_Last_Sent_At).getTime();
      const elapsedSeconds = Math.floor((now - lastSentTime) / 1000);
      if (elapsedSeconds < 60) {
        return {
          success: false,
          message: `Please wait ${60 - elapsedSeconds}s before requesting a new OTP.`,
          cooldownRemainingSeconds: 60 - elapsedSeconds,
        };
      }
    }

    // Default local fallback OTP & HMAC-SHA256 hash (used in offline testing)
    let rawOtp = generateRandomOTP();
    let otpHash = hashOTP(rawOtp);
    let expiryTime = new Date(now + 5 * 60 * 1000).toISOString(); // 5 minutes

    // Attempt live dispatch to Google Apps Script MailApp
    const gasResult = await EmailService.dispatchLiveGasOtp({
      recipientEmail: customer.Email,
      customerName: customer.Customer_Name,
      mobileNumber: mobile,
    });

    if (gasResult && gasResult.success && gasResult.otpHash) {
      otpHash = gasResult.otpHash;
      if (gasResult.otpExpiry) {
        expiryTime = gasResult.otpExpiry;
      }
    }

    // Update customer record with active OTP hash
    db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
      OTP_Hash: otpHash,
      OTP_Expiry: expiryTime,
      OTP_Attempts: 0, // Reset attempts on fresh OTP
      OTP_Last_Sent_At: new Date(now).toISOString(),
    });

    return {
      success: true,
      message: `A 6-digit verification code has been sent to your email (${customer.Email}). Please check your inbox.`,
      customerId: customer.Customer_ID,
      isNewCustomer,
    };
  }

  /**
   * Verify Customer OTP and issue session
   */
  public static verifyCustomerOTP(params: {
    mobileNumber: string;
    otp: string;
  }): { success: boolean; message: string; session?: CustomerSession } {
    const mobile = params.mobileNumber.trim();
    const otp = params.otp.trim();

    if (!mobile || !otp) {
      return { success: false, message: 'Mobile number and OTP are required.' };
    }

    const customer = db.findOne('Customers', (c) => c.Mobile_Number === mobile);
    if (!customer) {
      return { success: false, message: 'Customer record not found. Please request an OTP first.' };
    }

    const now = Date.now();
    const attempts = Number(customer.OTP_Attempts || 0);

    // Check maximum 3 failed attempts rule
    if (attempts >= 3) {
      return {
        success: false,
        message: 'Maximum verification attempts exceeded. Please request a new OTP.',
      };
    }

    // Check 5-minute expiry
    if (!customer.OTP_Expiry || new Date(customer.OTP_Expiry).getTime() < now) {
      return {
        success: false,
        message: 'Verification code has expired. Please request a new OTP.',
      };
    }

    // Verify HMAC-SHA256 hash
    const isValid = verifyOTPHash(otp, customer.OTP_Hash);
    if (!isValid) {
      const updatedAttempts = attempts + 1;
      db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
        OTP_Attempts: updatedAttempts,
      });

      const remaining = 3 - updatedAttempts;
      return {
        success: false,
        message: remaining > 0
          ? `Invalid verification code. ${remaining} attempt(s) remaining.`
          : 'Maximum verification attempts exceeded. Please request a new OTP.',
      };
    }

    // Generate new customer session
    const sessionId = generateSessionToken('cust');
    db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
      OTP_Hash: '', // Invalidate used OTP
      OTP_Expiry: '',
      OTP_Attempts: 0,
      OTP_Session_ID: sessionId,
    });

    const session: CustomerSession = {
      sessionId,
      customerId: customer.Customer_ID,
      customerName: customer.Customer_Name,
      mobileNumber: customer.Mobile_Number,
      email: customer.Email,
      role: 'Customer',
    };

    return {
      success: true,
      message: 'Authentication successful.',
      session,
    };
  }

  /**
   * Helper for approved testing of the 3 demo customer profiles (Section 18.1)
   */
  public static demoQuickLoginCustomer(mobileNumber: string): {
    success: boolean;
    message: string;
    session?: CustomerSession;
  } {
    const customer = db.findOne('Customers', (c) => c.Mobile_Number === mobileNumber);
    if (!customer) {
      return { success: false, message: 'Demo customer not found.' };
    }

    const sessionId = generateSessionToken('cust');
    db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
      OTP_Session_ID: sessionId,
    });

    const session: CustomerSession = {
      sessionId,
      customerId: customer.Customer_ID,
      customerName: customer.Customer_Name,
      mobileNumber: customer.Mobile_Number,
      email: customer.Email,
      role: 'Customer',
    };

    return {
      success: true,
      message: `Logged in as demo guest ${customer.Customer_Name}`,
      session,
    };
  }

  /**
   * Staff/Admin/Kitchen login with email/username and password
   */
  public static loginEmployee(params: {
    identifier: string; // Email or User_Name
    password: string;
  }): { success: boolean; message: string; session?: UserSession } {
    const ident = params.identifier.trim().toLowerCase();
    const password = params.password;

    if (!ident || !password) {
      return { success: false, message: 'Username/email and password are required.' };
    }

    const user = db.findOne(
      'Users',
      (u) =>
        u.User_Name.toLowerCase() === ident ||
        u.Email.toLowerCase() === ident
    );

    if (!user) {
      return { success: false, message: 'Invalid credentials.' };
    }

    // Account_Status rule: Disabled accounts cannot log in
    if (user.Account_Status !== 'Active') {
      return { success: false, message: 'Account is disabled. Contact system administrator.' };
    }

    // Verify PBKDF2 hash using user's unique salt
    const isPasswordValid = verifyPassword(password, user.Password_Hash, user.Salt);
    if (!isPasswordValid) {
      return { success: false, message: 'Invalid credentials.' };
    }

    // Create session token
    const sessionId = generateSessionToken('emp');
    let sessions: string[] = [];
    try {
      sessions = JSON.parse(user.Active_Sessions_JSON || '[]');
    } catch {
      sessions = [];
    }
    sessions.push(sessionId);

    db.updateRow('Users', 'User_ID', user.User_ID, {
      Active_Sessions_JSON: JSON.stringify(sessions),
    });

    const session = {
      sessionId,
      userId: user.User_ID,
      userName: user.User_Name,
      name: user.User_Name,
      email: user.Email,
      role: user.Role as 'Admin' | 'Staff' | 'Kitchen',
    };

    return {
      success: true,
      message: `Welcome back, ${user.User_Name}!`,
      session,
    };
  }

  /**
   * Validates a session token
   */
  public static validateSession(sessionId: string): {
    isValid: boolean;
    customer?: CustomerSession;
    user?: UserSession;
  } {
    if (!sessionId) return { isValid: false };

    // Check Customers
    const customer = db.findOne('Customers', (c) => c.OTP_Session_ID === sessionId);
    if (customer) {
      return {
        isValid: true,
        customer: {
          sessionId,
          customerId: customer.Customer_ID,
          customerName: customer.Customer_Name,
          mobileNumber: customer.Mobile_Number,
          email: customer.Email,
          role: 'Customer',
        },
      };
    }

    // Check Users
    const user = db.findOne('Users', (u) => {
      try {
        const list = JSON.parse(u.Active_Sessions_JSON || '[]');
        return Array.isArray(list) && list.includes(sessionId);
      } catch {
        return false;
      }
    });

    if (user && user.Account_Status === 'Active') {
      return {
        isValid: true,
        user: {
          sessionId,
          userId: user.User_ID,
          userName: user.User_Name,
          email: user.Email,
          role: user.Role as 'Admin' | 'Staff' | 'Kitchen',
        },
      };
    }

    return { isValid: false };
  }

  /**
   * Logs out and invalidates a session token
   */
  public static logout(sessionId: string): boolean {
    if (!sessionId) return false;

    // Check Customer
    const customer = db.findOne('Customers', (c) => c.OTP_Session_ID === sessionId);
    if (customer) {
      db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
        OTP_Session_ID: '',
      });
      return true;
    }

    // Check Users
    const user = db.findOne('Users', (u) => {
      try {
        const list = JSON.parse(u.Active_Sessions_JSON || '[]');
        return Array.isArray(list) && list.includes(sessionId);
      } catch {
        return false;
      }
    });

    if (user) {
      try {
        const list = JSON.parse(user.Active_Sessions_JSON || '[]');
        const updated = list.filter((s: string) => s !== sessionId);
        db.updateRow('Users', 'User_ID', user.User_ID, {
          Active_Sessions_JSON: JSON.stringify(updated),
        });
        return true;
      } catch {
        return false;
      }
    }

    return false;
  }
}

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
  hashSessionToken,
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

    // Returning guest lookup in Google Sheets if not cached in this browser's mockDb yet
    if (!customer && (!params.customerName || !params.email) && typeof window !== 'undefined') {
      const lookupGas = await EmailService.dispatchLiveGasOtp({
        mobileNumber: mobile,
      });

      if (lookupGas.cooldown) {
        return {
          success: false,
          message: lookupGas.message || 'Please wait before requesting a new OTP.',
          cooldownRemainingSeconds: lookupGas.cooldownRemainingSeconds,
        };
      }

      if (lookupGas.success && lookupGas.otpHash && lookupGas.email) {
        const custId = lookupGas.customerId || `CUST-${Date.now().toString().slice(-6)}`;
        db.insertRow('Customers', {
          Customer_ID: custId,
          Customer_Name: lookupGas.customerName || 'Valued Guest',
          Mobile_Number: mobile,
          Email: lookupGas.email,
          Created_At: new Date().toISOString(),
          OTP_Hash: lookupGas.otpHash,
          OTP_Expiry: lookupGas.otpExpiry || new Date(Date.now() + 5 * 60 * 1000).toISOString(),
          OTP_Attempts: 0,
          OTP_Last_Sent_At: new Date().toISOString(),
          OTP_Session_ID: '',
        });
        return {
          success: true,
          message: `A 6-digit verification code has been sent to your email (${lookupGas.email}). Please check your inbox.`,
          customerId: custId,
          isNewCustomer: false,
        };
      }
    }

    if (!customer) {
      // New customer must supply name and valid email
      if (!params.customerName || !params.email) {
        return {
          success: false,
          isNewCustomer: true,
          message: 'New customer profile details (name and email) are required.',
        };
      }
      const cleanEmail = params.email.trim().toLowerCase();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cleanEmail)) {
        return { success: false, message: 'Please enter a valid email address.' };
      }

      const duplicateEmail = db.findOne(
        'Customers',
        (c) => String(c.Email || '').trim().toLowerCase() === cleanEmail
      );
      if (duplicateEmail) {
        return {
          success: false,
          message: 'An account with this email address already exists. Please sign in using your registered mobile number.',
        };
      }

      isNewCustomer = true;
      const customerId = `CUST-${Date.now().toString().slice(-6)}`;
      customer = db.insertRow('Customers', {
        Customer_ID: customerId,
        Customer_Name: params.customerName.trim(),
        Mobile_Number: mobile,
        Email: cleanEmail,
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

    if (gasResult.cooldown) {
      return {
        success: false,
        message: gasResult.message || 'Please wait before requesting a new OTP.',
        cooldownRemainingSeconds: gasResult.cooldownRemainingSeconds,
      };
    }

    if (typeof window !== 'undefined') {
      if (gasResult.stubDetected || (!gasResult.success && gasResult.message)) {
        return {
          success: false,
          message: gasResult.message || 'Unable to send OTP email via Google Apps Script.',
        };
      }
    }

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
   * Returns configured customer trusted session duration in ms (default 24h)
   */
  public static getCustomerSessionDurationMs(): number {
    const setting = db.findOne('Restaurant_Settings', (s) => s.Setting_Key === 'CUSTOMER_SESSION_HOURS');
    const hours = Number(setting?.Setting_Value || 24);
    return Math.max(1, hours) * 60 * 60 * 1000;
  }

  private static encodeSessionValue(token: string, durationMs: number): string {
    const tokenHash = hashSessionToken(token);
    return `${tokenHash}|${Date.now() + durationMs}`;
  }

  private static parseCustomerSessionValue(stored: string): { tokenHash: string; expiresAt: number | null } {
    const raw = String(stored || '').trim();
    if (!raw) return { tokenHash: '', expiresAt: null };
    const [tokenHash, expStr] = raw.split('|');
    const exp = expStr ? Number(expStr) : null;
    return { tokenHash, expiresAt: exp && Number.isFinite(exp) ? exp : null };
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

    // Generate new trusted customer session with expiry
    const sessionId = generateSessionToken('cust');
    const encodedSession = this.encodeSessionValue(sessionId, this.getCustomerSessionDurationMs());
    db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
      OTP_Hash: '', // Invalidate used OTP
      OTP_Expiry: '',
      OTP_Attempts: 0,
      OTP_Session_ID: encodedSession,
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
   * Synchronizes a verified GAS customer OTP session into local mockDb so protected actions validate cleanly.
   */
  public static syncCustomerSessionFromGas(params: {
    sessionId: string;
    customerId: string;
    customerName: string;
    mobileNumber: string;
    email: string;
  }): CustomerSession {
    const mobile = params.mobileNumber.trim();
    const existing = db.findOne('Customers', (c) => c.Mobile_Number === mobile || c.Customer_ID === params.customerId);
    const encodedSession = this.encodeSessionValue(params.sessionId, this.getCustomerSessionDurationMs());
    if (existing) {
      db.updateRow('Customers', 'Customer_ID', existing.Customer_ID, {
        Customer_Name: params.customerName || existing.Customer_Name,
        Email: params.email || existing.Email,
        OTP_Hash: '',
        OTP_Expiry: '',
        OTP_Attempts: 0,
        OTP_Session_ID: encodedSession,
      });
    } else {
      db.insertRow('Customers', {
        Customer_ID: params.customerId,
        Customer_Name: params.customerName || 'Guest',
        Mobile_Number: mobile,
        Email: params.email || '',
        Created_At: new Date().toISOString(),
        OTP_Hash: '',
        OTP_Expiry: '',
        OTP_Attempts: 0,
        OTP_Last_Sent_At: '',
        OTP_Session_ID: encodedSession,
      });
    }
    return {
      sessionId: params.sessionId,
      customerId: existing?.Customer_ID || params.customerId,
      customerName: params.customerName || existing?.Customer_Name || 'Guest',
      mobileNumber: mobile || existing?.Mobile_Number || '',
      email: params.email || existing?.Email || '',
      role: 'Customer',
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
    let customer = db.findOne('Customers', (c) => c.Mobile_Number === mobileNumber);
    if (!customer) {
      const custId = `CUST-${Date.now().toString().slice(-6)}`;
      customer = {
        Customer_ID: custId,
        Customer_Name: `Guest ${mobileNumber.slice(-4)}`,
        Mobile_Number: mobileNumber,
        Email: `guest_${mobileNumber}@treattaste.com`,
        Created_At: new Date().toISOString(),
      };
      db.insertRow('Customers', customer);
    }

    const sessionId = generateSessionToken('cust');
    db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
      OTP_Session_ID: this.encodeSessionValue(sessionId, this.getCustomerSessionDurationMs()),
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
   * Updates Customer profile (Name & Email) with uniqueness validation
   */
  public static updateCustomerProfile(params: {
    customerId: string;
    customerName: string;
    email: string;
  }): { success: boolean; message: string; session?: Partial<CustomerSession> } {
    const name = String(params.customerName || '').trim();
    const email = String(params.email || '').trim().toLowerCase();

    if (!name || name.length < 2) {
      return { success: false, message: 'Customer name must be at least 2 characters.' };
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return { success: false, message: 'Please enter a valid email address.' };
    }

    const customer = db.findOne('Customers', (c) => c.Customer_ID === params.customerId);
    if (!customer) {
      return { success: false, message: 'Customer profile not found.' };
    }

    const duplicate = db.findOne(
      'Customers',
      (c) => c.Customer_ID !== params.customerId && String(c.Email || '').trim().toLowerCase() === email
    );
    if (duplicate) {
      return { success: false, message: 'This email address is already registered to another customer.' };
    }

    db.updateRow('Customers', 'Customer_ID', params.customerId, {
      Customer_Name: name,
      Email: email,
    });

    return {
      success: true,
      message: 'Profile updated successfully.',
      session: {
        customerId: customer.Customer_ID,
        customerName: name,
        mobileNumber: customer.Mobile_Number,
        email,
        role: 'Customer',
      },
    };
  }

  /**
   * Validates a session token and renews sliding expiry for trusted customer sessions
   */
  public static validateSession(sessionId: string): {
    isValid: boolean;
    customer?: CustomerSession;
    user?: UserSession;
  } {
    if (!sessionId) return { isValid: false };
    const targetHash = hashSessionToken(sessionId);

    // Check Customers using hashed token comparison
    const customer = db.findOne('Customers', (c) => {
      const parsed = this.parseCustomerSessionValue(c.OTP_Session_ID);
      return parsed.tokenHash === targetHash || parsed.tokenHash === sessionId;
    });
    if (customer) {
      const parsed = this.parseCustomerSessionValue(customer.OTP_Session_ID);
      if (parsed.expiresAt && Date.now() > parsed.expiresAt) {
        db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
          OTP_Session_ID: '',
        });
        return { isValid: false };
      }

      // Sliding renewal on active trusted device
      db.updateRow('Customers', 'Customer_ID', customer.Customer_ID, {
        OTP_Session_ID: this.encodeSessionValue(sessionId, this.getCustomerSessionDurationMs()),
      });

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
        return Array.isArray(list) && (list.includes(targetHash) || list.includes(sessionId));
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
    const targetHash = hashSessionToken(sessionId);

    // Check Customer
    const customer = db.findOne(
      'Customers',
      (c) => {
        const parsed = this.parseCustomerSessionValue(c.OTP_Session_ID);
        return parsed.tokenHash === targetHash || parsed.tokenHash === sessionId;
      }
    );
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
        return Array.isArray(list) && (list.includes(targetHash) || list.includes(sessionId));
      } catch {
        return false;
      }
    });

    if (user) {
      try {
        const list = JSON.parse(user.Active_Sessions_JSON || '[]');
        const updated = list.filter((s: string) => s !== targetHash && s !== sessionId);
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

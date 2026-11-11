/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * AdminManagementService:
 * Staff/Kitchen user provisioning, initial Admin bootstrap, menu CRUD, table management,
 * and restaurant configuration settings.
 */

import { db, SheetRow } from '../mockDb';
import { generateSalt, hashPassword } from '../crypto';

export class AdminManagementService {
  /**
   * Provisions a new Staff or Kitchen user account.
   * Enforces unique random salt, PBKDF2 hash, and prevents plaintext password storage.
   */
  public static createUser(params: {
    userName: string;
    email: string;
    role: 'Staff' | 'Kitchen' | 'Admin';
    password: string;
    adminUserName: string;
  }): { success: boolean; message: string; userId?: string } {
    const userName = params.userName.trim().toLowerCase();
    const email = params.email.trim().toLowerCase();

    if (!userName || !email || !params.password) {
      return { success: false, message: 'Username, email, and password are required.' };
    }

    if (params.password.length < 8) {
      return { success: false, message: 'Password must be at least 8 characters long.' };
    }

    const existing = db.findOne(
      'Users',
      (u) => u.User_Name.toLowerCase() === userName || u.Email.toLowerCase() === email
    );

    if (existing) {
      return { success: false, message: 'A user with this username or email already exists.' };
    }

    const salt = generateSalt();
    const hash = hashPassword(params.password, salt);
    const userId = `USR-${params.role.toUpperCase()}-${Date.now().toString().slice(-4)}`;

    db.insertRow('Users', {
      User_ID: userId,
      User_Name: userName,
      Email: email,
      Role: params.role,
      Account_Status: 'Active',
      Password_Hash: hash,
      Salt: salt,
      Active_Sessions_JSON: '[]',
    });

    return {
      success: true,
      message: `${params.role} account created successfully for '${userName}'.`,
      userId,
    };
  }

  /**
   * Toggles an employee account status between Active and Disabled.
   */
  public static toggleUserStatus(userId: string): { success: boolean; message: string; newStatus?: string } {
    const user = db.findOne('Users', (u) => u.User_ID === userId);
    if (!user) return { success: false, message: 'User not found.' };

    const newStatus = user.Account_Status === 'Active' ? 'Disabled' : 'Active';

    // If disabled, also invalidate active sessions immediately
    db.updateRow('Users', 'User_ID', userId, {
      Account_Status: newStatus,
      Active_Sessions_JSON: newStatus === 'Disabled' ? '[]' : user.Active_Sessions_JSON,
    });

    return {
      success: true,
      message: `Account status updated to ${newStatus}.`,
      newStatus,
    };
  }

  /**
   * Retrieves all users (without leaking hashes or salts!)
   */
  public static getAllUsers(): Array<Omit<SheetRow, 'Password_Hash' | 'Salt'>> {
    const users = db.getRows('Users');
    return users.map((u) => ({
      User_ID: u.User_ID,
      User_Name: u.User_Name,
      Email: u.Email,
      Role: u.Role,
      Account_Status: u.Account_Status,
      Active_Sessions_JSON: u.Active_Sessions_JSON,
    }));
  }

  /**
   * Adds or updates a menu item
   */
  public static upsertMenuItem(item: {
    foodId?: string;
    foodName: string;
    category: string;
    description: string;
    price: number;
    imageUrl?: string;
    availability: 'Available' | 'Unavailable';
    prepTimeMinutes: number;
    isActive: 'Active' | 'Inactive';
  }): { success: boolean; message: string } {
    if (!item.foodName || !item.category || item.price <= 0) {
      return { success: false, message: 'Name, category, and a valid positive price are required.' };
    }

    if (item.foodId) {
      // Update
      const existing = db.findOne('Menu', (m) => m.Food_ID === item.foodId);
      if (!existing) return { success: false, message: 'Menu item not found.' };

      db.updateRow('Menu', 'Food_ID', item.foodId, {
        Food_Name: item.foodName.trim(),
        Category: item.category.trim(),
        Description: item.description.trim(),
        Price: Number(item.price),
        Image_URL: item.imageUrl || existing.Image_URL,
        Availability: item.availability,
        Prep_Time_Minutes: Number(item.prepTimeMinutes) || 15,
        Is_Active: item.isActive,
      });

      return { success: true, message: 'Menu item updated successfully.' };
    } else {
      // Create new
      const foodId = `FOOD-${Date.now().toString().slice(-4)}`;
      db.insertRow('Menu', {
        Food_ID: foodId,
        Food_Name: item.foodName.trim(),
        Category: item.category.trim(),
        Description: item.description.trim(),
        Price: Number(item.price),
        Image_URL: item.imageUrl || 'https://images.unsplash.com/photo-1546069901-ba9599a7e63c?auto=format&fit=crop&w=400&q=80',
        Availability: item.availability,
        Prep_Time_Minutes: Number(item.prepTimeMinutes) || 15,
        Is_Active: item.isActive,
      });

      return { success: true, message: 'New menu item added to catalog.' };
    }
  }

  /**
   * Adds a new physical dining table
   */
  public static addTable(params: {
    tableNumber: string;
    seatingCapacity: number;
  }): { success: boolean; message: string; tableId?: string } {
    if (!params.tableNumber || params.seatingCapacity < 1) {
      return { success: false, message: 'Table number and valid seating capacity are required.' };
    }

    const existing = db.findOne('Tables', (t) => t.Table_Number === params.tableNumber.trim());
    if (existing) {
      return { success: false, message: `Table ${params.tableNumber} already exists.` };
    }

    const tableId = `TBL-${Date.now().toString().slice(-4)}`;
    db.insertRow('Tables', {
      Table_ID: tableId,
      Table_Number: params.tableNumber.trim().toUpperCase(),
      Seating_Capacity: Number(params.seatingCapacity),
      Table_Status: 'Available',
    });

    return {
      success: true,
      message: `Table ${params.tableNumber} created successfully.`,
      tableId,
    };
  }

  /**
   * Updates physical table maintenance status
   */
  public static toggleTableMaintenance(tableId: string): { success: boolean; message: string; newStatus?: string } {
    const table = db.findOne('Tables', (t) => t.Table_ID === tableId);
    if (!table) return { success: false, message: 'Table not found.' };

    const newStatus = table.Table_Status === 'Unavailable' ? 'Available' : 'Unavailable';
    db.updateRow('Tables', 'Table_ID', tableId, {
      Table_Status: newStatus,
    });

    return {
      success: true,
      message: `Table ${table.Table_Number} status updated to ${newStatus}.`,
      newStatus,
    };
  }

  /**
   * Retrieves restaurant configuration settings
   */
  public static getSettings(): Record<string, string> {
    const rows = db.getRows('Restaurant_Settings');
    const result: Record<string, string> = {};
    for (const r of rows) {
      result[r.Setting_Key] = r.Setting_Value;
    }
    return result;
  }

  /**
   * Updates restaurant settings
   */
  public static updateSetting(key: string, value: string): { success: boolean; message: string } {
    const row = db.findOne('Restaurant_Settings', (r) => r.Setting_Key === key);
    if (row) {
      db.updateRow('Restaurant_Settings', 'Setting_Key', key, { Setting_Value: value });
    } else {
      db.insertRow('Restaurant_Settings', { Setting_Key: key, Setting_Value: value });
    }
    return { success: true, message: `Setting '${key}' updated.` };
  }
}

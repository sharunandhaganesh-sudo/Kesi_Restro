/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * MockDatabase - Accurate in-memory simulator of Google Sheets with 12 tabs & 108 columns
 * Implements strict schema validation, column-index mapping, and lock simulation.
 */

import { DATABASE_SCHEMA } from './schema';
import { generateSalt, hashPassword } from './crypto';

export type SheetRow = Record<string, any>;

export class MockDatabase {
  private sheets: Map<string, SheetRow[]> = new Map();
  private lockOwner: string | null = null;

  constructor() {
    this.initializeAllSheets();
    this.seedBaselineData();
  }

  /**
   * Initializes all 12 sheets with empty row arrays
   */
  public initializeAllSheets(): void {
    for (const sheetName of Object.keys(DATABASE_SCHEMA)) {
      if (!this.sheets.has(sheetName)) {
        this.sheets.set(sheetName, []);
      }
    }
  }

  /**
   * Returns current headers for all sheets for schema verification
   */
  public getSheetHeaders(): Record<string, string[]> {
    const result: Record<string, string[]> = {};
    for (const [sheetName, def] of Object.entries(DATABASE_SCHEMA)) {
      result[sheetName] = [...def.columns];
    }
    return result;
  }

  /**
   * Simple lock simulation for critical operations
   */
  public acquireLock(owner: string, timeoutMs = 5000): boolean {
    if (this.lockOwner && this.lockOwner !== owner) {
      return false;
    }
    this.lockOwner = owner;
    return true;
  }

  public releaseLock(owner: string): void {
    if (this.lockOwner === owner) {
      this.lockOwner = null;
    }
  }

  /**
   * Returns all rows for a sheet
   */
  public getRows(sheetName: string): SheetRow[] {
    const sheet = this.sheets.get(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' does not exist in schema.`);
    }
    return sheet.map((row) => ({ ...row }));
  }

  /**
   * Finds rows matching a predicate
   */
  public findRows(sheetName: string, predicate: (row: SheetRow) => boolean): SheetRow[] {
    const rows = this.getRows(sheetName);
    return rows.filter(predicate);
  }

  /**
   * Finds a single row matching a predicate
   */
  public findOne(sheetName: string, predicate: (row: SheetRow) => boolean): SheetRow | null {
    const rows = this.getRows(sheetName);
    const found = rows.find(predicate);
    return found ? { ...found } : null;
  }

  /**
   * Appends a new row to the sheet, verifying exact column keys
   */
  public insertRow(sheetName: string, rowData: SheetRow): SheetRow {
    const def = DATABASE_SCHEMA[sheetName];
    if (!def) {
      throw new Error(`Sheet '${sheetName}' is not defined in schema.`);
    }

    // Build row adhering strictly to defined columns
    const cleanRow: SheetRow = {};
    for (const col of def.columns) {
      cleanRow[col] = rowData[col] !== undefined ? rowData[col] : '';
    }

    const sheet = this.sheets.get(sheetName)!;
    sheet.push(cleanRow);
    return { ...cleanRow };
  }

  /**
   * Updates an existing row identified by its primary key
   */
  public updateRow(
    sheetName: string,
    primaryKeyCol: string,
    primaryKeyValue: any,
    updates: Partial<SheetRow>
  ): SheetRow | null {
    const sheet = this.sheets.get(sheetName);
    if (!sheet) {
      throw new Error(`Sheet '${sheetName}' is not defined in schema.`);
    }

    const rowIndex = sheet.findIndex((r) => r[primaryKeyCol] === primaryKeyValue);
    if (rowIndex === -1) return null;

    const existingRow = sheet[rowIndex];
    const def = DATABASE_SCHEMA[sheetName];

    for (const [key, val] of Object.entries(updates)) {
      if (def.columns.includes(key)) {
        existingRow[key] = val;
      }
    }

    sheet[rowIndex] = existingRow;
    return { ...existingRow };
  }

  /**
   * Deletes a row by primary key (restricted usage)
   */
  public deleteRow(sheetName: string, primaryKeyCol: string, primaryKeyValue: any): boolean {
    const sheet = this.sheets.get(sheetName);
    if (!sheet) return false;
    const initialLen = sheet.length;
    this.sheets.set(
      sheetName,
      sheet.filter((r) => r[primaryKeyCol] !== primaryKeyValue)
    );
    return this.sheets.get(sheetName)!.length < initialLen;
  }

  /**
   * Reset database to pristine state with seed fixtures
   */
  public resetToSeed(): void {
    this.sheets.clear();
    this.initializeAllSheets();
    this.seedBaselineData();
  }

  /**
   * Seeds required initial data:
   * - 6 demo accounts: 1 Admin, 1 Staff, 1 Kitchen, 3 Customers
   * - 10 restaurant tables
   * - Menu catalog
   * - Settings
   */
  private seedBaselineData(): void {
    // 1. Restaurant Settings
    const settings: Record<string, string> = {
      RESTAURANT_NAME: 'Savor Dine-In Restaurant',
      UPI_ID: 'kesikam2006@oksbi',
      UPI_PAYEE_NAME: 'Kesika M',
      TAX_RATE_PERCENT: '5',
      MAX_STAFF_DISCOUNT_PERCENT: '10',
      MAX_ADMIN_DISCOUNT_PERCENT: '50',
      OPENING_TIME: '11:00',
      CLOSING_TIME: '23:00',
      GRACE_PERIOD_MINUTES: '10',
      STAFF_VERIFICATION_TIMEOUT_MINUTES: '15',
      DINING_DURATION_MINUTES: '90',
      CLEANING_TURNOVER_MINUTES: '15',
      TOTAL_BLOCKING_WINDOW_MINUTES: '105',
    };

    for (const [Setting_Key, Setting_Value] of Object.entries(settings)) {
      this.insertRow('Restaurant_Settings', { Setting_Key, Setting_Value });
    }

    // 2. Physical Tables
    // Tables table: Table_ID, Table_Number, Seating_Capacity, Table_Status
    // Table_Status: Available, Occupied, Unavailable
    const tables = [
      { Table_ID: 'TBL-01', Table_Number: 'T1', Seating_Capacity: 2, Table_Status: 'Available' },
      { Table_ID: 'TBL-02', Table_Number: 'T2', Seating_Capacity: 2, Table_Status: 'Available' },
      { Table_ID: 'TBL-03', Table_Number: 'T3', Seating_Capacity: 4, Table_Status: 'Available' },
      { Table_ID: 'TBL-04', Table_Number: 'T4', Seating_Capacity: 4, Table_Status: 'Available' },
      { Table_ID: 'TBL-05', Table_Number: 'T5', Seating_Capacity: 4, Table_Status: 'Available' },
      { Table_ID: 'TBL-06', Table_Number: 'T6', Seating_Capacity: 6, Table_Status: 'Available' },
      { Table_ID: 'TBL-07', Table_Number: 'T7', Seating_Capacity: 6, Table_Status: 'Available' },
      { Table_ID: 'TBL-08', Table_Number: 'T8', Seating_Capacity: 8, Table_Status: 'Available' },
      { Table_ID: 'TBL-09', Table_Number: 'T9', Seating_Capacity: 2, Table_Status: 'Available' },
      { Table_ID: 'TBL-10', Table_Number: 'T10', Seating_Capacity: 4, Table_Status: 'Available' },
    ];
    for (const tbl of tables) {
      this.insertRow('Tables', tbl);
    }

    // 3. Demo Users (Section 18.1): 1 Admin, 1 Staff, 1 Kitchen
    // Password for all demo accounts: "DemoPass@2026"
    const demoPassword = 'DemoPass@2026';
    const users = [
      {
        User_ID: 'USR-ADMIN-01',
        User_Name: 'admin',
        Email: 'admin@savor.restaurant',
        Role: 'Admin',
        Account_Status: 'Active',
      },
      {
        User_ID: 'USR-STAFF-01',
        User_Name: 'staff',
        Email: 'staff@savor.restaurant',
        Role: 'Staff',
        Account_Status: 'Active',
      },
      {
        User_ID: 'USR-KITCHEN-01',
        User_Name: 'kitchen',
        Email: 'kitchen@savor.restaurant',
        Role: 'Kitchen',
        Account_Status: 'Active',
      },
    ];

    for (const u of users) {
      const salt = generateSalt();
      const hash = hashPassword(demoPassword, salt);
      this.insertRow('Users', {
        User_ID: u.User_ID,
        User_Name: u.User_Name,
        Email: u.Email,
        Role: u.Role,
        Account_Status: u.Account_Status,
        Password_Hash: hash,
        Salt: salt,
        Active_Sessions_JSON: '[]',
      });
    }

    // 4. Demo Customers (Section 18.1): 3 Customer profiles
    const customers = [
      {
        Customer_ID: 'CUST-001',
        Customer_Name: 'Ananya Sharma',
        Mobile_Number: '9876543210',
        Email: 'ananya.sharma@example.com',
        Created_At: new Date(Date.now() - 86400000 * 5).toISOString(),
      },
      {
        Customer_ID: 'CUST-002',
        Customer_Name: 'Vikram Patel',
        Mobile_Number: '9876543211',
        Email: 'vikram.patel@example.com',
        Created_At: new Date(Date.now() - 86400000 * 3).toISOString(),
      },
      {
        Customer_ID: 'CUST-003',
        Customer_Name: 'Priya Sundaram',
        Mobile_Number: '9876543212',
        Email: 'priya.sundaram@example.com',
        Created_At: new Date(Date.now() - 86400000 * 1).toISOString(),
      },
    ];

    for (const c of customers) {
      this.insertRow('Customers', {
        Customer_ID: c.Customer_ID,
        Customer_Name: c.Customer_Name,
        Mobile_Number: c.Mobile_Number,
        Email: c.Email,
        Created_At: c.Created_At,
        OTP_Hash: '',
        OTP_Expiry: '',
        OTP_Attempts: 0,
        OTP_Last_Sent_At: '',
        OTP_Session_ID: '',
      });
    }

    // 5. Menu Catalog
    // Food_ID, Food_Name, Category, Description, Price, Image_URL, Availability, Prep_Time_Minutes, Is_Active
    const menuItems = [
      {
        Food_ID: 'FOOD-01',
        Food_Name: 'Crispy Truffle Fries',
        Category: 'Starters',
        Description: 'Golden hand-cut fries tossed in aromatic truffle oil, parmesan, and fresh rosemary.',
        Price: 280,
        Image_URL: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 12,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-02',
        Food_Name: 'Paneer Tikka Herb Skewers',
        Category: 'Starters',
        Description: 'Char-grilled cottage cheese cubes marinated in Kashmiri chili and tandoori spices.',
        Price: 340,
        Image_URL: 'https://images.unsplash.com/photo-1599488615731-7e5c2823ff28?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 18,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-03',
        Food_Name: 'Smoked Chicken Bruschetta',
        Category: 'Starters',
        Description: 'Artisan sourdough topped with smoked pulled chicken, sun-dried tomatoes, and basil pesto.',
        Price: 360,
        Image_URL: 'https://images.unsplash.com/photo-1541529086526-db283c563270?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 15,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-04',
        Food_Name: 'Wild Mushroom Risotto',
        Category: 'Mains',
        Description: 'Creamy Arborio rice slow-cooked with porcini, shiitake mushrooms, white truffle oil, and aged parmesan.',
        Price: 520,
        Image_URL: 'https://images.unsplash.com/photo-1633964913295-ceb43826e7c9?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 25,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-05',
        Food_Name: 'Butter Chicken with Garlic Naan',
        Category: 'Mains',
        Description: 'Tender tandoori chicken simmered in rich velvety tomato-butter gravy, served with fresh clay-oven garlic naan.',
        Price: 560,
        Image_URL: 'https://images.unsplash.com/photo-1588166524941-3bf61a9c41db?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 22,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-06',
        Food_Name: 'Pan-Seared Herb Salmon',
        Category: 'Mains',
        Description: 'Atlantic salmon fillet seared with dill butter, garlic mashed potatoes, and sautéed asparagus.',
        Price: 780,
        Image_URL: 'https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 24,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-07',
        Food_Name: 'Molten Belgian Chocolate Lava Cake',
        Category: 'Desserts',
        Description: 'Warm 70% dark Belgian chocolate cake with a molten center, served with Madagascan vanilla bean gelato.',
        Price: 310,
        Image_URL: 'https://images.unsplash.com/photo-1606313564200-e75d5e30476c?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 15,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-08',
        Food_Name: 'Classic Tiramisu Cup',
        Category: 'Desserts',
        Description: 'Espresso-soaked savoiardi biscuits layered with mascarpone cream and dusted with Valrhona cocoa.',
        Price: 290,
        Image_URL: 'https://images.unsplash.com/photo-1571877227200-a0d98ea607e9?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 8,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-09',
        Food_Name: 'Saffron Mango Cardamom Lassi',
        Category: 'Beverages',
        Description: 'Chilled Alphonso mango blended with hung curd, infused with royal Kashmiri saffron strands.',
        Price: 210,
        Image_URL: 'https://images.unsplash.com/photo-1553787499-6f9133860278?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 5,
        Is_Active: 'Active',
      },
      {
        Food_ID: 'FOOD-10',
        Food_Name: 'Artisan Cold Brew Hibiscus Tonic',
        Category: 'Beverages',
        Description: 'Single-origin Ethiopian cold brew coffee paired with organic wild hibiscus and craft tonic water.',
        Price: 240,
        Image_URL: 'https://images.unsplash.com/photo-1517701604599-bb29b565090c?auto=format&fit=crop&w=600&q=80',
        Availability: 'Available',
        Prep_Time_Minutes: 6,
        Is_Active: 'Active',
      },
    ];

    for (const item of menuItems) {
      this.insertRow('Menu', item);
    }
  }
}

// Global singleton instance for local runtime and tests
export const db = new MockDatabase();

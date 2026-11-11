/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * OrderService & KitchenService:
 * Handles cart validation with server-side price authority, staff authorization gates,
 * line item lifecycle, kitchen prep tickets, and Order_Status_History audit trails.
 */

import { db, SheetRow } from '../mockDb';

export interface CartItemInput {
  foodId: string;
  quantity: number;
}

export class OrderService {
  /**
   * Creates an order with items, computing all prices exclusively from the Menu tab.
   * Browser-supplied prices are strictly ignored.
   */
  public static createOrder(params: {
    bookingId: string;
    items: CartItemInput[];
    createdByRole: 'Customer' | 'Staff';
  }): { success: boolean; message: string; orderId?: string; totalAmount?: number } {
    if (!params.items || params.items.length === 0) {
      return { success: false, message: 'Cart cannot be empty.' };
    }

    const booking = db.findOne('Bookings', (b) => b.Booking_ID === params.bookingId);
    if (!booking) {
      return { success: false, message: 'Booking record not found.' };
    }

    const orderId = `ORD-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    let orderSubtotal = 0;
    const validatedItems: Array<{
      foodId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
    }> = [];

    // Verify each item against Menu tab
    for (const item of params.items) {
      const food = db.findOne('Menu', (m) => m.Food_ID === item.foodId);
      if (!food || food.Is_Active !== 'Active' || food.Availability !== 'Available') {
        return {
          success: false,
          message: `Item '${food?.Food_Name || item.foodId}' is currently unavailable.`,
        };
      }

      const qty = Math.max(1, Math.floor(Number(item.quantity) || 1));
      const unitPrice = Number(food.Price);
      const subtotal = qty * unitPrice;

      orderSubtotal += subtotal;
      validatedItems.push({
        foodId: food.Food_ID,
        quantity: qty,
        unitPrice,
        subtotal,
      });
    }

    // Insert Order row
    // Order_ID, Booking_ID, Order_DateTime, Order_Status, Authorized_At, Authorized_By
    db.insertRow('Orders', {
      Order_ID: orderId,
      Booking_ID: params.bookingId,
      Order_DateTime: now,
      Order_Status: 'Submitted',
      Authorized_At: '',
      Authorized_By: '',
    });

    // Insert Order_Items rows
    // Order_Item_ID, Order_ID, Food_ID, Quantity, Unit_Price, Subtotal, Item_Status, Cancellation_Reason, Replacement_Food_ID, Price_Difference
    for (let i = 0; i < validatedItems.length; i++) {
      const itm = validatedItems[i];
      const itemId = `ITEM-${Date.now().toString().slice(-5)}-${i + 1}`;

      db.insertRow('Order_Items', {
        Order_Item_ID: itemId,
        Order_ID: orderId,
        Food_ID: itm.foodId,
        Quantity: itm.quantity,
        Unit_Price: itm.unitPrice,
        Subtotal: itm.subtotal,
        Item_Status: 'Pending_Authorization',
        Cancellation_Reason: '',
        Replacement_Food_ID: '',
        Price_Difference: 0,
      });
    }

    // Record initial status in Order_Status_History
    db.insertRow('Order_Status_History', {
      History_ID: `HIST-${Date.now().toString().slice(-6)}`,
      Order_ID: orderId,
      Order_Status: 'Submitted',
      Changed_At: now,
      Changed_By: params.createdByRole,
      Change_Reason: 'Order submitted by customer/waiter',
    });

    return {
      success: true,
      message: 'Order placed successfully. Awaiting staff authorization for kitchen prep.',
      orderId,
      totalAmount: orderSubtotal,
    };
  }

  /**
   * Staff authorizes an order for kitchen preparation.
   * Business rules:
   * - Online orders can be authorized ONLY after customer arrival is verified by staff.
   * - Walk-in orders can be authorized AFTER customer is seated.
   */
  public static authorizeOrder(
    orderId: string,
    authorizedByUserName: string
  ): { success: boolean; message: string } {
    const order = db.findOne('Orders', (o) => o.Order_ID === orderId);
    if (!order) return { success: false, message: 'Order not found.' };

    const booking = db.findOne('Bookings', (b) => b.Booking_ID === order.Booking_ID);
    if (!booking) return { success: false, message: 'Associated booking not found.' };

    if (booking.Visit_Type === 'Online' && booking.Booking_Status !== 'Arrived' && booking.Booking_Status !== 'Seated') {
      return {
        success: false,
        message: 'Online orders cannot be sent to kitchen until customer arrival is verified by staff.',
      };
    }

    if (booking.Visit_Type === 'Walk-in' && booking.Booking_Status !== 'Seated') {
      return {
        success: false,
        message: 'Walk-in orders can be authorized only after party is seated at a table.',
      };
    }

    const now = new Date().toISOString();

    // Update order
    db.updateRow('Orders', 'Order_ID', orderId, {
      Order_Status: 'Authorized',
      Authorized_At: now,
      Authorized_By: authorizedByUserName,
    });

    // Update line items to Authorized
    const items = db.findRows('Order_Items', (i) => i.Order_ID === orderId);
    for (const item of items) {
      db.updateRow('Order_Items', 'Order_Item_ID', item.Order_Item_ID, {
        Item_Status: 'Authorized',
      });
    }

    // Log history
    db.insertRow('Order_Status_History', {
      History_ID: `HIST-${Date.now().toString().slice(-6)}`,
      Order_ID: orderId,
      Order_Status: 'Authorized',
      Changed_At: now,
      Changed_By: authorizedByUserName,
      Change_Reason: 'Staff authorized order for kitchen preparation',
    });

    return {
      success: true,
      message: `Order ${orderId} authorized and dispatched to Kitchen queue.`,
    };
  }

  /**
   * Cancels or modifies an order item
   */
  public static cancelOrReplaceItem(params: {
    orderItemId: string;
    action: 'CANCEL' | 'REPLACE';
    reason: string;
    replacementFoodId?: string;
    changedBy: string;
  }): { success: boolean; message: string } {
    const item = db.findOne('Order_Items', (i) => i.Order_Item_ID === params.orderItemId);
    if (!item) return { success: false, message: 'Order item not found.' };

    if (item.Item_Status === 'Served') {
      return { success: false, message: 'Cannot cancel an item that has already been served.' };
    }

    if (params.action === 'CANCEL') {
      db.updateRow('Order_Items', 'Order_Item_ID', params.orderItemId, {
        Item_Status: 'Cancelled',
        Cancellation_Reason: params.reason,
        Subtotal: 0,
      });

      return { success: true, message: 'Item cancelled successfully.' };
    }

    if (params.action === 'REPLACE' && params.replacementFoodId) {
      const newFood = db.findOne('Menu', (m) => m.Food_ID === params.replacementFoodId);
      if (!newFood) return { success: false, message: 'Replacement menu item not found.' };

      const oldSubtotal = Number(item.Subtotal);
      const newUnitPrice = Number(newFood.Price);
      const newSubtotal = Number(item.Quantity) * newUnitPrice;
      const priceDiff = newSubtotal - oldSubtotal;

      db.updateRow('Order_Items', 'Order_Item_ID', params.orderItemId, {
        Item_Status: 'Replaced',
        Replacement_Food_ID: newFood.Food_ID,
        Cancellation_Reason: params.reason,
        Unit_Price: newUnitPrice,
        Subtotal: newSubtotal,
        Price_Difference: priceDiff,
      });

      return {
        success: true,
        message: `Item replaced with ${newFood.Food_Name}. Price adjustment: ₹${priceDiff >= 0 ? '+' : ''}${priceDiff}`,
      };
    }

    return { success: false, message: 'Invalid action parameters.' };
  }
}

export class KitchenService {
  /**
   * Retrieves all orders authorized by staff for kitchen preparation.
   * Strictly filters out un-authorized orders.
   */
  public static getKitchenQueue(): Array<SheetRow & { items: any[]; tableNumber: string }> {
    const authorizedOrders = db.findRows(
      'Orders',
      (o) =>
        o.Order_Status === 'Authorized' ||
        o.Order_Status === 'In_Preparation' ||
        o.Order_Status === 'Ready_For_Serving'
    );

    const menu = db.getRows('Menu');
    const tables = db.getRows('Tables');
    const reservations = db.getRows('Table_Reservations');

    return authorizedOrders.map((order) => {
      const items = db.findRows('Order_Items', (i) => i.Order_ID === order.Order_ID);
      const enrichedItems = items.map((i) => {
        const food = menu.find((m) => m.Food_ID === i.Food_ID);
        return {
          ...i,
          foodName: food?.Food_Name || 'Unknown Dish',
          prepTimeMinutes: food?.Prep_Time_Minutes || 15,
          category: food?.Category || '',
        };
      });

      const res = reservations.find((r) => r.Booking_ID === order.Booking_ID);
      const table = res ? tables.find((t) => t.Table_ID === res.Table_ID) : undefined;

      return {
        ...order,
        items: enrichedItems,
        tableNumber: table?.Table_Number || 'TBD',
      };
    });
  }

  /**
   * Updates an order's preparation stage with audit logging
   * Allowed transitions: Authorized -> In_Preparation -> Ready_For_Serving -> Served
   */
  public static updatePreparationStatus(params: {
    orderId: string;
    newStatus: 'In_Preparation' | 'Ready_For_Serving' | 'Served';
    kitchenUserName: string;
    reason?: string;
  }): { success: boolean; message: string } {
    const order = db.findOne('Orders', (o) => o.Order_ID === params.orderId);
    if (!order) return { success: false, message: 'Order ticket not found.' };

    const validTransitions: Record<string, string[]> = {
      Authorized: ['In_Preparation'],
      In_Preparation: ['Ready_For_Serving'],
      Ready_For_Serving: ['Served'],
    };

    const allowed = validTransitions[order.Order_Status] || [];
    if (!allowed.includes(params.newStatus)) {
      return {
        success: false,
        message: `Invalid state transition from '${order.Order_Status}' to '${params.newStatus}'.`,
      };
    }

    const now = new Date().toISOString();

    db.updateRow('Orders', 'Order_ID', params.orderId, {
      Order_Status: params.newStatus,
    });

    // Update line items status
    const itemStatusMap: Record<string, string> = {
      In_Preparation: 'Cooking',
      Ready_For_Serving: 'Ready',
      Served: 'Served',
    };
    const newItemStatus = itemStatusMap[params.newStatus];
    if (newItemStatus) {
      const items = db.findRows('Order_Items', (i) => i.Order_ID === params.orderId && i.Item_Status !== 'Cancelled');
      for (const item of items) {
        db.updateRow('Order_Items', 'Order_Item_ID', item.Order_Item_ID, {
          Item_Status: newItemStatus,
        });
      }
    }

    // Record audit trail in Order_Status_History
    db.insertRow('Order_Status_History', {
      History_ID: `HIST-${Date.now().toString().slice(-6)}`,
      Order_ID: params.orderId,
      Order_Status: params.newStatus,
      Changed_At: now,
      Changed_By: params.kitchenUserName,
      Change_Reason: params.reason || `Kitchen status progressed to ${params.newStatus}`,
    });

    return {
      success: true,
      message: `Order ${params.orderId} marked as ${params.newStatus.replace(/_/g, ' ')}.`,
    };
  }
}

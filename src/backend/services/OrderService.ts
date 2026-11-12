/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * OrderService & KitchenService:
 * Handles cart validation with server-side price authority, staff authorization gates,
 * line item lifecycle, kitchen prep tickets, and Order_Status_History audit trails.
 */

import { db, SheetRow } from '../mockDb';

export type KitchenOrderStatus =
  | 'New_Order'
  | 'Accepted'
  | 'Preparing'
  | 'Ready'
  | 'Served'
  | 'Authorized'
  | 'In_Preparation'
  | 'Ready_For_Serving';

export interface CartItemInput {
  foodId: string;
  quantity: number;
  specialInstructions?: string;
}

export class OrderService {
  /**
   * Creates an order with items, computing all prices exclusively from the Menu tab.
   * Immediately queues the order as 'New_Order' for Kitchen Display visibility without waiting for billing.
   */
  public static createOrder(params: {
    orderId?: string;
    bookingId: string;
    items: CartItemInput[];
    specialInstructions?: string;
    createdByRole: 'Customer' | 'Staff';
  }): { success: boolean; message: string; orderId?: string; totalAmount?: number; orderStatus?: string } {
    if (!params.items || params.items.length === 0) {
      return { success: false, message: 'Cart cannot be empty.' };
    }

    const booking = db.findOne('Bookings', (b) => b.Booking_ID === params.bookingId);
    if (!booking) {
      return { success: false, message: 'Booking record not found.' };
    }

    const orderId = params.orderId || `ORD-${Date.now().toString().slice(-6)}`;
    const now = new Date().toISOString();

    let orderSubtotal = 0;
    const itemNotes: Record<string, string> = {};
    const validatedItems: Array<{
      foodId: string;
      quantity: number;
      unitPrice: number;
      subtotal: number;
      specialInstructions?: string;
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
      if (item.specialInstructions?.trim()) {
        itemNotes[food.Food_ID] = item.specialInstructions.trim();
      }
      validatedItems.push({
        foodId: food.Food_ID,
        quantity: qty,
        unitPrice,
        subtotal,
        specialInstructions: item.specialInstructions?.trim() || '',
      });
    }

    // Insert Order row immediately with New_Order so Kitchen sees it right away
    db.insertRow('Orders', {
      Order_ID: orderId,
      Booking_ID: params.bookingId,
      Order_DateTime: now,
      Order_Status: 'New_Order',
      Authorized_At: now,
      Authorized_By: params.createdByRole === 'Staff' ? 'Staff' : 'Direct Customer Order',
    });

    // Insert Order_Items rows
    for (let i = 0; i < validatedItems.length; i++) {
      const itm = validatedItems[i];
      const itemId = `ITEM-${orderId.replace('ORD-', '')}-${i + 1}`;

      db.insertRow('Order_Items', {
        Order_Item_ID: itemId,
        Order_ID: orderId,
        Food_ID: itm.foodId,
        Quantity: itm.quantity,
        Unit_Price: itm.unitPrice,
        Subtotal: itm.subtotal,
        Item_Status: 'New_Order',
        Cancellation_Reason: '',
        Replacement_Food_ID: '',
        Price_Difference: 0,
      });
    }

    // Record initial status + special instructions metadata in Order_Status_History
    db.insertRow('Order_Status_History', {
      History_ID: `HIST-${Date.now().toString().slice(-6)}`,
      Order_ID: orderId,
      Order_Status: 'New_Order',
      Changed_At: now,
      Changed_By: params.createdByRole,
      Change_Reason: JSON.stringify({
        summary: 'Order placed and routed immediately to Kitchen',
        specialInstructions: (params.specialInstructions || '').trim(),
        itemNotes,
      }),
    });

    return {
      success: true,
      message: 'Order confirmed and sent directly to the Kitchen Display!',
      orderId,
      totalAmount: orderSubtotal,
      orderStatus: 'New_Order',
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
  private static extractOrderMeta(orderId: string): {
    specialInstructions: string;
    itemNotes: Record<string, string>;
  } {
    const history = db.findRows('Order_Status_History', (h) => h.Order_ID === orderId);
    for (const h of history) {
      if (h.Change_Reason && String(h.Change_Reason).trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(h.Change_Reason);
          return {
            specialInstructions: parsed.specialInstructions || '',
            itemNotes: parsed.itemNotes || {},
          };
        } catch {
          // Ignore malformed JSON notes
        }
      }
    }
    return { specialInstructions: '', itemNotes: {} };
  }

  /**
   * Retrieves all orders for Kitchen Display (and Staff Order tracking).
   * Immediately includes New_Order orders as soon as customer submits, independent of billing.
   * Strictly deduplicated by Order_ID.
   */
  public static getKitchenQueue(includeServed = true): Array<
    SheetRow & {
      items: any[];
      tableNumber: string;
      customerName: string;
      specialInstructions: string;
    }
  > {
    const visibleStatuses = new Set([
      'New_Order',
      'Submitted',
      'Accepted',
      'Preparing',
      'Ready',
      'Authorized',
      'In_Preparation',
      'Ready_For_Serving',
    ]);
    if (includeServed) visibleStatuses.add('Served');

    const rawOrders = db.findRows('Orders', (o) => visibleStatuses.has(o.Order_Status));
    const uniqueOrdersMap = new Map<string, SheetRow>();
    for (const o of rawOrders) {
      if (!uniqueOrdersMap.has(o.Order_ID)) {
        uniqueOrdersMap.set(o.Order_ID, o);
      }
    }

    const menu = db.getRows('Menu');
    const tables = db.getRows('Tables');
    const reservations = db.getRows('Table_Reservations');
    const bookings = db.getRows('Bookings');
    const customers = db.getRows('Customers');

    return Array.from(uniqueOrdersMap.values())
      .map((order): any => {
        const meta = this.extractOrderMeta(order.Order_ID);
        const items = db.findRows('Order_Items', (i) => i.Order_ID === order.Order_ID);
        const seenItemIds = new Set<string>();
        const enrichedItems = items
          .filter((i) => {
            if (seenItemIds.has(i.Order_Item_ID)) return false;
            seenItemIds.add(i.Order_Item_ID);
            return true;
          })
          .map((i) => {
            const food = menu.find((m) => m.Food_ID === i.Food_ID);
            return {
              ...i,
              foodName: food?.Food_Name || 'Dish',
              prepTimeMinutes: food?.Prep_Time_Minutes || 15,
              category: food?.Category || '',
              specialInstructions: meta.itemNotes[i.Food_ID] || '',
            };
          });

        const res = reservations.find((r) => r.Booking_ID === order.Booking_ID);
        const table = res ? tables.find((t) => t.Table_ID === res.Table_ID) : undefined;
        const booking = bookings.find((b) => b.Booking_ID === order.Booking_ID);
        const customer = booking
          ? customers.find((c) => c.Customer_ID === booking.Customer_ID)
          : undefined;

        return {
          ...order,
          items: enrichedItems,
          tableNumber: table?.Table_Number || (res?.Table_ID ? res.Table_ID : 'Counter / Walk-in'),
          customerName: customer?.Customer_Name || 'Guest',
          specialInstructions: meta.specialInstructions,
        };
      })
      .sort((a, b) => new Date(b.Order_DateTime || 0).getTime() - new Date(a.Order_DateTime || 0).getTime());
  }

  /**
   * Updates an order's preparation stage with audit logging.
   * Supports New_Order -> Accepted -> Preparing -> Ready -> Served and legacy aliases.
   */
  public static updatePreparationStatus(params: {
    orderId: string;
    newStatus: KitchenOrderStatus;
    kitchenUserName: string;
    reason?: string;
  }): { success: boolean; message: string } {
    const order = db.findOne('Orders', (o) => o.Order_ID === params.orderId);
    if (!order) return { success: false, message: 'Order ticket not found.' };

    const validTransitions: Record<string, string[]> = {
      New_Order: ['Accepted', 'Preparing', 'In_Preparation'],
      Submitted: ['Accepted', 'Preparing', 'In_Preparation', 'Authorized'],
      Accepted: ['Preparing', 'In_Preparation', 'Ready'],
      Preparing: ['Ready', 'Ready_For_Serving', 'Served'],
      Ready: ['Served'],
      Authorized: ['Accepted', 'Preparing', 'In_Preparation'],
      In_Preparation: ['Preparing', 'Ready', 'Ready_For_Serving'],
      Ready_For_Serving: ['Ready', 'Served'],
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

    const itemStatusMap: Record<string, string> = {
      Accepted: 'Accepted',
      Preparing: 'Preparing',
      In_Preparation: 'Preparing',
      Ready: 'Ready',
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

  /**
   * Allows multi-item status tracking in Kitchen Display without locking whole-order flexibility.
   */
  public static updateOrderItemStatus(params: {
    orderItemId: string;
    newStatus: 'Accepted' | 'Preparing' | 'Ready' | 'Served';
    kitchenUserName: string;
  }): { success: boolean; message: string; orderId?: string } {
    const item = db.findOne('Order_Items', (i) => i.Order_Item_ID === params.orderItemId);
    if (!item) return { success: false, message: 'Order item not found.' };

    db.updateRow('Order_Items', 'Order_Item_ID', params.orderItemId, {
      Item_Status: params.newStatus,
    });

    const allItems = db.findRows(
      'Order_Items',
      (i) => i.Order_ID === item.Order_ID && i.Item_Status !== 'Cancelled'
    );
    const allServed = allItems.every((i) => i.Item_Status === 'Served');
    const allReadyOrServed = allItems.every((i) => i.Item_Status === 'Ready' || i.Item_Status === 'Served');
    const anyPreparing = allItems.some((i) => i.Item_Status === 'Preparing');

    let nextOrderStatus: string | null = null;
    if (allServed) nextOrderStatus = 'Served';
    else if (allReadyOrServed) nextOrderStatus = 'Ready';
    else if (anyPreparing) nextOrderStatus = 'Preparing';

    if (nextOrderStatus) {
      db.updateRow('Orders', 'Order_ID', item.Order_ID, { Order_Status: nextOrderStatus });
    }

    db.insertRow('Order_Status_History', {
      History_ID: `HIST-${Date.now().toString().slice(-6)}`,
      Order_ID: item.Order_ID,
      Order_Status: `Item:${params.orderItemId}->${params.newStatus}`,
      Changed_At: new Date().toISOString(),
      Changed_By: params.kitchenUserName,
      Change_Reason: `Item ${item.Food_ID} updated to ${params.newStatus}`,
    });

    return {
      success: true,
      orderId: item.Order_ID,
      message: `Item updated to ${params.newStatus}.`,
    };
  }
}

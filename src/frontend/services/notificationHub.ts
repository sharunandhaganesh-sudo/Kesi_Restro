/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 * 
 * Treat & Taste — Universal Real-Time Notification & Event Hub
 * - BroadcastChannel for 0ms instant cross-tab communication
 * - Event diffing & deduplication for cross-device polling detection
 * - Web AudioContext synthesized chimes (zero external audio file dependency)
 * - Safe event tracking preventing duplicate re-alerting across page reloads
 */

export interface RestaurantNotificationEvent {
  id: string; // Unique event ID for deduplication: e.g. "arrival_BK-20261112-2830"
  type:
    | 'NEW_RESERVATION'
    | 'ARRIVAL_REGISTERED'
    | 'ARRIVAL_VERIFIED'
    | 'TABLE_ALLOCATED'
    | 'CUSTOMER_SEATED'
    | 'NEW_ORDER'
    | 'ORDER_STATUS_CHANGED'
    | 'BILL_GENERATED'
    | 'PAYMENT_VERIFIED'
    | 'REFUND_STATUS_CHANGED';
  title: string;
  message: string;
  priority: 'low' | 'normal' | 'high' | 'critical';
  timestamp: string | number;
  metadata?: {
    bookingId?: string;
    customerId?: string;
    customerName?: string;
    partySize?: number;
    tableNumber?: string;
    orderId?: string;
    itemsSummary?: string;
    status?: string;
    billId?: string;
    amount?: number;
    grandTotal?: number;
    date?: string;
    time?: string;
  };
  actionLabel?: string;
  onAction?: () => void;
  autoDismissMs?: number; // 0 or undefined for persistent critical alerts
}

const SEEN_EVENTS_STORAGE_KEY = 'tt_seen_notification_ids';
const MAX_SEEN_CACHE = 200;

class NotificationHub {
  private listeners: Set<(event: RestaurantNotificationEvent) => void> = new Set();
  private broadcastChannel: BroadcastChannel | null = null;
  private seenIds: Set<string> = new Set();
  private audioCtx: AudioContext | null = null;

  constructor() {
    this.loadSeenIds();

    if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
      try {
        this.broadcastChannel = new BroadcastChannel('treat_taste_notifications');
        this.broadcastChannel.onmessage = (msg: MessageEvent<RestaurantNotificationEvent>) => {
          if (msg.data && msg.data.id) {
            this.handleIncomingEvent(msg.data, false);
          }
        };
      } catch (err) {
        console.warn('BroadcastChannel initialization error:', err);
      }
    }
  }

  private loadSeenIds() {
    if (typeof window === 'undefined') return;
    try {
      const stored = sessionStorage.getItem(SEEN_EVENTS_STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) {
          this.seenIds = new Set(parsed);
        }
      }
    } catch {}
  }

  private persistSeenIds() {
    if (typeof window === 'undefined') return;
    try {
      const arr = Array.from(this.seenIds).slice(-MAX_SEEN_CACHE);
      sessionStorage.setItem(SEEN_EVENTS_STORAGE_KEY, JSON.stringify(arr));
    } catch {}
  }

  public hasSeen(id: string): boolean {
    return this.seenIds.has(id);
  }

  public markSeen(id: string) {
    this.seenIds.add(id);
    this.persistSeenIds();
  }

  /**
   * Publishes an event locally, stores deduplication marker, and broadcasts across tabs
   */
  public publish(event: RestaurantNotificationEvent) {
    if (this.hasSeen(event.id)) {
      return; // Deduplicate
    }
    this.markSeen(event.id);
    this.handleIncomingEvent(event, true);
  }

  private handleIncomingEvent(event: RestaurantNotificationEvent, broadcast: boolean) {
    // Notify all active listeners in this window
    for (const listener of this.listeners) {
      try {
        listener(event);
      } catch (err) {
        console.error('NotificationHub listener error:', err);
      }
    }

    // Play synthesized audio alert for high and critical priority events
    if (event.priority === 'critical' || event.priority === 'high') {
      this.playChime(event.priority === 'critical' ? 'critical' : 'chime');
    }

    // Broadcast across tabs
    if (broadcast && this.broadcastChannel) {
      try {
        this.broadcastChannel.postMessage(event);
      } catch {}
    }
  }

  /**
   * Subscribe a component to incoming notifications
   */
  public subscribe(listener: (event: RestaurantNotificationEvent) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Synthesize a clean, pleasant notification chime via Web Audio API.
   * Completely self-contained with no external mp3/wav network requests.
   */
  public playChime(kind: 'chime' | 'critical' | 'ding' = 'chime') {
    if (typeof window === 'undefined') return;
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;

      if (!this.audioCtx || this.audioCtx.state === 'suspended') {
        this.audioCtx = new AudioCtx();
      }

      const now = this.audioCtx.currentTime;
      const osc = this.audioCtx.createOscillator();
      const gain = this.audioCtx.createGain();

      osc.connect(gain);
      gain.connect(this.audioCtx.destination);

      if (kind === 'critical') {
        // Double two-tone alert for staff actions
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now); // D5
        osc.frequency.setValueAtTime(880.00, now + 0.12); // A5
        gain.gain.setValueAtTime(0.2, now);
        gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
        osc.start(now);
        osc.stop(now + 0.4);
      } else {
        // Gentle bell chime (E5 -> G#5 -> B5)
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(659.25, now);
        osc.frequency.exponentialRampToValueAtTime(830.61, now + 0.15);
        gain.gain.setValueAtTime(0.15, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.5);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch {
      // Audio playback blocked by browser user-gesture policy until interaction
    }
  }
}

export const notificationHub = new NotificationHub();

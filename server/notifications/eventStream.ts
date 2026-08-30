import { Request, Response } from 'express';
import { logger } from '../logger.js';

export interface StreamEvent {
  id: string;
  type: 'BREAKING_NEWS' | 'NEW_CLUSTER' | 'GOOGLE_SKILL_SYNCED' | 'EARLY_SIGNAL' | 'HEARTBEAT';
  timestamp: string;
  data: any;
}

// In-memory set of active SSE client responses
const clients = new Set<Response>();

/**
 * Handles incoming Server-Sent Events (SSE) client connections
 */
export function handleEventStream(req: Request, res: Response) {
  // Configure standard SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache, no-transform');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable proxy buffering (Nginx/Cloudflare)
  res.flushHeaders();

  // Send initial connected handshake
  const handshake: StreamEvent = {
    id: `handshake_${Date.now()}`,
    type: 'HEARTBEAT',
    timestamp: new Date().toISOString(),
    data: { status: 'CONNECTED', active_subscribers: clients.size + 1 }
  };
  res.write(`data: ${JSON.stringify(handshake)}\n\n`);

  // Register client
  clients.add(res);
  logger.info('EVENT_STREAM', 'CLIENT_CONNECTED', `Active SSE subscribers: ${clients.size}`);

  // Heartbeat ping every 25 seconds to keep connection alive through load balancers
  const heartbeatTimer = setInterval(() => {
    try {
      res.write(`: heartbeat ${new Date().toISOString()}\n\n`);
    } catch (e) {
      clearInterval(heartbeatTimer);
    }
  }, 25000);

  // Clean up on disconnect
  req.on('close', () => {
    clearInterval(heartbeatTimer);
    clients.delete(res);
    logger.info('EVENT_STREAM', 'CLIENT_DISCONNECTED', `Remaining subscribers: ${clients.size}`);
  });
}

/**
 * Broadcasts an event to all connected SSE clients
 */
export function broadcastStreamEvent(type: StreamEvent['type'], data: any) {
  if (clients.size === 0) return;

  const event: StreamEvent = {
    id: `evt_${Date.now()}_${Math.random().toString(36).substring(7)}`,
    type,
    timestamp: new Date().toISOString(),
    data
  };

  const payload = `data: ${JSON.stringify(event)}\n\n`;

  for (const client of clients) {
    try {
      client.write(payload);
    } catch (err) {
      clients.delete(client);
    }
  }

  logger.info('EVENT_STREAM', 'BROADCAST', `Dispatched [${type}] to ${clients.size} clients`);
}

/**
 * Returns diagnostic metrics for the event stream
 */
export function getStreamMetrics() {
  return {
    active_subscribers: clients.size,
    status: 'OPERATIONAL'
  };
}

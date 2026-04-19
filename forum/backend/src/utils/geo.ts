import geoip from 'geoip-lite';
import { UAParser } from 'ua-parser-js';
import { createHash } from 'crypto';
import { Request } from 'express';

export function getClientIp(req: Request): string {
  const forwarded = req.headers['x-forwarded-for'];
  if (typeof forwarded === 'string') {
    return forwarded.split(',')[0].trim();
  }
  return req.socket?.remoteAddress || '0.0.0.0';
}

export function getCountry(ip: string): string {
  try {
    const geo = geoip.lookup(ip);
    return geo?.country || 'Unknown';
  } catch {
    return 'Unknown';
  }
}

export function parseUserAgent(ua: string) {
  const parser = new UAParser(ua);
  const result = parser.getResult();
  return {
    browser: `${result.browser.name || 'Unknown'} ${result.browser.version || ''}`.trim(),
    os: `${result.os.name || 'Unknown'} ${result.os.version || ''}`.trim(),
    device: result.device.type || 'desktop',
  };
}

export function generateFingerprint(req: Request): string {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const accept = req.headers['accept'] || '';
  const lang = req.headers['accept-language'] || '';
  const clientFingerprint = (req.headers['x-fingerprint'] as string) || '';
  const data = `${ip}:${ua}:${accept}:${lang}:${clientFingerprint}`;
  return createHash('sha256').update(data).digest('hex');
}

export function extractRequestMeta(req: Request) {
  const ip = getClientIp(req);
  const ua = req.headers['user-agent'] || '';
  const { browser, os } = parseUserAgent(ua);
  const country = getCountry(ip);
  const fingerprint = generateFingerprint(req);
  return { ip, country, browser, os, fingerprint, userAgent: ua };
}

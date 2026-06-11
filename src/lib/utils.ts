import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export interface ParsedFile {
  isEncrypted: boolean;
  sha256: string | null;
  originalName: string;
  rawName: string;
}

export function parseFileName(rawName: string): ParsedFile {
  if (rawName.startsWith('enc_')) {
    // Format: enc_[sha256]_[random_id]_[original_name]
    const parts = rawName.split('_');
    if (parts.length >= 4) {
      const sha256 = parts[1];
      const originalName = parts.slice(3).join('_');
      return {
        isEncrypted: true,
        sha256,
        originalName,
        rawName
      };
    }
  } else if (rawName.startsWith('sec_')) {
    // Format: sec_[sha256]_[random_id]_[original_name]
    const parts = rawName.split('_');
    if (parts.length >= 4) {
      const sha256 = parts[1];
      const originalName = parts.slice(3).join('_');
      return {
        isEncrypted: false,
        sha256,
        originalName,
        rawName
      };
    }
  }

  // Legacy file fallback: [random_id]_[original_name]
  const parts = rawName.split('_');
  if (parts.length >= 2) {
    // Check if parts[0] looks like a random string or numeric timestamp
    const originalName = parts.slice(1).join('_');
    return {
      isEncrypted: false,
      sha256: null,
      originalName,
      rawName
    };
  }

  return {
    isEncrypted: false,
    sha256: null,
    originalName: rawName,
    rawName
  };
}

export function formatBytes(bytes: number, decimals = 2): string {
  if (!bytes || bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

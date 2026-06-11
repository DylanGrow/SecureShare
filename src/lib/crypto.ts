// Web Crypto API implementations for zero-knowledge client-side encryption

async function getPbkdf2Key(password: string): Promise<CryptoKey> {
  const enc = new TextEncoder();
  return crypto.subtle.importKey(
    'raw',
    enc.encode(password),
    { name: 'PBKDF2' },
    false,
    ['deriveBits', 'deriveKey']
  );
}

export async function deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
  const baseKey = await getPbkdf2Key(password);
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: salt as BufferSource,
      iterations: 10000,
      hash: 'SHA-256'
    },
    baseKey,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

export async function encryptFile(file: File, password: string): Promise<Blob> {
  const fileBuffer = await file.arrayBuffer();
  
  // Generate random salt (16 bytes) and IV (12 bytes)
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  const key = await deriveKey(password, salt);
  
  const ciphertext = await crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    fileBuffer
  );
  
  // Package as [salt (16 bytes)][iv (12 bytes)][ciphertext]
  const packageBuffer = new Uint8Array(salt.byteLength + iv.byteLength + ciphertext.byteLength);
  packageBuffer.set(salt, 0);
  packageBuffer.set(iv, salt.byteLength);
  packageBuffer.set(new Uint8Array(ciphertext), salt.byteLength + iv.byteLength);
  
  // Return encrypted binary data
  return new Blob([packageBuffer], { type: 'application/octet-stream' });
}

export async function decryptFile(encryptedBuffer: ArrayBuffer, password: string): Promise<ArrayBuffer> {
  const salt = new Uint8Array(encryptedBuffer, 0, 16);
  const iv = new Uint8Array(encryptedBuffer, 16, 12);
  const ciphertext = new Uint8Array(encryptedBuffer, 28);
  
  const key = await deriveKey(password, salt);
  
  const decrypted = await crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    key,
    ciphertext
  );
  
  return decrypted;
}

export async function computeSHA256(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const hashBuffer = await crypto.subtle.digest('SHA-256', buffer);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  return hashHex;
}

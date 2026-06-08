/**
 * Generates an RSA-OAEP key pair (2048-bit).
 * @returns {Promise<{ privateKey: CryptoKey, publicKeySpki: string }>}
 */
export const generateRSAKeyPair = async () => {
  const keyPair = await window.crypto.subtle.generateKey(
    {
      name: 'RSA-OAEP',
      modulusLength: 2048,
      publicExponent: new Uint8Array([1, 0, 1]),
      hash: 'SHA-256',
    },
    true, // Extractable so we can export the public key
    ['encrypt', 'decrypt']
  );

  // Export public key to SPKI format for transmission
  const exportedPublicKey = await window.crypto.subtle.exportKey(
    'spki',
    keyPair.publicKey
  );
  
  // Convert ArrayBuffer to Base64 string for easy transport
  const base64PublicKey = btoa(String.fromCharCode(...new Uint8Array(exportedPublicKey)));

  return {
    privateKey: keyPair.privateKey,
    publicKeySpki: base64PublicKey
  };
};

/**
 * Generates a random AES-256-GCM session key.
 * @returns {Promise<CryptoKey>}
 */
export const generateAESKey = async () => {
  return window.crypto.subtle.generateKey(
    {
      name: 'AES-GCM',
      length: 256
    },
    true, // Extractable so we can encrypt it with RSA and send over socket
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts an AES session key using the target user's RSA Public Key.
 * @param {CryptoKey} aesKey 
 * @param {string} targetPublicKeyBase64 - SPKI format in Base64
 * @returns {Promise<string>} Base64-encoded encrypted AES key
 */
export const encryptAESKeyWithRSA = async (aesKey, targetPublicKeyBase64) => {
  // Convert Base64 back to ArrayBuffer
  const binaryString = atob(targetPublicKeyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  
  // Import the target's public key
  const targetPublicKey = await window.crypto.subtle.importKey(
    'spki',
    bytes.buffer,
    {
      name: 'RSA-OAEP',
      hash: 'SHA-256'
    },
    true,
    ['encrypt']
  );

  // Export the AES key to raw bytes
  const rawAesKey = await window.crypto.subtle.exportKey('raw', aesKey);

  // Encrypt the raw AES key with the target's RSA public key
  const encryptedAesKeyBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'RSA-OAEP'
    },
    targetPublicKey,
    rawAesKey
  );

  // Return base64 encoded string of the encrypted AES key
  return btoa(String.fromCharCode(...new Uint8Array(encryptedAesKeyBuffer)));
};

/**
 * Decrypts an encrypted AES session key using the local user's RSA Private Key.
 * @param {CryptoKey} privateKey 
 * @param {string} encryptedAesKeyBase64 
 * @returns {Promise<CryptoKey>} The decrypted AES session key
 */
export const decryptAESKeyWithRSA = async (privateKey, encryptedAesKeyBase64) => {
  const binaryString = atob(encryptedAesKeyBase64);
  const bytes = new Uint8Array(binaryString.length);
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  // Decrypt to get the raw AES key bytes
  const rawAesKey = await window.crypto.subtle.decrypt(
    {
      name: 'RSA-OAEP'
    },
    privateKey,
    bytes.buffer
  );

  // Import the raw bytes back into a CryptoKey for AES-GCM
  return window.crypto.subtle.importKey(
    'raw',
    rawAesKey,
    {
      name: 'AES-GCM'
    },
    true, // Extractable
    ['encrypt', 'decrypt']
  );
};

/**
 * Encrypts a plaintext message using an AES session key.
 * @param {CryptoKey} aesKey 
 * @param {string} plaintextMessage 
 * @returns {Promise<{ ciphertextBase64: string, ivBase64: string }>}
 */
export const encryptMessageWithAES = async (aesKey, plaintextMessage) => {
  const enc = new TextEncoder();
  const encodedMessage = enc.encode(plaintextMessage);

  // Initialization Vector (IV) must be unique for every encryption
  const iv = window.crypto.getRandomValues(new Uint8Array(12));

  const ciphertextBuffer = await window.crypto.subtle.encrypt(
    {
      name: 'AES-GCM',
      iv: iv
    },
    aesKey,
    encodedMessage
  );

  const ciphertextBase64 = btoa(String.fromCharCode(...new Uint8Array(ciphertextBuffer)));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  return { ciphertextBase64, ivBase64 };
};

/**
 * Decrypts an encrypted message using an AES session key.
 * @param {CryptoKey} aesKey 
 * @param {string} ciphertextBase64 
 * @param {string} ivBase64 
 * @returns {Promise<string>} Plaintext message
 */
export const decryptMessageWithAES = async (aesKey, ciphertextBase64, ivBase64) => {
  const ctBinary = atob(ciphertextBase64);
  const ctBytes = new Uint8Array(ctBinary.length);
  for (let i = 0; i < ctBinary.length; i++) {
    ctBytes[i] = ctBinary.charCodeAt(i);
  }

  const ivBinary = atob(ivBase64);
  const ivBytes = new Uint8Array(ivBinary.length);
  for (let i = 0; i < ivBinary.length; i++) {
    ivBytes[i] = ivBinary.charCodeAt(i);
  }

  const plaintextBuffer = await window.crypto.subtle.decrypt(
    {
      name: 'AES-GCM',
      iv: ivBytes
    },
    aesKey,
    ctBytes.buffer
  );

  const dec = new TextDecoder();
  return dec.decode(plaintextBuffer);
};

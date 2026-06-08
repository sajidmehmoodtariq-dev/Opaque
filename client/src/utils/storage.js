import { openDB } from 'idb';

const DB_NAME = 'opaque_db';
const STORE_NAME = 'keys';
const MESSAGES_STORE = 'messages';

export const initDB = async () => {
  return openDB(DB_NAME, 2, {
    upgrade(db, oldVersion, newVersion, transaction) {
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME);
      }
      if (!db.objectStoreNames.contains(MESSAGES_STORE)) {
        // Create messages store with auto-incrementing ID for ordering
        const msgStore = db.createObjectStore(MESSAGES_STORE, { keyPath: 'id', autoIncrement: true });
        msgStore.createIndex('roomId', 'roomId', { unique: false });
      }
    },
  });
};

/**
 * Saves the RSA Private Key to IndexedDB.
 * Since IndexedDB supports the Structured Clone Algorithm, 
 * we can directly store the CryptoKey object. It never leaves the browser.
 */
export const savePrivateKey = async (userId, privateKey) => {
  const db = await initDB();
  await db.put(STORE_NAME, privateKey, `private_key_${userId}`);
};

/**
 * Retrieves the RSA Private Key from IndexedDB.
 */
export const getPrivateKey = async (userId) => {
  const db = await initDB();
  return db.get(STORE_NAME, `private_key_${userId}`);
};

/**
 * Saves a decrypted chat message to IndexedDB.
 * Local Storage: The decrypted chat history is saved only in the browser's IndexedDB.
 */
export const saveChatMessage = async (roomId, senderId, text, timestamp = Date.now()) => {
  const db = await initDB();
  await db.add(MESSAGES_STORE, {
    roomId,
    senderId,
    text,
    timestamp
  });
};

/**
 * Retrieves the local decrypted chat history for a specific room.
 */
export const getChatMessages = async (roomId) => {
  const db = await initDB();
  // Get all messages using the roomId index
  const tx = db.transaction(MESSAGES_STORE, 'readonly');
  const index = tx.store.index('roomId');
  const messages = await index.getAll(roomId);
  
  // Sort by timestamp just to be safe
  return messages.sort((a, b) => a.timestamp - b.timestamp);
};

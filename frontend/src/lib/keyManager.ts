/**
 * Key Manager Module for WhisperChain+
 * 
 * Handles secure storage of private keys in the browser with password protection.
 * The private key is encrypted with the user's password before storing in localStorage.
 */

import CryptoJS from 'crypto-js';

// Storage keys
const PRIVATE_KEY_STORAGE_KEY = 'whisperchain_encrypted_private_key';
const SALT_STORAGE_KEY = 'whisperchain_key_salt';

/**
 * Store a private key with password protection
 * 
 * @param privateKey The PEM format private key
 * @param password User's password for encrypting the key
 * @returns boolean indicating success
 */
export const storePrivateKey = (privateKey: string, password: string): boolean => {
  try {
    // Generate a random salt
    const salt = CryptoJS.lib.WordArray.random(128/8).toString();
    
    // Generate a key from the password and salt
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,
      iterations: 10000
    });
    
    // Encrypt the private key
    const encrypted = CryptoJS.AES.encrypt(privateKey, key.toString()).toString();
    
    // Store both the encrypted key and salt in localStorage
    localStorage.setItem(PRIVATE_KEY_STORAGE_KEY, encrypted);
    localStorage.setItem(SALT_STORAGE_KEY, salt);
    
    return true;
  } catch (error) {
    console.error('Error storing private key:', error);
    return false;
  }
};

/**
 * Retrieve and decrypt the stored private key
 * 
 * @param password User's password to decrypt the key
 * @returns The decrypted private key or null if fail
 */
export const getPrivateKey = (password: string): string | null => {
  try {
    // Retrieve the encrypted key and salt
    const encryptedKey = localStorage.getItem(PRIVATE_KEY_STORAGE_KEY);
    const salt = localStorage.getItem(SALT_STORAGE_KEY);
    
    if (!encryptedKey || !salt) {
      console.error('No encrypted key or salt found in storage');
      return null;
    }
    
    // Regenerate the key from the password and stored salt
    const key = CryptoJS.PBKDF2(password, salt, {
      keySize: 256/32,
      iterations: 10000
    });
    
    // Decrypt the private key
    const decrypted = CryptoJS.AES.decrypt(encryptedKey, key.toString());
    const privateKey = decrypted.toString(CryptoJS.enc.Utf8);
    
    if (!privateKey) {
      console.error('Failed to decrypt private key - likely wrong password');
      return null;
    }
    
    return privateKey;
  } catch (error) {
    console.error('Error retrieving private key:', error);
    return null;
  }
};

/**
 * Check if a private key is stored
 * 
 * @returns boolean indicating if an encrypted key exists
 */
export const hasStoredPrivateKey = (): boolean => {
  return localStorage.getItem(PRIVATE_KEY_STORAGE_KEY) !== null &&
         localStorage.getItem(SALT_STORAGE_KEY) !== null;
};

/**
 * Remove the stored private key
 * 
 * @returns boolean indicating success
 */
export const removePrivateKey = (): boolean => {
  try {
    localStorage.removeItem(PRIVATE_KEY_STORAGE_KEY);
    localStorage.removeItem(SALT_STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Error removing private key:', error);
    return false;
  }
};

/**
 * Verify if a password can correctly decrypt the stored key
 * 
 * @param password The password to verify
 * @returns boolean indicating if password is correct
 */
export const verifyPassword = (password: string): boolean => {
  return getPrivateKey(password) !== null;
}; 
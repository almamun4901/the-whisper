import CryptoJS from 'crypto-js';

// Either define or remove KeyManager import
interface KeyManagerInterface {
    generateAndStoreKeyPair(password: string): Promise<{ publicKey: string }>;
    encryptAndStoreKey(privateKey: string, password: string): void;
    decryptKey(password: string): boolean;
    decryptMessage(encryptedMessage: string): Promise<string>;
    clearDecryptedKey(): void;
    isKeyDecrypted(): boolean;
    hasStoredKey(): boolean;
    changeKeyPassword(currentPassword: string, newPassword: string): boolean;
}

class KeyManagerService implements KeyManagerInterface {
    private static instance: KeyManagerService;
    private decryptedKey: string | null = null;
    private readonly STORAGE_KEY = 'encrypted_private_key';
    private readonly SALT_KEY = 'key_salt';
    private readonly SESSION_KEY = 'session_key';
    private readonly KEY_ITERATIONS = 10000;

    private constructor() {}

    static getInstance(): KeyManagerService {
        if (!KeyManagerService.instance) {
            KeyManagerService.instance = new KeyManagerService();
        }
        return KeyManagerService.instance;
    }

    // Generate a new key pair and encrypt with password
    async generateAndStoreKeyPair(password: string): Promise<{ publicKey: string }> {
        try {
            // Generate key pair on server
            const response = await fetch('http://localhost:8000/generate-keypair', {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to generate key pair');
            }

            const data = await response.json();
            const privateKey = data.private_key;
            const publicKey = data.public_key;

            // Encrypt and store the private key locally
            this.encryptAndStoreKey(privateKey, password);
            
            // Set the decrypted key for the current session
            this.decryptedKey = privateKey;
            
            // Store session key in sessionStorage (cleared when browser closes)
            if (this.decryptedKey) {
                sessionStorage.setItem(this.SESSION_KEY, this.decryptedKey);
            }

            return { publicKey };
        } catch (error) {
            console.error('Error generating key pair:', error);
            throw new Error('Failed to generate and store key pair');
        }
    }

    // Encrypt the private key with password and store it
    encryptAndStoreKey(privateKey: string, password: string): void {
        try {
            // Generate a random salt
            const salt = CryptoJS.lib.WordArray.random(128/8).toString();
            
            // Generate a key from password and salt
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 256/32,
                iterations: this.KEY_ITERATIONS
            });
            
            // Encrypt the private key
            const encrypted = CryptoJS.AES.encrypt(privateKey, key.toString()).toString();
            
            // Store the encrypted key and salt
            localStorage.setItem(this.STORAGE_KEY, encrypted);
            localStorage.setItem(this.SALT_KEY, salt);
        } catch (error) {
            console.error('Error encrypting private key:', error);
            throw new Error('Failed to encrypt and store key');
        }
    }

    // Decrypt the private key using password
    decryptKey(password: string): boolean {
        try {
            const encryptedKey = localStorage.getItem(this.STORAGE_KEY);
            const salt = localStorage.getItem(this.SALT_KEY);
            
            if (!encryptedKey || !salt) {
                throw new Error('No encrypted key found');
            }

            // Generate key from password and salt
            const key = CryptoJS.PBKDF2(password, salt, {
                keySize: 256/32,
                iterations: this.KEY_ITERATIONS
            });
            
            // Decrypt the private key
            const decrypted = CryptoJS.AES.decrypt(encryptedKey, key.toString());
            const privateKey = decrypted.toString(CryptoJS.enc.Utf8);
            
            if (!privateKey) {
                console.error('Failed to decrypt key - likely wrong password');
                return false;
            }
            
            // Store the decrypted key in memory for this session
            this.decryptedKey = privateKey;
            
            // Also store in sessionStorage for persistence across page reloads
            sessionStorage.setItem(this.SESSION_KEY, this.decryptedKey);
            
            return true;
        } catch (error) {
            console.error('Error decrypting key:', error);
            return false;
        }
    }

    // Decrypt a message using the session key
    async decryptMessage(encryptedMessage: string): Promise<string> {
        // First check if key is in memory
        if (!this.decryptedKey) {
            // Try to get from sessionStorage
            const sessionKey = sessionStorage.getItem(this.SESSION_KEY);
            if (sessionKey) {
                this.decryptedKey = sessionKey;
            } else {
                throw new Error('Key not decrypted. Please enter your password first.');
            }
        }

        try {
            // Use client-side encryption to decrypt the message
            const response = await fetch('http://localhost:8000/messages/decrypt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token') || ''}`
                },
                body: JSON.stringify({
                    encrypted_message: encryptedMessage,
                    private_key: this.decryptedKey
                })
            });

            if (!response.ok) {
                throw new Error('Failed to decrypt message');
            }

            const data = await response.json();
            return data.decrypted_message;
        } catch (error) {
            console.error('Error decrypting message:', error);
            throw new Error('Failed to decrypt message');
        }
    }

    // Clear the decrypted key from memory and session storage
    clearDecryptedKey(): void {
        this.decryptedKey = null;
        sessionStorage.removeItem(this.SESSION_KEY);
    }

    // Check if key is currently decrypted
    isKeyDecrypted(): boolean {
        if (this.decryptedKey) return true;
        
        // Check sessionStorage as fallback
        const sessionKey = sessionStorage.getItem(this.SESSION_KEY);
        if (sessionKey) {
            this.decryptedKey = sessionKey;
            return true;
        }
        
        return false;
    }

    // Check if a key is stored in localStorage
    hasStoredKey(): boolean {
        return localStorage.getItem(this.STORAGE_KEY) !== null &&
               localStorage.getItem(this.SALT_KEY) !== null;
    }

    // Change password for the stored key
    changeKeyPassword(currentPassword: string, newPassword: string): boolean {
        try {
            // First decrypt with current password
            if (!this.decryptKey(currentPassword)) {
                return false;
            }
            
            // Then re-encrypt with new password
            if (this.decryptedKey) {
                this.encryptAndStoreKey(this.decryptedKey, newPassword);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Error changing password:', error);
            return false;
        }
    }
}

export const keyManager = KeyManagerService.getInstance(); 
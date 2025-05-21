import { KeyManager } from '../types';

class KeyManagerService {
    private static instance: KeyManagerService;
    private decryptedKey: string | null = null;
    private readonly STORAGE_KEY = 'encrypted_private_key';

    private constructor() {}

    static getInstance(): KeyManagerService {
        if (!KeyManagerService.instance) {
            KeyManagerService.instance = new KeyManagerService();
        }
        return KeyManagerService.instance;
    }

    // Store encrypted key in localStorage
    storeEncryptedKey(encryptedKey: string): void {
        localStorage.setItem(this.STORAGE_KEY, encryptedKey);
    }

    // Get encrypted key from localStorage
    getEncryptedKey(): string | null {
        return localStorage.getItem(this.STORAGE_KEY);
    }

    // Decrypt the key using the provided password
    async decryptKey(password: string): Promise<void> {
        const encryptedKey = this.getEncryptedKey();
        if (!encryptedKey) {
            throw new Error('No encrypted key found');
        }

        try {
            const response = await fetch('http://localhost:8000/decrypt-key', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                },
                body: JSON.stringify({
                    encrypted_key: encryptedKey,
                    key_password: password
                })
            });

            if (!response.ok) {
                throw new Error('Failed to decrypt key');
            }

            const data = await response.json();
            this.decryptedKey = data.decrypted_key;
        } catch (error) {
            throw new Error('Failed to decrypt key');
        }
    }

    // Decrypt a message using the decrypted key
    async decryptMessage(encryptedMessage: string): Promise<string> {
        if (!this.decryptedKey) {
            throw new Error('Key not decrypted');
        }

        try {
            const response = await fetch('http://localhost:8000/messages/decrypt', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
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
            throw new Error('Failed to decrypt message');
        }
    }

    // Clear the decrypted key from memory
    clearDecryptedKey(): void {
        this.decryptedKey = null;
    }

    // Check if key is currently decrypted
    isKeyDecrypted(): boolean {
        return this.decryptedKey !== null;
    }
}

export const keyManager = KeyManagerService.getInstance(); 
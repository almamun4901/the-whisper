"""
End-to-End Encryption System for WhisperChain+

This module provides:
1. Hybrid encryption (RSA + AES) for secure message exchange
2. Key management and storage
3. Message encryption/decryption utilities
4. Session key generation and management
"""

from cryptography.hazmat.primitives import hashes, serialization
from cryptography.hazmat.primitives.asymmetric import padding, rsa
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
import os
import base64
from typing import Tuple, Dict
import json

class E2EEncryption:
    def __init__(self):
        self.session_keys: Dict[str, bytes] = {}  # Store session keys for active sessions

    def generate_session_key(self) -> bytes:
        """Generate a random AES session key"""
        return os.urandom(32)  # 256-bit key for AES-256

    def encrypt_message(self, message: str, recipient_public_key: str) -> Tuple[str, str]:
        """
        Encrypt a message using hybrid encryption (RSA + AES)
        Returns: (encrypted_message, encrypted_session_key)
        """
        # Generate a new session key
        session_key = self.generate_session_key()
        
        # Load recipient's public key
        public_key = serialization.load_pem_public_key(recipient_public_key.encode())
        
        # Encrypt the session key with recipient's public key
        encrypted_session_key = public_key.encrypt(
            session_key,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Generate a random IV
        iv = os.urandom(16)
        
        # Create an encryptor object
        cipher = Cipher(
            algorithms.AES(session_key),
            modes.CBC(iv)
        )
        encryptor = cipher.encryptor()
        
        # Pad the message to be a multiple of 16 bytes
        padded_message = self._pad_message(message.encode())
        
        # Encrypt the message
        encrypted_message = encryptor.update(padded_message) + encryptor.finalize()
        
        # Combine IV and encrypted message
        final_message = iv + encrypted_message
        
        # Return base64 encoded encrypted message and session key
        return (
            base64.b64encode(final_message).decode(),
            base64.b64encode(encrypted_session_key).decode()
        )

    def decrypt_message(self, encrypted_message: str, encrypted_session_key: str, private_key_pem: str) -> str:
        """
        Decrypt a message using the private key and encrypted session key
        """
        # Load private key
        private_key = serialization.load_pem_private_key(
            private_key_pem.encode(),
            password=None
        )
        
        # Decrypt the session key
        encrypted_session_key_bytes = base64.b64decode(encrypted_session_key)
        session_key = private_key.decrypt(
            encrypted_session_key_bytes,
            padding.OAEP(
                mgf=padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Decode the encrypted message
        encrypted_data = base64.b64decode(encrypted_message)
        
        # Extract IV and encrypted message
        iv = encrypted_data[:16]
        encrypted_message = encrypted_data[16:]
        
        # Create a decryptor object
        cipher = Cipher(
            algorithms.AES(session_key),
            modes.CBC(iv)
        )
        decryptor = cipher.decryptor()
        
        # Decrypt the message
        padded_message = decryptor.update(encrypted_message) + decryptor.finalize()
        
        # Unpad the message
        return self._unpad_message(padded_message).decode()

    def _pad_message(self, message: bytes) -> bytes:
        """Pad the message to be a multiple of 16 bytes"""
        padding_length = 16 - (len(message) % 16)
        padding = bytes([padding_length] * padding_length)
        return message + padding

    def _unpad_message(self, padded_message: bytes) -> bytes:
        """Remove padding from the message"""
        padding_length = padded_message[-1]
        return padded_message[:-padding_length]

    def store_session_key(self, session_id: str, session_key: bytes):
        """Store a session key for later use"""
        self.session_keys[session_id] = session_key

    def get_session_key(self, session_id: str) -> bytes:
        """Retrieve a stored session key"""
        return self.session_keys.get(session_id)

    def clear_session_key(self, session_id: str):
        """Remove a stored session key"""
        if session_id in self.session_keys:
            del self.session_keys[session_id] 
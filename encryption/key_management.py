"""
Key management utilities for WhisperChain+.
Handles RSA key pair generation, encryption, and storage.
"""

from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives.asymmetric import rsa, padding
from cryptography.hazmat.primitives import serialization
import base64
import os
from typing import Tuple, Optional, Dict
import json

class KeyManager:
    def __init__(self):
        self.key_size = 2048  # RSA key size in bits
        self._session_key: Optional[bytes] = None
        self._session_private_key: Optional[bytes] = None
        self.user_keys_cache: Dict[str, object] = {}  # Cache for user keys

    def generate_key_pair(self):
        """Generate RSA key pair"""
        private_key = rsa.generate_private_key(
            public_exponent=65537,
            key_size=self.key_size
        )
        public_key = private_key.public_key()
        return public_key, private_key

    def encrypt_private_key(self, private_key, password: str) -> str:
        """Encrypt private key with password"""
        # Convert password to key using PBKDF2
        salt = os.urandom(16)
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000,
        )
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
        
        # Serialize private key
        private_key_pem = private_key.private_bytes(
            encoding=serialization.Encoding.PEM,
            format=serialization.PrivateFormat.PKCS8,
            encryption_algorithm=serialization.NoEncryption()
        )
        
        # Encrypt with Fernet
        f = Fernet(key)
        encrypted_key = f.encrypt(private_key_pem)
        
        # Combine salt and encrypted key
        combined = salt + encrypted_key
        return base64.b64encode(combined).decode('utf-8')

    def decrypt_private_key(self, encrypted_key: str, password: str):
        """Decrypt private key with password"""
        try:
            # Decode combined data
            combined = base64.b64decode(encrypted_key)
            salt = combined[:16]
            encrypted_key = combined[16:]
            
            # Derive key from password
            kdf = PBKDF2HMAC(
                algorithm=hashes.SHA256(),
                length=32,
                salt=salt,
                iterations=100000,
            )
            key = base64.urlsafe_b64encode(kdf.derive(password.encode()))
            
            # Decrypt with Fernet
            f = Fernet(key)
            private_key_pem = f.decrypt(encrypted_key)
            
            # Load private key
            return serialization.load_pem_private_key(
                private_key_pem,
                password=None
            )
        except Exception as e:
            raise Exception(f"Failed to decrypt private key: {str(e)}")

    def get_public_key_pem(self, public_key) -> str:
        """Convert public key to PEM format with proper headers"""
        try:
            # Convert to PEM format
            pem_bytes = public_key.public_bytes(
                encoding=serialization.Encoding.PEM,
                format=serialization.PublicFormat.SubjectPublicKeyInfo
            )
            
            # Ensure proper PEM format with headers
            pem_str = pem_bytes.decode('utf-8')
            if not pem_str.startswith('-----BEGIN PUBLIC KEY-----'):
                pem_str = '-----BEGIN PUBLIC KEY-----\n' + pem_str
            if not pem_str.endswith('-----END PUBLIC KEY-----\n'):
                pem_str = pem_str.rstrip() + '\n-----END PUBLIC KEY-----\n'
            
            return pem_str
        except Exception as e:
            print(f"Error formatting public key: {str(e)}")
            raise Exception(f"Failed to format public key: {str(e)}")

    def generate_and_encrypt_key_pair(self, password: str) -> dict:
        """Generate key pair and encrypt the private key with password"""
        public_key, private_key = self.generate_key_pair()
        encrypted_private_key = self.encrypt_private_key(private_key, password)
        public_key_pem = self.get_public_key_pem(public_key)
        
        return {
            "public_key": public_key_pem,
            "encrypted_private_key": encrypted_private_key
        }
    
    def store_user_key(self, user_id: str, encrypted_private_key: str, public_key: str) -> bool:
        """Store encrypted private key and public key for a user"""
        try:
            key_data = {
                "encrypted_private_key": encrypted_private_key,
                "public_key": public_key
            }
            
            # Store key data in a file named after the user ID
            key_file_path = f"user_keys/{user_id}.json"
            os.makedirs(os.path.dirname(key_file_path), exist_ok=True)
            
            with open(key_file_path, 'w') as f:
                json.dump(key_data, f)
                
            return True
        except Exception as e:
            print(f"Error storing user key: {str(e)}")
            return False
    
    def get_user_key(self, user_id: str) -> Optional[dict]:
        """Get encrypted private key and public key for a user"""
        try:
            # First check if key is in cache
            if user_id in self.user_keys_cache:
                return self.user_keys_cache[user_id]
            
            # If not in cache, read from file
            key_file_path = f"user_keys/{user_id}.json"
            if not os.path.exists(key_file_path):
                return None
                
            with open(key_file_path, 'r') as f:
                key_data = json.load(f)
                
            # Store in cache for future use
            self.user_keys_cache[user_id] = key_data
            return key_data
        except Exception as e:
            print(f"Error getting user key: {str(e)}")
            return None
    
    def verify_key_password(self, encrypted_private_key: str, password: str) -> bool:
        """Verify if the password can decrypt the private key"""
        try:
            self.decrypt_private_key(encrypted_private_key, password)
            return True
        except Exception:
            return False
    
    def set_session_key(self, private_key: bytes):
        """Store private key in memory for session duration"""
        self._session_private_key = private_key

    def get_session_key(self) -> Optional[bytes]:
        """Get private key from memory"""
        return self._session_private_key

    def clear_session_key(self):
        """Clear private key from memory"""
        self._session_private_key = None 
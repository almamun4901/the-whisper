"""
Message encryption utilities for WhisperChain+.
Handles message encryption and decryption using RSA and AES.
"""

from cryptography.hazmat.primitives import hashes, serialization, padding
from cryptography.hazmat.primitives.asymmetric import rsa, padding as asym_padding
from cryptography.hazmat.primitives.ciphers import Cipher, algorithms, modes
import base64
import os

def encrypt_message(message: str, public_key_pem: str) -> str:
    """
    Encrypt a message using the recipient's public key.
    Uses hybrid encryption (RSA + AES) for better performance.
    
    Args:
        message (str): The message to encrypt
        public_key_pem (str): The recipient's public key in PEM format
        
    Returns:
        str: The encrypted message in base64 format
    """
    try:
        # Load the public key from PEM format
        public_key = serialization.load_pem_public_key(
            public_key_pem.encode('utf-8')
        )
        
        # Generate a random AES key
        aes_key = os.urandom(32)  # 256 bits
        
        # Encrypt the message with AES
        iv = os.urandom(16)  # Initialization vector
        cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
        encryptor = cipher.encryptor()
        
        # Pad the message
        padder = padding.PKCS7(algorithms.AES.block_size).padder()
        padded_data = padder.update(message.encode()) + padder.finalize()
        
        # Encrypt the padded message
        encrypted_message = encryptor.update(padded_data) + encryptor.finalize()
        
        # Encrypt the AES key with RSA
        encrypted_key = public_key.encrypt(
            aes_key,
            asym_padding.OAEP(
                mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Combine IV, encrypted key, and encrypted message
        combined = iv + encrypted_key + encrypted_message
        
        # Convert to base64
        return base64.b64encode(combined).decode('utf-8')
        
    except Exception as e:
        print(f"Encryption error details: {str(e)}")
        raise Exception(f"Failed to encrypt message: {str(e)}")

def decrypt_message(encrypted_data: str, private_key) -> str:
    """
    Decrypt a message using the recipient's private key.
    
    Args:
        encrypted_data (str): The encrypted message in base64 format
        private_key: The recipient's private key object
        
    Returns:
        str: The decrypted message
    """
    try:
        # Decode the encrypted data
        combined = base64.b64decode(encrypted_data)
        
        # Extract IV, encrypted key, and encrypted message
        iv = combined[:16]
        encrypted_key = combined[16:272]  # RSA-2048 encrypted key size
        encrypted_message = combined[272:]
        
        # Decrypt the AES key
        aes_key = private_key.decrypt(
            encrypted_key,
            asym_padding.OAEP(
                mgf=asym_padding.MGF1(algorithm=hashes.SHA256()),
                algorithm=hashes.SHA256(),
                label=None
            )
        )
        
        # Decrypt the message
        cipher = Cipher(algorithms.AES(aes_key), modes.CBC(iv))
        decryptor = cipher.decryptor()
        
        # Decrypt and unpad
        padded_message = decryptor.update(encrypted_message) + decryptor.finalize()
        unpadder = padding.PKCS7(algorithms.AES.block_size).unpadder()
        message = unpadder.update(padded_message) + unpadder.finalize()
        
        return message.decode('utf-8')
    except Exception as e:
        print(f"Decryption error details: {str(e)}")
        raise Exception(f"Failed to decrypt message: {str(e)}") 
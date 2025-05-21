"""
Message Service for WhisperChain+

This service handles:
1. Message creation with encryption
2. Message retrieval and decryption
3. Message status updates
"""

from sqlalchemy.orm import Session
from models.message import Message
from encryption.e2e_encryption import E2EEncryption
from typing import List, Optional
from datetime import datetime

class MessageService:
    def __init__(self):
        self.encryption = E2EEncryption()

    def create_message(
        self,
        db: Session,
        content: str,
        sender_id: int,
        recipient_id: int,
        recipient_public_key: str
    ) -> Message:
        """
        Create and encrypt a new message
        """
        # Encrypt the message
        encrypted_content, encrypted_session_key = self.encryption.encrypt_message(
            content,
            recipient_public_key
        )

        # Create message object
        message = Message(
            content=encrypted_content,
            encrypted_session_key=encrypted_session_key,
            sender_id=sender_id,
            recipient_id=recipient_id,
            created_at=datetime.utcnow(),
            read=False
        )

        # Save to database
        db.add(message)
        db.commit()
        db.refresh(message)

        return message

    def get_message(
        self,
        db: Session,
        message_id: int,
        recipient_private_key: str
    ) -> Optional[dict]:
        """
        Retrieve and decrypt a message
        """
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            return None

        try:
            # Decrypt the message
            decrypted_content = self.encryption.decrypt_message(
                message.content,
                message.encrypted_session_key,
                recipient_private_key
            )

            # Mark as read
            message.read = True
            db.commit()

            return {
                "id": message.id,
                "content": decrypted_content,
                "sender_id": message.sender_id,
                "recipient_id": message.recipient_id,
                "created_at": message.created_at,
                "read": message.read
            }
        except Exception as e:
            # Log the error and return None
            print(f"Error decrypting message: {str(e)}")
            return None

    def get_user_messages(
        self,
        db: Session,
        user_id: int,
        private_key: str,
        limit: int = 50,
        offset: int = 0
    ) -> List[dict]:
        """
        Get all messages for a user (both sent and received)
        """
        messages = db.query(Message).filter(
            (Message.sender_id == user_id) | (Message.recipient_id == user_id)
        ).order_by(Message.created_at.desc()).offset(offset).limit(limit).all()

        decrypted_messages = []
        for message in messages:
            try:
                decrypted_content = self.encryption.decrypt_message(
                    message.content,
                    message.encrypted_session_key,
                    private_key
                )

                decrypted_messages.append({
                    "id": message.id,
                    "content": decrypted_content,
                    "sender_id": message.sender_id,
                    "recipient_id": message.recipient_id,
                    "created_at": message.created_at,
                    "read": message.read
                })
            except Exception as e:
                print(f"Error decrypting message {message.id}: {str(e)}")
                continue

        return decrypted_messages

    def mark_as_read(self, db: Session, message_id: int) -> bool:
        """
        Mark a message as read
        """
        message = db.query(Message).filter(Message.id == message_id).first()
        if not message:
            return False

        message.read = True
        db.commit()
        return True 
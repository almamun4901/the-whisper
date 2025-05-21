import React, { useState, useEffect } from 'react';
import { Card, Button, Spinner, Alert } from 'react-bootstrap';
import { keyManager } from '../services/keyManager';
import KeyPasswordModal from './KeyPasswordModal';

interface Message {
    id: number;
    sender_username: string;
    content: string;
    created_at: string;
    read: boolean;
}

const Inbox: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showKeyModal, setShowKeyModal] = useState(false);
    const [decryptedMessages, setDecryptedMessages] = useState<{ [key: number]: string }>({});

    const fetchMessages = async () => {
        try {
            const response = await fetch('http://localhost:8000/messages/inbox', {
                headers: {
                    'Authorization': `Bearer ${localStorage.getItem('token')}`
                }
            });
            if (!response.ok) throw new Error('Failed to fetch messages');
            const data = await response.json();
            setMessages(data);
        } catch (err) {
            setError('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchMessages();
    }, []);

    const handleDecryptMessages = async () => {
        if (!keyManager.isKeyDecrypted()) {
            setShowKeyModal(true);
            return;
        }
        await decryptAllMessages();
    };

    const decryptAllMessages = async () => {
        const newDecryptedMessages: { [key: number]: string } = {};
        for (const message of messages) {
            try {
                const decryptedContent = await keyManager.decryptMessage(message.content);
                newDecryptedMessages[message.id] = decryptedContent;
            } catch (err) {
                newDecryptedMessages[message.id] = 'Failed to decrypt message';
            }
        }
        setDecryptedMessages(newDecryptedMessages);
    };

    const handleKeyDecryptionSuccess = () => {
        decryptAllMessages();
    };

    if (loading) {
        return <Spinner animation="border" />;
    }

    return (
        <div className="container mt-4">
            <h2>Inbox</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            
            <Button 
                variant="primary" 
                className="mb-3"
                onClick={handleDecryptMessages}
            >
                {keyManager.isKeyDecrypted() ? 'Refresh Messages' : 'Decrypt Messages'}
            </Button>

            {messages.map((message) => (
                <Card key={message.id} className="mb-3">
                    <Card.Header>
                        From: {message.sender_username}
                        <small className="float-end">
                            {new Date(message.created_at).toLocaleString()}
                        </small>
                    </Card.Header>
                    <Card.Body>
                        {decryptedMessages[message.id] ? (
                            <Card.Text>{decryptedMessages[message.id]}</Card.Text>
                        ) : (
                            <Card.Text className="text-muted">
                                Message is encrypted. Click "Decrypt Messages" to view.
                            </Card.Text>
                        )}
                    </Card.Body>
                </Card>
            ))}

            <KeyPasswordModal
                show={showKeyModal}
                onHide={() => setShowKeyModal(false)}
                onSuccess={handleKeyDecryptionSuccess}
            />
        </div>
    );
};

export default Inbox; 
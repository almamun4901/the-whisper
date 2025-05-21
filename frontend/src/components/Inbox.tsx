import React, { useState, useEffect } from 'react';
import KeyDecryption from './KeyDecryption';

interface Message {
    id: number;
    sender_id: number;
    sender_name: string;
    encrypted_content: string;
    created_at: string;
}

const Inbox: React.FC = () => {
    const [messages, setMessages] = useState<Message[]>([]);
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const [selectedMessage, setSelectedMessage] = useState<Message | null>(null);
    const [decryptedContent, setDecryptedContent] = useState<{ [key: number]: string }>({});

    useEffect(() => {
        fetchMessages();
    }, []);

    const fetchMessages = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            if (!token) {
                setError('Authentication required. Please log in.');
                setLoading(false);
                return;
            }

            const response = await fetch('http://localhost:8000/messages/inbox', {
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });

            if (!response.ok) {
                throw new Error('Failed to fetch messages');
            }

            const data = await response.json();
            setMessages(data.messages || []);
        } catch (err) {
            setError('Error loading messages. Please try again.');
            console.error('Fetch error:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleDecrypt = (messageId: number, decryptedMessage: string) => {
        setDecryptedContent(prev => ({
            ...prev,
            [messageId]: decryptedMessage
        }));
        setSelectedMessage(null);
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleString();
    };

    if (loading) {
        return <div className="loading">Loading messages...</div>;
    }

    if (error) {
        return <div className="error-message">{error}</div>;
    }

    return (
        <div className="inbox">
            <h2>Your Messages</h2>
            
            <button 
                className="refresh-button"
                onClick={fetchMessages}
            >
                Refresh Messages
            </button>
            
            {messages.length === 0 ? (
                <p>No messages in your inbox</p>
            ) : (
                <div className="message-list">
                    {messages.map(message => (
                        <div key={message.id} className="message-item">
                            <div className="message-header">
                                <strong>From: {message.sender_name}</strong>
                                <span className="message-date">{formatDate(message.created_at)}</span>
                            </div>
                            
                            {decryptedContent[message.id] ? (
                                <div className="message-content">
                                    <p>{decryptedContent[message.id]}</p>
                                </div>
                            ) : (
                                <div className="message-actions">
                                    <button 
                                        onClick={() => setSelectedMessage(message)}
                                        className="decrypt-button"
                                    >
                                        Decrypt Message
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
            
            {selectedMessage && (
                <div className="modal-overlay">
                    <div className="modal-content">
                        <button 
                            className="modal-close"
                            onClick={() => setSelectedMessage(null)}
                        >
                            ×
                        </button>
                        <h3>Decrypt Message from {selectedMessage.sender_name}</h3>
                        <KeyDecryption 
                            encryptedMessage={selectedMessage.encrypted_content}
                            onDecrypt={(decryptedMessage) => handleDecrypt(selectedMessage.id, decryptedMessage)}
                        />
                    </div>
                </div>
            )}
            
            <style jsx>{`
                .inbox {
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 20px;
                }
                
                h2 {
                    margin-bottom: 20px;
                    color: #333;
                }
                
                .refresh-button {
                    margin-bottom: 20px;
                    background-color: #3498db;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 10px 15px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .refresh-button:hover {
                    background-color: #2980b9;
                }
                
                .message-list {
                    display: flex;
                    flex-direction: column;
                    gap: 15px;
                }
                
                .message-item {
                    border: 1px solid #ddd;
                    border-radius: 8px;
                    padding: 15px;
                    background-color: #f9f9f9;
                }
                
                .message-header {
                    display: flex;
                    justify-content: space-between;
                    margin-bottom: 10px;
                    padding-bottom: 10px;
                    border-bottom: 1px solid #eee;
                }
                
                .message-date {
                    color: #666;
                    font-size: 0.9em;
                }
                
                .message-content {
                    margin-top: 10px;
                    white-space: pre-wrap;
                }
                
                .message-actions {
                    margin-top: 10px;
                }
                
                .decrypt-button {
                    background-color: #4CAF50;
                    color: white;
                    border: none;
                    border-radius: 4px;
                    padding: 8px 15px;
                    cursor: pointer;
                    font-size: 14px;
                }
                
                .decrypt-button:hover {
                    background-color: #45a049;
                }
                
                .modal-overlay {
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    bottom: 0;
                    background-color: rgba(0, 0, 0, 0.5);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 1000;
                }
                
                .modal-content {
                    background-color: white;
                    padding: 20px;
                    border-radius: 8px;
                    min-width: 400px;
                    max-width: 600px;
                    position: relative;
                    box-shadow: 0 4px 8px rgba(0,0,0,0.1);
                }
                
                .modal-close {
                    position: absolute;
                    top: 10px;
                    right: 10px;
                    background: none;
                    border: none;
                    font-size: 24px;
                    cursor: pointer;
                    color: #666;
                }
                
                .error-message {
                    color: #f44336;
                    padding: 15px;
                    margin-bottom: 15px;
                    border: 1px solid #f44336;
                    border-radius: 4px;
                    background-color: #ffebee;
                }
                
                .loading {
                    padding: 20px;
                    text-align: center;
                    color: #666;
                    font-size: 16px;
                }
            `}</style>
        </div>
    );
};

export default Inbox; 
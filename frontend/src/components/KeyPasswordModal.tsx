import React, { useState } from 'react';
import { Modal, Button, Form, Alert } from 'react-bootstrap';
import { keyManager } from '../services/keyManager';

interface KeyPasswordModalProps {
    show: boolean;
    onHide: () => void;
    onSuccess: () => void;
}

const KeyPasswordModal: React.FC<KeyPasswordModalProps> = ({ show, onHide, onSuccess }) => {
    const [keyPassword, setKeyPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setLoading(true);

        try {
            // Use the new client-side decryption
            const success = keyManager.decryptKey(keyPassword);
            
            if (success) {
                onSuccess();
                onHide();
            } else {
                setError('Invalid password. Please try again.');
            }
        } catch (err) {
            setError('Error decrypting key. Please try again.');
            console.error('Key decryption error:', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Enter Key Password</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <p className="text-muted mb-3">
                    Your private key is encrypted with a password for security.
                    Enter your password to decrypt it and read your messages.
                </p>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Key Password</Form.Label>
                        <Form.Control
                            type="password"
                            value={keyPassword}
                            onChange={(e) => setKeyPassword(e.target.value)}
                            placeholder="Enter your key password"
                            disabled={loading}
                            required
                        />
                    </Form.Group>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Button 
                        variant="primary" 
                        type="submit" 
                        className="w-100" 
                        disabled={loading}
                    >
                        {loading ? 'Decrypting...' : 'Decrypt Key'}
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default KeyPasswordModal; 
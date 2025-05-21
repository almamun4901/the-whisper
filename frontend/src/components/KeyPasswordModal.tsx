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

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        try {
            await keyManager.decryptKey(keyPassword);
            onSuccess();
            onHide();
        } catch (err) {
            setError('Invalid key password');
        }
    };

    return (
        <Modal show={show} onHide={onHide} centered>
            <Modal.Header closeButton>
                <Modal.Title>Enter Key Password</Modal.Title>
            </Modal.Header>
            <Modal.Body>
                <Form onSubmit={handleSubmit}>
                    <Form.Group className="mb-3">
                        <Form.Label>Key Password</Form.Label>
                        <Form.Control
                            type="password"
                            value={keyPassword}
                            onChange={(e) => setKeyPassword(e.target.value)}
                            placeholder="Enter your key password"
                            required
                        />
                    </Form.Group>
                    {error && <Alert variant="danger">{error}</Alert>}
                    <Button variant="primary" type="submit" className="w-100">
                        Decrypt Key
                    </Button>
                </Form>
            </Modal.Body>
        </Modal>
    );
};

export default KeyPasswordModal; 
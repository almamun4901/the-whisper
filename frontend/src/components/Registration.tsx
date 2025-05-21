import React, { useState } from 'react';
import { Form, Button, Alert } from 'react-bootstrap';
import { useNavigate } from 'react-router-dom';
import { keyManager } from '../services/keyManager';

interface UserRegistration {
    username: string;
    password: string;
    role: string;
    key_password: string;
}

const Registration: React.FC = () => {
    const navigate = useNavigate();
    const [formData, setFormData] = useState<UserRegistration>({
        username: '',
        password: '',
        key_password: '',
        role: 'receiver'
    });
    const [error, setError] = useState('');
    const [validationErrors, setValidationErrors] = useState({
        username: '',
        password: '',
        key_password: ''
    });

    const validateForm = () => {
        const errors = {
            username: '',
            password: '',
            key_password: ''
        };

        // Username validation
        if (!/\d/.test(formData.username)) {
            errors.username = 'Username must contain at least one number';
        }

        // Key password validation
        if (formData.key_password.length < 8) {
            errors.key_password = 'Key password must be at least 8 characters long';
        } else {
            if (!/[A-Z]/.test(formData.key_password)) {
                errors.key_password = 'Key password must contain at least one uppercase letter';
            }
            if (!/[a-z]/.test(formData.key_password)) {
                errors.key_password = 'Key password must contain at least one lowercase letter';
            }
            if (!/\d/.test(formData.key_password)) {
                errors.key_password = 'Key password must contain at least one number';
            }
        }

        setValidationErrors(errors);
        return !Object.values(errors).some(error => error !== '');
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');

        if (!validateForm()) {
            return;
        }

        try {
            const requestData = {
                username: formData.username,
                password: formData.password,
                role: formData.role,
                key_password: formData.key_password
            };

            // Log the exact data being sent
            console.log('Sending registration data:', requestData);

            const response = await fetch('http://localhost:8000/register', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Accept': 'application/json'
                },
                body: JSON.stringify(requestData)
            });

            // Log the raw response
            console.log('Response status:', response.status);
            const responseText = await response.text();
            console.log('Response text:', responseText);

            if (!response.ok) {
                let errorMessage = 'Registration failed';
                try {
                    const data = JSON.parse(responseText);
                    errorMessage = data.detail || errorMessage;
                    console.error('Registration error details:', data);
                } catch (e) {
                    console.error('Error parsing response:', e);
                }
                throw new Error(errorMessage);
            }

            const data = JSON.parse(responseText);
            console.log('Registration success:', data);
            
            // Store the encrypted private key
            keyManager.storeEncryptedKey(data.encrypted_private_key);
            
            // Store the token
            localStorage.setItem('token', data.access_token);
            
            navigate('/status');
        } catch (err) {
            console.error('Registration error:', err);
            setError(err instanceof Error ? err.message : 'Registration failed');
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
        // Clear validation error when user starts typing
        setValidationErrors(prev => ({
            ...prev,
            [name]: ''
        }));
    };

    return (
        <div className="container mt-5">
            <h2>Register</h2>
            {error && <Alert variant="danger">{error}</Alert>}
            
            <Form onSubmit={handleSubmit}>
                <Form.Group className="mb-3">
                    <Form.Label>Username</Form.Label>
                    <Form.Control
                        type="text"
                        name="username"
                        value={formData.username}
                        onChange={handleChange}
                        placeholder="Enter username (must contain a number)"
                        required
                        isInvalid={!!validationErrors.username}
                    />
                    <Form.Control.Feedback type="invalid">
                        {validationErrors.username}
                    </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Password</Form.Label>
                    <Form.Control
                        type="password"
                        name="password"
                        value={formData.password}
                        onChange={handleChange}
                        placeholder="Enter password"
                        required
                        isInvalid={!!validationErrors.password}
                    />
                    <Form.Control.Feedback type="invalid">
                        {validationErrors.password}
                    </Form.Control.Feedback>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Key Password</Form.Label>
                    <Form.Control
                        type="password"
                        name="key_password"
                        value={formData.key_password}
                        onChange={handleChange}
                        placeholder="Enter key password (for encrypting your private key)"
                        required
                        isInvalid={!!validationErrors.key_password}
                    />
                    <Form.Control.Feedback type="invalid">
                        {validationErrors.key_password}
                    </Form.Control.Feedback>
                    <Form.Text className="text-muted">
                        This password will be used to encrypt your private key. 
                        It must be at least 8 characters long and contain uppercase, 
                        lowercase, and numbers.
                    </Form.Text>
                </Form.Group>

                <Form.Group className="mb-3">
                    <Form.Label>Role</Form.Label>
                    <Form.Select
                        name="role"
                        value={formData.role}
                        onChange={handleChange}
                        required
                    >
                        <option value="receiver">Receiver</option>
                        <option value="sender">Sender</option>
                    </Form.Select>
                </Form.Group>

                <Button variant="primary" type="submit">
                    Register
                </Button>
            </Form>
        </div>
    );
};

export default Registration; 
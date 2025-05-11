# WhisperChain+

A secure, role-based anonymous messaging platform that enables users to send encrypted anonymous compliments while maintaining sender privacy and preventing abuse.

## Project Structure

## File Descriptions

### Backend
- `main.py`: FastAPI application setup, middleware configuration, and route registration
- `routes/*.py`: API endpoint definitions for each feature area
- `services/*.py`: Business logic implementation for each feature

### Models
- `user.py`: User account data, roles, and cryptographic keys
- `message.py`: Encrypted message structure and metadata
- `token.py`: One-time use anonymous token structure
- `audit_log.py`: System event logging structure

### Encryption
- `key_utils.py`: RSA/ECC key pair generation and management
- `crypto_utils.py`: Message encryption/decryption using hybrid encryption

### Auth
- `rbac.py`: Role-based access control definitions and enforcement
- `session_manager.py`: User session handling and validation

### Logs
- `audit_logger.py`: Append-only logging with digital signatures

### Database
- `config.py`: Database connection settings and environment configuration
- `db_session.py`: SQLAlchemy session management

### Tests
- Test files for each major component of the system

## Setup Instructions

1. Create a virtual environment:
   ```bash
   python -m venv venv
   source venv/bin/activate  # On Windows: venv\Scripts\activate
   ```

2. Install dependencies:
   ```bash
   pip install -r requirements.txt
   ```

3. Initialize the database:
   ```bash
   python backend/database/init_db.py
   ```

4. Start the server:
   ```bash
   python run.py
   ```

## Security Features

- End-to-end encryption for messages
- Role-based access control
- One-time use anonymous tokens
- Append-only audit logging
- Sender anonymity preservation

import React, { useState } from 'react'
import { useToast } from './ui/use-toast'

interface KeyDecryptionProps {
  onDecrypt: (decryptedMessage: string) => void
  encryptedMessage: string
}

const KeyDecryption: React.FC<KeyDecryptionProps> = ({ onDecrypt, encryptedMessage }) => {
  const [keyPassword, setKeyPassword] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        setError('Authentication required. Please log in.')
        setLoading(false)
        return
      }

      const response = await fetch('http://localhost:8000/messages/decrypt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          encrypted_message: encryptedMessage,
          key_password: keyPassword
        })
      })

      const data = await response.json()
      
      if (!response.ok) {
        setError(data.detail || 'Failed to decrypt message')
        setLoading(false)
        return
      }

      // Pass the decrypted message to the parent component
      onDecrypt(data.decrypted_message)
      
      // Clear the password field
      setKeyPassword('')
      
      toast({
        title: "Message decrypted successfully",
        description: "You can now read your message",
      })
    } catch (err) {
      setError('Error decrypting message. Please try again.')
      console.error('Decryption error:', err)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="key-decryption">
      <h3>Enter Key Password</h3>
      <p>Your message is encrypted. Enter your key password to decrypt it.</p>
      
      <form onSubmit={handleDecrypt}>
        <div className="form-group">
          <label htmlFor="keyPassword">Key Password:</label>
          <input
            type="password"
            id="keyPassword"
            value={keyPassword}
            onChange={(e) => setKeyPassword(e.target.value)}
            placeholder="Enter your key password"
            disabled={loading}
            required
          />
        </div>
        
        {error && <div className="error-message">{error}</div>}
        
        <button 
          type="submit" 
          disabled={loading || !keyPassword}
        >
          {loading ? 'Decrypting...' : 'Decrypt Message'}
        </button>
      </form>
      
      <style jsx>{`
        .key-decryption {
          margin: 20px 0;
          padding: 20px;
          border: 1px solid #ccc;
          border-radius: 5px;
          background-color: #f9f9f9;
        }
        
        .form-group {
          margin-bottom: 15px;
        }
        
        label {
          display: block;
          margin-bottom: 5px;
          font-weight: bold;
        }
        
        input {
          width: 100%;
          padding: 10px;
          border: 1px solid #ccc;
          border-radius: 4px;
          font-size: 16px;
        }
        
        button {
          padding: 10px 15px;
          background-color: #4CAF50;
          color: white;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          font-size: 16px;
        }
        
        button:disabled {
          background-color: #cccccc;
          cursor: not-allowed;
        }
        
        .error-message {
          color: #f44336;
          margin-bottom: 15px;
        }
      `}</style>
    </div>
  )
}

export default KeyDecryption 
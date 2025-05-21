import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface Message {
  id: number
  sender_username: string
  content: string
  created_at: string
  read: boolean
}

const Inbox = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [decryptedMessages, setDecryptedMessages] = useState<{[key: number]: string}>({})
  const [keyPassword, setKeyPassword] = useState('')
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchMessages = async () => {
      try {
        const response = await axios.get('http://localhost:8000/messages/inbox', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        console.log('Fetched messages:', response.data)
        setMessages(response.data)
      } catch (error) {
        console.error('Failed to fetch messages:', error)
        setError('Failed to load messages')
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [navigate])

  const handleDecrypt = async (messageId: number, encryptedContent: string) => {
    console.log('Starting decryption for message:', messageId)
    const encryptedKey = localStorage.getItem('encryptedPrivateKey')
    if (!encryptedKey) {
      setError('No encrypted private key found. Please register again.')
      return
    }

    setShowKeyModal(true)
  }

  const handleKeyDecryption = async () => {
    if (!keyPassword) {
      setError('Please enter your key password')
      return
    }

    try {
      console.log('Decrypting private key...')
      // First decrypt the private key
      const keyResponse = await axios.post('http://localhost:8000/decrypt-key', {
        encrypted_key: localStorage.getItem('encryptedPrivateKey'),
        key_password: keyPassword
      }, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })

      const decryptedKey = keyResponse.data.decrypted_key
      console.log('Private key decrypted successfully')

      // Now decrypt all messages
      const newDecryptedMessages: {[key: number]: string} = {}
      for (const message of messages) {
        try {
          console.log('Decrypting message:', message.id)
          const response = await axios.post(
            'http://localhost:8000/messages/decrypt',
            {
              encrypted_content: message.content,
              private_key: decryptedKey
            },
            {
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${localStorage.getItem('token')}`
              }
            }
          )
          
          console.log('Message decrypted:', response.data)
          newDecryptedMessages[message.id] = response.data.decrypted_content

          // Mark as read
          await axios.get(`http://localhost:8000/messages/${message.id}/mark-read`, {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`
            }
          })
        } catch (error: any) {
          console.error('Failed to decrypt message:', error)
          newDecryptedMessages[message.id] = error.response?.data?.detail || 'Failed to decrypt message'
        }
      }

      console.log('All messages decrypted:', newDecryptedMessages)
      setDecryptedMessages(newDecryptedMessages)
      setShowKeyModal(false)
      setKeyPassword('')
    } catch (error: any) {
      console.error('Failed to decrypt key:', error)
      setError(error.response?.data?.detail || 'Failed to decrypt key. Please check your password.')
    }
  }

  return (
    <div className="min-h-screen bg-background p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold text-white">Inbox</h1>
          <button
            onClick={() => navigate('/dashboard')}
            className="px-4 py-2 bg-muted text-white rounded-md hover:bg-muted/80 transition"
          >
            Back to Dashboard
          </button>
        </div>

        {error && (
          <div className="bg-destructive/10 text-white p-3 rounded-md mb-4">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-center py-8 text-white">Loading messages...</p>
        ) : messages.length === 0 ? (
          <div className="bg-card p-8 rounded-lg shadow text-center">
            <p className="text-white">No messages in your inbox</p>
          </div>
        ) : (
          <div className="space-y-4">
            {messages.map((message) => (
              <div 
                key={message.id} 
                className={`bg-card p-4 rounded-lg shadow ${!message.read ? 'border-l-4 border-primary' : ''}`}
              >
                <div className="flex justify-between">
                  <h3 className="font-medium text-white">From: {message.sender_username}</h3>
                  <span className="text-xs text-white/70">
                    {new Date(message.created_at).toLocaleString()}
                  </span>
                </div>
                
                {decryptedMessages[message.id] ? (
                  <div className="mt-2 p-3 bg-muted/30 rounded">
                    <p className="text-white">{decryptedMessages[message.id]}</p>
                  </div>
                ) : (
                  <div className="mt-2">
                    <p className="text-white/70 italic">Encrypted message</p>
                    <button
                      onClick={() => handleDecrypt(message.id, message.content)}
                      className="mt-2 px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary/90"
                    >
                      Decrypt Message
                    </button>
                  </div>
                )}
                
                {!message.read && !decryptedMessages[message.id] && (
                  <div className="mt-2 text-xs text-primary font-medium">
                    Unread
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {showKeyModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4 text-white">Enter Key Password</h2>
              <p className="text-sm text-white/70 mb-4">
                Enter your key password to decrypt messages
              </p>
              <input
                type="password"
                value={keyPassword}
                onChange={(e) => setKeyPassword(e.target.value)}
                className="w-full p-2 border rounded mb-4 text-white bg-muted/30"
                placeholder="Enter your key password"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    handleKeyDecryption()
                  }
                }}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowKeyModal(false)
                    setKeyPassword('')
                  }}
                  className="px-4 py-2 bg-muted text-white rounded hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={handleKeyDecryption}
                  className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
                >
                  Decrypt
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default Inbox 
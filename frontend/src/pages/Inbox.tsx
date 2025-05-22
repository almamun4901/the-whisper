import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import CryptoJS from 'crypto-js'
import { useToast } from '../components/ui/use-toast'

interface Message {
  id: number
  sender_name: string
  encrypted_content: string
  plain_content?: string
  created_at: string
  read: boolean
  is_flagged: boolean
}

const Inbox = () => {
  const [messages, setMessages] = useState<Message[]>([])
  const [loading, setLoading] = useState(true)
  const [decryptLoading, setDecryptLoading] = useState(false)
  const [error, setError] = useState('')
  const [showKeyModal, setShowKeyModal] = useState(false)
  const [showFlagModal, setShowFlagModal] = useState(false)
  const [flagReason, setFlagReason] = useState('')
  const [selectedMessageId, setSelectedMessageId] = useState<number | null>(null)
  const [decryptedMessages, setDecryptedMessages] = useState<{[key: number]: string}>({})
  const [keyPassword, setKeyPassword] = useState('')
  const [currentMessageId, setCurrentMessageId] = useState<number | null>(null)
  const [currentEncryptedContent, setCurrentEncryptedContent] = useState('')
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    const fetchMessages = async () => {
      try {
        console.log('Fetching messages with token:', token?.substring(0, 5) + '...')
        
        const response = await axios.get('http://localhost:8000/messages/inbox', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        
        console.log('Raw response:', response)
        console.log('Fetched messages:', response.data)
        
        // Check if response.data is an array
        if (!Array.isArray(response.data)) {
          console.error('Response is not an array:', response.data)
          setError('Messages data has unexpected format')
          setMessages([])
        } else {
          setMessages(response.data || [])
        }
      } catch (error: any) {
        console.error('Failed to fetch messages:', error)
        console.error('Error details:', error.response?.data)
        setError(`Failed to load messages: ${error.message}. ${error.response?.data?.detail || ''}`)
      } finally {
        setLoading(false)
      }
    }

    fetchMessages()
  }, [navigate])

  const handleDecrypt = async (messageId: number, encryptedContent: string) => {
    console.log('Starting decryption for message:', messageId)
    setCurrentMessageId(messageId)
    setCurrentEncryptedContent(encryptedContent)
    setShowKeyModal(true)
  }

  const handleKeyDecryption = async () => {
    if (!keyPassword) {
      setError('Please enter your key password')
      return
    }

    if (!currentMessageId || !currentEncryptedContent) {
      setError('No message selected for decryption')
      return
    }

    setDecryptLoading(true)
    try {
      // Get username from localStorage
      const username = localStorage.getItem('username')
      if (!username) {
        setError('User information not found, please login again')
        navigate('/login')
        return
      }

      // Get the encrypted private key from localStorage
      const encryptedPrivateKey = localStorage.getItem(`privateKey_${username}`)
      if (!encryptedPrivateKey) {
        setError('Private key not found. You may need to register again.')
        return
      }

      // Decrypt the private key using the provided key password
      let decryptedPrivateKey
      try {
        decryptedPrivateKey = CryptoJS.AES.decrypt(
          encryptedPrivateKey,
          keyPassword
        ).toString(CryptoJS.enc.Utf8)
        
        if (!decryptedPrivateKey) {
          throw new Error('Incorrect key password')
        }
      } catch (e) {
        setError('Failed to decrypt private key. Incorrect key password.')
        return
      }

      // Now pass both the encrypted content and the decrypted private key to the backend
      console.log('Decrypting message with private key...')
      const response = await axios.post(
        'http://localhost:8000/messages/decrypt',
        {
          encrypted_message: currentEncryptedContent,
          key_password: keyPassword,
          private_key: decryptedPrivateKey  // Send the decrypted private key
        },
        {
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      )
      
      console.log('Message decrypted:', response.data)
      
      // Update the decrypted messages state
      setDecryptedMessages(prev => ({
        ...prev,
        [currentMessageId]: response.data.decrypted_message
      }))

      // Mark as read
      try {
        await axios.get(`http://localhost:8000/messages/${currentMessageId}/mark-read`, {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        })
      } catch (error) {
        console.error('Failed to mark message as read:', error)
      }

      // Close the modal and reset state
      setShowKeyModal(false)
      setKeyPassword('')
      setCurrentMessageId(null)
      setCurrentEncryptedContent('')
    } catch (error: any) {
      console.error('Failed to decrypt message:', error)
      setError(error.response?.data?.detail || 'Failed to decrypt message. Please check your key password.')
    } finally {
      setDecryptLoading(false)
    }
  }

  const handleFlagMessage = async (messageId: number) => {
    setSelectedMessageId(messageId)
    setShowFlagModal(true)
  }

  const submitFlag = async () => {
    if (!selectedMessageId || !flagReason.trim()) {
      toast({
        title: "Error",
        description: "Please provide a reason for flagging",
        variant: "destructive"
      })
      return
    }

    try {
      await axios.post(
        `http://localhost:8000/messages/${selectedMessageId}/flag`,
        { reason: flagReason },
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )

      // Update the message in the local state
      setMessages(messages.map(msg => 
        msg.id === selectedMessageId 
          ? { ...msg, is_flagged: true }
          : msg
      ))

      toast({
        title: "Success",
        description: "Message flagged successfully"
      })

      // Reset and close modal
      setFlagReason('')
      setShowFlagModal(false)
      setSelectedMessageId(null)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to flag message",
        variant: "destructive"
      })
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
            <button 
              className="ml-2 text-sm underline" 
              onClick={() => setError('')}
            >
              Dismiss
            </button>
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
                  <h3 className="font-medium text-white">From: {message.sender_name}</h3>
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
                      onClick={() => handleDecrypt(message.id, message.encrypted_content)}
                      className="mt-2 px-3 py-1 bg-primary text-white text-sm rounded hover:bg-primary/90"
                    >
                      Decrypt Message
                    </button>
                  </div>
                )}
                
                <div className="mt-2 flex justify-between items-center">
                {!message.read && !decryptedMessages[message.id] && (
                    <div className="text-xs text-primary font-medium">
                    Unread
                  </div>
                )}
                  {message.is_flagged ? (
                    <span className="text-xs text-red-500 font-medium">Flagged</span>
                  ) : (
                    <button
                      onClick={() => handleFlagMessage(message.id)}
                      className="px-3 py-1 bg-red-500 text-white text-sm rounded hover:bg-red-600"
                    >
                      Flag Message
                    </button>
                  )}
                </div>
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
                    setCurrentMessageId(null)
                    setCurrentEncryptedContent('')
                  }}
                                className="px-4 py-2 bg-muted text-white rounded hover:bg-muted/80"
              disabled={decryptLoading}
            >
              Cancel
            </button>
            <button
              onClick={handleKeyDecryption}
              className="px-4 py-2 bg-primary text-white rounded hover:bg-primary/90"
              disabled={decryptLoading}
            >
              {decryptLoading ? 'Decrypting...' : 'Decrypt'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Flag Modal */}
        {showFlagModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center">
            <div className="bg-card p-6 rounded-lg shadow-lg max-w-md w-full">
              <h2 className="text-xl font-bold mb-4 text-white">Flag Message</h2>
              <p className="text-sm text-white/70 mb-4">
                Please provide a reason for flagging this message
              </p>
              <textarea
                value={flagReason}
                onChange={(e) => setFlagReason(e.target.value)}
                className="w-full p-2 border rounded mb-4 text-white bg-muted/30"
                placeholder="Enter reason for flagging..."
                rows={4}
              />
              <div className="flex justify-end space-x-2">
                <button
                  onClick={() => {
                    setShowFlagModal(false)
                    setFlagReason('')
                    setSelectedMessageId(null)
                  }}
                  className="px-4 py-2 bg-muted text-white rounded hover:bg-muted/80"
                >
                  Cancel
                </button>
                <button
                  onClick={submitFlag}
                  className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                >
                  Flag Message
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
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../components/ui/use-toast'
import CryptoJS from 'crypto-js'

interface Receiver {
  id: number;
  username: string;
}

const SendMessage = () => {
  const [recipientId, setRecipientId] = useState<number | ''>('')
  const [message, setMessage] = useState('')
  const [receivers, setReceivers] = useState<Receiver[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')
  const [currentToken, setCurrentToken] = useState<string | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem('token')
    if (!token) {
      navigate('/login')
      return
    }

    // Fetch available receivers
    const fetchReceivers = async () => {
      try {
        const response = await axios.get('http://localhost:8000/users/receivers', {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        setReceivers(response.data.map((user: any) => ({
          id: user.id,
          username: user.username
        })))
      } catch (error) {
        console.error('Failed to fetch receivers:', error)
      }
    }

    fetchReceivers()
  }, [navigate])

  const getOrCreateToken = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Authentication required')
      }

      // Get the current round ID from the backend
      const roundResponse = await axios.get('http://localhost:8000/messages/current-round', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const roundId = roundResponse.data.round_id

      // Get the user ID
      const userResponse = await axios.get('http://localhost:8000/users/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const userId = userResponse.data.id

      // Generate token hash using the same method as backend
      const token_hash = CryptoJS.SHA256(`${userId}${roundId}`).toString()
      
      // Store the token hash for this round
      localStorage.setItem(`token_${roundId}`, token_hash)
      setCurrentToken(token_hash)
      
      return token_hash
    } catch (error: any) {
      console.error('Token generation error:', error)
      throw new Error(error.response?.data?.detail || 'Failed to get token')
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')
    setSuccess('')

    if (!recipientId) {
      setError('Please select a recipient')
      setLoading(false)
      return
    }

    try {
      const token = localStorage.getItem('token')
      if (!token) {
        throw new Error('Authentication required')
      }

      // Get current round ID
      const roundResponse = await axios.get('http://localhost:8000/messages/current-round', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const roundId = roundResponse.data.round_id

      // Try to get existing token for this round
      let token_hash = localStorage.getItem(`token_${roundId}`)
      
      // If no token exists for this round, create one
      if (!token_hash) {
        token_hash = await getOrCreateToken()
      }
      
      // Use the token we have
      await axios.post(
        'http://localhost:8000/messages/send',
        {
          recipient_id: Number(recipientId),
          encrypted_content: message,
          token_hash: token_hash
        },
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      
      setSuccess('Message sent successfully!')
      setMessage('')
      
      // Show toast notification
      toast({
        title: "Success",
        description: "Message sent successfully!",
      })
    } catch (error: any) {
      const errorMessage = error.response?.data?.detail || 'Failed to send message'
      setError(errorMessage)
      
      // Show error toast
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive"
      })
      
      // If token is invalid or used, clear it for this round
      if (errorMessage.includes('token')) {
        const roundId = Math.floor(Date.now() / 120000) // Current round ID (120000 ms = 2 minutes)
        localStorage.removeItem(`token_${roundId}`)
        setCurrentToken(null)
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-card-foreground">Send Message</h1>
        
        {error && (
          <div className="bg-destructive/10 text-destructive p-3 rounded-md text-center">
            {error}
          </div>
        )}
        
        {success && (
          <div className="bg-primary/10 text-primary p-3 rounded-md text-center">
            {success}
          </div>
        )}
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Recipient</label>
            <select
              value={recipientId}
              onChange={(e) => setRecipientId(e.target.value ? Number(e.target.value) : '')}
              className="w-full p-2 border rounded text-foreground bg-background"
              required
            >
              <option value="">Select a recipient</option>
              {receivers.map((receiver) => (
                <option key={receiver.id} value={receiver.id}>
                  {receiver.username}
                </option>
              ))}
            </select>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Message</label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background h-32"
              placeholder="Type your message here..."
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={loading}
            className={`w-full py-2 px-4 rounded text-white ${
              loading ? 'bg-primary/50 cursor-not-allowed' : 'bg-primary hover:bg-primary/90'
            }`}
          >
            {loading ? 'Sending...' : 'Send Message'}
          </button>
          
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="w-full py-2 rounded bg-muted text-muted-foreground hover:bg-muted/90 transition"
          >
            Back to Dashboard
          </button>
        </form>
      </div>
    </div>
  )
}

export default SendMessage 
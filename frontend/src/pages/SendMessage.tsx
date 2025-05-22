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
        // Update to save both id and username
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
      // Get the current round ID from the backend
      const roundResponse = await axios.get('http://localhost:8000/messages/current-round', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const roundId = roundResponse.data.round_id

      // Get the user ID from the token
      const userResponse = await axios.get('http://localhost:8000/users/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const userId = userResponse.data.id

      // Generate token hash using SHA-256
      const token_hash = CryptoJS.SHA256(`${userId}${roundId}`).toString()
      
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
    } catch (error: any) {
      setError(error.response?.data?.detail || 'Failed to send message')
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
            className="w-full py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
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
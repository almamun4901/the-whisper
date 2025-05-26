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
  const [tokenStatus, setTokenStatus] = useState<'active' | 'frozen' | 'banned' | null>(null)
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

  const getOrCreateToken = async (roundId: number) => {
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
      const currentRoundId = roundResponse.data.round_id

      // Get the user ID
      const userResponse = await axios.get('http://localhost:8000/users/me', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      const userId = userResponse.data.id

      // Generate token hash using the same method as backend
      const token_hash = CryptoJS.SHA256(`${userId}${currentRoundId}`).toString()
      
      // Store the token hash for this round
      localStorage.setItem(`token_${currentRoundId}`, token_hash)
      setCurrentToken(token_hash)
      
      return { token_hash }
    } catch (error: any) {
      console.error('Token generation error:', error)
      throw new Error(error.response?.data?.detail || 'Failed to get token')
    }
  }

  // Function to check token status
  const checkTokenStatus = async () => {
    try {
      const token = localStorage.getItem('token')
      if (!token) {
        navigate('/login')
        return
      }

      // Get current round ID
      const currentRound = Math.floor(Date.now() / (2 * 60 * 1000))
      const token_hash = localStorage.getItem(`token_${currentRound}`)

      if (token_hash) {
        // Check token status from backend
        const response = await axios.get(`http://localhost:8000/messages/token-status/${token_hash}`, {
          headers: {
            Authorization: `Bearer ${token}`
          }
        })
        
        setTokenStatus(response.data.status)
        
        // If token is frozen or banned, show appropriate message
        if (response.data.status === 'frozen') {
          toast({
            title: "Token Frozen",
            description: "Your token has been frozen by a moderator. Please use a different token.",
            variant: "destructive",
            duration: 5000
          })
        } else if (response.data.status === 'banned') {
          toast({
            title: "Token Banned",
            description: response.data.message || "Your token has been banned. Please use a different token.",
            variant: "destructive",
            duration: 5000
          })
        }
      }
    } catch (error) {
      console.error('Error checking token status:', error)
    }
  }

  // Check token status when component mounts and periodically
  useEffect(() => {
    checkTokenStatus()
    
    // Check token status every minute
    const interval = setInterval(checkTokenStatus, 60000)
    
    return () => clearInterval(interval)
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

    if (!message.trim()) {
      setError('Please enter a message')
      setLoading(false)
      return
    }

    try {
      // First check if user is approved
      const userResponse = await axios.get('http://localhost:8000/users/me', {
        headers: {
          Authorization: `Bearer ${localStorage.getItem('token')}`
        }
      })

      if (!userResponse.data.is_approved) {
        setError('Your account is pending approval. Please wait for an admin to approve your account.')
        setLoading(false)
        return
      }

      // Get current round ID (2 minutes)
      const currentRound = Math.floor(Date.now() / (2 * 60 * 1000))
      
      // Try to get existing token for this round
      let token_hash = localStorage.getItem(`token_${currentRound}`)
      
      // Prepare the message payload
      const messagePayload = {
        recipient_id: Number(recipientId),
        encrypted_content: message.trim(),
        token_hash: token_hash || undefined  // Use undefined instead of null
      }
      
      // Send message with token (backend will create a new token if needed)
      const response = await axios.post(
        'http://localhost:8000/messages/send',
        messagePayload,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`
          }
        }
      )

      // Store the token hash if it's new
      if (response.data.token_hash) {
        localStorage.setItem(`token_${currentRound}`, response.data.token_hash)
        setCurrentToken(response.data.token_hash)
      }

      // After successful message send, update token status
      await checkTokenStatus()

      setSuccess("Message sent successfully!")
      setMessage('')
      
      toast({
        title: "Success",
        description: "Message sent successfully!",
      })
    } catch (error: any) {
      const errorDetail = error.response?.data?.detail || "Failed to send message"
      
      // Handle different types of errors
      if (error.response?.status === 403) {
        if (typeof errorDetail === 'object' && errorDetail.status === 'banned') {
          // Handle ban message with structured data
          toast({
            title: "Account Banned",
            description: errorDetail.message,
            variant: "destructive",
            duration: 5000
          })
          setError(errorDetail.message)
          // Update token status after ban message
          await checkTokenStatus()
        } else if (typeof errorDetail === 'object' && errorDetail.status === 'token_banned') {
          // Handle token ban message
          toast({
            title: "Token Banned",
            description: errorDetail.message,
            variant: "destructive",
            duration: 5000
          })
          setError(errorDetail.message)
          // Update token status after token ban
          await checkTokenStatus()
        } else if (typeof errorDetail === 'object' && errorDetail.status === 'token_frozen') {
          // Handle frozen token message
          toast({
            title: "Token Frozen",
            description: errorDetail.message,
            variant: "destructive",
            duration: 5000
          })
          setError(errorDetail.message)
          // Update token status after token freeze
          await checkTokenStatus()
        } else if (errorDetail.includes("pending approval")) {
          setError('Your account is pending approval. Please wait for an admin to approve your account.')
        } else if (errorDetail.includes("token")) {
          // Clear token if it's invalid
          const roundId = Math.floor(Date.now() / 120000)
          localStorage.removeItem(`token_${roundId}`)
          setCurrentToken(null)
          setError("Your token is invalid. Please try sending again.")
        } else {
          setError(errorDetail)
        }
      } else if (error.response?.status === 422) {
        // Handle validation errors
        const validationErrors = error.response.data.detail
        if (Array.isArray(validationErrors)) {
          setError(validationErrors.map(err => err.msg).join(', '))
        } else {
          setError("Invalid message format. Please check your input.")
        }
      } else {
        // For other errors, show a generic message
        toast({
          title: "Error",
          description: typeof errorDetail === 'object' ? errorDetail.message : errorDetail,
          variant: "destructive"
        })
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-card-foreground">Send Message</h1>
        
        {tokenStatus && (
          <div className={`p-3 rounded-md text-center ${
            tokenStatus === 'active' 
              ? 'bg-primary/10 text-primary' 
              : 'bg-destructive/10 text-destructive'
          }`}>
            Token Status: {tokenStatus.charAt(0).toUpperCase() + tokenStatus.slice(1)}
          </div>
        )}
        
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
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const Status = () => {
  const [username, setUsername] = useState('')
  const [statusMessage, setStatusMessage] = useState('')
  const [status, setStatus] = useState<'pending' | 'approved' | 'rejected' | null>(null)
  const navigate = useNavigate()

  const checkStatus = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await axios.get(`http://localhost:8000/status?username=${username}`)
      setStatus(response.data.status)
      if (response.data.status === 'approved') {
        setStatusMessage('Your registration has been approved! You can now log in.')
      } else if (response.data.status === 'pending') {
        setStatusMessage('Your registration is still pending approval.')
      } else if (response.data.status === 'rejected') {
        setStatusMessage('Your registration has been rejected.')
      }
    } catch (error: any) {
      setStatusMessage(error.response?.data?.detail || 'Failed to check status')
      setStatus(null)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-card-foreground">Check Registration Status</h1>
        
        {statusMessage && (
          <div className={`p-3 rounded-md text-center ${
            status === 'approved' ? 'bg-green-100 text-green-700' :
            status === 'rejected' ? 'bg-red-100 text-red-700' :
            'bg-blue-100 text-blue-700'
          }`}>
            {statusMessage}
          </div>
        )}
        
        <form onSubmit={checkStatus} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              placeholder="Enter your username"
              required
            />
          </div>
          
          <button 
            type="submit" 
            className="w-full py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            Check Status
          </button>
          
          <button 
            type="button"
            onClick={() => navigate('/')}
            className="w-full py-2 rounded bg-muted text-muted-foreground hover:bg-muted/90 transition"
          >
            Back to Home
          </button>
        </form>
      </div>
    </div>
  )
}

export default Status 
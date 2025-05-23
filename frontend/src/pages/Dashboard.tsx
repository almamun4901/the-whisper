import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../components/ui/use-toast'

interface TokenStatus {
  status: 'active' | 'banned' | 'warning' | 'frozen'
  message: string
  banned_until?: string
  warning_date?: string
  frozen_since?: string
}

const Dashboard = () => {
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const navigate = useNavigate()
  const { toast } = useToast()

  useEffect(() => {
    const token = localStorage.getItem('token')
    const storedUsername = localStorage.getItem('username')
    const storedRole = localStorage.getItem('userRole')
    
    if (!token || !storedUsername || !storedRole) {
      navigate('/login')
      return
    }
    
    setUsername(storedUsername)
    setRole(storedRole)
    setLoading(false)

    // Fetch token status for senders
    if (storedRole === 'sender') {
      fetchTokenStatus()
    }
  }, [navigate])

  const fetchTokenStatus = async () => {
    try {
      const response = await axios.get('http://localhost:8000/users/token-status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      setTokenStatus(response.data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch token status",
        variant: "destructive"
      })
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('userRole')
    navigate('/login')
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'banned':
        return 'text-red-500'
      case 'warning':
        return 'text-yellow-500'
      case 'frozen':
        return 'text-red-500'
      case 'active':
        return 'text-green-500'
      default:
        return 'text-muted-foreground'
    }
  }

  if (loading) {
    return <div className="flex items-center justify-center min-h-screen">Loading...</div>
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-card-foreground">User Dashboard</h1>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-sm text-muted-foreground">
                Logged in as: <span className="font-medium text-card-foreground">{username}</span> ({role})
              </span>
              <button
                onClick={handleLogout}
                className="px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {role === 'sender' && (
              <>
                <div className="bg-card shadow overflow-hidden rounded-lg">
                  <div className="px-4 py-5 sm:p-6">
                    <h2 className="text-lg font-medium text-card-foreground">Send Messages</h2>
                    <p className="mt-1 text-sm text-muted-foreground">
                      Send encrypted messages to receivers
                    </p>
                    <div className="mt-5">
                      <button
                        onClick={() => navigate('/send-message')}
                        className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
                      >
                        Compose Message
                      </button>
                    </div>
                  </div>
                </div>

                {tokenStatus && (
                  <div className="bg-card shadow overflow-hidden rounded-lg">
                    <div className="px-4 py-5 sm:p-6">
                      <h2 className="text-lg font-medium text-card-foreground">Token Status</h2>
                      <div className="mt-4 space-y-2">
                        <div className="flex items-center space-x-2">
                          <span className={`font-medium ${getStatusColor(tokenStatus.status)}`}>
                            Status: {tokenStatus.status.toUpperCase()}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {tokenStatus.message}
                        </p>
                        {tokenStatus.banned_until && (
                          <p className="text-sm text-red-500">
                            Banned until: {new Date(tokenStatus.banned_until).toLocaleString()}
                          </p>
                        )}
                        {tokenStatus.warning_date && (
                          <p className="text-sm text-yellow-500">
                            Warning issued: {new Date(tokenStatus.warning_date).toLocaleString()}
                          </p>
                        )}
                        {tokenStatus.frozen_since && (
                          <p className="text-sm text-red-500">
                            Frozen since: {new Date(tokenStatus.frozen_since).toLocaleString()}
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
            
            {role === 'receiver' && (
              <div className="bg-card shadow overflow-hidden rounded-lg">
                <div className="px-4 py-5 sm:p-6">
                  <h2 className="text-lg font-medium text-card-foreground">Inbox</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    View and decrypt your received messages
                  </p>
                  <div className="mt-5">
                    <button
                      onClick={() => navigate('/inbox')}
                      className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
                    >
                      View Messages
                    </button>
                  </div>
                </div>
              </div>
            )}
            
            <div className="bg-card shadow overflow-hidden rounded-lg">
              <div className="px-4 py-5 sm:p-6">
                <h2 className="text-lg font-medium text-card-foreground">Account Status</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  Check your account status and information
                </p>
                <div className="mt-5">
                  <button
                    onClick={() => navigate('/status')}
                    className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
                  >
                    View Status
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default Dashboard 
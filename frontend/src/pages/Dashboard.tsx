import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const Dashboard = () => {
  const [username, setUsername] = useState('')
  const [role, setRole] = useState('')
  const [loading, setLoading] = useState(true)
  const navigate = useNavigate()

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
  }, [navigate])

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('username')
    localStorage.removeItem('userRole')
    navigate('/login')
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
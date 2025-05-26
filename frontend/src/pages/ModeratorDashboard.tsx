import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../components/ui/use-toast'
import { useNavigate } from 'react-router-dom'

interface FlaggedMessage {
  id: number
  sender_name: string
  encrypted_content: string
  created_at: string
  token_hash: string
  is_resolved: boolean
  flag_reason: string
}

interface TokenStatus {
  is_used: boolean
  is_frozen: boolean
  expires_at: string
  created_at: string
}

interface AuditLog {
  id: number
  action_type: string
  token_hash: string
  action_details: string
  created_at: string
}

interface BanRequest {
  token_hash: string
  ban_type: 'freeze' | 'temp_5min' | 'temp_1hour' | 'warning'
  ban_reason: string
}

const ModeratorDashboard = () => {
  const [flaggedMessages, setFlaggedMessages] = useState<FlaggedMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedToken, setSelectedToken] = useState<string | null>(null)
  const [tokenStatus, setTokenStatus] = useState<TokenStatus | null>(null)
  const { toast } = useToast()
  const navigate = useNavigate()

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('userRole')
    localStorage.removeItem('username')
    navigate('/login')
  }

  const fetchFlaggedMessages = async () => {
    try {
      const response = await axios.get('http://localhost:8000/moderator/flagged-messages', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      // Sort messages by created_at in descending order (newest first)
      // Filter out resolved messages
      const sortedMessages = response.data
        .filter((msg: FlaggedMessage) => !msg.is_resolved)
        .sort((a: FlaggedMessage, b: FlaggedMessage) => 
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        )
      setFlaggedMessages(sortedMessages)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch flagged messages",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  const handleBanUser = async (tokenHash: string, banType: string) => {
    try {
      await axios.post(
        'http://localhost:8000/moderator/ban-user',
        {
          token_hash: tokenHash,
          ban_type: banType,
          ban_reason: `Message flagged for inappropriate content`
        },
        {
          headers: {
            'Authorization': `Bearer ${localStorage.getItem('token')}`
          }
        }
      )

      toast({
        title: "Success",
        description: "Action taken successfully"
      })
      
      // Refresh the list
      fetchFlaggedMessages()
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to take action",
        variant: "destructive"
      })
    }
  }

  const fetchTokenStatus = async (tokenHash: string) => {
    try {
      const response = await axios.get(`http://localhost:8000/moderator/token-status/${tokenHash}`, {
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

  useEffect(() => {
    fetchFlaggedMessages()
  }, [])

  useEffect(() => {
    if (selectedToken) {
      fetchTokenStatus(selectedToken)
    }
  }, [selectedToken])

  const handleFreezeToken = async (tokenHash: string) => {
    try {
      await axios.post(`http://localhost:8000/moderator/freeze-token/${tokenHash}`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      toast({
        title: "Success",
        description: "Token frozen successfully"
      })
      fetchTokenStatus(tokenHash)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to freeze token",
        variant: "destructive"
      })
    }
  }

  const handleIssueWarning = async (tokenHash: string) => {
    try {
      await axios.post(`http://localhost:8000/moderator/warn/${tokenHash}`, {}, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('token')}`
        }
      })
      toast({
        title: "Success",
        description: "Warning issued successfully"
      })
      fetchTokenStatus(tokenHash)
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.response?.data?.detail || "Failed to issue warning",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-card-foreground">Moderator Dashboard</h1>
            </div>
            <div className="flex items-center">
              <button
                onClick={handleLogout}
                className="ml-4 px-4 py-2 bg-muted text-muted-foreground rounded-md hover:bg-muted/80 transition"
              >
                Logout
              </button>
            </div>
          </div>
        </div>
      </nav>

      <main className="container mx-auto p-4">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          {/* Flagged Messages Section */}
          <div className="lg:col-span-2 space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="text-xl font-semibold text-card-foreground">Flagged Messages</h2>
              <button
                onClick={fetchFlaggedMessages}
                className="px-3 py-1 bg-primary text-primary-foreground rounded hover:bg-primary/90"
              >
                Refresh
              </button>
            </div>
            {loading ? (
              <div className="text-center py-8">
                <p className="text-muted-foreground">Loading flagged messages...</p>
              </div>
            ) : (
              <div className="space-y-4">
                {flaggedMessages.length === 0 ? (
                  <div className="text-center py-8 bg-card rounded-lg">
                    <p className="text-muted-foreground">No flagged messages</p>
                  </div>
                ) : (
                  flaggedMessages.map((message) => (
                    <div key={message.id} className="bg-card p-4 rounded-lg shadow">
                      <div className="space-y-4">
                        <div className="flex justify-between items-start">
                          <div className="space-y-2">
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Message Content:</p>
                              <p className="text-sm break-all bg-muted/30 p-2 rounded">
                                {message.encrypted_content}
                              </p>
                            </div>
                            <div className="space-y-1">
                              <p className="text-sm font-medium">Flag Reason:</p>
                              <p className="text-sm text-red-500">
                                {message.flag_reason}
                              </p>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              Flagged at: {new Date(message.created_at).toLocaleString()}
                            </p>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <button
                              onClick={() => handleBanUser(message.token_hash, 'freeze')}
                              className="px-3 py-1 text-sm bg-red-500 text-white rounded hover:bg-red-600"
                            >
                              Ban
                            </button>
                            <button
                              onClick={() => handleBanUser(message.token_hash, 'temp_5min')}
                              className="px-3 py-1 text-sm bg-orange-500 text-white rounded hover:bg-orange-600"
                            >
                              5min Ban
                            </button>
                            <button
                              onClick={() => handleBanUser(message.token_hash, 'temp_1hour')}
                              className="px-3 py-1 text-sm bg-yellow-500 text-white rounded hover:bg-yellow-600"
                            >
                              1hr Ban
                            </button>
                            <button
                              onClick={() => handleBanUser(message.token_hash, 'warning')}
                              className="px-3 py-1 text-sm bg-blue-500 text-white rounded hover:bg-blue-600"
                            >
                              Warning
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Token Actions Section */}
          <div className="space-y-4">
            <h2 className="text-xl font-semibold text-card-foreground">Token Actions</h2>
            {selectedToken ? (
              <div className="bg-card p-4 rounded-lg shadow">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-medium mb-2">Token Details</h3>
                    <p className="text-sm break-all bg-muted/30 p-2 rounded">
                      {selectedToken}
                    </p>
                  </div>
                  
                  {tokenStatus && (
                    <div className="space-y-2">
                      <h3 className="font-medium">Status</h3>
                      <div className="grid grid-cols-2 gap-2 text-sm">
                        <div className="bg-muted/30 p-2 rounded">
                          <span className="text-muted-foreground">Status:</span>
                          <span className={`ml-2 ${tokenStatus.is_frozen ? 'text-red-500' : 'text-green-500'}`}>
                            {tokenStatus.is_frozen ? 'Frozen' : 'Active'}
                          </span>
                        </div>
                        <div className="bg-muted/30 p-2 rounded">
                          <span className="text-muted-foreground">Used:</span>
                          <span className="ml-2">{tokenStatus.is_used ? 'Yes' : 'No'}</span>
                        </div>
                        <div className="bg-muted/30 p-2 rounded">
                          <span className="text-muted-foreground">Created:</span>
                          <span className="ml-2">{new Date(tokenStatus.created_at).toLocaleString()}</span>
                        </div>
                        <div className="bg-muted/30 p-2 rounded">
                          <span className="text-muted-foreground">Expires:</span>
                          <span className="ml-2">{new Date(tokenStatus.expires_at).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="space-y-2">
                    <h3 className="font-medium">Actions</h3>
                    <div className="grid grid-cols-1 gap-2">
                      <button
                        onClick={() => handleFreezeToken(selectedToken)}
                        className="w-full px-4 py-2 bg-yellow-500 text-white rounded hover:bg-yellow-600 disabled:opacity-50"
                        disabled={tokenStatus?.is_frozen}
                      >
                        Freeze Token
                      </button>
                      <button
                        onClick={() => handleIssueWarning(selectedToken)}
                        className="w-full px-4 py-2 bg-orange-500 text-white rounded hover:bg-orange-600"
                      >
                        Issue Warning
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8 bg-card rounded-lg">
                <p className="text-muted-foreground">Select a token to view actions</p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  )
}

export default ModeratorDashboard
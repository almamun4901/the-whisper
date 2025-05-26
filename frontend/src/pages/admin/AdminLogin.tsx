import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const AdminLogin = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const navigate = useNavigate()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    // Trim whitespace from inputs
    const trimmedUsername = username.trim()
    const trimmedPassword = password.trim()

    if (!trimmedUsername || !trimmedPassword) {
      setError('Please enter both username and password')
      setLoading(false)
      return
    }

    try {
      const response = await axios.post('http://localhost:8000/admin/login', {
        username: trimmedUsername,
        password: trimmedPassword
      })
      
      if (response.data.access_token) {
        localStorage.setItem('adminToken', response.data.access_token)
        navigate('/admin/dashboard')
      }
    } catch (error: any) {
      console.error('Login failed:', error)
      setError(error.response?.data?.detail || 'Invalid credentials')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-card-foreground">Admin Login</h1>
        {error && (
          <div className="p-3 text-sm text-red-500 bg-red-50 rounded-md">
            {error}
          </div>
        )}
        <form onSubmit={handleLogin} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              placeholder="Enter admin username"
              disabled={loading}
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              placeholder="Enter admin password"
              disabled={loading}
            />
          </div>
          <button 
            type="submit" 
            className="w-full py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition disabled:opacity-50"
            disabled={loading}
          >
            {loading ? "Logging in..." : "Login"}
          </button>
        </form>
      </div>
    </div>
  )
}

export default AdminLogin 
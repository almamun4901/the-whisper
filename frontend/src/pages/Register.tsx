import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

const Register = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [role, setRole] = useState('sender')
  const [message, setMessage] = useState('')
  const navigate = useNavigate()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      const response = await axios.post('http://localhost:8000/register', {
        username,
        password,
        role
      })
      setMessage('Registration successful! Waiting for admin approval.')
      setTimeout(() => {
        navigate('/status')
      }, 2000)
    } catch (error: any) {
      setMessage(error.response?.data?.detail || 'Registration failed')
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-card-foreground">Register Account</h1>
        {message && (
          <div className="bg-primary/10 text-primary p-3 rounded-md text-center">
            {message}
          </div>
        )}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              placeholder="Choose a username"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              placeholder="Choose a password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Role</label>
            <select
              value={role}
              onChange={(e) => setRole(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              required
            >
              <option value="sender">Sender</option>
              <option value="receiver">Receiver</option>
            </select>
          </div>
          <button 
            type="submit" 
            className="w-full py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
          >
            Register
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

export default Register 
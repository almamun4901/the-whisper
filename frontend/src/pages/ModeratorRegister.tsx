import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'
import { useToast } from '../components/ui/use-toast'
import CryptoJS from 'crypto-js'

const ModeratorRegister = () => {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [keyPassword, setKeyPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const navigate = useNavigate()
  const { toast } = useToast()

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const response = await axios.post('http://localhost:8000/register/moderator', {
        username,
        password,
        key_password: keyPassword
      })

      if (response.data.private_key) {
        // Encrypt the private key with the key password before storing
        const encryptedPrivateKey = CryptoJS.AES.encrypt(
          response.data.private_key, 
          keyPassword
        ).toString();
        
        // Store the encrypted private key in localStorage
        localStorage.setItem(`privateKey_${username}`, encryptedPrivateKey);
        
        toast({
          title: "Moderator registration successful",
          description: "Please wait for admin approval. Your private key has been securely stored.",
        })
      } else {
        toast({
          title: "Registration issue",
          description: "Private key not received. Please contact support.",
          variant: "destructive"
        })
      }
      
      navigate('/status')
    } catch (error: any) {
      toast({
        title: "Registration failed",
        description: error.response?.data?.detail || "An error occurred",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/20">
      <div className="w-full max-w-md p-8 space-y-6 bg-card rounded-lg shadow-lg">
        <h1 className="text-2xl font-bold text-center text-card-foreground">Moderator Registration</h1>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Username</label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              placeholder="Enter username"
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
              placeholder="Enter password"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-card-foreground mb-1">Key Password</label>
            <input
              type="password"
              value={keyPassword}
              onChange={(e) => setKeyPassword(e.target.value)}
              className="w-full p-2 border rounded text-foreground bg-background"
              placeholder="Enter password for key encryption"
              required
            />
            <p className="mt-1 text-sm text-muted-foreground">
              This password will be used to encrypt your private key. Keep it safe!
            </p>
          </div>
          <button
            type="submit"
            className="w-full py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
            disabled={loading}
          >
            {loading ? 'Registering...' : 'Register as Moderator'}
          </button>
        </form>
      </div>
    </div>
  )
}

export default ModeratorRegister 
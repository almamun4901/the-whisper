import { useState } from 'react'
import { useToast } from './ui/use-toast'

interface KeyDecryptionProps {
  onKeyDecrypted: (decryptedKey: string) => void
  onCancel: () => void
}

const KeyDecryption = ({ onKeyDecrypted, onCancel }: KeyDecryptionProps) => {
  const [keyPassword, setKeyPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const { toast } = useToast()

  const handleDecrypt = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)

    try {
      const encryptedKey = localStorage.getItem('encryptedPrivateKey')
      if (!encryptedKey) {
        throw new Error('No encrypted key found')
      }

      // Call backend to decrypt the key
      const response = await fetch('http://localhost:8000/decrypt-key', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          encrypted_key: encryptedKey,
          password: keyPassword
        })
      })

      if (!response.ok) {
        throw new Error('Failed to decrypt key')
      }

      const { decrypted_key } = await response.json()
      onKeyDecrypted(decrypted_key)
      
      toast({
        title: "Key decrypted successfully",
        description: "You can now read your messages",
      })
    } catch (error: any) {
      toast({
        title: "Decryption failed",
        description: error.message || "Invalid key password",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
      <div className="bg-card p-6 rounded-lg shadow-lg w-full max-w-md">
        <h2 className="text-xl font-semibold mb-4">Enter Key Password</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Enter your key password to decrypt your private key and read messages
        </p>
        <form onSubmit={handleDecrypt} className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-1">Key Password</label>
            <input
              type="password"
              value={keyPassword}
              onChange={(e) => setKeyPassword(e.target.value)}
              className="w-full p-2 border rounded bg-background"
              placeholder="Enter your key password"
              required
            />
          </div>
          <div className="flex space-x-2">
            <button
              type="submit"
              className="flex-1 py-2 rounded bg-primary text-primary-foreground hover:bg-primary/90 transition"
              disabled={loading}
            >
              {loading ? 'Decrypting...' : 'Decrypt Key'}
            </button>
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 py-2 rounded bg-muted text-muted-foreground hover:bg-muted/90 transition"
              disabled={loading}
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

export default KeyDecryption 
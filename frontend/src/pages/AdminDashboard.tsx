import { useState, useEffect } from 'react'
import axios from 'axios'
import { useToast } from '../components/ui/use-toast'

interface PendingUser {
  id: number
  username: string
  role: string
  status: string
}

const AdminDashboard = () => {
  const [pendingUsers, setPendingUsers] = useState<PendingUser[]>([])
  const [loading, setLoading] = useState(true)
  const { toast } = useToast()

  const fetchPendingUsers = async () => {
    try {
      const response = await axios.get('http://localhost:8000/admin/pending-users')
      setPendingUsers(response.data)
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to fetch pending users",
        variant: "destructive"
      })
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchPendingUsers()
  }, [])

  const handleApprove = async (userId: number) => {
    try {
      await axios.post(`http://localhost:8000/admin/approve-user/${userId}`)
      toast({
        title: "Success",
        description: "User approved successfully"
      })
      fetchPendingUsers()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to approve user",
        variant: "destructive"
      })
    }
  }

  const handleReject = async (userId: number) => {
    try {
      await axios.post(`http://localhost:8000/admin/reject-user/${userId}`)
      toast({
        title: "Success",
        description: "User rejected successfully"
      })
      fetchPendingUsers()
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to reject user",
        variant: "destructive"
      })
    }
  }

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Admin Dashboard</h1>
      <h2 className="text-xl font-semibold mb-2">Pending Approvals</h2>
      
      {loading ? (
        <p>Loading...</p>
      ) : (
        <div className="space-y-4">
          {pendingUsers.length === 0 ? (
            <p>No pending approvals</p>
          ) : (
            pendingUsers.map((user) => (
              <div key={user.id} className="border p-4 rounded-lg flex justify-between items-center">
                <div>
                  <p className="font-medium">{user.username}</p>
                  <p className="text-sm text-muted-foreground">Role: {user.role}</p>
                </div>
                <div className="space-x-2">
                  <button
                    onClick={() => handleApprove(user.id)}
                    className="px-4 py-2 bg-green-500 text-white rounded hover:bg-green-600"
                  >
                    Approve
                  </button>
                  <button
                    onClick={() => handleReject(user.id)}
                    className="px-4 py-2 bg-red-500 text-white rounded hover:bg-red-600"
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </div>
  )
}

export default AdminDashboard 
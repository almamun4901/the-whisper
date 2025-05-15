import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface User {
  id: number
  username: string
  role: string
  status: string
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    const token = localStorage.getItem('adminToken')
    if (!token) {
      navigate('/admin/login')
      return
    }

    fetchUsers()
  }, [navigate])

  const fetchUsers = async () => {
    try {
      const token = localStorage.getItem('adminToken')
      const response = await axios.get('http://localhost:8000/admin/pending-users', {
        headers: {
          Authorization: `Bearer ${token}`
        }
      })
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const handleApprove = async (userId: number) => {
    try {
      const token = localStorage.getItem('adminToken')
      await axios.post(
        `http://localhost:8000/admin/approve-user/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      fetchUsers()
    } catch (error) {
      console.error('Failed to approve user:', error)
    }
  }

  const handleReject = async (userId: number) => {
    try {
      const token = localStorage.getItem('adminToken')
      await axios.post(
        `http://localhost:8000/admin/reject-user/${userId}`,
        {},
        {
          headers: {
            Authorization: `Bearer ${token}`
          }
        }
      )
      fetchUsers()
    } catch (error) {
      console.error('Failed to reject user:', error)
    }
  }

  const handleLogout = () => {
    localStorage.removeItem('adminToken')
    navigate('/admin/login')
  }

  return (
    <div className="min-h-screen bg-background">
      <nav className="bg-card shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-card-foreground">Admin Dashboard</h1>
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

      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          <div className="bg-card shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-card-foreground">Pending Users</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                Approve or reject pending user registration requests
              </p>
            </div>
            <div className="border-t border-border">
              <ul className="divide-y divide-border">
                {users.map((user) => (
                  <li key={user.id} className="px-4 py-4 sm:px-6">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-card-foreground truncate">
                          {user.username}
                        </p>
                        <p className="text-sm text-muted-foreground">
                          Role: {user.role}
                        </p>
                      </div>
                      <div className="flex space-x-2">
                        <button
                          onClick={() => handleApprove(user.id)}
                          className="px-3 py-1 bg-primary text-primary-foreground rounded-md text-sm hover:bg-primary/90 transition"
                        >
                          Approve
                        </button>
                        <button
                          onClick={() => handleReject(user.id)}
                          className="px-3 py-1 bg-destructive text-destructive-foreground rounded-md text-sm hover:bg-destructive/90 transition"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
                {users.length === 0 && (
                  <li className="px-4 py-4 sm:px-6 text-center text-muted-foreground">
                    No pending users
                  </li>
                )}
              </ul>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard 
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import axios from 'axios'

interface User {
  id: number
  username: string
  role: string
  status: string
}

interface AuditLog {
  id: number
  action_type: string
  token_hash: string
  moderator_id: number
  user_id: number | null
  action_details: string
  created_at: string
}

const AdminDashboard = () => {
  const [users, setUsers] = useState<User[]>([])
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    fetchUsers()
    fetchAuditLogs()
  }, [])

  const fetchUsers = async () => {
    try {
      const response = await axios.get('http://localhost:8000/admin/pending-users')
      setUsers(response.data)
    } catch (error) {
      console.error('Failed to fetch users:', error)
    }
  }

  const fetchAuditLogs = async () => {
    try {
      const response = await axios.get('http://localhost:8000/admin/audit-logs')
      setAuditLogs(response.data)
    } catch (error) {
      console.error('Failed to fetch audit logs:', error)
    }
  }

  const handleApprove = async (userId: number) => {
    try {
      await axios.post(`http://localhost:8000/admin/approve-user/${userId}`)
      fetchUsers()
    } catch (error) {
      console.error('Failed to approve user:', error)
    }
  }

  const handleReject = async (userId: number) => {
    try {
      await axios.post(`http://localhost:8000/admin/reject-user/${userId}`)
      fetchUsers()
    } catch (error) {
      console.error('Failed to reject user:', error)
    }
  }

  const handleLogout = () => {
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
          <div className="bg-card shadow overflow-hidden rounded-lg mb-8">
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
          {/* Audit Log Section */}
          <div className="bg-card shadow overflow-hidden rounded-lg">
            <div className="px-4 py-5 sm:px-6">
              <h2 className="text-lg font-medium text-card-foreground">Audit Logs</h2>
              <p className="mt-1 text-sm text-muted-foreground">
                All system actions: message sending, registration, bans, and more.
              </p>
            </div>
            <div className="border-t border-border overflow-x-auto">
              <table className="min-w-full divide-y divide-border">
                <thead>
                  <tr>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Action Type</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Token Hash</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Moderator ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">User ID</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Details</th>
                    <th className="px-4 py-2 text-left text-xs font-medium text-muted-foreground uppercase tracking-wider">Created At</th>
                  </tr>
                </thead>
                <tbody className="bg-background divide-y divide-border">
                  {auditLogs.map((log) => (
                    <tr key={log.id}>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{log.id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          log.action_type === 'user_approved' ? 'bg-green-500/10 text-green-500' :
                          log.action_type === 'user_rejected' ? 'bg-red-500/10 text-red-500' :
                          log.action_type === 'freeze' ? 'bg-yellow-500/10 text-yellow-500' :
                          log.action_type === 'ban' ? 'bg-red-500/10 text-red-500' :
                          log.action_type === 'warn' ? 'bg-orange-500/10 text-orange-500' :
                          'bg-blue-500/10 text-blue-500'
                        }`}>
                          {log.action_type.toUpperCase()}
                        </span>
                      </td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{log.token_hash}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{log.moderator_id}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{log.user_id ?? '-'}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{log.action_details}</td>
                      <td className="px-4 py-2 whitespace-nowrap text-sm">{new Date(log.created_at).toLocaleString()}</td>
                    </tr>
                  ))}
                  {auditLogs.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-4 py-4 text-center text-muted-foreground">No audit logs found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

export default AdminDashboard 
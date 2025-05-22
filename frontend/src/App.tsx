import { BrowserRouter as Router, Routes, Route } from 'react-router-dom'
import Home from './pages/Home'
import AdminLogin from './pages/admin/AdminLogin'
import AdminDashboard from './pages/admin/AdminDashboard'
import Register from './pages/Register'
import Status from './pages/Status'
import NotFound from './pages/NotFound'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import SendMessage from './pages/SendMessage'
import Inbox from './pages/Inbox'
import ModeratorDashboard from './pages/ModeratorDashboard'
import { Toaster } from './components/ui/toaster'
import './App.css'

function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin/dashboard" element={<AdminDashboard />} />
        <Route path="/register" element={<Register />} />
        <Route path="/status" element={<Status />} />
        <Route path="/login" element={<Login />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/send-message" element={<SendMessage />} />
        <Route path="/inbox" element={<Inbox />} />
        <Route path="/moderator/dashboard" element={<ModeratorDashboard />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
      <Toaster />
    </Router>
  )
}

export default App

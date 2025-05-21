import { useNavigate } from 'react-router-dom'

const Home = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center">
      <div className="bg-card p-8 rounded-lg shadow-md w-full max-w-md">
        <h1 className="text-3xl font-bold text-center mb-6 text-primary">WhisperChain+</h1>
        <p className="text-muted-foreground mb-6 text-center">
          A secure, role-based anonymous messaging platform
        </p>
        <div className="space-y-4">
          <button 
            onClick={() => navigate('/admin/login')}
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground py-2 px-4 rounded transition duration-200"
          >
            Admin Login
          </button>
          <button
            onClick={() => navigate('/login')}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white py-2 px-4 rounded transition duration-200"
          >
            User Login
          </button>
          <button
            onClick={() => navigate('/register')}
            className="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded transition duration-200"
          >
            Register
          </button>
          <button
            onClick={() => navigate('/status')}
            className="w-full bg-secondary hover:bg-secondary/90 text-secondary-foreground py-2 px-4 rounded transition duration-200"
          >
            Check Status
          </button>
        </div>
      </div>
    </div>
  )
}

export default Home 
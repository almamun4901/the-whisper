import { useNavigate } from 'react-router-dom'

const NotFound = () => {
  const navigate = useNavigate()

  return (
    <div className="min-h-screen bg-background flex flex-col justify-center items-center p-4">
      <div className="bg-card p-8 rounded-lg shadow-md w-full max-w-md text-center">
        <h1 className="text-4xl font-bold mb-2 text-card-foreground">404</h1>
        <h2 className="text-2xl font-semibold mb-4 text-card-foreground">Page Not Found</h2>
        <p className="text-muted-foreground mb-6">
          The page you're looking for doesn't exist or has been moved.
        </p>
        <button
          onClick={() => navigate('/')}
          className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition"
        >
          Go Home
        </button>
      </div>
    </div>
  )
}

export default NotFound 
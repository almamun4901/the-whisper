"""
Simple HTTP server using Python's http.server module
"""

from http.server import BaseHTTPRequestHandler, HTTPServer
import json
import urllib.parse

# In-memory database for testing
users = [
    {"id": 1, "username": "testuser1", "role": "sender", "status": "approved"},
    {"id": 2, "username": "testuser2", "role": "receiver", "status": "pending"}
]

class SimpleHandler(BaseHTTPRequestHandler):
    def _set_headers(self, status_code=200):
        self.send_response(status_code)
        self.send_header('Content-type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.end_headers()
    
    def do_OPTIONS(self):
        self._set_headers()
        
    def do_GET(self):
        self._set_headers()
        
        if self.path == '/':
            response = {"message": "Backend API is running"}
        elif self.path == '/users':
            response = users
        elif self.path.startswith('/status'):
            # Parse query parameters
            parsed_path = urllib.parse.urlparse(self.path)
            query_params = urllib.parse.parse_qs(parsed_path.query)
            username = query_params.get('username', [None])[0]
            
            if username:
                user = next((u for u in users if u['username'] == username), None)
                if user:
                    response = {
                        "username": user["username"],
                        "role": user["role"],
                        "status": user["status"]
                    }
                else:
                    self._set_headers(404)
                    response = {"error": "User not found"}
            else:
                self._set_headers(400)
                response = {"error": "Username parameter required"}
        elif self.path == '/admin/pending-users':
            # Admin endpoint to get pending users
            pending = [user for user in users if user['status'] == 'pending']
            response = pending
        else:
            self._set_headers(404)
            response = {"error": "Not found"}
            
        self.wfile.write(json.dumps(response).encode())

    def do_POST(self):
        try:
            # Check if Content-Length header exists
            content_length = self.headers.get('Content-Length')
            if content_length is None:
                self._set_headers(400)
                response = {"error": "Missing Content-Length header"}
                self.wfile.write(json.dumps(response).encode())
                return
                
            content_length = int(content_length)
            post_data = self.rfile.read(content_length)
            
            # Empty POST request
            if not post_data:
                if self.path.startswith('/admin/approve-user/'):
                    # Admin approval endpoint (no body needed)
                    user_id = int(self.path.split('/')[-1])
                    user = next((u for u in users if u['id'] == user_id), None)
                    
                    if user:
                        user['status'] = 'approved'
                        response = {
                            "id": user["id"],
                            "username": user["username"],
                            "role": user["role"],
                            "status": user["status"]
                        }
                    else:
                        self._set_headers(404)
                        response = {"error": "User not found"}
                elif self.path.startswith('/admin/reject-user/'):
                    # Admin rejection endpoint (no body needed)
                    user_id = int(self.path.split('/')[-1])
                    user = next((u for u in users if u['id'] == user_id), None)
                    
                    if user:
                        user['status'] = 'rejected'
                        response = {
                            "id": user["id"],
                            "username": user["username"],
                            "role": user["role"],
                            "status": user["status"]
                        }
                    else:
                        self._set_headers(404)
                        response = {"error": "User not found"}
                else:
                    self._set_headers(400)
                    response = {"error": "Empty request body"}
            else:
                try:
                    data = json.loads(post_data.decode('utf-8'))
                    
                    if self.path == '/register':
                        # Registration endpoint
                        if 'username' not in data or 'password' not in data or 'role' not in data:
                            self._set_headers(400)
                            response = {"error": "Missing required fields"}
                        elif data['role'] not in ['sender', 'receiver']:
                            self._set_headers(400)
                            response = {"error": "Role must be 'sender' or 'receiver'"}
                        elif any(u['username'] == data['username'] for u in users):
                            self._set_headers(400)
                            response = {"error": "Username already exists"}
                        else:
                            new_user = {
                                "id": len(users) + 1,
                                "username": data['username'],
                                "role": data['role'],
                                "status": "pending"
                            }
                            users.append(new_user)
                            self._set_headers(201)
                            response = {
                                "id": new_user["id"],
                                "username": new_user["username"],
                                "role": new_user["role"],
                                "status": new_user["status"]
                            }
                    elif self.path == '/admin/login':
                        # Admin login endpoint
                        if data.get('username') == 'admin' and data.get('password') == 'admin123':
                            response = {
                                "access_token": "mock_access_token_for_testing",
                                "token_type": "bearer"
                            }
                        else:
                            self._set_headers(401)
                            response = {"error": "Invalid admin credentials"}
                    else:
                        self._set_headers(404)
                        response = {"error": "Endpoint not found"}
                except json.JSONDecodeError:
                    self._set_headers(400)
                    response = {"error": "Invalid JSON"}
        except Exception as e:
            self._set_headers(500)
            response = {"error": f"Server error: {str(e)}"}
            
        self.wfile.write(json.dumps(response).encode())

def run(server_class=HTTPServer, handler_class=SimpleHandler, port=8888):
    server_address = ('', port)
    httpd = server_class(server_address, handler_class)
    print(f"Starting server on port {port}")
    print(f"Test API available at http://localhost:{port}")
    print("Available endpoints:")
    print(" - GET  / - API status")
    print(" - GET  /users - List all users")
    print(" - GET  /status?username=<username> - Get user status")
    print(" - GET  /admin/pending-users - List pending users")
    print(" - POST /register - Register a new user")
    print(" - POST /admin/login - Admin login")
    print(" - POST /admin/approve-user/<id> - Approve user")
    print(" - POST /admin/reject-user/<id> - Reject user")
    httpd.serve_forever()

if __name__ == "__main__":
    run() 
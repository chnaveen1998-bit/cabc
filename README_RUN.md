Setup and run instructions (macOS / Linux)

1. Open a terminal and change to the project folder:
   cd /Users/naveenchitturi/Downloads/CABC

2. Create & activate a virtual environment (recommended):
   python3 -m venv venv
   source venv/bin/activate

3. Install dependencies:
   pip install -r requirements.txt

4. Configure environment (recommended):
   Export these before running the server (adjust values):

   macOS/Linux (zsh):
   export SECRET_KEY="change-me"
   export GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   export ADMIN_EMAILS="admin1@example.com,admin2@example.com"
   export ADMIN_TOKEN="set-a-deploy-token"
   export MAX_UPLOAD_MB=5
   # Optional fallback admin username/password (if you cannot create Google OAuth)
   export ADMIN_USER="admin@example.com"
   export ADMIN_PASS="choose-a-strong-password"

   Windows (PowerShell):
   $env:SECRET_KEY="change-me"
   $env:GOOGLE_CLIENT_ID="your-client-id.apps.googleusercontent.com"
   $env:ADMIN_EMAILS="admin1@example.com,admin2@example.com"
   $env:ADMIN_TOKEN="set-a-deploy-token"
   $env:MAX_UPLOAD_MB=5

5. Run the server:
   python app.py
   - The app listens on http://127.0.0.1:5000 by default.

5. Open the site in your browser:
   http://127.0.0.1:5000/

6. Submit a membership form using the site. Files and data are stored locally:
   - Uploaded photos: /Users/naveenchitturi/Downloads/CABC/uploads/
   - Membership records: /Users/naveenchitturi/Downloads/CABC/data/memberships.json
   - Login logs (admin users): /Users/naveenchitturi/Downloads/CABC/data/login_logs.json

Security & Admin
- Bulk upload endpoints (/upload/memberships, /upload/prayers) require the header X-Admin-Token to match ADMIN_TOKEN. The browser export buttons automatically attach the token if you store it in localStorage under key ADMIN_TOKEN.
- Admin login uses Google Sign-In. Set GOOGLE_CLIENT_ID and list allowed admin emails in ADMIN_EMAILS (comma-separated). On successful admin login, the server appends a log entry with login_time; on logout it writes logout_time and duration_seconds. Use the Admin dropdown -> Logout to end the session.

Validation & Limits
- Phone must be 10 digits. Aadhar must be 12 digits (if provided). Email must contain '@' and '.'.
- Allowed file types: png, jpg, jpeg, gif, pdf. Max upload size defaults to MAX_UPLOAD_MB (5 MB).

Quick test using curl (multipart form):
curl -v -F "memberName=Test Person" -F "memberDob=1990-01-01" \
  -F "memberPhone=1234567890" -F "memberEmail=test@example.com" \
  -F "memberAddress=Somewhere" -F "memberBaptized=yes" \
  -F "memberPrevChurch=None" -F "memberWhy=Join" \
  -F "familyPhoto=@/path/to/local/photo.jpg" \
  http://127.0.0.1:5000/api/memberships

Bulk JSON upload (requires X-Admin-Token):
curl -s -X POST http://127.0.0.1:5000/upload/prayers \
   -H "Content-Type: application/json" \
   -H "X-Admin-Token: $ADMIN_TOKEN" \
   -d '[{"ts": 123, "name": "Alice", "anon": false, "text": "Pray"}]'

curl -s -X POST http://127.0.0.1:5000/upload/memberships \
   -H "Content-Type: application/json" \
   -H "X-Admin-Token: $ADMIN_TOKEN" \
   -d '[]'

Troubleshooting
- Port in use: change port in app.py (app.run(..., port=PORT)).
- File permissions: ensure the process can write to uploads/ and data/ (create them manually if required).
- Allowed file types: png, jpg, jpeg, gif. Other types will be rejected.
- Static files: app serves files from the project root. If your browser requests fail, confirm file paths (css/, js/).
- To stop the server: Ctrl+C in the terminal. To deactivate venv: deactivate

Windows (PowerShell)
1. cd C:\Users\<you>\Downloads\CABC
2. python -m venv venv
3. .\venv\Scripts\Activate.ps1
4. pip install -r requirements.txt
5. python app.py

Optional
- Use ngrok to expose the local server for remote testing (ngrok http 5000).
- If you want a production setup, use a WSGI server (gunicorn/uwsgi) and configure file permissions and backups for data/memberships.json.
 - For Google Sign-In, create OAuth credentials in Google Cloud Console (Web type), add your origins (https://yourdomain, http://localhost:5000 for local), and copy the Client ID into GOOGLE_CLIENT_ID.

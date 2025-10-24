from flask import Flask, request, jsonify, send_from_directory, abort, session
from werkzeug.utils import secure_filename
from werkzeug.exceptions import RequestEntityTooLarge
import os
import json
from datetime import datetime
import re

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
UPLOAD_DIR = os.path.join(BASE_DIR, 'uploads')
DATA_DIR = os.path.join(BASE_DIR, 'data')
MEMBERS_FILE = os.path.join(DATA_DIR, 'memberships.json')
ALLOWED_EXT = {'png', 'jpg', 'jpeg', 'gif', 'pdf'}
# App config
MAX_UPLOAD_MB = int(os.getenv('MAX_UPLOAD_MB', '5'))
app = Flask(__name__, static_folder=BASE_DIR, static_url_path='')
app.config['MAX_CONTENT_LENGTH'] = MAX_UPLOAD_MB * 1024 * 1024

# Secrets and admin config
ADMIN_TOKEN = os.getenv('ADMIN_TOKEN', '').strip()
GOOGLE_CLIENT_ID = os.getenv('GOOGLE_CLIENT_ID', '').strip()
SECRET_KEY = os.getenv('SECRET_KEY', 'dev-secret').strip()
ADMIN_EMAILS = [e.strip().lower() for e in os.getenv('ADMIN_EMAILS', '').split(',') if e.strip()]
app.secret_key = SECRET_KEY
ADMIN_USER = os.getenv('ADMIN_USER', '').strip()
ADMIN_PASS = os.getenv('ADMIN_PASS', '').strip()

# Ensure directories exist
os.makedirs(UPLOAD_DIR, exist_ok=True)
os.makedirs(DATA_DIR, exist_ok=True)
if not os.path.exists(MEMBERS_FILE):
    with open(MEMBERS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)
# Pending submissions files
PENDING_PRAYERS_FILE = os.path.join(DATA_DIR, 'pending_prayers.json')
PENDING_MEMBERS_FILE = os.path.join(DATA_DIR, 'pending_members.json')
if not os.path.exists(PENDING_PRAYERS_FILE):
    with open(PENDING_PRAYERS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)
if not os.path.exists(PENDING_MEMBERS_FILE):
    with open(PENDING_MEMBERS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)
LOGIN_LOGS_FILE = os.path.join(DATA_DIR, 'login_logs.json')
if not os.path.exists(LOGIN_LOGS_FILE):
    with open(LOGIN_LOGS_FILE, 'w', encoding='utf-8') as f:
        json.dump([], f)

def allowed_filename(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXT

def validate_phone(phone: str) -> bool:
    return bool(re.fullmatch(r"\d{10}", phone))

def validate_aadhar(aadhar: str) -> bool:
    if not aadhar:
        return True
    return bool(re.fullmatch(r"\d{12}", aadhar))

def validate_email(email: str) -> bool:
    if not email:
        return True
    return ('@' in email and '.' in email)

def validate_membership_form(form: dict):
    name = (form.get('memberName') or '').strip()
    phone = (form.get('memberPhone') or '').strip()
    email = (form.get('memberEmail') or '').strip()
    aadhar = (form.get('memberAadhar') or '').strip()
    if not name:
        return False, 'Name is required'
    if not validate_phone(phone):
        return False, 'Phone must be 10 digits'
    if not validate_email(email):
        return False, 'Invalid email address'
    if not validate_aadhar(aadhar):
        return False, 'Aadhar must be 12 digits'
    return True, None

def require_admin_token():
    if not ADMIN_TOKEN:
        # No token set -> do not enforce (development convenience)
        return True
    token = request.headers.get('X-Admin-Token', '')
    return token == ADMIN_TOKEN

def is_admin_email(email: str) -> bool:
    return (email or '').strip().lower() in ADMIN_EMAILS if ADMIN_EMAILS else False

def append_login_log(email: str, name: str):
    try:
        with open(LOGIN_LOGS_FILE, 'r+', encoding='utf-8') as fh:
            try:
                logs = json.load(fh)
            except Exception:
                logs = []
            logs.append({
                'email': email,
                'name': name,
                'login_time': datetime.utcnow().isoformat() + 'Z',
                'logout_time': None,
                'duration_seconds': None
            })
            fh.seek(0)
            json.dump(logs, fh, indent=2, ensure_ascii=False)
            fh.truncate()
    except Exception:
        pass

def close_last_login_log(email: str):
    try:
        with open(LOGIN_LOGS_FILE, 'r+', encoding='utf-8') as fh:
            try:
                logs = json.load(fh)
            except Exception:
                logs = []
            for i in range(len(logs)-1, -1, -1):
                entry = logs[i]
                if entry.get('email','').lower() == (email or '').lower() and not entry.get('logout_time'):
                    entry['logout_time'] = datetime.utcnow().isoformat() + 'Z'
                    try:
                        t1 = datetime.fromisoformat(entry['login_time'].replace('Z',''))
                        t2 = datetime.fromisoformat(entry['logout_time'].replace('Z',''))
                        entry['duration_seconds'] = int((t2 - t1).total_seconds())
                    except Exception:
                        entry['duration_seconds'] = None
                    break
            fh.seek(0)
            json.dump(logs, fh, indent=2, ensure_ascii=False)
            fh.truncate()
    except Exception:
        pass

@app.route('/')
def index():
    return send_from_directory(BASE_DIR, 'index.html')

# Serve other static files (css, js, images, know_more.html, etc.)
@app.route('/<path:filename>')
def static_files(filename):
    # Prevent directory traversal
    safe_path = os.path.join(BASE_DIR, filename)
    if os.path.exists(safe_path):
        return send_from_directory(BASE_DIR, filename)
    abort(404)

@app.route('/config')
def config_endpoint():
    return jsonify(googleClientId=GOOGLE_CLIENT_ID, adminEmails=ADMIN_EMAILS)

@app.route('/auth/me')
def auth_me():
    u = session.get('user')
    return jsonify(user=u) if u else jsonify(user=None)

@app.route('/auth/google/verify', methods=['POST'])
def auth_google_verify():
    try:
        data = request.get_json(silent=True) or {}
        token = data.get('id_token') or data.get('credential')
        if not token:
            return jsonify(success=False, message='Missing id_token'), 400
        if not GOOGLE_CLIENT_ID:
            return jsonify(success=False, message='Server missing GOOGLE_CLIENT_ID'), 500
        # Verify token with Google's certs
        from google.oauth2 import id_token as google_id_token
        from google.auth.transport import requests as google_requests
        idinfo = google_id_token.verify_oauth2_token(token, google_requests.Request(), GOOGLE_CLIENT_ID)
        email = idinfo.get('email')
        name = idinfo.get('name') or ''
        picture = idinfo.get('picture') or ''
        sub = idinfo.get('sub')
        if not email:
            return jsonify(success=False, message='No email in token'), 400
        is_admin = is_admin_email(email)
        session['user'] = {'email': email, 'name': name, 'picture': picture, 'sub': sub, 'admin': is_admin}
        if is_admin:
            append_login_log(email, name)
        return jsonify(success=True, user=session['user'])
    except Exception as e:
        return jsonify(success=False, message=str(e)), 400

@app.route('/auth/logout', methods=['POST'])
def auth_logout():
    u = session.get('user')
    if u and u.get('admin'):
        close_last_login_log(u.get('email'))
    session.clear()
    return jsonify(success=True)


@app.route('/auth/login', methods=['POST'])
def auth_login():
    """Simple username/password fallback for environments without Google OAuth.
    Expects JSON: {username, password}
    Requires ADMIN_USER and ADMIN_PASS to be set in env.
    """
    try:
        if not ADMIN_USER or not ADMIN_PASS:
            return jsonify(success=False, message='Server not configured for fallback login'), 500
        data = request.get_json(silent=True) or {}
        username = (data.get('username') or '').strip()
        password = (data.get('password') or '').strip()
        if not username or not password:
            return jsonify(success=False, message='Missing username or password'), 400
        if username != ADMIN_USER or password != ADMIN_PASS:
            return jsonify(success=False, message='Invalid credentials'), 401
        # login successful
        email = username
        name = username
        is_admin = True
        session['user'] = {'email': email, 'name': name, 'picture': '', 'sub': None, 'admin': is_admin}
        append_login_log(email, name)
        return jsonify(success=True, user=session['user'])
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/api/prayers', methods=['GET'])
def api_prayers():
    """Return the saved prayers JSON file. Requires admin token or admin session."""
    PRAYERS_FILE = os.path.join(DATA_DIR, 'prayers.json')
    try:
        # enforce admin access unless ADMIN_TOKEN not set (dev convenience)
        if not require_admin_token():
            # also allow logged-in admin session
            u = session.get('user')
            if not (u and u.get('admin')):
                return jsonify(success=False, message='Unauthorized'), 401
        if not os.path.exists(PRAYERS_FILE):
            return jsonify([])
        with open(PRAYERS_FILE, 'r', encoding='utf-8') as pf:
            data = json.load(pf)
        return jsonify(data)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


PENDING_FILE = PENDING_PRAYERS_FILE


@app.route('/submit/prayer', methods=['POST'])
def submit_prayer():
    """Public endpoint for submitting prayer requests. Saves to pending_prayers.json."""
    try:
        data = request.get_json(silent=True) or {}
        name = data.get('name','').strip()
        text = data.get('text','').strip()
        anon = bool(data.get('anon', False))
        ts = data.get('ts') or datetime.utcnow().timestamp()
        if not text:
            return jsonify(success=False, message='Missing text'), 400

        # load pending list
        try:
            with open(PENDING_FILE, 'r', encoding='utf-8') as pf:
                pend = json.load(pf)
        except Exception:
            pend = []

        next_id = (max([p.get('id',0) for p in pend]) + 1) if pend else 1
        entry = {'id': next_id, 'ts': int(ts), 'name': name, 'anon': anon, 'text': text}
        pend.append(entry)
        with open(PENDING_FILE, 'w', encoding='utf-8') as pf:
            json.dump(pend, pf, indent=2, ensure_ascii=False)
        return jsonify(success=True, id=entry['id'])
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/api/pending-prayers', methods=['GET'])
def api_pending_prayers():
    """Return array of pending prayers; requires admin token or session."""
    try:
        if not require_admin_token():
            u = session.get('user')
            if not (u and u.get('admin')):
                return jsonify(success=False, message='Unauthorized'), 401
        try:
            with open(PENDING_FILE, 'r', encoding='utf-8') as pf:
                pend = json.load(pf)
        except Exception:
            pend = []
        return jsonify(pend)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/api/pending-prayers/<int:pid>/approve', methods=['POST'])
def approve_pending_prayer(pid):
    try:
        if not require_admin_token():
            u = session.get('user')
            if not (u and u.get('admin')):
                return jsonify(success=False, message='Unauthorized'), 401
        try:
            with open(PENDING_FILE, 'r', encoding='utf-8') as pf:
                pend = json.load(pf)
        except Exception:
            pend = []
        entry = None
        remaining = []
        for p in pend:
            if int(p.get('id',0)) == pid:
                entry = p
            else:
                remaining.append(p)
        if not entry:
            return jsonify(success=False, message='Not found'), 404

        # append to approved prayers file
        PRAYERS_FILE = os.path.join(DATA_DIR, 'prayers.json')
        try:
            with open(PRAYERS_FILE, 'r', encoding='utf-8') as pf:
                approved = json.load(pf)
        except Exception:
            approved = []
        approved.append(entry)
        with open(PRAYERS_FILE, 'w', encoding='utf-8') as pf:
            json.dump(approved, pf, indent=2, ensure_ascii=False)

        # write remaining pending
        with open(PENDING_FILE, 'w', encoding='utf-8') as pf:
            json.dump(remaining, pf, indent=2, ensure_ascii=False)

        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/api/pending-prayers/<int:pid>/reject', methods=['POST'])
def reject_pending_prayer(pid):
    try:
        if not require_admin_token():
            u = session.get('user')
            if not (u and u.get('admin')):
                return jsonify(success=False, message='Unauthorized'), 401
        try:
            with open(PENDING_FILE, 'r', encoding='utf-8') as pf:
                pend = json.load(pf)
        except Exception:
            pend = []
        remaining = [p for p in pend if int(p.get('id',0)) != pid]
        with open(PENDING_FILE, 'w', encoding='utf-8') as pf:
            json.dump(remaining, pf, indent=2, ensure_ascii=False)
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


# Development convenience: allow a dev login endpoint when running in debug mode
@app.route('/auth/dev-login', methods=['POST'])
def auth_dev_login():
    if not app.debug:
        return jsonify(success=False, message='Not available'), 403
    # create a dummy admin session for local testing
    email = 'dev-admin@example.com'
    session['user'] = {'email': email, 'name': 'Dev Admin', 'picture': '', 'sub': None, 'admin': True}
    append_login_log(email, 'Dev Admin')
    return jsonify(success=True, user=session['user'])

@app.route('/api/memberships', methods=['POST'])
def receive_membership():
    try:
        form = request.form
        ok, msg = validate_membership_form(form)
        if not ok:
            return jsonify(success=False, message=msg), 400
        # Basic fields (keep existing names for backward compatibility)
        name = form.get('memberName', '').strip()
        dob = form.get('memberDob', '').strip()
        phone = form.get('memberPhone', '').strip()
        email = form.get('memberEmail', '').strip()
        address = form.get('memberAddress', '').strip()
        baptized = form.get('memberBaptized', '').strip()
        prev_church = form.get('memberPrevChurch', '').strip()
        why = form.get('memberWhy', '').strip()

        # New/expanded fields from the long membership form
        birth_place = form.get('memberBirthPlace', '').strip()
        blood_group = form.get('memberBloodGroup', '').strip()
        christian_status = form.get('memberChristianStatus', '').strip()
        baptism_pastor = form.get('memberBaptismPastor', '').strip()
        baptism_year = form.get('memberBaptismYear', '').strip()
        education = form.get('memberEducation', '').strip()
        other_qualifications = form.get('memberOtherQualifications', '').strip()
        occupation = form.get('memberOccupation', '').strip()
        aadhar = form.get('memberAadhar', '').strip()
        father_name = form.get('memberFatherName', '').strip()
        father_occupation = form.get('memberFatherOcc', '').strip()
        mother_name = form.get('memberMotherName', '').strip()
        mother_occupation = form.get('memberMotherOcc', '').strip()
        spouse_name = form.get('memberSpouseName', '').strip()
        spouse_occupation = form.get('memberSpouseOcc', '').strip()
        children_json = form.get('children', '[]').strip()
        declaration = form.get('memberDeclaration', '').strip()
        declaration_date = form.get('memberDeclarationDate', '').strip()
        declaration_place = form.get('memberDeclarationPlace', '').strip()

        # File handling - allow familyPhoto and memberSignature
        saved_files = {}
        def save_file(field_name):
            if field_name in request.files:
                f = request.files[field_name]
                if f and f.filename:
                    filename = secure_filename(f.filename)
                    if not allowed_filename(filename):
                        raise ValueError(f'File type not allowed for {field_name}')
                    timestamp = datetime.utcnow().strftime('%Y%m%d%H%M%S')
                    name_pref = filename.rsplit('.', 1)[0]
                    ext = filename.rsplit('.', 1)[1]
                    saved_name = f"{field_name}_{name_pref}_{timestamp}.{ext}"
                    save_path = os.path.join(UPLOAD_DIR, saved_name)
                    f.save(save_path)
                    return saved_name
            return None

        family_photo_name = save_file('familyPhoto')
        signature_name = save_file('memberSignature')

        # Build a membership record (without assigning approved ID yet)
        record = {
                'name': name,
                'dob': dob,
                'phone': phone,
                'email': email,
                'address': address,
                'baptized': baptized,
                'previous_church': prev_church,
                'why': why,
                'birth_place': birth_place,
                'blood_group': blood_group,
                'christian_status': christian_status,
                'baptism_pastor': baptism_pastor,
                'baptism_year': baptism_year,
                'education': education,
                'other_qualifications': other_qualifications,
                'occupation': occupation,
                'aadhar': aadhar,
                'father_name': father_name,
                'father_occupation': father_occupation,
                'mother_name': mother_name,
                'mother_occupation': mother_occupation,
                'spouse_name': spouse_name,
                'spouse_occupation': spouse_occupation,
                'children': None,
                'declaration': declaration,
                'declaration_date': declaration_date,
                'declaration_place': declaration_place,
                'files': {},
        'timestamp': datetime.utcnow().isoformat() + 'Z'
    }

        # Parse children JSON if present
        try:
            record['children'] = json.loads(children_json) if children_json else []
        except Exception:
            record['children'] = []

        if family_photo_name:
            record['files']['familyPhoto'] = family_photo_name
        if signature_name:
            record['files']['memberSignature'] = signature_name

        # Save to pending members list for admin review
        try:
            with open(PENDING_MEMBERS_FILE, 'r+', encoding='utf-8') as pf:
                try:
                    pending = json.load(pf)
                except Exception:
                    pending = []
                next_pending_id = (max([int(x.get('id', 0)) for x in pending]) + 1) if pending else 1
                record['id'] = next_pending_id
                pending.append(record)
                pf.seek(0)
                json.dump(pending, pf, indent=2, ensure_ascii=False)
                pf.truncate()
        except Exception as e:
            return jsonify(success=False, message=f'Failed to save pending membership: {e}'), 500

        resp = {'success': True, 'message': 'Submitted for review', 'pending_id': record['id']}
        if family_photo_name:
            resp['family_photo'] = '/uploads/' + family_photo_name
        if signature_name:
            resp['member_signature'] = '/uploads/' + signature_name
        return jsonify(resp)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

@app.route('/api/pending-memberships', methods=['GET'])
def list_pending_memberships():
    """Admin-only: list pending membership submissions."""
    try:
        if not require_admin_token():
            u = session.get('user')
            if not (u and u.get('admin')):
                return jsonify(success=False, message='Unauthorized'), 401
        try:
            with open(PENDING_MEMBERS_FILE, 'r', encoding='utf-8') as pf:
                pending = json.load(pf)
        except Exception:
            pending = []
        return jsonify(pending)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

@app.route('/api/pending-memberships/<int:mid>/approve', methods=['POST'])
def approve_pending_membership(mid: int):
    """Admin-only: move a pending membership into approved memberships.json."""
    try:
        if not require_admin_token():
            u = session.get('user')
            if not (u and u.get('admin')):
                return jsonify(success=False, message='Unauthorized'), 401

        # Load pending
        try:
            with open(PENDING_MEMBERS_FILE, 'r', encoding='utf-8') as pf:
                pending = json.load(pf)
        except Exception:
            pending = []

        entry = None
        remaining = []
        for p in pending:
            if int(p.get('id', 0)) == mid:
                entry = p
            else:
                remaining.append(p)
        if not entry:
            return jsonify(success=False, message='Not found'), 404

        # Append to approved memberships
        with open(MEMBERS_FILE, 'r+', encoding='utf-8') as fh:
            try:
                records = json.load(fh)
            except Exception:
                records = []
            approved_id = len(records) + 1
            entry['id'] = approved_id
            records.append(entry)
            fh.seek(0)
            json.dump(records, fh, indent=2, ensure_ascii=False)
            fh.truncate()

        # Write remaining pending
        with open(PENDING_MEMBERS_FILE, 'w', encoding='utf-8') as pf:
            json.dump(remaining, pf, indent=2, ensure_ascii=False)

        return jsonify(success=True, id=approved_id)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

@app.route('/api/pending-memberships/<int:mid>/reject', methods=['POST'])
def reject_pending_membership(mid: int):
    """Admin-only: drop a pending membership submission."""
    try:
        if not require_admin_token():
            u = session.get('user')
            if not (u and u.get('admin')):
                return jsonify(success=False, message='Unauthorized'), 401
        try:
            with open(PENDING_MEMBERS_FILE, 'r', encoding='utf-8') as pf:
                pending = json.load(pf)
        except Exception:
            pending = []
        remaining = [p for p in pending if int(p.get('id', 0)) != mid]
        with open(PENDING_MEMBERS_FILE, 'w', encoding='utf-8') as pf:
            json.dump(remaining, pf, indent=2, ensure_ascii=False)
        return jsonify(success=True)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

# Serve uploaded files
@app.route('/uploads/<path:filename>')
def uploaded_file(filename):
    return send_from_directory(UPLOAD_DIR, filename)


@app.route('/upload/memberships', methods=['POST'])
def upload_memberships_bulk():
    """Accept a JSON array of membership objects and append them to memberships.json.
    This is used by the client export button which sends application/json.
    """
    try:
        if not require_admin_token():
            return jsonify(success=False, message='Unauthorized'), 401
        if not request.is_json:
            return jsonify(success=False, message='Expected application/json'), 400
        data = request.get_json()
        if not isinstance(data, list):
            return jsonify(success=False, message='Expected a JSON array of applications'), 400

        with open(MEMBERS_FILE, 'r+', encoding='utf-8') as fh:
            try:
                records = json.load(fh)
            except Exception:
                records = []
            start_id = len(records) + 1
            saved_ids = []
            for i, item in enumerate(data):
                # Minimal normalization: ensure dict
                if not isinstance(item, dict):
                    continue
                item_record = item.copy()
                item_record['id'] = start_id + i
                item_record['timestamp'] = datetime.utcnow().isoformat() + 'Z'
                records.append(item_record)
                saved_ids.append(item_record['id'])
            fh.seek(0)
            json.dump(records, fh, indent=2, ensure_ascii=False)
            fh.truncate()

        return jsonify(success=True, message='Saved', saved=len(saved_ids), ids=saved_ids)
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500


@app.route('/upload/prayers', methods=['POST'])
def upload_prayers():
    """Accept JSON array of prayer entries and save to data/prayers.json for admin review."""
    PRAYERS_FILE = os.path.join(DATA_DIR, 'prayers.json')
    try:
        if not require_admin_token():
            return jsonify(success=False, message='Unauthorized'), 401
        if not request.is_json:
            return jsonify(success=False, message='Expected application/json'), 400
        data = request.get_json()
        if not isinstance(data, list):
            return jsonify(success=False, message='Expected a JSON array'), 400

        # Save as-is (overwrite) - this is suitable for small datasets
        with open(PRAYERS_FILE, 'w', encoding='utf-8') as pf:
            json.dump(data, pf, indent=2, ensure_ascii=False)
        return jsonify(success=True, message='Prayers saved', count=len(data))
    except Exception as e:
        return jsonify(success=False, message=str(e)), 500

@app.errorhandler(RequestEntityTooLarge)
def handle_file_too_large(e):
    return jsonify(success=False, message=f'File too large. Limit is {MAX_UPLOAD_MB} MB'), 413

if __name__ == '__main__':
    # Run: python app.py
    try:
        port = int(os.getenv('PORT') or os.getenv('FLASK_RUN_PORT') or '5000')
    except Exception:
        port = 5000
    app.run(host='127.0.0.1', port=port, debug=True)

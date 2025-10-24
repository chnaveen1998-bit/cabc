from flask import Flask, request, jsonify
from flask_cors import CORS
import os, csv, json

app = Flask(__name__)
CORS(app)

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
STORAGE_DIR = os.path.join(BASE_DIR, 'storage')
os.makedirs(STORAGE_DIR, exist_ok=True)

@app.route('/upload/prayers', methods=['POST'])
def upload_prayers():
    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({'error': 'Invalid JSON', 'details': str(e)}), 400
    if not isinstance(data, list):
        return jsonify({'error': 'Expected a JSON array of prayer objects'}), 400
    csv_path = os.path.join(STORAGE_DIR, 'prayer_requests.csv')
    json_path = os.path.join(STORAGE_DIR, 'prayer_requests.json')
    headers = ['ts', 'name', 'anon', 'text']
    try:
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for p in data:
                writer.writerow([p.get('ts',''), p.get('name',''), p.get('anon', False), p.get('text','')])
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        return jsonify({'error': 'Failed to write files', 'details': str(e)}), 500
    # return concise names to the client
    return jsonify({'status': 'saved', 'files': ['prayer_requests.csv','prayer_requests.json']}), 200

@app.route('/upload/memberships', methods=['POST'])
def upload_memberships():
    try:
        data = request.get_json(force=True)
    except Exception as e:
        return jsonify({'error': 'Invalid JSON', 'details': str(e)}), 400
    if not isinstance(data, list):
        return jsonify({'error': 'Expected a JSON array of application objects'}), 400
    csv_path = os.path.join(STORAGE_DIR, 'membership_applications.csv')
    json_path = os.path.join(STORAGE_DIR, 'membership_applications.json')
    headers = ['ts','name','dob','phone','email','address','baptized','prevChurch','why']
    try:
        with open(csv_path, 'w', newline='', encoding='utf-8') as f:
            writer = csv.writer(f)
            writer.writerow(headers)
            for a in data:
                writer.writerow([a.get('ts',''), a.get('name',''), a.get('dob',''), a.get('phone',''), a.get('email',''), a.get('address',''), a.get('baptized',''), a.get('prevChurch',''), a.get('why','')])
        with open(json_path, 'w', encoding='utf-8') as f:
            json.dump(data, f, ensure_ascii=False, indent=2)
    except Exception as e:
        return jsonify({'error': 'Failed to write files', 'details': str(e)}), 500
    return jsonify({'status': 'saved', 'files': ['membership_applications.csv','membership_applications.json']}), 200


@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'ok'}), 200

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=True)

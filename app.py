from flask import Flask, jsonify
from flask_cors import CORS
import firebase_admin
from firebase_admin import credentials
from firebase_admin import db

app = Flask(__name__)
CORS(app)

# 初始化 Firebase
cred = credentials.Certificate("/Users/xinhanyang/Downloads/items-49542-firebase-adminsdk-ls9zm-7e00eaa244.json")
firebase_admin.initialize_app(cred, {
    'databaseURL': 'https://items-49542.firebaseio.com/'
})

@app.route('/devices')
def get_devices():
    ref = db.reference('devices')
    devices = ref.get()
    return jsonify(devices)

@app.route('/toggle-borrow/<device_id>')
def toggle_borrow(device_id):
    ref = db.reference(f'devices/{device_id}')
    device = ref.get()
    if device:
        device['borrowed'] = not device['borrowed']
        ref.set(device)
        return jsonify({"success": True, "device": device})
    return jsonify({"success": False, "message": "Device not found"}), 404

if __name__ == '__main__':
    app.run(debug=True)
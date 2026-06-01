import os
from flask import Flask, request, jsonify
from flask_cors import CORS
import requests

app = Flask(__name__)
CORS(app)

MISTRAL_KEY = os.environ.get('MISTRAL_KEY')
MISTRAL_URL = "https://api.mistral.ai/v1/chat/completions"

@app.route('/ia', methods=['POST'])
def ia():
    data = request.json
    headers = {
        "Authorization": f"Bearer {MISTRAL_KEY}",
        "Content-Type": "application/json"
    }
    payload = {
        "model": "mistral-small-latest",
        "messages": data.get('messages', []),
        "temperature": data.get('temperature', 0.7),
        "max_tokens": data.get('max_tokens', 500)
    }
    response = requests.post(MISTRAL_URL, json=payload, headers=headers)
    result = response.json()
    return jsonify({'content': result['choices'][0]['message']['content']})

@app.route('/')
def home():
    return 'Regard Créatif IA - En ligne!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
import os
from flask import Flask, request, jsonify
from flask_cors import CORS
from mistralai import Mistral

app = Flask(__name__)
CORS(app)

MISTRAL_KEY = os.environ.get('MISTRAL_KEY')
client = Mistral(api_key=MISTRAL_KEY)

@app.route('/ia', methods=['POST'])
def ia():
    data = request.json
    response = client.chat.complete(
        model="mistral-small-latest",
        messages=data.get('messages', []),
        temperature=data.get('temperature', 0.7),
        max_tokens=data.get('max_tokens', 500)
    )
    return jsonify({
        'content': response.choices[0].message.content
    })

@app.route('/')
def home():
    return 'Regard Créatif IA - En ligne!'

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=10000)
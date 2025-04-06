from flask import Flask, render_template, request, jsonify, session
from sumy.parsers.plaintext import PlaintextParser
from sumy.nlp.tokenizers import Tokenizer
from sumy.summarizers.text_rank import TextRankSummarizer
from werkzeug.utils import secure_filename
import os
import uuid
from datetime import datetime
from utils.file_processor import process_file
import nltk
import time

app = Flask(__name__)
app.secret_key = os.environ.get('SECRET_KEY') or os.urandom(24)
app.config['MAX_CONTENT_LENGTH'] = 5 * 1024 * 1024  # 5MB limit

# Configuration
UPLOAD_FOLDER = 'uploads'
ALLOWED_EXTENSIONS = {'pdf', 'docx', 'txt'}
app.config['UPLOAD_FOLDER'] = UPLOAD_FOLDER
os.makedirs(UPLOAD_FOLDER, exist_ok=True)

def initialize_nltk():
    """Initialize NLTK data with robust error handling"""
    try:
        nltk.data.find('tokenizers/punkt')
        nltk.data.find('taggers/averaged_perceptron_tagger')
    except LookupError:
        print("Downloading NLTK data...")
        try:
            nltk.download('punkt', quiet=True)
            nltk.download('averaged_perceptron_tagger', quiet=True)
            print("NLTK data downloaded successfully")
        except Exception as e:
            print(f"Error downloading NLTK data: {str(e)}")
            raise

def allowed_file(filename):
    return '.' in filename and filename.rsplit('.', 1)[1].lower() in ALLOWED_EXTENSIONS

def summarize_text(text, length='medium'):
    """Enhanced TextRank summarization with robust NLTK data handling"""
    try:
        # Verify NLTK resources are available
        nltk.data.find('tokenizers/punkt')
        
        parser = PlaintextParser.from_string(text, Tokenizer("english"))
        summarizer = TextRankSummarizer()
        
        # Adjust summary length
        if length == 'short':
            sentences_count = max(2, len(parser.document.sentences)//4)
        elif length == 'long':
            sentences_count = max(5, len(parser.document.sentences)//2)
        else:  # medium
            sentences_count = max(3, len(parser.document.sentences)//3)
            
        summary = summarizer(parser.document, min(sentences_count, len(parser.document.sentences)))
        return " ".join(str(sentence) for sentence in summary)
    except Exception as e:
        raise RuntimeError(f"Summarization error: {str(e)}")

@app.route('/')
def home():
    if 'history' not in session:
        session['history'] = []
    return render_template('index.html')

@app.route('/summarize', methods=['POST'])
def summarize():
    try:
        data = request.get_json()
        text = data.get('text', '').strip()
        length = data.get('length', 'medium')
        
        if not text:
            return jsonify({'error': 'Please enter text to summarize'}), 400
        
        summary_text = summarize_text(text, length)
        
        # History management
        history_entry = {
            'id': str(uuid.uuid4()),
            'date': datetime.now().strftime("%Y-%m-%d %H:%M"),
            'original_length': len(text.split()),
            'summary_length': len(summary_text.split()),
            'preview': text[:50] + '...' if len(text) > 50 else text
        }
        
        session['history'] = (session.get('history', [])[-9:] + [history_entry])
        session.modified = True
        
        return jsonify({
            'summary': summary_text,
            'stats': {
                'original_words': len(text.split()),
                'summary_words': len(summary_text.split()),
                'reduction': f"{round((1 - len(summary_text.split())/len(text.split())) * 100)}%"
            }
        })
        
    except Exception as e:
        return jsonify({'error': str(e)}), 500

@app.route('/upload', methods=['POST'])
def upload_file():
    if 'file' not in request.files:
        return jsonify({'error': 'No file selected'}), 400
        
    file = request.files['file']
    if file.filename == '':
        return jsonify({'error': 'No file selected'}), 400
        
    if not allowed_file(file.filename):
        return jsonify({'error': 'File type not allowed'}), 400
        
    try:
        filename = secure_filename(file.filename)
        filepath = os.path.join(app.config['UPLOAD_FOLDER'], filename)
        file.save(filepath)
        text = process_file(filepath)
        os.remove(filepath)
        return jsonify({'text': text})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    # Initialize NLTK before starting the app
    initialize_nltk()
    
    # Get port from environment variable or use 5000 as default
    port = int(os.environ.get('PORT', 5000))
    app.run(host='0.0.0.0', port=port)
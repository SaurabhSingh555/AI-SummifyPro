import PyPDF2
import docx
import os
import re

def process_file(filepath):
    """Process files with enhanced error handling"""
    ext = os.path.splitext(filepath)[1].lower()
    
    try:
        if ext == '.pdf':
            return extract_text_from_pdf(filepath)
        elif ext == '.docx':
            return extract_text_from_docx(filepath)
        elif ext == '.txt':
            with open(filepath, 'r', encoding='utf-8') as f:
                return clean_text(f.read())
        else:
            raise ValueError("Unsupported file format")
    except Exception as e:
        raise RuntimeError(f"File processing error: {str(e)}")

def extract_text_from_pdf(filepath):
    text = ""
    with open(filepath, 'rb') as f:
        reader = PyPDF2.PdfReader(f)
        for page in reader.pages:
            text += page.extract_text() + "\n"
    return clean_text(text)

def extract_text_from_docx(filepath):
    doc = docx.Document(filepath)
    return clean_text("\n".join(para.text for para in doc.paragraphs if para.text))

def clean_text(text):
    """Remove excessive whitespace and normalize text"""
    text = re.sub(r'\s+', ' ', text)  # Replace multiple spaces/newlines
    return text.strip()
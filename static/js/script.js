document.addEventListener('DOMContentLoaded', function() {
    // DOM Elements
    const inputText = document.getElementById('input-text');
    const summarizeBtn = document.getElementById('summarize-btn');
    const summaryOutput = document.getElementById('summary-output');
    const copyBtn = document.getElementById('copy-btn');
    const downloadBtn = document.getElementById('download-btn');
    const uploadBtn = document.getElementById('upload-btn');
    const fileInput = document.getElementById('file-input');
    const wordCount = document.getElementById('word-count');
    const originalWords = document.getElementById('original-words');
    const summaryWords = document.getElementById('summary-words');
    const reduction = document.getElementById('reduction');
    const lengthSelector = document.getElementById('length');
    const historyList = document.getElementById('history-list');
    const clearHistoryBtn = document.getElementById('clear-history');
    const themeToggle = document.getElementById('theme-toggle');

    // Initialize
    updateWordCount();
    loadHistory();
    setupEventListeners();

    function setupEventListeners() {
        inputText.addEventListener('input', updateWordCount);
        summarizeBtn.addEventListener('click', summarizeText);
        copyBtn.addEventListener('click', copySummary);
        downloadBtn.addEventListener('click', downloadSummary);
        uploadBtn.addEventListener('click', () => fileInput.click());
        fileInput.addEventListener('change', handleFileUpload);
        clearHistoryBtn.addEventListener('click', clearHistory);
        themeToggle.addEventListener('click', toggleTheme);
    }

    function updateWordCount() {
        const text = inputText.value.trim();
        const count = text ? text.split(/\s+/).length : 0;
        wordCount.textContent = count.toLocaleString();
    }

    async function summarizeText() {
        const text = inputText.value.trim();
        const length = lengthSelector.value;
        
        if (!text) {
            showError('Please enter some text to summarize');
            return;
        }
        
        try {
            const response = await fetch('/summarize', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    text: text,
                    length: length
                })
            });
            
            const data = await response.json();
            
            if (response.ok) {
                displaySummary(data.summary, data.stats);
                addToHistory(text, data.summary, data.stats);
            } else {
                throw new Error(data.error || 'Failed to summarize text');
            }
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        }
    }

    function displaySummary(summary, stats) {
        // Clear placeholder if exists
        const placeholder = summaryOutput.querySelector('.placeholder');
        if (placeholder) placeholder.remove();
        
        // Create summary paragraphs
        summaryOutput.innerHTML = '';
        const paragraphs = summary.split('\n').filter(p => p.trim() !== '');
        
        paragraphs.forEach(p => {
            const paragraph = document.createElement('p');
            paragraph.textContent = p;
            paragraph.classList.add('summary-content');
            summaryOutput.appendChild(paragraph);
        });
        
        // Update stats
        if (stats) {
            originalWords.textContent = stats.original_words.toLocaleString();
            summaryWords.textContent = stats.summary_words.toLocaleString();
            reduction.textContent = stats.reduction;
        }
        
        // Enable buttons
        copyBtn.disabled = false;
        downloadBtn.disabled = false;
    }

    function copySummary() {
        const textToCopy = summaryOutput.textContent;
        
        if (!textToCopy || summaryOutput.querySelector('.placeholder')) {
            showError('No summary to copy');
            return;
        }
        
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                showTooltip(copyBtn, 'Copied!');
            })
            .catch(err => {
                console.error('Failed to copy:', err);
                showError('Failed to copy text');
            });
    }

    function downloadSummary() {
        const textToDownload = summaryOutput.textContent;
        
        if (!textToDownload || summaryOutput.querySelector('.placeholder')) {
            showError('No summary to download');
            return;
        }
        
        const blob = new Blob([textToDownload], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'summary.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    async function handleFileUpload(event) {
        const file = event.target.files[0];
        if (!file) return;
        
        try {
            const formData = new FormData();
            formData.append('file', file);
            
            const response = await fetch('/upload', {
                method: 'POST',
                body: formData
            });
            
            const data = await response.json();
            
            if (response.ok) {
                inputText.value = data.text;
                updateWordCount();
            } else {
                throw new Error(data.error || 'Failed to process file');
            }
        } catch (error) {
            console.error('Error:', error);
            showError(error.message);
        } finally {
            fileInput.value = '';
        }
    }

    function addToHistory(originalText, summary, stats) {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        historyItem.innerHTML = `
            <div class="history-item-info">
                <span class="history-item-date">${new Date().toLocaleString()}</span>
                <span class="history-item-preview" title="${originalText.substring(0, 100)}...">
                    ${originalText.substring(0, 50)}${originalText.length > 50 ? '...' : ''}
                </span>
            </div>
            <div class="history-item-stats">
                <span class="history-item-stat">
                    <i class="fas fa-text-width"></i>
                    ${stats.original_words}
                </span>
                <span class="history-item-stat">
                    <i class="fas fa-compress-alt"></i>
                    ${stats.reduction}
                </span>
            </div>
        `;
        
        historyItem.addEventListener('click', () => {
            inputText.value = originalText;
            updateWordCount();
            displaySummary(summary, stats);
            window.scrollTo({ top: 0, behavior: 'smooth' });
        });
        
        // Remove empty state if exists
        const historyEmpty = historyList.querySelector('.history-empty');
        if (historyEmpty) historyEmpty.remove();
        
        // Add to top of history
        historyList.insertBefore(historyItem, historyList.firstChild);
        
        // Limit to 10 items
        if (historyList.children.length > 10) {
            historyList.removeChild(historyList.lastChild);
        }
    }

    function loadHistory() {
        // In a real app, you would load from server
        const historyEmpty = historyList.querySelector('.history-empty');
        if (historyEmpty) return;
        
        historyList.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-clock-rotate-left"></i>
                <p>Your summary history will appear here</p>
            </div>
        `;
    }

    function clearHistory() {
        if (!confirm('Clear all history?')) return;
        historyList.innerHTML = `
            <div class="history-empty">
                <i class="fas fa-clock-rotate-left"></i>
                <p>Your summary history will appear here</p>
            </div>
        `;
    }

    function toggleTheme() {
        const currentTheme = document.documentElement.getAttribute('data-theme');
        const newTheme = currentTheme === 'light' ? 'dark' : 'light';
        
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('theme', newTheme);
        
        const icon = themeToggle.querySelector('i');
        icon.className = newTheme === 'light' ? 'fas fa-moon' : 'fas fa-sun';
    }

    function showError(message) {
        const errorElement = document.createElement('div');
        errorElement.className = 'error-message';
        errorElement.innerHTML = `
            <i class="fas fa-exclamation-circle"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(errorElement);
        
        setTimeout(() => {
            errorElement.remove();
        }, 5000);
    }

    function showTooltip(element, message) {
        const tooltip = document.createElement('div');
        tooltip.className = 'tooltip-message';
        tooltip.textContent = message;
        
        const rect = element.getBoundingClientRect();
        tooltip.style.left = `${rect.left + rect.width / 2}px`;
        tooltip.style.top = `${rect.top - 10}px`;
        tooltip.style.transform = 'translate(-50%, -100%)';
        
        document.body.appendChild(tooltip);
        
        setTimeout(() => {
            tooltip.remove();
        }, 2000);
    }
});


import './style.css'

interface JSONLEntry {
  string_table?: string[];
  [key: string]: any;
}

interface ProcessedEntry {
  [key: string]: any;
}

class JSONLViewer {
  private stringTable: string[] = [];
  private entries: ProcessedEntry[] = [];
  private showAllColumns = false;
  private rawJSONL: string = '';
  
  private readonly hiddenColumns = [
    'timestamp', 'pathname', 'lineno', 'has_payload', 'payload_filename', 'rank', 'process', 'thread'
  ];
  private readonly STORAGE_KEY = 'tlparse-jsonl-data';

  constructor() {
    this.init();
  }

  private init() {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = this.getHTML();
    this.setupEventListeners();
    this.loadFromStorage();
  }

  private getHTML(): string {
    return `
      <div class="upload-section" id="upload-section">
        <h1>JSONL Viewer</h1>
        <div class="upload-options">
          <div class="file-input-wrapper">
            <input type="file" id="file-input" accept=".jsonl,.json">
            <label for="file-input">Choose File</label>
          </div>
          <input type="text" id="url-input" class="url-input" placeholder="Enter JSONL URL...">
          <button id="load-url" class="load-button">Load from URL</button>
        </div>
        <div class="drop-zone" id="drop-zone">
          Or drag and drop a JSONL file here
        </div>
      </div>
      <div class="table-container" id="table-container" style="display: none;">
        <div class="table-controls">
          <label>
            <input type="checkbox" id="show-all-columns">
            Show all columns
          </label>
          <button id="clear-data" class="clear-button">Clear Data</button>
          <span id="entry-count"></span>
        </div>
        <div style="overflow: auto;">
          <table class="data-table" id="data-table">
            <thead id="table-head"></thead>
            <tbody id="table-body"></tbody>
          </table>
        </div>
      </div>
      <div class="error" id="error-message" style="display: none;"></div>
    `;
  }

  private setupEventListeners() {
    const fileInput = document.getElementById('file-input') as HTMLInputElement;
    const urlInput = document.getElementById('url-input') as HTMLInputElement;
    const loadUrlButton = document.getElementById('load-url') as HTMLButtonElement;
    const dropZone = document.getElementById('drop-zone') as HTMLDivElement;
    const showAllCheckbox = document.getElementById('show-all-columns') as HTMLInputElement;
    const clearButton = document.getElementById('clear-data') as HTMLButtonElement;

    fileInput.addEventListener('change', (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        this.loadFile(file);
      }
    });

    loadUrlButton.addEventListener('click', () => {
      const url = urlInput.value.trim();
      if (url) {
        this.loadFromURL(url);
      }
    });

    urlInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        const url = urlInput.value.trim();
        if (url) {
          this.loadFromURL(url);
        }
      }
    });

    // Drag and drop
    dropZone.addEventListener('dragover', (e) => {
      e.preventDefault();
      dropZone.classList.add('drag-over');
    });

    dropZone.addEventListener('dragleave', () => {
      dropZone.classList.remove('drag-over');
    });

    dropZone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropZone.classList.remove('drag-over');
      const file = e.dataTransfer?.files[0];
      if (file) {
        this.loadFile(file);
      }
    });

    showAllCheckbox.addEventListener('change', (e) => {
      this.showAllColumns = (e.target as HTMLInputElement).checked;
      this.renderTable();
    });

    clearButton.addEventListener('click', () => {
      this.clearData();
    });
  }

  private async loadFile(file: File) {
    try {
      const text = await file.text();
      this.parseJSONL(text);
    } catch (error) {
      this.showError('Failed to read file: ' + (error as Error).message);
    }
  }

  private async loadFromURL(url: string) {
    try {
      const response = await fetch(url);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      const text = await response.text();
      this.parseJSONL(text);
    } catch (error) {
      this.showError('Failed to load from URL: ' + (error as Error).message);
    }
  }

  private parseJSONL(text: string) {
    try {
      const lines = text.trim().split('\n');
      const rawEntries: JSONLEntry[] = [];
      
      for (const line of lines) {
        if (line.trim()) {
          rawEntries.push(JSON.parse(line));
        }
      }

      if (rawEntries.length === 0) {
        throw new Error('No valid JSONL entries found');
      }

      // Extract string table from first entry
      const firstEntry = rawEntries[0];
      if (firstEntry.string_table) {
        this.stringTable = firstEntry.string_table;
        rawEntries.shift(); // Remove string table entry
      }

      // Process entries
      this.entries = rawEntries.map(entry => this.processEntry(entry));
      
      // Save to localStorage
      this.rawJSONL = text;
      this.saveToStorage();
      
      this.hideUploadSection();
      this.renderTable();
      
    } catch (error) {
      this.showError('Failed to parse JSONL: ' + (error as Error).message);
    }
  }

  private processEntry(entry: JSONLEntry): ProcessedEntry {
    const processed = { ...entry };
    
    // Handle dynamo_start events specially - replace interned strings
    if (processed.dynamo_start && processed.dynamo_start.stack) {
      processed.dynamo_start = {
        ...processed.dynamo_start,
        stack: processed.dynamo_start.stack.map((frame: any) => ({
          ...frame,
          filename: typeof frame.filename === 'number' 
            ? this.stringTable[frame.filename] || frame.filename
            : frame.filename
        }))
      };
    }

    return processed;
  }

  private hideUploadSection() {
    const uploadSection = document.getElementById('upload-section')!;
    const tableContainer = document.getElementById('table-container')!;
    
    uploadSection.style.display = 'none';
    tableContainer.style.display = 'block';
  }

  private renderTable() {
    if (this.entries.length === 0) return;

    const tableHead = document.getElementById('table-head')!;
    const tableBody = document.getElementById('table-body')!;
    const entryCount = document.getElementById('entry-count')!;

    // Define the well-known common fields
    const commonFields = ['frame_compile_id', 'frame_id', 'attempt', 'rank', 'process', 'thread'];
    
    // Create column structure: frame + visible common fields + hidden fields (if shown) + event key + event content
    let columns = ['frame'];
    
    // Add common fields (excluding frame-related ones which are consolidated)
    columns.push(...commonFields.filter(col => !['frame_compile_id', 'frame_id', 'attempt'].includes(col)));
    
    // Add hidden columns if showAllColumns is true
    if (this.showAllColumns) {
      columns.push(...this.hiddenColumns);
    }
    
    // Add the event key and content columns
    columns.push('event_key', 'event_content');

    // Render header
    const headerRow = columns.map(col => {
      const isHidden = this.hiddenColumns.includes(col);
      const className = !this.showAllColumns && isHidden ? 'hidden' : '';
      return `<th class="${className}">${col}</th>`;
    }).join('');
    tableHead.innerHTML = `<tr>${headerRow}</tr>`;

    // Render body
    const rows = this.entries.map(entry => {
      const cells = columns.map(col => {
        const isHidden = this.hiddenColumns.includes(col);
        const className = (!this.showAllColumns && isHidden ? 'hidden ' : '') + 
                          (col === 'event_content' ? 'json-cell' : '');
        
        let value = '';
        
        if (col === 'frame') {
          // Consolidated frame column
          const frameId = entry.frame_id !== undefined ? entry.frame_id : '';
          const compileId = entry.frame_compile_id !== undefined ? entry.frame_compile_id : '';
          const attempt = entry.attempt || 0;
          value = `${frameId}/${compileId}${attempt > 0 ? '_' + attempt : ''}`;
        } else if (col === 'event_key') {
          // Find the event key (non-common, non-hidden field)
          const eventKey = Object.keys(entry).find(key => 
            !commonFields.includes(key) && 
            !this.hiddenColumns.includes(key)
          ) || '';
          value = eventKey;
        } else if (col === 'event_content') {
          // Find the event key and stringify its content
          const eventKey = Object.keys(entry).find(key => 
            !commonFields.includes(key) && 
            !this.hiddenColumns.includes(key)
          );
          if (eventKey && entry[eventKey] !== undefined) {
            if (typeof entry[eventKey] === 'object' && entry[eventKey] !== null) {
              value = JSON.stringify(entry[eventKey], null, 2);
            } else {
              value = String(entry[eventKey]);
            }
          }
        } else {
          value = entry[col] !== undefined ? String(entry[col]) : '';
        }
        
        return `<td class="${className}">${this.escapeHtml(value)}</td>`;
      }).join('');
      
      return `<tr>${cells}</tr>`;
    }).join('');
    
    tableBody.innerHTML = rows;
    entryCount.textContent = `${this.entries.length} entries`;
  }

  private escapeHtml(unsafe: string): string {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  private showError(message: string) {
    const errorElement = document.getElementById('error-message')!;
    errorElement.textContent = message;
    errorElement.style.display = 'block';
    
    // Auto-hide after 5 seconds
    setTimeout(() => {
      errorElement.style.display = 'none';
    }, 5000);
  }

  private saveToStorage() {
    try {
      localStorage.setItem(this.STORAGE_KEY, this.rawJSONL);
    } catch (error) {
      console.warn('Failed to save to localStorage:', error);
    }
  }

  private loadFromStorage() {
    try {
      const savedData = localStorage.getItem(this.STORAGE_KEY);
      if (savedData) {
        this.parseJSONL(savedData);
      }
    } catch (error) {
      console.warn('Failed to load from localStorage:', error);
      localStorage.removeItem(this.STORAGE_KEY);
    }
  }

  private clearData() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      this.rawJSONL = '';
      this.stringTable = [];
      this.entries = [];
      this.showUploadSection();
    } catch (error) {
      console.warn('Failed to clear localStorage:', error);
    }
  }

  private showUploadSection() {
    const uploadSection = document.getElementById('upload-section')!;
    const tableContainer = document.getElementById('table-container')!;
    
    uploadSection.style.display = 'block';
    tableContainer.style.display = 'none';
  }
}

// Initialize the application
new JSONLViewer();
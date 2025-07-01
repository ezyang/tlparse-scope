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
  private filteredEntries: ProcessedEntry[] = [];
  private showAllColumns = false;
  private rawJSONL: string = '';
  private selectedEventKey: string = 'all';
  private selectedFrame: string = 'all';
  private eventDataColumns: string[] = [];
  private visibleEventColumns: Set<string> = new Set();
  private tensorIndex: Map<number, any> = new Map();
  
  private readonly hiddenColumns = [
    'timestamp', 'pathname', 'lineno', 'has_payload', 'payload_filename', 'rank', 'process', 'thread'
  ];
  private readonly STORAGE_KEY = 'tlparse-jsonl-data';

  constructor() {
    this.init();
  }

  private updateUrlFromFilters() {
    const url = new URL(window.location.href);
    
    if (this.selectedEventKey !== 'all') {
      url.searchParams.set('event', this.selectedEventKey);
    } else {
      url.searchParams.delete('event');
    }
    
    if (this.selectedFrame !== 'all') {
      url.searchParams.set('frame', this.selectedFrame);
    } else {
      url.searchParams.delete('frame');
    }
    
    if (this.showAllColumns) {
      url.searchParams.set('showAll', 'true');
    } else {
      url.searchParams.delete('showAll');
    }
    
    window.history.replaceState({}, '', url.toString());
  }

  private loadFiltersFromUrl() {
    const url = new URL(window.location.href);
    
    const eventParam = url.searchParams.get('event');
    if (eventParam) {
      this.selectedEventKey = eventParam;
    }
    
    const frameParam = url.searchParams.get('frame');
    if (frameParam) {
      this.selectedFrame = frameParam;
    }
    
    const showAllParam = url.searchParams.get('showAll');
    if (showAllParam === 'true') {
      this.showAllColumns = true;
    }
  }

  private syncFilterUIWithState() {
    const eventFilter = document.getElementById('event-filter') as HTMLSelectElement;
    const frameFilter = document.getElementById('frame-filter') as HTMLSelectElement;
    const showAllCheckbox = document.getElementById('show-all-columns') as HTMLInputElement;
    
    if (eventFilter) eventFilter.value = this.selectedEventKey;
    if (frameFilter) frameFilter.value = this.selectedFrame;
    if (showAllCheckbox) showAllCheckbox.checked = this.showAllColumns;
  }

  private init() {
    const app = document.querySelector<HTMLDivElement>('#app')!;
    app.innerHTML = this.getHTML();
    this.loadFiltersFromUrl();
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
          <div class="control-group">
            <label>Event:</label>
            <select id="event-filter" class="filter-select">
              <option value="all">All Events</option>
            </select>
          </div>
          <div class="control-group">
            <label>Frame:</label>
            <select id="frame-filter" class="filter-select">
              <option value="all">All Frames</option>
            </select>
          </div>
          <div class="control-group">
            <label>
              <input type="checkbox" id="show-all-columns">
              Show all columns
            </label>
          </div>
          <button id="clear-data" class="clear-button">Clear Data</button>
          <span id="entry-count"></span>
        </div>
        <div class="column-controls" id="column-controls" style="display: none;">
          <div class="column-toggle-header">
            <span>Event Data Columns:</span>
            <div class="toggle-all-buttons">
              <button id="select-all-columns" class="toggle-button">All</button>
              <button id="select-none-columns" class="toggle-button">None</button>
            </div>
          </div>
          <div class="column-checkboxes" id="column-checkboxes"></div>
        </div>
        <div class="table-wrapper">
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
    const eventFilter = document.getElementById('event-filter') as HTMLSelectElement;
    const frameFilter = document.getElementById('frame-filter') as HTMLSelectElement;
    const selectAllColumns = document.getElementById('select-all-columns') as HTMLButtonElement;
    const selectNoneColumns = document.getElementById('select-none-columns') as HTMLButtonElement;

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
      this.updateUrlFromFilters();
      this.renderTable();
    });

    clearButton.addEventListener('click', () => {
      this.clearData();
    });

    eventFilter.addEventListener('change', (e) => {
      this.selectedEventKey = (e.target as HTMLSelectElement).value;
      this.updateUrlFromFilters();
      this.applyFilters();
    });

    frameFilter.addEventListener('change', (e) => {
      this.selectedFrame = (e.target as HTMLSelectElement).value;
      this.updateUrlFromFilters();
      this.applyFilters();
    });

    selectAllColumns.addEventListener('click', () => {
      this.visibleEventColumns = new Set(this.eventDataColumns);
      this.updateColumnCheckboxes();
      this.renderTable();
    });

    selectNoneColumns.addEventListener('click', () => {
      this.visibleEventColumns.clear();
      this.updateColumnCheckboxes();
      this.renderTable();
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

  private parseJSONL(text: string, saveToStorage: boolean = true) {
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

      // Check if we have any data entries after removing string table
      if (rawEntries.length === 0) {
        this.entries = [];
        this.filteredEntries = [];
        this.hideUploadSection();
        this.renderTable();
        return;
      }

      // Process entries
      this.entries = this.processEntries(rawEntries);
      this.filteredEntries = [...this.entries];
      
      // Collect all unique event keys and frames
      this.collectEventKeysAndFrames();
      
      // Apply filters after populating dropdowns
      this.applyFilters();
      
      // Save to localStorage only if requested
      if (saveToStorage) {
        this.rawJSONL = text;
        this.saveToStorage();
      }
      
      this.hideUploadSection();
      
    } catch (error) {
      this.showError('Failed to parse JSONL: ' + (error as Error).message);
    }
  }

  private processEntries(rawEntries: JSONLEntry[]): ProcessedEntry[] {
    // Clear tensor index for each new dataset
    this.tensorIndex.clear();
    
    const processedEntries: ProcessedEntry[] = [];
    
    for (const entry of rawEntries) {
      const processed = this.processEntry(entry);
      
      // Build tensor index from describe_tensor events
      if (processed.describe_tensor) {
        const tensorData = processed.describe_tensor;
        if (tensorData.describer_id !== undefined) {
          this.tensorIndex.set(tensorData.describer_id, tensorData);
        }
      }
      
      // Join describe_source events with tensor data
      if (processed.describe_source) {
        const sourceData = processed.describe_source;
        if (sourceData.describer_id !== undefined) {
          const tensorData = this.tensorIndex.get(sourceData.describer_id);
          if (tensorData) {
            // Create joined event with all tensor columns inlined
            const joinedData = { ...sourceData };
            
            // Add all tensor fields except id/describer_id to avoid conflicts
            Object.keys(tensorData).forEach(key => {
              if (key !== 'id' && key !== 'describer_id') {
                joinedData[key] = tensorData[key];
              }
            });
            
            processed.describe_source = joinedData;
          }
        }
      }
      
      processedEntries.push(processed);
    }
    
    return processedEntries;
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

  private collectEventKeysAndFrames() {
    const eventKeys = new Set<string>();
    const frames = new Set<string>();
    
    const commonFields = ['frame_compile_id', 'frame_id', 'attempt', 'rank', 'process', 'thread'];
    
    this.entries.forEach(entry => {
      // Collect event keys
      const eventKey = Object.keys(entry).find(key => 
        !commonFields.includes(key) && 
        !this.hiddenColumns.includes(key)
      );
      if (eventKey) {
        eventKeys.add(eventKey);
      }
      
      // Collect frames
      const frameId = entry.frame_id !== undefined ? entry.frame_id : '';
      const compileId = entry.frame_compile_id !== undefined ? entry.frame_compile_id : '';
      const attempt = entry.attempt || 0;
      const frameStr = `${frameId}/${compileId}${attempt > 0 ? '_' + attempt : ''}`;
      frames.add(frameStr);
    });
    
    this.populateFilterDropdowns(Array.from(eventKeys).sort(), Array.from(frames).sort());
    this.updateEventDataColumns();
  }
  
  private updateEventDataColumns() {
    const allEventDataColumns = new Set<string>();
    const commonFields = ['frame_compile_id', 'frame_id', 'attempt', 'rank', 'process', 'thread'];
    
    // Only collect columns from entries that match the current filter
    const entriesToCheck = this.selectedEventKey === 'all' ? this.entries : this.filteredEntries;
    
    entriesToCheck.forEach(entry => {
      const eventKey = Object.keys(entry).find(key => 
        !commonFields.includes(key) && 
        !this.hiddenColumns.includes(key)
      );
      
      if (eventKey && (this.selectedEventKey === 'all' || eventKey === this.selectedEventKey)) {
        // Collect event data columns
        if (typeof entry[eventKey] === 'object' && entry[eventKey] !== null) {
          Object.keys(entry[eventKey]).forEach(subKey => {
            allEventDataColumns.add(subKey);
          });
        }
      }
    });
    
    this.eventDataColumns = Array.from(allEventDataColumns).sort();
    this.visibleEventColumns = new Set(this.eventDataColumns); // Show all by default
    this.updateColumnControls();
  }
  
  private populateFilterDropdowns(eventKeys: string[], frames: string[]) {
    const eventFilter = document.getElementById('event-filter') as HTMLSelectElement;
    const frameFilter = document.getElementById('frame-filter') as HTMLSelectElement;
    
    // Populate event filter
    eventFilter.innerHTML = '<option value="all">All Events</option>';
    eventKeys.forEach(key => {
      eventFilter.innerHTML += `<option value="${key}">${key}</option>`;
    });
    
    // Populate frame filter
    frameFilter.innerHTML = '<option value="all">All Frames</option>';
    frames.forEach(frame => {
      frameFilter.innerHTML += `<option value="${frame}">${frame}</option>`;
    });
    
    // Sync UI with current filter values
    this.syncFilterUIWithState();
  }
  
  private updateColumnControls() {
    const columnControls = document.getElementById('column-controls')!;
    if (this.selectedEventKey !== 'all' && this.eventDataColumns.length > 0) {
      columnControls.style.display = 'block';
      this.updateColumnCheckboxes();
    } else {
      columnControls.style.display = 'none';
    }
  }
  
  private updateColumnCheckboxes() {
    const columnCheckboxes = document.getElementById('column-checkboxes')!;
    columnCheckboxes.innerHTML = '';
    
    this.eventDataColumns.forEach(column => {
      const isChecked = this.visibleEventColumns.has(column);
      columnCheckboxes.innerHTML += `
        <label class="column-checkbox">
          <input type="checkbox" value="${column}" ${isChecked ? 'checked' : ''}>
          ${column}
        </label>
      `;
    });
    
    // Add event listeners to checkboxes
    columnCheckboxes.querySelectorAll('input[type="checkbox"]').forEach(checkbox => {
      checkbox.addEventListener('change', (e) => {
        const target = e.target as HTMLInputElement;
        const column = target.value;
        if (target.checked) {
          this.visibleEventColumns.add(column);
        } else {
          this.visibleEventColumns.delete(column);
        }
        this.renderTable();
      });
    });
  }
  
  private applyFilters() {
    const commonFields = ['frame_compile_id', 'frame_id', 'attempt', 'rank', 'process', 'thread'];
    
    this.filteredEntries = this.entries.filter(entry => {
      // Filter by event key
      if (this.selectedEventKey !== 'all') {
        const eventKey = Object.keys(entry).find(key => 
          !commonFields.includes(key) && 
          !this.hiddenColumns.includes(key)
        );
        if (eventKey !== this.selectedEventKey) {
          return false;
        }
      }
      
      // Filter by frame
      if (this.selectedFrame !== 'all') {
        const frameId = entry.frame_id !== undefined ? entry.frame_id : '';
        const compileId = entry.frame_compile_id !== undefined ? entry.frame_compile_id : '';
        const attempt = entry.attempt || 0;
        const frameStr = `${frameId}/${compileId}${attempt > 0 ? '_' + attempt : ''}`;
        if (frameStr !== this.selectedFrame) {
          return false;
        }
      }
      
      return true;
    });
    
    // Update event data columns based on filtered entries
    this.updateEventDataColumns();
    this.renderTable();
  }

  private renderTable() {
    const tableHead = document.getElementById('table-head')!;
    const tableBody = document.getElementById('table-body')!;
    const entryCount = document.getElementById('entry-count')!;
    
    if (this.entries.length === 0) {
      entryCount.textContent = '0 entries';
      return;
    }

    // Define the well-known common fields
    const commonFields = ['frame_compile_id', 'frame_id', 'attempt', 'rank', 'process', 'thread'];
    
    // Create column structure
    let columns: string[] = [];
    
    // Add frame column (only if not filtering by specific frame)
    if (this.selectedFrame === 'all') {
      columns.push('frame');
    }
    
    // Add common fields (excluding frame-related ones which are consolidated)
    columns.push(...commonFields.filter(col => !['frame_compile_id', 'frame_id', 'attempt'].includes(col)));
    
    // Add hidden columns if showAllColumns is true
    if (this.showAllColumns) {
      columns.push(...this.hiddenColumns);
    }
    
    // Add event key column (only if not filtering by specific event)
    if (this.selectedEventKey === 'all') {
      columns.push('event_key');
    }
    
    // If filtering by specific event and have event data columns, show individual columns
    if (this.selectedEventKey !== 'all' && this.eventDataColumns.length > 0) {
      columns.push(...this.eventDataColumns.filter(col => this.visibleEventColumns.has(col)));
    } else {
      // Otherwise show the JSON event content
      columns.push('event_content');
    }

    // Render header
    const headerRow = columns.map(col => {
      const isHidden = this.hiddenColumns.includes(col);
      const className = !this.showAllColumns && isHidden ? 'hidden' : '';
      return `<th class="${className}">${col}</th>`;
    }).join('');
    tableHead.innerHTML = `<tr>${headerRow}</tr>`;

    // Render body
    const rows = this.filteredEntries.map(entry => {
      const cells = columns.map(col => {
        const isHidden = this.hiddenColumns.includes(col);
        let className = (!this.showAllColumns && isHidden ? 'hidden ' : '');
        
        let value = '';
        
        if (col === 'frame') {
          const frameId = entry.frame_id !== undefined ? entry.frame_id : '';
          const compileId = entry.frame_compile_id !== undefined ? entry.frame_compile_id : '';
          const attempt = entry.attempt || 0;
          value = `${frameId}/${compileId}${attempt > 0 ? '_' + attempt : ''}`;
        } else if (col === 'event_key') {
          const eventKey = Object.keys(entry).find(key => 
            !commonFields.includes(key) && 
            !this.hiddenColumns.includes(key)
          ) || '';
          value = eventKey;
        } else if (col === 'event_content') {
          className += 'json-cell';
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
        } else if (this.eventDataColumns.includes(col)) {
          // Event data column
          const eventKey = Object.keys(entry).find(key => 
            !commonFields.includes(key) && 
            !this.hiddenColumns.includes(key)
          );
          if (eventKey && entry[eventKey] && typeof entry[eventKey] === 'object') {
            const eventData = entry[eventKey][col];
            if (eventData !== undefined) {
              if (typeof eventData === 'object' && eventData !== null) {
                className += 'json-cell';
                value = JSON.stringify(eventData, null, 2);
              } else {
                value = String(eventData);
              }
            }
          }
        } else {
          value = entry[col] !== undefined ? String(entry[col]) : '';
        }
        
        return `<td class="${className.trim()}">${this.escapeHtml(value)}</td>`;
      }).join('');
      
      return `<tr>${cells}</tr>`;
    }).join('');
    
    tableBody.innerHTML = rows;
    entryCount.textContent = `${this.filteredEntries.length} of ${this.entries.length} entries`;
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
        this.rawJSONL = savedData; // Set rawJSONL before parsing
        this.parseJSONL(savedData, false); // Don't save to storage when loading
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
      this.filteredEntries = [];
      this.selectedEventKey = 'all';
      this.selectedFrame = 'all';
      this.showAllColumns = false;
      this.eventDataColumns = [];
      this.visibleEventColumns.clear();
      this.tensorIndex.clear();
      
      // Clear URL parameters
      const url = new URL(window.location.href);
      url.searchParams.delete('event');
      url.searchParams.delete('frame');
      url.searchParams.delete('showAll');
      window.history.replaceState({}, '', url.toString());
      
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
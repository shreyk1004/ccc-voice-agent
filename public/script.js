const API_BASE = '';

// Wait for DOM to be ready before attaching event listeners
document.addEventListener('DOMContentLoaded', function() {
    // Get DOM elements
    const uploadSection = document.getElementById('uploadSection');
    const audioFile = document.getElementById('audioFile');
    const processBtn = document.getElementById('processButton');
    const downloadBtn = document.getElementById('downloadButton');
    
    // Drag and drop functionality
    if (uploadSection && audioFile) {
        uploadSection.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadSection.classList.add('dragover');
        });

        uploadSection.addEventListener('dragleave', () => {
            uploadSection.classList.remove('dragover');
        });

        uploadSection.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadSection.classList.remove('dragover');
            const files = e.dataTransfer.files;
            if (files.length > 0) {
                audioFile.files = files;
                updateUploadUI(files[0]);
            }
        });

        uploadSection.addEventListener('click', (e) => {
            // Only trigger file input if clicking on the upload area itself, not child elements
            if (e.target === uploadSection || e.target.tagName === 'H3' || e.target.tagName === 'P') {
                audioFile.click();
            }
        });

        // Add file selection feedback
        audioFile.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                updateUploadUI(file);
            }
        });
        
        console.log('Upload functionality initialized');
    }
    
    // Process button event listener
    if (processBtn) {
        processBtn.addEventListener('click', processAudio);
        console.log('Process button event listener attached');
    }
    
    // Download button event listener
    if (downloadBtn) {
        downloadBtn.addEventListener('click', downloadResults);
        console.log('Download button event listener attached');
    } else {
        console.error('Download button not found!');
    }
});

// Global variables to store results
let currentTranscriptionResult = null;
let currentExtractionResult = null;

async function processAudio() {
    const file = audioFile.files[0];
    if (!file) {
        alert('Please select an audio file');
        return;
    }

    const extractionType = document.getElementById('extractionType').value;
    
    // Show loading
    document.getElementById('loading').style.display = 'block';
    document.getElementById('results').style.display = 'none';
    
    try {
        // Step 1: Upload and transcribe audio
        console.log('Step 1: Transcribing audio...');
        const transcriptionResult = await transcribeAudio(file);
        console.log('Transcription result:', transcriptionResult);
        
        // Store and display transcription
        currentTranscriptionResult = transcriptionResult;
        document.getElementById('transcriptionText').textContent = JSON.stringify(transcriptionResult, null, 2);
        
        // Step 2: Extract data from transcription
        console.log('Step 2: Extracting data...');
        const extractionResult = await extractData(transcriptionResult.transcription.text, extractionType);
        console.log('Extraction result:', extractionResult);
        
        // Store and display extraction
        currentExtractionResult = extractionResult;
        document.getElementById('extractionText').textContent = JSON.stringify(extractionResult, null, 2);
        
        // Show results
        document.getElementById('loading').style.display = 'none';
        document.getElementById('results').style.display = 'block';
        
        // Ensure download button is visible
        const downloadBtn = document.getElementById('downloadButton');
        if (downloadBtn) {
            downloadBtn.style.display = 'block';
            console.log('Download button should now be visible');
        } else {
            console.error('Download button not found when showing results!');
        }
        
    } catch (error) {
        console.error('Error:', error);
        document.getElementById('loading').style.display = 'none';
        showError('Error processing audio: ' + error.message);
    }
}

async function transcribeAudio(file) {
    const formData = new FormData();
    formData.append('audio', file);
    formData.append('model', 'fal-whisper');
    formData.append('timestamp', 'true');
    formData.append('speakerDiarization', 'false');

    const response = await fetch('/api/transcription/upload', {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error(`Transcription failed: ${response.statusText}`);
    }

    return await response.json();
}

async function extractData(transcription, extractionType) {
    const response = await fetch('/api/extraction/extract', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            transcription: transcription,
            extractionType: extractionType
        })
    });

    if (!response.ok) {
        throw new Error(`Data extraction failed: ${response.statusText}`);
    }

    return await response.json();
}

function showError(message) {
    const resultsDiv = document.getElementById('results');
    resultsDiv.innerHTML = `
        <div class="result-section error">
            <h3>❌ Error</h3>
            <p>${message}</p>
        </div>
    `;
    resultsDiv.style.display = 'block';
}

function updateUploadUI(file) {
    const uploadSection = document.getElementById('uploadSection');
    const fileName = file.name;
    const fileSize = (file.size / 1024 / 1024).toFixed(2); // Convert to MB
    
    // Update upload section to show selected file
    uploadSection.style.background = '#e8f5e8';
    uploadSection.style.borderColor = '#28a745';
    
    // Find or create file info display
    let fileInfo = document.getElementById('fileInfo');
    if (!fileInfo) {
        fileInfo = document.createElement('div');
        fileInfo.id = 'fileInfo';
        fileInfo.style.marginTop = '10px';
        fileInfo.style.padding = '10px';
        fileInfo.style.background = '#d4edda';
        fileInfo.style.border = '1px solid #c3e6cb';
        fileInfo.style.borderRadius = '4px';
        fileInfo.style.fontSize = '14px';
        uploadSection.appendChild(fileInfo);
    }
    
    fileInfo.innerHTML = `
        <strong>✅ File Selected:</strong><br>
        📁 ${fileName}<br>
        📊 ${fileSize} MB
    `;
    
    console.log(`File selected: ${fileName} (${fileSize} MB)`);
}

function downloadResults() {
    if (!currentTranscriptionResult || !currentExtractionResult) {
        alert('No results available to download. Please process an audio file first.');
        return;
    }

    // Create comprehensive results object
    const results = {
        timestamp: new Date().toISOString(),
        extraction_type: document.getElementById('extractionType').value,
        transcription: currentTranscriptionResult,
        extraction: currentExtractionResult,
        file_info: {
            original_filename: currentTranscriptionResult.metadata?.fileName || 'unknown',
            file_size: currentTranscriptionResult.metadata?.fileSize || 0,
            mime_type: currentTranscriptionResult.metadata?.mimeType || 'unknown'
        }
    };

    // Generate filename with timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
    const extractionType = document.getElementById('extractionType').value;
    const baseFilename = `voice-extraction-${extractionType}-${timestamp}`;

    // Create JSON file
    const jsonData = JSON.stringify(results, null, 2);
    downloadFile(jsonData, `${baseFilename}.json`, 'application/json');

    // Create XML file
    const xmlData = convertToXML(results);
    downloadFile(xmlData, `${baseFilename}.xml`, 'application/xml');
    
    console.log(`Downloaded results as both JSON and XML files`);
}

function convertToXML(data) {
    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<voice_extraction_results>\n';
    
    // Add timestamp and metadata
    xml += `  <timestamp>${escapeXML(data.timestamp)}</timestamp>\n`;
    xml += `  <extraction_type>${escapeXML(data.extraction_type)}</extraction_type>\n`;
    
    // File information
    xml += '  <file_info>\n';
    xml += `    <original_filename>${escapeXML(data.file_info.original_filename)}</original_filename>\n`;
    xml += `    <file_size>${data.file_info.file_size}</file_size>\n`;
    xml += `    <mime_type>${escapeXML(data.file_info.mime_type)}</mime_type>\n`;
    xml += '  </file_info>\n';
    
    // Transcription
    xml += '  <transcription>\n';
    xml += `    <text>${escapeXML(data.transcription.transcription?.text || '')}</text>\n`;
    xml += `    <confidence>${data.transcription.transcription?.confidence || 0}</confidence>\n`;
    xml += `    <model>${escapeXML(data.transcription.transcription?.model || '')}</model>\n`;
    xml += `    <word_count>${data.transcription.transcription?.wordCount || 0}</word_count>\n`;
    if (data.transcription.transcription?.duration) {
        xml += `    <duration>${data.transcription.transcription.duration}</duration>\n`;
    }
    xml += '  </transcription>\n';
    
    // Extracted data - this is the main comprehensive data
    xml += '  <extracted_data>\n';
    xml += `    <success>${data.extraction.extractedData?.success || false}</success>\n`;
    xml += `    <confidence>${data.extraction.extractedData?.confidence || 0}</confidence>\n`;
    
    if (data.extraction.extractedData?.extractedData) {
        const extractedFields = data.extraction.extractedData.extractedData;
        
        // Customer Information
        xml += '    <customer_information>\n';
        xml += `      <customer_name>${escapeXML(extractedFields.customer_name || '')}</customer_name>\n`;
        xml += `      <contact_info>${escapeXML(extractedFields.contact_info || '')}</contact_info>\n`;
        xml += `      <service_requests>${escapeXML(extractedFields.service_requests || '')}</service_requests>\n`;
        xml += '    </customer_information>\n';
        
        // Vehicle Information
        xml += '    <vehicle_information>\n';
        xml += `      <vin>${escapeXML(extractedFields.vin || '')}</vin>\n`;
        xml += `      <vehicle_type>${escapeXML(extractedFields.vehicle_type || '')}</vehicle_type>\n`;
        xml += `      <type>${escapeXML(extractedFields.type || '')}</type>\n`;
        xml += `      <year>${escapeXML(extractedFields.year || '')}</year>\n`;
        xml += `      <make>${escapeXML(extractedFields.make || '')}</make>\n`;
        xml += `      <model>${escapeXML(extractedFields.model || '')}</model>\n`;
        xml += `      <body_style>${escapeXML(extractedFields.body_style || '')}</body_style>\n`;
        xml += `      <engine>${escapeXML(extractedFields.engine || '')}</engine>\n`;
        xml += `      <interior_color>${escapeXML(extractedFields.interior_color || '')}</interior_color>\n`;
        xml += `      <exterior_color>${escapeXML(extractedFields.exterior_color || '')}</exterior_color>\n`;
        xml += `      <paint_code>${escapeXML(extractedFields.paint_code || '')}</paint_code>\n`;
        xml += `      <trim_code>${escapeXML(extractedFields.trim_code || '')}</trim_code>\n`;
        xml += `      <license_plate>${escapeXML(extractedFields.license_plate || '')}</license_plate>\n`;
        xml += `      <license_state>${escapeXML(extractedFields.license_state || '')}</license_state>\n`;
        xml += `      <license_expiration>${escapeXML(extractedFields.license_expiration || '')}</license_expiration>\n`;
        xml += `      <job_number>${escapeXML(extractedFields.job_number || '')}</job_number>\n`;
        xml += `      <production_date>${escapeXML(extractedFields.production_date || '')}</production_date>\n`;
        xml += `      <mileage_in>${escapeXML(extractedFields.mileage_in || '')}</mileage_in>\n`;
        xml += `      <mileage_out>${escapeXML(extractedFields.mileage_out || '')}</mileage_out>\n`;
        xml += `      <fuel_level>${escapeXML(extractedFields.fuel_level || '')}</fuel_level>\n`;
        xml += '    </vehicle_information>\n';
        
        // Damage Assessment
        xml += '    <damage_assessment>\n';
        xml += `      <repairable_condition>${escapeXML(extractedFields.repairable_condition || '')}</repairable_condition>\n`;
        xml += `      <primary_impact>${escapeXML(extractedFields.primary_impact || '')}</primary_impact>\n`;
        xml += `      <secondary_impact>${escapeXML(extractedFields.secondary_impact || '')}</secondary_impact>\n`;
        xml += `      <drivable_status>${escapeXML(extractedFields.drivable_status || '')}</drivable_status>\n`;
        xml += `      <impact_notes>${escapeXML(extractedFields.impact_notes || '')}</impact_notes>\n`;
        xml += `      <prior_damage_notes>${escapeXML(extractedFields.prior_damage_notes || '')}</prior_damage_notes>\n`;
        xml += `      <problem_description>${escapeXML(extractedFields.problem_description || '')}</problem_description>\n`;
        xml += `      <diagnosis>${escapeXML(extractedFields.diagnosis || '')}</diagnosis>\n`;
        xml += '    </damage_assessment>\n';
        
        // Repair Work
        xml += '    <repair_work>\n';
        xml += `      <repairs_performed>${escapeXML(extractedFields.repairs_performed || '')}</repairs_performed>\n`;
        xml += `      <labor_type>${escapeXML(extractedFields.labor_type || '')}</labor_type>\n`;
        xml += `      <tasks_performed>${escapeXML(extractedFields.tasks_performed || '')}</tasks_performed>\n`;
        xml += `      <time_per_task>${escapeXML(extractedFields.time_per_task || '')}</time_per_task>\n`;
        xml += `      <total_hours>${escapeXML(extractedFields.total_hours || '')}</total_hours>\n`;
        xml += `      <labor_time>${escapeXML(extractedFields.labor_time || '')}</labor_time>\n`;
        xml += `      <difficulty_level>${escapeXML(extractedFields.difficulty_level || '')}</difficulty_level>\n`;
        xml += `      <technician_notes>${escapeXML(extractedFields.technician_notes || '')}</technician_notes>\n`;
        xml += '    </repair_work>\n';
        
        // Parts & Operations
        xml += '    <parts_operations>\n';
        xml += `      <parts_used>${escapeXML(extractedFields.parts_used || '')}</parts_used>\n`;
        xml += `      <part_numbers>${escapeXML(extractedFields.part_numbers || '')}</part_numbers>\n`;
        xml += `      <part_descriptions>${escapeXML(extractedFields.part_descriptions || '')}</part_descriptions>\n`;
        xml += `      <quantities>${escapeXML(extractedFields.quantities || '')}</quantities>\n`;
        xml += `      <suppliers>${escapeXML(extractedFields.suppliers || '')}</suppliers>\n`;
        xml += `      <costs>${escapeXML(extractedFields.costs || '')}</costs>\n`;
        xml += `      <installation_notes>${escapeXML(extractedFields.installation_notes || '')}</installation_notes>\n`;
        xml += `      <paint_needed>${escapeXML(extractedFields.paint_needed || '')}</paint_needed>\n`;
        xml += `      <operation_notes>${escapeXML(extractedFields.operation_notes || '')}</operation_notes>\n`;
        xml += `      <estimate_line>${escapeXML(extractedFields.estimate_line || '')}</estimate_line>\n`;
        xml += `      <operation_type>${escapeXML(extractedFields.operation_type || '')}</operation_type>\n`;
        xml += `      <operation_description>${escapeXML(extractedFields.operation_description || '')}</operation_description>\n`;
        xml += `      <quantity>${escapeXML(extractedFields.quantity || '')}</quantity>\n`;
        xml += `      <unit_price>${escapeXML(extractedFields.unit_price || '')}</unit_price>\n`;
        xml += `      <estimated_total>${escapeXML(extractedFields.estimated_total || '')}</estimated_total>\n`;
        xml += '    </parts_operations>\n';
        
        // Recommendations
        xml += '    <recommendations>\n';
        xml += `      <recommendations>${escapeXML(extractedFields.recommendations || '')}</recommendations>\n`;
        xml += '    </recommendations>\n';
    }
    
    xml += '  </extracted_data>\n';
    xml += '</voice_extraction_results>';
    
    return xml;
}

function escapeXML(text) {
    if (typeof text !== 'string') {
        return String(text || '');
    }
    return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&apos;');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const downloadLink = document.createElement('a');
    downloadLink.href = URL.createObjectURL(blob);
    downloadLink.download = filename;
    downloadLink.style.display = 'none';
    
    document.body.appendChild(downloadLink);
    downloadLink.click();
    document.body.removeChild(downloadLink);
    
    // Small delay between downloads to avoid browser issues
    setTimeout(() => {
        URL.revokeObjectURL(downloadLink.href);
    }, 100);
} 
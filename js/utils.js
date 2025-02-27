export function verifyUploadedResume() {
    chrome.storage.local.get(['resume', 'resumeData'], function(result) {
        if (result.resume && result.resumeData) {
            const summary = document.createElement('div');
            summary.className = 'upload-summary';
            
            // Create a more detailed summary of the parsed data
            let skillsList = result.resumeData.skills?.join(', ') || 'No skills found';
            let experienceList = 'No experience entries found';
            
            // Safely handle experience data
            if (Array.isArray(result.resumeData.experience)) {
                experienceList = result.resumeData.experience
                    .map(exp => {
                        // Ensure description is a string
                        const description = String(exp?.description || '');
                        return `${exp?.duration || 'N/A'}: ${description.slice(0, 50)}...`;
                    })
                    .join('<br>') || 'No experience entries found';
            }
            
            summary.innerHTML = `
                <h3>Parsed Resume Data:</h3>
                <div class="parsed-section">
                    <h4>Skills Found (${result.resumeData.skills?.length || 0}):</h4>
                    <p>${skillsList}</p>
                </div>
                <div class="parsed-section">
                    <h4>Experience (${result.resumeData.experience?.length || 0} entries):</h4>
                    <p>${experienceList}</p>
                </div>
                <div class="parsed-section">
                    <h4>Summary:</h4>
                    <p>${String(result.resumeData.summary || '').slice(0, 100)}...</p>
                </div>
            `;
            
            const uploadSection = document.getElementById('uploadSection');
            const existingSummary = uploadSection.querySelector('.upload-summary');
            if (existingSummary) {
                existingSummary.remove();
            }
            uploadSection.appendChild(summary);
        }
    });
}

export function updateStatus(message, isError = false) {
    const status = document.getElementById('status');
    const uploadError = document.querySelector('.upload-error');
    const progressBar = document.querySelector('.upload-progress');
    
    if (isError) {
        status.textContent = '';
        uploadError.textContent = message;
        uploadError.style.display = 'block';
        progressBar.style.display = 'none';
    } else {
        status.textContent = message;
        uploadError.style.display = 'none';
        if (message) {
            progressBar.style.display = 'block';
        }
    }
} 
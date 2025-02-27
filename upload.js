import { parsePDF } from './js/pdf-parser.js';
import { parseResumeWithAI } from './js/openai-parser.js';
import { verifyUploadedResume, updateStatus } from './js/utils.js';

// Add this at the beginning of the file for debugging

document.addEventListener('DOMContentLoaded', function() {
    // Make sure progress bar is hidden and animation is disabled initially
    const progressContainer = document.querySelector('.upload-progress');
    if (progressContainer) {
        progressContainer.style.display = 'none';
        progressContainer.innerHTML = `
            <div class="progress-bar" style="animation: none; width: 0;"></div>
            <div class="progress-percentage">0%</div>
        `;
    }
    
    // Check if we're re-uploading
    const params = new URLSearchParams(window.location.search);
    const isReupload = params.get('reupload') === 'true';
    
    if (isReupload) {
        // This is a re-upload, clear existing data
        document.querySelector('h1').textContent = 'Upload New Resume';
        chrome.storage.local.remove(['resume', 'resumeData'], function() {
            updateStatus('Previous resume data cleared. Ready for new upload.');
        });
    } else {
        // Check if we already have a resume
        chrome.storage.local.get(['resume'], function(result) {
            if (result.resume) {
                // Redirect to popup with a message about already having a resume
                updateStatus('You already have a resume uploaded. Use the extension popup to manage it.');
                
                // Show a button to force re-upload
                const actionArea = document.createElement('div');
                actionArea.innerHTML = `
                    <button id="forceReupload" class="primary-btn">Upload New Resume Anyway</button>
                    <button id="goBack" class="secondary-btn">Go Back</button>
                `;
                document.querySelector('.container').appendChild(actionArea);
                
                document.getElementById('forceReupload').addEventListener('click', function() {
                    // Clear existing data and reload page with reupload flag
                    chrome.storage.local.remove(['resume', 'resumeData'], function() {
                        window.location.href = 'upload.html?reupload=true';
                    });
                });
                
                document.getElementById('goBack').addEventListener('click', function() {
                    window.close();
                });
            }
        });
    }

    const uploadInput = document.getElementById('resumeUpload');
    const fileName = document.getElementById('fileName');
    const backButton = document.getElementById('backButton');
    
    // Fix the event listener for file upload
    if (uploadInput) {
        uploadInput.addEventListener('change', function(e) {
            e.preventDefault();
            const file = e.target.files[0];
            
            if (!file) {
                updateStatus('No file selected', true);
                return;
            }
            
            // Before starting processing, reset and show the progress bar
            const progressContainer = document.querySelector('.upload-progress');
            const progressBar = progressContainer.querySelector('.progress-bar');
            
            // First make sure animation is disabled and width is 0
            progressBar.style.animation = 'none';
            progressBar.style.width = '0';
            
            // Then show the container
            progressContainer.style.display = 'block';
            
            // Check file format
            const fileExt = file.name.split('.').pop().toLowerCase();
            if (!['pdf', 'doc', 'docx', 'txt'].includes(fileExt)) {
                updateStatus('Unsupported file type. Please upload PDF, DOC, DOCX, or TXT files.', true);
                return;
            }
            
            // Show processing state
            updateStatus('Processing resume...');
            
            // Use try-catch to handle errors in file processing
            try {
                processResume(file);
            } catch (error) {
                updateStatus('Error: ' + error.message, true);
                progressContainer.style.display = 'none';
            }
        });
    } else {
        updateStatus('Error: File upload element not found', true);
    }

    // Fix the Back to Dashboard button
    if (backButton) {
        backButton.addEventListener('click', function(e) {
            e.preventDefault();
            
            // Use Chrome API to close the current tab
            chrome.tabs.getCurrent(function(tab) {
                if (tab) {
                    chrome.tabs.remove(tab.id);
                } else {
                    // Fallback if we can't get the current tab
                    window.close();
                }
            });
        });
    } else {
        updateStatus('Error: Back button not found', true);
    }
});

// Copy the necessary functions from popup.js (processResumeFile, processResume, etc.)
async function processResumeFile(file) {
    // Same implementation as in popup.js
    updateStatus('Starting file processing...');
    
    const fileType = file.name.split('.').pop().toLowerCase();
    
    if (!['pdf', 'doc', 'docx', 'txt'].includes(fileType)) {
        throw new Error('Unsupported file type. Please upload PDF, DOC, DOCX, or TXT files.');
    }

    try {
        let text = '';
        
        if (fileType === 'pdf') {
            updateStatus('Reading PDF file...');
            text = await parsePDF(file);
            if (!text) {
                throw new Error('No text extracted from PDF');
            }
        } else {
            // Handle other file types...
        }

        updateStatus('Analyzing resume with AI...');
        const parsedData = await parseResumeWithAI(text);
        
        return parsedData;
        
    } catch (error) {
        updateStatus(error.message, true);
        throw error;
    }
}

// Update the processResume function to include progress tracking
async function processResume(file) {
    updateStatus('Processing resume...');
    const progressContainer = document.querySelector('.upload-progress');
    const progressBar = progressContainer.querySelector('.progress-bar');
    const percentageElement = document.querySelector('.progress-percentage');
    progressContainer.style.display = 'block';
    updateProgress(10, 'Starting file processing...'); // Initial progress
    
    // Create a progress update function
    function updateProgress(percentage, message) {
        if (percentageElement) {
            percentageElement.textContent = `${percentage}%`;
        }
        if (message) {
            updateStatus(message);
        }
    }
    
    // Update progress as we process
    updateProgress(20, 'Reading file...');
    
    // Modified process to update progress
    let resumeData;
    try {
        const fileType = file.name.split('.').pop().toLowerCase();
        
        if (fileType === 'pdf') {
            updateProgress(30, 'Extracting text from PDF...');
            updateProgress(40, 'Processing text content...');
            updateProgress(50, 'Preparing for AI analysis...');
            
            const text = await parsePDF(file);
            
            if (!text) {
                throw new Error('No text extracted from PDF');
            }
            
            updateProgress(60, 'Analyzing with AI (this may take a moment)...');
            
            // Add a pulsing animation when waiting for OpenAI
            progressContainer.classList.add('waiting-for-ai');
            
            resumeData = await parseResumeWithAI(text);
        } else {
            // Handle other file types
            updateProgress(30, 'Reading file content...');
            // Add processing for other file types
        }
        
        updateProgress(90, 'Analysis complete. Saving data...');
    } catch (error) {
        throw error; // Re-throw for outer catch
    }
    
    // Store the data
    await new Promise((resolve, reject) => {
        updateStatus('Saving resume data to storage...');
        
        // Generate a unique ID for this resume
        const resumeId = 'resume_' + Date.now();
        
        // Get existing resumes first
        chrome.storage.local.get(['resumes', 'activeResumeId'], function(existingData) {
            const resumes = existingData.resumes || [];
            
            // Create resume metadata
            const resumeMetadata = {
                id: resumeId,
                name: file.name,
                uploadDate: Date.now(),
                pageCount: resumeData.pageCount || 1,
                skillsCount: resumeData.skills?.length || 0,
                experienceCount: resumeData.experience?.length || 0
            };
            
            // Add to resumes array
            resumes.push(resumeMetadata);
            
            // Store multiple values in chrome.storage
            const updates = {
                // Update resumes list
                'resumes': resumes,
                
                // Set this as the active resume
                'activeResumeId': resumeId,
                
                // For backwards compatibility, also store as the main resume
                'resume': {
                    content: resumeData,
                    name: file.name,
                    lastModified: Date.now()
                },
                'resumeData': resumeData,
                
                // Store the individual resume data with its ID
                [`resumeData_${resumeId}`]: resumeData
            };
            
            chrome.storage.local.set(updates, function() {
                if (chrome.runtime.lastError) {
                    console.error('Storage error:', chrome.runtime.lastError);
                    reject(chrome.runtime.lastError);
                } else {
                    updateStatus('Resume data saved to storage');
                    resolve();
                    
                    // If coming from the resumes page, add a button to go back
                    const params = new URLSearchParams(window.location.search);
                    if (params.get('from') === 'resumes') {
                        const goBackBtn = document.createElement('button');
                        goBackBtn.textContent = 'Back to My Resumes';
                        goBackBtn.className = 'primary-btn';
                        goBackBtn.style.marginTop = '20px';
                        goBackBtn.addEventListener('click', function() {
                            window.location.href = 'resumes.html';
                        });
                        
                        // Add after the back button
                        const backButton = document.getElementById('backButton');
                        backButton.parentNode.insertBefore(goBackBtn, backButton);
                    }
                }
            });
        });
    });

    // Update UI elements with success state
    updateProgress(100, 'Resume uploaded and parsed successfully!');
    document.getElementById('fileName').textContent = file.name;
    
    // Show success message
    const uploadSuccess = document.getElementById('uploadSuccess');
    uploadSuccess.style.display = 'flex';
    
    // Update parsed details
    const parsedDetails = document.getElementById('parsedDetails');
    parsedDetails.style.display = 'block';
    
    // Update counts
    document.getElementById('pageCount').textContent = resumeData.pageCount || '1';
    document.getElementById('skillsCount').textContent = 
        `${resumeData.skills?.length || 0} skills detected`;
    document.getElementById('experienceCount').textContent = 
        `${resumeData.experience?.length || 0} entries found`;
    
    // Important: Make sure to hide the progress bar when complete
    progressContainer.style.display = 'none';
    
    // Add this function to verify the resumes array after upload
    verifyResumesArray();
    
}

// Also add this function to update the progress visually
function updateProgress(percentage, message) {
    const percentageElement = document.querySelector('.progress-percentage');
    const progressBar = document.querySelector('.progress-bar');
    const progressContainer = document.querySelector('.upload-progress');
    
    if (!progressContainer || !progressBar) return;
    
    // Make sure animation is disabled
    progressBar.style.animation = 'none';
    
    // Set the width based on percentage
    progressBar.style.width = `${percentage}%`;
    
    // Update the percentage text
    if (percentageElement) {
        percentageElement.textContent = `${percentage}%`;
    }
    
    // Update status message if provided
    if (message) {
        updateStatus(message);
    }
}

// Add this function to verify the resumes array after upload
function verifyResumesArray() {
    chrome.storage.local.get(['resumes'], function(result) {
        if (!Array.isArray(result.resumes)) {
            console.error('Resumes is not an array! Fixing...');
            chrome.storage.local.set({ 'resumes': [] }, function() {
                console.log('Created empty resumes array');
            });
        }
    });
} 
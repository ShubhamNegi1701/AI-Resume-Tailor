import { parsePDF } from './js/pdf-parser.js';
import { parseResumeWithAI } from './js/openai-parser.js';
import { verifyUploadedResume, updateStatus } from './js/utils.js';

document.addEventListener('DOMContentLoaded', function() {
    const uploadInput = document.getElementById('resumeUpload');
    const fileName = document.getElementById('fileName');
    const actionSection = document.getElementById('actionSection');
    const status = document.getElementById('status');
    const parsedDetails = document.getElementById('parsedDetails');
    const settingsButton = document.getElementById('settingsButton');
    const settingsModal = document.getElementById('settingsModal');
    const saveSettings = document.getElementById('saveSettings');
    const closeSettings = document.getElementById('closeSettings');
    const apiKeyInput = document.getElementById('apiKey');

    // Check if we're in "upload new" mode
    chrome.storage.local.get(['resumeUploadMode'], function(result) {
        if (result.resumeUploadMode === 'new') {
            // Reset UI to upload state
            document.getElementById('fileName').textContent = '';
            document.getElementById('actionSection').style.display = 'none';
            document.getElementById('uploadSuccess').style.display = 'none';
            document.getElementById('parsedDetails').style.display = 'none';
            
            // Remove existing summary if present
            const existingSummary = document.querySelector('.upload-summary');
            if (existingSummary) {
                existingSummary.remove();
            }
            
            // Show instructions
            updateStatus('Please select a new resume file');
            
            // Make the upload button more prominent
            const uploadLabel = document.querySelector('.upload-btn');
            uploadLabel.style.animation = 'pulse 1.5s infinite';
            
            // Add instruction message
            const uploadMessage = document.createElement('p');
            uploadMessage.className = 'upload-message';
            uploadMessage.textContent = 'Click "Choose File" to upload a new resume';
            
            // Insert after the upload button
            const uploadSection = document.getElementById('uploadSection');
            const existingMessage = uploadSection.querySelector('.upload-message');
            if (existingMessage) {
                existingMessage.remove();
            }
            uploadLabel.parentNode.insertBefore(uploadMessage, uploadLabel.nextSibling);
            
            // Reset the mode flag once we've set up the UI
            chrome.storage.local.remove(['resumeUploadMode']);
        }
    });

    // Check if resume is already uploaded and show appropriate state
    chrome.storage.local.get(['resume', 'resumeData', 'resumes'], function(result) {
        if (result.resume) {
            // Replace upload section with resume preview and summary
            const uploadSection = document.getElementById('uploadSection');
            if (uploadSection) {
                // First create the resume preview HTML
                let previewHTML = `
                    <div class="resume-preview">
                        <h2>Your Active Resume</h2>
                        <div class="resume-name">${result.resume.name || 'Resume'}</div>
                `;
                
                // Add resume summary if we have resumeData
                if (result.resumeData) {
                    const skills = result.resumeData.skills || [];
                    const experience = result.resumeData.experience || [];
                    const education = result.resumeData.education || [];
                    
                    previewHTML += `
                        <div class="resume-summary">
                            <div class="summary-item">
                                <span class="summary-label">Skills:</span>
                                <span class="summary-value">${skills.length} skills</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Experience:</span>
                                <span class="summary-value">${experience.length} positions</span>
                            </div>
                            <div class="summary-item">
                                <span class="summary-label">Education:</span>
                                <span class="summary-value">${education.length} entries</span>
                            </div>
                        </div>
                        
                        <div class="skills-preview">
                            ${skills.slice(0, 5).map(skill => `<span class="skill-tag">${skill}</span>`).join('')}
                            ${skills.length > 5 ? `<span class="more-skills">+${skills.length - 5} more</span>` : ''}
                        </div>
                    `;
                }
                
                // Add actions at the bottom
                previewHTML += `
                        <div class="resume-actions">
                            <button id="manageResumesBtn" class="primary-btn">Manage Resumes</button>
                        </div>
                    </div>
                `;
                
                // Set the HTML
                uploadSection.innerHTML = previewHTML;
                
                // Add event listener for the manage button
                const manageBtn = document.getElementById('manageResumesBtn');
                if (manageBtn) {
                    manageBtn.addEventListener('click', function() {
                        chrome.tabs.create({url: 'resumes.html'});
                    });
                }
            }
            
            // Update filename display
            fileName.textContent = result.resume.name || 'Resume uploaded';
            actionSection.style.display = 'block';
            
            // Show success message
            const uploadSuccess = document.getElementById('uploadSuccess');
            uploadSuccess.style.display = 'flex';
            
            // Show count of all resumes if we have multiple
            if (result.resumes && result.resumes.length > 1) {
                uploadSuccess.innerHTML = `
                    <span class="success-icon">✓</span>
                    <span>Resume active (${result.resumes.length} resumes available)</span>
                    <button id="reuploadBtn" class="reupload-btn">Upload New Resume</button>
                `;
            }
            
            // Create resume summary section if it doesn't exist
            if (!document.querySelector('.upload-summary') && result.resumeData) {
                const summaryContent = generateResumeSummary(result.resumeData);
                const summarySection = document.createElement('div');
                summarySection.className = 'upload-summary';
                summarySection.innerHTML = summaryContent;
                
                // Add after success message
                uploadSuccess.parentNode.insertBefore(summarySection, uploadSuccess.nextSibling);
            }
            
            // Update the event listener for the reupload button
            const reuploadBtn = document.getElementById('reuploadBtn');
            if (reuploadBtn) {
                reuploadBtn.addEventListener('click', function(e) {
                    e.preventDefault();
                    chrome.tabs.create({url: 'upload.html'});
                });
            }
        } else {
            // No resume is uploaded, show upload UI
            const uploadSection = document.getElementById('uploadSection');
            if (uploadSection) {
                uploadSection.style.display = 'block';
            }
        }
    });

    uploadInput.addEventListener('change', function(e) {
        e.preventDefault(); // Prevent form submission
        const file = e.target.files[0];
        if (!file) return;

        // Clear the upload mode flag
        chrome.storage.local.remove(['resumeUploadMode']);

        // Show processing state immediately
        updateStatus('Processing resume...');
        document.querySelector('.upload-progress').style.display = 'block';
        
        // Keep popup open by processing in a separate function
        processResume(file);
    });

    // Load saved API key
    chrome.storage.local.get(['openaiApiKey'], function(result) {
        if (result.openaiApiKey) {
            apiKeyInput.value = result.openaiApiKey;
        }
    });

    settingsButton.addEventListener('click', function() {
        settingsModal.style.display = 'flex';
    });

    closeSettings.addEventListener('click', function() {
        settingsModal.style.display = 'none';
    });

    saveSettings.addEventListener('click', function() {
        const apiKey = apiKeyInput.value.trim();
        const aiModel = document.getElementById('aiModel').value;
        const defaultFormat = document.getElementById('defaultFormat').value;
        const autoSave = document.getElementById('autoSave').checked;
        
        if (apiKey) {
            chrome.storage.local.set({ 
                'openaiApiKey': apiKey,
                'aiModel': aiModel,
                'defaultFormat': defaultFormat,
                'autoSave': autoSave
            }, function() {
                settingsModal.style.display = 'none';
                updateStatus('Settings saved successfully!');
            });
        } else {
            updateStatus('Please enter an API key', true);
        }
    });

    // Close modal when clicking outside
    settingsModal.addEventListener('click', function(e) {
        if (e.target === settingsModal) {
            settingsModal.style.display = 'none';
        }
    });

    // Make sure this is early in the DOMContentLoaded event
    // Add a check for no resume at the beginning of the script
    chrome.storage.local.get(['resume'], function(result) {
        if (!result.resume) {
            // No resume is uploaded yet, offer to go to upload page
            const uploadSection = document.getElementById('uploadSection');
            
            // Replace the content with a clearer message
            uploadSection.innerHTML = `
                <h2>No Resume Found</h2>
                <p>You need to upload your resume to use Smart Resume Matcher</p>
                <button id="goToUploadBtn" class="primary-btn">Upload Resume</button>
            `;
            
            // Add event listener for the upload button
            document.getElementById('goToUploadBtn').addEventListener('click', function() {
                chrome.tabs.create({url: 'upload.html'});
            });
        }
    });

    // Remove the non-functional buttons if they exist
    const editButton = document.getElementById('editResume');
    if (editButton) {
        editButton.style.display = 'none'; // Hide instead of remove in case references exist elsewhere
    }
    
    const downloadButton = document.getElementById('downloadPDF');
    if (downloadButton) {
        downloadButton.style.display = 'none'; // Hide instead of remove
    }

    // Only keep the "Manage Resumes" button in the action section
    if (actionSection) {
        // Clear existing buttons
        actionSection.innerHTML = '';
        
        // Create and add only the Manage Resumes button
        const manageResumesButton = document.createElement('button');
        manageResumesButton.id = 'manageResumes';
        manageResumesButton.className = 'action-btn';
        manageResumesButton.textContent = 'Manage Resumes';
        actionSection.appendChild(manageResumesButton);
        
        // Add event listener
        manageResumesButton.addEventListener('click', function() {
            console.log('Navigating to resumes.html');
            chrome.tabs.create({url: 'resumes.html'});
        });
    }

    // After line 195 where we check for no resume
    chrome.storage.local.get(['openaiApiKey', 'resume'], function(result) {
        if (!result.openaiApiKey && !result.resume) {
            // First-time user needs API key and resume
            uploadSection.innerHTML = `
                <h2>Welcome to Smart Resume Matcher!</h2>
                <p>To get started, you'll need:</p>
                <ol>
                    <li>Your OpenAI API key (for AI-powered resume parsing)</li>
                    <li>Your resume file (PDF format recommended)</li>
                </ol>
                <button id="setupBtn" class="primary-btn">Start Setup</button>
            `;
            
            document.getElementById('setupBtn').addEventListener('click', function() {
                // Show a guided setup modal with steps
                showGuidedSetup();
            });
        }
    });

    // Check storage data
    chrome.storage.local.get(null, function(data) {
        console.log('All storage data:', data);
    });
});

async function processResumeFile(file) {
    console.log('Processing file:', file.name, 'Type:', file.type);
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
        
        console.log('Resume parsed successfully:', parsedData);
        return parsedData;
        
    } catch (error) {
        console.error('File processing error:', error);
        updateStatus(error.message, true);
        throw error;
    }
}

function readTextFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (e) => resolve(e.target.result);
        reader.onerror = (e) => reject(new Error('Failed to read file'));
        reader.readAsText(file);
    });
}

function parseResumeText(text) {
    const sections = {
        personalInfo: {},
        summary: '',
        experience: [],
        skills: [],
        education: [],
        pageCount: 1
    };

    try {
        // Split text into lines and clean them
        const lines = text.split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0);

        let currentSection = '';
        let currentExperience = null;

        // Common technical keywords to help identify skills
        const techKeywords = [
            'javascript', 'python', 'java', 'react', 'node', 'aws', 'sql',
            'html', 'css', 'docker', 'kubernetes', 'git', 'agile',
            'programming', 'development', 'software', 'web', 'api',
            'database', 'frontend', 'backend', 'full-stack', 'cloud'
        ];

        // First pass - try to identify sections
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            const lowerLine = line.toLowerCase();

            // Log each line for debugging
            console.log('Processing line:', line);

            // More aggressive section detection
            if (/^(?:technical |core )?skills|expertise|technologies|competencies/i.test(line)) {
                console.log('Found skills section:', line);
                currentSection = 'skills';
                // Look ahead for bullet points or comma-separated lists
                let skillText = '';
                for (let j = i + 1; j < lines.length && j < i + 15; j++) {
                    if (/^(?:experience|education|projects|work|summary)/i.test(lines[j])) break;
                    skillText += lines[j] + ' ';
                }
                // Extract skills from the skill text
                const skillMatches = skillText.match(/[A-Za-z0-9+#/.()]+(?: [A-Za-z0-9+#/.()]+)*\b/g) || [];
                sections.skills.push(...skillMatches);
                continue;
            }

            // Look for technical keywords in the text
            if (techKeywords.some(keyword => lowerLine.includes(keyword))) {
                const words = line.split(/[,;•|●∙⋅·⚫\s]+/);
                const technicalWords = words.filter(word => 
                    word.length > 2 && 
                    !['and', 'the', 'for', 'with'].includes(word.toLowerCase())
                );
                sections.skills.push(...technicalWords);
            }

            // Detect sections
            if (lowerLine.includes('experience') || lowerLine.includes('work history') || lowerLine.includes('employment')) {
                currentSection = 'experience';
                continue;
            } else if (lowerLine.includes('skills') || lowerLine.includes('technologies') || lowerLine.includes('technical expertise')) {
                currentSection = 'skills';
                continue;
            } else if (lowerLine.includes('education') || lowerLine.includes('academic')) {
                currentSection = 'education';
                continue;
            } else if (lowerLine.includes('summary') || lowerLine.includes('objective') || lowerLine.includes('profile')) {
                currentSection = 'summary';
                continue;
            }

            // Process sections
            switch (currentSection) {
                case 'skills':
                    // Split by common skill delimiters
                    const skillDelimiters = /[,|•|●|∙|⋅|·|⚫|\n]/;
                    const potentialSkills = line.split(skillDelimiters)
                        .map(skill => skill.trim())
                        .filter(skill => skill.length > 2); // Ignore very short strings
                    sections.skills.push(...potentialSkills);
                    break;

                case 'experience':
                    // Look for date patterns to identify new positions
                    const datePattern = /\b(19|20)\d{2}\b|present|current/i;
                    if (datePattern.test(line)) {
                        if (currentExperience) {
                            sections.experience.push(currentExperience);
                        }
                        currentExperience = {
                            company: '',
                            position: '',
                            duration: line,
                            description: ''
                        };
                        
                        // Try to extract company/position from next line
                        if (i + 1 < lines.length) {
                            currentExperience.position = lines[i + 1];
                        }
                    } else if (currentExperience) {
                        currentExperience.description += line + ' ';
                    }
                    break;

                case 'summary':
                    sections.summary += line + ' ';
                    break;
            }
        }

        // Add final experience entry if exists
        if (currentExperience) {
            sections.experience.push(currentExperience);
        }

        // Clean up skills
        sections.skills = [...new Set(sections.skills)] // Remove duplicates
            .map(skill => skill.trim())
            .filter(skill => {
                // Filter out common false positives
                if (skill.length < 2) return false;
                if (/^[0-9\s]*$/.test(skill)) return false;
                if (/^(and|the|for|with|from|to)$/i.test(skill)) return false;
                return true;
            });

        console.log('Extracted skills:', sections.skills);

        // Ensure we have at least placeholder data
        if (sections.skills.length === 0) {
            console.warn('No skills detected in resume, checking full text for technical terms');
            // Last resort - scan entire text for technical terms
            const fullText = text.toLowerCase();
            const foundSkills = techKeywords.filter(keyword => fullText.includes(keyword));
            if (foundSkills.length > 0) {
                sections.skills = foundSkills;
            } else {
                sections.skills = ['Skills extraction needs review'];
            }
        }

        sections.summary = sections.summary.trim();

        console.log('Parsed resume sections:', {
            skillsCount: sections.skills.length,
            experienceCount: sections.experience.length,
            summaryLength: sections.summary.length
        });

        return sections;
    } catch (error) {
        console.error('Error parsing resume text:', error);
        return {
            personalInfo: {},
            summary: 'Failed to parse resume content',
            experience: [{
                duration: 'Error',
                description: 'Failed to parse experience'
            }],
            skills: ['Failed to parse skills'],
            education: [],
            pageCount: 1
        };
    }
}

// Update the processResume function
async function processResume(file) {
    try {
        // Show processing state
        updateStatus('Processing resume...');
        document.querySelector('.upload-progress').style.display = 'block';
        
        const resumeData = await processResumeFile(file);
        
        // Store the data
        await new Promise((resolve) => {
            chrome.storage.local.set({
                'resume': {
                    content: resumeData,
                    name: file.name,
                    lastModified: file.lastModified
                },
                'resumeData': resumeData
            }, resolve);
        });

        // Update UI elements
        document.getElementById('fileName').textContent = file.name;
        document.getElementById('actionSection').style.display = 'block';
        
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
        
        // Create detailed summary
        const summary = document.createElement('div');
        summary.className = 'upload-summary';
        
        // Format the skills and experience data
        const skillsList = resumeData.skills?.join(', ') || 'No skills detected';
        const experienceList = resumeData.experience?.map(exp => 
            `<li>${exp.duration || 'N/A'}: ${exp.description?.substring(0, 100)}...</li>`
        ).join('') || 'No experience entries found';
        
        summary.innerHTML = `
            <h3>Parsed Resume Data:</h3>
            <div class="parsed-section">
                <h4>Skills Found:</h4>
                <p>${skillsList}</p>
            </div>
            <div class="parsed-section">
                <h4>Experience:</h4>
                <ul>${experienceList}</ul>
            </div>
            <div class="parsed-section">
                <h4>Summary:</h4>
                <p>${resumeData.summary?.substring(0, 200)}...</p>
            </div>
        `;
        
        // Replace existing summary if present
        const uploadSection = document.getElementById('uploadSection');
        const existingSummary = uploadSection.querySelector('.upload-summary');
        if (existingSummary) {
            existingSummary.remove();
        }
        uploadSection.appendChild(summary);
        
        // Hide progress bar and clear status
        document.querySelector('.upload-progress').style.display = 'none';
        updateStatus('');
        
    } catch (error) {
        console.error('Upload error:', error);
        updateStatus(error.message, true);
        document.querySelector('.upload-progress').style.display = 'none';
    }
}

// Add these functions to handle the resume details modal
function showResumeDetails(resumeData) {
    const modal = document.getElementById('resumeDetailsModal');
    const content = document.getElementById('resumeDetailsContent');
    
    // Generate detailed content
    content.innerHTML = generateResumeHTML(resumeData);
    
    // Show the modal
    modal.style.display = 'flex';
    
    // Add close functionality
    const closeButton = modal.querySelector('.close-modal');
    closeButton.addEventListener('click', function() {
        modal.style.display = 'none';
    });
    
    // Close when clicking outside the content
    modal.addEventListener('click', function(e) {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });
}

function generateResumeHTML(data) {
    let html = '';
    
    // Personal information
    html += `<div class="resume-section">
        <h4>Personal Information</h4>
        <p><strong>Name:</strong> ${data.name || 'Not specified'}</p>
        <p><strong>Email:</strong> ${data.email || 'Not specified'}</p>
        <p><strong>Phone:</strong> ${data.phone || 'Not specified'}</p>
        <p><strong>Location:</strong> ${data.location || 'Not specified'}</p>
        ${data.linkedin ? `<p><strong>LinkedIn:</strong> ${data.linkedin}</p>` : ''}
        ${data.website ? `<p><strong>Website:</strong> ${data.website}</p>` : ''}
    </div>`;
    
    // Summary section
    if (data.summary) {
        html += `<div class="resume-section">
            <h4>Professional Summary</h4>
            <p>${data.summary}</p>
        </div>`;
    }
    
    // Skills section
    if (data.skills && data.skills.length > 0) {
        html += `<div class="resume-section">
            <h4>Skills (${data.skills.length})</h4>
            <div class="skills-container">`;
        
        data.skills.forEach(skill => {
            const skillType = skill.type || 'technical';
            html += `<span class="skill-tag ${skillType.toLowerCase()}">${skill.name}</span>`;
        });
        
        html += `</div></div>`;
    }
    
    // Experience section
    if (data.experience && data.experience.length > 0) {
        html += `<div class="resume-section">
            <h4>Work Experience (${data.experience.length})</h4>`;
        
        data.experience.forEach(exp => {
            html += `<div class="experience-item">
                <div class="experience-title">${exp.title || 'Position'}</div>
                <div class="experience-company">${exp.company || 'Company'}</div>
                <div class="experience-date">${exp.startDate || ''} ${exp.endDate ? '- ' + exp.endDate : (exp.present ? '- Present' : '')}</div>
                <div class="experience-description">${exp.description || ''}</div>
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // Education section
    if (data.education && data.education.length > 0) {
        html += `<div class="resume-section">
            <h4>Education (${data.education.length})</h4>`;
        
        data.education.forEach(edu => {
            html += `<div class="education-item">
                <div class="education-degree">${edu.degree || 'Degree'}</div>
                <div class="education-institution">${edu.institution || 'Institution'}</div>
                <div class="education-date">${edu.startDate || ''} ${edu.endDate ? '- ' + edu.endDate : (edu.present ? '- Present' : '')}</div>
                ${edu.description ? `<div class="education-description">${edu.description}</div>` : ''}
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // Certifications section
    if (data.certifications && data.certifications.length > 0) {
        html += `<div class="resume-section">
            <h4>Certifications (${data.certifications.length})</h4>`;
        
        data.certifications.forEach(cert => {
            html += `<div class="certification-item">
                <div><strong>${cert.name || 'Certification'}</strong></div>
                <div>${cert.issuer || ''}</div>
                <div class="certification-date">${cert.date || ''}</div>
            </div>`;
        });
        
        html += `</div>`;
    }
    
    // Projects section
    if (data.projects && data.projects.length > 0) {
        html += `<div class="resume-section">
            <h4>Projects (${data.projects.length})</h4>`;
        
        data.projects.forEach(project => {
            html += `<div class="project-item">
                <div><strong>${project.name || 'Project'}</strong></div>
                <div>${project.date || ''}</div>
                <div>${project.description || ''}</div>
            </div>`;
        });
        
        html += `</div>`;
    }
    
    return html;
}

function showGuidedSetup() {
    // Create a multi-step setup wizard
    const setupModal = document.createElement('div');
    setupModal.className = 'modal';
    setupModal.style.display = 'flex';
    
    // First step is API key setup, second is resume upload
    // Implementation details...
} 
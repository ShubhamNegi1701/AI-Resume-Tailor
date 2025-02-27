document.addEventListener('DOMContentLoaded', function() {
    const jobDescriptionElem = document.getElementById('jobDescription');
    const resumeHighlightsElem = document.getElementById('resumeHighlights');
    const changesListElem = document.getElementById('changesList');
    const saveAsNewBtn = document.getElementById('saveAsNewBtn');
    const downloadBtn = document.getElementById('downloadBtn');
    const applyWithResumeBtn = document.getElementById('applyWithResumeBtn');
    const cancelBtn = document.getElementById('cancelBtn');
    
    // Load the tailored resume and job description
    chrome.storage.local.get(['tailoredResume', 'originalJobDescription', 'resumeData'], function(result) {
        if (!result.tailoredResume || !result.originalJobDescription) {
            showError('No tailored resume found. Please go back and retry.');
            return;
        }
        
        // Display the job description
        jobDescriptionElem.textContent = result.originalJobDescription;
        
        // Populate the form with tailored resume data
        populateForm(result.tailoredResume);
        
        // Generate highlights and changes
        if (result.resumeData) {
            // Compare original and tailored resume
            const changes = compareResumes(result.resumeData, result.tailoredResume);
            displayChanges(changes);
            highlightResumeKeywords(result.tailoredResume, result.originalJobDescription);
        }
    });
    
    // Event listeners for buttons
    saveAsNewBtn.addEventListener('click', function() {
        const resumeData = collectFormData();
        saveAsTailoredResume(resumeData);
    });
    
    downloadBtn.addEventListener('click', function() {
        const resumeData = collectFormData();
        generatePDF(resumeData);
    });
    
    applyWithResumeBtn.addEventListener('click', function() {
        // Save the resume and close the popup to return to the job page
        const resumeData = collectFormData();
        saveAsTailoredResume(resumeData, true);
    });
    
    cancelBtn.addEventListener('click', function() {
        window.close();
    });
    
    // Add event listeners for form inputs
    document.getElementById('addSkill').addEventListener('click', function() {
        const skillInput = document.getElementById('skillInput');
        if (skillInput.value.trim()) {
            addSkillTag(skillInput.value.trim());
            skillInput.value = '';
        }
    });
    
    document.getElementById('addExperience').addEventListener('click', function() {
        addExperienceEntry();
    });
    
    document.getElementById('addEducation').addEventListener('click', function() {
        addEducationEntry();
    });
});

function populateForm(resumeData) {
    // Personal information
    if (resumeData.name) document.getElementById('fullName').value = resumeData.name;
    if (resumeData.email) document.getElementById('email').value = resumeData.email;
    if (resumeData.phone) document.getElementById('phone').value = resumeData.phone;
    if (resumeData.location) document.getElementById('location').value = resumeData.location;
    
    // Summary
    if (resumeData.summary) document.getElementById('summary').value = resumeData.summary;
    
    // Skills
    const skillsList = document.getElementById('skillsList');
    skillsList.innerHTML = '';
    if (resumeData.skills && resumeData.skills.length > 0) {
        resumeData.skills.forEach(skill => {
            const skillName = typeof skill === 'string' ? skill : skill.name || skill.toString();
            addSkillTag(skillName);
        });
    }
    
    // Experience
    const experienceList = document.getElementById('experienceList');
    experienceList.innerHTML = '';
    if (resumeData.experience && resumeData.experience.length > 0) {
        resumeData.experience.forEach(exp => {
            addExperienceEntry(exp);
        });
    }
    
    // Education
    const educationList = document.getElementById('educationList');
    educationList.innerHTML = '';
    if (resumeData.education && resumeData.education.length > 0) {
        resumeData.education.forEach(edu => {
            addEducationEntry(edu);
        });
    }
}

function addSkillTag(skillName) {
    const skillsList = document.getElementById('skillsList');
    const tag = document.createElement('div');
    tag.className = 'skill-tag';
    tag.innerHTML = `
        ${skillName}
        <span class="remove-skill">×</span>
    `;
    
    tag.querySelector('.remove-skill').addEventListener('click', function() {
        tag.remove();
    });
    
    skillsList.appendChild(tag);
}

function addExperienceEntry(data = {}) {
    const experienceList = document.getElementById('experienceList');
    const entry = document.createElement('div');
    entry.className = 'experience-entry';
    
    entry.innerHTML = `
        <input type="text" class="exp-company" placeholder="Company" value="${data.company || ''}">
        <input type="text" class="exp-title" placeholder="Job Title" value="${data.title || data.position || ''}">
        <div class="date-range">
            <input type="text" class="exp-start-date" placeholder="Start Date" value="${data.startDate || ''}">
            <input type="text" class="exp-end-date" placeholder="End Date" value="${data.endDate || ''}">
        </div>
        <textarea class="exp-description" placeholder="Description">${data.description || ''}</textarea>
        <button class="remove-btn">Remove</button>
    `;
    
    entry.querySelector('.remove-btn').addEventListener('click', function() {
        entry.remove();
    });
    
    experienceList.appendChild(entry);
}

function addEducationEntry(data = {}) {
    const educationList = document.getElementById('educationList');
    const entry = document.createElement('div');
    entry.className = 'education-entry';
    
    entry.innerHTML = `
        <input type="text" class="edu-institution" placeholder="Institution" value="${data.institution || ''}">
        <input type="text" class="edu-degree" placeholder="Degree" value="${data.degree || ''}">
        <div class="date-range">
            <input type="text" class="edu-start-date" placeholder="Start Date" value="${data.startDate || ''}">
            <input type="text" class="edu-end-date" placeholder="End Date" value="${data.endDate || ''}">
        </div>
        <textarea class="edu-description" placeholder="Description">${data.description || ''}</textarea>
        <button class="remove-btn">Remove</button>
    `;
    
    entry.querySelector('.remove-btn').addEventListener('click', function() {
        entry.remove();
    });
    
    educationList.appendChild(entry);
}

function collectFormData() {
    // Collect personal info
    const personalInfo = {
        name: document.getElementById('fullName').value,
        email: document.getElementById('email').value,
        phone: document.getElementById('phone').value,
        location: document.getElementById('location').value
    };
    
    // Collect skills
    const skills = [];
    document.querySelectorAll('#skillsList .skill-tag').forEach(tag => {
        // Extract just the text content without the remove button
        const skillText = tag.textContent.replace('×', '').trim();
        skills.push(skillText);
    });
    
    // Collect experience
    const experience = [];
    document.querySelectorAll('#experienceList .experience-entry').forEach(entry => {
        experience.push({
            company: entry.querySelector('.exp-company').value,
            title: entry.querySelector('.exp-title').value,
            startDate: entry.querySelector('.exp-start-date').value,
            endDate: entry.querySelector('.exp-end-date').value,
            description: entry.querySelector('.exp-description').value
        });
    });
    
    // Collect education
    const education = [];
    document.querySelectorAll('#educationList .education-entry').forEach(entry => {
        education.push({
            institution: entry.querySelector('.edu-institution').value,
            degree: entry.querySelector('.edu-degree').value,
            startDate: entry.querySelector('.edu-start-date').value,
            endDate: entry.querySelector('.edu-end-date').value,
            description: entry.querySelector('.edu-description').value
        });
    });
    
    // Return the complete resume data
    return {
        name: personalInfo.name,
        email: personalInfo.email,
        phone: personalInfo.phone,
        location: personalInfo.location,
        summary: document.getElementById('summary').value,
        skills: skills,
        experience: experience,
        education: education,
        isTailored: true,
        tailoredDate: new Date().toISOString()
    };
}

function saveAsTailoredResume(resumeData, closeAfterSave = false) {
    // Generate a unique ID for the resume
    const resumeId = 'resume_' + Date.now();
    
    // Get current job description
    chrome.storage.local.get(['originalJobDescription', 'resumes'], function(result) {
        const jobDescription = result.originalJobDescription || '';
        const resumes = result.resumes || [];
        
        // Create a new resume entry
        const newResume = {
            id: resumeId,
            name: `Tailored Resume - ${new Date().toLocaleDateString()}`,
            type: 'tailored',
            createdAt: new Date().toISOString(),
            jobDescription: jobDescription.substring(0, 200) + '...',
            previewText: resumeData.summary?.substring(0, 100) + '...'
        };
        
        // Add to resumes list
        resumes.push(newResume);
        
        // Save both the resume list and the detailed resume data
        chrome.storage.local.set({
            [`resumeData_${resumeId}`]: resumeData,
            'resumes': resumes,
            // Set as active resume
            'activeResumeId': resumeId,
            'resume': {
                name: newResume.name,
                id: resumeId,
                lastModified: Date.now()
            },
            'resumeData': resumeData
        }, function() {
            showNotification('Resume saved successfully!');
            
            if (closeAfterSave) {
                window.close();
            }
        });
    });
}

function compareResumes(original, tailored) {
    const changes = {
        summary: {
            original: original.summary || '',
            tailored: tailored.summary || '',
            changed: original.summary !== tailored.summary
        },
        skills: {
            added: [],
            reordered: false,
            removed: []
        },
        experience: []
    };
    
    // Compare skills
    if (original.skills && tailored.skills) {
        // Find added skills
        changes.skills.added = tailored.skills.filter(skill => 
            !original.skills.includes(skill));
            
        // Find removed skills
        changes.skills.removed = original.skills.filter(skill => 
            !tailored.skills.includes(skill));
            
        // Check if skills were reordered
        if (original.skills.length === tailored.skills.length && 
            changes.skills.added.length === 0 && 
            changes.skills.removed.length === 0 &&
            JSON.stringify(original.skills) !== JSON.stringify(tailored.skills)) {
            changes.skills.reordered = true;
        }
    }
    
    // Compare experience entries
    if (original.experience && tailored.experience) {
        // For each experience entry in the tailored resume
        tailored.experience.forEach((tailoredExp, index) => {
            // Try to find matching entry in original resume
            const originalExp = original.experience.find(exp => 
                exp.company === tailoredExp.company && 
                exp.position === tailoredExp.position);
                
            if (originalExp) {
                // Check if description was modified
                if (originalExp.description !== tailoredExp.description) {
                    changes.experience.push({
                        index: index,
                        company: tailoredExp.company,
                        position: tailoredExp.position,
                        original: originalExp.description,
                        tailored: tailoredExp.description,
                        type: 'modified'
                    });
                }
            } else {
                // This is a new or heavily modified entry
                changes.experience.push({
                    index: index,
                    company: tailoredExp.company,
                    position: tailoredExp.position,
                    tailored: tailoredExp.description,
                    type: 'new'
                });
            }
        });
    }
    
    return changes;
}

function displayChanges(changes) {
    const changesListElem = document.getElementById('changesList');
    
    let html = '<h3>Tailoring Changes</h3>';
    
    // Summary changes
    if (changes.summary.changed) {
        html += `
            <div class="change-item">
                <h4>Summary Updated</h4>
                <div class="change-details">
                    <div class="change-original">
                        <strong>Original:</strong> 
                        <p>${changes.summary.original}</p>
                    </div>
                    <div class="change-tailored highlight-change">
                        <strong>Tailored:</strong> 
                        <p>${changes.summary.tailored}</p>
                    </div>
                </div>
            </div>
        `;
    }
    
    // Skills changes
    if (changes.skills.added.length > 0 || changes.skills.removed.length > 0 || changes.skills.reordered) {
        html += `<div class="change-item"><h4>Skills Updated</h4>`;
        
        if (changes.skills.reordered) {
            html += `<p>✓ Skills have been reordered to prioritize the most relevant ones</p>`;
        }
        
        if (changes.skills.added.length > 0) {
            html += `
                <div class="change-details">
                    <strong>Highlighted Skills:</strong>
                    <div class="skills-container">
                        ${changes.skills.added.map(skill => 
                            `<span class="skill-tag highlight-change">${skill}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        if (changes.skills.removed.length > 0) {
            html += `
                <div class="change-details">
                    <strong>De-emphasized Skills:</strong>
                    <div class="skills-container">
                        ${changes.skills.removed.map(skill => 
                            `<span class="skill-tag muted-change">${skill}</span>`).join('')}
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
    }
    
    // Experience changes
    if (changes.experience.length > 0) {
        html += `<div class="change-item"><h4>Experience Descriptions Updated</h4>`;
        
        changes.experience.forEach(exp => {
            html += `
                <div class="experience-change">
                    <strong>${exp.position} at ${exp.company}</strong>
                    ${exp.type === 'modified' ? `
                        <div class="change-details">
                            <div class="change-original">
                                <strong>Original:</strong> 
                                <p>${exp.original}</p>
                            </div>
                            <div class="change-tailored highlight-change">
                                <strong>Tailored:</strong> 
                                <p>${exp.tailored}</p>
                            </div>
                        </div>
                    ` : `
                        <div class="change-details">
                            <div class="change-tailored highlight-change">
                                <strong>Emphasized:</strong> 
                                <p>${exp.tailored}</p>
                            </div>
                        </div>
                    `}
                </div>
            `;
        });
        
        html += `</div>`;
    }
    
    // If no changes were detected
    if (!changes.summary.changed && 
        changes.skills.added.length === 0 && 
        changes.skills.removed.length === 0 && 
        !changes.skills.reordered &&
        changes.experience.length === 0) {
        html += `
            <div class="change-item">
                <p>No significant changes were needed - your resume already matches this job well!</p>
            </div>
        `;
    }
    
    changesListElem.innerHTML = html;
}

function highlightResumeKeywords(resumeData, jobDescription) {
    const resumeHighlightsElem = document.getElementById('resumeHighlights');
    
    // Extract potential keywords from job description (simplified approach)
    const jobWords = jobDescription.toLowerCase().split(/\W+/).filter(word => 
        word.length > 3 && !['and', 'the', 'with', 'from', 'that', 'this', 'have', 'will'].includes(word)
    );
    
    // Create a map of keyword frequencies
    const keywordFrequency = {};
    jobWords.forEach(word => {
        keywordFrequency[word] = (keywordFrequency[word] || 0) + 1;
    });
    
    // Sort by frequency and get top keywords
    const topKeywords = Object.keys(keywordFrequency)
        .sort((a, b) => keywordFrequency[b] - keywordFrequency[a])
        .slice(0, 20);
    
    // Highlight these keywords in the resume summary and skills
    let highlightedSummary = resumeData.summary || '';
    
    topKeywords.forEach(keyword => {
        const regex = new RegExp(`\\b${keyword}\\b`, 'gi');
        highlightedSummary = highlightedSummary.replace(regex, match => 
            `<span class="highlight">${match}</span>`
        );
    });
    
    // Create the highlights HTML
    let html = `
        <div class="summary-highlight">
            <h4>Summary</h4>
            <p>${highlightedSummary}</p>
        </div>
        
        <div class="skills-highlight">
            <h4>Relevant Skills</h4>
            <div class="skills-container">
    `;
    
    // Add skills, highlighting those that match keywords
    if (resumeData.skills && resumeData.skills.length > 0) {
        resumeData.skills.forEach(skill => {
            const skillText = typeof skill === 'string' ? skill : (skill.name || '');
            let isHighlighted = false;
            
            // Check if this skill matches any top keywords
            topKeywords.forEach(keyword => {
                if (skillText.toLowerCase().includes(keyword)) {
                    isHighlighted = true;
                }
            });
            
            html += `<span class="skill-tag ${isHighlighted ? 'highlight' : ''}">${skillText}</span>`;
        });
    }
    
    html += `
            </div>
        </div>
    `;
    
    resumeHighlightsElem.innerHTML = html;
}

function generatePDF(resumeData) {
    // Create PDF generation logic here
    showNotification('PDF generation would happen here');
}

function showNotification(message, type = 'success') {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    
    document.body.appendChild(notification);
    
    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function showError(message) {
    const container = document.querySelector('.container');
    container.innerHTML = `
        <div class="error-message">
            <h2>Error</h2>
            <p>${message}</p>
            <button onclick="window.close()" class="secondary-btn">Close</button>
        </div>
    `;
} 
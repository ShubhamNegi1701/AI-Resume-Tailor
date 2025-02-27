document.addEventListener('DOMContentLoaded', function() {
    const saveButton = document.getElementById('saveButton');
    const downloadButton = document.getElementById('downloadButton');
    const addExperienceButton = document.getElementById('addExperience');
    const addSkillButton = document.getElementById('addSkill');
    const skillInput = document.getElementById('skillInput');
    const skillsList = document.getElementById('skillsList');
    const experienceList = document.getElementById('experienceList');

    // Load existing resume data
    chrome.storage.local.get(['resume'], function(result) {
        if (result.resume) {
            // Populate form fields with existing data
            populateFields(result.resume);
        }
    });

    saveButton.addEventListener('click', function() {
        const resumeData = collectFormData();
        chrome.storage.local.set({
            'resume': resumeData
        }, function() {
            showNotification('Resume saved successfully!');
        });
    });

    addExperienceButton.addEventListener('click', function() {
        addExperienceEntry();
    });

    addSkillButton.addEventListener('click', function() {
        if (skillInput.value.trim()) {
            addSkillTag(skillInput.value.trim());
            skillInput.value = '';
        }
    });

    downloadButton.addEventListener('click', function() {
        generatePDF();
    });
});

function addExperienceEntry(data = {}) {
    const entry = document.createElement('div');
    entry.className = 'experience-entry';
    entry.innerHTML = `
        <input type="text" placeholder="Company" value="${data.company || ''}">
        <input type="text" placeholder="Position" value="${data.position || ''}">
        <input type="text" placeholder="Duration" value="${data.duration || ''}">
        <textarea placeholder="Description">${data.description || ''}</textarea>
        <button class="remove-btn">Remove</button>
    `;

    entry.querySelector('.remove-btn').addEventListener('click', function() {
        entry.remove();
    });

    experienceList.appendChild(entry);
}

function addSkillTag(skillName) {
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

function collectFormData() {
    // TODO: Implement complete form data collection
    return {
        personalInfo: {
            name: document.getElementById('fullName').value,
            email: document.getElementById('email').value,
            phone: document.getElementById('phone').value,
            location: document.getElementById('location').value
        },
        summary: document.getElementById('summary').value,
        // Add more sections as needed
    };
}

function populateFields(data) {
    // Implement field population logic
    if (data.personalInfo) {
        document.getElementById('fullName').value = data.personalInfo.name || '';
        document.getElementById('email').value = data.personalInfo.email || '';
        document.getElementById('phone').value = data.personalInfo.phone || '';
        document.getElementById('location').value = data.personalInfo.location || '';
    }
    // Add more sections as needed
}

function showNotification(message, type = 'success') {
    // Implement notification logic
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    document.body.appendChild(notification);

    setTimeout(() => {
        notification.remove();
    }, 3000);
}

function generatePDF() {
    showNotification('Preparing your resume...', 'info');
    
    // Collect all form data
    const resumeData = collectFormData();
    
    // Create professional PDF layout
    const doc = new jsPDF();
    
    // Add proper styling and structure
    doc.setFont('Helvetica', 'bold');
    doc.setFontSize(18);
    doc.text(resumeData.personalInfo.name, 20, 20);
    
    // Add contact details in a nicely formatted row
    doc.setFontSize(10);
    let contactText = '';
    if (resumeData.personalInfo.email) contactText += resumeData.personalInfo.email;
    if (resumeData.personalInfo.phone) contactText += ' | ' + resumeData.personalInfo.phone;
    if (resumeData.personalInfo.location) contactText += ' | ' + resumeData.personalInfo.location;
    doc.text(contactText, 20, 28);
    
    // Continue adding sections with proper formatting
    
    // Save with the person's name
    const filename = `${resumeData.personalInfo.name.replace(/\s+/g, '_')}_Resume.pdf`;
    doc.save(filename);
    
    showNotification('Resume downloaded as PDF!', 'success');
} 
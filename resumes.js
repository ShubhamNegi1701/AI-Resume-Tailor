document.addEventListener('DOMContentLoaded', function() {
    const resumesList = document.getElementById('resumesList');
    const emptyState = document.getElementById('emptyState');
    const uploadNewBtn = document.getElementById('uploadNewBtn');
    const backBtn = document.getElementById('backBtn');
    
    // Load all resumes from storage
    chrome.storage.local.get(['resumes', 'activeResumeId'], function(result) {
        const resumes = result.resumes || [];
        const activeResumeId = result.activeResumeId;
        
        console.log('Loaded resumes:', resumes);
        console.log('Active resume ID:', activeResumeId);
        
        // Handle empty state
        if (!resumes.length) {
            emptyState.style.display = 'block';
        } else {
            emptyState.style.display = 'none';
            
            // Clear any existing resume cards
            while (resumesList.firstChild && resumesList.firstChild !== emptyState) {
                resumesList.removeChild(resumesList.firstChild);
            }
            
            // Add each resume card
            resumes.forEach(function(resume) {
                const isActive = resume.id === activeResumeId;
                const dateFormatted = new Date(resume.uploadDate).toLocaleDateString();
                
                // Load the detailed resume data for this resume
                chrome.storage.local.get([`resumeData_${resume.id}`], function(data) {
                    const resumeData = data[`resumeData_${resume.id}`] || {};
                    
                    const resumeCard = document.createElement('div');
                    resumeCard.className = 'resume-card' + (isActive ? ' active' : '');
                    resumeCard.innerHTML = `
                        <div class="resume-info">
                            <div class="resume-name">
                                ${resume.name}
                                ${isActive ? '<span class="active-badge">Active</span>' : ''}
                            </div>
                            <div class="resume-date">Uploaded on ${dateFormatted}</div>
                            <div class="resume-stats">
                                <div class="stat">
                                    <span class="stat-icon">📄</span> ${resumeData.pageCount || 1} page${resumeData.pageCount > 1 ? 's' : ''}
                                </div>
                                <div class="stat">
                                    <span class="stat-icon">🔧</span> ${resumeData.skills?.length || 0} skills
                                </div>
                                <div class="stat">
                                    <span class="stat-icon">💼</span> ${resumeData.experience?.length || 0} experiences
                                </div>
                            </div>
                        </div>
                        <div class="resume-actions">
                            ${!isActive ? `<button class="action-btn set-active-btn" data-id="${resume.id}">Set Active</button>` : ''}
                            <button class="action-btn delete-btn" data-id="${resume.id}">Delete</button>
                        </div>
                    `;
                    
                    // Add event listeners for buttons
                    resumesList.appendChild(resumeCard);
                    
                    // Event listener for Set Active button
                    const setActiveBtn = resumeCard.querySelector('.set-active-btn');
                    if (setActiveBtn) {
                        setActiveBtn.addEventListener('click', function() {
                            setActiveResume(resume.id);
                        });
                    }
                    
                    // Event listener for Delete button
                    const deleteBtn = resumeCard.querySelector('.delete-btn');
                    if (deleteBtn) {
                        deleteBtn.addEventListener('click', function() {
                            deleteResume(resume.id);
                        });
                    }
                });
            });
        }
    });
    
    // Upload new resume button
    uploadNewBtn.addEventListener('click', function() {
        chrome.tabs.create({url: 'upload.html?from=resumes'});
    });
    
    // Back button to popup
    backBtn.addEventListener('click', function() {
        window.close();
    });
    
    // Set active resume function
    function setActiveResume(resumeId) {
        chrome.storage.local.get(['resumes'], function(result) {
            const resumes = result.resumes || [];
            const selectedResume = resumes.find(r => r.id === resumeId);
            
            if (selectedResume) {
                // Get the full resume data
                chrome.storage.local.get([`resumeData_${resumeId}`], function(data) {
                    const resumeData = data[`resumeData_${resumeId}`];
                    
                    // Set this as active and update main resume
                    chrome.storage.local.set({
                        'activeResumeId': resumeId,
                        'resume': {
                            content: resumeData,
                            name: selectedResume.name,
                            lastModified: Date.now()
                        },
                        'resumeData': resumeData
                    }, function() {
                        // Reload the page to show updated active status
                        window.location.reload();
                    });
                });
            }
        });
    }
    
    // Delete resume function
    function deleteResume(resumeId) {
        if (confirm('Are you sure you want to delete this resume?')) {
            chrome.storage.local.get(['resumes', 'activeResumeId'], function(result) {
                let resumes = result.resumes || [];
                const activeResumeId = result.activeResumeId;
                
                // Remove from resumes array
                resumes = resumes.filter(r => r.id !== resumeId);
                
                // Update storage with filtered resumes
                const updates = { 'resumes': resumes };
                
                // If we're deleting the active resume, we need to update that too
                if (resumeId === activeResumeId && resumes.length > 0) {
                    // Make the first resume active
                    updates.activeResumeId = resumes[0].id;
                    
                    // Also update the main resume reference
                    chrome.storage.local.get([`resumeData_${resumes[0].id}`], function(data) {
                        const newActiveData = data[`resumeData_${resumes[0].id}`];
                        updates.resume = {
                            content: newActiveData,
                            name: resumes[0].name,
                            lastModified: Date.now()
                        };
                        updates.resumeData = newActiveData;
                        
                        // Save all updates and remove the old resume data
                        chrome.storage.local.set(updates, function() {
                            chrome.storage.local.remove([`resumeData_${resumeId}`], function() {
                                window.location.reload();
                            });
                        });
                    });
                } else if (resumeId === activeResumeId) {
                    // We're deleting the last resume
                    updates.activeResumeId = null;
                    updates.resume = null;
                    updates.resumeData = null;
                    
                    chrome.storage.local.set(updates, function() {
                        chrome.storage.local.remove([`resumeData_${resumeId}`], function() {
                            window.location.reload();
                        });
                    });
                } else {
                    // Not deleting the active resume, just update and remove
                    chrome.storage.local.set(updates, function() {
                        chrome.storage.local.remove([`resumeData_${resumeId}`], function() {
                            window.location.reload();
                        });
                    });
                }
            });
        }
    }
}); 
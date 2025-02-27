// Add message listener to respond to popup requests
chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "ping") {
        sendResponse("pong");
        return true;
    }
    
    if (request.action === "getJobDescription") {
        extractJobDescription()
            .then(description => sendResponse(description))
            .catch(error => sendResponse(null));
        return true;  // Required for async response
    }
    
    if (request.action === "getJobTitle") {
        extractJobTitle()
            .then(title => sendResponse(title))
            .catch(error => sendResponse(null));
        return true;  // Required for async response
    }
});

// Simplify content.js to focus only on the working parts
// Remove unused/incomplete functions like createMatchingInterface and calculateMatchScore
// which aren't implemented yet

function extractJobDescription() {
    return new Promise((resolve, reject) => {
        try {
            let jobDescription = '';
            
            // LinkedIn job description extraction - try multiple selectors
            if (window.location.hostname.includes('linkedin.com')) {
                // Try different possible selectors for LinkedIn
                const selectors = [
                    '.job-description',
                    '.description__text',
                    '.show-more-less-html__markup',
                    '[data-job-description]',
                    '#job-details'
                ];
                
                for (const selector of selectors) {
                    const descElement = document.querySelector(selector);
                    if (descElement && descElement.innerText.trim()) {
                        jobDescription = descElement.innerText;
                        break;
                    }
                }
                
                // If still not found, try to get the entire job posting content
                if (!jobDescription) {
                    const jobPostingElement = document.querySelector('.jobs-description');
                    if (jobPostingElement) {
                        jobDescription = jobPostingElement.innerText;
                    }
                }
            }
            // Indeed job description extraction
            else if (window.location.hostname.includes('indeed.com')) {
                const descElement = document.querySelector('#jobDescriptionText');
                if (descElement) {
                    jobDescription = descElement.innerText;
                }
            }

            if (jobDescription) {
                console.log("Job description extracted successfully:", jobDescription.substring(0, 100) + "...");
                resolve(jobDescription);
            } else {
                console.error("Could not find job description");
                reject('Could not find job description');
            }
        } catch (error) {
            console.error("Error extracting job description:", error);
            reject(error);
        }
    });
}

// Update the LinkedIn job title selectors to be more comprehensive
function extractJobTitle() {
    return new Promise(async (resolve, reject) => {
        try {
            let jobTitle = '';
            
            // First try with standard selectors
            if (window.location.hostname.includes('linkedin.com')) {
                // Try different possible selectors for LinkedIn job titles
                const selectors = [
                    '.job-details-jobs-unified-top-card__job-title',
                    '.topcard__title',
                    'h1.t-24',
                    'h1.job-title',
                    '.jobs-unified-top-card__job-title',
                    '.jobs-details-top-card__job-title',
                    '.jobs-details-top-card__title',
                    '.jobs-search-results__list-item--active .job-card-container__title',
                    '.jobs-search-results-list__list-item--active .job-card-list__title',
                    // More generic selectors as fallbacks
                    'h1',
                    '.jobs-details h1',
                    '.job-view-layout h1'
                ];
                
                for (const selector of selectors) {
                    const titleElement = document.querySelector(selector);
                    if (titleElement && titleElement.innerText.trim()) {
                        jobTitle = titleElement.innerText.trim();
                        console.log(`Found job title with selector: ${selector}`);
                        break;
                    }
                }
                
                // If still not found, try to get it from the page title
                if (!jobTitle) {
                    const pageTitle = document.title;
                    if (pageTitle && pageTitle.includes('|')) {
                        // LinkedIn page titles often have format "Job Title | Company"
                        jobTitle = pageTitle.split('|')[0].trim();
                        console.log("Extracted job title from page title:", jobTitle);
                    }
                }
            }
            // Indeed job title extraction
            else if (window.location.hostname.includes('indeed.com')) {
                const selectors = [
                    'h1.jobsearch-JobInfoHeader-title',
                    '.jobsearch-JobInfoHeader-title',
                    'h1.icl-u-xs-mb--xs',
                    // Generic fallback
                    'h1'
                ];
                
                for (const selector of selectors) {
                    const titleElement = document.querySelector(selector);
                    if (titleElement && titleElement.innerText.trim()) {
                        jobTitle = titleElement.innerText.trim();
                        console.log(`Found job title with selector: ${selector}`);
                        break;
                    }
                }
                
                // Try page title as fallback
                if (!jobTitle) {
                    const pageTitle = document.title;
                    if (pageTitle && pageTitle.includes('-')) {
                        // Indeed page titles often have format "Job Title - Company"
                        jobTitle = pageTitle.split('-')[0].trim();
                        console.log("Extracted job title from page title:", jobTitle);
                    }
                }
            }

            // If we still don't have a good job title, try AI extraction
            if (!jobTitle || jobTitle === "Job Position") {
                console.log("Standard extraction failed, trying AI extraction...");
                
                // Get the job description
                const jobDescription = await extractJobDescription().catch(() => '');
                
                if (jobDescription) {
                    // Try to extract the job title using AI
                    try {
                        // Check if we have API key
                        const apiKeyResult = await chrome.storage.local.get(['openaiApiKey']);
                        if (apiKeyResult.openaiApiKey) {
                            jobTitle = await extractTitleWithAI(jobDescription, apiKeyResult.openaiApiKey);
                            console.log("AI extracted job title:", jobTitle);
                        }
                    } catch (aiError) {
                        console.error("AI extraction error:", aiError);
                    }
                }
            }

            if (jobTitle) {
                console.log("Final job title extracted:", jobTitle);
                resolve(jobTitle);
            } else {
                console.warn("Could not find job title with any method");
                resolve("Job Position"); // Default fallback
            }
        } catch (error) {
            console.error("Error extracting job title:", error);
            resolve("Job Position"); // Default fallback on error
        }
    });
}

// Function to extract job title using AI
async function extractTitleWithAI(jobDescription, apiKey) {
    try {
        // Use only the first 500 characters to save tokens
        const truncatedDescription = jobDescription.substring(0, 500);
        
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: "gpt-3.5-turbo",
                messages: [{
                    role: "system",
                    content: "You are a job title extraction assistant. Extract only the job title from the job description. Return only the job title, nothing else."
                }, {
                    role: "user",
                    content: `Extract the job title from this job description: ${truncatedDescription}`
                }],
                temperature: 0.3,
                max_tokens: 30
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to extract title with AI');
        }
        
        // Get the extracted title
        let extractedTitle = data.choices[0].message.content.trim();
        
        // Remove quotes if present
        if ((extractedTitle.startsWith('"') && extractedTitle.endsWith('"')) || 
            (extractedTitle.startsWith("'") && extractedTitle.endsWith("'"))) {
            extractedTitle = extractedTitle.substring(1, extractedTitle.length - 1);
        }
        
        return extractedTitle;
    } catch (error) {
        console.error('AI title extraction error:', error);
        return null;
    }
} 
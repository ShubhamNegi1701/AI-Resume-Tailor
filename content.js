// Simplify content.js to focus only on the working parts
// Remove unused/incomplete functions like createMatchingInterface and calculateMatchScore
// which aren't implemented yet

function extractJobDescription() {
    return new Promise((resolve, reject) => {
        try {
            let jobDescription = '';
            
            // LinkedIn job description extraction
            if (window.location.hostname.includes('linkedin.com')) {
                const descElement = document.querySelector('.job-description');
                if (descElement) {
                    jobDescription = descElement.innerText;
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
                resolve(jobDescription);
            } else {
                reject('Could not find job description');
            }
        } catch (error) {
            reject(error);
        }
    });
} 
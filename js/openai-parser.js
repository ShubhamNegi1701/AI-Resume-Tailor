async function getApiKey() {
    return new Promise((resolve) => {
        chrome.storage.local.get(['openaiApiKey'], function(result) {
            resolve(result.openaiApiKey);
        });
    });
}

async function parseResumeWithAI(text) {
    try {
        const apiKey = await getApiKey();
        if (!apiKey) {
            throw new Error('Please set your OpenAI API key in settings');
        }

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
                    content: "You are a resume parsing expert. Extract skills, experience, education, and summary from the given resume text. Return the data in JSON format."
                }, {
                    role: "user",
                    content: `Parse this resume and return a JSON with skills (as array), experience (as array of objects with company, position, duration, description), education (as array), and summary (as string): ${text}`
                }],
                temperature: 0.3
            })
        });

        const data = await response.json();
        if (!response.ok) {
            throw new Error(data.error?.message || 'Failed to parse resume with AI');
        }

        // Parse the AI response
        const parsedData = JSON.parse(data.choices[0].message.content);
        console.log('AI parsed resume:', parsedData);
        
        return {
            ...parsedData,
            pageCount: 1
        };
    } catch (error) {
        console.error('AI parsing error:', error);
        throw new Error('Failed to parse resume with AI: ' + error.message);
    }
}

export { parseResumeWithAI }; 
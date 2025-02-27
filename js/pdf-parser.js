// Initialize PDF.js
const pdfjsLib = window['pdfjs-dist/build/pdf'];

// Configure worker
if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    pdfjsLib.GlobalWorkerOptions.workerSrc = chrome.runtime.getURL('js/pdf.worker.js');
}

async function parsePDF(file) {
    // Declare pdf variable in outer scope
    let pdf = null;
    
    try {
        // Validate file
        if (!file || !(file instanceof File)) {
            throw new Error('Invalid file provided');
        }

        console.log('Starting PDF parsing...', file.name);
        
        // Convert file to ArrayBuffer
        let arrayBuffer;
        try {
            arrayBuffer = await file.arrayBuffer();
            console.log('File converted to ArrayBuffer, size:', arrayBuffer.byteLength);
        } catch (error) {
            throw new Error(`Failed to read file: ${error.message}`);
        }
        
        // Load the PDF document
        try {
            const loadingTask = pdfjsLib.getDocument({ data: arrayBuffer });
            pdf = await loadingTask.promise;
            console.log(`PDF loaded successfully. Pages: ${pdf.numPages}`);
        } catch (error) {
            throw new Error(`Failed to load PDF: ${error.message}`);
        }
        
        // Extract text from all pages
        let fullText = '';
        try {
            for (let i = 1; i <= pdf.numPages; i++) {
                console.log(`Processing page ${i}/${pdf.numPages}`);
                const page = await pdf.getPage(i);
                const textContent = await page.getTextContent();
                const pageText = textContent.items
                    .map(item => item.str)
                    .join(' ')
                    .trim();
                
                if (pageText) {
                    fullText += pageText + '\n';
                }
                console.log(`Page ${i} processed, text length: ${pageText.length}`);
            }
        } catch (error) {
            throw new Error(`Failed to extract text from PDF: ${error.message}`);
        }
        
        // Validate extracted text
        if (!fullText || fullText.trim().length === 0) {
            throw new Error('No text content found in PDF');
        }
        
        console.log('PDF parsing completed. Total text length:', fullText.length);
        return fullText.trim();
        
    } catch (error) {
        console.error('PDF parsing error:', error);
        // Rethrow with more specific error message
        throw new Error(`Failed to parse PDF file: ${error.message}`);
    } finally {
        // Cleanup
        try {
            if (pdf) {
                pdf.destroy();
            }
        } catch (error) {
            console.warn('Failed to cleanup PDF:', error);
        }
    }
}

export { parsePDF }; 
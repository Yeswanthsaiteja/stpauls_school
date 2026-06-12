const express = require('express');
const axios = require('axios');
const app = express();

// Parse raw text bodies since ADMS sends raw string data
app.use(express.text({ type: '*/*' }));

app.all('*', async (req, res) => {
    console.log(`[${new Date().toISOString()}] Incoming ADMS Request: ${req.method} ${req.url}`);
    
    // We forward everything directly to the Firebase Cloud Function
    const FIREBASE_URL = `https://us-central1-stpauls-erp.cloudfunctions.net/iclock${req.url}`;
    
    try {
        const response = await axios({
            method: req.method,
            url: FIREBASE_URL,
            data: req.body,
            headers: {
                // Forward the content type or default to plain text
                'Content-Type': req.headers['content-type'] || 'text/plain',
            }
        });

        // The machine expects pure text/plain responses
        res.setHeader('Content-Type', 'text/plain');
        res.setHeader('Server', 'Microsoft-IIS/7.5'); // Spoof IIS Server header just in case
        
        // Send back the exact response from Firebase
        res.status(response.status).send(response.data);
        console.log(`[Success] Forwarded to Firebase. Response: ${response.data}`);

    } catch (error) {
        console.error("[Error] Failed to forward to Firebase:", error.message);
        // ADMS expects a simple plain text OK even on errors sometimes, or just drop
        res.status(500).send("Proxy Error");
    }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Biometric Proxy Server is running on port ${PORT}`);
});

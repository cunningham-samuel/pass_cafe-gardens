const express = require('express');
const axios = require('axios');
const crypto = require('crypto');
const cors = require('cors');

const app = express();
const port = process.env.PORT || 3000;

app.use(cors());

// ENV variables
const NEXUDUS_API_USERNAME = process.env.NEXUDUS_API_USERNAME;
const NEXUDUS_API_PASSWORD = process.env.NEXUDUS_API_PASSWORD;
const SHARED_SECRET = process.env.SHARED_SECRET;

app.get('/api/get-bookings', async (req, res) => {
    const { userid, hash } = req.query;

    if (!userid || !hash) {
        return res.json({ error: 'Missing parameters.' });
    }

    // Validate hash
    const fullUrlWithoutHash = req.protocol + '://' + req.get('host') + req.originalUrl.split('&hash=')[0];

    const hmac = crypto.createHmac('sha256', SHARED_SECRET);
    hmac.update(fullUrlWithoutHash);
    const computedHash = hmac.digest('hex');

    if (computedHash !== hash) {
        return res.json({ error: 'Invalid signature.' });
    }

    try {
        const bookingsRes = await axios.get(`https://spaces.nexudus.com/api/spaces/bookings?customerid=${userid}&fromdate=${new Date().toISOString()}&status=Confirmed`, {
            auth: {
                username: NEXUDUS_API_USERNAME,
                password: NEXUDUS_API_PASSWORD
            }
        });

        res.json({ bookings: bookingsRes.data.Records });
    } catch (err) {
        console.error(err.response?.data || err);
        res.json({ error: 'Failed to retrieve bookings.' });
    }
});

app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});

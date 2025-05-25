require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const { nanoid } = require('nanoid');
const validUrl = require('valid-url');
const Url = require('./models/Url');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

mongoose.connect(process.env.MONGO_URI)
    .then(() => console.log('MongoDB connected...'))
    .catch(err => console.error(err));

const baseUrl = process.env.BASE_URL || `http://localhost:${PORT}`;

// @route   POST /api/shorten
app.post('/api/shorten', async (req, res) => {
    const { longUrl, customCode } = req.body;

    if (!longUrl) {
        return res.status(400).json({ error: "longUrl is required" });
    }

    if (!validUrl.isUri(longUrl)) {
        return res.status(400).json({ error: 'Invalid long URL' });
    }

    try {
        if (customCode) {
            if (!/^[a-zA-Z0-9_-]{3,15}$/.test(customCode)) {
                return res.status(400).json({ error: "Invalid customCode format. Must be 3-15 alphanumeric characters, underscores, or hyphens." });
            }

            const existingCustomUrl = await Url.findOne({ shortCode: customCode });
            if (existingCustomUrl) {
                return res.status(409).json({ error: `Custom code '${customCode}' is already in use. Please choose another.` });
            }

            const newUrl = new Url({
                longUrl,
                shortCode: customCode,
                createdAt: new Date()
            });

            await newUrl.save();
            return res.status(201).json({ shortUrl: `${baseUrl}/${newUrl.shortCode}` }); // 201 Created
        }
        let url = await Url.findOne({ longUrl: longUrl, shortCode: { $not: /^.{8}$/ } }); // Пример: ищем существующий сгенерированный код, а не кастомный

        if (url) {
            return res.json({ shortUrl: `${baseUrl}/${url.shortCode}` });
        } else {
             const shortCode = nanoid(8); // Генерируем 8-символьный код
            while (await Url.findOne({ shortCode })) {
                shortCode = nanoid(8);
            }

            url = new Url({
                longUrl,
                shortCode,
                createdAt: new Date()
            });

            await url.save();
            return res.status(201).json({ shortUrl: `${baseUrl}/${url.shortCode}` }); // 201 Created
        }

    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

// @route   GET /:shortCode
app.get('/:shortCode', async (req, res) => {
    try {
        const url = await Url.findOne({ shortCode: req.params.shortCode });

        if (url) {
            url.clicks++;
            await url.save();
            return res.redirect(url.longUrl);
        } else {
            return res.status(404).json({ error: 'Short URL not found' });
        }
    } catch (err) {
        console.error(err);
        return res.status(500).json({ error: 'Server error' });
    }
});

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const ApifyScraper = require('./scraper');

const app = express();
const port = 8000;

app.use(cors());
app.use(express.json());

// Health check for Render
app.get('/', (req, res) => res.status(200).send('Instagram Scraper Backend is Running'));
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));

// In-memory job storage
const jobs = new Map();
const scraper = new ApifyScraper(process.env.APIFY_API_TOKEN);

// Multer setup for CSV upload
const upload = multer({ storage: multer.memoryStorage() });

// Global Error Handlers to catch silent crashes
process.on('uncaughtException', (err) => {
    console.error('CRITICAL: Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('CRITICAL: Unhandled Rejection at:', promise, 'reason:', reason);
});

app.get('/test-apify', async (req, res) => {
    try {
        if (!scraper.client) {
            return res.json({ status: 'failed', message: 'Apify API Token not configured' });
        }
        await scraper.client.actors().list();
        res.json({ status: 'success', message: 'Apify Connection is active!' });
    } catch (e) {
        res.status(500).json({ status: 'failed', message: `Global Token Error: ${e.message}` });
    }
});

app.post('/upload', upload.single('file'), async (req, res) => {
    console.log('Upload request received');
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        const content = req.file.buffer.toString();
        const records = parse(content, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        if (records.length === 0) {
            return res.status(400).json({ error: 'CSV is empty' });
        }

        const headers = Object.keys(records[0]);
        let linkColumn = headers.find(h =>
            h.toLowerCase().includes('reel') ||
            h.toLowerCase() === 'link' ||
            h.toLowerCase() === 'links' ||
            h.toLowerCase().includes('url')
        );

        if (!linkColumn) {
            linkColumn = headers[0];
            console.log(`No obvious link column found, falling back to: ${linkColumn}`);
        }

        const links = records.map(r => r[linkColumn] || "").filter(l => l);
        const jobId = uuidv4();

        jobs.set(jobId, {
            status: 'processing',
            progress: 0,
            total: links.length,
            results: [],
            originalRows: records,
            linkColumn: linkColumn,
            createdAt: new Date()
        });

        console.log(`Starting job ${jobId} with ${links.length} links`);
        processJob(jobId, links);

        res.json({ job_id: jobId, total: links.length });
    } catch (e) {
        console.error('Upload failed:', e);
        res.status(500).json({ error: `Failed to parse CSV: ${e.message}` });
    }
});

async function processJob(jobId, links) {
    const job = jobs.get(jobId);
    try {
        const scrapedResults = await scraper.scrapeReels(links, (itemCount) => {
            job.progress = itemCount;
        });

        const orderedResults = links.map(inputLink => {
            const found = scrapedResults.find(r => r.link === inputLink);
            return found || { link: inputLink, status: 'failed', error: 'Not processed' };
        });

        job.results = orderedResults;
        job.progress = orderedResults.length;
        job.status = 'completed';
        console.log(`Job ${jobId} completed successfully`);
    } catch (e) {
        console.error(`Job ${jobId} failed:`, e);
        job.status = 'failed';
        job.error = e.message;
    }
}

app.get('/status/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job) return res.status(404).json({ error: 'Job not found' });
    res.json(job);
});

app.get('/fields', (req, res) => {
    res.json([
        { id: "shortcode", label: "Shortcode" },
        { id: "username", label: "Username" },
        { id: "full_name", label: "Full Name" },
        { id: "caption", label: "Caption" },
        { id: "likes", label: "Likes" },
        { id: "comments", label: "Comments" },
        { id: "videoplaycount", label: "Video Play Count" },
        { id: "year", label: "Year" },
        { id: "month", label: "Month" },
        { id: "date", label: "Date" }
    ]);
});

app.get('/download/:jobId', (req, res) => {
    const job = jobs.get(req.params.jobId);
    if (!job || job.status !== 'completed') {
        return res.status(404).json({ error: 'Results not ready' });
    }

    const fieldsParam = req.query.fields;
    const selectedFields = fieldsParam ? fieldsParam.split(',') : [];

    const data = job.originalRows.map(row => {
        const link = row[job.linkColumn];
        const result = job.results.find(r => r.link === link);

        const mergedRow = { ...row };
        selectedFields.forEach(f => {
            mergedRow[f] = result && result[f] ? result[f] : "";
        });
        return mergedRow;
    });

    const csv = stringify(data, { header: true });

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=results_${req.params.jobId}.csv`);
    res.send(csv);
});

const server = app.listen(port, () => {
    console.log(`=========================================`);
    console.log(`🚀 Instagram Scraper Backend is ACTIVE`);
    console.log(`📍 URL: http://localhost:${port}`);
    console.log(`📅 Started at: ${new Date().toLocaleString()}`);
    console.log(`=========================================`);
});

server.on('error', (err) => {
    console.error('SERVER ERROR:', err);
});

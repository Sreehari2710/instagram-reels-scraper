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

// Log buffer for debugging production
const debugLogs = [];
const log = (msg) => {
    const entry = `[${new Date().toLocaleTimeString()}] ${msg}`;
    console.log(entry);
    debugLogs.push(entry);
    if (debugLogs.length > 200) debugLogs.shift();
};

log("=== Backend Script Initialized ===");

// Health check for Render
app.get('/', (req, res) => {
    log("GET / requested");
    res.status(200).send('Instagram Scraper Backend is Running');
});
app.get('/health', (req, res) => res.status(200).send('OK'));
app.get('/ping', (req, res) => res.status(200).send('pong'));
app.get('/debug-logs', (req, res) => res.json({ logs: debugLogs, count: debugLogs.length }));

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
        log("Testing Apify configuration...");
        if (!scraper.client) {
            log("Apify Token missing");
            return res.json({ status: 'failed', message: 'Apify API Token not configured' });
        }
        await scraper.client.actors().list();
        log("Apify Connection Verified!");
        res.json({ status: 'success', message: 'Apify Connection is active!' });
    } catch (e) {
        log(`Apify Connection Error: ${e.message}`);
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

        // 1. First, find all columns that might contain links
        const candidates = headers.filter(h => {
            const lower = h.toLowerCase();
            return lower.includes('reel') || lower === 'link' || lower === 'links' || lower.includes('url');
        });

        // 2. Rank candidates by checking their actual content
        let linkColumn = null;
        for (const col of candidates) {
            // Check first 5 rows to see if any contain an instagram reel link
            const isInstaCol = records.slice(0, 5).some(row => {
                const val = (row[col] || "").toLowerCase();
                return val.includes('instagram.com/reels/') || val.includes('instagram.com/p/') || val.includes('instagram.com/tv/');
            });
            if (isInstaCol) {
                linkColumn = col;
                break;
            }
        }

        // 3. Fallback to keyword "reel" if no content match
        if (!linkColumn) {
            linkColumn = headers.find(h => h.toLowerCase().includes('reel'));
        }

        // 4. Final fallbacks
        if (!linkColumn) {
            linkColumn = candidates[0] || headers[0];
        }

        console.log(`Detected link column: "${linkColumn}"`);

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

        log(`Starting job ${jobId} with ${links.length} links`);
        processJob(jobId, links);

        res.json({ job_id: jobId, total: links.length });
    } catch (e) {
        log(`Upload failed: ${e.message}`);
        res.status(500).json({ error: `Failed to parse CSV: ${e.message}` });
    }
});

async function processJob(jobId, links) {
    const job = jobs.get(jobId);
    try {
        log(`Processing job ${jobId}...`);
        const scrapedResults = await scraper.scrapeReels(links, (itemCount, currentResults) => {
            job.progress = Math.min(itemCount, links.length);
            job.results = currentResults;
        }, log); // Pass our log function to the scraper

        job.results = scrapedResults;
        job.progress = links.length;
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

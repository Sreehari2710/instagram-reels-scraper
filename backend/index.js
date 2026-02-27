require('dotenv').config();
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const { v4: uuidv4 } = require('uuid');
const { parse } = require('csv-parse/sync');
const { stringify } = require('csv-stringify/sync');
const XLSX = require('xlsx');
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
    log('Upload request received');
    if (!req.file) {
        return res.status(400).json({ error: 'No file uploaded' });
    }

    try {
        let records = [];
        const filename = req.file.originalname.toLowerCase();

        if (filename.endsWith('.csv')) {
            const content = req.file.buffer.toString();
            records = parse(content, {
                columns: true,
                skip_empty_lines: true,
                trim: true
            });
        } else if (filename.endsWith('.xlsx') || filename.endsWith('.xls')) {
            const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
            const firstSheetName = workbook.SheetNames[0];
            const worksheet = workbook.Sheets[firstSheetName];
            records = XLSX.utils.sheet_to_json(worksheet, { defval: "" });
        } else {
            return res.status(400).json({ error: 'Unsupported file format. Please upload a CSV or Excel file.' });
        }

        if (records.length === 0) {
            return res.status(400).json({ error: 'File is empty' });
        }

        const headers = Object.keys(records[0]).map(h => h.trim());

        let bestCol = null;
        let maxScore = 0;

        for (const col of headers) {
            let score = 0;
            const samples = records.slice(0, 100);

            samples.forEach(row => {
                const val = String(row[col] || "").toLowerCase().trim();
                if (val.includes('instagram.com/')) {
                    if (val.includes('/reel/') || val.includes('/reels/')) {
                        score += 10;
                    } else {
                        score += 1;
                    }
                }
            });

            if (col.toLowerCase().includes('reel')) score += 5;

            if (score > maxScore) {
                maxScore = score;
                bestCol = col;
            }

            if (score > 0) {
                log(`Scored column "${col}": ${score}`);
            }
        }

        const linkColumn = bestCol;

        if (!linkColumn) {
            log(`CRITICAL: No column with Instagram links detected in the entire file.`);
            return res.status(400).json({ error: "Could not find a column containing Instagram links. Please ensure your file has a column with links like 'https://www.instagram.com/reel/...' or starts with a header like 'Reel Link'." });
        }

        log(`Final selection: Column "${linkColumn}" will be used for scraping.`);

        const links = records
            .map(r => String(r[linkColumn] || "").trim())
            .filter(l => l && l.includes('instagram.com/') && (l.includes('/reel/') || l.includes('/reels/')))
            .map(l => l.split('?')[0].replace(/\/$/, ""));

        if (links.length === 0) {
            log(`ERROR: No valid Instagram Reel URLs found in column "${linkColumn}"`);
            return res.status(400).json({ error: `No valid Instagram Reel URLs found in column "${linkColumn}". Please ensure the column contains links like https://www.instagram.com/reels/...` });
        }

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
        }, log, (runId) => {
            job.runId = runId;
        }); // Pass our log function and runId callback

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

app.post('/stop/:jobId', async (req, res) => {
    const { jobId } = req.params;
    log(`Stop request received for job ${jobId}`);
    try {
        const job = jobs.get(jobId);
        if (!job) return res.status(404).json({ error: 'Job not found' });

        if (job.runId) {
            await scraper.abortRun(job.runId);
        }

        job.status = 'aborted';
        res.json({ success: true, message: "Job stopped" });
    } catch (e) {
        log(`Failed to stop job ${jobId}: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
});

app.post('/scrape-links', async (req, res) => {
    log('Direct links scrape request received');
    const { links: rawLinks } = req.body;

    if (!rawLinks || !Array.isArray(rawLinks) || rawLinks.length === 0) {
        return res.status(400).json({ error: 'No links provided' });
    }

    try {
        const links = rawLinks
            .map(l => String(l || "").trim())
            .filter(l => l && l.includes('instagram.com/') && (l.includes('/reel/') || l.includes('/reels/')))
            .map(l => l.split('?')[0].replace(/\/$/, ""));

        if (links.length === 0) {
            return res.status(400).json({ error: 'No valid Instagram Reel URLs found in the provided list.' });
        }

        const jobId = uuidv4();
        const records = links.map(l => ({ "Input URL": l }));

        jobs.set(jobId, {
            status: 'processing',
            results: [],
            total: links.length,
            progress: 0,
            originalRows: records,
            linkColumn: "Input URL",
            createdAt: new Date()
        });

        processJob(jobId, links);
        res.json({ job_id: jobId, total: links.length });
    } catch (e) {
        log(`Error creating manual job: ${e.message}`);
        res.status(500).json({ error: e.message });
    }
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
    if (!job || (job.status !== 'completed' && job.status !== 'aborted')) {
        return res.status(404).json({ error: 'Results not ready' });
    }

    const fieldsParam = req.query.fields;
    const selectedFields = fieldsParam ? fieldsParam.split(',') : [];

    const data = job.originalRows.map(row => {
        const rawLink = (row[job.linkColumn] || "");
        const cleanLink = rawLink.split('?')[0].replace(/\/$/, "");

        const result = job.results.find(r => {
            const rClean = (r.link || "").split('?')[0].replace(/\/$/, "");
            return rClean === cleanLink;
        });

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

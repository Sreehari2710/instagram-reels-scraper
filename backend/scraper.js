const { ApifyClient } = require('apify-client');

class ApifyScraper {
    constructor(apiToken = null) {
        this.apiToken = apiToken;
        this.client = apiToken ? new ApifyClient({ token: apiToken }) : null;
    }

    updateToken(apiToken) {
        this.apiToken = apiToken;
        this.client = new ApifyClient({ token: apiToken });
    }

    async scrapeReels(links, onProgress = null, externalLogger = null) {
        const log = (msg) => {
            console.log(`[Scraper] ${msg}`);
            if (externalLogger) externalLogger(`[Scraper] ${msg}`);
        };

        if (!this.client) {
            log("Error: Client not initialized");
            return links.map(link => ({ link, status: 'failed', error: 'Apify API Token not configured' }));
        }

        try {
            log(`Preparing to scrape ${links.length} reels...`);
            const runInput = {
                "username": links,
                "resultsLimit": 1,
                "skipPinnedPosts": true,
                "includeSharesCount": false,
                "includeTranscript": false,
                "includeDownloadedVideo": false
            };

            log("Calling Apify start()...");
            const run = await this.client.actor("apify/instagram-reel-scraper").start(runInput);
            const runId = run.id;
            const datasetId = run.defaultDatasetId;

            log(`Run started successfully. ID: ${runId} | Dataset: ${datasetId}`);

            // Poll for progress & intermediate results
            let finished = false;
            while (!finished) {
                log(`Polling run ${runId}...`);
                const currentRun = await this.client.run(runId).get();
                const itemCount = currentRun.itemCount || 0;
                const status = currentRun.status;

                log(`Status: ${status} | Items: ${itemCount}`);

                // Fetch intermediate items
                const { items } = await this.client.dataset(datasetId).listItems({ limit: 1000 });

                if (onProgress) {
                    onProgress(itemCount, this._formatItems(links, items));
                }

                if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
                    finished = true;
                    log(`Scrape finished with status: ${status}`);
                } else {
                    await new Promise(res => setTimeout(res, 5000));
                }
            }

            const { items } = await this.client.dataset(datasetId).listItems({ limit: 1000 });
            return this._formatItems(links, items);

        } catch (e) {
            log(`CRITICAL ERROR: ${e.message}`);
            throw e;
        }
    }

    _formatItems(links, items) {
        return links.map(link => {
            // Scrub original link: basic cleaning
            const cleanOriginal = link.split('?')[0].replace(/\/$/, "");

            const matchedItem = items.find(item => {
                // Prioritize inputUrl (Apify tracks what we sent)
                const inputUrl = (item.inputUrl || "").split('?')[0].replace(/\/$/, "");
                const currentUrl = (item.url || "").split('?')[0].replace(/\/$/, "");

                // Check for direct match on inputUrl OR if the item url matches our cleaned input
                return (inputUrl && inputUrl === cleanOriginal) ||
                    (currentUrl && currentUrl === cleanOriginal) ||
                    (currentUrl && currentUrl.includes(cleanOriginal)) ||
                    (cleanOriginal && cleanOriginal.includes(currentUrl));
            });

            if (matchedItem) {
                const tsStr = matchedItem.timestamp || "";
                let year = "", month = "", date = "";
                if (tsStr) {
                    try {
                        const dt = new Date(tsStr);
                        year = dt.getFullYear().toString();
                        month = (dt.getMonth() + 1).toString();
                        date = dt.getDate().toString();
                    } catch (e) { }
                }

                return {
                    link,
                    shortcode: matchedItem.shortCode || "",
                    username: matchedItem.ownerUsername || "unknown",
                    full_name: matchedItem.ownerFullName || "",
                    caption: matchedItem.caption || "",
                    likes: matchedItem.likesCount || 0,
                    comments: matchedItem.commentsCount || 0,
                    videoplaycount: matchedItem.videoPlayCount || 0,
                    year, month, date,
                    status: "success"
                };
            } else {
                return { link, status: "processing", error: "Waiting for data..." };
            }
        });
    }
}

module.exports = ApifyScraper;

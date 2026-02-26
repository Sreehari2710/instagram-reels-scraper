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

    async scrapeReels(links, onProgress = null) {
        if (!this.client) {
            return links.map(link => ({
                link, status: 'failed', error: 'Apify API Token not configured'
            }));
        }

        try {
            const runInput = {
                "directUrls": links,
                "resultsLimit": 1,
                "includeDownloadedVideo": false,
                "includeSharesCount": true,
                "includeTranscript": false,
                "skipPinnedPosts": true
            };

            console.log(`[Apify] Starting Actor for ${links.length} reels...`);
            const run = await this.client.actor("apify/instagram-reel-scraper").start(runInput);
            const runId = run.id;
            const datasetId = run.defaultDatasetId;

            console.log(`[Apify] Run started: ${runId}`);

            // Poll for progress & intermediate results
            let finished = false;
            while (!finished) {
                const currentRun = await this.client.run(runId).get();
                const itemCount = currentRun.itemCount || 0;

                // Fetch intermediate items to show progress in UI
                const { items } = await this.client.dataset(datasetId).listItems();

                if (onProgress) {
                    onProgress(itemCount, this._formatItems(links, items));
                }

                if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(currentRun.status)) {
                    finished = true;
                    console.log(`[Apify] Run finished: ${currentRun.status}`);
                } else {
                    await new Promise(res => setTimeout(res, 5000));
                }
            }

            const { items } = await this.client.dataset(datasetId).listItems();
            return this._formatItems(links, items);

        } catch (e) {
            console.error(`[Apify] Error: ${e.message}`);
            throw e;
        }
    }

    _formatItems(links, items) {
        return links.map(link => {
            const cleanLink = link.split('?')[0].replace(/\/$/, "");

            const matchedItem = items.find(item => {
                const postUrl = (item.url || item.inputUrl || "").split('?')[0].replace(/\/$/, "");
                return postUrl && postUrl.includes(cleanLink);
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

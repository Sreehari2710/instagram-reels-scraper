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
                link,
                status: 'failed',
                error: 'Apify API Token not configured'
            }));
        }

        try {
            const runInput = {
                "resultsLimit": links.length,
                "username": links, // The actor accepts an array of URLs here
                "includeDownloadedVideo": false,
                "includeSharesCount": true,
                "includeTranscript": false,
                "skipPinnedPosts": true
            };

            console.log(`Starting Apify Actor for ${links.length} links...`);
            const run = await this.client.actor("apify/instagram-reel-scraper").start(runInput);
            const runId = run.id;
            const datasetId = run.defaultDatasetId;

            // Poll for progress
            let finished = false;
            while (!finished) {
                const currentRun = await this.client.run(runId).get();
                if (onProgress) onProgress(currentRun.itemCount || 0);

                if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(currentRun.status)) {
                    finished = true;
                } else {
                    await new Promise(res => setTimeout(res, 3000)); // Poll every 3 seconds
                }
            }

            const { items } = await this.client.dataset(datasetId).listItems();
            console.log(`Apify finished. Found ${items.length} results.`);

            const resultsMap = new Map();
            items.forEach(item => {
                if (item.inputUrl) {
                    resultsMap.set(item.inputUrl, item);
                }
            });

            return links.map(link => {
                const baseLink = link.split('?')[0].replace(/\/$/, "");

                let matchedItem = null;
                for (const [resLink, item] of resultsMap.entries()) {
                    if (resLink && resLink.includes(baseLink)) {
                        matchedItem = item;
                        break;
                    }
                }

                if (matchedItem) {
                    const tsStr = matchedItem.timestamp || "";
                    let year = "", month = "", date = "";
                    if (tsStr) {
                        try {
                            const dt = new Date(tsStr);
                            year = dt.getFullYear().toString();
                            month = (dt.getMonth() + 1).toString();
                            date = dt.getDate().toString();
                        } catch (e) {
                            console.error("Date parse error", e);
                        }
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
                        year,
                        month,
                        date,
                        thumbnail_url: matchedItem.displayUrl || "",
                        status: "success"
                    };
                } else {
                    return {
                        link,
                        status: "failed",
                        error: "No data found for this link"
                    };
                }
            });

        } catch (e) {
            console.error(`Apify Error: ${e.message}`);
            return links.map(link => ({
                link,
                status: 'failed',
                error: e.message
            }));
        }
    }
}

module.exports = ApifyScraper;

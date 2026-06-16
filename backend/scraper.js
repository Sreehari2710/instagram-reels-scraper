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

    async abortRun(runId) {
        if (!this.client || !runId) return;
        try {
            console.log(`[Scraper] Aborting run ${runId}...`);
            await this.client.run(runId).abort();
            return { success: true };
        } catch (e) {
            console.error(`[Scraper] Failed to abort run ${runId}: ${e.message}`);
            throw e;
        }
    }

    async scrapeReels(links, onProgress = null, externalLogger = null, onRunId = null) {
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
                "includeSharesCount": true,
                "includeTranscript": false,
                "includeDownloadedVideo": false
            };

            log("Calling Apify start()...");
            const run = await this.client.actor("apify/instagram-reel-scraper").start(runInput);
            const runId = run.id;
            const datasetId = run.defaultDatasetId;

            log(`Run started successfully. ID: ${runId} | Dataset: ${datasetId}`);
            if (onRunId) onRunId(runId);

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
                    shares: matchedItem.sharesCount || 0,
                    videoplaycount: matchedItem.videoPlayCount || 0,
                    year, month, date,
                    status: "success"
                };
            } else {
                return { link, status: "processing", error: "Waiting for data..." };
            }
        });
    }
    async scrapeAverageStats(links, onProgress = null, externalLogger = null, onRunId = null) {
        const log = (msg) => {
            console.log(`[Scraper-Avg] ${msg}`);
            if (externalLogger) externalLogger(`[Scraper-Avg] ${msg}`);
        };

        if (!this.client) {
            log("Error: Client not initialized");
            return links.map(link => ({ link, status: 'failed', error: 'Apify API Token not configured' }));
        }

        try {
            log(`Preparing to scrape stats for ${links.length} profiles...`);
            
            // Format to ensure Apify only receives clean usernames
            const apifyUsernames = links.map(link => {
                let s = link.split('?')[0].replace(/\/$/, "");
                if (s.includes('instagram.com/') || s.includes('instagr.am/')) {
                    try {
                        if (!s.startsWith('http')) s = 'https://' + s;
                        const urlObj = new URL(s);
                        const parts = urlObj.pathname.split('/').filter(p => p.length > 0);
                        if (parts.length > 0) {
                            const firstPart = parts[0];
                            if (!['p', 'reel', 'reels', 'tv', 'explore', 'stories'].includes(firstPart.toLowerCase())) {
                                return firstPart; // Safely return just the username
                            }
                        }
                    } catch(e) {}
                }
                return s.replace(/^@/, "").trim(); // Return raw or @ stripped string
            });

            const runInput = {
                "username": apifyUsernames,
                "resultsLimit": 10,
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
            if (onRunId) onRunId(runId);

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
                    onProgress(itemCount, this._formatItemsAvg(links, items));
                }

                if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
                    finished = true;
                    log(`Scrape finished with status: ${status}`);
                } else {
                    await new Promise(res => setTimeout(res, 5000));
                }
            }

            const { items } = await this.client.dataset(datasetId).listItems({ limit: 1000 });
            return this._formatItemsAvg(links, items);

        } catch (e) {
            log(`CRITICAL ERROR: ${e.message}`);
            throw e;
        }
    }

    async scrapeAverageStatsWithRotation(links, apiTokens = [], onProgress = null, externalLogger = null, onKeySwitch = null) {
        const log = (msg) => {
            console.log(`[Scraper-Avg-Rotation] ${msg}`);
            if (externalLogger) externalLogger(`[Scraper-Avg-Rotation] ${msg}`);
        };

        if (!apiTokens || apiTokens.length === 0) {
            log("Error: No API tokens provided for rotation pool");
            return links.map(link => ({ link, status: 'failed', error: 'No Apify API tokens configured for avg scraper' }));
        }

        const accumulatedResults = new Map(); // username/link → result
        let remainingLinks = [...links];

        for (let keyIndex = 0; keyIndex < apiTokens.length; keyIndex++) {
            const token = apiTokens[keyIndex];
            if (!token || token.includes('your_avg_api_key')) {
                log(`Skipping key ${keyIndex + 1} — not configured`);
                continue;
            }

            if (remainingLinks.length === 0) {
                log("All accounts scraped, stopping early.");
                break;
            }

            log(`Using API key ${keyIndex + 1}/${apiTokens.length} for ${remainingLinks.length} remaining accounts`);
            if (onKeySwitch) onKeySwitch(keyIndex);

            const client = new (require('apify-client').ApifyClient)({ token });

            try {
                const apifyUsernames = remainingLinks.map(link => {
                    let s = link.split('?')[0].replace(/\/$/, "");
                    if (s.includes('instagram.com/') || s.includes('instagr.am/')) {
                        try {
                            if (!s.startsWith('http')) s = 'https://' + s;
                            const urlObj = new URL(s);
                            const parts = urlObj.pathname.split('/').filter(p => p.length > 0);
                            if (parts.length > 0) {
                                const firstPart = parts[0];
                                if (!['p', 'reel', 'reels', 'tv', 'explore', 'stories'].includes(firstPart.toLowerCase())) {
                                    return firstPart;
                                }
                            }
                        } catch (e) {}
                    }
                    return s.replace(/^@/, "").trim();
                });

                const runInput = {
                    "username": apifyUsernames,
                    "resultsLimit": 10,
                    "skipPinnedPosts": true,
                    "includeSharesCount": false,
                    "includeTranscript": false,
                    "includeDownloadedVideo": false
                };

                log("Calling Apify start()...");
                const run = await client.actor("apify/instagram-reel-scraper").start(runInput);
                const runId = run.id;
                const datasetId = run.defaultDatasetId;
                log(`Run started. ID: ${runId} | Dataset: ${datasetId}`);

                let finished = false;
                let lastItems = [];
                while (!finished) {
                    log(`Polling run ${runId}...`);
                    const currentRun = await client.run(runId).get();
                    const itemCount = currentRun.itemCount || 0;
                    const status = currentRun.status;
                    log(`Status: ${status} | Items: ${itemCount}`);

                    const { items } = await client.dataset(datasetId).listItems({ limit: 1000 });
                    lastItems = items;

                    // Merge completed results so far
                    this._mergeAvgResults(links, items, accumulatedResults);

                    if (onProgress) {
                        const merged = this._buildAvgResultsFromMap(links, accumulatedResults);
                        onProgress(accumulatedResults.size * 10, merged);
                    }

                    if (['SUCCEEDED', 'FAILED', 'ABORTED', 'TIMED-OUT'].includes(status)) {
                        finished = true;
                        log(`Run ended with status: ${status}`);
                    } else {
                        await new Promise(res => setTimeout(res, 5000));
                    }
                }

                // Final merge after run ends
                this._mergeAvgResults(links, lastItems, accumulatedResults);

                // Determine which links still have no results → remainingLinks for next key
                remainingLinks = links.filter(link => !accumulatedResults.has(this._normalizeLink(link)));
                log(`After key ${keyIndex + 1}: ${accumulatedResults.size} done, ${remainingLinks.length} remaining`);

            } catch (e) {
                log(`Key ${keyIndex + 1} failed: ${e.message}. Switching to next key if available.`);
                // remainingLinks stays as-is so next key picks up from where we left off
            }
        }

        return this._buildAvgResultsFromMap(links, accumulatedResults);
    }

    _normalizeLink(link) {
        return link.split('?')[0].replace(/\/$/, "").toLowerCase().replace(/^@/, "");
    }

    _mergeAvgResults(links, items, accumulatedResults) {
        links.forEach(link => {
            const cleanOriginal = this._normalizeLink(link);
            if (accumulatedResults.has(cleanOriginal)) return; // already done

            const matchedItems = items.filter(item => {
                const inputUrl = (item.inputUrl || "").split('?')[0].replace(/\/$/, "");
                const ownerUsername = (item.ownerUsername || "").toLowerCase();
                const isMatch =
                    (inputUrl && inputUrl.toLowerCase() === cleanOriginal) ||
                    (cleanOriginal.includes(`instagram.com/${ownerUsername}/`) || cleanOriginal.includes(`instagram.com/${ownerUsername}`)) ||
                    (ownerUsername && cleanOriginal === ownerUsername) ||
                    (ownerUsername && cleanOriginal === `@${ownerUsername}`);
                return isMatch;
            });

            if (matchedItems.length > 0) {
                let totalComments = 0, totalVideoPlayCount = 0, validComments = 0, validViews = 0;
                matchedItems.forEach(mi => {
                    if (typeof mi.commentsCount === 'number') { totalComments += mi.commentsCount; validComments++; }
                    if (typeof mi.videoPlayCount === 'number') { totalVideoPlayCount += mi.videoPlayCount; validViews++; }
                });
                const firstItem = matchedItems[0];
                accumulatedResults.set(cleanOriginal, {
                    link,
                    username: firstItem.ownerUsername || "unknown",
                    full_name: firstItem.ownerFullName || "",
                    reels_scraped: matchedItems.length,
                    avg_comments: validComments > 0 ? Math.round(totalComments / validComments) : 0,
                    avg_videoplaycount: validViews > 0 ? Math.round(totalVideoPlayCount / validViews) : 0,
                    status: "success"
                });
            }
        });
    }

    _buildAvgResultsFromMap(links, accumulatedResults) {
        return links.map(link => {
            const key = this._normalizeLink(link);
            return accumulatedResults.get(key) || { link, status: "processing", error: "Waiting for data..." };
        });
    }

    _formatItemsAvg(links, items) {
        return links.map(link => {
            const cleanOriginal = link.split('?')[0].replace(/\/$/, "");

            const matchedItems = items.filter(item => {
                const inputUrl = (item.inputUrl || "").split('?')[0].replace(/\/$/, "");
                const ownerUsername = item.ownerUsername || "";
                
                // Match either by input URL exactly, or by matching the username in the profile link, or pure username match
                const isMatch = (inputUrl && inputUrl === cleanOriginal) ||
                    (cleanOriginal.includes(`instagram.com/${ownerUsername}/`) || cleanOriginal.includes(`instagram.com/${ownerUsername}`)) ||
                    (ownerUsername && cleanOriginal === ownerUsername) ||
                    (ownerUsername && cleanOriginal === `@${ownerUsername}`);
                return isMatch;
            });

            if (matchedItems.length > 0) {
                let totalComments = 0;
                let totalVideoPlayCount = 0;
                let validCommentsCount = 0;
                let validViewsCount = 0;

                matchedItems.forEach(mi => {
                    if (typeof mi.commentsCount === 'number') {
                        totalComments += mi.commentsCount;
                        validCommentsCount++;
                    }
                    if (typeof mi.videoPlayCount === 'number') {
                        totalVideoPlayCount += mi.videoPlayCount;
                        validViewsCount++;
                    }
                });

                const avg_comments = validCommentsCount > 0 ? Math.round(totalComments / validCommentsCount) : 0;
                const avg_videoplaycount = validViewsCount > 0 ? Math.round(totalVideoPlayCount / validViewsCount) : 0;

                const firstItem = matchedItems[0];

                return {
                    link,
                    username: firstItem.ownerUsername || "unknown",
                    full_name: firstItem.ownerFullName || "",
                    reels_scraped: matchedItems.length,
                    avg_comments,
                    avg_videoplaycount,
                    status: "success"
                };
            } else {
                return { link, status: "processing", error: "Waiting for data..." };
            }
        });
    }
}

module.exports = ApifyScraper;

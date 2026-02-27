"use client";

import React, { useState } from 'react';
import { Link2, AlertCircle, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface DirectLinkInputProps {
    onScrape: (links: string[]) => void;
    isUploading: boolean;
}

export default function DirectLinkInput({ onScrape, isUploading }: DirectLinkInputProps) {
    const [linksText, setLinksText] = useState("");

    const handleStart = () => {
        const links = linksText
            .split('\n')
            .map(l => l.trim())
            .filter(l => l.length > 0);

        if (links.length === 0) {
            alert("Please paste at least one link.");
            return;
        }

        onScrape(links);
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div className="bg-white rounded-3xl border border-slate-200 p-8 shadow-sm">
                <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 bg-blue-50 rounded-xl flex items-center justify-center text-blue-500">
                        <Link2 size={20} />
                    </div>
                    <div>
                        <h3 className="text-xl font-bold text-slate-900">Paste Links</h3>
                        <p className="text-sm text-slate-500">Enter one Instagram reel URL per line</p>
                    </div>
                </div>

                <textarea
                    value={linksText}
                    onChange={(e) => setLinksText(e.target.value)}
                    placeholder="https://www.instagram.com/reel/C7...&#10;https://www.instagram.com/reels/Xyz..."
                    className="w-full h-48 p-5 bg-slate-50 border border-slate-200 rounded-2xl focus:ring-4 focus:ring-blue-100 focus:border-blue-500 transition-all outline-none resize-none font-mono text-sm mb-6"
                    disabled={isUploading}
                />

                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-[11px] font-bold text-slate-400 uppercase tracking-widest">
                        <AlertCircle size={14} />
                        {linksText.split('\n').filter(l => l.trim()).length} links detected
                    </div>

                    <button
                        onClick={handleStart}
                        disabled={isUploading || !linksText.trim()}
                        className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all text-sm uppercase tracking-wide flex items-center gap-2 group disabled:opacity-50 disabled:hover:translate-y-0"
                    >
                        {isUploading ? (
                            <Loader2 className="animate-spin" size={18} />
                        ) : null}
                        {isUploading ? "Starting Scrape..." : "Start Extracting"}
                    </button>
                </div>
            </div>
        </div>
    );
}

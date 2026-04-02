"use client";

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Instagram, FileSpreadsheet, Keyboard, BarChart2 } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import DirectLinkInput from '@/components/DirectLinkInput';
import ResultsViewAvg from '@/components/ResultsViewAvg';
import SettingsModal from '@/components/SettingsModal';
import Link from 'next/link';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface Result {
  link: string;
  status: string;
  username?: string;
  full_name?: string;
  reels_scraped?: number;
  avg_comments?: number | string;
  avg_videoplaycount?: number | string;
  error?: string;
}

export default function AverageStatsCalculator() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'aborted' | 'awaiting_action'>('idle');
  const [results, setResults] = useState<Result[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputMethod, setInputMethod] = useState<'file' | 'direct'>('file');
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const handleUpload = async (file: File) => {
    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload-avg`, formData);
      setJobId(response.data.job_id);
      setStatus('processing');
      startPolling(response.data.job_id);
    } catch (error: unknown) {
      console.error("Upload failed", error);
      let errorMsg = "Upload failed. Please try again.";
      if (axios.isAxiosError(error)) {
        errorMsg = error.response?.data?.error || `Upload failed. Make sure the backend reached at ${API_BASE_URL} is running.`;
      }
      alert(errorMsg);
      setStatus('idle');
    }
  };

  const handleDirectScrape = async (links: string[]) => {
    setStatus('processing');
    try {
      const response = await axios.post(`${API_BASE_URL}/scrape-links-avg`, { links });
      setJobId(response.data.job_id);
      startPolling(response.data.job_id);
    } catch (error: unknown) {
      console.error("Direct scrape failed", error);
      let errorMsg = "Failed to start scrape. Please try again.";
      if (axios.isAxiosError(error)) {
        errorMsg = error.response?.data?.error || errorMsg;
      }
      alert(errorMsg);
      setStatus('idle');
    }
  };


  const startPolling = (id: string) => {
    if (pollInterval.current) clearInterval(pollInterval.current);

    pollInterval.current = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/status/${id}`);
        const data = response.data;

        setResults(data.results);

        if (data.status === 'completed') {
          setStatus('completed');
          if (pollInterval.current) clearInterval(pollInterval.current);
        } else if (data.status === 'awaiting_action') {
          setStatus('awaiting_action');
        } else if (data.status === 'processing') {
          setStatus('processing');
        }
      } catch (error) {
        console.error("Polling failed", error);
      }
    }, 2000);
  };

  const handleStop = async () => {
    if (!jobId) return;
    try {
      await axios.post(`${API_BASE_URL}/stop/${jobId}`);
      setStatus('aborted');
      if (pollInterval.current) clearInterval(pollInterval.current);
    } catch (error) {
      console.error("Stop failed", error);
      alert("Failed to stop scraping. Please try again.");
    }
  };

  const handleDownload = (fields?: string) => {
    if (jobId) {
      let url = `${API_BASE_URL}/download/${jobId}`;
      if (fields) url += `?fields=${fields}`;
      window.open(url, '_blank');
    }
  };


  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-200 px-6 py-4 flex flex-col md:flex-row items-center justify-between sticky top-0 z-50 shadow-sm gap-4">
        <div className="flex items-center gap-3">
          <div className="neo-box bg-white p-2">
            <Instagram size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">REEL SCRAPER</h1>
            <p className="text-xs font-bold opacity-70">INTERNAL TOOL v1.0</p>
          </div>
        </div>

        <div className="flex bg-slate-100 p-1 rounded-xl">
            <Link href="/" className="px-6 py-2 rounded-lg text-sm font-bold text-slate-500 hover:text-slate-800 transition-colors">
                Single Reel Data
            </Link>
            <Link href="/avg-calculator" className="px-6 py-2 rounded-lg text-sm font-bold bg-white text-blue-600 shadow-sm">
                Average Stats Calc
            </Link>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <main className="py-12 px-6">
        <div className="max-w-3xl mx-auto text-center mb-10">
            <h2 className="text-2xl font-bold text-slate-800 flex items-center justify-center gap-2 mb-2">
                <BarChart2 className="text-blue-500"/> Compute Average Account Metrics
            </h2>
            <p className="text-slate-500">Paste instagram profile links or upload a CSV with profile links. Based on your settings, this will scrape the last 10 reels of each account and calculate average comments and views.</p>
        </div>

        {!jobId ? (
          <>
            <div className="flex justify-center mb-12">
              <div className="bg-white p-1.5 rounded-2xl border border-slate-200 flex gap-1 shadow-sm">
                <button
                  onClick={() => setInputMethod('file')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${inputMethod === 'file' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <FileSpreadsheet size={18} /> File Upload
                </button>
                <button
                  onClick={() => setInputMethod('direct')}
                  className={`flex items-center gap-2 px-6 py-3 rounded-xl font-bold transition-all ${inputMethod === 'direct' ? 'bg-blue-600 text-white shadow-lg shadow-blue-100' : 'text-slate-400 hover:text-slate-600'}`}
                >
                  <Keyboard size={18} /> Quick Paste
                </button>
              </div>
            </div>

            {inputMethod === 'file' ? (
              <UploadZone onUpload={handleUpload} isUploading={status === 'uploading'} />
            ) : (
              <DirectLinkInput onScrape={handleDirectScrape} isUploading={status === 'processing'} allowProfiles={true} />
            )}
          </>
        ) : (
          <ResultsViewAvg
            status={status}
            results={results}
            onDownload={handleDownload}
            onStop={handleStop}
            onReset={() => {
              setJobId(null);
              setStatus('idle');
              setResults([]);
              if (pollInterval.current) clearInterval(pollInterval.current);
            }}
            jobId={jobId}
          />
        )}
      </main>

      <footer className="border-t border-slate-200 p-10 bg-white mt-20">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <p className="font-medium text-slate-400 text-sm">© 2026 VUDUCOM INTERNAL TOOLS</p>
          <div className="flex gap-3">
            <div className="px-3 py-1 text-[10px] font-bold text-slate-400 uppercase tracking-widest border border-slate-100 rounded-md">Node.js Engine</div>
          </div>
        </div>
      </footer>
    </div>
  );
}

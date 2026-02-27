"use client";

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Instagram, ShieldCheck, Zap, Settings as SettingsIcon } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import DirectLinkInput from '@/components/DirectLinkInput';
import ResultsView from '@/components/ResultsView';
import SettingsModal from '@/components/SettingsModal';
import { FileSpreadsheet, Keyboard } from 'lucide-react';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'aborted' | 'awaiting_action'>('idle');
  const [results, setResults] = useState<any[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [inputMethod, setInputMethod] = useState<'file' | 'direct'>('file');
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const handleUpload = async (file: File) => {
    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData);
      setJobId(response.data.job_id);
      setStatus('processing');
      startPolling(response.data.job_id);
    } catch (error: any) {
      console.error("Upload failed", error);
      const errorMsg = error.response?.data?.error || `Upload failed. Make sure the backend reached at ${API_BASE_URL} is running.`;
      alert(errorMsg);
      setStatus('idle');
    }
  };

  const handleDirectScrape = async (links: string[]) => {
    setStatus('processing');
    try {
      const response = await axios.post(`${API_BASE_URL}/scrape-links`, { links });
      setJobId(response.data.job_id);
      startPolling(response.data.job_id);
    } catch (error: any) {
      console.error("Direct scrape failed", error);
      const errorMsg = error.response?.data?.error || "Failed to start scrape. Please try again.";
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

  const handleReset = () => {
    setJobId(null);
    setStatus('idle');
    setStatus('idle');
    setResults([]);
    if (pollInterval.current) clearInterval(pollInterval.current);
  };

  useEffect(() => {
    return () => {
      if (pollInterval.current) clearInterval(pollInterval.current);
    };
  }, []);

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 p-6 flex items-center justify-between sticky top-0 z-50 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="neo-box bg-white p-2">
            <Instagram size={32} />
          </div>
          <div>
            <h1 className="text-3xl font-black uppercase tracking-tighter">REEL SCRAPER</h1>
            <p className="text-xs font-bold opacity-70">INTERNAL TOOL v1.0</p>
          </div>
        </div>

        <div className="hidden md:flex gap-6 items-center">
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Internal v1.3</p>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <main className="py-12 px-6">
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
              <DirectLinkInput onScrape={handleDirectScrape} isUploading={status === 'processing'} />
            )}
          </>
        ) : (
          <ResultsView
            status={status}
            results={results}
            onDownload={handleDownload}
            onStop={handleStop}
            onReset={() => {
              setJobId(null);
              setStatus('idle');
              setResults([]);
            }}
            jobId={jobId}
          />
        )}
      </main>

      {/* Footer */}
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

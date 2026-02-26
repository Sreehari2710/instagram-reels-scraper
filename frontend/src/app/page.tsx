"use client";

import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { Instagram, ShieldCheck, Zap, Settings as SettingsIcon } from 'lucide-react';
import UploadZone from '@/components/UploadZone';
import ResultsView from '@/components/ResultsView';
import SettingsModal from '@/components/SettingsModal';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

export default function Home() {
  const [jobId, setJobId] = useState<string | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'processing' | 'completed' | 'failed' | 'awaiting_action'>('idle');
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [results, setResults] = useState<any[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const pollInterval = useRef<NodeJS.Timeout | null>(null);

  const handleUpload = async (file: File) => {
    setStatus('uploading');
    const formData = new FormData();
    formData.append('file', file);

    try {
      const response = await axios.post(`${API_BASE_URL}/upload`, formData);
      setJobId(response.data.job_id);
      setTotal(response.data.total);
      setStatus('processing');
      startPolling(response.data.job_id);
    } catch (error) {
      console.error("Upload failed", error);
      alert(`Upload failed. Make sure the backend reached at ${API_BASE_URL} is running.`);
      setStatus('idle');
    }
  };


  const startPolling = (id: string) => {
    if (pollInterval.current) clearInterval(pollInterval.current);

    pollInterval.current = setInterval(async () => {
      try {
        const response = await axios.get(`${API_BASE_URL}/status/${id}`);
        const data = response.data;

        setProgress(data.progress);
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
    setProgress(0);
    setTotal(0);
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
          <p className="text-slate-400 text-xs font-semibold uppercase tracking-wider">Internal v1.2</p>
        </div>
      </header>

      <SettingsModal
        isOpen={isSettingsOpen}
        onClose={() => setIsSettingsOpen(false)}
      />

      <main className="py-12 px-6">
        {status === 'idle' || status === 'uploading' ? (
          <>
            <div className="text-center mb-16 max-w-4xl mx-auto">
              <h2 className="text-5xl md:text-7xl font-extrabold text-slate-900 mb-6 tracking-tight leading-tight">
                Get Any Reel Data <br />
                <span className="text-blue-600">Instantly</span>
              </h2>
              <p className="text-xl font-bold opacity-80 max-w-2xl mx-auto mt-6">
                Paste your links in a CSV and we'll fetch the likes, views, captions, and more without any account login required.
              </p>
            </div>

            <UploadZone onUpload={handleUpload} isUploading={status === 'uploading'} />
          </>
        ) : (
          <ResultsView
            status={status}
            progress={progress}
            total={total}
            results={results}
            onDownload={handleDownload}
            onReset={() => {
              setJobId(null);
              setStatus('idle');
              setResults([]);
              setProgress(0);
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

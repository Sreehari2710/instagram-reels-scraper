"use client";

import React from 'react';
import { Download, ExternalLink, CheckCircle2, XCircle, Loader2, AlertTriangle, RefreshCw, Check, Info, ChevronDown, Trash2 } from 'lucide-react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';

interface Result {
    link: string;
    status: string;
    username?: string;
    full_name?: string;
    likes?: number | string;
    videoplaycount?: number | string;
    caption?: string;
    comments?: number | string;
    error?: string;
    year?: string;
    month?: string;
    date?: string;
}

interface ResultsViewProps {
    status: string;
    results: Result[];
    onDownload: (fields?: string) => void;
    onStop: () => void;
    onReset: () => void;
    jobId: string | null;
}

export default function ResultsView({ status, results, onDownload, onStop, onReset, jobId }: ResultsViewProps) {
    // Field Selection Modal State
    const [isModalOpen, setIsModalOpen] = React.useState(false);
    const [availableFields, setAvailableFields] = React.useState<{ id: string, label: string }[]>([]);
    const [selectedFields, setSelectedFields] = React.useState<string[]>([]);
    const [isLoadingFields, setIsLoadingFields] = React.useState(false);
    const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
    const [searchTerm, setSearchTerm] = React.useState("");

    const openDownloadModal = async () => {
        setIsLoadingFields(true);
        setIsModalOpen(true);
        try {
            const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
            const res = await axios.get(`${API_BASE_URL}/fields`);
            setAvailableFields(res.data);
            setSelectedFields([]); // None selected by default as requested
        } catch (e) {
            console.error("Failed to fetch fields", e);
        } finally {
            setIsLoadingFields(false);
        }
    };

    const toggleField = (id: string) => {
        setSelectedFields(prev =>
            prev.includes(id) ? prev.filter(f => f !== id) : [...prev, id]
        );
    };

    const confirmDownload = () => {
        onDownload(selectedFields.join(','));
        setIsModalOpen(false);
    };

    return (
        <div className="w-full max-w-6xl mx-auto p-6 relative">
            {/* Field Selection Modal */}
            <AnimatePresence>
                {isModalOpen && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[150] flex items-start justify-center p-4 bg-black/60 backdrop-blur-sm pt-20"
                    >
                        <motion.div
                            initial={{ scale: 0.9, y: 30 }}
                            animate={{ scale: 1, y: 0 }}
                            className="bg-white rounded-[32px] w-full max-w-lg shadow-2xl relative"
                        >
                            <div className="bg-white border-b border-slate-100 p-6 flex items-center justify-between rounded-t-[32px]">
                                <h3 className="font-bold text-slate-900 text-xl flex items-center gap-2">
                                    <Download size={22} className="text-blue-600" /> Export Data
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                                    <XCircle size={28} />
                                </button>
                            </div>

                            <div className="p-6">
                                <p className="font-semibold text-slate-600 text-sm mb-4 flex items-center gap-2">
                                    <Info size={16} className="text-blue-500" /> pick the columns you want in your final CSV.
                                </p>

                                {isLoadingFields ? (
                                    <div className="flex flex-col items-center py-8 gap-3">
                                        <Loader2 className="animate-spin text-blue-500" size={40} />
                                        <span className="font-bold text-slate-400 text-xs">Loading Fields...</span>
                                    </div>
                                ) : (
                                    <div className="relative mb-8">
                                        <div className="font-bold text-slate-500 text-xs mb-3 flex items-center gap-2 uppercase tracking-wider">
                                            Selected Columns
                                        </div>
                                        <div className="flex flex-wrap gap-2 mb-4">
                                            {selectedFields.map(fieldId => {
                                                const field = availableFields.find(f => f.id === fieldId);
                                                return (
                                                    <div key={fieldId} className="bg-blue-50 border border-blue-100 rounded-xl py-1.5 px-3 flex items-center gap-2 text-[11px] font-bold text-blue-700">
                                                        {field?.label || fieldId}
                                                        <button onClick={() => toggleField(fieldId)} className="hover:text-blue-900 transition-colors">
                                                            <XCircle size={14} />
                                                        </button>
                                                    </div>
                                                );
                                            })}
                                            {selectedFields.length === 0 && (
                                                <div className="text-slate-400 font-medium text-xs py-2 italic">None yet—pick from the list below</div>
                                            )}
                                        </div>

                                        <button
                                            onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                                            className="w-full bg-slate-50 border border-slate-200 rounded-2xl p-4 flex items-center justify-between font-bold text-slate-700 hover:bg-slate-100 transition-all"
                                        >
                                            Add / Remove Columns
                                            <ChevronDown size={20} className={`transition-transform duration-300 ${isDropdownOpen ? 'rotate-180' : ''}`} />
                                        </button>

                                        <AnimatePresence>
                                            {isDropdownOpen && (
                                                <motion.div
                                                    initial={{ opacity: 0, scale: 0.98, y: -4 }}
                                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                                    exit={{ opacity: 0, scale: 0.98, y: -4 }}
                                                    className="absolute top-full left-0 right-0 z-[160] mt-1 bg-white border border-slate-200 rounded-[28px] max-h-[400px] overflow-hidden shadow-2xl ring-1 ring-black/5 flex flex-col pt-3"
                                                >
                                                    <div className="px-4 pb-2">
                                                        <div className="relative">
                                                            <input
                                                                type="text"
                                                                placeholder="Search fields..."
                                                                value={searchTerm}
                                                                onChange={(e) => setSearchTerm(e.target.value)}
                                                                className="w-full bg-slate-50 border border-slate-100 rounded-xl py-2 px-10 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-all"
                                                            />
                                                            <div className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400">
                                                                <RefreshCw size={14} className={isLoadingFields ? "animate-spin" : ""} />
                                                            </div>
                                                        </div>
                                                    </div>

                                                    <div className="flex-1 overflow-y-auto px-3 pb-8 scrollbar-thin scrollbar-thumb-slate-200">
                                                        {availableFields
                                                            .filter(f => f.label.toLowerCase().includes(searchTerm.toLowerCase()))
                                                            .map(field => (
                                                                <button
                                                                    key={field.id}
                                                                    onClick={() => toggleField(field.id)}
                                                                    className={`w-full p-3.5 flex items-center justify-between font-semibold text-sm rounded-xl transition-all mb-1 last:mb-0 ${selectedFields.includes(field.id)
                                                                        ? 'bg-blue-50 text-blue-700'
                                                                        : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                                                                        }`}
                                                                >
                                                                    {field.label}
                                                                    {selectedFields.includes(field.id) && <Check size={18} className="text-blue-500" />}
                                                                </button>
                                                            ))}
                                                        {availableFields.filter(f => f.label.toLowerCase().includes(searchTerm.toLowerCase())).length === 0 && (
                                                            <div className="p-8 text-center text-slate-400 text-xs font-medium">No fields found matching "{searchTerm}"</div>
                                                        )}
                                                    </div>
                                                </motion.div>
                                            )}
                                        </AnimatePresence>
                                    </div>
                                )}

                                <div className="flex gap-4 mt-4">
                                    <button
                                        onClick={() => setSelectedFields(availableFields.map(f => f.id))}
                                        className="flex-1 px-4 py-3 rounded-2xl font-bold bg-slate-100 text-slate-600 hover:bg-slate-200 transition-all text-sm"
                                    >
                                        Select All
                                    </button>
                                    <button
                                        onClick={confirmDownload}
                                        disabled={selectedFields.length === 0}
                                        className="flex-[2] px-4 py-3 rounded-2xl font-bold bg-blue-600 text-white hover:bg-blue-700 shadow-xl shadow-blue-100 transition-all disabled:opacity-30 text-sm uppercase tracking-wide"
                                    >
                                        DOWNLOAD CSV
                                    </button>
                                </div>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Status Card */}
            <div className="bg-white rounded-2xl p-8 mb-10 border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-8 animate-in fade-in slide-in-from-bottom-5 duration-500">
                <div className="flex-1 w-full">
                    <div className="flex items-center gap-4">
                        <div className={`w-3 h-3 rounded-full ${status === 'completed' ? 'bg-green-500' : status === 'failed' || status === 'aborted' ? 'bg-red-500' : 'bg-blue-500 animate-pulse'}`}></div>
                        <span className="font-extrabold text-2xl text-slate-900 tracking-tight uppercase">
                            {status === 'processing' ? 'SCRAPING...' :
                                status === 'completed' ? 'DONE!' :
                                    status === 'aborted' ? 'STOPPED' :
                                        status === 'failed' ? 'FAILED' : 'PAUSED'}
                        </span>

                        {status === 'processing' && (
                            <button
                                onClick={onStop}
                                className="ml-4 bg-red-50 text-red-600 px-4 py-2 rounded-xl font-bold text-xs uppercase tracking-wider hover:bg-red-100 transition-all border border-red-100 flex items-center gap-2"
                            >
                                <XCircle size={14} /> Stop Scraping
                            </button>
                        )}
                    </div>
                </div>

                <div className="flex gap-4">
                    {['completed', 'aborted', 'failed'].includes(status) && (
                        <button
                            onClick={openDownloadModal}
                            className="bg-blue-600 text-white px-8 py-4 rounded-xl font-bold shadow-xl shadow-blue-100 hover:bg-blue-700 hover:-translate-y-1 transition-all flex items-center gap-2"
                        >
                            <Download size={20} /> DOWNLOAD RESULTS
                        </button>
                    )}
                    <button
                        onClick={onReset}
                        className="bg-slate-50 text-slate-600 px-8 py-4 rounded-xl font-bold border border-slate-200 hover:bg-slate-100 transition-all"
                    >
                        START NEW
                    </button>
                </div>
            </div>

            {/* Results Table */}
            <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden overflow-x-auto">
                <table className="w-full text-left border-collapse">
                    <thead>
                        <tr className="bg-slate-50 border-b border-slate-200">
                            <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Reel Info</th>
                            <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider">Author</th>
                            <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider text-center">Metrics</th>
                            <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider text-center">Timeline</th>
                            <th className="p-5 font-bold text-slate-500 uppercase text-xs tracking-wider text-center">Status</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                        {results.map((result, idx) => (
                            <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                <td className="p-5 min-w-[320px]">
                                    <div className="flex items-center gap-4">
                                        <div className="rounded-lg bg-slate-100 w-10 h-10 flex items-center justify-center flex-shrink-0">
                                            {result.status === 'processing' ? (
                                                <Loader2 className="animate-spin text-blue-500" size={18} />
                                            ) : (
                                                <div className="w-2 h-2 rounded-full bg-slate-300" />
                                            )}
                                        </div>
                                        <div className="flex flex-col gap-1">
                                            <a href={result.link} target="_blank" className="font-bold text-slate-900 flex items-center gap-1.5 hover:text-blue-600 transition-colors text-sm">
                                                View Source <ExternalLink size={14} />
                                            </a>
                                            <p className="text-xs text-slate-500 line-clamp-1">{result.caption || "No caption available"}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5">
                                    <div className="flex flex-col">
                                        <span className="font-bold text-slate-900">@{result.username || 'unknown'}</span>
                                        <span className="text-xs text-slate-500">{result.full_name}</span>
                                    </div>
                                </td>
                                <td className="p-5">
                                    <div className="flex items-center justify-center gap-4">
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Likes</span>
                                            <span className="font-bold text-slate-700">{result.likes || 0}</span>
                                        </div>
                                        <div className="flex flex-col items-center border-x border-slate-100 px-4">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Views</span>
                                            <span className="font-bold text-slate-700">{result.videoplaycount || 0}</span>
                                        </div>
                                        <div className="flex flex-col items-center">
                                            <span className="text-[10px] font-bold text-slate-400 uppercase">Comments</span>
                                            <span className="font-bold text-slate-700">{result.comments || 0}</span>
                                        </div>
                                    </div>
                                </td>
                                <td className="p-5 text-center">
                                    <div className="inline-flex flex-col bg-slate-50 px-3 py-1.5 rounded-lg border border-slate-200">
                                        <span className="text-[10px] font-bold text-slate-400 uppercase">{result.year || '----'}</span>
                                        <span className="text-xs font-bold text-slate-700">{result.month && result.date ? `${result.date}/${result.month}` : 'Pending'}</span>
                                    </div>
                                </td>
                                <td className="p-5 text-center">
                                    {result.status === 'success' ? (
                                        <span className="bg-green-100 text-green-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight">Verified</span>
                                    ) : result.status === 'failed' ? (
                                        <span className="bg-red-100 text-red-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight">Failed</span>
                                    ) : (
                                        <span className="bg-blue-100 text-blue-700 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-tight animate-pulse">Running</span>
                                    )}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}

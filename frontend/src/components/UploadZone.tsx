"use client";

import React, { useState, useRef } from 'react';
import { Upload, FileText, X, AlertCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface UploadZoneProps {
    onUpload: (file: File) => void;
    isUploading: boolean;
}

export default function UploadZone({ onUpload, isUploading }: UploadZoneProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = () => {
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            validateAndSetFile(files[0]);
        }
    };

    const validateAndSetFile = (file: File) => {
        const name = file.name.toLowerCase();
        if (name.endsWith('.csv') || name.endsWith('.xlsx') || name.endsWith('.xls')) {
            setSelectedFile(file);
        } else {
            alert("Please upload a CSV or Excel file.");
        }
    };

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (files && files.length > 0) {
            validateAndSetFile(files[0]);
        }
    };

    const clearFile = () => {
        setSelectedFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    return (
        <div className="w-full max-w-3xl mx-auto">
            <div
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                    relative group overflow-hidden border-2 border-dashed rounded-3xl p-12 transition-all duration-500
                    ${isDragging ? 'border-blue-500 bg-blue-50/50' : 'border-slate-200 bg-white hover:border-slate-300'}
                    ${isUploading ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
                `}
                onClick={() => !isUploading && fileInputRef.current?.click()}
            >
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleFileSelect}
                    accept=".csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
                    className="hidden"
                    disabled={isUploading}
                />

                <AnimatePresence mode="wait">
                    {selectedFile ? (
                        <motion.div
                            key="selected"
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9 }}
                            className="flex flex-col items-center"
                        >
                            <div className="w-20 h-20 bg-blue-100 rounded-2xl flex items-center justify-center text-blue-600 mb-6 shadow-sm">
                                <FileText size={40} />
                            </div>
                            <h3 className="text-2xl font-bold text-slate-900 mb-1">{selectedFile.name}</h3>
                            <p className="text-slate-400 font-medium mb-8">{(selectedFile.size / 1024).toFixed(1)} KB • Ready to Scrape</p>

                            <div className="flex gap-4">
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        onUpload(selectedFile);
                                    }}
                                    disabled={isUploading}
                                    className="bg-blue-600 text-white px-10 py-4 rounded-xl font-bold shadow-xl shadow-blue-200 hover:bg-blue-700 hover:-translate-y-1 active:translate-y-0 transition-all text-sm uppercase tracking-wide"
                                >
                                    {isUploading ? "Processing..." : "Start Extracting"}
                                </button>

                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        clearFile();
                                    }}
                                    className="bg-white text-slate-400 p-4 rounded-xl border border-slate-200 hover:text-red-500 hover:border-red-100 hover:bg-red-50 transition-all"
                                >
                                    <X size={20} />
                                </button>
                            </div>
                        </motion.div>
                    ) : (
                        <motion.div
                            key="idle"
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            className="flex flex-col items-center"
                        >
                            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mb-8 border border-slate-100 group-hover:scale-110 group-hover:bg-blue-50 group-hover:text-blue-400 transition-all duration-500">
                                <Upload size={44} />
                            </div>
                            <h2 className="text-3xl font-extrabold text-slate-900 mb-4 tracking-tight">Drop your File here</h2>
                            <p className="text-slate-500 font-medium mb-10 max-w-sm">Upload a CSV or Excel sheet with reel links to instantly extract metrics.</p>

                            <div className="flex items-center gap-2 px-6 py-2 bg-slate-100 rounded-full text-[11px] font-bold text-slate-500 uppercase tracking-widest">
                                <AlertCircle size={14} className="text-slate-400" />
                                Support for up to 500 links
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </div>
    );
}

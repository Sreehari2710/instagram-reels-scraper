"use client";

import React, { useState, useEffect } from 'react';
import { X, Settings, Database, Activity, Save, Loader2, CheckCircle2, AlertCircle, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

interface SettingsModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export default function SettingsModal({ isOpen, onClose }: SettingsModalProps) {
    const [settings, setSettings] = useState({
        request_delay: 5
    });
    const [isSaving, setIsSaving] = useState(false);
    const [isTesting, setIsTesting] = useState(false);
    const [testResult, setTestResult] = useState<{ status: string, message: string } | null>(null);

    useEffect(() => {
        if (isOpen) {
            fetchConfig();
        }
    }, [isOpen]);

    const fetchConfig = async () => {
        try {
            const response = await axios.get(`${API_BASE_URL}/config`);
            setSettings({
                request_delay: response.data.request_delay || 5
            });
        } catch (error) {
            console.error("Failed to fetch config", error);
        }
    };

    const handleSave = async () => {
        setIsSaving(true);
        try {
            await axios.post(`${API_BASE_URL}/config`, settings);
            setTestResult({ status: 'success', message: 'Settings saved! Try testing now.' });
        } catch (error) {
            setTestResult({ status: 'failed', message: 'Failed to save settings.' });
        } finally {
            setIsSaving(false);
        }
    };

    const handleTest = async () => {
        setIsTesting(true);
        setTestResult(null);
        try {
            const response = await axios.get(`${API_BASE_URL}/test-apify`);
            setTestResult(response.data);
        } catch (error) {
            setTestResult({ status: 'failed', message: 'API connection error.' });
        } finally {
            setIsTesting(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, y: 20 }}
                        animate={{ scale: 1, y: 0 }}
                        exit={{ scale: 0.9, y: 20 }}
                        className="neo-box bg-white w-full max-w-lg relative z-10 overflow-hidden"
                    >
                        {/* Header */}
                        <div className="bg-neo-cyan border-b-4 border-neo-border p-4 flex items-center justify-between">
                            <div className="flex items-center gap-2 font-black uppercase text-xl">
                                <Settings size={24} /> PRO CONFIGURATION
                            </div>
                            <button onClick={onClose} className="neo-button bg-white p-1 hover:bg-neo-pink">
                                <X size={20} />
                            </button>
                        </div>

                        <div className="p-6 max-h-[75vh] overflow-y-auto">
                            <div className="mb-4 neo-box p-4 bg-neo-cyan/5 border-l-4 border-neo-cyan">
                                <p className="font-black uppercase text-xs mb-1">Status: Operational</p>
                                <p className="text-[10px] font-bold opacity-60">
                                    The system is currently using a global Apify token managed via environment variables.
                                </p>
                            </div>

                            {/* Delay */}
                            <div className="mb-6">
                                <label className="block font-black uppercase text-xs mb-1 flex items-center gap-2">
                                    <Clock size={14} /> Delay: {settings.request_delay}s
                                </label>
                                <input
                                    type="range"
                                    min="3"
                                    max="60"
                                    value={settings.request_delay}
                                    onChange={(e) => setSettings({ ...settings, request_delay: parseInt(e.target.value) })}
                                    className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-black"
                                />
                                <div className="flex justify-between text-[10px] font-black mt-1 uppercase">
                                    <span>Fast (3s)</span>
                                    <span>Safe (60s)</span>
                                </div>
                            </div>

                            {testResult && (
                                <div className={`neo-box p-4 mb-6 flex items-start gap-3 ${testResult.status === 'success' ? 'bg-neo-green' : 'bg-neo-pink'}`}>
                                    {testResult.status === 'success' ? <CheckCircle2 size={24} /> : <AlertCircle size={24} />}
                                    <div>
                                        <p className="font-black uppercase text-xs">
                                            {testResult.status === 'success' ? 'Ready' :
                                                testResult.message.includes('Block') ? 'Block Detected' : 'Error'}
                                        </p>
                                        <p className="text-sm font-bold">{testResult.message}</p>
                                    </div>
                                </div>
                            )}

                            <div className="flex gap-4">
                                <button
                                    onClick={handleSave}
                                    disabled={isSaving}
                                    className="flex-1 neo-button bg-neo-yellow p-3 font-black flex items-center justify-center gap-2"
                                >
                                    {isSaving ? <Loader2 className="animate-spin" size={20} /> : <Save size={20} />}
                                    SAVE
                                </button>
                                <button
                                    onClick={handleTest}
                                    disabled={isTesting}
                                    className="flex-1 neo-button bg-neo-cyan p-3 font-black flex items-center justify-center gap-2 "
                                >
                                    {isTesting ? <Loader2 className="animate-spin" size={20} /> : <Activity size={20} />}
                                    TEST CONFIG
                                </button>
                            </div>
                        </div>

                        <div className="bg-neo-cyan/10 p-4 border-t-4 border-neo-border text-[9px] font-bold opacity-80 uppercase text-center">
                            Powered by Apify Cloud. No local browser or session ID required.
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}

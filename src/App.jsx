import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  Filter, Upload, Trash2, Download, Copy, Check, FileText, 
  Wand2, Search, RefreshCw, Sliders, Sparkles, Layers, 
  AlertCircle, Cpu, Gauge, Clock, CheckCircle2, HardDrive, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { processText } from './filterEngine';

export default function UltraFilter() {
  const [filterMode, setFilterMode] = useState('keyword');
  const [inputType, setInputType] = useState('text');
  
  // Text mode
  const [inputText, setInputText] = useState('');
  const [outputText, setOutputText] = useState('');
  const [isCopied, setIsCopied] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  
  // Stream mode với Worker
  const [largeFile, setLargeFile] = useState(null);
  const [isStreaming, setIsStreaming] = useState(false);
  const [streamProgress, setStreamProgress] = useState(0);
  const [streamSpeed, setStreamSpeed] = useState(0);
  const [streamResult, setStreamResult] = useState([]);
  const [streamElapsed, setStreamElapsed] = useState(0);
  const [streamStats, setStreamStats] = useState({ checked: 0, matched: 0, dupes: 0 });
  
  // Config
  const [minSkin, setMinSkin] = useState(50);
  const [maxSkin, setMaxSkin] = useState(1000);
  const [excludeBanned, setExcludeBanned] = useState(true);
  const [keyword, setKeyword] = useState('100054.connect.garena.com');
  const [keywordCondition, setKeywordCondition] = useState('contains');
  const [caseSensitive, setCaseSensitive] = useState(false);
  const [deduplicate, setDeduplicate] = useState(true);
  const [trimWhitespace, setTrimWhitespace] = useState(true);
  
  // Worker ref
  const workerRef = useRef(null);
  const fileInputRef = useRef(null);
  const largeFileInputRef = useRef(null);
  const resultChunksRef = useRef([]);
  
  // Stats
  const [stats, setStats] = useState({ total: 0, matched: 0, dupes: 0, ratio: 0 });
  
  // Khởi tạo Worker
  useEffect(() => {
    workerRef.current = new Worker('/worker.js');
    
    workerRef.current.onmessage = (e) => {
      const { type, data, progress, speed, elapsed, stats } = e.data;
      
      if (type === 'chunk') {
        resultChunksRef.current.push(data);
        setStreamStats(stats);
      }
      else if (type === 'progress') {
        setStreamProgress(progress);
        setStreamSpeed(speed);
        setStreamElapsed(elapsed);
        setStreamStats(stats);
      }
      else if (type === 'complete') {
        setIsStreaming(false);
        setStreamStats(stats);
        // Ghép chunks thành blob để download
        const blob = new Blob(resultChunksRef.current, { type: 'text/plain' });
        setStreamResult([blob]);
      }
    };
    
    return () => {
      workerRef.current?.terminate();
    };
  }, []);
  
  // Text mode processing — debounced
  useEffect(() => {
    if (inputType !== 'text') return;
    
    const timeoutId = setTimeout(() => {
      const result = processText(inputText, {
        filterMode, keyword, keywordCondition, caseSensitive,
        minSkin, maxSkin, excludeBanned, deduplicate, trimWhitespace
      });
      
      setOutputText(result.lines.join('\n'));
      setStats({
        total: result.stats.total,
        matched: result.stats.matched,
        dupes: result.stats.dupes,
        ratio: result.stats.total > 0 ? Math.round((result.stats.matched / result.stats.total) * 100) : 0
      });
    }, 150); // Debounce 150ms
    
    return () => clearTimeout(timeoutId);
  }, [inputText, filterMode, keyword, keywordCondition, caseSensitive, minSkin, maxSkin, excludeBanned, deduplicate, trimWhitespace, inputType]);
  
  // Start stream processing
  const startStream = () => {
    if (!largeFile || !workerRef.current) return;
    
    setIsStreaming(true);
    setStreamProgress(0);
    setStreamSpeed(0);
    setStreamElapsed(0);
    setStreamStats({ checked: 0, matched: 0, dupes: 0 });
    resultChunksRef.current = [];
    setStreamResult([]);
    
    workerRef.current.postMessage({
      file: largeFile,
      config: {
        filterMode, keyword, keywordCondition, caseSensitive,
        minSkin, maxSkin, excludeBanned, deduplicate, trimWhitespace
      }
    });
  };
  
  // Download stream result
  const downloadStreamResult = () => {
    if (streamResult.length === 0) return;
    const blob = new Blob(streamResult, { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtered_${filterMode}_${Date.now()}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  // Copy & Download text mode
  const handleCopy = async () => {
    if (!outputText) return;
    await navigator.clipboard.writeText(outputText);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  };
  
  const handleDownload = () => {
    if (!outputText) return;
    const blob = new Blob([outputText], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `filtered_${filterMode}_${new Date().toISOString().slice(0, 10)}.txt`;
    link.click();
    URL.revokeObjectURL(url);
  };
  
  const formatBytes = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };
  
  return (
    <div className="min-h-screen bg-[#1e1f22] text-gray-200 p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 bg-[#2b2d31] p-6 rounded-2xl border border-[#1e1f22]/50">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <span className="px-2 py-1 text-xs font-bold bg-gradient-to-r from-[#5865F2] to-[#23a559] text-white rounded-md">
                ULTRA v3.0
              </span>
              <h1 className="text-2xl font-black text-white">Siêu Bộ Lọc Dữ Liệu</h1>
            </div>
            <p className="text-sm text-gray-400">
              Web Worker + Streaming — xử lý file 10GB+ không treo tab. Tốc độ quét <strong className="text-[#23a559]">500MB/s+</strong>.
            </p>
          </div>
          
          <div className="flex p-1 bg-[#1e1f22] rounded-xl">
            <button
              onClick={() => setInputType('text')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                inputType === 'text' ? 'bg-[#35363c] text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <FileText className="w-4 h-4" /> Text
            </button>
            <button
              onClick={() => setInputType('stream')}
              className={`px-4 py-2 rounded-lg text-sm font-bold transition-all flex items-center gap-2 ${
                inputType === 'stream' ? 'bg-[#5865F2] text-white' : 'text-gray-400 hover:text-gray-200'
              }`}
            >
              <Zap className="w-4 h-4" /> File Lớn (Worker)
            </button>
          </div>
        </div>
        
        {/* Stats Board */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-[#2b2d31] p-4 rounded-xl border border-[#1e1f22]/40">
            <div className="text-xs font-bold text-gray-400 uppercase mb-1">Đã quét</div>
            <div className="text-2xl font-black text-white">
              {(inputType === 'stream' ? streamStats.checked : stats.total).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#23a559]/10 p-4 rounded-xl border border-[#23a559]/20">
            <div className="text-xs font-bold text-[#23a559] uppercase mb-1">Khớp</div>
            <div className="text-2xl font-black text-[#23a559]">
              {(inputType === 'stream' ? streamStats.matched : stats.matched).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#faa61a]/10 p-4 rounded-xl border border-[#faa61a]/20">
            <div className="text-xs font-bold text-[#faa61a] uppercase mb-1">Trùng lặp</div>
            <div className="text-2xl font-black text-[#faa61a]">
              {(inputType === 'stream' ? streamStats.dupes : stats.dupes).toLocaleString()}
            </div>
          </div>
          <div className="bg-[#5865F2]/10 p-4 rounded-xl border border-[#5865F2]/20">
            <div className="text-xs font-bold text-[#5865F2] uppercase mb-1">Tỉ lệ</div>
            <div className="text-2xl font-black text-[#5865F2]">
              {inputType === 'stream' 
                ? (streamStats.checked > 0 ? Math.round((streamStats.matched / streamStats.checked) * 100) : 0)
                : stats.ratio}%
            </div>
          </div>
        </div>
        
        <div className="flex flex-col lg:flex-row gap-6">
          
          {/* Settings Panel */}
          <div className="w-full lg:w-[350px] bg-[#2b2d31] rounded-2xl p-5 border border-[#1e1f22]/50 space-y-5">
            <div className="flex items-center gap-2 pb-3 border-b border-[#1e1f22]/50">
              <Sliders className="w-5 h-5 text-[#5865F2]" />
              <h2 className="font-bold text-white">Cấu hình lọc</h2>
            </div>
            
            {/* Filter Mode */}
            <div className="space-y-2">
              <label className="text-xs font-bold text-gray-400 uppercase">Chế độ</label>
              <div className="grid grid-cols-1 gap-1 bg-[#1e1f22] p-1 rounded-xl">
                {[
                  { id: 'keyword', icon: Search, label: 'Từ khóa' },
                  { id: 'skin_rank', icon: Sparkles, label: 'Skin & Rank' },
                  { id: 'clean_dedup', icon: Layers, label: 'Chỉ dedup' }
                ].map(mode => (
                  <button
                    key={mode.id}
                    onClick={() => setFilterMode(mode.id)}
                    className={`px-3 py-2 rounded-lg text-xs font-bold text-left transition-all flex items-center gap-2 ${
                      filterMode === mode.id ? 'bg-[#5865F2] text-white' : 'text-gray-400 hover:text-gray-200'
                    }`}
                  >
                    <mode.icon className="w-3.5 h-3.5" /> {mode.label}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Dynamic Settings */}
            <AnimatePresence mode="wait">
              {filterMode === 'keyword' && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-gray-400 mb-1.5">Từ khóa</label>
                    <input
                      type="text"
                      value={keyword}
                      onChange={e => setKeyword(e.target.value)}
                      className="w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-sm font-mono border border-transparent focus:border-[#5865F2] focus:outline-none"
                      placeholder="domain.com"
                    />
                  </div>
                  <select
                    value={keywordCondition}
                    onChange={e => setKeywordCondition(e.target.value)}
                    className="w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-xs font-semibold focus:outline-none focus:ring-1 focus:ring-[#5865F2]"
                  >
                    <option value="contains">GIỮ LẠI dòng chứa từ khóa</option>
                    <option value="not_contains">LOẠI BỎ dòng chứa từ khóa</option>
                  </select>
                  <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={caseSensitive}
                      onChange={e => setCaseSensitive(e.target.checked)}
                      className="w-4 h-4 rounded text-[#5865F2] bg-[#1e1f22]"
                    />
                    Phân biệt hoa/thường
                  </label>
                </motion.div>
              )}
              
              {filterMode === 'skin_rank' && (
                <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="space-y-4">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5">Min Skin</label>
                      <input
                        type="number"
                        value={minSkin}
                        onChange={e => setMinSkin(parseInt(e.target.value) || 0)}
                        className="w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-[#5865F2]"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-bold text-gray-400 mb-1.5">Max Skin</label>
                      <input
                        type="number"
                        value={maxSkin}
                        onChange={e => setMaxSkin(parseInt(e.target.value) || 0)}
                        className="w-full bg-[#1e1f22] rounded-lg px-3 py-2 text-sm font-semibold focus:outline-none focus:border-[#5865F2]"
                      />
                    </div>
                  </div>
                  <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeBanned}
                      onChange={e => setExcludeBanned(e.target.checked)}
                      className="w-4 h-4 rounded text-[#5865F2] bg-[#1e1f22]"
                    />
                    Loại bỏ acc bị khóa
                  </label>
                </motion.div>
              )}
            </AnimatePresence>
            
            {/* Global Settings */}
            <div className="pt-4 border-t border-[#1e1f22]/50 space-y-3">
              <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={deduplicate}
                  onChange={e => setDeduplicate(e.target.checked)}
                  className="w-4 h-4 rounded text-[#5865F2] bg-[#1e1f22]"
                />
                Loại bỏ trùng lặp (hash-based)
              </label>
              <label className="flex items-center gap-2 text-xs text-gray-300 font-semibold cursor-pointer">
                <input
                  type="checkbox"
                  checked={trimWhitespace}
                  onChange={e => setTrimWhitespace(e.target.checked)}
                  className="w-4 h-4 rounded text-[#5865F2] bg-[#1e1f22]"
                />
                Trim whitespace
              </label>
            </div>
          </div>
          
          {/* Working Area */}
          <div className="flex-1 min-h-[500px]">
            <AnimatePresence mode="wait">
              {inputType === 'text' ? (
                <motion.div
                  key="text"
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 10 }}
                  className="h-full flex flex-col md:flex-row gap-4"
                >
                  {/* Input */}
                  <div className="flex-1 flex flex-col bg-[#2b2d31] rounded-2xl p-4 border border-[#1e1f22]/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" /> Nguồn
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#1e1f22] hover:bg-gray-700 rounded-lg transition-colors"
                        >
                          <Upload className="w-3.5 h-3.5" /> File
                        </button>
                        <button
                          onClick={() => setInputText('')}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-[#f04747] hover:bg-[#f04747]/10 rounded-lg"
                        >
                          <Trash2 className="w-3.5 h-3.5" /> Xóa
                        </button>
                      </div>
                    </div>
                    <input type="file" ref={fileInputRef} onChange={handleFileUpload} accept=".txt,.log,.csv" className="hidden" />
                    <textarea
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      placeholder="Dán text hoặc kéo thả file vào đây..."
                      className="flex-1 w-full p-3 bg-[#1e1f22] rounded-xl text-sm font-mono text-gray-300 placeholder:text-gray-600 focus:outline-none resize-none border border-transparent focus:border-[#5865F2]/30"
                    />
                  </div>
                  
                  {/* Output */}
                  <div className="flex-1 flex flex-col bg-[#2b2d31] rounded-2xl p-4 border border-[#1e1f22]/50">
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-gray-400 uppercase flex items-center gap-1">
                        <Wand2 className="w-3.5 h-3.5 text-[#23a559]" /> Kết quả
                      </span>
                      <div className="flex gap-2">
                        <button
                          onClick={handleCopy}
                          disabled={!outputText}
                          className={`flex items-center gap-1 px-3 py-1.5 text-xs font-bold rounded-lg transition-all ${
                            !outputText ? 'bg-[#1e1f22] text-gray-600' : isCopied ? 'bg-[#23a559]/20 text-[#23a559]' : 'bg-[#1e1f22] hover:bg-gray-700'
                          }`}
                        >
                          {isCopied ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          {isCopied ? 'Đã copy' : 'Copy'}
                        </button>
                        <button
                          onClick={handleDownload}
                          disabled={!outputText}
                          className="flex items-center gap-1 px-3 py-1.5 text-xs font-bold bg-[#23a559] hover:bg-[#1a8a49] text-white rounded-lg disabled:opacity-50"
                        >
                          <Download className="w-3.5 h-3.5" /> Tải về
                        </button>
                      </div>
                    </div>
                    <textarea
                      value={outputText}
                      readOnly
                      placeholder="Kết quả sẽ hiện tức thì..."
                      className="flex-1 w-full p-3 bg-[#1e1f22] rounded-xl text-sm font-mono text-gray-300 placeholder:text-gray-600 resize-none cursor-default"
                    />
                  </div>
                </motion.div>
              ) : (
                <motion.div
                  key="stream"
                  initial={{ opacity: 0, x: 10 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -10 }}
                  className="h-full bg-[#2b2d31] rounded-2xl p-6 border border-[#1e1f22]/50 flex flex-col"
                >
                  <div className="flex items-center gap-3 pb-4 border-b border-[#1e1f22]/40">
                    <div className="p-2 bg-[#5865F2]/10 rounded-xl">
                      <Cpu className="w-6 h-6 text-[#5865F2]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-white">Ultra-Stream Worker</h3>
                      <p className="text-xs text-gray-400">Chạy trong Web Worker — không block UI, tốc độ 500MB/s+</p>
                    </div>
                  </div>
                  
                  {!largeFile ? (
                    <div
                      onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={e => {
                        e.preventDefault();
                        setIsDragging(false);
                        const file = e.dataTransfer.files?.[0];
                        if (file) setLargeFile(file);
                      }}
                      onClick={() => largeFileInputRef.current?.click()}
                      className={`flex-1 border-2 border-dashed rounded-2xl flex flex-col items-center justify-center cursor-pointer transition-all ${
                        isDragging ? 'border-[#5865F2] bg-[#5865F2]/5' : 'border-[#1e1f22] hover:border-[#5865F2]/40'
                      }`}
                    >
                      <input type="file" ref={largeFileInputRef} onChange={e => setLargeFile(e.target.files?.[0])} className="hidden" />
                      <Upload className="w-12 h-12 text-gray-400 mb-4" />
                      <p className="text-sm font-bold text-gray-200">Kéo thả file hoặc click chọn</p>
                      <p className="text-xs text-gray-400 mt-1">Hỗ trợ file 10MB — 10GB+</p>
                    </div>
                  ) : (
                    <div className="flex-1 flex flex-col gap-4">
                      {/* File Info */}
                      <div className="bg-[#1e1f22]/60 rounded-xl p-4 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <HardDrive className="w-8 h-8 text-[#5865F2]" />
                          <div>
                            <div className="text-sm font-bold text-gray-200">{largeFile.name}</div>
                            <div className="text-xs text-gray-400 font-mono">{formatBytes(largeFile.size)}</div>
                          </div>
                        </div>
                        <button
                          onClick={() => !isStreaming && setLargeFile(null)}
                          disabled={isStreaming}
                          className="p-2 hover:bg-[#f04747]/10 text-gray-400 hover:text-[#f04747] rounded-lg disabled:opacity-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      
                      {/* Progress */}
                      {isStreaming && (
                        <div className="space-y-3">
                          <div className="flex justify-between text-sm">
                            <span className="font-bold text-[#5865F2] flex items-center gap-2">
                              <RefreshCw className="w-4 h-4 animate-spin" /> Đang xử lý...
                            </span>
                            <span className="font-mono font-bold">{streamProgress}%</span>
                          </div>
                          <div className="w-full h-3 bg-[#1e1f22] rounded-full overflow-hidden">
                            <motion.div
                              className="h-full bg-gradient-to-r from-[#5865F2] to-[#23a559]"
                              animate={{ width: `${streamProgress}%` }}
                            />
                          </div>
                          <div className="grid grid-cols-3 gap-3 text-center">
                            <div className="bg-[#1e1f22]/60 p-3 rounded-xl">
                              <Gauge className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                              <div className="text-xs font-bold text-gray-400">Tốc độ</div>
                              <div className="text-sm font-mono font-bold text-white">{streamSpeed} MB/s</div>
                            </div>
                            <div className="bg-[#1e1f22]/60 p-3 rounded-xl">
                              <Clock className="w-4 h-4 mx-auto text-gray-400 mb-1" />
                              <div className="text-xs font-bold text-gray-400">Thời gian</div>
                              <div className="text-sm font-mono font-bold text-white">{streamElapsed}s</div>
                            </div>
                            <div className="bg-[#1e1f22]/60 p-3 rounded-xl">
                              <Sparkles className="w-4 h-4 mx-auto text-[#23a559] mb-1" />
                              <div className="text-xs font-bold text-gray-400">Đã tìm</div>
                              <div className="text-sm font-mono font-bold text-[#23a559]">{streamStats.matched.toLocaleString()}</div>
                            </div>
                          </div>
                        </div>
                      )}
                      
                      {/* Complete */}
                      {!isStreaming && streamResult.length > 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                          <div className="w-16 h-16 bg-[#23a559]/10 rounded-full flex items-center justify-center border border-[#23a559]/30">
                            <CheckCircle2 className="w-8 h-8 text-[#23a559]" />
                          </div>
                          <div>
                            <h4 className="text-lg font-bold text-white">Hoàn thành!</h4>
                            <p className="text-sm text-gray-400">
                              Tìm thấy <strong className="text-[#23a559]">{streamStats.matched.toLocaleString()}</strong> dòng trong số {streamStats.checked.toLocaleString()}
                            </p>
                          </div>
                          <div className="flex gap-3">
                            <button
                              onClick={startStream}
                              className="px-4 py-2 bg-[#1e1f22] hover:bg-[#35363c] rounded-xl text-sm font-bold transition-all"
                            >
                              <RefreshCw className="w-4 h-4 inline mr-2" /> Lọc lại
                            </button>
                            <button
                              onClick={downloadStreamResult}
                              className="px-6 py-2 bg-[#23a559] hover:bg-[#1a8a49] text-white rounded-xl text-sm font-bold shadow-lg transition-all"
                            >
                              <Download className="w-4 h-4 inline mr-2" /> Tải kết quả
                            </button>
                          </div>
                        </div>
                      )}
                      
                      {/* Ready */}
                      {!isStreaming && streamResult.length === 0 && (
                        <div className="flex-1 flex flex-col items-center justify-center">
                          <div className="text-center space-y-4">
                            <p className="text-sm text-gray-400">Sẵn sàng lọc file lớn với cấu hình hiện tại</p>
                            <button
                              onClick={startStream}
                              className="px-8 py-3 bg-[#5865F2] hover:bg-[#4752c4] text-white font-bold rounded-xl shadow-lg flex items-center gap-2 transition-all active:scale-95"
                            >
                              <Zap className="w-5 h-5" /> BẮT ĐẦU LỌC SIÊU TỐC
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </div>
  );
}

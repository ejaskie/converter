'use client';

import { useState, useRef, useEffect } from 'react';

const MAX_DAILY_LIMIT = 5;

const formats = {
  image: ['PNG', 'JPG', 'WEBP'],
  document: ['PDF', 'DOCX', 'TXT', 'PPTX', 'XLSX']
};

export default function KonvertPage() {
  const [appMode, setAppMode] = useState<'image' | 'document'>('image');
  const [stage, setStage] = useState<'drop' | 'options' | 'working' | 'result'>('drop');

  const [currentFile, setCurrentFile] = useState<File | null>(null);
  const [targetFormat, setTargetFormat] = useState<string>('');

  const [convertedBlobUrl, setConvertedBlobUrl] = useState<string | null>(null);
  const [convertedFileName, setConvertedFileName] = useState<string>('');

  const [errorMsg, setErrorMsg] = useState<string>('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [progress, setProgress] = useState(0);

  const [showModal, setShowModal] = useState(false);
  const [usageCount, setUsageCount] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Ambil data limit dari Local Storage saat komponen dimuat
  useEffect(() => {
    const today = new Date().toLocaleDateString('id-ID');
    const lastUsedDate = localStorage.getItem('konversi_last_date');
    let count = parseInt(localStorage.getItem('konversi_usage_count') || '0');

    if (lastUsedDate !== today) {
      count = 0;
      localStorage.setItem('konversi_last_date', today);
    }
    setUsageCount(count);
  }, []);

  const resetApp = () => {
    setErrorMsg('');
    setCurrentFile(null);
    setTargetFormat('');
    if (convertedBlobUrl) {
      URL.revokeObjectURL(convertedBlobUrl);
      setConvertedBlobUrl(null);
    }
    if (fileInputRef.current) fileInputRef.current.value = '';
    setStage('drop');
  };

  const handleModeChange = (mode: 'image' | 'document') => {
    setAppMode(mode);
    resetApp();
  };

  const handleFileSelection = (file: File) => {
    setErrorMsg('');
    if (appMode === 'image' && !file.type.startsWith('image/')) {
      setErrorMsg('Harap unggah file gambar.');
      return;
    }

    setCurrentFile(file);
    const availableFormats = formats[appMode];
    const ext = file.name.split('.').pop()?.toUpperCase() || '';

    let defaultFormat = availableFormats[0];
    if (ext === defaultFormat && availableFormats.length > 1) {
      defaultFormat = availableFormats[1];
    }
    setTargetFormat(defaultFormat);
    setStage('options');
  };

  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFileSelection(e.dataTransfer.files[0]);
    }
  };

  const processImageConversion = (): Promise<void> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          canvas.width = img.width; canvas.height = img.height;
          const ctx = canvas.getContext('2d');
          if (targetFormat === 'JPG' && ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
          }
          ctx?.drawImage(img, 0, 0);

          let mimeType = 'image/png'; let ext = 'png';
          if (targetFormat === 'JPG') { mimeType = 'image/jpeg'; ext = 'jpg'; }
          if (targetFormat === 'WEBP') { mimeType = 'image/webp'; ext = 'webp'; }

          canvas.toBlob((blob) => {
            if (!blob) return reject(new Error('Canvas error.'));
            setConvertedBlobUrl(URL.createObjectURL(blob));
            setConvertedFileName(`${currentFile!.name.replace(/\.[^/.]+$/, "")}-converted.${ext}`);
            resolve();
          }, mimeType, 0.95);
        };
        img.onerror = () => reject(new Error('Gambar tidak valid.'));
        if (e.target?.result) img.src = e.target.result as string;
      };
      reader.readAsDataURL(currentFile!);
    });
  };

  const processDocumentAPI = async () => {
    const fromFormat = currentFile!.name.split('.').pop()!.toLowerCase();
    const toFormat = targetFormat.toLowerCase();

    const formData = new FormData();
    formData.append('File', currentFile!);
    formData.append('fromFormat', fromFormat);
    formData.append('toFormat', toFormat);

    const response = await fetch('/api/convert', { method: 'POST', body: formData });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.error || "Kesalahan API eksternal.");
    }

    const fileResult = data.Files[0];
    if (fileResult.FileData) {
      const byteCharacters = atob(fileResult.FileData);
      const byteNumbers = new Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "application/octet-stream" });

      setConvertedBlobUrl(URL.createObjectURL(blob));
      setConvertedFileName(fileResult.FileName);
    } else {
      throw new Error("Gagal membaca hasil konversi dari server.");
    }
  };

  const startConversion = async () => {
    if (usageCount >= MAX_DAILY_LIMIT) {
      setErrorMsg(`<b>Limit Harian Tercapai!</b> Anda sudah mengonversi ${MAX_DAILY_LIMIT} file hari ini. Silakan coba lagi besok atau <a href="https://wa.me/6289694309642" target="_blank">Hubungi Admin</a>.`);
      return;
    }

    setErrorMsg('');
    setStage('working');

    let currentProgress = 10;
    setProgress(currentProgress);

    const progressInterval = setInterval(() => {
      currentProgress += (90 - currentProgress) * 0.1;
      setProgress(currentProgress);
    }, 150);

    try {
      if (appMode === 'image') {
        await processImageConversion();
      } else {
        await processDocumentAPI();
      }

      const newCount = usageCount + 1;
      setUsageCount(newCount);
      localStorage.setItem('konversi_usage_count', newCount.toString());

      clearInterval(progressInterval);
      setProgress(100);

      setTimeout(() => {
        setStage('result');
      }, 500);
    } catch (err: any) {
      clearInterval(progressInterval);
      setErrorMsg(`Gagal: ${err.message}`);
      setStage('options');
    }
  };

  const executeFinalDownload = () => {
    if (!convertedBlobUrl) return;
    setShowModal(false);

    const a = document.createElement('a');
    a.href = convertedBlobUrl;
    a.download = convertedFileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <>
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700&family=Inter:wght@400;500;600&family=JetBrains+Mono:wght@400;500&display=swap" rel="stylesheet" />

      <div className="wrap">
        <header>
          <div className="eyebrow">Alat Utilitas Digital</div>
          <h1>Ubah format file. <span>Cepat</span> & praktis.</h1>
          <p className="sub">Konversi gambar (Lokal) dan dokumen (Cloud API) Anda secara langsung tanpa perlu menginstal aplikasi tambahan.</p>
          <a href="https://saweria.co/ejaskie" target="_blank" rel="noreferrer" className="saweria-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
              <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
              <line x1="6" y1="1" x2="6" y2="4"></line>
              <line x1="10" y1="1" x2="10" y2="4"></line>
              <line x1="14" y1="1" x2="14" y2="4"></line>
            </svg>
            Dukung KONVER
          </a>
        </header>

        <div className="stage">

          {(stage === 'drop' || stage === 'options') && (
            <div className="mode-tabs">
              <button className={`mode-tab ${appMode === 'image' ? 'active' : ''}`} onClick={() => handleModeChange('image')}>🖼️ Konversi Gambar</button>
              <button className={`mode-tab ${appMode === 'document' ? 'active' : ''}`} onClick={() => handleModeChange('document')}>📄 Konversi Dokumen</button>
            </div>
          )}

          <div className="corner tl"><svg viewBox="0 0 16 16" fill="none"><path d="M0 0H16M0 0V16" stroke="currentColor" strokeWidth="1.5" /></svg></div>
          <div className="corner tr"><svg viewBox="0 0 16 16" fill="none"><path d="M0 0H16M0 0V16" stroke="currentColor" strokeWidth="1.5" /></svg></div>
          <div className="corner bl"><svg viewBox="0 0 16 16" fill="none"><path d="M0 0H16M0 0V16" stroke="currentColor" strokeWidth="1.5" /></svg></div>
          <div className="corner br"><svg viewBox="0 0 16 16" fill="none"><path d="M0 0H16M0 0V16" stroke="currentColor" strokeWidth="1.5" /></svg></div>

          {/* Area Upload */}
          <div
            className={`dropzone ${isDragOver ? 'dragover' : ''}`}
            style={{ display: stage === 'drop' ? 'flex' : 'none' }}
            onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(true); }}
            onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setIsDragOver(false); }}
            onDrop={onDrop}
            onClick={() => fileInputRef.current?.click()}
          >
            <div className="drop-icon">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6">
                <path d="M12 16V4M12 4L7 9M12 4l5 5" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M4 16v2a2 2 0 002 2h12a2 2 0 002-2v-2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <div className="drop-title">
              {appMode === 'image' ? 'Jatuhkan gambar di sini' : 'Jatuhkan dokumen di sini'}
            </div>
            <div className="drop-hint" dangerouslySetInnerHTML={{ __html: appMode === 'image' ? 'atau <b>klik untuk memilih</b> — JPG, PNG, WEBP' : 'atau <b>klik untuk memilih</b> — PDF, DOCX, TXT, PPTX, XLSX' }} />
            <input type="file" ref={fileInputRef} accept={appMode === 'image' ? 'image/*' : '.pdf,.doc,.docx,.txt,.pptx,.xlsx'} onChange={(e) => { if (e.target.files?.[0]) handleFileSelection(e.target.files[0]) }} />
          </div>

          {/* Pilihan Format */}
          <div className={`format-select ${stage === 'options' ? 'active' : ''}`}>
            {currentFile && (
              <>
                <div className="file-preview-box">
                  <div className="file-preview-name">{currentFile.name}</div>
                  <div className="file-preview-meta">{`${currentFile.type || 'Document'} · ${(currentFile.size / 1024).toFixed(1)} KB`}</div>
                </div>
                <div className="target-label">Pilih Format Hasil Konversi:</div>
                <div className="tool-options">
                  {formats[appMode].map(fmt => {
                    const ext = currentFile.name.split('.').pop()?.toUpperCase();
                    if (fmt === ext) return null;
                    return (
                      <button key={fmt} className={`tool-btn ${fmt === targetFormat ? 'active' : ''}`} onClick={() => setTargetFormat(fmt)}>
                        {fmt}
                      </button>
                    )
                  })}
                </div>
                <div className="actions" style={{ marginTop: '10px' }}>
                  <button className="action" onClick={resetApp}>Batal</button>
                  <button className="action primary" onClick={startConversion}>Mulai Konversi</button>
                </div>
              </>
            )}
          </div>

          {/* Progress Loading */}
          <div className={`working ${stage === 'working' ? 'active' : ''}`}>
            <div className="spinner"></div>
            <div className="working-label">Memproses konversi...</div>
            <div className="progress-track">
              <div className="progress-fill" style={{ width: `${progress}%` }}></div>
            </div>
          </div>

          {/* Halaman Berhasil */}
          <div className={`result ${stage === 'result' ? 'active' : ''}`}>
            <div className="success-icon">
              <svg fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path>
                <polyline points="22 4 12 14.01 9 11.01"></polyline>
              </svg>
            </div>
            <h2 className="result-title">Konversi Berhasil!</h2>
            <div className="result-meta">{`${convertedFileName} · Sisa limit harian: ${MAX_DAILY_LIMIT - usageCount}`}</div>
            <div className="actions">
              <button className="action" onClick={resetApp}>Konversi File Lain</button>
              <button className="action primary" onClick={() => setShowModal(true)}>Unduh File</button>
            </div>
          </div>
        </div>

        {/* Notifikasi Error */}
        <div className={`error-box ${errorMsg ? 'active' : ''}`} dangerouslySetInnerHTML={{ __html: errorMsg }}></div>

        {/* Footer & WhatsApp */}
        <div className="contact-admin">
          <p>Aplikasi error atau kuota habis?</p>
          <a href="https://wa.me/6289694309642" target="_blank" rel="noreferrer" className="wa-btn">
            <svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51a12.8 12.8 0 0 0-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413Z" />
            </svg>
            Hubungi Admin
          </a>
        </div>
        <footer>DIDUKUNG OLEH BROWSER ENGINE & CONVERTAPI</footer>
      </div>

      {/* Modal Unduh (Tetap Persis Sama) */}
      <div className={`modal-overlay ${showModal ? 'active' : ''}`} onClick={(e) => { if (e.target === e.currentTarget) setShowModal(false) }}>
        <div className="modal-content">
          <button className="close-modal" onClick={() => setShowModal(false)}>&times;</button>
          <h3>Terima Kasih Telah Menggunakan KONVER!</h3>
          <p>File Anda siap diunduh. Jika aplikasi ini membantu, mohon pertimbangkan untuk mendukung kami agar server ini tetap hidup dan gratis untuk semua orang. ☕</p>

          <div className="modal-actions">
            <a href="https://saweria.co/ejaskie" target="_blank" rel="noreferrer" className="action primary saweria-modal-btn">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 8h1a4 4 0 0 1 0 8h-1"></path>
                <path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"></path>
                <line x1="6" y1="1" x2="6" y2="4"></line>
                <line x1="10" y1="1" x2="10" y2="4"></line>
                <line x1="14" y1="1" x2="14" y2="4"></line>
              </svg>
              Dukung via Saweria
            </a>
            <button id="finalDownloadBtn" onClick={executeFinalDownload}>Selesaikan & Unduh File</button>
          </div>
        </div>
      </div>
    </>
  );
}
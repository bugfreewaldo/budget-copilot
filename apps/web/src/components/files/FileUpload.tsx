'use client';

import { useState, useCallback, useRef } from 'react';
import {
  createUploadUrls,
  completeUpload,
  uploadFileToS3,
  type UploadTarget,
} from '@/lib/api';
import { useToast } from '@/components/ui/toast';

const ALLOWED_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv',
];

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

interface UploadProgress {
  file: File;
  status: 'pending' | 'uploading' | 'processing' | 'done' | 'error';
  progress: number;
  error?: string;
  fileId?: string;
}

interface FileUploadProps {
  onUploadComplete?: (fileIds: string[]) => void;
  onClose?: () => void;
}

export function FileUpload({ onUploadComplete, onClose }: FileUploadProps) {
  const [files, setFiles] = useState<UploadProgress[]>([]);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { showToast } = useToast();

  const validateFile = (file: File): string | null => {
    if (!ALLOWED_TYPES.includes(file.type)) {
      return `Tipo de archivo no soportado: ${file.type}`;
    }
    if (file.size > MAX_FILE_SIZE) {
      return `Archivo muy grande (máx 10MB)`;
    }
    return null;
  };

  const addFiles = useCallback((newFiles: FileList | File[]) => {
    const fileArray = Array.from(newFiles);
    const validFiles: UploadProgress[] = [];

    for (const file of fileArray) {
      const error = validateFile(file);
      if (error) {
        showToast(`${file.name}: ${error}`, 'error');
      } else {
        validFiles.push({
          file,
          status: 'pending',
          progress: 0,
        });
      }
    }

    setFiles((prev) => [...prev, ...validFiles]);
  }, [showToast]);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragging(false);
      if (e.dataTransfer.files.length > 0) {
        addFiles(e.dataTransfer.files);
      }
    },
    [addFiles]
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files && e.target.files.length > 0) {
        addFiles(e.target.files);
      }
    },
    [addFiles]
  );

  const removeFile = useCallback((index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const uploadFiles = async () => {
    const pendingFiles = files.filter((f) => f.status === 'pending');
    if (pendingFiles.length === 0) return;

    setIsUploading(true);

    try {
      // Get pre-signed URLs
      const { uploadTargets } = await createUploadUrls(
        pendingFiles.map((f) => ({
          filename: f.file.name,
          mimeType: f.file.type,
          size: f.file.size,
        }))
      );

      // Upload each file
      const completedFiles: Array<{
        storageKey: string;
        originalName: string;
        mimeType: string;
        size: number;
      }> = [];

      for (let i = 0; i < pendingFiles.length; i++) {
        const fileProgress = pendingFiles[i]!;
        const target = uploadTargets[i]!;

        // Update status to uploading
        setFiles((prev) =>
          prev.map((f) =>
            f.file === fileProgress.file
              ? { ...f, status: 'uploading' as const, progress: 0 }
              : f
          )
        );

        try {
          // Upload to S3
          await uploadFileToS3(fileProgress.file, target.uploadUrl);

          // Update status to processing
          setFiles((prev) =>
            prev.map((f) =>
              f.file === fileProgress.file
                ? { ...f, status: 'processing' as const, progress: 100 }
                : f
            )
          );

          completedFiles.push({
            storageKey: target.storageKey,
            originalName: fileProgress.file.name,
            mimeType: fileProgress.file.type,
            size: fileProgress.file.size,
          });
        } catch (error) {
          setFiles((prev) =>
            prev.map((f) =>
              f.file === fileProgress.file
                ? {
                    ...f,
                    status: 'error' as const,
                    error:
                      error instanceof Error
                        ? error.message
                        : 'Error al subir',
                  }
                : f
            )
          );
        }
      }

      // Complete the upload
      if (completedFiles.length > 0) {
        const result = await completeUpload(completedFiles);

        // Update file statuses with IDs
        setFiles((prev) =>
          prev.map((f) => {
            const idx = completedFiles.findIndex(
              (cf) => cf.originalName === f.file.name
            );
            if (idx !== -1 && result.fileIds[idx]) {
              return {
                ...f,
                status: 'done' as const,
                fileId: result.fileIds[idx],
              };
            }
            return f;
          })
        );

        showToast(
          `${result.fileIds.length} archivo(s) subido(s) correctamente`,
          'success'
        );

        if (onUploadComplete) {
          onUploadComplete(result.fileIds);
        }
      }
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : 'Error al subir archivos',
        'error'
      );
    } finally {
      setIsUploading(false);
    }
  };

  const pendingCount = files.filter((f) => f.status === 'pending').length;
  const hasFiles = files.length > 0;

  return (
    <div className="bg-gray-900 rounded-2xl border border-gray-800 p-6">
      <h3 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
        <span>📄</span>
        Subir Archivos
      </h3>

      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className={`
          border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all
          ${
            isDragging
              ? 'border-cyan-500 bg-cyan-500/10'
              : 'border-gray-700 hover:border-gray-600 hover:bg-gray-800/50'
          }
        `}
      >
        <input
          ref={fileInputRef}
          type="file"
          multiple
          accept={ALLOWED_TYPES.join(',')}
          onChange={handleFileSelect}
          className="hidden"
        />
        <div className="text-4xl mb-3">📸</div>
        <p className="text-gray-300 font-medium">
          Arrastra archivos aquí o haz clic para seleccionar
        </p>
        <p className="text-gray-500 text-sm mt-2">
          Imágenes, PDFs, Excel, CSV (máx 10MB)
        </p>
      </div>

      {/* File list */}
      {hasFiles && (
        <div className="mt-4 space-y-2">
          {files.map((f, index) => (
            <div
              key={`${f.file.name}-${index}`}
              className="flex items-center gap-3 bg-gray-800 rounded-xl p-3"
            >
              <div className="text-2xl">
                {f.file.type.startsWith('image/') && '🖼️'}
                {f.file.type === 'application/pdf' && '📕'}
                {(f.file.type.includes('spreadsheet') ||
                  f.file.type.includes('excel') ||
                  f.file.type === 'text/csv') &&
                  '📊'}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-white text-sm font-medium truncate">
                  {f.file.name}
                </p>
                <p className="text-gray-500 text-xs">
                  {(f.file.size / 1024).toFixed(1)} KB
                </p>
              </div>
              <div className="flex items-center gap-2">
                {f.status === 'pending' && (
                  <span className="text-gray-400 text-xs">Pendiente</span>
                )}
                {f.status === 'uploading' && (
                  <span className="text-cyan-400 text-xs animate-pulse">
                    Subiendo...
                  </span>
                )}
                {f.status === 'processing' && (
                  <span className="text-yellow-400 text-xs animate-pulse">
                    Procesando...
                  </span>
                )}
                {f.status === 'done' && (
                  <span className="text-green-400 text-xs">✓ Listo</span>
                )}
                {f.status === 'error' && (
                  <span className="text-red-400 text-xs" title={f.error}>
                    ✗ Error
                  </span>
                )}
                {f.status === 'pending' && !isUploading && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      removeFile(index);
                    }}
                    className="text-gray-500 hover:text-red-400 transition-colors"
                  >
                    ✕
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      <div className="flex justify-end gap-3 mt-4">
        {onClose && (
          <button
            onClick={onClose}
            disabled={isUploading}
            className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-800 border border-gray-700 rounded-xl hover:bg-gray-700 disabled:opacity-50 transition-all"
          >
            Cancelar
          </button>
        )}
        <button
          onClick={uploadFiles}
          disabled={pendingCount === 0 || isUploading}
          className="px-4 py-2 text-sm font-medium text-white bg-gradient-to-r from-cyan-500 to-blue-500 rounded-xl hover:from-cyan-600 hover:to-blue-600 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
        >
          {isUploading
            ? 'Subiendo...'
            : `Subir ${pendingCount} archivo${pendingCount !== 1 ? 's' : ''}`}
        </button>
      </div>
    </div>
  );
}

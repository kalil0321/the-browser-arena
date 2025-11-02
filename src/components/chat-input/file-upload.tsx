"use client";

import { useRef, useState } from "react";
import { Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileUploadProps {
    file: File | null;
    onFileChange: (file: File | null) => void;
    onRemoveFile: () => void;
    isLoading?: boolean;
    isUploadingFiles?: boolean;
    children?: React.ReactNode;
    fileInputRef?: React.RefObject<HTMLInputElement | null>;
}

export function FileUpload({
    file,
    onFileChange,
    onRemoveFile,
    isLoading = false,
    isUploadingFiles = false,
    children,
    fileInputRef: externalFileInputRef
}: FileUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const internalFileInputRef = useRef<HTMLInputElement>(null);
    const fileInputRef = externalFileInputRef || internalFileInputRef;

    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const selectedFile = e.target.files?.[0];
        if (selectedFile) {
            onFileChange(selectedFile);
        }
        // Reset input so same file can be selected again
        if (fileInputRef.current) {
            fileInputRef.current.value = '';
        }
    };

    const handleRemoveFile = () => {
        onRemoveFile();
    };

    // Drag and drop handlers
    const handleDragEnter = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            setIsDragging(true);
        }
    };

    const handleDragLeave = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        // Only hide if we're leaving the container (not just moving between children)
        const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const x = e.clientX;
        const y = e.clientY;
        if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) {
            setIsDragging(false);
        }
    };

    const handleDragOver = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        if (e.dataTransfer.types.includes('Files')) {
            e.dataTransfer.dropEffect = 'copy';
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const droppedFile = e.dataTransfer.files[0];
        if (droppedFile) {
            onFileChange(droppedFile);
        }
    };

    return (
        <div
            className={cn(
                "relative",
                isDragging && "ring-2 ring-primary ring-offset-2"
            )}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
        >
            {children}

            {/* File display (single file) */}
            {file && (
                <div className="flex flex-wrap gap-2 mb-2">
                    <div className="flex items-center gap-2 px-3 py-2 sm:py-1.5 rounded-full bg-zinc-100 dark:bg-zinc-800 text-xs text-foreground min-h-[44px] sm:min-h-0">
                        <Paperclip className="h-3.5 w-3.5 sm:h-3 sm:w-3 text-muted-foreground shrink-0" />
                        <span className="max-w-[180px] sm:max-w-[200px] truncate text-xs sm:text-xs">{file.name}</span>
                        <button
                            type="button"
                            onClick={handleRemoveFile}
                            disabled={isLoading || isUploadingFiles}
                            className="ml-1 hover:opacity-70 disabled:opacity-50 touch-manipulation min-w-[32px] min-h-[32px] flex items-center justify-center"
                            title="Remove file"
                        >
                            <X className="h-4 w-4 sm:h-3 sm:w-3" />
                        </button>
                    </div>
                </div>
            )}

            {/* Drag and drop hint */}
            {isDragging && (
                <div className="absolute inset-0 flex items-center justify-center bg-primary/5 border-2 border-dashed border-primary rounded-4xl z-10 pointer-events-none">
                    <div className="text-center">
                        <Paperclip className="h-8 w-8 mx-auto mb-2 text-primary" />
                        <p className="text-sm font-medium text-primary">Drop files here</p>
                    </div>
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                onChange={handleFileSelect}
                className="hidden"
                id="file-upload-input"
                disabled={isLoading || isUploadingFiles}
            />
        </div>
    );
}



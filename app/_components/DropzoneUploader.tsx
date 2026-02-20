"use client";

import { useMemo, useState } from "react";
import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";
import { FILE_LIMITS } from "@/config/security";

export type DropzoneUploaderProps = {
  accept?: Record<string, string[]>;
  multiple?: boolean;
  onFiles: (files: File[]) => void;
  helper?: string;
  capture?: "environment" | "user";
};

export default function DropzoneUploader({
  accept,
  multiple = true,
  onFiles,
  helper,
  capture
}: DropzoneUploaderProps) {
  const [rejectionMessage, setRejectionMessage] = useState("");
  const maxSize = FILE_LIMITS.defaultHardBytes;
  const acceptHint = useMemo(() => {
    if (!accept) return "";
    const extensions = Object.values(accept).flat().join(", ");
    return extensions || "";
  }, [accept]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple,
    maxSize,
    onDropAccepted: (files) => {
      setRejectionMessage("");
      onFiles(files);
    },
    onDropRejected: (rejections) => {
      const reason = rejections[0]?.errors[0]?.message || "Unsupported file.";
      setRejectionMessage(
        `${reason} (max ${(maxSize / 1024 / 1024).toFixed(0)}MB per file)`
      );
    }
  });

  return (
    <div
      {...getRootProps({
        className: `dropzone ${isDragActive ? "dragging" : ""}`
      })}
    >
      <input {...getInputProps({ capture })} />
      <UploadCloud className="mx-auto h-10 w-10 text-ember" />
      <h3 className="mt-4 font-semibold">Drop files here</h3>
      <p className="mt-2 text-sm text-muted">
        Drag and drop or click to select your documents.
      </p>
      {acceptHint ? (
        <p className="mt-2 text-xs text-muted">Supported: {acceptHint}</p>
      ) : null}
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
      <p className="mt-1 text-xs text-muted">
        Recommended under {(FILE_LIMITS.defaultSoftBytes / 1024 / 1024).toFixed(0)}MB per file.
      </p>
      {rejectionMessage ? (
        <p className="mt-2 text-xs text-red-600">{rejectionMessage}</p>
      ) : null}
    </div>
  );
}

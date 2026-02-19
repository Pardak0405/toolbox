"use client";

import { useDropzone } from "react-dropzone";
import { UploadCloud } from "lucide-react";

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
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept,
    multiple,
    onDrop: (files) => onFiles(files)
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
      {helper ? <p className="mt-2 text-xs text-muted">{helper}</p> : null}
    </div>
  );
}

"use client";

import { useState, useRef } from "react";
import { IconUpload, IconX, IconFile, IconFilm } from "@/components/icons";
import { uploadPrivateFile } from "@/lib/upload-client";

interface FileUploadProps {
  name: string;
  accept?: string;
  label?: string;
  hint?: string;
  className?: string;
}

/**
 * 파일을 선택하면 즉시 비공개 저장소(/api/uploads)에 올리고, 받은 주소(/api/files/<id>)를 hidden input에 담는다.
 * 3개의 hidden input: name_file_data (파일 주소), name_file_name (파일명), name_file_type (MIME)
 */
export function FileUpload({
  name,
  accept = "image/*,video/*",
  label = "파일 첨부",
  hint = "이미지 또는 동영상 파일을 업로드하세요.",
  className,
}: FileUploadProps) {
  const [fileName, setFileName] = useState<string | null>(null);
  const [fileType, setFileType] = useState<string | null>(null);
  const [fileData, setFileData] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setLoading(true);
    setFileName(file.name);
    setFileType(file.type);
    setFileData(null);
    const result = await uploadPrivateFile(file);
    if ("url" in result) {
      setFileData(result.url);
    } else {
      setError(result.error);
      setFileName(null);
      setFileType(null);
      if (inputRef.current) inputRef.current.value = "";
    }
    setLoading(false);
  };

  const handleClear = () => {
    setError(null);
    setFileName(null);
    setFileType(null);
    setFileData(null);
    if (inputRef.current) inputRef.current.value = "";
  };

  const isVideo = fileType?.startsWith("video/") ?? false;

  return (
    <div className={className}>
      {/* Hidden inputs for form submission */}
      <input type="hidden" name={`${name}_file_data`} value={fileData ?? ""} />
      <input type="hidden" name={`${name}_file_name`} value={fileName ?? ""} />
      <input type="hidden" name={`${name}_file_type`} value={fileType ?? ""} />

      {fileName ? (
        <div className="flex items-center gap-2 rounded-xl border border-gray-300 bg-gray-50 px-3 py-2">
          {isVideo ? (
            <IconFilm size={16} className="shrink-0 text-brand-purple" />
          ) : (
            <IconFile size={16} className="shrink-0 text-brand-purple" />
          )}
          <span className="flex-1 truncate text-sm text-gray-700">{fileName}</span>
          {loading && <span className="text-xs text-gray-400">업로드 중...</span>}
          {!loading && (
            <button
              type="button"
              onClick={handleClear}
              className="text-gray-400 hover:text-red-500"
              aria-label="파일 제거"
            >
              <IconX size={14} />
            </button>
          )}
        </div>
      ) : (
        <label className="flex cursor-pointer flex-col items-center justify-center rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 px-4 py-6 text-center hover:border-brand-purple hover:bg-purple-50/30 transition-colors">
          <IconUpload size={24} className="mb-2 text-gray-400" />
          <span className="text-sm font-medium text-gray-600">{label}</span>
          <span className="mt-1 text-xs text-gray-400">{hint}</span>
          <input
            ref={inputRef}
            type="file"
            accept={accept}
            onChange={handleChange}
            className="hidden"
          />
        </label>
      )}
      {error && <p className="mt-1 text-xs font-medium text-red-600" role="alert">{error}</p>}
    </div>
  );
}

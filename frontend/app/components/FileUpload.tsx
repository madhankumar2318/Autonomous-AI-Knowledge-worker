"use client";
import { useState, useEffect } from "react";
import { Upload, File, Download, Trash2 } from "lucide-react";

export default function FileUpload() {
  const [file, setFile] = useState<File | null>(null);
  const [uploads, setUploads] = useState<any[]>([]);
  const [uploading, setUploading] = useState(false);

  // 🔹 Fetch uploaded files
  const fetchUploads = async () => {
    try {
      const res = await fetch("http://127.0.0.1:8000/upload/list");
      const data = await res.json();
      setUploads(data.uploads || []);
    } catch (err) {
      console.error("Error fetching uploads:", err);
    }
  };

  useEffect(() => {
    fetchUploads();
  }, []);

  // 🔹 Upload file
  const handleUpload = async () => {
    if (!file) return;
    setUploading(true);

    const formData = new FormData();
    formData.append("file", file);

    try {
      const res = await fetch("http://127.0.0.1:8000/upload/", {
        method: "POST",
        body: formData,
      });

      if (res.ok) {
        setFile(null);
        fetchUploads();
      } else {
        alert("Upload failed!");
      }
    } catch (err) {
      alert("Upload error!");
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* File Picker */}
      <div className="border-2 border-dashed border-light rounded-lg p-6 text-center hover:border-accent transition-colors">
        <Upload className="w-8 h-8 text-muted mx-auto mb-3" />
        <input
          type="file"
          onChange={(e) => setFile(e.target.files?.[0] || null)}
          className="hidden"
          id="file-upload"
          accept=".csv,.json"
        />
        <label
          htmlFor="file-upload"
          className="cursor-pointer text-sm text-secondary hover:text-primary"
        >
          {file ? (
            <span className="font-medium text-primary">{file.name}</span>
          ) : (
            <>
              <span className="text-accent font-medium">Choose a file</span> or
              drag and drop
            </>
          )}
        </label>
        <p className="text-xs text-muted mt-1">CSV or JSON files only</p>
      </div>

      {file && (
        <button
          onClick={handleUpload}
          disabled={uploading}
          className="btn btn-primary w-full flex items-center justify-center gap-2"
        >
          {uploading ? (
            <>
              <div className="spinner"></div>
              Uploading...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4" />
              Upload File
            </>
          )}
        </button>
      )}

      {/* Uploaded Files List */}
      {uploads.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-primary mb-3">
            Uploaded Files
          </h3>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {uploads.map((u) => (
              <div
                key={u.id}
                className="flex items-center justify-between p-3 bg-surface rounded-lg hover:bg-hover transition-colors"
              >
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  <File className="w-4 h-4 text-accent flex-shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-sm text-primary truncate">
                      {u.filename}
                    </p>
                    <p className="text-xs text-muted">
                      {Math.round(u.size / 1024)} KB
                    </p>
                  </div>
                </div>
                <a
                  href={`http://127.0.0.1:8000/uploads/${u.filename}`}
                  download
                  className="btn-ghost p-2 rounded-lg hover:bg-accent/10"
                  title="Download"
                >
                  <Download className="w-4 h-4 text-accent" />
                </a>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { api } from '../lib/api';

export function Uploads() {
  const { token } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<'idle' | 'uploading' | 'uploaded'>('idle');
  const [error, setError] = useState<string | null>(null);

  const handleUpload = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!token || !file) return;
    setStatus('uploading');
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      await api.uploadReceipt(token, formData);
      setStatus('uploaded');
      setFile(null);
      setTimeout(() => setStatus('idle'), 2000);
    } catch (err) {
      setStatus('idle');
      setError(err instanceof Error ? err.message : 'Failed to upload');
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>Receipt & label uploads</h2>
        {status === 'uploaded' && <span style={{ color: '#1f7a4d' }}>Uploaded!</span>}
      </div>

      <div className="card">
        <p>
          Upload JPG or PNG images of receipts, pantry shelves, or nutrition labels. Files are stored
          securely and can be linked to inventory items or usage records for future AI-assisted
          parsing.
        </p>
        <form onSubmit={handleUpload} style={{ display: 'grid', gap: '1rem' }}>
          <input
            type="file"
            accept="image/png, image/jpeg"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
          {error && <p className="error-text">{error}</p>}
          <button className="primary-btn" type="submit" disabled={!file || status === 'uploading'}>
            {status === 'uploading' ? 'Uploading…' : 'Upload image'}
          </button>
        </form>
        <p style={{ fontSize: '0.85rem', color: '#64748b' }}>
          Hint: capture receipts in good light so Part 2’s scanning feature can read them easily.
        </p>
      </div>
    </>
  );
}


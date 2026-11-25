import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useAuthenticator } from '@aws-amplify/ui-react';
import { generateClient } from 'aws-amplify/data';
import { uploadData, getUrl, remove } from 'aws-amplify/storage';
import { get } from 'aws-amplify/api';
import { fetchAuthSession } from 'aws-amplify/auth';
import type { Schema } from '../amplify/data/resource';

const client = generateClient<Schema>();
type Photo = Schema['Photo']['type'] & { url?: string };

function App() {
  const { user, signOut } = useAuthenticator();
  const [photos, setPhotos] = useState<Photo[]>([]);
  const [file, setFile] = useState<File | null>(null);
  const [title, setTitle] = useState('');
  const [busy, setBusy] = useState(false);
  const [groups, setGroups] = useState<string[]>([]);
  const [apiResult, setApiResult] = useState('');

  async function loadPhotos() {
    const { data } = await client.models.Photo.list();
    const withUrls = await Promise.all(
      data.map(async (p) => {
        const { url } = await getUrl({ path: p.path });
        return { ...p, url: url.toString() };
      }),
    );
    setPhotos(withUrls);
  }

  async function loadGroups() {
    const session = await fetchAuthSession();
    const g = session.tokens?.idToken?.payload['cognito:groups'];
    setGroups(Array.isArray(g) ? (g as string[]) : []);
  }

  useEffect(() => {
    loadPhotos();
    loadGroups();
  }, []);

  async function handleUpload(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      alert('Please choose an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be under 5 MB.');
      return;
    }
    setBusy(true);
    try {
      const result = await uploadData({
        path: ({ identityId }) => `photos/${identityId}/${Date.now()}-${file.name}`,
        data: file,
        options: { contentType: file.type },
      }).result;
      await client.models.Photo.create({ title: title || file.name, path: result.path });
      setFile(null);
      setTitle('');
      form.reset();
      await loadPhotos();
    } catch (err) {
      alert('Upload failed: ' + String(err));
    } finally {
      setBusy(false);
    }
  }

  async function handleDelete(photo: Photo) {
    try {
      await remove({ path: photo.path });
      await client.models.Photo.delete({ id: photo.id });
      await loadPhotos();
    } catch {
      alert('You can only delete your own photos (unless you are an admin).');
    }
  }

  async function callRestApi(fail = false) {
    setApiResult('Calling REST API...');
    try {
      const session = await fetchAuthSession();
      const token = session.tokens?.idToken?.toString() ?? '';
      const { body } = await get({
        apiName: 'photoRestApi',
        path: 'stats',
        options: {
          headers: { Authorization: token },
          queryParams: fail ? { fail: 'true' } : undefined,
        },
      }).response;
      setApiResult(JSON.stringify(await body.json(), null, 2));
    } catch (err) {
      setApiResult('Error: ' + String(err));
    }
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: 24, textAlign: 'left' }}>
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h1>📷 Photo Gallery</h1>
        <div>
          <span style={{ marginRight: 12 }}>
            {user?.signInDetails?.loginId ?? user?.username} | groups: {groups.join(', ') || 'none'}
          </span>
          <button onClick={signOut}>Sign out</button>
        </div>
      </header>

      <section>
        <h2>Upload a photo</h2>
        <form onSubmit={handleUpload} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <input
            type="text"
            placeholder="Title (optional)"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            type="file"
            accept="image/*"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          />
          <button type="submit" disabled={!file || busy}>
            {busy ? 'Uploading...' : 'Upload'}
          </button>
        </form>
      </section>

      <section>
        <h2>REST API test</h2>
        <button onClick={() => callRestApi(false)}>Call GET /stats</button>{' '}
        <button onClick={() => callRestApi(true)}>Trigger test error (CloudWatch)</button>
        {apiResult && (
          <pre style={{ background: '#222', color: '#0f0', padding: 12 }}>{apiResult}</pre>
        )}
      </section>

      <section>
        <h2>Gallery ({photos.length})</h2>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))',
            gap: 16,
          }}
        >
          {photos.map((p) => (
            <figure key={p.id} style={{ margin: 0, border: '1px solid #444', padding: 8 }}>
              <img
                src={p.url}
                alt={p.title}
                style={{ width: '100%', height: 160, objectFit: 'cover' }}
              />
              <figcaption>{p.title}</figcaption>
              <button onClick={() => handleDelete(p)}>Delete</button>
            </figure>
          ))}
        </div>
      </section>
    </main>
  );
}

export default App;

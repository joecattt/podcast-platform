import { useEffect, useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { isHost, useAuth } from '../lib/auth';
import {
  getShowSettings,
  saveShowSettings,
  uploadIntroVideo,
  uploadLogo,
  type ShowSettings,
} from '../lib/show';
import { Button } from '../components/Button';

export function Settings() {
  const { user, loading } = useAuth();
  const [s, setS] = useState<ShowSettings | null>(null);
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    getShowSettings().then(setS);
  }, []);

  if (loading) return <div className="p-8 text-muted-foreground">Loading…</div>;
  if (!isHost(user)) return <Navigate to="/host" state={{ next: '/settings' }} replace />;
  if (!s) return <div className="p-8 text-muted-foreground">Loading settings…</div>;

  async function handleSave() {
    if (!s) return;
    setSaving(true);
    setMsg(null);
    try {
      await saveShowSettings(s);
      setMsg('Saved.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleIntroUpload(file: File) {
    if (!s) return;
    setSaving(true);
    setMsg('Uploading intro…');
    try {
      const { path, url } = await uploadIntroVideo(file);
      const next = { ...s, introVideoPath: path, introVideoUrl: url };
      setS(next);
      await saveShowSettings(next);
      setMsg('Intro uploaded.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleLogoUpload(file: File) {
    if (!s) return;
    setSaving(true);
    setMsg('Uploading logo…');
    try {
      const { path, url } = await uploadLogo(file);
      const next = { ...s, logoPath: path, logoUrl: url };
      setS(next);
      await saveShowSettings(next);
      setMsg('Logo uploaded.');
    } catch (e: unknown) {
      setMsg(e instanceof Error ? e.message : 'Upload failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8 space-y-8">
      <header className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Show settings</h1>
        <Link to="/" className="text-sm underline text-muted-foreground">← Home</Link>
      </header>

      <section className="space-y-3">
        <label className="block text-sm font-medium">Show name</label>
        <input
          value={s.name}
          onChange={(e) => setS({ ...s, name: e.target.value })}
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        />
      </section>

      <section className="space-y-3">
        <label className="block text-sm font-medium">Show description (used for AI SEO context)</label>
        <textarea
          value={s.showDescription ?? ''}
          onChange={(e) => setS({ ...s, showDescription: e.target.value })}
          rows={3}
          placeholder="What's the show about?"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        />
        <label className="block text-sm font-medium">Topic keywords (comma-separated)</label>
        <input
          value={(s.topicKeywords ?? []).join(', ')}
          onChange={(e) => setS({ ...s, topicKeywords: e.target.value.split(',').map((x) => x.trim()).filter(Boolean) })}
          placeholder="comedy, interviews, tech"
          className="w-full rounded-md border border-border bg-background px-3 py-2"
        />
      </section>

      <section className="space-y-3">
        <label className="block text-sm font-medium">Brand colors</label>
        <div className="flex gap-3">
          {(['primary', 'accent', 'background'] as const).map((k) => (
            <label key={k} className="flex-1 space-y-1">
              <span className="block text-xs text-muted-foreground capitalize">{k}</span>
              <input
                type="color"
                value={s.brandColors[k]}
                onChange={(e) =>
                  setS({ ...s, brandColors: { ...s.brandColors, [k]: e.target.value } })
                }
                className="block h-10 w-full rounded-md border border-border"
              />
            </label>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <label className="block text-sm font-medium">Intro video (plays before every episode)</label>
        {s.introVideoUrl && (
          <video src={s.introVideoUrl} controls className="w-full max-h-48 rounded-md border border-border" />
        )}
        <input
          type="file"
          accept="video/*"
          onChange={(e) => e.target.files?.[0] && handleIntroUpload(e.target.files[0])}
          className="block text-sm"
        />
      </section>

      <section className="space-y-3">
        <label className="block text-sm font-medium">Logo</label>
        {s.logoUrl && <img src={s.logoUrl} alt="Logo" className="h-16" />}
        <input
          type="file"
          accept="image/*"
          onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
          className="block text-sm"
        />
      </section>

      <div className="flex items-center gap-3 pt-4 border-t border-border">
        <Button onClick={handleSave} disabled={saving}>
          {saving ? 'Saving…' : 'Save settings'}
        </Button>
        {msg && <span className="text-sm text-muted-foreground">{msg}</span>}
      </div>
    </div>
  );
}

import { useState, useEffect } from 'react';
import { Crown, Check, ImageUp, ImageOff, QrCode, Copy, ShieldCheck, Clock3, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useApp, useLoad } from '../hooks/useApp';
import { Button, Field, ErrorState, Loading } from '../components/ui';
import { hasPremium, PREMIUM_FEATURES } from '../../../shared/account.js';
const UPI_ID = 'your-upi-id@bank';
export default function PremiumPage() {
  const { user, refresh } = useApp();
  const unlocked = hasPremium(user);
  const { data, loading } = useLoad(() => api('/premium/order').catch(() => ({ order: null })), [user?.account]);
  const [form, setForm] = useState({ name: user?.name || '', email: '', phone: '', country: '', address: '' });
  const [proof, setProof] = useState(null), [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const order = data?.order;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function pickProof(file) {
    if (file && !/^image\/(png|jpeg|webp)$/.test(file.type)) { setError('Use a JPG, PNG, or WebP image.'); return; }
    setError('');
    setProof(file || null);
    setPreview(old => { if (old) URL.revokeObjectURL(old); return file ? URL.createObjectURL(file) : ''; });
  }
  async function submit(e) {
    e.preventDefault();
    if (!proof) { setError('Attach a screenshot of the UPI payment.'); return; }
    setBusy(true); setError('');
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append('proof', proof);
    try { await api('/premium/order', { method: 'POST', body }); refresh(); toast.success('Request sent with your payment photo.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <>
    <section className="premium-hero">
      <div>
        <span className="premium-badge"><Crown size={13}/> RECALL PREMIUM</span>
        <h1>{unlocked ? 'You have Premium.' : 'Study with the full toolkit.'}</h1>
        <p>{unlocked ? 'Projects, imports, live quizzes, folder covers, and editor invites are unlocked on this account.' : 'Keep the free library exactly as it is, and add the six tools below.'}</p>
        {unlocked && <span className="premium-plan"><Check size={14}/> Active plan · {user.account}</span>}
      </div>
      <div className="premium-hero-art" aria-hidden="true"><Crown size={78}/></div>
    </section>
    <div className="premium-section-head"><h2>What Premium unlocks</h2><span>{PREMIUM_FEATURES.length} features</span></div>
    <ul className="premium-feature-list">{PREMIUM_FEATURES.map(f => <li key={f.id}><span className="premium-feature-icon"><Sparkles size={15}/></span><div><strong>{f.label}</strong><p>{f.detail}</p></div></li>)}</ul>
    {unlocked ? null : loading ? <Loading/> : order?.status === 'pending' ? <section className="premium-pending">
      <span className="premium-pending-icon"><Clock3 size={22}/></span>
      <div><h2>Waiting for confirmation</h2><p>Your details and payment screenshot are with our team. Premium turns on as soon as the transfer is verified.</p></div>
      {order.hasProof && <a href={`/api/premium/orders/${order.id}/proof`} target="_blank" rel="noreferrer"><img className="proof-preview" src={`/api/premium/orders/${order.id}/proof`} alt="Your payment screenshot"/></a>}
    </section> : <div className="premium-checkout">
      <form className="premium-form" onSubmit={submit}>
        <div className="premium-card-head"><h2>Your details</h2><p>We use these to match your payment and raise an invoice.</p></div>
        <div className="premium-grid">
          <Field label="Full name"><input required maxLength={80} placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></Field>
          <Field label="Email"><input required type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/></Field>
          <Field label="Phone number"><input required type="tel" minLength={8} maxLength={20} placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/></Field>
          <Field label="Country"><input required maxLength={56} placeholder="India" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}/></Field>
        </div>
        <Field label="Address"><textarea required minLength={6} maxLength={300} rows={3} placeholder="Street, city, and postal code" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}/></Field>
        <div className="premium-card-head premium-card-head-inline"><h2>Proof of payment</h2><span className="premium-required">Required</span></div>
        <label className={`dropzone proof-dropzone ${proof ? 'has-file' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickProof(e.dataTransfer.files[0]); }}>
          <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => pickProof(e.target.files[0])}/>
          {preview ? <img className="proof-preview" src={preview} alt="Payment screenshot preview"/> : <span className="dropzone-icon"><ImageUp size={22}/></span>}
          <strong>{proof ? proof.name : 'Add your payment screenshot'}</strong>
          <small>{proof ? 'Click or drop another image to replace it.' : 'Drag an image here, or click to browse. JPG, PNG, or WebP.'}</small>
        </label>
        {proof && <button type="button" className="text-button proof-clear" onClick={() => pickProof(null)}><ImageOff size={14}/> Remove image</button>}
        {error && <ErrorState message={error}/>}
        <Button className="primary premium-submit" loading={busy} type="submit"><Crown size={16}/> Submit payment request</Button>
        <p className="premium-fineprint"><ShieldCheck size={14}/> Your screenshot is private. Only you and an admin can open it.</p>
      </form>
      <aside className="premium-aside">
        <div className="premium-pay-card">
          <span className="premium-pay-label"><QrCode size={14}/> PAY WITH UPI</span>
          <div className="premium-qr" aria-hidden="true"><QrCode size={40}/><span>QR goes here</span></div>
          <button type="button" className="premium-upi" onClick={async () => { try { await navigator.clipboard.writeText(UPI_ID); toast.success('UPI ID copied'); } catch { toast.error('Copy the UPI ID manually.'); } }}><span>{UPI_ID}</span><Copy size={14}/></button>
          <small>Replace the UPI ID and QR image before going live.</small>
        </div>
        <ol className="premium-steps">
          <li><span>1</span> Pay the amount to the UPI ID.</li>
          <li><span>2</span> Screenshot the success screen.</li>
          <li><span>3</span> Fill the form and attach it.</li>
          <li><span>4</span> An admin confirms and Premium turns on.</li>
        </ol>
      </aside>
    </div>}
  </>;
}

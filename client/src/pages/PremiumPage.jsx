import { useState } from 'react';
import { Crown, Check } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useApp, useLoad } from '../hooks/useApp';
import { Button, Field, ErrorState, Loading } from '../components/ui';
import { hasPremium, PREMIUM_FEATURES } from '../../../shared/account.js';
export default function PremiumPage() {
  const { user, refresh } = useApp();
  const unlocked = hasPremium(user);
  const { data, loading } = useLoad(() => api('/premium/order').catch(() => ({ order: null })), [user?.account]);
  const [form, setForm] = useState({ name: user?.name || '', email: '', phone: '', country: '', address: '' });
  const [proof, setProof] = useState(null), [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const order = data?.order;
  function pickProof(file) {
    setProof(file || null);
    if (preview) URL.revokeObjectURL(preview);
    setPreview(file ? URL.createObjectURL(file) : '');
  }
  async function submit(e) {
    e.preventDefault(); setBusy(true); setError('');
    if (!proof) { setError('Upload a screenshot of the UPI payment.'); setBusy(false); return; }
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append('proof', proof);
    try { await api('/premium/order', { method: 'POST', body }); refresh(); toast.success('Request sent with your payment photo. We will confirm shortly.'); }
    catch (err) { setError(err.message); } finally { setBusy(false); }
  }
  return <>
    <div className="page-heading"><div><span className="eyebrow">RECALL PREMIUM</span><h1>{unlocked ? 'You have Premium.' : 'Study with the full toolkit.'}</h1><p>{unlocked ? 'Projects, imports, live quizzes, and editor invites are unlocked on this account.' : 'Normal accounts keep the core library. Premium unlocks the extras below.'}</p></div></div>
    <ul className="premium-feature-list">{PREMIUM_FEATURES.map(f => <li key={f.id}><Crown size={16}/><div><strong>{f.label}</strong><p>{f.detail}</p></div></li>)}</ul>
    {unlocked ? <p className="inline-note"><Check size={16}/> {user.account === 'normal' ? 'Premium' : user.account} — every premium feature is available.</p> : loading ? <Loading/> : order?.status === 'pending' ? <div className="premium-buy"><h2>Waiting for confirmation</h2><p>Your details and payment screenshot are in. An admin will confirm the transfer.</p><UpiBlock/>{order.hasProof && <img className="proof-preview" src={`/api/premium/orders/${order.id}/proof`} alt="Your payment screenshot"/>}</div> : <div className="premium-buy">
      <h2>Buy Premium</h2>
      <p>Pay with UPI, then send this form with a screenshot of the payment.</p>
      <UpiBlock/>
      <form className="form-stack" onSubmit={submit}>
        <Field label="Full name"><input required maxLength={80} value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></Field>
        <Field label="Email"><input required type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/></Field>
        <Field label="Phone number"><input required type="tel" minLength={8} maxLength={20} value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/></Field>
        <Field label="Country"><input required maxLength={56} value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}/></Field>
        <Field label="Address"><textarea required minLength={6} maxLength={300} rows={3} value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}/></Field>
        <Field label="Payment screenshot" hint="JPG, PNG, or WebP of the UPI success screen.">
          <label className="upload-button proof-upload"><input type="file" accept="image/png,image/jpeg,image/webp" required onChange={e => pickProof(e.target.files[0])}/>{proof ? proof.name : 'Choose payment photo'}</label>
          {preview && <img className="proof-preview" src={preview} alt="Payment screenshot preview"/>}
        </Field>
        {error && <ErrorState message={error}/>}
        <Button className="primary" loading={busy} type="submit"><Crown size={16}/> Submit request</Button>
      </form>
    </div>}
  </>;
}
function UpiBlock() {
  return <div className="upi-block">
    <strong>Pay with UPI</strong>
    <p>UPI ID — <em>your-upi-id@bank</em></p>
    <div className="upi-qr" aria-hidden="true">QR</div>
    <small>Replace this placeholder with your UPI ID and QR image.</small>
  </div>;
}

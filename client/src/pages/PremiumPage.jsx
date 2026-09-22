import { useState, useEffect } from 'react';
import { Crown, Check, ImageUp, ImageOff, QrCode, Copy, ShieldCheck, Clock3, Sparkles, Infinity as Forever, Zap, Banknote } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { messageFor, ApiError } from '../services/errors';
import { loadCheckout } from '../services/razorpay';
import { useApp, useLoad } from '../hooks/useApp';
import { Button, Field, ErrorState, Loading } from '../components/ui';
import { hasPremium, PREMIUM_FEATURES, PREMIUM_PLANS, planById } from '../../../shared/account.js';
const UPI_ID = 'your-upi-id@bank';
const money = n => `₹${n.toLocaleString('en-IN')}`;
const perMonth = plan => plan.days ? `${money(Math.round(plan.price / (plan.days / 30)))}/mo` : 'one payment';
const METHOD_ICONS = { razorpay: Zap, manual: Banknote };
export default function PremiumPage() {
  const { user, setUser, refresh, revision } = useApp();
  const unlocked = hasPremium(user);
  const { data, loading } = useLoad(() => api('/premium/order').catch(() => ({ order: null, subscription: null, methods: [] })), [user?.account, revision]);
  const [plan, setPlan] = useState('yearly');
  const [method, setMethod] = useState('');
  const [form, setForm] = useState({ name: user?.name || '', email: '', phone: '', country: '', address: '' });
  const [proof, setProof] = useState(null), [preview, setPreview] = useState('');
  const [busy, setBusy] = useState(false), [error, setError] = useState('');
  const order = data?.order, sub = data?.subscription, methods = data?.methods || [];
  const chosen = planById(plan);
  // Default to whatever the server offers first: online when it is configured, the UPI transfer otherwise.
  useEffect(() => { if (methods.length && !methods.some(m => m.id === method)) setMethod(methods[0].id); }, [methods, method]);
  const active = methods.find(m => m.id === method) || null;
  useEffect(() => () => { if (preview) URL.revokeObjectURL(preview); }, [preview]);
  function pickProof(file) {
    if (file && !/^image\/(png|jpeg|webp)$/.test(file.type)) { setError('Use a JPG, PNG, or WebP image.'); return; }
    setError('');
    setProof(file || null);
    setPreview(old => { if (old) URL.revokeObjectURL(old); return file ? URL.createObjectURL(file) : ''; });
  }
  async function submit(e) {
    e.preventDefault();
    if (active?.requiresProof && !proof) { setError('Attach a screenshot of the UPI payment.'); return; }
    setBusy(true); setError('');
    try {
      if (method === 'razorpay') await payOnline();
      else { await submitManual(); toast.success('Request sent with your payment photo.'); }
      refresh();
    } catch (err) { setError(messageFor(err)); } finally { setBusy(false); }
  }
  async function submitManual() {
    const body = new FormData();
    Object.entries(form).forEach(([k, v]) => body.append(k, v));
    body.append('plan', plan); body.append('method', 'manual'); body.append('proof', proof);
    await api('/premium/order', { method: 'POST', body });
  }
  /** The gateway owns the card form; we only hand it an order and verify the signature it hands back. */
  async function payOnline() {
    const { checkout } = await api('/premium/checkout', { method: 'POST', body: { ...form, plan, method: 'razorpay' } });
    const Razorpay = await loadCheckout();
    await new Promise((resolve, reject) => {
      const rz = new Razorpay({
        key: checkout.key, order_id: checkout.orderId, amount: checkout.amount, currency: checkout.currency,
        name: 'Recall', description: checkout.description, prefill: checkout.prefill, theme: { color: '#5b53e8' },
        handler: response => api('/premium/checkout/confirm', {
          method: 'POST',
          body: { orderId: response.razorpay_order_id, paymentId: response.razorpay_payment_id, signature: response.razorpay_signature },
        }).then(async () => {
          toast.success('Payment confirmed. Premium is on.');
          const me = await api('/auth/me').catch(() => null);
          if (me?.user) setUser(me.user);
          resolve();
        }, reject),
        modal: { ondismiss: () => { api('/premium/order', { method: 'DELETE' }).catch(() => {}); reject(new ApiError('Payment cancelled. You were not charged.', { code: 'CHECKOUT_CANCELLED' })); } },
      });
      rz.on('payment.failed', r => reject(new ApiError(r?.error?.description || 'The payment did not go through. You were not charged.', { code: 'PAYMENT_FAILED' })));
      rz.open();
    });
  }
  return <>
    <section className="premium-hero">
      <div>
        <span className="premium-badge"><Crown size={13}/> RECALL PREMIUM</span>
        <h1>{unlocked ? 'You have Premium.' : 'Study with the full toolkit.'}</h1>
        <p>{unlocked ? 'Projects, imports, live quizzes, folder covers, and editor invites are unlocked on this account.' : 'Keep the free library exactly as it is, and add the six tools below.'}</p>
        {unlocked && <span className="premium-plan"><Check size={14}/> {sub?.planLabel || user.account} · {sub?.expiresAt ? `${sub.daysLeft} day${sub.daysLeft === 1 ? '' : 's'} left` : 'never expires'}</span>}
      </div>
      <div className="premium-hero-art" aria-hidden="true"><Crown size={78}/></div>
    </section>
    <div className="premium-section-head"><h2>What Premium unlocks</h2><span>{PREMIUM_FEATURES.length} features</span></div>
    <ul className="premium-feature-list">{PREMIUM_FEATURES.map(f => <li key={f.id}><span className="premium-feature-icon"><Sparkles size={15}/></span><div><strong>{f.label}</strong><p>{f.detail}</p></div></li>)}</ul>
    {unlocked ? null : loading ? <Loading/> : order?.status === 'pending' ? <section className="premium-pending">
      <span className="premium-pending-icon"><Clock3 size={22}/></span>
      <div><h2>Waiting for confirmation</h2><p>{order.method === 'manual'
        ? `Your ${planById(order.plan)?.label || 'Premium'} request and payment screenshot are with our team. Premium turns on as soon as the transfer is verified.`
        : `Your ${planById(order.plan)?.label || 'Premium'} payment is still settling with the gateway. Premium turns on as soon as it clears, usually within a minute.`}</p></div>
      {order.hasProof && <a href={`/api/premium/orders/${order.id}/proof`} target="_blank" rel="noreferrer"><img className="proof-preview" src={`/api/premium/orders/${order.id}/proof`} alt="Your payment screenshot"/></a>}
    </section> : <div className="premium-checkout">
      <form className="premium-form" onSubmit={submit}>
        <div className="premium-card-head"><h2>Choose a plan</h2><p>Every plan unlocks the same features. Longer plans simply cost less per month.</p></div>
        <div className="plan-picker" role="radiogroup" aria-label="Premium plan">{PREMIUM_PLANS.map(p => <label key={p.id} className={`plan-option ${plan === p.id ? 'is-chosen' : ''}`}>
          <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)}/>
          <span className="plan-top"><strong>{p.label}</strong>{p.id === 'yearly' && <span className="plan-tag">Popular</span>}{p.days == null && <Forever size={15}/>}</span>
          <span className="plan-price">{money(p.price)}</span>
          <span className="plan-term">{p.days ? `${p.days} days · ${perMonth(p)}` : 'never expires'}</span>
          <span className="plan-blurb">{p.blurb}</span>
        </label>)}</div>
        {methods.length > 1 && <>
          <div className="premium-card-head premium-card-head-inline"><h2>How would you like to pay?</h2></div>
          <div className="pay-picker" role="radiogroup" aria-label="Payment method">{methods.map(m => {
            const Icon = METHOD_ICONS[m.id] || Banknote;
            return <label key={m.id} className={`pay-option ${method === m.id ? 'is-chosen' : ''}`}>
              <input type="radio" name="method" value={m.id} checked={method === m.id} onChange={() => setMethod(m.id)}/>
              <span className="pay-icon"><Icon size={16}/></span>
              <span className="pay-text"><strong>{m.label}</strong><small>{m.blurb}</small></span>
              {m.instant && <span className="plan-tag">Instant</span>}
            </label>;
          })}</div>
        </>}
        <div className="premium-card-head premium-card-head-inline"><h2>Your details</h2><span className="plan-total">{chosen ? `${chosen.label} · ${money(chosen.price)}` : ''}</span></div>
        <div className="premium-grid">
          <Field label="Full name"><input required maxLength={80} placeholder="Your name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}/></Field>
          <Field label="Email"><input required type="email" placeholder="you@example.com" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))}/></Field>
          <Field label="Phone number"><input required type="tel" minLength={8} maxLength={20} placeholder="+91 98765 43210" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}/></Field>
          <Field label="Country"><input required maxLength={56} placeholder="India" value={form.country} onChange={e => setForm(f => ({ ...f, country: e.target.value }))}/></Field>
        </div>
        <Field label="Address"><textarea required minLength={6} maxLength={300} rows={3} placeholder="Street, city, and postal code" value={form.address} onChange={e => setForm(f => ({ ...f, address: e.target.value }))}/></Field>
        {active?.requiresProof && <>
          <div className="premium-card-head premium-card-head-inline"><h2>Proof of payment</h2><span className="premium-required">Required</span></div>
          <label className={`dropzone proof-dropzone ${proof ? 'has-file' : ''}`} onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); pickProof(e.dataTransfer.files[0]); }}>
            <input type="file" accept="image/png,image/jpeg,image/webp" onChange={e => pickProof(e.target.files[0])}/>
            {preview ? <img className="proof-preview" src={preview} alt="Payment screenshot preview"/> : <span className="dropzone-icon"><ImageUp size={22}/></span>}
            <strong>{proof ? proof.name : 'Add your payment screenshot'}</strong>
            <small>{proof ? 'Click or drop another image to replace it.' : 'Drag an image here, or click to browse. JPG, PNG, or WebP.'}</small>
          </label>
          {proof && <button type="button" className="text-button proof-clear" onClick={() => pickProof(null)}><ImageOff size={14}/> Remove image</button>}
        </>}
        {error && <ErrorState message={error}/>}
        <Button className="primary premium-submit" loading={busy} type="submit"><Crown size={16}/> {active?.instant ? 'Pay' : 'Submit request'}{chosen ? ` · ${money(chosen.price)}` : ''}</Button>
        <p className="premium-fineprint"><ShieldCheck size={14}/> {active?.requiresProof ? 'Your screenshot is private. Only you and an admin can open it.' : 'Card details go straight to the payment gateway. Recall never sees them.'}</p>
      </form>
      <aside className="premium-aside">
        {active?.requiresProof ? <>
          <div className="premium-pay-card">
            <span className="premium-pay-label"><QrCode size={14}/> PAY WITH UPI</span>
            {chosen && <strong className="premium-amount">{money(chosen.price)}</strong>}
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
        </> : <>
          <div className="premium-pay-card">
            <span className="premium-pay-label"><Zap size={14}/> PAY ONLINE</span>
            {chosen && <strong className="premium-amount">{money(chosen.price)}</strong>}
            <p className="premium-pay-note">Cards, UPI apps, net banking, and wallets. Premium switches on the moment the payment clears.</p>
            <small>Secured by Razorpay.</small>
          </div>
          <ol className="premium-steps">
            <li><span>1</span> Fill in your details.</li>
            <li><span>2</span> Pay in the secure window.</li>
            <li><span>3</span> Premium turns on right away.</li>
          </ol>
        </>}
      </aside>
    </div>}
  </>;
}

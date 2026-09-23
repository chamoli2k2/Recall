import { useState } from 'react';
import { Crown, Check, QrCode, Copy, Clock3, Sparkles, Infinity as Forever, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { useApp, useQuery } from '../hooks/useApp';
import { Loading } from '../components/ui';
import PaymentForm from '../components/PaymentForm';
import { hasPremium, PREMIUM_FEATURES, PREMIUM_PLANS, planById } from '../../../shared/account.js';
const UPI_ID = 'your-upi-id@bank';
const money = n => `₹${n.toLocaleString('en-IN')}`;
const perMonth = plan => plan.days ? `${money(Math.round(plan.price / (plan.days / 30)))}/mo` : 'one payment';

/** The UPI instructions and the gateway reassurance, chosen by whichever method is selected. */
export function PaymentAside({ method, amount, steps }) {
  const manual = method?.requiresProof;
  return <aside className="premium-aside">
    <div className="premium-pay-card">
      <span className="premium-pay-label">{manual ? <><QrCode size={14}/> PAY WITH UPI</> : <><Zap size={14}/> PAY ONLINE</>}</span>
      {amount ? <strong className="premium-amount">{money(amount)}</strong> : null}
      {manual ? <>
        <div className="premium-qr" aria-hidden="true"><QrCode size={40}/><span>QR goes here</span></div>
        <button type="button" className="premium-upi" onClick={async () => { try { await navigator.clipboard.writeText(UPI_ID); toast.success('UPI ID copied'); } catch { toast.error('Copy the UPI ID manually.'); } }}><span>{UPI_ID}</span><Copy size={14}/></button>
        <small>Replace the UPI ID and QR image before going live.</small>
      </> : <>
        <p className="premium-pay-note">Cards, UPI apps, net banking, and wallets. It switches on the moment the payment clears.</p>
        <small>Secured by Razorpay.</small>
      </>}
    </div>
    <ol className="premium-steps">{(manual ? steps.manual : steps.online).map((s, i) => <li key={i}><span>{i + 1}</span> {s}</li>)}</ol>
  </aside>;
}

const STEPS = {
  manual: ['Pay the amount to the UPI ID.', 'Screenshot the success screen.', 'Fill the form and attach it.', 'An admin confirms and it turns on.'],
  online: ['Fill in your details.', 'Pay in the secure window.', 'It turns on right away.'],
};

export default function PremiumPage() {
  const { user } = useApp();
  const unlocked = hasPremium(user);
  const { data, loading } = useQuery('/premium/order', () => api('/premium/order').catch(() => ({ order: null, subscription: null, methods: [] })));
  const [plan, setPlan] = useState('yearly');
  const [method, setMethod] = useState(null);
  const order = data?.order, sub = data?.subscription, methods = data?.methods || [];
  const chosen = planById(plan);
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
      <div className="premium-form-wrap">
        <div className="premium-card-head"><h2>Choose a plan</h2><p>Every plan unlocks the same features. Longer plans simply cost less per month.</p></div>
        <div className="plan-picker" role="radiogroup" aria-label="Premium plan">{PREMIUM_PLANS.map(p => <label key={p.id} className={`plan-option ${plan === p.id ? 'is-chosen' : ''}`}>
          <input type="radio" name="plan" value={p.id} checked={plan === p.id} onChange={() => setPlan(p.id)}/>
          <span className="plan-top"><strong>{p.label}</strong>{p.id === 'yearly' && <span className="plan-tag">Popular</span>}{p.days == null && <Forever size={15}/>}</span>
          <span className="plan-price">{money(p.price)}</span>
          <span className="plan-term">{p.days ? `${p.days} days · ${perMonth(p)}` : 'never expires'}</span>
          <span className="plan-blurb">{p.blurb}</span>
        </label>)}</div>
        <PaymentForm
          methods={methods}
          amount={chosen?.price}
          summary={chosen ? `${chosen.label} · ${money(chosen.price)}` : ''}
          extra={{ plan }}
          manualPath="/premium/order"
          checkoutPath="/premium/checkout"
          cancelPath="/premium/order"
          onMethodChange={setMethod}
        />
      </div>
      <PaymentAside method={method} amount={chosen?.price} steps={STEPS}/>
    </div>}
  </>;
}

import { useState } from 'react';
import { MailWarning } from 'lucide-react';
import { toast } from 'sonner';
import { api } from '../services/api';
import { Button } from './ui';
import { BRAND } from '../../../shared/brand.js';

/** Asks for a fresh confirmation link. Used everywhere an unconfirmed address is in the way. */
export function ResendLinkButton({ label = 'Send me a confirmation link' }) {
  const [busy, setBusy] = useState(false);
  return <Button className="primary" loading={busy} onClick={async () => {
    setBusy(true);
    try {
      const r = await api('/auth/verify-email/resend', { method: 'POST' });
      if (r.sent) toast.success('Link sent. Check your inbox.');
      else if (r.reason === 'too-soon') toast('We just sent one. Give it a minute before trying again.');
      else toast.error(`Email is not set up on this server yet. Write to ${BRAND.email.general} and we will confirm it by hand.`);
    } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  }}>{label}</Button>;
}

/** Stands in for a form an unconfirmed address is not allowed to reach. */
export default function ConfirmEmailFirst({ className = '', title = 'Confirm your email first', children }) {
  return <div className={`premium-unverified ${className}`.trim()}>
    <span className="verify-icon verify-icon-bad"><MailWarning size={26}/></span>
    <h2>{title}</h2>
    <p>{children}</p>
    <ResendLinkButton/>
  </div>;
}

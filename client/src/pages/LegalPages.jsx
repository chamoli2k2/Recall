import { Link } from 'react-router-dom';
function Legal({ eyebrow, title, children }) {
  return <article className="legal-page"><span className="eyebrow">{eyebrow}</span><h1>{title}</h1>{children}<p className="legal-back"><Link to="/" className="text-button">Back to Recall</Link></p></article>;
}
export function ContactPage() {
  return <Legal eyebrow="CONTACT" title="Get in touch">
    <p>This is a placeholder contact page. Add the address, email, or form you want people to use.</p>
    <p><strong>Email</strong> — hello@example.com</p>
    <p><strong>Location</strong> — Your city, country</p>
  </Legal>;
}
export function TermsPage() {
  return <Legal eyebrow="LEGAL" title="Terms of use">
    <p>This is a template. Replace it with the terms that apply to your deployment of Recall.</p>
    <p>1. You are responsible for the content you publish and the people you invite.</p>
    <p>2. Private folders stay private unless you change visibility or share access.</p>
    <p>3. Add payment, acceptable-use, and liability language here before a public launch.</p>
  </Legal>;
}
export function PrivacyPage() {
  return <Legal eyebrow="LEGAL" title="Privacy">
    <p>This is a template. Describe what you store (accounts, cards, images), where it lives, and how to request deletion.</p>
    <p>Recall stores session cookies, folder content, and optional images you upload. Study progress is per account.</p>
    <p>Add a data-retention and contact section before you collect real user data at scale.</p>
  </Legal>;
}

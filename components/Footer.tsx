import Link from "next/link";
import { SITE } from "@/lib/site";

export default function Footer() {
  return (
    <footer className="footer">
      <div className="container">
        <div className="footer-grid">
          <div className="footer-brand">
            <Link href="/" className="brand" aria-label="OddsOracle home">
              <span className="brand-logo">O</span>
              <span>{SITE.name}</span>
            </Link>
            <p style={{ marginTop: 14 }}>
              Free multi-sport betting predictions and analysis. Built to be
              honest, clear and useful — no guarantees, just value.
            </p>
          </div>

          <div>
            <h4>Predictions</h4>
            <ul>
              <li><Link href="/predictions/">Today&rsquo;s Picks</Link></li>
              <li><Link href="/predictions/football/">Football</Link></li>
              <li><Link href="/predictions/basketball/">Basketball</Link></li>
              <li><Link href="/predictions/tennis/">Tennis</Link></li>
              <li><Link href="/predictions/other/">More Sports</Link></li>
            </ul>
          </div>

          <div>
            <h4>Company</h4>
            <ul>
              <li><Link href="/about/">About</Link></li>
              <li><Link href="/contact/">Contact</Link></li>
              <li><Link href="/responsible-gambling/">Responsible Gambling</Link></li>
              <li><Link href="/faq/">FAQ</Link></li>
            </ul>
          </div>

          <div>
            <h4>Legal</h4>
            <ul>
              <li><Link href="/terms/">Terms of Use</Link></li>
              <li><Link href="/privacy/">Privacy Policy</Link></li>
              <li><Link href="/disclaimer/">Disclaimer</Link></li>
            </ul>
          </div>
        </div>

        <div className="footer-bottom">
          <span>© {SITE.foundedYear} {SITE.name}. All rights reserved.</span>
          <span>You must be 18+ to gamble. Please bet responsibly.</span>
        </div>
      </div>
    </footer>
  );
}

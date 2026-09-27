import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function TermsOfService() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14">
        <button onClick={() => setLocation("/")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display font-black text-lg uppercase tracking-wide">Terms of Service</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">
        <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest">Last updated: July 5, 2026</p>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">1. Acceptance</h2>
          <p>By creating an account or using Intermingled, you agree to these Terms of Service and our Privacy Policy. If you do not agree, do not use the service.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">2. Eligibility</h2>
          <p>You must be at least 18 years old to use Intermingled. By using the service, you represent that you are 18 or older. We reserve the right to terminate accounts where underage use is discovered.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">3. Account Rules</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>You must provide accurate information. Fake profiles, impersonation, or catfishing is prohibited.</li>
            <li>You are responsible for all activity under your account.</li>
            <li>One account per person. Multiple accounts will be terminated.</li>
            <li>You must not share your account with others.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">4. Acceptable Use</h2>
          <p>You agree not to:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li>Post or send illegal, hateful, abusive, sexually explicit, or harmful content.</li>
            <li>Harass, threaten, or intimidate other users.</li>
            <li>Share contact information (phone numbers, social handles, emails) in speed-dating chats.</li>
            <li>Use the service for commercial solicitation, spam, or bot activity.</li>
            <li>Attempt to reverse-engineer or circumvent any security features.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">5. The Speed-Dating Format</h2>
          <p>Intermingled's core experience is structured real-time speed dating. Choosers have a daily session limit. Suitors may be eliminated during sessions. Results and match decisions are final within each session. We do not guarantee matches or outcomes.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">6. Subscriptions & Billing</h2>
          <p>Some features require a paid subscription. Subscriptions auto-renew unless cancelled before the renewal date. Refunds are issued at our discretion. On iOS, subscriptions are managed through Apple and subject to Apple's refund policies.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">7. Content You Share</h2>
          <p>You retain ownership of content you post (photos, bio, messages). By posting, you grant Intermingled a non-exclusive license to display it to other users as part of the service. We may remove content that violates these Terms.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">8. Safety & Moderation</h2>
          <p>We encourage users to block and report inappropriate behavior. We review reports and may suspend or permanently ban accounts that violate these Terms. We are not liable for user conduct but are committed to keeping the platform safe.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">9. Disclaimer</h2>
          <p>Intermingled is provided "as is." We do not guarantee that you will find a match. We are not responsible for in-person meetings or relationships that develop from the platform. Always meet new people in public places and exercise caution.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">10. Termination</h2>
          <p>We reserve the right to suspend or terminate your account at any time for violation of these Terms. You may delete your account at any time from your profile settings.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">11. Changes</h2>
          <p>We may update these Terms. Continued use after changes constitutes acceptance. We will notify users of material changes via email or in-app notice.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">12. Contact</h2>
          <p>Questions? Contact us at <span className="text-primary font-mono">legal@intermingled.app</span></p>
        </section>

        <div className="pt-6 border-t border-border">
          <button onClick={() => setLocation("/privacy")} className="text-primary text-sm hover:underline">
            View Privacy Policy →
          </button>
        </div>
      </div>
    </div>
  );
}

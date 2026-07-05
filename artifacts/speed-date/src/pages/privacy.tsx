import { useLocation } from "wouter";
import { ArrowLeft } from "lucide-react";

export default function PrivacyPolicy() {
  const [, setLocation] = useLocation();
  return (
    <div className="min-h-[100dvh] bg-background text-foreground">
      <div className="sticky top-0 z-30 bg-background/90 backdrop-blur border-b border-border flex items-center gap-3 px-4 h-14">
        <button onClick={() => setLocation("/")} className="p-2 rounded-lg hover:bg-accent transition-colors">
          <ArrowLeft size={20} />
        </button>
        <span className="font-display font-black text-lg uppercase tracking-wide">Privacy Policy</span>
      </div>

      <div className="max-w-2xl mx-auto px-6 py-10 space-y-8 text-sm text-muted-foreground leading-relaxed">
        <p className="text-xs font-mono text-muted-foreground/50 uppercase tracking-widest">Last updated: July 5, 2026</p>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">1. Who We Are</h2>
          <p>Intermingled ("we", "our", or "us") operates the Intermingled dating platform, including the web app and mobile app. This policy explains how we collect, use, and protect your personal data.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">2. Data We Collect</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong className="text-foreground">Account data:</strong> name, email address, date of birth (for 18+ verification), and profile photos you upload.</li>
            <li><strong className="text-foreground">Profile data:</strong> bio, personality quiz answers, gender, dating preferences, and profile prompts.</li>
            <li><strong className="text-foreground">Usage data:</strong> messages sent during speed-dating sessions (retained for moderation), match history, and likes.</li>
            <li><strong className="text-foreground">Device data:</strong> push notification tokens (mobile), device type, and app version.</li>
            <li><strong className="text-foreground">Payment data:</strong> subscription status. Payment details are handled by Stripe and never stored by us.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">3. How We Use Your Data</h2>
          <ul className="space-y-2 list-disc list-inside">
            <li>To match you with compatible users using our personality-based algorithm.</li>
            <li>To operate real-time speed-dating sessions and direct messaging.</li>
            <li>To send push notifications about matches and messages (mobile only, with your permission).</li>
            <li>To enforce our safety rules including age verification, blocking, and reporting.</li>
            <li>To process subscription payments via Stripe.</li>
            <li>To detect and prevent abuse, spam, and policy violations.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">4. Data Sharing</h2>
          <p>We do not sell your personal data. We share data only with:</p>
          <ul className="space-y-2 list-disc list-inside">
            <li><strong className="text-foreground">Clerk</strong> — authentication provider.</li>
            <li><strong className="text-foreground">Stripe</strong> — payment processor.</li>
            <li><strong className="text-foreground">Expo</strong> — push notification delivery (mobile).</li>
            <li>Law enforcement when required by law.</li>
          </ul>
          <p>Other users see only what you choose to share publicly: your name, photos, bio, age, gender, and profile prompts. Your email is never visible to other users.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">5. Data Retention</h2>
          <p>Your profile data is kept while your account is active. Session messages are retained for 90 days for moderation purposes. You may request deletion of your account and all associated data at any time by contacting us.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">6. Your Rights</h2>
          <p>Depending on your location, you may have the right to access, correct, delete, or export your personal data. To exercise these rights, contact us at the address below. We will respond within 30 days.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">7. Children</h2>
          <p>Intermingled is strictly for users 18 years and older. We do not knowingly collect data from anyone under 18. If we discover an underage account, it will be immediately deleted.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">8. Security</h2>
          <p>We use industry-standard encryption and security practices to protect your data. However, no system is completely secure — please use a strong password and keep your account credentials private.</p>
        </section>

        <section className="space-y-3">
          <h2 className="font-display font-black text-lg text-foreground uppercase tracking-wide">9. Contact</h2>
          <p>Questions or requests? Reach us at <span className="text-primary font-mono">privacy@intermingled.app</span></p>
        </section>

        <div className="pt-6 border-t border-border">
          <button onClick={() => setLocation("/terms")} className="text-primary text-sm hover:underline">
            View Terms of Service →
          </button>
        </div>
      </div>
    </div>
  );
}

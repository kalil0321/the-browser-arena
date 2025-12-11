import type { Metadata } from "next";
import { SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Privacy Policy",
  description: "Privacy Policy for The Browser Arena - Learn how we collect, use, and protect your personal information.",
};

export default function PrivacyPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground p-4">
      <div className="flex-1 overflow-y-auto">
        <div className="container py-8 space-y-8 mx-auto max-w-4xl font-default">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Privacy Policy</h1>
            <p className="text-muted-foreground mt-2">
              Last updated: October 29, 2025
            </p>
          </div>

          <Separator />

          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. Information We Collect</h2>
              <p className="text-foreground/90 leading-relaxed">
                We collect information that you provide directly to us, including when you create an account, use our services, or communicate with us. This may include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>Name and email address</li>
                <li>Account credentials</li>
                <li>Usage data and preferences</li>
                <li>Communications and interactions with our service</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">2. How We Use Your Information</h2>
              <p className="text-foreground/90 leading-relaxed">
                We use the information we collect to:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>Provide, maintain, and improve our services</li>
                <li>Process and complete transactions</li>
                <li>Send you technical notices and support messages</li>
                <li>Respond to your comments and questions</li>
                <li>Protect against fraudulent or illegal activity</li>
                <li>Comply with legal obligations</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">3. Information Sharing and Disclosure</h2>
              <p className="text-foreground/90 leading-relaxed">
                We may share your personal information with third parties,  in the following circumstances:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>With your consent or at your direction</li>
                <li>With service providers who perform services on our behalf</li>
                <li>To comply with legal obligations or respond to lawful requests</li>
                <li>To protect the rights, property, and safety of us, our users, or others</li>
                <li>In connection with a merger, sale, or acquisition of all or a portion of our business</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">4. Data Security</h2>
              <p className="text-foreground/90 leading-relaxed">
                We take reasonable measures to help protect your personal information from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction. However, no security system is impenetrable and we cannot guarantee the security of our systems.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">5. Data Retention</h2>
              <p className="text-foreground/90 leading-relaxed">
                We store your personal information for as long as necessary to provide our services, comply with legal obligations, resolve disputes, and enforce our agreements. When we no longer need your information, we will securely delete or anonymize it.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">6. Your Rights and Choices</h2>
              <p className="text-foreground/90 leading-relaxed">
                You have certain rights regarding your personal information, including:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>Access and receive a copy of your personal information</li>
                <li>Correct or update inaccurate information</li>
                <li>Request deletion of your personal information</li>
                <li>Object to or restrict certain processing of your information</li>
                <li>Withdraw consent where we rely on consent to process your information</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">7. Cookies and Tracking Technologies</h2>
              <p className="text-foreground/90 leading-relaxed">
                We use cookies and similar tracking technologies to collect information about your browsing activities. You can control cookies through your browser settings, but disabling cookies may affect your ability to use certain features of our service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">8. Children's Privacy</h2>
              <p className="text-foreground/90 leading-relaxed">
                Our service is not directed to children under 13 years of age. We do not knowingly collect personal information from children under 13. If you become aware that a child has provided us with personal information, please contact us.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">9. Changes to This Privacy Policy</h2>
              <p className="text-foreground/90 leading-relaxed">
                We may update this privacy policy from time to time. We will notify you of any changes by posting the new privacy policy on this page and updating the "Last updated" date. You are advised to review this privacy policy periodically for any changes.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">10. Contact Us</h2>
              <p className="text-foreground/90 leading-relaxed">
                If you have any questions about this privacy policy or our practices, please contact us through the contact information provided on our website.
              </p>
            </section>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

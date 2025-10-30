import type { Metadata } from "next";
import { SidebarInset } from "@/components/ui/sidebar";
import { Separator } from "@/components/ui/separator";

export const metadata: Metadata = {
  title: "Terms of Service",
  description: "Terms of Service for The Browser Arena - Read our terms and conditions for using our platform.",
};

export default function TermsPage() {
  return (
    <SidebarInset className="flex flex-1 flex-col overflow-hidden bg-background text-foreground p-4">
      <div className="flex-1 overflow-y-auto">
        <div className="container py-8 space-y-8 mx-auto max-w-4xl font-default">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Terms of Service</h1>
            <p className="text-muted-foreground mt-2">
              Last updated: October 29, 2025
            </p>
          </div>

          <Separator />

          <div className="space-y-6">
            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">1. Acceptance of Terms</h2>
              <p className="text-foreground/90 leading-relaxed">
                By accessing and using this service, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by the above, please do not use this service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">2. Use License</h2>
              <p className="text-foreground/90 leading-relaxed">
                Permission is granted to temporarily access the materials (information or software) on this service for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title, and under this license you may not:
              </p>
              <ul className="list-disc list-inside space-y-2 text-foreground/90 ml-4">
                <li>Modify or copy the materials</li>
                <li>Use the materials for any commercial purpose, or for any public display (commercial or non-commercial)</li>
                <li>Attempt to decompile or reverse engineer any software contained in the service</li>
                <li>Remove any copyright or other proprietary notations from the materials</li>
                <li>Transfer the materials to another person or "mirror" the materials on any other server</li>
              </ul>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">3. Disclaimer</h2>
              <p className="text-foreground/90 leading-relaxed">
                The materials on this service are provided on an 'as is' basis. We make no warranties, expressed or implied, and hereby disclaim and negate all other warranties including, without limitation, implied warranties or conditions of merchantability, fitness for a particular purpose, or non-infringement of intellectual property or other violation of rights.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">4. Limitations</h2>
              <p className="text-foreground/90 leading-relaxed">
                In no event shall we or our suppliers be liable for any damages (including, without limitation, damages for loss of data or profit, or due to business interruption) arising out of the use or inability to use the materials on this service, even if we or an authorized representative has been notified orally or in writing of the possibility of such damage.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">5. Accuracy of Materials</h2>
              <p className="text-foreground/90 leading-relaxed">
                The materials appearing on this service could include technical, typographical, or photographic errors. We do not warrant that any of the materials on its service are accurate, complete or current. We may make changes to the materials contained on its service at any time without notice.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">6. Links</h2>
              <p className="text-foreground/90 leading-relaxed">
                We have not reviewed all of the sites linked to its service and are not responsible for the contents of any such linked site. The inclusion of any link does not imply endorsement by us of the site. Use of any such linked website is at the user's own risk.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">7. Modifications</h2>
              <p className="text-foreground/90 leading-relaxed">
                We may revise these terms of service for its service at any time without notice. By using this service you are agreeing to be bound by the then current version of these terms of service.
              </p>
            </section>

            <section className="space-y-4">
              <h2 className="text-2xl font-semibold">8. Governing Law</h2>
              <p className="text-foreground/90 leading-relaxed">
                These terms and conditions are governed by and construed in accordance with the laws and you irrevocably submit to the exclusive jurisdiction of the courts in that location.
              </p>
            </section>
          </div>
        </div>
      </div>
    </SidebarInset>
  );
}

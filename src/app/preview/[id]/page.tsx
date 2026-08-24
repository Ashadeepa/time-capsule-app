import { getCapsuleById } from "@/lib/capsules";
import { buildEmailHtml, buildSubject } from "@/lib/mailer";
import { notFound } from "next/navigation";
import Link from "next/link";

export default async function PreviewPage({ params }: { params: { id: string } }) {
  const capsule = await getCapsuleById(params.id);

  if (!capsule) notFound();

  if (capsule.status !== "delivered") {
    return (
      <div className="max-w-2xl mx-auto px-6 py-16 text-center">
        <h1 className="text-2xl font-semibold mb-3">Not delivered yet</h1>
        <p className="text-ink/70 mb-6">
          This letter is still sealed and scheduled for{" "}
          {new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(capsule.deliveryDate)}.
        </p>
        <Link href="/my-letters" className="text-sm underline">
          Back to my letters
        </Link>
      </div>
    );
  }

  const html = buildEmailHtml(capsule);
  const subject = buildSubject(capsule);

  return (
    <div className="max-w-2xl mx-auto px-6 py-12">
      <p className="text-xs text-ink/40 mb-1">Simulated inbox preview</p>
      <h1 className="text-lg font-medium mb-6">{subject}</h1>
      <div
        className="rounded-xl border border-ink/10 overflow-hidden"
        dangerouslySetInnerHTML={{ __html: html }}
      />
      <div className="mt-8">
        <Link href="/my-letters" className="text-sm underline">
          Back to my letters
        </Link>
      </div>
    </div>
  );
}

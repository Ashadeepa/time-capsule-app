import { getCapsuleById } from "@/lib/capsules";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ConfirmPage({ params }: { params: { id: string } }) {
  const capsule = await getCapsuleById(params.id);

  if (!capsule) notFound();

  const formattedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(
    capsule.deliveryDate
  );

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="text-5xl mb-4">🕯️</div>
      <h1 className="text-2xl font-semibold mb-3">Your letter has been sealed.</h1>
      <p className="text-ink/70 leading-relaxed mb-8">
        &ldquo;{capsule.title}&rdquo; will be delivered to <strong>{capsule.recipientEmail}</strong> on{" "}
        <strong>{formattedDate}</strong>. It can&apos;t be opened or edited before then — that&apos;s
        the whole point.
      </p>

      <div className="flex flex-col sm:flex-row gap-3 justify-center">
        <Link
          href="/my-letters"
          className="px-5 py-2.5 rounded-md border border-ink/20 text-sm font-medium hover:bg-white transition-colors"
        >
          Track your letters
        </Link>
        <Link
          href="/"
          className="px-5 py-2.5 rounded-md bg-seal text-cream text-sm font-medium hover:bg-seal/90 transition-colors"
        >
          Write another
        </Link>
      </div>

      <p className="text-xs text-ink/40 mt-10">
        Demo mode: since this is a prototype, you can also{" "}
        <Link href={`/preview/${capsule.id}`} className="underline">
          jump ahead and see what the delivery would look like
        </Link>{" "}
        instead of waiting for the real date.
      </p>
    </div>
  );
}

import { getCapsuleById } from "@/lib/capsules";
import Link from "next/link";
import { notFound } from "next/navigation";

export default async function ConfirmPage({ params }: { params: { id: string } }) {
  const capsule = await getCapsuleById(params.id);

  if (!capsule) notFound();

  const formattedDate = new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(
    capsule.deliveryDate
  );
  const formattedEndDate = capsule.recurrenceEndDate
    ? new Intl.DateTimeFormat("en-IN", { dateStyle: "long" }).format(capsule.recurrenceEndDate)
    : null;

  const recipientList =
    capsule.recipientEmails.length === 1
      ? capsule.recipientEmails[0]
      : capsule.recipientEmails.length === 2
      ? capsule.recipientEmails.join(" and ")
      : `${capsule.recipientEmails.slice(0, -1).join(", ")}, and ${capsule.recipientEmails.at(-1)}`;

  return (
    <div className="max-w-2xl mx-auto px-6 py-16 text-center">
      <div className="text-5xl mb-4">🕯️</div>
      <h1 className="text-2xl font-semibold mb-3">Your letter has been sealed.</h1>
      <p className="text-ink/70 leading-relaxed mb-8">
        &ldquo;{capsule.title}&rdquo; will be delivered to <strong>{recipientList}</strong> on{" "}
        <strong>{formattedDate}</strong>
        {capsule.recurrence !== "none" && formattedEndDate && (
          <>
            {" "}
            — and repeats every {capsule.recurrence === "yearly" ? "year" : "month"} until{" "}
            <strong>{formattedEndDate}</strong>
          </>
        )}
        . It can&apos;t be opened or edited before then — that&apos;s the whole point.
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

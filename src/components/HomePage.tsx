/**
 * HomePage — the rep's landing page.
 *
 * Shows: goal tracker, company goal card, in-play section,
 * KPI rewards leaderboard, and the "Earnie Spotlight" (shoutout feed).
 */

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <h2 className="text-2xl font-bold">Welcome back</h2>

      {/* Goal Tracker */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-3">My Goals</h3>
        <p className="text-muted-foreground text-sm">
          Your personal KPI targets and progress will appear here once goals are set.
        </p>
      </section>

      {/* In-Play Section */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-3">In Play</h3>
        <p className="text-muted-foreground text-sm">
          Active challenges, battles, and power wheel events you are participating in.
        </p>
      </section>

      {/* KPI Rewards Leaderboard */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-3">KPI Rewards Leaderboard</h3>
        <p className="text-muted-foreground text-sm">
          Top earners from automatic KPI coin triggers this period.
        </p>
      </section>

      {/* Live Activity / Spotlight */}
      <section className="rounded-lg border border-border bg-card p-6">
        <h3 className="text-lg font-semibold mb-3">Spotlight</h3>
        <p className="text-muted-foreground text-sm">
          Recent wins, shoutouts, and activity across your organization.
        </p>
      </section>
    </div>
  );
}

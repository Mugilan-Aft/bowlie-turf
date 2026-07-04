import { Link } from "@tanstack/react-router";

export function Footer() {
  return (
    <footer className="border-t border-border bg-surface">
      <div className="container-page py-14">
        <div className="grid gap-10 md:grid-cols-4">
          <div>
            <div className="flex items-center gap-2 font-display text-lg font-bold">
              <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-sm">
                T
              </span>
              Bowlie
            </div>
            <p className="mt-3 max-w-xs text-sm text-muted-foreground">
              The premium way to book turfs, fill squads, and run tournaments.
            </p>
          </div>

          <FooterCol
            title="Players"
            items={[
              { to: "/browse", label: "Browse turfs" },
              { to: "/tournaments", label: "Tournaments" },
              { to: "/live-scores", label: "Live scores" },
            ]}
          />
          <FooterCol
            title="Owners"
            items={[
              { to: "/owner-onboarding", label: "List your turf" },
              { to: "/owner/dashboard", label: "Owner dashboard" },
            ]}
          />
          <FooterCol
            title="Company"
            items={[
              { to: "/", label: "About" },
              { to: "/", label: "Support" },
              { to: "/", label: "Terms" },
            ]}
          />
        </div>
        <div className="mt-10 flex flex-col gap-2 border-t border-border pt-6 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p>© {new Date().getFullYear()} Bowlie. All rights reserved.</p>
          <p>Crafted for players, owners, and operators.</p>
        </div>
      </div>
    </footer>
  );
}

function FooterCol({
  title,
  items,
}: {
  title: string;
  items: { to: string; label: string }[];
}) {
  return (
    <div>
      <h4 className="text-sm font-semibold tracking-wide text-foreground">{title}</h4>
      <ul className="mt-3 space-y-2 text-sm text-muted-foreground">
        {items.map((i) => (
          <li key={i.label}>
            <Link to={i.to} className="hover:text-foreground transition-colors">
              {i.label}
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

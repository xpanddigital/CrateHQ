export default function Home() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-background">
      <div className="text-center max-w-xl mx-auto">
        <h1 className="text-4xl font-bold mb-4 font-[var(--font-heading)] italic">Welcome to Flank</h1>
        <p className="text-muted-foreground mb-8">
          Flank is your music catalog CRM and outreach automation platform.
        </p>
        <div className="flex gap-4 justify-center">
          <a
            href="/login"
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
          >
            Login
          </a>
          <a
            href="/signup"
            className="px-6 py-3 border border-input rounded-lg hover:bg-accent transition-colors"
          >
            Sign Up
          </a>
        </div>
      </div>
    </div>
  )
}

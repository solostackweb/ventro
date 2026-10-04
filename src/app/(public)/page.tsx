import Link from 'next/link';
import { Button } from '@/components/ui/Button';
import { Badge } from '@/components/ui/Badge';
import { Card, CardContent } from '@/components/ui/Card';
import { cn } from '@/lib/utils/helpers';

const FEATURES = [
  {
    title: 'Verified Funding Rounds',
    description: 'Every round backed by primary sources — company announcements, SEC filings, investor blogs. No fabricated amounts, no undisclosed sums presented as zero.',
    icon: 'shield-check',
  },
  {
    title: 'Stated vs. Inferred Theses',
    description: 'Fund\'s own words (blog posts, interviews) separated from observed patterns (portfolio clustering). Methodology, period, and sample size always shown.',
    icon: 'brain',
  },
  {
    title: 'Deduplicated News Feed',
    description: 'Cluster duplicate coverage into one story. See timeline of sources, which claims each supports, and "last checked" timestamps.',
    icon: 'newspaper',
  },
  {
    title: 'Personalized Workspace',
    description: 'Follow funds/companies, set AI topics/geographies/stages, save patterns, configure alerts. "Why am I seeing this?" on every card.',
    icon: 'user-cog',
  },
  {
    title: 'Evidence-Backed Patterns',
    description: 'Patterns show qualifying events, baseline, counterexamples, confidence, and coverage. Admin review gate for high-impact interpretations.',
    icon: 'bar-chart-2',
  },
  {
    title: 'Community Discussion',
    description: 'Threaded discussions on companies, funds, and patterns. Private notes stay private. Moderation with audit trail.',
    icon: 'message-square',
  },
];

const PRICING_NOTE = 'Single plan: $10/month USD. Masters\' Union students: 10-day full access via verified @mastersunion.org email (no card). No annual tiers.';

export default function LandingPage() {
  return (
    <div className="flex flex-col">
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-b from-accent-blue/5 via-bg-primary to-bg-primary py-20 lg:py-32">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <Badge variant="blue" className="mb-6" dot>New: AI Investment Intelligence Platform</Badge>
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-text-primary mb-6">
              Two questions.<br />
              <span className="text-accent-blue">Inspectable evidence.</span>
            </h1>
            <p className="text-lg sm:text-xl text-text-secondary mb-10 max-w-2xl mx-auto">
              Where are investors investing? What are they looking for? Verified AI funding rounds, 
              investor theses, and market patterns — every claim traced to a primary source.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
              <Link href="/signup">
                <Button size="lg" className="w-full sm:w-auto">
                  Start Free →
                </Button>
              </Link>
              <Link href="/news">
                <Button variant="secondary" size="lg" className="w-full sm:w-auto">
                  Explore Feed
                </Button>
              </Link>
            </div>
            <p className="mt-6 text-sm text-text-muted">{PRICING_NOTE}</p>
          </div>
        </div>
      </section>

      {/* Interactive Example */}
      <section className="py-16 lg:py-24 bg-bg-secondary">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-center mb-12">See how it works</h2>
          <div className="max-w-4xl mx-auto">
            <Card className="overflow-hidden">
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div className="flex items-center gap-3">
            <Badge variant="purple">Foundation Models</Badge>
                    <Badge variant="verified" dot>Verified</Badge>
                    <span className="text-text-muted text-sm">2h ago · 3 sources</span>
                  </div>
                  <h3 className="text-xl font-semibold">Sequoia leads $6.6B round in OpenAI at $157B valuation</h3>
                  <p className="text-text-secondary">
                    OpenAI raises largest private round ever. Sequoia Capital leads with participation from Thrive Capital, NVIDIA, Microsoft, and others. 
                    Funds earmarked for compute infrastructure and AGI research.
                  </p>
                  <div className="flex flex-wrap gap-2 text-sm text-text-muted">
                    <span>🏢 OpenAI</span>
                    <span>💰 Series B</span>
                    <span>💵 $6.6B</span>
                    <span>👥 Sequoia (lead), Thrive, NVIDIA</span>
                    <span>🏷️ Foundation Models</span>
                    <span>🌍 US</span>
                  </div>
                  <div className="pt-4 border-t border-border-default flex flex-wrap gap-3">
                    <Button variant="ghost" size="sm">Why am I seeing this?</Button>
                    <Button variant="ghost" size="sm">Follow OpenAI</Button>
                    <Button variant="ghost" size="sm">Follow Sequoia</Button>
                    <Button variant="ghost" size="sm">Save</Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold mb-4">Built for AI founders, investors, and researchers</h2>
            <p className="text-lg text-text-secondary max-w-2xl mx-auto">
              Every feature designed around evidence, not hype. Fast scan first, depth on demand.
            </p>
          </div>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map((feature, index) => (
              <Card key={index} className="h-full hover:shadow-lg transition-shadow">
                <CardContent className="p-6">
                  <div className="w-10 h-10 rounded-lg bg-accent-blue/10 flex items-center justify-center mb-4">
                    <svg className="w-6 h-6 text-accent-blue" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d={feature.icon === 'shield-check' ? "M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" : feature.icon === 'brain' ? "M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" : feature.icon === 'newspaper' ? "M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 00-2-2H9a2 2 0 00-2 2v9a2 2 0 002 2h2m-4-4h.01" : feature.icon === 'user-cog' ? "M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" : feature.icon === 'bar-chart-2' ? "M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" : "M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"} />
                    </svg>
                  </div>
                  <h3 className="text-lg font-semibold mb-2">{feature.title}</h3>
                  <p className="text-text-secondary">{feature.description}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      </section>

      {/* How it works flow */}
      <section className="py-16 lg:py-24 bg-bg-secondary">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">From news to insight in 4 steps</h2>
          <div className="grid md:grid-cols-4 gap-6">
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-accent-blue/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-accent-blue">1</div>
              <h3 className="text-lg font-semibold mb-2">Collect</h3>
              <p className="text-text-secondary">Official RSS feeds, APIs, and regulatory sources. No bulk scraping. Source rights tracked per connector.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-accent-green/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-accent-green">2</div>
              <h3 className="text-lg font-semibold mb-2">Extract</h3>
              <p className="text-text-secondary">LLM extracts structured facts with evidence spans. Validated against 100-item evaluation set. Hallucinations rejected.</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-accent-amber/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-accent-amber">3</div>
              <h3 className="text-lg font-semibold mb-2">Verify</h3>
              <p className="text-text-secondary">Multi-source corroboration. Conflicts flagged. Stated vs. inferred theses separated. Unknowns labeled &ldquo;not disclosed.&rdquo;</p>
            </div>
            <div className="text-center p-6">
              <div className="w-16 h-16 rounded-2xl bg-accent-purple/10 flex items-center justify-center mx-auto mb-4 text-2xl font-bold text-accent-purple">4</div>
              <h3 className="text-lg font-semibold mb-2">Personalize</h3>
              <p className="text-text-secondary">Shared corpus powers your workspace. Follows, topics, alerts, saved items. &ldquo;Why am I seeing this?&rdquo; on every card.</p>
            </div>
          </div>
        </div>
      </section>

      {/* Coverage & Limitations */}
      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <h2 className="text-3xl font-bold text-center mb-12">Transparent coverage & limitations</h2>
          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">50 AI-Focused VCs</h3>
                <p className="text-text-secondary text-sm">Sequoia, a16z, Lightspeed, Peak XV, Radical, Air Street, and more. Stated + observed theses tracked.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">50 AI Companies</h3>
                <p className="text-text-secondary text-sm">Foundation models, infra, apps, robotics. India coverage: Sarvam, Krutrim, Yellow.ai, Observe.AI.</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">83+ Source Connectors</h3>
                <p className="text-text-secondary text-sm">RSS feeds, GitHub, Hugging Face, SEC EDGAR, SEBI, PIB, Hacker News, Tavily/Firecrawl (capped).</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="p-6">
                <h3 className="font-semibold mb-3">YC AI Batches</h3>
                <p className="text-text-secondary text-sm">W24, S24, W25, S25 tracked manually. Official YC directory access pending permission.</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="mt-12 p-6 bg-bg-secondary rounded-xl border border-border-default">
            <h3 className="font-semibold mb-4">What we don&apos;t promise (yet)</h3>
            <ul className="grid md:grid-cols-2 gap-3 text-sm text-text-secondary">
              <li>• Exhaustive coverage of all private investments</li>
              <li>• Proprietary deal-flow or undisclosed valuations</li>
              <li>• Guaranteed real-time updates (GitHub Actions scheduling)</li>
              <li>• Investor recommendation engine or &ldquo;best investor&rdquo; scores</li>
              <li>• Bulk republishing of third-party articles</li>
              <li>• Mobile app or large-scale social network</li>
            </ul>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-16 lg:py-24 bg-accent-blue text-white">
        <div className="mx-auto max-w-3xl px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold mb-4">Ready to find your investors?</h2>
          <p className="text-blue-100 mb-8">
            Join founders and analysts tracking AI funding with evidence. 
            10-day access for Masters&apos; Union students. Coming soon: $10/month for everyone.
          </p>
          <Link href="/signup">
            <Button size="lg" variant="secondary" className="bg-white text-accent-blue hover:bg-blue-50 w-full sm:w-auto">
              Create Free Account
            </Button>
          </Link>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 border-t border-border-default bg-bg-secondary">
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8">
            <div>
              <h3 className="font-bold text-lg mb-4">Ventro</h3>
              <p className="text-text-secondary text-sm mb-4">
                AI investment intelligence with inspectable evidence. 
                Where investors invest. What they look for.
              </p>
            </div>
            <div>
              <h4 className="font-medium mb-3">Product</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><Link href="/news" className="hover:text-accent-blue">News Feed</Link></li>
                <li><Link href="/companies" className="hover:text-accent-blue">Companies</Link></li>
                <li><Link href="/investors" className="hover:text-accent-blue">Investors</Link></li>
                <li><Link href="/patterns" className="hover:text-accent-blue">Patterns</Link></li>
                <li><Link href="/pricing" className="hover:text-accent-blue">Pricing</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Company</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><Link href="/about" className="hover:text-accent-blue">About</Link></li>
                <li><Link href="/blog" className="hover:text-accent-blue">Blog</Link></li>
                <li><Link href="/careers" className="hover:text-accent-blue">Careers</Link></li>
                <li><Link href="/contact" className="hover:text-accent-blue">Contact</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-medium mb-3">Legal</h4>
              <ul className="space-y-2 text-sm text-text-secondary">
                <li><Link href="/privacy" className="hover:text-accent-blue">Privacy</Link></li>
                <li><Link href="/terms" className="hover:text-accent-blue">Terms</Link></li>
                <li><Link href="/cookies" className="hover:text-accent-blue">Cookies</Link></li>
                <li><Link href="/security" className="hover:text-accent-blue">Security</Link></li>
              </ul>
            </div>
          </div>
          <div className="mt-8 pt-8 border-t border-border-default text-center text-sm text-text-muted">
            <p>© 2024 Ventro. All rights reserved. Not financial advice.</p>
          </div>
        </div>
      </footer>
    </div>
  );
}

'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { MultiSelect } from '@/components/ui/Select';
import { Card, CardContent, CardHeader } from '@/components/ui/Card';
import { Badge } from '@/components/ui/Badge';
import { cn, formatCurrency } from '@/lib/utils/helpers';
import { UserProfile, AITheme, Geography, Stage, UserRole } from '@/types';

const TOPIC_OPTIONS = [
  { value: 'foundation_models', label: 'Foundation Models' },
  { value: 'infrastructure', label: 'Infrastructure' },
  { value: 'applications', label: 'Applications' },
  { value: 'robotics', label: 'Robotics' },
  { value: 'hardware', label: 'Hardware' },
  { value: 'research', label: 'Research' },
];

const GEOGRAPHY_OPTIONS = [
  { value: 'us', label: 'United States' },
  { value: 'india', label: 'India' },
  { value: 'eu', label: 'European Union' },
  { value: 'israel', label: 'Israel' },
  { value: 'canada', label: 'Canada' },
  { value: 'uk', label: 'United Kingdom' },
  { value: 'sea', label: 'Southeast Asia' },
  { value: 'global', label: 'Global' },
];

const STAGE_OPTIONS = [
  { value: 'pre_seed', label: 'Pre-seed' },
  { value: 'seed', label: 'Seed' },
  { value: 'series_a', label: 'Series A' },
  { value: 'series_b', label: 'Series B' },
  { value: 'series_c', label: 'Series C' },
  { value: 'growth', label: 'Growth' },
  { value: 'public', label: 'Public' },
];

export default function SettingsPage() {
  const router = useRouter();
  const supabase = createClient();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<'profile' | 'billing' | 'personalization' | 'alerts'>('profile');
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Form states
  const [role, setRole] = useState<UserProfile['role']>(null);
  const [ai_topics, setAiTopics] = useState<AITheme[]>([]);
  const [geographies, setGeographies] = useState<Geography[]>([]);
  const [stages, setStages] = useState<Stage[]>([]);
  const [followedFunds, setFollowedFunds] = useState<string[]>([]);
  const [followedCompanies, setFollowedCompanies] = useState<string[]>([]);

  useEffect(() => {
    const fetchProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push('/login?redirect=/settings');
        return;
      }
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', user.id)
        .single();
      if (error) {
        console.error('Profile fetch error:', error);
        router.push('/onboarding');
        return;
      }
      setProfile(data);
      setRole(data.role);
      setAiTopics(data.ai_topics || []);
      setGeographies(data.geographies || []);
      setStages(data.stages || []);
      
      // Fetch follows
      const { data: follows } = await supabase
        .from('follows')
        .select('entity_type, entity_id')
        .eq('user_id', user.id);
      setFollowedFunds(follows?.filter((f: { entity_type: string }) => f.entity_type === 'fund').map((f: { entity_id: string }) => f.entity_id) || []);
      setFollowedCompanies(follows?.filter((f: { entity_type: string }) => f.entity_type === 'company').map((f: { entity_id: string }) => f.entity_id) || []);
      
      setLoading(false);
    };
    fetchProfile();
  }, [router, supabase]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    
    const { error } = await supabase
      .from('user_profiles')
      .update({
        role,
        ai_topics,
        geographies,
        stages,
      })
      .eq('id', profile.id);

    if (error) {
      setMessage({ type: 'error', text: error.message });
    } else {
      setMessage({ type: 'success', text: 'Profile saved successfully' });
      setProfile({ ...profile, role, ai_topics, geographies, stages });
    }
    setSaving(false);
  };

  const handleSaveFollows = async () => {
    if (!profile) return;
    setSaving(true);
    setMessage(null);
    
    // Delete existing follows
    await supabase.from('follows').delete().eq('user_id', profile.id);
    
    // Insert new follows
    const follows = [
      ...followedFunds.map(entity_id => ({ user_id: profile.id, entity_type: 'fund' as const, entity_id })),
      ...followedCompanies.map(entity_id => ({ user_id: profile.id, entity_type: 'company' as const, entity_id })),
    ];
    
    if (follows.length > 0) {
      const { error } = await supabase.from('follows').insert(follows);
      if (error) {
        setMessage({ type: 'error', text: error.message });
        setSaving(false);
        return;
      }
    }
    
    setMessage({ type: 'success', text: 'Follows updated successfully' });
    setSaving(false);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin w-8 h-8 border-4 border-accent-blue border-t-transparent rounded-full" />
      </div>
    );
  }

  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  const getEntitlementLabel = (entitlement: string) => {
    switch (entitlement) {
      case 'preview': return 'Preview';
      case 'student_trial': return '20-Day Trial';
      case 'subscribed': return 'Subscribed';
      default: return 'Unknown';
    }
  };

  const getEntitlementColor = (entitlement: string) => {
    switch (entitlement) {
      case 'preview': return 'bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-100';
      case 'student_trial': return 'bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-100';
      case 'subscribed': return 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className="min-h-screen bg-bg-primary">
      <header className="sticky top-0 z-40 border-b border-border-default bg-bg-primary/80 backdrop-blur-sm">
        <div className="mx-auto max-w-4xl px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <Link href="/dashboard" className="text-xl font-bold text-text-primary">Ventro</Link>
          <div className="flex items-center gap-3">
            <span className={cn('px-2 py-1 text-xs font-medium rounded-full', getEntitlementColor(profile.entitlement))}>
              {getEntitlementLabel(profile.entitlement)}
            </span>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2">Settings</h1>
          <p className="text-text-secondary">Manage your account, preferences, and alerts</p>
        </div>

        {message && (
          <div className={cn(
            'mb-6 p-4 rounded-lg text-sm',
            message.type === 'success' ? 'bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-100' : 'bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-100'
          )} role="alert">
            {message.text}
          </div>
        )}

        {/* Tab Navigation */}
        <div className="border-b border-border-default mb-8">
          <nav className="flex gap-1" aria-label="Settings sections">
            {[
              { id: 'profile', label: 'Profile' },
              { id: 'personalization', label: 'Personalization' },
              { id: 'alerts', label: 'Alerts' },
              { id: 'billing', label: 'Billing' },
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={cn(
                  'px-4 py-2 text-sm font-medium border-b-2 transition-colors',
                  activeTab === tab.id
                    ? 'text-accent-blue border-accent-blue'
                    : 'text-text-secondary border-transparent hover:text-text-primary hover:border-border-default'
                )}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Profile Information</h2>
              <p className="text-text-secondary text-sm">Your basic account details</p>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="grid sm:grid-cols-2 gap-4">
                <Input
                  label="Email"
                  value={profile.email}
                  disabled
                  hint="Cannot change email from here"
                />
                <Input
                  label="Role"
                  value={role || 'Not set'}
                  disabled
                  hint="Change via onboarding reset"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-text-secondary mb-2">Role</label>
                <div className="grid gap-3" role="radiogroup" aria-label="Select your role">
                  {[
                    { value: 'founder', label: 'AI Founder', description: 'Building an AI company' },
                    { value: 'investor', label: 'Investor', description: 'Investing in AI companies' },
                    { value: 'analyst', label: 'Analyst', description: 'Researching AI markets' },
                    { value: 'student', label: 'Student', description: 'Learning about AI investing' },
                    { value: 'other', label: 'Other', description: 'Other interest in AI' },
                  ].map((r) => (
                    <button
                      key={r.value}
                      type="button"
                      onClick={() => setRole(r.value as UserRole)}
                      className={cn(
                        'relative p-4 rounded-xl border-2 text-left transition-all',
                        role === r.value
                          ? 'border-accent-blue bg-accent-blue/5'
                          : 'border-border-default hover:border-accent-blue/50'
                      )}
                      role="radio"
                      aria-checked={role === r.value}
                    >
                      <div className="flex items-start gap-3">
                        <div className={cn(
                          'w-5 h-5 rounded-full border-2 flex-shrink-0 mt-0.5',
                          role === r.value
                            ? 'border-accent-blue bg-accent-blue'
                            : 'border-border-default'
                        )}>
                          {role === r.value && (
                            <svg className="w-full h-full text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="font-medium">{r.label}</div>
                          <div className="text-sm text-text-muted">{r.description}</div>
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <Button onClick={handleSaveProfile} loading={saving} className="w-full sm:w-auto">
                Save Changes
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Personalization Tab */}
        {activeTab === 'personalization' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">AI Topics</h2>
                <p className="text-text-secondary text-sm">Weight topics to personalize your feed (0-1 scale)</p>
              </CardHeader>
              <CardContent className="space-y-4">
                {TOPIC_OPTIONS.map((topic) => (
                  <div key={topic.value} className="flex items-center gap-4">
                    <div className="w-48">
                      <label className="text-sm font-medium">{topic.label}</label>
                    </div>
                    <input
                      type="range"
                      min="0"
                      max="1"
                      step="0.1"
                      value={ai_topics.includes(topic.value as AITheme) ? 0.6 : 0}
                      onChange={(e) => {
                        const val = parseFloat(e.currentTarget.value);
                        if (val > 0) {
                          setAiTopics(prev => Array.from(new Set([...prev, topic.value as AITheme])));
                        } else {
                          setAiTopics(prev => prev.filter(t => t !== topic.value));
                        }
                      }}
                      className="flex-1"
                    />
                    <span className="text-sm text-text-muted w-10 text-right">
                      {ai_topics.includes(topic.value as AITheme) ? 'On' : 'Off'}
                    </span>
                  </div>
                ))}
                <Button variant="secondary" onClick={() => {
                  setAiTopics([]);
                  setGeographies([]);
                  setStages([]);
                }}>
                  Reset to Defaults
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Geographies</h2>
                <p className="text-text-secondary text-sm">Regions you follow</p>
              </CardHeader>
              <CardContent>
                <MultiSelect
                  label="Geographies"
                  options={GEOGRAPHY_OPTIONS}
                  value={geographies}
                  onChange={setGeographies}
                  placeholder="Select geographies..."
                  maxSelections={8}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Company Stages</h2>
                <p className="text-text-secondary text-sm">Investment stages of interest</p>
              </CardHeader>
              <CardContent>
                <MultiSelect
                  label="Stages"
                  options={STAGE_OPTIONS}
                  value={stages}
                  onChange={setStages}
                  placeholder="Select stages..."
                  maxSelections={7}
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Followed Funds</h2>
                <p className="text-text-secondary text-sm">Maximum 10</p>
              </CardHeader>
              <CardContent>
                <MultiSelect
                  options={[
                    { value: 'sequoia', label: 'Sequoia Capital' },
                    { value: 'a16z', label: 'Andreessen Horowitz' },
                    { value: 'lightspeed', label: 'Lightspeed' },
                    { value: 'peak-xv', label: 'Peak XV Partners' },
                    { value: 'greylock', label: 'Greylock' },
                    { value: 'index', label: 'Index Ventures' },
                    { value: 'radical', label: 'Radical Ventures' },
                    { value: 'air-street', label: 'Air Street Capital' },
                    { value: 'accel-india', label: 'Accel India' },
                    { value: 'nvidia', label: 'NVIDIA (NVentures)' },
                  ]}
                  value={followedFunds}
                  onChange={setFollowedFunds}
                  placeholder="Search funds..."
                  maxSelections={10}
                />
                <Button variant="secondary" onClick={handleSaveFollows} className="mt-4">
                  Save Follows
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Followed Companies</h2>
                <p className="text-text-secondary text-sm">Maximum 10</p>
              </CardHeader>
              <CardContent>
                <MultiSelect
                  options={[
                    { value: 'openai', label: 'OpenAI' },
                    { value: 'anthropic', label: 'Anthropic' },
                    { value: 'mistral', label: 'Mistral AI' },
                    { value: 'figure', label: 'Figure AI' },
                    { value: 'sarvam', label: 'Sarvam AI' },
                    { value: 'cohere', label: 'Cohere' },
                    { value: 'databricks', label: 'Databricks' },
                    { value: 'glean', label: 'Glean' },
                    { value: 'perplexity', label: 'Perplexity' },
                    { value: 'elevenlabs', label: 'ElevenLabs' },
                    { value: 'runway', label: 'Runway' },
                  ]}
                  value={followedCompanies}
                  onChange={setFollowedCompanies}
                  placeholder="Search companies..."
                  maxSelections={10}
                />
                <Button variant="secondary" onClick={handleSaveFollows} className="mt-4">
                  Save Follows
                </Button>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Alerts Tab */}
        {activeTab === 'alerts' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Alert Rules</h2>
                <p className="text-text-secondary text-sm">Configure when and how you get notified</p>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <p className="text-text-secondary text-sm">Alert rules will appear here after you follow funds/companies. Each rule can be configured for:</p>
                  <ul className="list-disc list-inside space-y-2 text-text-secondary text-sm mt-2">
                    <li>Trigger: New funding round, new portfolio company, thesis update, any announcement</li>
                    <li>Frequency: Instant, Daily digest, Weekly digest</li>
                    <li>Channels: Email, In-app notification</li>
                    <li>Topic filter: Only alert for specific AI topics</li>
                  </ul>
                  <Link href="/investors">
                    <Button variant="secondary" className="mt-4">Browse Investors to Follow</Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Notification Preferences</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Email notifications</p>
                    <p className="text-sm text-text-muted">Receive alerts via email</p>
                  </div>
                  <Button variant="ghost" size="sm">Configure</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">In-app notifications</p>
                    <p className="text-sm text-text-muted">Receive alerts in the app</p>
                  </div>
                  <Button variant="ghost" size="sm">Configure</Button>
                </div>
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">Daily digest time</p>
                    <p className="text-sm text-text-muted">When to send daily summary</p>
                  </div>
                  <Button variant="ghost" size="sm">08:00 UTC</Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Subscription</h2>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="p-4 bg-bg-secondary rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-semibold">Current Plan</p>
                      <p className="text-sm text-text-muted">
                        {profile.entitlement === 'student_trial' 
                          ? `20-Day Trial — Expires ${profile.trial_expires_at ? new Date(profile.trial_expires_at).toLocaleDateString() : 'soon'}`
                          : profile.entitlement === 'subscribed'
                            ? 'Pro — $10/month'
                            : 'Preview (Free)'}
                      </p>
                    </div>
                    <Badge variant={profile.entitlement === 'subscribed' ? 'green' : profile.entitlement === 'student_trial' ? 'purple' : 'blue'}>
                      {getEntitlementLabel(profile.entitlement)}
                    </Badge>
                  </div>
                </div>

                {profile.entitlement !== 'subscribed' && (
                  <div className="border-t border-border-default pt-4">
                    <h3 className="font-semibold mb-3">Upgrade to Pro</h3>
                    <p className="text-text-secondary mb-4">
                      Get full access to investor theses, round details, patterns, alerts, and community.
                    </p>
                    <div className="grid sm:grid-cols-2 gap-4">
                      <Card>
                        <CardContent className="p-6 text-center">
                          <span className="text-3xl font-bold text-text-primary">$10</span>
                          <span className="text-text-muted">/month</span>
                          <ul className="mt-4 space-y-2 text-sm text-text-secondary text-left">
                            <li>✓ Full profiles</li>
                            <li>✓ Stated + Observed thesis</li>
                            <li>✓ Patterns & alerts</li>
                            <li>✓ Unlimited saves</li>
                            <li>✓ Community posting</li>
                          </ul>
                          <Button className="mt-4 w-full" disabled>Coming Soon</Button>
                        </CardContent>
                      </Card>
                      {profile.entitlement === 'student_trial' && (
                        <Card>
                          <CardContent className="p-6 text-center">
                            <span className="text-3xl font-bold text-accent-purple">Free</span>
                            <span className="text-text-muted">20-day trial</span>
                            <ul className="mt-4 space-y-2 text-sm text-text-secondary text-left">
                              <li>✓ Same as Pro</li>
                              <li>✓ No card required</li>
                              <li>✓ Auto-expires</li>
                              <li>✓ Data preserved</li>
                            </ul>
                            <Badge variant="purple" className="mt-4 inline-block">Active</Badge>
                          </CardContent>
                        </Card>
                      )}
                    </div>
                  </div>
                )}

                {profile.entitlement === 'subscribed' && (
                  <div className="border-t border-border-default pt-4">
                    <Button variant="secondary" className="w-full">Manage Billing (Coming Soon)</Button>
                    <p className="text-sm text-text-muted text-center mt-2">Billing portal will be available after payment provider integration</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}
      </main>
    </div>
  );
}

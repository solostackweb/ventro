import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
    // Check admin authorization
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    
    const isAdmin = profile?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    const { type } = body;
    
    const results: Record<string, any> = {};
    
    if (!type || type === 'funding') {
      const { extractFundingEvidence } = await import('@/lib/ingestion/funding-extractor');
      await extractFundingEvidence();
      results.funding = 'completed';
    }
    
    if (!type || type === 'thesis') {
      const { extractStatedThesisForAllFunds, computeObservedThesisForAllFunds } = await import('@/lib/ingestion/thesis-extractor');
      await extractStatedThesisForAllFunds();
      await computeObservedThesisForAllFunds();
      results.thesis = 'completed';
    }
    
    if (!type || type === 'patterns') {
      const { runPatternDetectionPipeline } = await import('@/lib/ingestion/pattern-detector');
      await runPatternDetectionPipeline();
      results.patterns = 'completed';
    }
    
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}

export async function GET() {
  try {
    const supabase = await createServerClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('role')
      .eq('id', user.id)
      .single();
    if (profile?.role !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const { data: rounds, error } = await supabase
      .from('funding_rounds')
      .select('*')
      .order('announced_date', { ascending: false })
      .limit(50);
    
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }
    
    const { data: participants } = await supabase
      .from('round_participants')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(100);
    
    const { data: thesis } = await supabase
      .from('stated_thesis')
      .select('*')
      .order('extracted_at', { ascending: false })
      .limit(50);
    
    const { data: observed } = await supabase
      .from('observed_thesis')
      .select('*')
      .order('last_computed', { ascending: false })
      .limit(50);
    
    const { data: patterns } = await supabase
      .from('patterns')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(50);
    
    return NextResponse.json({ 
      rounds: rounds || [], 
      participants: participants || [],
      thesis: thesis || [],
      observed_thesis: observed || [],
      patterns: patterns || [],
    });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

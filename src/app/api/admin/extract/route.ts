import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { extractFundingEvents } from '@/lib/ingestion/funding-extractor';
import { extractStatedThesisForAllFunds, computeObservedThesisForAllFunds } from '@/lib/ingestion/thesis-extractor';
import { runPatternDetectionPipeline } from '@/lib/ingestion/pattern-detector';

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
    
    // Simple admin check - in production use proper role system
    const isAdmin = user.email?.includes('admin') || profile?.role === 'admin';
    if (!isAdmin) {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }
    
    const body = await request.json();
    const { type } = body;
    
    const results: Record<string, any> = {};
    
    if (!type || type === 'funding') {
      await extractFundingEvents();
      results.funding = 'completed';
    }
    
    if (!type || type === 'thesis') {
      await extractStatedThesisForAllFunds();
      await computeObservedThesisForAllFunds();
      results.thesis = 'completed';
    }
    
    if (!type || type === 'patterns') {
      await runPatternDetectionPipeline();
      results.patterns = 'completed';
    }
    
    return NextResponse.json({ success: true, results });
  } catch (error) {
    console.error('Extraction error:', error);
    return NextResponse.json({ error: 'Extraction failed' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const supabase = await createServerClient();
    
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
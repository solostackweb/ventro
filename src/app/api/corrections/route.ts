import { createServerClient } from '@/lib/supabase/server';
import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';

const correctionSchema = z.object({
  entity_type: z.enum(['story', 'company', 'fund']),
  entity_id: z.string().uuid(),
  field: z.string().min(1).max(100),
  current_value: z.string().optional(),
  suggested_value: z.string().min(1).max(500),
  evidence_url: z.string().url().optional().or(z.literal('')),
  evidence_text: z.string().max(2000).optional(),
  reporter_email: z.string().email().optional(),
});

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validated = correctionSchema.parse(body);

    const supabase = await createServerClient();

    const { data, error } = await supabase
      .from('admin_audit_log')
      .insert({
        entity_type: validated.entity_type,
        entity_id: validated.entity_id,
        action: 'correction_reported',
        changes: {
          field: validated.field,
          current_value: validated.current_value,
          suggested_value: validated.suggested_value,
          evidence_url: validated.evidence_url || null,
          evidence_text: validated.evidence_text || null,
          reporter_email: validated.reporter_email || null,
        },
        performed_by: validated.reporter_email || 'anonymous',
      })
      .select()
      .single();

    if (error) {
      console.error('Correction API error:', error);
      return NextResponse.json({ error: 'Failed to submit correction' }, { status: 500 });
    }

    return NextResponse.json({ 
      success: true, 
      correction_id: data.id,
      message: 'Correction submitted for review' 
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid correction data', details: error.issues }, { status: 400 });
    }
    console.error('Correction API error:', error);
    return NextResponse.json({ error: 'Failed to submit correction' }, { status: 500 });
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const entityType = searchParams.get('entity_type');
    const entityId = searchParams.get('entity_id');

    const supabase = await createServerClient();

    let query = supabase
      .from('admin_audit_log')
      .select('*')
      .eq('action', 'correction_reported')
      .order('created_at', { ascending: false })
      .limit(50);

    if (entityType) query = query.eq('entity_type', entityType);
    if (entityId) query = query.eq('entity_id', entityId);

    const { data, error } = await query;

    if (error) {
      console.error('Correction fetch error:', error);
      return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 });
    }

    return NextResponse.json({ corrections: data || [] });
  } catch (error) {
    console.error('Correction fetch error:', error);
    return NextResponse.json({ error: 'Failed to fetch corrections' }, { status: 500 });
  }
}
